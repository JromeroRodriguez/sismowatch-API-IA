"""Pipeline status and data quality metrics router."""

from typing import List
from fastapi import APIRouter, Depends
from auth import require_viewer_or_admin, require_admin
from database import fetch_all, fetch_one
from schemas import PipelineStatusItem, PipelineSummary, QualityMetricItem, QuarantineItem, User

router = APIRouter(prefix="/api/pipeline", tags=["Estado del Pipeline y Calidad"])
quality_router = APIRouter(prefix="/api/quality", tags=["Calidad de Datos y Cuarentena (Solo Admin)"])


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


@quality_router.get(
    "/quarantine",
    response_model=List[QuarantineItem],
    summary="Registros rechazados por calidad en cuarentena (Solo Admin)",
)
@router.get(
    "/quarantine",
    response_model=List[QuarantineItem],
    summary="Registros rechazados por calidad en cuarentena (Solo Admin)",
)
def get_quarantine_records(_: User = Depends(require_admin)):
    """Retorna los registros que no superaron las reglas de calidad de Pandera

    y fueron desviados a la tabla de cuarentena. Requiere rol 'admin'.
    """
    sql = """
        SELECT id, place, mag, latitude, longitude, depth_km, rejection_reason, rejected_at, raw_payload
        FROM gold.quality_quarantine
        ORDER BY rejected_at DESC
        LIMIT 100;
    """
    rows = fetch_all(sql)
    return [
        QuarantineItem(
            id=r["id"],
            place=r.get("place"),
            mag=float(r["mag"]) if r.get("mag") is not None else None,
            latitude=float(r["latitude"]) if r.get("latitude") is not None else None,
            longitude=float(r["longitude"]) if r.get("longitude") is not None else None,
            depth_km=float(r["depth_km"]) if r.get("depth_km") is not None else None,
            rejection_reason=r["rejection_reason"],
            rejected_at=r["rejected_at"],
            raw_payload=r.get("raw_payload"),
        )
        for r in rows
    ]

