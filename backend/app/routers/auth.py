"""
Authentication router: login, self-serve signup, registration, token refresh,
logout, and password change.

Access tokens are short-lived and returned in the body; the refresh token is a
revocable, server-side token delivered as an httpOnly cookie so it is never
exposed to JavaScript (XSS-resistant).
"""

from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Cookie, Depends, HTTPException, Request, Response, status
from sqlalchemy.orm import Session

from app.config import get_settings
from app.database import get_db
from app.models.db_models import Farm, User
from app.models.schemas import (
    LoginRequest,
    PasswordChangeRequest,
    SignupRequest,
    TokenResponse,
    UserCreate,
    UserResponse,
)
from app.rate_limit import limiter
from app.services.audit_service import record_audit
from app.services.auth_service import (
    create_access_token,
    get_current_user,
    hash_password,
    issue_refresh_token,
    resolve_refresh_token,
    revoke_all_refresh_tokens,
    revoke_refresh_token,
    require_manager,
    verify_password,
    verify_password_timing_safe,
)
from app.utils import integrity_guard

settings = get_settings()
router = APIRouter(prefix="/api/auth", tags=["auth"])

_USERNAME_TAKEN = "Username is already taken"
_INVALID_CREDENTIALS = "Invalid username or password"


def _set_refresh_cookie(response: Response, raw: str) -> None:
    response.set_cookie(
        key=settings.refresh_cookie_name,
        value=raw,
        httponly=True,
        secure=settings.is_production,
        samesite="none" if settings.is_production else "lax",
        max_age=settings.refresh_token_expire_days * 86400,
        path="/api/auth",
    )


def _clear_refresh_cookie(response: Response) -> None:
    response.delete_cookie(settings.refresh_cookie_name, path="/api/auth")


def _issue_session(
    db: Session, response: Response, user: User, farm_name: str
) -> TokenResponse:
    raw_refresh = issue_refresh_token(db, user)
    _set_refresh_cookie(response, raw_refresh)
    token = create_access_token(
        {"sub": str(user.id), "role": user.role, "farm_id": user.farm_id}
    )
    return TokenResponse(
        access_token=token,
        role=user.role,
        user_id=user.id,
        username=user.username,
        farm_id=user.farm_id,
        farm_name=farm_name,
    )


def _now_naive() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


@router.post("/login", response_model=TokenResponse)
@limiter.limit("5/minute")
def login(
    request: Request,
    response: Response,
    credentials: LoginRequest,
    db: Session = Depends(get_db),
):
    """Authenticate a user and start a session (access token + refresh cookie)."""
    user = db.query(User).filter(User.username == credentials.username).first()

    if user and user.locked_until and user.locked_until > _now_naive():
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account temporarily locked due to failed logins. Try again later.",
        )

    password_ok = verify_password_timing_safe(
        credentials.password, user.password_hash if user else None
    )
    if not user or not password_ok:
        if user:
            user.failed_login_attempts += 1
            if user.failed_login_attempts >= settings.max_failed_logins:
                user.locked_until = _now_naive() + timedelta(
                    minutes=settings.lockout_minutes
                )
                user.failed_login_attempts = 0
                db.commit()
                record_audit(
                    db,
                    request,
                    user,
                    action="account_locked",
                    entity_type="user",
                    entity_id=user.id,
                )
            else:
                db.commit()
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail=_INVALID_CREDENTIALS
        )

    # Success — reset lockout counters.
    if user.failed_login_attempts or user.locked_until:
        user.failed_login_attempts = 0
        user.locked_until = None
        db.commit()

    token = _issue_session(db, response, user, user.farm.name)
    record_audit(
        db, request, user, action="login", entity_type="user", entity_id=user.id
    )
    return token


@router.post(
    "/signup", response_model=TokenResponse, status_code=status.HTTP_201_CREATED
)
@limiter.limit("5/minute")
def signup(
    request: Request,
    response: Response,
    payload: SignupRequest,
    db: Session = Depends(get_db),
):
    """Self-serve onboarding: create a new farm with the signer as its manager."""
    existing = db.query(User).filter(User.username == payload.username).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail=_USERNAME_TAKEN
        )
    farm = Farm(name=payload.farm_name or f"{payload.username}'s Farm")
    db.add(farm)
    db.flush()
    new_user = User(
        username=payload.username,
        password_hash=hash_password(payload.password),
        role="manager",
        farm_id=farm.id,
    )
    db.add(new_user)
    with integrity_guard(db, _USERNAME_TAKEN):
        db.commit()
    db.refresh(new_user)
    return _issue_session(db, response, new_user, farm.name)


@router.post("/refresh", response_model=TokenResponse)
def refresh(
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
    moometrics_refresh: str | None = Cookie(default=None),
):
    """Exchange a valid refresh cookie for a fresh access token (rotating the
    refresh token)."""
    raw = moometrics_refresh
    user = resolve_refresh_token(db, raw) if raw else None
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired session. Please sign in again.",
        )
    # Rotate: revoke the presented token, issue a new one.
    revoke_refresh_token(db, raw)
    return _issue_session(db, response, user, user.farm.name)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(
    response: Response,
    db: Session = Depends(get_db),
    moometrics_refresh: str | None = Cookie(default=None),
):
    """Revoke the current refresh token and clear the cookie."""
    if moometrics_refresh:
        revoke_refresh_token(db, moometrics_refresh)
    _clear_refresh_cookie(response)


@router.put("/password", status_code=status.HTTP_204_NO_CONTENT)
def change_password(
    request: Request,
    payload: PasswordChangeRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Change the current user's password and revoke all their refresh tokens."""
    if not verify_password(payload.current_password, current_user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is incorrect",
        )
    current_user.password_hash = hash_password(payload.new_password)
    db.commit()
    revoke_all_refresh_tokens(db, current_user.id)
    record_audit(
        db,
        request,
        current_user,
        action="password_change",
        entity_type="user",
        entity_id=current_user.id,
    )


@router.post(
    "/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED
)
def register(
    request: Request,
    body: UserCreate,
    db: Session = Depends(get_db),
    manager: User = Depends(require_manager),
):
    """Create a new user account inside the manager's farm. Manager only."""
    existing = db.query(User).filter(User.username == body.username).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail=_USERNAME_TAKEN
        )
    new_user = User(
        username=body.username,
        password_hash=hash_password(body.password),
        role=body.role,
        farm_id=manager.farm_id,
    )
    db.add(new_user)
    with integrity_guard(db, _USERNAME_TAKEN):
        db.commit()
    db.refresh(new_user)
    record_audit(
        db,
        request,
        manager,
        action="create",
        entity_type="user",
        entity_id=new_user.id,
        details={"username": new_user.username, "role": new_user.role},
    )
    return new_user
