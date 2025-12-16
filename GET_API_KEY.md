# Getting a Valid OpenWeatherMap API Key

## The Issue

Both API keys tested are returning 401 Unauthorized from OpenWeatherMap:

- First key: 31 characters (truncated)
- Second key: `44a84bb8ae9cdfcd5123c5c34918e3bb` (invalid/not activated)

## Solution: Get a Fresh API Key

### Step 1: Create Account / Login

1. Go to: https://openweathermap.org/
2. Click "Sign In" (top right)
3. If you don't have an account, click "Create an Account"
4. Complete registration and verify your email

### Step 2: Generate API Key

1. After logging in, go to: https://home.openweathermap.org/api_keys
2. You'll see a section called "API keys"
3. There should be a default key already created, OR
4. Click "Generate" to create a new key
5. Give it a name like "MooMetrics"
6. Click "Generate"

### Step 3: Copy the Full Key

**IMPORTANT**:

- The key will be **exactly 32 characters**
- It looks like: `a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6`
- Copy the ENTIRE key (all 32 characters)
- No spaces, no quotes

### Step 4: Wait for Activation

⏰ **New API keys take 10-15 minutes to activate!**

- Don't use the key immediately
- Wait at least 10 minutes
- Check the status on the API keys page
- Status should show "Active"

### Step 5: Update Backend Configuration

1. Open `backend/.env` in your editor
2. Update the line:
   ```bash
   OPENWEATHER_API_KEY=your_new_32_character_key_here
   ```
3. Save the file
4. The backend will auto-reload (watch the terminal)

### Step 6: Verify It Works

**Test 1: Check Configuration**

```bash
curl http://localhost:8000/config/check
```

Should show:

```json
{
  "openweather_api_key_configured": true,
  "openweather_api_key_length": 32,  ← Should be 32!
  "openweather_api_key_first_4": "abcd"
}
```

**Test 2: Test Weather API**

```bash
curl "http://localhost:8000/api/weather?lat=-17.8252&lon=31.0335"
```

Should return REAL weather data (not "Mock Data")

**Test 3: Check in Browser**

1. Open http://localhost:3000
2. Set your location
3. Weather widget should show real data!

## Alternative: Use Mock Data (For Now)

If you don't want to wait for API activation or deal with API keys right now:

**The app works perfectly with mock data!**

- Weather will show: 22°C, Sunny, "Mock Data (Invalid API Key)"
- All other features work normally
- You can add a real API key later

## Troubleshooting

### "Invalid API Key" Error

**Cause**: Key not activated yet
**Solution**: Wait 10-15 minutes, then try again

### "Rate Limit Exceeded"

**Cause**: Too many requests (free tier: 60 calls/minute)
**Solution**: Wait a minute, then try again

### Key Still Not Working After 15 Minutes

1. Go to https://home.openweathermap.org/api_keys
2. Check if key status is "Active"
3. Try generating a completely new key
4. Make sure you're using the "Current Weather Data" API (free tier)

### Backend Not Picking Up New Key

1. Check you saved `backend/.env` file
2. Restart backend:
   ```bash
   # In backend terminal, press Ctrl+C
   # Then run:
   uvicorn app.main:app --reload --port 8000
   ```

## Free Tier Limits

OpenWeatherMap free tier includes:

- ✅ 60 calls per minute
- ✅ 1,000,000 calls per month
- ✅ Current weather data
- ✅ 5 day forecast
- ❌ Historical data (paid only)

This is MORE than enough for development and personal use!

## Quick Reference

**File Locations:**

- Backend config: `backend/.env`
- Frontend config: `.env` (root folder)

**Backend .env format:**

```bash
OPENWEATHER_API_KEY=your_32_character_key
OPENAI_API_KEY=your_openai_key_optional
```

**Test Commands:**

```bash
# Check config
curl http://localhost:8000/config/check

# Test weather
curl "http://localhost:8000/api/weather?lat=40.7128&lon=-74.0060"

# Check health
curl http://localhost:8000/health
```

## Need Help?

If you're still having issues:

1. Check the backend terminal for error messages
2. Verify the key is exactly 32 characters
3. Make sure you waited 10-15 minutes for activation
4. Try the test commands above
5. Check OpenWeatherMap dashboard for key status
