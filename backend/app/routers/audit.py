"""
Audit router: read-only access to the farm's audit trail (manager only).
"""

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.db_models import AuditLog, User
from app.models.schemas import AuditLogResponse, Page
from app.services.auth_service import require_manager

router = APIRouter(prefix="/api/audit", tags=["audit"])


@router.get("", response_model=Page[AuditLogResponse])
def list_audit(
    db: Session = Depends(get_db),
    manager: User = Depends(require_manager),
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=200),
):
    """Return this farm's audit log, most recent first (paginated)."""
    base = db.query(AuditLog).filter(AuditLog.farm_id == manager.farm_id)
    total = base.count()
    items = (
        base.order_by(AuditLog.created_at.desc())
        .offset((page - 1) * limit)
        .limit(limit)
        .all()
    )
    return Page(items=items, total=total, page=page, limit=limit)
