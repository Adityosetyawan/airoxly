"""Sales expenses (Pengeluaran Sales)."""
from __future__ import annotations

import uuid
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException

from core.config import db
from core.security import get_current_user, require_roles
from core.utils import now_utc, strip_id
from models import ExpenseCreate, ExpenseUpdate

router = APIRouter(prefix="/api/expenses", tags=["expenses"])


@router.post("")
async def create_expense(body: ExpenseCreate, user=Depends(require_roles("sales", "super_admin"))):
    if body.amount <= 0:
        raise HTTPException(400, "Jumlah pengeluaran harus > 0")
    date_iso = (body.date or now_utc().isoformat())
    date_only = date_iso[:10]
    doc = {
        "id": str(uuid.uuid4()),
        "sales_id": user["id"],
        "sales_code": user.get("sales_code") or user.get("username"),
        "group_letter": user.get("group_letter"),
        "category": body.category.strip() or "Lain-lain",
        "description": (body.description or "").strip(),
        "amount": float(body.amount),
        "date": date_iso,
        "date_only": date_only,
        "created_at": now_utc().isoformat(),
        "edit_count": 0,
    }
    if body.photo_base64:
        doc["photo_base64"] = body.photo_base64
    await db.expenses.insert_one(doc)
    return strip_id(doc)


@router.patch("/{expense_id}")
async def update_expense(expense_id: str, body: ExpenseUpdate, user=Depends(get_current_user)):
    e = await db.expenses.find_one({"id": expense_id})
    if not e:
        raise HTTPException(404, "Pengeluaran tidak ditemukan")
    is_super = user["role"] == "super_admin"
    if user["role"] == "sales":
        if e.get("sales_id") != user["id"]:
            raise HTTPException(403, "Bukan pengeluaran Anda")
    elif user["role"] == "admin":
        raise HTTPException(403, "Admin tidak bisa mengubah pengeluaran")
    elif not is_super:
        raise HTTPException(403, "Forbidden")
    update: dict = {}
    unset: dict = {}
    if body.category is not None:
        update["category"] = body.category.strip() or "Lain-lain"
    if body.description is not None:
        update["description"] = body.description.strip()
    if body.amount is not None:
        if body.amount <= 0:
            raise HTTPException(400, "Jumlah pengeluaran harus > 0")
        update["amount"] = float(body.amount)
    if body.photo_base64 is not None:
        if body.photo_base64 == "":
            unset["photo_base64"] = ""
        else:
            update["photo_base64"] = body.photo_base64
    if update or unset:
        update["edit_count"] = int(e.get("edit_count") or 0) + 1
        update["updated_at"] = now_utc().isoformat()
        ops: dict = {"$set": update}
        if unset:
            ops["$unset"] = unset
        await db.expenses.update_one({"id": expense_id}, ops)
    return await db.expenses.find_one({"id": expense_id}, {"_id": 0})


@router.get("")
async def list_expenses(
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    sales_id: Optional[str] = None,
    sales_code: Optional[str] = None,
    user=Depends(get_current_user),
):
    q: dict = {}
    if user["role"] == "sales":
        q["sales_id"] = user["id"]
    elif user["role"] == "admin":
        q["group_letter"] = user.get("group_letter")
    if sales_id:
        q["sales_id"] = sales_id
    if sales_code:
        q["sales_code"] = sales_code
    if date_from or date_to:
        dq: dict = {}
        if date_from:
            dq["$gte"] = date_from
        if date_to:
            dq["$lte"] = date_to
        q["date_only"] = dq
    return await db.expenses.find(q, {"_id": 0}).sort("date", -1).to_list(2000)


@router.delete("/{expense_id}")
async def delete_expense(expense_id: str, user=Depends(get_current_user)):
    e = await db.expenses.find_one({"id": expense_id})
    if not e:
        raise HTTPException(404, "Not found")
    if user["role"] == "sales" and e.get("sales_id") != user["id"]:
        raise HTTPException(403, "Bukan pengeluaran Anda")
    if user["role"] == "admin":
        raise HTTPException(403, "Admin tidak bisa hapus pengeluaran")
    await db.expenses.delete_one({"id": expense_id})
    return {"ok": True}
