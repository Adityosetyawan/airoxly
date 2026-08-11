"""Small, dependency-light utilities shared across the codebase."""
from __future__ import annotations

from datetime import datetime, timezone
from math import asin, cos, radians, sin, sqrt


def now_utc() -> datetime:
    return datetime.now(timezone.utc)


def strip_id(doc: dict) -> dict:
    """Return a shallow copy of a Mongo doc with the internal `_id` removed."""
    if doc and "_id" in doc:
        doc = dict(doc)
        doc.pop("_id", None)
    return doc


def user_public(u: dict) -> dict:
    """Serialize a user document to the shape returned by /auth/me & /users endpoints."""
    return {
        "id": u["id"],
        "username": u["username"],
        "role": u["role"],
        "name": u.get("name"),
        "group_letter": u.get("group_letter"),
        "sales_code": u.get("sales_code"),
        "wa_number": u.get("wa_number"),
        "address": u.get("address"),
        "year_joined": u.get("year_joined"),
        "salary": u.get("salary"),
        "commission": u.get("commission"),
        "bonus": u.get("bonus"),
        "disabled": u.get("disabled", False),
        "google_email": u.get("google_email"),
        "picture": u.get("picture"),
        "kelompok": u.get("kelompok"),
    }


def haversine_m(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Great-circle distance between two lat/lng pairs, in meters."""
    r_earth = 6371000.0
    dlat = radians(lat2 - lat1)
    dlng = radians(lng2 - lng1)
    a = sin(dlat / 2) ** 2 + cos(radians(lat1)) * cos(radians(lat2)) * sin(dlng / 2) ** 2
    return 2 * r_earth * asin(sqrt(a))
