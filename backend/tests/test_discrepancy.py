"""Backend regression tests for the new "Selisih Galon Merah/Hijau" feature.

Endpoints under test:
  - POST  /api/warehouse/daily              (with photo_isi_* / photo_kosong_* data URIs)
  - PATCH /api/warehouse/daily/{id}         (unset photo via empty string, edit_count bump)
  - GET   /api/warehouse/discrepancy        (merah/hijau/summary)
  - POST  /api/warehouse/daily/{id}/clear-hijau   (RBAC: admin/super_admin only, group scoped)
  - POST  /api/warehouse/daily/{id}/restore-hijau
  - Regression: GET /api/warehouse/stock (gudang), GET /api/expenses (sales)

All tests are idempotent. Test data is created on fixed past dates (2020-01-*) and
teardown removes it via super_admin DELETE endpoints.
"""
from __future__ import annotations

import pytest
import requests

BASE_URL = "http://localhost:8001/api"

# Sales A1 UUID from credentials memo
SALES_A1_ID = "a4bf1f67-4bd7-48c0-85c2-1befc26bd6be"

# Fixed test dates in the past — safe to clean up without touching real data
DATE_T3 = "2020-01-15"   # discrepancy scenarios (merah/hijau/clear/restore)
DATE_T4 = "2020-01-17"   # RBAC clear-hijau test (isolated from DATE_T3 for parallel-safe)
DATE_T5_A = "2020-01-13" # summary aggregation — merah day
DATE_T5_B = "2020-01-14" # summary aggregation — hijau day
DATE_PHOTO = "2020-01-16"  # photo-test date

TINY_PNG_DATA_URI = (
    "data:image/png;base64,"
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII="
)


def _login(session: requests.Session, username: str, password: str) -> str:
    r = session.post(
        f"{BASE_URL}/auth/login",
        json={"username": username, "password": password},
    )
    assert r.status_code == 200, f"login {username} failed: {r.status_code} {r.text}"
    return r.json()["access_token"]


def _auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


@pytest.fixture(scope="module")
def http() -> requests.Session:
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def tokens(http: requests.Session) -> dict:
    return {
        "super": _login(http, "superadmin", "super123"),
        "gudang": _login(http, "gudang1", "gudang123"),
        "produksi": _login(http, "produksi1", "prod123"),
        "adminA": _login(http, "adminA", "admin123"),
        "adminB": _login(http, "adminB", "admin123"),
        "salesA1": _login(http, "A1", "sales123"),
    }


# ---------------------------------------------------------------------------
# Cleanup helpers (idempotent, use super_admin token)
# ---------------------------------------------------------------------------
def _cleanup_warehouse_daily(http: requests.Session, super_token: str, date: str) -> None:
    r = http.get(
        f"{BASE_URL}/warehouse/daily",
        params={"date_from": date, "date_to": date, "sales_id": SALES_A1_ID},
        headers=_auth(super_token),
    )
    if r.status_code != 200:
        return
    for row in r.json():
        http.delete(
            f"{BASE_URL}/warehouse/daily/{row['id']}",
            headers=_auth(super_token),
        )


def _cleanup_production_daily(http: requests.Session, super_token: str, date: str) -> None:
    r = http.get(
        f"{BASE_URL}/production/daily",
        params={"date_from": date, "date_to": date, "sales_id": SALES_A1_ID},
        headers=_auth(super_token),
    )
    if r.status_code != 200:
        return
    for row in r.json():
        http.delete(
            f"{BASE_URL}/production/daily/{row['id']}",
            headers=_auth(super_token),
        )


@pytest.fixture(scope="module", autouse=True)
def _pre_and_post_cleanup(http: requests.Session, tokens: dict):
    # Per-class dates are isolated. This module-scoped fixture runs per xdist worker,
    # so we only clean dates that belong to classes on THIS worker (best-effort). To
    # be strictly safe against cross-worker races, each test class also cleans its own
    # dates in class-scoped fixtures below.
    yield
    # No global teardown here — per-class fixtures handle cleanup deterministically.


