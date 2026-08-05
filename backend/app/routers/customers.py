from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import require_admin, require_any_staff
from app.schemas.customer import CustomerCreate, CustomerResponse, CustomerUpdate
from app.services import customer_service

router = APIRouter(prefix="/customers", tags=["Customers"])


@router.post("/", response_model=CustomerResponse, status_code=201)
def create_customer(
    data: CustomerCreate,
    db: Session = Depends(get_db),
    _=Depends(require_admin),
):
    return customer_service.create_customer(data, db)


@router.get("/", response_model=list[CustomerResponse])
def list_customers(
    search: str | None = Query(default=None),
    db: Session = Depends(get_db),
    _=Depends(require_any_staff),
):
    return customer_service.list_customers(db, search=search)


@router.get("/{customer_id}", response_model=CustomerResponse)
def get_customer(
    customer_id: UUID,
    db: Session = Depends(get_db),
    _=Depends(require_any_staff),
):
    return customer_service.get_customer(customer_id, db)


@router.put("/{customer_id}", response_model=CustomerResponse)
def update_customer(
    customer_id: UUID,
    data: CustomerUpdate,
    db: Session = Depends(get_db),
    _=Depends(require_admin),
):
    return customer_service.update_customer(customer_id, data, db)
