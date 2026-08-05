from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import require_admin, require_any_staff
from app.schemas.invoice import InvoiceCreate, InvoiceResponse, JobPartCreate, MarkPaidRequest
from app.services import invoice_service, job_parts_service

router = APIRouter(prefix="/invoices", tags=["Invoices"])


@router.post("/", response_model=InvoiceResponse, status_code=201)
def create_invoice(
    data: InvoiceCreate,
    db: Session = Depends(get_db),
    _=Depends(require_admin),
):
    return invoice_service.create_invoice(data, db)


@router.get("/")
def list_invoices(
    db: Session = Depends(get_db),
    _=Depends(require_any_staff),
):
    return invoice_service.list_invoices(db)


@router.get("/{invoice_id}", response_model=InvoiceResponse)
def get_invoice(
    invoice_id: UUID,
    db: Session = Depends(get_db),
    _=Depends(require_any_staff),
):
    return invoice_service.get_invoice(invoice_id, db)


@router.patch("/{invoice_id}/pay", response_model=InvoiceResponse)
def mark_paid(
    invoice_id: UUID,
    data: MarkPaidRequest,
    db: Session = Depends(get_db),
    _=Depends(require_admin),
):
    return invoice_service.mark_paid(invoice_id, data, db)
