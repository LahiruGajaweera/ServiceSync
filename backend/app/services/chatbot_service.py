import re
import os
import httpx
from sqlalchemy.orm import Session
from app.models.job import Job

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

def get_shop_context(db: Session) -> str:
    # Get recent jobs with estimated cost to form a simple pricing guide
    jobs = db.query(Job).filter(Job.estimated_cost.isnot(None)).order_by(Job.id.desc()).limit(30).all()
    if not jobs:
        return "No historical pricing data available."
    
    pricing = {}
    for job in jobs:
        if not job.device_brand or not job.device_model or not job.fault_category:
            continue
        key = f"{job.device_brand} {job.device_model} ({job.fault_category.replace('_', ' ')})"
        if key not in pricing:
            pricing[key] = []
        pricing[key].append(float(job.estimated_cost))
    
    context_lines = []
    for k, v in pricing.items():
        avg = sum(v) / len(v)
        context_lines.append(f"- {k}: approx LKR {avg:,.0f}")
    
    return "Recent average repair costs:\n" + "\n".join(context_lines)

async def process_chat_message(message: str, db: Session) -> dict:
    message = message.strip()
    message_lower = message.lower()
    
    # 1. Rule-based: Check for Job ID pattern (e.g., SS-A1B2C3D4)
    job_id_match = re.search(r'SS-[A-F0-9]{8}', message.upper())
    if job_id_match:
        job_id = job_id_match.group(0)
        job = db.query(Job).filter(Job.job_id == job_id).first()
        if job:
            job_data = {
                "job_id": job.job_id,
                "status": job.status,
                "device_brand": job.device_brand,
                "device_model": job.device_model,
                "fault_category": job.fault_category,
                "received_date": job.received_date.isoformat() if job.received_date else None,
                "estimated_cost": float(job.estimated_cost) if job.estimated_cost else None,
            }
            return {"reply": f"Here is the status for your repair job ({job_id}):", "job_data": job_data}
        else:
            return {"reply": f"I couldn't find a repair job with the ID {job_id}. Please check the receipt."}

    # 2. Rule-based: Basic greetings and FAQs
    if message_lower in ["hi", "hello", "hey", "ayubowan"]:
        return {"reply": "Hello! Welcome to ServiceSync. How can I help you today? You can ask me about our shop or provide a Job ID (e.g. SS-12345678) to track your repair."}
    
    if "time" in message_lower or "hours" in message_lower or "open" in message_lower:
        return {"reply": "We are open Monday to Saturday, from 9:00 AM to 6:00 PM."}
        
    if "location" in message_lower or "where" in message_lower or "address" in message_lower:
        return {"reply": "We are located at No. 123, Main Street, Colombo 04."}

    # 3. AI Fallback: Gemini API
    if GEMINI_API_KEY:
        try:
            shop_context = get_shop_context(db)
            async with httpx.AsyncClient() as client:
                url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key={GEMINI_API_KEY}"
                prompt = (
                    "You are a helpful customer support chatbot for a phone repair shop called ServiceSync.\n"
                    "Keep your answers friendly and concise (1-2 sentences).\n"
                    "Language Rule: You must understand English, Sinhala, and Singlish (Sinhala typed in English letters). Always reply in the exact same language/style the user used.\n"
                    f"Context Data from our database:\n{shop_context}\n\n"
                    "Instructions: Use the Context Data to estimate prices if the user asks. If the specific device is not in the context, tell them to visit the shop for an accurate estimate.\n"
                    f"User: {message}"
                )
                payload = {
                    "contents": [{"parts": [{"text": prompt}]}]
                }
                response = await client.post(url, json=payload, timeout=30.0)
                if response.status_code == 200:
                    data = response.json()
                    ai_reply = data["candidates"][0]["content"]["parts"][0]["text"]
                    return {"reply": ai_reply.strip()}
                else:
                    return {"reply": "I'm having a little trouble understanding that right now. Can you try asking in a different way or providing your Job ID?"}
        except Exception as e:
            import traceback
            traceback.print_exc()
            print(f"GEMINI API EXCEPTION: {e}")
            return {"reply": "Sorry, our AI system is currently unavailable. Please ask a simple question or provide your Job ID."}
            
    # Default fallback if no AI key and no rules match
    return {"reply": "I am a simple chatbot. I didn't quite understand that. You can ask me about our location, opening hours, or provide a Job ID (SS-XXXXXXXX) to track your repair."}
