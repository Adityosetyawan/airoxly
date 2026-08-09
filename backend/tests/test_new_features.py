"""Regression tests for newly implemented backend features.

Covers:
  1. Expense with photo_base64 + edit (PATCH /api/expenses/{id})
  2. GPS ping filter (POST /api/location/ping) — near/far coordinates
  3. Settings endpoints (GET / PUT /api/settings/{key}) RBAC + values
  4. Dangerous data-reset guard endpoints (do NOT actually reset)
  5. Regression: create_user without google_email (no duplicate-null 500)

All tests are idempotent — created data is cleaned up in teardown.
"""
from __future__ import annotations

import base64
import os
import time

import pytest
import requests

BASE_URL = "http://localhost:8001/api"

# ---------------------------------------------------------------------------
# Shared fixtures
# ---------------------------------------------------------------------------

def _login(session: requests.Session, username: str, password: str) -> str:
    r = session.post(f"{BASE_URL}/auth/login", json={"username": username, "password": password})
    assert r.status_code == 200, f"login failed for {username}: {r.status_code} {r.text}"
    return r.json()["access_token"]


@pytest.fixture(scope="module")
def http() -> requests.Session:
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def tokens(http: requests.Session) -> dict:
    return {
        "super": _login(http, "superadmin", "super123"),
        "sales": _login(http, "A1", "sales123"),
        "admin": _login(http, "adminA", "admin123"),
    }


def _auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


# ---------------------------------------------------------------------------
# 1) EXPENSE with photo_base64 + edit
# ---------------------------------------------------------------------------
class TestExpenseWithPhotoAndEdit:
    def test_expense_photo_and_edit_flow(self, http: requests.Session, tokens: dict):
        # A 1x1 transparent PNG
        tiny_png_b64 = (
            "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII="
        )
        photo = f"data:image/png;base64,{tiny_png_b64}"

        # ---- Create expense (as sales) with photo_base64
        r = http.post(
            f"{BASE_URL}/expenses",
            headers=_auth(tokens["sales"]),
            json={
                "category": "BBM",
                "description": "TEST_expense photo",
                "amount": 12345,
                "photo_base64": photo,
            },
        )
        assert r.status_code == 200, f"create expense failed: {r.status_code} {r.text}"
        exp = r.json()
        exp_id = exp["id"]
        assert exp.get("photo_base64") == photo, "photo_base64 not returned in create response"
        assert int(exp.get("edit_count", 0)) == 0
        assert exp.get("amount") == 12345.0

        try:
            # ---- PATCH amount/description as sales -> edit_count = 1
            r = http.patch(
                f"{BASE_URL}/expenses/{exp_id}",
                headers=_auth(tokens["sales"]),
                json={"amount": 15000, "description": "TEST_expense edited"},
            )
            assert r.status_code == 200, f"patch failed: {r.status_code} {r.text}"
            e2 = r.json()
            assert e2["amount"] == 15000.0
            assert e2["description"] == "TEST_expense edited"
            assert int(e2.get("edit_count", 0)) == 1
            assert e2.get("photo_base64") == photo, "photo should remain after non-photo edit"

            # ---- PATCH photo_base64="" -> photo removed, edit_count = 2
            r = http.patch(
                f"{BASE_URL}/expenses/{exp_id}",
                headers=_auth(tokens["sales"]),
                json={"photo_base64": ""},
            )
            assert r.status_code == 200, f"patch clear photo failed: {r.status_code} {r.text}"
            e3 = r.json()
            assert "photo_base64" not in e3 or e3.get("photo_base64") in (None, ""), (
                f"photo should be removed, got: {e3.get('photo_base64')!r}"
            )
            assert int(e3.get("edit_count", 0)) == 2

            # ---- PATCH as admin -> 403
            r = http.patch(
                f"{BASE_URL}/expenses/{exp_id}",
                headers=_auth(tokens["admin"]),
                json={"amount": 20000},
            )
            assert r.status_code == 403, f"admin should get 403, got: {r.status_code} {r.text}"
        finally:
            # ---- Cleanup
            r = http.delete(f"{BASE_URL}/expenses/{exp_id}", headers=_auth(tokens["sales"]))
            assert r.status_code == 200, f"cleanup failed: {r.status_code} {r.text}"


