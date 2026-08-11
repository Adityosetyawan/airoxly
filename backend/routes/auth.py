"""Authentication: login (JWT), Google session exchange, logout, me."""
from __future__ import annotations

import logging
import secrets
from datetime import datetime, timedelta, timezone

import httpx
from fastapi import APIRouter, Depends, HTTPException

from core.config import db, oauth2_scheme
from core.security import create_token, get_current_user, verify_password
from core.utils import user_public
from models import LoginRequest, SessionExchangeRequest, TokenResponse

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/login", response_model=TokenResponse)
async def login(body: LoginRequest):
    user = await db.users.find_one({"username": body.username.strip()}, {"_id": 0})
    if not user or user.get("disabled") or not verify_password(body.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Username atau password salah")
    token = create_token(user["id"])
    return TokenResponse(access_token=token, user=user_public(user))


@router.get("/me")
async def me(user=Depends(get_current_user)):
    return user_public(user)


@router.post("/session")
async def google_session_exchange(body: SessionExchangeRequest):
    """Exchange a one-time Emergent `session_id` for a 7-day `session_token`."""
    session_id = (body.session_id or "").strip()
    if not session_id:
        raise HTTPException(status_code=400, detail="session_id required")

    try:
        async with httpx.AsyncClient(timeout=10.0) as _client:
            r = await _client.get(
                "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
                headers={"X-Session-ID": session_id},
            )
    except Exception as e:
        logging.exception("Emergent session resolve failed: %s", e)
        raise HTTPException(status_code=401, detail="Gagal verifikasi sesi Google")
    if r.status_code != 200:
        raise HTTPException(status_code=401, detail="Sesi Google tidak valid / kedaluwarsa")
    data = r.json() or {}
    email = (data.get("email") or "").strip().lower()
    if not email:
        raise HTTPException(status_code=401, detail="Email Google tidak tersedia")
    picture = data.get("picture")

    user = await db.users.find_one(
        {"$or": [{"google_email": email}, {"username": email}]},
        {"_id": 0},
    )
    if not user:
        raise HTTPException(
            status_code=401,
            detail=f"Akun Google {email} belum terdaftar. Hubungi Super Admin untuk registrasi.",
        )
    if user.get("disabled"):
        raise HTTPException(status_code=403, detail="Akun dinonaktifkan")

    session_token = "emg_" + secrets.token_urlsafe(48)
    expires_at = datetime.now(timezone.utc) + timedelta(days=7)
    await db.user_sessions.insert_one(
        {
            "session_token": session_token,
            "user_id": user["id"],
            "email": email,
            "created_at": datetime.now(timezone.utc),
            "expires_at": expires_at,
        }
    )

    updates: dict = {}
    if not user.get("google_email"):
        updates["google_email"] = email
    if picture and user.get("picture") != picture:
        updates["picture"] = picture
    if updates:
        await db.users.update_one({"id": user["id"]}, {"$set": updates})
        user.update(updates)

    return {"session_token": session_token, "user": user_public(user)}


@router.post("/logout")
async def auth_logout(user=Depends(get_current_user), token: str = Depends(oauth2_scheme)):
    if token and token.startswith("emg_"):
        await db.user_sessions.delete_one({"session_token": token})
    return {"ok": True}
