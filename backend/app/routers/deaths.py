"""
Deaths router: death report submission and retrieval (farm-scoped).
"""

from datetime import date
from typing import Optional

from fastapi import (
    APIRouter,
    Depends,
    File,
    Form,
    HTTPException,
    Query,
    Request,
    UploadFile,
    status,
)
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.db_models import Animal, DeathRecord, User, utcnow
from app.models.schemas import DeathRecordResponse, Page
from app.services.audit_service import record_audit
from app.services.auth_service import get_current_user
from app.services.image_service import image_hash_exists, process_death_image
from app.services.storage import get_storage_backend
from app.utils import csv_response

router = APIRouter(prefix="/api/deaths", tags=["deaths"])


def _to_response(record: DeathRecord) -> DeathRecordResponse:
    """Serialize a record, resolving the storage reference to a public URL."""
    resp = DeathRecordResponse.model_validate(record)
    resp.image_path = get_storage_backend().public_url(record.image_path)
    return resp


@router.get("", response_model=Page[DeathRecordResponse])
def list_deaths(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=200),
):
    """Return this farm's death reports (managers: all; employees: own)."""
    query = db.query(DeathRecord).filter(DeathRecord.farm_id == current_user.farm_id)
    if current_user.role != "manager":
        query = query.filter(DeathRecord.reported_by_user_id == current_user.id)
    total = query.count()
    records = (
        query.order_by(DeathRecord.created_at.desc())
        .offset((page - 1) * limit)
        .limit(limit)
        .all()
    )
    return Page(
        items=[_to_response(r) for r in records],
        total=total,
        page=page,
        limit=limit,
    )


@router.get("/check-hash")
def check_hash(
    hash: str = Query(..., min_length=64, max_length=64),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Report whether an image hash is already used in this farm.

    Lets the offline outbox warn a worker *before* they queue a duplicate.
    """
    return {"exists": image_hash_exists(db, current_user.farm_id, hash)}


@router.post(
    "", response_model=DeathRecordResponse, status_code=status.HTTP_201_CREATED
)
async def report_death(
    request: Request,
    animal_id: int = Form(...),
    cause_of_death: str = Form(...),
    date_of_death: date = Form(...),
    notes: Optional[str] = Form(None),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Submit a death report for an animal in the caller's farm.

    - The animal must currently be alive.
    - A photo is required and must not have been used in a previous report
      within this farm (SHA-256 hash check).
    - On success the animal status is set to 'dead'.
    """
    animal = (
        db.query(Animal)
        .filter(Animal.id == animal_id, Animal.farm_id == current_user.farm_id)
        .first()
    )
    if not animal:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Animal not found"
        )

    if animal.status != "alive":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Animal '{animal.name}' is already recorded as dead",
        )

    existing_record = (
        db.query(DeathRecord).filter(DeathRecord.animal_id == animal_id).first()
    )
    if existing_record:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A death record already exists for this animal",
        )

    # Validates file type/size and dedups within the farm; raises 409 on dup.
    image_ref, image_hash = await process_death_image(file, db, current_user.farm_id)

    record = DeathRecord(
        farm_id=current_user.farm_id,
        animal_id=animal_id,
        reported_by_user_id=current_user.id,
        cause_of_death=cause_of_death,
        date_of_death=date_of_death,
        image_path=image_ref,
        image_hash=image_hash,
        notes=notes,
    )
    db.add(record)

    animal.status = "dead"
    animal.updated_at = utcnow()

    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        # DB unique constraints (one record per animal, per-farm image hash)
        # are authoritative under concurrency. If a racing request beat us,
        # drop the object we just wrote and report 409.
        get_storage_backend().delete(image_ref)
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A death report for this animal or image already exists",
        )
    db.refresh(record)
    record_audit(
        db,
        request,
        current_user,
        action="create",
        entity_type="death_record",
        entity_id=record.id,
        details={"animal_id": animal_id, "cause_of_death": cause_of_death},
    )
    return _to_response(record)


@router.get("/export.csv")
def export_deaths_csv(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Download this farm's death reports as CSV (employees: own only)."""
    query = db.query(DeathRecord).filter(DeathRecord.farm_id == current_user.farm_id)
    if current_user.role != "manager":
        query = query.filter(DeathRecord.reported_by_user_id == current_user.id)
    records = query.order_by(DeathRecord.created_at.desc()).all()
    header = [
        "id",
        "animal_id",
        "reported_by_user_id",
        "cause_of_death",
        "date_of_death",
        "notes",
        "created_at",
    ]
    rows = (
        [
            r.id,
            r.animal_id,
            r.reported_by_user_id,
            r.cause_of_death,
            r.date_of_death,
            r.notes or "",
            r.created_at,
        ]
        for r in records
    )
    return csv_response("deaths.csv", header, rows)


@router.get("/{record_id}", response_model=DeathRecordResponse)
def get_death(
    record_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return a single death report. Employees can only view their own."""
    record = (
        db.query(DeathRecord)
        .filter(
            DeathRecord.id == record_id,
            DeathRecord.farm_id == current_user.farm_id,
        )
        .first()
    )
    if not record:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Death record not found"
        )

    if current_user.role != "manager" and record.reported_by_user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to view this record",
        )
    return _to_response(record)
