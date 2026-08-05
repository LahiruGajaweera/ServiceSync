from datetime import datetime, timezone
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models.donor import DonorDevice, DonorPart
from app.schemas.donor import DonorDeviceCreate, DonorPartCreate


def register_donor_device(data: DonorDeviceCreate, db: Session) -> DonorDevice:
    device = DonorDevice(**data.model_dump())
    db.add(device)
    db.commit()
    db.refresh(device)
    return device


def list_donor_devices(db: Session) -> list[DonorDevice]:
    return db.query(DonorDevice).order_by(DonorDevice.added_date.desc()).all()


def get_donor_device(device_id: UUID, db: Session) -> DonorDevice:
    d = db.query(DonorDevice).filter(DonorDevice.id == device_id).first()
    if not d:
        raise HTTPException(404, "Donor device not found")
    return d


def claim_donor_device(device_id: UUID, current_user, db: Session) -> DonorDevice:
    d = get_donor_device(device_id, db)
    if d.assigned_technician_id:
        if d.assigned_technician_id == current_user.id:
            return d
        raise HTTPException(400, "Donor device is already assigned to another technician")
    d.assigned_technician_id = current_user.id
    db.commit()
    db.refresh(d)
    return d


def assign_technician_to_device(device_id: UUID, technician_id: UUID | None, db: Session) -> DonorDevice:
    d = get_donor_device(device_id, db)
    d.assigned_technician_id = technician_id
    db.commit()
    db.refresh(d)
    return d


def add_donor_part(data: DonorPartCreate, db: Session) -> DonorPart:
    get_donor_device(data.donor_device_id, db)  # validates device exists
    part = DonorPart(
        **data.model_dump(),
        extracted_date=datetime.now(timezone.utc),
    )
    db.add(part)
    db.commit()
    db.refresh(part)
    return part


def list_parts_for_device(device_id: UUID, db: Session) -> list[DonorPart]:
    return (
        db.query(DonorPart)
        .filter(DonorPart.donor_device_id == device_id)
        .all()
    )


def list_pending_parts(db: Session) -> list[DonorPart]:
    return (
        db.query(DonorPart)
        .filter(DonorPart.approval_status == "pending")
        .order_by(DonorPart.extracted_date.desc())
        .all()
    )


def approve_donor_part(part_id: UUID, db: Session) -> DonorPart:
    part = db.query(DonorPart).filter(DonorPart.id == part_id).first()
    if not part:
        raise HTTPException(404, "Donor part not found")
    if part.approval_status == "approved":
        return part
    part.approval_status = "approved"
    db.commit()
    db.refresh(part)
    return part


def mark_device_assessed(device_id: UUID, db: Session) -> DonorDevice:
    d = get_donor_device(device_id, db)
    d.status = "stripped"
    db.commit()
    db.refresh(d)
    return d
