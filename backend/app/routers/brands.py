from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import require_any_staff
from app.schemas.brand import BrandCreate, BrandResponse
from app.services import brand_service

router = APIRouter(prefix="/brands", tags=["Brands"])


@router.get("/", response_model=list[BrandResponse])
def list_brands(
    search: str | None = Query(default=None),
    db: Session = Depends(get_db),
    _=Depends(require_any_staff),
):
    return brand_service.list_brands(db, search=search)


@router.post("/", response_model=BrandResponse, status_code=201)
def create_brand(
    data: BrandCreate,
    db: Session = Depends(get_db),
    _=Depends(require_any_staff),
):
    return brand_service.create_brand(data, db)
