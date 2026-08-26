from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy import text

from app.core.config import settings
from app.core.database import engine

# Import all models so SQLAlchemy registers them with Base.metadata before create_all
import app.models  # noqa: F401
from app.core.database import Base


import asyncio
from app.tasks.automation import background_task_runner

@asynccontextmanager
async def lifespan(_: FastAPI):
    Base.metadata.create_all(bind=engine)
    _run_migrations()
    _backfill_inventory()
    _seed_brands()
    _seed_models()
    _seed_specs()
    _seed_settings()
    
    # Start background tasks
    bg_task = asyncio.create_task(background_task_runner())
    
    yield
    
    bg_task.cancel()


def _run_migrations() -> None:
    """Idempotent schema tweaks for the no-Alembic setup (safe to run every boot)."""
    statements = [
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS phone_number VARCHAR(20)",
        "ALTER TABLE users ALTER COLUMN email DROP NOT NULL",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url VARCHAR(255)",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS specializations VARCHAR(255)",
        "CREATE UNIQUE INDEX IF NOT EXISTS ix_users_phone_number ON users (phone_number)",
        # Temporary-password / force-change-on-first-login (existing rows default to FALSE)
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS is_temporary_password BOOLEAN NOT NULL DEFAULT FALSE",
        # Inventory batch system
        "ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS sku VARCHAR(40)",
        "ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS track_serial BOOLEAN NOT NULL DEFAULT FALSE",
        "ALTER TABLE inventory_items ALTER COLUMN unit_price SET DEFAULT 0",
        "CREATE UNIQUE INDEX IF NOT EXISTS ix_inventory_items_sku ON inventory_items (sku)",
        "ALTER TABLE job_parts_used ADD COLUMN IF NOT EXISTS batch_id UUID REFERENCES inventory_batches(id)",
        "ALTER TABLE job_parts_used ADD COLUMN IF NOT EXISTS used_by_technician_id UUID REFERENCES users(id)",
        "ALTER TABLE job_parts_used ADD COLUMN IF NOT EXISTS unit_price NUMERIC(10, 2) NOT NULL DEFAULT 0",
        "ALTER TABLE jobs ADD COLUMN IF NOT EXISTS estimated_cost NUMERIC(10, 2)",
        "ALTER TABLE jobs ADD COLUMN IF NOT EXISTS final_warning_sent BOOLEAN NOT NULL DEFAULT FALSE",
        "ALTER TABLE jobs ADD COLUMN IF NOT EXISTS reminder_83_sent BOOLEAN NOT NULL DEFAULT FALSE",
        "ALTER TABLE jobs ADD COLUMN IF NOT EXISTS reminder_90_sent BOOLEAN NOT NULL DEFAULT FALSE",
        "ALTER TABLE jobs ADD COLUMN IF NOT EXISTS reminder_425_sent BOOLEAN NOT NULL DEFAULT FALSE",
        "ALTER TABLE jobs ADD COLUMN IF NOT EXISTS investigated BOOLEAN NOT NULL DEFAULT FALSE",
        "ALTER TABLE job_parts_used ADD COLUMN IF NOT EXISTS inventory_unit_id UUID REFERENCES inventory_units(id)",
        "ALTER TABLE jobs ADD COLUMN IF NOT EXISTS admin_alert TEXT",
        "ALTER TABLE jobs ADD COLUMN IF NOT EXISTS physical_condition VARCHAR(255)",
        "ALTER TABLE jobs ADD COLUMN IF NOT EXISTS salvage_delayed_until TIMESTAMP WITH TIME ZONE",
        "ALTER TABLE inventory_adjustment_logs ADD COLUMN IF NOT EXISTS batch_id UUID REFERENCES inventory_batches(id)",
        "ALTER TABLE donor_devices ADD COLUMN IF NOT EXISTS source_description VARCHAR(255)",
        "ALTER TABLE donor_devices ADD COLUMN IF NOT EXISTS assigned_technician_id UUID REFERENCES users(id)",
        "ALTER TABLE donor_parts ADD COLUMN IF NOT EXISTS approval_status VARCHAR(20) NOT NULL DEFAULT 'approved'",
        "ALTER TABLE jobs ADD COLUMN IF NOT EXISTS actual_fault VARCHAR(100)",
        "ALTER TABLE jobs ADD COLUMN IF NOT EXISTS identified_fault VARCHAR(100)",
        "ALTER TABLE jobs ADD COLUMN IF NOT EXISTS diagnostic_time_mins INTEGER",
        "ALTER TABLE jobs ADD COLUMN IF NOT EXISTS repair_time_mins INTEGER",
        "ALTER TABLE jobs ADD COLUMN IF NOT EXISTS resolution_notes TEXT",
        
        # QC Checklist
        "ALTER TABLE jobs ADD COLUMN IF NOT EXISTS qc_mic_tested BOOLEAN NOT NULL DEFAULT FALSE",
        "ALTER TABLE jobs ADD COLUMN IF NOT EXISTS qc_camera_tested BOOLEAN NOT NULL DEFAULT FALSE",
        "ALTER TABLE jobs ADD COLUMN IF NOT EXISTS qc_touch_tested BOOLEAN NOT NULL DEFAULT FALSE",
        "ALTER TABLE jobs ADD COLUMN IF NOT EXISTS qc_biometrics_tested BOOLEAN NOT NULL DEFAULT FALSE",
        "ALTER TABLE jobs ADD COLUMN IF NOT EXISTS qc_wifi_tested BOOLEAN NOT NULL DEFAULT FALSE",
        "ALTER TABLE jobs ADD COLUMN IF NOT EXISTS qc_charging_tested BOOLEAN NOT NULL DEFAULT FALSE",
    ]
    
    with engine.connect().execution_options(isolation_level="AUTOCOMMIT") as conn:
        try:
            conn.execute(text("ALTER TYPE donor_source ADD VALUE IF NOT EXISTS 'other'"))
        except Exception:
            pass
        try:
            conn.execute(text("ALTER TYPE donor_status ADD VALUE IF NOT EXISTS 'assessed'"))
        except Exception:
            pass
        try:
            conn.execute(text("ALTER TYPE job_status ADD VALUE IF NOT EXISTS 'failed'"))
        except Exception:
            pass
        try:
            conn.execute(text("ALTER TYPE job_status ADD VALUE IF NOT EXISTS 'rejected'"))
        except Exception:
            pass

    with engine.begin() as conn:
        for stmt in statements:
            conn.execute(text(stmt))


