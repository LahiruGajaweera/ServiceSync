from datetime import datetime, timezone
from uuid import UUID

from fastapi import HTTPException, BackgroundTasks
from sqlalchemy.orm import Session

from app.models.job import Job
from app.models.notification import SalvageAssessment
from app.models.user import User
from app.schemas.salvage import SalvageCreate, SalvageStatusUpdate


from app.services import scraper_service

def _run_auto_assessment(assessment_id: UUID, brand: str, model: str, db: Session):
    try:
        scraped = scraper_service.scrape_market_price(brand, model)
        market_price = scraped.get("avg_price")
        
        a = db.query(SalvageAssessment).filter(SalvageAssessment.id == assessment_id).first()
        if not a: return
        
        if market_price:
            a.scraped_market_price = market_price
            
            # Simple ROI Calculation
            refurbish_cost = float(a.refurbish_cost_estimate or 0)
            if refurbish_cost == 0:
                refurbish_cost = float(market_price) * 0.3 # Rough estimate
                a.refurbish_cost_estimate = refurbish_cost
                
            a.refurbish_value = float(market_price) - refurbish_cost
            
            # If we don't have parts value, just estimate it
            salvage_val = float(a.salvage_value or (float(market_price) * 0.4))
            a.salvage_value = salvage_val
            
            a.recommendation = "refurbish" if a.refurbish_value > salvage_val else "salvage_for_parts"
            
        a.status = "assessed"
        db.commit()
    except Exception as e:
        pass


def create_assessment(data: SalvageCreate, assessed_by_user: User, background_tasks: BackgroundTasks, db: Session) -> SalvageAssessment:
    job = db.query(Job).filter(Job.id == data.job_id).first()
    if not job:
        raise HTTPException(404, "Job not found")
    if db.query(SalvageAssessment).filter(SalvageAssessment.job_id == data.job_id).first():
        raise HTTPException(400, "Assessment already exists for this job")

    assessment = SalvageAssessment(
        job_id=data.job_id,
        scraped_market_price=data.scraped_market_price,
        refurbish_cost_estimate=data.refurbish_cost_estimate,
        refurbish_value=data.refurbish_value,
        salvage_value=data.salvage_value,
        recommendation=data.recommendation,
        assessed_by=assessed_by_user.id,
        assessed_at=datetime.now(timezone.utc),
        status="pending" if not data.recommendation else "assessed",
    )
    db.add(assessment)
    db.commit()
    db.refresh(assessment)
    
    # If no manual recommendation, run auto-assessment
    if not data.recommendation:
        background_tasks.add_task(_run_auto_assessment, assessment.id, job.device_brand, job.device_model, db)
        
    return assessment


def list_assessments(db: Session) -> list[dict]:
    assessments = (
        db.query(SalvageAssessment)
        .order_by(SalvageAssessment.assessed_at.desc())
        .all()
    )
    result = []
    for a in assessments:
        job = db.query(Job).filter(Job.id == a.job_id).first()
        result.append({
            "id": a.id,
            "job_id": a.job_id,
            "job_public_id": job.job_id if job else None,
            "device": f"{job.device_brand} {job.device_model}" if job else None,
            "job_status": job.status if job else None,
            "scraped_market_price": a.scraped_market_price,
            "refurbish_cost_estimate": a.refurbish_cost_estimate,
            "refurbish_value": a.refurbish_value,
            "salvage_value": a.salvage_value,
            "recommendation": a.recommendation,
            "status": a.status,
            "assessed_by": a.assessed_by,
            "assessed_at": a.assessed_at,
        })
    return result


def get_assessment(assessment_id: UUID, db: Session) -> SalvageAssessment:
    a = db.query(SalvageAssessment).filter(SalvageAssessment.id == assessment_id).first()
    if not a:
        raise HTTPException(404, "Assessment not found")
    return a


def update_status(assessment_id: UUID, data: SalvageStatusUpdate, db: Session) -> SalvageAssessment:
    a = db.query(SalvageAssessment).filter(SalvageAssessment.id == assessment_id).first()
    if not a:
        raise HTTPException(404, "Assessment not found")
    a.status = data.status
    db.commit()
    db.refresh(a)
    return a
