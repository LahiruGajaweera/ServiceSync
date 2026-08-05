from uuid import UUID

from fastapi import APIRouter, Depends, BackgroundTasks
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user, require_admin
from app.models.user import User
from app.schemas.salvage import SalvageCreate, SalvageResponse, SalvageStatusUpdate
from app.services import salvage_service

router = APIRouter(prefix="/salvage", tags=["Salvage"])


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
