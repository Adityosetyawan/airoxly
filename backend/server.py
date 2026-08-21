from dotenv import load_dotenv
load_dotenv()

import os
import logging
import random
from datetime import datetime, timezone, timedelta
from typing import Optional

import bcrypt
import jwt
from bson import ObjectId
from fastapi import FastAPI, APIRouter, HTTPException, Request, Response, Depends, Query
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel
from starlette.middleware.cors import CORSMiddleware

mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url, tz_aware=True)
db = client[os.environ["DB_NAME"]]

JWT_ALGORITHM = "HS256"
ACCESS_TOKEN_MINUTES = 60 * 24
RANGE_WINDOWS = {"harian": 1, "mingguan": 7, "bulanan": 30}
MONTHS_ID = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"]

app = FastAPI(title="Air OXLY Admin API")
api_router = APIRouter(prefix="/api")
logger = logging.getLogger("airoxly")


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))


def create_access_token(user_id: str, email: str, role: str, name: str) -> str:
    payload = {
        "sub": user_id,
        "email": email,
        "role": role,
        "name": name,
        "exp": datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_MINUTES),
        "type": "access",
    }
    return jwt.encode(payload, os.environ["JWT_SECRET"], algorithm=JWT_ALGORITHM)


def user_public(u: dict) -> dict:
    return {"id": str(u["_id"]), "email": u["email"], "name": u["name"], "role": u["role"]}


