import os
import re
import google.generativeai as genai
from sqlalchemy.orm import Session
from app.models.job import Job
from app.models.inventory import InventoryItem
from sqlalchemy import or_
from typing import List
from app.schemas.chatbot import ChatMessage

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

if GEMINI_API_KEY:
    genai.configure(api_key=GEMINI_API_KEY)

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

def get_job_status(job_id: str) -> str:
    """Gets the status, estimated cost, and details of a phone repair job by its Job ID (e.g. SS-12345678)."""
    # Note: We will inject db_session inside process_chat_message because tools can't have Session type easily.
    pass

def check_part_availability(brand: str, model_name: str) -> str:
    """Checks if there are any spare parts available in stock for a given phone brand and model."""
    pass

async def process_chat_message(message: str, history: List[ChatMessage], db: Session) -> dict:
    message = message.strip()
    
    # 1. Rule-based Job Tracking (for returning UI job_data widget if it's a direct ID match)
    # This remains useful so the frontend can render the nice UI card if an ID is directly typed.
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

    # 2. AI Agent with History and Function Calling
    if GEMINI_API_KEY:
        try:
            shop_context = get_shop_context(db)
            
            formatted_history = []
            for h in history:
                formatted_history.append({"role": h.role, "parts": [h.text]})
            
            shop_info = (
                "Shop Name: ServiceSync\n"
                "Address: No. 54, Galle Road, Colombo 03\n"
                "Opening Hours: Monday to Saturday 9:00 AM - 6:00 PM\n"
                "Contact: 011-2345678\n"
                "Warranty Policy: 3 months warranty for display and battery replacements. No warranty for water damage repairs."
            )
            
            system_instruction = (
                "You are a helpful customer support chatbot for a phone repair shop called ServiceSync.\n"
                "Keep your answers friendly and concise (1-2 sentences).\n"
                "Language Rule: You must understand English, Sinhala, and Singlish (Sinhala typed in English letters). Always reply in the exact same language/style the user used.\n"
                f"Shop Details:\n{shop_info}\n\n"
                f"Context Data from our database (Recent avg prices):\n{shop_context}\n\n"
                "Instructions:\n"
                "- If asked about shop details, opening hours, or warranty, use the Shop Details above.\n"
                "- If asked about prices (e.g., 'How much to repair?'), ONLY use the Context Data (Recent avg prices) to give an average cost. Never give individual part prices. If the specific device is not in the context, tell them to visit the shop for an accurate estimate.\n"
                "- If the user asks about part availability or stock (e.g., 'Do you have an iPhone 13 display?'), ALWAYS use the check_part_availability tool to check if it's available. Tell them if it's available, but DO NOT mention the price of the part.\n"
                "- If the user asks about their repair status, ALWAYS use the get_job_status tool. Ask them for their Job ID (format SS-XXXXXXXX) if they haven't provided it.\n"
                "- Never invent prices or stock. If you don't know, tell them to contact the shop or visit us.\n\n"
                "Examples:\n"
                "User: kade koheda thiyenne?\n"
                "Bot: අපේ කඩේ තියෙන්නේ No. 54, Galle Road, Colombo 03 වල. සෙනසුරාදා වෙනකන් උදේ 9 ඉඳන් හවස 6 වෙනකන් ඇරලා තියෙනවා.\n"
                "User: display dapu ewata warranty denawada?\n"
                "Bot: ඔව්, display සහ battery දාන ඒවට මාස 3ක වගකීමක් (warranty) අපි දෙනවා. හැබැයි වතුර ගිය ෆෝන් වලට වගකීමක් දෙන්නේ නෑ."
            )
            
            model = genai.GenerativeModel(
                model_name="gemini-3.5-flash",
                system_instruction=system_instruction,
                tools=[get_job_status, check_part_availability]
            )
            
            chat = model.start_chat(history=formatted_history)
            response = chat.send_message(message)
            
            # Check if Gemini requested to call a function
            if response.parts:
                for part in response.parts:
                    if function_call := getattr(part, "function_call", None):
                        if function_call.name == "get_job_status":
                            args = dict(function_call.args)
                            req_job_id = args.get("job_id")
                            
                            # Execute local DB logic
                            api_response = ""
                            job = db.query(Job).filter(Job.job_id.ilike(req_job_id)).first()
                            if job:
                                cost = f"LKR {job.estimated_cost}" if job.estimated_cost else "Not estimated yet"
                                status_clean = job.status.replace("_", " ").title()
                                api_response = f"Job ID: {job.job_id}, Device: {job.device_brand} {job.device_model}, Issue: {job.fault_category}, Status: {status_clean}, Estimated Cost: {cost}"
                            else:
                                api_response = f"Could not find any repair job with ID {req_job_id}."
                            
                            # Send function result back to Gemini
                            response = chat.send_message(
                                genai.protos.Part(
                                    function_response=genai.protos.FunctionResponse(
                                        name="get_job_status",
                                        response={"result": api_response}
                                    )
                                )
                            )
                        elif function_call.name == "check_part_availability":
                            args = dict(function_call.args)
                            brand = args.get("brand", "")
                            model_name = args.get("model_name", "")
                            
                            # Search inventory based on item name and quantity > 0
                            search_term = f"%{model_name}%" if model_name else f"%{brand}%"
                            parts = db.query(InventoryItem).filter(
                                InventoryItem.quantity > 0,
                                InventoryItem.name.ilike(search_term)
                            ).limit(5).all()
                            
                            if parts:
                                found_parts = [f"{p.name} (Qty: {p.quantity})" for p in parts]
                                api_response = "Found parts in stock:\n" + "\n".join(found_parts)
                            else:
                                api_response = f"No spare parts found in stock matching '{brand} {model_name}'."
                                
                            response = chat.send_message(
                                genai.protos.Part(
                                    function_response=genai.protos.FunctionResponse(
                                        name="check_part_availability",
                                        response={"result": api_response}
                                    )
                                )
                            )
            
            return {"reply": response.text.strip()}
            
        except Exception as e:
            import traceback
            traceback.print_exc()
            print(f"GEMINI API EXCEPTION: {e}")
            return {"reply": "Sorry, our AI system is currently unavailable. Please ask a simple question or provide your Job ID."}
            
    # Default fallback if no AI key and no rules match
    return {"reply": "I am a simple chatbot. I didn't quite understand that. You can ask me about our location, opening hours, or provide a Job ID (SS-XXXXXXXX) to track your repair."}
