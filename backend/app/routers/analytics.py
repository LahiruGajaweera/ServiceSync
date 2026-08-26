from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import Optional

from app.core.database import get_db
from app.core.deps import require_admin
from app.models.user import User
from app.services import analytics_service, predictive_service

router = APIRouter(prefix="/analytics", tags=["Analytics"])


@router.get("/summary")
def summary(
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    return analytics_service.get_summary(db)


@router.get("/jobs-trend")
def jobs_trend(
    days: int = 30,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    return analytics_service.get_jobs_trend(db, days=days)


@router.get("/revenue-trend")
def revenue_trend(
    months: int = 6,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    return analytics_service.get_revenue_trend(db, months=months)


@router.get("/technician-stats")
def technician_stats(
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    return analytics_service.get_technician_stats(db)


@router.get("/fault-distribution")
def fault_distribution(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    brand: Optional[str] = None,
    model: Optional[str] = None,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    return analytics_service.get_fault_distribution(db, start_date, end_date, brand, model)


@router.get("/status-distribution")
def status_distribution(
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    return analytics_service.get_status_distribution(db)


@router.get("/device-models")
def get_device_models(
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    return analytics_service.get_device_models(db)

@router.get("/device-brands-models")
def get_device_brands_and_models(
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    return analytics_service.get_device_brands_and_models(db)


@router.get("/predictions/faults")
def predict_faults(
    months_back: int = 6,
    device_brand: str = None,
    device_model: str = None,
    location: str = "Colombo",
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    return predictive_service.forecast_fault_trends(db, months_back=months_back, device_brand=device_brand, device_model=device_model, location=location)

@router.get("/predictions/devices")
def predict_devices(
    months_back: int = 6,
    fault_category: str = None,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    return predictive_service.forecast_device_trends(db, months_back=months_back, fault_category=fault_category)


@router.get("/predictions/inventory")
def predict_inventory(
    weeks_back: int = 12,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    return predictive_service.forecast_inventory_demand(db, weeks_back=weeks_back)


@router.get("/technician-performance")
def calculate_tech_performance(
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    return predictive_service.calculate_technician_scores(db)
