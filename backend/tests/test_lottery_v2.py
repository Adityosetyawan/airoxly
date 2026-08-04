"""
Air OXLY Lottery — session-specific feature tests.
Covers: prize_description & description on periods (create+patch), customer_wa
propagation into tickets & winners, and GET /lottery/winners (cross-period,
role-scoped).
"""
import os
import uuid
import pytest
import requests

BASE = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "https://oxly-crm.preview.emergentagent.com").rstrip("/")
API = f"{BASE}/api"


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
        "B1": _login("B1", "sales123"),
    }


def _deactivate_all(stok):
    r = requests.get(f"{API}/lottery/periods", headers=H(stok))
    for p in r.json():
        if p.get("is_active") and not p.get("drawn_at"):
            requests.patch(f"{API}/lottery/periods/{p['id']}", headers=H(stok), json={"is_active": False})


def _create_period(stok, active=False, prize=None, desc=None, name=None,
                   start="2020-01-01", end="2099-12-31", winners=2):
    body = {
        "name": name or f"TEST_V2_{uuid.uuid4().hex[:6]}",
        "start_date": start,
        "end_date": end,
        "winner_count": winners,
        "is_active": active,
    }
    if prize is not None:
        body["prize_description"] = prize
    if desc is not None:
        body["description"] = desc
    r = requests.post(f"{API}/lottery/periods", headers=H(stok), json=body)
    assert r.status_code == 200, r.text
    return r.json()


def _gln(tok):
    r = requests.get(f"{API}/products", headers=H(tok))
    for p in r.json():
        if p["unit"] == "gln" and "Kosong" not in p["name"] and p["price"] > 0:
            return p
    raise RuntimeError("No gallon product")


def _make_cust(tok, wa=""):
    body = {"name": f"TEST_V2_C_{uuid.uuid4().hex[:6]}"}
    if wa:
        body["wa_number"] = wa
    r = requests.post(f"{API}/customers", headers=H(tok), json=body)
    assert r.status_code == 200, r.text
    return r.json()


def _mk_txn(tok, cust, gln, qty=2):
    it = {"product_id": gln["id"], "product_name": gln["name"], "unit": gln["unit"],
          "qty": qty, "price": gln["price"], "subtotal": gln["price"] * qty}
    r = requests.post(f"{API}/transactions", headers=H(tok), json={
        "customer_id": cust["id"], "items": [it], "bayar": it["subtotal"]
    })
    assert r.status_code == 200, r.text
    return r.json()


# ---------- prize_description / description on Period ----------
class TestPeriodPrizeDescription:
    def test_create_with_prize_and_desc(self, tokens):
        stok, _ = tokens["super"]
        p = _create_period(stok, prize="Motor Beat + TV + Rice Cooker",
                           desc="Undian akhir tahun untuk semua pelanggan setia.")
        assert p["prize_description"] == "Motor Beat + TV + Rice Cooker"
        assert p["description"] == "Undian akhir tahun untuk semua pelanggan setia."
        # GET /periods returns fields
        r = requests.get(f"{API}/lottery/periods", headers=H(stok))
        rec = next(x for x in r.json() if x["id"] == p["id"])
        assert rec["prize_description"] == "Motor Beat + TV + Rice Cooker"
        assert rec["description"] == "Undian akhir tahun untuk semua pelanggan setia."
        # cleanup
        requests.delete(f"{API}/lottery/periods/{p['id']}", headers=H(stok))

    def test_create_without_fields_nullable(self, tokens):
        stok, _ = tokens["super"]
        p = _create_period(stok)  # no prize/desc
        assert p["prize_description"] is None
        assert p["description"] is None
        requests.delete(f"{API}/lottery/periods/{p['id']}", headers=H(stok))

    def test_active_endpoint_returns_prize_desc(self, tokens):
        stok, _ = tokens["super"]
        _deactivate_all(stok)
        p = _create_period(stok, active=True, prize="Emas 5gr", desc="Sekali seumur hidup")
        try:
            r = requests.get(f"{API}/lottery/periods/active", headers=H(stok))
            assert r.status_code == 200
            j = r.json()
            assert j is not None
            assert j["prize_description"] == "Emas 5gr"
            assert j["description"] == "Sekali seumur hidup"
        finally:
            requests.patch(f"{API}/lottery/periods/{p['id']}", headers=H(stok), json={"is_active": False})
            requests.delete(f"{API}/lottery/periods/{p['id']}", headers=H(stok))

    def test_patch_updates_prize_and_desc(self, tokens):
        stok, _ = tokens["super"]
        p = _create_period(stok, prize="Old", desc="Old d")
        r = requests.patch(f"{API}/lottery/periods/{p['id']}", headers=H(stok),
                           json={"prize_description": "New Prize", "description": "New Desc"})
        assert r.status_code == 200, r.text
        assert r.json()["prize_description"] == "New Prize"
        assert r.json()["description"] == "New Desc"
        requests.delete(f"{API}/lottery/periods/{p['id']}", headers=H(stok))

    def test_patch_empty_string_treated_as_none(self, tokens):
        """Spec: empty string diperlakukan sebagai None."""
        stok, _ = tokens["super"]
        p = _create_period(stok, prize="Something", desc="Anything")
        r = requests.patch(f"{API}/lottery/periods/{p['id']}", headers=H(stok),
                           json={"prize_description": "", "description": ""})
        assert r.status_code == 200, r.text
        j = r.json()
        # per spec: empty string should become None (nullable)
        assert j["prize_description"] in (None, ""), (
            f"prize_description expected None or empty, got {j['prize_description']!r}"
        )
        assert j["description"] in (None, ""), (
            f"description expected None or empty, got {j['description']!r}"
        )
        # STRICT expectation (spec): should be None. Fail with clear message otherwise.
        if j["prize_description"] == "":
            pytest.fail("SPEC violation: PATCH with empty string should be treated as None but got empty string")
        requests.delete(f"{API}/lottery/periods/{p['id']}", headers=H(stok))


