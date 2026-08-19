"""Customer endpoints (scoped by sales; admins see own group; super admin sees all)."""
from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pymongo import ReturnDocument

from core.config import db
from core.security import get_current_user, require_roles
from core.utils import now_utc, strip_id
from models import CustomerCreate, CustomerUpdate

router = APIRouter(prefix="/api/customers", tags=["customers"])


async def next_customer_no_for(sales_id: str) -> int:
    """Get next customer_no for a sales — using a persistent counter that
    NEVER decrements (deleted numbers are never reused).

    - Migration: if `users.next_customer_no` doesn't exist yet, initialize it
      from `max(customer_no) + 1` of existing customers for that sales.
    - On subsequent calls, atomically increment the counter with $inc.
    """
    u = await db.users.find_one({"id": sales_id}, {"_id": 0, "id": 1, "next_customer_no": 1})
    if u is None:
        return 1
    counter = u.get("next_customer_no")
    if counter is None:
        # Lazy migration: initialize from existing customers
        last = await db.customers.find(
            {"created_by": sales_id},
            {"_id": 0, "customer_no": 1},
        ).sort("customer_no", -1).limit(1).to_list(1)
        initial = (int(last[0].get("customer_no", 0)) + 1) if last else 1
        await db.users.update_one(
            {"id": sales_id},
            {"$set": {"next_customer_no": initial}},
        )
    # Atomically consume this number and bump the counter for next time.
    # `ReturnDocument.BEFORE` returns the doc PRE-update — the value we hand out.
    result = await db.users.find_one_and_update(
        {"id": sales_id},
        {"$inc": {"next_customer_no": 1}},
        projection={"_id": 0, "next_customer_no": 1},
        return_document=ReturnDocument.BEFORE,
    )
    if not result or result.get("next_customer_no") is None:
        return 1
    return int(result["next_customer_no"])


@router.get("")
async def list_customers(
    sort: str = Query("no", pattern="^(no|ranking|last|recent|loans|debt)$"),
    q: Optional[str] = None,
    sales_id: Optional[str] = None,
    user=Depends(get_current_user),
):
    filt: dict = {}
    if user["role"] == "sales":
        filt["created_by"] = user["id"]
    elif user["role"] == "admin":
        filt["group_letter"] = user.get("group_letter")
        if sales_id:
            filt["created_by"] = sales_id
    else:
        if sales_id:
            filt["created_by"] = sales_id
    if q:
        filt["$or"] = [
            {"name": {"$regex": q, "$options": "i"}},
            {"barcode_id": {"$regex": q, "$options": "i"}},
        ]

    direct_sort_map = {
        "no": [("customer_no", 1)],
        "ranking": [("total_purchases", -1), ("purchase_count", -1)],
        "loans": [("gallon_loans", -1), ("total_debt", -1)],
        "debt": [("total_debt", -1)],
        "recent": [("last_purchase_date", -1)],
    }
    # Lazy-loading: never ship the base64 `photo_rumah` in list responses.
    # Client fetches full doc via GET /customers/{id} when opening detail.
    # We surface `has_photo` so the list UI can show a photo indicator.
    list_projection = {"_id": 0, "photo_rumah": 0}

    def _decorate(items: list[dict], raw_photos: dict[str, bool]) -> list[dict]:
        for it in items:
            it["has_photo"] = raw_photos.get(it.get("id") or "", False)
        return items

    async def _has_photo_map() -> dict[str, bool]:
        # Only pull the id + short photo flag, not the full base64 payload.
        # Mongo can't tell "field exists AND non-empty" cheaply without $expr,
        # so we project the first byte via $substrCP.
        cursor = db.customers.aggregate([
            {"$match": filt},
            {"$project": {
                "_id": 0,
                "id": 1,
                "has_photo": {
                    "$cond": [
                        {"$and": [
                            {"$ifNull": ["$photo_rumah", False]},
                            {"$gt": [{"$strLenCP": {"$ifNull": ["$photo_rumah", ""]}}, 10]},
                        ]},
                        True,
                        False,
                    ],
                },
            }},
        ])
        return {d["id"]: bool(d.get("has_photo")) async for d in cursor}

    if sort in direct_sort_map:
        cursor = db.customers.find(filt, list_projection).sort(direct_sort_map[sort])
        items = await cursor.to_list(2000)
        photos = await _has_photo_map()
        items = _decorate(items, photos)
        if sort == "recent":
            has_date = [c for c in items if c.get("last_purchase_date")]
            no_date = [c for c in items if not c.get("last_purchase_date")]
            no_date.sort(key=lambda c: c.get("customer_no", 0))
            items = has_date + no_date
        return items

    cursor = db.customers.find(filt, list_projection)
    items = await cursor.to_list(2000)
    photos = await _has_photo_map()
    items = _decorate(items, photos)
    if sort == "last":
        has_date = [c for c in items if c.get("last_purchase_date")]
        no_date = [c for c in items if not c.get("last_purchase_date")]
        has_date.sort(key=lambda c: c.get("last_purchase_date") or "")
        no_date.sort(key=lambda c: c.get("customer_no", 0))
        items = has_date + no_date
    return items


