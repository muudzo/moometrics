"""
Animals router: CRUD operations for animal records.
"""

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.db_models import Animal, User
from app.models.schemas import AnimalCreate, AnimalResponse, AnimalUpdate
from app.services.auth_service import get_current_user, require_manager
from app.utils import integrity_guard

_TAG_TAKEN = "Tag number is already assigned to another animal"

router = APIRouter(prefix="/api/animals", tags=["animals"])


@router.get("", response_model=list[AnimalResponse])
def list_animals(
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    """Return all animal records."""
    return db.query(Animal).order_by(Animal.created_at.desc()).all()


@router.post("", response_model=AnimalResponse, status_code=status.HTTP_201_CREATED)
def create_animal(
    body: AnimalCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create a new animal record."""
    if body.tag_number:
        existing = db.query(Animal).filter(Animal.tag_number == body.tag_number).first()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT, detail=_TAG_TAKEN
            )
    animal = Animal(
        name=body.name,
        animal_type=body.animal_type,
        tag_number=body.tag_number,
        breed=body.breed,
        date_of_birth=body.date_of_birth,
        notes=body.notes,
        added_by_user_id=current_user.id,
        status="alive",
    )
    db.add(animal)
    with integrity_guard(db, _TAG_TAKEN):
        db.commit()
    db.refresh(animal)
    return animal


@router.get("/{animal_id}", response_model=AnimalResponse)
def get_animal(
    animal_id: int,
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    """Return a single animal record."""
    animal = db.query(Animal).filter(Animal.id == animal_id).first()
    if not animal:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Animal not found"
        )
    return animal


@router.put("/{animal_id}", response_model=AnimalResponse)
def update_animal(
    animal_id: int,
    body: AnimalUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update an animal record.

    Both roles can update; only managers can force-set status.
    """
    animal = db.query(Animal).filter(Animal.id == animal_id).first()
    if not animal:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Animal not found"
        )

    if body.status == "dead" and current_user.role != "manager":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=(
                "Only managers can directly set status"
                " to 'dead'. Use the death report endpoint."
            ),
        )

    update_data = body.model_dump(exclude_unset=True)

    new_tag = update_data.get("tag_number")
    if new_tag:
        clash = (
            db.query(Animal)
            .filter(Animal.tag_number == new_tag, Animal.id != animal_id)
            .first()
        )
        if clash:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT, detail=_TAG_TAKEN
            )

    for field, value in update_data.items():
        setattr(animal, field, value)
    animal.updated_at = datetime.utcnow()

    with integrity_guard(db, _TAG_TAKEN):
        db.commit()
    db.refresh(animal)
    return animal


@router.delete("/{animal_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_animal(
    animal_id: int,
    db: Session = Depends(get_db),
    _manager: User = Depends(require_manager),
):
    """Delete an animal record. Manager access required."""
    animal = db.query(Animal).filter(Animal.id == animal_id).first()
    if not animal:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Animal not found"
        )
    db.delete(animal)
    db.commit()
