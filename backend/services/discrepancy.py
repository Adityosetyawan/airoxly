"""Compute daily bawa/kembali discrepancy per sales (Merah/Hijau logic)."""
from __future__ import annotations

from core.config import db


async def compute_discrepancy_for_date(sales_id: str, date: str) -> dict:
    """Compute daily selisih + color for one sales on one date.

    Business rule (confirmed by user via concrete examples):
      - bawa_total = Σ (bawa_pagi + bawa_siang)                   [galon isi]
      - galon_kembali = Σ (kosong_kembali_siang + kosong_kembali_sore)
      - selisih = galon_kembali − bawa_total
        · selisih > 0 → HIJAU (LEBIH, kembali > bawa)
        · selisih < 0 → MERAH (KURANG, kembali < bawa)
        · selisih = 0 → aman
    Backwards-compat: legacy rows kept "kosong pulang" in sisa_* fields.
    """
    wh_entries = await db.warehouse_daily.find(
        {"sales_id": sales_id, "date": date},
        {"_id": 0},
    ).to_list(100)
    bawa_total = 0
    galon_kembali = 0
    for e in wh_entries:
        bawa_total += int(e.get("bawa_pagi", 0) or 0) + int(e.get("bawa_siang", 0) or 0)
        kk_siang = e.get("kosong_kembali_siang")
        kk_sore = e.get("kosong_kembali_sore")
        if kk_siang is None and kk_sore is None:
            galon_kembali += int(e.get("sisa_pagi", 0) or 0) + int(e.get("sisa_siang", 0) or 0)
        else:
            galon_kembali += int(kk_siang or 0) + int(kk_sore or 0)
    hijau_cleared_any = any(e.get("hijau_cleared") for e in wh_entries)
    selisih = galon_kembali - bawa_total
    hijau_raw = selisih if selisih > 0 else 0
    merah = -selisih if selisih < 0 else 0
    hijau = 0 if hijau_cleared_any else hijau_raw
    return {
        "sales_id": sales_id,
        "date": date,
        "bawa_total": bawa_total,
        "galon_kembali": galon_kembali,
        "kosong_pulang": galon_kembali,
        "galon_ganti_produksi": bawa_total,
        "selisih": selisih,
        "merah": merah,
        "hijau": hijau,
        "hijau_raw": hijau_raw,
        "hijau_cleared": hijau_cleared_any,
        "warehouse_entry_ids": [e.get("id") for e in wh_entries],
    }
