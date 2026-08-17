from uuid import UUID

from sqlalchemy.orm import Session

from app.core.database import SessionLocal
from app.models.customer import Customer
from app.models.job import Job
from app.models.notification import Notification


def log_notification(
    job_id: UUID,
    customer_id: UUID,
    notification_type: str,
    message: str,
    db: Session,
    status: str = "pending",
) -> Notification:
    notif = Notification(
        job_id=job_id,
        customer_id=customer_id,
        notification_type=notification_type,
        message=message,
        status=status,
    )
    db.add(notif)
    db.commit()
    db.refresh(notif)
    return notif


def _get_tracking_url(job_id_str: str) -> str:
    # In a real app, this should be the public frontend URL.
    return f"http://localhost:5173/track/{job_id_str}"


def _get_qr_url(data: str) -> str:
    # Free reliable QR code API
    return f"https://api.qrserver.com/v1/create-qr-code/?size=150x150&data={data}"


def notify_job_created(job_id: UUID) -> None:
    db = SessionLocal()
    try:
        job = db.query(Job).filter(Job.id == job_id).first()
        if not job:
            return
        customer = db.query(Customer).filter(Customer.id == job.customer_id).first()
        if not customer:
            return

        track_url = _get_tracking_url(job.job_id)
        qr_url = _get_qr_url(track_url)
        cost_str = f"LKR {job.estimated_cost}" if job.estimated_cost else "TBD"

        # 1. Email Logic (Digital Receipt)
        if customer.email:
            subject = f"Receipt: ServiceSync Repair Job {job.job_id}"
            plain_body = f"Dear {customer.name}, your device ({job.device_brand} {job.device_model}) has been received. Estimated Cost: {cost_str}. Track status: {track_url}"
            html_body = f"""
            <html>
                <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
                    <div style="max-width: 400px; margin: 0 auto; border: 1px solid #ddd; border-radius: 8px; padding: 20px; text-align: center;">
                        <h2 style="color: #2563eb; margin-bottom: 5px;">ServiceSync</h2>
                        <p style="margin-top: 0; color: #666;">Service Receipt</p>
                        <hr style="border: 0; border-top: 1px dashed #ccc; margin: 20px 0;">
                        <p><strong>Job ID:</strong> {job.job_id}</p>
                        <p><strong>Customer:</strong> {customer.name}</p>
                        <p><strong>Device:</strong> {job.device_brand} {job.device_model}</p>
                        <p><strong>Fault:</strong> {job.fault_category.replace('_', ' ').title()}</p>
                        <p><strong>Estimated Cost:</strong> {cost_str}</p>
                        <hr style="border: 0; border-top: 1px dashed #ccc; margin: 20px 0;">
                        <p style="font-size: 0.9em; color: #555;">Scan to track your repair status:</p>
                        <img src="{qr_url}" alt="QR Code" width="150" height="150" style="margin: 10px 0;">
                        <p style="font-size: 0.8em; color: #888;">Or click <a href="{track_url}">here</a> to track.</p>
                    </div>
                </body>
            </html>
            """
            from app.services.otp_delivery import _send_email, _smtp_configured
            sent_email = False
            if _smtp_configured():
                try:
                    _send_email(customer.email, subject, plain_body, html_body)
                    sent_email = True
                except Exception:
                    pass
            log_notification(job.id, customer.id, "email", plain_body, db, status="sent" if sent_email else "dev_mode_mock")
            if not sent_email:
                print(f"[Email Dev Mode] Job Created Sent to {customer.email}:\n{html_body}")

        # 2. SMS Logic
        if customer.phone_number:
            sms_body = f"ServiceSync: We've received your {job.device_brand} {job.device_model}. Job: {job.job_id}. Cost: {cost_str}. Track: {track_url}"
            from app.services.otp_delivery import _send_sms, _sms_configured
            sent_sms = False
            if _sms_configured():
                try:
                    _send_sms(customer.phone_number, sms_body)
                    sent_sms = True
                except Exception:
                    pass
            log_notification(job.id, customer.id, "sms", sms_body, db, status="sent" if sent_sms else "dev_mode_mock")
            if not sent_sms:
                print(f"[SMS Dev Mode] Job Created Sent to {customer.phone_number}: {sms_body}")

    finally:
        db.close()


