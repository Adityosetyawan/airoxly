"""
Backend tests for GET /api/customers with all 6 sort values + role scoping.

Session scope (Aug 2026): Added `recent` & `debt` sort options, and fixed
`last` sort so customers with null last_purchase_date go to the BOTTOM.
"""
import os
import pytest
import requests

BASE_URL = (
    os.environ.get("EXPO_BACKEND_URL")
    or os.environ.get("EXPO_PUBLIC_BACKEND_URL")
    or "https://oxly-crm.preview.emergentagent.com"
).rstrip("/")


def _login(username: str, password: str) -> str:
    r = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"username": username, "password": password},
        timeout=15,
    )
    assert r.status_code == 200, f"login {username} failed: {r.status_code} {r.text}"
    return r.json()["access_token"]


@pytest.fixture(scope="module")
def super_token() -> str:
    return _login("superadmin", "super123")


@pytest.fixture(scope="module")
def adminA_token() -> str:
    return _login("adminA", "admin123")


@pytest.fixture(scope="module")
def adminB_token() -> str:
    return _login("adminB", "admin123")


@pytest.fixture(scope="module")
def salesA1_token() -> str:
    return _login("A1", "sales123")


def _get_customers(token: str, sort: str = "no", sales_id: str | None = None):
    params = {"sort": sort}
    if sales_id:
        params["sales_id"] = sales_id
    r = requests.get(
        f"{BASE_URL}/api/customers",
        params=params,
        headers={"Authorization": f"Bearer {token}"},
        timeout=15,
    )
    return r


# ---------------------------------------------------------------
# 1) Basic status 200 for all 6 sort values as super_admin
# ---------------------------------------------------------------
@pytest.mark.parametrize("sort", ["no", "ranking", "recent", "last", "loans", "debt"])
def test_sort_values_return_200(super_token, sort):
    r = _get_customers(super_token, sort=sort)
    assert r.status_code == 200, f"sort={sort} => {r.status_code} {r.text}"
    body = r.json()
    assert isinstance(body, list)


# ---------------------------------------------------------------
# 2) Invalid sort => 422
# ---------------------------------------------------------------
def test_invalid_sort_returns_422(super_token):
    r = _get_customers(super_token, sort="badvalue")
    assert r.status_code == 422, f"expected 422, got {r.status_code} {r.text}"


# ---------------------------------------------------------------
# 3) sort=last — null last_purchase_date customers at END,
#    remaining sorted ASC (oldest first)
# ---------------------------------------------------------------
def test_sort_last_places_nulls_at_end_and_asc(super_token):
    r = _get_customers(super_token, sort="last")
    assert r.status_code == 200
    items = r.json()
    if len(items) < 2:
        pytest.skip("Need >=2 customers to validate ordering")

    with_date_idx = [i for i, c in enumerate(items) if c.get("last_purchase_date")]
    null_idx = [i for i, c in enumerate(items) if not c.get("last_purchase_date")]

    # If both groups exist, every with-date index must be < every null index
    if with_date_idx and null_idx:
        assert max(with_date_idx) < min(null_idx), (
            "Customers with null last_purchase_date must be at the END for sort=last"
        )

    # With-date customers should be ascending (oldest first)
    dates = [items[i]["last_purchase_date"] for i in with_date_idx]
    assert dates == sorted(dates), (
        f"sort=last should be ascending by date. Got: {dates}"
    )


# ---------------------------------------------------------------
# 4) sort=recent — customers with a purchase FIRST (desc by date), nulls LAST
# ---------------------------------------------------------------
def test_sort_recent_places_purchases_first_desc(super_token):
    r = _get_customers(super_token, sort="recent")
    assert r.status_code == 200
    items = r.json()
    if len(items) < 2:
        pytest.skip("Need >=2 customers to validate ordering")

    with_date_idx = [i for i, c in enumerate(items) if c.get("last_purchase_date")]
    null_idx = [i for i, c in enumerate(items) if not c.get("last_purchase_date")]

    if with_date_idx and null_idx:
        assert max(with_date_idx) < min(null_idx), (
            "sort=recent must place null-date customers LAST"
        )

    # With-date customers must be descending (most recent first)
    dates = [items[i]["last_purchase_date"] for i in with_date_idx]
    assert dates == sorted(dates, reverse=True), (
        f"sort=recent should be descending by date. Got: {dates}"
    )


# ---------------------------------------------------------------
# 5) sort=ranking — total_purchases descending
# ---------------------------------------------------------------
def test_sort_ranking_by_total_purchases_desc(super_token):
    r = _get_customers(super_token, sort="ranking")
    assert r.status_code == 200
    items = r.json()
    if len(items) < 2:
        pytest.skip("Need >=2 customers")

    tp = [c.get("total_purchases", 0) or 0 for c in items]
    assert tp == sorted(tp, reverse=True), (
        f"sort=ranking should be desc by total_purchases. Got: {tp}"
    )


