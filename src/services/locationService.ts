/**
 * UGNAY Location & Google Maps Geocoding Service
 * Consumes EXPO_PUBLIC_GOOGLE_MAPS_API_KEY from process.env
 * Provides reverse geocoding (lat, lng -> human readable address) and Cebu area defaults.
 */

import { openRouteService } from './openRouteService';

export interface LocationPoint {
  latitude: number;
  longitude: number;
  address: string;
  shortName?: string;
}

export const CEBU_DEFAULT_LOCATIONS: Record<string, LocationPoint> = {
  CALLER_KATIPUNAN: {
    latitude: 10.2994,
    longitude: 123.8890,
    address: 'Katipunan Ave, Labangon, Cebu City, 6000 Cebu, Philippines',
    shortName: 'Katipunan Ave, Labangon, Cebu City',
  },
  DISPATCH_DRRMO: {
    latitude: 10.3157,
    longitude: 123.8854,
    address: 'Cebu City Hall & DRRMO Central Command, N. Gonzales St, Cebu City, 6000 Cebu, Philippines',
    shortName: 'Cebu DRRMO Central Command',
  },
  FIRE_BFP_CENTRAL: {
    latitude: 10.3025,
    longitude: 123.8970,
    address: 'BFP Central Fire Station #4, N. Bacalso Ave, Cebu City, 6000 Cebu, Philippines',
    shortName: 'BFP Station #4, N. Bacalso Ave, Cebu City',
  },
  EMS_VICENTE_SOTTO: {
    latitude: 10.3101,
    longitude: 123.8911,
    address: 'Vicente Sotto Medical Center EMS Bay, B. Rodriguez St, Cebu City, 6000 Cebu, Philippines',
    shortName: 'VSMMC EMS Bay, Cebu City',
  },
};

class LocationService {
  private static instance: LocationService;
  private apiKey: string;
  private geocodeCache: Map<string, string> = new Map();

  constructor() {
    this.apiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || 'AIzaSyBb6uLRn1eFYx8pLYhXxM5eWZeo8uZOMbY';
  }

  static getInstance(): LocationService {
    if (!LocationService.instance) {
      LocationService.instance = new LocationService();
    }
    return LocationService.instance;
  }

  /**
   * Reverse Geocode (Lat, Lng) -> Full Human-Readable Street Address using Google Maps API
   */
  async reverseGeocode(latitude: number, longitude: number): Promise<string> {
    const cacheKey = `${latitude.toFixed(4)},${longitude.toFixed(4)}`;
    if (this.geocodeCache.has(cacheKey)) {
      return this.geocodeCache.get(cacheKey)!;
    }

    // 1. Try OpenStreetMap Nominatim reverse geocoding (100% Free Open-Source)
    try {
      const osmAddr = await openRouteService.reverseGeocodeNominatim(latitude, longitude);
      if (osmAddr) {
        this.geocodeCache.set(cacheKey, osmAddr);
        return osmAddr;
      }
    } catch (e) {}

    // 2. Try Google Maps if key is configured
    try {
      const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${latitude},${longitude}&key=${this.apiKey}`;
      const response = await fetch(url);
      const data = await response.json();

      if (data.status === 'OK' && data.results && data.results.length > 0) {
        const formattedAddress = data.results[0].formatted_address;
        this.geocodeCache.set(cacheKey, formattedAddress);
        return formattedAddress;
      }
    } catch (err) {
      console.warn('[Google Maps Geocoding] Fetch warning:', err);
    }

    // Fallback to Cebu area default locations matching closest coordinates
    let closestAddr: string | null = null;
    let minDistance = 0.015; // max threshold in degrees (~1.5km)

    for (const loc of Object.values(CEBU_DEFAULT_LOCATIONS)) {
      const dist = Math.hypot(latitude - loc.latitude, longitude - loc.longitude);
      if (dist < minDistance) {
        minDistance = dist;
        closestAddr = loc.address;
      }
    }

    if (closestAddr) {
      return closestAddr;
    }

    return `${latitude.toFixed(4)}° N, ${longitude.toFixed(4)}° E (Cebu City Area)`;
  }

  /**
   * Calculate distance between two points in km
   */
  calculateDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // Radius of Earth in km
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * (Math.PI / 180)) *
        Math.cos(lat2 * (Math.PI / 180)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Number((R * c).toFixed(1));
  }
}

export const locationService = LocationService.getInstance();
