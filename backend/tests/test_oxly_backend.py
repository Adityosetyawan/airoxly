"""
Air OXLY Backend API tests.
Covers: auth, RBAC, products, users, customers, transactions (debt/loan math), reports, location, stats.
"""
import os
import uuid
import pytest
import requests

BASE = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "https://oxly-crm.preview.emergentagent.com").rstrip("/")
API = f"{BASE}/api"


# ----------- helpers ----------
def login(username, password):
    r = requests.post(f"{API}/auth/login", json={"username": username, "password": password}, timeout=30)
    assert r.status_code == 200, f"Login {username} failed: {r.status_code} {r.text}"
    data = r.json()
    return data["access_token"], data["user"]


def H(tok):
    return {"Authorization": f"Bearer {tok}", "Content-Type": "application/json"}


# ----------- fixtures ----------
@pytest.fixture(scope="module")
def tokens():
    return {
        "super": login("superadmin", "super123"),
        "adminA": login("adminA", "admin123"),
        "adminB": login("adminB", "admin123"),
        "A1": login("A1", "sales123"),
        "A2": login("A2", "sales123"),
        "B1": login("B1", "sales123"),
    }


# ===== AUTH =====
class TestAuth:
    def test_login_super(self):
        tok, u = login("superadmin", "super123")
        assert u["role"] == "super_admin"
        assert tok

    def test_login_adminA(self):
        tok, u = login("adminA", "admin123")
        assert u["role"] == "admin"
        assert u["group_letter"] == "A"

    def test_login_A1(self):
        tok, u = login("A1", "sales123")
        assert u["role"] == "sales"
        assert u["sales_code"] == "A1"
        assert u["group_letter"] == "A"

    def test_login_wrong_password(self):
        r = requests.post(f"{API}/auth/login", json={"username": "A1", "password": "wrong"})
        assert r.status_code == 401

    def test_me(self, tokens):
        tok, _ = tokens["A1"]
        r = requests.get(f"{API}/auth/me", headers=H(tok))
        assert r.status_code == 200
        assert r.json()["username"] == "A1"

    def test_me_no_token(self):
        r = requests.get(f"{API}/auth/me")
        assert r.status_code == 401


# ===== PRODUCTS =====
class TestProducts:
    def test_list_products_default_seven(self, tokens):
        tok, _ = tokens["A1"]
        r = requests.get(f"{API}/products", headers=H(tok))
        assert r.status_code == 200
        prods = r.json()
        assert len(prods) >= 7
        names = [p["name"] for p in prods]
        assert "Air Galon 19L" in names

    def test_create_product_super(self, tokens):
        tok, _ = tokens["super"]
        payload = {"name": f"TEST_Product_{uuid.uuid4().hex[:6]}", "unit": "gln", "price": 12345, "order": 99}
        r = requests.post(f"{API}/products", headers=H(tok), json=payload)
        assert r.status_code == 200
        prod = r.json()
        assert prod["price"] == 12345
        pid = prod["id"]
        # patch
        r2 = requests.patch(f"{API}/products/{pid}", headers=H(tok), json={"price": 15000})
        assert r2.status_code == 200
        assert r2.json()["price"] == 15000
        # delete
        r3 = requests.delete(f"{API}/products/{pid}", headers=H(tok))
        assert r3.status_code == 200

    def test_create_product_forbidden_admin(self, tokens):
        tok, _ = tokens["adminA"]
        r = requests.post(f"{API}/products", headers=H(tok), json={"name": "X", "unit": "gln", "price": 1})
        assert r.status_code == 403

    def test_create_product_forbidden_sales(self, tokens):
        tok, _ = tokens["A1"]
        r = requests.post(f"{API}/products", headers=H(tok), json={"name": "X", "unit": "gln", "price": 1})
        assert r.status_code == 403


