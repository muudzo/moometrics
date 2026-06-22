"""
Authentication router: login, self-serve signup, and user registration.
"""

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.db_models import Farm, User
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


def _token_for(user: User, farm_name: str) -> TokenResponse:
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
    return _token_for(user, user.farm.name)


@router.post(
    "/signup", response_model=TokenResponse, status_code=status.HTTP_201_CREATED
)
@limiter.limit("5/minute")
def signup(request: Request, payload: SignupRequest, db: Session = Depends(get_db)):
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
    return _token_for(new_user, farm.name)


@router.post(
    "/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED
)
def register(
    request: UserCreate,
    db: Session = Depends(get_db),
    manager: User = Depends(require_manager),
):
    """Create a new user account inside the manager's farm. Manager only."""
    existing = db.query(User).filter(User.username == request.username).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail=_USERNAME_TAKEN
        )
    new_user = User(
        username=request.username,
        password_hash=hash_password(request.password),
        role=request.role,
        farm_id=manager.farm_id,
    )
    db.add(new_user)
    with integrity_guard(db, _USERNAME_TAKEN):
        db.commit()
    db.refresh(new_user)
    return new_user
