from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import require_admin, require_any_staff
from app.schemas.supplier import SupplierCreate, SupplierResponse, SupplierUpdate
from app.services import supplier_service

router = APIRouter(prefix="/suppliers", tags=["Suppliers"])


@router.post("/", response_model=SupplierResponse, status_code=201)
def create_supplier(
    data: SupplierCreate,
    db: Session = Depends(get_db),
    _=Depends(require_any_staff),
):
    # Allow any staff to create a supplier when adding inventory
    return supplier_service.create_supplier(data, db)


@router.get("/", response_model=list[SupplierResponse])
def list_suppliers(
    search: str | None = Query(default=None),
    db: Session = Depends(get_db),
    _=Depends(require_any_staff),
):
    return supplier_service.list_suppliers(db, search=search)


@router.get("/{supplier_id}", response_model=SupplierResponse)
def get_supplier(
    supplier_id: UUID,
    db: Session = Depends(get_db),
    _=Depends(require_any_staff),
):
    return supplier_service.get_supplier(supplier_id, db)


@router.put("/{supplier_id}", response_model=SupplierResponse)
def update_supplier(
    supplier_id: UUID,
    data: SupplierUpdate,
    db: Session = Depends(get_db),
    _=Depends(require_admin),
):
    return supplier_service.update_supplier(supplier_id, data, db)
