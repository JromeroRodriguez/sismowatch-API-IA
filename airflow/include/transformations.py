"""Data transformation module for USGS Earthquakes.

Converts nested GeoJSON payloads into flat, typed structures
following the Medallion architecture (Bronze -> Silver -> Gold).
"""

from datetime import datetime, timezone
import json
from typing import Any, Dict, List, Optional
import pandas as pd
from psycopg2.extras import execute_batch, execute_values
from include.db import get_db_connection


def epoch_ms_to_datetime(epoch_ms: Optional[int]) -> Optional[datetime]:
    """Converts epoch milliseconds to timezone-aware UTC datetime."""
    if epoch_ms is None:
        return None
    try:
        # USGS timestamps are in milliseconds
        return datetime.fromtimestamp(epoch_ms / 1000.0, tz=timezone.utc)
    except (ValueError, OSError, OverflowError):
        return None


def transform_geojson_feature(feature: Dict[str, Any]) -> Dict[str, Any]:
    """Transforms a single USGS GeoJSON feature into a flat dictionary

    conforming to the Silver layer schema.
    """
    props = feature.get("properties") or {}
    geom = feature.get("geometry") or {}
    coords = geom.get("coordinates") or [None, None, None]

    # Handle coordinates [longitude, latitude, depth_km]
    lon = float(coords[0]) if len(coords) > 0 and coords[0] is not None else 0.0
    lat = float(coords[1]) if len(coords) > 1 and coords[1] is not None else 0.0
    depth = float(coords[2]) if len(coords) > 2 and coords[2] is not None else 0.0

    # Ensure event ID
    event_id = str(feature.get("id") or props.get("id") or "").strip()

    # Dates
    time_dt = epoch_ms_to_datetime(props.get("time"))
    if time_dt is None:
        time_dt = datetime.now(timezone.utc)
    updated_dt = epoch_ms_to_datetime(props.get("updated"))

    # Magnitude
    mag_raw = props.get("mag")
    try:
        mag = float(mag_raw) if mag_raw is not None else 0.0
    except (ValueError, TypeError):
        mag = 0.0

    return {
        "id": event_id,
        "mag": mag,
        "place": str(props.get("place") or "Unknown Location").strip(),
        "time": time_dt,
        "updated": updated_dt,
        "tz": props.get("tz"),
        "url": props.get("url") or "",
        "detail": props.get("detail") or "",
        "felt": props.get("felt"),
        "cdi": props.get("cdi"),
        "mmi": props.get("mmi"),
        "alert": props.get("alert"),
        "status": str(props.get("status") or "automatic"),
        "tsunami": int(props.get("tsunami") or 0),
        "sig": int(props.get("sig") or 0),
        "net": str(props.get("net") or ""),
        "code": str(props.get("code") or ""),
        "ids": str(props.get("ids") or ""),
        "sources": str(props.get("sources") or ""),
        "types": str(props.get("types") or ""),
        "nst": props.get("nst"),
        "dmin": props.get("dmin"),
        "rms": props.get("rms"),
        "gap": props.get("gap"),
        "mag_type": str(props.get("magType") or "unknown"),
        "type": str(props.get("type") or "earthquake"),
        "title": str(props.get("title") or ""),
        "longitude": lon,
        "latitude": lat,
        "depth_km": depth,
        "is_valid": True,  # Pandera will validate this in quality checks
    }


def clean_and_transform_features(features: List[Dict[str, Any]]) -> pd.DataFrame:
    """Transforms a list of GeoJSON features into a clean pandas DataFrame."""
    rows = [transform_geojson_feature(f) for f in features if f]
    if not rows:
        return pd.DataFrame()
    return pd.DataFrame(rows)


def upsert_bronze_records(features: List[Dict[str, Any]], source: str = "usgs_feed") -> int:
    """Upserts raw GeoJSON features into bronze.earthquakes_raw.

    Uses role: sismo_ingest.
    """
    if not features:
        return 0

    query = """
    INSERT INTO bronze.earthquakes_raw (id, raw_payload, source, ingested_at)
    VALUES %s
    ON CONFLICT (id) DO UPDATE SET
        raw_payload = EXCLUDED.raw_payload,
        source = EXCLUDED.source,
        ingested_at = CURRENT_TIMESTAMP;
    """

    records = [
        (
            str(f.get("id") or (f.get("properties") or {}).get("id")),
            json.dumps(f),
            source,
        )
        for f in features
        if f and (f.get("id") or (f.get("properties") or {}).get("id"))
    ]

    if not records:
        return 0

    with get_db_connection(role="ingest") as conn:
        with conn.cursor() as cur:
            execute_values(
                cur,
                query,
                records,
                template="(%s, %s::jsonb, %s, CURRENT_TIMESTAMP)",
                page_size=500,
            )
            count = len(records)
    return count


