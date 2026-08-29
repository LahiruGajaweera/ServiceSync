import hashlib
import os
from uuid import UUID

from fastapi import APIRouter, Depends, Form, HTTPException, Request, BackgroundTasks
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.invoice import Invoice
from app.models.job import Job, JobStatusHistory
from app.schemas.invoice import MarkPaidRequest
from app.services import invoice_service

router = APIRouter(prefix="/payments", tags=["Payments"])

PAYHERE_MERCHANT_ID = os.environ.get("PAYHERE_MERCHANT_ID")
PAYHERE_SECRET = os.environ.get("PAYHERE_SECRET")

@router.get("/invoice/{invoice_id}")
def get_public_invoice(invoice_id: UUID, db: Session = Depends(get_db)):
    invoice = db.query(Invoice).filter(Invoice.id == invoice_id).first()
    if not invoice:
        raise HTTPException(404, "Invoice not found")
        
    job = db.query(Job).filter(Job.id == invoice.job_id).first()
    
    return {
        "id": str(invoice.id),
        "total_amount": invoice.total_amount,
        "payment_status": invoice.payment_status,
        "customer_name": job.customer_name if job else "Customer",
        "customer_phone": job.customer_phone if job else "",
        "job_id": job.job_id if job else "",
        "device": f"{job.device_brand} {job.device_model}" if job else "Device",
    }

@router.get("/hash")
def get_payhere_hash(order_id: str, amount: str, currency: str = "LKR"):
    if not PAYHERE_MERCHANT_ID or not PAYHERE_SECRET:
        raise HTTPException(500, "PayHere credentials not configured")
        
    # Format amount with 2 decimal places to match PayHere spec
    formatted_amount = f"{float(amount):.2f}"
        
    merchant_secret_hash = hashlib.md5(PAYHERE_SECRET.encode()).hexdigest().upper()
    hash_str = f"{PAYHERE_MERCHANT_ID}{order_id}{formatted_amount}{currency}{merchant_secret_hash}"
    final_hash = hashlib.md5(hash_str.encode()).hexdigest().upper()
    
    return {
        "merchant_id": PAYHERE_MERCHANT_ID,
        "hash": final_hash,
        "amount": formatted_amount,
        "currency": currency,
        "order_id": order_id
    }

@router.post("/payhere-notify")
async def payhere_notify(
    request: Request,
    background_tasks: BackgroundTasks,
    merchant_id: str = Form(...),
    order_id: str = Form(...),
    payhere_amount: str = Form(...),
    payhere_currency: str = Form(...),
    status_code: str = Form(...),
    md5sig: str = Form(...),
    payment_id: str = Form(None),
    db: Session = Depends(get_db)
):
    if not PAYHERE_MERCHANT_ID or not PAYHERE_SECRET:
        raise HTTPException(500, "PayHere credentials not configured")

    # Verify Hash
    merchant_secret_hash = hashlib.md5(PAYHERE_SECRET.encode()).hexdigest().upper()
    local_hash_str = f"{PAYHERE_MERCHANT_ID}{order_id}{payhere_amount}{payhere_currency}{status_code}{merchant_secret_hash}"
    local_md5sig = hashlib.md5(local_hash_str.encode()).hexdigest().upper()

    if local_md5sig != md5sig:
        raise HTTPException(400, "Invalid signature")

    if status_code == "2":
        # Payment Success! Update Invoice.
        try:
            invoice_uuid = UUID(order_id)
        except ValueError:
            raise HTTPException(400, "Invalid order_id format")

        invoice = db.query(Invoice).filter(Invoice.id == invoice_uuid).first()
        if invoice and invoice.payment_status != "paid":
            # Mark invoice as paid
            invoice_service.mark_paid(
                invoice.id, 
                MarkPaidRequest(payment_method="payhere", payment_reference=payment_id), 
                db
            )
            
            # Automatically set job to delivered upon payment
            job = db.query(Job).filter(Job.id == invoice.job_id).first()
            if job and job.status != "delivered":
                job.status = "delivered"
                
                # Add history record (using technician_id if claimed, otherwise None)
                history = JobStatusHistory(
                    job_id=job.id,
                    status="delivered",
                    changed_by=job.technician_id,
                    notes="Automatically marked as delivered upon PayHere payment."
                )
                db.add(history)
                db.commit()
                
                # Send delivered SMS
                from app.services.notification_service import notify_delivered
                background_tasks.add_task(notify_delivered, job.id)

    return {"status": "ok"}

@router.post("/send-link")
def send_payment_link(order_id: str = Form(...), phone_number: str = Form(...), db: Session = Depends(get_db)):
    try:
        invoice_uuid = UUID(order_id)
    except ValueError:
        raise HTTPException(400, "Invalid order_id format")

    invoice = db.query(Invoice).filter(Invoice.id == invoice_uuid).first()
    if not invoice:
        raise HTTPException(404, "Invoice not found")
        
    frontend_url = os.environ.get("FRONTEND_URL", "http://localhost:5173")
    payment_link = f"{frontend_url}/pay/{order_id}"
    
    message = f"Your ServiceSync invoice is ready. Please pay LKR {invoice.total_amount} online via: {payment_link}"
    
    # Use configured SMS provider
    from app.services.otp_delivery import _send_sms, _sms_configured
    if _sms_configured():
        try:
            _send_sms(phone_number, message)
        except Exception as e:
            raise HTTPException(500, f"Failed to send SMS: {str(e)}")
    
    return {"status": "ok", "message": "SMS sent successfully", "preview": message}
