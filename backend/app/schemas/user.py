from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, EmailStr


class UserCreate(BaseModel):
    name: str
    email: EmailStr
    password: str
    role: Literal["admin", "technician"]


class TechnicianCreate(BaseModel):
    """Admin-issued technician account. Password is auto-generated server-side."""

    name: str
    email: EmailStr
    phone_number: str


class UserUpdate(BaseModel):
    name: str | None = None
    is_active: bool | None = None


class UserResponse(BaseModel):
    id: UUID
    name: str
    email: str | None = None
    avatar_url: str | None = None
    role: str
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class TechnicianCreateResponse(BaseModel):
    """Returned once when an admin creates a technician.

    ``temporary_password`` is surfaced so the admin can relay it while the SMS
    gateway is mocked; drop it from the response once real SMS delivery is live.
    """

    user: UserResponse
    temporary_password: str
    sms_sent: bool
