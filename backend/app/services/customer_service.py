from fastapi import HTTPException
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.models.customer import Customer
from app.schemas.customer import CustomerCreate, CustomerUpdate


def create_customer(data: CustomerCreate, db: Session) -> Customer:
    if db.query(Customer).filter(Customer.phone_number == data.phone_number).first():
        raise HTTPException(400, "A customer with this phone number already exists")
    customer = Customer(**data.model_dump())
    db.add(customer)
    db.commit()
    db.refresh(customer)
    return customer


def list_customers(db: Session, search: str | None = None) -> list[Customer]:
    q = db.query(Customer)
    if search:
        like = f"%{search}%"
        q = q.filter(or_(Customer.name.ilike(like), Customer.phone_number.ilike(like)))
    return q.order_by(Customer.name).all()


def get_customer(customer_id, db: Session) -> Customer:
    c = db.query(Customer).filter(Customer.id == customer_id).first()
    if not c:
        raise HTTPException(404, "Customer not found")
    return c


def update_customer(customer_id, data: CustomerUpdate, db: Session) -> Customer:
    c = get_customer(customer_id, db)
    for field, value in data.model_dump(exclude_none=True).items():
        setattr(c, field, value)
    db.commit()
    db.refresh(c)
    return c
