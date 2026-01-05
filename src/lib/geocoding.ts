import { Location } from './tsp';

// Geocoding using Nominatim (OpenStreetMap)
export async function geocodeAddress(address: string): Promise<Location | null> {
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
        address
      )}&limit=1`,
      {
        headers: {
          'User-Agent': 'SmartTravelPlanner/1.0',
        },
      }
    );

    const data = await response.json();

    if (data && data.length > 0) {
      return {
        id: crypto.randomUUID(),
        name: address,
        lat: parseFloat(data[0].lat),
        lng: parseFloat(data[0].lon),
        address: data[0].display_name,
      };
    }

    return null;
  } catch (error) {
    console.error('Geocoding error:', error);
    return null;
  }
}

// Search suggestions
export async function searchPlaces(query: string): Promise<Array<{ display_name: string; lat: string; lon: string }>> {
  if (query.length < 3) return [];

  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
        query
      )}&limit=5`,
      {
        headers: {
          'User-Agent': 'SmartTravelPlanner/1.0',
        },
      }
    );

    return await response.json();
  } catch (error) {
    console.error('Search error:', error);
    return [];
  }
}

// Sample locations for demo
export const SAMPLE_LOCATIONS: Location[] = [
  { id: '1', name: 'Central Station', lat: 40.7128, lng: -74.006, address: 'New York, NY' },
  { id: '2', name: 'City Park', lat: 40.7829, lng: -73.9654, address: 'Central Park, NY' },
  { id: '3', name: 'Downtown Mall', lat: 40.7484, lng: -73.9857, address: 'Midtown, NY' },
  { id: '4', name: 'Airport', lat: 40.6413, lng: -73.7781, address: 'JFK Airport, NY' },
  { id: '5', name: 'Harbor View', lat: 40.6892, lng: -74.0445, address: 'Statue of Liberty, NY' },
];