# ---------------------------------------------------------------------------
# 2) GPS FILTER
# ---------------------------------------------------------------------------
class TestGpsFilter:
    def test_gps_filter_flow(self, http: requests.Session, tokens: dict):
        # Ensure default threshold = 20m (super_admin sets it)
        r = http.put(
            f"{BASE_URL}/settings/gps_min_move_m",
            headers=_auth(tokens["super"]),
            json={"key": "gps_min_move_m", "value": 20},
        )
        assert r.status_code == 200

        base_lat, base_lng = -6.200000, 106.816666  # Jakarta-ish

        # 1st ping — should NOT be filtered (no prior point or dt>5m fallback)
        r = http.post(
            f"{BASE_URL}/location/ping",
            headers=_auth(tokens["sales"]),
            json={"lat": base_lat, "lng": base_lng},
        )
        assert r.status_code == 200
        j = r.json()
        assert j["ok"] is True
        assert j["filtered"] is False, f"1st ping should not be filtered, got: {j}"

        # 2nd ping ~1m offset (~9e-6 deg lat ≈ 1m) — should be FILTERED
        near_lat = base_lat + 0.000009
        near_lng = base_lng
        r = http.post(
            f"{BASE_URL}/location/ping",
            headers=_auth(tokens["sales"]),
            json={"lat": near_lat, "lng": near_lng},
        )
        assert r.status_code == 200
        j = r.json()
        assert j["ok"] is True
        assert j["filtered"] is True, f"near ping should be filtered, got: {j}"
        assert j["distance_m"] < 20, f"distance should be <20m, got: {j}"

        # 3rd ping ~200m away — should NOT be filtered
        far_lat = base_lat + 0.002  # ~222m
        r = http.post(
            f"{BASE_URL}/location/ping",
            headers=_auth(tokens["sales"]),
            json={"lat": far_lat, "lng": base_lng},
        )
        assert r.status_code == 200
        j = r.json()
        assert j["ok"] is True
        assert j["filtered"] is False, f"far ping should not be filtered, got: {j}"

        # Restore default (20)
        r = http.put(
            f"{BASE_URL}/settings/gps_min_move_m",
            headers=_auth(tokens["super"]),
            json={"key": "gps_min_move_m", "value": 20},
        )
        assert r.status_code == 200


# ---------------------------------------------------------------------------
# 3) SETTINGS RBAC
# ---------------------------------------------------------------------------
class TestSettingsRbac:
    def test_settings_rbac_and_values(self, http: requests.Session, tokens: dict):
        # GET as sales -> 200
        r = http.get(
            f"{BASE_URL}/settings/visit_radius_m",
            headers=_auth(tokens["sales"]),
        )
        assert r.status_code == 200

        # PUT as sales -> 403
        r = http.put(
            f"{BASE_URL}/settings/visit_radius_m",
            headers=_auth(tokens["sales"]),
            json={"key": "visit_radius_m", "value": 150},
        )
        assert r.status_code == 403, f"sales should be forbidden, got: {r.status_code} {r.text}"

        try:
            # PUT as super_admin value=150 -> 200
            r = http.put(
                f"{BASE_URL}/settings/visit_radius_m",
                headers=_auth(tokens["super"]),
                json={"key": "visit_radius_m", "value": 150},
            )
            assert r.status_code == 200, f"super_admin should succeed: {r.text}"
            assert r.json().get("value") == 150

            # GET after set -> value 150
            r = http.get(
                f"{BASE_URL}/settings/visit_radius_m",
                headers=_auth(tokens["sales"]),
            )
            assert r.status_code == 200
            assert r.json().get("value") == 150
        finally:
            # Reset to 100
            r = http.put(
                f"{BASE_URL}/settings/visit_radius_m",
                headers=_auth(tokens["super"]),
                json={"key": "visit_radius_m", "value": 100},
            )
            assert r.status_code == 200