# ---------------------------------------------------------------
# 6) sort=debt — total_debt descending
# ---------------------------------------------------------------
def test_sort_debt_by_total_debt_desc(super_token):
    r = _get_customers(super_token, sort="debt")
    assert r.status_code == 200
    items = r.json()
    if len(items) < 2:
        pytest.skip("Need >=2 customers")

    debts = [c.get("total_debt", 0) or 0 for c in items]
    assert debts == sorted(debts, reverse=True), (
        f"sort=debt should be desc by total_debt. Got: {debts}"
    )


# ---------------------------------------------------------------
# 7) sort=loans — gallon_loans descending
# ---------------------------------------------------------------
def test_sort_loans_by_gallon_loans_desc(super_token):
    r = _get_customers(super_token, sort="loans")
    assert r.status_code == 200
    items = r.json()
    if len(items) < 2:
        pytest.skip("Need >=2 customers")

    loans = [c.get("gallon_loans", 0) or 0 for c in items]
    assert loans == sorted(loans, reverse=True), (
        f"sort=loans should be desc by gallon_loans. Got: {loans}"
    )


# ---------------------------------------------------------------
# 8) sort=no — customer_no ascending
# ---------------------------------------------------------------
def test_sort_no_by_customer_no_asc(super_token):
    r = _get_customers(super_token, sort="no")
    assert r.status_code == 200
    items = r.json()
    if len(items) < 2:
        pytest.skip("Need >=2 customers")
    # As super_admin we may have multiple sales' customers; customer_no is per-sales
    # so it is not globally monotonic. Just assert Mongo ordering was ASC on the field.
    nos = [c.get("customer_no", 0) or 0 for c in items]
    assert nos == sorted(nos), f"sort=no should be non-decreasing by customer_no. Got: {nos}"


# ---------------------------------------------------------------
# 9) Role scoping — sales A1 sees only own customers
# ---------------------------------------------------------------
def test_sales_only_sees_own_customers(salesA1_token, super_token):
    r_sales = _get_customers(salesA1_token, sort="no")
    assert r_sales.status_code == 200
    sales_items = r_sales.json()

    # Get A1 user id via super_admin (via /api/auth/me on sales token)
    me = requests.get(
        f"{BASE_URL}/api/auth/me",
        headers={"Authorization": f"Bearer {salesA1_token}"},
        timeout=10,
    )
    assert me.status_code == 200, me.text
    a1_id = me.json()["id"]

    for c in sales_items:
        assert c.get("created_by") == a1_id, (
            f"Sales A1 must not see customer {c.get('id')} created_by={c.get('created_by')}"
        )


# ---------------------------------------------------------------
# 10) Role scoping — adminA sees only wilayah A (group_letter=A)
# ---------------------------------------------------------------
def test_adminA_sees_only_group_A(adminA_token):
    r = _get_customers(adminA_token, sort="no")
    assert r.status_code == 200
    items = r.json()
    for c in items:
        assert c.get("group_letter") == "A", (
            f"adminA leaked non-A customer: {c.get('id')} group={c.get('group_letter')}"
        )


# ---------------------------------------------------------------
# 11) Role scoping — adminB sees only wilayah B
# ---------------------------------------------------------------
def test_adminB_sees_only_group_B(adminB_token):
    r = _get_customers(adminB_token, sort="no")
    assert r.status_code == 200
    items = r.json()
    for c in items:
        assert c.get("group_letter") == "B", (
            f"adminB leaked non-B customer: {c.get('id')} group={c.get('group_letter')}"
        )


# ---------------------------------------------------------------
# 12) super_admin sales_id filter still narrows results
# ---------------------------------------------------------------
def test_super_admin_sales_id_filter(super_token, salesA1_token):
    me = requests.get(
        f"{BASE_URL}/api/auth/me",
        headers={"Authorization": f"Bearer {salesA1_token}"},
        timeout=10,
    ).json()
    a1_id = me["id"]

    all_r = _get_customers(super_token, sort="no")
    all_items = all_r.json()

    filt_r = _get_customers(super_token, sort="no", sales_id=a1_id)
    assert filt_r.status_code == 200
    filt_items = filt_r.json()

    for c in filt_items:
        assert c.get("created_by") == a1_id
    # Filtered set must be <= all
    assert len(filt_items) <= len(all_items)


# ---------------------------------------------------------------
# 13) super_admin sees more/equal than adminA (all sales, not just A)
# ---------------------------------------------------------------
def test_super_admin_scope_is_superset(super_token, adminA_token):
    r_all = _get_customers(super_token, sort="no")
    r_a = _get_customers(adminA_token, sort="no")
    assert r_all.status_code == 200 and r_a.status_code == 200
    assert len(r_all.json()) >= len(r_a.json())
