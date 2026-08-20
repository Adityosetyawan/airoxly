"""Generic Inventory System — Bahan (Materials) & Barang Jadi (Finished Goods).

Kategori:
  • bahan          → Cup Kosong, Kardus, Sedotan, Lid, Lakban, dll
  • barang_jadi    → Cup 150ml isi, Cup 240ml, Botol, dll (yg akhirnya dijual)

Alur:
  Bahan:
    warehouse_incoming for material (Gudang input barang masuk)
    → bahan_transfers  (Gudang → Produksi)
    → bahan_usage      (opsional; Produksi konsumsi — MVP: tidak dilacak)
    Stock Gudang    = incoming - transfers
    Stock Produksi  = transfers

  Barang Jadi:
    finished_production   (Produksi cetak barang)
    → finished_transfers  (Produksi → Gudang)
    → sales transaction items (auto-catat pengurangan Gudang saat sales jual)
    Stock Produksi  = produced - transfers_out
    Stock Gudang    = transfers_in - sales_out
"""
from __future__ import annotations

import uuid
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from core.config import db
from core.security import get_current_user, require_roles
from core.utils import now_utc

router = APIRouter(prefix="/api/inventory", tags=["inventory"])


# ═══════════════════════════════════════════════════════════════════════════
# ITEMS CRUD (Superadmin only) — inventory_items
# ═══════════════════════════════════════════════════════════════════════════

class InventoryItemBody(BaseModel):
    name: str
    category: str  # "bahan" | "barang_jadi"
    unit: str = "pcs"
    order: int = 0


@router.get("/items")
async def list_items(
    category: Optional[str] = None,
    user=Depends(get_current_user),
):
    q: dict = {}
    if category:
        q["category"] = category
    items = await db.inventory_items.find(q, {"_id": 0}).to_list(500)
    items.sort(key=lambda x: (x.get("category", ""), x.get("order", 0), x.get("name", "")))
    return items


@router.post("/items")
async def create_item(body: InventoryItemBody, user=Depends(require_roles("super_admin"))):
    if body.category not in ("bahan", "barang_jadi"):
        raise HTTPException(400, "category harus 'bahan' atau 'barang_jadi'")
    name = body.name.strip()
    if not name:
        raise HTTPException(400, "Nama tidak boleh kosong")
    exists = await db.inventory_items.find_one({"name": name, "category": body.category})
    if exists:
        raise HTTPException(400, f"Item '{name}' sudah ada di kategori {body.category}")
    doc = {
        "id": str(uuid.uuid4()),
        "name": name,
        "category": body.category,
        "unit": body.unit or "pcs",
        "order": int(body.order or 0),
        "created_at": now_utc().isoformat(),
    }
    await db.inventory_items.insert_one(doc)
    doc.pop("_id", None)
    return doc


@router.put("/items/{item_id}")
async def update_item(item_id: str, body: InventoryItemBody, user=Depends(require_roles("super_admin"))):
    update = {"name": body.name.strip(), "category": body.category, "unit": body.unit or "pcs", "order": int(body.order or 0)}
    res = await db.inventory_items.update_one({"id": item_id}, {"$set": update})
    if not res.matched_count:
        raise HTTPException(404, "Item tidak ada")
    return {"ok": True}


@router.delete("/items/{item_id}")
async def delete_item(item_id: str, user=Depends(require_roles("super_admin"))):
    res = await db.inventory_items.delete_one({"id": item_id})
    if not res.deleted_count:
        raise HTTPException(404, "Item tidak ada")
    return {"ok": True}


# ═══════════════════════════════════════════════════════════════════════════
# BAHAN (Materials)
# ═══════════════════════════════════════════════════════════════════════════

class BahanIncomingBody(BaseModel):
    date: str  # YYYY-MM-DD
    item_name: str
    qty: int
    notes: Optional[str] = None


class BahanTransferBody(BaseModel):
    date: str
    item_name: str
    qty: int
    notes: Optional[str] = None


async def _find_item_or_404(name: str, category: str) -> dict:
    it = await db.inventory_items.find_one({"name": name, "category": category}, {"_id": 0})
    if not it:
        raise HTTPException(404, f"Item '{name}' tidak ada di kategori {category}. Minta SuperAdmin tambah dulu.")
    return it


@router.post("/bahan/incoming")
async def bahan_incoming(
    body: BahanIncomingBody,
    user=Depends(require_roles("gudang", "super_admin")),
):
    if body.qty <= 0:
        raise HTTPException(400, "Qty harus > 0")
    await _find_item_or_404(body.item_name, "bahan")
    doc = {
        "id": str(uuid.uuid4()),
        "date": body.date,
        "item_name": body.item_name,
        "qty": int(body.qty),
        "notes": body.notes or "",
        "created_by": user["id"],
        "created_by_name": user.get("name") or user["username"],
        "created_at": now_utc().isoformat(),
    }
    await db.bahan_incoming.insert_one(doc)
    doc.pop("_id", None)
    return doc


