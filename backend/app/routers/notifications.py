from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import require_admin, require_any_staff
from app.services import notification_service

router = APIRouter(prefix="/notifications", tags=["Notifications"])


@router.get("/")
def list_notifications(
    db: Session = Depends(get_db),
    _=Depends(require_any_staff),
):
    return notification_service.list_notifications(db)


@router.get("/job/{job_id}")
def notifications_for_job(
    job_id: UUID,
    db: Session = Depends(get_db),
    _=Depends(require_any_staff),
):
    return notification_service.list_notifications_for_job(job_id, db)
