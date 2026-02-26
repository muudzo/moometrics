"""
Deaths router: death report submission and retrieval.
"""

from datetime import date, datetime
from typing import Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.db_models import Animal, DeathRecord, User
from app.models.schemas import DeathRecordResponse
from app.services.auth_service import get_current_user
from app.services.image_service import process_death_image

router = APIRouter(prefix="/api/deaths", tags=["deaths"])


@router.get("", response_model=list[DeathRecordResponse])
def list_deaths(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Return death reports.
    Managers see all reports; employees see only their own.
    """
    query = db.query(DeathRecord)
    if current_user.role != "manager":
        query = query.filter(DeathRecord.reported_by_user_id == current_user.id)
    return query.order_by(DeathRecord.created_at.desc()).all()


@router.post("", response_model=DeathRecordResponse, status_code=status.HTTP_201_CREATED)
async def report_death(
    animal_id: int = Form(...),
    cause_of_death: str = Form(...),
    date_of_death: date = Form(...),
    notes: Optional[str] = Form(None),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Submit a death report for an animal.

    - The animal must currently be alive.
    - A photo is required and must not have been used in a previous report (SHA-256 hash check).
    - On success the animal status is set to 'dead'.
    """
    animal = db.query(Animal).filter(Animal.id == animal_id).first()
    if not animal:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Animal not found")

    if animal.status != "alive":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Animal '{animal.name}' is already recorded as dead",
        )

    existing_record = db.query(DeathRecord).filter(DeathRecord.animal_id == animal_id).first()
    if existing_record:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A death record already exists for this animal",
        )

    # Validates file type/size and checks for duplicate hash; raises 409 on duplicate
    image_path, image_hash = await process_death_image(file, db)

    record = DeathRecord(
        animal_id=animal_id,
        reported_by_user_id=current_user.id,
        cause_of_death=cause_of_death,
        date_of_death=date_of_death,
        image_path=image_path,
        image_hash=image_hash,
        notes=notes,
    )
    db.add(record)

    animal.status = "dead"
    animal.updated_at = datetime.utcnow()

    db.commit()
    db.refresh(record)
    return record


@router.get("/{record_id}", response_model=DeathRecordResponse)
def get_death(
    record_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return a single death report. Employees can only view their own."""
    record = db.query(DeathRecord).filter(DeathRecord.id == record_id).first()
    if not record:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Death record not found")

    if current_user.role != "manager" and record.reported_by_user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to view this record",
        )
    return record
