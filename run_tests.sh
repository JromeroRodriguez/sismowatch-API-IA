#!/usr/bin/env bash
# SismoWatch Automated Verification Suite
set -e

echo "=========================================================="
echo " Running SismoWatch Automated Test Suite (16 Test Cases)"
echo " Covering: Ingestion, Transformations, DAG Integrity, "
echo " Pandera Quality Rules, API/RBAC Security Gates, and"
echo " Live Ground-Truth Conversational SismoBot Chat"
echo "=========================================================="

docker exec -u airflow sismowatch-airflow-webserver /home/airflow/.local/bin/pytest /opt/airflow/tests -v "$@"
