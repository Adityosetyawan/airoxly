"""Central configuration: env, Mongo client, JWT constants, security primitives.

Everything downstream (routes, services) imports from here to avoid circular
imports and to keep environment/DB boot logic in one place.
"""
from __future__ import annotations

import os
from pathlib import Path

from dotenv import load_dotenv
from fastapi.security import OAuth2PasswordBearer
from motor.motor_asyncio import AsyncIOMotorClient
from passlib.context import CryptContext

ROOT_DIR = Path(__file__).resolve().parent.parent
load_dotenv(ROOT_DIR / ".env")

# --- Mongo ---
mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ["DB_NAME"]]

# --- JWT / auth ---
JWT_SECRET = os.environ.get("JWT_SECRET", "oxly-super-secret-change-in-prod-please")
JWT_ALG = "HS256"
JWT_EXPIRE_HOURS = 24 * 30  # 30 days for field usage

pwd_ctx = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login", auto_error=False)
