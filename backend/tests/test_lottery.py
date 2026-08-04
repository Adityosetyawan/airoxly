"""
Air OXLY Lottery/Undian Berhadiah — end-to-end backend tests.
Covers: CRUD periode, RBAC, auto-generate tickets on transaction,
delete-cascade, draw random winners, tickets & stats filtering.
"""
import os
import re
import uuid
import pytest
import requests

BASE = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "https://oxly-crm.preview.emergentagent.com").rstrip("/")
API = f"{BASE}/api"

TICKET_RE = re.compile(r"^OXLY-[A-Z0-9]{6}$")


def _login(u, p):
    r = requests.post(f"{API}/auth/login", json={"username": u, "password": p}, timeout=30)
    assert r.status_code == 200, f"{u} login failed: {r.text}"
    return r.json()["access_token"], r.json()["user"]


def H(tok):
    return {"Authorization": f"Bearer {tok}", "Content-Type": "application/json"}


@pytest.fixture(scope="module")
def tokens():
    return {
        "super": _login("superadmin", "super123"),
        "adminA": _login("adminA", "admin123"),
        "adminB": _login("adminB", "admin123"),
        "A1": _login("A1", "sales123"),
        "A2": _login("A2", "sales123"),
        "B1": _login("B1", "sales123"),
    }


# ---------- Helpers ----------
def _deactivate_all(super_tok):
    r = requests.get(f"{API}/lottery/periods", headers=H(super_tok))
    for p in r.json():
        if p.get("is_active"):
            # patch to deactivate; if drawn, skip
            if not p.get("drawn_at"):
                requests.patch(f"{API}/lottery/periods/{p['id']}", headers=H(super_tok), json={"is_active": False})


def _create_period(super_tok, name=None, start="2026-01-01", end="2026-12-31", winners=3, active=True):
    body = {
        "name": name or f"TEST_Undian_{uuid.uuid4().hex[:6]}",
        "start_date": start,
        "end_date": end,
        "winner_count": winners,
        "is_active": active,
    }
    r = requests.post(f"{API}/lottery/periods", headers=H(super_tok), json=body)
    assert r.status_code == 200, r.text
    return r.json()


def _cleanup_period(super_tok, pid):
    # delete tickets first via mongo? No—use API contract: can only delete when 0 tickets.
    # Best-effort: skip if failure.
    r = requests.delete(f"{API}/lottery/periods/{pid}", headers=H(super_tok))
    return r.status_code


def _get_gallon_product(tok):
    r = requests.get(f"{API}/products", headers=H(tok))
    for p in r.json():
        if p["unit"] == "gln" and "Kosong" not in p["name"] and p["price"] > 0:
            return p
    raise RuntimeError("No gallon product found")


def _make_customer(tok, name_prefix="TEST_LTR"):
    r = requests.post(f"{API}/customers", headers=H(tok), json={"name": f"{name_prefix}_{uuid.uuid4().hex[:6]}"})
    assert r.status_code == 200, r.text
    return r.json()