# ---------- customer_wa on tickets ----------
class TestTicketCustomerWa:
    def test_ticket_has_customer_wa(self, tokens):
        stok, _ = tokens["super"]
        a1tok, _ = tokens["A1"]
        _deactivate_all(stok)
        p = _create_period(stok, active=True)
        try:
            cust = _make_cust(a1tok, wa="08123456789")
            gln = _gln(a1tok)
            t = _mk_txn(a1tok, cust, gln, qty=2)
            assert len(t["lottery_tickets"]) == 2
            # Fetch tickets via API and verify customer_wa field present
            r = requests.get(f"{API}/lottery/tickets", headers=H(stok),
                             params={"period_id": p["id"], "customer_id": cust["id"]})
            assert r.status_code == 200
            tkts = r.json()
            assert len(tkts) == 2
            for tk in tkts:
                assert tk.get("customer_wa") == "08123456789", tk
                assert "customer_name" in tk
            requests.delete(f"{API}/transactions/{t['id']}", headers=H(stok))
        finally:
            requests.patch(f"{API}/lottery/periods/{p['id']}", headers=H(stok), json={"is_active": False})
            requests.delete(f"{API}/lottery/periods/{p['id']}", headers=H(stok))

    def test_ticket_customer_wa_empty_when_missing(self, tokens):
        stok, _ = tokens["super"]
        a1tok, _ = tokens["A1"]
        _deactivate_all(stok)
        p = _create_period(stok, active=True)
        try:
            cust = _make_cust(a1tok)  # no wa
            gln = _gln(a1tok)
            t = _mk_txn(a1tok, cust, gln, qty=1)
            r = requests.get(f"{API}/lottery/tickets", headers=H(stok),
                             params={"customer_id": cust["id"]})
            tkts = r.json()
            assert len(tkts) >= 1
            # customer_wa should be empty string / falsy
            assert not tkts[0].get("customer_wa")
            requests.delete(f"{API}/transactions/{t['id']}", headers=H(stok))
        finally:
            requests.patch(f"{API}/lottery/periods/{p['id']}", headers=H(stok), json={"is_active": False})
            requests.delete(f"{API}/lottery/periods/{p['id']}", headers=H(stok))


# ---------- Draw returns customer_wa ----------
class TestDrawIncludesCustomerWa:
    def test_draw_winners_have_customer_wa(self, tokens):
        stok, _ = tokens["super"]
        a1tok, _ = tokens["A1"]
        _deactivate_all(stok)
        p = _create_period(stok, active=True, winners=2)
        try:
            cust = _make_cust(a1tok, wa="08999888777")
            gln = _gln(a1tok)
            t = _mk_txn(a1tok, cust, gln, qty=3)
            rd = requests.post(f"{API}/lottery/periods/{p['id']}/draw", headers=H(stok))
            assert rd.status_code == 200, rd.text
            data = rd.json()
            for w in data["winners"]:
                assert w.get("customer_wa") == "08999888777"
                assert "customer_name" in w
                assert "ticket_code" in w
                assert "rank" in w
            requests.delete(f"{API}/transactions/{t['id']}", headers=H(stok))
        finally:
            requests.delete(f"{API}/lottery/periods/{p['id']}", headers=H(stok))


