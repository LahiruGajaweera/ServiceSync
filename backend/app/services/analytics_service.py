from datetime import date, datetime, timedelta, timezone
from decimal import Decimal

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.invoice import Invoice
from app.models.inventory import InventoryItem
from app.models.job import Job, JobStatusHistory
from app.models.notification import SalvageAssessment
from app.models.user import User


def get_summary(db: Session) -> dict:
    today = datetime.now(timezone.utc)
    month_start = today.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

    total_jobs       = db.query(func.count(Job.id)).scalar() or 0
    active_jobs      = db.query(func.count(Job.id)).filter(Job.status == "in_progress").scalar() or 0
    pending_jobs     = db.query(func.count(Job.id)).filter(Job.status == "pending").scalar() or 0
    completed_jobs   = db.query(func.count(Job.id)).filter(Job.status.in_(["completed", "delivered"])).scalar() or 0
    unclaimed_jobs   = db.query(func.count(Job.id)).filter(Job.status == "unclaimed").scalar() or 0
    pickup_jobs      = db.query(func.count(Job.id)).filter(Job.status == "ready_for_pickup").scalar() or 0

    revenue_total    = db.query(func.sum(Invoice.total_amount)).filter(Invoice.payment_status == "paid").scalar() or Decimal("0")
    revenue_month    = db.query(func.sum(Invoice.total_amount)).filter(
        Invoice.payment_status == "paid",
        Invoice.paid_at >= month_start,
    ).scalar() or Decimal("0")
    invoices_unpaid  = db.query(func.count(Invoice.id)).filter(Invoice.payment_status == "unpaid").scalar() or 0

    low_stock        = db.query(func.count(InventoryItem.id)).filter(
        InventoryItem.quantity <= InventoryItem.min_stock_threshold
    ).scalar() or 0

    salvage_pending  = db.query(func.count(SalvageAssessment.id)).filter(SalvageAssessment.status == "pending").scalar() or 0
    technicians      = db.query(func.count(User.id)).filter(User.role == "technician", User.is_active.is_(True)).scalar() or 0

    return {
        "jobs": {
            "total": total_jobs,
            "active": active_jobs,
            "pending": pending_jobs,
            "completed": completed_jobs,
            "unclaimed": unclaimed_jobs,
            "ready_for_pickup": pickup_jobs,
        },
        "revenue": {
            "total_paid": float(revenue_total),
            "month_paid": float(revenue_month),
            "unpaid_invoices": invoices_unpaid,
        },
        "inventory": {
            "low_stock_count": low_stock,
        },
        "salvage": {
            "pending_assessments": salvage_pending,
        },
        "staff": {
            "active_technicians": technicians,
        },
    }


def get_jobs_trend(db: Session, days: int = 30) -> list[dict]:
    """Jobs created per day for the last N days."""
    cutoff = datetime.now(timezone.utc) - timedelta(days=days)
    rows = (
        db.query(
            func.date_trunc("day", Job.created_at).label("day"),
            func.count(Job.id).label("count"),
        )
        .filter(Job.created_at >= cutoff)
        .group_by("day")
        .order_by("day")
        .all()
    )
    # Fill missing days with zeros
    result_map = {row.day.date(): row.count for row in rows}
    trend = []
    for i in range(days):
        d = (datetime.now(timezone.utc) - timedelta(days=days - 1 - i)).date()
        trend.append({"date": d.isoformat(), "jobs": result_map.get(d, 0)})
    return trend


def get_revenue_trend(db: Session, months: int = 6) -> list[dict]:
    """Paid revenue per month for the last N months."""
    cutoff = datetime.now(timezone.utc).replace(day=1) - timedelta(days=1)
    cutoff = (cutoff.replace(day=1) - timedelta(days=(months - 1) * 28)).replace(day=1)

    rows = (
        db.query(
            func.date_trunc("month", Invoice.paid_at).label("month"),
            func.sum(Invoice.total_amount).label("revenue"),
        )
        .filter(Invoice.payment_status == "paid", Invoice.paid_at >= cutoff)
        .group_by("month")
        .order_by("month")
        .all()
    )
    result_map = {row.month.date().replace(day=1): float(row.revenue or 0) for row in rows}

    trend = []
    for i in range(months):
        today = datetime.now(timezone.utc).date()
        month_date = (today.replace(day=1) - timedelta(days=(months - 1 - i) * 28)).replace(day=1)
        trend.append({
            "month": month_date.strftime("%b %Y"),
            "revenue": result_map.get(month_date, 0),
        })
    return trend


def get_technician_stats(db: Session) -> list[dict]:
    """Per-technician job count breakdown."""
    technicians = db.query(User).filter(User.role == "technician", User.is_active.is_(True)).all()
    result = []
    for tech in technicians:
        jobs = db.query(Job).filter(Job.technician_id == tech.id).all()
        counts = {"pending": 0, "in_progress": 0, "completed": 0, "delivered": 0, "unclaimed": 0, "ready_for_pickup": 0}
        for job in jobs:
            counts[job.status] = counts.get(job.status, 0) + 1
        result.append({
            "technician_id": str(tech.id),
            "name": tech.name,
            "total": len(jobs),
            "status_breakdown": counts,
        })
    return sorted(result, key=lambda x: x["total"], reverse=True)


from typing import Optional
from datetime import datetime, timedelta, timezone

def get_fault_distribution(
    db: Session,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    brand: Optional[str] = None,
    model: Optional[str] = None,
) -> list[dict]:
    """Job count by fault category."""
    query = db.query(Job.fault_category, func.count(Job.id).label("count"))

    if start_date:
        try:
            start_dt = datetime.strptime(start_date, "%Y-%m-%d").replace(tzinfo=timezone.utc)
            query = query.filter(Job.received_date >= start_dt)
        except ValueError:
            pass

    if end_date:
        try:
            end_dt = datetime.strptime(end_date, "%Y-%m-%d").replace(tzinfo=timezone.utc, hour=23, minute=59, second=59)
            query = query.filter(Job.received_date <= end_dt)
        except ValueError:
            pass

    if brand and brand.lower() != "all":
        query = query.filter(Job.device_brand == brand)

    if model and model.lower() != "all":
        query = query.filter(Job.device_model == model)

    rows = (
        query.group_by(Job.fault_category)
        .order_by(func.count(Job.id).desc())
        .all()
    )
    return [{"fault_category": r.fault_category, "count": r.count} for r in rows]


def get_status_distribution(db: Session) -> list[dict]:
    """Job count by current status."""
    rows = (
        db.query(Job.status, func.count(Job.id).label("count"))
        .group_by(Job.status)
        .order_by(func.count(Job.id).desc())
        .all()
    )
    return [{"status": r.status, "count": r.count} for r in rows]

def get_device_models(db: Session) -> list[str]:
    """List of distinct device models in jobs."""
    rows = db.query(Job.device_model).distinct().filter(Job.device_model.is_not(None)).order_by(Job.device_model).all()
    return [r[0] for r in rows]
