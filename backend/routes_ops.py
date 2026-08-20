from fastapi import APIRouter, Depends, HTTPException
from datetime import datetime
import uuid

from db import db
from auth import get_current_user, require_roles
from models import TransactionCreate, ExpenseCreate, TransferCreate

router = APIRouter(prefix="/api")


# ---------- TRANSACTIONS ----------
@router.get("/transactions")
async def list_transactions(user=Depends(get_current_user)):
    q = {} if user["role"] in ("superadmin", "admin") else {"salesId": user["id"]}
    return await db.transactions.find(q, {"_id": 0}).sort("date", -1).to_list(2000)


@router.post("/transactions")
async def create_transaction(body: TransactionCreate, user=Depends(get_current_user)):
    cust = await db.customers.find_one({"id": body.customerId})
    if not cust:
        raise HTTPException(status_code=404, detail="Pelanggan tidak ditemukan")
    if not body.items:
        raise HTTPException(status_code=400, detail="Minimal 1 produk")
    total = sum(i.qty * i.price for i in body.items)
    bayar = body.bayar or 0
    status = "lunas" if bayar >= total else "utang"
    doc = {
        "id": str(uuid.uuid4()), "customerId": body.customerId, "customer": cust["name"],
        "salesId": user["id"], "sales": user["name"], "items": [i.dict() for i in body.items],
        "total": total, "bayar": bayar, "kembali": max(0, bayar - total),
        "galonPinjam": body.galonPinjam or 0, "galonKembali": body.galonKembali or 0,
        "date": datetime.utcnow().isoformat(), "status": status,
    }
    await db.transactions.insert_one(doc)
    # update customer galon pinjam & lastBuy
    new_pinjam = max(0, (cust.get("galonPinjam", 0)) + (body.galonPinjam or 0) - (body.galonKembali or 0))
    await db.customers.update_one({"id": body.customerId}, {"$set": {"galonPinjam": new_pinjam, "lastBuy": datetime.utcnow().date().isoformat()}})
    doc.pop("_id", None)
    return doc


# ---------- EXPENSES ----------
@router.get("/expenses")
async def list_expenses(_=Depends(get_current_user)):
    return await db.expenses.find({}, {"_id": 0}).sort("date", -1).to_list(1000)


@router.post("/expenses")
async def create_expense(body: ExpenseCreate, user=Depends(get_current_user)):
    doc = body.dict()
    doc["id"] = str(uuid.uuid4())
    doc["by"] = user["name"]
    doc["date"] = datetime.utcnow().date().isoformat()
    await db.expenses.insert_one(doc)
    doc.pop("_id", None)
    return doc


# ---------- OVERVIEW ----------
@router.get("/overview")
async def overview(_=Depends(get_current_user)):
    txs = await db.transactions.find({}, {"_id": 0}).to_list(5000)
    today = datetime.utcnow().date().isoformat()
    today_txs = [t for t in txs if str(t.get("date", "")).startswith(today)]
    total_customers = await db.customers.count_documents({})
    total_products = await db.products.count_documents({})
    active_sales = await db.users.count_documents({"role": "sales"})

    # weekly trend (last 7 days)
    from collections import defaultdict
    day_names = ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"]
    buckets = defaultdict(int)
    for t in txs:
        try:
            d = datetime.fromisoformat(t["date"]).weekday()
            buckets[d] += t.get("total", 0)
        except Exception:
            pass
    weekly = [{"day": day_names[i], "value": buckets.get(i, 0) or 0} for i in range(7)]
    if not any(w["value"] for w in weekly):
        weekly = [{"day": day_names[i], "value": v} for i, v in enumerate([2100000, 2650000, 1980000, 3120000, 2870000, 3450000, 1580000])]

    # top products
    prod_sold = defaultdict(int)
    for t in txs:
        for it in t.get("items", []):
            prod_sold[it["name"]] += it["qty"]
    total_sold = sum(prod_sold.values()) or 1
    top = sorted(prod_sold.items(), key=lambda x: -x[1])[:4]
    top_products = [{"name": n, "sold": s, "pct": round(s / total_sold * 100)} for n, s in top]

    return {
        "todaySales": sum(t.get("total", 0) for t in today_txs),
        "todayTransactions": len(today_txs),
        "monthSales": sum(t.get("total", 0) for t in txs),
        "monthTransactions": len(txs),
        "totalCustomers": total_customers,
        "totalProducts": total_products,
        "activeSales": active_sales,
        "weeklyTrend": weekly,
        "topProducts": top_products,
    }


# ---------- WAREHOUSE ----------
@router.get("/spareparts")
async def list_spareparts(_=Depends(get_current_user)):
    return await db.spareparts.find({}, {"_id": 0}).to_list(100)


@router.post("/warehouse/transfer")
async def transfer(body: TransferCreate, user=Depends(require_roles("gudang", "superadmin"))):
    part = await db.spareparts.find_one({"id": body.partId})
    if not part:
        raise HTTPException(status_code=404, detail="Sparepart tidak ditemukan")
    if body.qty <= 0 or body.qty > part["gudang"]:
        raise HTTPException(status_code=400, detail=f"Jumlah tidak valid. Stok gudang: {part['gudang']}")
    await db.spareparts.update_one({"id": body.partId}, {"$inc": {"gudang": -body.qty, "produksi": body.qty}})
    doc = {"id": str(uuid.uuid4()), "part": part["name"], "qty": body.qty, "note": body.note or "", "by": user["name"], "date": datetime.utcnow().isoformat()}
    await db.transfers.insert_one(doc)
    doc.pop("_id", None)
    return doc


@router.get("/warehouse/transfers")
async def list_transfers(_=Depends(get_current_user)):
    return await db.transfers.find({}, {"_id": 0}).sort("date", -1).to_list(500)


# ---------- LOTTERY ----------
@router.get("/lottery")
async def get_lottery(_=Depends(get_current_user)):
    l = await db.lottery.find_one({}, {"_id": 0})
    return l or {}
