import secrets
from datetime import date, datetime, timezone
from uuid import UUID

from fastapi import HTTPException, BackgroundTasks
from sqlalchemy.orm import Session, aliased

from app.models.customer import Customer
from app.models.job import Job, JobStatusHistory, JobImage
from app.models.user import User
from app.schemas.job import AssignTechnicianRequest, JobCreate, JobStatusUpdate, TimerToggleRequest, AutoResumeRequest


# ─── helpers ─────────────────────────────────────────────────────────────────

def _generate_job_id(db: Session) -> str:
    for _ in range(10):
        candidate = f"SS-{secrets.token_hex(4).upper()}"
        if not db.query(Job).filter(Job.job_id == candidate).first():
            return candidate
    raise RuntimeError("Could not generate a unique Job ID — retry the request")


def _job_dict(job: Job, customer_name=None, customer_phone=None, technician_name=None, images=None) -> dict:
    return {
        "id": job.id,
        "job_id": job.job_id,
        "customer_id": job.customer_id,
        "customer_name": customer_name,
        "customer_phone": customer_phone,
        "technician_id": job.technician_id,
        "technician_name": technician_name,
        "device_brand": job.device_brand,
        "device_model": job.device_model,
        "device_imei": job.device_imei,
        "fault_category": job.fault_category,
        "fault_description": job.fault_description,
        "status": job.status,
        "estimated_completion_date": job.estimated_completion_date,
        "estimated_cost": job.estimated_cost,
        "investigated": job.investigated,
        "received_date": job.received_date,
        "completed_date": job.completed_date,
        "notes": job.notes,
        "revert_requested_to": job.revert_requested_to,
        "revert_reason": job.revert_reason,
        "admin_alert": job.admin_alert,
        "labor_cost": job.labor_cost,
        "physical_condition": job.physical_condition,
        "images": images or [],
        "created_at": job.created_at,
        "created_at": job.created_at,
        "rework_of_job_id": job.rework_of_job_id,
        "active_repair_start_time": job.active_repair_start_time,
        "total_diagnostic_seconds": job.total_diagnostic_seconds,
        "total_active_repair_seconds": job.total_active_repair_seconds,
        "current_timer_mode": job.current_timer_mode,
        "qc_mic_tested": job.qc_mic_tested,
        "qc_camera_tested": job.qc_camera_tested,
        "qc_touch_tested": job.qc_touch_tested,
        "qc_biometrics_tested": job.qc_biometrics_tested,
        "qc_wifi_tested": job.qc_wifi_tested,
        "qc_charging_tested": job.qc_charging_tested,
    }


def _query_jobs(db: Session, status: str | None = None, technician_id: UUID | None = None, include_unassigned: bool = False, has_alerts: bool = False):
    TechAlias = aliased(User)

    q = (
        db.query(
            Job,
            Customer.name.label("customer_name"),
            Customer.phone_number.label("customer_phone"),
            TechAlias.name.label("technician_name"),
        )
        .join(Customer, Job.customer_id == Customer.id)
        .outerjoin(TechAlias, Job.technician_id == TechAlias.id)
    )

    if status:
        q = q.filter(Job.status == status)
    if technician_id:
        if include_unassigned:
            q = q.filter((Job.technician_id == technician_id) | (Job.technician_id.is_(None)))
        else:
            q = q.filter(Job.technician_id == technician_id)

    if has_alerts:
        q = q.filter((Job.revert_requested_to.isnot(None)) | (Job.admin_alert.isnot(None)))

    return q.order_by(Job.created_at.desc()).all()


# ─── public ──────────────────────────────────────────────────────────────────

