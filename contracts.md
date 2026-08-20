# Air OXLY - API Contracts & Integration Plan

## Auth (JWT)
- POST /api/auth/login  {username, password} -> {access_token, token_type, user}
- GET  /api/auth/me  (Bearer) -> user
- GET  /api/auth/impersonate/{user_id}  (superadmin) -> {access_token, user}

## Users  (superadmin, admin)
- GET  /api/users
- POST /api/users  {name, username, password?, role, area, target?}

## Products
- GET    /api/products
- POST   /api/products  {name, price, stock, refill}
- PUT    /api/products/{id}
- DELETE /api/products/{id}

## Customers
- GET  /api/customers
- POST /api/customers {name, phone, address, area}  (barcode auto AOX-XXXX)

## Transactions
- GET  /api/transactions  (sales -> own; admin/superadmin -> all)
- POST /api/transactions {customerId, items:[{productId,name,qty,price}], bayar, galonPinjam, galonKembali}
  -> computes total, status(lunas/utang), kembali; sales/salesId from token

## Expenses
- GET  /api/expenses
- POST /api/expenses {title, amount, category}

## Overview (dashboard)
- GET  /api/overview -> {todaySales, todayTransactions, monthSales, monthTransactions,
        totalCustomers, totalProducts, activeSales, weeklyTrend[], topProducts[]}

## Warehouse / Spareparts
- GET  /api/spareparts
- POST /api/warehouse/transfer {partId, qty, note}  (gudang/superadmin)
- GET  /api/warehouse/transfers

## Lottery
- GET  /api/lottery

## Seed (on startup if empty)
- Users: superadmin/super123, adminA/admin123, A1/sales123, A2/sales123, gudang/gudang123, produksi/prod123
- Products, Customers, Transactions, Expenses, Spareparts, Transfers, Lottery (from mock)

## Frontend integration
- Add src/api.js (axios instance w/ REACT_APP_BACKEND_URL + /api, Bearer token from localStorage)
- AuthContext.login -> POST /api/auth/login; store token; user from response
- Replace mock imports in pages with API calls (useEffect + state)
- Keep mockData.js only as fallback/removed where wired
- Passwords hashed via passlib pbkdf2_sha256; JWT via pyjwt

## Mocked/kept simple
- GPS live map points: static (visual mock) - Peta Live remains mock
- Settings Half/All Reset: real endpoints optional; keep as UI action (mock) for safety
- Guide/PDF: static content
