"""
Backend tests for Emergent-managed Google Sign-in integration.
Covers:
- POST /api/auth/session (invalid session_id, missing field)
- POST /api/auth/login (legacy JWT still works)
- PATCH /api/users/{id} google_email (self, uniqueness)
- GET /api/auth/me includes google_email
- POST /api/users google_email uniqueness (409 on duplicate)
- get_current_user dual-mode: JWT and emg_ session_token
- Expired session -> 401
- POST /api/auth/logout revokes emg_ session; JWT is stateless
"""
import os
import uuid
import secrets
from datetime import datetime, timezone, timedelta

import pytest
import requests
from motor.motor_asyncio import AsyncIOMotorClient
import asyncio

# Base URL: prefer public Expo backend URL; fall back to internal
BASE = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "https://oxly-crm.preview.emergentagent.com").rstrip("/")
API = f"{BASE}/api"

# Mongo direct access for session_token seeding
MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "test_database")


def H(tok):
    return {"Authorization": f"Bearer {tok}", "Content-Type": "application/json"}


# ------------- module-scoped fixtures -------------
@pytest.fixture(scope="module")
def super_login():
    r = requests.post(f"{API}/auth/login",
                      json={"username": "superadmin", "password": "super123"},
                      timeout=30)
    assert r.status_code == 200, f"super login failed: {r.status_code} {r.text}"
    d = r.json()
    return d["access_token"], d["user"]


@pytest.fixture(scope="module")
def other_user_id(super_login):
    """Return the id of another existing user (e.g. adminA) to test cross-user conflict."""
    tok, _ = super_login
    r = requests.get(f"{API}/users", headers=H(tok), timeout=30)
    assert r.status_code == 200
    users = r.json()
    # pick any non-superadmin user
    for u in users:
        if u["username"] != "superadmin":
            return u["id"]
    pytest.skip("No other users to test cross-user uniqueness")


@pytest.fixture(scope="module")
def loop():
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


@pytest.fixture(scope="module")
def mongo(loop):
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    yield db, loop
    client.close()


# ============================================================
# 1) POST /api/auth/session — invalid & missing session_id
# ============================================================
class TestAuthSession:
    def test_invalid_session_id_returns_401(self):
        r = requests.post(f"{API}/auth/session",
                          json={"session_id": "invalid_fake_xyz"},
                          timeout=30)
        assert r.status_code == 401, f"expected 401 got {r.status_code} {r.text}"
        detail = r.json().get("detail", "")
        # Accept both possible messages: Emergent returned non-200 OR network error
        assert "Sesi Google" in detail or "Gagal verifikasi" in detail, (
            f"unexpected detail: {detail}"
        )

    def test_missing_session_id_returns_422(self):
        r = requests.post(f"{API}/auth/session", json={}, timeout=30)
        assert r.status_code == 422, f"expected 422 got {r.status_code} {r.text}"


# ============================================================
# 2) Legacy JWT login still works
# ============================================================
class TestLegacyLogin:
    def test_superadmin_login_returns_jwt(self, super_login):
        tok, user = super_login
        assert tok and isinstance(tok, str) and len(tok) > 20
        # JWT tokens should NOT start with emg_
        assert not tok.startswith("emg_")
        assert user["role"] == "super_admin"
        assert user["username"] == "superadmin"


# ============================================================
# 3) PATCH google_email on self + uniqueness
# ============================================================
class TestGoogleEmailPatch:
    email_val = f"boss_{uuid.uuid4().hex[:8]}@example.com"

    def test_patch_self_google_email_ok(self, super_login):
        tok, user = super_login
        r = requests.patch(
            f"{API}/users/{user['id']}",
            headers=H(tok),
            json={"google_email": self.email_val},
            timeout=30,
        )
        assert r.status_code == 200, f"{r.status_code} {r.text}"
        body = r.json()
        assert body.get("google_email") == self.email_val

    def test_me_includes_google_email(self, super_login):
        tok, _ = super_login
        r = requests.get(f"{API}/auth/me", headers=H(tok), timeout=30)
        assert r.status_code == 200, r.text
        body = r.json()
        assert "google_email" in body
        assert body["google_email"] == self.email_val

    def test_patch_other_user_same_email_409(self, super_login, other_user_id):
        tok, _ = super_login
        r = requests.patch(
            f"{API}/users/{other_user_id}",
            headers=H(tok),
            json={"google_email": self.email_val},
            timeout=30,
        )
        assert r.status_code == 409, f"{r.status_code} {r.text}"
        assert "sudah dipakai" in r.json().get("detail", "").lower() \
            or "already" in r.json().get("detail", "").lower() \
            or "google" in r.json().get("detail", "").lower()


