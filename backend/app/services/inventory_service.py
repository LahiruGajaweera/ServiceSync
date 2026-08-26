import json
from datetime import datetime, timezone
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import cast, func, or_
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Session, joinedload

from app.models.donor import DonorPart
from app.models.inventory import InventoryBatch, InventoryItem, InventoryAdjustmentLog, InventoryUnit
from app.schemas.inventory import (
    InventoryItemCreate,
    InventoryItemUpdate,
    ReceiveStockRequest,
    StockAdjustRequest,
)


def _serialize_batch(b: InventoryBatch) -> dict:
    d = {c.name: getattr(b, c.name) for c in b.__table__.columns}
    if hasattr(b, "units") and b.units:
        d["units"] = [{"serial_number": u.serial_number, "status": u.status} for u in b.units]
    return d


def _add_is_low_stock(item: InventoryItem) -> dict:
    d = {c.name: getattr(item, c.name) for c in item.__table__.columns}
    d["is_low_stock"] = item.quantity <= item.min_stock_threshold
    d["batches"] = [
        _serialize_batch(b)
        for b in sorted(item.batches, key=lambda b: (b.purchased_at or b.created_at))
    ]
    return d


# ── SKU / batch-code generation ───────────────────────────────────────────────

def _abbrev(category: str) -> str:
    letters = "".join(ch for ch in (category or "").upper() if ch.isalpha())
    return letters[:3] or "GEN"


def _generate_sku(category: str, db: Session) -> str:
    base = f"SS-{_abbrev(category)}"
    n = (db.query(func.count(InventoryItem.id)).scalar() or 0) + 1
    sku = f"{base}-{n:04d}"
    while db.query(InventoryItem).filter(InventoryItem.sku == sku).first():
        n += 1
        sku = f"{base}-{n:04d}"
    return sku


def _next_batch_code(item: InventoryItem, db: Session) -> str:
    n = (
        db.query(func.count(InventoryBatch.id))
        .filter(InventoryBatch.inventory_item_id == item.id)
        .scalar()
        or 0
    )
    code = f"{item.sku}-B{n + 1}"
    while db.query(InventoryBatch).filter(InventoryBatch.batch_code == code).first():
        n += 1
        code = f"{item.sku}-B{n + 1}"
    return code


def _add_batch(item, supplier, unit_cost, quantity, purchased_at, db) -> InventoryBatch:
    batch = InventoryBatch(
        batch_code=_next_batch_code(item, db),
        inventory_item_id=item.id,
        supplier=supplier,
        unit_cost=unit_cost or 0,
        quantity_received=quantity,
        quantity_remaining=quantity,
        purchased_at=purchased_at or datetime.now(timezone.utc),
    )
    db.add(batch)
    item.quantity = (item.quantity or 0) + quantity
    if supplier:
        item.supplier = supplier
    return batch


# ── FIFO consumption (shared with job_parts_service) ──────────────────────────

def consume_inventory(item: InventoryItem, qty: int, db: Session, batch_id: UUID | None = None, serial_number: str | None = None):
    """Deduct ``qty`` units from an item's batches.

    Returns a tuple: (list of ``(batch, chunk)`` allocations, ``InventoryUnit | None``)
    so the caller can record exactly which supplier/price each consumed unit came from,
    and link the specific unit if serialized.
    """
    unit = None
    if item.track_serial:
        if not serial_number:
            raise HTTPException(400, "Serial number is required for this item")
        unit = db.query(InventoryUnit).filter(
            InventoryUnit.serial_number == serial_number, 
            InventoryUnit.inventory_item_id == item.id
        ).first()
        if not unit or unit.status != "in_stock":
            raise HTTPException(400, f"Serial number {serial_number} is not in stock")
        if qty != 1:
            raise HTTPException(400, "Quantity must be 1 when consuming a serialized part")
        
        batch_id = unit.batch_id
    if batch_id:
        batch = next((b for b in item.batches if b.id == batch_id), None)
        if not batch:
            raise HTTPException(404, "Selected batch does not belong to this item")
        if batch.quantity_remaining < qty:
            raise HTTPException(400, f"Batch {batch.batch_code} only has {batch.quantity_remaining} left")
        batch.quantity_remaining -= qty
        item.quantity = (item.quantity or 0) - qty
        if unit:
            unit.status = "used"
        return [(batch, qty)], unit

    batches = sorted(
        [b for b in item.batches if b.quantity_remaining > 0],
        key=lambda b: (b.purchased_at or b.created_at),
    )
    available = sum(b.quantity_remaining for b in batches)
    if available < qty:
        raise HTTPException(400, f"Insufficient stock: only {available} available")

    allocations = []
    remaining = qty
    for b in batches:
        if remaining <= 0:
            break
        take = min(b.quantity_remaining, remaining)
        b.quantity_remaining -= take
        remaining -= take
        allocations.append((b, take))
    item.quantity = (item.quantity or 0) - qty
    return allocations, None


