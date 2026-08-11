"""Lottery helper functions (ticket codes, period activation)."""
from __future__ import annotations

import secrets
import string
import uuid

from core.config import db


def gen_ticket_code() -> str:
    """Generate a random OXLY-XXXXXX ticket code (6 uppercase alphanumeric)."""
    return "OXLY-" + "".join(
        secrets.choice(string.ascii_uppercase + string.digits) for _ in range(6)
    )


async def gen_unique_ticket_code() -> str:
    """Generate a ticket code guaranteed unique in db.lottery_tickets."""
    for _ in range(10):
        code = gen_ticket_code()
        exists = await db.lottery_tickets.find_one({"ticket_code": code}, {"_id": 1})
        if not exists:
            return code
    return "OXLY-" + uuid.uuid4().hex[:8].upper()


async def deactivate_all_periods():
    await db.lottery_periods.update_many({}, {"$set": {"is_active": False}})