def _wipe_dates(http: requests.Session, super_token: str, dates: list[str]) -> None:
    for d in dates:
        _cleanup_warehouse_daily(http, super_token, d)
        _cleanup_production_daily(http, super_token, d)


# ---------------------------------------------------------------------------
# 1) POST /api/warehouse/daily with 4 photo_* data URIs
# 2) PATCH photo_isi_pagi="" unsets photo, bumps edit_count
# ---------------------------------------------------------------------------
class TestWarehousePhotoFields:
    @pytest.fixture(autouse=True)
    def _cleanup(self, http, tokens):
        _wipe_dates(http, tokens["super"], [DATE_PHOTO])
        yield
        _wipe_dates(http, tokens["super"], [DATE_PHOTO])

    def test_create_and_patch_photos(self, http: requests.Session, tokens: dict):
        payload = {
            "date": DATE_PHOTO,
            "shift": "pagi",
            "sales_id": SALES_A1_ID,
            "bawa_pagi": 10,
            "sisa_pagi": 3,
            "photo_isi_pagi": TINY_PNG_DATA_URI,
            "photo_isi_siang": TINY_PNG_DATA_URI,
            "photo_kosong_siang": TINY_PNG_DATA_URI,
            "photo_kosong_sore": TINY_PNG_DATA_URI,
        }
        r = http.post(
            f"{BASE_URL}/warehouse/daily",
            json=payload,
            headers=_auth(tokens["gudang"]),
        )
        assert r.status_code == 200, r.text
        doc = r.json()
        entry_id = doc["id"]
        assert doc.get("photo_isi_pagi") == TINY_PNG_DATA_URI
        assert doc.get("photo_isi_siang") == TINY_PNG_DATA_URI
        assert doc.get("photo_kosong_siang") == TINY_PNG_DATA_URI
        assert doc.get("photo_kosong_sore") == TINY_PNG_DATA_URI

        # Verify persistence via GET list
        g = http.get(
            f"{BASE_URL}/warehouse/daily",
            params={"date_from": DATE_PHOTO, "date_to": DATE_PHOTO, "sales_id": SALES_A1_ID},
            headers=_auth(tokens["gudang"]),
        )
        assert g.status_code == 200, g.text
        rows = g.json()
        assert any(r_["id"] == entry_id and r_.get("photo_isi_pagi") for r_ in rows)

        # PATCH: unset photo_isi_pagi
        p = http.patch(
            f"{BASE_URL}/warehouse/daily/{entry_id}",
            json={"photo_isi_pagi": ""},
            headers=_auth(tokens["gudang"]),
        )
        assert p.status_code == 200, p.text
        updated = p.json()
        assert "photo_isi_pagi" not in updated or not updated.get("photo_isi_pagi"), (
            f"photo_isi_pagi should be unset, got: {updated.get('photo_isi_pagi')!r}"
        )
        # Other photos preserved
        assert updated.get("photo_isi_siang") == TINY_PNG_DATA_URI
        assert updated.get("photo_kosong_siang") == TINY_PNG_DATA_URI
        assert updated.get("photo_kosong_sore") == TINY_PNG_DATA_URI
        assert int(updated.get("edit_count", 0)) == 1