# ---------------------------------------------------------------------------
# 4) RESET ENDPOINTS GUARDS (do NOT actually reset)
# ---------------------------------------------------------------------------
class TestResetGuards:
    def test_reset_sales_missing_confirm(self, http: requests.Session, tokens: dict):
        # No body -> validation error 422
        r = http.post(
            f"{BASE_URL}/admin/reset-sales-data",
            headers=_auth(tokens["super"]),
            json={},
        )
        assert r.status_code == 422, f"expected 422 (missing confirm), got: {r.status_code} {r.text}"

    def test_reset_sales_wrong_confirm(self, http: requests.Session, tokens: dict):
        r = http.post(
            f"{BASE_URL}/admin/reset-sales-data",
            headers=_auth(tokens["super"]),
            json={"confirm": "WRONG"},
        )
        assert r.status_code == 400, f"expected 400, got: {r.status_code} {r.text}"
        detail = (r.json() or {}).get("detail", "")
        assert "Konfirmasi tidak cocok" in detail, f"unexpected detail: {detail}"

    def test_reset_sales_by_sales_role(self, http: requests.Session, tokens: dict):
        r = http.post(
            f"{BASE_URL}/admin/reset-sales-data",
            headers=_auth(tokens["sales"]),
            json={"confirm": "RESET PENJUALAN"},
        )
        assert r.status_code == 403, f"expected 403, got: {r.status_code} {r.text}"

    def test_reset_all_by_admin_role(self, http: requests.Session, tokens: dict):
        r = http.post(
            f"{BASE_URL}/admin/reset-all-data",
            headers=_auth(tokens["admin"]),
            json={"confirm": "RESET SEMUA"},
        )
        assert r.status_code == 403, f"expected 403, got: {r.status_code} {r.text}"

    def test_reset_all_by_admin_role_with_valid_confirm(self, http: requests.Session, tokens: dict):
        # Even with the correct phrase, adminA MUST be blocked by RBAC first (403).
        r = http.post(
            f"{BASE_URL}/admin/reset-all-data",
            headers=_auth(tokens["admin"]),
            json={"confirm": "RESET SEMUA"},
        )
        assert r.status_code == 403, f"expected 403 (RBAC), got: {r.status_code} {r.text}"


# ---------------------------------------------------------------------------
# 5) CREATE USER without google_email — no duplicate-null 500 regression
# ---------------------------------------------------------------------------
class TestCreateUserNoGoogleEmail:
    def test_create_two_admins_without_google_email(self, http: requests.Session, tokens: dict):
        suffix = int(time.time())
        u1 = f"TEST_admD_{suffix}"
        u2 = f"TEST_admE_{suffix}"
        created_ids: list[str] = []
        try:
            # Create admin D (no google_email in body)
            r = http.post(
                f"{BASE_URL}/users",
                headers=_auth(tokens["super"]),
                json={
                    "username": u1,
                    "password": "test123",
                    "role": "admin",
                    "group_letter": "D",
                    "name": "TEST Admin D",
                },
            )
            assert r.status_code == 200, f"create admD failed: {r.status_code} {r.text}"
            body1 = r.json()
            created_ids.append(body1["id"])
            assert body1["username"] == u1
            assert body1["role"] == "admin"
            assert body1["group_letter"] == "D"
            assert body1.get("google_email") in (None, ""), (
                f"google_email should be unset/None, got: {body1.get('google_email')!r}"
            )

            # Create admin E (still no google_email) — MUST NOT hit dup-key 500
            r = http.post(
                f"{BASE_URL}/users",
                headers=_auth(tokens["super"]),
                json={
                    "username": u2,
                    "password": "test123",
                    "role": "admin",
                    "group_letter": "E",
                    "name": "TEST Admin E",
                },
            )
            assert r.status_code == 200, (
                f"create admE failed (dup-null regression?): {r.status_code} {r.text}"
            )
            body2 = r.json()
            created_ids.append(body2["id"])
            assert body2["username"] == u2
            assert body2["group_letter"] == "E"
        finally:
            # Cleanup
            for uid in created_ids:
                http.delete(f"{BASE_URL}/users/{uid}", headers=_auth(tokens["super"]))
