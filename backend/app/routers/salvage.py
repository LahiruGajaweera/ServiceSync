from uuid import UUID

from fastapi import APIRouter, Depends, BackgroundTasks
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user, require_admin
from app.models.user import User
from app.schemas.salvage import (
    SalvageCreate,
    SalvageResponse,
    SalvageStatusUpdate,
    LiveEstimateRequest,
    LiveEstimateResponse,
    NotesUpdate,
    BatchEstimateRequest,
    SalvageActualsUpdate
)
from app.services import salvage_service

router = APIRouter(prefix="/salvage", tags=["Salvage"])

@router.post("/estimate", response_model=LiveEstimateResponse)
def get_live_estimate(
    data: LiveEstimateRequest,
    db: Session = Depends(get_db),
    _=Depends(require_admin),
):
    market_price = float(data.scraped_market_price) if data.scraped_market_price else 0.0
    return salvage_service.get_live_ai_estimate(data.job_id, market_price, db)



@router.post("/", response_model=SalvageResponse, status_code=201)
def create_assessment(
    data: SalvageCreate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    return salvage_service.create_assessment(data, current_user, background_tasks, db)


@router.get("/")
def list_assessments(
    db: Session = Depends(get_db),
    _=Depends(require_admin),
):
    return salvage_service.list_assessments(db)


@router.get("/pending-unclaimed")
def list_pending_unclaimed(
    db: Session = Depends(get_db),
    _=Depends(require_admin),
):
    return salvage_service.get_pending_unclaimed_jobs(db)


@router.post("/delay/{job_id}")
def delay_salvage(
    job_id: UUID,
    days: int,
    db: Session = Depends(get_db),
    _=Depends(require_admin),
):
    return salvage_service.delay_salvage(job_id, days, db)


@router.post("/{assessment_id}/reassess")
def reassess(
    assessment_id: UUID,
    db: Session = Depends(get_db),
    _=Depends(require_admin),
):
    """Re-run AI estimate on an existing assessment."""
    return salvage_service.reassess(assessment_id, db)


@router.patch("/{assessment_id}/notes", response_model=SalvageResponse)
def update_notes(
    assessment_id: UUID,
    data: NotesUpdate,
    db: Session = Depends(get_db),
    _=Depends(require_admin),
):
    """Update admin notes on an assessment."""
    return salvage_service.update_notes(assessment_id, data, db)


@router.post("/batch-estimate")
def batch_estimate(
    data: BatchEstimateRequest,
    db: Session = Depends(get_db),
    _=Depends(require_admin),
):
    """Run live estimates for multiple jobs synchronously."""
    return salvage_service.batch_estimate(data.job_ids, db)


@router.patch("/{assessment_id}/actuals", response_model=SalvageResponse)
def record_actuals(
    assessment_id: UUID,
    data: SalvageActualsUpdate,
    db: Session = Depends(get_db),
    _=Depends(require_admin),
):
    """Record actual outcomes and calculate profit/loss and AI accuracy."""
    return salvage_service.record_actuals(assessment_id, data, db)


@router.get("/{assessment_id}", response_model=SalvageResponse)
def get_assessment(
    assessment_id: UUID,
    db: Session = Depends(get_db),
    _=Depends(require_admin),
):
    return salvage_service.get_assessment(assessment_id, db)


@router.patch("/{assessment_id}/status", response_model=SalvageResponse)
def update_status(
    assessment_id: UUID,
    data: SalvageStatusUpdate,
    db: Session = Depends(get_db),
    _=Depends(require_admin),
):
    return salvage_service.update_status(assessment_id, data, db)
