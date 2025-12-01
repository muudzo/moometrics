import React, { createContext, useContext, useState, useEffect } from 'react';

interface Location {
    latitude: number;
    longitude: number;
    name?: string;
    source: 'browser' | 'manual' | 'default';
}

interface LocationContextType {
    location: Location | null;
    setManualLocation: (lat: number, lon: number, name?: string) => void;
    requestBrowserLocation: () => void;
    isLoading: boolean;
    error: string | null;
}

const LocationContext = createContext<LocationContextType | undefined>(undefined);

export const LocationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [location, setLocation] = useState<Location | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Load saved location from localStorage on mount
    useEffect(() => {
        const savedLocation = localStorage.getItem('moometrics_location');
        if (savedLocation) {
            setLocation(JSON.parse(savedLocation));
        } else {
            // Try browser geolocation on first load
            requestBrowserLocation();
        }
    }, []);

    const requestBrowserLocation = () => {
        if (!navigator.geolocation) {
            setError('Geolocation is not supported by your browser');
            // Set default location (New York as fallback)
            const defaultLoc: Location = {
                latitude: 40.7128,
                longitude: -74.0060,
                name: 'Default Location',
                source: 'default'
            };
            setLocation(defaultLoc);
            localStorage.setItem('moometrics_location', JSON.stringify(defaultLoc));
            return;
        }

        setIsLoading(true);
        setError(null);

        navigator.geolocation.getCurrentPosition(
            (position) => {
                const newLocation: Location = {
                    latitude: position.coords.latitude,
                    longitude: position.coords.longitude,
                    name: 'Current Location',
                    source: 'browser'
                };
                setLocation(newLocation);
                localStorage.setItem('moometrics_location', JSON.stringify(newLocation));
                setIsLoading(false);
            },
            (err) => {
                setError(`Location access denied: ${err.message}`);
                setIsLoading(false);
                // Set default location on error
                const defaultLoc: Location = {
                    latitude: 40.7128,
                    longitude: -74.0060,
                    name: 'Default Location',
                    source: 'default'
                };
                setLocation(defaultLoc);
                localStorage.setItem('moometrics_location', JSON.stringify(defaultLoc));
            }
        );
    };

    const setManualLocation = (lat: number, lon: number, name?: string) => {
        const newLocation: Location = {
            latitude: lat,
            longitude: lon,
            name: name || 'Manual Location',
            source: 'manual'
        };
        setLocation(newLocation);
        localStorage.setItem('moometrics_location', JSON.stringify(newLocation));
        setError(null);
    };

    return (
        <LocationContext.Provider value={{
            location,
            setManualLocation,
            requestBrowserLocation,
            isLoading,
            error
        }}>
            {children}
        </LocationContext.Provider>
    );
};

export const useLocation = () => {
    const context = useContext(LocationContext);
    if (context === undefined) {
        throw new Error('useLocation must be used within a LocationProvider');
    }
    return context;
};