# ---------- Tests ----------
class TestPeriodCRUD:
    def test_create_period_super(self, tokens):
        stok, _ = tokens["super"]
        p = _create_period(stok, active=False)
        assert p["name"].startswith("TEST_Undian_")
        assert p["winner_count"] == 3
        assert p["is_active"] is False
        assert p["drawn_at"] is None
        # cleanup
        assert _cleanup_period(stok, p["id"]) == 200

    def test_list_periods(self, tokens):
        stok, _ = tokens["super"]
        r = requests.get(f"{API}/lottery/periods", headers=H(stok))
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_create_period_forbidden_admin(self, tokens):
        atok, _ = tokens["adminA"]
        r = requests.post(f"{API}/lottery/periods", headers=H(atok), json={
            "name": "TEST_bad", "start_date": "2026-01-01", "end_date": "2026-12-31", "winner_count": 1
        })
        assert r.status_code == 403

    def test_create_period_forbidden_sales(self, tokens):
        stok, _ = tokens["A1"]
        r = requests.post(f"{API}/lottery/periods", headers=H(stok), json={
            "name": "TEST_bad", "start_date": "2026-01-01", "end_date": "2026-12-31", "winner_count": 1
        })
        assert r.status_code == 403

    def test_invalid_dates(self, tokens):
        stok, _ = tokens["super"]
        r = requests.post(f"{API}/lottery/periods", headers=H(stok), json={
            "name": "TEST_bad", "start_date": "2026-12-31", "end_date": "2026-01-01", "winner_count": 1
        })
        assert r.status_code == 400

    def test_invalid_winner_count(self, tokens):
        stok, _ = tokens["super"]
        r = requests.post(f"{API}/lottery/periods", headers=H(stok), json={
            "name": "TEST_bad", "start_date": "2026-01-01", "end_date": "2026-12-31", "winner_count": 0
        })
        assert r.status_code == 400

    def test_activate_deactivates_others(self, tokens):
        stok, _ = tokens["super"]
        p1 = _create_period(stok, active=True)
        p2 = _create_period(stok, active=False)
        # activate p2
        r = requests.post(f"{API}/lottery/periods/{p2['id']}/activate", headers=H(stok))
        assert r.status_code == 200
        # Check p1 no longer active
        r_active = requests.get(f"{API}/lottery/periods/active", headers=H(stok))
        assert r_active.status_code == 200
        active = r_active.json()
        assert active is not None
        assert active["id"] == p2["id"]
        # cleanup
        requests.patch(f"{API}/lottery/periods/{p1['id']}", headers=H(stok), json={"is_active": False})
        _cleanup_period(stok, p1["id"])
        _cleanup_period(stok, p2["id"])

    def test_patch_period(self, tokens):
        stok, _ = tokens["super"]
        p = _create_period(stok, active=False, winners=1)
        r = requests.patch(f"{API}/lottery/periods/{p['id']}", headers=H(stok), json={"winner_count": 5, "name": "TEST_Updated"})
        assert r.status_code == 200
        assert r.json()["winner_count"] == 5
        assert r.json()["name"] == "TEST_Updated"
        _cleanup_period(stok, p["id"])

    def test_patch_invalid_dates(self, tokens):
        stok, _ = tokens["super"]
        p = _create_period(stok, active=False)
        r = requests.patch(f"{API}/lottery/periods/{p['id']}", headers=H(stok), json={"start_date": "2027-01-01"})
        # end_date remains 2026-12-31 → start > end → 400
        assert r.status_code == 400
        _cleanup_period(stok, p["id"])

    def test_delete_period_ok_when_no_tickets(self, tokens):
        stok, _ = tokens["super"]
        p = _create_period(stok, active=False)
        r = requests.delete(f"{API}/lottery/periods/{p['id']}", headers=H(stok))
        assert r.status_code == 200

    def test_active_period_endpoint(self, tokens):
        stok, _ = tokens["super"]
        # Ensure at least one active period exists to test the shape
        p = _create_period(stok, active=True)
        r = requests.get(f"{API}/lottery/periods/active", headers=H(stok))
        assert r.status_code == 200
        j = r.json()
        assert j is not None
        assert j["is_active"] is True
        assert "ticket_count" in j
        # cleanup
        requests.patch(f"{API}/lottery/periods/{p['id']}", headers=H(stok), json={"is_active": False})
        _cleanup_period(stok, p["id"])


