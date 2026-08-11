"""Shifts settings (dynamic Super Admin CRUD)."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException

from core.config import db
from core.security import get_current_user, require_roles
from core.utils import now_utc
from models import ShiftsPayload
from services.seed import get_shifts

router = APIRouter(prefix="/api/shifts", tags=["shifts"])


@router.get("")
async def get_shifts_list(user=Depends(get_current_user)):
    """All roles can read the shifts list."""
    return {"shifts": await get_shifts()}


@router.put("")
async def set_shifts_list(body: ShiftsPayload, user=Depends(require_roles("super_admin"))):
    if not body.shifts:
        raise HTTPException(400, "Minimal 1 shift")
    seen = set()
    payload: list[dict] = []
    for i, s in enumerate(body.shifts, start=1):
        k = (s.key or "").strip().lower()
        if not k or not all(c.isalnum() or c == "_" for c in k):
            raise HTTPException(400, f"Key shift '{s.key}' harus alfanumerik (a-z0-9_)")
        if k in seen:
            raise HTTPException(400, f"Key '{k}' duplikat")
        seen.add(k)
        payload.append({"key": k, "label": s.label.strip() or k.title(), "order": s.order or i})
    payload.sort(key=lambda x: x["order"])
    await db.settings.update_one(
        {"key": "shifts"},
        {"$set": {"value": payload, "updated_at": now_utc().isoformat(), "updated_by": user["id"]}},
        upsert=True,
    )
    return {"ok": True, "shifts": payload}
