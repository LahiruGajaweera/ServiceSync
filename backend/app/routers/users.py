from typing import List

from fastapi import APIRouter, Depends, UploadFile, File, HTTPException
from sqlalchemy.orm import Session
import os
import uuid
import shutil

from app.core.database import get_db
from app.core.deps import require_admin, get_current_user
from app.models.user import User
from app.schemas.user import UserCreate, UserResponse
from app.services import auth_service

router = APIRouter(prefix="/users", tags=["Users"])


@router.post("/", response_model=UserResponse, status_code=201)
def create_user(
    data: UserCreate,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    return auth_service.create_user(data, db)


@router.get("/", response_model=List[UserResponse])
def list_users(
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    return db.query(User).filter(User.is_active.is_(True)).all()


@router.get("/me/performance")
def get_my_performance(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    from app.services.predictive_service import calculate_technician_scores
    scores = calculate_technician_scores(db)
    for s in scores:
        if s["technician_id"] == str(current_user.id):
            return s
    
    # Fallback if no jobs completed or no score yet
    return {
        "technician_id": str(current_user.id),
        "name": current_user.name,
        "total_jobs_completed": 0,
        "performance_score": 0,
        "rating": "N/A"
    }


@router.post("/me/avatar", response_model=UserResponse)
def upload_avatar(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File must be an image")

    ext = os.path.splitext(file.filename)[1]
    filename = f"{current_user.id}_{uuid.uuid4().hex[:8]}{ext}"
    filepath = os.path.join("uploads", "avatars", filename)

    os.makedirs(os.path.dirname(filepath), exist_ok=True)
    with open(filepath, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    current_user.avatar_url = f"/uploads/avatars/{filename}"
    db.commit()
    db.refresh(current_user)

    return current_user
