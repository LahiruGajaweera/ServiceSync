from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, field_validator

from app.schemas.auth import normalize_phone


class SupplierCreate(BaseModel):
    name: str
    phone_number: str
    email: str | None = None
    address: str | None = None

    @field_validator("phone_number", mode="before")
    def validate_phone(cls, v: str) -> str:
        return normalize_phone(v)


class SupplierUpdate(BaseModel):
    name: str | None = None
    phone_number: str | None = None
    email: str | None = None
    address: str | None = None

    @field_validator("phone_number", mode="before")
    def validate_phone(cls, v: str | None) -> str | None:
        return normalize_phone(v) if v else v


class SupplierResponse(BaseModel):
    id: UUID
    name: str
    phone_number: str
    email: str | None = None
    address: str | None = None
    created_at: datetime

    model_config = {"from_attributes": True}
