import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Location, OptimizationResult } from '@/lib/tsp';
import { DirectionsResult } from '@/hooks/useDirections';
import { decodePolyline } from '@/lib/polyline';
import { cn } from '@/lib/utils';

interface TravelMapProps {
  locations: Location[];
  optimizationResult: OptimizationResult | null;
  showOptimized: boolean;
  className?: string;
  directions?: DirectionsResult | null;
  optimizedDirections?: DirectionsResult | null;
}

export function TravelMap({ 
  locations, 
  optimizationResult, 
  showOptimized, 
  className,
  directions,
  optimizedDirections 
}: TravelMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const markersRef = useRef<L.Marker[]>([]);
  const originalLineRef = useRef<L.Polyline | null>(null);
  const optimizedLineRef = useRef<L.Polyline | null>(null);
  const [mapReady, setMapReady] = useState(false);

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current || map.current) return;

    map.current = L.map(mapContainer.current, {
      center: [40.7128, -74.006],
      zoom: 11,
      zoomControl: false,
    });

    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
      maxZoom: 19,
    }).addTo(map.current);

    L.control.zoom({ position: 'topright' }).addTo(map.current);

    setMapReady(true);

    return () => {
      map.current?.remove();
      map.current = null;
    };
  }, []);

  // Update markers and routes
  useEffect(() => {
    if (!map.current || !mapReady) return;

    // Clear existing markers
    markersRef.current.forEach((marker) => marker.remove());
    markersRef.current = [];

    // Clear existing lines
    originalLineRef.current?.remove();
    optimizedLineRef.current?.remove();
    originalLineRef.current = null;
    optimizedLineRef.current = null;

    if (locations.length === 0) return;

    // Determine which locations to show markers for (based on optimized order if available)
    const displayOrder = showOptimized && optimizedDirections?.waypointOrder 
      ? [0, ...optimizedDirections.waypointOrder.map(i => i + 1)]
      : locations.map((_, i) => i);

    // Add markers
    locations.forEach((location, index) => {
      const displayIndex = displayOrder.indexOf(index);
      const isFirst = index === 0;
      const markerHtml = `
        <div class="custom-marker ${isFirst ? 'marker-origin' : 'marker-destination'}">
          ${displayIndex !== -1 ? displayIndex + 1 : index + 1}
        </div>
      `;

      const icon = L.divIcon({
        html: markerHtml,
        className: '',
        iconSize: [32, 32],
        iconAnchor: [16, 16],
      });

      const marker = L.marker([location.lat, location.lng], { icon })
        .addTo(map.current!)
        .bindPopup(`
          <div class="p-2">
            <p class="font-semibold">${displayIndex + 1}. ${location.name}</p>
            ${location.address ? `<p class="text-xs text-gray-500">${location.address}</p>` : ''}
          </div>
        `);

      markersRef.current.push(marker);
    });

    const originalColor = 'hsl(0, 75%, 55%)';
    const optimizedColor = 'hsl(160, 85%, 40%)';

    // Draw routes using Google Directions polylines if available
    if (directions?.overviewPolyline || optimizedDirections?.overviewPolyline) {
      // Original route (red, dashed)
      if (directions?.overviewPolyline) {
        const decodedPath = decodePolyline(directions.overviewPolyline);
        originalLineRef.current = L.polyline(decodedPath, {
          color: originalColor,
          weight: 4,
          opacity: showOptimized ? 0.3 : 0.9,
          dashArray: showOptimized ? '10, 10' : undefined,
        }).addTo(map.current);
      }

      // Optimized route (green, solid)
      if (showOptimized && optimizedDirections?.overviewPolyline) {
        const decodedPath = decodePolyline(optimizedDirections.overviewPolyline);
        optimizedLineRef.current = L.polyline(decodedPath, {
          color: optimizedColor,
          weight: 5,
          opacity: 0.9,
        }).addTo(map.current);
      }
    } 
    // Fallback to straight lines if no directions available
    else if (optimizationResult && locations.length >= 2) {
      const createPath = (pathIndices: number[]): L.LatLngExpression[] => {
        const coords: L.LatLngExpression[] = pathIndices
          .filter((idx) => locations[idx] !== undefined)
          .map((idx) => [locations[idx].lat, locations[idx].lng]);
        if (coords.length > 0) {
          coords.push(coords[0]);
        }
        return coords;
      };

      const originalPath = createPath(optimizationResult.originalRoute.path);
      originalLineRef.current = L.polyline(originalPath, {
        color: originalColor,
        weight: 3,
        opacity: showOptimized ? 0.3 : 0.8,
        dashArray: '10, 10',
      }).addTo(map.current);

      if (showOptimized) {
        const optimizedPath = createPath(optimizationResult.optimizedRoute.path);
        optimizedLineRef.current = L.polyline(optimizedPath, {
          color: optimizedColor,
          weight: 4,
          opacity: 0.9,
        }).addTo(map.current);
      }
    }

    // Fit bounds to show all markers
    if (locations.length > 0) {
      const bounds = L.latLngBounds(
        locations.map((loc) => [loc.lat, loc.lng] as L.LatLngExpression)
      );
      map.current.fitBounds(bounds, { padding: [50, 50] });
    }
  }, [locations, optimizationResult, showOptimized, mapReady, directions, optimizedDirections]);

  // Check if we have live traffic data
  const hasTrafficData = directions?.trafficDelay !== undefined && directions.trafficDelay !== 0;
  const currentDirections = showOptimized ? optimizedDirections : directions;

  return (
    <div className={cn('relative w-full h-full min-h-[400px] rounded-xl overflow-hidden', className)}>
      <div ref={mapContainer} className="absolute inset-0" />
      
      {/* Traffic Info Badge */}
      {currentDirections && hasTrafficData && (
        <div className="absolute top-4 left-4 bg-card/95 backdrop-blur-sm border border-border rounded-lg px-3 py-2 shadow-lg z-[400]">
          <div className="flex items-center gap-2">
            <div className={cn(
              "w-2 h-2 rounded-full",
              currentDirections.trafficDelay > 300 ? "bg-red-500 animate-pulse" : 
              currentDirections.trafficDelay > 60 ? "bg-yellow-500" : "bg-green-500"
            )} />
            <span className="text-xs font-medium text-foreground">
              {currentDirections.trafficDelay > 0 
                ? `+${Math.round(currentDirections.trafficDelay / 60)} min traffic` 
                : 'No delays'}
            </span>
          </div>
        </div>
      )}

      {/* Live Route Info */}
      {currentDirections && (
        <div className="absolute top-4 right-14 bg-card/95 backdrop-blur-sm border border-border rounded-lg px-3 py-2 shadow-lg z-[400]">
          <div className="flex items-center gap-3 text-xs">
            <div>
              <span className="text-muted-foreground">Distance: </span>
              <span className="font-semibold text-foreground">{currentDirections.totalDistance.text}</span>
            </div>
            <div className="w-px h-4 bg-border" />
            <div>
              <span className="text-muted-foreground">ETA: </span>
              <span className="font-semibold text-foreground">{currentDirections.totalDurationInTraffic.text}</span>
            </div>
          </div>
        </div>
      )}
      
      {/* Map Legend */}
      {(optimizationResult || directions) && (
        <div className="absolute bottom-4 left-4 bg-card/95 backdrop-blur-sm border border-border rounded-lg p-3 shadow-lg z-[400]">
          <p className="text-xs font-semibold mb-2 text-foreground">Route Legend</p>
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <div className="w-6 h-0.5" style={{ 
                borderStyle: showOptimized ? 'dashed' : 'solid', 
                borderWidth: '2px', 
                borderColor: 'hsl(0, 75%, 55%)' 
              }} />
              <span className="text-xs text-muted-foreground">Original Route</span>
            </div>
            {showOptimized && (
              <div className="flex items-center gap-2">
                <div className="w-6 h-1 rounded-full" style={{ backgroundColor: 'hsl(160, 85%, 40%)' }} />
                <span className="text-xs text-muted-foreground">Optimized Route</span>
              </div>
            )}
          </div>
          {directions && (
            <div className="mt-2 pt-2 border-t border-border">
              <span className="text-xs text-green-600 font-medium">📍 Live Road Data</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
