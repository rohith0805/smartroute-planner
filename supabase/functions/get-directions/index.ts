import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Require authenticated user
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return new Response(
      JSON.stringify({ error: 'Unauthorized' }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
  const supabaseAuth = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } }
  );
  const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();
  if (authError || !user) {
    return new Response(
      JSON.stringify({ error: 'Unauthorized' }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
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

    const travelMode = vehicleType === 'bike' ? 'BICYCLE' : 'DRIVE';

    const origin = {
      location: { latLng: { latitude: locations[0].lat, longitude: locations[0].lng } }
    };
    const destination = {
      location: { latLng: { latitude: locations[0].lat, longitude: locations[0].lng } }
    };
    const intermediates = locations.slice(1).map(loc => ({
      location: { latLng: { latitude: loc.lat, longitude: loc.lng } }
    }));

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

    if (optimize && intermediates.length > 0) {
      requestBody.optimizeWaypointOrder = true;
    }

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

    if (data?.error) {
      const status = String(data.error.status || 'UNKNOWN');
      const message = String(data.error.message || 'Unknown error');
      console.error('Google Routes API error:', message);
      return new Response(
        JSON.stringify({ success: false, error: `Google Routes API error: ${status}`, details: message, code: status }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!data.routes || data.routes.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: 'No routes found between the locations' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const route = data.routes[0];
    const totalDurationSeconds = parseInt(route.duration?.replace('s', '') || '0');
    const totalDistanceMeters = route.distanceMeters || 0;

    const legs = (route.legs || []).map((leg: any) => {
      const legDuration = parseInt(leg.duration?.replace('s', '') || '0');
      const legDistance = leg.distanceMeters || 0;
      return {
        startAddress: leg.startLocation?.latLng ? `${leg.startLocation.latLng.latitude.toFixed(4)}, ${leg.startLocation.latLng.longitude.toFixed(4)}` : 'Unknown',
        endAddress: leg.endLocation?.latLng ? `${leg.endLocation.latLng.latitude.toFixed(4)}, ${leg.endLocation.latLng.longitude.toFixed(4)}` : 'Unknown',
        distance: { value: legDistance, text: formatDistance(legDistance) },
        duration: { value: legDuration, text: formatDuration(legDuration) },
        durationInTraffic: { value: legDuration, text: formatDuration(legDuration) },
        polyline: leg.polyline?.encodedPolyline || '',
      };
    });

    const waypointOrder = route.optimizedIntermediateWaypointIndex || intermediates.map((_, i) => i);

    const result = {
      success: true,
      route: {
        overviewPolyline: route.polyline?.encodedPolyline || '',
        bounds: route.viewport || null,
        legs,
        waypointOrder,
        totalDistance: { value: totalDistanceMeters, text: formatDistance(totalDistanceMeters) },
        totalDuration: { value: totalDurationSeconds, text: formatDuration(totalDurationSeconds) },
        totalDurationInTraffic: { value: totalDurationSeconds, text: formatDuration(totalDurationSeconds) },
        trafficDelay: 0,
      },
    };

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
  if (meters >= 1000) return `${(meters / 1000).toFixed(1)} km`;
  return `${meters} m`;
}

function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) return `${hours}h ${minutes}min`;
  return `${minutes} min`;
}
