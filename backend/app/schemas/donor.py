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
    purpose: Literal["refurbish", "parts"] = "parts"
    purchase_price: float | None = None


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
    purpose: str = "parts"
    purchase_price: float | None = None
    status: str
    added_date: datetime | None = None
    
    # Refurbish Workflow
    refurbish_status: str | None = None
    parts_used_notes: str | None = None
    selling_price: float | None = None
    qc_mic_tested: bool = False
    qc_camera_tested: bool = False
    qc_touch_tested: bool = False
    qc_biometrics_tested: bool = False
    qc_wifi_tested: bool = False
    qc_charging_tested: bool = False

    model_config = {"from_attributes": True}


class DonorDeviceRefurbishSubmit(BaseModel):
    parts_used_notes: str | None = None
    qc_mic_tested: bool = False
    qc_camera_tested: bool = False
    qc_touch_tested: bool = False
    qc_biometrics_tested: bool = False
    qc_wifi_tested: bool = False
    qc_charging_tested: bool = False


class DonorDeviceRefurbishApprove(BaseModel):
    selling_price: float


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
    sku: str | None = None
    estimated_value: float | None = None
    extracted_date: datetime | None = None
    created_at: datetime

    model_config = {"from_attributes": True}

class DonorPartApprove(BaseModel):
    estimated_value: float


class RefurbishedPartCreate(BaseModel):
    inventory_batch_id: UUID
    quantity: float


class RefurbishedPartResponse(BaseModel):
    id: UUID
    donor_device_id: UUID
    inventory_item_id: UUID
    inventory_batch_id: UUID | None
    quantity: float
    unit_cost: float
    created_at: datetime
    
    # We might want to include some item details to show in UI
    inventory_item_name: str | None = None
    inventory_item_sku: str | None = None

    model_config = {"from_attributes": True}