# ===== USERS RBAC =====
class TestUsersRBAC:
    def test_super_can_list_all(self, tokens):
        tok, _ = tokens["super"]
        r = requests.get(f"{API}/users", headers=H(tok))
        assert r.status_code == 200
        roles = {u["role"] for u in r.json()}
        assert "super_admin" in roles and "admin" in roles and "sales" in roles

    def test_admin_sees_only_own_group_sales(self, tokens):
        tok, _ = tokens["adminA"]
        r = requests.get(f"{API}/users", headers=H(tok))
        assert r.status_code == 200
        for u in r.json():
            assert u["role"] == "sales"
            assert u["group_letter"] == "A"

    def test_sales_cannot_list(self, tokens):
        tok, _ = tokens["A1"]
        r = requests.get(f"{API}/users", headers=H(tok))
        assert r.status_code == 403

    def test_admin_create_sales_own_group(self, tokens):
        tok, _ = tokens["adminA"]
        uname = f"TEST_SalesA_{uuid.uuid4().hex[:6]}"
        r = requests.post(f"{API}/users", headers=H(tok), json={
            "username": uname, "password": "pw12345", "role": "sales", "name": "T"
        })
        assert r.status_code == 200
        assert r.json()["group_letter"] == "A"
        # cleanup via super
        stok, _ = tokens["super"]
        requests.delete(f"{API}/users/{r.json()['id']}", headers=H(stok))

    def test_admin_cannot_create_admin(self, tokens):
        tok, _ = tokens["adminA"]
        r = requests.post(f"{API}/users", headers=H(tok), json={
            "username": f"TEST_x_{uuid.uuid4().hex[:6]}", "password": "pw", "role": "admin"
        })
        assert r.status_code == 403


# ===== CUSTOMERS =====
class TestCustomers:
    def test_sales_creates_customer_auto_barcode(self, tokens):
        tok, _ = tokens["A1"]
        r = requests.post(f"{API}/customers", headers=H(tok), json={
            "name": f"TEST_Cust_{uuid.uuid4().hex[:6]}", "address": "Jl X", "wa_number": "628111"
        })
        assert r.status_code == 200
        c = r.json()
        assert c["group_letter"] == "A"
        assert c["barcode_id"].startswith("OXLY-")
        assert c["customer_no"] >= 100
        assert c["gallon_loans"] == 0
        assert c["total_debt"] == 0

    def test_sales_A_cannot_see_customer_B(self, tokens):
        # create customer via B1
        tokB, _ = tokens["B1"]
        rc = requests.post(f"{API}/customers", headers=H(tokB), json={"name": f"TEST_B_{uuid.uuid4().hex[:6]}"})
        assert rc.status_code == 200
        bcust = rc.json()
        # A1 lookup should 403
        tokA, _ = tokens["A1"]
        r = requests.get(f"{API}/customers/lookup/{bcust['barcode_id']}", headers=H(tokA))
        assert r.status_code == 403

    def test_customers_list_filtered_by_group_for_sales(self, tokens):
        tok, _ = tokens["A1"]
        r = requests.get(f"{API}/customers?sort=no", headers=H(tok))
        assert r.status_code == 200
        for c in r.json():
            assert c["group_letter"] == "A"

    def test_customers_sort_options(self, tokens):
        tok, _ = tokens["A1"]
        for s in ["no", "ranking", "last", "loans"]:
            r = requests.get(f"{API}/customers?sort={s}", headers=H(tok))
            assert r.status_code == 200, s

    def test_lookup_barcode(self, tokens):
        tok, _ = tokens["A1"]
        rc = requests.post(f"{API}/customers", headers=H(tok), json={"name": f"TEST_L_{uuid.uuid4().hex[:6]}"})
        c = rc.json()
        r = requests.get(f"{API}/customers/lookup/{c['barcode_id']}", headers=H(tok))
        assert r.status_code == 200
        assert r.json()["id"] == c["id"]


