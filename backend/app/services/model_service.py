from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.phone_model import PhoneModel
from app.schemas.phone_model import PhoneModelCreate


def list_models(
    db: Session,
    brand: str | None = None,
    brands: list[str] | None = None,
    search: str | None = None,
) -> list[PhoneModel]:
    q = db.query(PhoneModel)
    if brands:
        lowered = [b.lower() for b in brands]
        q = q.filter(func.lower(PhoneModel.brand).in_(lowered))
    elif brand:
        q = q.filter(func.lower(PhoneModel.brand) == brand.strip().lower())
    if search:
        q = q.filter(PhoneModel.name.ilike(f"%{search.strip()}%"))
    return q.order_by(PhoneModel.name).all()


def create_model(data: PhoneModelCreate, db: Session) -> PhoneModel:
    """Add a phone model to the registry. Idempotent: returns the existing
    model (case-insensitive match on brand + name) instead of duplicating."""
    existing = (
        db.query(PhoneModel)
        .filter(
            func.lower(PhoneModel.brand) == data.brand.lower(),
            func.lower(PhoneModel.name) == data.name.lower(),
        )
        .first()
    )
    if existing:
        return existing

    model = PhoneModel(brand=data.brand, name=data.name)
    db.add(model)
    db.commit()
    db.refresh(model)
    return model
