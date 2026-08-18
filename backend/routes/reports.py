"""Daily and monthly reports (sales/produksi aggregations)."""
from __future__ import annotations

import calendar
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException

from core.config import db
from core.security import get_current_user
from core.utils import now_utc
from models import MonthlyReportUpdate

router = APIRouter(prefix="/api/reports", tags=["reports"])

DAY_NAMES_ID = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu", "Minggu"]


@router.get("/daily")
async def daily_report(
    date: Optional[str] = None,
    group_letter: Optional[str] = None,
    sales_code: Optional[str] = None,
    user=Depends(get_current_user),
):
    """Aggregated daily report by sales_code."""
    d = date or now_utc().strftime("%Y-%m-%d")
    q: dict = {"date_only": d}
    if user["role"] == "sales":
        q["sales_id"] = user["id"]
    elif user["role"] == "admin":
        q["group_letter"] = user.get("group_letter")
    else:
        if group_letter:
            q["group_letter"] = group_letter
    if sales_code:
        q["sales_code"] = sales_code

    txns = await db.transactions.find(q, {"_id": 0}).to_list(5000)
    q_exp: dict = {"date_only": d}
    if user["role"] == "sales":
        q_exp["sales_id"] = user["id"]
    elif user["role"] == "admin":
        q_exp["group_letter"] = user.get("group_letter")
    if sales_code:
        q_exp["sales_code"] = sales_code
    expenses = await db.expenses.find(q_exp, {"_id": 0}).to_list(5000)

    agg: dict = {}
    total_all = {"total_uang": 0.0, "total_bayar": 0.0, "total_hutang": 0.0, "total_pinjam": 0, "total_kembali": 0, "total_gln_terjual": 0, "count": 0, "total_pengeluaran": 0.0, "total_setoran": 0.0}
    for t in txns:
        code = t.get("sales_code") or "?"
        a = agg.setdefault(code, {
            "sales_code": code,
            "sales_id": t.get("sales_id"),
            "total_uang": 0.0,
            "total_bayar": 0.0,
            "total_hutang": 0.0,
            "total_pinjam": 0,
            "total_kembali": 0,
            "total_gln_terjual": 0,
            "count": 0,
            "total_pengeluaran": 0.0,
            "total_setoran": 0.0,
            "expenses": [],
            "transactions": [],
        })
        a["total_uang"] += float(t.get("total", 0))
        a["total_bayar"] += float(t.get("bayar", 0))
        a["total_hutang"] += float(t.get("hutang_transaksi", 0))
        a["total_pinjam"] += int(t.get("pinjam_galon", 0))
        a["total_kembali"] += int(t.get("galon_kembali", 0))
        gln = sum(int(it.get("qty", 0)) for it in t.get("items", []) if it.get("unit") == "gln" and "Kosong" not in it.get("product_name", ""))
        a["total_gln_terjual"] += gln
        a["count"] += 1
        a["transactions"].append(t)
        total_all["total_uang"] += float(t.get("total", 0))
        total_all["total_bayar"] += float(t.get("bayar", 0))
        total_all["total_hutang"] += float(t.get("hutang_transaksi", 0))
        total_all["total_pinjam"] += int(t.get("pinjam_galon", 0))
        total_all["total_kembali"] += int(t.get("galon_kembali", 0))
        total_all["total_gln_terjual"] += gln
        total_all["count"] += 1

    for e in expenses:
        code = e.get("sales_code") or "?"
        a = agg.setdefault(code, {
            "sales_code": code,
            "sales_id": e.get("sales_id"),
            "total_uang": 0.0, "total_bayar": 0.0, "total_hutang": 0.0,
            "total_pinjam": 0, "total_kembali": 0, "total_gln_terjual": 0,
            "count": 0, "total_pengeluaran": 0.0, "total_setoran": 0.0,
            "expenses": [], "transactions": [],
        })
        a["total_pengeluaran"] += float(e.get("amount", 0))
        a["expenses"].append(e)
        total_all["total_pengeluaran"] += float(e.get("amount", 0))

    for _code, a in agg.items():
        a["total_setoran"] = max(0.0, a["total_bayar"] - a["total_pengeluaran"])
    total_all["total_setoran"] = max(0.0, total_all["total_bayar"] - total_all["total_pengeluaran"])
    return {"date": d, "totals": total_all, "groups": list(agg.values())}


