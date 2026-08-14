"""PDF exports (Data Pelanggan per Sales, range nomor urut) — using reportlab (pure Python)."""
from __future__ import annotations

import io
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse

from core.config import db
from core.security import get_current_user

router = APIRouter(prefix="/api/exports", tags=["exports"])


def _fmt_rp(n) -> str:
    try:
        return "Rp " + f"{int(n or 0):,}".replace(",", ".")
    except Exception:
        return "Rp 0"


def _short(s, n: int) -> str:
    """Truncate long strings for table cells, appending an ellipsis."""
    if s is None:
        return ""
    s = str(s)
    return s if len(s) <= n else s[: n - 1] + "…"


def _build_customer_pdf(sales: dict, customers: list, from_no: int, to_no: int) -> bytes:
    """Build an A4-landscape PDF for the customer list of one sales, using reportlab."""
    from reportlab.lib import colors
    from reportlab.lib.pagesizes import landscape, A4
    from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
    from reportlab.lib.units import mm
    from reportlab.platypus import (
        Paragraph,
        SimpleDocTemplate,
        Spacer,
        Table,
        TableStyle,
    )

    total_debt = sum(float(c.get("total_debt", 0) or 0) for c in customers)
    total_loans = sum(int(c.get("gallon_loans", 0) or 0) for c in customers)
    total_purchases = sum(float(c.get("total_purchases", 0) or 0) for c in customers)

    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf,
        pagesize=landscape(A4),
        leftMargin=10 * mm,
        rightMargin=10 * mm,
        topMargin=10 * mm,
        bottomMargin=12 * mm,
        title=f"Data Pelanggan {sales.get('sales_code') or sales.get('username')}",
    )

    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        "TitleGreen", parent=styles["Heading1"],
        textColor=colors.HexColor("#0F766E"), fontSize=15, leading=17, spaceAfter=2,
    )
    meta_style = ParagraphStyle(
        "Meta", parent=styles["Normal"],
        fontSize=9, textColor=colors.HexColor("#4B5563"), leading=12,
    )
    kpi_label = ParagraphStyle(
        "KpiLabel", parent=styles["Normal"],
        fontSize=7.5, textColor=colors.HexColor("#6B7280"),
    )
    kpi_value = ParagraphStyle(
        "KpiValue", parent=styles["Normal"],
        fontSize=11, textColor=colors.HexColor("#111827"), fontName="Helvetica-Bold",
    )

    story = []

    # Header
    sales_code = sales.get("sales_code") or sales.get("username") or "-"
    story.append(Paragraph(f"Data Pelanggan · Sales {sales_code}", title_style))
    meta_text = (
        f"<b>Nama Sales:</b> {sales.get('name') or '-'} &nbsp;·&nbsp; "
        f"<b>Wilayah:</b> {sales.get('group_letter') or '-'} &nbsp;·&nbsp; "
        f"<b>Rentang No:</b> {from_no} – {to_no} &nbsp;·&nbsp; "
        f"<b>Jumlah:</b> {len(customers)} pelanggan &nbsp;·&nbsp; "
        f"<b>Dicetak:</b> {datetime.now().strftime('%d-%m-%Y %H:%M')}"
    )
    story.append(Paragraph(meta_text, meta_style))
    story.append(Spacer(1, 6))

    # KPI row
    kpi_data = [[
        [Paragraph("TOTAL PINJAMAN GALON", kpi_label), Paragraph(str(total_loans), kpi_value)],
        [Paragraph("TOTAL PIUTANG", kpi_label), Paragraph(_fmt_rp(total_debt), kpi_value)],
        [Paragraph("TOTAL PEMBELIAN (KUMULATIF)", kpi_label), Paragraph(_fmt_rp(total_purchases), kpi_value)],
    ]]
    kpi_table = Table(kpi_data, colWidths=[92 * mm, 92 * mm, 92 * mm])
    kpi_table.setStyle(TableStyle([
        ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#E5E7EB")),
        ("INNERGRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#E5E7EB")),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
        ("RIGHTPADDING", (0, 0), (-1, -1), 8),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
    ]))
    story.append(kpi_table)
    story.append(Spacer(1, 8))

    # Main table
    header = [
        "No",
        "Nama Pelanggan",
        "Barcode",
        "No WA",
        "Alamat",
        "Pinjam\nGln",
        "Piutang",
        "Total Beli",
        "Beli Terakhir",
    ]
    body = []
    for c in customers:
        last_pur = c.get("last_purchase_date") or ""
        if last_pur:
            last_pur = last_pur[:10]
        body.append([
            str(c.get("customer_no") or ""),
            _short(c.get("name"), 28),
            _short(c.get("barcode_id"), 18),
            _short(c.get("wa_number"), 15),
            _short(c.get("address"), 40),
            str(int(c.get("gallon_loans") or 0)),
            _fmt_rp(c.get("total_debt") or 0),
            _fmt_rp(c.get("total_purchases") or 0),
            last_pur or "-",
        ])
    footer_row = [
        "", "TOTAL", "", "", "",
        str(total_loans),
        _fmt_rp(total_debt),
        _fmt_rp(total_purchases),
        "",
    ]
    if not body:
        body = [["", "Tidak ada pelanggan pada rentang ini", "", "", "", "", "", "", ""]]
    data = [header] + body + [footer_row]

    col_widths = [12 * mm, 46 * mm, 30 * mm, 26 * mm, 62 * mm, 15 * mm, 24 * mm, 26 * mm, 24 * mm]
    table = Table(data, colWidths=col_widths, repeatRows=1)
    style = TableStyle([
        # Header
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#0F766E")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, 0), 8.5),
        ("ALIGN", (0, 0), (-1, 0), "CENTER"),
        # Body
        ("FONTSIZE", (0, 1), (-1, -1), 8),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("ALIGN", (0, 1), (0, -1), "CENTER"),
        ("ALIGN", (5, 1), (7, -1), "RIGHT"),
        ("ALIGN", (8, 1), (8, -1), "CENTER"),
        ("GRID", (0, 0), (-1, -1), 0.3, colors.HexColor("#D1D5DB")),
        ("ROWBACKGROUNDS", (0, 1), (-1, -2), [colors.white, colors.HexColor("#F9FAFB")]),
        # Footer
        ("BACKGROUND", (0, -1), (-1, -1), colors.HexColor("#ECFDF5")),
        ("FONTNAME", (0, -1), (-1, -1), "Helvetica-Bold"),
        ("ALIGN", (1, -1), (1, -1), "RIGHT"),
    ])
    table.setStyle(style)
    story.append(table)

    def _on_page(canvas, _doc):
        canvas.saveState()
        canvas.setFont("Helvetica", 7.5)
        canvas.setFillColor(colors.HexColor("#6B7280"))
        page_size = landscape(A4)
        w, h = page_size
        canvas.drawCentredString(
            w / 2, 5 * mm,
            "Air OXLY · Dokumen otomatis dari sistem — Halaman " + str(_doc.page),
        )
        canvas.restoreState()

    doc.build(story, onFirstPage=_on_page, onLaterPages=_on_page)
    return buf.getvalue()


