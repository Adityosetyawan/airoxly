#!/usr/bin/env python3
"""
Air OXLY Backend API Test Suite
Tests all backend endpoints with proper authentication and role-based access control
"""

import requests
import json
from typing import Dict, Optional

# Base URL from frontend/.env
BASE_URL = "https://airoxly-dev.preview.emergentagent.com/api"

# Test credentials (seeded in db.py)
CREDENTIALS = {
    "superadmin": {"username": "superadmin", "password": "super123"},
    "admin": {"username": "adminA", "password": "admin123"},
    "sales_a1": {"username": "A1", "password": "sales123"},
    "sales_a2": {"username": "A2", "password": "sales123"},
    "gudang": {"username": "gudang", "password": "gudang123"},
    "produksi": {"username": "produksi", "password": "prod123"},
}

# Store tokens and user info
tokens: Dict[str, str] = {}
users: Dict[str, dict] = {}

# Test results
results = {
    "passed": [],
    "failed": [],
    "total": 0
}


def log_test(name: str, passed: bool, details: str = ""):
    """Log test result"""
    results["total"] += 1
    status = "✅ PASS" if passed else "❌ FAIL"
    msg = f"{status}: {name}"
    if details:
        msg += f" - {details}"
    print(msg)
    
    if passed:
        results["passed"].append(name)
    else:
        results["failed"].append(f"{name}: {details}")


def test_login(role: str, creds: dict) -> bool:
    """Test login endpoint"""
    try:
        resp = requests.post(f"{BASE_URL}/auth/login", json=creds, timeout=10)
        
        if resp.status_code == 200:
            data = resp.json()
            if "access_token" in data and "user" in data:
                tokens[role] = data["access_token"]
                users[role] = data["user"]
                # Verify password field is not in response
                if "password" in data["user"]:
                    log_test(f"Login {role} - no password in response", False, "Password field present in user object")
                    return False
                log_test(f"Login {role}", True, f"Token received for {data['user']['name']}")
                return True
            else:
                log_test(f"Login {role}", False, "Missing access_token or user in response")
                return False
        else:
            log_test(f"Login {role}", False, f"Status {resp.status_code}: {resp.text}")
            return False
    except Exception as e:
        log_test(f"Login {role}", False, f"Exception: {str(e)}")
        return False


def test_login_invalid():
    """Test login with invalid credentials"""
    try:
        resp = requests.post(f"{BASE_URL}/auth/login", 
                           json={"username": "invalid", "password": "wrong"}, 
                           timeout=10)
        if resp.status_code == 401:
            log_test("Login with invalid credentials", True, "Correctly returned 401")
            return True
        else:
            log_test("Login with invalid credentials", False, f"Expected 401, got {resp.status_code}")
            return False
    except Exception as e:
        log_test("Login with invalid credentials", False, f"Exception: {str(e)}")
        return False


def test_auth_me(role: str) -> bool:
    """Test /auth/me endpoint"""
    if role not in tokens:
        log_test(f"Auth /me as {role}", False, "No token available")
        return False
    
    try:
        headers = {"Authorization": f"Bearer {tokens[role]}"}
        resp = requests.get(f"{BASE_URL}/auth/me", headers=headers, timeout=10)
        
        if resp.status_code == 200:
            data = resp.json()
            if "password" in data:
                log_test(f"Auth /me as {role}", False, "Password field present in response")
                return False
            log_test(f"Auth /me as {role}", True, f"User: {data.get('name')}")
            return True
        else:
            log_test(f"Auth /me as {role}", False, f"Status {resp.status_code}: {resp.text}")
            return False
    except Exception as e:
        log_test(f"Auth /me as {role}", False, f"Exception: {str(e)}")
        return False


def test_impersonate():
    """Test impersonate endpoint"""
    # Test as superadmin (should work)
    if "superadmin" not in tokens:
        log_test("Impersonate as superadmin", False, "No superadmin token")
        return False
    
    try:
        # Impersonate sales user u3 (A1)
        headers = {"Authorization": f"Bearer {tokens['superadmin']}"}
        resp = requests.get(f"{BASE_URL}/auth/impersonate/u3", headers=headers, timeout=10)
        
        if resp.status_code == 200:
            data = resp.json()
            if "access_token" in data and "user" in data:
                if data["user"]["id"] == "u3":
                    log_test("Impersonate as superadmin", True, f"Successfully impersonated {data['user']['name']}")
                else:
                    log_test("Impersonate as superadmin", False, "Wrong user returned")
                    return False
            else:
                log_test("Impersonate as superadmin", False, "Missing access_token or user")
                return False
        else:
            log_test("Impersonate as superadmin", False, f"Status {resp.status_code}: {resp.text}")
            return False
    except Exception as e:
        log_test("Impersonate as superadmin", False, f"Exception: {str(e)}")
        return False
    
    # Test as sales (should fail with 403)
    if "sales_a1" not in tokens:
        log_test("Impersonate as sales (should fail)", False, "No sales token")
        return False
    
    try:
        headers = {"Authorization": f"Bearer {tokens['sales_a1']}"}
        resp = requests.get(f"{BASE_URL}/auth/impersonate/u4", headers=headers, timeout=10)
        
        if resp.status_code == 403:
            log_test("Impersonate as sales (should fail)", True, "Correctly returned 403")
            return True
        else:
            log_test("Impersonate as sales (should fail)", False, f"Expected 403, got {resp.status_code}")
            return False
    except Exception as e:
        log_test("Impersonate as sales (should fail)", False, f"Exception: {str(e)}")
        return False


