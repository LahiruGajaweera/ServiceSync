from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import require_any_staff
from app.schemas.phone_model import PhoneModelCreate, PhoneModelResponse
from app.services import model_service

router = APIRouter(prefix="/models", tags=["Phone Models"])


@router.get("/", response_model=list[PhoneModelResponse])
def list_models(
    brand: str | None = Query(default=None),
    brands: str | None = Query(default=None),
    search: str | None = Query(default=None),
    db: Session = Depends(get_db),
    _=Depends(require_any_staff),
):
    brand_list = (
        [b.strip() for b in brands.split(",") if b.strip()] if brands else None
    )
    return model_service.list_models(db, brand=brand, brands=brand_list, search=search)


@router.post("/", response_model=PhoneModelResponse, status_code=201)
def create_model(
    data: PhoneModelCreate,
    db: Session = Depends(get_db),
    _=Depends(require_any_staff),
):
    return model_service.create_model(data, db)