def notify_ready_for_pickup(job_id: UUID) -> None:
    db = SessionLocal()
    try:
        job = db.query(Job).filter(Job.id == job_id).first()
        if not job:
            return
        customer = db.query(Customer).filter(Customer.id == job.customer_id).first()
        if not customer:
            return
            
        subject = "Your device is ready for collection"
        message = (
            f"Dear {customer.name}, your device ({job.device_brand} {job.device_model}) "
            f"is ready for collection. Job ID: {job.job_id}. Please visit the shop."
        )

        if customer.email:
            from app.services.otp_delivery import _send_email, _smtp_configured
            sent_email = False
            if _smtp_configured():
                try:
                    _send_email(customer.email, subject, message)
                    sent_email = True
                except Exception:
                    pass
            log_notification(job.id, customer.id, "email", message, db, status="sent" if sent_email else "dev_mode_mock")
            if not sent_email:
                 print(f"[Email Dev Mode] Ready for Pickup Sent to {customer.email}: {message}")

        if customer.phone_number:
            from app.services.otp_delivery import _send_sms, _sms_configured
            sent_sms = False
            if _sms_configured():
                try:
                    _send_sms(customer.phone_number, message)
                    sent_sms = True
                except Exception:
                    pass
            log_notification(job.id, customer.id, "sms", message, db, status="sent" if sent_sms else "dev_mode_mock")
            if not sent_sms:
                 print(f"[SMS Dev Mode] Ready for Pickup Sent to {customer.phone_number}: {message}")
                 
    finally:
        db.close()


def notify_unclaimed(job_id: UUID) -> None:
    db = SessionLocal()
    try:
        job = db.query(Job).filter(Job.id == job_id).first()
        if not job:
            return
        customer = db.query(Customer).filter(Customer.id == job.customer_id).first()
        if not customer:
            return

        subject = "Urgent: Unclaimed Device"
        message = (
            f"Dear {customer.name}, your device ({job.device_brand} {job.device_model}) "
            f"has been marked as unclaimed. Job ID: {job.job_id}. "
            "Please contact the shop as soon as possible to arrange collection."
        )

        if customer.email:
            from app.services.otp_delivery import _send_email, _smtp_configured
            sent_email = False
            if _smtp_configured():
                try:
                    _send_email(customer.email, subject, message)
                    sent_email = True
                except Exception:
                    pass
            log_notification(job.id, customer.id, "email", message, db, status="sent" if sent_email else "dev_mode_mock")
            if not sent_email:
                 print(f"[Email Dev Mode] Unclaimed Sent to {customer.email}: {message}")

        if customer.phone_number:
            from app.services.otp_delivery import _send_sms, _sms_configured
            sent_sms = False
            if _sms_configured():
                try:
                    _send_sms(customer.phone_number, message)
                    sent_sms = True
                except Exception:
                    pass
            log_notification(job.id, customer.id, "sms", message, db, status="sent" if sent_sms else "dev_mode_mock")
            if not sent_sms:
                 print(f"[SMS Dev Mode] Unclaimed Sent to {customer.phone_number}: {message}")
    finally:
        db.close()