def test_products():
    """Test products endpoints"""
    # GET products (any authenticated user)
    if "sales_a1" not in tokens:
        log_test("GET /products", False, "No token available")
        return False
    
    try:
        headers = {"Authorization": f"Bearer {tokens['sales_a1']}"}
        resp = requests.get(f"{BASE_URL}/products", headers=headers, timeout=10)
        
        if resp.status_code == 200:
            products = resp.json()
            log_test("GET /products as sales", True, f"Retrieved {len(products)} products")
        else:
            log_test("GET /products as sales", False, f"Status {resp.status_code}")
            return False
    except Exception as e:
        log_test("GET /products as sales", False, f"Exception: {str(e)}")
        return False
    
    # POST product as superadmin (should work)
    if "superadmin" not in tokens:
        log_test("POST /products as superadmin", False, "No superadmin token")
        return False
    
    try:
        headers = {"Authorization": f"Bearer {tokens['superadmin']}"}
        new_product = {
            "name": "Test Product Galon 20L",
            "price": 7000,
            "stock": 50,
            "refill": True
        }
        resp = requests.post(f"{BASE_URL}/products", json=new_product, headers=headers, timeout=10)
        
        if resp.status_code == 200:
            data = resp.json()
            product_id = data.get("id")
            log_test("POST /products as superadmin", True, f"Created product {product_id}")
            
            # PUT product as superadmin
            update_data = {
                "name": "Test Product Galon 20L Updated",
                "price": 7500,
                "stock": 60,
                "refill": True
            }
            resp = requests.put(f"{BASE_URL}/products/{product_id}", json=update_data, headers=headers, timeout=10)
            if resp.status_code == 200:
                log_test("PUT /products as superadmin", True, "Product updated")
            else:
                log_test("PUT /products as superadmin", False, f"Status {resp.status_code}")
            
            # DELETE product as superadmin
            resp = requests.delete(f"{BASE_URL}/products/{product_id}", headers=headers, timeout=10)
            if resp.status_code == 200:
                log_test("DELETE /products as superadmin", True, "Product deleted")
            else:
                log_test("DELETE /products as superadmin", False, f"Status {resp.status_code}")
        else:
            log_test("POST /products as superadmin", False, f"Status {resp.status_code}: {resp.text}")
            return False
    except Exception as e:
        log_test("POST /products as superadmin", False, f"Exception: {str(e)}")
        return False
    
    # POST product as sales (should fail with 403)
    try:
        headers = {"Authorization": f"Bearer {tokens['sales_a1']}"}
        new_product = {"name": "Unauthorized Product", "price": 5000}
        resp = requests.post(f"{BASE_URL}/products", json=new_product, headers=headers, timeout=10)
        
        if resp.status_code == 403:
            log_test("POST /products as sales (should fail)", True, "Correctly returned 403")
        else:
            log_test("POST /products as sales (should fail)", False, f"Expected 403, got {resp.status_code}")
    except Exception as e:
        log_test("POST /products as sales (should fail)", False, f"Exception: {str(e)}")


def test_customers():
    """Test customers endpoints"""
    if "sales_a1" not in tokens:
        log_test("GET /customers", False, "No token available")
        return False
    
    try:
        # GET customers
        headers = {"Authorization": f"Bearer {tokens['sales_a1']}"}
        resp = requests.get(f"{BASE_URL}/customers", headers=headers, timeout=10)
        
        if resp.status_code == 200:
            customers = resp.json()
            log_test("GET /customers", True, f"Retrieved {len(customers)} customers")
        else:
            log_test("GET /customers", False, f"Status {resp.status_code}")
            return False
        
        # POST customer (should auto-generate barcode AOX-XXXX)
        new_customer = {
            "name": "Test Customer Warung Maju",
            "phone": "0812-9999-8888",
            "address": "Jl. Test No. 99",
            "area": "Area A"
        }
        resp = requests.post(f"{BASE_URL}/customers", json=new_customer, headers=headers, timeout=10)
        
        if resp.status_code == 200:
            data = resp.json()
            barcode = data.get("barcode", "")
            if barcode.startswith("AOX-") and len(barcode) == 8:
                log_test("POST /customers with barcode generation", True, f"Barcode: {barcode}")
            else:
                log_test("POST /customers with barcode generation", False, f"Invalid barcode format: {barcode}")
        else:
            log_test("POST /customers", False, f"Status {resp.status_code}: {resp.text}")
    except Exception as e:
        log_test("POST /customers", False, f"Exception: {str(e)}")


