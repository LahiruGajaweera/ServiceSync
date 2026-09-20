from datetime import datetime
from decimal import Decimal
from typing import Literal
from uuid import UUID

from pydantic import BaseModel


class PartBreakdownItem(BaseModel):
    part: str
    condition: str
    value: float


class SalvageCreate(BaseModel):
    job_id: UUID
    scraped_market_price: Decimal | None = None
    refurbish_cost_estimate: Decimal | None = None
    refurbish_value: Decimal | None = None
    salvage_value: Decimal | None = None
    recommendation: Literal["refurbish", "salvage_for_parts"] | None = None
    parts_breakdown: list[PartBreakdownItem] | None = None
    notes: str | None = None


class SalvageStatusUpdate(BaseModel):
    status: Literal["approved", "rejected"]


class LiveEstimateRequest(BaseModel):
    job_id: UUID
    scraped_market_price: Decimal | None = None


class LiveEstimateResponse(BaseModel):
    refurbish_cost_estimate: Decimal
    salvage_value: Decimal
    refurbish_value: Decimal
    recommendation: str
    parts_breakdown: list[PartBreakdownItem] = []
    ai_confidence: float | None = None


class SalvageResponse(BaseModel):
    id: UUID
    job_id: UUID
    scraped_market_price: Decimal | None
    refurbish_cost_estimate: Decimal | None
    refurbish_value: Decimal | None
    salvage_value: Decimal | None
    recommendation: str | None
    parts_breakdown: list[dict] | None = None
    notes: str | None = None
    ai_confidence: float | None = None
    
    # Phase 2
    actual_refurbish_cost: Decimal | None = None
    actual_resale_price: Decimal | None = None
    actual_parts_revenue: Decimal | None = None
    profit_loss: Decimal | None = None
    ai_accuracy_score: float | None = None
    
    assessed_by: UUID | None
    status: str
    assessed_at: datetime | None

    model_config = {"from_attributes": True}


class NotesUpdate(BaseModel):
    notes: str


class SalvageActualsUpdate(BaseModel):
    actual_refurbish_cost: Decimal | None = None
    actual_resale_price: Decimal | None = None
    actual_parts_revenue: Decimal | None = None


class BatchEstimateRequest(BaseModel):
    job_ids: list[UUID]