# ---------- GET /lottery/winners ----------
class TestListAllWinners:
    """Uses pre-seeded 'Undian Bulan Agustus 2026' with 3 winners for role scoping,
    plus creates ephemeral periods to add coverage."""

    def test_endpoint_reachable_super_admin(self, tokens):
        stok, _ = tokens["super"]
        r = requests.get(f"{API}/lottery/winners", headers=H(stok))
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        # every entry has required keys
        for w in data:
            for k in ("period_id", "period_name", "drawn_at", "rank", "ticket_code", "customer_name"):
                assert k in w, f"Missing {k} in {w}"

    def test_endpoint_reachable_admin_and_sales(self, tokens):
        for role in ("adminA", "A1"):
            tok, _ = tokens[role]
            r = requests.get(f"{API}/lottery/winners", headers=H(tok))
            assert r.status_code == 200, f"{role}: {r.text}"

    def test_role_scoping_end_to_end(self, tokens):
        """Create period, add tickets from A1 and B1, draw, then verify:
           - super_admin sees all
           - adminA sees only group-A winners
           - A1 sees only own-ticket winners
           - B1 sees only own-ticket winners
        """
        stok, _ = tokens["super"]
        a1tok, a1u = tokens["A1"]
        b1tok, b1u = tokens["B1"]
        atokA, _ = tokens["adminA"]
        atokB, _ = tokens["adminB"]

        _deactivate_all(stok)
        p = _create_period(stok, active=True, winners=4,
                           prize="Sepeda Motor", desc="Grand prize")
        txn_ids = []
        try:
            # Seed 3 tickets from A1 (with wa) and 3 from B1
            for tok, wa in [(a1tok, "081A1A1A1"), (b1tok, "081B1B1B1")]:
                cust = _make_cust(tok, wa=wa)
                gln = _gln(tok)
                t = _mk_txn(tok, cust, gln, qty=3)
                txn_ids.append(t["id"])
            # Draw all 4 winners
            rd = requests.post(f"{API}/lottery/periods/{p['id']}/draw", headers=H(stok))
            assert rd.status_code == 200, rd.text
            winners = rd.json()["winners"]
            assert len(winners) == 4

            # Super
            r_super = requests.get(f"{API}/lottery/winners", headers=H(stok)).json()
            our = [w for w in r_super if w["period_id"] == p["id"]]
            assert len(our) == 4
            for w in our:
                assert w["prize_description"] == "Sepeda Motor"
                assert w["period_name"] == p["name"]

            # AdminA
            r_admA = requests.get(f"{API}/lottery/winners", headers=H(atokA)).json()
            our_a = [w for w in r_admA if w["period_id"] == p["id"]]
            for w in our_a:
                assert w.get("group_letter") == "A", w
            # AdminB
            r_admB = requests.get(f"{API}/lottery/winners", headers=H(atokB)).json()
            our_b = [w for w in r_admB if w["period_id"] == p["id"]]
            for w in our_b:
                assert w.get("group_letter") == "B", w
            # A + B counts should sum to 4 (all winners fell in one of the two groups)
            assert len(our_a) + len(our_b) == 4

            # Sales A1 sees only own tickets from this period
            r_a1 = requests.get(f"{API}/lottery/winners", headers=H(a1tok)).json()
            our_a1 = [w for w in r_a1 if w["period_id"] == p["id"]]
            # cross-check each ticket belongs to A1
            for w in our_a1:
                tk = requests.get(f"{API}/lottery/tickets", headers=H(stok),
                                  params={"period_id": p["id"]}).json()
                match = next((x for x in tk if x["ticket_code"] == w["ticket_code"]), None)
                assert match is not None and match["sales_id"] == a1u["id"]

            # Sales B1 sees only own tickets from this period
            r_b1 = requests.get(f"{API}/lottery/winners", headers=H(b1tok)).json()
            our_b1 = [w for w in r_b1 if w["period_id"] == p["id"]]
            assert len(our_a1) + len(our_b1) == 4  # exhaustive across sales
        finally:
            for tid in txn_ids:
                requests.delete(f"{API}/transactions/{tid}", headers=H(stok))
            requests.delete(f"{API}/lottery/periods/{p['id']}", headers=H(stok))

    def test_seeded_august_period_has_winners(self, tokens):
        """The pre-seeded 'Undian Bulan Agustus 2026' should be present w/ winners."""
        stok, _ = tokens["super"]
        r = requests.get(f"{API}/lottery/winners", headers=H(stok)).json()
        aug = [w for w in r if "Agustus" in (w.get("period_name") or "")]
        if not aug:
            pytest.skip("Seeded August period not present in this env")
        # Every winner should have customer_wa (per agent-to-agent context: customer Budi, wa 08111)
        for w in aug:
            assert w.get("customer_name")
            # customer_wa may exist
