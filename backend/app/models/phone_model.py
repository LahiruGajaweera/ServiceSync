import uuid
from sqlalchemy import Column, String, DateTime, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import UUID
from app.core.database import Base


class PhoneModel(Base):
    __tablename__ = "phone_models"
    __table_args__ = (UniqueConstraint("brand", "name", name="uq_phone_models_brand_name"),)

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    brand = Column(String(100), nullable=False, index=True)
    name = Column(String(120), nullable=False, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