@router.get("/customers.pdf")
async def export_customers_pdf(
    sales_id: Optional[str] = Query(None, description="Sales ID (required for admin/super_admin)"),
    from_no: int = Query(1, ge=1),
    to_no: int = Query(9999, ge=1),
    user=Depends(get_current_user),
):
    """Export data pelanggan sales tertentu ke PDF berdasarkan rentang nomor urut."""
    if from_no > to_no:
        raise HTTPException(400, "Nomor awal harus <= nomor akhir")

    if user["role"] == "sales":
        target_sales_id = user["id"]
    else:
        if not sales_id:
            raise HTTPException(400, "Parameter sales_id wajib untuk role Admin/SuperAdmin")
        target_sales_id = sales_id

    sales = await db.users.find_one({"id": target_sales_id, "role": "sales"}, {"_id": 0, "password_hash": 0})
    if not sales:
        raise HTTPException(404, "Sales tidak ditemukan")
    if user["role"] == "admin" and sales.get("group_letter") != user.get("group_letter"):
        raise HTTPException(403, "Sales bukan dari wilayah Anda")

    customers = await db.customers.find(
        {
            "created_by": target_sales_id,
            "customer_no": {"$gte": from_no, "$lte": to_no},
        },
        {"_id": 0},
    ).sort("customer_no", 1).to_list(5000)

    pdf_bytes = _build_customer_pdf(sales, customers, from_no, to_no)
    filename = f"Pelanggan_{sales.get('sales_code') or sales.get('username')}_{from_no}-{to_no}.pdf"
    return StreamingResponse(
        io.BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/customers/preview")
async def preview_customer_export(
    sales_id: Optional[str] = Query(None),
    from_no: int = Query(1, ge=1),
    to_no: int = Query(9999, ge=1),
    user=Depends(get_current_user),
):
    """Cek jumlah pelanggan yang akan ter-export TANPA generate PDF (lightweight)."""
    if user["role"] == "sales":
        target_sales_id = user["id"]
    else:
        if not sales_id:
            raise HTTPException(400, "Parameter sales_id wajib untuk role Admin/SuperAdmin")
        target_sales_id = sales_id

    sales = await db.users.find_one({"id": target_sales_id, "role": "sales"}, {"_id": 0})
    if not sales:
        raise HTTPException(404, "Sales tidak ditemukan")
    if user["role"] == "admin" and sales.get("group_letter") != user.get("group_letter"):
        raise HTTPException(403, "Sales bukan dari wilayah Anda")

    total_customers = await db.customers.count_documents({"created_by": target_sales_id})
    in_range = await db.customers.count_documents(
        {"created_by": target_sales_id, "customer_no": {"$gte": from_no, "$lte": to_no}}
    )
    min_max = await db.customers.aggregate([
        {"$match": {"created_by": target_sales_id}},
        {"$group": {"_id": None, "min_no": {"$min": "$customer_no"}, "max_no": {"$max": "$customer_no"}}},
    ]).to_list(1)
    stats = min_max[0] if min_max else {"min_no": 0, "max_no": 0}
    return {
        "sales_id": target_sales_id,
        "sales_code": sales.get("sales_code") or sales.get("username"),
        "sales_name": sales.get("name"),
        "total_customers": total_customers,
        "min_no": stats.get("min_no", 0),
        "max_no": stats.get("max_no", 0),
        "in_range": in_range,
        "from_no": from_no,
        "to_no": to_no,
    }