@router.get("/reminders")
async def customer_reminders(
    debt_days: int = Query(14, ge=1, le=365),
    inactive_weeks: int = Query(4, ge=1, le=52),
    sales_id: Optional[str] = None,
    user=Depends(get_current_user),
):
    """Return customers that need Sales attention:
      • debt_overdue: piutang berumur > `debt_days` hari.
      • inactive:    tidak beli > `inactive_weeks` minggu.

    Sales sees own; Admin sees own group; Super Admin sees all (optionally
    filterable by `sales_id`). `debt_since` (transaction.py side-effect) is
    used first; falls back to `last_purchase_date` for pre-existing debts.
    """
    filt: dict = {}
    if user["role"] == "sales":
        filt["created_by"] = user["id"]
    elif user["role"] == "admin":
        filt["group_letter"] = user.get("group_letter")
        if sales_id:
            filt["created_by"] = sales_id
    else:
        if sales_id:
            filt["created_by"] = sales_id

    now = now_utc()
    debt_cutoff_date = (now - timedelta(days=debt_days)).strftime("%Y-%m-%d")
    inactive_cutoff = now - timedelta(weeks=inactive_weeks)
    inactive_cutoff_iso = inactive_cutoff.isoformat()
    today_str = now.strftime("%Y-%m-%d")

    cursor = db.customers.find(filt, {"_id": 0, "photo_rumah": 0})
    docs = await cursor.to_list(5000)

    debt_overdue = []
    inactive = []
    for c in docs:
        total_debt = float(c.get("total_debt") or 0)
        last_pd = c.get("last_purchase_date")
        # Debt overdue calculation
        if total_debt > 0:
            debt_since = c.get("debt_since")
            if not debt_since and last_pd:
                # Legacy row without `debt_since`; fall back to last purchase.
                try:
                    debt_since = (last_pd or "")[:10]
                except Exception:
                    debt_since = None
            if debt_since:
                try:
                    d0 = datetime.strptime(debt_since, "%Y-%m-%d").replace(tzinfo=timezone.utc)
                    days = (now - d0).days
                except Exception:
                    days = 0
                if debt_since <= debt_cutoff_date:
                    debt_overdue.append({**c, "debt_days": max(days, 0), "debt_since": debt_since})

        # Inactivity — customers that HAVE purchased at least once but not
        # recently. Never-purchased customers are excluded (they're the "new"
        # customer follow-up flow, not this one).
        if last_pd:
            try:
                pd = datetime.fromisoformat(last_pd.replace("Z", "+00:00")) if isinstance(last_pd, str) else None
            except Exception:
                pd = None
            if pd:
                if pd.tzinfo is None:
                    pd = pd.replace(tzinfo=timezone.utc)
                if pd < inactive_cutoff:
                    days_inactive = (now - pd).days
                    inactive.append({**c, "days_inactive": max(days_inactive, 0)})

    debt_overdue.sort(key=lambda c: c.get("debt_days") or 0, reverse=True)
    inactive.sort(key=lambda c: c.get("days_inactive") or 0, reverse=True)

    return {
        "debt_overdue": debt_overdue,
        "inactive": inactive,
        "debt_days": debt_days,
        "inactive_weeks": inactive_weeks,
        "today": today_str,
    }