# ===== TRANSACTIONS - business logic =====
class TestTransactions:
    def _make_customer(self, tok):
        r = requests.post(f"{API}/customers", headers=H(tok), json={"name": f"TEST_TX_{uuid.uuid4().hex[:6]}"})
        assert r.status_code == 200
        return r.json()

    def _get_products(self, tok):
        r = requests.get(f"{API}/products", headers=H(tok))
        return r.json()

    def test_txn_bayar_lunas_debt_zero(self, tokens):
        tok, _ = tokens["A1"]
        cust = self._make_customer(tok)
        prods = self._get_products(tok)
        gln = next(p for p in prods if p["unit"] == "gln" and p["price"] > 0)
        item = {"product_id": gln["id"], "product_name": gln["name"], "unit": gln["unit"],
                "qty": 2, "price": gln["price"], "subtotal": gln["price"] * 2}
        total = item["subtotal"]
        r = requests.post(f"{API}/transactions", headers=H(tok), json={
            "customer_id": cust["id"], "items": [item], "bayar": total, "pinjam_galon": 3, "galon_kembali": 1
        })
        assert r.status_code == 200, r.text
        t = r.json()
        assert t["total"] == total
        assert t["hutang_transaksi"] == 0
        assert t["new_debt"] == 0
        assert t["new_loans"] == 2  # 0 + 3 - 1
        # customer state
        rc = requests.get(f"{API}/customers/{cust['id']}", headers=H(tok))
        c = rc.json()
        assert c["gallon_loans"] == 2
        assert c["total_debt"] == 0
        assert c["purchase_count"] == 1
        assert c["total_purchases"] == total
        assert c["last_purchase_date"] is not None

    def test_txn_bayar_kurang_menambah_hutang(self, tokens):
        tok, _ = tokens["A1"]
        cust = self._make_customer(tok)
        prods = self._get_products(tok)
        gln = next(p for p in prods if p["unit"] == "gln" and p["price"] > 0)
        item = {"product_id": gln["id"], "product_name": gln["name"], "unit": gln["unit"],
                "qty": 5, "price": gln["price"], "subtotal": gln["price"] * 5}
        total = item["subtotal"]
        bayar = total - 30000
        r = requests.post(f"{API}/transactions", headers=H(tok), json={
            "customer_id": cust["id"], "items": [item], "bayar": bayar
        })
        assert r.status_code == 200
        t = r.json()
        assert t["hutang_transaksi"] == 30000
        assert t["new_debt"] == 30000
        # 2nd txn with overpay reduces old debt
        item2 = dict(item, qty=1, subtotal=gln["price"])
        total2 = item2["subtotal"]
        bayar2 = total2 + 10000  # overpay by 10k
        r2 = requests.post(f"{API}/transactions", headers=H(tok), json={
            "customer_id": cust["id"], "items": [item2], "bayar": bayar2
        })
        assert r2.status_code == 200
        t2 = r2.json()
        assert t2["hutang_transaksi"] == 0
        assert t2["prev_debt"] == 30000
        assert t2["new_debt"] == 20000

    def test_sales_cannot_txn_for_other_group_customer(self, tokens):
        tokB, _ = tokens["B1"]
        bcust = self._make_customer(tokB)
        tokA, _ = tokens["A1"]
        prods = self._get_products(tokA)
        gln = next(p for p in prods if p["unit"] == "gln" and p["price"] > 0)
        item = {"product_id": gln["id"], "product_name": gln["name"], "unit": gln["unit"],
                "qty": 1, "price": gln["price"], "subtotal": gln["price"]}
        r = requests.post(f"{API}/transactions", headers=H(tokA), json={
            "customer_id": bcust["id"], "items": [item], "bayar": 0
        })
        assert r.status_code == 403

    def test_sales_edit_once_then_second_400(self, tokens):
        tok, _ = tokens["A1"]
        cust = self._make_customer(tok)
        prods = self._get_products(tok)
        gln = next(p for p in prods if p["unit"] == "gln" and p["price"] > 0)
        item = {"product_id": gln["id"], "product_name": gln["name"], "unit": gln["unit"],
                "qty": 1, "price": gln["price"], "subtotal": gln["price"]}
        r = requests.post(f"{API}/transactions", headers=H(tok), json={
            "customer_id": cust["id"], "items": [item], "bayar": gln["price"]
        })
        tid = r.json()["id"]
        r1 = requests.patch(f"{API}/transactions/{tid}", headers=H(tok), json={"bayar": gln["price"] - 5000})
        assert r1.status_code == 200
        assert r1.json()["edited"] is True
        r2 = requests.patch(f"{API}/transactions/{tid}", headers=H(tok), json={"bayar": 0})
        assert r2.status_code == 400

    def test_admin_cannot_edit_txn(self, tokens):
        stok, _ = tokens["A1"]
        cust = self._make_customer(stok)
        prods = self._get_products(stok)
        gln = next(p for p in prods if p["unit"] == "gln" and p["price"] > 0)
        item = {"product_id": gln["id"], "product_name": gln["name"], "unit": gln["unit"],
                "qty": 1, "price": gln["price"], "subtotal": gln["price"]}
        r = requests.post(f"{API}/transactions", headers=H(stok), json={
            "customer_id": cust["id"], "items": [item], "bayar": gln["price"]
        })
        tid = r.json()["id"]
        atok, _ = tokens["adminA"]
        r2 = requests.patch(f"{API}/transactions/{tid}", headers=H(atok), json={"bayar": 0})
        assert r2.status_code == 403

    def test_super_delete_txn_reverses_state(self, tokens):
        stok, _ = tokens["A1"]
        cust = self._make_customer(stok)
        prods = self._get_products(stok)
        gln = next(p for p in prods if p["unit"] == "gln" and p["price"] > 0)
        item = {"product_id": gln["id"], "product_name": gln["name"], "unit": gln["unit"],
                "qty": 2, "price": gln["price"], "subtotal": gln["price"] * 2}
        total = item["subtotal"]
        r = requests.post(f"{API}/transactions", headers=H(stok), json={
            "customer_id": cust["id"], "items": [item], "bayar": total - 10000, "pinjam_galon": 2
        })
        tid = r.json()["id"]
        # Before delete
        c_before = requests.get(f"{API}/customers/{cust['id']}", headers=H(stok)).json()
        assert c_before["total_debt"] == 10000
        assert c_before["gallon_loans"] == 2
        # delete via super
        sutok, _ = tokens["super"]
        rd = requests.delete(f"{API}/transactions/{tid}", headers=H(sutok))
        assert rd.status_code == 200
        c_after = requests.get(f"{API}/customers/{cust['id']}", headers=H(stok)).json()
        assert c_after["total_debt"] == 0
        assert c_after["gallon_loans"] == 0
        assert c_after["purchase_count"] == 0


