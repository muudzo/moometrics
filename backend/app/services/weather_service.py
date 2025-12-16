"""
Weather service for fetching data from OpenWeatherMap API.
"""

import httpx
import logging
from app.config import get_settings
from app.models.schemas import WeatherResponse

settings = get_settings()
logger = logging.getLogger(__name__)


async def get_weather_by_coordinates(
    latitude: float, longitude: float
) -> WeatherResponse:
    """
    Fetch weather data for given coordinates from OpenWeatherMap API.

    Args:
        latitude: Latitude coordinate
        longitude: Longitude coordinate

    Returns:
        WeatherResponse with current weather data
    """
    # Mock data if no API key is configured
    if (
        settings.openweather_api_key == "YOUR_API_KEY"
        or not settings.openweather_api_key
    ):
        logger.info("Using mock weather data (no API key configured)")
        return WeatherResponse(
            temperature=22.0,
            condition="Sunny",
            location="Farm Location (Mock Data)",
            humidity=45,
            wind_speed=12.0,
            icon="01d",
        )

    # Fetch real data from OpenWeatherMap
    url = f"{settings.openweather_base_url}/weather"
    params = {
        "lat": latitude,
        "lon": longitude,
        "units": "metric",
        "appid": settings.openweather_api_key,
    }

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            logger.info(f"Fetching weather for coordinates: {latitude}, {longitude}")
            response = await client.get(url, params=params)

            # Check for API errors
            if response.status_code == 401:
                logger.error("OpenWeatherMap API key is invalid or not activated")
                return _get_mock_weather("Invalid API Key")

            if response.status_code == 429:
                logger.error("OpenWeatherMap API rate limit exceeded")
                return _get_mock_weather("Rate Limit Exceeded")

            if response.status_code != 200:
                logger.error(
                    f"OpenWeatherMap API error: {response.status_code} - "
                    f"{response.text}"
                )
                return _get_mock_weather(f"API Error {response.status_code}")

            data = response.json()
            logger.info(
                f"Successfully fetched weather for {data.get('name', 'Unknown')}"
            )

            return WeatherResponse(
                temperature=round(data["main"]["temp"], 1),
                condition=data["weather"][0]["main"],
                location=data.get("name", "Unknown Location"),
                humidity=data["main"]["humidity"],
                wind_speed=round(data["wind"]["speed"], 1),
                icon=data["weather"][0]["icon"],
            )

    except httpx.TimeoutException:
        logger.error("OpenWeatherMap API request timed out")
        return _get_mock_weather("Timeout")
    except httpx.RequestError as e:
        logger.error(f"Network error fetching weather: {str(e)}")
        return _get_mock_weather("Network Error")
    except (KeyError, ValueError) as e:
        logger.error(f"Error parsing weather data: {str(e)}")
        return _get_mock_weather("Parse Error")
    except Exception as e:
        logger.error(f"Unexpected error fetching weather: {str(e)}")
        return _get_mock_weather("Unknown Error")


def _get_mock_weather(reason: str) -> WeatherResponse:
    """Return mock weather data with reason in location."""
    return WeatherResponse(
        temperature=22.0,
        condition="Sunny",
        location=f"Mock Data ({reason})",
        humidity=45,
        wind_speed=12.0,
        icon="01d",
    )
