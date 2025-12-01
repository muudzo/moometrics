"""
Weather service for fetching data from OpenWeatherMap API.
"""
import httpx
from app.config import get_settings
from app.models.schemas import WeatherResponse

settings = get_settings()


async def get_weather_by_coordinates(latitude: float, longitude: float) -> WeatherResponse:
    """
    Fetch weather data for given coordinates from OpenWeatherMap API.
    
    Args:
        latitude: Latitude coordinate
        longitude: Longitude coordinate
        
    Returns:
        WeatherResponse with current weather data
        
    Raises:
        httpx.HTTPError: If the API request fails
    """
    # Mock data if no API key is configured
    if settings.openweather_api_key == "YOUR_API_KEY":
        return WeatherResponse(
            temperature=22.0,
            condition="Sunny",
            location="Farm Location",
            humidity=45,
            wind_speed=12.0,
            icon="01d"
        )
    
    # Fetch real data from OpenWeatherMap
    url = f"{settings.openweather_base_url}/weather"
    params = {
        "lat": latitude,
        "lon": longitude,
        "units": "metric",
        "appid": settings.openweather_api_key
    }
    
    async with httpx.AsyncClient() as client:
        response = await client.get(url, params=params)
        response.raise_for_status()
        data = response.json()
        
        return WeatherResponse(
            temperature=round(data["main"]["temp"], 1),
            condition=data["weather"][0]["main"],
            location=data["name"],
            humidity=data["main"]["humidity"],
            wind_speed=round(data["wind"]["speed"], 1),
            icon=data["weather"][0]["icon"]
        )
