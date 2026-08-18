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
from app.schemas.salvage import SalvageCreate, SalvageStatusUpdate, NotesUpdate, SalvageActualsUpdate


from app.services import scraper_service

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
if GEMINI_API_KEY:
    genai.configure(api_key=GEMINI_API_KEY)

def get_similar_past_assessments(brand: str, model: str, db: Session) -> str:
    """Fetch past approved assessments with actual profit/loss data to use as few-shot examples for the AI."""
    past_cases = (
        db.query(SalvageAssessment)
        .join(Job, SalvageAssessment.job_id == Job.id)
        .filter(
            Job.device_brand == brand,
            Job.device_model == model,
            SalvageAssessment.profit_loss.isnot(None),
            SalvageAssessment.status == "approved"
        )
        .order_by(SalvageAssessment.assessed_at.desc())
        .limit(3)
        .all()
    )
    
    if not past_cases:
        return ""
        
    examples_str = "--- HISTORICAL DATA FOR SIMILAR DEVICES ---\n"
    for idx, case in enumerate(past_cases, 1):
        actual_profit = float(case.profit_loss)
        examples_str += f"Case {idx}:\n"
        examples_str += f"- Recommended: {case.recommendation}\n"
        examples_str += f"- Estimated Refurbish Cost: {case.refurbish_cost_estimate}\n"
        examples_str += f"- Actual Refurbish Cost: {case.actual_refurbish_cost or 'N/A'}\n"
        examples_str += f"- Estimated Salvage Value: {case.salvage_value}\n"
        examples_str += f"- Actual Parts Revenue: {case.actual_parts_revenue or 'N/A'}\n"
        examples_str += f"- Actual Profit/Loss: {actual_profit}\n"
        if actual_profit < 0:
            examples_str += "- Note: This previous recommendation resulted in a LOSS. Adjust your future estimates to be more conservative.\n"
        else:
            examples_str += "- Note: This previous recommendation resulted in a PROFIT.\n"
        examples_str += "\n"
        
    examples_str += "--- END HISTORICAL DATA ---\n\nPlease consider these past actuals when making your estimate.\n\n"
    return examples_str


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
            
            # Call the reusable live estimate function
            result = get_live_ai_estimate(job.id, float(market_price), db)
            
            a.refurbish_cost_estimate = result["refurbish_cost_estimate"]
            a.salvage_value = result["salvage_value"]
            a.refurbish_value = result["refurbish_value"]
            a.recommendation = result["recommendation"]
            a.parts_breakdown = result.get("parts_breakdown", [])
            a.ai_confidence = result.get("ai_confidence")
            
        a.status = "assessed"
        db.commit()
    except Exception as e:
        print(f"Salvage Assessment Task Error: {e}")
    finally:
        db.close()


