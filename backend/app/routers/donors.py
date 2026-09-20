from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import require_any_staff
from app.schemas.donor import (
    DonorDeviceCreate,
    DonorDeviceResponse,
    DonorPartCreate,
    DonorPartResponse,
    DonorPartApprove,
)
from app.services import donor_service
from app.models.user import User
from app.core.deps import require_any_staff, require_technician

router = APIRouter(prefix="/donors", tags=["Donor Devices"])


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


from pydantic import BaseModel
class AssignTechnicianRequest(BaseModel):
    technician_id: UUID | None

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
