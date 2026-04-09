"""
Main FastAPI application entry point.
"""

import logging
import os

from alembic import command
from alembic.config import Config as AlembicConfig
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import Response

from app.config import get_settings
from app.database import Base, SessionLocal, engine
from app.models.db_models import User  # noqa: F401 — ensures model is registered
from app.models.db_models import Animal  # noqa: F401
from app.models.db_models import DeathRecord  # noqa: F401
from app.routers import auth, animals, deaths, users, dashboard
from app.services.auth_service import hash_password

settings = get_settings()
logger = logging.getLogger(__name__)

app = FastAPI(
    title="MooMetrics API",
    description="Core animal record-keeping API with role-based access",
    version="1.0.0",
)


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):  # type: ignore[override]
        response: Response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        if settings.is_production:
            response.headers["Strict-Transport-Security"] = (
                "max-age=63072000; includeSubDomains"
            )
        return response


app.add_middleware(SecurityHeadersMiddleware)

# CORS
origins = [settings.frontend_url]
if settings.is_development:
    origins.append("http://localhost:3000")

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["Content-Type", "Authorization"],
    max_age=3600,
)

# Routers
app.include_router(auth.router)
app.include_router(animals.router)
app.include_router(deaths.router)
app.include_router(users.router)
app.include_router(dashboard.router)

# Serve uploaded death images as static files
os.makedirs(settings.upload_dir, exist_ok=True)
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")


def _seed_default_manager() -> None:
    """Create the default admin manager account if no users exist."""
    db = SessionLocal()
    try:
        if db.query(User).count() == 0:
            admin = User(
                username="admin",
                password_hash=hash_password("admin123"),
                role="manager",
            )
            db.add(admin)
            db.commit()
            logger.info("Default manager account created: admin / admin123")
    finally:
        db.close()


def _run_migrations() -> None:
    """Apply any pending Alembic migrations."""
    try:
        alembic_cfg = AlembicConfig("alembic.ini")
        command.upgrade(alembic_cfg, "head")
        logger.info("Database migrations applied successfully")
    except Exception:
        logger.warning("Alembic migrations failed, falling back to create_all")
        Base.metadata.create_all(bind=engine)


@app.on_event("startup")
def startup() -> None:
    _run_migrations()
    _seed_default_manager()


@app.get("/")
async def root():
    return {"message": "MooMetrics API", "version": "1.0.0", "docs": "/docs"}


@app.get("/health")
async def health_check():
    return {"status": "healthy"}
