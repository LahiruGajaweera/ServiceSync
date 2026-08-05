from datetime import datetime
from decimal import Decimal
from typing import Literal
from uuid import UUID

from pydantic import BaseModel


class SalvageCreate(BaseModel):
    job_id: UUID
    scraped_market_price: Decimal | None = None
    refurbish_cost_estimate: Decimal | None = None
    refurbish_value: Decimal | None = None
    salvage_value: Decimal | None = None
    recommendation: Literal["refurbish", "salvage_for_parts"]


class SalvageStatusUpdate(BaseModel):
    status: Literal["approved", "rejected"]


class SalvageResponse(BaseModel):
    id: UUID
    job_id: UUID
    scraped_market_price: Decimal | None
    refurbish_cost_estimate: Decimal | None
    refurbish_value: Decimal | None
    salvage_value: Decimal | None
    recommendation: str | None
    assessed_by: UUID | None
    status: str
    assessed_at: datetime | None

    model_config = {"from_attributes": True}
