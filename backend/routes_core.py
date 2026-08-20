from fastapi import APIRouter, Depends, HTTPException
from datetime import datetime
import uuid

from db import db
from auth import (
    verify_password, create_access_token, get_current_user, require_roles, hash_password,
)
from models import LoginReq, UserCreate, ProductCreate, CustomerCreate

router = APIRouter(prefix="/api")


# ---------- AUTH ----------
@router.post("/auth/login")
async def login(body: LoginReq):
    user = await db.users.find_one({"username": {"$regex": f"^{body.username}$", "$options": "i"}})
    if not user or not verify_password(body.password, user["password"]):
        raise HTTPException(status_code=401, detail="Username atau password salah")
    token = create_access_token({"sub": user["id"], "role": user["role"]})
    user.pop("_id", None); user.pop("password", None)
    return {"access_token": token, "token_type": "bearer", "user": user}


@router.get("/auth/me")
async def me(user=Depends(get_current_user)):
    return user


@router.get("/auth/impersonate/{user_id}")
async def impersonate(user_id: str, _=Depends(require_roles("superadmin"))):
    target = await db.users.find_one({"id": user_id}, {"_id": 0, "password": 0})
    if not target:
        raise HTTPException(status_code=404, detail="User tidak ditemukan")
    token = create_access_token({"sub": target["id"], "role": target["role"]})
    return {"access_token": token, "token_type": "bearer", "user": target}


# ---------- USERS ----------
@router.get("/users")
async def list_users(_=Depends(require_roles("superadmin", "admin"))):
    return await db.users.find({}, {"_id": 0, "password": 0}).to_list(1000)


@router.post("/users")
async def create_user(body: UserCreate, _=Depends(require_roles("superadmin", "admin"))):
    exists = await db.users.find_one({"username": body.username})
    if exists:
        raise HTTPException(status_code=400, detail="Username sudah dipakai")
    doc = body.dict()
    doc["id"] = str(uuid.uuid4())
    doc["password"] = hash_password(doc.get("password") or "123456")
    await db.users.insert_one(doc)
    doc.pop("_id", None); doc.pop("password", None)
    return doc


# ---------- PRODUCTS ----------
@router.get("/products")
async def list_products(_=Depends(get_current_user)):
    return await db.products.find({}, {"_id": 0}).to_list(1000)


@router.post("/products")
async def create_product(body: ProductCreate, _=Depends(require_roles("superadmin", "admin"))):
    doc = body.dict()
    doc["id"] = str(uuid.uuid4())
    await db.products.insert_one(doc)
    doc.pop("_id", None)
    return doc


@router.put("/products/{pid}")
async def update_product(pid: str, body: ProductCreate, _=Depends(require_roles("superadmin", "admin"))):
    res = await db.products.update_one({"id": pid}, {"$set": body.dict()})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Produk tidak ditemukan")
    return await db.products.find_one({"id": pid}, {"_id": 0})


@router.delete("/products/{pid}")
async def delete_product(pid: str, _=Depends(require_roles("superadmin", "admin"))):
    await db.products.delete_one({"id": pid})
    return {"ok": True}


# ---------- CUSTOMERS ----------
@router.get("/customers")
async def list_customers(_=Depends(get_current_user)):
    return await db.customers.find({}, {"_id": 0}).to_list(2000)


@router.post("/customers")
async def create_customer(body: CustomerCreate, _=Depends(get_current_user)):
    count = await db.customers.count_documents({})
    doc = body.dict()
    doc["id"] = str(uuid.uuid4())
    doc["barcode"] = f"AOX-{str(count + 1).zfill(4)}"
    doc["galonPinjam"] = 0
    doc["lastBuy"] = datetime.utcnow().date().isoformat()
    await db.customers.insert_one(doc)
    doc.pop("_id", None)
    return doc
