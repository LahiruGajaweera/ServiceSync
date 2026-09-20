import uuid
from sqlalchemy import Column, Enum, ForeignKey, Numeric, String, Text, DateTime, Float, func, Boolean
from sqlalchemy.dialects.postgresql import UUID, JSONB
from app.core.database import Base


class Notification(Base):
    __tablename__ = "notifications"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    job_id = Column(UUID(as_uuid=True), ForeignKey("jobs.id"), nullable=False)
    customer_id = Column(UUID(as_uuid=True), ForeignKey("customers.id"), nullable=False)
    notification_type = Column(
        Enum("sms", "email", name="notification_type"), nullable=False
    )
    message = Column(Text, nullable=False)
    status = Column(
        Enum("pending", "sent", "failed", name="notification_status"),
        nullable=False,
        default="pending",
    )
    sent_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class SalvageAssessment(Base):
    __tablename__ = "salvage_assessments"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    job_id = Column(UUID(as_uuid=True), ForeignKey("jobs.id"), nullable=False)
    scraped_market_price = Column(Numeric(10, 2), nullable=True)
    refurbish_cost_estimate = Column(Numeric(10, 2), nullable=True)
    refurbish_value = Column(Numeric(10, 2), nullable=True)
    salvage_value = Column(Numeric(10, 2), nullable=True)
    recommendation = Column(
        Enum("refurbish", "salvage_for_parts", name="salvage_recommendation"),
        nullable=True,
    )
    # Phase 1: Part-level breakdown from AI
    parts_breakdown = Column(JSONB, nullable=True, default=list)
    # Phase 1: Admin notes
    notes = Column(Text, nullable=True)
    # Phase 1: AI confidence score (0.0 - 1.0)
    ai_confidence = Column(Float, nullable=True)
    
    # Phase 2: Actual outcomes & Profit tracking
    actual_refurbish_cost = Column(Numeric(10, 2), nullable=True)
    actual_resale_price = Column(Numeric(10, 2), nullable=True)
    actual_parts_revenue = Column(Numeric(10, 2), nullable=True)
    profit_loss = Column(Numeric(10, 2), nullable=True)
    ai_accuracy_score = Column(Float, nullable=True)
    
    assessed_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    status = Column(
        Enum("pending", "assessed", "approved", "rejected", name="assessment_status"),
        nullable=False,
        default="pending",
    )
    assessed_at = Column(DateTime(timezone=True), nullable=True)



class AdminCallTask(Base):
    __tablename__ = "admin_call_tasks"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    job_id = Column(UUID(as_uuid=True), ForeignKey("jobs.id"), nullable=False)
    message = Column(Text, nullable=False)
    is_completed = Column(Boolean, default=False, nullable=False)
    completed_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    completed_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