async def _get_monthly_admin_doc(sales_id: str, year: int, month: int) -> dict:
    doc = await db.monthly_reports.find_one(
        {"sales_id": sales_id, "year": year, "month": month},
        {"_id": 0},
    )
    if not doc:
        doc = {
            "sales_id": sales_id, "year": year, "month": month,
            "gaji_sopir": 0, "gaji_kernet": 0,
            "bonus_per_galon_1": 0, "bonus_per_galon_2": 0,
            "komisi": 0,
            "bonus_target_mg1": 0, "bonus_target_mg2": 0, "bonus_target_mg3": 0,
            "bonus_target_mg4": 0, "bonus_target_mg5": 0,
            "part_qtys": {},
        }
    return doc


@router.get("/monthly")
async def monthly_report(
    sales_id: str,
    year: int,
    month: int,
    user=Depends(get_current_user),
):
    target_user = await db.users.find_one({"id": sales_id})
    if not target_user:
        raise HTTPException(404, "Sales tidak ditemukan")
    if user["role"] == "sales" and user["id"] != sales_id:
        raise HTTPException(403, "Forbidden")
    if user["role"] == "admin" and target_user.get("group_letter") != user.get("group_letter"):
        raise HTTPException(403, "Forbidden")

    ndays = calendar.monthrange(year, month)[1]
    start = f"{year:04d}-{month:02d}-01"
    end = f"{year:04d}-{month:02d}-{ndays:02d}"

    txns = await db.transactions.find(
        {"sales_id": sales_id, "date_only": {"$gte": start, "$lte": end}},
        {"_id": 0},
    ).to_list(10000)

    daily_map: dict = {}
    total_bayar = 0.0
    total_uang = 0.0
    total_gln = 0
    for t in txns:
        d = int(t["date_only"].split("-")[2])
        row = daily_map.setdefault(d, {"bayar": 0.0, "uang": 0.0, "gln": 0, "count": 0})
        row["bayar"] += float(t.get("bayar", 0))
        row["uang"] += float(t.get("total", 0))
        gln = sum(int(it.get("qty", 0)) for it in t.get("items", []) if it.get("unit") == "gln" and "Kosong" not in it.get("product_name", ""))
        row["gln"] += gln
        row["count"] += 1
        total_bayar += float(t.get("bayar", 0))
        total_uang += float(t.get("total", 0))
        total_gln += gln

    daily = []
    for day in range(1, ndays + 1):
        dt = datetime(year, month, day)
        day_name = DAY_NAMES_ID[dt.weekday()]
        r = daily_map.get(day, {"bayar": 0.0, "uang": 0.0, "gln": 0, "count": 0})
        daily.append({
            "no": day,
            "date": dt.strftime("%Y-%m-%d"),
            "day_name": day_name,
            "penjualan": r["uang"],
            "bayar": r["bayar"],
            "gln": r["gln"],
            "count": r["count"],
        })
    A1_penjualan = total_uang

    expenses = await db.expenses.find(
        {"sales_id": sales_id, "date_only": {"$gte": start, "$lte": end}},
        {"_id": 0},
    ).sort("date", 1).to_list(10000)
    total_sales_expenses = sum(float(e.get("amount", 0)) for e in expenses)

    admin = await _get_monthly_admin_doc(sales_id, year, month)

    A2_gaji_bonus = sum([
        float(admin.get("gaji_sopir", 0) or 0),
        float(admin.get("gaji_kernet", 0) or 0),
        float(admin.get("bonus_per_galon_1", 0) or 0),
        float(admin.get("bonus_per_galon_2", 0) or 0),
        float(admin.get("komisi", 0) or 0),
        float(admin.get("bonus_target_mg1", 0) or 0),
        float(admin.get("bonus_target_mg2", 0) or 0),
        float(admin.get("bonus_target_mg3", 0) or 0),
        float(admin.get("bonus_target_mg4", 0) or 0),
        float(admin.get("bonus_target_mg5", 0) or 0),
    ])

    parts_docs = await db.part_prices.find({}, {"_id": 0}).sort("order", 1).to_list(100)
    part_qtys = admin.get("part_qtys", {}) or {}

    prod_entries = await db.production_daily.find(
        {"sales_id": sales_id, "date": {"$gte": start, "$lte": end}, "is_draft": {"$ne": True}},
        {"_id": 0},
    ).to_list(2000)
    wh_entries = await db.warehouse_daily.find(
        {"sales_id": sales_id, "date": {"$gte": start, "$lte": end}, "is_draft": {"$ne": True}},
        {"_id": 0},
    ).to_list(2000)

    def _sum(rows, key):
        return sum(int(r.get(key, 0) or 0) for r in rows)

    auto_part_qtys: dict = {
        "Seal": _sum(prod_entries, "sil_ganti") + _sum(wh_entries, "seal_ganti"),
        "Mur": _sum(prod_entries, "mur_ganti") + _sum(wh_entries, "mur_ganti"),
        "Kran": _sum(prod_entries, "kran_ganti") + _sum(wh_entries, "kran_ganti"),
        "Stiker": _sum(prod_entries, "stiker_ganti") + _sum(wh_entries, "stiker_ganti"),
        "Stoper": _sum(prod_entries, "stoper_ganti") + _sum(wh_entries, "stoper_ganti"),
        "Karet Kran": _sum(prod_entries, "karet_kran_ganti") + _sum(wh_entries, "karet_kran_ganti"),
        "Galon Kran": _sum(wh_entries, "galon_kran"),
        "Galon Polos": _sum(wh_entries, "galon_polos") + _sum(wh_entries, "galon_ganti") + _sum(prod_entries, "galon_ganti"),
    }

    def _accumulate_part_qtys(rows):
        for r in rows:
            pq = r.get("part_qtys") or {}
            if not isinstance(pq, dict):
                continue
            for name, qty in pq.items():
                try:
                    auto_part_qtys[name] = int(auto_part_qtys.get(name, 0) or 0) + int(qty or 0)
                except (TypeError, ValueError):
                    pass

    _accumulate_part_qtys(prod_entries)
    _accumulate_part_qtys(wh_entries)

    parts = []
    parts_total = 0.0
    for p in parts_docs:
        auto_qty = int(auto_part_qtys.get(p["name"], 0) or 0)
        manual_qty_raw = part_qtys.get(p["name"])
        if manual_qty_raw is not None and int(manual_qty_raw or 0) > 0:
            qty = int(manual_qty_raw)
            source = "manual"
        else:
            qty = auto_qty
            source = "auto" if auto_qty > 0 else "empty"
        subtotal = float(p.get("rp_per_pcs", 0)) * qty
        parts_total += subtotal
        parts.append({
            "id": p["id"],
            "name": p["name"],
            "rp_per_pcs": float(p.get("rp_per_pcs", 0)),
            "qty": qty,
            "auto_qty": auto_qty,
            "manual_qty": int(manual_qty_raw or 0) if manual_qty_raw is not None else 0,
            "source": source,
            "subtotal": subtotal,
        })

    A3_biaya_operasional = parts_total + total_sales_expenses

    kulakan_setting = await db.settings.find_one({"key": "rp_kulakan_per_galon"}, {"_id": 0})
    rp_kulakan = float((kulakan_setting or {}).get("value") or 0)
    A4_kulakan = rp_kulakan * total_gln

    pendapatan_bersih = A1_penjualan - A4_kulakan - A3_biaya_operasional - A2_gaji_bonus

    # --- Aggregations for Prod & Warehouse Summary ---
    # Prod entries split by destination:
    #   destination == "gudang" → produksi masuk ke gudang (dibawa ke gudang)
    #   destination == "sales"  → produksi langsung dijual (skip gudang)
    def _sum_where(rows, key, cond):
        return sum(int(r.get(key, 0) or 0) for r in rows if cond(r))

    # Total galon terproduksi (semua entry) — RAW, tanpa dikurangi sisa
    total_produksi_raw = _sum(prod_entries, "produksi_galon")
    total_sisa_produksi = _sum(prod_entries, "sisa_pagi") + _sum(prod_entries, "sisa_siang")

    prod_ke_gudang = _sum_where(
        prod_entries, "produksi_galon",
        lambda r: (r.get("destination") or "gudang") == "gudang",
    )
    prod_langsung_jual_produced = _sum_where(
        prod_entries, "produksi_galon",
        lambda r: (r.get("destination") or "gudang") == "sales",
    )
    prod_langsung_jual_sisa = _sum_where(
        prod_entries, "sisa_pagi",
        lambda r: (r.get("destination") or "gudang") == "sales",
    ) + _sum_where(
        prod_entries, "sisa_siang",
        lambda r: (r.get("destination") or "gudang") == "sales",
    )
    # Terjual dari produksi langsung (yang tidak lewat gudang): produced - sisa
    terjual_langsung_produksi = max(0, prod_langsung_jual_produced - prod_langsung_jual_sisa)

    wh_bawa_total = _sum(wh_entries, "bawa_pagi") + _sum(wh_entries, "bawa_siang")
    wh_sisa_total = _sum(wh_entries, "sisa_pagi") + _sum(wh_entries, "sisa_siang")
    # Stok yang KELUAR dari gudang (bawa isi sales - sisa isi yg dikembalikan)
    stok_keluar_gudang = wh_bawa_total - wh_sisa_total

    terjual_gudang_produksi = stok_keluar_gudang + terjual_langsung_produksi

    prod_wh_summary = {
        # Produksi Galon = total produksi RAW (tanpa dikurangi sisa)
        "produksi_galon_total": total_produksi_raw,
        "sisa_produksi": total_sisa_produksi,
        "dibawa_ke_gudang": prod_ke_gudang,
        "stok_keluar_gudang": stok_keluar_gudang,
        "terjual_langsung_produksi": terjual_langsung_produksi,
        "terjual_gudang_produksi": terjual_gudang_produksi,
        # Legacy fields (kept for backward compatibility)
        "bawa_total": wh_bawa_total,
        "sisa_total": wh_sisa_total,
        "terjual_by_gudang": stok_keluar_gudang,
        "prod_entries_count": len(prod_entries),
        "wh_entries_count": len(wh_entries),
    }
    prod_wh_summary["terjual_by_transaksi"] = total_gln
    prod_wh_summary["match"] = terjual_gudang_produksi == total_gln
    prod_wh_summary["diff"] = total_gln - terjual_gudang_produksi

    return {
        "sales_id": sales_id,
        "sales_code": target_user.get("sales_code") or target_user.get("username"),
        "sales_name": target_user.get("name"),
        "group_letter": target_user.get("group_letter"),
        "year": year,
        "month": month,
        "days_in_month": ndays,
        "daily": daily,
        "total_gln_sold": total_gln,
        "total_bayar": total_bayar,
        "sales_expenses": expenses,
        "total_sales_expenses": total_sales_expenses,
        "admin": {
            "gaji_sopir": float(admin.get("gaji_sopir", 0) or 0),
            "gaji_kernet": float(admin.get("gaji_kernet", 0) or 0),
            "bonus_per_galon_1": float(admin.get("bonus_per_galon_1", 0) or 0),
            "bonus_per_galon_2": float(admin.get("bonus_per_galon_2", 0) or 0),
            "komisi": float(admin.get("komisi", 0) or 0),
            "bonus_target_mg1": float(admin.get("bonus_target_mg1", 0) or 0),
            "bonus_target_mg2": float(admin.get("bonus_target_mg2", 0) or 0),
            "bonus_target_mg3": float(admin.get("bonus_target_mg3", 0) or 0),
            "bonus_target_mg4": float(admin.get("bonus_target_mg4", 0) or 0),
            "bonus_target_mg5": float(admin.get("bonus_target_mg5", 0) or 0),
        },
        "parts": parts,
        "rp_kulakan_per_galon": rp_kulakan,
        "prod_wh_summary": prod_wh_summary,
        "A1_penjualan": A1_penjualan,
        "A2_gaji_bonus": A2_gaji_bonus,
        "A3_biaya_operasional": A3_biaya_operasional,
        "A3_parts_total": parts_total,
        "A3_sales_expenses_total": total_sales_expenses,
        "A4_kulakan": A4_kulakan,
        "pendapatan_bersih": pendapatan_bersih,
    }


@router.patch("/monthly")
async def update_monthly_report(
    sales_id: str,
    year: int,
    month: int,
    body: MonthlyReportUpdate,
    user=Depends(get_current_user),
):
    target_user = await db.users.find_one({"id": sales_id})
    if not target_user:
        raise HTTPException(404, "Sales tidak ditemukan")
    if user["role"] == "sales":
        raise HTTPException(403, "Forbidden")
    if user["role"] == "admin" and target_user.get("group_letter") != user.get("group_letter"):
        raise HTTPException(403, "Forbidden")

    update = {k: v for k, v in body.dict(exclude_unset=True).items() if v is not None}
    if not update:
        return {"ok": True}
    await db.monthly_reports.update_one(
        {"sales_id": sales_id, "year": year, "month": month},
        {"$set": {**update, "sales_id": sales_id, "year": year, "month": month, "updated_at": now_utc().isoformat()}},
        upsert=True,
    )
    return {"ok": True}