# ---------------------------------------------------------------------------
# 3) Discrepancy: merah, hijau, clear, restore
# ---------------------------------------------------------------------------
class TestDiscrepancyFlow:
    @pytest.fixture(autouse=True)
    def _cleanup(self, http, tokens):
        _wipe_dates(http, tokens["super"], [DATE_T3])
        yield
        _wipe_dates(http, tokens["super"], [DATE_T3])

    def test_merah_then_hijau_then_clear_then_restore(
        self, http: requests.Session, tokens: dict
    ):
        # Skenario MERAH: bawa=8, galon_kembali=5 → kembali<bawa → merah=3
        wh = http.post(
            f"{BASE_URL}/warehouse/daily",
            json={
                "date": DATE_T3,
                "shift": "pagi",
                "sales_id": SALES_A1_ID,
                "bawa_pagi": 8,
                "kosong_kembali_siang": 5,
            },
            headers=_auth(tokens["gudang"]),
        )
        assert wh.status_code == 200, wh.text
        wh_id = wh.json()["id"]

        # GET discrepancy → merah=3, hijau=0
        r = http.get(
            f"{BASE_URL}/warehouse/discrepancy",
            params={
                "date_from": DATE_T3,
                "date_to": DATE_T3,
                "sales_id": SALES_A1_ID,
            },
            headers=_auth(tokens["adminA"]),
        )
        assert r.status_code == 200, r.text
        body = r.json()
        assert len(body["entries"]) == 1, body
        e = body["entries"][0]
        assert e["sales_id"] == SALES_A1_ID
        assert e["merah"] == 3, e
        assert e["hijau"] == 0, e
        assert e["bawa_total"] == 8
        assert e["galon_kembali"] == 5
        assert e["selisih"] == -3

        # PATCH kosong_kembali_siang=12 → kembali=12 > bawa=8 → hijau=4
        p = http.patch(
            f"{BASE_URL}/warehouse/daily/{wh_id}",
            json={"kosong_kembali_siang": 12},
            headers=_auth(tokens["gudang"]),
        )
        assert p.status_code == 200, p.text

        r = http.get(
            f"{BASE_URL}/warehouse/discrepancy",
            params={
                "date_from": DATE_T3,
                "date_to": DATE_T3,
                "sales_id": SALES_A1_ID,
            },
            headers=_auth(tokens["adminA"]),
        )
        assert r.status_code == 200
        e = r.json()["entries"][0]
        assert e["merah"] == 0, e
        assert e["hijau"] == 4, e
        assert e["hijau_raw"] == 4
        assert e["hijau_cleared"] in (False, None) or not e["hijau_cleared"]

        # POST clear-hijau as adminA (group A ↔ A1 group A) → 200
        c = http.post(
            f"{BASE_URL}/warehouse/daily/{wh_id}/clear-hijau",
            headers=_auth(tokens["adminA"]),
        )
        assert c.status_code == 200, c.text

        r = http.get(
            f"{BASE_URL}/warehouse/discrepancy",
            params={
                "date_from": DATE_T3,
                "date_to": DATE_T3,
                "sales_id": SALES_A1_ID,
            },
            headers=_auth(tokens["adminA"]),
        )
        # After clear + hijau_raw=4, entries are still non-noise because hijau_raw>0
        assert r.status_code == 200
        entries = r.json()["entries"]
        assert len(entries) == 1, entries
        e = entries[0]
        assert e["hijau"] == 0, e
        assert e["hijau_raw"] == 4, e
        assert e["hijau_cleared"] is True, e

        # POST restore-hijau as adminA → 200
        rs = http.post(
            f"{BASE_URL}/warehouse/daily/{wh_id}/restore-hijau",
            headers=_auth(tokens["adminA"]),
        )
        assert rs.status_code == 200, rs.text

        r = http.get(
            f"{BASE_URL}/warehouse/discrepancy",
            params={
                "date_from": DATE_T3,
                "date_to": DATE_T3,
                "sales_id": SALES_A1_ID,
            },
            headers=_auth(tokens["adminA"]),
        )
        assert r.status_code == 200
        e = r.json()["entries"][0]
        assert e["hijau"] == 4, e
        assert not e.get("hijau_cleared"), e


