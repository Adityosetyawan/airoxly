from fastapi import FastAPI, APIRouter, HTTPException, Depends, status, Query
from fastapi.security import OAuth2PasswordBearer
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional, Literal, Any
import uuid
import random
import secrets
import string
from datetime import datetime, timezone, timedelta
import calendar
import jwt
from passlib.context import CryptContext
import httpx


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# JWT config
JWT_SECRET = os.environ.get("JWT_SECRET", "oxly-super-secret-change-in-prod-please")
JWT_ALG = "HS256"
JWT_EXPIRE_HOURS = 24 * 30  # 30 days for field usage

pwd_ctx = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login", auto_error=False)

app = FastAPI(title="Air OXLY API")
api = APIRouter(prefix="/api")


# ============================================================
# MODELS
# ============================================================
Role = Literal["super_admin", "admin", "sales"]


class LoginRequest(BaseModel):
    username: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: dict


class UserPublic(BaseModel):
    id: str
    username: str
    role: Role
    name: Optional[str] = None
    group_letter: Optional[str] = None  # Admin uses letter A-Z, Sales uses A1-Z100
    sales_code: Optional[str] = None
    wa_number: Optional[str] = None
    address: Optional[str] = None
    year_joined: Optional[int] = None
    salary: Optional[float] = None
    commission: Optional[float] = None
    bonus: Optional[float] = None
    disabled: bool = False
    google_email: Optional[str] = None
    picture: Optional[str] = None


class UserCreate(BaseModel):
    username: str
    password: str
    role: Role
    name: Optional[str] = None
    group_letter: Optional[str] = None
    sales_code: Optional[str] = None
    wa_number: Optional[str] = None
    address: Optional[str] = None
    year_joined: Optional[int] = None
    salary: Optional[float] = 0
    commission: Optional[float] = 0
    bonus: Optional[float] = 0
    google_email: Optional[str] = None


class UserUpdate(BaseModel):
    password: Optional[str] = None
    name: Optional[str] = None
    group_letter: Optional[str] = None
    sales_code: Optional[str] = None
    wa_number: Optional[str] = None
    address: Optional[str] = None
    year_joined: Optional[int] = None
    salary: Optional[float] = None
    commission: Optional[float] = None
    bonus: Optional[float] = None
    disabled: Optional[bool] = None
    google_email: Optional[str] = None
    role: Optional[Role] = None


class Product(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    unit: str  # "gln", "box"
    price: float
    order: int = 0


class ProductCreate(BaseModel):
    name: str
    unit: str
    price: float
    order: int = 0


class ProductUpdate(BaseModel):
    name: Optional[str] = None
    unit: Optional[str] = None
    price: Optional[float] = None
    order: Optional[int] = None


class CustomerCreate(BaseModel):
    name: str
    address: Optional[str] = ""
    wa_number: Optional[str] = ""
    barcode_id: Optional[str] = None  # if empty, auto-generated
    lat: Optional[float] = None
    lng: Optional[float] = None


class CustomerUpdate(BaseModel):
    name: Optional[str] = None
    address: Optional[str] = None
    wa_number: Optional[str] = None
    lat: Optional[float] = None
    lng: Optional[float] = None


class TransactionItem(BaseModel):
    product_id: str
    product_name: str
    unit: str
    qty: int
    price: float
    subtotal: float


class TransactionCreate(BaseModel):
    customer_id: str
    items: List[TransactionItem]
    bayar: float = 0
    pinjam_galon: int = 0
    galon_kembali: int = 0  # gallons returned by customer


class TransactionEdit(BaseModel):
    items: Optional[List[TransactionItem]] = None
    bayar: Optional[float] = None
    pinjam_galon: Optional[int] = None
    galon_kembali: Optional[int] = None


class LocationPing(BaseModel):
    lat: float
    lng: float


class LotteryPeriodCreate(BaseModel):
    name: str
    start_date: str  # YYYY-MM-DD
    end_date: str
    winner_count: int = 1
    is_active: bool = False
    prize_description: Optional[str] = None
    description: Optional[str] = None


class LotteryPeriodUpdate(BaseModel):
    name: Optional[str] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    winner_count: Optional[int] = None
    is_active: Optional[bool] = None
    prize_description: Optional[str] = None
    description: Optional[str] = None


class ExpenseCreate(BaseModel):
    category: str  # BBM, Makan, Parkir, Servis, Lain-lain
    description: Optional[str] = ""
    amount: float
    date: Optional[str] = None  # ISO date; defaults to today


class PartPriceUpdate(BaseModel):
    name: str
    rp_per_pcs: float
    order: Optional[int] = 0


class SettingUpdate(BaseModel):
    key: str
    value: Any


class MonthlyReportUpdate(BaseModel):
    # yellow — filled by admin
    gaji_sopir: Optional[float] = None
    gaji_kernet: Optional[float] = None
    bonus_per_galon_1: Optional[float] = None
    bonus_per_galon_2: Optional[float] = None
    komisi: Optional[float] = None
    bonus_target_mg1: Optional[float] = None
    bonus_target_mg2: Optional[float] = None
    bonus_target_mg3: Optional[float] = None
    bonus_target_mg4: Optional[float] = None
    bonus_target_mg5: Optional[float] = None
    # part qty consumed this month (yellow — admin)
    part_qtys: Optional[dict] = None  # { "Seal": 5, "Mur": 3, ... }


# ============================================================
# HELPERS
# ============================================================
def now_utc() -> datetime:
    return datetime.now(timezone.utc)


def hash_password(pwd: str) -> str:
    return pwd_ctx.hash(pwd)


def verify_password(pwd: str, hashed: str) -> bool:
    try:
        return pwd_ctx.verify(pwd, hashed)
    except Exception:
        return False


def create_token(user_id: str) -> str:
    payload = {
        "sub": user_id,
        "iat": now_utc(),
        "exp": now_utc() + timedelta(hours=JWT_EXPIRE_HOURS),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALG)


def user_public(u: dict) -> dict:
    return {
        "id": u["id"],
        "username": u["username"],
        "role": u["role"],
        "name": u.get("name"),
        "group_letter": u.get("group_letter"),
        "sales_code": u.get("sales_code"),
        "wa_number": u.get("wa_number"),
        "address": u.get("address"),
        "year_joined": u.get("year_joined"),
        "salary": u.get("salary"),
        "commission": u.get("commission"),
        "bonus": u.get("bonus"),
        "disabled": u.get("disabled", False),
        "google_email": u.get("google_email"),
        "picture": u.get("picture"),
    }


async def get_current_user(token: Optional[str] = Depends(oauth2_scheme)):
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    user_id: Optional[str] = None
    # 1) Try Emergent Google session_token (prefix "emg_")
    if token.startswith("emg_"):
        sess = await db.user_sessions.find_one({"session_token": token}, {"_id": 0})
        if not sess:
            raise HTTPException(status_code=401, detail="Invalid session")
        exp = sess.get("expires_at")
        if exp is not None:
            if exp.tzinfo is None:
                exp = exp.replace(tzinfo=timezone.utc)
            if exp < datetime.now(timezone.utc):
                raise HTTPException(status_code=401, detail="Session expired")
        user_id = sess.get("user_id")
    else:
        # 2) JWT flow (username/password)
        try:
            payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALG])
            user_id = payload.get("sub")
        except Exception:
            raise HTTPException(status_code=401, detail="Invalid token")
    user = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not user or user.get("disabled"):
        raise HTTPException(status_code=401, detail="User not found or disabled")
    return user


def require_roles(*roles: Role):
    async def dep(user=Depends(get_current_user)):
        if user["role"] not in roles:
            raise HTTPException(status_code=403, detail="Insufficient role")
        return user
    return dep


def strip_id(doc: dict) -> dict:
    if doc and "_id" in doc:
        doc = dict(doc)
        doc.pop("_id", None)
    return doc


# ============================================================
# STARTUP: SEED
# ============================================================
DEFAULT_PRODUCTS = [
    {"name": "Air Galon 19L", "unit": "gln", "price": 20000, "order": 1},
    {"name": "Cup 150ml", "unit": "box", "price": 18000, "order": 2},
    {"name": "Cup 240ml", "unit": "box", "price": 22000, "order": 3},
    {"name": "Botol 330ml", "unit": "box", "price": 35000, "order": 4},
    {"name": "Botol 600ml", "unit": "box", "price": 45000, "order": 5},
    {"name": "Botol 1500ml", "unit": "box", "price": 55000, "order": 6},
    {"name": "Galon Kosong", "unit": "gln", "price": 0, "order": 7},
]

