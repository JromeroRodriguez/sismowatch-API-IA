"""Alerting and failure callbacks for Airflow pipelines.

Provides on_failure_callback and on_success_callback handlers:
- Persists pipeline execution states in gold.pipeline_status
- Logs structured error telemetry
- Optionally sends webhook notifications if ALERT_WEBHOOK_URL is set
"""

from datetime import datetime, timezone
import json
import logging
import os
import requests
from include.db import get_db_connection

logger = logging.getLogger("airflow.task")


def update_pipeline_status(dag_id: str, run_id: str, state: str, is_failure: bool = False):
    """Updates the pipeline health status in gold.pipeline_status.

    Uses role: sismo_transform.
    """
    now_utc = datetime.now(timezone.utc)
    field_to_update = "last_failure_at" if is_failure else "last_success_at"

    query = f"""
    INSERT INTO gold.pipeline_status (
        dag_id, last_run_id, state, {field_to_update}, updated_at
    ) VALUES (
        %(dag_id)s, %(last_run_id)s, %(state)s, %(now)s, %(now)s
    )
    ON CONFLICT (dag_id) DO UPDATE SET
        last_run_id = EXCLUDED.last_run_id,
        state = EXCLUDED.state,
        {field_to_update} = EXCLUDED.{field_to_update},
        updated_at = EXCLUDED.updated_at;
    """

    try:
        with get_db_connection(role="transform") as conn:
            with conn.cursor() as cur:
                cur.execute(
                    query,
                    {
                        "dag_id": str(dag_id),
                        "last_run_id": str(run_id),
                        "state": str(state),
                        "now": now_utc,
                    },
                )
    except Exception as e:
        logger.error(f"Failed to update gold.pipeline_status: {e}")


def task_failure_alert(context: dict):
    """Callback triggered whenever a task in Airflow fails.

    Extracts execution context, updates database status, and dispatches webhook alert.
    """
    ti = context.get("task_instance")
    dag_id = context.get("dag").dag_id if context.get("dag") else "unknown_dag"
    task_id = ti.task_id if ti else "unknown_task"
    run_id = context.get("run_id") or "unknown_run"
    exception = context.get("exception") or "Unspecified error"
    try_number = ti.try_number if ti else 1

    alert_payload = {
        "alert_type": "AIRFLOW_TASK_FAILURE",
        "dag_id": dag_id,
        "task_id": task_id,
        "run_id": run_id,
        "try_number": try_number,
        "error": str(exception),
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }

    logger.critical(
        f"[SISMO_ALERT] TASK FAILURE in DAG '{dag_id}', Task '{task_id}' (attempt {try_number}): {exception}"
    )

    # 1. Update pipeline status table
    update_pipeline_status(dag_id=dag_id, run_id=run_id, state="FAILED", is_failure=True)

    # 2. Dispatch webhook if configured
    webhook_url = os.getenv("ALERT_WEBHOOK_URL")
    if webhook_url:
        try:
            requests.post(webhook_url, json=alert_payload, timeout=5)
            logger.info("Successfully sent failure notification to webhook.")
        except Exception as err:
            logger.warning(f"Could not dispatch webhook alert: {err}")


def pipeline_success_callback(context: dict):
    """Callback triggered on successful DAG/task completion."""
    dag_id = context.get("dag").dag_id if context.get("dag") else "unknown_dag"
    run_id = context.get("run_id") or "unknown_run"
    update_pipeline_status(dag_id=dag_id, run_id=run_id, state="SUCCESS", is_failure=False)
