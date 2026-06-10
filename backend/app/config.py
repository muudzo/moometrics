"""
Configuration management for the backend API.
"""

from functools import lru_cache
from typing import Literal
from pydantic import Field
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    # Environment
    environment: Literal["development", "staging", "production"] = Field(
        default="development", description="Application environment"
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
    jwt_expire_minutes: int = Field(
        default=480, description="JWT expiry in minutes (8 hours)"
    )

    # Database
    database_url: str = Field(
        default="sqlite:///./moometrics.db", description="SQLAlchemy database URL"
    )

    # File uploads
    upload_dir: str = Field(
        default="uploads/deaths", description="Directory for death report images"
    )

    # Initial admin account (seeded on first startup if no users exist)
    admin_username: str = Field(default="admin", description="Seeded admin username")
    admin_initial_password: str = Field(
        default="admin123",
        description="Seeded admin password — MUST be overridden in production",
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

    class Config:
        env_file = ".env"
        case_sensitive = False


@lru_cache()
def get_settings() -> Settings:
    """
    Get settings instance (singleton via lru_cache).
    """
    return Settings()