class TestTicketAutoGen:
    def _mk_txn(self, tok, cust, gln, qty):
        item = {"product_id": gln["id"], "product_name": gln["name"], "unit": gln["unit"],
                "qty": qty, "price": gln["price"], "subtotal": gln["price"] * qty}
        r = requests.post(f"{API}/transactions", headers=H(tok), json={
            "customer_id": cust["id"], "items": [item], "bayar": item["subtotal"]
        })
        return r

    def test_gallon_qty3_generates_3_tickets(self, tokens):
        stok, _ = tokens["super"]
        atok, _ = tokens["A1"]
        # Ensure a fresh active period for today's date
        p = _create_period(stok, active=True, start="2020-01-01", end="2099-12-31", winners=2)
        try:
            cust = _make_customer(atok)
            gln = _get_gallon_product(atok)
            r = self._mk_txn(atok, cust, gln, 3)
            assert r.status_code == 200, r.text
            t = r.json()
            assert "lottery_tickets" in t
            tickets = t["lottery_tickets"]
            assert len(tickets) == 3
            for code in tickets:
                assert TICKET_RE.match(code), f"Invalid format: {code}"
            assert len(set(tickets)) == 3  # unique within txn
            assert t.get("lottery_period_name") == p["name"]
            # cleanup: delete txn (also removes tickets)
            requests.delete(f"{API}/transactions/{t['id']}", headers=H(stok))
        finally:
            # deactivate & delete period
            requests.patch(f"{API}/lottery/periods/{p['id']}", headers=H(stok), json={"is_active": False})
            _cleanup_period(stok, p["id"])

    def test_empty_gallon_returns_no_tickets(self, tokens):
        stok, _ = tokens["super"]
        atok, _ = tokens["A1"]
        p = _create_period(stok, active=True, start="2020-01-01", end="2099-12-31")
        try:
            # find Galon Kosong product
            prods = requests.get(f"{API}/products", headers=H(atok)).json()
            empty = next((x for x in prods if "Kosong" in x["name"]), None)
            assert empty is not None, "No 'Galon Kosong' product"
            cust = _make_customer(atok)
            item = {"product_id": empty["id"], "product_name": empty["name"], "unit": empty["unit"],
                    "qty": 2, "price": empty["price"], "subtotal": empty["price"] * 2}
            r = requests.post(f"{API}/transactions", headers=H(atok), json={
                "customer_id": cust["id"], "items": [item], "bayar": item["subtotal"]
            })
            assert r.status_code == 200
            t = r.json()
            assert t.get("lottery_tickets", []) == []
            requests.delete(f"{API}/transactions/{t['id']}", headers=H(stok))
        finally:
            requests.patch(f"{API}/lottery/periods/{p['id']}", headers=H(stok), json={"is_active": False})
            _cleanup_period(stok, p["id"])

    def test_non_gallon_unit_no_tickets(self, tokens):
        stok, _ = tokens["super"]
        atok, _ = tokens["A1"]
        p = _create_period(stok, active=True, start="2020-01-01", end="2099-12-31")
        try:
            prods = requests.get(f"{API}/products", headers=H(atok)).json()
            box = next((x for x in prods if x["unit"] != "gln"), None)
            assert box is not None
            cust = _make_customer(atok)
            item = {"product_id": box["id"], "product_name": box["name"], "unit": box["unit"],
                    "qty": 2, "price": box["price"], "subtotal": box["price"] * 2}
            r = requests.post(f"{API}/transactions", headers=H(atok), json={
                "customer_id": cust["id"], "items": [item], "bayar": item["subtotal"]
            })
            assert r.status_code == 200
            t = r.json()
            assert t.get("lottery_tickets", []) == []
            requests.delete(f"{API}/transactions/{t['id']}", headers=H(stok))
        finally:
            requests.patch(f"{API}/lottery/periods/{p['id']}", headers=H(stok), json={"is_active": False})
            _cleanup_period(stok, p["id"])

    def test_no_active_period_no_tickets(self, tokens):
        stok, _ = tokens["super"]
        atok, _ = tokens["A1"]
        # deactivate all periods
        _deactivate_all(stok)
        cust = _make_customer(atok)
        gln = _get_gallon_product(atok)
        item = {"product_id": gln["id"], "product_name": gln["name"], "unit": gln["unit"],
                "qty": 2, "price": gln["price"], "subtotal": gln["price"] * 2}
        r = requests.post(f"{API}/transactions", headers=H(atok), json={
            "customer_id": cust["id"], "items": [item], "bayar": item["subtotal"]
        })
        assert r.status_code == 200, r.text
        t = r.json()
        assert t.get("lottery_tickets", []) == []
        requests.delete(f"{API}/transactions/{t['id']}", headers=H(stok))

    def test_delete_txn_removes_tickets(self, tokens):
        stok, _ = tokens["super"]
        atok, _ = tokens["A1"]
        p = _create_period(stok, active=True, start="2020-01-01", end="2099-12-31")
        try:
            cust = _make_customer(atok)
            gln = _get_gallon_product(atok)
            item = {"product_id": gln["id"], "product_name": gln["name"], "unit": gln["unit"],
                    "qty": 4, "price": gln["price"], "subtotal": gln["price"] * 4}
            r = requests.post(f"{API}/transactions", headers=H(atok), json={
                "customer_id": cust["id"], "items": [item], "bayar": item["subtotal"]
            })
            t = r.json()
            assert len(t["lottery_tickets"]) == 4
            # count tickets for period before
            before = requests.get(f"{API}/lottery/tickets", headers=H(stok), params={"period_id": p["id"]}).json()
            n_before = len(before)
            # Delete txn
            rd = requests.delete(f"{API}/transactions/{t['id']}", headers=H(stok))
            assert rd.status_code == 200
            after = requests.get(f"{API}/lottery/tickets", headers=H(stok), params={"period_id": p["id"]}).json()
            assert len(after) == n_before - 4
        finally:
            requests.patch(f"{API}/lottery/periods/{p['id']}", headers=H(stok), json={"is_active": False})
            _cleanup_period(stok, p["id"])