def test_transactions():
    """Test transactions endpoints"""
    if "sales_a1" not in tokens:
        log_test("Transactions test", False, "No sales_a1 token")
        return False
    
    try:
        headers = {"Authorization": f"Bearer {tokens['sales_a1']}"}
        
        # Create transaction with full payment (status should be 'lunas')
        tx_data = {
            "customerId": "c1",
            "items": [
                {"productId": "p1", "name": "Galon Polos 19L", "qty": 2, "price": 6000}
            ],
            "bayar": 12000,
            "galonPinjam": 1,
            "galonKembali": 0
        }
        resp = requests.post(f"{BASE_URL}/transactions", json=tx_data, headers=headers, timeout=10)
        
        if resp.status_code == 200:
            data = resp.json()
            if data.get("total") == 12000 and data.get("status") == "lunas" and data.get("kembali") == 0:
                log_test("POST /transactions (lunas)", True, f"Transaction {data.get('id')} created")
            else:
                log_test("POST /transactions (lunas)", False, 
                        f"Expected total=12000, status=lunas, kembali=0. Got total={data.get('total')}, status={data.get('status')}, kembali={data.get('kembali')}")
        else:
            log_test("POST /transactions (lunas)", False, f"Status {resp.status_code}: {resp.text}")
            return False
        
        # Create transaction with partial payment (status should be 'utang')
        tx_data_utang = {
            "customerId": "c2",
            "items": [
                {"productId": "p1", "name": "Galon Polos 19L", "qty": 5, "price": 6000}
            ],
            "bayar": 20000,
            "galonPinjam": 0,
            "galonKembali": 0
        }
        resp = requests.post(f"{BASE_URL}/transactions", json=tx_data_utang, headers=headers, timeout=10)
        
        if resp.status_code == 200:
            data = resp.json()
            if data.get("total") == 30000 and data.get("status") == "utang":
                log_test("POST /transactions (utang)", True, f"Transaction with debt created")
            else:
                log_test("POST /transactions (utang)", False, 
                        f"Expected total=30000, status=utang. Got total={data.get('total')}, status={data.get('status')}")
        else:
            log_test("POST /transactions (utang)", False, f"Status {resp.status_code}: {resp.text}")
        
        # GET transactions as sales (should only see own transactions)
        resp = requests.get(f"{BASE_URL}/transactions", headers=headers, timeout=10)
        
        if resp.status_code == 200:
            txs = resp.json()
            # Check if all transactions belong to sales_a1 (u3)
            all_own = all(tx.get("salesId") == "u3" for tx in txs)
            if all_own:
                log_test("GET /transactions as sales (filtered)", True, f"Retrieved {len(txs)} own transactions")
            else:
                log_test("GET /transactions as sales (filtered)", False, "Contains transactions from other sales")
        else:
            log_test("GET /transactions as sales", False, f"Status {resp.status_code}")
        
        # GET transactions as superadmin (should see all)
        if "superadmin" in tokens:
            headers_admin = {"Authorization": f"Bearer {tokens['superadmin']}"}
            resp = requests.get(f"{BASE_URL}/transactions", headers=headers_admin, timeout=10)
            
            if resp.status_code == 200:
                txs = resp.json()
                # Should have transactions from multiple sales
                sales_ids = set(tx.get("salesId") for tx in txs)
                if len(sales_ids) > 1:
                    log_test("GET /transactions as superadmin (all)", True, f"Retrieved {len(txs)} transactions from {len(sales_ids)} sales")
                else:
                    log_test("GET /transactions as superadmin (all)", True, f"Retrieved {len(txs)} transactions")
            else:
                log_test("GET /transactions as superadmin", False, f"Status {resp.status_code}")
    except Exception as e:
        log_test("Transactions test", False, f"Exception: {str(e)}")


