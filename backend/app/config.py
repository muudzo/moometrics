"""
Configuration management for the backend API.
"""

from functools import lru_cache
from typing import Literal
from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    model_config = SettingsConfigDict(
        env_file=".env", case_sensitive=False, extra="ignore"
    )

    # Environment
    environment: Literal["development", "staging", "production"] = Field(
        default="development", description="Application environment"
    )

    # Startup behaviour — disabled in tests so they can manage their own schema.
    run_db_migrations: bool = Field(
        default=True, description="Run Alembic migrations on application startup"
    )

    # Server
    backend_port: int = Field(default=8000, description="Backend server port")
    frontend_url: str = Field(
        default="http://localhost:3000", description="Frontend URL for CORS"
    )

    # JWT Auth
    jwt_secret: str = Field(
        default="change-me-in-production", description="Secret key for JWT signing"
    )
    jwt_algorithm: str = Field(default="HS256", description="JWT signing algorithm")
    jwt_issuer: str = Field(default="moometrics", description="JWT issuer claim")
    access_token_expire_minutes: int = Field(
        default=15, description="Short-lived access-token lifetime (minutes)"
    )
    refresh_token_expire_days: int = Field(
        default=30, description="Refresh-token lifetime (days)"
    )
    refresh_cookie_name: str = Field(
        default="moometrics_refresh", description="Refresh-token cookie name"
    )

    # Brute-force protection
    max_failed_logins: int = Field(
        default=5, description="Failed logins before an account is locked"
    )
    lockout_minutes: int = Field(
        default=15, description="How long an account stays locked (minutes)"
    )

    # Database
    database_url: str = Field(
        default="sqlite:///./moometrics.db", description="SQLAlchemy database URL"
    )

    # File uploads
    upload_dir: str = Field(
        default="uploads/deaths", description="Directory for death report images"
    )

    # Object storage (death-report images)
    storage_backend: Literal["local", "s3"] = Field(
        default="local", description="Image storage backend: local disk or S3/R2"
    )
    s3_bucket: str = Field(default="", description="S3/R2 bucket name")
    s3_endpoint_url: str = Field(
        default="", description="S3-compatible endpoint (set for Cloudflare R2)"
    )
    s3_region: str = Field(default="auto", description="S3/R2 region")
    s3_access_key_id: str = Field(default="", description="S3/R2 access key id")
    s3_secret_access_key: str = Field(default="", description="S3/R2 secret access key")
    s3_public_base_url: str = Field(
        default="",
        description="Public base URL for served objects (CDN / R2 public bucket)",
    )

    # Initial admin account (seeded on first startup if no users exist)
    admin_username: str = Field(default="admin", description="Seeded admin username")
    admin_initial_password: str = Field(
        default="admin123",
        description="Seeded admin password — MUST be overridden in production",
    )
    default_farm_name: str = Field(
        default="Default Farm",
        description="Name of the farm created alongside the seeded admin",
    )

    # Logging
    log_level: str = Field(default="INFO", description="Logging level")

    @property
    def is_production(self) -> bool:
        return self.environment == "production"

    @property
    def is_development(self) -> bool:
        return self.environment == "development"

    def model_post_init(self, __context: object) -> None:
        if self.is_production:
            if self.jwt_secret == "change-me-in-production":
                raise ValueError(
                    "JWT_SECRET must be set to a strong value in production"
                )
            if self.database_url.startswith("sqlite"):
                raise ValueError(
                    "SQLite is not supported in production — use PostgreSQL"
                )
            if self.admin_initial_password == "admin123":
                raise ValueError(
                    "ADMIN_INITIAL_PASSWORD must be set to a strong value in "
                    "production (the default 'admin123' is not allowed)"
                )


@lru_cache()
def get_settings() -> Settings:
    """
    Get settings instance (singleton via lru_cache).
    """
    return Settings()
