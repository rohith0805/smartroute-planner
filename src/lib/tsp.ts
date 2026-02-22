export interface Location {
  id: string;
  name: string;
  lat: number;
  lng: number;
  address?: string;
}

export type VehicleType = 'car' | 'bike' | 'truck';

export interface LegDetail {
  fromIndex: number;
  toIndex: number;
  distance: number; // km
  time: number; // minutes
}

export interface RouteResult {
  path: number[];
  totalDistance: number;
  estimatedTime: number;
  legs: LegDetail[];
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
  truck: 35, // Big vehicles move slower
};

// Time spent at each stop/destination (minutes)
const STOP_TIME_MINUTES = 5;

// Road distance correction factor: real road distance is typically 1.3-1.4x straight-line distance
const ROAD_CORRECTION_FACTOR = 1.35;

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

// 2-opt optimization with fixed start (index 0 stays in place)
export function twoOptOptimizationFixedStart(
  path: number[],
  distanceMatrix: number[][]
): number[] {
  if (path.length < 3) return path;

  let improved = true;
  let bestPath = [...path];
  let bestDistance = calculateTotalDistance(bestPath, distanceMatrix);

  while (improved) {
    improved = false;

    // Start from i=1 to keep index 0 (starting destination) fixed
    for (let i = 1; i < bestPath.length - 1; i++) {
      for (let j = i + 1; j < bestPath.length; j++) {
        const newPath = twoOptSwap(bestPath, i - 1, j);
        // Ensure start is still 0
        if (newPath[0] !== path[0]) continue;
        const newDistance = calculateTotalDistance(newPath, distanceMatrix);

        if (newDistance < bestDistance - 0.0001) {
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

  // Helper to compute legs for a path
  const computeLegs = (path: number[]): LegDetail[] => {
    const legs: LegDetail[] = [];
    for (let i = 0; i < path.length - 1; i++) {
      const dist = distanceMatrix[path[i]][path[i + 1]] * ROAD_CORRECTION_FACTOR;
      legs.push({
        fromIndex: path[i],
        toIndex: path[i + 1],
        distance: dist,
        time: (dist / speed) * 60,
      });
    }
    // Return to start
    if (path.length > 1) {
      const dist = distanceMatrix[path[path.length - 1]][path[0]] * ROAD_CORRECTION_FACTOR;
      legs.push({
        fromIndex: path[path.length - 1],
        toIndex: path[0],
        distance: dist,
        time: (dist / speed) * 60,
      });
    }
    return legs;
  };

  // Original route (user input order)
  const originalPath = locations.map((_, idx) => idx);
  const originalLegs = computeLegs(originalPath);
  const originalDistance = originalLegs.reduce((sum, l) => sum + l.distance, 0);
  const originalDrivingTime = originalLegs.reduce((sum, l) => sum + l.time, 0);
  // Add stop time: each intermediate destination adds stop time
  const originalStopTime = (n - 1) * STOP_TIME_MINUTES; // stops at each destination except start
  const originalTime = originalDrivingTime + originalStopTime;

  let optimizedPath: number[];

  // Use brute force for small sets (up to 8 locations), otherwise use heuristics
  // IMPORTANT: Always keep index 0 as the fixed starting destination
  if (n <= 8) {
    optimizedPath = bruteForceOptimize(distanceMatrix);
  } else {
    // Always start from index 0 (the user's chosen starting point)
    const initialPath = nearestNeighborTSP(distanceMatrix, 0);

    // Apply 2-opt optimization while preserving start
    optimizedPath = twoOptOptimizationFixedStart(initialPath, distanceMatrix);
  }

  // Ensure the path always starts from index 0
  if (optimizedPath[0] !== 0) {
    const startIdx = optimizedPath.indexOf(0);
    if (startIdx > 0) {
      optimizedPath = [...optimizedPath.slice(startIdx), ...optimizedPath.slice(0, startIdx)];
    }
  }

  const optimizedLegs = computeLegs(optimizedPath);
  const optimizedDistance = optimizedLegs.reduce((sum, l) => sum + l.distance, 0);
  const optimizedDrivingTime = optimizedLegs.reduce((sum, l) => sum + l.time, 0);
  const optimizedStopTime = (n - 1) * STOP_TIME_MINUTES;
  const optimizedTime = optimizedDrivingTime + optimizedStopTime;

  const savingsDistance = originalDistance - optimizedDistance;
  const savingsTime = originalTime - optimizedTime;
  const savingsPercentage =
    originalDistance > 0 ? (savingsDistance / originalDistance) * 100 : 0;

  return {
    originalRoute: {
      path: originalPath,
      totalDistance: originalDistance,
      estimatedTime: originalTime,
      legs: originalLegs,
    },
    optimizedRoute: {
      path: optimizedPath,
      totalDistance: optimizedDistance,
      estimatedTime: optimizedTime,
      legs: optimizedLegs,
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