def test_expenses():
    """Test expenses endpoints"""
    if "sales_a1" not in tokens:
        log_test("Expenses test", False, "No token available")
        return False
    
    try:
        headers = {"Authorization": f"Bearer {tokens['sales_a1']}"}
        
        # GET expenses
        resp = requests.get(f"{BASE_URL}/expenses", headers=headers, timeout=10)
        
        if resp.status_code == 200:
            expenses = resp.json()
            log_test("GET /expenses", True, f"Retrieved {len(expenses)} expenses")
        else:
            log_test("GET /expenses", False, f"Status {resp.status_code}")
            return False
        
        # POST expense (should record with 'by' = current user name)
        expense_data = {
            "title": "Test Expense - Bensin",
            "amount": 75000,
            "category": "Transport"
        }
        resp = requests.post(f"{BASE_URL}/expenses", json=expense_data, headers=headers, timeout=10)
        
        if resp.status_code == 200:
            data = resp.json()
            expected_name = users["sales_a1"]["name"]
            if data.get("by") == expected_name:
                log_test("POST /expenses with 'by' field", True, f"Expense recorded by {data.get('by')}")
            else:
                log_test("POST /expenses with 'by' field", False, f"Expected by={expected_name}, got {data.get('by')}")
        else:
            log_test("POST /expenses", False, f"Status {resp.status_code}: {resp.text}")
    except Exception as e:
        log_test("Expenses test", False, f"Exception: {str(e)}")


def test_overview():
    """Test overview endpoint"""
    if "sales_a1" not in tokens:
        log_test("GET /overview", False, "No token available")
        return False
    
    try:
        headers = {"Authorization": f"Bearer {tokens['sales_a1']}"}
        resp = requests.get(f"{BASE_URL}/overview", headers=headers, timeout=10)
        
        if resp.status_code == 200:
            data = resp.json()
            required_fields = ["todaySales", "monthSales", "totalCustomers", "totalProducts", 
                             "activeSales", "weeklyTrend", "topProducts"]
            missing = [f for f in required_fields if f not in data]
            
            if not missing:
                # Verify weeklyTrend has 7 items
                if len(data.get("weeklyTrend", [])) == 7:
                    log_test("GET /overview", True, f"All fields present, weeklyTrend has 7 days")
                else:
                    log_test("GET /overview", False, f"weeklyTrend should have 7 items, got {len(data.get('weeklyTrend', []))}")
            else:
                log_test("GET /overview", False, f"Missing fields: {missing}")
        else:
            log_test("GET /overview", False, f"Status {resp.status_code}: {resp.text}")
    except Exception as e:
        log_test("GET /overview", False, f"Exception: {str(e)}")


def test_warehouse():
    """Test warehouse/spareparts endpoints"""
    if "gudang" not in tokens:
        log_test("Warehouse test", False, "No gudang token")
        return False
    
    try:
        headers = {"Authorization": f"Bearer {tokens['gudang']}"}
        
        # GET spareparts
        resp = requests.get(f"{BASE_URL}/spareparts", headers=headers, timeout=10)
        
        if resp.status_code == 200:
            parts = resp.json()
            log_test("GET /spareparts", True, f"Retrieved {len(parts)} spareparts")
            
            # Find a part with sufficient stock for transfer
            part_s1 = next((p for p in parts if p["id"] == "s1"), None)
            if not part_s1:
                log_test("Warehouse transfer test", False, "Part s1 not found")
                return False
            
            initial_gudang = part_s1["gudang"]
            initial_produksi = part_s1["produksi"]
        else:
            log_test("GET /spareparts", False, f"Status {resp.status_code}")
            return False
        
        # POST transfer as gudang (should work)
        transfer_data = {
            "partId": "s1",
            "qty": 20,
            "note": "Test transfer from backend_test"
        }
        resp = requests.post(f"{BASE_URL}/warehouse/transfer", json=transfer_data, headers=headers, timeout=10)
        
        if resp.status_code == 200:
            data = resp.json()
            log_test("POST /warehouse/transfer as gudang", True, f"Transfer {data.get('id')} created")
            
            # Verify stock changes
            resp = requests.get(f"{BASE_URL}/spareparts", headers=headers, timeout=10)
            if resp.status_code == 200:
                parts = resp.json()
                part_s1_after = next((p for p in parts if p["id"] == "s1"), None)
                if part_s1_after:
                    expected_gudang = initial_gudang - 20
                    expected_produksi = initial_produksi + 20
                    if part_s1_after["gudang"] == expected_gudang and part_s1_after["produksi"] == expected_produksi:
                        log_test("Warehouse transfer stock update", True, 
                                f"Gudang: {initial_gudang} -> {part_s1_after['gudang']}, Produksi: {initial_produksi} -> {part_s1_after['produksi']}")
                    else:
                        log_test("Warehouse transfer stock update", False, 
                                f"Expected gudang={expected_gudang}, produksi={expected_produksi}. Got gudang={part_s1_after['gudang']}, produksi={part_s1_after['produksi']}")
        else:
            log_test("POST /warehouse/transfer as gudang", False, f"Status {resp.status_code}: {resp.text}")
        
        # POST transfer as sales (should fail with 403)
        if "sales_a1" in tokens:
            headers_sales = {"Authorization": f"Bearer {tokens['sales_a1']}"}
            resp = requests.post(f"{BASE_URL}/warehouse/transfer", json=transfer_data, headers=headers_sales, timeout=10)
            
            if resp.status_code == 403:
                log_test("POST /warehouse/transfer as sales (should fail)", True, "Correctly returned 403")
            else:
                log_test("POST /warehouse/transfer as sales (should fail)", False, f"Expected 403, got {resp.status_code}")
        
        # POST transfer with qty > available stock (should fail with 400)
        transfer_invalid = {
            "partId": "s1",
            "qty": 999999,
            "note": "Invalid transfer - too much qty"
        }
        resp = requests.post(f"{BASE_URL}/warehouse/transfer", json=transfer_invalid, headers=headers, timeout=10)
        
        if resp.status_code == 400:
            log_test("POST /warehouse/transfer with excessive qty (should fail)", True, "Correctly returned 400")
        else:
            log_test("POST /warehouse/transfer with excessive qty (should fail)", False, f"Expected 400, got {resp.status_code}")
        
        # GET transfers
        resp = requests.get(f"{BASE_URL}/warehouse/transfers", headers=headers, timeout=10)
        
        if resp.status_code == 200:
            transfers = resp.json()
            log_test("GET /warehouse/transfers", True, f"Retrieved {len(transfers)} transfers")
        else:
            log_test("GET /warehouse/transfers", False, f"Status {resp.status_code}")
    except Exception as e:
        log_test("Warehouse test", False, f"Exception: {str(e)}")


