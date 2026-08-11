"""Products CRUD — Super Admin manages, others read only."""
from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends

from core.config import db
from core.security import get_current_user, require_roles
from core.utils import now_utc, strip_id
from models import ProductCreate, ProductUpdate

router = APIRouter(prefix="/api/products", tags=["products"])


@router.get("")
async def list_products(user=Depends(get_current_user)):
    return await db.products.find({}, {"_id": 0}).sort("order", 1).to_list(1000)


@router.post("")
async def create_product(body: ProductCreate, user=Depends(require_roles("super_admin"))):
    doc = {"id": str(uuid.uuid4()), **body.dict(), "created_at": now_utc().isoformat()}
    await db.products.insert_one(doc)
    return strip_id(doc)


@router.patch("/{product_id}")
async def update_product(product_id: str, body: ProductUpdate, user=Depends(require_roles("super_admin"))):
    update = {k: v for k, v in body.dict(exclude_unset=True).items() if v is not None}
    if update:
        await db.products.update_one({"id": product_id}, {"$set": update})
    return await db.products.find_one({"id": product_id}, {"_id": 0})


@router.delete("/{product_id}")
async def delete_product(product_id: str, user=Depends(require_roles("super_admin"))):
    await db.products.delete_one({"id": product_id})
    return {"ok": True}
