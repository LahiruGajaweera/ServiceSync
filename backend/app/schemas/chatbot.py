from pydantic import BaseModel
from typing import Optional, Dict, Any, List

class ChatMessage(BaseModel):
    role: str
    text: str

class ChatRequest(BaseModel):
    message: str
    history: List[ChatMessage] = []
    
class ChatResponse(BaseModel):
    reply: str
    job_data: Optional[Dict[str, Any]] = None