# ===== REPORTS =====
class TestReports:
    def test_daily_report_super(self, tokens):
        tok, _ = tokens["super"]
        r = requests.get(f"{API}/reports/daily", headers=H(tok))
        assert r.status_code == 200
        data = r.json()
        assert "totals" in data and "groups" in data and "date" in data

    def test_daily_report_admin_scoped(self, tokens):
        tok, _ = tokens["adminA"]
        r = requests.get(f"{API}/reports/daily", headers=H(tok))
        assert r.status_code == 200
        # All groups should have code starting with A (based on sales_code)
        for g in r.json()["groups"]:
            assert g["sales_code"].startswith("A")


# ===== LOCATION =====
class TestLocation:
    def test_sales_ping(self, tokens):
        tok, _ = tokens["A1"]
        r = requests.post(f"{API}/location/ping", headers=H(tok), json={"lat": -6.2, "lng": 106.8})
        assert r.status_code == 200

    def test_admin_live(self, tokens):
        tok, _ = tokens["adminA"]
        r = requests.get(f"{API}/location/live", headers=H(tok))
        assert r.status_code == 200
        for s in r.json():
            assert s["group_letter"] == "A"

    def test_sales_cannot_live(self, tokens):
        tok, _ = tokens["A1"]
        r = requests.get(f"{API}/location/live", headers=H(tok))
        assert r.status_code == 403


# ===== STATS =====
class TestStats:
    def test_overview_sales(self, tokens):
        tok, _ = tokens["A1"]
        r = requests.get(f"{API}/stats/overview", headers=H(tok))
        assert r.status_code == 200
        d = r.json()
        for k in ["total_customers", "total_transactions", "today_count", "today_revenue", "today_total", "today_gln_sold"]:
            assert k in d

    def test_overview_super(self, tokens):
        tok, _ = tokens["super"]
        r = requests.get(f"{API}/stats/overview", headers=H(tok))
        assert r.status_code == 200
