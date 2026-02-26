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

    # Logging
    log_level: str = Field(default="INFO", description="Logging level")

    @property
    def is_production(self) -> bool:
        return self.environment == "production"

    @property
    def is_development(self) -> bool:
        return self.environment == "development"

    class Config:
        env_file = ".env"
        case_sensitive = False


@lru_cache()
def get_settings() -> Settings:
    """
    Get settings instance (singleton via lru_cache).
    """
    return Settings()
