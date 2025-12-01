"""
Weather API router.
"""
from fastapi import APIRouter, HTTPException, Query
from app.services.weather_service import get_weather_by_coordinates
from app.models.schemas import WeatherResponse

router = APIRouter(prefix="/api/weather", tags=["weather"])


@router.get("", response_model=WeatherResponse)
async def get_weather(
    lat: float = Query(..., description="Latitude coordinate"),
    lon: float = Query(..., description="Longitude coordinate")
):
    """
    Get current weather data for specified coordinates.
    
    Args:
        lat: Latitude coordinate
        lon: Longitude coordinate
        
    Returns:
        Current weather data including temperature, condition, humidity, and wind speed
    """
    try:
        weather_data = await get_weather_by_coordinates(lat, lon)
        return weather_data
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to fetch weather data: {str(e)}"
        )
