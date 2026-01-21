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

    // Map vehicle type to Google's travel mode
    const travelMode = vehicleType === 'bike' ? 'bicycling' : 'driving';
    
    // Build origin, destination, and waypoints
    const origin = `${locations[0].lat},${locations[0].lng}`;
    const destination = `${locations[locations.length - 1].lat},${locations[locations.length - 1].lng}`;
    
    // If it's a round trip, destination should be the origin
    const isRoundTrip = true;
    const finalDestination = isRoundTrip ? origin : destination;
    
    // Waypoints (all locations except first for round trip, or except first and last otherwise)
    const waypointLocations = isRoundTrip 
      ? locations.slice(1) 
      : locations.slice(1, -1);
    
    const waypoints = waypointLocations
      .map(loc => `${loc.lat},${loc.lng}`)
      .join('|');

    // Build the API URL
    let apiUrl = `https://maps.googleapis.com/maps/api/directions/json?origin=${origin}&destination=${finalDestination}&mode=${travelMode}&key=${GOOGLE_MAPS_API_KEY}&departure_time=now`;
    
    if (waypoints) {
      // optimize:true asks Google to reorder waypoints for best route
      const waypointPrefix = optimize ? 'optimize:true|' : '';
      apiUrl += `&waypoints=${waypointPrefix}${waypoints}`;
    }

    // Add traffic model for driving
    if (travelMode === 'driving') {
      apiUrl += '&traffic_model=best_guess';
    }

    console.log('Calling Google Directions API...');
    const response = await fetch(apiUrl);
    const data = await response.json();

    if (data.status !== 'OK') {
      console.error('Google API error:', data.status, data.error_message);
      return new Response(
        JSON.stringify({ 
          error: `Google Maps API error: ${data.status}`,
          details: data.error_message 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const route = data.routes[0];
    
    // Calculate totals
    let totalDistance = 0;
    let totalDuration = 0;
    let totalDurationInTraffic = 0;

    const legs = route.legs.map((leg: any, index: number) => {
      totalDistance += leg.distance.value;
      totalDuration += leg.duration.value;
      if (leg.duration_in_traffic) {
        totalDurationInTraffic += leg.duration_in_traffic.value;
      } else {
        totalDurationInTraffic += leg.duration.value;
      }

      return {
        startAddress: leg.start_address,
        endAddress: leg.end_address,
        distance: leg.distance,
        duration: leg.duration,
        durationInTraffic: leg.duration_in_traffic || leg.duration,
        steps: leg.steps.map((step: any) => ({
          instruction: step.html_instructions,
          distance: step.distance,
          duration: step.duration,
          polyline: step.polyline.points,
        })),
      };
    });

    // Get waypoint order if optimized
    const waypointOrder = route.waypoint_order || waypointLocations.map((_, i) => i);

    const result = {
      success: true,
      route: {
        overviewPolyline: route.overview_polyline.points,
        bounds: route.bounds,
        legs,
        waypointOrder,
        totalDistance: {
          value: totalDistance,
          text: formatDistance(totalDistance),
        },
        totalDuration: {
          value: totalDuration,
          text: formatDuration(totalDuration),
        },
        totalDurationInTraffic: {
          value: totalDurationInTraffic,
          text: formatDuration(totalDurationInTraffic),
        },
        trafficDelay: totalDurationInTraffic - totalDuration,
      },
    };

    console.log('Successfully fetched directions:', {
      distance: result.route.totalDistance.text,
      duration: result.route.totalDuration.text,
      durationInTraffic: result.route.totalDurationInTraffic.text,
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
