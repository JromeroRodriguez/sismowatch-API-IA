"""### Historical Earthquakes Backfill DAG (Parametrized & Idempotent)

Performs a historical backfill of earthquakes from the official USGS query API
for a customizable time window (default: last 30 days, min magnitude 2.5).

- **Source**: USGS FDSNWS Query API (`/fdsnws/event/1/query`)
- **Parameters**:
  - `days_back`: Number of days in the past to query (default: 30)
  - `min_magnitude`: Minimum earthquake magnitude filter (default: 2.5)
  - `start_date`: Optional explicit start date (`YYYY-MM-DD`)
  - `end_date`: Optional explicit end date (`YYYY-MM-DD`)
- **Architecture**: Ingests into Bronze, transforms & validates into Silver, and promotes valid to Gold.
- **Idempotency**: All writes use `ON CONFLICT (id) DO UPDATE` to ensure zero duplicates.
- **Trigger**: Manual / Parametrized (`schedule=None`).
"""

from datetime import datetime, timedelta, timezone
import logging
import os
import requests
from airflow.decorators import dag, task, task_group
from airflow.models.param import Param
from airflow.exceptions import AirflowFailException
from include.transformations import (
    upsert_bronze_records,
    clean_and_transform_features,
    upsert_silver_records,
    promote_silver_to_gold,
)
from include.quality import (
    validate_earthquakes_dataset,
    record_quality_metrics,
)
from include.alerts import task_failure_alert, pipeline_success_callback

logger = logging.getLogger("airflow.task")

USGS_HISTORICAL_URL = os.getenv(
    "USGS_HISTORICAL_URL",
    "https://earthquake.usgs.gov/fdsnws/event/1/query",
)

default_args = {
    "owner": "sismowatch",
    "depends_on_past": False,
    "email_on_failure": False,
    "email_on_retry": False,
    "retries": 2,
    "retry_delay": timedelta(seconds=30),
    "retry_exponential_backoff": True,
    "max_retry_delay": timedelta(minutes=5),
    "execution_timeout": timedelta(minutes=15),
    "on_failure_callback": task_failure_alert,
}


@dag(
    dag_id="historical_backfill_dag",
    default_args=default_args,
    description="Backfill historico parametrizado e idempotente de sismos (ultimos 30 dias)",
    schedule=None,
    start_date=datetime(2026, 1, 1),
    catchup=False,
    max_active_runs=1,
    params={
        "days_back": Param(
            default=30,
            type="integer",
            minimum=1,
            maximum=90,
            description="Numero de dias hacia atras a consultar",
        ),
        "min_magnitude": Param(
            default=2.5,
            type="number",
            minimum=0.0,
            maximum=10.0,
            description="Magnitud minima para filtrar sismos",
        ),
        "start_date": Param(
            default="",
            type=["string", "null"],
            description="Fecha inicial explicita (YYYY-MM-DD). Si se omite, se calcula desde days_back",
        ),
        "end_date": Param(
            default="",
            type=["string", "null"],
            description="Fecha final explicita (YYYY-MM-DD). Si se omite, se usa la fecha actual",
        ),
    },
    tags=["backfill", "historical", "medallion", "usgs"],
    on_success_callback=pipeline_success_callback,
    doc_md=__doc__,
)
def historical_backfill_pipeline():

    @task_group(group_id="historical_ingestion")
    def ingest_group():

        @task(execution_timeout=timedelta(minutes=10))
        def fetch_and_store_historical(**context) -> dict:
            """Queries USGS historical API for the requested date window and loads to Bronze."""
            params = context["params"]
            days_back = int(params["days_back"])
            min_mag = float(params["min_magnitude"])
            start_date_str = str(params.get("start_date") or "").strip()
            end_date_str = str(params.get("end_date") or "").strip()

            now = datetime.now(timezone.utc)
            if not end_date_str:
                end_date_str = now.strftime("%Y-%m-%d")
            if not start_date_str:
                start_date_str = (now - timedelta(days=days_back)).strftime("%Y-%m-%d")

            logger.info(
                f"[BACKFILL] Starting USGS query: starttime={start_date_str}, "
                f"endtime={end_date_str}, minmagnitude={min_mag}"
            )

            query_params = {
                "format": "geojson",
                "starttime": start_date_str,
                "endtime": end_date_str,
                "minmagnitude": min_mag,
                "limit": 20000,
            }

            try:
                response = requests.get(USGS_HISTORICAL_URL, params=query_params, timeout=(10, 60))
                response.raise_for_status()
                data = response.json()
            except requests.exceptions.RequestException as e:
                logger.error(f"[BACKFILL_ERROR] Failed querying USGS historical catalog: {e}")
                raise

            features = data.get("features", [])
            total_fetched = len(features)
            logger.info(f"[BACKFILL] Fetched {total_fetched} historical events from USGS.")

            # Upsert into bronze.earthquakes_raw
            ingested_count = upsert_bronze_records(features, source="usgs_historical")
            logger.info(f"[BACKFILL] Ingested/Upserted {ingested_count} records into bronze.")

            return {
                "fetched_count": total_fetched,
                "ingested_count": ingested_count,
                "starttime": start_date_str,
                "endtime": end_date_str,
                "features": features[:1000],  # Pass sample or pass count
            }

        return fetch_and_store_historical()

    @task_group(group_id="historical_processing")
    def processing_group(ingest_summary: dict):

        @task(execution_timeout=timedelta(minutes=10))
        def process_and_validate_historical(ingest_summary: dict, **context) -> dict:
            """Transforms, validates with Pandera, and loads historical events into Silver and Gold."""
            dag_id = context["dag"].dag_id
            run_id = context["run_id"]

            features = ingest_summary.get("features", [])
            if not features:
                # If features were truncated from XCom, read directly from bronze
                from include.transformations import load_bronze_features_for_processing
                features = load_bronze_features_for_processing(limit=2000)

            logger.info(f"[BACKFILL] Transforming {len(features)} historical features.")
            df = clean_and_transform_features(features)

            # Quality validation with relaxed freshness for historical data
            df_validated, quality_summary = validate_earthquakes_dataset(
                df, dag_id=dag_id, run_id=run_id, freshness_max_minutes=999999.0
            )

            # Upsert into silver
            silver_count = upsert_silver_records(df_validated)

            # Promote valid records to gold
            gold_count = promote_silver_to_gold()

            # Record quality metrics
            record_quality_metrics(quality_summary)

            logger.info(
                f"[BACKFILL COMPLETE] Silver={silver_count}, Gold={gold_count}, "
                f"Quality Score={quality_summary['quality_score']}%"
            )

            return {
                "silver_count": silver_count,
                "gold_count": gold_count,
                "quality_score": quality_summary["quality_score"],
            }

        return process_and_validate_historical(ingest_summary)

    ingest_res = ingest_group()
    processing_group(ingest_res)


historical_backfill_pipeline()
