from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, field_validator


class PartSpecCreate(BaseModel):
    name: str

    @field_validator("name")
    @classmethod
    def _clean_name(cls, v: str) -> str:
        v = (v or "").strip().upper()
        if not v:
            raise ValueError("Spec cannot be empty")
        if len(v) > 60:
            raise ValueError("Spec is too long")
        return v


class PartSpecResponse(BaseModel):
    id: UUID
    name: str
    created_at: datetime | None = None

    model_config = {"from_attributes": True}
