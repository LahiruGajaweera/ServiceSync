import os
import uuid
from typing import Any, Dict
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import require_admin
from app.models.setting import SystemSetting
from app.models.user import User

router = APIRouter(prefix="/settings", tags=["System Settings"])


# Default initial settings dictionary
DEFAULT_SETTINGS: Dict[str, Dict[str, str]] = {
    "shop_name": {
        "value": "ServiceSync Repair Center",
        "category": "general",
        "description": "Name of the shop displayed on top bar and invoices",
    },
    "shop_address": {
        "value": "No. 123, Main Street, Colombo, Sri Lanka",
        "category": "general",
        "description": "Physical shop address for invoices",
    },
    "shop_phone": {
        "value": "077 123 4567",
        "category": "general",
        "description": "Primary contact phone number",
    },
    "shop_email": {
        "value": "info@servicesync.lk",
        "category": "general",
        "description": "Shop support email address",
    },
    "tax_rate": {
        "value": "15.0",
        "category": "financial",
        "description": "Default tax percentage applied to invoices",
    },
    "currency_symbol": {
        "value": "LKR",
        "category": "financial",
        "description": "Currency symbol or code (e.g. LKR, Rs., $)",
    },
    "warranty_terms": {
        "value": "1. Warranty covers replaced parts only. 2. Physical and water damage voids warranty. 3. Original receipt required for claims.",
        "category": "warranty",
        "description": "General shop warranty policy terms printed on receipts",
    },
    "category_warranties": {
        "value": '{"Display & Touch":"30","Battery Replacement":"90","Charging Port":"14","Motherboard IC":"7","Software / Unlocking":"0","General Repairs":"30"}',
        "category": "warranty",
        "description": "JSON map of category-specific default warranty days",
    },
    "invoice_footer_note": {
        "value": "Thank you for choosing ServiceSync! All repairs include shop warranty as stated.",
        "category": "branding",
        "description": "Footer message shown on printed invoices",
    },
    "shop_logo_url": {
        "value": "",
        "category": "branding",
        "description": "URL of the uploaded shop logo",
    },
}


class SettingsUpdateSchema(BaseModel):
    settings: Dict[str, str]


@router.get("", response_model=Dict[str, Any])
def get_all_settings(db: Session = Depends(get_db)):
    """Fetch all system settings as a key-value dictionary."""
    rows = db.query(SystemSetting).all()
    setting_map = {r.key: r.value for r in rows}

    # Ensure all defaults are present in return object
    result = {}
    for key, info in DEFAULT_SETTINGS.items():
        result[key] = setting_map.get(key, info["value"])

    # Include any custom added settings
    for key, val in setting_map.items():
        if key not in result:
            result[key] = val

    return result


@router.put("", response_model=Dict[str, Any])
def update_settings(
    payload: SettingsUpdateSchema,
    db: Session = Depends(get_db),
    current_admin: User = Depends(require_admin),
):
    """Update system settings in bulk (Admin only)."""
    for key, val in payload.settings.items():
        setting = db.query(SystemSetting).filter(SystemSetting.key == key).first()
        if not setting:
            category = DEFAULT_SETTINGS.get(key, {}).get("category", "general")
            desc = DEFAULT_SETTINGS.get(key, {}).get("description", "")
            setting = SystemSetting(key=key, value=str(val), category=category, description=desc)
            db.add(setting)
        else:
            setting.value = str(val)
    
    db.commit()
    return get_all_settings(db=db)


@router.post("/logo")
def upload_shop_logo(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_admin: User = Depends(require_admin),
):
    """Upload shop logo image and update shop_logo_url setting (Admin only)."""
    allowed_types = ["image/jpeg", "image/png", "image/webp", "image/svg+xml"]
    if file.content_type not in allowed_types:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid image format. Allowed formats: JPG, PNG, WEBP, SVG.",
        )

    os.makedirs("uploads/logos", exist_ok=True)
    ext = os.path.splitext(file.filename)[1] or ".png"
    filename = f"logo_{uuid.uuid4().hex[:8]}{ext}"
    file_path = os.path.join("uploads/logos", filename)

    with open(file_path, "wb") as buffer:
        buffer.write(file.file.read())

    logo_url = f"/uploads/logos/{filename}"

    # Update system_settings entry
    setting = db.query(SystemSetting).filter(SystemSetting.key == "shop_logo_url").first()
    if not setting:
        setting = SystemSetting(
            key="shop_logo_url",
            value=logo_url,
            category="branding",
            description="URL of the uploaded shop logo",
        )
        db.add(setting)
    else:
        setting.value = logo_url

    db.commit()
    return {"logo_url": logo_url}
