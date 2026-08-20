"""Warehouse stock computation & legacy field → part-name mapping."""
from __future__ import annotations

from core.config import db

# Mapping legacy incoming keys → canonical Part Name
LEGACY_ITEM_TO_PART_NAME = {
    "galon": "Galon Polos",
    "galon_polos": "Galon Polos",
    "galon_kran": "Galon Kran",
    "seal": "Seal",
    "mur": "Mur",
    "kran": "Kran",
    "stiker": "Stiker",
    "karet_kran": "Karet Kran",
    "stoper": "Stoper",
}

# Legacy hardcoded qty fields → canonical Part Name (produksi_daily)
LEGACY_FIELD_TO_PART_NAME_PRODUKSI = {
    "galon_ganti": "Galon Polos",
    "galon_kran": "Galon Kran",
    "galon_polos": "Galon Polos",
    "sil_ganti": "Seal",
    "mur_ganti": "Mur",
    "kran_ganti": "Kran",
    "stiker_ganti": "Stiker",
    "karet_kran_ganti": "Karet Kran",
    "stoper_ganti": "Stoper",
}

LEGACY_FIELD_TO_PART_NAME_GUDANG = {
    "galon_ganti": "Galon Polos",
    "galon_kran": "Galon Kran",
    "galon_polos": "Galon Polos",
    "seal_ganti": "Seal",
    "mur_ganti": "Mur",
    "kran_ganti": "Kran",
    "stiker_ganti": "Stiker",
    "karet_kran_ganti": "Karet Kran",
    "stoper_ganti": "Stoper",
}


def canonical_item(item: str) -> str:
    """Map any incoming/legacy item key to canonical Part Name."""
    if not item:
        return item
    return LEGACY_ITEM_TO_PART_NAME.get(item, item)


async def compute_stock() -> dict:
    """Compute current warehouse stock — dynamic per SuperAdmin's part_prices.

    Only WAREHOUSE INCOMING adds stock; production & warehouse-daily reduce it.
    Draft rows (is_draft=True) are excluded.
    """
    split = await compute_stock_split()
    return split.get("combined", {})


async def compute_stock_split() -> dict:
    """Compute stock split into Gudang & Produksi buckets.

    Flow:
      • warehouse_incoming     → +Gudang
      • sparepart_transfers    → -Gudang, +Produksi (Gudang kirim ke Produksi)
      • warehouse_daily.part_* → -Gudang (Gudang pakai untuk sales via part_qtys/legacy)
      • production_daily.part_* → -Produksi (Produksi pakai — tetap tercatat per sales)

    Returns: { gudang: {name: qty}, produksi: {name: qty}, combined: {name: gudang+produksi} }
    """
    parts_docs = await db.part_prices.find({}, {"_id": 0, "name": 1}).to_list(200)
    part_names = [p.get("name") for p in parts_docs if p.get("name")]
    gudang: dict = {n: 0 for n in part_names}
    produksi: dict = {n: 0 for n in part_names}

    def _bump(bucket: dict, name: str, delta: int):
        if not name:
            return
        bucket[name] = int(bucket.get(name, 0) or 0) + int(delta or 0)

    # Warehouse incoming → +Gudang
    async for row in db.warehouse_incoming.find({}, {"_id": 0}):
        item = row.get("item") or ""
        qty = int(row.get("qty", 0) or 0)
        _bump(gudang, canonical_item(item), qty)

    # Sparepart transfers Gudang → Produksi
    async for row in db.sparepart_transfers.find({}, {"_id": 0}):
        name = row.get("part_name") or ""
        qty = int(row.get("qty", 0) or 0)
        _bump(gudang, name, -qty)
        _bump(produksi, name, qty)

    # Produksi menggunakan sparepart → -Produksi
    async for row in db.production_daily.find({"is_draft": {"$ne": True}}, {"_id": 0}):
        for f, name in LEGACY_FIELD_TO_PART_NAME_PRODUKSI.items():
            v = int(row.get(f, 0) or 0)
            if v:
                _bump(produksi, name, -v)
        pq = row.get("part_qtys") or {}
        if isinstance(pq, dict):
            for name, qty in pq.items():
                try:
                    _bump(produksi, name, -int(qty or 0))
                except (TypeError, ValueError):
                    pass

    # Warehouse daily part usage (Gudang) → -Gudang
    async for row in db.warehouse_daily.find({"is_draft": {"$ne": True}}, {"_id": 0}):
        for f, name in LEGACY_FIELD_TO_PART_NAME_GUDANG.items():
            v = int(row.get(f, 0) or 0)
            if v:
                _bump(gudang, name, -v)
        pq = row.get("part_qtys") or {}
        if isinstance(pq, dict):
            for name, qty in pq.items():
                try:
                    _bump(gudang, name, -int(qty or 0))
                except (TypeError, ValueError):
                    pass

    combined = {n: (gudang.get(n, 0) + produksi.get(n, 0)) for n in part_names}
    return {"gudang": gudang, "produksi": produksi, "combined": combined}
