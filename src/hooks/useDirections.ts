import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Location, VehicleType } from '@/lib/tsp';

export interface DirectionsLeg {
  startAddress: string;
  endAddress: string;
  distance: { value: number; text: string };
  duration: { value: number; text: string };
  durationInTraffic: { value: number; text: string };
  steps: {
    instruction: string;
    distance: { value: number; text: string };
    duration: { value: number; text: string };
    polyline: string;
  }[];
}

export interface DirectionsResult {
  overviewPolyline: string;
  bounds: {
    northeast: { lat: number; lng: number };
    southwest: { lat: number; lng: number };
  };
  legs: DirectionsLeg[];
  waypointOrder: number[];
  totalDistance: { value: number; text: string };
  totalDuration: { value: number; text: string };
  totalDurationInTraffic: { value: number; text: string };
  trafficDelay: number;
}

export function useDirections() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [directions, setDirections] = useState<DirectionsResult | null>(null);
  const [optimizedDirections, setOptimizedDirections] = useState<DirectionsResult | null>(null);

  const fetchDirections = async (
    locations: Location[],
    vehicleType: VehicleType,
    optimize: boolean = false
  ): Promise<DirectionsResult | null> => {
    if (locations.length < 2) {
      setError('At least 2 locations are required');
      return null;
    }

    setIsLoading(true);
    setError(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke('get-directions', {
        body: { locations, vehicleType, optimize },
      });

      if (fnError) {
        throw new Error(fnError.message);
      }

      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch directions');
      }

      return data.route as DirectionsResult;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch directions';
      setError(message);
      console.error('Directions error:', err);
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  const getRoutes = async (locations: Location[], vehicleType: VehicleType) => {
    setIsLoading(true);
    setError(null);

    try {
      // Fetch both original order and optimized routes in parallel
      const [originalRoute, optimizedRoute] = await Promise.all([
        fetchDirections(locations, vehicleType, false),
        fetchDirections(locations, vehicleType, true),
      ]);

      setDirections(originalRoute);
      setOptimizedDirections(optimizedRoute);

      return { original: originalRoute, optimized: optimizedRoute };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch routes';
      setError(message);
      return { original: null, optimized: null };
    } finally {
      setIsLoading(false);
    }
  };

  const clearDirections = () => {
    setDirections(null);
    setOptimizedDirections(null);
    setError(null);
  };

  return {
    isLoading,
    error,
    directions,
    optimizedDirections,
    getRoutes,
    clearDirections,
  };
}
