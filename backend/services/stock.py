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
    parts_docs = await db.part_prices.find({}, {"_id": 0, "name": 1}).to_list(200)
    part_names = [p.get("name") for p in parts_docs if p.get("name")]
    stock: dict = {n: 0 for n in part_names}

    def _bump(name: str, delta: int):
        if not name:
            return
        stock[name] = int(stock.get(name, 0) or 0) + int(delta or 0)

    async for row in db.warehouse_incoming.find({}, {"_id": 0}):
        item = row.get("item") or ""
        qty = int(row.get("qty", 0) or 0)
        _bump(canonical_item(item), qty)

    async for row in db.production_daily.find({"is_draft": {"$ne": True}}, {"_id": 0}):
        for f, name in LEGACY_FIELD_TO_PART_NAME_PRODUKSI.items():
            v = int(row.get(f, 0) or 0)
            if v:
                _bump(name, -v)
        pq = row.get("part_qtys") or {}
        if isinstance(pq, dict):
            for name, qty in pq.items():
                try:
                    _bump(name, -int(qty or 0))
                except (TypeError, ValueError):
                    pass

    async for row in db.warehouse_daily.find({"is_draft": {"$ne": True}}, {"_id": 0}):
        for f, name in LEGACY_FIELD_TO_PART_NAME_GUDANG.items():
            v = int(row.get(f, 0) or 0)
            if v:
                _bump(name, -v)
        pq = row.get("part_qtys") or {}
        if isinstance(pq, dict):
            for name, qty in pq.items():
                try:
                    _bump(name, -int(qty or 0))
                except (TypeError, ValueError):
                    pass

    return stock