def test_lottery():
    """Test lottery endpoint"""
    if "sales_a1" not in tokens:
        log_test("GET /lottery", False, "No token available")
        return False
    
    try:
        headers = {"Authorization": f"Bearer {tokens['sales_a1']}"}
        resp = requests.get(f"{BASE_URL}/lottery", headers=headers, timeout=10)
        
        if resp.status_code == 200:
            data = resp.json()
            required_fields = ["title", "prize", "winners"]
            missing = [f for f in required_fields if f not in data]
            
            if not missing:
                log_test("GET /lottery", True, f"Lottery data retrieved with {len(data.get('winners', []))} winners")
            else:
                log_test("GET /lottery", False, f"Missing fields: {missing}")
        else:
            log_test("GET /lottery", False, f"Status {resp.status_code}: {resp.text}")
    except Exception as e:
        log_test("GET /lottery", False, f"Exception: {str(e)}")


def test_auth_required():
    """Test that endpoints require authentication"""
    try:
        # Try to access /products without token
        resp = requests.get(f"{BASE_URL}/products", timeout=10)
        
        if resp.status_code == 401:
            log_test("Auth required (no token)", True, "Correctly returned 401")
        else:
            log_test("Auth required (no token)", False, f"Expected 401, got {resp.status_code}")
    except Exception as e:
        log_test("Auth required test", False, f"Exception: {str(e)}")