def get_live_ai_estimate(job_id: UUID, market_price: float, db: Session) -> dict:
    job = db.query(Job).filter(Job.id == job_id).first()
    if not job:
        raise HTTPException(404, "Job not found")

    # Default fallback values
    result = {
        "refurbish_cost_estimate": float(market_price) * 0.3,
        "salvage_value": float(market_price) * 0.4,
        "refurbish_value": 0.0,
        "recommendation": "salvage_for_parts",
        "parts_breakdown": [],
        "ai_confidence": None
    }
    
    historical_context = get_similar_past_assessments(job.device_brand, job.device_model, db)

    if GEMINI_API_KEY:
        try:
            prompt = (
                "You are an expert electronics refurbisher and salvage assessor in Sri Lanka. "
                "Evaluate the following device for salvage or refurbish.\n\n"
                f"Device: {job.device_brand} {job.device_model}\n"
                f"Reported Fault: {job.fault_category} - {job.fault_description}\n"
                f"Physical Condition: {job.physical_condition or 'Unknown'}\n"
                f"Estimated Repair Cost: {job.estimated_cost or 'Unknown'}\n"
                f"Market Price of working unit (secondhand): LKR {market_price}\n\n"
                f"{historical_context}"
                "Return ONLY a valid JSON object with the following keys:\n"
                "- \"refurbish_cost_estimate\": (float) estimated cost in LKR to repair it based on the fault and physical condition.\n"
                "- \"salvage_value\": (float) total estimated value of all extractable working parts in LKR.\n"
                "- \"parts_breakdown\": (array) a list of objects, each with:\n"
                "    - \"part\": (string) name of the part (e.g., \"Display\", \"Battery\", \"Camera Module\", \"Motherboard\", \"Back Panel\", \"Speaker\", \"Charging Port\")\n"
                "    - \"condition\": (string) one of \"Good\", \"Fair\", \"Poor\", or \"Broken\"\n"
                "    - \"value\": (float) estimated salvage value of this part in LKR. Set to 0 if the part is broken/damaged.\n"
                "- \"ai_confidence\": (float) your confidence in this estimate from 0.0 to 1.0\n"
                "- \"recommendation\": (string) either \"refurbish\" or \"salvage_for_parts\" based on profitability.\n\n"
                "IMPORTANT: The parts_breakdown must include at least these parts: Display, Battery, Camera Module, Motherboard, Back Panel. "
                "Add more parts if relevant (Speaker, Charging Port, SIM Tray, etc). "
                "The sum of all part values should equal the salvage_value."
            )
            
            genai_model = genai.GenerativeModel(model_name="gemini-3.5-flash")
            response = genai_model.generate_content(
                [prompt], 
                generation_config={"response_mime_type": "application/json"}
            )
            
            ai_data = json.loads(response.text)
            result["refurbish_cost_estimate"] = float(ai_data.get("refurbish_cost_estimate", 0))
            result["ai_confidence"] = float(ai_data.get("ai_confidence", 0.5))
            
            # Parse parts breakdown
            parts = ai_data.get("parts_breakdown", [])
            if isinstance(parts, list) and len(parts) > 0:
                result["parts_breakdown"] = parts
                # Recalculate salvage_value as the sum of all part values
                # (don't trust the AI's total, calculate from parts)
                parts_total = sum(float(p.get("value", 0)) for p in parts)
                if parts_total > 0:
                    result["salvage_value"] = parts_total
                else:
                    result["salvage_value"] = float(ai_data.get("salvage_value", 0))
            else:
                result["salvage_value"] = float(ai_data.get("salvage_value", 0))
            
            rec = ai_data.get("recommendation", "").lower()
            if rec in ["refurbish", "salvage_for_parts"]:
                result["recommendation"] = rec
                
        except Exception as e:
            print(f"Gemini AI Live Estimate Failed: {e}")

    # Final calculations (fallback or post-AI)
    result["refurbish_value"] = float(market_price) - result["refurbish_cost_estimate"]
    
    # Force recommendation based strictly on mathematical profitability
    # (LLMs often fail at math comparisons, so we do it explicitly in code)
    if result["refurbish_value"] > result["salvage_value"]:
        result["recommendation"] = "refurbish"
    else:
        result["recommendation"] = "salvage_for_parts"
        
    return result


def batch_estimate(job_ids: list[UUID], db: Session) -> dict:
    """Run live estimates for multiple jobs synchronously."""
    results = []
    
    for job_id in job_ids:
        job = db.query(Job).filter(Job.id == job_id).first()
        if not job: continue
        
        a = db.query(SalvageAssessment).filter(SalvageAssessment.job_id == job.id).first()
        if a and a.status != "pending":
            continue
            
        market_price = float(a.scraped_market_price) if a and a.scraped_market_price else 0
        if market_price <= 0:
            import asyncio
            # Wait for market price scrape (blocking inside sync loop isn't ideal but works for small batches)
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            scraped = loop.run_until_complete(scraper_service.scrape_market_price(job.device_brand, job.device_model))
            loop.close()
            market_price = float(scraped.get("avg_price", 0))
            
            if market_price <= 0:
                results.append({"job_id": job.id, "error": "Could not determine market price"})
                continue
                
        if not a:
            # Create pending assessment if it doesn't exist
            a = SalvageAssessment(job_id=job.id, scraped_market_price=market_price, status="pending")
            db.add(a)
            db.commit()
            db.refresh(a)
        elif not a.scraped_market_price:
            a.scraped_market_price = market_price
            db.commit()
            
        try:
            est = get_live_ai_estimate(job.id, market_price, db)
            a.refurbish_cost_estimate = est["refurbish_cost_estimate"]
            a.salvage_value = est["salvage_value"]
            a.refurbish_value = est["refurbish_value"]
            a.recommendation = est["recommendation"]
            a.parts_breakdown = est.get("parts_breakdown", [])
            a.ai_confidence = est.get("ai_confidence")
            a.assessed_at = datetime.now(timezone.utc)
            a.status = "assessed"
            db.commit()
            results.append({"job_id": job.id, "status": "success", "recommendation": est["recommendation"]})
        except Exception as e:
            results.append({"job_id": job.id, "error": str(e)})
            
    return {"processed": len(results), "results": results}


