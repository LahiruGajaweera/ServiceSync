from datetime import datetime, timezone
from decimal import Decimal
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models.customer import Customer
from app.models.invoice import Invoice, JobPartUsed
from app.models.job import Job
from app.schemas.invoice import InvoiceCreate, MarkPaidRequest


from app.models.setting import SystemSetting
import json

def create_invoice(data: InvoiceCreate, db: Session) -> Invoice:
    job = db.query(Job).filter(Job.id == data.job_id).first()
    if not job:
        raise HTTPException(404, "Job not found")
    if db.query(Invoice).filter(Invoice.job_id == data.job_id).first():
        raise HTTPException(400, "Invoice already exists for this job")

    parts = db.query(JobPartUsed).filter(JobPartUsed.job_id == data.job_id).all()
    
    # Cost price for margin protection
    total_cost_price = sum(Decimal(str(p.unit_cost)) * p.quantity for p in parts)
    
    # Selling price (what customer was charged for parts)
    parts_selling_total = sum(Decimal(str(p.unit_price)) * p.quantity for p in parts)
    
    # The base total bill before discounts
    base_subtotal = parts_selling_total + data.labor_cost
    
    # Use the discount calculated and verified by the frontend
    discount_amount = data.discount_amount
            
    # Apply discount
    subtotal = base_subtotal - discount_amount
    
    tax_amount = (subtotal * data.tax_rate / Decimal("100")).quantize(Decimal("0.01"))
    total_amount = subtotal + tax_amount

    qr_data = f"SERVICESYNC|JOB:{job.job_id}|TOTAL:LKR {total_amount:.2f}|STATUS:UNPAID"

    invoice = Invoice(
        job_id=data.job_id,
        subtotal=base_subtotal, # Save the original subtotal
        discount_amount=discount_amount, # Save the discount
        tax_amount=tax_amount,
        total_amount=total_amount,
        payment_status="unpaid",
        qr_code_data=qr_data,
    )
    db.add(invoice)
    db.commit()
    db.refresh(invoice)
    return invoice


def list_invoices(db: Session) -> list[dict]:
    invoices = db.query(Invoice).order_by(Invoice.created_at.desc()).all()
    result = []
    for inv in invoices:
        job = db.query(Job).filter(Job.id == inv.job_id).first()
        customer = db.query(Customer).filter(Customer.id == job.customer_id).first() if job else None
        result.append({
            "id": inv.id,
            "job_id": inv.job_id,
            "job_public_id": job.job_id if job else None,
            "device": f"{job.device_brand} {job.device_model}" if job else None,
            "customer_name": customer.name if customer else None,
            "customer_phone": customer.phone_number if customer else None,
            "subtotal": inv.subtotal,
            "tax_amount": inv.tax_amount,
            "total_amount": inv.total_amount,
            "payment_status": inv.payment_status,
            "payment_method": inv.payment_method,
            "qr_code_data": inv.qr_code_data,
            "paid_at": inv.paid_at,
            "created_at": inv.created_at,
        })
    return result


def get_invoice(invoice_id: UUID, db: Session) -> Invoice:
    inv = db.query(Invoice).filter(Invoice.id == invoice_id).first()
    if not inv:
        raise HTTPException(404, "Invoice not found")
    return inv


def get_invoice_by_job(job_id: UUID, db: Session) -> Invoice | None:
    return db.query(Invoice).filter(Invoice.job_id == job_id).first()


def mark_paid(invoice_id: UUID, data: MarkPaidRequest, db: Session) -> Invoice:
    inv = db.query(Invoice).filter(Invoice.id == invoice_id).first()
    if not inv:
        raise HTTPException(404, "Invoice not found")
    inv.payment_status = "paid"
    inv.payment_method = data.payment_method
    inv.paid_at = datetime.now(timezone.utc)
    inv.qr_code_data = inv.qr_code_data.replace("STATUS:UNPAID", "STATUS:PAID") if inv.qr_code_data else inv.qr_code_data
    db.commit()
    db.refresh(inv)
    return inv
