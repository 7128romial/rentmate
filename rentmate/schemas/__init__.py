"""Pydantic v2 request schemas — validate at API boundaries."""

from datetime import date
from typing import Optional

from pydantic import BaseModel, EmailStr, Field, field_validator


class RegisterIn(BaseModel):
    email: str
    password: str = Field(min_length=8, max_length=128)
    confirm_password: str
    first_name: str = Field(min_length=1, max_length=50)
    last_name: str = Field(min_length=1, max_length=50)
    phone: Optional[str] = None
    city: Optional[str] = None
    age: Optional[int] = Field(default=None, ge=16, le=120)
    gender: Optional[str] = None
    role: str = "tenant"

    @field_validator("email")
    @classmethod
    def _email_shape(cls, v):
        if "@" not in v or "." not in v.split("@")[-1]:
            raise ValueError("invalid email")
        return v.strip().lower()

    @field_validator("role")
    @classmethod
    def _role(cls, v):
        if v not in {"tenant", "roommate", "landlord"}:
            raise ValueError("invalid role")
        return v


class LoginIn(BaseModel):
    email: str
    password: str
    remember: bool = False


class MessageIn(BaseModel):
    body: str = Field(min_length=1, max_length=5000)


class ProfileUpdateIn(BaseModel):
    tab: str
    # Free-form dict-ish passthrough; individual fields validated in handler
    data: Optional[dict] = None


class PropertyCreateIn(BaseModel):
    title: str = Field(min_length=3, max_length=200)
    description: Optional[str] = None
    city: str
    neighborhood: Optional[str] = None
    address: Optional[str] = None
    property_type: str
    rooms: float = Field(ge=0, le=20)
    floor: int = Field(ge=-5, le=100)
    size_sqm: int = Field(ge=0, le=5000)
    rent_price: int = Field(gt=0, le=1_000_000)
    furnished: bool = False
    parking: bool = False
    elevator: bool = False
    balcony: bool = False
    ac: bool = False
    storage: bool = False
    pets_allowed: bool = False
    smoking_allowed: bool = False
    available_from: Optional[date] = None
    min_rental_months: int = 12
    roommate_gender: Optional[str] = None
    max_roommates: Optional[int] = None

    @field_validator("property_type")
    @classmethod
    def _type(cls, v):
        if v not in {"apartment", "room", "studio", "house"}:
            raise ValueError("invalid property_type")
        return v
