from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, field_validator


class PhoneModelCreate(BaseModel):
    brand: str
    name: str

    @field_validator("brand", "name")
    @classmethod
    def _clean(cls, v: str) -> str:
        v = (v or "").strip()
        if not v:
            raise ValueError("Value cannot be empty")
        return v


class PhoneModelResponse(BaseModel):
    id: UUID
    brand: str
    name: str
    created_at: datetime | None = None

    model_config = {"from_attributes": True}