@router.get("/bahan/incoming")
async def list_bahan_incoming(
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    user=Depends(require_roles("gudang", "produksi", "super_admin", "admin")),
):
    q: dict = {}
    if date_from and date_to:
        q["date"] = {"$gte": date_from, "$lte": date_to}
    return await db.bahan_incoming.find(q, {"_id": 0}).sort("date", -1).to_list(2000)


@router.delete("/bahan/incoming/{doc_id}")
async def del_bahan_incoming(doc_id: str, user=Depends(require_roles("super_admin"))):
    res = await db.bahan_incoming.delete_one({"id": doc_id})
    if not res.deleted_count:
        raise HTTPException(404, "Not found")
    return {"ok": True}


@router.post("/bahan/transfer")
async def bahan_transfer(
    body: BahanTransferBody,
    user=Depends(require_roles("gudang", "super_admin")),
):
    if body.qty <= 0:
        raise HTTPException(400, "Qty harus > 0")
    await _find_item_or_404(body.item_name, "bahan")
    # Cek stok Gudang cukup
    stok = await _bahan_stock_gudang(body.item_name)
    if body.qty > stok:
        raise HTTPException(400, f"Stok Gudang untuk '{body.item_name}' hanya {stok}")
    doc = {
        "id": str(uuid.uuid4()),
        "date": body.date,
        "item_name": body.item_name,
        "qty": int(body.qty),
        "notes": body.notes or "",
        "created_by": user["id"],
        "created_by_name": user.get("name") or user["username"],
        "created_at": now_utc().isoformat(),
    }
    await db.bahan_transfers.insert_one(doc)
    doc.pop("_id", None)
    return doc


@router.get("/bahan/transfers")
async def list_bahan_transfers(
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    user=Depends(require_roles("gudang", "produksi", "super_admin", "admin")),
):
    q: dict = {}
    if date_from and date_to:
        q["date"] = {"$gte": date_from, "$lte": date_to}
    return await db.bahan_transfers.find(q, {"_id": 0}).sort("date", -1).to_list(2000)


@router.delete("/bahan/transfer/{doc_id}")
async def del_bahan_transfer(doc_id: str, user=Depends(require_roles("super_admin"))):
    res = await db.bahan_transfers.delete_one({"id": doc_id})
    if not res.deleted_count:
        raise HTTPException(404, "Not found")
    return {"ok": True}


async def _bahan_stock_gudang(item_name: str) -> int:
    incoming = 0
    async for r in db.bahan_incoming.find({"item_name": item_name}, {"_id": 0, "qty": 1}):
        incoming += int(r.get("qty", 0) or 0)
    out = 0
    async for r in db.bahan_transfers.find({"item_name": item_name}, {"_id": 0, "qty": 1}):
        out += int(r.get("qty", 0) or 0)
    return incoming - out


# ═══════════════════════════════════════════════════════════════════════════
# BARANG JADI (Finished Goods)
# ═══════════════════════════════════════════════════════════════════════════

class FinishedProduceBody(BaseModel):
    date: str
    item_name: str
    qty: int
    notes: Optional[str] = None


class FinishedTransferBody(BaseModel):
    date: str
    item_name: str
    qty: int
    notes: Optional[str] = None


@router.post("/finished/produce")
async def finished_produce(
    body: FinishedProduceBody,
    user=Depends(require_roles("produksi", "super_admin")),
):
    if body.qty <= 0:
        raise HTTPException(400, "Qty harus > 0")
    await _find_item_or_404(body.item_name, "barang_jadi")
    doc = {
        "id": str(uuid.uuid4()),
        "date": body.date,
        "item_name": body.item_name,
        "qty": int(body.qty),
        "notes": body.notes or "",
        "created_by": user["id"],
        "created_by_name": user.get("name") or user["username"],
        "created_at": now_utc().isoformat(),
    }
    await db.finished_production.insert_one(doc)
    doc.pop("_id", None)
    return doc


@router.get("/finished/production")
async def list_finished_production(
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    user=Depends(require_roles("gudang", "produksi", "super_admin", "admin")),
):
    q: dict = {}
    if date_from and date_to:
        q["date"] = {"$gte": date_from, "$lte": date_to}
    return await db.finished_production.find(q, {"_id": 0}).sort("date", -1).to_list(2000)


@router.delete("/finished/produce/{doc_id}")
async def del_finished_produce(doc_id: str, user=Depends(require_roles("super_admin"))):
    res = await db.finished_production.delete_one({"id": doc_id})
    if not res.deleted_count:
        raise HTTPException(404, "Not found")
    return {"ok": True}


@router.post("/finished/transfer")
async def finished_transfer(
    body: FinishedTransferBody,
    user=Depends(require_roles("produksi", "super_admin")),
):
    if body.qty <= 0:
        raise HTTPException(400, "Qty harus > 0")
    await _find_item_or_404(body.item_name, "barang_jadi")
    stok = await _finished_stock_produksi(body.item_name)
    if body.qty > stok:
        raise HTTPException(400, f"Stok Produksi untuk '{body.item_name}' hanya {stok}")
    doc = {
        "id": str(uuid.uuid4()),
        "date": body.date,
        "item_name": body.item_name,
        "qty": int(body.qty),
        "notes": body.notes or "",
        "created_by": user["id"],
        "created_by_name": user.get("name") or user["username"],
        "created_at": now_utc().isoformat(),
    }
    await db.finished_transfers.insert_one(doc)
    doc.pop("_id", None)
    return doc


