from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.part_spec import PartSpec
from app.schemas.part_spec import PartSpecCreate


def list_specs(db: Session, search: str | None = None) -> list[PartSpec]:
    q = db.query(PartSpec)
    if search:
        q = q.filter(PartSpec.name.ilike(f"%{search.strip()}%"))
    return q.order_by(PartSpec.name).all()


def create_spec(data: PartSpecCreate, db: Session) -> PartSpec:
    """Add a spec/identifier to the registry. Idempotent: returns the existing
    spec (case-insensitive match) instead of creating a duplicate."""
    existing = (
        db.query(PartSpec)
        .filter(func.lower(PartSpec.name) == data.name.lower())
        .first()
    )
    if existing:
        return existing

    spec = PartSpec(name=data.name)
    db.add(spec)
    db.commit()
    db.refresh(spec)
    return spec