# ── CRUD ──────────────────────────────────────────────────────────────────────

def create_item(data: InventoryItemCreate, db: Session) -> dict:
    payload = data.model_dump()
    qty = payload.pop("quantity", None)
    unit_cost = payload.pop("unit_cost", None)
    unit_price = payload.pop("unit_price", None)
    supplier = payload.get("supplier")
    serial_numbers = payload.pop("serial_numbers", None)

    if payload.get("track_serial") and qty and qty > 0:
        if not serial_numbers or len(serial_numbers) != qty:
            raise HTTPException(400, f"Expected {qty} serial numbers for tracked item")

    # Duplicate check
    existing = db.query(InventoryItem).filter(
        InventoryItem.name == payload["name"],
        InventoryItem.part_type == payload["part_type"]
    ).first()
    if existing:
        raise HTTPException(409, detail={"msg": "DUPLICATE_PART", "item_id": str(existing.id), "sku": existing.sku})

    item = InventoryItem(**payload)
    item.sku = _generate_sku(item.category, db)
    item.quantity = 0
    item.unit_price = unit_price or 0
    db.add(item)
    db.flush()  # assign id before creating its first batch

    if qty and qty > 0:
        batch = _add_batch(item, supplier, unit_cost or 0, qty, None, db)
        db.flush()
        if item.track_serial and serial_numbers:
            for sn in serial_numbers:
                # check for existing serial
                if db.query(InventoryUnit).filter(InventoryUnit.serial_number == sn).first():
                    raise HTTPException(400, f"Serial number {sn} already exists")
                db.add(InventoryUnit(
                    inventory_item_id=item.id,
                    batch_id=batch.id,
                    serial_number=sn,
                    status="in_stock"
                ))

    db.commit()
    db.refresh(item)
    return _add_is_low_stock(item)


def receive_stock(item_id: UUID, data: ReceiveStockRequest, db: Session) -> dict:
    item = db.query(InventoryItem).filter(InventoryItem.id == item_id).first()
    if not item:
        raise HTTPException(404, "Item not found")

    if data.quantity <= 0:
        raise HTTPException(400, "Quantity must be a positive number")
    if not item.sku:
        item.sku = _generate_sku(item.category, db)
        db.flush()

    if data.new_selling_price is not None:
        item.unit_price = data.new_selling_price

    if item.track_serial:
        if not data.serial_numbers or len(data.serial_numbers) != data.quantity:
            raise HTTPException(400, f"Expected {data.quantity} serial numbers for tracked item")

    batch = _add_batch(item, data.supplier, data.unit_cost, data.quantity, data.purchased_at, db)
    db.flush()
    
    if item.track_serial and data.serial_numbers:
        for sn in data.serial_numbers:
            if db.query(InventoryUnit).filter(InventoryUnit.serial_number == sn).first():
                raise HTTPException(400, f"Serial number {sn} already exists")
            db.add(InventoryUnit(
                inventory_item_id=item.id,
                batch_id=batch.id,
                serial_number=sn,
                status="in_stock"
            ))

    db.commit()
    db.refresh(item)
    db.refresh(batch)
    return _serialize_batch(batch)


