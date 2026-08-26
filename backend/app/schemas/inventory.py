from datetime import datetime
from decimal import Decimal
from typing import Literal
from uuid import UUID

from pydantic import BaseModel


class InventoryItemCreate(BaseModel):
    name: str
    category: str
    compatible_brands: list[str] = []
    compatible_models: list[str] = []
    part_type: Literal["factory_new", "salvaged"]
    min_stock_threshold: int = 2
    track_serial: bool = False
    # Optional initial stock — seeds the first batch when provided.
    quantity: int | None = None
    unit_cost: Decimal | None = None
    unit_price: Decimal | None = None
    supplier: str | None = None
    serial_numbers: list[str] | None = None


class StockAdjustRequest(BaseModel):
    delta: int  # positive = restock, negative = consume
    reason: str
    note: str | None = None
    batch_id: UUID | None = None


class ReceiveStockRequest(BaseModel):
    """Record a new purchase batch of an existing catalog item."""

    supplier: str | None = None
    unit_cost: Decimal
    quantity: int
    purchased_at: datetime | None = None
    new_selling_price: Decimal | None = None
    serial_numbers: list[str] | None = None


class InventoryItemUpdate(BaseModel):
    name: str | None = None
    category: str | None = None
    compatible_brands: list[str] | None = None
    compatible_models: list[str] | None = None
    part_type: Literal["factory_new", "salvaged"] | None = None
    min_stock_threshold: int | None = None
    track_serial: bool | None = None
    supplier: str | None = None


class InventoryBatchResponse(BaseModel):
    id: UUID
    batch_code: str
    inventory_item_id: UUID
    supplier: str | None = None
    unit_cost: Decimal
    quantity_received: int
    quantity_remaining: int
    purchased_at: datetime | None = None
    created_at: datetime | None = None

    model_config = {"from_attributes": True}


class InventoryItemResponse(BaseModel):
    id: UUID
    sku: str | None = None
    name: str
    category: str
    compatible_brands: list
    compatible_models: list
    part_type: str
    quantity: int
    unit_price: Decimal
    min_stock_threshold: int
    supplier: str | None = None
    track_serial: bool = False
    is_low_stock: bool = False
    batches: list[InventoryBatchResponse] = []
    created_at: datetime

    model_config = {"from_attributes": True}


class InventoryAdjustmentLogResponse(BaseModel):
    id: UUID
    inventory_item_id: UUID
    user_id: UUID
    batch_id: UUID | None = None
    delta: int
    reason: str
    note: str | None = None
    created_at: datetime
    # Extra fields for display
    admin_name: str | None = None
    item_name: str | None = None
    batch_code: str | None = None

    model_config = {"from_attributes": True}
