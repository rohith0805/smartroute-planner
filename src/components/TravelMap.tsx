import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Location, OptimizationResult } from '@/lib/tsp';
import { cn } from '@/lib/utils';

interface TravelMapProps {
  locations: Location[];
  optimizationResult: OptimizationResult | null;
  showOptimized: boolean;
  className?: string;
}

export function TravelMap({ locations, optimizationResult, showOptimized, className }: TravelMapProps) {
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

    // Add markers
    locations.forEach((location, index) => {
      const isFirst = index === 0;
      const markerHtml = `
        <div class="custom-marker ${isFirst ? 'marker-origin' : 'marker-destination'}">
          ${index + 1}
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
            <p class="font-semibold">${index + 1}. ${location.name}</p>
            ${location.address ? `<p class="text-xs text-gray-500">${location.address}</p>` : ''}
          </div>
        `);

      markersRef.current.push(marker);
    });

    // Draw routes if we have optimization result
    if (optimizationResult && locations.length >= 2) {
      const createPath = (pathIndices: number[]): L.LatLngExpression[] => {
        const coords: L.LatLngExpression[] = pathIndices.map((idx) => [
          locations[idx].lat,
          locations[idx].lng,
        ]);
        // Close the loop
        if (coords.length > 0) {
          coords.push(coords[0]);
        }
        return coords;
      };

      // Original route (red, dashed)
      const originalPath = createPath(optimizationResult.originalRoute.path);
      originalLineRef.current = L.polyline(originalPath, {
        color: 'hsl(0, 75%, 55%)',
        weight: 3,
        opacity: showOptimized ? 0.3 : 0.8,
        dashArray: '10, 10',
      }).addTo(map.current);

      // Optimized route (green, solid)
      if (showOptimized) {
        const optimizedPath = createPath(optimizationResult.optimizedRoute.path);
        optimizedLineRef.current = L.polyline(optimizedPath, {
          color: 'hsl(160, 85%, 40%)',
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
  }, [locations, optimizationResult, showOptimized, mapReady]);

  return (
    <div className={cn('relative w-full h-full min-h-[400px] rounded-xl overflow-hidden', className)}>
      <div ref={mapContainer} className="absolute inset-0" />
      
      {/* Map Legend */}
      {optimizationResult && (
        <div className="absolute bottom-4 left-4 bg-card/95 backdrop-blur-sm border border-border rounded-lg p-3 shadow-lg z-[400]">
          <p className="text-xs font-semibold mb-2 text-foreground">Route Legend</p>
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <div className="w-6 h-0.5 bg-route-before border-dashed" style={{ borderStyle: 'dashed', borderWidth: '2px', borderColor: 'hsl(0, 75%, 55%)' }} />
              <span className="text-xs text-muted-foreground">Original Route</span>
            </div>
            {showOptimized && (
              <div className="flex items-center gap-2">
                <div className="w-6 h-1 rounded-full" style={{ backgroundColor: 'hsl(160, 85%, 40%)' }} />
                <span className="text-xs text-muted-foreground">Optimized Route</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
