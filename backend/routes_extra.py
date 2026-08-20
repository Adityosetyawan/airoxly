from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from datetime import datetime, timedelta
import io
import csv

from db import db
from auth import get_current_user, require_roles
from models import PingReq, ResetReq

router = APIRouter(prefix="/api")


# ---------- GPS LOCATIONS ----------
@router.post("/locations/ping")
async def ping(body: PingReq, user=Depends(get_current_user)):
    ts = datetime.utcnow().isoformat()
    doc = {
        "id": user["id"], "salesId": user["id"], "name": user["name"],
        "lat": body.lat, "lng": body.lng, "lastPing": ts,
        "status": "aktif",
    }
    await db.locations.update_one({"id": user["id"]}, {"$set": doc}, upsert=True)
    # simpan ke riwayat lokasi (jejak rute)
    await db.location_history.insert_one({
        "salesId": user["id"], "name": user["name"],
        "lat": body.lat, "lng": body.lng, "ts": ts,
    })
    return {"ok": True}


@router.get("/locations")
async def list_locations(_=Depends(get_current_user)):
    return await db.locations.find({}, {"_id": 0}).to_list(500)


@router.get("/locations/history")
async def location_history(salesId: str = Query(None), date: str = Query(None), user=Depends(get_current_user)):
    day = date or datetime.utcnow().date().isoformat()
    q = {}
    if user["role"] == "sales":
        q["salesId"] = user["id"]
    elif salesId:
        q["salesId"] = salesId
    rows = await db.location_history.find(q, {"_id": 0}).to_list(50000)
    rows = [r for r in rows if str(r.get("ts", "")).startswith(day)]
    trails = {}
    for r in rows:
        t = trails.setdefault(r["salesId"], {"salesId": r["salesId"], "name": r["name"], "points": []})
        t["points"].append({"lat": r["lat"], "lng": r["lng"], "ts": r["ts"]})
    for t in trails.values():
        t["points"].sort(key=lambda p: p["ts"])
    return list(trails.values())


# ---------- RESET DATA ----------
@router.post("/admin/reset")
async def reset_data(body: ResetReq, _=Depends(require_roles("superadmin"))):
    if body.type not in ("half", "all"):
        return {"ok": False, "detail": "Tipe reset tidak valid"}
    # Half & All: hapus data transaksional
    await db.transactions.delete_many({})
    await db.expenses.delete_many({})
    await db.transfers.delete_many({})
    await db.locations.delete_many({})
    await db.location_history.delete_many({})
    if body.type == "all":
        # All: hapus pelanggan juga (master user & produk tetap)
        await db.customers.delete_many({})
    return {"ok": True, "type": body.type}


# ---------- EXPORT LAPORAN ----------
def _filter_scope(txs, scope):
    if scope == "today":
        today = datetime.utcnow().date().isoformat()
        return [t for t in txs if str(t.get("date", "")).startswith(today)]
    if scope == "week":
        week_ago = datetime.utcnow() - timedelta(days=7)
        out = []
        for t in txs:
            try:
                if datetime.fromisoformat(t["date"]) >= week_ago:
                    out.append(t)
            except Exception:
                pass
        return out
    return txs


async def _get_txs(user, scope):
    q = {} if user["role"] in ("superadmin", "admin") else {"salesId": user["id"]}
    txs = await db.transactions.find(q, {"_id": 0}).sort("date", -1).to_list(5000)
    return _filter_scope(txs, scope)


@router.get("/reports/export")
async def export_report(
    fmt: str = Query("csv"), scope: str = Query("all"), user=Depends(get_current_user)
):
    txs = await _get_txs(user, scope)
    label = {"today": "Hari-Ini", "week": "Minggu-Ini"}.get(scope, "Semua")

    if fmt == "csv":
        buf = io.StringIO()
        w = csv.writer(buf)
        w.writerow(["Tanggal", "Pelanggan", "Sales", "Produk", "Total", "Bayar", "Status"])
        for t in txs:
            produk = "; ".join(f"{i['qty']}x {i['name']}" for i in t.get("items", []))
            w.writerow([t.get("date", ""), t.get("customer", ""), t.get("sales", ""),
                        produk, t.get("total", 0), t.get("bayar", 0), t.get("status", "")])
        w.writerow([])
        w.writerow(["", "", "", "TOTAL", sum(t.get("total", 0) for t in txs), "", ""])
        data = buf.getvalue().encode("utf-8-sig")
        return StreamingResponse(
            io.BytesIO(data), media_type="text/csv",
            headers={"Content-Disposition": f"attachment; filename=Laporan-AirOXLY-{label}.csv"},
        )

    # PDF
    from reportlab.lib.pagesizes import A4
    from reportlab.lib import colors
    from reportlab.lib.units import mm
    from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
    from reportlab.lib.styles import getSampleStyleSheet

    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4, topMargin=18 * mm, bottomMargin=18 * mm)
    styles = getSampleStyleSheet()
    elems = [Paragraph("Air OXLY - Laporan Penjualan", styles["Title"]),
             Paragraph(f"Periode: {label} &nbsp; | &nbsp; Dibuat: {datetime.utcnow().strftime('%d-%m-%Y %H:%M')} UTC", styles["Normal"]),
             Spacer(1, 8)]
    rows = [["Tanggal", "Pelanggan", "Sales", "Total", "Status"]]
    for t in txs:
        try:
            tgl = datetime.fromisoformat(t["date"]).strftime("%d-%m-%Y")
        except Exception:
            tgl = str(t.get("date", ""))[:10]
        rows.append([tgl, t.get("customer", ""), t.get("sales", ""),
                     f"Rp {t.get('total', 0):,.0f}".replace(",", "."), t.get("status", "")])
    rows.append(["", "", "TOTAL", f"Rp {sum(t.get('total', 0) for t in txs):,.0f}".replace(",", "."), ""])
    table = Table(rows, colWidths=[70, 150, 100, 90, 60], repeatRows=1)
    table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#10B981")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 8),
        ("ROWBACKGROUNDS", (0, 1), (-1, -2), [colors.white, colors.HexColor("#ECFDF5")]),
        ("BACKGROUND", (0, -1), (-1, -1), colors.HexColor("#D1FAE5")),
        ("FONTNAME", (0, -1), (-1, -1), "Helvetica-Bold"),
        ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#A7F3D0")),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ]))
    elems.append(table)
    doc.build(elems)
    buf.seek(0)
    return StreamingResponse(
        buf, media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename=Laporan-AirOXLY-{label}.pdf"},
    )
