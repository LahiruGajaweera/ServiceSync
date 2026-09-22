from uuid import UUID
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from pydantic import BaseModel

from app.core.database import get_db
from app.core.deps import require_any_staff, require_technician
from app.schemas.donor import (
    DonorDeviceCreate,
    DonorDeviceResponse,
    DonorPartCreate,
    DonorPartResponse,
    DonorPartApprove,
    DonorDeviceRefurbishSubmit,
    DonorDeviceRefurbishApprove,
    RefurbishedPartCreate,
    RefurbishedPartResponse,
)
from app.services import donor_service
from app.models.user import User

router = APIRouter(prefix="/donors", tags=["Donor Devices"])

class AssignTechnicianRequest(BaseModel):
    technician_id: UUID | None


@router.post("/", response_model=DonorDeviceResponse, status_code=201)
def register_donor_device(
    data: DonorDeviceCreate,
    db: Session = Depends(get_db),
    _=Depends(require_any_staff),
):
    return donor_service.register_donor_device(data, db)


@router.get("/", response_model=list[DonorDeviceResponse])
def list_donor_devices(
    db: Session = Depends(get_db),
    _=Depends(require_any_staff),
):
    return donor_service.list_donor_devices(db)


@router.get("/{device_id}", response_model=DonorDeviceResponse)
def get_donor_device(
    device_id: UUID,
    db: Session = Depends(get_db),
    _=Depends(require_any_staff),
):
    return donor_service.get_donor_device(device_id, db)


@router.patch("/{device_id}/claim", response_model=DonorDeviceResponse)
def claim_donor_device(
    device_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_technician),
):
    return donor_service.claim_donor_device(device_id, current_user, db)


@router.patch("/{device_id}/assign", response_model=DonorDeviceResponse)
def assign_donor_device(
    device_id: UUID,
    data: AssignTechnicianRequest,
    db: Session = Depends(get_db),
    _=Depends(require_any_staff),
):
    return donor_service.assign_technician_to_device(device_id, data.technician_id, db)


@router.patch("/{device_id}/assess", response_model=DonorDeviceResponse)
def assess_donor_device(
    device_id: UUID,
    db: Session = Depends(get_db),
    _=Depends(require_any_staff),
):
    return donor_service.mark_device_assessed(device_id, db)


@router.get("/parts/pending", response_model=list[DonorPartResponse])
def list_pending_parts(
    db: Session = Depends(get_db),
    _=Depends(require_any_staff),
):
    return donor_service.list_pending_parts(db)


@router.get("/parts/available", response_model=list[DonorPartResponse])
def list_available_parts(
    db: Session = Depends(get_db),
    _=Depends(require_any_staff),
):
    return donor_service.list_available_parts(db)


@router.patch("/parts/{part_id}/approve", response_model=DonorPartResponse)
def approve_donor_part(
    part_id: UUID,
    data: DonorPartApprove,
    db: Session = Depends(get_db),
    _=Depends(require_any_staff),
):
    return donor_service.approve_donor_part(part_id, data, db)


@router.post("/{device_id}/parts", response_model=DonorPartResponse, status_code=201)
def add_donor_part(
    device_id: UUID,
    data: DonorPartCreate,
    db: Session = Depends(get_db),
    _=Depends(require_any_staff),
):
    return donor_service.add_donor_part(data, db)


@router.get("/{device_id}/parts", response_model=list[DonorPartResponse])
def list_parts(
    device_id: UUID,
    db: Session = Depends(get_db),
    _=Depends(require_any_staff),
):
    return donor_service.list_parts_for_device(device_id, db)


@router.post("/{device_id}/refurbish-submit", response_model=DonorDeviceResponse)
def submit_refurbish(
    device_id: UUID,
    data: DonorDeviceRefurbishSubmit,
    db: Session = Depends(get_db),
    _=Depends(require_technician)
):
    return donor_service.submit_refurbish(device_id, data, db)


@router.post("/{device_id}/refurbish-approve", response_model=DonorDeviceResponse)
def approve_refurbish(
    device_id: UUID,
    data: DonorDeviceRefurbishApprove,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_staff)
):
    return donor_service.approve_refurbish(device_id, data, current_user, db)


@router.post("/{device_id}/refurbished-parts", response_model=RefurbishedPartResponse, status_code=201)
def log_refurbished_part(
    device_id: UUID,
    data: RefurbishedPartCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_technician)
):
    return donor_service.log_refurbished_part(device_id, data, current_user, db)


@router.get("/{device_id}/refurbished-parts", response_model=list[RefurbishedPartResponse])
def list_refurbished_parts(
    device_id: UUID,
    db: Session = Depends(get_db),
    _=Depends(require_any_staff)
):
    return donor_service.list_refurbished_parts(device_id, db)


@router.delete("/{device_id}/refurbished-parts/{part_id}", status_code=204)
def remove_refurbished_part(
    device_id: UUID,
    part_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_technician)
):
    donor_service.remove_refurbished_part(device_id, part_id, current_user, db)
    return None
