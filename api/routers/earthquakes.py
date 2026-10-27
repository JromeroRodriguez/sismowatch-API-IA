"""Earthquake events, KPIs, and TimeSeries analytics router."""

from datetime import datetime, timezone
import math
from typing import Optional
from fastapi import APIRouter, Depends, Query
from auth import require_viewer_or_admin
from database import fetch_all, fetch_one
from schemas import (
    KPIsResponse,
    PaginatedEarthquakes,
    TimeSeriesPoint,
    User,
)

router = APIRouter(prefix="/api", tags=["Sismos y KPIs"])


@router.get(
    "/kpis",
    response_model=KPIsResponse,
    summary="Indicadores clave del dashboard (KPIs)",
)
def get_kpis(_: User = Depends(require_viewer_or_admin)):
    """Calcula indicadores en tiempo real a partir de la capa Gold:

    - Total eventos en últimas 24h
    - Magnitud máxima y promedio en 24h
    - Alertas de tsunami en 24h
    - Fecha y hora del evento más reciente
    - Frescura del dato (minutos desde el último evento registrado)
    - Puntaje de calidad más reciente
    - Total de sismos almacenados en Gold
    """
    # 24-hour window metrics
    kpi_sql = """
        SELECT
            COUNT(*) FILTER (WHERE time >= NOW() - INTERVAL '24 hours') AS total_24h,
            MAX(mag) FILTER (WHERE time >= NOW() - INTERVAL '24 hours') AS max_mag_24h,
            ROUND(AVG(mag) FILTER (WHERE time >= NOW() - INTERVAL '24 hours')::numeric, 2) AS avg_mag_24h,
            COUNT(*) FILTER (WHERE time >= NOW() - INTERVAL '24 hours' AND tsunami = 1) AS tsunami_24h,
            MAX(time) AS latest_event_time,
            COUNT(*) AS total_gold
        FROM gold.earthquakes;
    """
    row = fetch_one(kpi_sql) or {}

    # Latest quality score
    quality_sql = """
        SELECT quality_score, freshness_minutes
        FROM gold.quality_metrics
        ORDER BY execution_timestamp DESC
        LIMIT 1;
    """
    quality_row = fetch_one(quality_sql) or {}

    latest_time = row.get("latest_event_time")
    freshness = None
    if latest_time:
        diff = (datetime.now(timezone.utc) - latest_time).total_seconds() / 60.0
        freshness = round(max(0.0, diff), 2)
    elif quality_row.get("freshness_minutes") is not None:
        freshness = float(quality_row.get("freshness_minutes"))

    return KPIsResponse(
        total_events_24h=int(row.get("total_24h") or 0),
        max_magnitude_24h=(
            float(row.get("max_mag_24h")) if row.get("max_mag_24h") is not None else None
        ),
        avg_magnitude_24h=(
            float(row.get("avg_mag_24h")) if row.get("avg_mag_24h") is not None else None
        ),
        tsunami_alerts_24h=int(row.get("tsunami_24h") or 0),
        latest_event_time=latest_time,
        quality_score=(
            float(quality_row.get("quality_score"))
            if quality_row.get("quality_score") is not None
            else 100.0
        ),
        data_freshness_minutes=freshness,
        total_events_gold=int(row.get("total_gold") or 0),
    )


