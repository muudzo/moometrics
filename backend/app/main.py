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
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from sqlalchemy import text
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse, Response

from app.config import get_settings
from app.database import SessionLocal
from app.models.db_models import User  # noqa: F401 — ensures model is registered
from app.models.db_models import Animal  # noqa: F401
from app.models.db_models import DeathRecord  # noqa: F401
from app.rate_limit import limiter
from app.routers import auth, animals, deaths, users, dashboard
from app.services.auth_service import hash_password

settings = get_settings()
logger = logging.getLogger(__name__)

_docs_enabled = not settings.is_production
app = FastAPI(
    title="MooMetrics API",
    description="Core animal record-keeping API with role-based access",
    version="1.0.0",
    docs_url="/docs" if _docs_enabled else None,
    redoc_url="/redoc" if _docs_enabled else None,
    openapi_url="/openapi.json" if _docs_enabled else None,
)

# Rate limiting (slowapi) — limits are applied per-route in the auth router
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)


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


# CORS — FRONTEND_URL may arrive as a bare host (e.g. wired from a Render
# service) or a full origin; normalize it to a scheme-qualified origin.
def _normalize_origin(value: str) -> str:
    value = value.strip().rstrip("/")
    if value.startswith("http://") or value.startswith("https://"):
        return value
    return f"https://{value}"


origins = [_normalize_origin(settings.frontend_url)]
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


def _seed_initial_admin() -> None:
    """Create the initial admin manager account if no users exist.

    In production the password comes from ADMIN_INITIAL_PASSWORD (config
    refuses to start if it is left at the default). The password is never
    logged in production.
    """
    db = SessionLocal()
    try:
        if db.query(User).count() == 0:
            admin = User(
                username=settings.admin_username,
                password_hash=hash_password(settings.admin_initial_password),
                role="manager",
            )
            db.add(admin)
            db.commit()
            if settings.is_production:
                logger.info(
                    "Initial admin '%s' created from ADMIN_INITIAL_PASSWORD",
                    settings.admin_username,
                )
            else:
                logger.info(
                    "Default manager account created: %s / %s",
                    settings.admin_username,
                    settings.admin_initial_password,
                )
    finally:
        db.close()


def _run_migrations() -> None:
    """Apply pending Alembic migrations. Fail fast on error.

    A failed migration means the schema is not what the code expects, so we
    let the exception abort startup rather than silently create_all() an
    unstamped schema (which permanently breaks future migrations).
    """
    alembic_cfg = AlembicConfig("alembic.ini")
    command.upgrade(alembic_cfg, "head")
    logger.info("Database migrations applied successfully")


@app.on_event("startup")
def startup() -> None:
    _run_migrations()
    _seed_initial_admin()


@app.get("/")
async def root():
    return {"message": "MooMetrics API", "version": "1.0.0"}


@app.get("/health")
async def health_check():
    """Readiness probe: verifies the database is reachable."""
    db = SessionLocal()
    try:
        db.execute(text("SELECT 1"))
    except Exception:
        logger.exception("Health check failed: database unreachable")
        return JSONResponse(
            status_code=503, content={"status": "unhealthy", "database": "down"}
        )
    finally:
        db.close()
    return {"status": "healthy"}
