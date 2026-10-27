"""Data Quality module using Pandera for SismoWatch.

Validates schemas, ranges, uniqueness, freshness, and volume.
Invalid records have is_valid set to False and are discarded from Gold.
Results are persisted into gold.quality_metrics.
"""

from datetime import datetime, timezone
import json
from typing import Dict, Any, Tuple
import pandas as pd
import pandera.pandas as pa
from pandera.pandas import Column, Check, DataFrameSchema
from include.db import get_db_connection

# 1. Declarative Pandera Schema for Silver/Gold Earthquake Events
EarthquakeSchema = DataFrameSchema(
    columns={
        "id": Column(str, nullable=False, unique=True, name="id"),
        "place": Column(str, nullable=False, name="place"),
        "latitude": Column(
            float,
            Check.in_range(-90.0, 90.0, include_min=True, include_max=True),
            nullable=False,
            name="latitude",
        ),
        "longitude": Column(
            float,
            Check.in_range(-180.0, 180.0, include_min=True, include_max=True),
            nullable=False,
            name="longitude",
        ),
        "mag": Column(
            float,
            Check.in_range(-3.0, 10.0, include_min=True, include_max=True),
            nullable=False,
            name="mag",
        ),
        "depth_km": Column(
            float,
            Check.in_range(-10.0, 1000.0, include_min=True, include_max=True),
            nullable=False,
            name="depth_km",
        ),
    },
    coerce=True,
    strict=False,
)


def validate_earthquakes_dataset(
    df: pd.DataFrame, dag_id: str, run_id: str, freshness_max_minutes: float = 180.0
) -> Tuple[pd.DataFrame, Dict[str, Any]]:
    """Runs comprehensive quality checks on the earthquakes DataFrame.

    - Evaluates row-level schema, coordinate bounds, and plausibility.
    - Evaluates batch-level freshness and volume.
    - Sets df['is_valid'] = False for rejected rows (discarded from Gold).
    - Returns updated DataFrame and execution quality summary.
    """
    if df.empty:
        summary = {
            "run_id": run_id,
            "dag_id": dag_id,
            "execution_timestamp": datetime.now(timezone.utc),
            "total_records": 0,
            "rules_evaluated": 1,
            "rules_passed": 0,
            "rules_rejected": 1,
            "quality_score": 0.0,
            "freshness_minutes": None,
            "status": "FAILED",
            "details": {"error": "DataFrame is empty (Volume check failed)"},
        }
        return df, summary

    total_records = len(df)
    now_utc = datetime.now(timezone.utc)

    # Track validation checks
    checks_evaluated = 0
    checks_passed = 0
    checks_rejected = 0
    failures = []

    # Initialize is_valid column
    df["is_valid"] = True

    # 1. Row-level checks:
    quarantine_records = []
    for idx, row in df.iterrows():
        row_valid = True
        row_failures = []
        row_id = row.get("id")

        # Check 1: Mandatory ID and place
        checks_evaluated += 1
        if not row_id or not str(row.get("place", "")).strip():
            row_valid = False
            checks_rejected += 1
            reason = f"Row {row_id}: Missing mandatory ID or place"
            failures.append(reason)
            row_failures.append(reason)
        else:
            checks_passed += 1

        # Check 2: Latitude bounds [-90, 90]
        checks_evaluated += 1
        lat = row.get("latitude")
        if lat is None or not (-90.0 <= float(lat) <= 90.0):
            row_valid = False
            checks_rejected += 1
            reason = f"Row {row_id}: Latitude out of bounds ({lat})"
            failures.append(reason)
            row_failures.append(reason)
        else:
            checks_passed += 1

        # Check 3: Longitude bounds [-180, 180]
        checks_evaluated += 1
        lon = row.get("longitude")
        if lon is None or not (-180.0 <= float(lon) <= 180.0):
            row_valid = False
            checks_rejected += 1
            reason = f"Row {row_id}: Longitude out of bounds ({lon})"
            failures.append(reason)
            row_failures.append(reason)
        else:
            checks_passed += 1

        # Check 4: Plausible magnitude [-3, 10]
        checks_evaluated += 1
        mag = row.get("mag")
        if mag is None or not (-3.0 <= float(mag) <= 10.0):
            row_valid = False
            checks_rejected += 1
            reason = f"Row {row_id}: Magnitude out of plausible range ({mag})"
            failures.append(reason)
            row_failures.append(reason)
        else:
            checks_passed += 1

        # Check 5: Plausible depth [-10, 1000]
        checks_evaluated += 1
        depth = row.get("depth_km")
        if depth is None or not (-10.0 <= float(depth) <= 1000.0):
            row_valid = False
            checks_rejected += 1
            reason = f"Row {row_id}: Depth out of plausible range ({depth})"
            failures.append(reason)
            row_failures.append(reason)
        else:
            checks_passed += 1

        # Check 6: Valid timestamp
        checks_evaluated += 1
        time_val = row.get("time")
        if not isinstance(time_val, (datetime, pd.Timestamp)):
            row_valid = False
            checks_rejected += 1
            reason = f"Row {row_id}: Invalid time format"
            failures.append(reason)
            row_failures.append(reason)
        else:
            checks_passed += 1

        # Discard invalid row from silver promotion and queue for quarantine
        if not row_valid:
            df.at[idx, "is_valid"] = False
            quarantine_records.append({
                "id": str(row_id or f"invalid_{idx}")[:64],
                "place": str(row.get("place") or "Desconocido")[:255],
                "mag": float(row.get("mag")) if pd.notnull(row.get("mag")) else None,
                "latitude": float(row.get("latitude")) if pd.notnull(row.get("latitude")) else None,
                "longitude": float(row.get("longitude")) if pd.notnull(row.get("longitude")) else None,
                "depth_km": float(row.get("depth_km")) if pd.notnull(row.get("depth_km")) else None,
                "rejection_reason": "; ".join(row_failures),
            })

    # Check 7: Batch-level ID uniqueness
    checks_evaluated += 1
    if df["id"].duplicated().any():
        checks_rejected += 1
        failures.append("Batch contains duplicate event IDs")
        # Mark duplicates as invalid
        dup_mask = df["id"].duplicated(keep="first")
        df.loc[dup_mask, "is_valid"] = False
    else:
        checks_passed += 1

    # Check 8: Freshness check (newest event age)
    checks_evaluated += 1
    newest_time = pd.to_datetime(df["time"]).max()
    if pd.notnull(newest_time):
        if newest_time.tzinfo is None:
            newest_time = newest_time.replace(tzinfo=timezone.utc)
        freshness_minutes = round((now_utc - newest_time).total_seconds() / 60.0, 2)
        if freshness_minutes <= freshness_max_minutes:
            checks_passed += 1
        else:
            checks_rejected += 1
            failures.append(
                f"Freshness exceeded: {freshness_minutes}m > {freshness_max_minutes}m"
            )
    else:
        freshness_minutes = None
        checks_rejected += 1
        failures.append("Cannot determine freshness (missing timestamps)")

    # Check 9: Volume check (batch size 1 to 2000)
    checks_evaluated += 1
    if 1 <= total_records <= 2000:
        checks_passed += 1
    else:
        checks_rejected += 1
        failures.append(f"Volume check failed: {total_records} records outside [1, 2000]")

    # Calculate overall quality score (0.0 to 100.0)
    quality_score = round((checks_passed / checks_evaluated) * 100.0, 2)
    status = "PASSED" if (quality_score >= 80.0 and checks_rejected == 0) else ("PASSED" if quality_score >= 80.0 else "FAILED")

    details = {
        "total_records": total_records,
        "valid_records": int(df["is_valid"].sum()),
        "invalid_records": int((~df["is_valid"]).sum()),
        "failures_sample": failures[:10],
        "freshness_minutes": freshness_minutes,
    }

    summary = {
        "run_id": run_id,
        "dag_id": dag_id,
        "execution_timestamp": now_utc,
        "total_records": total_records,
        "rules_evaluated": checks_evaluated,
        "rules_passed": checks_passed,
        "rules_rejected": checks_rejected,
        "quality_score": quality_score,
        "freshness_minutes": freshness_minutes,
        "status": status,
        "details": details,
        "quarantine_records": quarantine_records,
    }

    return df, summary


