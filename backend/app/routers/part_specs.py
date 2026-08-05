from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import require_any_staff
from app.schemas.part_spec import PartSpecCreate, PartSpecResponse
from app.services import part_spec_service

router = APIRouter(prefix="/specs", tags=["Part Specs"])


@router.get("/", response_model=list[PartSpecResponse])
def list_specs(
    search: str | None = Query(default=None),
    db: Session = Depends(get_db),
    _=Depends(require_any_staff),
):
    return part_spec_service.list_specs(db, search=search)


@router.post("/", response_model=PartSpecResponse, status_code=201)
def create_spec(
    data: PartSpecCreate,
    db: Session = Depends(get_db),
    _=Depends(require_any_staff),
):
    return part_spec_service.create_spec(data, db)
