import uuid
from sqlalchemy import Boolean, Column, Date, Enum, ForeignKey, Numeric, String, Text, DateTime, func
from sqlalchemy.dialects.postgresql import UUID
from app.core.database import Base


class Job(Base):
    __tablename__ = "jobs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    job_id = Column(String(20), unique=True, nullable=False, index=True)
    customer_id = Column(UUID(as_uuid=True), ForeignKey("customers.id"), nullable=False)
    technician_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    device_brand = Column(String(100), nullable=False)
    device_model = Column(String(100), nullable=False)
    device_imei = Column(String(20), nullable=True)
    fault_category = Column(
        Enum(
            "screen", "battery", "charging_port", "camera",
            "speaker", "software", "water_damage", "other",
            name="fault_category",
        ),
        nullable=False,
    )
    fault_description = Column(Text, nullable=True)
    status = Column(
        Enum(
            "pending", "in_progress", "completed",
            "ready_for_pickup", "delivered", "unclaimed",
            "failed", "rejected",
            name="job_status",
        ),
        nullable=False,
        default="pending",
    )
    estimated_completion_date = Column(Date, nullable=True)
    estimated_cost = Column(Numeric(10, 2), nullable=True)
    investigated = Column(Boolean, nullable=False, default=False)
    received_date = Column(DateTime(timezone=True), server_default=func.now())
    completed_date = Column(DateTime(timezone=True), nullable=True)
    pickup_date = Column(DateTime(timezone=True), nullable=True)
    notes = Column(Text, nullable=True)
    revert_requested_to = Column(String(30), nullable=True)
    revert_reason = Column(Text, nullable=True)
    admin_alert = Column(Text, nullable=True)
    final_warning_sent = Column(Boolean, nullable=False, default=False)
    labor_cost = Column(Numeric(10, 2), nullable=True, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())


class JobStatusHistory(Base):
    __tablename__ = "job_status_history"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    job_id = Column(UUID(as_uuid=True), ForeignKey("jobs.id"), nullable=False)
    status = Column(String(30), nullable=False)
    changed_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
