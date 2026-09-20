import uuid

from sqlalchemy import Boolean, Column, DateTime, Integer, String, func
from sqlalchemy.dialects.postgresql import UUID

from app.core.database import Base


class AdminSetupOtp(Base):
    """Holds a pending first-admin signup until its OTP is verified."""

    __tablename__ = "admin_setup_otps"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(100), nullable=False)
    email = Column(String(255), nullable=True)
    phone_number = Column(String(20), nullable=True)
    password_hash = Column(String(255), nullable=True)

    channel = Column(String(10), nullable=False)        # "email" | "phone"
    destination = Column(String(255), nullable=False)   # the email or phone
    code_hash = Column(String(64), nullable=False)      # sha256 hex of the code

    verified = Column(Boolean, default=False, nullable=False)

    expires_at = Column(DateTime(timezone=True), nullable=False)
    attempts = Column(Integer, default=0, nullable=False)
    consumed = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class PasswordResetOtp(Base):
    """Holds a pending password reset for an existing user until its OTP is verified."""

    __tablename__ = "password_reset_otps"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), nullable=False, index=True)

    channel = Column(String(10), nullable=False)        # "email" | "phone"
    destination = Column(String(255), nullable=False)   # the email or phone the code was sent to
    code_hash = Column(String(64), nullable=False)      # sha256 hex of the code

    expires_at = Column(DateTime(timezone=True), nullable=False)
    attempts = Column(Integer, default=0, nullable=False)
    consumed = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
