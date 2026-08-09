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


@router.delete("/technicians/{technician_id}", status_code=204)
def delete_technician(
    technician_id: str,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    from uuid import UUID
    from fastapi import HTTPException
    
    try:
        user_uuid = UUID(technician_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid technician ID")
        
    technician = db.query(User).filter(User.id == user_uuid, User.role == "technician").first()
    if not technician:
        raise HTTPException(status_code=404, detail="Technician not found")
        
    technician.is_active = False
    db.commit()
