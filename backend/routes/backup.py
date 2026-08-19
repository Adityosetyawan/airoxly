"""Full-data backup (Super Admin only).

Streams all core collections into a single ZIP file, each collection as a
UTF-8 CSV. Sensitive fields (`password_hash`, raw session tokens) are stripped.

Endpoints:
  - GET /api/backup/preview            → row counts per collection
  - GET /api/backup/export-all.zip     → downloadable ZIP archive
"""
from __future__ import annotations

import csv
import io
import json
import zipfile
from datetime import datetime
from typing import Any, Iterable, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse

from core.config import db
from core.security import get_current_user

router = APIRouter(prefix="/api/backup", tags=["backup"])


# Collections we export. Order matters: puts master data (users, products)
# first so a restore can re-link records.
_BACKUP_COLLECTIONS: list[tuple[str, dict]] = [
    ("users", {"password_hash": 0, "_id": 0}),
    ("products", {"_id": 0}),
    ("part_prices", {"_id": 0}),
    ("customers", {"_id": 0}),
    ("transactions", {"_id": 0}),
    ("expenses", {"_id": 0}),
    ("warehouse_daily", {"_id": 0}),
    ("warehouse_incoming", {"_id": 0}),
    ("production_daily", {"_id": 0}),
    ("monthly_reports", {"_id": 0}),
    ("lottery_periods", {"_id": 0}),
    ("lottery_tickets", {"_id": 0}),
    ("locations", {"_id": 0}),
    ("settings", {"_id": 0}),
]


def _flatten_value(v: Any) -> str:
    """Convert a Mongo value to a CSV-safe string."""
    if v is None:
        return ""
    if isinstance(v, bool):
        return "true" if v else "false"
    if isinstance(v, (int, float, str)):
        return str(v)
    if isinstance(v, datetime):
        try:
            return v.isoformat()
        except Exception:
            return str(v)
    # list / dict → JSON so it round-trips
    try:
        return json.dumps(v, ensure_ascii=False, default=str)
    except Exception:
        return str(v)


def _rows_to_csv(rows: Iterable[dict]) -> bytes:
    """Serialize a list of dicts to CSV bytes using the union of keys."""
    rows_list = list(rows)
    if not rows_list:
        return b""

    # Deterministic column order: gather keys as they first appear.
    seen: dict[str, None] = {}
    for r in rows_list:
        for k in r.keys():
            if k not in seen:
                seen[k] = None
    headers = list(seen.keys())

    buf = io.StringIO()
    writer = csv.writer(buf, quoting=csv.QUOTE_MINIMAL)
    writer.writerow(headers)
    for r in rows_list:
        writer.writerow([_flatten_value(r.get(h)) for h in headers])
    return buf.getvalue().encode("utf-8-sig")  # BOM → nice UX in Excel


async def _fetch_collection(name: str, projection: dict) -> list[dict]:
    coll = db.get_collection(name)
    try:
        # cap at 200k per collection for memory safety
        return await coll.find({}, projection).to_list(200_000)
    except Exception:
        return []


def _require_super_admin(user: dict) -> None:
    if user.get("role") != "super_admin":
        raise HTTPException(status_code=403, detail="Hanya Super Admin yang bisa akses backup")


@router.get("/preview")
async def preview_backup(user=Depends(get_current_user)):
    """Cheap COUNT per collection so UI can show what will be exported."""
    _require_super_admin(user)
    result: list[dict] = []
    total = 0
    for name, _ in _BACKUP_COLLECTIONS:
        try:
            n = await db.get_collection(name).count_documents({})
        except Exception:
            n = 0
        result.append({"name": name, "count": n})
        total += n
    return {"collections": result, "total_rows": total, "generated_at": datetime.utcnow().isoformat()}


@router.get("/export-all.zip")
async def export_all_backup(
    include: Optional[str] = Query(None, description="Comma-separated collection names. If omitted, exports all."),
    user=Depends(get_current_user),
):
    """Return a single ZIP with one CSV per collection."""
    _require_super_admin(user)

    wanted = set(x.strip() for x in include.split(",")) if include else None
    stamp = datetime.now().strftime("%Y%m%d_%H%M%S")

    # Build ZIP in memory. For our data volume (< a few million rows across
    # collections) this is safe on the Railway Hobby plan.
    buf = io.BytesIO()
    manifest: list[dict] = []
    with zipfile.ZipFile(buf, mode="w", compression=zipfile.ZIP_DEFLATED, compresslevel=6) as zf:
        for name, projection in _BACKUP_COLLECTIONS:
            if wanted and name not in wanted:
                continue
            rows = await _fetch_collection(name, projection)
            csv_bytes = _rows_to_csv(rows)
            zf.writestr(f"{name}.csv", csv_bytes)
            manifest.append({
                "collection": name,
                "rows": len(rows),
                "size_bytes": len(csv_bytes),
            })
        # Human-readable README
        readme = (
            "Air OXLY — Backup Data\n"
            f"Dibuat: {datetime.now().isoformat()}\n"
            f"Total koleksi: {len(manifest)}\n\n"
            "Isi:\n" + "\n".join(f"  - {m['collection']}.csv  ({m['rows']} baris)" for m in manifest)
            + "\n\nCatatan:\n"
              "  • Field password_hash & _id sengaja tidak diekspor.\n"
              "  • CSV pakai UTF-8 BOM supaya rapi di Excel.\n"
              "  • Nested field (array/object) diserialisasi sebagai JSON string.\n"
        )
        zf.writestr("README.txt", readme.encode("utf-8"))
        zf.writestr(
            "manifest.json",
            json.dumps(
                {
                    "generated_at": datetime.utcnow().isoformat(),
                    "generated_by": {
                        "id": user.get("id"),
                        "username": user.get("username"),
                    },
                    "collections": manifest,
                },
                ensure_ascii=False,
                indent=2,
            ).encode("utf-8"),
        )

    buf.seek(0)
    filename = f"AirOXLY_Backup_{stamp}.zip"
    return StreamingResponse(
        buf,
        media_type="application/zip",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "X-Backup-Filename": filename,
        },
    )
