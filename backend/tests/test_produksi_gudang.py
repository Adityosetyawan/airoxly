"""Backend regression tests for Produksi & Gudang module + monthly_report auto-fill.

Covers:
- Login for produksi/gudang/admin/superadmin
- POST/GET/PATCH/DELETE /api/production/daily (edit 1x limit, delete forbidden for produksi)
- POST/GET/PATCH/DELETE /api/warehouse/daily (edit 1x limit, delete forbidden for gudang)
- POST/GET /api/warehouse/incoming, GET /api/warehouse/stock
- GET /api/production/validate-sales/{sales_id}/{date}
- GET /api/reports/monthly (parts auto-fill + prod_wh_summary)
"""
import os
import pytest
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "http://localhost:8001").rstrip("/")
API = f"{BASE_URL}/api"

TEST_DATE = "2026-08-15"
TEST_YEAR = 2026
TEST_MONTH = 8


def _login(username: str, password: str) -> dict | None:
    r = requests.post(f"{API}/auth/login", json={"username": username, "password": password}, timeout=10)
    if r.status_code != 200:
        return None
    return r.json()


@pytest.fixture(scope="session")
def tokens():
    """Login all required users; skip suite if produksi/gudang seed missing."""
    out = {}
    for u, p in [
        ("superadmin", "super123"),
        ("adminA", "admin123"),
        ("produksi1", "prod123"),
        ("produksi2", "prod123"),
        ("gudang1", "gudang123"),
        ("gudang2", "gudang123"),
        ("A1", "sales123"),
    ]:
        j = _login(u, p)
        if j is None:
            out[u] = None
        else:
            out[u] = {"token": j["access_token"], "user": j["user"]}
    # produksi/gudang/admin are required
    for req in ("produksi1", "gudang1", "adminA", "A1"):
        if out.get(req) is None:
            pytest.skip(f"Required seed user missing: {req}")
    return out


def _h(t):
    return {"Authorization": f"Bearer {t}", "Content-Type": "application/json"}


@pytest.fixture(scope="session")
def sales_id(tokens):
    # Use A1's user id
    return tokens["A1"]["user"]["id"]


# ---------------- Health ----------------
def test_health():
    r = requests.get(f"{API}/health", timeout=10)
    assert r.status_code == 200
    assert r.json().get("status") == "ok"


# ---------------- Auth for new roles ----------------
def test_produksi_login_has_kelompok(tokens):
    u = tokens["produksi1"]["user"]
    assert u["role"] == "produksi"
    assert u.get("kelompok"), "produksi1 should have kelompok field"


def test_gudang_login_has_kelompok(tokens):
    u = tokens["gudang1"]["user"]
    assert u["role"] == "gudang"
    assert u.get("kelompok"), "gudang1 should have kelompok field"


# ---------------- Production endpoints ----------------
class TestProductionDaily:
    entry_id = None

    def test_create_production_daily(self, tokens, sales_id):
        payload = {
            "date": TEST_DATE,
            "shift": "pagi",
            "sales_id": sales_id,
            "galon_ganti": 0,
            "sil_ganti": 5,
            "kran_ganti": 3,
            "produksi_galon": 40,
            "note": "TEST_pytest",
        }
        r = requests.post(f"{API}/production/daily", json=payload, headers=_h(tokens["produksi1"]["token"]))
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["sales_id"] == sales_id
        assert data["sil_ganti"] == 5
        assert data["kelompok"] == tokens["produksi1"]["user"]["kelompok"]
        assert data.get("sales_code") == "A1"
        TestProductionDaily.entry_id = data["id"]

    def test_list_shows_entry(self, tokens):
        assert TestProductionDaily.entry_id
        r = requests.get(
            f"{API}/production/daily",
            params={"date_from": TEST_DATE, "date_to": TEST_DATE},
            headers=_h(tokens["produksi1"]["token"]),
        )
        assert r.status_code == 200
        ids = [e["id"] for e in r.json()]
        assert TestProductionDaily.entry_id in ids

    def test_edit_once_succeeds(self, tokens):
        assert TestProductionDaily.entry_id
        r = requests.patch(
            f"{API}/production/daily/{TestProductionDaily.entry_id}",
            json={"sil_ganti": 6},
            headers=_h(tokens["produksi1"]["token"]),
        )
        assert r.status_code == 200, r.text
        assert r.json()["sil_ganti"] == 6
        assert int(r.json().get("edit_count", 0)) == 1

    def test_edit_second_time_forbidden(self, tokens):
        assert TestProductionDaily.entry_id
        r = requests.patch(
            f"{API}/production/daily/{TestProductionDaily.entry_id}",
            json={"sil_ganti": 7},
            headers=_h(tokens["produksi1"]["token"]),
        )
        assert r.status_code == 403, f"expected 403, got {r.status_code}: {r.text}"

    def test_produksi_delete_forbidden(self, tokens):
        assert TestProductionDaily.entry_id
        r = requests.delete(
            f"{API}/production/daily/{TestProductionDaily.entry_id}",
            headers=_h(tokens["produksi1"]["token"]),
        )
        assert r.status_code == 403


