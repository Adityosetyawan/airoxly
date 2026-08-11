"""Air OXLY API — thin entry point.

All models, routes, and services live in dedicated modules. This file only:
  1. Instantiates the FastAPI app.
  2. Wires the startup / shutdown handlers.
  3. Registers every router in one place.
  4. Applies CORS.

If you're looking for endpoint code, see `routes/*.py`.
"""
from __future__ import annotations

import logging
import os

from fastapi import FastAPI
from starlette.middleware.cors import CORSMiddleware

from core.config import client
from routes import register_routes
from services.seed import run_seed

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)

app = FastAPI(title="Air OXLY API")


@app.on_event("startup")
async def _on_startup():
    await run_seed()


@app.on_event("shutdown")
async def _on_shutdown():
    client.close()


# Register all API routers
register_routes(app)

# Configurable CORS — set CORS_ORIGINS in .env for production
_cors_env = os.getenv("CORS_ORIGINS", "*").strip()
_cors_origins = (
    [o.strip() for o in _cors_env.split(",") if o.strip()]
    if _cors_env != "*"
    else ["*"]
)
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True if _cors_origins != ["*"] else False,
    allow_origins=_cors_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)
