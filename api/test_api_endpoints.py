"""Verification test suite for FastAPI endpoints and Role-Based Access Control (RBAC)."""

import os
import sys
import httpx

BASE_URL = os.getenv("API_BASE_URL", "http://localhost:8000")


def run_tests():
    print(f"--- Testing SismoWatch API at {BASE_URL} ---")

    # 1. Health check
    with httpx.Client(base_url=BASE_URL, timeout=10.0) as client:
        resp = client.get("/health")
        assert resp.status_code == 200, f"Health check failed: {resp.text}"
        data = resp.json()
        assert data.get("database_connected") is True, f"DB not connected: {data}"
        assert data.get("role") == "sismo_readonly", f"Role not sismo_readonly: {data}"
        print("✓ 1. Health check PASSED: database connected via 'sismo_readonly'")

        # 2. Login invalid credentials -> 401
        resp = client.post("/auth/login", json={"username": "admin", "password": "wrongpassword"})
        assert resp.status_code == 401, f"Expected 401, got {resp.status_code}"
        print("✓ 2. Invalid login returns 401 Unauthorized PASSED")

        # 3. Login viewer credentials -> 200 with JWT
        resp = client.post("/auth/login", json={"username": "viewer", "password": "admin123"})
        assert resp.status_code == 200, f"Viewer login failed: {resp.text}"
        viewer_token = resp.json().get("access_token")
        viewer_role = resp.json().get("role")
        assert viewer_token is not None
        assert viewer_role == "viewer"
        print(f"✓ 3. Viewer login PASSED: role='{viewer_role}'")

        # 4. Login admin credentials -> 200 with JWT
        resp = client.post("/auth/login", json={"username": "admin", "password": "admin123"})
        assert resp.status_code == 200, f"Admin login failed: {resp.text}"
        admin_token = resp.json().get("access_token")
        admin_role = resp.json().get("role")
        assert admin_token is not None
        assert admin_role == "admin"
        print(f"✓ 4. Admin login PASSED: role='{admin_role}'")

        # 5. Access without token -> 401 Unauthorized
        resp = client.get("/api/kpis")
        assert resp.status_code == 401, f"Expected 401 for unauthenticated request, got {resp.status_code}"
        print("✓ 5. Unauthenticated request returns 401 Unauthorized PASSED")

        viewer_headers = {"Authorization": f"Bearer {viewer_token}"}
        admin_headers = {"Authorization": f"Bearer {admin_token}"}

        # 6. Viewer accesses /api/kpis -> 200
        resp = client.get("/api/kpis", headers=viewer_headers)
        assert resp.status_code == 200, f"KPIs failed: {resp.text}"
        kpis = resp.json()
        assert "total_events_24h" in kpis
        assert "quality_score" in kpis
        assert "total_events_gold" in kpis
        print(f"✓ 6. Viewer GET /api/kpis PASSED: total_gold={kpis['total_events_gold']}, quality_score={kpis['quality_score']}")

        # 7. Viewer accesses /api/events -> 200
        resp = client.get("/api/events?page=1&page_size=5", headers=viewer_headers)
        assert resp.status_code == 200, f"Events failed: {resp.text}"
        events = resp.json()
        assert "items" in events
        assert "total" in events
        print(f"✓ 7. Viewer GET /api/events PASSED: {len(events['items'])} items returned of {events['total']} total")

        # 8. Viewer accesses /api/stats/timeseries -> 200
        resp = client.get("/api/stats/timeseries?days=7&interval=hour", headers=viewer_headers)
        assert resp.status_code == 200, f"Timeseries failed: {resp.text}"
        ts = resp.json()
        assert isinstance(ts, list)
        print(f"✓ 8. Viewer GET /api/stats/timeseries PASSED: {len(ts)} time buckets")

        # 9. Viewer accesses /api/pipeline/status -> 200
        resp = client.get("/api/pipeline/status", headers=viewer_headers)
        assert resp.status_code == 200, f"Pipeline status failed: {resp.text}"
        pipeline = resp.json()
        assert "statuses" in pipeline
        print(f"✓ 9. Viewer GET /api/pipeline/status PASSED: {len(pipeline['statuses'])} DAGs monitored")

        # 10. Viewer accesses /api/reports/export (CSV) -> 200
        resp = client.get("/api/reports/export?format=csv&limit=10", headers=viewer_headers)
        assert resp.status_code == 200, f"CSV export failed: {resp.text}"
        assert "text/csv" in resp.headers.get("content-type", "")
        print("✓ 10. Viewer GET /api/reports/export (CSV) PASSED")

        # 11. Viewer accesses /api/reports/export (PDF) -> 200
        resp = client.get("/api/reports/export?format=pdf&limit=10", headers=viewer_headers)
        assert resp.status_code == 200, f"PDF export failed: {resp.text}"
        assert "application/pdf" in resp.headers.get("content-type", "")
        print("✓ 11. Viewer GET /api/reports/export (PDF) PASSED")

        # 12. Security Test: Viewer attempts admin action -> MUST RETURN 403 FORBIDDEN
        resp = client.post(
            "/api/admin/backfill",
            json={"days_back": 1, "min_magnitude": 4.0},
            headers=viewer_headers,
        )
        assert resp.status_code == 403, f"Expected 403 Forbidden for viewer, got {resp.status_code}: {resp.text}"
        print("✓ 12. Security RBAC check: Viewer calling /api/admin/backfill rejected with 403 FORBIDDEN PASSED")

        # 13. Admin executes admin action -> 200 / 201
        resp = client.post(
            "/api/admin/backfill",
            json={"days_back": 1, "min_magnitude": 4.0},
            headers=admin_headers,
        )
        assert resp.status_code in [200, 201], f"Admin backfill trigger failed: {resp.status_code} - {resp.text}"
        print(f"✓ 13. Admin calling /api/admin/backfill PASSED: {resp.json().get('message')}")

    print("\n==========================================")
    print("ALL API AND SECURITY TESTS PASSED (100%)!")
    print("==========================================")


if __name__ == "__main__":
    run_tests()