async def get_current_user(request: Request) -> dict:
    token = None
    auth_header = request.headers.get("Authorization", "")
    if auth_header.startswith("Bearer "):
        token = auth_header[7:]
    if not token:
        token = request.cookies.get("access_token")
    if not token:
        raise HTTPException(status_code=401, detail="Tidak terautentikasi")
    try:
        payload = jwt.decode(token, os.environ["JWT_SECRET"], algorithms=[JWT_ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Sesi kedaluwarsa, silakan masuk kembali")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Token tidak valid")
    user = await db.users.find_one({"_id": ObjectId(payload["sub"])})
    if not user:
        raise HTTPException(status_code=401, detail="Pengguna tidak ditemukan")
    return user


class LoginRequest(BaseModel):
    username: str
    password: str


@api_router.post("/auth/login")
async def login(payload: LoginRequest, request: Request, response: Response):
    email = payload.username.strip().lower()
    now = datetime.now(timezone.utc)
    identifier = email
    attempt = await db.login_attempts.find_one({"identifier": identifier})
    if attempt and attempt.get("count", 0) >= 5:
        locked_until = attempt.get("locked_until")
        if locked_until and locked_until > now:
            raise HTTPException(status_code=429, detail="Terlalu banyak percobaan gagal. Coba lagi dalam 15 menit.")
    user = await db.users.find_one({"email": email})
    if not user or not verify_password(payload.password, user["password_hash"]):
        await db.login_attempts.update_one(
            {"identifier": identifier},
            {"$inc": {"count": 1}, "$set": {"locked_until": now + timedelta(minutes=15), "updated_at": now}},
            upsert=True,
        )
        raise HTTPException(status_code=401, detail="Email atau kata sandi salah")
    await db.login_attempts.delete_one({"identifier": identifier})
    token = create_access_token(str(user["_id"]), user["email"], user["role"], user["name"])
    response.set_cookie(
        key="access_token", value=token, httponly=True, secure=True,
        samesite="none", max_age=ACCESS_TOKEN_MINUTES * 60, path="/",
    )
    return {"access_token": token, "token_type": "bearer", "user": user_public(user)}


@api_router.get("/auth/me")
async def auth_me(user: dict = Depends(get_current_user)):
    return user_public(user)


@api_router.post("/auth/logout")
async def logout(response: Response):
    response.delete_cookie("access_token", path="/")
    return {"ok": True}


def pct_change(cur: float, prev: float) -> Optional[float]:
    if not prev:
        return None
    return round((cur - prev) / prev * 100, 1)


@api_router.get("/overview")
async def get_overview(range: str = Query("mingguan", alias="range"), user: dict = Depends(get_current_user)):
    if range not in RANGE_WINDOWS:
        raise HTTPException(status_code=400, detail="Range tidak valid")
    days = RANGE_WINDOWS[range]
    now = datetime.now(timezone.utc)
    cur_start = now - timedelta(days=days)
    prev_start = now - timedelta(days=days * 2)

    tx_filter = {"created_at": {"$gte": prev_start}}
    cust_filter = {"created_at": {"$gte": prev_start}}
    if user["role"] == "sales":
        uid = str(user["_id"])
        tx_filter["sales_id"] = uid
        cust_filter["created_by"] = uid

    tx_projection = {"total": 1, "hpp": 1, "created_at": 1, "sales_id": 1, "customer_name": 1, "sales_name": 1, "items.qty": 1}
    txns = await db.transactions.find(tx_filter, tx_projection, limit=5000).to_list(5000)
    customers = await db.customers.find(cust_filter, {"created_at": 1, "created_by": 1}, limit=5000).to_list(5000)
    expenses = [] if user["role"] == "sales" else await db.expenses.find({"created_at": {"$gte": prev_start}}, {"amount": 1, "created_at": 1}, limit=5000).to_list(5000)

    cur_tx = [t for t in txns if t["created_at"] >= cur_start]
    prev_tx = [t for t in txns if t["created_at"] < cur_start]
    cur_cust = [c for c in customers if c["created_at"] >= cur_start]
    prev_cust = [c for c in customers if c["created_at"] < cur_start]
    cur_exp = [e for e in expenses if e["created_at"] >= cur_start]
    prev_exp = [e for e in expenses if e["created_at"] < cur_start]

    cur_sales = sum(t["total"] for t in cur_tx)
    prev_sales = sum(t["total"] for t in prev_tx)
    cur_exp_total = sum(e["amount"] for e in cur_exp)
    prev_exp_total = sum(e["amount"] for e in prev_exp)
    cur_profit = sum(t["total"] - t.get("hpp", 0) for t in cur_tx)
    prev_profit = sum(t["total"] - t.get("hpp", 0) for t in prev_tx)

    metrics = [
        {"key": "penjualan", "label": "Penjualan", "format": "currency", "value": cur_sales, "delta_pct": pct_change(cur_sales, prev_sales)},
        {"key": "transaksi", "label": "Transaksi", "format": "number", "value": len(cur_tx), "delta_pct": pct_change(len(cur_tx), len(prev_tx))},
        {"key": "pelanggan_baru", "label": "Pelanggan Baru", "format": "number", "value": len(cur_cust), "delta_pct": pct_change(len(cur_cust), len(prev_cust))},
    ]
    if user["role"] != "sales":
        metrics += [
            {"key": "pengeluaran", "label": "Pengeluaran", "format": "currency", "value": cur_exp_total, "delta_pct": pct_change(cur_exp_total, prev_exp_total), "invert": True},
            {"key": "laba_kotor", "label": "Laba Kotor", "format": "currency", "value": cur_profit, "delta_pct": pct_change(cur_profit, prev_profit)},
        ]

    recent_filter = {} if user["role"] != "sales" else {"sales_id": str(user["_id"])}
    recent_docs = await db.transactions.find(recent_filter, {"customer_name": 1, "sales_name": 1, "items.qty": 1, "total": 1, "created_at": 1}).sort("created_at", -1).limit(6).to_list(6)
    recent = [
        {
            "id": str(t["_id"]),
            "customer_name": t.get("customer_name", "-"),
            "sales_name": t.get("sales_name", "-"),
            "items_count": sum(i["qty"] for i in t.get("items", [])),
            "total": t["total"],
            "created_at": t["created_at"].isoformat(),
        }
        for t in recent_docs
    ]

    return {
        "range": range,
        "period": {"start": cur_start.isoformat(), "end": now.isoformat()},
        "metrics": metrics,
        "recent_transactions": recent,
    }


@api_router.get("/reports/trend")
async def get_trend(range_key: str = Query("mingguan", alias="range"), user: dict = Depends(get_current_user)):
    now = datetime.now(timezone.utc)
    today = now.replace(hour=0, minute=0, second=0, microsecond=0)

    if range_key == "harian":
        buckets = [today - timedelta(days=13 - i) for i in range(14)]
        step = timedelta(days=1)
        label = lambda d: f"{d.day} {MONTHS_ID[d.month - 1]}"
    elif range_key == "mingguan":
        week_start = today - timedelta(days=today.weekday())
        buckets = [week_start - timedelta(days=7 * (11 - i)) for i in range(12)]
        step = timedelta(days=7)
        label = lambda d: f"{d.day} {MONTHS_ID[d.month - 1]}"
    elif range_key == "bulanan":
        first = today.replace(day=1)
        buckets = []
        for i in range(11, -1, -1):
            m = first.month - 1 - i
            y = first.year + m // 12
            buckets.append(first.replace(year=y, month=m % 12 + 1))
        step = None
        label = lambda d: f"{MONTHS_ID[d.month - 1]} {d.year}"
    else:
        raise HTTPException(status_code=400, detail="Range tidak valid")

    def bucket_end(d):
        if step:
            return d + step
        m = d.month % 12 + 1
        y = d.year + (1 if d.month == 12 else 0)
        return d.replace(year=y, month=m)

    tx_filter = {"created_at": {"$gte": buckets[0]}}
    if user["role"] == "sales":
        tx_filter["sales_id"] = str(user["_id"])
    txns = await db.transactions.find(tx_filter, {"total": 1, "created_at": 1, "sales_id": 1}, limit=5000).to_list(5000)
    show_expenses = user["role"] != "sales"
    expenses = await db.expenses.find({"created_at": {"$gte": buckets[0]}}, {"amount": 1, "created_at": 1}, limit=5000).to_list(5000) if show_expenses else []

    points = []
    for b in buckets:
        end = bucket_end(b)
        bucket_tx = [t for t in txns if b <= t["created_at"] < end]
        point = {
            "label": label(b),
            "penjualan": sum(t["total"] for t in bucket_tx),
            "transaksi": len(bucket_tx),
        }
        if show_expenses:
            point["pengeluaran"] = sum(e["amount"] for e in expenses if b <= e["created_at"] < end)
        points.append(point)

    return {"range": range_key, "show_expenses": show_expenses, "points": points}


async def seed_users():
    accounts = [
        (os.environ["SUPERADMIN_EMAIL"], os.environ["SUPERADMIN_PASSWORD"], "Adityo Setyawan", "superadmin"),
        (os.environ["ADMIN_EMAIL"], os.environ["ADMIN_PASSWORD"], "Admin OXLY", "admin"),
        (os.environ["SALES1_EMAIL"], os.environ["SALES1_PASSWORD"], "Budi Santoso", "sales"),
        (os.environ["SALES2_EMAIL"], os.environ["SALES2_PASSWORD"], "Sari Dewi", "sales"),
    ]
    for email, password, name, role in accounts:
        email = email.lower()
        existing = await db.users.find_one({"email": email})
        if existing is None:
            await db.users.insert_one({
                "email": email, "password_hash": hash_password(password),
                "name": name, "role": role, "created_at": datetime.now(timezone.utc),
            })
        else:
            updates = {"name": name, "role": role}
            if not verify_password(password, existing["password_hash"]):
                updates["password_hash"] = hash_password(password)
            await db.users.update_one({"_id": existing["_id"]}, {"$set": updates})


async def seed_business():
    if await db.app_meta.find_one({"key": "business_seed_v1"}):
        return
    sales_users = await db.users.find({"role": "sales"}).to_list(10)
    if not sales_users:
        return
    rng = random.Random(42)
    now = datetime.now(timezone.utc)
    today = now.replace(hour=0, minute=0, second=0, microsecond=0)

    products = [
        {"sku": "GLN-REFILL", "name": "OXLY Galon 19L Isi Ulang", "price": 22000, "cost": 9000},
        {"sku": "GLN-BARU", "name": "OXLY Galon 19L + Galon Baru", "price": 65000, "cost": 38000},
        {"sku": "BTL-600", "name": "OXLY Botol 600ml", "price": 5000, "cost": 2200},
        {"sku": "BTL-1500", "name": "OXLY Botol 1500ml", "price": 9000, "cost": 4000},
        {"sku": "CUP-KARTON", "name": "OXLY Cup 240ml (1 Karton)", "price": 38000, "cost": 21000},
        {"sku": "O2-REFILL", "name": "Tabung Oksigen 1m3 Isi Ulang", "price": 120000, "cost": 60000},
        {"sku": "O2-SET", "name": "Tabung Oksigen 1m3 + Tabung", "price": 850000, "cost": 520000},
        {"sku": "O2-REG", "name": "Regulator Oksigen", "price": 275000, "cost": 180000},
    ]
    await db.products.insert_many(products)

    first_names = ["Andi", "Budi", "Citra", "Dewi", "Eko", "Fitri", "Gunawan", "Hesti", "Irfan", "Joko",
                   "Kartika", "Lukman", "Maya", "Nugroho", "Putri", "Rina", "Samsul", "Tania", "Wahyu", "Yuli"]
    businesses = ["Warung Kopi", "Toko Kelontong", "Klinik", "Rumah Makan", "Kantor", "Bengkel", "Kos", "Apotek"]
    customers = []
    for i in range(46):
        created = today - timedelta(days=rng.randint(0, 400), hours=rng.randint(0, 12))
        if i % 3 == 0:
            name = f"{rng.choice(businesses)} {rng.choice(first_names)}"
        else:
            name = f"{rng.choice(first_names)} {rng.choice(['Saputra', 'Wijaya', 'Pratama', 'Lestari', 'Hidayat', 'Sari'])}"
        creator = rng.choice(sales_users)
        customers.append({
            "name": name,
            "phone": f"08{rng.randint(1000000000, 9999999999)}",
            "address": f"Jl. Merdeka No. {rng.randint(1, 200)}, Bandung",
            "created_by": str(creator["_id"]),
            "created_at": created,
        })
    await db.customers.insert_many(customers)

    txns = []
    for i in range(421):
        d = today - timedelta(days=420 - i)
        n = rng.randint(4, 11) if d.weekday() < 5 else rng.randint(2, 6)
        for _ in range(n):
            items = []
            for _ in range(rng.randint(1, 3)):
                p = rng.choices(products, weights=[30, 12, 22, 18, 10, 4, 2, 2])[0]
                qty = rng.randint(1, 10) if p["sku"].startswith("GLN") else rng.randint(1, 5)
                items.append({"product_id": p["sku"], "name": p["name"], "qty": qty, "price": p["price"], "cost": p["cost"]})
            cust = rng.choice(customers)
            seller = rng.choices(sales_users, weights=[60, 40])[0]
            total = sum(i["qty"] * i["price"] for i in items)
            hpp = sum(i["qty"] * i["cost"] for i in items)
            txns.append({
                "customer_id": str(cust["_id"]),
                "customer_name": cust["name"],
                "sales_id": str(seller["_id"]),
                "sales_name": seller["name"],
                "items": items,
                "total": total,
                "hpp": hpp,
                "status": "selesai",
                "created_at": d.replace(hour=rng.randint(7, 19), minute=rng.randint(0, 59)),
            })
    await db.transactions.insert_many(txns)

    expenses = []
    for i in range(421):
        d = today - timedelta(days=420 - i)
        if rng.random() < 0.65:
            expenses.append({"category": "Bahan Baku", "amount": rng.randint(150, 600) * 1000, "note": "Belanja galon & tutup", "created_at": d.replace(hour=9)})
        if rng.random() < 0.5:
            expenses.append({"category": "Transportasi", "amount": rng.randint(50, 150) * 1000, "note": "Bensin armada", "created_at": d.replace(hour=17)})
        if rng.random() < 0.1:
            expenses.append({"category": "Perawatan", "amount": rng.randint(200, 800) * 1000, "note": "Servis mesin/kendaraan", "created_at": d.replace(hour=14)})
        if d.day == 1:
            expenses.append({"category": "Gaji", "amount": 8400000, "note": "Gaji tim bulanan", "created_at": d.replace(hour=10)})
        if d.day == 5:
            expenses.append({"category": "Utilitas", "amount": 1250000, "note": "Listrik & air depot", "created_at": d.replace(hour=10)})
    await db.expenses.insert_many(expenses)

    await db.app_meta.insert_one({"key": "business_seed_v1", "seeded_at": now})
    logger.info("Seed data bisnis selesai: %d transaksi, %d pelanggan, %d pengeluaran", len(txns), len(customers), len(expenses))


@app.on_event("startup")
async def startup():
    await db.users.create_index("email", unique=True)
    await db.login_attempts.create_index("identifier")
    await db.transactions.create_index("created_at")
    await db.transactions.create_index("sales_id")
    await db.customers.create_index("created_at")
    await db.expenses.create_index("created_at")
    await seed_users()
    await seed_business()


app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=False,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
