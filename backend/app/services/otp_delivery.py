import smtplib
from email.message import EmailMessage

import httpx

from app.core.config import settings


def _smtp_configured() -> bool:
    return bool(settings.SMTP_HOST and settings.SMTP_FROM)


def _sms_configured() -> bool:
    return bool(settings.TEXTLK_API_TOKEN and settings.TEXTLK_SENDER_ID)


def _send_sms(destination: str, message: str) -> None:
    # Text.lk expects the number without a leading "+" and in 947XXXXXXXX format.
    # Convert from 07XXXXXXXX to 947XXXXXXXX if necessary.
    recipient = "94" + destination[1:] if destination.startswith("0") else destination.lstrip("+")
    response = httpx.post(
        settings.TEXTLK_API_URL,
        headers={
            "Authorization": f"Bearer {settings.TEXTLK_API_TOKEN}",
            "Content-Type": "application/json",
            "Accept": "application/json",
        },
        json={
            "recipient": recipient,
            "sender_id": settings.TEXTLK_SENDER_ID,
            "type": "plain",
            "message": message,
        },
        timeout=15,
    )
    response.raise_for_status()
    payload = response.json()
    if payload.get("status") != "success":
        raise RuntimeError(payload.get("message", "Text.lk SMS delivery failed"))


def _send_email(to_address: str, subject: str, body: str, html_body: str = None) -> None:
    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = settings.SMTP_FROM
    msg["To"] = to_address
    msg.set_content(body)
    
    if html_body:
        msg.add_alternative(html_body, subtype="html")

    with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=15) as server:
        if settings.SMTP_TLS:
            server.starttls()
        if settings.SMTP_USER and settings.SMTP_PASSWORD:
            server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
        server.send_message(msg)


def send_otp(channel: str, destination: str, code: str) -> bool:
    """
    Deliver the OTP. Returns True if it was actually sent through a real channel,
    False if running in dev mode (caller will surface the code to the client).
    """
    subject = "Your ServiceSync verification code"
    body = (
        f"Your ServiceSync admin setup verification code is: {code}\n\n"
        f"It expires in {settings.OTP_EXP_MINUTES} minutes. "
        f"If you did not request this, you can ignore this message."
    )

    if channel == "email" and _smtp_configured():
        try:
            _send_email(destination, subject, body)
            print(f"[OTP] Verification email sent to {destination}")
            return True
        except Exception as exc:  # noqa: BLE001 — fall back to dev mode on any failure
            print(f"[OTP] Email delivery failed ({exc}); falling back to dev mode")

    if channel == "phone" and _sms_configured():
        try:
            _send_sms(destination, body)
            print(f"[OTP] Verification SMS sent to {destination}")
            return True
        except Exception as exc:  # noqa: BLE001 — fall back to dev mode on any failure
            print(f"[OTP] SMS delivery failed ({exc}); falling back to dev mode")

    # No provider configured for this channel → dev mode.
    print(f"[OTP] (dev mode) code for {channel} {destination}: {code}")
    return False


def send_sms_notification(phone: str, password: str) -> bool:
    """Placeholder/mock: SMS a technician their temporary password.

    Sends through Text.lk if configured, otherwise logs in dev mode. Swap the
    body / provider for a real gateway (e.g. Notify.lk) when integrating later.
    Returns True if dispatched through a real provider, False in dev mode.
    """
    message = (
        f"Welcome to ServiceSync! Your temporary password is: {password}\n"
        "Log in and you'll be prompted to set a new password."
    )
    if _sms_configured():
        try:
            _send_sms(phone, message)
            print(f"[SMS] Temporary password sent to {phone}")
            return True
        except Exception as exc:  # noqa: BLE001 — fall back to dev mode on any failure
            print(f"[SMS] Delivery failed ({exc}); falling back to dev mode")

    print(f"[SMS] (dev mode / mock) to {phone}: {message}")
    return False
