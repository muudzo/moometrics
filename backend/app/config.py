"""
Configuration management for the backend API.
"""
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""
    
    # API Keys
    openweather_api_key: str = "YOUR_API_KEY"
    openai_api_key: str = ""
    
    # Server
    backend_port: int = 8000
    frontend_url: str = "http://localhost:3000"
    
    # API URLs
    openweather_base_url: str = "https://api.openweathermap.org/data/2.5"
    
    class Config:
        env_file = ".env"
        case_sensitive = False


def get_settings() -> Settings:
    """Get settings instance (reloads from .env each time)."""
    return Settings()
