"""
Animals router: CRUD operations for animal records (farm-scoped).
"""

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.db_models import Animal, User, utcnow
from app.models.schemas import AnimalCreate, AnimalResponse, AnimalUpdate, Page
from app.services.audit_service import record_audit
from app.services.auth_service import get_current_user, require_manager
from app.utils import integrity_guard

_TAG_TAKEN = "Tag number is already assigned to another animal"

router = APIRouter(prefix="/api/animals", tags=["animals"])


def _get_owned_animal(db: Session, animal_id: int, user: User) -> Animal:
    """Fetch an animal within the caller's farm or raise 404."""
    animal = (
        db.query(Animal)
        .filter(Animal.id == animal_id, Animal.farm_id == user.farm_id)
        .first()
    )
    if not animal:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Animal not found"
        )
    return animal


@router.get("", response_model=Page[AnimalResponse])
def list_animals(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=200),
):
    """Return this farm's animal records, most recent first (paginated)."""
    base = db.query(Animal).filter(Animal.farm_id == current_user.farm_id)
    total = base.count()
    items = (
        base.order_by(Animal.created_at.desc())
        .offset((page - 1) * limit)
        .limit(limit)
        .all()
    )
    return Page(items=items, total=total, page=page, limit=limit)


@router.post("", response_model=AnimalResponse, status_code=status.HTTP_201_CREATED)
def create_animal(
    request: Request,
    body: AnimalCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create a new animal record in the caller's farm."""
    if body.tag_number:
        existing = (
            db.query(Animal)
            .filter(
                Animal.farm_id == current_user.farm_id,
                Animal.tag_number == body.tag_number,
            )
            .first()
        )
        if existing:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=_TAG_TAKEN)
    animal = Animal(
        farm_id=current_user.farm_id,
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
    record_audit(
        db,
        request,
        current_user,
        action="create",
        entity_type="animal",
        entity_id=animal.id,
        details={"name": animal.name, "tag_number": animal.tag_number},
    )
    return animal


@router.get("/{animal_id}", response_model=AnimalResponse)
def get_animal(
    animal_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return a single animal record from the caller's farm."""
    return _get_owned_animal(db, animal_id, current_user)


@router.put("/{animal_id}", response_model=AnimalResponse)
def update_animal(
    request: Request,
    animal_id: int,
    body: AnimalUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update an animal record.

    Both roles can update; only managers can force-set status.
    """
    animal = _get_owned_animal(db, animal_id, current_user)

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
            .filter(
                Animal.farm_id == current_user.farm_id,
                Animal.tag_number == new_tag,
                Animal.id != animal_id,
            )
            .first()
        )
        if clash:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=_TAG_TAKEN)

    for field, value in update_data.items():
        setattr(animal, field, value)
    animal.updated_at = utcnow()

    with integrity_guard(db, _TAG_TAKEN):
        db.commit()
    db.refresh(animal)
    record_audit(
        db,
        request,
        current_user,
        action="update",
        entity_type="animal",
        entity_id=animal.id,
        details=update_data,
    )
    return animal


@router.delete("/{animal_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_animal(
    request: Request,
    animal_id: int,
    db: Session = Depends(get_db),
    current_manager: User = Depends(require_manager),
):
    """Delete an animal record. Manager access required."""
    animal = _get_owned_animal(db, animal_id, current_manager)
    db.delete(animal)
    db.commit()
    record_audit(
        db,
        request,
        current_manager,
        action="delete",
        entity_type="animal",
        entity_id=animal_id,
    )
