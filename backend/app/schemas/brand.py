from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, field_validator


class BrandCreate(BaseModel):
    name: str

    @field_validator("name")
    @classmethod
    def _clean_name(cls, v: str) -> str:
        v = (v or "").strip()
        if not v:
            raise ValueError("Brand name cannot be empty")
        if len(v) > 100:
            raise ValueError("Brand name is too long")
        return v


class BrandResponse(BaseModel):
    id: UUID
    name: str
    created_at: datetime | None = None

    model_config = {"from_attributes": True}