@router.get(
    "/events",
    response_model=PaginatedEarthquakes,
    summary="Listado paginado de eventos sísmicos con filtros",
)
def get_events(
    page: int = Query(1, ge=1, description="Número de página"),
    page_size: int = Query(20, ge=1, le=500, description="Registros por página"),
    min_mag: Optional[float] = Query(None, description="Magnitud mínima"),
    max_mag: Optional[float] = Query(None, description="Magnitud máxima"),
    search: Optional[str] = Query(None, description="Búsqueda por texto en lugar (place)"),
    start_date: Optional[str] = Query(None, description="Fecha de inicio (ISO o YYYY-MM-DD)"),
    end_date: Optional[str] = Query(None, description="Fecha de fin (ISO o YYYY-MM-DD)"),
    _: User = Depends(require_viewer_or_admin),
):
    """Consulta paginada y filtrada sobre la capa Gold."""
    where_clauses = ["1=1"]
    params = {}

    if min_mag is not None:
        where_clauses.append("mag >= %(min_mag)s")
        params["min_mag"] = min_mag

    if max_mag is not None:
        where_clauses.append("mag <= %(max_mag)s")
        params["max_mag"] = max_mag

    if search:
        where_clauses.append("place ILIKE %(search)s")
        params["search"] = f"%{search.strip()}%"

    if start_date:
        where_clauses.append("time >= %(start_date)s::timestamp")
        params["start_date"] = start_date

    if end_date:
        where_clauses.append("time <= %(end_date)s::timestamp")
        params["end_date"] = end_date

    where_str = " AND ".join(where_clauses)

    # Count total
    count_sql = f"SELECT COUNT(*) AS total FROM gold.earthquakes WHERE {where_str};"
    count_row = fetch_one(count_sql, params)
    total = int(count_row.get("total", 0)) if count_row else 0

    total_pages = max(1, math.ceil(total / page_size))
    offset = (page - 1) * page_size

    # Fetch rows
    data_sql = f"""
        SELECT id, place, time, updated, latitude, longitude, depth_km,
               mag, mag_type, tsunami, sig, status, type AS event_type, url, curated_at AS ingested_at
        FROM gold.earthquakes
        WHERE {where_str}
        ORDER BY time DESC
        LIMIT %(limit)s OFFSET %(offset)s;
    """
    params["limit"] = page_size
    params["offset"] = offset

    rows = fetch_all(data_sql, params)

    return PaginatedEarthquakes(
        items=rows,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
    )


@router.get(
    "/stats/timeseries",
    response_model=list[TimeSeriesPoint],
    summary="Serie temporal agrupada para gráficos de actividad",
)
def get_timeseries(
    days: int = Query(7, ge=1, le=30, description="Días hacia atrás a agrupar"),
    interval: str = Query("hour", regex="^(hour|day)$", description="Intervalo de agregación"),
    _: User = Depends(require_viewer_or_admin),
):
    """Retorna conteos y magnitudes máximas/promedio agrupadas por hora o día

    para alimentar las gráficas de líneas y barras del frontend.
    """
    sql = f"""
        SELECT
            TO_CHAR(DATE_TRUNC('{interval}', time), 'YYYY-MM-DD"T"HH24:MI:SS') AS time_bucket,
            COUNT(*) AS count,
            MAX(mag) AS max_mag,
            ROUND(AVG(mag)::numeric, 2) AS avg_mag
        FROM gold.earthquakes
        WHERE time >= NOW() - INTERVAL '%(days)s days'
        GROUP BY DATE_TRUNC('{interval}', time)
        ORDER BY DATE_TRUNC('{interval}', time) ASC;
    """
    # Use direct formatting for safe interval enum, parameterized days
    query = f"""
        SELECT
            TO_CHAR(DATE_TRUNC(%(interval)s, time), 'YYYY-MM-DD"T"HH24:MI:SS') AS time_bucket,
            COUNT(*) AS count,
            MAX(mag) AS max_mag,
            ROUND(AVG(mag)::numeric, 2) AS avg_mag
        FROM gold.earthquakes
        WHERE time >= NOW() - (%(days)s || ' days')::interval
        GROUP BY DATE_TRUNC(%(interval)s, time)
        ORDER BY DATE_TRUNC(%(interval)s, time) ASC;
    """
    rows = fetch_all(query, {"interval": interval, "days": str(days)})
    return [
        TimeSeriesPoint(
            time_bucket=r["time_bucket"],
            count=int(r["count"]),
            max_mag=float(r["max_mag"]) if r["max_mag"] is not None else None,
            avg_mag=float(r["avg_mag"]) if r["avg_mag"] is not None else None,
        )
        for r in rows
    ]