class TestRBACtickets:
    def test_sales_sees_only_own_tickets(self, tokens):
        stok, _ = tokens["super"]
        a1tok, a1u = tokens["A1"]
        b1tok, b1u = tokens["B1"]
        p = _create_period(stok, active=True, start="2020-01-01", end="2099-12-31")
        txn_ids = []
        try:
            for stok_i in (a1tok, b1tok):
                cust = _make_customer(stok_i)
                gln = _get_gallon_product(stok_i)
                item = {"product_id": gln["id"], "product_name": gln["name"], "unit": gln["unit"],
                        "qty": 2, "price": gln["price"], "subtotal": gln["price"] * 2}
                r = requests.post(f"{API}/transactions", headers=H(stok_i), json={
                    "customer_id": cust["id"], "items": [item], "bayar": item["subtotal"]
                })
                txn_ids.append(r.json()["id"])
            # A1 sees only own
            r_a = requests.get(f"{API}/lottery/tickets", headers=H(a1tok), params={"period_id": p["id"]}).json()
            for t in r_a:
                assert t["sales_id"] == a1u["id"]
            assert len(r_a) >= 2
            # AdminA sees only group A tickets
            atok_admin, _ = tokens["adminA"]
            r_admin = requests.get(f"{API}/lottery/tickets", headers=H(atok_admin), params={"period_id": p["id"]}).json()
            for t in r_admin:
                assert t["group_letter"] == "A"
            # Super sees all: at least 4 (2 from A1 + 2 from B1)
            r_super = requests.get(f"{API}/lottery/tickets", headers=H(stok), params={"period_id": p["id"]}).json()
            groups = {t["group_letter"] for t in r_super}
            assert "A" in groups and "B" in groups
        finally:
            for tid in txn_ids:
                requests.delete(f"{API}/transactions/{tid}", headers=H(stok))
            requests.patch(f"{API}/lottery/periods/{p['id']}", headers=H(stok), json={"is_active": False})
            _cleanup_period(stok, p["id"])

    def test_sales_cannot_draw_or_activate(self, tokens):
        stok, _ = tokens["super"]
        a1tok, _ = tokens["A1"]
        p = _create_period(stok, active=False)
        r1 = requests.post(f"{API}/lottery/periods/{p['id']}/activate", headers=H(a1tok))
        r2 = requests.post(f"{API}/lottery/periods/{p['id']}/draw", headers=H(a1tok))
        r3 = requests.delete(f"{API}/lottery/periods/{p['id']}", headers=H(a1tok))
        r4 = requests.patch(f"{API}/lottery/periods/{p['id']}", headers=H(a1tok), json={"name": "hax"})
        assert r1.status_code == 403 and r2.status_code == 403 and r3.status_code == 403 and r4.status_code == 403
        _cleanup_period(stok, p["id"])


