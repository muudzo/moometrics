# MooMetrics Backend API

Python backend for MooMetrics agricultural management system, providing weather data and AI-powered agricultural predictions.

## Features

- **Weather API**: Location-based weather data from OpenWeatherMap
- **AI Predictions**: OpenAI-powered planting and harvest recommendations
- **CORS Support**: Configured for frontend integration
- **Mock Data**: Fallback responses when API keys are not configured

## Tech Stack

- **FastAPI**: Modern, fast web framework
- **Uvicorn**: ASGI server
- **OpenAI**: AI predictions
- **httpx**: Async HTTP client
- **Pydantic**: Data validation

## Setup

### 1. Install Dependencies

```bash
cd backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
```

### 2. Configure Environment Variables

```bash
cp .env.example .env
# Edit .env and add your API keys
```

Required environment variables:

- `OPENWEATHER_API_KEY`: Your OpenWeatherMap API key
- `OPENAI_API_KEY`: Your OpenAI API key (optional, uses mock data if not provided)

### 3. Run the Server

```bash
# From the backend directory
uvicorn app.main:app --reload --port 8000
```

The API will be available at `http://localhost:8000`

## API Endpoints

### Weather

**GET** `/api/weather?lat={latitude}&lon={longitude}`

Get current weather data for specified coordinates.

**Example Request:**

```bash
curl "http://localhost:8000/api/weather?lat=40.7128&lon=-74.0060"
```

**Example Response:**

```json
{
  "temperature": 22.0,
  "condition": "Sunny",
  "location": "New York",
  "humidity": 45,
  "wind_speed": 12.0,
  "icon": "01d"
}
```

### AI Predictions

**POST** `/api/predictions/planting`

Get AI-powered planting and harvest predictions.

**Example Request:**

```bash
curl -X POST "http://localhost:8000/api/predictions/planting" \
  -H "Content-Type: application/json" \
  -d '{
    "crop_type": "corn",
    "latitude": 40.7128,
    "longitude": -74.0060,
    "soil_type": "loamy",
    "current_season": "spring"
  }'
```

**Example Response:**

```json
{
  "recommended_planting_date": "2024-04-15",
  "expected_harvest_date": "2024-09-20",
  "confidence": 0.75,
  "recommendations": [
    "Plant corn in well-drained soil with good sun exposure",
    "Ensure soil pH is between 6.0 and 7.0 for optimal growth",
    "Water regularly, especially during germination and flowering stages",
    "Monitor for common pests and diseases specific to your region",
    "Consider crop rotation to maintain soil health"
  ]
}
```

### Health Check

**GET** `/health`

Check if the API is running.

**Example Response:**

```json
{
  "status": "healthy"
}
```

## API Documentation

Interactive API documentation is available at:

- Swagger UI: `http://localhost:8000/docs`
- ReDoc: `http://localhost:8000/redoc`

## Project Structure

```
backend/
├── app/
│   ├── __init__.py
│   ├── main.py              # FastAPI application
│   ├── config.py            # Configuration management
│   ├── routers/
│   │   ├── weather.py       # Weather endpoints
│   │   └── predictions.py   # AI prediction endpoints
│   ├── services/
│   │   ├── weather_service.py  # Weather API logic
│   │   └── ai_service.py       # OpenAI integration
│   └── models/
│       └── schemas.py       # Pydantic models
├── .env.example
├── .gitignore
├── requirements.txt
└── README.md
```

## Development

### Running Tests

```bash
# Install test dependencies
pip install pytest pytest-asyncio httpx

# Run tests
pytest
```

### Code Quality

```bash
# Format code
black app/

# Lint
flake8 app/
```

## Deployment

For production deployment:

1. Set environment variables in your hosting platform
2. Use a production ASGI server (Uvicorn with Gunicorn)
3. Enable HTTPS
4. Configure proper CORS origins

Example production command:

```bash
gunicorn app.main:app -w 4 -k uvicorn.workers.UvicornWorker --bind 0.0.0.0:8000
```

## License

MIT
