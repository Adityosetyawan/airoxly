"""All Pydantic models used by the API.

Kept in a single module (rather than sub-packaged) to keep import lines short
and because Pydantic classes are tiny and rarely change together with logic.
"""
from __future__ import annotations

import uuid
from typing import Any, Dict, List, Literal, Optional

from pydantic import BaseModel, Field

Role = Literal["super_admin", "admin", "sales", "produksi", "gudang"]


# ============================================================
# AUTH / USERS
# ============================================================
class LoginRequest(BaseModel):
    username: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: dict


class SessionExchangeRequest(BaseModel):
    session_id: str


class UserPublic(BaseModel):
    id: str
    username: str
    role: Role
    name: Optional[str] = None
    group_letter: Optional[str] = None
    sales_code: Optional[str] = None
    wa_number: Optional[str] = None
    address: Optional[str] = None
    year_joined: Optional[int] = None
    salary: Optional[float] = None
    commission: Optional[float] = None
    bonus: Optional[float] = None
    disabled: bool = False
    google_email: Optional[str] = None
    picture: Optional[str] = None
    kelompok: Optional[str] = None


class UserCreate(BaseModel):
    username: str
    password: str
    role: Role
    name: Optional[str] = None
    group_letter: Optional[str] = None
    sales_code: Optional[str] = None
    wa_number: Optional[str] = None
    address: Optional[str] = None
    year_joined: Optional[int] = None
    salary: Optional[float] = 0
    commission: Optional[float] = 0
    bonus: Optional[float] = 0
    google_email: Optional[str] = None
    kelompok: Optional[str] = None


class UserUpdate(BaseModel):
    password: Optional[str] = None
    name: Optional[str] = None
    group_letter: Optional[str] = None
    sales_code: Optional[str] = None
    wa_number: Optional[str] = None
    address: Optional[str] = None
    year_joined: Optional[int] = None
    salary: Optional[float] = None
    commission: Optional[float] = None
    bonus: Optional[float] = None
    disabled: Optional[bool] = None
    google_email: Optional[str] = None
    role: Optional[Role] = None
    kelompok: Optional[str] = None


