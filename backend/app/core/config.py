from decimal import Decimal

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    APP_NAME: str = "ServiceSync"
    DATABASE_URL: str
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60

    # ── Pricing ───────────────────────────────────────────────────────
    # Markup applied to a batch's cost price to derive the customer price
    # when a part is consumed on a job. e.g. 30 => customer pays cost * 1.30.
    PARTS_MARKUP_PCT: Decimal = Decimal("30")

    # ── OTP / verification ────────────────────────────────────────────
    OTP_EXP_MINUTES: int = 10

    # Optional SMTP — when set, OTP emails are actually sent.
    # If unset, the system runs in dev mode (code returned in the API response & logged).
    SMTP_HOST: str | None = None
    SMTP_PORT: int = 587
    SMTP_USER: str | None = None
    SMTP_PASSWORD: str | None = None
    SMTP_FROM: str | None = None
    SMTP_TLS: bool = True

    # Optional Text.lk SMS gateway — when set, OTP codes are sent via SMS.
    # If unset, the phone channel runs in dev mode (code returned & logged).
    TEXTLK_API_TOKEN: str | None = None
    TEXTLK_SENDER_ID: str | None = None
    TEXTLK_API_URL: str = "https://app.text.lk/api/v3/sms/send"

    class Config:
        env_file = ".env"


settings = Settings()
