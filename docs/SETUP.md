# Running MooMetrics - Frontend + Backend

## Quick Start

### 1. Start the Backend (Terminal 1)

```bash
cd backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt

# Create .env file
cp .env.example .env
# Edit .env and add your OPENWEATHER_API_KEY

# Run the backend
uvicorn app.main:app --reload --port 8000
```

Backend will be available at: http://localhost:8000

### 2. Start the Frontend (Terminal 2)

```bash
# In the root directory
npm install
npm run dev
```

Frontend will be available at: http://localhost:3000

## Configuration

### Backend (.env in backend/)

```bash
OPENWEATHER_API_KEY=your_key_here
OPENAI_API_KEY=your_key_here  # Optional for AI predictions
```

### Frontend (.env in root/)

```bash
VITE_BACKEND_URL=http://localhost:8000
```

## Testing the Integration

1. Open http://localhost:3000
2. Login with any username
3. Click the location button in the header
4. Set your location (browser or manual)
5. Weather should load from your actual location!

## Troubleshooting

**Weather shows "Farm Location (Offline)"?**

- Backend is not running
- Check backend is at http://localhost:8000
- Check browser console for errors

**Weather shows mock data?**

- OpenWeatherMap API key not set in backend/.env
- Backend will use mock data if no API key

**CORS errors?**

- Backend CORS is configured for http://localhost:3000
- Make sure frontend is running on port 3000