@router.get("/lookup/{barcode_id}")
async def lookup_customer(barcode_id: str, user=Depends(get_current_user)):
    c = await db.customers.find_one({"barcode_id": barcode_id}, {"_id": 0})
    if not c:
        raise HTTPException(404, "Pelanggan tidak ditemukan")
    if user["role"] == "sales" and c.get("created_by") != user["id"]:
        raise HTTPException(403, "Bukan pelanggan Anda")
    if user["role"] == "admin" and c.get("group_letter") != user.get("group_letter"):
        raise HTTPException(403, "Bukan pelanggan wilayah Anda")
    return c


@router.get("/{customer_id}")
async def get_customer(customer_id: str, user=Depends(get_current_user)):
    c = await db.customers.find_one({"id": customer_id}, {"_id": 0})
    if not c:
        raise HTTPException(404, "Not found")
    if user["role"] == "sales" and c.get("created_by") != user["id"]:
        raise HTTPException(403, "Forbidden")
    if user["role"] == "admin" and c.get("group_letter") != user.get("group_letter"):
        raise HTTPException(403, "Forbidden")
    return c


@router.post("")
async def create_customer(body: CustomerCreate, user=Depends(require_roles("sales", "super_admin"))):
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
    if body.photo_rumah:
        doc["photo_rumah"] = body.photo_rumah
    await db.customers.insert_one(doc)
    return strip_id(doc)


@router.patch("/{customer_id}")
async def update_customer(customer_id: str, body: CustomerUpdate, user=Depends(get_current_user)):
    c = await db.customers.find_one({"id": customer_id})
    if not c:
        raise HTTPException(404, "Not found")
    if user["role"] == "sales" and c.get("created_by") != user["id"]:
        raise HTTPException(403, "Forbidden")
    if user["role"] == "admin" and c.get("group_letter") != user.get("group_letter"):
        raise HTTPException(403, "Forbidden")
    update_raw = body.dict(exclude_unset=True)
    update: dict = {}
    unset: dict = {}
    for k, v in update_raw.items():
        if v is None:
            continue
        if k == "photo_rumah" and v == "":
            unset["photo_rumah"] = ""
        else:
            update[k] = v
    ops: dict = {}
    if update:
        ops["$set"] = update
    if unset:
        ops["$unset"] = unset
    if ops:
        await db.customers.update_one({"id": customer_id}, ops)
    return await db.customers.find_one({"id": customer_id}, {"_id": 0})


@router.delete("/{customer_id}")
async def delete_customer(customer_id: str, user=Depends(get_current_user)):
    """Delete a customer.

    Permissions:
      - super_admin: any customer
      - admin: only customers within their group_letter
      - sales: only customers they created themselves

    Business rule (enforced for all roles):
      - Customer with outstanding debt (`total_debt > 0`) can NOT be deleted.
      - Customer with outstanding gallon loans (`gallon_loans > 0`) can NOT
        be deleted.
      This prevents accidental data loss for pelanggan yang masih punya
      kewajiban.

    Note: `customer_no` is NEVER reused after deletion (persistent counter
    on `users.next_customer_no`).
    """
    c = await db.customers.find_one({"id": customer_id}, {"_id": 0})
    if not c:
        raise HTTPException(404, "Pelanggan tidak ditemukan")
    if user["role"] == "sales":
        if c.get("created_by") != user["id"]:
            raise HTTPException(403, "Hanya bisa hapus pelanggan sendiri")
    elif user["role"] == "admin":
        if c.get("group_letter") != user.get("group_letter"):
            raise HTTPException(403, "Bukan pelanggan wilayah Anda")
    elif user["role"] not in ("super_admin",):
        raise HTTPException(403, "Forbidden")

    debt = float(c.get("total_debt") or 0)
    loans = int(c.get("gallon_loans") or 0)
    if debt > 0 or loans > 0:
        parts = []
        if debt > 0:
            parts.append(f"hutang Rp {debt:,.0f}".replace(",", "."))
        if loans > 0:
            parts.append(f"pinjam {loans} galon")
        raise HTTPException(
            400,
            f"Tidak bisa hapus: pelanggan masih memiliki " + " & ".join(parts) +
            ". Selesaikan pelunasan / pengembalian galon terlebih dahulu.",
        )

    await db.customers.delete_one({"id": customer_id})
    return {"ok": True, "deleted_id": customer_id, "customer_no": c.get("customer_no")}
