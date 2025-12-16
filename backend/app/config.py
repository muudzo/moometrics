"""
Configuration management for the backend API.
"""

from functools import lru_cache
from typing import Literal
from pydantic import Field, field_validator
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    # Environment
    environment: Literal["development", "staging", "production"] = Field(
        default="development", description="Application environment"
    )

    # API Keys
    openweather_api_key: str = Field(
        default="YOUR_API_KEY", description="OpenWeatherMap API key"
    )
    openai_api_key: str = Field(
        default="", description="OpenAI API key for crop predictions"
    )

    # Server
    backend_port: int = Field(default=8000, description="Backend server port")
    frontend_url: str = Field(
        default="http://localhost:3000", description="Frontend URL for CORS"
    )

    # API URLs
    openweather_base_url: str = Field(
        default="https://api.openweathermap.org/data/2.5",
        description="OpenWeatherMap API base URL",
    )

    # Cache settings
    cache_ttl_seconds: int = Field(
        default=300, description="Cache TTL in seconds (5 minutes default)"
    )

    # Logging
    log_level: str = Field(default="INFO", description="Logging level")

    @field_validator("openweather_api_key")
    @classmethod
    def validate_weather_api_key(cls, v: str) -> str:
        """Validate OpenWeatherMap API key format."""
        if v and v != "YOUR_API_KEY" and len(v) < 10:
            raise ValueError("OpenWeatherMap API key seems invalid (too short)")
        return v

    @field_validator("log_level")
    @classmethod
    def validate_log_level(cls, v: str) -> str:
        """Validate log level."""
        valid_levels = ["DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"]
        if v.upper() not in valid_levels:
            raise ValueError(f"Invalid log level. Must be one of: {valid_levels}")
        return v.upper()

    @property
    def is_production(self) -> bool:
        """Check if running in production environment."""
        return self.environment == "production"

    @property
    def is_development(self) -> bool:
        """Check if running in development environment."""
        return self.environment == "development"

    class Config:
        env_file = ".env"
        case_sensitive = False


@lru_cache()
def get_settings() -> Settings:
    """
    Get settings instance (singleton pattern using lru_cache).
    Settings are loaded once and cached for the application lifetime.
    """
    return Settings()
