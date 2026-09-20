import uuid
from sqlalchemy import Boolean, Column, Enum, ForeignKey, String, DateTime, func, Numeric
from sqlalchemy.dialects.postgresql import UUID, JSONB
from app.core.database import Base


class DonorDevice(Base):
    __tablename__ = "donor_devices"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    brand = Column(String(100), nullable=False)
    model = Column(String(100), nullable=False)
    imei = Column(String(20), nullable=True)
    condition = Column(
        Enum("good", "fair", "poor", name="device_condition"), nullable=False
    )
    source = Column(
        Enum("unclaimed_job", "purchased", "donated", "other", name="donor_source"),
        nullable=False,
    )
    source_job_id = Column(UUID(as_uuid=True), ForeignKey("jobs.id"), nullable=True)
    source_description = Column(String(255), nullable=True)
    assigned_technician_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    status = Column(
        Enum("available", "assessed", "stripped", "disposed", name="donor_status"),
        nullable=False,
        default="available",
    )
    added_date = Column(DateTime(timezone=True), server_default=func.now())
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class DonorPart(Base):
    __tablename__ = "donor_parts"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    donor_device_id = Column(
        UUID(as_uuid=True), ForeignKey("donor_devices.id"), nullable=False
    )
    part_name = Column(String(200), nullable=False)
    compatible_brands = Column(JSONB, default=list)
    compatible_models = Column(JSONB, default=list)
    condition = Column(
        Enum("good", "fair", "poor", name="part_condition"), nullable=False
    )
    is_available = Column(Boolean, default=True, nullable=False)
    approval_status = Column(String(20), default="pending", nullable=False)
    sku = Column(String(50), nullable=True, unique=True)
    estimated_value = Column(Numeric(10, 2), nullable=True)
    extracted_date = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
