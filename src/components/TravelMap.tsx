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

// SVG arrow decorator pattern
const createArrowDecorator = (color: string) => {
  return `
    <svg width="12" height="12" viewBox="0 0 12 12" xmlns="http://www.w3.org/2000/svg">
      <polygon points="0,0 12,6 0,12" fill="${color}" />
    </svg>
  `;
};

// Add arrows along a polyline
function addArrowsToLine(
  map: L.Map,
  pathCoords: L.LatLngExpression[],
  color: string,
  arrowsGroup: L.LayerGroup
) {
  if (pathCoords.length < 2) return;

  for (let i = 0; i < pathCoords.length - 1; i++) {
    const start = pathCoords[i] as [number, number];
    const end = pathCoords[i + 1] as [number, number];

    // Calculate midpoint
    const midLat = (start[0] + end[0]) / 2;
    const midLng = (start[1] + end[1]) / 2;

    // Calculate angle
    const angle = Math.atan2(end[0] - start[0], end[1] - start[1]) * (180 / Math.PI);

    // Create arrow icon
    const arrowIcon = L.divIcon({
      html: `<div style="transform: rotate(${90 - angle}deg); display: flex; align-items: center; justify-content: center;">
        ${createArrowDecorator(color)}
      </div>`,
      className: 'arrow-icon',
      iconSize: [12, 12],
      iconAnchor: [6, 6],
    });

    const arrowMarker = L.marker([midLat, midLng], { icon: arrowIcon, interactive: false });
    arrowsGroup.addLayer(arrowMarker);
  }
}

export function TravelMap({ locations, optimizationResult, showOptimized, className }: TravelMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const markersRef = useRef<L.Marker[]>([]);
  const originalLineRef = useRef<L.Polyline | null>(null);
  const optimizedLineRef = useRef<L.Polyline | null>(null);
  const arrowsGroupRef = useRef<L.LayerGroup | null>(null);
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

    // Create arrows layer group
    arrowsGroupRef.current = L.layerGroup().addTo(map.current);

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

    // Clear arrows
    arrowsGroupRef.current?.clearLayers();

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
        const coords: L.LatLngExpression[] = pathIndices
          .filter((idx) => locations[idx] !== undefined)
          .map((idx) => [locations[idx].lat, locations[idx].lng]);
        // Close the loop
        if (coords.length > 0) {
          coords.push(coords[0]);
        }
        return coords;
      };

      const originalColor = 'hsl(0, 75%, 55%)';
      const optimizedColor = 'hsl(160, 85%, 40%)';

      // Original route (red, dashed)
      const originalPath = createPath(optimizationResult.originalRoute.path);
      originalLineRef.current = L.polyline(originalPath, {
        color: originalColor,
        weight: 3,
        opacity: showOptimized ? 0.3 : 0.8,
        dashArray: '10, 10',
      }).addTo(map.current);

      // Add arrows to original route (only if not showing optimized)
      if (!showOptimized && arrowsGroupRef.current) {
        addArrowsToLine(map.current, originalPath, originalColor, arrowsGroupRef.current);
      }

      // Optimized route (green, solid)
      if (showOptimized) {
        const optimizedPath = createPath(optimizationResult.optimizedRoute.path);
        optimizedLineRef.current = L.polyline(optimizedPath, {
          color: optimizedColor,
          weight: 4,
          opacity: 0.9,
        }).addTo(map.current);

        // Add arrows to optimized route
        if (arrowsGroupRef.current) {
          addArrowsToLine(map.current, optimizedPath, optimizedColor, arrowsGroupRef.current);
        }
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
