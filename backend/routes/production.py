"""Production daily inputs & draft upsert."""
from __future__ import annotations

import uuid
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException

from core.config import db
from core.security import require_roles
from core.utils import now_utc
from models import ProductionDailyCreate, ProductionDailyUpdate

router = APIRouter(prefix="/api/production", tags=["production"])


@router.post("/daily")
async def create_production_daily(body: ProductionDailyCreate, user=Depends(require_roles("produksi", "super_admin"))):
    sales = await db.users.find_one({"id": body.sales_id, "role": "sales"}, {"_id": 0})
    if not sales:
        raise HTTPException(404, "Sales not found")
    doc = body.dict()

    if doc.get("is_draft"):
        existing = await db.production_daily.find_one(
            {"sales_id": body.sales_id, "date": body.date, "shift": body.shift, "is_draft": True},
            {"_id": 0},
        )
        if existing:
            update_fields = {k: v for k, v in doc.items() if v is not None}
            update_fields["updated_at"] = now_utc().isoformat()
            await db.production_daily.update_one({"id": existing["id"]}, {"$set": update_fields})
            return await db.production_daily.find_one({"id": existing["id"]}, {"_id": 0})

    doc.update({
        "id": str(uuid.uuid4()),
        "sales_code": sales.get("sales_code"),
        "group_letter": sales.get("group_letter"),
        "kelompok": user.get("kelompok"),
        "created_by": user["id"],
        "created_by_name": user.get("name") or user["username"],
        "created_at": now_utc().isoformat(),
    })
    await db.production_daily.insert_one(doc)
    doc.pop("_id", None)
    return doc


@router.get("/daily/draft")
async def get_production_draft(
    sales_id: str,
    date: str,
    shift: str,
    user=Depends(require_roles("produksi", "super_admin")),
):
    """Get produksi draft (if any) for (sales, date, shift)."""
    d = await db.production_daily.find_one(
        {"sales_id": sales_id, "date": date, "shift": shift, "is_draft": True},
        {"_id": 0},
    )
    return d or {}


@router.get("/daily")
async def list_production_daily(
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    sales_id: Optional[str] = None,
    kelompok: Optional[str] = None,
    user=Depends(require_roles("produksi", "super_admin", "admin", "gudang")),
):
    q: dict = {}
    if date_from and date_to:
        q["date"] = {"$gte": date_from, "$lte": date_to}
    elif date_from:
        q["date"] = {"$gte": date_from}
    elif date_to:
        q["date"] = {"$lte": date_to}
    if sales_id:
        q["sales_id"] = sales_id
    if kelompok:
        q["kelompok"] = kelompok
    if user["role"] == "admin":
        q["group_letter"] = user.get("group_letter")
    return await db.production_daily.find(q, {"_id": 0}).sort("date", -1).to_list(1000)


@router.delete("/daily/{entry_id}")
async def delete_production_daily(entry_id: str, user=Depends(require_roles("super_admin"))):
    res = await db.production_daily.delete_one({"id": entry_id})
    if not res.deleted_count:
        raise HTTPException(404, "Not found")
    return {"ok": True}


@router.patch("/daily/{entry_id}")
async def update_production_daily(entry_id: str, body: ProductionDailyUpdate, user=Depends(require_roles("produksi", "super_admin"))):
    existing = await db.production_daily.find_one({"id": entry_id}, {"_id": 0})
    if not existing:
        raise HTTPException(404, "Not found")
    if user["role"] == "produksi":
        edit_count = int(existing.get("edit_count", 0))
        if edit_count >= 1:
            raise HTTPException(403, "Entry sudah pernah di-edit. Hanya bisa 1x edit oleh Produksi.")
        if existing.get("created_by") != user["id"]:
            raise HTTPException(403, "Hanya bisa edit entry sendiri")
    updates = {k: v for k, v in body.dict().items() if v is not None}
    if not updates:
        return existing
    if "sales_id" in updates and updates["sales_id"] != existing.get("sales_id"):
        sales = await db.users.find_one({"id": updates["sales_id"], "role": "sales"}, {"_id": 0})
        if not sales:
            raise HTTPException(404, "Sales not found")
        updates["sales_code"] = sales.get("sales_code")
        updates["group_letter"] = sales.get("group_letter")
    if user["role"] == "produksi":
        updates["edit_count"] = int(existing.get("edit_count", 0)) + 1
    updates["updated_at"] = now_utc().isoformat()
    updates["updated_by"] = user["id"]
    updates["updated_by_name"] = user.get("name") or user["username"]
    await db.production_daily.update_one({"id": entry_id}, {"$set": updates})
    return await db.production_daily.find_one({"id": entry_id}, {"_id": 0})


@router.get("/validate-sales/{sales_id}/{date}")
async def validate_sales_bawa_sisa(sales_id: str, date: str, user=Depends(require_roles("super_admin", "admin", "gudang", "produksi"))):
    """Compare (bawa-sisa) from warehouse_daily vs actual transactions for that sales on that date."""
    entries = await db.warehouse_daily.find({"sales_id": sales_id, "date": date}, {"_id": 0}).to_list(100)
    bawa_total = sum(int(e.get("bawa_pagi", 0) or 0) + int(e.get("bawa_siang", 0) or 0) for e in entries)
    sisa_total = sum(int(e.get("sisa_pagi", 0) or 0) + int(e.get("sisa_siang", 0) or 0) for e in entries)
    terjual_by_gudang = bawa_total - sisa_total

    from_dt = f"{date}T00:00:00"
    to_dt = f"{date}T23:59:59.999999"
    txns = await db.transactions.find({
        "sales_id": sales_id,
        "date": {"$gte": from_dt, "$lte": to_dt},
    }, {"_id": 0}).to_list(1000)
    galon_sold_txn = 0
    for t in txns:
        for item in t.get("items", []):
            unit = (item.get("unit") or "").lower()
            name = (item.get("product_name") or "").lower()
            if unit == "gln" and "kosong" not in name:
                galon_sold_txn += int(item.get("qty", 0) or 0)

    match = terjual_by_gudang == galon_sold_txn
    return {
        "sales_id": sales_id,
        "date": date,
        "bawa_total": bawa_total,
        "sisa_total": sisa_total,
        "terjual_by_gudang": terjual_by_gudang,
        "terjual_by_transaksi": galon_sold_txn,
        "match": match,
        "diff": galon_sold_txn - terjual_by_gudang,
    }
