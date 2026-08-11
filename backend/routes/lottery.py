"""Lottery / Undian: periods CRUD + draw + tickets + stats + winners."""
from __future__ import annotations

import random
import uuid
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException

from core.config import db
from core.security import get_current_user, require_roles
from core.utils import now_utc, strip_id
from models import LotteryPeriodCreate, LotteryPeriodUpdate
from services.lottery_helpers import deactivate_all_periods

router = APIRouter(prefix="/api/lottery", tags=["lottery"])


@router.post("/periods")
async def create_lottery_period(body: LotteryPeriodCreate, user=Depends(require_roles("super_admin"))):
    if body.start_date > body.end_date:
        raise HTTPException(400, "Tanggal mulai harus sebelum tanggal selesai")
    if body.winner_count < 1:
        raise HTTPException(400, "Jumlah pemenang minimal 1")
    if body.is_active:
        await deactivate_all_periods()
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


@router.get("/periods")
async def list_lottery_periods(user=Depends(get_current_user)):
    items = await db.lottery_periods.find({}, {"_id": 0}).sort("created_at", -1).to_list(500)
    for it in items:
        it["ticket_count"] = await db.lottery_tickets.count_documents({"period_id": it["id"]})
    return items


@router.get("/periods/active")
async def get_active_period(user=Depends(get_current_user)):
    period = await db.lottery_periods.find_one({"is_active": True}, {"_id": 0})
    if not period:
        return None
    period["ticket_count"] = await db.lottery_tickets.count_documents({"period_id": period["id"]})
    return period


@router.patch("/periods/{pid}")
async def update_lottery_period(pid: str, body: LotteryPeriodUpdate, user=Depends(require_roles("super_admin"))):
    period = await db.lottery_periods.find_one({"id": pid})
    if not period:
        raise HTTPException(404, "Periode tidak ditemukan")
    if period.get("drawn_at"):
        raise HTTPException(400, "Periode sudah diundi, tidak bisa diubah")
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
        await deactivate_all_periods()
    await db.lottery_periods.update_one({"id": pid}, {"$set": update})
    doc = await db.lottery_periods.find_one({"id": pid}, {"_id": 0})
    doc["ticket_count"] = await db.lottery_tickets.count_documents({"period_id": pid})
    return doc


@router.post("/periods/{pid}/activate")
async def activate_period(pid: str, user=Depends(require_roles("super_admin"))):
    period = await db.lottery_periods.find_one({"id": pid})
    if not period:
        raise HTTPException(404, "Periode tidak ditemukan")
    if period.get("drawn_at"):
        raise HTTPException(400, "Periode sudah diundi")
    await deactivate_all_periods()
    await db.lottery_periods.update_one({"id": pid}, {"$set": {"is_active": True}})
    return await db.lottery_periods.find_one({"id": pid}, {"_id": 0})


@router.delete("/periods/{pid}")
async def delete_lottery_period(pid: str, user=Depends(require_roles("super_admin"))):
    period = await db.lottery_periods.find_one({"id": pid})
    if not period:
        raise HTTPException(404, "Periode tidak ditemukan")
    ticket_count = await db.lottery_tickets.count_documents({"period_id": pid})
    if ticket_count > 0:
        raise HTTPException(400, f"Tidak bisa hapus. Periode ini punya {ticket_count} tiket. Batalkan/undian dulu.")
    await db.lottery_periods.delete_one({"id": pid})
    return {"ok": True}


@router.post("/periods/{pid}/draw")
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


@router.get("/tickets")
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
    else:
        if sales_id:
            q["sales_id"] = sales_id
    if customer_id:
        q["customer_id"] = customer_id
    limit = max(1, min(int(limit), 5000))
    return await db.lottery_tickets.find(q, {"_id": 0}).sort("created_at", -1).limit(limit).to_list(limit)


@router.get("/stats")
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


@router.get("/winners")
async def list_all_winners(limit: int = 200, user=Depends(get_current_user)):
    q: dict = {"drawn_at": {"$ne": None}, "winners": {"$exists": True, "$not": {"$size": 0}}}
    periods = await db.lottery_periods.find(q, {"_id": 0}).sort("drawn_at", -1).limit(500).to_list(500)
    role = user["role"]
    group = user.get("group_letter")
    sales_id = user["id"] if role == "sales" else None
    out = []
    for p in periods:
        for w in p.get("winners", []):
            if role == "sales":
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