# ---------------------------------------------------------------------------
# 4) Guard clear-hijau access
# ---------------------------------------------------------------------------
class TestClearHijauRBAC:
    @pytest.fixture(autouse=True)
    def _cleanup(self, http, tokens):
        _wipe_dates(http, tokens["super"], [DATE_T4])
        yield
        _wipe_dates(http, tokens["super"], [DATE_T4])

    def test_rbac_denies_non_admin_and_wrong_group(
        self, http: requests.Session, tokens: dict
    ):
        # Ensure an entry exists on isolated DATE_T4 (parallel-safe)
        wh = http.post(
            f"{BASE_URL}/warehouse/daily",
            json={
                "date": DATE_T4,
                "shift": "siang",
                "sales_id": SALES_A1_ID,
                "sisa_siang": 1,
            },
            headers=_auth(tokens["gudang"]),
        )
        assert wh.status_code == 200, wh.text
        wh_id = wh.json()["id"]

        # gudang1 → 403
        r1 = http.post(
            f"{BASE_URL}/warehouse/daily/{wh_id}/clear-hijau",
            headers=_auth(tokens["gudang"]),
        )
        assert r1.status_code == 403, r1.text

        # A1 (sales) → 403
        r2 = http.post(
            f"{BASE_URL}/warehouse/daily/{wh_id}/clear-hijau",
            headers=_auth(tokens["salesA1"]),
        )
        assert r2.status_code == 403, r2.text

        # adminB (wrong wilayah) → 403
        r3 = http.post(
            f"{BASE_URL}/warehouse/daily/{wh_id}/clear-hijau",
            headers=_auth(tokens["adminB"]),
        )
        assert r3.status_code == 403, r3.text


# ---------------------------------------------------------------------------
# 5) Aggregation summary
# ---------------------------------------------------------------------------
class TestDiscrepancySummary:
    @pytest.fixture(autouse=True)
    def _cleanup(self, http, tokens):
        _wipe_dates(http, tokens["super"], [DATE_T5_A, DATE_T5_B])
        yield
        _wipe_dates(http, tokens["super"], [DATE_T5_A, DATE_T5_B])

    def test_summary_aggregation_two_days(
        self, http: requests.Session, tokens: dict
    ):
        # Day A → merah=3: bawa=5, kembali=2 → selisih=-3
        wh_a = http.post(
            f"{BASE_URL}/warehouse/daily",
            json={
                "date": DATE_T5_A,
                "shift": "pagi",
                "sales_id": SALES_A1_ID,
                "bawa_pagi": 5,
                "kosong_kembali_siang": 2,
            },
            headers=_auth(tokens["gudang"]),
        )
        assert wh_a.status_code == 200, wh_a.text

        # Day B → hijau=2: bawa=8, kembali=10 → selisih=+2
        wh_b = http.post(
            f"{BASE_URL}/warehouse/daily",
            json={
                "date": DATE_T5_B,
                "shift": "pagi",
                "sales_id": SALES_A1_ID,
                "bawa_pagi": 8,
                "kosong_kembali_siang": 10,
            },
            headers=_auth(tokens["gudang"]),
        )
        assert wh_b.status_code == 200, wh_b.text

        r = http.get(
            f"{BASE_URL}/warehouse/discrepancy",
            params={
                "date_from": DATE_T5_A,
                "date_to": DATE_T5_B,
                "sales_id": SALES_A1_ID,
            },
            headers=_auth(tokens["adminA"]),
        )
        assert r.status_code == 200, r.text
        body = r.json()
        summary = body["summary"]
        assert len(summary) == 1, summary
        s = summary[0]
        assert s["sales_id"] == SALES_A1_ID
        assert s["total_merah"] == 3, s
        assert s["total_hijau"] == 2, s
        assert s["days_merah"] == 1, s
        assert s["days_hijau"] == 1, s


# ---------------------------------------------------------------------------
# 6) Regression: prior endpoints still functional
# ---------------------------------------------------------------------------
class TestRegressionPriorEndpoints:
    def test_warehouse_stock_gudang(self, http: requests.Session, tokens: dict):
        r = http.get(
            f"{BASE_URL}/warehouse/stock",
            headers=_auth(tokens["gudang"]),
        )
        assert r.status_code == 200, r.text
        data = r.json()
        # Response is dict keyed by Part Name (SuperAdmin's part_prices)
        assert isinstance(data, dict)
        for key in ("Galon Polos", "Seal", "Mur", "Kran"):
            assert key in data, f"missing stock key {key}: {data}"

    def test_expenses_sales(self, http: requests.Session, tokens: dict):
        r = http.get(
            f"{BASE_URL}/expenses",
            headers=_auth(tokens["salesA1"]),
        )
        assert r.status_code == 200, r.text
        assert isinstance(r.json(), list)