DEFAULT_USERS = [
    {"username": "superadmin", "password": "super123", "role": "super_admin", "name": "Super Administrator"},
    {"username": "adminA", "password": "admin123", "role": "admin", "name": "Admin Wilayah A", "group_letter": "A"},
    {"username": "adminB", "password": "admin123", "role": "admin", "name": "Admin Wilayah B", "group_letter": "B"},
    {"username": "A1", "password": "sales123", "role": "sales", "name": "Sales A1", "group_letter": "A", "sales_code": "A1", "wa_number": "628123456781"},
    {"username": "A2", "password": "sales123", "role": "sales", "name": "Sales A2", "group_letter": "A", "sales_code": "A2", "wa_number": "628123456782"},
    {"username": "B1", "password": "sales123", "role": "sales", "name": "Sales B1", "group_letter": "B", "sales_code": "B1", "wa_number": "628123456783"},
]


@app.on_event("startup")
async def seed():
    await db.users.create_index("username", unique=True)
    await db.users.create_index("id", unique=True)
    await db.users.create_index("google_email", unique=True, sparse=True)
    await db.user_sessions.create_index("session_token", unique=True)
    await db.user_sessions.create_index("user_id")
    await db.user_sessions.create_index("expires_at", expireAfterSeconds=0)
    await db.customers.create_index("barcode_id", unique=True, sparse=True)
    await db.customers.create_index("customer_no")
    await db.customers.create_index("created_by")
    await db.transactions.create_index("date")
    await db.transactions.create_index("sales_id")
    await db.expenses.create_index("date_only")
    await db.expenses.create_index("sales_id")
    await db.monthly_reports.create_index([("sales_id", 1), ("year", 1), ("month", 1)], unique=True)
    await db.settings.create_index("key", unique=True)

    # Seed products if none
    if await db.products.count_documents({}) == 0:
        for p in DEFAULT_PRODUCTS:
            p2 = dict(p, id=str(uuid.uuid4()), created_at=now_utc().isoformat())
            await db.products.insert_one(p2)

    # Seed part prices (red — super admin permanent)
    DEFAULT_PARTS = [
        {"name": "Seal", "rp_per_pcs": 5000, "order": 1},
        {"name": "Mur", "rp_per_pcs": 3000, "order": 2},
        {"name": "Kran", "rp_per_pcs": 15000, "order": 3},
        {"name": "Galon Kran", "rp_per_pcs": 45000, "order": 4},
        {"name": "Galon Polos", "rp_per_pcs": 40000, "order": 5},
        {"name": "Stiker", "rp_per_pcs": 2000, "order": 6},
        {"name": "Stoper", "rp_per_pcs": 4000, "order": 7},
        {"name": "Karet Kran", "rp_per_pcs": 3000, "order": 8},
    ]
    if await db.part_prices.count_documents({}) == 0:
        for p in DEFAULT_PARTS:
            await db.part_prices.insert_one({**p, "id": str(uuid.uuid4()), "created_at": now_utc().isoformat()})

    # Seed default rp_kulakan (per galon)
    if not await db.settings.find_one({"key": "rp_kulakan_per_galon"}):
        await db.settings.insert_one({"key": "rp_kulakan_per_galon", "value": 13000})

    # Seed users if none
    for u in DEFAULT_USERS:
        existing = await db.users.find_one({"username": u["username"]})
        if existing:
            continue
        doc = {
            "id": str(uuid.uuid4()),
            "username": u["username"],
            "password_hash": hash_password(u["password"]),
            "role": u["role"],
            "name": u.get("name"),
            "group_letter": u.get("group_letter"),
            "sales_code": u.get("sales_code"),
            "wa_number": u.get("wa_number"),
            "address": u.get("address", ""),
            "year_joined": u.get("year_joined", datetime.now().year),
            "salary": u.get("salary", 0),
            "commission": u.get("commission", 0),
            "bonus": u.get("bonus", 0),
            "disabled": False,
            "created_at": now_utc().isoformat(),
        }
        await db.users.insert_one(doc)


@app.on_event("shutdown")
async def shutdown():
    client.close()


