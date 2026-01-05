export interface Location {
  id: string;
  name: string;
  lat: number;
  lng: number;
  address?: string;
}

export type VehicleType = 'car' | 'bike';

export interface RouteResult {
  path: number[];
  totalDistance: number;
  estimatedTime: number;
}

export interface OptimizationResult {
  originalRoute: RouteResult;
  optimizedRoute: RouteResult;
  savingsDistance: number;
  savingsTime: number;
  savingsPercentage: number;
}

// Speed factors based on vehicle type (km/h)
export const VEHICLE_SPEEDS: Record<VehicleType, number> = {
  car: 45, // Average city speed
  bike: 25,
};

// Calculate distance between two points using Haversine formula
export function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth's radius in km
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(deg: number): number {
  return deg * (Math.PI / 180);
}

// Create distance matrix
export function createDistanceMatrix(locations: Location[]): number[][] {
  const n = locations.length;
  const matrix: number[][] = [];

  for (let i = 0; i < n; i++) {
    matrix[i] = [];
    for (let j = 0; j < n; j++) {
      if (i === j) {
        matrix[i][j] = 0;
      } else {
        matrix[i][j] = calculateDistance(
          locations[i].lat,
          locations[i].lng,
          locations[j].lat,
          locations[j].lng
        );
      }
    }
  }

  return matrix;
}

// Calculate total distance for a given path
export function calculateTotalDistance(
  path: number[],
  distanceMatrix: number[][]
): number {
  let total = 0;
  for (let i = 0; i < path.length - 1; i++) {
    total += distanceMatrix[path[i]][path[i + 1]];
  }
  // Return to start
  if (path.length > 1) {
    total += distanceMatrix[path[path.length - 1]][path[0]];
  }
  return total;
}

// Nearest Neighbor Algorithm - creates initial route
export function nearestNeighborTSP(distanceMatrix: number[][]): number[] {
  const n = distanceMatrix.length;
  if (n === 0) return [];
  if (n === 1) return [0];

  const visited = new Set<number>([0]);
  const path: number[] = [0];

  while (visited.size < n) {
    const current = path[path.length - 1];
    let nearestDist = Infinity;
    let nearestCity = -1;

    for (let i = 0; i < n; i++) {
      if (!visited.has(i) && distanceMatrix[current][i] < nearestDist) {
        nearestDist = distanceMatrix[current][i];
        nearestCity = i;
      }
    }

    if (nearestCity !== -1) {
      visited.add(nearestCity);
      path.push(nearestCity);
    }
  }

  return path;
}

// 2-opt optimization - improves the route
export function twoOptOptimization(
  path: number[],
  distanceMatrix: number[][]
): number[] {
  if (path.length < 4) return path;

  let improved = true;
  let bestPath = [...path];
  let bestDistance = calculateTotalDistance(bestPath, distanceMatrix);

  while (improved) {
    improved = false;

    for (let i = 1; i < bestPath.length - 1; i++) {
      for (let j = i + 1; j < bestPath.length; j++) {
        const newPath = twoOptSwap(bestPath, i, j);
        const newDistance = calculateTotalDistance(newPath, distanceMatrix);

        if (newDistance < bestDistance) {
          bestPath = newPath;
          bestDistance = newDistance;
          improved = true;
        }
      }
    }
  }

  return bestPath;
}

// Helper function for 2-opt swap
function twoOptSwap(path: number[], i: number, j: number): number[] {
  const newPath = path.slice(0, i);
  const reversedSegment = path.slice(i, j + 1).reverse();
  const endSegment = path.slice(j + 1);
  return [...newPath, ...reversedSegment, ...endSegment];
}

// Main TSP solver
export function solveTSP(
  locations: Location[],
  vehicleType: VehicleType
): OptimizationResult | null {
  if (locations.length < 2) return null;

  const distanceMatrix = createDistanceMatrix(locations);
  const speed = VEHICLE_SPEEDS[vehicleType];

  // Original route (user input order)
  const originalPath = locations.map((_, idx) => idx);
  const originalDistance = calculateTotalDistance(originalPath, distanceMatrix);
  const originalTime = (originalDistance / speed) * 60; // Convert to minutes

  // Get optimized route using Nearest Neighbor + 2-opt
  const nnPath = nearestNeighborTSP(distanceMatrix);
  const optimizedPath = twoOptOptimization(nnPath, distanceMatrix);
  const optimizedDistance = calculateTotalDistance(optimizedPath, distanceMatrix);
  const optimizedTime = (optimizedDistance / speed) * 60;

  const savingsDistance = originalDistance - optimizedDistance;
  const savingsTime = originalTime - optimizedTime;
  const savingsPercentage =
    originalDistance > 0 ? (savingsDistance / originalDistance) * 100 : 0;

  return {
    originalRoute: {
      path: originalPath,
      totalDistance: originalDistance,
      estimatedTime: originalTime,
    },
    optimizedRoute: {
      path: optimizedPath,
      totalDistance: optimizedDistance,
      estimatedTime: optimizedTime,
    },
    savingsDistance: Math.max(0, savingsDistance),
    savingsTime: Math.max(0, savingsTime),
    savingsPercentage: Math.max(0, savingsPercentage),
  };
}

// Format distance for display
export function formatDistance(km: number): string {
  if (km < 1) {
    return `${Math.round(km * 1000)} m`;
  }
  return `${km.toFixed(1)} km`;
}

// Format time for display
export function formatTime(minutes: number): string {
  if (minutes < 60) {
    return `${Math.round(minutes)} min`;
  }
  const hours = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  return `${hours}h ${mins}m`;
}