def test_gps_locations():
    """Test GPS locations endpoints"""
    if "sales_a1" not in tokens:
        log_test("GPS locations test", False, "No sales_a1 token")
        return False
    
    try:
        headers = {"Authorization": f"Bearer {tokens['sales_a1']}"}
        
        # GET /api/locations (authenticated)
        resp = requests.get(f"{BASE_URL}/locations", headers=headers, timeout=10)
        
        if resp.status_code == 200:
            locations = resp.json()
            log_test("GET /api/locations", True, f"Retrieved {len(locations)} locations")
            
            # Verify seeded sales locations exist (Agus Sales, Dewi Sales)
            location_names = [loc.get("name") for loc in locations]
            if "Agus Sales" in location_names or "Dewi Sales" in location_names:
                log_test("GET /api/locations - seeded data", True, "Seeded sales locations found")
            else:
                log_test("GET /api/locations - seeded data", False, f"Expected seeded locations, got: {location_names}")
        else:
            log_test("GET /api/locations", False, f"Status {resp.status_code}: {resp.text}")
            return False
        
        # POST /api/locations/ping as sales A1
        ping_data = {"lat": -6.20, "lng": 106.85}
        resp = requests.post(f"{BASE_URL}/locations/ping", json=ping_data, headers=headers, timeout=10)
        
        if resp.status_code == 200:
            data = resp.json()
            if data.get("ok") == True:
                log_test("POST /api/locations/ping as sales", True, "Ping successful")
                
                # Verify location was updated
                resp = requests.get(f"{BASE_URL}/locations", headers=headers, timeout=10)
                if resp.status_code == 200:
                    locations = resp.json()
                    # Find A1's location (user id u3, name "Agus Sales")
                    a1_location = next((loc for loc in locations if loc.get("id") == "u3"), None)
                    
                    if a1_location:
                        if a1_location.get("lat") == -6.20 and a1_location.get("lng") == 106.85:
                            # Check lastPing is recent (within last minute)
                            from datetime import datetime, timedelta
                            try:
                                last_ping = datetime.fromisoformat(a1_location.get("lastPing", ""))
                                now = datetime.utcnow()
                                if (now - last_ping) < timedelta(minutes=1):
                                    log_test("POST /api/locations/ping - location updated", True, 
                                            f"A1 location updated to lat={a1_location['lat']}, lng={a1_location['lng']}, lastPing is recent")
                                else:
                                    log_test("POST /api/locations/ping - location updated", False, 
                                            f"lastPing not recent: {a1_location.get('lastPing')}")
                            except Exception as e:
                                log_test("POST /api/locations/ping - location updated", False, f"Error parsing lastPing: {str(e)}")
                        else:
                            log_test("POST /api/locations/ping - location updated", False, 
                                    f"Expected lat=-6.20, lng=106.85. Got lat={a1_location.get('lat')}, lng={a1_location.get('lng')}")
                    else:
                        log_test("POST /api/locations/ping - location updated", False, "A1 location (u3) not found after ping")
            else:
                log_test("POST /api/locations/ping as sales", False, f"Expected ok=true, got {data}")
        else:
            log_test("POST /api/locations/ping as sales", False, f"Status {resp.status_code}: {resp.text}")
        
        # POST /api/locations/ping without token (should return 401)
        resp = requests.post(f"{BASE_URL}/locations/ping", json=ping_data, timeout=10)
        
        if resp.status_code == 401:
            log_test("POST /api/locations/ping without token (should fail)", True, "Correctly returned 401")
        else:
            log_test("POST /api/locations/ping without token (should fail)", False, f"Expected 401, got {resp.status_code}")
    
    except Exception as e:
        log_test("GPS locations test", False, f"Exception: {str(e)}")


def test_export_reports():
    """Test export reports endpoints - RUN BEFORE RESET"""
    if "superadmin" not in tokens or "sales_a1" not in tokens:
        log_test("Export reports test", False, "Missing required tokens")
        return False
    
    try:
        headers_admin = {"Authorization": f"Bearer {tokens['superadmin']}"}
        headers_sales = {"Authorization": f"Bearer {tokens['sales_a1']}"}
        
        # GET /api/reports/export?fmt=csv&scope=all as superadmin
        resp = requests.get(f"{BASE_URL}/reports/export?fmt=csv&scope=all", headers=headers_admin, timeout=10)
        
        if resp.status_code == 200:
            # Check Content-Type
            content_type = resp.headers.get("Content-Type", "")
            if "text/csv" in content_type:
                log_test("GET /api/reports/export CSV - Content-Type", True, f"Content-Type: {content_type}")
            else:
                log_test("GET /api/reports/export CSV - Content-Type", False, f"Expected text/csv, got {content_type}")
            
            # Check Content-Disposition
            content_disp = resp.headers.get("Content-Disposition", "")
            if "attachment" in content_disp and "Laporan-AirOXLY" in content_disp and ".csv" in content_disp:
                log_test("GET /api/reports/export CSV - Content-Disposition", True, f"Content-Disposition: {content_disp}")
            else:
                log_test("GET /api/reports/export CSV - Content-Disposition", False, f"Invalid Content-Disposition: {content_disp}")
            
            # Check CSV content
            csv_content = resp.text
            if "Tanggal,Pelanggan,Sales,Produk,Total,Bayar,Status" in csv_content:
                # Check if there's at least one data row (not just header)
                lines = csv_content.strip().split("\n")
                if len(lines) >= 2:  # Header + at least one data row
                    log_test("GET /api/reports/export CSV - content", True, f"CSV has header and {len(lines)-1} data rows")
                else:
                    log_test("GET /api/reports/export CSV - content", False, f"CSV has only header, no data rows")
            else:
                log_test("GET /api/reports/export CSV - content", False, "CSV header row not found or incorrect")
        else:
            log_test("GET /api/reports/export CSV", False, f"Status {resp.status_code}: {resp.text}")
        
        # GET /api/reports/export?fmt=pdf&scope=all as superadmin
        resp = requests.get(f"{BASE_URL}/reports/export?fmt=pdf&scope=all", headers=headers_admin, timeout=10)
        
        if resp.status_code == 200:
            # Check Content-Type
            content_type = resp.headers.get("Content-Type", "")
            if "application/pdf" in content_type:
                log_test("GET /api/reports/export PDF - Content-Type", True, f"Content-Type: {content_type}")
            else:
                log_test("GET /api/reports/export PDF - Content-Type", False, f"Expected application/pdf, got {content_type}")
            
            # Check PDF magic bytes
            pdf_content = resp.content
            if pdf_content.startswith(b"%PDF"):
                log_test("GET /api/reports/export PDF - content", True, "PDF starts with %PDF magic bytes")
            else:
                log_test("GET /api/reports/export PDF - content", False, f"PDF does not start with %PDF, starts with: {pdf_content[:10]}")
        else:
            log_test("GET /api/reports/export PDF", False, f"Status {resp.status_code}: {resp.text}")
        
        # GET /api/reports/export?fmt=csv&scope=today as sales A1 (should work - sales can export own data)
        resp = requests.get(f"{BASE_URL}/reports/export?fmt=csv&scope=today", headers=headers_sales, timeout=10)
        
        if resp.status_code == 200:
            log_test("GET /api/reports/export as sales (scope=today)", True, "Sales can export own data")
        else:
            log_test("GET /api/reports/export as sales (scope=today)", False, f"Status {resp.status_code}: {resp.text}")
        
        # GET /api/reports/export without token (should return 401)
        resp = requests.get(f"{BASE_URL}/reports/export?fmt=csv&scope=all", timeout=10)
        
        if resp.status_code == 401:
            log_test("GET /api/reports/export without token (should fail)", True, "Correctly returned 401")
        else:
            log_test("GET /api/reports/export without token (should fail)", False, f"Expected 401, got {resp.status_code}")
    
    except Exception as e:
        log_test("Export reports test", False, f"Exception: {str(e)}")


