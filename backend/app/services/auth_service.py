import hashlib
import secrets
from datetime import datetime, timedelta, timezone
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import create_access_token, hash_password, verify_password
from app.models.otp import AdminSetupOtp, PasswordResetOtp
from app.models.user import User
from app.schemas.auth import LoginRequest, OtpRequest, normalize_phone
from app.schemas.user import TechnicianCreate, UserCreate
from app.services import otp_delivery

MAX_OTP_ATTEMPTS = 5


def _token_payload(user: User) -> dict:
    token = create_access_token({
        "sub": str(user.id),
        "role": user.role,
        "name": user.name,
        "email": user.email,
    })
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "id": str(user.id),
            "name": user.name,
            "email": user.email,
            "phone_number": user.phone_number,
            "role": user.role,
            "is_temporary_password": user.is_temporary_password,
        },
    }


def login(request: LoginRequest, db: Session) -> dict:
    ident = request.identifier.strip()

    user = (
        db.query(User)
        .filter(User.email == ident, User.is_active.is_(True))
        .first()
    )
    if not user:
        try:
            phone = normalize_phone(ident)
        except ValueError:
            phone = None
        if phone:
            user = (
                db.query(User)
                .filter(User.phone_number == phone, User.is_active.is_(True))
                .first()
            )

    if not user or not verify_password(request.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials",
        )

    return _token_payload(user)


def is_setup_required(db: Session) -> bool:
    """First-run setup is needed when no admin account exists yet."""
    return db.query(User).filter(User.role == "admin").first() is None


def _hash_code(code: str) -> str:
    return hashlib.sha256(code.encode()).hexdigest()


def _mask(channel: str, destination: str) -> str:
    if channel == "email":
        local, _, domain = destination.partition("@")
        head = local[0] if local else "*"
        return f"{head}{'*' * max(len(local) - 1, 2)}@{domain}"
    # phone — reveal only the last 3 digits
    return f"{destination[:3]}{'*' * max(len(destination) - 6, 2)}{destination[-3:]}"


def request_admin_otp(data: OtpRequest, db: Session) -> dict:
    if not is_setup_required(db):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Setup has already been completed")

    if data.channel == "email" and db.query(User).filter(User.email == data.destination).first():
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "This email is already registered")
    if data.channel == "phone" and db.query(User).filter(User.phone_number == data.destination).first():
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "This phone number is already registered")

    code = f"{secrets.randbelow(1_000_000):06d}"
    otp = AdminSetupOtp(
        name=data.name,
        email=data.destination if data.channel == "email" else None,
        phone_number=data.destination if data.channel == "phone" else None,
        password_hash=hash_password(data.password),
        channel=data.channel,
        destination=data.destination,
        code_hash=_hash_code(code),
        expires_at=datetime.now(timezone.utc) + timedelta(minutes=settings.OTP_EXP_MINUTES),
    )
    db.add(otp)
    db.commit()
    db.refresh(otp)

    delivered = otp_delivery.send_otp(data.channel, data.destination, code)

    return {
        "otp_id": str(otp.id),
        "channel": data.channel,
        "destination_masked": _mask(data.channel, data.destination),
        "expires_in_seconds": settings.OTP_EXP_MINUTES * 60,
        "dev_otp": None if delivered else code,
    }


def verify_admin_otp(otp_id: str, code: str, db: Session) -> dict:
    if not is_setup_required(db):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Setup has already been completed")

    try:
        otp = db.query(AdminSetupOtp).filter(AdminSetupOtp.id == UUID(otp_id)).first()
    except (ValueError, AttributeError):
        otp = None

    if not otp or otp.consumed:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid or already-used verification request")

    now = datetime.now(timezone.utc)
    if otp.expires_at < now:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Verification code has expired. Please resend a new code.")
    if otp.attempts >= MAX_OTP_ATTEMPTS:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Too many incorrect attempts. Please resend a new code.")

    if _hash_code(code) != otp.code_hash:
        otp.attempts += 1
        db.commit()
        remaining = MAX_OTP_ATTEMPTS - otp.attempts
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            f"Incorrect code. {remaining} attempt{'s' if remaining != 1 else ''} remaining.",
        )

    admin = User(
        name=otp.name,
        email=otp.email,
        phone_number=otp.phone_number,
        password_hash=otp.password_hash,
        role="admin",
    )
    db.add(admin)
    otp.consumed = True
    db.commit()
    db.refresh(admin)
    return _token_payload(admin)


def _find_user_by_identifier(identifier: str, db: Session) -> User | None:
    ident = identifier.strip()
    user = (
        db.query(User)
        .filter(User.email == ident.lower(), User.is_active.is_(True))
        .first()
    )
    if user:
        return user
    try:
        phone = normalize_phone(ident)
    except ValueError:
        return None
    return (
        db.query(User)
        .filter(User.phone_number == phone, User.is_active.is_(True))
        .first()
    )