class TestDraw:
    def test_draw_random_winners(self, tokens):
        stok, _ = tokens["super"]
        atok, _ = tokens["A1"]
        p = _create_period(stok, active=True, start="2020-01-01", end="2099-12-31", winners=2)
        txn_ids = []
        try:
            # Seed 5 tickets
            cust = _make_customer(atok)
            gln = _get_gallon_product(atok)
            item = {"product_id": gln["id"], "product_name": gln["name"], "unit": gln["unit"],
                    "qty": 5, "price": gln["price"], "subtotal": gln["price"] * 5}
            r = requests.post(f"{API}/transactions", headers=H(atok), json={
                "customer_id": cust["id"], "items": [item], "bayar": item["subtotal"]
            })
            txn_ids.append(r.json()["id"])
            # Draw
            rd = requests.post(f"{API}/lottery/periods/{p['id']}/draw", headers=H(stok))
            assert rd.status_code == 200, rd.text
            data = rd.json()
            assert data["period_id"] == p["id"]
            assert data["winner_count"] == 2
            assert data["total_tickets"] >= 5
            assert len(data["winners"]) == 2
            for i, w in enumerate(data["winners"]):
                assert w["rank"] == i + 1
                assert TICKET_RE.match(w["ticket_code"])
                assert w["customer_name"]
            # Period now inactive + drawn_at set
            r_get = requests.get(f"{API}/lottery/periods", headers=H(stok)).json()
            per = next(x for x in r_get if x["id"] == p["id"])
            assert per["drawn_at"] is not None
            assert per["is_active"] is False
            # Cannot draw again
            rd2 = requests.post(f"{API}/lottery/periods/{p['id']}/draw", headers=H(stok))
            assert rd2.status_code == 400
            # Cannot edit after drawn
            re_ = requests.patch(f"{API}/lottery/periods/{p['id']}", headers=H(stok), json={"name": "x"})
            assert re_.status_code == 400
        finally:
            for tid in txn_ids:
                requests.delete(f"{API}/transactions/{tid}", headers=H(stok))
            # cleanup best-effort: delete period after tickets gone
            _cleanup_period(stok, p["id"])

    def test_draw_no_tickets_400(self, tokens):
        stok, _ = tokens["super"]
        p = _create_period(stok, active=False)
        rd = requests.post(f"{API}/lottery/periods/{p['id']}/draw", headers=H(stok))
        assert rd.status_code == 400
        _cleanup_period(stok, p["id"])


class TestStats:
    def test_lottery_stats_shape(self, tokens):
        stok, _ = tokens["super"]
        atok, _ = tokens["A1"]
        p = _create_period(stok, active=True, start="2020-01-01", end="2099-12-31")
        txn_ids = []
        try:
            cust = _make_customer(atok)
            gln = _get_gallon_product(atok)
            item = {"product_id": gln["id"], "product_name": gln["name"], "unit": gln["unit"],
                    "qty": 3, "price": gln["price"], "subtotal": gln["price"] * 3}
            r = requests.post(f"{API}/transactions", headers=H(atok), json={
                "customer_id": cust["id"], "items": [item], "bayar": item["subtotal"]
            })
            txn_ids.append(r.json()["id"])
            r_stats = requests.get(f"{API}/lottery/stats", headers=H(stok))
            assert r_stats.status_code == 200
            d = r_stats.json()
            for k in ("period", "total_tickets", "top_customers", "per_sales"):
                assert k in d
            assert d["total_tickets"] >= 3
        finally:
            for tid in txn_ids:
                requests.delete(f"{API}/transactions/{tid}", headers=H(stok))
            requests.patch(f"{API}/lottery/periods/{p['id']}", headers=H(stok), json={"is_active": False})
            _cleanup_period(stok, p["id"])
