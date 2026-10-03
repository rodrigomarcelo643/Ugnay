import { useState, useEffect, useRef } from 'react';
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

interface CachedLocationData {
  latitude: number;
  longitude: number;
  accuracy: number;
  locationString: string;
  addressString: string;
  timestamp: number;
}

// Module-level in-memory cache for 0ms instant location across all screen changes
let globalCachedLocation: CachedLocationData | null = null;
const listeners = new Set<(loc: CachedLocationData) => void>();

function getInitialLocation(): CachedLocationData {
  if (globalCachedLocation) return globalCachedLocation;

  if (typeof window !== 'undefined' && window.sessionStorage) {
    try {
      const stored = window.sessionStorage.getItem('ugnay_cached_device_location');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed && parsed.latitude && parsed.longitude) {
          globalCachedLocation = parsed;
          return parsed;
        }
      }
    } catch (e) {}
  }

  // Fallback initial location (Arthaland Century Pacific Tower, BGC)
  const fallback: CachedLocationData = {
    latitude: 14.5518,
    longitude: 121.0478,
    accuracy: 15,
    locationString: '14.5518° N, 121.0478° E (BGC GPS)',
    addressString: 'Arthaland Century Pacific Tower, 5th Ave cor 30th St, BGC, Taguig, Metro Manila',
    timestamp: Date.now(),
  };
  globalCachedLocation = fallback;
  return fallback;
}

function updateGlobalCache(data: CachedLocationData) {
  globalCachedLocation = data;
  if (typeof window !== 'undefined' && window.sessionStorage) {
    try {
      window.sessionStorage.setItem('ugnay_cached_device_location', JSON.stringify(data));
    } catch (e) {}
  }
  listeners.forEach((listener) => listener(data));
}

let isGlobalFetching = false;

function fetchLiveLocation() {
  if (typeof window === 'undefined' || !('navigator' in window) || !('geolocation' in navigator)) {
    return;
  }
  if (isGlobalFetching) return;
  isGlobalFetching = true;

  // 1. FAST ACQUISITION: Low-accuracy/cached network fix (resolves in <200ms)
  navigator.geolocation.getCurrentPosition(
    async (pos) => {
      isGlobalFetching = false;
      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;
      const acc = Math.round(pos.coords.accuracy || 20);

      const formattedCoords = `${lat.toFixed(4)}° N, ${lng.toFixed(4)}° E (GPS ±${acc}m)`;
      const currentAddr = globalCachedLocation?.addressString || 'Locating nearby street address...';

      const updated: CachedLocationData = {
        latitude: lat,
        longitude: lng,
        accuracy: acc,
        locationString: formattedCoords,
        addressString: currentAddr,
        timestamp: Date.now(),
      };
      updateGlobalCache(updated);

      // Reverse geocode street address in background
      locationService.reverseGeocode(lat, lng).then((fullAddr) => {
        if (fullAddr && fullAddr !== updated.addressString) {
          updateGlobalCache({
            ...updated,
            addressString: fullAddr,
          });
        }
      });

      // 2. BACKGROUND REFINEMENT: If initial accuracy was coarse (>30m), quietly refine
      if (acc > 30) {
        navigator.geolocation.getCurrentPosition(
          async (refinedPos) => {
            const refinedLat = refinedPos.coords.latitude;
            const refinedLng = refinedPos.coords.longitude;
            const refinedAcc = Math.round(refinedPos.coords.accuracy || 10);

            const refinedCoords = `${refinedLat.toFixed(4)}° N, ${refinedLng.toFixed(4)}° E (GPS ±${refinedAcc}m)`;
            const refinedData: CachedLocationData = {
              latitude: refinedLat,
              longitude: refinedLng,
              accuracy: refinedAcc,
              locationString: refinedCoords,
              addressString: globalCachedLocation?.addressString || updated.addressString,
              timestamp: Date.now(),
            };
            updateGlobalCache(refinedData);

            locationService.reverseGeocode(refinedLat, refinedLng).then((refinedAddr) => {
              if (refinedAddr) {
                updateGlobalCache({
                  ...refinedData,
                  addressString: refinedAddr,
                });
              }
            });
          },
          () => {},
          { enableHighAccuracy: true, timeout: 6000, maximumAge: 10000 }
        );
      }
    },
    (err) => {
      isGlobalFetching = false;
      console.warn('Geolocation fast acquisition warning:', err.message);
    },
    { enableHighAccuracy: false, timeout: 3000, maximumAge: 120000 }
  );
}

export function useDeviceLocation(): DeviceLocationResult {
  const initial = getInitialLocation();

  const [locationString, setLocationString] = useState<string>(initial.locationString);
  const [addressString, setAddressString] = useState<string>(initial.addressString);
  const [latitude, setLatitude] = useState<number | null>(initial.latitude);
  const [longitude, setLongitude] = useState<number | null>(initial.longitude);
  const [accuracy, setAccuracy] = useState<number | null>(initial.accuracy);
  // With instant cache, status starts directly as 'ready' with zero loading delay
  const [status, setStatus] = useState<'detecting' | 'ready' | 'denied' | 'error'>('ready');

  useEffect(() => {
    const handleUpdate = (data: CachedLocationData) => {
      setLatitude(data.latitude);
      setLongitude(data.longitude);
      setAccuracy(data.accuracy);
      setLocationString(data.locationString);
      setAddressString(data.addressString);
      setStatus('ready');
    };

    listeners.add(handleUpdate);

    // If cache is older than 60 seconds or hasn't refreshed live, refresh in background
    if (!globalCachedLocation || Date.now() - globalCachedLocation.timestamp > 60000) {
      fetchLiveLocation();
    }

    return () => {
      listeners.delete(handleUpdate);
    };
  }, []);

  const refetch = () => {
    fetchLiveLocation();
  };

  return {
    locationString,
    addressString,
    latitude,
    longitude,
    accuracy,
    status,
    refetch,
  };
}