def test_reset_data():
    """Test reset data endpoint - RUN LAST (deletes data)"""
    if "superadmin" not in tokens or "sales_a1" not in tokens:
        log_test("Reset data test", False, "Missing required tokens")
        return False
    
    try:
        headers_admin = {"Authorization": f"Bearer {tokens['superadmin']}"}
        headers_sales = {"Authorization": f"Bearer {tokens['sales_a1']}"}
        
        # POST /api/admin/reset with invalid type (should return ok:false)
        resp = requests.post(f"{BASE_URL}/admin/reset", json={"type": "invalid"}, headers=headers_admin, timeout=10)
        
        if resp.status_code == 200:
            data = resp.json()
            if data.get("ok") == False:
                log_test("POST /api/admin/reset with invalid type", True, f"Correctly returned ok=false: {data.get('detail')}")
            else:
                log_test("POST /api/admin/reset with invalid type", False, f"Expected ok=false, got {data}")
        else:
            log_test("POST /api/admin/reset with invalid type", False, f"Status {resp.status_code}: {resp.text}")
        
        # POST /api/admin/reset as sales (should return 403)
        resp = requests.post(f"{BASE_URL}/admin/reset", json={"type": "half"}, headers=headers_sales, timeout=10)
        
        if resp.status_code == 403:
            log_test("POST /api/admin/reset as sales (should fail)", True, "Correctly returned 403 - only superadmin allowed")
        else:
            log_test("POST /api/admin/reset as sales (should fail)", False, f"Expected 403, got {resp.status_code}")
        
        # POST /api/admin/reset with type="half" as superadmin
        resp = requests.post(f"{BASE_URL}/admin/reset", json={"type": "half"}, headers=headers_admin, timeout=10)
        
        if resp.status_code == 200:
            data = resp.json()
            if data.get("ok") == True and data.get("type") == "half":
                log_test("POST /api/admin/reset type=half", True, "Reset successful")
                
                # Verify transactional data is deleted
                resp_tx = requests.get(f"{BASE_URL}/transactions", headers=headers_admin, timeout=10)
                resp_exp = requests.get(f"{BASE_URL}/expenses", headers=headers_admin, timeout=10)
                resp_trans = requests.get(f"{BASE_URL}/warehouse/transfers", headers=headers_admin, timeout=10)
                resp_loc = requests.get(f"{BASE_URL}/locations", headers=headers_admin, timeout=10)
                
                tx_empty = resp_tx.status_code == 200 and len(resp_tx.json()) == 0
                exp_empty = resp_exp.status_code == 200 and len(resp_exp.json()) == 0
                trans_empty = resp_trans.status_code == 200 and len(resp_trans.json()) == 0
                loc_empty = resp_loc.status_code == 200 and len(resp_loc.json()) == 0
                
                if tx_empty and exp_empty and trans_empty and loc_empty:
                    log_test("POST /api/admin/reset - transactional data deleted", True, 
                            "Transactions, expenses, transfers, locations all empty")
                else:
                    log_test("POST /api/admin/reset - transactional data deleted", False, 
                            f"Expected empty collections. tx={len(resp_tx.json()) if resp_tx.status_code==200 else 'error'}, "
                            f"exp={len(resp_exp.json()) if resp_exp.status_code==200 else 'error'}, "
                            f"trans={len(resp_trans.json()) if resp_trans.status_code==200 else 'error'}, "
                            f"loc={len(resp_loc.json()) if resp_loc.status_code==200 else 'error'}")
                
                # Verify master data is preserved
                resp_prod = requests.get(f"{BASE_URL}/products", headers=headers_admin, timeout=10)
                resp_cust = requests.get(f"{BASE_URL}/customers", headers=headers_admin, timeout=10)
                
                prod_not_empty = resp_prod.status_code == 200 and len(resp_prod.json()) > 0
                cust_not_empty = resp_cust.status_code == 200 and len(resp_cust.json()) > 0
                
                if prod_not_empty and cust_not_empty:
                    log_test("POST /api/admin/reset - master data preserved", True, 
                            f"Products ({len(resp_prod.json())}) and customers ({len(resp_cust.json())}) preserved")
                else:
                    log_test("POST /api/admin/reset - master data preserved", False, 
                            f"Expected non-empty master data. products={len(resp_prod.json()) if resp_prod.status_code==200 else 'error'}, "
                            f"customers={len(resp_cust.json()) if resp_cust.status_code==200 else 'error'}")
            else:
                log_test("POST /api/admin/reset type=half", False, f"Expected ok=true, type=half. Got {data}")
        else:
            log_test("POST /api/admin/reset type=half", False, f"Status {resp.status_code}: {resp.text}")
    
    except Exception as e:
        log_test("Reset data test", False, f"Exception: {str(e)}")


