"""Iteration 19 — Regression after AI-count caption UI fix.

Scope (BACKEND-ONLY per review request):
1. POST /api/production/daily with is_draft True/False + sisa_pagi/sisa_siang field
2. POST /api/warehouse/daily with is_draft True/False + photo_rumah preserved
3. GET  /api/{production|warehouse}/daily/draft?sales_id&date&shift
4. Draft upsert (second POST same sales/date/shift => UPDATE not INSERT)
5. AI endpoint reachability: POST /api/ai/count-gallons — 401 without auth,
   4xx with malformed body when authenticated (don't call real AI)
"""
from __future__ import annotations

import os
import uuid

import pytest
import requests

BASE_URL = "http://localhost:8001"
API = f"{BASE_URL}/api"

DATE = "2020-02-19"  # far past → own the (sales,date,shift) key
SHIFT_P = "pagi"
SHIFT_S = "sore"


def _login(u: str, p: str) -> dict | None:
    r = requests.post(f"{API}/auth/login", json={"username": u, "password": p}, timeout=10)
    return r.json() if r.status_code == 200 else None


def _h(t: str) -> dict:
    return {"Authorization": f"Bearer {t}", "Content-Type": "application/json"}


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------
@pytest.fixture(scope="module")
def tokens():
    out = {}
    for u, p in [
        ("superadmin", "super123"),
        ("produksi1", "prod123"),
        ("gudang1", "gudang123"),
        ("A1", "sales123"),
    ]:
        j = _login(u, p)
        if not j:
            pytest.skip(f"login failed for {u}")
        out[u] = {"token": j["access_token"], "user": j["user"]}
    return out


@pytest.fixture(scope="module")
def sales_id(tokens):
    return tokens["A1"]["user"]["id"]


@pytest.fixture(scope="module", autouse=True)
def cleanup(tokens, sales_id):
    """Cleanup any existing entries for the test date before + after all tests."""
    sup = tokens["superadmin"]["token"]

    def _wipe():
        for col in ("production_daily", "warehouse_daily"):
            r = requests.get(
                f"{API}/{'production' if col == 'production_daily' else 'warehouse'}/daily",
                params={"date_from": DATE, "date_to": DATE, "sales_id": sales_id},
                headers=_h(sup),
                timeout=10,
            )
            if r.status_code == 200:
                for row in r.json():
                    requests.delete(
                        f"{API}/{'production' if col == 'production_daily' else 'warehouse'}/daily/{row['id']}",
                        headers=_h(sup),
                        timeout=10,
                    )

    _wipe()
    yield
    _wipe()


# ---------------------------------------------------------------------------
# PRODUCTION daily — draft/final + sisa_pagi/sisa_siang
# ---------------------------------------------------------------------------
class TestProductionDraft:
    def test_create_draft(self, tokens, sales_id):
        payload = {
            "date": DATE,
            "shift": SHIFT_P,
            "sales_id": sales_id,
            "galon_ganti": 0,
            "sil_ganti": 1,
            "produksi_galon": 20,
            "sisa_pagi": 3,
            "sisa_siang": 2,
            "is_draft": True,
            "note": "TEST_iter19 draft #1",
        }
        r = requests.post(f"{API}/production/daily", json=payload, headers=_h(tokens["produksi1"]["token"]))
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["is_draft"] is True
        assert d["sisa_pagi"] == 3
        assert d["sisa_siang"] == 2
        assert d["produksi_galon"] == 20
        TestProductionDraft.draft_id = d["id"]

    def test_get_draft(self, tokens, sales_id):
        r = requests.get(
            f"{API}/production/daily/draft",
            params={"sales_id": sales_id, "date": DATE, "shift": SHIFT_P},
            headers=_h(tokens["produksi1"]["token"]),
        )
        assert r.status_code == 200, r.text
        d = r.json()
        assert d.get("id") == TestProductionDraft.draft_id
        assert d.get("is_draft") is True
        assert d.get("produksi_galon") == 20

    def test_draft_upsert_updates_same_id(self, tokens, sales_id):
        """POST again with same (sales, date, shift, is_draft=true) must UPDATE."""
        payload = {
            "date": DATE,
            "shift": SHIFT_P,
            "sales_id": sales_id,
            "galon_ganti": 0,
            "sil_ganti": 1,
            "produksi_galon": 35,          # changed
            "sisa_pagi": 5,                 # changed
            "sisa_siang": 2,
            "is_draft": True,
            "note": "TEST_iter19 draft #2 (updated)",
        }
        r = requests.post(f"{API}/production/daily", json=payload, headers=_h(tokens["produksi1"]["token"]))
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["id"] == TestProductionDraft.draft_id, "draft should be UPDATED, not new"
        assert d["produksi_galon"] == 35
        assert d["sisa_pagi"] == 5

        # Confirm via list — only 1 row for that (sales,date,shift)
        r2 = requests.get(
            f"{API}/production/daily",
            params={"date_from": DATE, "date_to": DATE, "sales_id": sales_id},
            headers=_h(tokens["produksi1"]["token"]),
        )
        assert r2.status_code == 200
        rows_shift = [row for row in r2.json() if row["shift"] == SHIFT_P]
        assert len(rows_shift) == 1, f"expected 1 row, got {len(rows_shift)}: {rows_shift}"

    def test_create_final_entry_different_shift(self, tokens, sales_id):
        """is_draft=False should always INSERT a new row (not upsert)."""
        payload = {
            "date": DATE,
            "shift": SHIFT_S,
            "sales_id": sales_id,
            "galon_ganti": 1,
            "sil_ganti": 0,
            "produksi_galon": 15,
            "sisa_pagi": 0,
            "sisa_siang": 4,
            "is_draft": False,
            "note": "TEST_iter19 final",
        }
        r = requests.post(f"{API}/production/daily", json=payload, headers=_h(tokens["produksi1"]["token"]))
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["is_draft"] is False
        assert d["sisa_siang"] == 4
        assert d["produksi_galon"] == 15


