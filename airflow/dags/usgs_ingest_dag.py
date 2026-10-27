"""### USGS Earthquakes Ingestion DAG

Extracts seismic event data from the USGS Earthquake API (last hour feed)
every 5 minutes and ingests the raw GeoJSON payloads into the Medallion **Bronze** layer.

- **Source**: USGS Earthquake Catalog (`all_hour.geojson`)
- **Target**: `bronze.earthquakes_raw`
- **Cadence**: Every 5 minutes (`*/5 * * * *`)
- **Idempotency**: `ON CONFLICT (id) DO UPDATE` ensures repeated runs do not duplicate data.
- **Trigger**: Publishes `Dataset("postgres://sismowatch/bronze/earthquakes_raw")` upon completion.
"""

from datetime import datetime, timedelta
import os
import requests
from airflow.decorators import dag, task
from airflow.datasets import Dataset
from include.transformations import upsert_bronze_records

# Airflow Dataset definition for event-driven downstream orchestration
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
}


@dag(
    dag_id="usgs_ingest_dag",
    default_args=default_args,
    description="Ingesta automatizada de sismos desde USGS cada 5 minutos hacia Bronze",
    schedule="*/5 * * * *",
    start_date=datetime(2026, 1, 1),
    catchup=False,
    max_active_runs=1,
    tags=["ingestion", "bronze", "usgs"],
    doc_md=__doc__,
)
def usgs_ingest_pipeline():

    @task(execution_timeout=timedelta(minutes=2))
    def extract_usgs_feed() -> list:
        """Fetches the past hour earthquake GeoJSON feed from USGS."""
        response = requests.get(USGS_API_URL, timeout=30)
        response.raise_for_status()
        data = response.json()
        features = data.get("features", [])
        return features

    @task(outlets=[BRONZE_DATASET], execution_timeout=timedelta(minutes=2))
    def load_to_bronze(features: list) -> dict:
        """Upserts raw GeoJSON features into bronze.earthquakes_raw.

        Emits BRONZE_DATASET to notify downstream transformation DAGs.
        """
        count = upsert_bronze_records(features, source="usgs_feed")
        return {"ingested_count": count, "timestamp": datetime.utcnow().isoformat()}

    raw_features = extract_usgs_feed()
    load_to_bronze(raw_features)


usgs_ingest_pipeline()
