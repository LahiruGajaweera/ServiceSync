import uuid
from sqlalchemy import Boolean, Column, Enum, String, DateTime, func
from sqlalchemy.dialects.postgresql import UUID
from app.core.database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(100), nullable=False)
    email = Column(String(255), unique=True, nullable=True, index=True)
    phone_number = Column(String(20), unique=True, nullable=True, index=True)
    password_hash = Column(String(255), nullable=False)
    role = Column(Enum("admin", "technician", name="user_role"), nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    # True until the user replaces an admin-issued temporary password on first login.
    is_temporary_password = Column(Boolean, default=False, nullable=False)
    avatar_url = Column(String(255), nullable=True)
    specializations = Column(String(255), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
