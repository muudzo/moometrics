"""
Authentication router: login and user registration.
"""

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.db_models import User
from app.models.schemas import (
    LoginRequest,
    SignupRequest,
    TokenResponse,
    UserCreate,
    UserResponse,
)
from app.rate_limit import limiter
from app.services.auth_service import (
    create_access_token,
    hash_password,
    require_manager,
    verify_password,
)
from app.utils import integrity_guard

router = APIRouter(prefix="/api/auth", tags=["auth"])

_USERNAME_TAKEN = "Username is already taken"


@router.post("/login", response_model=TokenResponse)
@limiter.limit("5/minute")
def login(request: Request, credentials: LoginRequest, db: Session = Depends(get_db)):
    """Authenticate a user and return a JWT access token."""
    user = db.query(User).filter(User.username == credentials.username).first()
    if not user or not verify_password(credentials.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password",
        )
    token = create_access_token({"sub": str(user.id), "role": user.role})
    return TokenResponse(
        access_token=token,
        role=user.role,
        user_id=user.id,
        username=user.username,
    )


@router.post(
    "/signup", response_model=TokenResponse, status_code=status.HTTP_201_CREATED
)
@limiter.limit("5/minute")
def signup(request: Request, payload: SignupRequest, db: Session = Depends(get_db)):
    """Public self-registration. Always creates an employee account."""
    existing = db.query(User).filter(User.username == payload.username).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail=_USERNAME_TAKEN
        )
    new_user = User(
        username=payload.username,
        password_hash=hash_password(payload.password),
        role="employee",
    )
    db.add(new_user)
    with integrity_guard(db, _USERNAME_TAKEN):
        db.commit()
    db.refresh(new_user)
    token = create_access_token({"sub": str(new_user.id), "role": new_user.role})
    return TokenResponse(
        access_token=token,
        role=new_user.role,
        user_id=new_user.id,
        username=new_user.username,
    )


@router.post(
    "/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED
)
def register(
    request: UserCreate,
    db: Session = Depends(get_db),
    _manager: User = Depends(require_manager),
):
    """Create a new user account. Manager access required."""
    existing = db.query(User).filter(User.username == request.username).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail=_USERNAME_TAKEN
        )
    new_user = User(
        username=request.username,
        password_hash=hash_password(request.password),
        role=request.role,
    )
    db.add(new_user)
    with integrity_guard(db, _USERNAME_TAKEN):
        db.commit()
    db.refresh(new_user)
    return new_user
