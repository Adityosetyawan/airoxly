# Auth Testing Playbook — Air OXLY Admin

Kredensial ada di /app/memory/test_credentials.md.

## Step 1: MongoDB Verification
```
mongosh
use test_database
db.users.find({}, {email:1, role:1}).pretty()
db.users.findOne({role: "superadmin"}, {password_hash: 1})
```
Verifikasi: hash bcrypt diawali `$2b$`, index unik pada users.email, index pada login_attempts.identifier.
Koleksi bisnis: transactions (~2800), customers (46), expenses, products (8).

## Step 2: API Testing
```
API_URL=$(grep REACT_APP_BACKEND_URL /app/frontend/.env | cut -d '=' -f2)
TOKEN=$(curl -s -X POST "$API_URL/api/auth/login" -H "Content-Type: application/json" -d '{"email":"adityo.setyawan@gmail.com","password":"OxlySuper2026!"}' | python3 -c "import sys,json;print(json.load(sys.stdin)['access_token'])")
curl -s "$API_URL/api/auth/me" -H "Authorization: Bearer $TOKEN"
curl -s "$API_URL/api/overview?range=mingguan" -H "Authorization: Bearer $TOKEN"
curl -s "$API_URL/api/reports/trend?range=bulanan" -H "Authorization: Bearer $TOKEN"
```

Login mengembalikan {access_token, user} + cookie access_token. /auth/me mengembalikan user yang sama via Bearer token.

## Step 3: RBAC checks
- Login sebagai sales (budi.santoso@airoxly.id): /api/overview tidak berisi metrik pengeluaran/laba_kotor; total penjualan < total superadmin.
- Tanpa token: /api/overview → 401.
- Password salah 5x berturut-turut → 429 (lockout 15 menit).
