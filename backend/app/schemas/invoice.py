from datetime import datetime
from decimal import Decimal
from typing import Literal
from uuid import UUID

from pydantic import BaseModel


class JobPartCreate(BaseModel):
    part_source: Literal["inventory", "donor"]
    inventory_item_id: UUID | None = None
    donor_part_id: UUID | None = None
    batch_id: UUID | None = None
    quantity: int = 1
    unit_cost: Decimal | None = None  # auto-filled from batch for inventory parts
    override_price: Decimal | None = None


class ConsumeByBatchRequest(BaseModel):
    """Consume stock from a single batch identified by its human-readable code."""

    batch_code: str
    job_id: UUID
    technician_id: UUID | None = None
    quantity: int = 1


class JobPartResponse(BaseModel):
    id: UUID
    job_id: UUID
    part_source: str
    inventory_item_id: UUID | None
    donor_part_id: UUID | None
    batch_id: UUID | None = None
    batch_code: str | None = None
    supplier: str | None = None
    used_by_technician_id: UUID | None = None
    used_by_name: str | None = None
    quantity: int
    unit_cost: Decimal
    unit_price: Decimal | None = None
    part_name: str | None = None
    created_at: datetime | None = None

    model_config = {"from_attributes": True}


class InvoiceCreate(BaseModel):
    job_id: UUID
    labor_cost: Decimal = Decimal("0.00")
    tax_rate: Decimal = Decimal("0.00")


class MarkPaidRequest(BaseModel):
    payment_method: Literal["cash", "card", "transfer"]


class InvoiceResponse(BaseModel):
    id: UUID
    job_id: UUID
    subtotal: Decimal
    tax_amount: Decimal
    total_amount: Decimal
    payment_status: str
    payment_method: str | None
    qr_code_data: str | None
    paid_at: datetime | None
    created_at: datetime | None

    model_config = {"from_attributes": True}
