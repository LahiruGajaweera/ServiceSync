from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import require_admin
from app.models.user import User
from app.schemas.user import TechnicianCreate, TechnicianCreateResponse
from app.services import auth_service

router = APIRouter(prefix="/admin", tags=["Admin"])


@router.post("/technicians", response_model=TechnicianCreateResponse, status_code=201)
def create_technician(
    data: TechnicianCreate,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    """Admin creates a technician; a temporary password is generated and SMS'd."""
    return auth_service.create_technician(data, db)
