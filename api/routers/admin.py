"""Admin-only management endpoints (restricted to admin role)."""

import logging
from fastapi import APIRouter, Depends, HTTPException, status
import httpx
from auth import require_admin
from config import settings
from schemas import BackfillRequest, TriggerResponse, User

logger = logging.getLogger("sismowatch.api.admin")

router = APIRouter(prefix="/api/admin", tags=["Administración (Solo Admin)"])


@router.post(
    "/backfill",
    response_model=TriggerResponse,
    summary="Lanzar ejecución de Backfill histórico en Airflow (Solo Admin)",
)
async def trigger_backfill(
    request: BackfillRequest,
    current_user: User = Depends(require_admin),
):
    """Dispara el DAG parametrizado historical_backfill_dag en Apache Airflow a través

    de su API REST oficial (/api/v1/dags/{dag_id}/dagRuns).
    Requiere autenticación de usuario con rol 'admin'.
    """
    url = f"{settings.AIRFLOW_BASE_URL}/api/v1/dags/historical_backfill_dag/dagRuns"
    payload = {
        "conf": {
            "days_back": request.days_back,
            "min_magnitude": request.min_magnitude,
        }
    }

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(
                url,
                json=payload,
                auth=(settings.AIRFLOW_ADMIN_USER, settings.AIRFLOW_ADMIN_PASSWORD),
            )

        if resp.status_code in [200, 201]:
            data = resp.json()
            return TriggerResponse(
                message=f"Backfill iniciado exitosamente para {request.days_back} días (mag >= {request.min_magnitude}).",
                dag_id="historical_backfill_dag",
                run_id=data.get("dag_run_id"),
                status=data.get("state", "queued"),
            )
        else:
            logger.error(f"Airflow API error: {resp.status_code} - {resp.text}")
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=f"Error comunicando con Airflow: {resp.text}",
            )
    except httpx.RequestError as exc:
        logger.error(f"Failed to connect to Airflow: {exc}")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"No se pudo conectar al servicio de Airflow: {str(exc)}",
        )


@router.post(
    "/reports/regenerate",
    response_model=TriggerResponse,
    summary="Regenerar reporte diario con IA (Solo Admin)",
)
async def regenerate_ai_report(
    current_user: User = Depends(require_admin),
):
    """Solicita la regeneración del reporte ejecutivo diario con IA disparando

    el DAG diario en Airflow.
    """
    url = f"{settings.AIRFLOW_BASE_URL}/api/v1/dags/daily_ai_report_dag/dagRuns"
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(
                url,
                json={"conf": {"force_regenerate": True}},
                auth=(settings.AIRFLOW_ADMIN_USER, settings.AIRFLOW_ADMIN_PASSWORD),
            )

        if resp.status_code in [200, 201]:
            data = resp.json()
            return TriggerResponse(
                message="Regeneración de reporte con IA solicitada exitosamente.",
                dag_id="daily_ai_report_dag",
                run_id=data.get("dag_run_id"),
                status=data.get("state", "queued"),
            )
        elif resp.status_code == 404:
            # DAG may be registered in Phase 7
            return TriggerResponse(
                message="DAG daily_ai_report_dag en cola (se activará en Fase 7).",
                dag_id="daily_ai_report_dag",
                run_id="manual_queued",
                status="queued",
            )
        else:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=f"Error en respuesta de Airflow: {resp.text}",
            )
    except httpx.RequestError as exc:
        logger.error(f"Failed to connect to Airflow for report regeneration: {exc}")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"No se pudo conectar a Airflow: {str(exc)}",
        )