def record_actuals(assessment_id: UUID, data: SalvageActualsUpdate, db: Session) -> SalvageAssessment:
    """Record actual costs/revenues and calculate profit/loss and AI accuracy."""
    a = db.query(SalvageAssessment).filter(SalvageAssessment.id == assessment_id).first()
    if not a:
        raise HTTPException(404, "Assessment not found")
        
    if data.actual_refurbish_cost is not None:
        a.actual_refurbish_cost = data.actual_refurbish_cost
    if data.actual_resale_price is not None:
        a.actual_resale_price = data.actual_resale_price
    if data.actual_parts_revenue is not None:
        a.actual_parts_revenue = data.actual_parts_revenue
        
    # Calculate Profit/Loss
    if a.recommendation == "refurbish":
        if a.actual_resale_price is not None and a.actual_refurbish_cost is not None:
            a.profit_loss = float(a.actual_resale_price) - float(a.actual_refurbish_cost)
            
            # AI predicted refurbish_value vs actual profit
            predicted = float(a.refurbish_value or 0)
            if predicted > 0:
                diff_pct = abs(predicted - float(a.profit_loss)) / predicted
                a.ai_accuracy_score = max(0.0, 1.0 - diff_pct)
    else:
        if a.actual_parts_revenue is not None:
            a.profit_loss = float(a.actual_parts_revenue)
            
            # AI predicted salvage_value vs actual revenue
            predicted = float(a.salvage_value or 0)
            if predicted > 0:
                diff_pct = abs(predicted - float(a.profit_loss)) / predicted
                a.ai_accuracy_score = max(0.0, 1.0 - diff_pct)
                
    db.commit()
    db.refresh(a)
    return a

def create_assessment(data: SalvageCreate, assessed_by_user: User, background_tasks: BackgroundTasks, db: Session) -> SalvageAssessment:
    job = db.query(Job).filter(Job.id == data.job_id).first()
    if not job:
        raise HTTPException(404, "Job not found")
    if db.query(SalvageAssessment).filter(SalvageAssessment.job_id == data.job_id).first():
        raise HTTPException(400, "Assessment already exists for this job")

    # Convert parts_breakdown Pydantic models to dicts for JSONB storage
    parts_data = [p.model_dump() if hasattr(p, 'model_dump') else p for p in (data.parts_breakdown or [])]

    assessment = SalvageAssessment(
        job_id=data.job_id,
        scraped_market_price=data.scraped_market_price,
        refurbish_cost_estimate=data.refurbish_cost_estimate,
        refurbish_value=data.refurbish_value,
        salvage_value=data.salvage_value,
        recommendation=data.recommendation,
        parts_breakdown=parts_data,
        notes=data.notes,
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
            "parts_breakdown": a.parts_breakdown or [],
            "notes": a.notes,
            "ai_confidence": a.ai_confidence,
            "actual_refurbish_cost": a.actual_refurbish_cost,
            "actual_resale_price": a.actual_resale_price,
            "actual_parts_revenue": a.actual_parts_revenue,
            "profit_loss": a.profit_loss,
            "ai_accuracy_score": a.ai_accuracy_score,
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
        
    if data.status == "approved" and a.status != "approved":
        job = db.query(Job).filter(Job.id == a.job_id).first()
        if a.recommendation == "salvage_for_parts" and job:
            from app.models.donor import DonorDevice
            # Ensure donor device doesn't already exist
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


def reassess(assessment_id: UUID, db: Session) -> dict:
    """Re-run AI estimate on an existing assessment using its stored market price."""
    a = db.query(SalvageAssessment).filter(SalvageAssessment.id == assessment_id).first()
    if not a:
        raise HTTPException(404, "Assessment not found")
    if a.status == "approved":
        raise HTTPException(400, "Cannot re-assess an approved assessment")
    
    market_price = float(a.scraped_market_price) if a.scraped_market_price else 0
    if market_price <= 0:
        raise HTTPException(400, "No market price stored — cannot re-assess")
    
    result = get_live_ai_estimate(a.job_id, market_price, db)
    
    a.refurbish_cost_estimate = result["refurbish_cost_estimate"]
    a.salvage_value = result["salvage_value"]
    a.refurbish_value = result["refurbish_value"]
    a.recommendation = result["recommendation"]
    a.parts_breakdown = result.get("parts_breakdown", [])
    a.ai_confidence = result.get("ai_confidence")
    a.assessed_at = datetime.now(timezone.utc)
    a.status = "assessed"
    
    db.commit()
    db.refresh(a)
    return result


def update_notes(assessment_id: UUID, data: NotesUpdate, db: Session) -> SalvageAssessment:
    """Update admin notes on an assessment."""
    a = db.query(SalvageAssessment).filter(SalvageAssessment.id == assessment_id).first()
    if not a:
        raise HTTPException(404, "Assessment not found")
    
    a.notes = data.notes
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
