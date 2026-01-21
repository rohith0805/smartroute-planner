import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Location {
  lat: number;
  lng: number;
  name: string;
}

interface DirectionsRequest {
  locations: Location[];
  vehicleType: 'car' | 'bike' | 'truck';
  optimize?: boolean;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const GOOGLE_MAPS_API_KEY = Deno.env.get('GOOGLE_MAPS_API_KEY');
    if (!GOOGLE_MAPS_API_KEY) {
      console.error('GOOGLE_MAPS_API_KEY not configured');
      return new Response(
        JSON.stringify({ error: 'Google Maps API key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { locations, vehicleType, optimize = false }: DirectionsRequest = await req.json();
    
    console.log('Received request:', { locationsCount: locations.length, vehicleType, optimize });

    if (!locations || locations.length < 2) {
      return new Response(
        JSON.stringify({ error: 'At least 2 locations are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Map vehicle type to Routes API travel mode
    const travelMode = vehicleType === 'bike' ? 'BICYCLE' : 'DRIVE';
    
    // Build origin and destination
    const origin = {
      location: {
        latLng: {
          latitude: locations[0].lat,
          longitude: locations[0].lng
        }
      }
    };

    // For round trip, destination is the origin
    const destination = {
      location: {
        latLng: {
          latitude: locations[0].lat,
          longitude: locations[0].lng
        }
      }
    };

    // Build intermediates (waypoints) - all locations except first
    const intermediates = locations.slice(1).map(loc => ({
      location: {
        latLng: {
          latitude: loc.lat,
          longitude: loc.lng
        }
      }
    }));

    // Build the Routes API request body
    const requestBody: any = {
      origin,
      destination,
      intermediates,
      travelMode,
      routingPreference: travelMode === 'DRIVE' ? 'TRAFFIC_AWARE_OPTIMAL' : 'ROUTING_PREFERENCE_UNSPECIFIED',
      computeAlternativeRoutes: false,
      languageCode: 'en-US',
      units: 'METRIC',
    };

    // Add optimization flag
    if (optimize && intermediates.length > 0) {
      requestBody.optimizeWaypointOrder = true;
    }

    console.log('Calling Google Routes API with', intermediates.length, 'waypoints, optimize:', optimize);

    // Use the Routes API
    const response = await fetch('https://routes.googleapis.com/directions/v2:computeRoutes', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': GOOGLE_MAPS_API_KEY,
        'X-Goog-FieldMask': 'routes.duration,routes.distanceMeters,routes.polyline.encodedPolyline,routes.legs,routes.optimizedIntermediateWaypointIndex,routes.viewport'
      },
      body: JSON.stringify(requestBody)
    });

    const data = await response.json();

    if (data.error) {
      console.error('Google Routes API error:', data.error.message);
      return new Response(
        JSON.stringify({ 
          error: `Google Routes API error: ${data.error.status || 'UNKNOWN'}`,
          details: data.error.message 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!data.routes || data.routes.length === 0) {
      console.error('No routes returned from API');
      return new Response(
        JSON.stringify({ error: 'No routes found between the locations' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const route = data.routes[0];
    
    // Parse duration (format: "1234s")
    const totalDurationSeconds = parseInt(route.duration?.replace('s', '') || '0');
    const totalDistanceMeters = route.distanceMeters || 0;

    // Process legs
    const legs = (route.legs || []).map((leg: any, index: number) => {
      const legDuration = parseInt(leg.duration?.replace('s', '') || '0');
      const legDistance = leg.distanceMeters || 0;
      
      return {
        startAddress: leg.startLocation?.latLng ? 
          `${leg.startLocation.latLng.latitude.toFixed(4)}, ${leg.startLocation.latLng.longitude.toFixed(4)}` : 
          'Unknown',
        endAddress: leg.endLocation?.latLng ? 
          `${leg.endLocation.latLng.latitude.toFixed(4)}, ${leg.endLocation.latLng.longitude.toFixed(4)}` : 
          'Unknown',
        distance: {
          value: legDistance,
          text: formatDistance(legDistance),
        },
        duration: {
          value: legDuration,
          text: formatDuration(legDuration),
        },
        durationInTraffic: {
          value: legDuration,
          text: formatDuration(legDuration),
        },
        polyline: leg.polyline?.encodedPolyline || '',
      };
    });

    // Get optimized waypoint order
    const waypointOrder = route.optimizedIntermediateWaypointIndex || 
      intermediates.map((_, i) => i);

    const result = {
      success: true,
      route: {
        overviewPolyline: route.polyline?.encodedPolyline || '',
        bounds: route.viewport || null,
        legs,
        waypointOrder,
        totalDistance: {
          value: totalDistanceMeters,
          text: formatDistance(totalDistanceMeters),
        },
        totalDuration: {
          value: totalDurationSeconds,
          text: formatDuration(totalDurationSeconds),
        },
        totalDurationInTraffic: {
          value: totalDurationSeconds,
          text: formatDuration(totalDurationSeconds),
        },
        trafficDelay: 0, // Routes API includes traffic in duration already
      },
    };

    console.log('Successfully fetched directions:', {
      distance: result.route.totalDistance.text,
      duration: result.route.totalDuration.text,
      waypointOrder: waypointOrder,
    });

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    console.error('Error in get-directions:', errorMessage);
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

function formatDistance(meters: number): string {
  if (meters >= 1000) {
    return `${(meters / 1000).toFixed(1)} km`;
  }
  return `${meters} m`;
}

function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  
  if (hours > 0) {
    return `${hours}h ${minutes}min`;
  }
  return `${minutes} min`;
}
