from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel


class DonorDeviceCreate(BaseModel):
    brand: str
    model: str
    imei: str | None = None
    condition: Literal["good", "fair", "poor"]
    source: Literal["unclaimed_job", "purchased", "donated", "other"]
    source_job_id: UUID | None = None
    source_description: str | None = None
    assigned_technician_id: UUID | None = None


class DonorDeviceResponse(BaseModel):
    id: UUID
    brand: str
    model: str
    imei: str | None = None
    condition: str
    source: str
    source_job_id: UUID | None = None
    source_description: str | None = None
    assigned_technician_id: UUID | None = None
    status: str
    added_date: datetime | None = None

    model_config = {"from_attributes": True}


class DonorPartCreate(BaseModel):
    donor_device_id: UUID
    part_name: str
    compatible_brands: list[str] = []
    compatible_models: list[str] = []
    condition: Literal["good", "fair", "poor"]


class DonorPartResponse(BaseModel):
    id: UUID
    donor_device_id: UUID
    part_name: str
    compatible_brands: list
    compatible_models: list
    condition: str
    is_available: bool
    approval_status: str
    extracted_date: datetime | None = None
    created_at: datetime

    model_config = {"from_attributes": True}