# ---------------- Warehouse endpoints ----------------
class TestWarehouseFlow:
    incoming_id = None
    daily_id = None

    def test_stock_before(self, tokens):
        r = requests.get(f"{API}/warehouse/stock", headers=_h(tokens["gudang1"]["token"]))
        assert r.status_code == 200
        js = r.json()
        # Stock is now keyed by Part Name (dinamis). Legacy key "galon" dinormalisasi ke "Galon Polos".
        assert "Galon Polos" in js
        TestWarehouseFlow._stock_before = int(js.get("Galon Polos", 0))

    def test_add_incoming_galon(self, tokens):
        # Kirim key legacy "galon" — backend akan normalisasi ke "Galon Polos"
        payload = {"date": TEST_DATE, "item": "galon", "qty": 50, "note": "TEST_pytest incoming"}
        r = requests.post(f"{API}/warehouse/incoming", json=payload, headers=_h(tokens["gudang1"]["token"]))
        assert r.status_code == 200, r.text
        TestWarehouseFlow.incoming_id = r.json()["id"]

    def test_stock_increased(self, tokens):
        r = requests.get(f"{API}/warehouse/stock", headers=_h(tokens["gudang1"]["token"]))
        assert r.status_code == 200
        after = int(r.json().get("Galon Polos", 0))
        assert after >= TestWarehouseFlow._stock_before + 50, (
            f"expected stock to grow by 50 -> {TestWarehouseFlow._stock_before + 50}, got {after}"
        )

    def test_create_warehouse_daily(self, tokens, sales_id):
        payload = {
            "date": TEST_DATE,
            "shift": "pagi",
            "sales_id": sales_id,
            "bawa_pagi": 70,
            "sisa_pagi": 5,
            "seal_ganti": 0,
            "note": "TEST_pytest wh",
        }
        r = requests.post(f"{API}/warehouse/daily", json=payload, headers=_h(tokens["gudang1"]["token"]))
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["bawa_pagi"] == 70
        assert d["sisa_pagi"] == 5
        assert d["kelompok"] == tokens["gudang1"]["user"]["kelompok"]
        TestWarehouseFlow.daily_id = d["id"]

    def test_validate_sales(self, tokens, sales_id):
        r = requests.get(
            f"{API}/production/validate-sales/{sales_id}/{TEST_DATE}",
            headers=_h(tokens["gudang1"]["token"]),
        )
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["bawa_total"] == 70
        assert d["sisa_total"] == 5
        assert d["terjual_by_gudang"] == 65

    def test_edit_wh_once(self, tokens):
        assert TestWarehouseFlow.daily_id
        r = requests.patch(
            f"{API}/warehouse/daily/{TestWarehouseFlow.daily_id}",
            json={"sisa_pagi": 4},
            headers=_h(tokens["gudang1"]["token"]),
        )
        assert r.status_code == 200, r.text
        assert r.json()["sisa_pagi"] == 4

    def test_edit_wh_twice_forbidden(self, tokens):
        assert TestWarehouseFlow.daily_id
        r = requests.patch(
            f"{API}/warehouse/daily/{TestWarehouseFlow.daily_id}",
            json={"sisa_pagi": 3},
            headers=_h(tokens["gudang1"]["token"]),
        )
        assert r.status_code == 403

    def test_gudang_delete_daily_forbidden(self, tokens):
        assert TestWarehouseFlow.daily_id
        r = requests.delete(
            f"{API}/warehouse/daily/{TestWarehouseFlow.daily_id}",
            headers=_h(tokens["gudang1"]["token"]),
        )
        assert r.status_code == 403


# ---------------- Monthly report auto-fill ----------------
class TestMonthlyReport:
    def test_report_parts_auto_and_prod_wh_summary(self, tokens, sales_id):
        # Admin should see the sales in group A
        tok = tokens["adminA"]["token"]
        r = requests.get(
            f"{API}/reports/monthly",
            params={"sales_id": sales_id, "year": TEST_YEAR, "month": TEST_MONTH},
            headers=_h(tok),
        )
        assert r.status_code == 200, r.text
        d = r.json()

        # prod_wh_summary must be present with required fields
        pws = d.get("prod_wh_summary")
        assert pws is not None, "prod_wh_summary missing from monthly_report"
        for k in [
            "produksi_galon_total",
            "bawa_total",
            "sisa_total",
            "terjual_by_gudang",
            "terjual_by_transaksi",
            "match",
            "diff",
        ]:
            assert k in pws, f"prod_wh_summary missing '{k}'"
        # We inserted bawa=70 sisa=4 (after edit) but tests may run in any order -> just assert values are sane
        assert pws["bawa_total"] >= 70
        assert pws["terjual_by_gudang"] >= 60  # 70 - 5 (or 4)

        # parts should include Seal with auto qty >= 5 (we inserted sil_ganti=5 -> edited to 6)
        parts = {p["name"]: p for p in d.get("parts", [])}
        assert "Seal" in parts, f"Seal missing. names={list(parts.keys())}"
        assert parts["Seal"]["qty"] >= 5, f"Seal qty {parts['Seal']}"
        assert parts["Seal"]["source"] == "auto", f"Seal source={parts['Seal']['source']}"
        assert "Kran" in parts
        assert parts["Kran"]["qty"] >= 3
        assert parts["Kran"]["source"] == "auto"


# ---------------- Cleanup ----------------
def test_cleanup(tokens):
    """Delete TEST_ data using superadmin (if available)."""
    sup = tokens.get("superadmin")
    if not sup:
        pytest.skip("superadmin login failed - cleanup skipped")
    tok = sup["token"]
    if TestProductionDaily.entry_id:
        requests.delete(
            f"{API}/production/daily/{TestProductionDaily.entry_id}",
            headers=_h(tok),
        )
    if TestWarehouseFlow.daily_id:
        requests.delete(
            f"{API}/warehouse/daily/{TestWarehouseFlow.daily_id}",
            headers=_h(tok),
        )
    if TestWarehouseFlow.incoming_id:
        requests.delete(
            f"{API}/warehouse/incoming/{TestWarehouseFlow.incoming_id}",
            headers=_h(tok),
        )
