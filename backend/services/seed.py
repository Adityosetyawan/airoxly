"""Startup: create indexes & seed default data (products, users, parts, settings)."""
from __future__ import annotations

import logging
import uuid
from datetime import datetime

from core.config import db
from core.security import hash_password
from core.utils import now_utc

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
    {"username": "produksi1", "password": "prod123", "role": "produksi", "name": "Operator Produksi 1", "kelompok": "Kelompok 1"},
    {"username": "produksi2", "password": "prod123", "role": "produksi", "name": "Operator Produksi 2", "kelompok": "Kelompok 2"},
    {"username": "produksi3", "password": "prod123", "role": "produksi", "name": "Operator Produksi 3", "kelompok": "Kelompok 3"},
    {"username": "gudang1", "password": "gudang123", "role": "gudang", "name": "Operator Gudang 1", "kelompok": "Regu A"},
    {"username": "gudang2", "password": "gudang123", "role": "gudang", "name": "Operator Gudang 2", "kelompok": "Regu B"},
]

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

DEFAULT_SHIFTS = [
    {"key": "pagi", "label": "Pagi", "order": 1},
    {"key": "siang", "label": "Siang", "order": 2},
    {"key": "malam", "label": "Malam", "order": 3},
]


async def run_seed():
    await db.users.create_index("username", unique=True)
    await db.users.create_index("id", unique=True)
    # Unique index on google_email only when it's a real string
    try:
        existing = await db.users.index_information()
        for idx_name, idx_info in existing.items():
            keys = idx_info.get("key", [])
            if any(k[0] == "google_email" for k in keys):
                if "partialFilterExpression" not in idx_info:
                    await db.users.drop_index(idx_name)
        await db.users.update_many({"google_email": None}, {"$unset": {"google_email": ""}})
    except Exception as _e:
        logging.getLogger(__name__).warning("google_email index migration: %s", _e)
    await db.users.create_index(
        "google_email",
        unique=True,
        partialFilterExpression={"google_email": {"$type": "string"}},
    )
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

    if await db.products.count_documents({}) == 0:
        for p in DEFAULT_PRODUCTS:
            p2 = dict(p, id=str(uuid.uuid4()), created_at=now_utc().isoformat())
            await db.products.insert_one(p2)

    if await db.part_prices.count_documents({}) == 0:
        for p in DEFAULT_PARTS:
            await db.part_prices.insert_one({**p, "id": str(uuid.uuid4()), "created_at": now_utc().isoformat()})

    if not await db.settings.find_one({"key": "rp_kulakan_per_galon"}):
        await db.settings.insert_one({"key": "rp_kulakan_per_galon", "value": 13000})

    # Seed default users ONLY once (protected by "initial_user_seed_done" flag).
    # Prevents auto-recreating a deleted user with the default password on restart.
    seed_done = await db.settings.find_one({"key": "initial_user_seed_done"})
    if not seed_done:
        for u in DEFAULT_USERS:
            if await db.users.find_one({"username": u["username"]}):
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
                "kelompok": u.get("kelompok"),
                "created_at": now_utc().isoformat(),
            }
            await db.users.insert_one(doc)
        await db.settings.insert_one({"key": "initial_user_seed_done", "value": True, "at": now_utc().isoformat()})


async def get_shifts() -> list[dict]:
    doc = await db.settings.find_one({"key": "shifts"}, {"_id": 0})
    if not doc or not doc.get("value"):
        return list(DEFAULT_SHIFTS)
    val = doc["value"]
    if isinstance(val, list) and val:
        return val
    return list(DEFAULT_SHIFTS)
