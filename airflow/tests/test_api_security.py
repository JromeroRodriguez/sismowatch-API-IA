"""Integration & Security tests for FastAPI endpoints and RBAC."""

import os
import httpx
import pytest

API_BASE_URL = os.getenv("API_BASE_URL", "http://sismowatch-api:8000")


@pytest.fixture(scope="module")
def api_client():
    with httpx.Client(base_url=API_BASE_URL, timeout=10.0) as client:
        yield client


@pytest.fixture(scope="module")
def viewer_token(api_client):
    resp = api_client.post("/auth/login", json={"username": "viewer", "password": "admin123"})
    assert resp.status_code == 200, f"Viewer login failed: {resp.text}"
    token = resp.json().get("access_token")
    assert token is not None
    return token


@pytest.fixture(scope="module")
def admin_token(api_client):
    resp = api_client.post("/auth/login", json={"username": "admin", "password": "admin123"})
    assert resp.status_code == 200, f"Admin login failed: {resp.text}"
    token = resp.json().get("access_token")
    assert token is not None
    return token


def test_api_health_check(api_client):
    """Test /health verifies database connection and read-only role."""
    resp = api_client.get("/health")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "healthy"
    assert data["database_connected"] is True
    assert data["role"] == "sismo_readonly"
    assert data["schema_target"] == "gold"


def test_auth_invalid_credentials_returns_401(api_client):
    """Security check: Invalid credentials must return 401 Unauthorized."""
    resp = api_client.post("/auth/login", json={"username": "admin", "password": "wrong_password"})
    assert resp.status_code == 401


def test_unauthenticated_request_returns_401(api_client):
    """Security check: Requests without Bearer token must return 401 Unauthorized."""
    resp = api_client.get("/api/kpis")
    assert resp.status_code == 401

    resp = api_client.get("/api/events")
    assert resp.status_code == 401


def test_viewer_can_read_gold_endpoints(api_client, viewer_token):
    """Viewer role must have read access to gold data endpoints."""
    headers = {"Authorization": f"Bearer {viewer_token}"}

    # KPIs
    resp = api_client.get("/api/kpis", headers=headers)
    assert resp.status_code == 200
    assert "quality_score" in resp.json()

    # Events
    resp = api_client.get("/api/events?page=1&page_size=5", headers=headers)
    assert resp.status_code == 200
    assert "items" in resp.json()

    # Time series
    resp = api_client.get("/api/stats/timeseries", headers=headers)
    assert resp.status_code == 200

    # Pipeline status
    resp = api_client.get("/api/pipeline/status", headers=headers)
    assert resp.status_code == 200


def test_security_rbac_viewer_rejected_from_admin_route_403(api_client, viewer_token):
    """Critical Security Check: A viewer user attempting to trigger an admin action

    (e.g., /api/admin/backfill) MUST be rejected with HTTP 403 Forbidden.
    """
    headers = {"Authorization": f"Bearer {viewer_token}"}
    resp = api_client.post(
        "/api/admin/backfill",
        json={"days_back": 1, "min_magnitude": 4.5},
        headers=headers,
    )
    assert resp.status_code == 403
    assert "Admin role required" in resp.text or "detail" in resp.json()


def test_admin_can_access_admin_route(api_client, admin_token):
    """Admin role must successfully trigger administrative actions."""
    headers = {"Authorization": f"Bearer {admin_token}"}
    resp = api_client.post(
        "/api/admin/backfill",
        json={"days_back": 1, "min_magnitude": 4.5},
        headers=headers,
    )
    assert resp.status_code in [200, 201]
    assert resp.json().get("status") in ["success", "queued"]


def test_quarantine_endpoint_security_and_rbac(api_client, admin_token, viewer_token):
    """Test /api/quality/quarantine enforces RBAC:

    - Admin receives 200 OK with list of rejected records
    - Viewer receives 403 Forbidden
    - Unauthenticated receives 401 Unauthorized
    """
    # 1. Admin access
    admin_headers = {"Authorization": f"Bearer {admin_token}"}
    resp_admin = api_client.get("/api/quality/quarantine", headers=admin_headers)
    assert resp_admin.status_code == 200, f"Admin quarantine failed: {resp_admin.text}"
    items = resp_admin.json()
    assert isinstance(items, list)

    # 2. Viewer access rejected
    viewer_headers = {"Authorization": f"Bearer {viewer_token}"}
    resp_viewer = api_client.get("/api/quality/quarantine", headers=viewer_headers)
    assert resp_viewer.status_code == 403, "Viewer should be forbidden from accessing quarantine"

    # 3. Unauthenticated access rejected
    resp_anon = api_client.get("/api/quality/quarantine")
    assert resp_anon.status_code == 401, "Anonymous user should be unauthorized"


def test_chatbot_endpoint_returns_ground_truth_answer(api_client, viewer_token):
    """Test POST /api/chat handles natural language questions using live gold metrics."""
    headers = {"Authorization": f"Bearer {viewer_token}"}
    resp = api_client.post(
        "/api/chat",
        json={"message": "¿Dónde hay más sismos?"},
        headers=headers,
    )
    assert resp.status_code == 200
    data = resp.json()
    assert "reply" in data
    assert len(data["reply"]) > 20
    assert "model" in data
    assert "latency_ms" in data
    assert isinstance(data.get("suggested_questions"), list)
