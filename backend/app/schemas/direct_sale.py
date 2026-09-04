from pydantic import BaseModel, Field
from typing import List, Optional
from uuid import UUID
from datetime import datetime
from decimal import Decimal

class DirectSaleItemCreate(BaseModel):
    inventory_item_id: UUID
    batch_id: Optional[UUID] = None
    inventory_unit_id: Optional[UUID] = None
    quantity: int = Field(default=1, ge=1)
    unit_price: Decimal = Field(default=0, ge=0)

class DirectSaleCreate(BaseModel):
    buyer_name: str
    discount_amount: Decimal = Field(default=0, ge=0)
    items: List[DirectSaleItemCreate]

class DirectSaleItemOut(BaseModel):
    id: UUID
    inventory_item_id: UUID
    batch_id: Optional[UUID]
    inventory_unit_id: Optional[UUID]
    quantity: int
    unit_price: Decimal
    unit_cost: Decimal

    class Config:
        from_attributes = True

class DirectSaleOut(BaseModel):
    id: UUID
    buyer_name: str
    subtotal: Decimal
    discount_amount: Decimal
    total_amount: Decimal
    created_at: datetime
    items: List[DirectSaleItemOut]

    class Config:
        from_attributes = True