# ============================================================
# PRODUCTS
# ============================================================
class Product(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    unit: str  # "gln", "box"
    price: float
    order: int = 0


class ProductCreate(BaseModel):
    name: str
    unit: str
    price: float
    order: int = 0


class ProductUpdate(BaseModel):
    name: Optional[str] = None
    unit: Optional[str] = None
    price: Optional[float] = None
    order: Optional[int] = None


# ============================================================
# CUSTOMERS
# ============================================================
class CustomerCreate(BaseModel):
    name: str
    address: Optional[str] = ""
    wa_number: Optional[str] = ""
    barcode_id: Optional[str] = None
    lat: Optional[float] = None
    lng: Optional[float] = None
    photo_rumah: Optional[str] = None  # base64 / data URI


class CustomerUpdate(BaseModel):
    name: Optional[str] = None
    address: Optional[str] = None
    wa_number: Optional[str] = None
    lat: Optional[float] = None
    lng: Optional[float] = None
    photo_rumah: Optional[str] = None  # "" to remove


# ============================================================
# TRANSACTIONS
# ============================================================
class TransactionItem(BaseModel):
    product_id: str
    product_name: str
    unit: str
    qty: int
    price: float
    subtotal: float


class TransactionCreate(BaseModel):
    customer_id: str
    items: List[TransactionItem]
    bayar: float = 0
    pinjam_galon: int = 0
    galon_kembali: int = 0


class TransactionEdit(BaseModel):
    items: Optional[List[TransactionItem]] = None
    bayar: Optional[float] = None
    pinjam_galon: Optional[int] = None
    galon_kembali: Optional[int] = None


# ============================================================
# LOCATION
# ============================================================
class LocationPing(BaseModel):
    lat: float
    lng: float


# ============================================================
# LOTTERY
# ============================================================
class LotteryPeriodCreate(BaseModel):
    name: str
    start_date: str
    end_date: str
    winner_count: int = 1
    is_active: bool = False
    prize_description: Optional[str] = None
    description: Optional[str] = None


class LotteryPeriodUpdate(BaseModel):
    name: Optional[str] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    winner_count: Optional[int] = None
    is_active: Optional[bool] = None
    prize_description: Optional[str] = None
    description: Optional[str] = None


# ============================================================
# EXPENSES
# ============================================================
class ExpenseCreate(BaseModel):
    category: str
    description: Optional[str] = ""
    amount: float
    date: Optional[str] = None
    photo_base64: Optional[str] = None


class ExpenseUpdate(BaseModel):
    category: Optional[str] = None
    description: Optional[str] = None
    amount: Optional[float] = None
    photo_base64: Optional[str] = None


# ============================================================
# SETTINGS / PART PRICES / MONTHLY
# ============================================================
class PartPriceUpdate(BaseModel):
    name: str
    rp_per_pcs: float
    order: Optional[int] = 0


class SettingUpdate(BaseModel):
    key: str
    value: Any


class MonthlyReportUpdate(BaseModel):
    gaji_sopir: Optional[float] = None
    gaji_kernet: Optional[float] = None
    bonus_per_galon_1: Optional[float] = None
    bonus_per_galon_2: Optional[float] = None
    komisi: Optional[float] = None
    bonus_target_mg1: Optional[float] = None
    bonus_target_mg2: Optional[float] = None
    bonus_target_mg3: Optional[float] = None
    bonus_target_mg4: Optional[float] = None
    bonus_target_mg5: Optional[float] = None
    part_qtys: Optional[dict] = None


# ============================================================
# SHIFTS
# ============================================================
class ShiftItem(BaseModel):
    key: str
    label: str
    order: Optional[int] = None


class ShiftsPayload(BaseModel):
    shifts: List[ShiftItem]


# ============================================================
# ADMIN RESET
# ============================================================
class ResetRequest(BaseModel):
    confirm: str


# ============================================================
# AI
# ============================================================
class AICountRequest(BaseModel):
    image_base64: str
    hint: Optional[str] = None


# ============================================================
# PRODUCTION & WAREHOUSE
# ============================================================
class ProductionDailyCreate(BaseModel):
    date: str
    shift: str
    sales_id: str
    galon_ganti: int = 0
    galon_kran: int = 0
    galon_polos: int = 0
    sil_ganti: int = 0
    mur_ganti: int = 0
    kran_ganti: int = 0
    stiker_ganti: int = 0
    stoper_ganti: int = 0
    karet_kran_ganti: int = 0
    produksi_galon: int = 0
    stok_galon_baru: int = 0
    part_qtys: Optional[Dict[str, int]] = None
    destination: Literal["gudang", "sales"] = "gudang"
    ai_count_before: Optional[int] = None
    ai_count_after: Optional[int] = None
    manual_adjust: int = 0
    manual_adjust_before: int = 0
    photo_before: Optional[str] = None
    photo_after: Optional[str] = None
    ai_confidence: Optional[str] = None
    sisa_pagi: int = 0
    sisa_siang: int = 0
    note: Optional[str] = None
    is_draft: bool = False


class WarehouseDailyCreate(BaseModel):
    date: str
    shift: str
    sales_id: str
    galon_ganti: int = 0
    galon_kran: int = 0
    galon_polos: int = 0
    kran_ganti: int = 0
    seal_ganti: int = 0
    mur_ganti: int = 0
    stiker_ganti: int = 0
    karet_kran_ganti: int = 0
    stoper_ganti: int = 0
    part_qtys: Optional[Dict[str, int]] = None
    bawa_pagi: int = 0
    bawa_siang: int = 0
    kosong_kembali_siang: Optional[int] = None
    kosong_kembali_sore: Optional[int] = None
    kosong_pagi: int = 0
    kosong_siang: int = 0
    sisa_pagi: int = 0
    sisa_siang: int = 0
    photo_isi_pagi: Optional[str] = None
    photo_isi_siang: Optional[str] = None
    photo_kosong_siang: Optional[str] = None
    photo_kosong_sore: Optional[str] = None
    note: Optional[str] = None
    is_draft: bool = False


class ProductionDailyUpdate(BaseModel):
    shift: Optional[str] = None
    sales_id: Optional[str] = None
    galon_ganti: Optional[int] = None
    galon_kran: Optional[int] = None
    galon_polos: Optional[int] = None
    sil_ganti: Optional[int] = None
    mur_ganti: Optional[int] = None
    kran_ganti: Optional[int] = None
    stiker_ganti: Optional[int] = None
    stoper_ganti: Optional[int] = None
    karet_kran_ganti: Optional[int] = None
    produksi_galon: Optional[int] = None
    part_qtys: Optional[Dict[str, int]] = None
    destination: Optional[Literal["gudang", "sales"]] = None
    ai_count_before: Optional[int] = None
    ai_count_after: Optional[int] = None
    manual_adjust: Optional[int] = None
    manual_adjust_before: Optional[int] = None
    photo_before: Optional[str] = None
    photo_after: Optional[str] = None
    ai_confidence: Optional[str] = None
    sisa_pagi: Optional[int] = None
    sisa_siang: Optional[int] = None
    note: Optional[str] = None


class WarehouseDailyUpdate(BaseModel):
    shift: Optional[str] = None
    sales_id: Optional[str] = None
    galon_ganti: Optional[int] = None
    galon_kran: Optional[int] = None
    galon_polos: Optional[int] = None
    kran_ganti: Optional[int] = None
    seal_ganti: Optional[int] = None
    mur_ganti: Optional[int] = None
    stiker_ganti: Optional[int] = None
    karet_kran_ganti: Optional[int] = None
    stoper_ganti: Optional[int] = None
    part_qtys: Optional[Dict[str, int]] = None
    bawa_pagi: Optional[int] = None
    bawa_siang: Optional[int] = None
    kosong_kembali_siang: Optional[int] = None
    kosong_kembali_sore: Optional[int] = None
    kosong_pagi: Optional[int] = None
    kosong_siang: Optional[int] = None
    sisa_pagi: Optional[int] = None
    sisa_siang: Optional[int] = None
    photo_isi_pagi: Optional[str] = None
    photo_isi_siang: Optional[str] = None
    photo_kosong_siang: Optional[str] = None
    photo_kosong_sore: Optional[str] = None
    note: Optional[str] = None


class WarehouseIncomingCreate(BaseModel):
    date: str
    item: str
    qty: int
    note: Optional[str] = None
