"""Warehouse: daily, incoming, stock, discrepancy (merah/hijau)."""
from __future__ import annotations

import uuid
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException

from core.config import db
from core.security import require_roles
from core.utils import now_utc
from models import WarehouseDailyCreate, WarehouseDailyUpdate, WarehouseIncomingCreate
from services.discrepancy import compute_discrepancy_for_date
from services.stock import canonical_item, compute_stock

router = APIRouter(prefix="/api/warehouse", tags=["warehouse"])


# ---------- WAREHOUSE daily ----------
@router.post("/daily")
async def create_warehouse_daily(body: WarehouseDailyCreate, user=Depends(require_roles("gudang", "super_admin"))):
    sales = await db.users.find_one({"id": body.sales_id, "role": "sales"}, {"_id": 0})
    if not sales:
        raise HTTPException(404, "Sales not found")
    doc = body.dict()
    for pk in ("photo_isi_pagi", "photo_isi_siang", "photo_kosong_siang", "photo_kosong_sore"):
        if not doc.get(pk):
            doc.pop(pk, None)
    for k in ("kosong_kembali_siang", "kosong_kembali_sore"):
        if doc.get(k) is None:
            doc.pop(k, None)

    if doc.get("is_draft"):
        existing = await db.warehouse_daily.find_one(
            {"sales_id": body.sales_id, "date": body.date, "shift": body.shift, "is_draft": True},
            {"_id": 0},
        )
        if existing:
            update_fields = {k: v for k, v in doc.items() if v is not None}
            update_fields["updated_at"] = now_utc().isoformat()
            await db.warehouse_daily.update_one({"id": existing["id"]}, {"$set": update_fields})
            return await db.warehouse_daily.find_one({"id": existing["id"]}, {"_id": 0})

    doc.update({
        "id": str(uuid.uuid4()),
        "sales_code": sales.get("sales_code"),
        "group_letter": sales.get("group_letter"),
        "kelompok": user.get("kelompok"),
        "created_by": user["id"],
        "created_by_name": user.get("name") or user["username"],
        "created_at": now_utc().isoformat(),
    })
    await db.warehouse_daily.insert_one(doc)
    doc.pop("_id", None)
    return doc


@router.get("/daily/draft")
async def get_warehouse_draft(
    sales_id: str,
    date: str,
    shift: str,
    user=Depends(require_roles("gudang", "super_admin")),
):
    d = await db.warehouse_daily.find_one(
        {"sales_id": sales_id, "date": date, "shift": shift, "is_draft": True},
        {"_id": 0},
    )
    return d or {}


