const API_KEY = import.meta.env.VITE_WEATHER_API_KEY || 'YOUR_API_KEY';
const BASE_URL = 'https://api.openweathermap.org/data/2.5';

export interface WeatherData {
    temp: number;
    condition: string;
    location: string;
    humidity: number;
    windSpeed: number;
    icon: string;
}

export const fetchWeather = async (lat: number, lon: number): Promise<WeatherData> => {
    // Mock data if no API key is provided or for testing
    if (API_KEY === 'YOUR_API_KEY') {
        return new Promise((resolve) => {
            setTimeout(() => {
                resolve({
                    temp: 22,
                    condition: 'Sunny',
                    location: 'Farm Location',
                    humidity: 45,
                    windSpeed: 12,
                    icon: '01d'
                });
            }, 500);
        });
    }

    try {
        const response = await fetch(`${BASE_URL}/weather?lat=${lat}&lon=${lon}&units=metric&appid=${API_KEY}`);
        if (!response.ok) {
            throw new Error('Weather data fetch failed');
        }
        const data = await response.json();
        return {
            temp: Math.round(data.main.temp),
            condition: data.weather[0].main,
            location: data.name,
            humidity: data.main.humidity,
            windSpeed: data.wind.speed,
            icon: data.weather[0].icon
        };
    } catch (error) {
        console.error('Error fetching weather:', error);
        // Fallback to mock data on error
        return {
            temp: 22,
            condition: 'Sunny',
            location: 'Farm Location',
            humidity: 45,
            windSpeed: 12,
            icon: '01d'
        };
    }
};
