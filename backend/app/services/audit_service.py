"""
Audit service: append-only record of mutating actions for dispute resolution.

Auditing must never break the user-facing action, so :func:`record_audit`
swallows and logs its own errors after rolling back only its own unit of work.
"""

import json
import logging
from typing import Optional

from fastapi import Request
from sqlalchemy.orm import Session

from app.models.db_models import AuditLog, User

logger = logging.getLogger(__name__)


def _client_ip(request: Optional[Request]) -> Optional[str]:
    if request is None:
        return None
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        # First hop is the original client.
        return forwarded.split(",")[0].strip()[:64]
    if request.client:
        return request.client.host
    return None


def _json_safe(details: Optional[dict]) -> Optional[dict]:
    """Coerce arbitrary values (dates, Decimals…) into JSON-serializable form."""
    if details is None:
        return None
    return json.loads(json.dumps(details, default=str))


def record_audit(
    db: Session,
    request: Optional[Request],
    actor: Optional[User],
    *,
    action: str,
    entity_type: str,
    entity_id: Optional[int] = None,
    farm_id: Optional[int] = None,
    details: Optional[dict] = None,
) -> None:
    """Persist a single audit entry. Best-effort: never raises."""
    resolved_farm = (
        farm_id if farm_id is not None else (actor.farm_id if actor else None)
    )
    if resolved_farm is None:
        logger.warning(
            "Skipping audit '%s' on %s: no farm context", action, entity_type
        )
        return
    try:
        entry = AuditLog(
            farm_id=resolved_farm,
            actor_user_id=actor.id if actor else None,
            actor_username=actor.username if actor else None,
            action=action,
            entity_type=entity_type,
            entity_id=entity_id,
            details=_json_safe(details),
            ip=_client_ip(request),
        )
        db.add(entry)
        db.commit()
    except Exception:  # pragma: no cover - defensive
        logger.exception("Failed to write audit log for %s/%s", entity_type, action)
        db.rollback()
