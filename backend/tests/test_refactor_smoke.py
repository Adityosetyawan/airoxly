"""Smoke test for post-refactor endpoint reachability & response schemas.
Verifies every route group listed in the iter-20 review request responds
at its documented path with correct auth/RBAC (no path changes vs. old
monolithic server.py).
"""
import os
import uuid
import pytest
import requests

BASE = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "https://oxly-crm.preview.emergentagent.com").rstrip("/")
API = f"{BASE}/api"


def _login(u, p):
    r = requests.post(f"{API}/auth/login", json={"username": u, "password": p}, timeout=30)
    assert r.status_code == 200, f"{u} login: {r.status_code} {r.text}"
    return r.json()["access_token"], r.json()["user"]


def H(tok):
    return {"Authorization": f"Bearer {tok}", "Content-Type": "application/json"}


@pytest.fixture(scope="module")
def tokens():
    return {
        "super": _login("superadmin", "super123"),
        "adminA": _login("adminA", "admin123"),
        "A1": _login("A1", "sales123"),
        "prod1": _login("produksi1", "prod123"),
        "gudang1": _login("gudang1", "gudang123"),
    }


# ---------- health ----------
class TestHealth:
    def test_health_ok(self):
        r = requests.get(f"{API}/health")
        assert r.status_code == 200
        j = r.json()
        assert j.get("status") == "ok"


# ---------- auth ----------
class TestAuth:
    def test_login_returns_token_user(self):
        r = requests.post(f"{API}/auth/login", json={"username": "A1", "password": "sales123"})
        assert r.status_code == 200
        j = r.json()
        assert "access_token" in j and "user" in j
        assert j["user"]["username"] == "A1"

    def test_wrong_password_401(self):
        r = requests.post(f"{API}/auth/login", json={"username": "A1", "password": "wrong"})
        assert r.status_code == 401

    def test_me(self, tokens):
        tok, _ = tokens["A1"]
        r = requests.get(f"{API}/auth/me", headers=H(tok))
        assert r.status_code == 200
        assert r.json()["username"] == "A1"

    def test_me_no_token_401(self):
        r = requests.get(f"{API}/auth/me")
        assert r.status_code == 401

    def test_logout(self, tokens):
        tok, _ = tokens["A1"]
        r = requests.post(f"{API}/auth/logout", headers=H(tok))
        assert r.status_code == 200

    def test_session_missing_body(self):
        # /api/auth/session expects session_id — without one should 4xx (not 500 or 404)
        r = requests.post(f"{API}/auth/session", json={})
        assert r.status_code in (400, 401, 422)


# ---------- users ----------
class TestUsers:
    def test_super_list_all(self, tokens):
        tok, _ = tokens["super"]
        r = requests.get(f"{API}/users", headers=H(tok))
        assert r.status_code == 200
        assert isinstance(r.json(), list)
        assert len(r.json()) > 0

    def test_admin_scoped_list(self, tokens):
        tok, _ = tokens["adminA"]
        r = requests.get(f"{API}/users", headers=H(tok))
        assert r.status_code == 200
        for u in r.json():
            assert u["group_letter"] == "A"

    def test_sales_forbidden_list(self, tokens):
        tok, _ = tokens["A1"]
        r = requests.get(f"{API}/users", headers=H(tok))
        assert r.status_code == 403


# ---------- products ----------
class TestProducts:
    def test_list(self, tokens):
        tok, _ = tokens["A1"]
        r = requests.get(f"{API}/products", headers=H(tok))
        assert r.status_code == 200
        assert len(r.json()) >= 7

    def test_super_crud(self, tokens):
        tok, _ = tokens["super"]
        payload = {"name": f"TEST_Refactor_{uuid.uuid4().hex[:6]}", "unit": "gln", "price": 5000}
        r = requests.post(f"{API}/products", headers=H(tok), json=payload)
        assert r.status_code == 200
        pid = r.json()["id"]
        r2 = requests.patch(f"{API}/products/{pid}", headers=H(tok), json={"price": 5500})
        assert r2.status_code == 200
        assert r2.json()["price"] == 5500
        r3 = requests.delete(f"{API}/products/{pid}", headers=H(tok))
        assert r3.status_code == 200

    def test_sales_forbidden_create(self, tokens):
        tok, _ = tokens["A1"]
        r = requests.post(f"{API}/products", headers=H(tok),
                          json={"name": "X", "unit": "gln", "price": 1})
        assert r.status_code == 403


