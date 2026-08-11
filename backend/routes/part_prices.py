"""Part prices (dynamic list) + generic key/value settings."""
from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException

from core.config import db
from core.security import get_current_user, require_roles
from core.utils import now_utc, strip_id
from models import PartPriceUpdate, SettingUpdate

router = APIRouter(prefix="/api", tags=["part_prices", "settings"])


# ---------- PART PRICES (Red — Super Admin permanent) ----------
@router.get("/part-prices")
async def list_part_prices(user=Depends(get_current_user)):
    return await db.part_prices.find({}, {"_id": 0}).sort("order", 1).to_list(100)


@router.post("/part-prices")
async def create_part_price(body: PartPriceUpdate, user=Depends(require_roles("super_admin"))):
    if not body.name.strip():
        raise HTTPException(400, "Nama part wajib diisi")
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


@router.patch("/part-prices/{part_id}")
async def update_part_price(part_id: str, body: PartPriceUpdate, user=Depends(require_roles("super_admin"))):
    existing = await db.part_prices.find_one({"id": part_id}, {"_id": 0})
    if not existing:
        raise HTTPException(404, "Not found")
    order = int(body.order or 0) or int(existing.get("order", 0))
    await db.part_prices.update_one(
        {"id": part_id},
        {"$set": {"name": body.name, "rp_per_pcs": float(body.rp_per_pcs), "order": order}},
    )
    return await db.part_prices.find_one({"id": part_id}, {"_id": 0})


@router.delete("/part-prices/{part_id}")
async def delete_part_price(part_id: str, user=Depends(require_roles("super_admin"))):
    await db.part_prices.delete_one({"id": part_id})
    return {"ok": True}


# ---------- SETTINGS key/value ----------
@router.get("/settings/{key}")
async def get_setting(key: str, user=Depends(get_current_user)):
    s = await db.settings.find_one({"key": key}, {"_id": 0})
    if not s:
        return {"key": key, "value": None}
    return s


@router.put("/settings/{key}")
async def set_setting(key: str, body: SettingUpdate, user=Depends(require_roles("super_admin"))):
    await db.settings.update_one({"key": key}, {"$set": {"key": key, "value": body.value}}, upsert=True)
    return {"key": key, "value": body.value}
