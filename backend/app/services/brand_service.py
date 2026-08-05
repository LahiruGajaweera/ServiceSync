from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.brand import Brand
from app.schemas.brand import BrandCreate


def list_brands(db: Session, search: str | None = None) -> list[Brand]:
    q = db.query(Brand)
    if search:
        q = q.filter(Brand.name.ilike(f"%{search.strip()}%"))
    return q.order_by(Brand.name).all()


def create_brand(data: BrandCreate, db: Session) -> Brand:
    """Add a brand to the registry. Idempotent: returns the existing brand
    (case-insensitive match) instead of creating a duplicate."""
    existing = (
        db.query(Brand)
        .filter(func.lower(Brand.name) == data.name.lower())
        .first()
    )
    if existing:
        return existing

    brand = Brand(name=data.name)
    db.add(brand)
    db.commit()
    db.refresh(brand)
    return brand