def _backfill_inventory() -> None:
    """Assign SKUs to legacy items and fold their loose stock into an initial batch."""
    from datetime import datetime, timezone

    from app.core.database import SessionLocal
    from app.models.inventory import InventoryBatch, InventoryItem
    from app.services.inventory_service import _generate_sku, _next_batch_code

    db = SessionLocal()
    try:
        items = db.query(InventoryItem).all()
        changed = False
        for item in items:
            if not item.sku:
                item.sku = _generate_sku(item.category, db)
                db.flush()
                changed = True
        for item in items:
            has_batch = (
                db.query(InventoryBatch)
                .filter(InventoryBatch.inventory_item_id == item.id)
                .first()
            )
            if not has_batch and (item.quantity or 0) > 0:
                db.add(InventoryBatch(
                    batch_code=_next_batch_code(item, db),
                    inventory_item_id=item.id,
                    supplier=item.supplier,
                    unit_cost=item.unit_price or 0,
                    quantity_received=item.quantity,
                    quantity_remaining=item.quantity,
                    purchased_at=datetime.now(timezone.utc),
                ))
                db.flush()
                changed = True
        if changed:
            db.commit()
    finally:
        db.close()


# Common phone brands seeded into the registry on first boot.
_DEFAULT_BRANDS = [
    "Apple", "Samsung", "Xiaomi", "Huawei", "Oppo", "Vivo", "Realme",
    "OnePlus", "Google", "Motorola", "Nokia", "Sony", "LG", "Asus",
    "Honor", "Lenovo", "ZTE", "Infinix", "Tecno", "Nothing",
]


def _seed_brands() -> None:
    """Populate the brand registry with common phone brands (idempotent)."""
    from app.core.database import SessionLocal
    from app.models.brand import Brand

    db = SessionLocal()
    try:
        existing = {b.name.lower() for b in db.query(Brand).all()}
        added = False
        for name in _DEFAULT_BRANDS:
            if name.lower() not in existing:
                db.add(Brand(name=name))
                added = True
        if added:
            db.commit()
    finally:
        db.close()


