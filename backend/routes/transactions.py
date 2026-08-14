"""Sales transactions (CRUD + auto-lottery ticket generation)."""
from __future__ import annotations

import uuid
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException

from core.config import db
from core.security import get_current_user, require_roles
from core.utils import now_utc, strip_id
from models import TransactionCreate, TransactionEdit, TransactionItem
from services.lottery_helpers import gen_unique_ticket_code

router = APIRouter(prefix="/api/transactions", tags=["transactions"])


def _txn_totals(items: List[TransactionItem]) -> float:
    return sum(i.subtotal for i in items)


@router.post("")
async def create_transaction(body: TransactionCreate, user=Depends(require_roles("sales", "super_admin"))):
    customer = await db.customers.find_one({"id": body.customer_id})
    if not customer:
        raise HTTPException(404, "Pelanggan tidak ditemukan")
    if user["role"] == "sales" and customer.get("created_by") != user["id"]:
        raise HTTPException(403, "Bukan pelanggan Anda")

    total = _txn_totals(body.items)
    prev_debt = float(customer.get("total_debt", 0))
    sisa_bayar = body.bayar - total
    if sisa_bayar >= 0:
        new_debt = max(0.0, prev_debt - sisa_bayar)
        hutang_transaksi = 0.0
    else:
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
    galon_qty = sum(
        int(it.qty) for it in body.items
        if it.unit == "gln" and "Kosong" not in (it.product_name or "")
    )
    if galon_qty > 0:
        period = await db.lottery_periods.find_one({"is_active": True})
        if period and period.get("start_date", "") <= txn["date_only"] <= period.get("end_date", "9999-12-31") and not period.get("drawn_at"):
            tickets_docs = []
            for _ in range(galon_qty):
                code = await gen_unique_ticket_code()
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
    # Track `debt_since` on the customer:
    #   • if debt just came into existence (prev == 0 → new > 0), stamp today.
    #   • if the customer just paid off everything (new == 0), clear the stamp.
    #   • otherwise leave the existing value alone.
    debt_update: dict = {}
    if prev_debt <= 0 and new_debt > 0:
        debt_update["$set"] = {"debt_since": txn["date_only"]}
    elif new_debt <= 0:
        debt_update["$unset"] = {"debt_since": ""}
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
    if debt_update:
        await db.customers.update_one({"id": body.customer_id}, debt_update)
    return strip_id(txn)


@router.get("")
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
    return await db.transactions.find(q, {"_id": 0}).sort("date", -1).to_list(5000)


@router.get("/{txn_id}")
async def get_txn(txn_id: str, user=Depends(get_current_user)):
    t = await db.transactions.find_one({"id": txn_id}, {"_id": 0})
    if not t:
        raise HTTPException(404, "Not found")
    return t


@router.patch("/{txn_id}")
async def edit_transaction(txn_id: str, body: TransactionEdit, user=Depends(get_current_user)):
    t = await db.transactions.find_one({"id": txn_id})
    if not t:
        raise HTTPException(404, "Not found")
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

    prev_total = float(t.get("total", 0))
    prev_debt_added = float(t.get("hutang_transaksi", 0))
    prev_loans_delta = int(t.get("pinjam_galon", 0)) - int(t.get("galon_kembali", 0))

    items = body.items if body.items is not None else [TransactionItem(**it) for it in t["items"]]
    bayar = body.bayar if body.bayar is not None else t["bayar"]
    pinjam = body.pinjam_galon if body.pinjam_galon is not None else t["pinjam_galon"]
    kembali = body.galon_kembali if body.galon_kembali is not None else t.get("galon_kembali", 0)

    new_total = _txn_totals(items) if isinstance(items[0], TransactionItem) else sum(i["subtotal"] for i in items)
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
    delta_purchases = new_total - prev_total
    await db.customers.update_one(
        {"id": t["customer_id"]},
        {
            "$set": {"total_debt": new_debt, "gallon_loans": new_loans},
            "$inc": {"total_purchases": delta_purchases},
        },
    )
    # Keep `debt_since` in sync with the recomputed debt state.
    if new_debt <= 0:
        await db.customers.update_one({"id": t["customer_id"]}, {"$unset": {"debt_since": ""}})
    elif not customer.get("debt_since"):
        await db.customers.update_one(
            {"id": t["customer_id"]},
            {"$set": {"debt_since": t.get("date_only") or now_utc().strftime("%Y-%m-%d")}},
        )
    return await db.transactions.find_one({"id": txn_id}, {"_id": 0})


@router.delete("/{txn_id}")
async def delete_txn(txn_id: str, user=Depends(require_roles("super_admin"))):
    t = await db.transactions.find_one({"id": txn_id})
    if not t:
        return {"ok": True}
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
    await db.lottery_tickets.delete_many({"transaction_id": txn_id})
    return {"ok": True}
