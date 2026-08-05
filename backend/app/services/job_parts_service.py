from uuid import UUID

from decimal import Decimal

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.donor import DonorPart
from app.models.inventory import InventoryBatch, InventoryItem
from app.models.invoice import JobPartUsed
from app.models.job import Job
from app.models.user import User
from app.schemas.invoice import ConsumeByBatchRequest, JobPartCreate
from app.services import inventory_service


def _customer_price(unit_cost) -> Decimal:
    """Customer-facing price = batch cost + configured markup."""
    cost = Decimal(str(unit_cost or 0))
    markup = Decimal(str(settings.PARTS_MARKUP_PCT))
    return (cost * (Decimal("1") + markup / Decimal("100"))).quantize(Decimal("0.01"))


def add_part(job_id: UUID, data: JobPartCreate, db: Session, used_by: User | None = None) -> list[dict]:
    job = db.query(Job).filter(Job.id == job_id).first()
    if not job:
        raise HTTPException(404, "Job not found")
    if data.quantity <= 0:
        raise HTTPException(400, "Quantity must be a positive number")

    # Technicians may only log parts on jobs assigned to them.
    if used_by and used_by.role == "technician" and job.technician_id != used_by.id:
        raise HTTPException(403, "You can only log parts on jobs assigned to you")

    used_by_id = used_by.id if used_by else None
    records: list[JobPartUsed] = []

    if data.part_source == "inventory":
        if not data.inventory_item_id:
            raise HTTPException(400, "inventory_item_id required for inventory parts")
        item = db.query(InventoryItem).filter(InventoryItem.id == data.inventory_item_id).first()
        if not item:
            raise HTTPException(404, "Inventory item not found")

        # FIFO deduction — a single request may span several purchase batches,
        # each with its own supplier/cost, so we log one row per batch chunk.
        allocations = inventory_service.consume_inventory(
            item, data.quantity, db, batch_id=data.batch_id
        )
        for batch, chunk in allocations:
            final_price = data.override_price if data.override_price is not None else item.unit_price
            records.append(JobPartUsed(
                job_id=job_id,
                part_source="inventory",
                inventory_item_id=item.id,
                batch_id=batch.id,
                used_by_technician_id=used_by_id,
                quantity=chunk,
                unit_cost=batch.unit_cost,
                unit_price=final_price,
            ))

    elif data.part_source == "donor":
        if not data.donor_part_id:
            raise HTTPException(400, "donor_part_id required for donor parts")
        part = db.query(DonorPart).filter(DonorPart.id == data.donor_part_id).first()
        if not part:
            raise HTTPException(404, "Donor part not found")
        if not part.is_available:
            raise HTTPException(400, "Donor part is already used")
        part.is_available = False
        final_price = data.override_price if data.override_price is not None else (data.unit_cost or 0)
        records.append(JobPartUsed(
            job_id=job_id,
            part_source="donor",
            donor_part_id=part.id,
            used_by_technician_id=used_by_id,
            quantity=data.quantity,
            unit_cost=data.unit_cost or 0,
            unit_price=final_price,
        ))
    else:
        raise HTTPException(400, "part_source must be 'inventory' or 'donor'")

    for r in records:
        db.add(r)
    db.commit()
    for r in records:
        db.refresh(r)

    return [_serialize_part(r, db) for r in records]


def consume_by_batch_code(
    data: ConsumeByBatchRequest, db: Session, current_user: User | None = None
) -> dict:
    """Consume stock from one specific batch, identified by its human-readable code.

    Used when there is no hardware scanner: the technician reads the printed
    batch code (e.g. ``SS-BAT-0003-B1``) and types/selects it. We resolve the
    batch, verify stock, decrement that exact batch, and log the consumption
    with the batch's real cost price plus the derived customer price.
    """
    code = (data.batch_code or "").strip()
    if not code:
        raise HTTPException(400, "batch_code is required")
    if data.quantity <= 0:
        raise HTTPException(400, "Quantity must be a positive number")

    batch = db.query(InventoryBatch).filter(InventoryBatch.batch_code == code).first()
    if not batch:
        raise HTTPException(404, f"No batch found for code '{code}'")

    item = db.query(InventoryItem).filter(InventoryItem.id == batch.inventory_item_id).first()
    if not item:
        raise HTTPException(404, "Inventory item for this batch no longer exists")

    job = db.query(Job).filter(Job.id == data.job_id).first()
    if not job:
        raise HTTPException(404, "Job not found")

    # Resolve which technician consumed the part.
    technician: User | None = None
    if data.technician_id:
        technician = db.query(User).filter(User.id == data.technician_id).first()
        if not technician:
            raise HTTPException(404, "Technician not found")

    # Security: a technician may only log against jobs assigned to them, and
    # always as themselves — never on behalf of another user.
    if current_user and current_user.role == "technician":
        if job.technician_id != current_user.id:
            raise HTTPException(403, "You can only log parts on jobs assigned to you")
        technician = current_user
    elif technician is None:
        technician = current_user

    if batch.quantity_remaining < data.quantity:
        raise HTTPException(
            400, f"Batch {batch.batch_code} only has {batch.quantity_remaining} left"
        )

    # Decrement this exact batch (FIFO helper, pinned to a single batch).
    inventory_service.consume_inventory(item, data.quantity, db, batch_id=batch.id)

    record = JobPartUsed(
        job_id=job.id,
        part_source="inventory",
        inventory_item_id=item.id,
        batch_id=batch.id,
        used_by_technician_id=technician.id if technician else None,
        quantity=data.quantity,
        unit_cost=batch.unit_cost,
        unit_price=item.unit_price,
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return _serialize_part(record, db)


def _serialize_part(p: JobPartUsed, db: Session) -> dict:
    part_name = None
    batch_code = None
    supplier = None
    used_by_name = None

    if p.part_source == "inventory" and p.inventory_item_id:
        item = db.query(InventoryItem).filter(InventoryItem.id == p.inventory_item_id).first()
        part_name = item.name if item else None
    elif p.part_source == "donor" and p.donor_part_id:
        donor = db.query(DonorPart).filter(DonorPart.id == p.donor_part_id).first()
        part_name = donor.part_name if donor else None

    if p.batch_id:
        batch = db.query(InventoryBatch).filter(InventoryBatch.id == p.batch_id).first()
        if batch:
            batch_code = batch.batch_code
            supplier = batch.supplier

    if p.used_by_technician_id:
        tech = db.query(User).filter(User.id == p.used_by_technician_id).first()
        used_by_name = tech.name if tech else None

    return {
        "id": p.id,
        "job_id": p.job_id,
        "part_source": p.part_source,
        "inventory_item_id": p.inventory_item_id,
        "donor_part_id": p.donor_part_id,
        "batch_id": p.batch_id,
        "batch_code": batch_code,
        "supplier": supplier,
        "used_by_technician_id": p.used_by_technician_id,
        "used_by_name": used_by_name,
        "quantity": p.quantity,
        "unit_cost": p.unit_cost,
        "unit_price": p.unit_price,
        "part_name": part_name,
        "created_at": p.created_at,
    }


def list_parts(job_id: UUID, db: Session) -> list[dict]:
    parts = (
        db.query(JobPartUsed)
        .filter(JobPartUsed.job_id == job_id)
        .order_by(JobPartUsed.created_at)
        .all()
    )
    return [_serialize_part(p, db) for p in parts]

