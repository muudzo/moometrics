"""
Main FastAPI application entry point.
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import get_settings
from app.routers import weather, predictions

settings = get_settings()

app = FastAPI(
    title="MooMetrics API",
    description="Backend API for agricultural management with weather data and AI predictions",
    version="0.1.0"
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_url, "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(weather.router)
app.include_router(predictions.router)


@app.get("/")
async def root():
    """Root endpoint."""
    return {
        "message": "MooMetrics API",
        "version": "0.1.0",
        "docs": "/docs"
    }


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "healthy"}


@app.get("/config/check")
async def config_check():
    """Check configuration status (for debugging)."""
    settings = get_settings()
    api_key = settings.openweather_api_key
    
    return {
        "openweather_api_key_configured": api_key != "YOUR_API_KEY" and len(api_key) > 0,
        "openweather_api_key_length": len(api_key) if api_key else 0,
        "openweather_api_key_first_4": api_key[:4] if api_key and len(api_key) >= 4 else "N/A",
        "openai_api_key_configured": len(settings.openai_api_key) > 0,
        "backend_port": settings.backend_port,
        "frontend_url": settings.frontend_url
    }
