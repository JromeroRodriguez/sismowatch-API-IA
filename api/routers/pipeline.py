"""Pipeline status and data quality metrics router."""

from fastapi import APIRouter, Depends
from auth import require_viewer_or_admin
from database import fetch_all, fetch_one
from schemas import PipelineStatusItem, PipelineSummary, QualityMetricItem, User

router = APIRouter(prefix="/api/pipeline", tags=["Estado del Pipeline y Calidad"])


@router.get(
    "/status",
    response_model=PipelineSummary,
    summary="Estado de ejecución de los DAGs y última métrica de calidad",
)
def get_pipeline_status(_: User = Depends(require_viewer_or_admin)):
    """Retorna el estado operativo de los DAGs de Airflow (usgs_ingest_dag,

    earthquakes_processing_dag, historical_backfill_dag) y la última métrica de calidad
    registrada por Pandera en gold.quality_metrics.
    """
    statuses_sql = """
        SELECT dag_id, state, last_run_id, last_success_at, last_failure_at, updated_at
        FROM gold.pipeline_status
        ORDER BY updated_at DESC;
    """
    status_rows = fetch_all(statuses_sql)

    quality_sql = """
        SELECT
            run_id,
            dag_id,
            execution_timestamp,
            total_records,
            rules_evaluated,
            rules_passed,
            rules_rejected,
            quality_score,
            freshness_minutes,
            status,
            details
        FROM gold.quality_metrics
        ORDER BY execution_timestamp DESC
        LIMIT 1;
    """
    quality_row = fetch_one(quality_sql)

    return PipelineSummary(
        statuses=[
            PipelineStatusItem(
                dag_id=r["dag_id"],
                state=r["state"],
                last_run_id=r["last_run_id"],
                last_success_at=r["last_success_at"],
                last_failure_at=r["last_failure_at"],
                updated_at=r["updated_at"],
            )
            for r in status_rows
        ],
        latest_quality=(
            QualityMetricItem(
                run_id=quality_row["run_id"],
                dag_id=quality_row["dag_id"],
                execution_timestamp=quality_row["execution_timestamp"],
                total_records=quality_row["total_records"],
                rules_evaluated=quality_row["rules_evaluated"],
                rules_passed=quality_row["rules_passed"],
                rules_rejected=quality_row["rules_rejected"],
                quality_score=float(quality_row["quality_score"]),
                freshness_minutes=(
                    float(quality_row["freshness_minutes"])
                    if quality_row.get("freshness_minutes") is not None
                    else None
                ),
                status=quality_row["status"],
                details=quality_row.get("details"),
            )
            if quality_row
            else None
        ),
    )
