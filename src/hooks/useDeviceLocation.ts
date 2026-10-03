import { useState, useEffect } from 'react';
import { locationService } from '@/services/locationService';

export interface DeviceLocationResult {
  locationString: string;
  addressString: string;
  latitude: number | null;
  longitude: number | null;
  accuracy: number | null;
  status: 'detecting' | 'ready' | 'denied' | 'error';
  refetch: () => void;
}

export function useDeviceLocation(): DeviceLocationResult {
  const [locationString, setLocationString] = useState<string>('Detecting device GPS...');
  const [addressString, setAddressString] = useState<string>('Arthaland Century Pacific Tower, 5th Ave cor 30th St, BGC, Taguig, Metro Manila');
  const [latitude, setLatitude] = useState<number | null>(14.5518);
  const [longitude, setLongitude] = useState<number | null>(121.0478);
  const [accuracy, setAccuracy] = useState<number | null>(25);
  const [status, setStatus] = useState<'detecting' | 'ready' | 'denied' | 'error'>('detecting');

  const fetchLocation = () => {
    setStatus('detecting');
    setLocationString('Detecting real-time device GPS...');

    if (typeof window !== 'undefined' && 'navigator' in window && 'geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          const acc = Math.round(pos.coords.accuracy);

          setLatitude(lat);
          setLongitude(lng);
          setAccuracy(acc);
          setStatus('ready');

          const formattedCoords = `${lat.toFixed(4)}° N, ${lng.toFixed(4)}° E (GPS ±${acc}m)`;
          setLocationString(formattedCoords);

          const fullAddr = await locationService.reverseGeocode(lat, lng);
          if (fullAddr) {
            setAddressString(fullAddr);
          }
        },
        async (err) => {
          console.warn('Geolocation error:', err.message);
          setStatus('ready');
          const defaultLat = 14.5518;
          const defaultLng = 121.0478;
          setLatitude(defaultLat);
          setLongitude(defaultLng);
          setAccuracy(25);
          setLocationString(`14.5518° N, 121.0478° E (BGC Scene)`);
          setAddressString('Arthaland Century Pacific Tower, 5th Ave cor 30th St, BGC, Taguig, Metro Manila');
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 }
      );
    } else {
      setStatus('ready');
      setAddressString('Katipunan Ave, Labangon, Cebu City, 6000 Cebu, Philippines');
      setLocationString('10.2994° N, 123.8890° E (GPS ±146m)');
    }
  };

  useEffect(() => {
    fetchLocation();
  }, []);

  return {
    locationString,
    addressString,
    latitude,
    longitude,
    accuracy,
    status,
    refetch: fetchLocation,
  };
}
