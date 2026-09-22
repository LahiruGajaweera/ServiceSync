from datetime import datetime, timezone
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models.donor import DonorDevice, DonorPart
from app.schemas.donor import DonorDeviceCreate, DonorPartCreate, DonorPartApprove


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


def list_available_parts(db: Session) -> list[DonorPart]:
    return (
        db.query(DonorPart)
        .filter(DonorPart.approval_status == "approved", DonorPart.is_available.is_(True))
        .order_by(DonorPart.extracted_date.desc())
        .all()
    )


def approve_donor_part(part_id: UUID, data: DonorPartApprove, db: Session) -> DonorPart:
    part = db.query(DonorPart).filter(DonorPart.id == part_id).first()
    if not part:
        raise HTTPException(404, "Donor part not found")
    if part.approval_status == "approved":
        return part
    
    part.approval_status = "approved"
    part.estimated_value = data.estimated_value
    part.sku = f"DP-{str(part.id)[:6].upper()}"
    
    db.commit()
    db.refresh(part)
    return part


def mark_device_assessed(device_id: UUID, db: Session) -> DonorDevice:
    d = get_donor_device(device_id, db)
    d.status = "stripped"
    db.commit()
    db.refresh(d)
    return d


def submit_refurbish(device_id: UUID, data, db: Session) -> DonorDevice:
    d = get_donor_device(device_id, db)
    d.refurbish_status = "pending_approval"
    d.parts_used_notes = data.parts_used_notes
    d.qc_mic_tested = data.qc_mic_tested
    d.qc_camera_tested = data.qc_camera_tested
    d.qc_touch_tested = data.qc_touch_tested
    d.qc_biometrics_tested = data.qc_biometrics_tested
    d.qc_wifi_tested = data.qc_wifi_tested
    d.qc_charging_tested = data.qc_charging_tested
    db.commit()
    db.refresh(d)
    return d


def approve_refurbish(device_id: UUID, data, current_user, db: Session) -> DonorDevice:
    from app.models.inventory import InventoryItem, InventoryBatch, InventoryUnit, InventoryAdjustmentLog
    d = get_donor_device(device_id, db)
    
    if d.refurbish_status != "pending_approval":
        raise HTTPException(400, "Device is not pending approval")
        
    d.refurbish_status = "approved"
    d.selling_price = data.selling_price
    d.status = "disposed" # Mark the donor record as completed
    
    # Create Inventory Item
    item = InventoryItem(
        name=f"Refurbished {d.brand} {d.model}",
        category="Refurbished Devices",
        part_type="salvaged",
        quantity=1,
        track_serial=True
    )
    db.add(item)
    db.flush()
    
    total_parts_cost = sum(float(p.unit_cost) * float(p.quantity) for p in d.refurbished_parts)
    base_cost = float(d.purchase_price or 0)

    # Create Inventory Batch
    batch = InventoryBatch(
        batch_code=f"REF-{str(d.id)[:8].upper()}",
        inventory_item_id=item.id,
        supplier="Internal Refurbish",
        unit_cost=base_cost + total_parts_cost,
        unit_price=data.selling_price,
        quantity_received=1,
        quantity_remaining=1
    )
    db.add(batch)
    db.flush()
    
    # Create Inventory Unit
    serial = d.imei if d.imei else f"SN-{str(d.id)[:8].upper()}"
    unit = InventoryUnit(
        inventory_item_id=item.id,
        batch_id=batch.id,
        serial_number=serial,
        status="in_stock"
    )
    db.add(unit)
    
    # Create Log
    log = InventoryAdjustmentLog(
        inventory_item_id=item.id,
        batch_id=batch.id,
        user_id=current_user.id,
        delta=1,
        reason="Refurbished device approved and added to inventory"
    )
    db.add(log)
    
    db.commit()
    db.refresh(d)
    return d


def log_refurbished_part(device_id: UUID, data, current_user, db: Session):
    try:
        from app.models.inventory import InventoryBatch, InventoryItem, InventoryAdjustmentLog
        from app.models.donor import RefurbishedPart
        
        d = get_donor_device(device_id, db)
        
        batch = db.query(InventoryBatch).filter(InventoryBatch.id == data.inventory_batch_id).first()
        if not batch:
            raise HTTPException(404, "Inventory batch not found")
            
        item = db.query(InventoryItem).filter(InventoryItem.id == batch.inventory_item_id).first()
        if not item:
            raise HTTPException(404, "Inventory item not found")

        if batch.quantity_remaining < data.quantity:
            raise HTTPException(400, "Not enough stock in the selected batch")

        # Deduct from inventory
        batch.quantity_remaining -= data.quantity
        item.quantity -= data.quantity
        
        # Record the part used with its cost
        ref_part = RefurbishedPart(
            donor_device_id=device_id,
            inventory_item_id=item.id,
            inventory_batch_id=batch.id,
            quantity=data.quantity,
            unit_cost=batch.unit_cost
        )
        db.add(ref_part)
        
        # Log the adjustment
        log = InventoryAdjustmentLog(
            inventory_item_id=item.id,
            batch_id=batch.id,
            user_id=current_user.id,
            delta=int(-data.quantity),
            reason=f"Refurbished device {d.brand} {d.model}"[:50]
        )
        db.add(log)
        
        db.commit()
        db.refresh(ref_part)
        
        # Attach item details for Pydantic response validation
        setattr(ref_part, "inventory_item_name", item.name)
        setattr(ref_part, "inventory_item_sku", item.sku)
        
        return ref_part
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=400, detail=f"Server error: {repr(e)}")


def list_refurbished_parts(device_id: UUID, db: Session):
    from app.models.donor import RefurbishedPart
    from app.models.inventory import InventoryItem
    
    # We join InventoryItem to get name and sku for the UI
    parts = db.query(RefurbishedPart, InventoryItem).join(
        InventoryItem, RefurbishedPart.inventory_item_id == InventoryItem.id
    ).filter(RefurbishedPart.donor_device_id == device_id).all()
    
    results = []
    for p, item in parts:
        res = p.__dict__.copy()
        res["inventory_item_name"] = item.name
        res["inventory_item_sku"] = item.sku
        results.append(res)
        
    return results


def remove_refurbished_part(device_id: UUID, part_id: UUID, current_user, db: Session):
    from app.models.donor import RefurbishedPart
    from app.models.inventory import InventoryBatch, InventoryItem, InventoryAdjustmentLog
    
    part = db.query(RefurbishedPart).filter(RefurbishedPart.id == part_id, RefurbishedPart.donor_device_id == device_id).first()
    if not part:
        raise HTTPException(404, "Part not found")
        
    # Return to inventory
    batch = db.query(InventoryBatch).filter(InventoryBatch.id == part.inventory_batch_id).first()
    item = db.query(InventoryItem).filter(InventoryItem.id == part.inventory_item_id).first()
    
    if batch and item:
        batch.quantity_remaining += part.quantity
        item.quantity += part.quantity
        
        log = InventoryAdjustmentLog(
            inventory_item_id=item.id,
            batch_id=batch.id,
            user_id=current_user.id,
            delta=int(part.quantity),
            reason="Refurbished part removed and returned to inventory"
        )
        db.add(log)
        
    db.delete(part)
    db.commit()
