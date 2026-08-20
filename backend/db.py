import os
from pathlib import Path
from datetime import datetime, timedelta
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
from auth import hash_password

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ["DB_NAME"]]


async def seed_if_empty():
    if await db.users.count_documents({}) > 0:
        return

    users = [
        {"id": "u1", "username": "superadmin", "name": "Budi Santoso", "role": "superadmin", "area": "Pusat", "target": 0, "password": hash_password("super123")},
        {"id": "u2", "username": "adminA", "name": "Rina Admin", "role": "admin", "area": "Area A", "target": 0, "password": hash_password("admin123")},
        {"id": "u3", "username": "A1", "name": "Agus Sales", "role": "sales", "area": "Area A", "target": 2000000, "password": hash_password("sales123")},
        {"id": "u4", "username": "A2", "name": "Dewi Sales", "role": "sales", "area": "Area A", "target": 1800000, "password": hash_password("sales123")},
        {"id": "u5", "username": "gudang", "name": "Hasan Gudang", "role": "gudang", "area": "Pusat", "target": 0, "password": hash_password("gudang123")},
        {"id": "u6", "username": "produksi", "name": "Sari Produksi", "role": "produksi", "area": "Pusat", "target": 0, "password": hash_password("prod123")},
    ]
    await db.users.insert_many(users)

    products = [
        {"id": "p1", "name": "Galon Polos 19L", "price": 6000, "refill": True, "stock": 320},
        {"id": "p2", "name": "Galon Bermerek 19L", "price": 18000, "refill": False, "stock": 145},
        {"id": "p3", "name": "Botol 600ml (dus)", "price": 42000, "refill": False, "stock": 88},
        {"id": "p4", "name": "Botol 1500ml (dus)", "price": 55000, "refill": False, "stock": 64},
        {"id": "p5", "name": "Gelas 240ml (dus)", "price": 24000, "refill": False, "stock": 210},
    ]
    await db.products.insert_many(products)

    customers = [
        {"id": "c1", "name": "Warung Bu Tini", "phone": "0812-1111-2222", "address": "Jl. Melati No. 12", "area": "Area A", "barcode": "AOX-0001", "galonPinjam": 3, "lastBuy": "2026-08-19"},
        {"id": "c2", "name": "Toko Sumber Rejeki", "phone": "0813-3333-4444", "address": "Jl. Kenanga No. 5", "area": "Area A", "barcode": "AOX-0002", "galonPinjam": 8, "lastBuy": "2026-08-20"},
        {"id": "c3", "name": "Kantin Sekolah 21", "phone": "0857-5555-6666", "address": "Jl. Pendidikan No. 21", "area": "Area A", "barcode": "AOX-0003", "galonPinjam": 2, "lastBuy": "2026-08-18"},
        {"id": "c4", "name": "Cafe Kopi Senja", "phone": "0821-7777-8888", "address": "Jl. Merdeka No. 9", "area": "Area B", "barcode": "AOX-0004", "galonPinjam": 5, "lastBuy": "2026-08-20"},
        {"id": "c5", "name": "Rumah Pak Joko", "phone": "0838-9999-0000", "address": "Perum Griya Asri B2", "area": "Area A", "barcode": "AOX-0005", "galonPinjam": 1, "lastBuy": "2026-08-17"},
        {"id": "c6", "name": "Masjid Al-Ikhlas", "phone": "0812-2323-4545", "address": "Jl. Damai No. 1", "area": "Area B", "barcode": "AOX-0006", "galonPinjam": 4, "lastBuy": "2026-08-16"},
    ]
    await db.customers.insert_many(customers)

    now = datetime.utcnow()
    transactions = [
        {"id": "t1", "customerId": "c2", "customer": "Toko Sumber Rejeki", "salesId": "u3", "sales": "Agus Sales", "items": [{"productId": "p1", "name": "Galon Polos 19L", "qty": 10, "price": 6000}], "total": 60000, "bayar": 60000, "kembali": 0, "galonPinjam": 0, "galonKembali": 5, "date": now.isoformat(), "status": "lunas"},
        {"id": "t2", "customerId": "c1", "customer": "Warung Bu Tini", "salesId": "u3", "sales": "Agus Sales", "items": [{"productId": "p1", "name": "Galon Polos 19L", "qty": 3, "price": 6000}, {"productId": "p3", "name": "Botol 600ml (dus)", "qty": 2, "price": 42000}], "total": 102000, "bayar": 100000, "kembali": 0, "galonPinjam": 3, "galonKembali": 0, "date": now.isoformat(), "status": "utang"},
        {"id": "t3", "customerId": "c4", "customer": "Cafe Kopi Senja", "salesId": "u4", "sales": "Dewi Sales", "items": [{"productId": "p2", "name": "Galon Bermerek 19L", "qty": 5, "price": 18000}], "total": 90000, "bayar": 90000, "kembali": 0, "galonPinjam": 0, "galonKembali": 2, "date": now.isoformat(), "status": "lunas"},
        {"id": "t4", "customerId": "c3", "customer": "Kantin Sekolah 21", "salesId": "u3", "sales": "Agus Sales", "items": [{"productId": "p5", "name": "Gelas 240ml (dus)", "qty": 4, "price": 24000}], "total": 96000, "bayar": 96000, "kembali": 0, "galonPinjam": 0, "galonKembali": 0, "date": (now - timedelta(days=1)).isoformat(), "status": "lunas"},
        {"id": "t5", "customerId": "c5", "customer": "Rumah Pak Joko", "salesId": "u4", "sales": "Dewi Sales", "items": [{"productId": "p1", "name": "Galon Polos 19L", "qty": 2, "price": 6000}], "total": 12000, "bayar": 12000, "kembali": 0, "galonPinjam": 1, "galonKembali": 1, "date": (now - timedelta(days=1)).isoformat(), "status": "lunas"},
    ]
    await db.transactions.insert_many(transactions)

    expenses = [
        {"id": "e1", "title": "Bensin motor operasional", "amount": 50000, "category": "Transport", "by": "Agus Sales", "date": "2026-08-20"},
        {"id": "e2", "title": "Servis mesin RO", "amount": 350000, "category": "Perawatan", "by": "Hasan Gudang", "date": "2026-08-19"},
        {"id": "e3", "title": "Beli tutup galon", "amount": 120000, "category": "Bahan", "by": "Sari Produksi", "date": "2026-08-18"},
        {"id": "e4", "title": "Konsumsi tim", "amount": 85000, "category": "Lain-lain", "by": "Rina Admin", "date": "2026-08-18"},
    ]
    await db.expenses.insert_many(expenses)

    spareparts = [
        {"id": "s1", "name": "Galon Polos", "gudang": 150, "produksi": 15},
        {"id": "s2", "name": "Tutup Galon", "gudang": 1200, "produksi": 300},
        {"id": "s3", "name": "Segel/Tisu", "gudang": 800, "produksi": 150},
        {"id": "s4", "name": "Tissue Galon", "gudang": 500, "produksi": 90},
    ]
    await db.spareparts.insert_many(spareparts)

    transfers = [
        {"id": "tr1", "part": "Galon Polos", "qty": 20, "note": "Stok produksi menipis", "by": "Hasan Gudang", "date": now.isoformat()},
        {"id": "tr2", "part": "Tutup Galon", "qty": 200, "note": "", "by": "Hasan Gudang", "date": (now - timedelta(days=1)).isoformat()},
    ]
    await db.transfers.insert_many(transfers)

    await db.lottery.insert_one({
        "id": "l1", "active": True, "title": "Undian Berhadiah Agustus 2026",
        "prize": "Motor Listrik + 10 Voucher Belanja", "totalCoupons": 1240, "drawDate": "2026-08-31",
        "winners": [
            {"id": "w1", "name": "Warung Bu Tini", "coupon": "AOX-8842", "prize": "Voucher Rp 100.000"},
            {"id": "w2", "name": "Cafe Kopi Senja", "coupon": "AOX-1290", "prize": "Voucher Rp 50.000"},
        ],
    })

    now_iso = datetime.utcnow().isoformat()
    await db.locations.insert_many([
        {"id": "u3", "salesId": "u3", "name": "Agus Sales", "lat": -6.2088, "lng": 106.8456, "lastPing": now_iso, "status": "aktif"},
        {"id": "u4", "salesId": "u4", "name": "Dewi Sales", "lat": -6.1751, "lng": 106.8650, "lastPing": now_iso, "status": "aktif"},
    ])


