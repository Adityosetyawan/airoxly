"""GPS tracking: sales ping, live map, history."""
from __future__ import annotations

import uuid
from datetime import datetime as _dt, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Depends

from core.config import db
from core.security import get_current_user, require_roles
from core.utils import haversine_m, now_utc
from models import LocationPing

router = APIRouter(prefix="/api/location", tags=["location"])

# Working hours (Asia/Jakarta = UTC+7). Sales GPS ping only accepted between
# GPS_START_HOUR (inclusive) and GPS_END_HOUR (exclusive).
GPS_START_HOUR = 8
GPS_END_HOUR = 17
JAKARTA_TZ = timezone(timedelta(hours=7))


def _is_within_working_hours() -> bool:
    """Return True when Jakarta local time is between GPS_START_HOUR (inclusive)
    and GPS_END_HOUR (exclusive). Falls back to True on any error."""
    try:
        now_jkt = _dt.now(JAKARTA_TZ)
        return GPS_START_HOUR <= now_jkt.hour < GPS_END_HOUR
    except Exception:
        return True


@router.post("/ping")
async def location_ping(body: LocationPing, user=Depends(get_current_user)):
    """GPS noise filter — skip if < min_move meters from previous ping and
    within last 5 minutes. Configurable via `settings.gps_min_move_m`.

    Also enforces server-side working-hours window (08:00–17:00 Asia/Jakarta):
    outside those hours the ping is silently ignored (no DB write, no error).
    """
    if not _is_within_working_hours():
        return {"ok": True, "skipped": "outside_working_hours", "window": f"{GPS_START_HOUR:02d}:00-{GPS_END_HOUR:02d}:00 WIB"}
    setting = await db.settings.find_one({"key": "gps_min_move_m"}, {"_id": 0})
    try:
        min_move_m = float((setting or {}).get("value") or 20)
    except Exception:
        min_move_m = 20.0
    last = await db.locations.find({"sales_id": user["id"]}, {"_id": 0}).sort("ts", -1).limit(1).to_list(1)
    if last and min_move_m > 0:
        prev = last[0]
        try:
            dist_m = haversine_m(prev["lat"], prev["lng"], body.lat, body.lng)
            prev_ts = _dt.fromisoformat((prev.get("ts") or "").replace("Z", "+00:00"))
            elapsed = (now_utc() - prev_ts).total_seconds()
        except Exception:
            dist_m = min_move_m + 1
            elapsed = 999
        if dist_m < min_move_m and elapsed < 300:
            ts_only = now_utc().isoformat()
            await db.users.update_one(
                {"id": user["id"]},
                {"$set": {"last_location": {"lat": body.lat, "lng": body.lng, "ts": ts_only}}},
            )
            return {"ok": True, "filtered": True, "distance_m": round(dist_m, 1)}
    doc = {
        "id": str(uuid.uuid4()),
        "sales_id": user["id"],
        "sales_code": user.get("sales_code") or user.get("username"),
        "group_letter": user.get("group_letter"),
        "lat": body.lat,
        "lng": body.lng,
        "ts": now_utc().isoformat(),
    }
    await db.locations.insert_one(doc)
    await db.users.update_one({"id": user["id"]}, {"$set": {"last_location": {"lat": body.lat, "lng": body.lng, "ts": doc["ts"]}}})
    return {"ok": True, "filtered": False}


@router.get("/live")
async def live_locations(user=Depends(require_roles("super_admin", "admin"))):
    q: dict = {"role": "sales"}
    if user["role"] == "admin":
        q["group_letter"] = user.get("group_letter")
    users = await db.users.find(q, {"_id": 0, "password_hash": 0}).to_list(1000)
    return [
        {
            "id": u["id"],
            "sales_code": u.get("sales_code"),
            "name": u.get("name"),
            "group_letter": u.get("group_letter"),
            "last_location": u.get("last_location"),
        }
        for u in users
    ]


@router.get("/history/{sales_id}")
async def location_history(sales_id: str, date: Optional[str] = None, user=Depends(require_roles("super_admin", "admin"))):
    q = {"sales_id": sales_id}
    if date:
        q["ts"] = {"$gte": date, "$lte": date + "T23:59:59"}
    return await db.locations.find(q, {"_id": 0}).sort("ts", 1).limit(2000).to_list(2000)