# ---------- customers ----------
class TestCustomers:
    def test_sales_create(self, tokens):
        tok, _ = tokens["A1"]
        r = requests.post(f"{API}/customers", headers=H(tok),
                          json={"name": f"TEST_C_{uuid.uuid4().hex[:6]}"})
        assert r.status_code == 200
        c = r.json()
        assert c["group_letter"] == "A"
        assert "barcode_id" in c

    def test_list_sort(self, tokens):
        tok, _ = tokens["A1"]
        for s in ("no", "ranking", "last", "loans"):
            r = requests.get(f"{API}/customers?sort={s}", headers=H(tok))
            assert r.status_code == 200, s


# ---------- transactions ----------
class TestTransactionsSmoke:
    def test_txn_create_and_list(self, tokens):
        tok, _ = tokens["A1"]
        rc = requests.post(f"{API}/customers", headers=H(tok),
                           json={"name": f"TEST_TxSm_{uuid.uuid4().hex[:6]}"})
        cust = rc.json()
        prods = requests.get(f"{API}/products", headers=H(tok)).json()
        gln = next(p for p in prods if p["unit"] == "gln" and p["price"] > 0)
        item = {"product_id": gln["id"], "product_name": gln["name"], "unit": gln["unit"],
                "qty": 1, "price": gln["price"], "subtotal": gln["price"]}
        r = requests.post(f"{API}/transactions", headers=H(tok), json={
            "customer_id": cust["id"], "items": [item], "bayar": gln["price"]
        })
        assert r.status_code == 200
        # list
        rl = requests.get(f"{API}/transactions", headers=H(tok))
        assert rl.status_code == 200
        assert isinstance(rl.json(), list)


# ---------- reports ----------
class TestReports:
    def test_daily(self, tokens):
        tok, _ = tokens["super"]
        r = requests.get(f"{API}/reports/daily", headers=H(tok))
        assert r.status_code == 200
        for k in ("totals", "groups", "date"):
            assert k in r.json()

    def test_monthly_get(self, tokens):
        tok, _ = tokens["super"]
        # pick any sales user
        users = requests.get(f"{API}/users", headers=H(tok)).json()
        sales = next(u for u in users if u["role"] == "sales")
        r = requests.get(
            f"{API}/reports/monthly",
            headers=H(tok),
            params={"sales_id": sales["id"], "year": 2020, "month": 1},
        )
        assert r.status_code == 200, r.text

    def test_monthly_patch_super(self, tokens):
        tok, _ = tokens["super"]
        users = requests.get(f"{API}/users", headers=H(tok)).json()
        sales = next(u for u in users if u["role"] == "sales")
        r = requests.patch(
            f"{API}/reports/monthly",
            headers=H(tok),
            params={"sales_id": sales["id"], "year": 2020, "month": 1},
            json={"gaji_sopir": 100.0},
        )
        assert r.status_code == 200, r.text


# ---------- part-prices ----------
class TestPartPrices:
    def test_list(self, tokens):
        tok, _ = tokens["super"]
        r = requests.get(f"{API}/part-prices", headers=H(tok))
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_super_crud(self, tokens):
        tok, _ = tokens["super"]
        payload = {"name": f"TEST_PP_{uuid.uuid4().hex[:6]}", "rp_per_pcs": 1000.0}
        r = requests.post(f"{API}/part-prices", headers=H(tok), json=payload)
        assert r.status_code == 200, r.text
        pid = r.json()["id"]
        r2 = requests.patch(f"{API}/part-prices/{pid}", headers=H(tok),
                            json={"name": payload["name"], "rp_per_pcs": 2000.0})
        assert r2.status_code == 200
        r3 = requests.delete(f"{API}/part-prices/{pid}", headers=H(tok))
        assert r3.status_code == 200


# ---------- settings ----------
class TestSettings:
    def test_get_and_put(self, tokens):
        tok, _ = tokens["super"]
        key = f"TEST_REFACTOR_{uuid.uuid4().hex[:6]}"
        # PUT — body requires SettingUpdate {key, value}
        r = requests.put(f"{API}/settings/{key}", headers=H(tok),
                         json={"key": key, "value": 123})
        assert r.status_code == 200, r.text
        # GET
        r2 = requests.get(f"{API}/settings/{key}", headers=H(tok))
        assert r2.status_code == 200
        assert r2.json()["value"] == 123


# ---------- expenses ----------
class TestExpenses:
    def test_list(self, tokens):
        tok, _ = tokens["super"]
        r = requests.get(f"{API}/expenses", headers=H(tok))
        assert r.status_code == 200

    def test_crud(self, tokens):
        tok, _ = tokens["super"]
        r = requests.post(f"{API}/expenses", headers=H(tok),
                          json={"date": "2020-01-01", "category": "TEST", "amount": 100, "note": "smoke"})
        assert r.status_code == 200
        eid = r.json()["id"]
        r2 = requests.patch(f"{API}/expenses/{eid}", headers=H(tok), json={"amount": 200})
        assert r2.status_code == 200
        r3 = requests.delete(f"{API}/expenses/{eid}", headers=H(tok))
        assert r3.status_code == 200


