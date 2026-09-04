import uuid
from sqlalchemy import Column, String, Numeric, DateTime, ForeignKey, Integer, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.core.database import Base

class DirectSale(Base):
    __tablename__ = "direct_sales"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    buyer_name = Column(String(255), nullable=False)
    subtotal = Column(Numeric(10, 2), nullable=False, default=0)
    discount_amount = Column(Numeric(10, 2), nullable=False, default=0)
    total_amount = Column(Numeric(10, 2), nullable=False, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    items = relationship("DirectSaleItem", back_populates="sale", cascade="all, delete-orphan")


class DirectSaleItem(Base):
    __tablename__ = "direct_sale_items"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    direct_sale_id = Column(UUID(as_uuid=True), ForeignKey("direct_sales.id"), nullable=False)
    inventory_item_id = Column(UUID(as_uuid=True), ForeignKey("inventory_items.id"), nullable=False)
    
    batch_id = Column(UUID(as_uuid=True), ForeignKey("inventory_batches.id"), nullable=True)
    inventory_unit_id = Column(UUID(as_uuid=True), ForeignKey("inventory_units.id"), nullable=True)
    
    quantity = Column(Integer, nullable=False, default=1)
    unit_cost = Column(Numeric(10, 2), nullable=False, default=0)
    unit_price = Column(Numeric(10, 2), nullable=False, default=0)
    
    sale = relationship("DirectSale", back_populates="items")
    item = relationship("InventoryItem")
    batch = relationship("InventoryBatch")
    unit = relationship("InventoryUnit")
