# API Key Troubleshooting Guide

## OpenWeatherMap API Key Issue

Your API key is configured but returning "Invalid API Key" errors. Here's why and how to fix it:

### Current Status

- ✅ API key is in the correct location (`backend/.env`)
- ✅ Backend is reading the key (31 characters detected)
- ❌ API key appears to be **31 characters** instead of 32
- ❌ OpenWeatherMap is rejecting it (401 Unauthorized)

### The Problem

OpenWeatherMap API keys are **exactly 32 characters** long. Your key is showing as 31 characters, which means:

1. The key might be truncated (missing one character)
2. There might be a typo when copying it
3. The key might not be fully activated yet

### Solution

1. **Go to OpenWeatherMap**:
   - Visit: https://home.openweathermap.org/api_keys
   - Log in to your account

2. **Copy the FULL API key**:
   - Make sure you copy ALL 32 characters
   - No spaces before or after
   - Example format: `a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6`

3. **Update `backend/.env`**:

   ```bash
   OPENWEATHER_API_KEY=your_full_32_character_key_here
   ```

   **Important**:
   - No quotes around the key
   - No spaces
   - Exactly 32 characters

4. **Wait for activation** (if key is new):
   - New API keys take 10-15 minutes to activate
   - Check the status on the OpenWeatherMap dashboard

5. **Restart the backend**:
   - The backend auto-reloads, but you can restart it to be sure
   - Press Ctrl+C in the backend terminal
   - Run: `uvicorn app.main:app --reload --port 8000`

### Verify the Fix

1. **Check key length**:

   ```bash
   curl http://localhost:8000/config/check
   ```

   Should show: `"openweather_api_key_length": 32`

2. **Test weather endpoint**:
   ```bash
   curl "http://localhost:8000/api/weather?lat=40.7128&lon=-74.0060"
   ```
   Should return real weather data, not "Mock Data (Invalid API Key)"

### File Structure (For Reference)

```
moometrics/
├── .env.example          # Frontend config template
├── .env                  # Frontend config (create this)
│   └── VITE_BACKEND_URL=http://localhost:8000
│
└── backend/
    ├── .env.example      # Backend config template
    └── .env              # Backend config (YOUR API KEY GOES HERE)
        ├── OPENWEATHER_API_KEY=your_32_char_key
        └── OPENAI_API_KEY=your_openai_key
```

### Alternative: Use Mock Data

If you don't want to use a real API key right now, the weather widget will automatically use mock data. It will show:

- Temperature: 22°C
- Condition: Sunny
- Location: "Mock Data (Invalid API Key)"

This is fine for development and testing!

### Still Not Working?

1. **Check API key status**: https://home.openweathermap.org/api_keys
2. **Generate a new key**: Sometimes keys have issues, try creating a fresh one
3. **Check backend logs**: Look for error messages in the terminal running the backend
4. **Verify .env file**: Make sure there are no hidden characters or formatting issues
