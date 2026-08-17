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

async def _run_auto_assessment(assessment_id: UUID, brand: str, model: str):
    from app.core.database import SessionLocal
    db = SessionLocal()
    try:
        scraped = await scraper_service.scrape_market_price(brand, model)
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
                        f"Physical Condition: {job.physical_condition or 'Unknown'}\n"
                        f"Estimated Repair Cost: {job.estimated_cost or 'Unknown'}\n"
                        f"Market Price of working unit: {market_price}\n\n"
                        "If images are provided, analyze them for physical damage (e.g. cracked screen, dents) to adjust your cost estimate.\n"
                        "Return ONLY a valid JSON object with the following keys:\n"
                        "- \"refurbish_cost_estimate\": (float) estimated cost to repair it based on the fault and physical condition. If the tech provided an estimate, use that or adjust it.\n"
                        "- \"salvage_value\": (float) estimated value of the working parts you can extract from it, considering the broken parts.\n"
                        "- \"recommendation\": (string) either \"refurbish\" or \"salvage_for_parts\" based on profitability.\n"
                    )
                    
                    from app.models.job import JobImage
                    job_images = db.query(JobImage).filter(JobImage.job_id == job.id).all()
                    
                    prompt_parts = [prompt]
                    for img in job_images:
                        local_path = img.file_path.lstrip('/')
                        if os.path.exists(local_path):
                            uploaded = genai.upload_file(path=local_path)
                            prompt_parts.append(uploaded)

                    # Using gemini-1.5-flash which supports vision
                    genai_model = genai.GenerativeModel(model_name="gemini-1.5-flash")
                    response = genai_model.generate_content(
                        prompt_parts, 
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
    finally:
        db.close()


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
        background_tasks.add_task(_run_auto_assessment, assessment.id, job.device_brand, job.device_model)
        
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
        
    if data.status == "approved" and a.status != "approved":
        job = db.query(Job).filter(Job.id == a.job_id).first()
        if a.recommendation == "salvage_for_parts" and job:
            from app.models.donor import DonorDevice
            # Ensure it doesn't already exist
            donor_exists = db.query(DonorDevice).filter(DonorDevice.source_job_id == job.id).first()
            if not donor_exists:
                new_donor = DonorDevice(
                    brand=job.device_brand,
                    model=job.device_model,
                    imei=job.device_imei,
                    condition="poor",
                    source="unclaimed_job",
                    source_job_id=job.id,
                    status="available"
                )
                db.add(new_donor)
                
    a.status = data.status
    db.commit()
    db.refresh(a)
    return a


def get_pending_unclaimed_jobs(db: Session) -> list[dict]:
    from datetime import datetime, timedelta, timezone
    from app.models.job import JobStatusHistory
    salvage_threshold = datetime.now(timezone.utc) - timedelta(minutes=3)
    
    unclaimed_jobs = db.query(Job).filter(Job.status == "unclaimed").all()
    result = []
    
    for job in unclaimed_jobs:
        if job.salvage_delayed_until and job.salvage_delayed_until > datetime.now(timezone.utc):
            continue
            
        # Check if assessment already exists
        assessment_exists = db.query(SalvageAssessment).filter(SalvageAssessment.job_id == job.id).first()
        if assessment_exists:
            continue
            
        history = (
            db.query(JobStatusHistory)
            .filter(JobStatusHistory.job_id == job.id, JobStatusHistory.status == "ready_for_pickup")
            .order_by(JobStatusHistory.created_at.desc())
            .first()
        )
        
        if history and history.created_at < salvage_threshold:
            result.append({
                "job_id": job.id,
                "job_public_id": job.job_id,
                "device": f"{job.device_brand} {job.device_model}",
                "unclaimed_since": history.created_at
            })
            
    return result


def delay_salvage(job_id: UUID, days: int, db: Session):
    from datetime import datetime, timezone, timedelta
    from fastapi import HTTPException
    from app.models.job import JobStatusHistory
    
    job = db.query(Job).filter(Job.id == job_id).first()
    if not job:
        raise HTTPException(404, "Job not found")
        
    # Revert to ready_for_pickup
    job.status = "ready_for_pickup"
    
    # DO NOT reset notification flags so the customer doesn't get spammed again!
    
    # Set the exact delay date based on admin's request
    job.salvage_delayed_until = datetime.now(timezone.utc) + timedelta(days=days)
    
    # Add new history entry
    history = JobStatusHistory(
        job_id=job.id,
        status="ready_for_pickup",
        changed_by=job.customer_id, # Placeholder
        notes=f"Time extended by admin for {days} days. Reverted from unclaimed."
    )
    db.add(history)
    
    # Remove pending salvage assessment if exists
    db.query(SalvageAssessment).filter(SalvageAssessment.job_id == job.id, SalvageAssessment.status == "pending").delete()
    
    db.commit()
    return {"status": "reverted_to_ready_for_pickup"}
