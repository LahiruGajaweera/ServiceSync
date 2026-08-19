from datetime import date, datetime
from decimal import Decimal
from typing import Literal
from uuid import UUID

from pydantic import BaseModel

FAULT_CATEGORIES = Literal[
    "screen", "battery", "charging_port", "camera",
    "speaker", "software", "water_damage", "other"
]

JOB_STATUSES = Literal[
    "pending", "in_progress", "completed",
    "ready_for_pickup", "delivered", "unclaimed",
    "failed", "rejected"
]


class JobCreate(BaseModel):
    customer_id: UUID
    technician_id: UUID | None = None
    rework_of_job_id: UUID | None = None
    device_brand: str
    device_model: str
    device_imei: str | None = None
    fault_category: FAULT_CATEGORIES
    fault_description: str | None = None
    estimated_completion_date: date | None = None
    estimated_cost: Decimal | None = None
    investigated: bool = False
    notes: str | None = None
    physical_condition: str | None = None


class JobImageResponse(BaseModel):
    id: UUID
    file_path: str
    created_at: datetime

    model_config = {"from_attributes": True}


class JobStatusUpdate(BaseModel):
    status: JOB_STATUSES
    estimated_cost: Decimal | None = None
    notes: str | None = None
    
    # Structured completion data (sent when status == 'completed')
    actual_fault: str | None = None
    identified_fault: str | None = None
    complexity_level: Literal["low", "medium", "high"] | None = None
    diagnostic_time_mins: int | None = None
    repair_time_mins: int | None = None
    resolution_notes: str | None = None


class JobRevertRequest(BaseModel):
    target_status: JOB_STATUSES
    reason: str


class JobLaborUpdate(BaseModel):
    labor_cost: Decimal


class AssignTechnicianRequest(BaseModel):
    technician_id: UUID | None = None


class TimerToggleRequest(BaseModel):
    mode: str | None = None  # "diagnostic" or "repair". None means pause.


class AutoResumeRequest(BaseModel):
    mode: str
    away_seconds: int


class JobListItem(BaseModel):
    id: UUID
    job_id: str
    customer_id: UUID
    customer_name: str | None = None
    customer_phone: str | None = None
    technician_id: UUID | None = None
    technician_name: str | None = None
    device_brand: str
    device_model: str
    device_imei: str | None = None
    fault_category: str
    fault_description: str | None = None
    status: str
    estimated_completion_date: date | None = None
    estimated_cost: Decimal | None = None
    labor_cost: Decimal | None = None
    investigated: bool | None = None
    received_date: datetime | None = None
    completed_date: datetime | None = None
    notes: str | None = None
    revert_requested_to: str | None = None
    revert_reason: str | None = None
    admin_alert: str | None = None
    labor_cost: Decimal | None = None
    physical_condition: str | None = None
    
    actual_fault: str | None = None
    complexity_level: str | None = None
    diagnostic_time_mins: int | None = None
    repair_time_mins: int | None = None
    
    rework_of_job_id: UUID | None = None
    active_repair_start_time: datetime | None = None
    total_diagnostic_seconds: int | None = 0
    total_active_repair_seconds: int | None = 0
    total_away_seconds: int | None = 0
    current_timer_mode: str | None = None

    model_config = {"from_attributes": True}
    resolution_notes: str | None = None
    images: list[JobImageResponse] = []
    created_at: datetime | None = None


class PublicJobResponse(BaseModel):
    job_id: str
    device_brand: str
    device_model: str
    fault_category: str
    status: str
    estimated_completion_date: date | None = None
    estimated_cost: Decimal | None = None
    received_date: datetime | None = None
    completed_date: datetime | None = None


class CompatibleInventoryPart(BaseModel):
    id: UUID
    name: str
    category: str
    quantity: int
    unit_price: Decimal
    part_type: str

    model_config = {"from_attributes": True}


class CompatibleDonorPart(BaseModel):
    id: UUID
    part_name: str
    condition: str
    compatible_brands: list
    compatible_models: list

    model_config = {"from_attributes": True}


class CompatiblePartsResponse(BaseModel):
    inventory_parts: list[CompatibleInventoryPart]
    donor_parts: list[CompatibleDonorPart]
