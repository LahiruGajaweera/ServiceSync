from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import datetime, timezone

from app.core.database import get_db
from app.core.deps import require_admin
from app.models.user import User
from app.models.notification import AdminCallTask
from app.models.job import Job

router = APIRouter(prefix="/admin-tasks", tags=["Admin Tasks"])


@router.get("/")
def list_pending_tasks(db: Session = Depends(get_db), current_user: User = Depends(require_admin)):
    tasks = (
        db.query(AdminCallTask, Job)
        .join(Job, AdminCallTask.job_id == Job.id)
        .filter(AdminCallTask.is_completed == False)
        .order_by(AdminCallTask.created_at.asc())
        .all()
    )
    result = []
    for task, job in tasks:
        result.append({
            "id": task.id,
            "job_id": task.job_id,
            "job_public_id": job.job_id,
            "customer_id": job.customer_id,
            "device": f"{job.device_brand} {job.device_model}",
            "message": task.message,
            "created_at": task.created_at
        })
    return result


@router.patch("/{task_id}/complete")
def complete_task(task_id: UUID, db: Session = Depends(get_db), current_user: User = Depends(require_admin)):
    task = db.query(AdminCallTask).filter(AdminCallTask.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
        
    task.is_completed = True
    task.completed_by = current_user.id
    task.completed_at = datetime.now(timezone.utc)
    
    db.commit()
    return {"status": "success"}