async def ensure_locations():
    """Seed lokasi GPS jika koleksi kosong (untuk DB yang sudah ter-seed sebelumnya)."""
    if await db.locations.count_documents({}) > 0:
        return
    if await db.users.count_documents({}) == 0:
        return
    now_iso = datetime.utcnow().isoformat()
    await db.locations.insert_many([
        {"id": "u3", "salesId": "u3", "name": "Agus Sales", "lat": -6.2088, "lng": 106.8456, "lastPing": now_iso, "status": "aktif"},
        {"id": "u4", "salesId": "u4", "name": "Dewi Sales", "lat": -6.1751, "lng": 106.8650, "lastPing": now_iso, "status": "aktif"},
    ])


async def ensure_history():
    """Seed jejak rute demo (ping tiap 120 detik, 08:00-17:00) jika kosong."""
    import random
    if await db.location_history.count_documents({}) > 0:
        return
    if await db.users.count_documents({}) == 0:
        return
    today = datetime.utcnow().date()
    bases = {
        "u3": ("Agus Sales", -6.2088, 106.8456),
        "u4": ("Dewi Sales", -6.1751, 106.8650),
    }
    docs = []
    for sid, (name, blat, blng) in bases.items():
        lat, lng = blat, blng
        t = datetime(today.year, today.month, today.day, 8, 0, 0)
        end = datetime(today.year, today.month, today.day, 17, 0, 0)
        # arah dominan agar rute terlihat seperti perjalanan
        drift_lat = random.uniform(-0.0006, 0.0006)
        drift_lng = random.uniform(-0.0006, 0.0006)
        while t <= end:
            lat += drift_lat + random.uniform(-0.0009, 0.0009)
            lng += drift_lng + random.uniform(-0.0009, 0.0009)
            docs.append({"salesId": sid, "name": name, "lat": round(lat, 6), "lng": round(lng, 6), "ts": t.isoformat()})
            t += timedelta(seconds=120)
    if docs:
        await db.location_history.insert_many(docs)