def load_bronze_features_for_processing(limit: int = 1000) -> List[Dict[str, Any]]:
    """Reads raw GeoJSON features from bronze.earthquakes_raw.

    Uses role: sismo_transform.
    """
    query = """
    SELECT raw_payload
    FROM bronze.earthquakes_raw
    ORDER BY ingested_at DESC
    LIMIT %s;
    """
    with get_db_connection(role="transform") as conn:
        with conn.cursor() as cur:
            cur.execute(query, (limit,))
            rows = cur.fetchall()
            return [row[0] for row in rows if row and row[0]]


def upsert_silver_records(df: pd.DataFrame) -> int:
    """Upserts cleaned records from DataFrame into silver.earthquakes_clean.

    Uses role: sismo_transform.
    """
    if df.empty:
        return 0

    query = """
    INSERT INTO silver.earthquakes_clean (
        id, mag, place, time, updated, tz, url, detail, felt, cdi, mmi,
        alert, status, tsunami, sig, net, code, ids, sources, types,
        nst, dmin, rms, gap, mag_type, type, title, longitude, latitude,
        depth_km, is_valid, cleaned_at
    ) VALUES (
        %(id)s, %(mag)s, %(place)s, %(time)s, %(updated)s, %(tz)s, %(url)s,
        %(detail)s, %(felt)s, %(cdi)s, %(mmi)s, %(alert)s, %(status)s,
        %(tsunami)s, %(sig)s, %(net)s, %(code)s, %(ids)s, %(sources)s,
        %(types)s, %(nst)s, %(dmin)s, %(rms)s, %(gap)s, %(mag_type)s,
        %(type)s, %(title)s, %(longitude)s, %(latitude)s, %(depth_km)s,
        %(is_valid)s, CURRENT_TIMESTAMP
    )
    ON CONFLICT (id) DO UPDATE SET
        mag = EXCLUDED.mag,
        place = EXCLUDED.place,
        updated = EXCLUDED.updated,
        status = EXCLUDED.status,
        tsunami = EXCLUDED.tsunami,
        sig = EXCLUDED.sig,
        url = EXCLUDED.url,
        longitude = EXCLUDED.longitude,
        latitude = EXCLUDED.latitude,
        depth_km = EXCLUDED.depth_km,
        is_valid = EXCLUDED.is_valid,
        cleaned_at = CURRENT_TIMESTAMP;
    """

    # Replace pandas NaN/NaT with None in python dicts for PostgreSQL NULL
    raw_dicts = df.to_dict(orient="records")
    records = [
        {k: (None if pd.isna(v) else v) for k, v in row.items()}
        for row in raw_dicts
    ]

    with get_db_connection(role="transform") as conn:
        with conn.cursor() as cur:
            execute_batch(cur, query, records, page_size=500)
            count = len(records)
    return count


def promote_silver_to_gold() -> int:
    """Promotes valid records from silver to gold schema using ON CONFLICT DO UPDATE.

    Only records where is_valid = TRUE reach the gold layer.
    Uses role: sismo_transform.
    """
    query = """
    INSERT INTO gold.earthquakes (
        id, mag, place, time, updated, tsunami, sig, status,
        mag_type, type, url, longitude, latitude, depth_km, curated_at
    )
    SELECT
        id, mag, place, time, updated, tsunami, sig, status,
        mag_type, type, url, longitude, latitude, depth_km, CURRENT_TIMESTAMP
    FROM silver.earthquakes_clean
    WHERE is_valid = TRUE
    ON CONFLICT (id) DO UPDATE SET
        mag = EXCLUDED.mag,
        place = EXCLUDED.place,
        updated = EXCLUDED.updated,
        tsunami = EXCLUDED.tsunami,
        sig = EXCLUDED.sig,
        status = EXCLUDED.status,
        mag_type = EXCLUDED.mag_type,
        type = EXCLUDED.type,
        url = EXCLUDED.url,
        longitude = EXCLUDED.longitude,
        latitude = EXCLUDED.latitude,
        depth_km = EXCLUDED.depth_km,
        curated_at = CURRENT_TIMESTAMP;
    """
    with get_db_connection(role="transform") as conn:
        with conn.cursor() as cur:
            cur.execute(query)
            count = cur.rowcount
    return count
