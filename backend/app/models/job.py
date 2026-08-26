import uuid
from sqlalchemy import Boolean, Column, Date, Enum, ForeignKey, Numeric, String, Text, DateTime, func, Integer
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.core.database import Base


class Job(Base):
    __tablename__ = "jobs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    job_id = Column(String(20), unique=True, nullable=False, index=True)
    customer_id = Column(UUID(as_uuid=True), ForeignKey("customers.id"), nullable=False)
    technician_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    device_brand = Column(String(100), nullable=False)
    device_model = Column(String(100), nullable=False)
    current_timer_mode = Column(String(20), nullable=True)  # 'diagnostic' or 'repair'
    total_away_seconds = Column(Integer, nullable=False, default=0)
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
    physical_condition = Column(String(255), nullable=True)
    revert_requested_to = Column(String(30), nullable=True)
    revert_reason = Column(Text, nullable=True)
    admin_alert = Column(Text, nullable=True)
    reminder_83_sent = Column(Boolean, nullable=False, default=False)
    reminder_90_sent = Column(Boolean, nullable=False, default=False)
    reminder_425_sent = Column(Boolean, nullable=False, default=False)
    final_warning_sent = Column(Boolean, nullable=False, default=False)
    salvage_delayed_until = Column(DateTime(timezone=True), nullable=True)
    labor_cost = Column(Numeric(10, 2), nullable=True, default=0)

    # Structured repair completion data
    actual_fault = Column(String(100), nullable=True)
    identified_fault = Column(String(100), nullable=True)
    complexity_level = Column(Enum("low", "medium", "high", name="complexity_level"), nullable=True)
    diagnostic_time_mins = Column(Integer, nullable=True)
    repair_time_mins = Column(Integer, nullable=True)
    resolution_notes = Column(Text, nullable=True)
    
    # QC Checklist
    qc_mic_tested = Column(Boolean, nullable=False, default=False)
    qc_camera_tested = Column(Boolean, nullable=False, default=False)
    qc_touch_tested = Column(Boolean, nullable=False, default=False)
    qc_biometrics_tested = Column(Boolean, nullable=False, default=False)
    qc_wifi_tested = Column(Boolean, nullable=False, default=False)
    qc_charging_tested = Column(Boolean, nullable=False, default=False)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Performance Enhancements
    rework_of_job_id = Column(UUID(as_uuid=True), ForeignKey("jobs.id"), nullable=True)
    active_repair_start_time = Column(DateTime(timezone=True), nullable=True)
    total_diagnostic_seconds = Column(Integer, nullable=False, default=0)
    total_active_repair_seconds = Column(Integer, nullable=False, default=0)
    current_timer_mode = Column(Enum("diagnostic", "repair", name="timer_mode"), nullable=True)

    images = relationship("JobImage", backref="job", cascade="all, delete-orphan", lazy="joined")
    reworks = relationship("Job", backref="original_job", remote_side=[id])


class JobStatusHistory(Base):
    __tablename__ = "job_status_history"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    job_id = Column(UUID(as_uuid=True), ForeignKey("jobs.id"), nullable=False)
    status = Column(String(30), nullable=False)
    changed_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class JobImage(Base):
    __tablename__ = "job_images"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    job_id = Column(UUID(as_uuid=True), ForeignKey("jobs.id"), nullable=False)
    file_path = Column(String(500), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
