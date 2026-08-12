from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.schemas.chatbot import ChatRequest, ChatResponse
from app.services.chatbot_service import process_chat_message

router = APIRouter(prefix="/chatbot", tags=["chatbot"])

@router.post("/message", response_model=ChatResponse)
async def send_message(request: ChatRequest, db: Session = Depends(get_db)):
    try:
        result = await process_chat_message(request.message, request.history, db)
        return ChatResponse(reply=result["reply"], job_data=result.get("job_data"))
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"An error occurred while processing the chat message: {str(e)}"
        )
