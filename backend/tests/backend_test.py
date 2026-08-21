"""Backend API tests for Air OXLY Admin (replica)."""
import os
import time
import pytest
import requests

BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/") if os.environ.get("REACT_APP_BACKEND_URL") else None
if not BASE_URL:
    # Load from frontend/.env
    with open("/app/frontend/.env") as f:
        for line in f:
            if line.startswith("REACT_APP_BACKEND_URL="):
                BASE_URL = line.split("=", 1)[1].strip().rstrip("/")

SUPER = {"email": "adityo.setyawan@gmail.com", "password": "OxlySuper2026!"}
ADMIN = {"email": "admin@airoxly.id", "password": "OxlyAdmin2026!"}
SALES = {"email": "budi.santoso@airoxly.id", "password": "OxlySales2026!"}


@pytest.fixture(scope="module")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


def _login(session, creds):
    r = session.post(f"{BASE_URL}/api/auth/login", json=creds)
    return r


# --- Auth ---
def test_login_super_success(session):
    r = _login(session, SUPER)
    assert r.status_code == 200, r.text
    d = r.json()
    assert "access_token" in d
    assert d["user"]["role"] == "superadmin"
    assert d["user"]["email"] == SUPER["email"].lower()


def test_login_wrong_password(session):
    r = session.post(f"{BASE_URL}/api/auth/login",
                     json={"email": SUPER["email"], "password": "wrong-pwd"})
    assert r.status_code == 401
    assert "Email atau kata sandi salah" in r.json().get("detail", "")


def test_overview_no_token(session):
    r = requests.get(f"{BASE_URL}/api/overview?range=mingguan")
    assert r.status_code == 401


def test_auth_me(session):
    tok = _login(session, SUPER).json()["access_token"]
    r = requests.get(f"{BASE_URL}/api/auth/me",
                     headers={"Authorization": f"Bearer {tok}"})
    assert r.status_code == 200
    assert r.json()["role"] == "superadmin"


# --- Overview role-based ---
@pytest.fixture(scope="module")
def super_token(session):
    return _login(session, SUPER).json()["access_token"]


@pytest.fixture(scope="module")
def sales_token(session):
    return _login(session, SALES).json()["access_token"]


def _get(url, token):
    return requests.get(url, headers={"Authorization": f"Bearer {token}"})


@pytest.mark.parametrize("rng", ["harian", "mingguan", "bulanan"])
def test_overview_super_has_all_metrics(super_token, rng):
    r = _get(f"{BASE_URL}/api/overview?range={rng}", super_token)
    assert r.status_code == 200, r.text
    d = r.json()
    keys = {m["key"] for m in d["metrics"]}
    assert {"penjualan", "transaksi", "pelanggan_baru", "pengeluaran", "laba_kotor"} <= keys
    assert d["range"] == rng


def test_overview_sales_excludes_expenses(sales_token):
    r = _get(f"{BASE_URL}/api/overview?range=mingguan", sales_token)
    assert r.status_code == 200
    d = r.json()
    keys = {m["key"] for m in d["metrics"]}
    assert "pengeluaran" not in keys
    assert "laba_kotor" not in keys
    assert {"penjualan", "transaksi", "pelanggan_baru"} <= keys
    # recent_transactions should only contain this sales' transactions
    for t in d["recent_transactions"]:
        # sales_name should equal Budi Santoso for this user
        assert t["sales_name"] == "Budi Santoso"


def test_overview_sales_sales_less_than_super(super_token, sales_token):
    s = _get(f"{BASE_URL}/api/overview?range=bulanan", super_token).json()
    p = _get(f"{BASE_URL}/api/overview?range=bulanan", sales_token).json()
    sup_sales = next(m for m in s["metrics"] if m["key"] == "penjualan")["value"]
    sal_sales = next(m for m in p["metrics"] if m["key"] == "penjualan")["value"]
    assert sal_sales < sup_sales
    assert sal_sales >= 0


# --- Trend ---
@pytest.mark.parametrize("rng,expected", [("harian", 14), ("mingguan", 12), ("bulanan", 12)])
def test_trend_super(super_token, rng, expected):
    r = _get(f"{BASE_URL}/api/reports/trend?range={rng}", super_token)
    assert r.status_code == 200
    d = r.json()
    assert len(d["points"]) == expected
    assert d["show_expenses"] is True
    assert "pengeluaran" in d["points"][0]


def test_trend_sales_no_expenses(sales_token):
    r = _get(f"{BASE_URL}/api/reports/trend?range=harian", sales_token)
    assert r.status_code == 200
    d = r.json()
    assert d["show_expenses"] is False
    for p in d["points"]:
        assert "pengeluaran" not in p


def test_trend_invalid_range(super_token):
    r = _get(f"{BASE_URL}/api/reports/trend?range=tahunan", super_token)
    assert r.status_code == 400


# --- Logout ---
def test_logout(super_token):
    r = requests.post(f"{BASE_URL}/api/auth/logout",
                      headers={"Authorization": f"Bearer {super_token}"})
    assert r.status_code == 200


# --- Brute force (run last; uses admin@airoxly.id) ---
def test_brute_force_lockout():
    # Use unique bogus email to isolate from superadmin
    email = ADMIN["email"]
    last_status = None
    for i in range(6):
        r = requests.post(f"{BASE_URL}/api/auth/login",
                          json={"email": email, "password": f"wrong{i}"})
        last_status = r.status_code
        if r.status_code == 429:
            break
    assert last_status == 429, f"Expected 429 after 5+ attempts, got {last_status}"