def list_batches(item_id: UUID, db: Session) -> list[dict]:
    item = db.query(InventoryItem).filter(InventoryItem.id == item_id).first()
    if not item:
        raise HTTPException(404, "Inventory item not found")
    return [
        _serialize_batch(b)
        for b in sorted(item.batches, key=lambda b: (b.purchased_at or b.created_at))
    ]


def list_items(db: Session, search: str | None = None, low_stock_only: bool = False) -> list[dict]:
    q = db.query(InventoryItem)
    if search:
        q = q.filter(or_(
            InventoryItem.name.ilike(f"%{search}%"),
            InventoryItem.category.ilike(f"%{search}%"),
            InventoryItem.sku.ilike(f"%{search}%"),
        ))
    items = q.order_by(InventoryItem.name).all()
    result = [_add_is_low_stock(i) for i in items]
    if low_stock_only:
        result = [r for r in result if r["is_low_stock"]]
    return result


def get_item(item_id: UUID, db: Session) -> dict:
    item = db.query(InventoryItem).filter(InventoryItem.id == item_id).first()
    if not item:
        raise HTTPException(404, "Inventory item not found")
    return _add_is_low_stock(item)


def update_item(item_id: UUID, data: InventoryItemUpdate, db: Session) -> dict:
    item = db.query(InventoryItem).filter(InventoryItem.id == item_id).first()
    if not item:
        raise HTTPException(404, "Inventory item not found")
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(item, field, value)
    db.commit()
    db.refresh(item)
    return _add_is_low_stock(item)


def adjust_stock(item_id: UUID, data: StockAdjustRequest, user_id: UUID, db: Session) -> dict:
    """Manual correction (shrinkage/recount). Negative deducts FIFO; positive tops up the newest batch."""
    item = db.query(InventoryItem).filter(InventoryItem.id == item_id).first()
    if not item:
        raise HTTPException(404, "Inventory item not found")
        
    logs_to_add = []
    
    if data.delta < 0:
        if data.batch_id:
            batch = db.query(InventoryBatch).filter(InventoryBatch.id == data.batch_id).first()
            if not batch or batch.inventory_item_id != item.id:
                raise HTTPException(400, "Invalid batch selected")
            if batch.quantity_remaining < -data.delta:
                raise HTTPException(400, f"Batch only has {batch.quantity_remaining} left")
            batch.quantity_remaining += data.delta
            item.quantity = (item.quantity or 0) + data.delta
            
            logs_to_add.append(
                InventoryAdjustmentLog(
                    inventory_item_id=item.id,
                    user_id=user_id,
                    batch_id=batch.id,
                    delta=data.delta,
                    reason=data.reason,
                    note=data.note
                )
            )
        else:
            allocations, _ = consume_inventory(item, -data.delta, db)
            for batch, qty in allocations:
                logs_to_add.append(
                    InventoryAdjustmentLog(
                        inventory_item_id=item.id,
                        user_id=user_id,
                        batch_id=batch.id,
                        delta=-qty,
                        reason=data.reason,
                        note=data.note
                    )
                )
    elif data.delta > 0:
        batches = sorted(item.batches, key=lambda b: (b.purchased_at or b.created_at))
        batch_id_to_use = None
        if batches:
            newest = batches[-1]
            newest.quantity_remaining += data.delta
            newest.quantity_received += data.delta
            item.quantity = (item.quantity or 0) + data.delta
            batch_id_to_use = newest.id
        else:
            new_batch = _add_batch(item, item.supplier, item.unit_price or 0, data.delta, None, db)
            db.flush()
            batch_id_to_use = new_batch.id
            
        logs_to_add.append(
            InventoryAdjustmentLog(
                inventory_item_id=item.id,
                user_id=user_id,
                batch_id=batch_id_to_use,
                delta=data.delta,
                reason=data.reason,
                note=data.note
            )
        )
    else:
        logs_to_add.append(
            InventoryAdjustmentLog(
                inventory_item_id=item.id,
                user_id=user_id,
                batch_id=data.batch_id,
                delta=0,
                reason=data.reason,
                note=data.note
            )
        )

    for log in logs_to_add:
        db.add(log)
    
    db.commit()
    db.refresh(item)
    return _add_is_low_stock(item)
    