# Popular phone models per brand seeded into the registry on first boot.
# Staff can add any missing model on the fly via the UI (saved to the table).
_DEFAULT_MODELS = {
    "Apple": [
        "iPhone 11", "iPhone 12", "iPhone 12 Pro", "iPhone 13", "iPhone 13 Pro",
        "iPhone 14", "iPhone 14 Pro", "iPhone 15", "iPhone 15 Pro", "iPhone SE",
    ],
    "Samsung": [
        "Galaxy A14", "Galaxy A54", "Galaxy S21", "Galaxy S22", "Galaxy S23",
        "Galaxy S24", "Galaxy Note 20", "Galaxy A34", "Galaxy M14", "Galaxy Z Flip 5",
    ],
    "Xiaomi": [
        "Redmi Note 12", "Redmi Note 13", "Redmi 12", "Redmi 13C",
        "Poco X6", "Poco F5", "Mi 11", "13T Pro",
    ],
    "Huawei": ["P30", "P40", "P50 Pro", "Mate 40", "Nova 11", "Y9"],
    "Oppo": ["Reno 10", "Reno 11", "A78", "A98", "Find X6"],
    "Vivo": ["V29", "V27", "Y36", "Y27", "X100"],
    "Realme": ["Realme 11", "Realme 12 Pro", "Realme C55", "Realme C53", "GT Neo 5"],
    "OnePlus": ["OnePlus 11", "OnePlus 12", "Nord 3", "Nord CE 3", "10 Pro"],
    "Google": ["Pixel 6", "Pixel 7", "Pixel 7a", "Pixel 8", "Pixel 8 Pro"],
    "Motorola": ["Moto G54", "Moto G84", "Edge 40", "Razr 40"],
    "Nokia": ["Nokia G21", "Nokia G42", "Nokia X30", "Nokia C32"],
    "Nothing": ["Phone (1)", "Phone (2)", "Phone (2a)"],
}


def _seed_models() -> None:
    """Populate the phone-model registry with popular models per brand (idempotent)."""
    from app.core.database import SessionLocal
    from app.models.phone_model import PhoneModel

    db = SessionLocal()
    try:
        existing = {
            (m.brand.lower(), m.name.lower()) for m in db.query(PhoneModel).all()
        }
        added = False
        for brand, names in _DEFAULT_MODELS.items():
            for name in names:
                if (brand.lower(), name.lower()) not in existing:
                    db.add(PhoneModel(brand=brand, name=name))
                    added = True
        if added:
            db.commit()
    finally:
        db.close()


# Common part spec/identifier tokens seeded into the registry on first boot.
# Staff can add any missing spec on the fly via the UI (saved to the table).
_DEFAULT_SPECS = [
    "OEM", "ORIGINAL", "COPY", "OLED", "LCD", "INCELL", "AMOLED",
    "AAA", "HIGH COPY", "REFURBISHED", "PULLED",
]


def _seed_specs() -> None:
    """Populate the part-spec registry with common spec tokens (idempotent)."""
    from app.core.database import SessionLocal
    from app.models.part_spec import PartSpec

    db = SessionLocal()
    try:
        existing = {s.name.lower() for s in db.query(PartSpec).all()}
        added = False
        for name in _DEFAULT_SPECS:
            if name.lower() not in existing:
                db.add(PartSpec(name=name))
                added = True
        if added:
            db.commit()
    finally:
        db.close()


def _seed_settings() -> None:
    """Populate default system settings if missing (idempotent)."""
    from app.core.database import SessionLocal
    from app.models.setting import SystemSetting
    from app.routers.settings import DEFAULT_SETTINGS

    db = SessionLocal()
    try:
        existing = {s.key for s in db.query(SystemSetting).all()}
        added = False
        for key, info in DEFAULT_SETTINGS.items():
            if key not in existing:
                db.add(
                    SystemSetting(
                        key=key,
                        value=info["value"],
                        category=info["category"],
                        description=info.get("description"),
                    )
                )
                added = True
        if added:
            db.commit()
    finally:
        db.close()


app = FastAPI(
    title="ServiceSync API",
    description="Smart Job & Inventory Management System for Phone Repair Shop",
    version="1.0.0",
    lifespan=lifespan,
)

import os
os.makedirs("uploads/avatars", exist_ok=True)
os.makedirs("uploads/logos", exist_ok=True)
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

from app.routers import analytics, auth, customers, donors, inventory, invoices, jobs, notifications, salvage, scraper, users, chatbot  # noqa: E402
from app.routers import admin, brands, models, part_specs, suppliers, admin_tasks, settings  # noqa: E402

app.include_router(auth.router)
app.include_router(admin.router)
app.include_router(users.router)
app.include_router(customers.router)
app.include_router(suppliers.router)
app.include_router(jobs.router)
app.include_router(inventory.router)
app.include_router(donors.router)
app.include_router(invoices.router)
app.include_router(salvage.router)
app.include_router(analytics.router)
app.include_router(notifications.router)
app.include_router(scraper.router)
app.include_router(brands.router)
app.include_router(models.router)
app.include_router(part_specs.router)
app.include_router(chatbot.router)
app.include_router(admin_tasks.router)
app.include_router(settings.router)


@app.get("/health", tags=["System"])
def health_check():
    return {"status": "ok", "app": settings.APP_NAME}
