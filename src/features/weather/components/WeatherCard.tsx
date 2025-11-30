import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CloudSun, Droplets, Wind } from 'lucide-react';
import { fetchWeather, WeatherData } from '../services/weatherService';

export const WeatherCard: React.FC = () => {
    const [weather, setWeather] = useState<WeatherData | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const loadWeather = async () => {
            try {
                // Default coordinates (can be made dynamic later)
                const data = await fetchWeather(40.7128, -74.0060);
                setWeather(data);
            } catch (error) {
                console.error('Failed to load weather', error);
            } finally {
                setLoading(false);
            }
        };

        loadWeather();
    }, []);

    if (loading) {
        return (
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Weather</CardTitle>
                    <CloudSun className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">Loading...</div>
                </CardContent>
            </Card>
        );
    }

    if (!weather) return null;

    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Weather - {weather.location}</CardTitle>
                <CloudSun className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
                <div className="flex items-center justify-between">
                    <div className="text-2xl font-bold">{weather.temp}°C</div>
                    <div className="text-sm text-muted-foreground">{weather.condition}</div>
                </div>
                <div className="mt-4 flex items-center space-x-4 text-sm text-muted-foreground">
                    <div className="flex items-center">
                        <Droplets className="mr-1 h-3 w-3" />
                        {weather.humidity}%
                    </div>
                    <div className="flex items-center">
                        <Wind className="mr-1 h-3 w-3" />
                        {weather.windSpeed} km/h
                    </div>
                </div>
            </CardContent>
        </Card>
    );
};