def list_adjustments(item_id: UUID, db: Session) -> list[dict]:
    logs = (
        db.query(InventoryAdjustmentLog)
        .options(joinedload(InventoryAdjustmentLog.user), joinedload(InventoryAdjustmentLog.item), joinedload(InventoryAdjustmentLog.batch))
        .filter(InventoryAdjustmentLog.inventory_item_id == item_id)
        .order_by(InventoryAdjustmentLog.created_at.desc())
        .all()
    )
    return _format_adjustment_logs(logs)

def list_all_adjustments(db: Session) -> list[dict]:
    logs = (
        db.query(InventoryAdjustmentLog)
        .options(joinedload(InventoryAdjustmentLog.user), joinedload(InventoryAdjustmentLog.item), joinedload(InventoryAdjustmentLog.batch))
        .order_by(InventoryAdjustmentLog.created_at.desc())
        .all()
    )
    return _format_adjustment_logs(logs)

def _format_adjustment_logs(logs: list[InventoryAdjustmentLog]) -> list[dict]:
    res = []
    for log in logs:
        admin_name = log.user.name if log.user else "Unknown"
        item_name = log.item.name if log.item else "Unknown"
        batch_code = log.batch.batch_code if log.batch else None
        res.append({
            "id": log.id,
            "inventory_item_id": log.inventory_item_id,
            "user_id": log.user_id,
            "batch_id": log.batch_id,
            "delta": log.delta,
            "reason": log.reason,
            "note": log.note,
            "created_at": log.created_at,
            "admin_name": admin_name,
            "item_name": item_name,
            "batch_code": batch_code
        })
    return res


def suggest_compatible_parts(brand: str, model: str, db: Session) -> dict:
    brand_json = cast(json.dumps([brand]), JSONB)
    model_json = cast(json.dumps([model]), JSONB)

    inv_parts = (
        db.query(InventoryItem)
        .filter(
            InventoryItem.quantity > 0,
            InventoryItem.compatible_brands.op("@>")(brand_json),
            InventoryItem.compatible_models.op("@>")(model_json),
        )
        .all()
    )

    donor_parts = (
        db.query(DonorPart)
        .filter(
            DonorPart.is_available.is_(True),
            DonorPart.compatible_brands.op("@>")(brand_json),
            DonorPart.compatible_models.op("@>")(model_json),
        )
        .all()
    )

    return {"inventory_parts": inv_parts, "donor_parts": donor_parts}


def resolve_scan(code: str, db: Session) -> dict:
    """Resolve a scanned SKU or batch code to an item (and batch, if a batch code)."""
    code = (code or "").strip()
    if not code:
        raise HTTPException(400, "Empty scan code")

    if code.startswith("DP-"):
        donor_part = db.query(DonorPart).filter(DonorPart.sku == code).first()
        if donor_part:
            if not donor_part.is_available:
                raise HTTPException(400, "This donor part has already been used.")
            return {"donor_part": {
                "id": str(donor_part.id),
                "part_name": donor_part.part_name,
                "sku": donor_part.sku,
                "estimated_value": float(donor_part.estimated_value) if donor_part.estimated_value else 0.0,
                "condition": donor_part.condition,
                "is_available": donor_part.is_available
            }}

    batch = db.query(InventoryBatch).filter(InventoryBatch.batch_code == code).first()
    if batch:
        item = db.query(InventoryItem).filter(InventoryItem.id == batch.inventory_item_id).first()
        return {"item": _add_is_low_stock(item), "batch": _serialize_batch(batch)}

    item = db.query(InventoryItem).filter(InventoryItem.sku == code).first()
    if item:
        return {"item": _add_is_low_stock(item), "batch": None}

    raise HTTPException(404, f"No inventory part or donor part found for code '{code}'")

