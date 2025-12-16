const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000';

export interface WeatherData {
  temp: number;
  condition: string;
  location: string;
  humidity: number;
  windSpeed: number;
  icon: string;
}

export const fetchWeather = async (lat: number, lon: number): Promise<WeatherData> => {
  try {
    // Call our Python backend API
    const response = await fetch(`${BACKEND_URL}/api/weather?lat=${lat}&lon=${lon}`);

    if (!response.ok) {
      throw new Error(`Backend API error: ${response.status}`);
    }

    const data = await response.json();

    return {
      temp: Math.round(data.temperature),
      condition: data.condition,
      location: data.location,
      humidity: data.humidity,
      windSpeed: data.wind_speed,
      icon: data.icon,
    };
  } catch (error) {
    console.error('Error fetching weather from backend:', error);

    // Fallback to mock data on error
    return {
      temp: 22,
      condition: 'Sunny',
      location: 'Farm Location (Offline)',
      humidity: 45,
      windSpeed: 12,
      icon: '01d',
    };
  }
};