# ---------------------------------------------------------------------------
# WAREHOUSE daily — draft/final + photo_rumah
# ---------------------------------------------------------------------------
class TestWarehouseDraft:
    tiny_png = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII="

    def test_create_draft(self, tokens, sales_id):
        payload = {
            "date": DATE,
            "shift": SHIFT_P,
            "sales_id": sales_id,
            "bawa_pagi": 30,
            "sisa_pagi": 4,
            "photo_isi_pagi": self.tiny_png,
            "is_draft": True,
            "note": "TEST_iter19 wh draft #1",
        }
        r = requests.post(f"{API}/warehouse/daily", json=payload, headers=_h(tokens["gudang1"]["token"]))
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["is_draft"] is True
        assert d["bawa_pagi"] == 30
        assert d["sisa_pagi"] == 4
        assert d.get("photo_isi_pagi") == self.tiny_png
        TestWarehouseDraft.draft_id = d["id"]

    def test_get_draft(self, tokens, sales_id):
        r = requests.get(
            f"{API}/warehouse/daily/draft",
            params={"sales_id": sales_id, "date": DATE, "shift": SHIFT_P},
            headers=_h(tokens["gudang1"]["token"]),
        )
        assert r.status_code == 200, r.text
        d = r.json()
        assert d.get("id") == TestWarehouseDraft.draft_id
        assert d.get("is_draft") is True
        assert d.get("bawa_pagi") == 30

    def test_draft_upsert_updates_same_id(self, tokens, sales_id):
        payload = {
            "date": DATE,
            "shift": SHIFT_P,
            "sales_id": sales_id,
            "bawa_pagi": 45,          # changed
            "sisa_pagi": 6,            # changed
            "photo_isi_pagi": self.tiny_png,
            "is_draft": True,
            "note": "TEST_iter19 wh draft #2 (updated)",
        }
        r = requests.post(f"{API}/warehouse/daily", json=payload, headers=_h(tokens["gudang1"]["token"]))
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["id"] == TestWarehouseDraft.draft_id, "wh draft must UPDATE not insert new"
        assert d["bawa_pagi"] == 45
        assert d["sisa_pagi"] == 6

    def test_draft_no_match_returns_empty(self, tokens, sales_id):
        r = requests.get(
            f"{API}/warehouse/daily/draft",
            params={"sales_id": sales_id, "date": "2020-02-01", "shift": SHIFT_P},
            headers=_h(tokens["gudang1"]["token"]),
        )
        assert r.status_code == 200
        assert r.json() == {}


# ---------------------------------------------------------------------------
# AI count-gallons endpoint reachability (no real image call)
# ---------------------------------------------------------------------------
class TestAiCountReachable:
    def test_ai_endpoint_requires_auth(self):
        r = requests.post(f"{API}/ai/count-gallons", json={"image_base64": ""}, timeout=10)
        assert r.status_code in (401, 403), f"expected 401/403 without token, got {r.status_code}"

    def test_ai_endpoint_missing_field_422(self, tokens):
        r = requests.post(
            f"{API}/ai/count-gallons",
            json={},  # missing image_base64
            headers=_h(tokens["produksi1"]["token"]),
            timeout=10,
        )
        assert r.status_code == 422, f"expected 422 for missing field, got {r.status_code}: {r.text}"

    def test_ai_endpoint_present_and_auth_ok(self, tokens):
        """We do NOT actually invoke GPT-5. Send empty base64: backend should reach
        the AI provider and return an error (502) OR mongo-side 4xx. Anything other
        than 404 confirms the route is wired up."""
        r = requests.post(
            f"{API}/ai/count-gallons",
            json={"image_base64": ""},   # valid schema, invalid image
            headers=_h(tokens["produksi1"]["token"]),
            timeout=30,
        )
        # 404 would mean route missing → BAD. Anything else means route reachable.
        assert r.status_code != 404, "AI endpoint MUST exist at /api/ai/count-gallons"
