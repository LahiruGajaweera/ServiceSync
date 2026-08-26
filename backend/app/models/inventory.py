import uuid
from sqlalchemy import Boolean, Column, Enum, ForeignKey, Integer, Numeric, String, DateTime, func
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from app.core.database import Base


class InventoryItem(Base):
    __tablename__ = "inventory_items"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    sku = Column(String(40), unique=True, nullable=True, index=True)
    name = Column(String(200), nullable=False)
    category = Column(String(100), nullable=False)
    compatible_brands = Column(JSONB, default=list)
    compatible_models = Column(JSONB, default=list)
    part_type = Column(
        Enum("factory_new", "salvaged", name="part_type"), nullable=False
    )
    quantity = Column(Integer, nullable=False, default=0)
    unit_price = Column(Numeric(10, 2), nullable=False, default=0)
    min_stock_threshold = Column(Integer, nullable=False, default=2)
    supplier = Column(String(200), nullable=True)
    track_serial = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    batches = relationship(
        "InventoryBatch",
        back_populates="item",
        cascade="all, delete-orphan",
        order_by="InventoryBatch.purchased_at",
    )
    units = relationship(
        "InventoryUnit",
        back_populates="item",
        cascade="all, delete-orphan",
    )


class InventoryBatch(Base):
    """One purchase lot of an inventory item — its own supplier and price."""

    __tablename__ = "inventory_batches"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    batch_code = Column(String(60), unique=True, nullable=False, index=True)
    inventory_item_id = Column(
        UUID(as_uuid=True), ForeignKey("inventory_items.id"), nullable=False, index=True
    )
    supplier = Column(String(200), nullable=True)
    unit_cost = Column(Numeric(10, 2), nullable=False, default=0)
    quantity_received = Column(Integer, nullable=False, default=0)
    quantity_remaining = Column(Integer, nullable=False, default=0)
    purchased_at = Column(DateTime(timezone=True), server_default=func.now())
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    item = relationship("InventoryItem", back_populates="batches")
    units = relationship("InventoryUnit", back_populates="batch", cascade="all, delete-orphan")


class InventoryUnit(Base):
    """An individual physical unit with a unique serial number."""

    __tablename__ = "inventory_units"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    inventory_item_id = Column(
        UUID(as_uuid=True), ForeignKey("inventory_items.id"), nullable=False, index=True
    )
    batch_id = Column(
        UUID(as_uuid=True), ForeignKey("inventory_batches.id"), nullable=False, index=True
    )
    serial_number = Column(String(100), unique=True, nullable=False, index=True)
    status = Column(
        Enum("in_stock", "used", "returned", "lost", name="unit_status"),
        nullable=False,
        default="in_stock",
    )
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    item = relationship("InventoryItem", back_populates="units")
    batch = relationship("InventoryBatch", back_populates="units")


class InventoryAdjustmentLog(Base):
    __tablename__ = "inventory_adjustment_logs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    inventory_item_id = Column(
        UUID(as_uuid=True), ForeignKey("inventory_items.id"), nullable=False, index=True
    )
    user_id = Column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True
    )
    batch_id = Column(
        UUID(as_uuid=True), ForeignKey("inventory_batches.id"), nullable=True, index=True
    )
    delta = Column(Integer, nullable=False)
    reason = Column(String(50), nullable=False)
    note = Column(String(500), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    item = relationship("InventoryItem")
    user = relationship("User")
    batch = relationship("InventoryBatch")
