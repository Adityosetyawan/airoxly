"""Regression tests for the self-hosted migration additions (Session 15).

Covers:
- New /api/health endpoint
- Existing seed-user logins (superadmin / adminA / A1)
- /api/auth/session Google endpoint (401 on invalid id) — regression for Session 14
- /api/customers?sort=recent|debt — regression for Session 13
- /api/auth/logout still works
- CORS response headers include Access-Control-Allow-Origin
"""

import os
import pytest
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "http://localhost:8001").rstrip("/")


# ---------------------------- fixtures ---------------------------- #
@pytest.fixture(scope="module")
def api():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


def _login(api, username, password):
    r = api.post(f"{BASE_URL}/api/auth/login", json={"username": username, "password": password})
    return r


# ---------------------------- /api/health ---------------------------- #
class TestHealth:
    def test_health_ok(self, api):
        r = api.get(f"{BASE_URL}/api/health")
        assert r.status_code == 200, r.text
        body = r.json()
        assert body.get("status") == "ok"
        assert body.get("db") == "connected"


# ---------------------------- seed login regressions ---------------------------- #
class TestSeedLogins:
    def test_superadmin_login(self, api):
        r = _login(api, "superadmin", "super123")
        assert r.status_code == 200, r.text
        body = r.json()
        assert "access_token" in body and body["access_token"]
        assert body.get("user", {}).get("role") == "super_admin"

    def test_adminA_login(self, api):
        r = _login(api, "adminA", "admin123")
        assert r.status_code == 200, r.text
        body = r.json()
        assert "access_token" in body and body["access_token"]
        assert body.get("user", {}).get("role") == "admin"

    def test_sales_A1_login(self, api):
        r = _login(api, "A1", "sales123")
        assert r.status_code == 200, r.text
        body = r.json()
        assert "access_token" in body and body["access_token"]
        assert body.get("user", {}).get("role") == "sales"


# ---------------------------- Session 14 regression: google auth ---------------------------- #
class TestGoogleSessionInvalid:
    def test_invalid_session_id_returns_401(self, api):
        r = api.post(
            f"{BASE_URL}/api/auth/session",
            json={"session_id": "definitely_not_a_valid_session_id_xyz"},
        )
        assert r.status_code == 401, f"expected 401 got {r.status_code}: {r.text}"


# ---------------------------- Session 13 regression: customers sort ---------------------------- #
class TestCustomersSort:
    def _auth_headers(self, api):
        r = _login(api, "superadmin", "super123")
        assert r.status_code == 200
        token = r.json()["access_token"]
        return {"Authorization": f"Bearer {token}"}

    def test_customers_sort_recent(self, api):
        headers = self._auth_headers(api)
        r = api.get(f"{BASE_URL}/api/customers?sort=recent", headers=headers)
        assert r.status_code == 200, r.text
        data = r.json()
        assert isinstance(data, list)

    def test_customers_sort_debt(self, api):
        headers = self._auth_headers(api)
        r = api.get(f"{BASE_URL}/api/customers?sort=debt", headers=headers)
        assert r.status_code == 200, r.text
        data = r.json()
        assert isinstance(data, list)


# ---------------------------- Logout ---------------------------- #
class TestLogout:
    def test_logout_returns_ok(self, api):
        r = _login(api, "superadmin", "super123")
        token = r.json()["access_token"]
        r2 = api.post(
            f"{BASE_URL}/api/auth/logout",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert r2.status_code in (200, 204), r2.text


# ---------------------------- CORS ---------------------------- #
class TestCORS:
    def test_cors_wildcard_default(self, api):
        # With CORS_ORIGINS unset locally, ACAO should be "*"
        r = requests.options(
            f"{BASE_URL}/api/health",
            headers={
                "Origin": "http://localhost:3000",
                "Access-Control-Request-Method": "GET",
            },
        )
        # Some servers return 200, some 204 for preflight
        assert r.status_code in (200, 204), r.text
        acao = r.headers.get("access-control-allow-origin") or r.headers.get(
            "Access-Control-Allow-Origin"
        )
        assert acao is not None, f"missing ACAO. headers={dict(r.headers)}"
        # Either wildcard or the requesting origin echoed
        assert acao in ("*", "http://localhost:3000"), acao