def toggle_timer(job_id: UUID, data: TimerToggleRequest, current_user: User, db: Session) -> dict:
    job = db.query(Job).filter(Job.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
        
    if job.technician_id != current_user.id and current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Not authorized to toggle timer for this job")
        
    now_time = datetime.now(timezone.utc)
    requested_mode = data.mode

    if job.active_repair_start_time:
        # A timer is running. Stop it and record elapsed time.
        elapsed = (now_time - job.active_repair_start_time.replace(tzinfo=timezone.utc)).total_seconds()
        
        if job.current_timer_mode == "diagnostic":
            job.total_diagnostic_seconds = (job.total_diagnostic_seconds or 0) + int(elapsed)
        else:
            job.total_active_repair_seconds = (job.total_active_repair_seconds or 0) + int(elapsed)
            
        job.active_repair_start_time = None
        job.current_timer_mode = None
        
        # If the user clicked to switch to the OTHER mode (requested_mode is different than the one that was running)
        # We start the new mode immediately. If requested_mode is None or same, it's just a pause.
        if requested_mode and requested_mode != job.current_timer_mode: # wait, current_timer_mode is None now.
            pass # We will handle starting the new mode below
            
    # If we are starting a timer (either because it was paused, or we just switched modes)
    if requested_mode and not job.active_repair_start_time:
        job.active_repair_start_time = now_time
        job.current_timer_mode = requested_mode
        if job.status == "pending":
            job.status = "in_progress"
            
    db.commit()
    db.refresh(job)
    
    customer = db.query(Customer).filter(Customer.id == job.customer_id).first()
    tech = db.query(User).filter(User.id == job.technician_id).first()
    return _job_dict(job, customer.name if customer else None, customer.phone_number if customer else None, tech.name if tech else None)


def auto_resume_timer(job_id: UUID, data: AutoResumeRequest, current_user: User, db: Session) -> dict:
    job = db.query(Job).filter(Job.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
        
    if job.technician_id != current_user.id and current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Not authorized to toggle timer for this job")
        
    now_time = datetime.now(timezone.utc)
    
    if data.away_seconds > 0:
        # Cap away seconds to 12 hours max per session to prevent overnight penalties
        capped_away = min(data.away_seconds, 12 * 3600)
        job.total_away_seconds = (job.total_away_seconds or 0) + capped_away

    # Start timer
    job.active_repair_start_time = now_time
    job.current_timer_mode = data.mode
    if job.status == "pending":
        job.status = "in_progress"
            
    db.commit()
    db.refresh(job)
    
    customer = db.query(Customer).filter(Customer.id == job.customer_id).first()
    tech = db.query(User).filter(User.id == job.technician_id).first()
    return _job_dict(job, customer.name if customer else None, customer.phone_number if customer else None, tech.name if tech else None)

def create_job(data: JobCreate, created_by: User, db: Session, background_tasks: BackgroundTasks = None) -> dict:
    original_job_code = None
    if data.rework_of_job_id:
        parent_job = db.query(Job).filter(Job.id == data.rework_of_job_id).first()
        if parent_job:
            original_job_code = parent_job.job_id

    job = Job(
        job_id=_generate_job_id(db),
        customer_id=data.customer_id,
        technician_id=data.technician_id,
        rework_of_job_id=data.rework_of_job_id,
        device_brand=data.device_brand,
        device_model=data.device_model,
        device_imei=data.device_imei,
        fault_category=data.fault_category,
        fault_description=data.fault_description,
        estimated_completion_date=data.estimated_completion_date,
        estimated_cost=data.estimated_cost if not data.rework_of_job_id else 0,
        investigated=data.investigated,
        notes=data.notes,
        physical_condition=data.physical_condition,
        status="pending",
    )
    db.add(job)
    db.flush()  # populate job.id before inserting history

    history_note = f"Warranty Claim registered (Rework of #{original_job_code})" if original_job_code else "Job registered"
    history = JobStatusHistory(
        job_id=job.id,
        status="pending",
        changed_by=created_by.id,
        notes=history_note,
    )
    db.add(history)
    db.commit()
    db.refresh(job)

    if background_tasks:
        from app.services.notification_service import notify_job_created
        background_tasks.add_task(notify_job_created, job.id)

    customer = db.query(Customer).filter(Customer.id == job.customer_id).first()
    return _job_dict(job, customer.name if customer else None, customer.phone_number if customer else None)


def list_jobs(db: Session, status: str | None = None, technician_id: UUID | None = None, include_unassigned: bool = False, has_alerts: bool = False) -> list[dict]:
    rows = _query_jobs(db, status=status, technician_id=technician_id, include_unassigned=include_unassigned, has_alerts=has_alerts)
    if not rows:
        return []
        
    job_ids = [job.id for job, _, _, _ in rows]
    all_images = db.query(JobImage).filter(JobImage.job_id.in_(job_ids)).all()
    images_by_job = {}
    for img in all_images:
        images_by_job.setdefault(img.job_id, []).append({
            "id": img.id,
            "file_path": img.file_path,
            "created_at": img.created_at
        })
        
    return [_job_dict(job, cname, cphone, tname, images_by_job.get(job.id, [])) for job, cname, cphone, tname in rows]


def get_all_identified_faults(db: Session) -> list[str]:
    results = db.query(Job.identified_fault).filter(Job.identified_fault.isnot(None)).distinct().all()
    return [r[0] for r in results if r[0]]


def get_job(job_id: UUID, db: Session) -> dict:
    TechAlias = aliased(User)
    row = (
        db.query(
            Job,
            Customer.name.label("customer_name"),
            Customer.phone_number.label("customer_phone"),
            TechAlias.name.label("technician_name"),
        )
        .join(Customer, Job.customer_id == Customer.id)
        .outerjoin(TechAlias, Job.technician_id == TechAlias.id)
        .filter(Job.id == job_id)
        .first()
    )
    if not row:
        raise HTTPException(404, "Job not found")
    job, cname, cphone, tname = row
    
    images = db.query(JobImage).filter(JobImage.job_id == job_id).all()
    images_list = [{"id": img.id, "file_path": img.file_path, "created_at": img.created_at} for img in images]
    
    return _job_dict(job, cname, cphone, tname, images_list)

def clear_admin_alert(job_id: UUID, db: Session) -> dict:
    job = db.query(Job).filter(Job.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    job.admin_alert = None
    db.commit()
    db.refresh(job)
    
    customer = db.query(Customer).filter(Customer.id == job.customer_id).first()
    tech = db.query(User).filter(User.id == job.technician_id).first() if job.technician_id else None
    return _job_dict(job, customer.name if customer else None, customer.phone_number if customer else None, tech.name if tech else None)


def get_job_by_public_id(public_id: str, db: Session) -> dict | None:
    row = (
        db.query(Job)
        .filter(Job.job_id == public_id.upper())
        .first()
    )
    if not row:
        return None
    return {
        "job_id": row.job_id,
        "device_brand": row.device_brand,
        "device_model": row.device_model,
        "fault_category": row.fault_category,
        "status": row.status,
        "estimated_completion_date": row.estimated_completion_date,
        "estimated_cost": row.estimated_cost,
        "received_date": row.received_date,
        "completed_date": row.completed_date,
    }


def update_status(job_id: UUID, data: JobStatusUpdate, changed_by: User, db: Session, background_tasks: BackgroundTasks = None) -> dict:
    job = db.query(Job).filter(Job.id == job_id).first()
    if not job:
        raise HTTPException(404, "Job not found")

    STATUS_ORDER = {
        "pending": 0, 
        "in_progress": 1, 
        "completed": 2, 
        "failed": 2,
        "rejected": 2,
        "ready_for_pickup": 3, 
        "delivered": 4, 
        "unclaimed": 4
    }
    current_order = STATUS_ORDER.get(job.status, 0)
    new_order = STATUS_ORDER.get(data.status, 0)

    if new_order < current_order:
        raise HTTPException(400, f"Cannot revert status from {job.status} to {data.status} directly. Please use the request revert feature.")

    if changed_by.role == "technician":
        if job.technician_id != changed_by.id:
            raise HTTPException(403, "You must claim this job before updating its status")
        if data.status not in ["pending", "in_progress", "completed", "failed", "rejected"]:
            raise HTTPException(403, "Technicians can only update status up to completed/failed/rejected")
    elif changed_by.role == "admin":
        if new_order in [1, 2] and current_order < 3:
            raise HTTPException(403, "Admins cannot update job to 'in_progress', 'completed', 'failed', or 'rejected'. This is the technician's role.")

    job.status = data.status
    if data.estimated_cost is not None and data.status in ["completed", "failed", "rejected"]:
        job.estimated_cost = data.estimated_cost

    if data.status in ["completed", "failed", "rejected"]:
        job.completed_date = datetime.now(timezone.utc)
        
        # Save structured completion data
        if data.actual_fault is not None:
            job.actual_fault = data.actual_fault
        if data.identified_fault is not None:
            job.identified_fault = data.identified_fault
        if data.complexity_level is not None:
            job.complexity_level = data.complexity_level
        if data.diagnostic_time_mins is not None:
            job.diagnostic_time_mins = data.diagnostic_time_mins
        if data.repair_time_mins is not None:
            job.repair_time_mins = data.repair_time_mins
        if data.resolution_notes is not None:
            job.resolution_notes = data.resolution_notes
            
        if data.qc_mic_tested is not None: job.qc_mic_tested = data.qc_mic_tested
        if data.qc_camera_tested is not None: job.qc_camera_tested = data.qc_camera_tested
        if data.qc_touch_tested is not None: job.qc_touch_tested = data.qc_touch_tested
        if data.qc_biometrics_tested is not None: job.qc_biometrics_tested = data.qc_biometrics_tested
        if data.qc_wifi_tested is not None: job.qc_wifi_tested = data.qc_wifi_tested
        if data.qc_charging_tested is not None: job.qc_charging_tested = data.qc_charging_tested

    history = JobStatusHistory(
        job_id=job.id,
        status=data.status,
        changed_by=changed_by.id,
        notes=data.notes,
    )
    db.add(history)
    db.commit()
    db.refresh(job)

    if data.status == "in_progress" and background_tasks:
        from app.services.notification_service import notify_in_progress
        background_tasks.add_task(notify_in_progress, job.id)
    elif data.status == "completed" and background_tasks:
        from app.services.notification_service import notify_completed
        background_tasks.add_task(notify_completed, job.id)
    elif data.status == "ready_for_pickup" and background_tasks:
        from app.services.notification_service import notify_ready_for_pickup
        background_tasks.add_task(notify_ready_for_pickup, job.id)
    elif data.status == "delivered" and background_tasks:
        from app.services.notification_service import notify_delivered
        background_tasks.add_task(notify_delivered, job.id)
    elif data.status == "unclaimed" and background_tasks:
        from app.services.notification_service import notify_unclaimed
        background_tasks.add_task(notify_unclaimed, job.id)

    customer = db.query(Customer).filter(Customer.id == job.customer_id).first()
    tech = db.query(User).filter(User.id == job.technician_id).first() if job.technician_id else None
    return _job_dict(job, customer.name if customer else None, customer.phone_number if customer else None, tech.name if tech else None)


def get_job_history(job_id: UUID, db: Session) -> list[dict]:
    job = db.query(Job).filter(Job.id == job_id).first()
    if not job:
        raise HTTPException(404, "Job not found")
    rows = (
        db.query(JobStatusHistory, User)
        .outerjoin(User, JobStatusHistory.changed_by == User.id)
        .filter(JobStatusHistory.job_id == job_id)
        .order_by(JobStatusHistory.created_at.asc())
        .all()
    )
    result = []
    for h, tech in rows:
        result.append({
            "id": h.id,
            "status": h.status,
            "changed_by_name": tech.name if tech else "System",
            "notes": h.notes,
            "created_at": h.created_at,
        })
    return result


def claim_job(job_id: UUID, technician: User, db: Session) -> dict:
    job = db.query(Job).filter(Job.id == job_id).first()
    if not job:
        raise HTTPException(404, "Job not found")

    if job.technician_id is not None:
        if job.technician_id == technician.id:
            raise HTTPException(400, "You have already claimed this job")
        raise HTTPException(400, "This job is already assigned to another technician")

    job.technician_id = technician.id
    history = JobStatusHistory(
        job_id=job.id,
        status=job.status,
        changed_by=technician.id,
        notes=f"Job claimed by {technician.name}",
    )
    db.add(history)
    db.commit()
    db.refresh(job)

    customer = db.query(Customer).filter(Customer.id == job.customer_id).first()
    return _job_dict(
        job,
        customer.name if customer else None,
        customer.phone_number if customer else None,
        technician.name,
    )


def assign_technician(job_id: UUID, data: AssignTechnicianRequest, db: Session) -> dict:
    job = db.query(Job).filter(Job.id == job_id).first()
    if not job:
        raise HTTPException(404, "Job not found")

    if data.technician_id:
        tech = db.query(User).filter(User.id == data.technician_id, User.role == "technician", User.is_active.is_(True)).first()
        if not tech:
            raise HTTPException(404, "Technician not found or inactive")

    job.technician_id = data.technician_id
    db.commit()
    db.refresh(job)

    customer = db.query(Customer).filter(Customer.id == job.customer_id).first()
    tech = db.query(User).filter(User.id == job.technician_id).first() if job.technician_id else None
    return _job_dict(job, customer.name if customer else None, customer.phone_number if customer else None, tech.name if tech else None)


from app.schemas.job import JobRevertRequest

def request_revert(job_id: UUID, data: JobRevertRequest, changed_by: User, db: Session) -> dict:
    job = db.query(Job).filter(Job.id == job_id).first()
    if not job:
        raise HTTPException(404, "Job not found")

    if changed_by.role == "technician" and job.technician_id != changed_by.id:
        raise HTTPException(403, "You must claim this job before requesting a revert")

    if job.status == "delivered":
        raise HTTPException(400, "Cannot request a revert for a delivered job")

    if job.revert_requested_to:
        raise HTTPException(400, "A revert request is already pending")

    job.revert_requested_to = data.target_status
    job.revert_reason = data.reason
    db.commit()
    db.refresh(job)

    customer = db.query(Customer).filter(Customer.id == job.customer_id).first()
    tech = db.query(User).filter(User.id == job.technician_id).first() if job.technician_id else None
    return _job_dict(job, customer.name if customer else None, customer.phone_number if customer else None, tech.name if tech else None)

def approve_revert(job_id: UUID, changed_by: User, db: Session) -> dict:
    job = db.query(Job).filter(Job.id == job_id).first()
    if not job:
        raise HTTPException(404, "Job not found")
    if not job.revert_requested_to:
        raise HTTPException(400, "No revert request pending for this job")

    old_status = job.status
    job.status = job.revert_requested_to
    job.revert_requested_to = None
    job.revert_reason = None

    history = JobStatusHistory(
        job_id=job.id,
        status=job.status,
        changed_by=changed_by.id,
        notes=f"Revert Approved (from {old_status})",
    )
    db.add(history)
    db.commit()
    db.refresh(job)

    customer = db.query(Customer).filter(Customer.id == job.customer_id).first()
    tech = db.query(User).filter(User.id == job.technician_id).first() if job.technician_id else None
    return _job_dict(job, customer.name if customer else None, customer.phone_number if customer else None, tech.name if tech else None)

def reject_revert(job_id: UUID, changed_by: User, db: Session) -> dict:
    job = db.query(Job).filter(Job.id == job_id).first()
    if not job:
        raise HTTPException(404, "Job not found")
    if not job.revert_requested_to:
        raise HTTPException(400, "No revert request pending for this job")

    job.revert_requested_to = None
    job.revert_reason = None
    
    history = JobStatusHistory(
        job_id=job.id,
        status=job.status,
        changed_by=changed_by.id,
        notes=f"Revert Rejected",
    )
    db.add(history)
    db.commit()
    db.refresh(job)

    customer = db.query(Customer).filter(Customer.id == job.customer_id).first()
    tech = db.query(User).filter(User.id == job.technician_id).first() if job.technician_id else None
    return _job_dict(job, customer.name if customer else None, customer.phone_number if customer else None, tech.name if tech else None)


def update_labor_cost(db: Session, job_id: UUID, labor_cost: float, user: User) -> dict:
    job = db.query(Job).filter(Job.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    if user.role == "technician" and job.technician_id != user.id:
        raise HTTPException(status_code=403, detail="You are not assigned to this job")

    job.labor_cost = labor_cost
    db.commit()
    db.refresh(job)

    customer = db.query(Customer).filter(Customer.id == job.customer_id).first()
    tech = db.query(User).filter(User.id == job.technician_id).first() if job.technician_id else None
    return _job_dict(job, customer.name if customer else None, customer.phone_number if customer else None, tech.name if tech else None)
