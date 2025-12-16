"""
Weather API router.
"""

from fastapi import APIRouter, Query
from app.services.weather_service import get_weather_by_coordinates
from app.models.schemas import WeatherResponse

router = APIRouter(prefix="/api/weather", tags=["weather"])


@router.get("", response_model=WeatherResponse)
async def get_weather(
    lat: float = Query(..., description="Latitude coordinate"),
    lon: float = Query(..., description="Longitude coordinate"),
):
    """
    Get current weather data for specified coordinates.

    Args:
        lat: Latitude coordinate
        lon: Longitude coordinate

    Returns:
        Current weather data including temperature, condition, humidity, and wind speed.
        Returns mock data if API is unavailable or API key is invalid.
    """
    # Service handles all errors and returns mock data on failure
    weather_data = await get_weather_by_coordinates(lat, lon)
    return weather_data