def request_password_reset(identifier: str, db: Session) -> dict:
    user = _find_user_by_identifier(identifier, db)
    if not user:
        raise HTTPException(
            status.HTTP_404_NOT_FOUND,
            "No active account was found with that email or phone number",
        )

    # Prefer the channel that matches what the user typed; fall back to whatever
    # contact detail the account has on file.
    ident = identifier.strip().lower()
    if user.email and ident == user.email:
        channel, destination = "email", user.email
    elif user.phone_number:
        channel, destination = "phone", user.phone_number
    elif user.email:
        channel, destination = "email", user.email
    else:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "This account has no email or phone number on file to send a code to",
        )

    code = f"{secrets.randbelow(1_000_000):06d}"
    otp = PasswordResetOtp(
        user_id=user.id,
        channel=channel,
        destination=destination,
        code_hash=_hash_code(code),
        expires_at=datetime.now(timezone.utc) + timedelta(minutes=settings.OTP_EXP_MINUTES),
    )
    db.add(otp)
    db.commit()
    db.refresh(otp)

    delivered = otp_delivery.send_otp(channel, destination, code)

    return {
        "otp_id": str(otp.id),
        "channel": channel,
        "destination_masked": _mask(channel, destination),
        "expires_in_seconds": settings.OTP_EXP_MINUTES * 60,
        "dev_otp": None if delivered else code,
    }


def _load_valid_reset_otp(otp_id: str, code: str, db: Session) -> PasswordResetOtp:
    """Validate a reset OTP (id, not consumed/expired, attempts, code) without consuming it.

    Increments the attempt counter on a wrong code, then raises.
    """
    try:
        otp = db.query(PasswordResetOtp).filter(PasswordResetOtp.id == UUID(otp_id)).first()
    except (ValueError, AttributeError):
        otp = None

    if not otp or otp.consumed:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid or already-used reset request")

    now = datetime.now(timezone.utc)
    if otp.expires_at < now:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Verification code has expired. Please resend a new code.")
    if otp.attempts >= MAX_OTP_ATTEMPTS:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Too many incorrect attempts. Please resend a new code.")

    if _hash_code(code) != otp.code_hash:
        otp.attempts += 1
        db.commit()
        remaining = MAX_OTP_ATTEMPTS - otp.attempts
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            f"Incorrect code. {remaining} attempt{'s' if remaining != 1 else ''} remaining.",
        )

    return otp


def verify_reset_otp(otp_id: str, code: str, db: Session) -> dict:
    """Check the reset OTP is correct so the UI can unlock the new-password fields.

    Does NOT consume the OTP \u2014 the same code is submitted again to actually reset.
    """
    otp = _load_valid_reset_otp(otp_id, code, db)
    remaining = max(int((otp.expires_at - datetime.now(timezone.utc)).total_seconds()), 0)
    return {"verified": True, "expires_in_seconds": remaining}


def reset_password(otp_id: str, code: str, new_password: str, db: Session) -> dict:
    otp = _load_valid_reset_otp(otp_id, code, db)

    user = db.query(User).filter(User.id == otp.user_id).first()
    if not user:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "The account for this reset no longer exists")

    user.password_hash = hash_password(new_password)
    otp.consumed = True
    db.commit()
    db.refresh(user)
    return _token_payload(user)


def create_user(data: UserCreate, db: Session) -> User:
    if db.query(User).filter(User.email == data.email).first():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A user with this email already exists",
        )

    user = User(
        name=data.name,
        email=data.email,
        password_hash=hash_password(data.password),
        role=data.role,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def _generate_temp_password(length: int = 8) -> str:
    """Cryptographically-random temporary password (e.g. ``Tk7@mP4q``).

    Guarantees at least one lower, upper, digit and symbol, and avoids
    ambiguous characters (O/0, l/1) so it reads cleanly over SMS.
    """
    lowers = "abcdefghijkmnpqrstuvwxyz"
    uppers = "ABCDEFGHJKLMNPQRSTUVWXYZ"
    digits = "23456789"
    symbols = "@#$%&*"
    pool = lowers + uppers + digits + symbols
    chars = [
        secrets.choice(lowers),
        secrets.choice(uppers),
        secrets.choice(digits),
        secrets.choice(symbols),
    ]
    chars += [secrets.choice(pool) for _ in range(max(length - 4, 0))]
    secrets.SystemRandom().shuffle(chars)
    return "".join(chars)


def create_technician(data: TechnicianCreate, db: Session) -> dict:
    """Admin creates a technician with an auto-generated temporary password.

    The technician must change it on first login (``is_temporary_password``).
    """
    email = data.email.strip().lower()
    if db.query(User).filter(User.email == email).first():
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "A user with this email already exists")

    phone = normalize_phone(data.phone_number)
    if db.query(User).filter(User.phone_number == phone).first():
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "A user with this phone number already exists")

    temp_password = _generate_temp_password()
    technician = User(
        name=data.name.strip(),
        email=email,
        phone_number=phone,
        password_hash=hash_password(temp_password),
        role="technician",
        is_temporary_password=True,
        specializations=data.specializations,
    )
    db.add(technician)
    db.commit()
    db.refresh(technician)

    # Placeholder SMS delivery — swap for a real gateway (Notify.lk / Text.lk) later.
    sms_sent = otp_delivery.send_sms_notification(phone, temp_password)

    return {
        "user": technician,
        "temporary_password": temp_password,
        "sms_sent": sms_sent,
    }


def update_password(user: User, new_password: str, db: Session) -> dict:
    """Set a new password for the authenticated user and clear the temp flag."""
    user.password_hash = hash_password(new_password)
    user.is_temporary_password = False
    db.commit()
    db.refresh(user)
    return _token_payload(user)
