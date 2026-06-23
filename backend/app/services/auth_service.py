"""
Authentication service: password hashing, JWT + refresh-token lifecycle,
brute-force lockout helpers, and FastAPI dependencies.
"""

import hashlib
import logging
import secrets
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from passlib.context import CryptContext
from sqlalchemy.orm import Session

from app.config import get_settings
from app.database import get_db
from app.models.db_models import RefreshToken, User

settings = get_settings()
logger = logging.getLogger(__name__)

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")

# A real bcrypt hash used to equalize timing when a username does not exist,
# so login response time does not reveal whether an account is present.
_DUMMY_HASH = pwd_context.hash("timing-attack-mitigation-placeholder")


def hash_password(plain: str) -> str:
    return pwd_context.hash(plain)


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


def verify_password_timing_safe(plain: str, hashed: Optional[str]) -> bool:
    """Verify a password, always doing the bcrypt work to avoid user-enumeration.

    When ``hashed`` is ``None`` (no such user) we still hash against a dummy so
    the request takes the same time as a real verification, then return False.
    """
    if hashed is None:
        pwd_context.verify(plain, _DUMMY_HASH)
        return False
    return pwd_context.verify(plain, hashed)


def _now() -> datetime:
    return datetime.now(timezone.utc)


def create_access_token(data: dict) -> str:
    payload = data.copy()
    payload["exp"] = _now() + timedelta(minutes=settings.access_token_expire_minutes)
    payload["iss"] = settings.jwt_issuer
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


# --- Refresh tokens -------------------------------------------------------


def _hash_token(raw: str) -> str:
    return hashlib.sha256(raw.encode()).hexdigest()


def issue_refresh_token(db: Session, user: User) -> str:
    """Create and persist a refresh token; return the raw (only) copy."""
    raw = secrets.token_urlsafe(48)
    record = RefreshToken(
        user_id=user.id,
        token_hash=_hash_token(raw),
        expires_at=_now().replace(tzinfo=None)
        + timedelta(days=settings.refresh_token_expire_days),
    )
    db.add(record)
    db.commit()
    return raw


def resolve_refresh_token(db: Session, raw: str) -> Optional[User]:
    """Return the user for a valid, unrevoked, unexpired refresh token."""
    record = (
        db.query(RefreshToken)
        .filter(RefreshToken.token_hash == _hash_token(raw))
        .first()
    )
    if record is None or record.revoked:
        return None
    if record.expires_at < _now().replace(tzinfo=None):
        return None
    return db.query(User).filter(User.id == record.user_id).first()


def revoke_refresh_token(db: Session, raw: str) -> None:
    record = (
        db.query(RefreshToken)
        .filter(RefreshToken.token_hash == _hash_token(raw))
        .first()
    )
    if record is not None:
        record.revoked = True
        db.commit()


def revoke_all_refresh_tokens(db: Session, user_id: int) -> None:
    db.query(RefreshToken).filter(
        RefreshToken.user_id == user_id, RefreshToken.revoked.is_(False)
    ).update({RefreshToken.revoked: True})
    db.commit()


# --- Dependencies ---------------------------------------------------------


def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> User:
    credentials_exc = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(
            token,
            settings.jwt_secret,
            algorithms=[settings.jwt_algorithm],
            issuer=settings.jwt_issuer,
            options={"verify_aud": False},
        )
        user_id: Optional[str] = payload.get("sub")
        if user_id is None:
            raise credentials_exc
    except JWTError:
        raise credentials_exc

    user = db.query(User).filter(User.id == int(user_id)).first()
    if user is None:
        raise credentials_exc
    return user


def require_manager(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role != "manager":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Manager access required",
        )
    return current_user
