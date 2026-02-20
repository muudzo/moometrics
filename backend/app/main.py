"""
Main FastAPI application entry point.
"""

import logging
import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

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

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_url, "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
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


@app.on_event("startup")
def startup() -> None:
    Base.metadata.create_all(bind=engine)
    _seed_default_manager()


@app.get("/")
async def root():
    return {"message": "MooMetrics API", "version": "1.0.0", "docs": "/docs"}


@app.get("/health")
async def health_check():
    return {"status": "healthy"}
