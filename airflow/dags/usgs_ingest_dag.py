"""### USGS Earthquakes Ingestion DAG (Robust Edition)

Extracts seismic event data from the USGS Earthquake API (last hour feed)
every 5 minutes and ingests raw GeoJSON payloads into the Medallion **Bronze** layer.

- **Cadence**: Every 5 minutes (`*/5 * * * *`)
- **Robustness**:
  - `retries`: 3 with exponential backoff (`retry_exponential_backoff=True`)
  - `execution_timeout`: 3 minutes
  - `max_active_runs`: 1 (prevents race conditions)
  - Explicit USGS error handling (timeouts, HTTP 5xx, network drops)
  - `on_failure_callback`: records failure state in `gold.pipeline_status` and logs alert
  - `on_success_callback`: updates `gold.pipeline_status` with latest successful run
- **Idempotency**: `ON CONFLICT (id) DO UPDATE` ensures repeated executions do not duplicate data.
- **Trigger**: Emits `Dataset("sismowatch://bronze/earthquakes_raw")` to trigger downstream DAGs.
"""

from datetime import datetime, timedelta
import logging
import os
import requests
from airflow.decorators import dag, task
from airflow.datasets import Dataset
from include.transformations import upsert_bronze_records
from include.alerts import task_failure_alert, pipeline_success_callback

logger = logging.getLogger("airflow.task")

BRONZE_DATASET = Dataset("sismowatch://bronze/earthquakes_raw")

USGS_API_URL = os.getenv(
    "USGS_API_URL",
    "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_hour.geojson",
)

default_args = {
    "owner": "sismowatch",
    "depends_on_past": False,
    "email_on_failure": False,
    "email_on_retry": False,
    "retries": 3,
    "retry_delay": timedelta(seconds=15),
    "retry_exponential_backoff": True,
    "max_retry_delay": timedelta(minutes=5),
    "execution_timeout": timedelta(minutes=3),
    "on_failure_callback": task_failure_alert,
}


@dag(
    dag_id="usgs_ingest_dag",
    default_args=default_args,
    description="Ingesta robusta de sismos desde USGS cada 5 min hacia Bronze con reintentos exponenciales",
    schedule="*/5 * * * *",
    start_date=datetime(2026, 1, 1),
    catchup=False,
    max_active_runs=1,
    tags=["ingestion", "bronze", "usgs", "robustness"],
    on_success_callback=pipeline_success_callback,
    doc_md=__doc__,
)
def usgs_ingest_pipeline():

    @task(execution_timeout=timedelta(minutes=2))
    def extract_usgs_feed() -> list:
        """Fetches the past hour earthquake GeoJSON feed from USGS with explicit error handling."""
        logger.info(f"Connecting to USGS feed: {USGS_API_URL}")
        try:
            response = requests.get(USGS_API_URL, timeout=(5, 30))
            response.raise_for_status()
            data = response.json()
            features = data.get("features", [])
            logger.info(f"Successfully retrieved {len(features)} features from USGS.")
            return features
        except requests.exceptions.Timeout as e:
            logger.error(f"[USGS_ERROR] USGS API connection timed out: {e}")
            raise
        except requests.exceptions.HTTPError as e:
            logger.error(f"[USGS_ERROR] USGS returned HTTP error status {response.status_code}: {e}")
            raise
        except requests.exceptions.RequestException as e:
            logger.error(f"[USGS_ERROR] Network or connection error communicating with USGS: {e}")
            raise

    @task(outlets=[BRONZE_DATASET], execution_timeout=timedelta(minutes=2))
    def load_to_bronze(features: list) -> dict:
        """Upserts raw GeoJSON features into bronze.earthquakes_raw.

        Emits BRONZE_DATASET to notify downstream transformation DAGs.
        """
        count = upsert_bronze_records(features, source="usgs_feed")
        logger.info(f"Upserted {count} records into bronze.earthquakes_raw.")
        return {"ingested_count": count, "timestamp": datetime.utcnow().isoformat()}

    raw_features = extract_usgs_feed()
    load_to_bronze(raw_features)


usgs_ingest_pipeline()
