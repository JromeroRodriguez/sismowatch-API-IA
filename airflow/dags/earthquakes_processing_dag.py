"""### Earthquakes Medallion Processing DAG with Pandera Data Quality Gate (Robust Edition)

Downstream pipeline triggered automatically whenever new data lands in the
**Bronze** layer via Airflow Dataset scheduling.

- **Trigger**: `schedule=[Dataset("sismowatch://bronze/earthquakes_raw")]`
- **Silver step**: Cleans, parses coordinates, formats UTC timestamps, runs **Pandera Quality Validation**, sets `is_valid`, and upserts into `silver.earthquakes_clean`.
- **Quality Gate step (BLOCKING)**: Evaluates overall batch quality and freshness. If quality score fails threshold, halts execution and blocks promotion to Gold.
- **Gold step**: Promotes strictly valid records (`WHERE is_valid = TRUE`) into `gold.earthquakes`.
- **Robustness**:
  - `retries`: 2 with exponential backoff (`retry_exponential_backoff=True`)
  - `execution_timeout`: 5 minutes
  - `max_active_runs`: 1
  - `on_failure_callback`: records failure in `gold.pipeline_status` and triggers alert
  - `on_success_callback`: updates `gold.pipeline_status`
- **Metrics**: Persists execution rules, passed/rejected counts, freshness, and score in `gold.quality_metrics`.
"""

from datetime import datetime, timedelta
import logging
from airflow.decorators import dag, task, task_group
from airflow.datasets import Dataset
from airflow.exceptions import AirflowFailException
from include.transformations import (
    load_bronze_features_for_processing,
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

BRONZE_DATASET = Dataset("sismowatch://bronze/earthquakes_raw")

default_args = {
    "owner": "sismowatch",
    "depends_on_past": False,
    "email_on_failure": False,
    "email_on_retry": False,
    "retries": 2,
    "retry_delay": timedelta(seconds=20),
    "retry_exponential_backoff": True,
    "max_retry_delay": timedelta(minutes=5),
    "execution_timeout": timedelta(minutes=5),
    "on_failure_callback": task_failure_alert,
}


@dag(
    dag_id="earthquakes_processing_dag",
    default_args=default_args,
    description="Procesamiento Medallion robusto con Quality Gate bloqueante y reintentos exponenciales",
    schedule=[BRONZE_DATASET],
    start_date=datetime(2026, 1, 1),
    catchup=False,
    max_active_runs=1,
    tags=["transformation", "silver", "gold", "quality", "pandera", "medallion", "robustness"],
    on_success_callback=pipeline_success_callback,
    doc_md=__doc__,
)
def earthquakes_processing_pipeline():

    @task_group(group_id="bronze_to_silver")
    def silver_processing_group():

        @task(execution_timeout=timedelta(minutes=3))
        def extract_bronze() -> list:
            """Extracts recent features from bronze.earthquakes_raw."""
            features = load_bronze_features_for_processing(limit=500)
            logger.info(f"Loaded {len(features)} features from bronze for silver transformation.")
            return features

        @task(execution_timeout=timedelta(minutes=3))
        def transform_and_validate_silver(features: list, **context) -> dict:
            """Cleans features, applies Pandera validation rules, and saves quality metrics."""
            if not features:
                logger.warning("No features found in bronze to process.")
                return {"processed_count": 0, "quality_score": 100.0, "status": "PASSED"}

            dag_id = context["dag"].dag_id
            run_id = context["run_id"]

            # 1. Transform raw GeoJSON into pandas DataFrame
            df = clean_and_transform_features(features)

            # 2. Apply Pandera quality validation & calculate metrics
            df_validated, quality_summary = validate_earthquakes_dataset(
                df, dag_id=dag_id, run_id=run_id
            )

            # 3. Upsert clean features into silver (including is_valid flag)
            count = upsert_silver_records(df_validated)
            logger.info(f"Upserted {count} clean records into silver.earthquakes_clean.")

            # 4. Save quality execution metrics into gold.quality_metrics
            record_quality_metrics(quality_summary)
            logger.info(f"Recorded quality metrics: Score={quality_summary['quality_score']}%, Status={quality_summary['status']}")

            return quality_summary

        raw_data = extract_bronze()
        return transform_and_validate_silver(raw_data)

    @task(execution_timeout=timedelta(minutes=1))
    def quality_gate(quality_summary: dict) -> dict:
        """Blocking Quality Gate: fails and stops execution if quality score is substandard.

        Ensures invalid batches never reach the Gold consumption layer.
        """
        score = quality_summary.get("quality_score", 0.0)
        status = quality_summary.get("status", "FAILED")
        rejected = quality_summary.get("rules_rejected", 0)

        if status == "FAILED" or score < 70.0:
            error_msg = (
                f"Quality Gate FAILED: Score {score}% is below threshold. "
                f"Rules rejected: {rejected}. Halting pipeline before Gold layer."
            )
            logger.error(error_msg)
            raise AirflowFailException(error_msg)

        logger.info(f"Quality Gate PASSED: Score {score}%. Proceeding to Gold layer.")
        return {"gate_passed": True, "score": score}

    @task_group(group_id="silver_to_gold")
    def gold_processing_group():

        @task(execution_timeout=timedelta(minutes=2))
        def load_to_gold() -> dict:
            """Promotes only valid records (is_valid = TRUE) into gold.earthquakes."""
            count = promote_silver_to_gold()
            logger.info(f"Promoted {count} curated records into gold.earthquakes.")
            return {"curated_count": count, "timestamp": datetime.utcnow().isoformat()}

        return load_to_gold()

    # Define task dependencies with blocking quality gate
    quality_summary = silver_processing_group()
    gate_result = quality_gate(quality_summary)
    gold_res = gold_processing_group()

    quality_summary >> gate_result >> gold_res


earthquakes_processing_pipeline()
