import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { MapPin, Navigation } from 'lucide-react';
import { useLocation } from '@/context/LocationContext';

export const LocationSettings: React.FC = () => {
  const { location, setManualLocation, requestBrowserLocation, isLoading } = useLocation();
  const [latitude, setLatitude] = useState(location?.latitude.toString() || '');
  const [longitude, setLongitude] = useState(location?.longitude.toString() || '');
  const [locationName, setLocationName] = useState(location?.name || '');
  const [open, setOpen] = useState(false);

  const handleSaveManual = () => {
    const lat = parseFloat(latitude);
    const lon = parseFloat(longitude);

    if (isNaN(lat) || isNaN(lon)) {
      alert('Please enter valid coordinates');
      return;
    }

    if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
      alert('Coordinates out of range. Latitude: -90 to 90, Longitude: -180 to 180');
      return;
    }

    setManualLocation(lat, lon, locationName || undefined);
    setOpen(false);
  };

  const handleUseBrowserLocation = () => {
    requestBrowserLocation();
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-2">
          <MapPin className="h-4 w-4" />
          {location?.source === 'browser' && 'Auto Location'}
          {location?.source === 'manual' && 'Manual Location'}
          {location?.source === 'default' && 'Default Location'}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Location Settings</DialogTitle>
          <DialogDescription>
            Set your farm location for accurate weather data. You can use your current location or
            enter coordinates manually.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="space-y-2">
            <Button
              onClick={handleUseBrowserLocation}
              disabled={isLoading}
              className="w-full gap-2"
              variant="outline"
            >
              <Navigation className="h-4 w-4" />
              {isLoading ? 'Getting location...' : 'Use My Current Location'}
            </Button>
          </div>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">Or enter manually</span>
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="location-name">Location Name (Optional)</Label>
            <Input
              id="location-name"
              placeholder="e.g., Main Farm"
              value={locationName}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setLocationName(e.target.value)}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="latitude">Latitude</Label>
            <Input
              id="latitude"
              type="number"
              step="0.0001"
              placeholder="e.g., 40.7128"
              value={latitude}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setLatitude(e.target.value)}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="longitude">Longitude</Label>
            <Input
              id="longitude"
              type="number"
              step="0.0001"
              placeholder="e.g., -74.0060"
              value={longitude}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setLongitude(e.target.value)}
            />
          </div>

          <Button onClick={handleSaveManual}>Save Manual Location</Button>

          {location && (
            <div className="text-xs text-muted-foreground space-y-1">
              <p>Current: {location.name || 'Unnamed'}</p>
              <p>
                Coordinates: {location.latitude.toFixed(4)}, {location.longitude.toFixed(4)}
              </p>
              <p>Source: {location.source}</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
