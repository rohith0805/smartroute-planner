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

// Nearest Neighbor Algorithm - creates initial route from a given starting point
export function nearestNeighborTSP(distanceMatrix: number[][], startCity: number = 0): number[] {
  const n = distanceMatrix.length;
  if (n === 0) return [];
  if (n === 1) return [0];

  const visited = new Set<number>([startCity]);
  const path: number[] = [startCity];

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
  if (path.length < 3) return path;

  let improved = true;
  let bestPath = [...path];
  let bestDistance = calculateTotalDistance(bestPath, distanceMatrix);

  while (improved) {
    improved = false;

    for (let i = 0; i < bestPath.length - 1; i++) {
      for (let j = i + 2; j < bestPath.length; j++) {
        const newPath = twoOptSwap(bestPath, i, j);
        const newDistance = calculateTotalDistance(newPath, distanceMatrix);

        if (newDistance < bestDistance - 0.0001) { // Small epsilon for floating point
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
  const newPath = path.slice(0, i + 1);
  const reversedSegment = path.slice(i + 1, j + 1).reverse();
  const endSegment = path.slice(j + 1);
  return [...newPath, ...reversedSegment, ...endSegment];
}

// Brute force for small number of locations (factorial complexity but fast for n <= 8)
function bruteForceOptimize(distanceMatrix: number[][]): number[] {
  const n = distanceMatrix.length;
  if (n <= 1) return [0];
  if (n === 2) return [0, 1];

  // Generate all permutations starting from city 0
  const cities = Array.from({ length: n - 1 }, (_, i) => i + 1);
  const permutations = getPermutations(cities);
  
  let bestPath = [0, ...cities];
  let bestDistance = calculateTotalDistance(bestPath, distanceMatrix);

  for (const perm of permutations) {
    const path = [0, ...perm];
    const distance = calculateTotalDistance(path, distanceMatrix);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestPath = path;
    }
  }

  return bestPath;
}

// Generate all permutations of an array
function getPermutations(arr: number[]): number[][] {
  if (arr.length <= 1) return [arr];
  
  const result: number[][] = [];
  
  for (let i = 0; i < arr.length; i++) {
    const current = arr[i];
    const remaining = [...arr.slice(0, i), ...arr.slice(i + 1)];
    const perms = getPermutations(remaining);
    
    for (const perm of perms) {
      result.push([current, ...perm]);
    }
  }
  
  return result;
}

// Main TSP solver
export function solveTSP(
  locations: Location[],
  vehicleType: VehicleType
): OptimizationResult | null {
  if (locations.length < 2) return null;

  const distanceMatrix = createDistanceMatrix(locations);
  const speed = VEHICLE_SPEEDS[vehicleType];
  const n = locations.length;

  // Original route (user input order)
  const originalPath = locations.map((_, idx) => idx);
  const originalDistance = calculateTotalDistance(originalPath, distanceMatrix);
  const originalTime = (originalDistance / speed) * 60; // Convert to minutes

  let optimizedPath: number[];

  // Use brute force for small sets (up to 8 locations), otherwise use heuristics
  if (n <= 8) {
    optimizedPath = bruteForceOptimize(distanceMatrix);
  } else {
    // Try nearest neighbor from multiple starting points and pick the best
    let bestPath = nearestNeighborTSP(distanceMatrix, 0);
    let bestDistance = calculateTotalDistance(bestPath, distanceMatrix);

    for (let start = 1; start < Math.min(n, 5); start++) {
      const path = nearestNeighborTSP(distanceMatrix, start);
      const distance = calculateTotalDistance(path, distanceMatrix);
      if (distance < bestDistance) {
        bestDistance = distance;
        bestPath = path;
      }
    }

    // Apply 2-opt optimization
    optimizedPath = twoOptOptimization(bestPath, distanceMatrix);
  }

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