def record_quarantine_records(invalid_records: list) -> None:
    """Inserts rejected records into gold.quality_quarantine.

    Uses role: sismo_transform.
    """
    if not invalid_records:
        return

    query = """
    INSERT INTO gold.quality_quarantine (
        id, place, mag, latitude, longitude, depth_km, rejection_reason, rejected_at
    ) VALUES (
        %(id)s, %(place)s, %(mag)s, %(latitude)s, %(longitude)s, %(depth_km)s, %(rejection_reason)s, NOW()
    )
    ON CONFLICT (id) DO UPDATE SET
        rejection_reason = EXCLUDED.rejection_reason,
        rejected_at = NOW();
    """
    with get_db_connection(role="transform") as conn:
        with conn.cursor() as cur:
            for item in invalid_records:
                cur.execute(query, item)


def record_quality_metrics(metrics: Dict[str, Any]) -> None:
    """Saves the execution quality metrics into gold.quality_metrics

    and persists any rejected records into gold.quality_quarantine.
    Uses role: sismo_transform.
    """
    # Persist quarantine records if any
    if metrics.get("quarantine_records"):
        record_quarantine_records(metrics["quarantine_records"])

    query = """
    INSERT INTO gold.quality_metrics (
        run_id, dag_id, execution_timestamp, total_records,
        rules_evaluated, rules_passed, rules_rejected, quality_score,
        freshness_minutes, status, details
    ) VALUES (
        %(run_id)s, %(dag_id)s, %(execution_timestamp)s, %(total_records)s,
        %(rules_evaluated)s, %(rules_passed)s, %(rules_rejected)s, %(quality_score)s,
        %(freshness_minutes)s, %(status)s, %(details)s::jsonb
    )
    ON CONFLICT (run_id) DO UPDATE SET
        rules_evaluated = EXCLUDED.rules_evaluated,
        rules_passed = EXCLUDED.rules_passed,
        rules_rejected = EXCLUDED.rules_rejected,
        quality_score = EXCLUDED.quality_score,
        freshness_minutes = EXCLUDED.freshness_minutes,
        status = EXCLUDED.status,
        details = EXCLUDED.details;
    """

    data = {
        "run_id": str(metrics["run_id"]),
        "dag_id": str(metrics["dag_id"]),
        "execution_timestamp": metrics.get("execution_timestamp") or datetime.now(timezone.utc),
        "total_records": int(metrics["total_records"]),
        "rules_evaluated": int(metrics["rules_evaluated"]),
        "rules_passed": int(metrics["rules_passed"]),
        "rules_rejected": int(metrics["rules_rejected"]),
        "quality_score": float(metrics["quality_score"]),
        "freshness_minutes": float(metrics["freshness_minutes"]) if metrics.get("freshness_minutes") is not None else None,
        "status": str(metrics["status"]),
        "details": json.dumps(metrics.get("details") or {}),
    }

    with get_db_connection(role="transform") as conn:
        with conn.cursor() as cur:
            cur.execute(query, data)
