from uuid import UUID

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user, require_admin, require_any_staff, require_technician
from app.models.user import User
from app.schemas.job import (
    AssignTechnicianRequest,
    CompatiblePartsResponse,
    JobCreate,
    JobListItem,
    JobStatusUpdate,
    PublicJobResponse,
    TimerToggleRequest,
    AutoResumeRequest,
)
from app.services import invoice_service, job_parts_service, job_service
from app.schemas.invoice import JobPartCreate

router = APIRouter(prefix="/jobs", tags=["Jobs"])


# ── PUBLIC — no auth ──────────────────────────────────────────────────────────

@router.get("/track/{public_id}", response_model=PublicJobResponse)
def track_job(public_id: str, db: Session = Depends(get_db)):
    result = job_service.get_job_by_public_id(public_id, db)
    if not result:
        raise HTTPException(404, f"No job found with ID '{public_id.upper()}'")
    return result


# ── TECHNICIAN — own jobs ─────────────────────────────────────────────────────

@router.get("/mine", response_model=list[JobListItem])
def my_jobs(
    status: str | None = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return job_service.list_jobs(db, status=status, technician_id=current_user.id, include_unassigned=True)


@router.get("/faults/identified", response_model=list[str])
def get_identified_faults(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    return job_service.get_all_identified_faults(db)


@router.patch("/{job_id}/claim", response_model=JobListItem)
def claim_job(
    job_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_technician),
):
    return job_service.claim_job(job_id, current_user, db)


# ── ADMIN / STAFF ─────────────────────────────────────────────────────────────

@router.post("/", response_model=JobListItem, status_code=201)
def create_job(
    data: JobCreate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    return job_service.create_job(data, current_user, db, background_tasks=background_tasks)


from fastapi import UploadFile, File
import os
import uuid
from app.models.job import JobImage

@router.post("/{job_id}/images", status_code=201)
async def upload_job_images(
    job_id: UUID,
    files: list[UploadFile] = File(...),
    db: Session = Depends(get_db),
    _=Depends(require_admin),
):
    job = job_service.get_job(job_id, db)
    if not job:
        raise HTTPException(404, "Job not found")

    os.makedirs("uploads/jobs", exist_ok=True)
    uploaded_images = []
    
    for file in files:
        ext = file.filename.split(".")[-1] if "." in file.filename else "jpg"
        filename = f"{uuid.uuid4().hex}.{ext}"
        filepath = os.path.join("uploads", "jobs", filename)
        
        with open(filepath, "wb") as f:
            f.write(await file.read())
            
        db_img = JobImage(job_id=job_id, file_path=f"/uploads/jobs/{filename}")
        db.add(db_img)
        db.flush()
        
        uploaded_images.append({
            "id": str(db_img.id),
            "file_path": db_img.file_path,
            "created_at": db_img.created_at.isoformat() if db_img.created_at else None
        })
        
    db.commit()
    return {"uploaded": len(uploaded_images), "images": uploaded_images}


@router.get("/", response_model=list[JobListItem])
def list_jobs(
    status: str | None = Query(default=None),
    technician_id: UUID | None = Query(default=None),
    has_alerts: bool = Query(default=False),
    db: Session = Depends(get_db),
    _=Depends(require_any_staff),
):
    return job_service.list_jobs(db, status=status, technician_id=technician_id, has_alerts=has_alerts)


@router.get("/{job_id}", response_model=JobListItem)
def get_job(
    job_id: UUID,
    db: Session = Depends(get_db),
    _=Depends(require_any_staff),
):
    return job_service.get_job(job_id, db)


@router.patch("/{job_id}/clear_alert", response_model=JobListItem)
def clear_job_admin_alert(
    job_id: UUID,
    db: Session = Depends(get_db),
    _=Depends(require_admin),
):
    return job_service.clear_admin_alert(job_id, db)


@router.patch("/{job_id}/status", response_model=JobListItem)
def update_status(
    job_id: UUID,
    data: JobStatusUpdate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return job_service.update_status(job_id, data, current_user, db, background_tasks=background_tasks)


@router.patch("/{job_id}/assign", response_model=JobListItem)
def assign_technician(
    job_id: UUID,
    data: AssignTechnicianRequest,
    db: Session = Depends(get_db),
    _=Depends(require_admin),
):
    return job_service.assign_technician(job_id, data, db)


@router.post("/{job_id}/toggle-timer")
def toggle_job_timer(
    job_id: UUID,
    data: TimerToggleRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return job_service.toggle_timer(job_id, data, current_user, db)


@router.post("/{job_id}/auto-resume")
def auto_resume_job_timer(
    job_id: UUID,
    data: AutoResumeRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return job_service.auto_resume_timer(job_id, data, current_user, db)


# ── Parts used ────────────────────────────────────────────────────────────────

@router.post("/{job_id}/parts", status_code=201)
def add_part(
    job_id: UUID,
    data: JobPartCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_staff),
):
    return job_parts_service.add_part(job_id, data, db, used_by=current_user)


@router.get("/{job_id}/parts")
def list_parts(
    job_id: UUID,
    db: Session = Depends(get_db),
    _=Depends(require_any_staff),
):
    return job_parts_service.list_parts(job_id, db)


# ── Status history ────────────────────────────────────────────────────────────

@router.get("/{job_id}/history")
def get_history(
    job_id: UUID,
    db: Session = Depends(get_db),
    _=Depends(require_any_staff),
):
    return job_service.get_job_history(job_id, db)


# ── Invoice for this job ──────────────────────────────────────────────────────

@router.get("/{job_id}/invoice")
def get_job_invoice(
    job_id: UUID,
    db: Session = Depends(get_db),
    _=Depends(require_any_staff),
):
    inv = invoice_service.get_invoice_by_job(job_id, db)
    if not inv:
        return None
    return inv


# ── Revert Requests ───────────────────────────────────────────────────────────

from app.schemas.job import JobRevertRequest, JobLaborUpdate

@router.post("/{job_id}/revert-request", response_model=JobListItem)
def request_job_revert(
    job_id: UUID,
    data: JobRevertRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_technician),
):
    return job_service.request_revert(job_id, data, current_user, db)


@router.post("/{job_id}/revert-approve", response_model=JobListItem)
def approve_job_revert(
    job_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    return job_service.approve_revert(job_id, current_user, db)


@router.post("/{job_id}/revert-reject", response_model=JobListItem)
def reject_job_revert(
    job_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    return job_service.reject_revert(job_id, current_user, db)


@router.patch("/{job_id}/labor", response_model=JobListItem)
def update_job_labor_cost(
    job_id: UUID,
    data: JobLaborUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_technician),
):
    return job_service.update_labor_cost(db, job_id, float(data.labor_cost), current_user)