# ============================================================
# AUTH
# ============================================================
@api.post("/auth/login", response_model=TokenResponse)
async def login(body: LoginRequest):
    user = await db.users.find_one({"username": body.username.strip()}, {"_id": 0})
    if not user or user.get("disabled") or not verify_password(body.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Username atau password salah")
    token = create_token(user["id"])
    return TokenResponse(access_token=token, user=user_public(user))


@api.get("/auth/me")
async def me(user=Depends(get_current_user)):
    return user_public(user)


class SessionExchangeRequest(BaseModel):
    session_id: str


@api.post("/auth/session")
async def google_session_exchange(body: SessionExchangeRequest):
    """Exchange a one-time Emergent `session_id` for a 7-day `session_token`.

    - The `session_id` is a one-time value returned by Emergent to the frontend
      redirect. This endpoint calls Emergent's session-data API to resolve the
      Google user's email/name/picture.
    - The email MUST already exist as a whitelisted user (either via a Super
      Admin having set `google_email` on a user, OR via the username matching
      the email exactly). If no such user is found, we return 401.
    - On success, we mint a 7-day `session_token` prefixed with `emg_` and
      persist it in `user_sessions`.
    """
    session_id = (body.session_id or "").strip()
    if not session_id:
        raise HTTPException(status_code=400, detail="session_id required")

    # Resolve the session with Emergent (single external call)
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            r = await client.get(
                "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
                headers={"X-Session-ID": session_id},
            )
    except Exception as e:
        logging.exception("Emergent session resolve failed: %s", e)
        raise HTTPException(status_code=401, detail="Gagal verifikasi sesi Google")
    if r.status_code != 200:
        raise HTTPException(status_code=401, detail="Sesi Google tidak valid / kedaluwarsa")
    data = r.json() or {}
    email = (data.get("email") or "").strip().lower()
    if not email:
        raise HTTPException(status_code=401, detail="Email Google tidak tersedia")
    picture = data.get("picture")

    # Look up user by google_email OR username == email (allowing pre-registered
    # accounts that already use email as username).
    user = await db.users.find_one(
        {"$or": [{"google_email": email}, {"username": email}]},
        {"_id": 0},
    )
    if not user:
        raise HTTPException(
            status_code=401,
            detail=f"Akun Google {email} belum terdaftar. Hubungi Super Admin untuk registrasi.",
        )
    if user.get("disabled"):
        raise HTTPException(status_code=403, detail="Akun dinonaktifkan")

    # Mint a session_token distinct from JWT (prefix `emg_`)
    session_token = "emg_" + secrets.token_urlsafe(48)
    expires_at = datetime.now(timezone.utc) + timedelta(days=7)
    await db.user_sessions.insert_one(
        {
            "session_token": session_token,
            "user_id": user["id"],
            "email": email,
            "created_at": datetime.now(timezone.utc),
            "expires_at": expires_at,
        }
    )

    # Backfill google_email/picture on user record if we now know them
    updates: dict = {}
    if not user.get("google_email"):
        updates["google_email"] = email
    if picture and user.get("picture") != picture:
        updates["picture"] = picture
    if updates:
        await db.users.update_one({"id": user["id"]}, {"$set": updates})
        user.update(updates)

    return {"session_token": session_token, "user": user_public(user)}


@api.post("/auth/logout")
async def auth_logout(user=Depends(get_current_user), token: str = Depends(oauth2_scheme)):
    """Revoke the current Emergent session (JWT tokens are stateless — nothing
    to revoke server-side; frontend just clears its own copy)."""
    if token and token.startswith("emg_"):
        await db.user_sessions.delete_one({"session_token": token})
    return {"ok": True}


# ============================================================
# USERS  (Super Admin manages all; Admin only creates/manages Sales in own group)
# ============================================================
@api.get("/users")
async def list_users(
    role: Optional[Role] = None,
    group_letter: Optional[str] = None,
    user=Depends(get_current_user),
):
    q: dict = {}
    if user["role"] == "admin":
        # admin sees only sales in own group
        q["role"] = "sales"
        q["group_letter"] = user.get("group_letter")
    elif user["role"] == "sales":
        raise HTTPException(403, "Forbidden")
    else:
        if role:
            q["role"] = role
        if group_letter:
            q["group_letter"] = group_letter
    users = await db.users.find(q, {"_id": 0, "password_hash": 0}).to_list(1000)
    return [user_public({**u, "password_hash": ""}) for u in users]


@api.post("/users")
async def create_user(body: UserCreate, user=Depends(get_current_user)):
    if user["role"] == "sales":
        raise HTTPException(403, "Forbidden")
    if user["role"] == "admin":
        if body.role != "sales":
            raise HTTPException(403, "Admin hanya bisa buat user Sales")
        if body.group_letter and body.group_letter != user.get("group_letter"):
            raise HTTPException(403, "Admin hanya bisa buat sales pada wilayahnya")
        body.group_letter = user.get("group_letter")
    if await db.users.find_one({"username": body.username}):
        raise HTTPException(409, "Username sudah dipakai")
    google_email = (body.google_email or "").strip().lower() or None
    if google_email and await db.users.find_one({"google_email": google_email}):
        raise HTTPException(409, "Email Google sudah dipakai user lain")
    doc = {
        "id": str(uuid.uuid4()),
        "username": body.username.strip(),
        "password_hash": hash_password(body.password),
        "role": body.role,
        "name": body.name,
        "group_letter": body.group_letter,
        "sales_code": body.sales_code,
        "wa_number": body.wa_number,
        "address": body.address,
        "year_joined": body.year_joined or datetime.now().year,
        "salary": body.salary or 0,
        "commission": body.commission or 0,
        "bonus": body.bonus or 0,
        "disabled": False,
        "google_email": google_email,
        "created_at": now_utc().isoformat(),
    }
    await db.users.insert_one(doc)
    return user_public(doc)


@api.patch("/users/{user_id}")
async def update_user(user_id: str, body: UserUpdate, user=Depends(get_current_user)):
    target = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not target:
        raise HTTPException(404, "User tidak ditemukan")
    if user["role"] == "sales":
        raise HTTPException(403, "Forbidden")
    if user["role"] == "admin":
        if target["role"] != "sales" or target.get("group_letter") != user.get("group_letter"):
            raise HTTPException(403, "Forbidden")
        if body.role and body.role != "sales":
            raise HTTPException(403, "Admin tidak bisa mengubah role")
    update: dict = {}
    for k, v in body.dict(exclude_unset=True).items():
        if k == "password" and v:
            update["password_hash"] = hash_password(v)
        elif k == "google_email":
            # Normalize (empty string clears it, else lowercase) & guard uniqueness
            v_norm = (v or "").strip().lower() or None
            if v_norm and v_norm != target.get("google_email"):
                exists = await db.users.find_one({"google_email": v_norm, "id": {"$ne": user_id}})
                if exists:
                    raise HTTPException(409, "Email Google sudah dipakai user lain")
            update["google_email"] = v_norm
        elif k != "password" and v is not None:
            update[k] = v
    if update:
        await db.users.update_one({"id": user_id}, {"$set": update})
    updated = await db.users.find_one({"id": user_id}, {"_id": 0})
    return user_public(updated)


@api.delete("/users/{user_id}")
async def delete_user(user_id: str, user=Depends(require_roles("super_admin"))):
    if user["id"] == user_id:
        raise HTTPException(400, "Tidak bisa menghapus diri sendiri")
    await db.users.delete_one({"id": user_id})
    return {"ok": True}


# ============================================================
# PRODUCTS (Super Admin manages; others read)
# ============================================================
@api.get("/products")
async def list_products(user=Depends(get_current_user)):
    items = await db.products.find({}, {"_id": 0}).sort("order", 1).to_list(1000)
    return items


@api.post("/products")
async def create_product(body: ProductCreate, user=Depends(require_roles("super_admin"))):
    doc = {"id": str(uuid.uuid4()), **body.dict(), "created_at": now_utc().isoformat()}
    await db.products.insert_one(doc)
    return strip_id(doc)


@api.patch("/products/{product_id}")
async def update_product(product_id: str, body: ProductUpdate, user=Depends(require_roles("super_admin"))):
    update = {k: v for k, v in body.dict(exclude_unset=True).items() if v is not None}
    if update:
        await db.products.update_one({"id": product_id}, {"$set": update})
    p = await db.products.find_one({"id": product_id}, {"_id": 0})
    return p


@api.delete("/products/{product_id}")
async def delete_product(product_id: str, user=Depends(require_roles("super_admin"))):
    await db.products.delete_one({"id": product_id})
    return {"ok": True}


# ============================================================
# CUSTOMERS
# Scoped per-sales (owner). Admin sees all customers of sales in own group; super_admin sees all.
# ============================================================
async def next_customer_no_for(sales_id: str) -> int:
    last = await db.customers.find(
        {"created_by": sales_id},
        {"_id": 0, "customer_no": 1},
    ).sort("customer_no", -1).limit(1).to_list(1)
    if not last:
        return 1
    return int(last[0].get("customer_no", 0)) + 1


@api.get("/customers")
async def list_customers(
    sort: str = Query("no", pattern="^(no|ranking|last|recent|loans|debt)$"),
    q: Optional[str] = None,
    sales_id: Optional[str] = None,
    user=Depends(get_current_user),
):
    filt: dict = {}
    if user["role"] == "sales":
        # sales only sees own customers
        filt["created_by"] = user["id"]
    elif user["role"] == "admin":
        # admin sees all customers of sales in own group
        filt["group_letter"] = user.get("group_letter")
        if sales_id:
            filt["created_by"] = sales_id
    else:
        # super_admin optional filter by sales
        if sales_id:
            filt["created_by"] = sales_id
    if q:
        filt["$or"] = [
            {"name": {"$regex": q, "$options": "i"}},
            {"barcode_id": {"$regex": q, "$options": "i"}},
        ]

    # Simple direct-sort keys (Mongo can sort in DB)
    direct_sort_map = {
        "no": [("customer_no", 1)],
        "ranking": [("total_purchases", -1), ("purchase_count", -1)],
        "loans": [("gallon_loans", -1), ("total_debt", -1)],
        "debt": [("total_debt", -1)],
        "recent": [("last_purchase_date", -1)],
    }
    if sort in direct_sort_map:
        cursor = db.customers.find(filt, {"_id": 0}).sort(direct_sort_map[sort])
        items = await cursor.to_list(2000)
        # For "recent": customers who never purchased (null date) should appear LAST
        if sort == "recent":
            has_date = [c for c in items if c.get("last_purchase_date")]
            no_date = [c for c in items if not c.get("last_purchase_date")]
            # customer_no ascending for those with no purchase
            no_date.sort(key=lambda c: c.get("customer_no", 0))
            items = has_date + no_date
        return items

    # "last" (oldest last purchase first) needs Python-side sort so we can push
    # never-purchased customers to the bottom (Mongo sorts nulls first on asc).
    cursor = db.customers.find(filt, {"_id": 0})
    items = await cursor.to_list(2000)
    if sort == "last":
        has_date = [c for c in items if c.get("last_purchase_date")]
        no_date = [c for c in items if not c.get("last_purchase_date")]
        has_date.sort(key=lambda c: c.get("last_purchase_date") or "")
        no_date.sort(key=lambda c: c.get("customer_no", 0))
        items = has_date + no_date
    return items


@api.get("/customers/lookup/{barcode_id}")
async def lookup_customer(barcode_id: str, user=Depends(get_current_user)):
    c = await db.customers.find_one({"barcode_id": barcode_id}, {"_id": 0})
    if not c:
        raise HTTPException(404, "Pelanggan tidak ditemukan")
    if user["role"] == "sales" and c.get("created_by") != user["id"]:
        raise HTTPException(403, "Bukan pelanggan Anda")
    if user["role"] == "admin" and c.get("group_letter") != user.get("group_letter"):
        raise HTTPException(403, "Bukan pelanggan wilayah Anda")
    return c


@api.get("/customers/{customer_id}")
async def get_customer(customer_id: str, user=Depends(get_current_user)):
    c = await db.customers.find_one({"id": customer_id}, {"_id": 0})
    if not c:
        raise HTTPException(404, "Not found")
    if user["role"] == "sales" and c.get("created_by") != user["id"]:
        raise HTTPException(403, "Forbidden")
    if user["role"] == "admin" and c.get("group_letter") != user.get("group_letter"):
        raise HTTPException(403, "Forbidden")
    return c


@api.post("/customers")
async def create_customer(body: CustomerCreate, user=Depends(require_roles("sales", "super_admin"))):
    # Only sales (or super_admin acting as owner) can create.
    if user["role"] != "sales":
        raise HTTPException(403, "Hanya Sales yang bisa menambah pelanggan baru")
    sales_code = (user.get("sales_code") or user.get("username") or "SALES").upper()
    group = user.get("group_letter")
    customer_no = await next_customer_no_for(user["id"])
    barcode = (body.barcode_id or f"{sales_code}-OXLY-{customer_no}").strip()
    if await db.customers.find_one({"barcode_id": barcode}):
        raise HTTPException(409, "Barcode sudah dipakai")
    doc = {
        "id": str(uuid.uuid4()),
        "customer_no": customer_no,
        "name": body.name,
        "address": body.address or "",
        "wa_number": body.wa_number or "",
        "barcode_id": barcode,
        "group_letter": group,
        "sales_code": sales_code,
        "created_by": user["id"],
        "gallon_loans": 0,
        "total_debt": 0.0,
        "total_purchases": 0.0,
        "purchase_count": 0,
        "last_purchase_date": None,
        "lat": body.lat,
        "lng": body.lng,
        "created_at": now_utc().isoformat(),
    }
    await db.customers.insert_one(doc)
    return strip_id(doc)


@api.patch("/customers/{customer_id}")
async def update_customer(customer_id: str, body: CustomerUpdate, user=Depends(get_current_user)):
    c = await db.customers.find_one({"id": customer_id})
    if not c:
        raise HTTPException(404, "Not found")
    if user["role"] == "sales" and c.get("created_by") != user["id"]:
        raise HTTPException(403, "Forbidden")
    if user["role"] == "admin" and c.get("group_letter") != user.get("group_letter"):
        raise HTTPException(403, "Forbidden")
    update = {k: v for k, v in body.dict(exclude_unset=True).items() if v is not None}
    if update:
        await db.customers.update_one({"id": customer_id}, {"$set": update})
    updated = await db.customers.find_one({"id": customer_id}, {"_id": 0})
    return updated


@api.delete("/customers/{customer_id}")
async def delete_customer(customer_id: str, user=Depends(require_roles("super_admin"))):
    await db.customers.delete_one({"id": customer_id})
    return {"ok": True}


# ============================================================
# TRANSACTIONS
# ============================================================
def _txn_totals(items: List[TransactionItem]) -> float:
    return sum(i.subtotal for i in items)


@api.post("/transactions")
async def create_transaction(body: TransactionCreate, user=Depends(require_roles("sales", "super_admin"))):
    customer = await db.customers.find_one({"id": body.customer_id})
    if not customer:
        raise HTTPException(404, "Pelanggan tidak ditemukan")
    if user["role"] == "sales" and customer.get("created_by") != user["id"]:
        raise HTTPException(403, "Bukan pelanggan Anda")

    total = _txn_totals(body.items)
    prev_debt = float(customer.get("total_debt", 0))
    # payment covers current total first; leftover reduces prev debt
    hutang_baru = 0.0
    sisa_bayar = body.bayar - total
    if sisa_bayar >= 0:
        # payment covers this txn; overflow reduces old debt
        new_debt = max(0.0, prev_debt - sisa_bayar)
        hutang_transaksi = 0.0
    else:
        # not enough payment -> add remainder to debt
        hutang_transaksi = -sisa_bayar
        new_debt = prev_debt + hutang_transaksi

    new_loans = int(customer.get("gallon_loans", 0)) + int(body.pinjam_galon) - int(body.galon_kembali)
    if new_loans < 0:
        new_loans = 0

    txn_id = str(uuid.uuid4())
    txn = {
        "id": txn_id,
        "customer_id": body.customer_id,
        "customer_name": customer.get("name"),
        "customer_no": customer.get("customer_no"),
        "customer_wa": customer.get("wa_number"),
        "sales_id": user["id"],
        "sales_code": user.get("sales_code") or user.get("username"),
        "group_letter": customer.get("group_letter"),
        "items": [i.dict() for i in body.items],
        "total": total,
        "bayar": body.bayar,
        "hutang_transaksi": hutang_transaksi,
        "pinjam_galon": body.pinjam_galon,
        "galon_kembali": body.galon_kembali,
        "prev_debt": prev_debt,
        "new_debt": new_debt,
        "prev_loans": int(customer.get("gallon_loans", 0)),
        "new_loans": new_loans,
        "date": now_utc().isoformat(),
        "date_only": now_utc().strftime("%Y-%m-%d"),
        "edited": False,
        "edit_count": 0,
        "lottery_tickets": [],
    }
    # Auto-generate lottery tickets for gallon-water purchases (excludes empty gallon returns)
    galon_qty = sum(
        int(it.qty) for it in body.items
        if it.unit == "gln" and "Kosong" not in (it.product_name or "")
    )
    if galon_qty > 0:
        period = await db.lottery_periods.find_one({"is_active": True})
        if period and period.get("start_date", "") <= txn["date_only"] <= period.get("end_date", "9999-12-31") and not period.get("drawn_at"):
            tickets_docs = []
            for _ in range(galon_qty):
                code = await _gen_unique_ticket_code()
                tickets_docs.append({
                    "id": str(uuid.uuid4()),
                    "ticket_code": code,
                    "period_id": period["id"],
                    "period_name": period.get("name"),
                    "sales_id": user["id"],
                    "sales_code": user.get("sales_code") or user.get("username"),
                    "group_letter": customer.get("group_letter"),
                    "customer_id": customer["id"],
                    "customer_name": customer.get("name"),
                    "customer_no": customer.get("customer_no"),
                    "customer_wa": customer.get("wa_number") or "",
                    "transaction_id": txn_id,
                    "created_at": now_utc().isoformat(),
                })
            await db.lottery_tickets.insert_many(tickets_docs)
            txn["lottery_tickets"] = [t["ticket_code"] for t in tickets_docs]
            txn["lottery_period_name"] = period.get("name")

    await db.transactions.insert_one(txn)
    await db.customers.update_one(
        {"id": body.customer_id},
        {
            "$set": {
                "total_debt": new_debt,
                "gallon_loans": new_loans,
                "last_purchase_date": txn["date"],
            },
            "$inc": {
                "total_purchases": total,
                "purchase_count": 1,
            },
        },
    )
    return strip_id(txn)


@api.get("/transactions")
async def list_transactions(
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    sales_id: Optional[str] = None,
    sales_code: Optional[str] = None,
    group_letter: Optional[str] = None,
    customer_id: Optional[str] = None,
    user=Depends(get_current_user),
):
    q: dict = {}
    if user["role"] == "sales":
        q["sales_id"] = user["id"]
    elif user["role"] == "admin":
        q["group_letter"] = user.get("group_letter")
    else:
        if group_letter:
            q["group_letter"] = group_letter
    if sales_id:
        q["sales_id"] = sales_id
    if sales_code:
        q["sales_code"] = sales_code
    if customer_id:
        q["customer_id"] = customer_id
    if date_from or date_to:
        dq: dict = {}
        if date_from:
            dq["$gte"] = date_from
        if date_to:
            dq["$lte"] = date_to
        q["date_only"] = dq
    items = await db.transactions.find(q, {"_id": 0}).sort("date", -1).to_list(5000)
    return items


@api.get("/transactions/{txn_id}")
async def get_txn(txn_id: str, user=Depends(get_current_user)):
    t = await db.transactions.find_one({"id": txn_id}, {"_id": 0})
    if not t:
        raise HTTPException(404, "Not found")
    return t


@api.patch("/transactions/{txn_id}")
async def edit_transaction(txn_id: str, body: TransactionEdit, user=Depends(get_current_user)):
    t = await db.transactions.find_one({"id": txn_id})
    if not t:
        raise HTTPException(404, "Not found")
    # sales can edit only own, 1x. Super admin unlimited.
    if user["role"] == "sales":
        if t["sales_id"] != user["id"]:
            raise HTTPException(403, "Bukan transaksi Anda")
        if int(t.get("edit_count", 0)) >= 1:
            raise HTTPException(400, "Transaksi hanya bisa diedit 1x oleh sales")
    elif user["role"] == "admin":
        raise HTTPException(403, "Admin tidak bisa edit transaksi")

    customer = await db.customers.find_one({"id": t["customer_id"]})
    if not customer:
        raise HTTPException(404, "Pelanggan tidak ditemukan")

    # Revert old effect first
    prev_total = float(t.get("total", 0))
    prev_debt_added = float(t.get("hutang_transaksi", 0))
    prev_loans_delta = int(t.get("pinjam_galon", 0)) - int(t.get("galon_kembali", 0))

    # Recompute new values
    items = body.items if body.items is not None else [TransactionItem(**it) for it in t["items"]]
    bayar = body.bayar if body.bayar is not None else t["bayar"]
    pinjam = body.pinjam_galon if body.pinjam_galon is not None else t["pinjam_galon"]
    kembali = body.galon_kembali if body.galon_kembali is not None else t.get("galon_kembali", 0)

    new_total = _txn_totals(items) if isinstance(items[0], TransactionItem) else sum(i["subtotal"] for i in items)
    # Reverse debt effect: subtract prev_debt_added from customer, then re-apply new
    debt_before = float(customer.get("total_debt", 0)) - prev_debt_added
    if debt_before < 0:
        debt_before = 0
    sisa = bayar - new_total
    if sisa >= 0:
        hutang_transaksi = 0.0
        new_debt = max(0.0, debt_before - sisa)
    else:
        hutang_transaksi = -sisa
        new_debt = debt_before + hutang_transaksi

    # Loans: reverse then apply
    loans_before = int(customer.get("gallon_loans", 0)) - prev_loans_delta
    if loans_before < 0:
        loans_before = 0
    new_loans = loans_before + int(pinjam) - int(kembali)
    if new_loans < 0:
        new_loans = 0

    items_dict = [i.dict() if isinstance(i, TransactionItem) else i for i in items]

    await db.transactions.update_one(
        {"id": txn_id},
        {"$set": {
            "items": items_dict,
            "total": new_total,
            "bayar": bayar,
            "pinjam_galon": pinjam,
            "galon_kembali": kembali,
            "hutang_transaksi": hutang_transaksi,
            "new_debt": new_debt,
            "new_loans": new_loans,
            "edited": True,
        }, "$inc": {"edit_count": 1}},
    )
    # Update customer totals
    delta_purchases = new_total - prev_total
    await db.customers.update_one(
        {"id": t["customer_id"]},
        {
            "$set": {"total_debt": new_debt, "gallon_loans": new_loans},
            "$inc": {"total_purchases": delta_purchases},
        },
    )
    updated = await db.transactions.find_one({"id": txn_id}, {"_id": 0})
    return updated


@api.delete("/transactions/{txn_id}")
async def delete_txn(txn_id: str, user=Depends(require_roles("super_admin"))):
    t = await db.transactions.find_one({"id": txn_id})
    if not t:
        return {"ok": True}
    # revert effects
    debt_delta = float(t.get("hutang_transaksi", 0))
    loans_delta = int(t.get("pinjam_galon", 0)) - int(t.get("galon_kembali", 0))
    await db.customers.update_one(
        {"id": t["customer_id"]},
        {
            "$inc": {
                "total_debt": -debt_delta,
                "gallon_loans": -loans_delta,
                "total_purchases": -float(t.get("total", 0)),
                "purchase_count": -1,
            }
        },
    )
    await db.transactions.delete_one({"id": txn_id})
    # Also cleanup lottery tickets linked to this transaction
    await db.lottery_tickets.delete_many({"transaction_id": txn_id})
    return {"ok": True}


# ============================================================
# REPORTS
# ============================================================
@api.get("/reports/daily")
async def daily_report(
    date: Optional[str] = None,
    group_letter: Optional[str] = None,
    sales_code: Optional[str] = None,
    user=Depends(get_current_user),
):
    """Aggregated daily report by sales_code."""
    d = date or now_utc().strftime("%Y-%m-%d")
    q: dict = {"date_only": d}
    if user["role"] == "sales":
        q["sales_id"] = user["id"]
    elif user["role"] == "admin":
        q["group_letter"] = user.get("group_letter")
    else:
        if group_letter:
            q["group_letter"] = group_letter
    if sales_code:
        q["sales_code"] = sales_code

    txns = await db.transactions.find(q, {"_id": 0}).to_list(5000)
    # Expenses in same scope
    q_exp: dict = {"date_only": d}
    if user["role"] == "sales":
        q_exp["sales_id"] = user["id"]
    elif user["role"] == "admin":
        q_exp["group_letter"] = user.get("group_letter")
    if sales_code:
        q_exp["sales_code"] = sales_code
    expenses = await db.expenses.find(q_exp, {"_id": 0}).to_list(5000)

    # aggregate by sales_code
    agg: dict = {}
    total_all = {"total_uang": 0.0, "total_bayar": 0.0, "total_hutang": 0.0, "total_pinjam": 0, "total_kembali": 0, "total_gln_terjual": 0, "count": 0, "total_pengeluaran": 0.0, "total_setoran": 0.0}
    for t in txns:
        code = t.get("sales_code") or "?"
        a = agg.setdefault(code, {
            "sales_code": code,
            "sales_id": t.get("sales_id"),
            "total_uang": 0.0,
            "total_bayar": 0.0,
            "total_hutang": 0.0,
            "total_pinjam": 0,
            "total_kembali": 0,
            "total_gln_terjual": 0,
            "count": 0,
            "total_pengeluaran": 0.0,
            "total_setoran": 0.0,
            "expenses": [],
            "transactions": [],
        })
        a["total_uang"] += float(t.get("total", 0))
        a["total_bayar"] += float(t.get("bayar", 0))
        a["total_hutang"] += float(t.get("hutang_transaksi", 0))
        a["total_pinjam"] += int(t.get("pinjam_galon", 0))
        a["total_kembali"] += int(t.get("galon_kembali", 0))
        # count gallons sold (unit gln)
        gln = sum(int(it.get("qty", 0)) for it in t.get("items", []) if it.get("unit") == "gln" and "Kosong" not in it.get("product_name", ""))
        a["total_gln_terjual"] += gln
        a["count"] += 1
        a["transactions"].append(t)
        total_all["total_uang"] += float(t.get("total", 0))
        total_all["total_bayar"] += float(t.get("bayar", 0))
        total_all["total_hutang"] += float(t.get("hutang_transaksi", 0))
        total_all["total_pinjam"] += int(t.get("pinjam_galon", 0))
        total_all["total_kembali"] += int(t.get("galon_kembali", 0))
        total_all["total_gln_terjual"] += gln
        total_all["count"] += 1

    # apply expenses per sales
    for e in expenses:
        code = e.get("sales_code") or "?"
        a = agg.setdefault(code, {
            "sales_code": code,
            "sales_id": e.get("sales_id"),
            "total_uang": 0.0, "total_bayar": 0.0, "total_hutang": 0.0,
            "total_pinjam": 0, "total_kembali": 0, "total_gln_terjual": 0,
            "count": 0, "total_pengeluaran": 0.0, "total_setoran": 0.0,
            "expenses": [], "transactions": [],
        })
        a["total_pengeluaran"] += float(e.get("amount", 0))
        a["expenses"].append(e)
        total_all["total_pengeluaran"] += float(e.get("amount", 0))

    # compute setoran = bayar - pengeluaran per sales & overall
    for code, a in agg.items():
        a["total_setoran"] = max(0.0, a["total_bayar"] - a["total_pengeluaran"])
    total_all["total_setoran"] = max(0.0, total_all["total_bayar"] - total_all["total_pengeluaran"])
    return {"date": d, "totals": total_all, "groups": list(agg.values())}


# ============================================================
# PART PRICES & SETTINGS (Red — Super Admin permanent)
# ============================================================
@api.get("/part-prices")
async def list_part_prices(user=Depends(get_current_user)):
    items = await db.part_prices.find({}, {"_id": 0}).sort("order", 1).to_list(100)
    return items


@api.post("/part-prices")
async def create_part_price(body: PartPriceUpdate, user=Depends(require_roles("super_admin"))):
    if not body.name.strip():
        raise HTTPException(400, "Nama part wajib diisi")
    # auto-set order if not provided
    order = int(body.order or 0)
    if order == 0:
        last = await db.part_prices.find({}, {"_id": 0, "order": 1}).sort("order", -1).limit(1).to_list(1)
        order = (int(last[0].get("order", 0)) if last else 0) + 1
    doc = {
        "id": str(uuid.uuid4()),
        "name": body.name.strip(),
        "rp_per_pcs": float(body.rp_per_pcs),
        "order": order,
        "created_at": now_utc().isoformat(),
    }
    await db.part_prices.insert_one(doc)
    return strip_id(doc)


@api.patch("/part-prices/{part_id}")
async def update_part_price(part_id: str, body: PartPriceUpdate, user=Depends(require_roles("super_admin"))):
    existing = await db.part_prices.find_one({"id": part_id}, {"_id": 0})
    if not existing:
        raise HTTPException(404, "Not found")
    order = int(body.order or 0) or int(existing.get("order", 0))
    await db.part_prices.update_one(
        {"id": part_id},
        {"$set": {"name": body.name, "rp_per_pcs": float(body.rp_per_pcs), "order": order}},
    )
    p = await db.part_prices.find_one({"id": part_id}, {"_id": 0})
    return p


@api.delete("/part-prices/{part_id}")
async def delete_part_price(part_id: str, user=Depends(require_roles("super_admin"))):
    await db.part_prices.delete_one({"id": part_id})
    return {"ok": True}


@api.get("/settings/{key}")
async def get_setting(key: str, user=Depends(get_current_user)):
    s = await db.settings.find_one({"key": key}, {"_id": 0})
    if not s:
        return {"key": key, "value": None}
    return s


@api.put("/settings/{key}")
async def set_setting(key: str, body: SettingUpdate, user=Depends(require_roles("super_admin"))):
    await db.settings.update_one({"key": key}, {"$set": {"key": key, "value": body.value}}, upsert=True)
    return {"key": key, "value": body.value}


# ============================================================
# MONTHLY REPORT (Laporan Bulanan)
# ============================================================
DAY_NAMES_ID = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu", "Minggu"]


async def _get_monthly_admin_doc(sales_id: str, year: int, month: int) -> dict:
    doc = await db.monthly_reports.find_one(
        {"sales_id": sales_id, "year": year, "month": month},
        {"_id": 0},
    )
    if not doc:
        doc = {
            "sales_id": sales_id,
            "year": year,
            "month": month,
            "gaji_sopir": 0,
            "gaji_kernet": 0,
            "bonus_per_galon_1": 0,
            "bonus_per_galon_2": 0,
            "komisi": 0,
            "bonus_target_mg1": 0,
            "bonus_target_mg2": 0,
            "bonus_target_mg3": 0,
            "bonus_target_mg4": 0,
            "bonus_target_mg5": 0,
            "part_qtys": {},
        }
    return doc


@api.get("/reports/monthly")
async def monthly_report(
    sales_id: str,
    year: int,
    month: int,
    user=Depends(get_current_user),
):
    # RBAC
    target_user = await db.users.find_one({"id": sales_id})
    if not target_user:
        raise HTTPException(404, "Sales tidak ditemukan")
    if user["role"] == "sales" and user["id"] != sales_id:
        raise HTTPException(403, "Forbidden")
    if user["role"] == "admin" and target_user.get("group_letter") != user.get("group_letter"):
        raise HTTPException(403, "Forbidden")

    # date range
    ndays = calendar.monthrange(year, month)[1]
    start = f"{year:04d}-{month:02d}-01"
    end = f"{year:04d}-{month:02d}-{ndays:02d}"

    # Green: daily transactions
    txns = await db.transactions.find(
        {"sales_id": sales_id, "date_only": {"$gte": start, "$lte": end}},
        {"_id": 0},
    ).to_list(10000)

    daily_map: dict = {}  # day -> {"bayar": .., "gln": .., "count": ..}
    total_bayar = 0.0
    total_uang = 0.0
    total_gln = 0
    for t in txns:
        d = int(t["date_only"].split("-")[2])
        row = daily_map.setdefault(d, {"bayar": 0.0, "uang": 0.0, "gln": 0, "count": 0})
        row["bayar"] += float(t.get("bayar", 0))
        row["uang"] += float(t.get("total", 0))
        gln = sum(int(it.get("qty", 0)) for it in t.get("items", []) if it.get("unit") == "gln" and "Kosong" not in it.get("product_name", ""))
        row["gln"] += gln
        row["count"] += 1
        total_bayar += float(t.get("bayar", 0))
        total_uang += float(t.get("total", 0))
        total_gln += gln

    daily = []
    for day in range(1, ndays + 1):
        dt = datetime(year, month, day)
        day_name = DAY_NAMES_ID[dt.weekday()]
        r = daily_map.get(day, {"bayar": 0.0, "uang": 0.0, "gln": 0, "count": 0})
        daily.append({
            "no": day,
            "date": dt.strftime("%Y-%m-%d"),
            "day_name": day_name,
            "penjualan": r["uang"],  # nilai jual per hari
            "bayar": r["bayar"],
            "gln": r["gln"],
            "count": r["count"],
        })
    A1_penjualan = total_uang  # nilai penjualan (total kotor / omzet)

    # Green: sales expenses (BBM/Servis/dll) in the month
    expenses = await db.expenses.find(
        {"sales_id": sales_id, "date_only": {"$gte": start, "$lte": end}},
        {"_id": 0},
    ).sort("date", 1).to_list(10000)
    total_sales_expenses = sum(float(e.get("amount", 0)) for e in expenses)

    # Yellow: admin filled values
    admin = await _get_monthly_admin_doc(sales_id, year, month)

    A2_gaji_bonus = sum([
        float(admin.get("gaji_sopir", 0) or 0),
        float(admin.get("gaji_kernet", 0) or 0),
        float(admin.get("bonus_per_galon_1", 0) or 0),
        float(admin.get("bonus_per_galon_2", 0) or 0),
        float(admin.get("komisi", 0) or 0),
        float(admin.get("bonus_target_mg1", 0) or 0),
        float(admin.get("bonus_target_mg2", 0) or 0),
        float(admin.get("bonus_target_mg3", 0) or 0),
        float(admin.get("bonus_target_mg4", 0) or 0),
        float(admin.get("bonus_target_mg5", 0) or 0),
    ])

    # Red: part prices + Yellow: qty
    parts_docs = await db.part_prices.find({}, {"_id": 0}).sort("order", 1).to_list(100)
    part_qtys = admin.get("part_qtys", {}) or {}
    parts = []
    parts_total = 0.0
    for p in parts_docs:
        qty = int(part_qtys.get(p["name"], 0) or 0)
        subtotal = float(p.get("rp_per_pcs", 0)) * qty
        parts_total += subtotal
        parts.append({
            "id": p["id"],
            "name": p["name"],
            "rp_per_pcs": float(p.get("rp_per_pcs", 0)),
            "qty": qty,
            "subtotal": subtotal,
        })

    A3_biaya_operasional = parts_total + total_sales_expenses

    # Red: Rp kulakan per galon
    kulakan_setting = await db.settings.find_one({"key": "rp_kulakan_per_galon"}, {"_id": 0})
    rp_kulakan = float((kulakan_setting or {}).get("value") or 0)
    A4_kulakan = rp_kulakan * total_gln

    # Net income
    pendapatan_bersih = A1_penjualan - A4_kulakan - A3_biaya_operasional - A2_gaji_bonus

    return {
        "sales_id": sales_id,
        "sales_code": target_user.get("sales_code") or target_user.get("username"),
        "sales_name": target_user.get("name"),
        "group_letter": target_user.get("group_letter"),
        "year": year,
        "month": month,
        "days_in_month": ndays,
        "daily": daily,
        "total_gln_sold": total_gln,
        "total_bayar": total_bayar,
        # green
        "sales_expenses": expenses,
        "total_sales_expenses": total_sales_expenses,
        # yellow (admin)
        "admin": {
            "gaji_sopir": float(admin.get("gaji_sopir", 0) or 0),
            "gaji_kernet": float(admin.get("gaji_kernet", 0) or 0),
            "bonus_per_galon_1": float(admin.get("bonus_per_galon_1", 0) or 0),
            "bonus_per_galon_2": float(admin.get("bonus_per_galon_2", 0) or 0),
            "komisi": float(admin.get("komisi", 0) or 0),
            "bonus_target_mg1": float(admin.get("bonus_target_mg1", 0) or 0),
            "bonus_target_mg2": float(admin.get("bonus_target_mg2", 0) or 0),
            "bonus_target_mg3": float(admin.get("bonus_target_mg3", 0) or 0),
            "bonus_target_mg4": float(admin.get("bonus_target_mg4", 0) or 0),
            "bonus_target_mg5": float(admin.get("bonus_target_mg5", 0) or 0),
        },
        "parts": parts,
        "rp_kulakan_per_galon": rp_kulakan,
        # totals
        "A1_penjualan": A1_penjualan,
        "A2_gaji_bonus": A2_gaji_bonus,
        "A3_biaya_operasional": A3_biaya_operasional,
        "A3_parts_total": parts_total,
        "A3_sales_expenses_total": total_sales_expenses,
        "A4_kulakan": A4_kulakan,
        "pendapatan_bersih": pendapatan_bersih,
    }


@api.patch("/reports/monthly")
async def update_monthly_report(
    sales_id: str,
    year: int,
    month: int,
    body: MonthlyReportUpdate,
    user=Depends(get_current_user),
):
    # only admin (own group) & super_admin can edit yellow fields
    target_user = await db.users.find_one({"id": sales_id})
    if not target_user:
        raise HTTPException(404, "Sales tidak ditemukan")
    if user["role"] == "sales":
        raise HTTPException(403, "Forbidden")
    if user["role"] == "admin" and target_user.get("group_letter") != user.get("group_letter"):
        raise HTTPException(403, "Forbidden")

    update = {k: v for k, v in body.dict(exclude_unset=True).items() if v is not None}
    if not update:
        return {"ok": True}
    await db.monthly_reports.update_one(
        {"sales_id": sales_id, "year": year, "month": month},
        {"$set": {**update, "sales_id": sales_id, "year": year, "month": month, "updated_at": now_utc().isoformat()}},
        upsert=True,
    )
    return {"ok": True}


# ============================================================
# EXPENSES (Pengeluaran Sales)
# ============================================================
@api.post("/expenses")
async def create_expense(body: ExpenseCreate, user=Depends(require_roles("sales", "super_admin"))):
    if body.amount <= 0:
        raise HTTPException(400, "Jumlah pengeluaran harus > 0")
    date_iso = (body.date or now_utc().isoformat())
    date_only = date_iso[:10] if "T" in date_iso else date_iso[:10]
    doc = {
        "id": str(uuid.uuid4()),
        "sales_id": user["id"],
        "sales_code": user.get("sales_code") or user.get("username"),
        "group_letter": user.get("group_letter"),
        "category": body.category.strip() or "Lain-lain",
        "description": (body.description or "").strip(),
        "amount": float(body.amount),
        "date": date_iso,
        "date_only": date_only,
        "created_at": now_utc().isoformat(),
    }
    await db.expenses.insert_one(doc)
    return strip_id(doc)


@api.get("/expenses")
async def list_expenses(
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    sales_id: Optional[str] = None,
    sales_code: Optional[str] = None,
    user=Depends(get_current_user),
):
    q: dict = {}
    if user["role"] == "sales":
        q["sales_id"] = user["id"]
    elif user["role"] == "admin":
        q["group_letter"] = user.get("group_letter")
    if sales_id:
        q["sales_id"] = sales_id
    if sales_code:
        q["sales_code"] = sales_code
    if date_from or date_to:
        dq: dict = {}
        if date_from:
            dq["$gte"] = date_from
        if date_to:
            dq["$lte"] = date_to
        q["date_only"] = dq
    items = await db.expenses.find(q, {"_id": 0}).sort("date", -1).to_list(2000)
    return items


@api.delete("/expenses/{expense_id}")
async def delete_expense(expense_id: str, user=Depends(get_current_user)):
    e = await db.expenses.find_one({"id": expense_id})
    if not e:
        raise HTTPException(404, "Not found")
    if user["role"] == "sales" and e.get("sales_id") != user["id"]:
        raise HTTPException(403, "Bukan pengeluaran Anda")
    if user["role"] == "admin":
        raise HTTPException(403, "Admin tidak bisa hapus pengeluaran")
    await db.expenses.delete_one({"id": expense_id})
    return {"ok": True}


# ============================================================
# LOCATION / GPS
# ============================================================
@api.post("/location/ping")
async def location_ping(body: LocationPing, user=Depends(get_current_user)):
    doc = {
        "id": str(uuid.uuid4()),
        "sales_id": user["id"],
        "sales_code": user.get("sales_code") or user.get("username"),
        "group_letter": user.get("group_letter"),
        "lat": body.lat,
        "lng": body.lng,
        "ts": now_utc().isoformat(),
    }
    await db.locations.insert_one(doc)
    # Also upsert last-known
    await db.users.update_one({"id": user["id"]}, {"$set": {"last_location": {"lat": body.lat, "lng": body.lng, "ts": doc["ts"]}}})
    return {"ok": True}


@api.get("/location/live")
async def live_locations(user=Depends(require_roles("super_admin", "admin"))):
    q: dict = {"role": "sales"}
    if user["role"] == "admin":
        q["group_letter"] = user.get("group_letter")
    users = await db.users.find(q, {"_id": 0, "password_hash": 0}).to_list(1000)
    return [
        {
            "id": u["id"],
            "sales_code": u.get("sales_code"),
            "name": u.get("name"),
            "group_letter": u.get("group_letter"),
            "last_location": u.get("last_location"),
        }
        for u in users
    ]


@api.get("/location/history/{sales_id}")
async def location_history(sales_id: str, date: Optional[str] = None, user=Depends(require_roles("super_admin", "admin"))):
    q = {"sales_id": sales_id}
    if date:
        q["ts"] = {"$gte": date, "$lte": date + "T23:59:59"}
    # Ascending order so caller can draw polyline chronologically
    items = await db.locations.find(q, {"_id": 0}).sort("ts", 1).limit(2000).to_list(2000)
    return items


# ============================================================
# STATS
# ============================================================
@api.get("/stats/overview")
async def overview(user=Depends(get_current_user)):
    q_tx: dict = {}
    q_c: dict = {}
    today = now_utc().strftime("%Y-%m-%d")
    if user["role"] == "sales":
        q_tx["sales_id"] = user["id"]
        q_c["created_by"] = user["id"]
    elif user["role"] == "admin":
        q_tx["group_letter"] = user.get("group_letter")
        q_c["group_letter"] = user.get("group_letter")

    total_customers = await db.customers.count_documents(q_c)
    total_tx = await db.transactions.count_documents(q_tx)
    q_today = dict(q_tx, date_only=today)
    today_tx = await db.transactions.find(q_today, {"_id": 0}).to_list(2000)

    # Expenses today in same scope
    q_exp_today: dict = {"date_only": today}
    if user["role"] == "sales":
        q_exp_today["sales_id"] = user["id"]
    elif user["role"] == "admin":
        q_exp_today["group_letter"] = user.get("group_letter")
    today_expenses_list = await db.expenses.find(q_exp_today, {"_id": 0}).to_list(2000)
    today_expenses = sum(float(e.get("amount", 0)) for e in today_expenses_list)

    today_revenue = sum(float(t.get("bayar", 0)) for t in today_tx)
    today_total = sum(float(t.get("total", 0)) for t in today_tx)
    today_gln = sum(sum(int(it.get("qty", 0)) for it in t.get("items", []) if it.get("unit") == "gln" and "Kosong" not in it.get("product_name", "")) for t in today_tx)
    today_deposit = max(0.0, today_revenue - today_expenses)
    return {
        "total_customers": total_customers,
        "total_transactions": total_tx,
        "today_count": len(today_tx),
        "today_revenue": today_revenue,
        "today_total": today_total,
        "today_gln_sold": today_gln,
        "today_expenses": today_expenses,
        "today_deposit": today_deposit,
    }


# ============================================================
# LOTTERY / UNDIAN
# ============================================================
def _gen_ticket_code() -> str:
    """Generate a random OXLY-XXXXXX ticket code (6 uppercase alphanumeric chars)."""
    return "OXLY-" + "".join(secrets.choice(string.ascii_uppercase + string.digits) for _ in range(6))


async def _gen_unique_ticket_code() -> str:
    """Generate a ticket code guaranteed unique in db.lottery_tickets."""
    for _ in range(10):
        code = _gen_ticket_code()
        exists = await db.lottery_tickets.find_one({"ticket_code": code}, {"_id": 1})
        if not exists:
            return code
    # Fallback: append uuid tail if collisions keep happening
    return "OXLY-" + uuid.uuid4().hex[:8].upper()


async def _deactivate_all_periods():
    await db.lottery_periods.update_many({}, {"$set": {"is_active": False}})


@api.post("/lottery/periods")
async def create_lottery_period(body: LotteryPeriodCreate, user=Depends(require_roles("super_admin"))):
    if body.start_date > body.end_date:
        raise HTTPException(400, "Tanggal mulai harus sebelum tanggal selesai")
    if body.winner_count < 1:
        raise HTTPException(400, "Jumlah pemenang minimal 1")
    if body.is_active:
        await _deactivate_all_periods()
    doc = {
        "id": str(uuid.uuid4()),
        "name": body.name.strip(),
        "start_date": body.start_date,
        "end_date": body.end_date,
        "winner_count": int(body.winner_count),
        "is_active": bool(body.is_active),
        "prize_description": (body.prize_description or "").strip() or None,
        "description": (body.description or "").strip() or None,
        "winners": [],
        "drawn_at": None,
        "created_by": user["id"],
        "created_at": now_utc().isoformat(),
    }
    await db.lottery_periods.insert_one(doc)
    return strip_id(doc)


@api.get("/lottery/periods")
async def list_lottery_periods(user=Depends(get_current_user)):
    items = await db.lottery_periods.find({}, {"_id": 0}).sort("created_at", -1).to_list(500)
    # Attach ticket count for each period
    for it in items:
        it["ticket_count"] = await db.lottery_tickets.count_documents({"period_id": it["id"]})
    return items


@api.get("/lottery/periods/active")
async def get_active_period(user=Depends(get_current_user)):
    period = await db.lottery_periods.find_one({"is_active": True}, {"_id": 0})
    if not period:
        return None
    period["ticket_count"] = await db.lottery_tickets.count_documents({"period_id": period["id"]})
    return period


@api.patch("/lottery/periods/{pid}")
async def update_lottery_period(pid: str, body: LotteryPeriodUpdate, user=Depends(require_roles("super_admin"))):
    period = await db.lottery_periods.find_one({"id": pid})
    if not period:
        raise HTTPException(404, "Periode tidak ditemukan")
    if period.get("drawn_at"):
        raise HTTPException(400, "Periode sudah diundi, tidak bisa diubah")
    # Build update dict; treat empty string on nullable text fields as null
    raw = body.dict(exclude_unset=True)
    update: dict = {}
    for k, v in raw.items():
        if v is None:
            continue
        if k in ("prize_description", "description"):
            update[k] = (v.strip() if isinstance(v, str) else v) or None
        else:
            update[k] = v
    if "winner_count" in update and int(update["winner_count"]) < 1:
        raise HTTPException(400, "Jumlah pemenang minimal 1")
    if "start_date" in update or "end_date" in update:
        start = update.get("start_date", period["start_date"])
        end = update.get("end_date", period["end_date"])
        if start > end:
            raise HTTPException(400, "Tanggal mulai harus sebelum tanggal selesai")
    if update.get("is_active"):
        await _deactivate_all_periods()
    await db.lottery_periods.update_one({"id": pid}, {"$set": update})
    doc = await db.lottery_periods.find_one({"id": pid}, {"_id": 0})
    doc["ticket_count"] = await db.lottery_tickets.count_documents({"period_id": pid})
    return doc


@api.post("/lottery/periods/{pid}/activate")
async def activate_period(pid: str, user=Depends(require_roles("super_admin"))):
    period = await db.lottery_periods.find_one({"id": pid})
    if not period:
        raise HTTPException(404, "Periode tidak ditemukan")
    if period.get("drawn_at"):
        raise HTTPException(400, "Periode sudah diundi")
    await _deactivate_all_periods()
    await db.lottery_periods.update_one({"id": pid}, {"$set": {"is_active": True}})
    doc = await db.lottery_periods.find_one({"id": pid}, {"_id": 0})
    return doc


@api.delete("/lottery/periods/{pid}")
async def delete_lottery_period(pid: str, user=Depends(require_roles("super_admin"))):
    period = await db.lottery_periods.find_one({"id": pid})
    if not period:
        raise HTTPException(404, "Periode tidak ditemukan")
    ticket_count = await db.lottery_tickets.count_documents({"period_id": pid})
    if ticket_count > 0:
        raise HTTPException(400, f"Tidak bisa hapus. Periode ini punya {ticket_count} tiket. Batalkan/undian dulu.")
    await db.lottery_periods.delete_one({"id": pid})
    return {"ok": True}


@api.post("/lottery/periods/{pid}/draw")
async def draw_lottery(pid: str, user=Depends(require_roles("super_admin"))):
    period = await db.lottery_periods.find_one({"id": pid})
    if not period:
        raise HTTPException(404, "Periode tidak ditemukan")
    if period.get("drawn_at"):
        raise HTTPException(400, "Periode sudah diundi sebelumnya")
    tickets = await db.lottery_tickets.find({"period_id": pid}, {"_id": 0}).to_list(100000)
    if not tickets:
        raise HTTPException(400, "Belum ada tiket di periode ini")
    winner_count = min(int(period.get("winner_count", 1)), len(tickets))
    picked = random.sample(tickets, winner_count)
    winners = []
    for i, t in enumerate(picked):
        winners.append({
            "rank": i + 1,
            "ticket_code": t["ticket_code"],
            "customer_id": t.get("customer_id"),
            "customer_name": t.get("customer_name"),
            "customer_no": t.get("customer_no"),
            "customer_wa": t.get("customer_wa") or "",
            "sales_code": t.get("sales_code"),
            "group_letter": t.get("group_letter"),
        })
    drawn_at = now_utc().isoformat()
    await db.lottery_periods.update_one(
        {"id": pid},
        {"$set": {"winners": winners, "drawn_at": drawn_at, "is_active": False}},
    )
    return {
        "period_id": pid,
        "drawn_at": drawn_at,
        "winner_count": winner_count,
        "total_tickets": len(tickets),
        "winners": winners,
    }


@api.get("/lottery/tickets")
async def list_lottery_tickets(
    period_id: Optional[str] = None,
    sales_id: Optional[str] = None,
    customer_id: Optional[str] = None,
    limit: int = 500,
    user=Depends(get_current_user),
):
    q: dict = {}
    if period_id:
        q["period_id"] = period_id
    if user["role"] == "sales":
        q["sales_id"] = user["id"]
    elif user["role"] == "admin":
        q["group_letter"] = user.get("group_letter")
        if sales_id:
            q["sales_id"] = sales_id
    else:  # super_admin
        if sales_id:
            q["sales_id"] = sales_id
    if customer_id:
        q["customer_id"] = customer_id
    limit = max(1, min(int(limit), 5000))
    items = await db.lottery_tickets.find(q, {"_id": 0}).sort("created_at", -1).limit(limit).to_list(limit)
    return items


@api.get("/lottery/stats")
async def lottery_stats(period_id: Optional[str] = None, user=Depends(get_current_user)):
    if period_id:
        pid = period_id
    else:
        active = await db.lottery_periods.find_one({"is_active": True}, {"_id": 0})
        if not active:
            return {"period": None, "total_tickets": 0, "top_customers": [], "per_sales": []}
        pid = active["id"]
    period = await db.lottery_periods.find_one({"id": pid}, {"_id": 0})
    if not period:
        return {"period": None, "total_tickets": 0, "top_customers": [], "per_sales": []}
    q: dict = {"period_id": pid}
    if user["role"] == "sales":
        q["sales_id"] = user["id"]
    elif user["role"] == "admin":
        q["group_letter"] = user.get("group_letter")
    total = await db.lottery_tickets.count_documents(q)
    top_customers = await db.lottery_tickets.aggregate([
        {"$match": q},
        {"$group": {
            "_id": "$customer_id",
            "customer_name": {"$first": "$customer_name"},
            "customer_no": {"$first": "$customer_no"},
            "sales_code": {"$first": "$sales_code"},
            "count": {"$sum": 1},
        }},
        {"$sort": {"count": -1}},
        {"$limit": 10},
    ]).to_list(10)
    per_sales = await db.lottery_tickets.aggregate([
        {"$match": q},
        {"$group": {
            "_id": "$sales_id",
            "sales_code": {"$first": "$sales_code"},
            "count": {"$sum": 1},
        }},
        {"$sort": {"count": -1}},
    ]).to_list(200)
    return {
        "period": period,
        "total_tickets": total,
        "top_customers": [{"customer_id": t["_id"], "customer_name": t["customer_name"], "customer_no": t["customer_no"], "sales_code": t["sales_code"], "count": t["count"]} for t in top_customers],
        "per_sales": [{"sales_id": t["_id"], "sales_code": t["sales_code"], "count": t["count"]} for t in per_sales],
    }


@api.get("/lottery/winners")
async def list_all_winners(limit: int = 200, user=Depends(get_current_user)):
    """Cross-period list of winners. Role-scoped: sales/admin filtered by group."""
    q: dict = {"drawn_at": {"$ne": None}, "winners": {"$exists": True, "$not": {"$size": 0}}}
    periods = await db.lottery_periods.find(q, {"_id": 0}).sort("drawn_at", -1).limit(500).to_list(500)
    role = user["role"]
    group = user.get("group_letter")
    sales_id = user["id"] if role == "sales" else None
    out = []
    for p in periods:
        for w in p.get("winners", []):
            if role == "sales":
                # need to check the ticket belongs to this sales
                t = await db.lottery_tickets.find_one(
                    {"ticket_code": w["ticket_code"]},
                    {"_id": 0, "sales_id": 1, "group_letter": 1},
                )
                if not t or t.get("sales_id") != sales_id:
                    continue
            elif role == "admin":
                if w.get("group_letter") != group:
                    continue
            out.append({
                "period_id": p["id"],
                "period_name": p["name"],
                "drawn_at": p["drawn_at"],
                "prize_description": p.get("prize_description"),
                **w,
            })
            if len(out) >= limit:
                break
        if len(out) >= limit:
            break
    return out


app.include_router(api)
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)
