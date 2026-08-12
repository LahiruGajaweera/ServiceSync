from datetime import datetime, timezone
from uuid import UUID
import os
import json
import google.generativeai as genai

from fastapi import HTTPException, BackgroundTasks
from sqlalchemy.orm import Session

from app.models.job import Job
from app.models.notification import SalvageAssessment
from app.models.user import User
from app.schemas.salvage import SalvageCreate, SalvageStatusUpdate


from app.services import scraper_service

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
if GEMINI_API_KEY:
    genai.configure(api_key=GEMINI_API_KEY)

def _run_auto_assessment(assessment_id: UUID, brand: str, model: str, db: Session):
    try:
        scraped = scraper_service.scrape_market_price(brand, model)
        market_price = scraped.get("avg_price")
        
        a = db.query(SalvageAssessment).filter(SalvageAssessment.id == assessment_id).first()
        if not a: return
        
        job = db.query(Job).filter(Job.id == a.job_id).first()
        if not job: return
        
        if market_price:
            a.scraped_market_price = market_price
            success = False
            
            if GEMINI_API_KEY:
                try:
                    prompt = (
                        "You are an expert electronics refurbisher. Evaluate the following device for salvage or refurbish.\n"
                        f"Device: {job.device_brand} {job.device_model}\n"
                        f"Reported Fault: {job.fault_category} - {job.fault_description}\n"
                        f"Estimated Repair Cost: {job.estimated_cost or 'Unknown'}\n"
                        f"Market Price of working unit: {market_price}\n\n"
                        "Return ONLY a valid JSON object with the following keys:\n"
                        "- \"refurbish_cost_estimate\": (float) estimated cost to repair it based on the fault. If the tech provided an estimate, use that or adjust it.\n"
                        "- \"salvage_value\": (float) estimated value of the working parts you can extract from it, considering the broken parts.\n"
                        "- \"recommendation\": (string) either \"refurbish\" or \"salvage_for_parts\" based on profitability.\n"
                    )
                    genai_model = genai.GenerativeModel(model_name="gemini-3.5-flash")
                    response = genai_model.generate_content(
                        prompt, 
                        generation_config={"response_mime_type": "application/json"}
                    )
                    
                    result = json.loads(response.text)
                    a.refurbish_cost_estimate = float(result.get("refurbish_cost_estimate", 0))
                    a.salvage_value = float(result.get("salvage_value", 0))
                    a.refurbish_value = float(market_price) - a.refurbish_cost_estimate
                    
                    rec = result.get("recommendation", "").lower()
                    if rec in ["refurbish", "salvage_for_parts"]:
                        a.recommendation = rec
                    else:
                        a.recommendation = "refurbish" if a.refurbish_value > a.salvage_value else "salvage_for_parts"
                    
                    success = True
                except Exception as e:
                    print(f"Gemini AI Salvage Assessment Failed: {e}")
            
            if not success:
                # Fallback to simple ROI Calculation
                refurbish_cost = float(a.refurbish_cost_estimate or 0)
                if refurbish_cost == 0:
                    refurbish_cost = float(market_price) * 0.3 # Rough estimate
                    a.refurbish_cost_estimate = refurbish_cost
                    
                a.refurbish_value = float(market_price) - refurbish_cost
                salvage_val = float(a.salvage_value or (float(market_price) * 0.4))
                a.salvage_value = salvage_val
                a.recommendation = "refurbish" if a.refurbish_value > salvage_val else "salvage_for_parts"
            
        a.status = "assessed"
        db.commit()
    except Exception as e:
        print(f"Salvage Assessment Task Error: {e}")


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
    rows = (
        db.query(SalvageAssessment, Job)
        .outerjoin(Job, SalvageAssessment.job_id == Job.id)
        .order_by(SalvageAssessment.assessed_at.desc())
        .all()
    )
    result = []
    for a, job in rows:
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
