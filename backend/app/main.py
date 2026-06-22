"""
Main FastAPI application entry point.

The app is built by :func:`create_app` so tests can construct an isolated
instance with overridden dependencies. ``app = create_app()`` at module scope
keeps the ASGI entrypoint ``app.main:app`` working for uvicorn / Render.
"""

import logging
import os
from contextlib import asynccontextmanager

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

from app.config import Settings, get_settings
from app.database import SessionLocal
from app.observability import install_observability
from app.models.db_models import Animal  # noqa: F401 — registers model
from app.models.db_models import DeathRecord  # noqa: F401
from app.models.db_models import User
from app.rate_limit import limiter
from app.routers import animals, audit, auth, dashboard, deaths, users
from app.services.auth_service import hash_password

logger = logging.getLogger(__name__)


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """Attach baseline security headers to every response."""

    def __init__(self, app, *, is_production: bool) -> None:
        super().__init__(app)
        self._is_production = is_production

    async def dispatch(self, request: Request, call_next):  # type: ignore[override]
        response: Response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        if self._is_production:
            response.headers["Strict-Transport-Security"] = (
                "max-age=63072000; includeSubDomains"
            )
        return response


def _normalize_origin(value: str) -> str:
    """Normalize a CORS origin to a scheme-qualified form.

    ``FRONTEND_URL`` may arrive as a bare host (e.g. wired from a Render
    service) or as a full origin.
    """
    value = value.strip().rstrip("/")
    if value.startswith("http://") or value.startswith("https://"):
        return value
    return f"https://{value}"


def _cors_origins(settings: Settings) -> list[str]:
    origins = [_normalize_origin(settings.frontend_url)]
    if settings.is_development:
        origins.append("http://localhost:3000")
    return origins


def _run_migrations() -> None:
    """Apply pending Alembic migrations. Fail fast on error.

    A failed migration means the schema is not what the code expects, so we
    let the exception abort startup rather than silently create_all() an
    unstamped schema (which permanently breaks future migrations).
    """
    alembic_cfg = AlembicConfig("alembic.ini")
    command.upgrade(alembic_cfg, "head")
    logger.info("Database migrations applied successfully")


def _seed_initial_admin(settings: Settings) -> None:
    """Create the initial admin manager (and its farm) if no users exist.

    In production the password comes from ADMIN_INITIAL_PASSWORD (config
    refuses to start if it is left at the default). The password is never
    logged in production.
    """
    from app.models.db_models import Farm

    db = SessionLocal()
    try:
        if db.query(User).count() == 0:
            farm = Farm(name=settings.default_farm_name)
            db.add(farm)
            db.flush()
            admin = User(
                username=settings.admin_username,
                password_hash=hash_password(settings.admin_initial_password),
                role="manager",
                farm_id=farm.id,
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


def create_app(settings: Settings | None = None) -> FastAPI:
    """Construct and configure the FastAPI application."""
    settings = settings or get_settings()
    docs_enabled = not settings.is_production

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        if settings.run_db_migrations:
            _run_migrations()
            _seed_initial_admin(settings)
        yield

    app = FastAPI(
        title="MooMetrics API",
        description="Multi-tenant animal record-keeping API with role-based access",
        version="2.0.0",
        docs_url="/docs" if docs_enabled else None,
        redoc_url="/redoc" if docs_enabled else None,
        openapi_url="/openapi.json" if docs_enabled else None,
        lifespan=lifespan,
    )

    # Structured logging, request-id propagation, optional Sentry.
    install_observability(app, settings)

    # Rate limiting (slowapi) — limits are applied per-route in the routers.
    app.state.limiter = limiter
    app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

    app.add_middleware(SecurityHeadersMiddleware, is_production=settings.is_production)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=_cors_origins(settings),
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "DELETE"],
        allow_headers=["Content-Type", "Authorization"],
        max_age=3600,
    )

    app.include_router(auth.router)
    app.include_router(animals.router)
    app.include_router(deaths.router)
    app.include_router(users.router)
    app.include_router(dashboard.router)
    app.include_router(audit.router)

    # Serve uploaded death images as static files (local storage backend only;
    # S3/R2 serves objects from its own public/presigned URLs).
    if settings.storage_backend == "local":
        os.makedirs(settings.upload_dir, exist_ok=True)
        os.makedirs("uploads", exist_ok=True)
        app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

    @app.get("/")
    async def root():
        return {"message": "MooMetrics API", "version": app.version}

    @app.get("/health")
    async def health_check():
        """Readiness probe: verifies the database is reachable."""
        db = SessionLocal()
        try:
            db.execute(text("SELECT 1"))
        except Exception:
            logger.exception("Health check failed: database unreachable")
            return JSONResponse(
                status_code=503,
                content={"status": "unhealthy", "database": "down"},
            )
        finally:
            db.close()
        return {"status": "healthy"}

    return app


app = create_app()