# ============================================================
# 4) POST /users google_email uniqueness (with cleanup)
# ============================================================
class TestCreateUserGoogleEmail:
    created_ids: list = []

    def test_create_user_with_google_email(self, super_login):
        tok, _ = super_login
        payload = {
            "username": f"ga_test_{uuid.uuid4().hex[:6]}",
            "password": "pw123",
            "role": "sales",
            "name": "GA Test",
            "group_letter": "A",
            "sales_code": f"A{99 + len(self.created_ids)}",
            "google_email": f"gauser_{uuid.uuid4().hex[:8]}@example.com",
        }
        r = requests.post(f"{API}/users", headers=H(tok), json=payload, timeout=30)
        assert r.status_code == 200, f"{r.status_code} {r.text}"
        u = r.json()
        assert u["google_email"] == payload["google_email"].lower()
        self.__class__.created_ids.append(u["id"])
        self.__class__._last_payload = payload

    def test_create_user_duplicate_google_email_409(self, super_login):
        tok, _ = super_login
        prev = getattr(self.__class__, "_last_payload", None)
        assert prev is not None, "previous test must run first"
        payload = {
            "username": f"ga_test_dup_{uuid.uuid4().hex[:6]}",
            "password": "pw123",
            "role": "sales",
            "name": "GA Dup",
            "group_letter": "A",
            "sales_code": "A98",
            "google_email": prev["google_email"],
        }
        r = requests.post(f"{API}/users", headers=H(tok), json=payload, timeout=30)
        assert r.status_code == 409, f"{r.status_code} {r.text}"

    def test_cleanup_created_users(self, super_login):
        tok, _ = super_login
        for uid in self.__class__.created_ids:
            r = requests.delete(f"{API}/users/{uid}", headers=H(tok), timeout=30)
            assert r.status_code in (200, 204, 404), f"cleanup failed {r.status_code} {r.text}"
        self.__class__.created_ids = []


# ============================================================
# 5) Dual-token support: emg_ session_token via Mongo insert
# ============================================================
class TestEmgSessionToken:
    valid_token = "emg_" + secrets.token_urlsafe(48)
    expired_token = "emg_" + secrets.token_urlsafe(48)

    def test_seed_valid_and_expired_sessions(self, super_login, mongo):
        _, user = super_login
        db, loop = mongo

        async def _seed():
            await db.user_sessions.insert_one({
                "session_token": self.valid_token,
                "user_id": user["id"],
                "email": "test-google@example.com",
                "created_at": datetime.now(timezone.utc),
                "expires_at": datetime.now(timezone.utc) + timedelta(days=7),
            })
            await db.user_sessions.insert_one({
                "session_token": self.expired_token,
                "user_id": user["id"],
                "email": "test-google@example.com",
                "created_at": datetime.now(timezone.utc) - timedelta(days=8),
                "expires_at": datetime.now(timezone.utc) - timedelta(days=1),
            })

        loop.run_until_complete(_seed())

    def test_me_with_valid_emg_token(self, super_login):
        r = requests.get(f"{API}/auth/me", headers=H(self.valid_token), timeout=30)
        assert r.status_code == 200, f"{r.status_code} {r.text}"
        body = r.json()
        _, user = super_login
        assert body["id"] == user["id"]
        assert body["username"] == "superadmin"

    def test_me_with_expired_emg_token(self):
        # Note: MongoDB TTL runs every ~60s. We may need to check by expiry logic
        # which is enforced in get_current_user, not by TTL deletion.
        r = requests.get(f"{API}/auth/me", headers=H(self.expired_token), timeout=30)
        # Could be 401 "Session expired" or 401 "Invalid session" if TTL already deleted it.
        assert r.status_code == 401, f"{r.status_code} {r.text}"
        detail = r.json().get("detail", "").lower()
        assert "session" in detail or "expired" in detail

    def test_logout_with_emg_token(self):
        r = requests.post(f"{API}/auth/logout", headers=H(self.valid_token), timeout=30)
        assert r.status_code == 200, f"{r.status_code} {r.text}"
        assert r.json().get("ok") is True

    def test_me_after_logout_returns_401(self):
        r = requests.get(f"{API}/auth/me", headers=H(self.valid_token), timeout=30)
        assert r.status_code == 401, f"{r.status_code} {r.text}"

    def test_jwt_logout_does_not_invalidate(self, super_login):
        tok, _ = super_login
        # Logout with JWT (stateless) — server just returns ok
        r = requests.post(f"{API}/auth/logout", headers=H(tok), timeout=30)
        assert r.status_code == 200
        # Old JWT still works because it's stateless
        r2 = requests.get(f"{API}/auth/me", headers=H(tok), timeout=30)
        assert r2.status_code == 200, f"JWT was unexpectedly invalidated: {r2.status_code} {r2.text}"

    def test_cleanup_expired_token(self, mongo):
        db, loop = mongo

        async def _clean():
            await db.user_sessions.delete_many({
                "session_token": {"$in": [self.valid_token, self.expired_token]}
            })

        loop.run_until_complete(_clean())


# ============================================================
# 6) Cleanup: clear google_email on superadmin so re-runs work
# ============================================================
class TestFinalCleanup:
    def test_clear_google_email(self, super_login):
        tok, user = super_login
        r = requests.patch(
            f"{API}/users/{user['id']}",
            headers=H(tok),
            json={"google_email": ""},
            timeout=30,
        )
        assert r.status_code == 200, r.text
        assert r.json().get("google_email") in (None, "")