def notify_job_reminder(job_id: UUID, message: str) -> None:
    db = SessionLocal()
    try:
        job = db.query(Job).filter(Job.id == job_id).first()
        if not job:
            return
        customer = db.query(Customer).filter(Customer.id == job.customer_id).first()
        if not customer:
            return

        subject = "ServiceSync Reminder"
        # We append the job ID just in case
        full_message = f"Dear {customer.name}, {message} Job ID: {job.job_id}"

        if customer.email:
            from app.services.otp_delivery import _send_email, _smtp_configured
            sent_email = False
            if _smtp_configured():
                try:
                    _send_email(customer.email, subject, full_message)
                    sent_email = True
                except Exception:
                    pass
            log_notification(job.id, customer.id, "email", full_message, db, status="sent" if sent_email else "dev_mode_mock")
            if not sent_email:
                 print(f"[Email Dev Mode] Reminder Sent to {customer.email}: {full_message}")

        if customer.phone_number:
            from app.services.otp_delivery import _send_sms, _sms_configured
            sent_sms = False
            if _sms_configured():
                try:
                    _send_sms(customer.phone_number, full_message)
                    sent_sms = True
                except Exception:
                    pass
            log_notification(job.id, customer.id, "sms", full_message, db, status="sent" if sent_sms else "dev_mode_mock")
            if not sent_sms:
                 print(f"[SMS Dev Mode] Reminder Sent to {customer.phone_number}: {full_message}")
    finally:
        db.close()


def notify_in_progress(job_id: UUID) -> None:
    db = SessionLocal()
    try:
        job = db.query(Job).filter(Job.id == job_id).first()
        if not job:
            return
        customer = db.query(Customer).filter(Customer.id == job.customer_id).first()
        if not customer:
            return
            
        track_url = _get_tracking_url(job.job_id)
        subject = f"Repair In Progress: {job.job_id}"
        message = (
            f"Dear {customer.name}, our technician has started working on your device ({job.device_brand} {job.device_model}). "
            f"Job ID: {job.job_id}. Track status: {track_url}"
        )

        if customer.email:
            from app.services.otp_delivery import _send_email, _smtp_configured
            sent_email = False
            if _smtp_configured():
                try:
                    _send_email(customer.email, subject, message)
                    sent_email = True
                except Exception:
                    pass
            log_notification(job.id, customer.id, "email", message, db, status="sent" if sent_email else "dev_mode_mock")
            if not sent_email:
                 print(f"[Email Dev Mode] In Progress Sent to {customer.email}: {message}")

        if customer.phone_number:
            from app.services.otp_delivery import _send_sms, _sms_configured
            sent_sms = False
            if _sms_configured():
                try:
                    _send_sms(customer.phone_number, message)
                    sent_sms = True
                except Exception:
                    pass
            log_notification(job.id, customer.id, "sms", message, db, status="sent" if sent_sms else "dev_mode_mock")
            if not sent_sms:
                 print(f"[SMS Dev Mode] In Progress Sent to {customer.phone_number}: {message}")
                 
    finally:
        db.close()


def notify_completed(job_id: UUID) -> None:
    db = SessionLocal()
    try:
        job = db.query(Job).filter(Job.id == job_id).first()
        if not job:
            return
        customer = db.query(Customer).filter(Customer.id == job.customer_id).first()
        if not customer:
            return
            
        track_url = _get_tracking_url(job.job_id)
        subject = f"Repair Completed: {job.job_id}"
        message = (
            f"Dear {customer.name}, the repair for your device ({job.device_brand} {job.device_model}) is complete. "
            f"Job ID: {job.job_id}. Please wait for the final ready for pickup notification. Track status: {track_url}"
        )

        if customer.email:
            from app.services.otp_delivery import _send_email, _smtp_configured
            sent_email = False
            if _smtp_configured():
                try:
                    _send_email(customer.email, subject, message)
                    sent_email = True
                except Exception:
                    pass
            log_notification(job.id, customer.id, "email", message, db, status="sent" if sent_email else "dev_mode_mock")
            if not sent_email:
                 print(f"[Email Dev Mode] Completed Sent to {customer.email}: {message}")

        if customer.phone_number:
            from app.services.otp_delivery import _send_sms, _sms_configured
            sent_sms = False
            if _sms_configured():
                try:
                    _send_sms(customer.phone_number, message)
                    sent_sms = True
                except Exception:
                    pass
            log_notification(job.id, customer.id, "sms", message, db, status="sent" if sent_sms else "dev_mode_mock")
            if not sent_sms:
                 print(f"[SMS Dev Mode] Completed Sent to {customer.phone_number}: {message}")
                 
    finally:
        db.close()


