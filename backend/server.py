from fastapi import FastAPI
from starlette.middleware.cors import CORSMiddleware
import logging

from db import db, seed_if_empty
import auth as auth_mod
from routes_core import router as core_router
from routes_ops import router as ops_router

app = FastAPI(title="Air OXLY API")

app.include_router(core_router)
app.include_router(ops_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@app.get("/api/")
async def root():
    return {"message": "Air OXLY API aktif"}


@app.on_event("startup")
async def on_startup():
    auth_mod.set_db(db)
    await seed_if_empty()
    logger.info("Air OXLY backend siap & data ter-seed.")


@app.on_event("shutdown")
async def on_shutdown():
    pass
