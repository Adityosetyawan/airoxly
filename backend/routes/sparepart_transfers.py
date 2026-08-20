"""Sparepart transfers: Gudang → Produksi.

Business rules:
  • Gudang mengirim sparepart ke Produksi → mengurangi stok Gudang & menambah stok Produksi.
  • Produksi memakai sparepart (via production_daily.part_qtys) → mengurangi stok Produksi
    (tapi TETAP dicatat sebagai penggantian sparepart per sales — logika existing).
  • Gudang bisa lihat stok Produksi (transparansi).

Endpoints:
  • POST /api/warehouse/transfer          (Gudang / Super Admin)
  • GET  /api/warehouse/transfers         (Gudang / Produksi / Super Admin / Admin)
  • DELETE /api/warehouse/transfer/{id}   (Super Admin)
  • GET  /api/warehouse/stock-split       (semua role terkait) → {gudang: {}, produksi: {}}
"""
from __future__ import annotations

import uuid
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from core.config import db
from core.security import require_roles
from core.utils import now_utc
from services.stock import compute_stock_split

router = APIRouter(prefix="/api/warehouse", tags=["warehouse"])


class SparepartTransferCreate(BaseModel):
    date: str  # YYYY-MM-DD
    part_name: str
    qty: int
    notes: Optional[str] = None


@router.post("/transfer")
async def create_transfer(
    body: SparepartTransferCreate,
    user=Depends(require_roles("gudang", "super_admin")),
):
    if body.qty <= 0:
        raise HTTPException(400, "Qty harus > 0")
    part = await db.part_prices.find_one({"name": body.part_name}, {"_id": 0, "name": 1})
    if not part:
        raise HTTPException(404, f"Part '{body.part_name}' tidak ada di daftar Part Prices")

    # Cek stok Gudang cukup
    split = await compute_stock_split()
    gudang_stok = int(split.get("gudang", {}).get(body.part_name, 0) or 0)
    if body.qty > gudang_stok:
        raise HTTPException(
            400,
            f"Stok Gudang untuk '{body.part_name}' hanya {gudang_stok}, tidak cukup untuk kirim {body.qty}",
        )

    doc = {
        "id": str(uuid.uuid4()),
        "date": body.date,
        "part_name": body.part_name,
        "qty": int(body.qty),
        "notes": body.notes or "",
        "from_location": "gudang",
        "to_location": "produksi",
        "created_by": user["id"],
        "created_by_name": user.get("name") or user["username"],
        "created_at": now_utc().isoformat(),
    }
    await db.sparepart_transfers.insert_one(doc)
    doc.pop("_id", None)
    return doc


@router.get("/transfers")
async def list_transfers(
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    part_name: Optional[str] = None,
    user=Depends(require_roles("gudang", "produksi", "super_admin", "admin")),
):
    q: dict = {}
    if date_from and date_to:
        q["date"] = {"$gte": date_from, "$lte": date_to}
    elif date_from:
        q["date"] = {"$gte": date_from}
    elif date_to:
        q["date"] = {"$lte": date_to}
    if part_name:
        q["part_name"] = part_name
    return await db.sparepart_transfers.find(q, {"_id": 0}).sort("date", -1).to_list(2000)


@router.delete("/transfer/{transfer_id}")
async def delete_transfer(transfer_id: str, user=Depends(require_roles("super_admin"))):
    res = await db.sparepart_transfers.delete_one({"id": transfer_id})
    if not res.deleted_count:
        raise HTTPException(404, "Not found")
    return {"ok": True}


@router.get("/stock-split")
async def get_stock_split(user=Depends(require_roles("gudang", "produksi", "super_admin", "admin"))):
    """Return {gudang: {part_name: qty}, produksi: {part_name: qty}, combined: {...}}"""
    return await compute_stock_split()
