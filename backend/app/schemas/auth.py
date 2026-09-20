import re
from typing import Literal

from email_validator import EmailNotValidError, validate_email
from pydantic import BaseModel, field_validator, model_validator


def normalize_phone(raw: str) -> str:
    """Normalise a Sri Lankan phone number to strictly 10 digits starting with 0."""
    if not raw:
        raise ValueError("Phone number cannot be empty")
    digits = re.sub(r"[\s\-()]", "", raw.strip())
    if digits.startswith("0") and len(digits) == 10 and digits.isdigit():
        return digits
    raise ValueError("Enter a valid phone number (e.g. 0712345678 or 0112334455)")


class LoginRequest(BaseModel):
    identifier: str  # email or phone number
    password: str


class OtpRequest(BaseModel):
    """Step 1 of first-admin setup: collect details and choose a channel."""

    name: str
    channel: Literal["email", "phone"]
    destination: str

    @field_validator("name")
    @classmethod
    def _name(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("Name is required")
        return v.strip()

    @model_validator(mode="after")
    def _check_destination(self):
        dest = self.destination.strip()
        if self.channel == "email":
            try:
                validate_email(dest, check_deliverability=False)
            except EmailNotValidError:
                raise ValueError("Enter a valid email address")
            self.destination = dest.lower()
        else:
            self.destination = normalize_phone(dest)
        return self


class OtpRequestResponse(BaseModel):
    otp_id: str
    channel: str
    destination_masked: str
    expires_in_seconds: int
    dev_otp: str | None = None  # only populated in dev mode (no real delivery)


class OtpVerifyRequest(BaseModel):
    otp_id: str
    code: str

    @field_validator("code")
    @classmethod
    def _code(cls, v: str) -> str:
        v = v.strip()
        if not v.isdigit() or len(v) != 6:
            raise ValueError("Enter the 6-digit verification code")
        return v


class SetupCompleteRequest(BaseModel):
    otp_id: str
    password: str

    @field_validator("password")
    @classmethod
    def _password(cls, v: str) -> str:
        if len(v) < 6:
            raise ValueError("Password must be at least 6 characters")
        return v


class SetupStatusResponse(BaseModel):
    setup_required: bool


class ForgotPasswordRequest(BaseModel):
    """Step 1 of password reset: identify the account by email or phone."""

    identifier: str

    @field_validator("identifier")
    @classmethod
    def _identifier(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("Enter your email or phone number")
        return v.strip()


class ForgotPasswordResponse(BaseModel):
    otp_id: str
    channel: str
    destination_masked: str
    expires_in_seconds: int
    dev_otp: str | None = None  # only populated in dev mode (no real delivery)


class ResetPasswordRequest(BaseModel):
    """Step 2 of password reset: verify the OTP and set a new password."""

    otp_id: str
    code: str
    new_password: str

    @field_validator("code")
    @classmethod
    def _code(cls, v: str) -> str:
        v = v.strip()
        if not v.isdigit() or len(v) != 6:
            raise ValueError("Enter the 6-digit verification code")
        return v

    @field_validator("new_password")
    @classmethod
    def _new_password(cls, v: str) -> str:
        if len(v) < 6:
            raise ValueError("Password must be at least 6 characters")
        return v


class UserInToken(BaseModel):
    id: str
    name: str
    email: str | None = None
    phone_number: str | None = None
    role: str
    is_temporary_password: bool = False


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserInToken


class UpdatePasswordRequest(BaseModel):
    """Force-change a temporary password for the authenticated user."""

    new_password: str
    otp_id: str | None = None
    code: str | None = None

    @field_validator("code")
    @classmethod
    def _code(cls, v: str | None) -> str | None:
        if v is None:
            return v
        v = v.strip()
        if not v.isdigit() or len(v) != 6:
            raise ValueError("Enter the 6-digit verification code")
        return v

    @field_validator("new_password")
    @classmethod
    def _new_password(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters")
        return v

