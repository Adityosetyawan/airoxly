"""Health check probe (liveness + readiness via Mongo ping)."""
from __future__ import annotations

from fastapi import APIRouter
from fastapi.responses import JSONResponse

from core.config import db

router = APIRouter(prefix="/api", tags=["health"])


@router.get("/health")
async def health_check():
    """Liveness + readiness probe.
    Returns 200 when the DB ping succeeds so container orchestrators mark the
    instance healthy. Returns 503 on failure so upstream LBs can route around.
    """
    try:
        await db.command("ping")
        return {"status": "ok", "db": "connected"}
    except Exception as e:
        return JSONResponse(
            status_code=503,
            content={"status": "degraded", "db": "unreachable", "error": str(e)},
        )
