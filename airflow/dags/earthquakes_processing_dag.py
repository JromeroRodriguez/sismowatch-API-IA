"""### Earthquakes Medallion Processing DAG

Downstream pipeline triggered automatically whenever new data lands in the
**Bronze** layer via Airflow Dataset scheduling.

- **Trigger**: `schedule=[Dataset("postgres://sismowatch/bronze/earthquakes_raw")]`
- **Silver step**: Cleans, parses coordinates, formats UTC timestamps, and upserts into `silver.earthquakes_clean`.
- **Gold step**: Promotes strictly valid records into `gold.earthquakes`.
- **Idempotency**: All database writes use `ON CONFLICT (id) DO UPDATE`.
"""

from datetime import datetime, timedelta
from airflow.decorators import dag, task, task_group
from airflow.datasets import Dataset
from include.transformations import (
    load_bronze_features_for_processing,
    clean_and_transform_features,
    upsert_silver_records,
    promote_silver_to_gold,
)

BRONZE_DATASET = Dataset("sismowatch://bronze/earthquakes_raw")

default_args = {
    "owner": "sismowatch",
    "depends_on_past": False,
    "email_on_failure": False,
    "email_on_retry": False,
    "retries": 2,
    "retry_delay": timedelta(seconds=20),
}


@dag(
    dag_id="earthquakes_processing_dag",
    default_args=default_args,
    description="Procesamiento Medallion: Bronze -> Silver (limpieza) -> Gold (curado)",
    schedule=[BRONZE_DATASET],
    start_date=datetime(2026, 1, 1),
    catchup=False,
    max_active_runs=1,
    tags=["transformation", "silver", "gold", "medallion"],
    doc_md=__doc__,
)
def earthquakes_processing_pipeline():

    @task_group(group_id="bronze_to_silver")
    def silver_processing_group():

        @task(execution_timeout=timedelta(minutes=3))
        def extract_bronze() -> list:
            """Extracts recent features from bronze.earthquakes_raw."""
            features = load_bronze_features_for_processing(limit=500)
            return features

        @task(execution_timeout=timedelta(minutes=3))
        def transform_and_load_silver(features: list) -> dict:
            """Cleans features using pandas and upserts into silver.earthquakes_clean."""
            if not features:
                return {"processed_count": 0}
            df = clean_and_transform_features(features)
            count = upsert_silver_records(df)
            return {"processed_count": count}

        raw_data = extract_bronze()
        return transform_and_load_silver(raw_data)

    @task_group(group_id="silver_to_gold")
    def gold_processing_group():

        @task(execution_timeout=timedelta(minutes=2))
        def load_to_gold() -> dict:
            """Promotes valid records from silver into gold.earthquakes."""
            count = promote_silver_to_gold()
            return {"curated_count": count, "timestamp": datetime.utcnow().isoformat()}

        return load_to_gold()

    silver_res = silver_processing_group()
    gold_res = gold_processing_group()

    silver_res >> gold_res


earthquakes_processing_pipeline()