def print_summary():
    """Print test summary"""
    print("\n" + "="*80)
    print("TEST SUMMARY")
    print("="*80)
    print(f"Total Tests: {results['total']}")
    print(f"Passed: {len(results['passed'])} ✅")
    print(f"Failed: {len(results['failed'])} ❌")
    
    if results['failed']:
        print("\n" + "="*80)
        print("FAILED TESTS:")
        print("="*80)
        for failure in results['failed']:
            print(f"  ❌ {failure}")
    
    print("\n" + "="*80)


def main():
    """Run all tests"""
    print("="*80)
    print("Air OXLY Backend API Test Suite")
    print(f"Base URL: {BASE_URL}")
    print("="*80 + "\n")
    
    # 1. Authentication tests
    print("--- AUTHENTICATION TESTS ---")
    test_login("superadmin", CREDENTIALS["superadmin"])
    test_login("admin", CREDENTIALS["admin"])
    test_login("sales_a1", CREDENTIALS["sales_a1"])
    test_login("sales_a2", CREDENTIALS["sales_a2"])
    test_login("gudang", CREDENTIALS["gudang"])
    test_login("produksi", CREDENTIALS["produksi"])
    test_login_invalid()
    
    # 2. Auth /me tests
    print("\n--- AUTH /ME TESTS ---")
    test_auth_me("superadmin")
    test_auth_me("sales_a1")
    
    # 3. Impersonate tests
    print("\n--- IMPERSONATE TESTS ---")
    test_impersonate()
    
    # 4. Products tests
    print("\n--- PRODUCTS TESTS ---")
    test_products()
    
    # 5. Customers tests
    print("\n--- CUSTOMERS TESTS ---")
    test_customers()
    
    # 6. Transactions tests
    print("\n--- TRANSACTIONS TESTS ---")
    test_transactions()
    
    # 7. Expenses tests
    print("\n--- EXPENSES TESTS ---")
    test_expenses()
    
    # 8. Overview tests
    print("\n--- OVERVIEW TESTS ---")
    test_overview()
    
    # 9. Warehouse tests
    print("\n--- WAREHOUSE TESTS ---")
    test_warehouse()
    
    # 10. Lottery tests
    print("\n--- LOTTERY TESTS ---")
    test_lottery()
    
    # 11. Auth required tests
    print("\n--- AUTH REQUIRED TESTS ---")
    test_auth_required()
    
    # 12. GPS Locations tests (NEW)
    print("\n--- GPS LOCATIONS TESTS (NEW) ---")
    test_gps_locations()
    
    # 13. Export Reports tests (NEW - run BEFORE reset)
    print("\n--- EXPORT REPORTS TESTS (NEW) ---")
    test_export_reports()
    
    # 14. Reset Data tests (NEW - run LAST since it deletes data)
    print("\n--- RESET DATA TESTS (NEW - RUN LAST) ---")
    test_reset_data()
    
    # Print summary
    print_summary()
    
    # Return exit code
    return 0 if len(results['failed']) == 0 else 1


if __name__ == "__main__":
    exit(main())
