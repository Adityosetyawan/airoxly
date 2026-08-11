"""User management (Super Admin manages all; Admin only creates/manages Sales in own group)."""
from __future__ import annotations

import uuid
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException

from core.config import db
from core.security import get_current_user, hash_password, require_roles
from core.utils import now_utc, user_public
from models import Role, UserCreate, UserUpdate

router = APIRouter(prefix="/api/users", tags=["users"])


@router.get("")
async def list_users(
    role: Optional[Role] = None,
    group_letter: Optional[str] = None,
    user=Depends(get_current_user),
):
    q: dict = {}
    if user["role"] == "admin":
        q["role"] = "sales"
        q["group_letter"] = user.get("group_letter")
    elif user["role"] == "sales":
        raise HTTPException(403, "Forbidden")
    else:
        if role:
            q["role"] = role
        if group_letter:
            q["group_letter"] = group_letter
    users = await db.users.find(q, {"_id": 0, "password_hash": 0}).to_list(1000)
    return [user_public({**u, "password_hash": ""}) for u in users]


@router.post("")
async def create_user(body: UserCreate, user=Depends(get_current_user)):
    if user["role"] == "sales":
        raise HTTPException(403, "Forbidden")
    if user["role"] == "admin":
        if body.role != "sales":
            raise HTTPException(403, "Admin hanya bisa buat user Sales")
        if body.group_letter and body.group_letter != user.get("group_letter"):
            raise HTTPException(403, "Admin hanya bisa buat sales pada wilayahnya")
        body.group_letter = user.get("group_letter")
    if await db.users.find_one({"username": body.username}):
        raise HTTPException(409, "Username sudah dipakai")
    google_email = (body.google_email or "").strip().lower() or None
    if google_email and await db.users.find_one({"google_email": google_email}):
        raise HTTPException(409, "Email Google sudah dipakai user lain")
    doc = {
        "id": str(uuid.uuid4()),
        "username": body.username.strip(),
        "password_hash": hash_password(body.password),
        "role": body.role,
        "name": body.name,
        "group_letter": body.group_letter,
        "sales_code": body.sales_code,
        "wa_number": body.wa_number,
        "address": body.address,
        "year_joined": body.year_joined or datetime.now().year,
        "salary": body.salary or 0,
        "commission": body.commission or 0,
        "bonus": body.bonus or 0,
        "disabled": False,
        "kelompok": body.kelompok,
        "created_at": now_utc().isoformat(),
    }
    if google_email:
        doc["google_email"] = google_email
    await db.users.insert_one(doc)
    return user_public(doc)


@router.patch("/{user_id}")
async def update_user(user_id: str, body: UserUpdate, user=Depends(get_current_user)):
    target = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not target:
        raise HTTPException(404, "User tidak ditemukan")
    if user["role"] == "sales":
        raise HTTPException(403, "Forbidden")
    if user["role"] == "admin":
        if target["role"] != "sales" or target.get("group_letter") != user.get("group_letter"):
            raise HTTPException(403, "Forbidden")
        if body.role and body.role != "sales":
            raise HTTPException(403, "Admin tidak bisa mengubah role")
    update: dict = {}
    unset: dict = {}
    for k, v in body.dict(exclude_unset=True).items():
        if k == "password" and v:
            update["password_hash"] = hash_password(v)
        elif k == "google_email":
            v_norm = (v or "").strip().lower() or None
            if v_norm and v_norm != target.get("google_email"):
                exists = await db.users.find_one({"google_email": v_norm, "id": {"$ne": user_id}})
                if exists:
                    raise HTTPException(409, "Email Google sudah dipakai user lain")
            if v_norm:
                update["google_email"] = v_norm
            else:
                unset["google_email"] = ""
        elif k != "password" and v is not None:
            update[k] = v
    if update or unset:
        ops: dict = {}
        if update:
            ops["$set"] = update
        if unset:
            ops["$unset"] = unset
        await db.users.update_one({"id": user_id}, ops)
    updated = await db.users.find_one({"id": user_id}, {"_id": 0})
    return user_public(updated)


@router.delete("/{user_id}")
async def delete_user(user_id: str, user=Depends(require_roles("super_admin"))):
    if user["id"] == user_id:
        raise HTTPException(400, "Tidak bisa menghapus diri sendiri")
    await db.users.delete_one({"id": user_id})
    return {"ok": True}
