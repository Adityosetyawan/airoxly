from pydantic import BaseModel, Field
from typing import List, Optional
import uuid
from datetime import datetime


def _id():
    return str(uuid.uuid4())


class LoginReq(BaseModel):
    username: str
    password: str


class UserCreate(BaseModel):
    name: str
    username: str
    password: Optional[str] = "123456"
    role: str
    area: Optional[str] = "Area A"
    target: Optional[int] = 0


class ProductCreate(BaseModel):
    name: str
    price: int
    stock: Optional[int] = 0
    refill: Optional[bool] = False


class CustomerCreate(BaseModel):
    name: str
    phone: Optional[str] = ""
    address: Optional[str] = ""
    area: Optional[str] = "Area A"


class TxItem(BaseModel):
    productId: str
    name: str
    qty: int
    price: int


class TransactionCreate(BaseModel):
    customerId: str
    items: List[TxItem]
    bayar: Optional[int] = 0
    galonPinjam: Optional[int] = 0
    galonKembali: Optional[int] = 0


class ExpenseCreate(BaseModel):
    title: str
    amount: int
    category: Optional[str] = "Lain-lain"


class TransferCreate(BaseModel):
    partId: str
    qty: int
    note: Optional[str] = ""


class PingReq(BaseModel):
    lat: float
    lng: float


class ResetReq(BaseModel):
    type: str  # "half" atau "all"
