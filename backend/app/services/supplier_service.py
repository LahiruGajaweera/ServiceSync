from fastapi import HTTPException
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.models.supplier import Supplier
from app.schemas.supplier import SupplierCreate, SupplierUpdate


def create_supplier(data: SupplierCreate, db: Session) -> Supplier:
    if db.query(Supplier).filter(Supplier.phone_number == data.phone_number).first():
        raise HTTPException(400, "A supplier with this phone number already exists")
    supplier = Supplier(**data.model_dump())
    db.add(supplier)
    db.commit()
    db.refresh(supplier)
    return supplier


def list_suppliers(db: Session, search: str | None = None) -> list[Supplier]:
    q = db.query(Supplier)
    if search:
        like = f"%{search}%"
        q = q.filter(or_(Supplier.name.ilike(like), Supplier.phone_number.ilike(like)))
    return q.order_by(Supplier.name).all()


def get_supplier(supplier_id, db: Session) -> Supplier:
    s = db.query(Supplier).filter(Supplier.id == supplier_id).first()
    if not s:
        raise HTTPException(404, "Supplier not found")
    return s


def update_supplier(supplier_id, data: SupplierUpdate, db: Session) -> Supplier:
    s = get_supplier(supplier_id, db)
    for field, value in data.model_dump(exclude_none=True).items():
        setattr(s, field, value)
    db.commit()
    db.refresh(s)
    return s
