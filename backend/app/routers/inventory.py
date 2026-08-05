from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import require_admin, require_any_staff
from app.models.user import User
from app.schemas.inventory import (
    InventoryBatchResponse,
    InventoryItemCreate,
    InventoryItemResponse,
    InventoryItemUpdate,
    InventoryItemUpdate,
    ReceiveStockRequest,
    StockAdjustRequest,
    InventoryAdjustmentLogResponse,
)
from app.schemas.invoice import ConsumeByBatchRequest, JobPartResponse
from app.schemas.job import CompatiblePartsResponse
from app.services import inventory_service, job_parts_service

router = APIRouter(prefix="/inventory", tags=["Inventory"])


# Literal routes must come before /{id}
@router.get("/low-stock", response_model=list[InventoryItemResponse])
def get_low_stock(
    db: Session = Depends(get_db),
    _=Depends(require_any_staff),
):
    return inventory_service.list_items(db, low_stock_only=True)


@router.get("/suggest", response_model=CompatiblePartsResponse)
def suggest_parts(
    brand: str = Query(...),
    model: str = Query(...),
    db: Session = Depends(get_db),
    _=Depends(require_any_staff),
):
    return inventory_service.suggest_compatible_parts(brand, model, db)


@router.get("/scan/{code}")
def resolve_scan(
    code: str,
    db: Session = Depends(get_db),
    _=Depends(require_any_staff),
):
    return inventory_service.resolve_scan(code, db)


@router.post("/consume", response_model=JobPartResponse, status_code=201)
def consume_part(
    data: ConsumeByBatchRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_staff),
):
    """Consume stock from a single batch (by its printed code) and log it to a job."""
    return inventory_service.consume_from_batch(data, current_user.id, db)


@router.get("/adjustments/all", response_model=list[InventoryAdjustmentLogResponse])
def list_all_adjustments(
    db: Session = Depends(get_db),
    _=Depends(require_admin),
):
    return inventory_service.list_all_adjustments(db)


@router.post("/", response_model=InventoryItemResponse, status_code=201)
def create_item(
    data: InventoryItemCreate,
    db: Session = Depends(get_db),
    _=Depends(require_admin),
):
    return inventory_service.create_item(data, db)


@router.get("/", response_model=list[InventoryItemResponse])
def list_items(
    search: str | None = Query(default=None),
    db: Session = Depends(get_db),
    _=Depends(require_any_staff),
):
    return inventory_service.list_items(db, search=search)


@router.get("/{item_id}", response_model=InventoryItemResponse)
def get_item(
    item_id: UUID,
    db: Session = Depends(get_db),
    _=Depends(require_any_staff),
):
    return inventory_service.get_item(item_id, db)


@router.patch("/{item_id}", response_model=InventoryItemResponse)
def update_item(
    item_id: UUID,
    data: InventoryItemUpdate,
    db: Session = Depends(get_db),
    _=Depends(require_admin),
):
    return inventory_service.update_item(item_id, data, db)


@router.patch("/{item_id}/stock", response_model=InventoryItemResponse)
def adjust_stock(
    item_id: UUID,
    data: StockAdjustRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    return inventory_service.adjust_stock(item_id, data, current_user.id, db)


@router.post("/{item_id}/receive", response_model=InventoryBatchResponse, status_code=201)
def receive_stock(
    item_id: UUID,
    data: ReceiveStockRequest,
    db: Session = Depends(get_db),
    _=Depends(require_admin),
):
    return inventory_service.receive_stock(item_id, data, db)


@router.get("/{item_id}/batches", response_model=list[InventoryBatchResponse])
def list_batches(
    item_id: UUID,
    db: Session = Depends(get_db),
    _=Depends(require_any_staff),
):
    return inventory_service.list_batches(item_id, db)

@router.get("/{item_id}/adjustments", response_model=list[InventoryAdjustmentLogResponse])
def list_adjustments(
    item_id: UUID,
    db: Session = Depends(get_db),
    _=Depends(require_admin),
):
    return inventory_service.list_adjustments(item_id, db)
