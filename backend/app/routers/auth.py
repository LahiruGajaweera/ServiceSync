from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.user import User
from app.schemas.auth import (
    ForgotPasswordRequest,
    ForgotPasswordResponse,
    LoginRequest,
    OtpRequest,
    OtpRequestResponse,
    OtpVerifyRequest,
    ResetPasswordRequest,
    SetupStatusResponse,
    TokenResponse,
    UpdatePasswordRequest,
)
from app.schemas.user import UserResponse
from app.services import auth_service

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.get("/setup-status", response_model=SetupStatusResponse)
def setup_status(db: Session = Depends(get_db)):
    return {"setup_required": auth_service.is_setup_required(db)}


@router.post("/setup/request-otp", response_model=OtpRequestResponse, status_code=201)
def request_setup_otp(request: OtpRequest, db: Session = Depends(get_db)):
    return auth_service.request_admin_otp(request, db)


@router.post("/setup/verify-otp", response_model=TokenResponse, status_code=201)
def verify_setup_otp(request: OtpVerifyRequest, db: Session = Depends(get_db)):
    return auth_service.verify_admin_otp(request.otp_id, request.code, db)


@router.post("/login", response_model=TokenResponse)
def login(request: LoginRequest, db: Session = Depends(get_db)):
    return auth_service.login(request, db)


@router.post("/forgot-password/request-otp", response_model=ForgotPasswordResponse, status_code=201)
def request_password_reset(request: ForgotPasswordRequest, db: Session = Depends(get_db)):
    return auth_service.request_password_reset(request.identifier, db)


@router.post("/forgot-password/verify-otp")
def verify_reset_otp(request: OtpVerifyRequest, db: Session = Depends(get_db)):
    return auth_service.verify_reset_otp(request.otp_id, request.code, db)


@router.post("/forgot-password/reset", response_model=TokenResponse, status_code=201)
def reset_password(request: ResetPasswordRequest, db: Session = Depends(get_db)):
    return auth_service.reset_password(request.otp_id, request.code, request.new_password, db)


@router.post("/update-password", response_model=TokenResponse)
def update_password(
    request: UpdatePasswordRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Authenticated user replaces their (temporary) password."""
    return auth_service.update_password(current_user, request.new_password, db)


@router.get("/me", response_model=UserResponse)
def get_me(current_user: User = Depends(get_current_user)):
    return current_user
