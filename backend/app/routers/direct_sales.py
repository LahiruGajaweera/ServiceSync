from typing import List
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from decimal import Decimal

from app.core.database import get_db
from app.models.direct_sale import DirectSale, DirectSaleItem
from app.models.inventory import InventoryItem, InventoryBatch, InventoryUnit
from app.schemas.direct_sale import DirectSaleCreate, DirectSaleOut

router = APIRouter(prefix="/direct-sales", tags=["direct_sales"])

@router.post("/", response_model=DirectSaleOut)
def create_direct_sale(sale_in: DirectSaleCreate, db: Session = Depends(get_db)):
    if not sale_in.items:
        raise HTTPException(400, "Sale must have at least one item")

    subtotal = Decimal(0)
    sale = DirectSale(
        buyer_name=sale_in.buyer_name,
        discount_amount=sale_in.discount_amount
    )
    db.add(sale)
    db.flush() # Get sale.id

    for item_in in sale_in.items:
        inventory_item = db.query(InventoryItem).filter(InventoryItem.id == item_in.inventory_item_id).first()
        if not inventory_item:
            raise HTTPException(404, f"Inventory item {item_in.inventory_item_id} not found")
        
        unit_cost = Decimal(0)

        # Handle Serialized Item
        if inventory_item.track_serial:
            if not item_in.inventory_unit_id:
                raise HTTPException(400, f"Item {inventory_item.name} requires an inventory_unit_id")
            
            unit = db.query(InventoryUnit).filter(InventoryUnit.id == item_in.inventory_unit_id).first()
            if not unit or unit.inventory_item_id != inventory_item.id:
                raise HTTPException(404, "Serial unit not found or mismatch")
            if unit.status != "in_stock":
                raise HTTPException(400, f"Serial unit {unit.serial_number} is not in stock (status: {unit.status})")
            
            # Mark as used (sold)
            unit.status = "used"
            
            # Deduct from item and batch
            if unit.batch:
                unit.batch.quantity_remaining = max(0, unit.batch.quantity_remaining - 1)
                unit_cost = unit.batch.unit_cost
            else:
                unit_cost = inventory_item.unit_price or Decimal(0)
                
            inventory_item.quantity = max(0, (inventory_item.quantity or 0) - 1)

            sale_item = DirectSaleItem(
                direct_sale_id=sale.id,
                inventory_item_id=inventory_item.id,
                batch_id=unit.batch_id,
                inventory_unit_id=unit.id,
                quantity=1,
                unit_cost=unit_cost,
                unit_price=item_in.unit_price
            )
            db.add(sale_item)
            subtotal += item_in.unit_price * 1

        # Handle Non-Serialized Bulk Item
        else:
            if item_in.quantity <= 0:
                raise HTTPException(400, "Quantity must be greater than 0")
            
            if (inventory_item.quantity or 0) < item_in.quantity:
                raise HTTPException(400, f"Not enough stock for {inventory_item.name}. Available: {inventory_item.quantity}")

            qty_needed = item_in.quantity
            inventory_item.quantity = (inventory_item.quantity or 0) - qty_needed

            # FIFO Deduct
            batches = db.query(InventoryBatch).filter(
                InventoryBatch.inventory_item_id == inventory_item.id,
                InventoryBatch.quantity_remaining > 0
            ).order_by(InventoryBatch.created_at.asc()).all()

            for batch in batches:
                if qty_needed <= 0:
                    break
                
                deduct = min(batch.quantity_remaining, qty_needed)
                batch.quantity_remaining -= deduct
                qty_needed -= deduct

                # Create sale item per batch to correctly track cost
                sale_item = DirectSaleItem(
                    direct_sale_id=sale.id,
                    inventory_item_id=inventory_item.id,
                    batch_id=batch.id,
                    quantity=deduct,
                    unit_cost=batch.unit_cost,
                    unit_price=item_in.unit_price
                )
                db.add(sale_item)
            
            # If still qty_needed, there was a mismatch in batch vs item quantity
            if qty_needed > 0:
                sale_item = DirectSaleItem(
                    direct_sale_id=sale.id,
                    inventory_item_id=inventory_item.id,
                    quantity=qty_needed,
                    unit_cost=inventory_item.unit_price or Decimal(0),
                    unit_price=item_in.unit_price
                )
                db.add(sale_item)
            
            subtotal += item_in.unit_price * item_in.quantity

    sale.subtotal = subtotal
    sale.total_amount = max(Decimal(0), subtotal - sale_in.discount_amount)

    db.commit()
    db.refresh(sale)
    return sale

@router.get("/", response_model=List[DirectSaleOut])
def get_direct_sales(db: Session = Depends(get_db)):
    return db.query(DirectSale).order_by(DirectSale.created_at.desc()).all()