@router.get("/daily")
async def list_warehouse_daily(
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    sales_id: Optional[str] = None,
    kelompok: Optional[str] = None,
    user=Depends(require_roles("gudang", "produksi", "super_admin", "admin")),
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
    return await db.warehouse_daily.find(q, {"_id": 0}).sort("date", -1).to_list(1000)


@router.delete("/daily/{entry_id}")
async def delete_warehouse_daily(entry_id: str, user=Depends(require_roles("super_admin"))):
    res = await db.warehouse_daily.delete_one({"id": entry_id})
    if not res.deleted_count:
        raise HTTPException(404, "Not found")
    return {"ok": True}


@router.patch("/daily/{entry_id}")
async def update_warehouse_daily(entry_id: str, body: WarehouseDailyUpdate, user=Depends(require_roles("gudang", "super_admin"))):
    existing = await db.warehouse_daily.find_one({"id": entry_id}, {"_id": 0})
    if not existing:
        raise HTTPException(404, "Not found")
    if user["role"] == "gudang":
        edit_count = int(existing.get("edit_count", 0))
        if edit_count >= 1:
            raise HTTPException(403, "Entry sudah pernah di-edit. Hanya bisa 1x edit oleh Gudang.")
        if existing.get("created_by") != user["id"]:
            raise HTTPException(403, "Hanya bisa edit entry sendiri")
    updates = {k: v for k, v in body.dict().items() if v is not None}
    if not updates:
        return existing
    unset: dict = {}
    for pk in ("photo_isi_pagi", "photo_isi_siang", "photo_kosong_siang", "photo_kosong_sore"):
        if pk in updates and updates[pk] == "":
            unset[pk] = ""
            updates.pop(pk)
    if "sales_id" in updates and updates["sales_id"] != existing.get("sales_id"):
        sales = await db.users.find_one({"id": updates["sales_id"], "role": "sales"}, {"_id": 0})
        if not sales:
            raise HTTPException(404, "Sales not found")
        updates["sales_code"] = sales.get("sales_code")
        updates["group_letter"] = sales.get("group_letter")
    if user["role"] == "gudang":
        updates["edit_count"] = int(existing.get("edit_count", 0)) + 1
    updates["updated_at"] = now_utc().isoformat()
    updates["updated_by"] = user["id"]
    updates["updated_by_name"] = user.get("name") or user["username"]
    ops: dict = {"$set": updates}
    if unset:
        ops["$unset"] = unset
    await db.warehouse_daily.update_one({"id": entry_id}, ops)
    return await db.warehouse_daily.find_one({"id": entry_id}, {"_id": 0})


# ---------- WAREHOUSE incoming ----------
@router.post("/incoming")
async def create_warehouse_incoming(body: WarehouseIncomingCreate, user=Depends(require_roles("gudang", "super_admin"))):
    doc = body.dict()
    doc["item"] = canonical_item(doc.get("item") or "")
    doc.update({
        "id": str(uuid.uuid4()),
        "kelompok": user.get("kelompok"),
        "created_by": user["id"],
        "created_by_name": user.get("name") or user["username"],
        "created_at": now_utc().isoformat(),
    })
    await db.warehouse_incoming.insert_one(doc)
    doc.pop("_id", None)
    return doc


@router.get("/incoming")
async def list_warehouse_incoming(
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    item: Optional[str] = None,
    user=Depends(require_roles("gudang", "produksi", "super_admin", "admin")),
):
    q: dict = {}
    if date_from and date_to:
        q["date"] = {"$gte": date_from, "$lte": date_to}
    if item:
        q["item"] = item
    return await db.warehouse_incoming.find(q, {"_id": 0}).sort("date", -1).to_list(2000)


@router.delete("/incoming/{entry_id}")
async def delete_warehouse_incoming(entry_id: str, user=Depends(require_roles("super_admin"))):
    res = await db.warehouse_incoming.delete_one({"id": entry_id})
    if not res.deleted_count:
        raise HTTPException(404, "Not found")
    return {"ok": True}


# ---------- STOCK ----------
@router.get("/stock")
async def get_warehouse_stock(user=Depends(require_roles("gudang", "produksi", "super_admin", "admin"))):
    return await compute_stock()


# ---------- DISCREPANCY (merah/hijau) ----------
@router.get("/discrepancy")
async def get_discrepancy(
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    sales_id: Optional[str] = None,
    user=Depends(require_roles("super_admin", "admin", "gudang", "produksi")),
):
    wq: dict = {}
    if date_from and date_to:
        wq["date"] = {"$gte": date_from, "$lte": date_to}
    elif date_from:
        wq["date"] = {"$gte": date_from}
    elif date_to:
        wq["date"] = {"$lte": date_to}
    if sales_id:
        wq["sales_id"] = sales_id
    if user["role"] == "admin":
        wq["group_letter"] = user.get("group_letter")
    wh_rows = await db.warehouse_daily.find(wq, {"_id": 0}).to_list(5000)

    pairs = set()
    for r in wh_rows:
        if r.get("sales_id") and r.get("date"):
            pairs.add((r["sales_id"], r["date"]))

    entries: list[dict] = []
    sales_ids = {p[0] for p in pairs}
    users_map: dict[str, dict] = {}
    async for u in db.users.find({"id": {"$in": list(sales_ids)}}, {"_id": 0}):
        users_map[u["id"]] = u

    for sid, dt in sorted(pairs, key=lambda x: (x[1], x[0]), reverse=True):
        d = await compute_discrepancy_for_date(sid, dt)
        if d["merah"] == 0 and d["hijau"] == 0 and d["hijau_raw"] == 0:
            continue
        u = users_map.get(sid, {})
        d["sales_code"] = u.get("sales_code") or u.get("username", sid)
        d["sales_name"] = u.get("name")
        d["group_letter"] = u.get("group_letter")
        entries.append(d)

    summary_map: dict[str, dict] = {}
    for e in entries:
        s = summary_map.setdefault(e["sales_id"], {
            "sales_id": e["sales_id"],
            "sales_code": e["sales_code"],
            "sales_name": e["sales_name"],
            "group_letter": e["group_letter"],
            "total_merah": 0, "total_hijau": 0, "total_hijau_raw": 0,
            "days_merah": 0, "days_hijau": 0,
        })
        s["total_merah"] += e["merah"]
        s["total_hijau"] += e["hijau"]
        s["total_hijau_raw"] += e["hijau_raw"]
        if e["merah"] > 0:
            s["days_merah"] += 1
        if e["hijau"] > 0:
            s["days_hijau"] += 1
    summary = sorted(
        summary_map.values(),
        key=lambda x: (x["total_merah"], x["total_hijau"]),
        reverse=True,
    )
    return {"entries": entries, "summary": summary}


@router.post("/daily/{entry_id}/clear-hijau")
async def clear_hijau(entry_id: str, user=Depends(require_roles("admin", "super_admin"))):
    e = await db.warehouse_daily.find_one({"id": entry_id}, {"_id": 0})
    if not e:
        raise HTTPException(404, "Entry tidak ditemukan")
    if user["role"] == "admin" and e.get("group_letter") != user.get("group_letter"):
        raise HTTPException(403, "Bukan wilayah Anda")
    await db.warehouse_daily.update_many(
        {"sales_id": e.get("sales_id"), "date": e.get("date")},
        {"$set": {
            "hijau_cleared": True,
            "hijau_cleared_by": user["id"],
            "hijau_cleared_by_name": user.get("name") or user["username"],
            "hijau_cleared_at": now_utc().isoformat(),
        }},
    )
    return {"ok": True, "sales_id": e.get("sales_id"), "date": e.get("date")}


@router.post("/daily/{entry_id}/restore-hijau")
async def restore_hijau(entry_id: str, user=Depends(require_roles("admin", "super_admin"))):
    e = await db.warehouse_daily.find_one({"id": entry_id}, {"_id": 0})
    if not e:
        raise HTTPException(404, "Entry tidak ditemukan")
    if user["role"] == "admin" and e.get("group_letter") != user.get("group_letter"):
        raise HTTPException(403, "Bukan wilayah Anda")
    await db.warehouse_daily.update_many(
        {"sales_id": e.get("sales_id"), "date": e.get("date")},
        {"$unset": {"hijau_cleared": "", "hijau_cleared_by": "", "hijau_cleared_by_name": "", "hijau_cleared_at": ""}},
    )
    return {"ok": True}
