"""
Users router: user management within the manager's farm (manager only).
"""

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.db_models import User
from app.models.schemas import UserResponse
from app.services.audit_service import record_audit
from app.services.auth_service import require_manager

router = APIRouter(prefix="/api/users", tags=["users"])


@router.get("", response_model=list[UserResponse])
def list_users(
    db: Session = Depends(get_db),
    manager: User = Depends(require_manager),
):
    """Return user accounts in the manager's farm. Manager access required."""
    return (
        db.query(User)
        .filter(User.farm_id == manager.farm_id)
        .order_by(User.created_at.asc())
        .all()
    )


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_user(
    user_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_manager: User = Depends(require_manager),
):
    """Delete a user account in the manager's farm.

    Manager access required. Cannot delete your own account.
    """
    if user_id == current_manager.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You cannot delete your own account",
        )
    user = (
        db.query(User)
        .filter(User.id == user_id, User.farm_id == current_manager.farm_id)
        .first()
    )
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="User not found"
        )
    db.delete(user)
    db.commit()
    record_audit(
        db,
        request,
        current_manager,
        action="delete",
        entity_type="user",
        entity_id=user_id,
    )
