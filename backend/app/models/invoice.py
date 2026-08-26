import uuid
from sqlalchemy import Column, Enum, ForeignKey, Integer, Numeric, String, Text, DateTime, func
from sqlalchemy.dialects.postgresql import UUID
from app.core.database import Base


class Invoice(Base):
    __tablename__ = "invoices"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    job_id = Column(UUID(as_uuid=True), ForeignKey("jobs.id"), unique=True, nullable=False)
    subtotal = Column(Numeric(10, 2), nullable=False, default=0)
    tax_amount = Column(Numeric(10, 2), nullable=False, default=0)
    total_amount = Column(Numeric(10, 2), nullable=False, default=0)
    payment_status = Column(
        Enum("unpaid", "paid", "partial", name="payment_status"),
        nullable=False,
        default="unpaid",
    )
    payment_method = Column(String(50), nullable=True)
    qr_code_data = Column(Text, nullable=True)
    paid_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())


class JobPartUsed(Base):
    __tablename__ = "job_parts_used"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    job_id = Column(UUID(as_uuid=True), ForeignKey("jobs.id"), nullable=False)
    part_source = Column(
        Enum("inventory", "donor", name="part_source"), nullable=False
    )
    inventory_item_id = Column(
        UUID(as_uuid=True), ForeignKey("inventory_items.id"), nullable=True
    )
    donor_part_id = Column(
        UUID(as_uuid=True), ForeignKey("donor_parts.id"), nullable=True
    )
    batch_id = Column(
        UUID(as_uuid=True), ForeignKey("inventory_batches.id"), nullable=True
    )
    inventory_unit_id = Column(
        UUID(as_uuid=True), ForeignKey("inventory_units.id"), nullable=True
    )
    used_by_technician_id = Column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=True
    )
    quantity = Column(Integer, nullable=False, default=1)
    unit_cost = Column(Numeric(10, 2), nullable=False, default=0)
    unit_price = Column(Numeric(10, 2), nullable=False, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
