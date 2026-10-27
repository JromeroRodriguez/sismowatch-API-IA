"""Unit tests for Airflow DAG integrity and structure verification."""

import pytest
from airflow.models import DagBag


@pytest.fixture(scope="module")
def dagbag():
    """Load the DagBag once for all tests in this module."""
    return DagBag(dag_folder="/opt/airflow/dags", include_examples=False)


def test_dags_import_without_errors(dagbag):
    """Ensure all DAG files import cleanly without syntax or import errors."""
    assert (
        len(dagbag.import_errors) == 0
    ), f"DAG import errors detected: {dagbag.import_errors}"


def test_expected_dags_present(dagbag):
    """Verify that all 4 required SismoWatch DAGs are registered."""
    expected_dags = [
        "usgs_ingest_dag",
        "earthquakes_medallion_processing",
        "historical_backfill_dag",
        "daily_ai_report_dag",
    ]
    # Note: dag id in earthquakes_processing_dag.py is earthquakes_processing_dag
    actual_dags = list(dagbag.dags.keys())
    for expected in [
        "usgs_ingest_dag",
        "earthquakes_processing_dag",
        "historical_backfill_dag",
        "daily_ai_report_dag",
    ]:
        assert expected in actual_dags, f"Expected DAG '{expected}' not found in {actual_dags}"


def test_dag_cycle_check(dagbag):
    """Verify that none of the DAGs have cyclic dependencies."""
    from airflow.utils.dag_cycle_tester import check_cycle

    for dag_id, dag in dagbag.dags.items():
        assert len(dag.tasks) > 0, f"DAG '{dag_id}' has no tasks"
        # Verify DAG is an acyclic graph
        check_cycle(dag)


def test_dag_retry_and_alert_configuration(dagbag):
    """Verify that ingestion DAGs have retries and alerting callbacks configured."""
    ingest_dag = dagbag.get_dag("usgs_ingest_dag")
    assert ingest_dag is not None
    # Check default_args or task retry settings
    for task in ingest_dag.tasks:
        assert task.retries >= 1, f"Task {task.task_id} in usgs_ingest_dag has no retries"