@router.get("/finished/transfers")
async def list_finished_transfers(
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    user=Depends(require_roles("gudang", "produksi", "super_admin", "admin")),
):
    q: dict = {}
    if date_from and date_to:
        q["date"] = {"$gte": date_from, "$lte": date_to}
    return await db.finished_transfers.find(q, {"_id": 0}).sort("date", -1).to_list(2000)


@router.delete("/finished/transfer/{doc_id}")
async def del_finished_transfer(doc_id: str, user=Depends(require_roles("super_admin"))):
    res = await db.finished_transfers.delete_one({"id": doc_id})
    if not res.deleted_count:
        raise HTTPException(404, "Not found")
    return {"ok": True}


async def _finished_stock_produksi(item_name: str) -> int:
    produced = 0
    async for r in db.finished_production.find({"item_name": item_name}, {"_id": 0, "qty": 1}):
        produced += int(r.get("qty", 0) or 0)
    transferred = 0
    async for r in db.finished_transfers.find({"item_name": item_name}, {"_id": 0, "qty": 1}):
        transferred += int(r.get("qty", 0) or 0)
    return produced - transferred


async def _finished_sold_gudang(item_names: list[str], sales_code: Optional[str] = None) -> dict[str, int]:
    """Compute total qty sold via sales transactions per item_name.

    Sales' `transactions.items[i].product_id` corresponds to `products.id`.
    We need to bridge by product name → inventory item name (assumed same).
    """
    if not item_names:
        return {}
    # Fetch all products matching any of the item_names (case-insensitive)
    name_set = {n.lower() for n in item_names}
    prods = await db.products.find({}, {"_id": 0, "id": 1, "name": 1}).to_list(500)
    prod_id_to_name: dict[str, str] = {}
    for p in prods:
        if (p.get("name") or "").lower() in name_set:
            prod_id_to_name[p["id"]] = p["name"]

    if not prod_id_to_name:
        return {n: 0 for n in item_names}

    q: dict = {"is_draft": {"$ne": True}}
    if sales_code:
        q["sales_code"] = sales_code

    totals: dict[str, int] = {n: 0 for n in item_names}
    async for t in db.transactions.find(q, {"_id": 0, "items": 1}):
        for it in t.get("items", []):
            pid = it.get("product_id")
            if pid in prod_id_to_name:
                pname = prod_id_to_name[pid]
                # Match back to inventory item name (case-sensitive)
                for n in item_names:
                    if n.lower() == pname.lower():
                        totals[n] = totals.get(n, 0) + int(it.get("qty", 0) or 0)
                        break
    return totals


# ═══════════════════════════════════════════════════════════════════════════
# STOCK OVERVIEW
# ═══════════════════════════════════════════════════════════════════════════

@router.get("/stock")
async def inventory_stock(
    category: Optional[str] = None,
    user=Depends(get_current_user),
):
    """Return per-item stock split by location.

    Response:
      {
        bahan: [
          {name, unit, gudang: N, produksi: N},
          ...
        ],
        barang_jadi: [
          {name, unit, produksi: N, gudang: N, sold: N (in Gudang column already netted)},
          ...
        ]
      }
    """
    out: dict = {"bahan": [], "barang_jadi": []}
    items = await db.inventory_items.find({} if not category else {"category": category}, {"_id": 0}).to_list(500)

    # Bahan
    bahan_items = [i for i in items if i.get("category") == "bahan"]
    if bahan_items:
        bahan_items.sort(key=lambda i: (i.get("order", 0), i.get("name", "")))
        for item in bahan_items:
            name = item["name"]
            gudang = await _bahan_stock_gudang(name)
            transferred = 0
            async for r in db.bahan_transfers.find({"item_name": name}, {"_id": 0, "qty": 1}):
                transferred += int(r.get("qty", 0) or 0)
            out["bahan"].append({
                "name": name,
                "unit": item.get("unit", "pcs"),
                "gudang": gudang,
                "produksi": transferred,
            })

    # Barang Jadi
    finished_items = [i for i in items if i.get("category") == "barang_jadi"]
    if finished_items:
        finished_items.sort(key=lambda i: (i.get("order", 0), i.get("name", "")))
        finished_names = [i["name"] for i in finished_items]
        sold_map = await _finished_sold_gudang(finished_names)
        for item in finished_items:
            name = item["name"]
            produksi = await _finished_stock_produksi(name)
            transferred_to_gudang = 0
            async for r in db.finished_transfers.find({"item_name": name}, {"_id": 0, "qty": 1}):
                transferred_to_gudang += int(r.get("qty", 0) or 0)
            sold = sold_map.get(name, 0)
            gudang = transferred_to_gudang - sold
            out["barang_jadi"].append({
                "name": name,
                "unit": item.get("unit", "pcs"),
                "produksi": produksi,
                "gudang": gudang,
                "sold": sold,
                "transferred_in": transferred_to_gudang,
            })

    return out