def notify_delivered(job_id: UUID) -> None:
    db = SessionLocal()
    try:
        job = db.query(Job).filter(Job.id == job_id).first()
        if not job:
            return
        customer = db.query(Customer).filter(Customer.id == job.customer_id).first()
        if not customer:
            return
            
        subject = f"Thank you for choosing ServiceSync!"
        message = (
            f"Dear {customer.name}, your device ({job.device_brand} {job.device_model}) has been delivered. "
            f"Thank you for doing business with us!"
        )

        if customer.email:
            from app.services.otp_delivery import _send_email, _smtp_configured
            sent_email = False
            if _smtp_configured():
                try:
                    _send_email(customer.email, subject, message)
                    sent_email = True
                except Exception:
                    pass
            log_notification(job.id, customer.id, "email", message, db, status="sent" if sent_email else "dev_mode_mock")
            if not sent_email:
                 print(f"[Email Dev Mode] Delivered Sent to {customer.email}: {message}")

        if customer.phone_number:
            from app.services.otp_delivery import _send_sms, _sms_configured
            sent_sms = False
            if _sms_configured():
                try:
                    _send_sms(customer.phone_number, message)
                    sent_sms = True
                except Exception:
                    pass
            log_notification(job.id, customer.id, "sms", message, db, status="sent" if sent_sms else "dev_mode_mock")
            if not sent_sms:
                 print(f"[SMS Dev Mode] Delivered Sent to {customer.phone_number}: {message}")
                 
    finally:
        db.close()


def list_notifications(db: Session) -> list[Notification]:
    return db.query(Notification).order_by(Notification.created_at.desc()).all()


def list_notifications_for_job(job_id: UUID, db: Session) -> list[Notification]:
    return (
        db.query(Notification)
        .filter(Notification.job_id == job_id)
        .order_by(Notification.created_at.desc())
        .all()
    )


def notify_admin_unclaimed(job_id: UUID) -> None:
    db = SessionLocal()
    try:
        job = db.query(Job).filter(Job.id == job_id).first()
        if not job:
            return
            
        from app.models.user import User
        admins = db.query(User).filter(User.role == "admin").all()
        
        subject = f"System Alert: New Donor Device Auto-Registered"
        message = (
            f"Job {job.job_id} ({job.device_brand} {job.device_model}) has been marked as unclaimed. "
            f"It has been automatically added to the Donor Device Console."
        )

        # SMS/Email logic removed as per user request to only show dashboard notifications
        # The dashboard notification will be handled via the Job.admin_alert field
    finally:
        db.close()


def notify_final_warning(job_id: UUID):
    """Notify customer that they have a short grace period left to collect their device."""
    db = SessionLocal()
    try:
        job = db.query(Job).filter(Job.id == job_id).first()
        customer = db.query(Customer).filter(Customer.id == job.customer_id).first()

        subject = "FINAL WARNING: Device Collection"
        message = (
            f"Dear {customer.name}, your device ({job.device_brand} {job.device_model}) "
            f"has been ready for pickup for a long time. You have a few days left to collect it. "
            f"If not collected, it will be classified as abandoned and dismantled for parts. "
            f"Please visit the shop immediately. Job ID: {job.job_id}"
        )

        if customer.email:
            from app.services.otp_delivery import _send_email, _smtp_configured
            if _smtp_configured():
                try:
                    _send_email(customer.email, subject, message)
                except Exception:
                    pass
            else:
                print(f"[Email Dev Mode] Final Warning Sent to {customer.email}: {message}")

        if customer.phone_number:
            from app.services.otp_delivery import _send_sms, _sms_configured
            if _sms_configured():
                try:
                    _send_sms(customer.phone_number, message)
                except Exception:
                    pass
            else:
                print(f"[SMS Dev Mode] Final Warning Sent to {customer.phone_number}: {message}")
    finally:
        db.close()
