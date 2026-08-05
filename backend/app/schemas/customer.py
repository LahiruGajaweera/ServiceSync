from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class CustomerCreate(BaseModel):
    name: str
    phone_number: str
    email: str | None = None
    address: str | None = None


class CustomerUpdate(BaseModel):
    name: str | None = None
    phone_number: str | None = None
    email: str | None = None
    address: str | None = None


class CustomerResponse(BaseModel):
    id: UUID
    name: str
    phone_number: str
    email: str | None = None
    address: str | None = None
    created_at: datetime

    model_config = {"from_attributes": True}