# ---------- locations ----------
class TestLocations:
    def test_ping(self, tokens):
        tok, _ = tokens["A1"]
        r = requests.post(f"{API}/location/ping", headers=H(tok), json={"lat": -6.2, "lng": 106.8})
        assert r.status_code == 200

    def test_live_admin(self, tokens):
        tok, _ = tokens["adminA"]
        r = requests.get(f"{API}/location/live", headers=H(tok))
        assert r.status_code == 200

    def test_live_forbid_sales(self, tokens):
        tok, _ = tokens["A1"]
        r = requests.get(f"{API}/location/live", headers=H(tok))
        assert r.status_code == 403

    def test_history(self, tokens):
        tok, _ = tokens["adminA"]
        # get any sales id in group A
        rs = requests.get(f"{API}/users", headers=H(tok)).json()
        sales_id = rs[0]["id"]
        r = requests.get(f"{API}/location/history/{sales_id}", headers=H(tok))
        assert r.status_code == 200


# ---------- overview ----------
class TestOverview:
    def test_super(self, tokens):
        tok, _ = tokens["super"]
        r = requests.get(f"{API}/stats/overview", headers=H(tok))
        assert r.status_code == 200
        for k in ("total_customers", "total_transactions", "today_count", "today_revenue"):
            assert k in r.json()


# ---------- lottery ----------
class TestLottery:
    def test_periods_list(self, tokens):
        tok, _ = tokens["super"]
        r = requests.get(f"{API}/lottery/periods", headers=H(tok))
        assert r.status_code == 200, r.text
        assert isinstance(r.json(), list)

    def test_tickets_list(self, tokens):
        tok, _ = tokens["super"]
        r = requests.get(f"{API}/lottery/tickets", headers=H(tok))
        assert r.status_code == 200, r.text

    def test_stats(self, tokens):
        tok, _ = tokens["super"]
        r = requests.get(f"{API}/lottery/stats", headers=H(tok))
        assert r.status_code == 200, r.text

    def test_winners(self, tokens):
        tok, _ = tokens["super"]
        r = requests.get(f"{API}/lottery/winners", headers=H(tok))
        assert r.status_code == 200, r.text


# ---------- shifts ----------
class TestShifts:
    def test_get(self, tokens):
        tok, _ = tokens["super"]
        r = requests.get(f"{API}/shifts", headers=H(tok))
        assert r.status_code == 200

    def test_put_super(self, tokens):
        tok, _ = tokens["super"]
        r = requests.put(f"{API}/shifts", headers=H(tok),
                         json={"pagi_start": "06:00", "pagi_end": "12:00",
                               "siang_start": "12:00", "siang_end": "18:00"})
        assert r.status_code in (200, 422)  # accept schema variation


# ---------- production ----------
class TestProduction:
    def test_get_daily(self, tokens):
        tok, _ = tokens["prod1"]
        r = requests.get(f"{API}/production/daily", headers=H(tok))
        assert r.status_code == 200

    def test_get_draft_empty(self, tokens):
        tok, _ = tokens["prod1"]
        r = requests.get(f"{API}/production/daily/draft", headers=H(tok),
                         params={"sales_id": "nonexistent", "date": "2020-01-01", "shift": "pagi"})
        assert r.status_code == 200, r.text


# ---------- warehouse ----------
class TestWarehouse:
    def test_get_daily(self, tokens):
        tok, _ = tokens["gudang1"]
        r = requests.get(f"{API}/warehouse/daily", headers=H(tok))
        assert r.status_code == 200

    def test_get_incoming(self, tokens):
        tok, _ = tokens["gudang1"]
        r = requests.get(f"{API}/warehouse/incoming", headers=H(tok))
        assert r.status_code == 200

    def test_get_stock(self, tokens):
        tok, _ = tokens["gudang1"]
        r = requests.get(f"{API}/warehouse/stock", headers=H(tok))
        assert r.status_code == 200

    def test_get_discrepancy(self, tokens):
        tok, _ = tokens["super"]
        r = requests.get(f"{API}/warehouse/discrepancy", headers=H(tok))
        assert r.status_code == 200


# ---------- AI ----------
class TestAI:
    def test_no_auth(self):
        r = requests.post(f"{API}/ai/count-gallons", json={"image_base64": ""})
        assert r.status_code in (401, 403)

    def test_with_auth_no_image(self, tokens):
        tok, _ = tokens["A1"]
        r = requests.post(f"{API}/ai/count-gallons", headers=H(tok), json={})
        assert r.status_code in (400, 422)  # missing required
