"""Pydantic models for API request/response schemas."""

from pydantic import BaseModel
from typing import Optional


class WeatherResponse(BaseModel):
    """Weather data response model."""

    temperature: float
    condition: str
    location: str
    humidity: int
    wind_speed: float
    icon: str


class PredictionRequest(BaseModel):
    """AI prediction request model."""

    crop_type: str
    latitude: float
    longitude: float
    soil_type: Optional[str] = None
    current_season: Optional[str] = None


class PredictionResponse(BaseModel):
    """AI prediction response model."""

    recommended_planting_date: str
    expected_harvest_date: str
    confidence: float
    recommendations: list[str]
