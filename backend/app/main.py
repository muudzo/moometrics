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
    description="Backend API for agricultural management with weather/AI data",
    version="0.1.0",
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
    return {"message": "MooMetrics API", "version": "0.1.0", "docs": "/docs"}


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "healthy"}
