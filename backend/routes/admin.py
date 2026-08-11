"""DANGEROUS data reset endpoints (Super Admin only)."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException

from core.config import db
from core.security import require_roles
from models import ResetRequest

router = APIRouter(prefix="/api/admin", tags=["admin"])


@router.post("/reset-sales-data")
async def reset_sales_data(body: ResetRequest, user=Depends(require_roles("super_admin"))):
    """Wipe operational sales data. Keeps users/products/customers/settings/parts/lottery periods."""
    if (body.confirm or "").strip().upper() != "RESET PENJUALAN":
        raise HTTPException(400, "Konfirmasi tidak cocok. Ketik: RESET PENJUALAN")
    result = {}
    for coll in (
        "transactions", "expenses", "monthly_reports", "locations",
        "lottery_tickets", "lottery_winners",
        "production_daily", "warehouse_daily", "warehouse_incoming",
    ):
        r = await db[coll].delete_many({})
        result[coll] = r.deleted_count
    upd = await db.customers.update_many(
        {},
        {"$set": {
            "gallon_loans": 0,
            "total_debt": 0,
            "total_purchases": 0,
            "purchase_count": 0,
            "last_purchase_date": None,
        }},
    )
    result["customers_reset"] = upd.modified_count
    await db.users.update_many({}, {"$unset": {"last_location": ""}})
    return {"ok": True, "reset": result}


@router.post("/reset-all-data")
async def reset_all_data(body: ResetRequest, user=Depends(require_roles("super_admin"))):
    """Total wipe including customers."""
    if (body.confirm or "").strip().upper() != "RESET SEMUA":
        raise HTTPException(400, "Konfirmasi tidak cocok. Ketik: RESET SEMUA")
    result = {}
    for coll in (
        "transactions", "expenses", "monthly_reports", "locations",
        "lottery_tickets", "lottery_winners",
        "production_daily", "warehouse_daily", "warehouse_incoming",
        "customers",
    ):
        r = await db[coll].delete_many({})
        result[coll] = r.deleted_count
    await db.users.update_many({}, {"$unset": {"last_location": ""}})
    return {"ok": True, "reset": result}
