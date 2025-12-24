import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { z } from 'zod';

// Define Zod schema for runtime validation
const LocationSchema = z.object({
  latitude: z.number(),
  longitude: z.number(),
  name: z.string().optional(),
  source: z.enum(['browser', 'manual', 'default']),
});

type Location = z.infer<typeof LocationSchema>;

interface LocationContextType {
  location: Location | null;
  setManualLocation: (lat: number, lon: number, name?: string) => void;
  requestBrowserLocation: () => void;
  isLoading: boolean;
  error: string | null;
}

const LocationContext = createContext<LocationContextType | undefined>(undefined);

const STORAGE_KEY = 'moometrics_location';

export const LocationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const isMounted = useRef(false);

  const [location, setLocation] = useState<Location | null>(() => {
    try {
      const savedLocation = localStorage.getItem(STORAGE_KEY);
      if (!savedLocation) return null;
      
      const parsed = JSON.parse(savedLocation);
      const result = LocationSchema.safeParse(parsed);
      
      if (!result.success) {
        console.warn('Corrupted location data found in localStorage, clearing.', result.error);
        localStorage.removeItem(STORAGE_KEY);
        return null;
      }
      return result.data;
    } catch (e) {
      console.error('Failed to parse location from localStorage', e);
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }
  });

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  const requestBrowserLocation = () => {
    if (!navigator.geolocation) {
      if (isMounted.current) {
        setError('Geolocation is not supported by your browser');
        // Set default location (New York as fallback)
        const defaultLoc: Location = {
          latitude: 40.7128,
          longitude: -74.006,
          name: 'Default Location',
          source: 'default',
        };
        setLocation(defaultLoc);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(defaultLoc));
      }
      return;
    }

    if (isMounted.current) {
      setIsLoading(true);
      setError(null);
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        if (!isMounted.current) return;

        const newLocation: Location = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          name: 'Current Location',
          source: 'browser',
        };
        setLocation(newLocation);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(newLocation));
        setIsLoading(false);
      },
      (err) => {
        if (!isMounted.current) return;

        setError(`Location access denied: ${err.message}`);
        setIsLoading(false);
        // Set default location on error
        const defaultLoc: Location = {
          latitude: 40.7128,
          longitude: -74.006,
          name: 'Default Location',
          source: 'default',
        };
        setLocation(defaultLoc);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(defaultLoc));
      }
    );
  };

  // Load saved location from localStorage on mount
  useEffect(() => {
    const savedLocation = localStorage.getItem(STORAGE_KEY);
    if (!savedLocation) {
      // Try browser geolocation on first load if no saved location
      requestBrowserLocation();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setManualLocation = (lat: number, lon: number, name?: string) => {
    const newLocation: Location = {
      latitude: lat,
      longitude: lon,
      name: name || 'Manual Location',
      source: 'manual',
    };
    
    // Validate before setting
    const result = LocationSchema.safeParse(newLocation);
    if (!result.success) {
      console.error('Attempted to set invalid location', result.error);
      if (isMounted.current) setError('Internal Error: Invalid location data');
      return;
    }

    if (isMounted.current) {
      setLocation(result.data);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(result.data));
      setError(null);
    }
  };

  return (
    <LocationContext.Provider
      value={{
        location,
        setManualLocation,
        requestBrowserLocation,
        isLoading,
        error,
      }}
    >
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
