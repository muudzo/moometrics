# MooMetrics - Testing & Troubleshooting Guide

## Current Status ✅

**Backend**: Running on http://localhost:8000
**Frontend**: Running on http://localhost:3000

## Testing the Application

### 1. Access the Application

Open your browser to: **http://localhost:3000**

### 2. Login

- Enter any username (mock authentication)
- Click "Login"

### 3. Set Your Location

Click the **location button** in the header (top right) and choose:

**Option A: Browser Geolocation**

- Click "Use My Current Location"
- Allow browser location access
- Weather will load for your actual location

**Option B: Manual Coordinates**

- Enter latitude and longitude
- Example: New York (40.7128, -74.0060)
- Click "Save Manual Location"

### 4. Verify Weather Data

The weather card should show:

- Current temperature
- Weather condition
- Humidity
- Wind speed
- Location name

## Troubleshooting

### Weather Shows "Farm Location (Offline)"

**Cause**: Backend is not responding

**Solution**:

```bash
# Check if backend is running
curl http://localhost:8000/health

# If not running, start it:
cd backend
source venv/bin/activate
uvicorn app.main:app --reload --port 8000
```

### Weather Shows Mock Data (22°C, Sunny)

**Cause**: OpenWeatherMap API key issue

**Check**:

1. Open `backend/.env`
2. Verify `OPENWEATHER_API_KEY` is set correctly
3. API key should be 32 characters long
4. No spaces or quotes around the key

**Format**:

```bash
OPENWEATHER_API_KEY=your32characterapikeyhere
```

**Get a valid API key**:

1. Go to https://openweathermap.org/api
2. Sign up for free account
3. Generate API key (takes ~10 minutes to activate)
4. Copy the full 32-character key
5. Paste into `backend/.env`
6. Restart backend server

**Restart backend after changing .env**:

```bash
# Stop current server (Ctrl+C in backend terminal)
# Then restart:
uvicorn app.main:app --reload --port 8000
```

### 401 Unauthorized Error

**Cause**: Invalid or incomplete API key

**Solution**:

- Verify API key is exactly 32 characters
- Check for typos or extra spaces
- Ensure API key is activated (wait 10-15 minutes after creation)
- Try generating a new API key

### CORS Errors in Browser Console

**Cause**: Frontend not on correct port

**Solution**: Ensure frontend is running on http://localhost:3000

### Location Not Updating

**Cause**: Browser cache or location context issue

**Solution**:

1. Hard refresh browser (Cmd+Shift+R or Ctrl+Shift+R)
2. Clear localStorage: Open DevTools → Application → Local Storage → Clear
3. Reload page

## Testing Backend API Directly

### Health Check

```bash
curl http://localhost:8000/health
# Expected: {"status":"healthy"}
```

### Weather Endpoint

```bash
curl "http://localhost:8000/api/weather?lat=40.7128&lon=-74.0060"
# Expected: JSON with temperature, condition, etc.
```

### API Documentation

Open: http://localhost:8000/docs

## Verification Checklist

- [ ] Backend running on port 8000
- [ ] Frontend running on port 3000
- [ ] Can login to application
- [ ] Can set location (browser or manual)
- [ ] Weather data loads (not showing "Offline")
- [ ] Weather data is accurate for location
- [ ] No console errors in browser

## Production Deployment Notes

Before deploying to production:

1. **Environment Variables**:
   - Set `OPENWEATHER_API_KEY` in production environment
   - Set `VITE_BACKEND_URL` to production backend URL
   - Set `FRONTEND_URL` in backend to production frontend URL

2. **Security**:
   - Never commit `.env` files
   - Use environment variable management (e.g., Heroku Config Vars)
   - Enable HTTPS

3. **Performance**:
   - Build frontend: `npm run build`
   - Use production ASGI server: `gunicorn`
   - Enable caching for weather data

## Support

If issues persist:

1. Check browser console for errors (F12 → Console)
2. Check backend terminal for error messages
3. Verify both servers are running
4. Test API endpoints directly with curl
