"""Password hashing, JWT signing, and FastAPI auth dependencies."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Optional

import jwt
from fastapi import Depends, HTTPException

from core.config import JWT_ALG, JWT_EXPIRE_HOURS, JWT_SECRET, db, oauth2_scheme, pwd_ctx
from core.utils import now_utc


def hash_password(pwd: str) -> str:
    return pwd_ctx.hash(pwd)


def verify_password(pwd: str, hashed: str) -> bool:
    try:
        return pwd_ctx.verify(pwd, hashed)
    except Exception:
        return False


def create_token(user_id: str) -> str:
    payload = {
        "sub": user_id,
        "iat": now_utc(),
        "exp": now_utc() + timedelta(hours=JWT_EXPIRE_HOURS),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALG)


async def get_current_user(token: Optional[str] = Depends(oauth2_scheme)):
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    user_id: Optional[str] = None
    # 1) Emergent Google session_token (prefix "emg_")
    if token.startswith("emg_"):
        sess = await db.user_sessions.find_one({"session_token": token}, {"_id": 0})
        if not sess:
            raise HTTPException(status_code=401, detail="Invalid session")
        exp = sess.get("expires_at")
        if exp is not None:
            if exp.tzinfo is None:
                exp = exp.replace(tzinfo=timezone.utc)
            if exp < datetime.now(timezone.utc):
                raise HTTPException(status_code=401, detail="Session expired")
        user_id = sess.get("user_id")
    else:
        # 2) JWT flow (username/password)
        try:
            payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALG])
            user_id = payload.get("sub")
        except Exception:
            raise HTTPException(status_code=401, detail="Invalid token")
    user = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not user or user.get("disabled"):
        raise HTTPException(status_code=401, detail="User not found or disabled")
    return user


def require_roles(*roles: str):
    async def dep(user=Depends(get_current_user)):
        if user["role"] not in roles:
            raise HTTPException(status_code=403, detail="Insufficient role")
        return user

    return dep
