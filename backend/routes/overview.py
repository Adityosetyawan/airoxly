"""Dashboard/overview statistics."""
from __future__ import annotations

from fastapi import APIRouter, Depends

from core.config import db
from core.security import get_current_user
from core.utils import now_utc

router = APIRouter(prefix="/api/stats", tags=["stats"])


@router.get("/overview")
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
