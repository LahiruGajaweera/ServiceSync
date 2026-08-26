from datetime import datetime, timezone
from sqlalchemy import Column, DateTime, String, Text

from app.core.database import Base


class SystemSetting(Base):
    __tablename__ = "system_settings"

    key = Column(String(100), primary_key=True, index=True)
    value = Column(Text, nullable=True)
    category = Column(String(50), nullable=False, default="general", index=True)
    description = Column(String(255), nullable=True)
    updated_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )
