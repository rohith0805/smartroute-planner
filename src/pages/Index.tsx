import React, { useState, useCallback, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Location, VehicleType, OptimizationResult, solveTSP } from '@/lib/tsp';
import { SAMPLE_LOCATIONS } from '@/lib/geocoding';
import { TravelMap } from '@/components/TravelMap';
import { LocationInput } from '@/components/LocationInput';
import { VehicleSelector } from '@/components/VehicleSelector';
import { RouteComparison } from '@/components/RouteComparison';
import { SaveTripDialog } from '@/components/SaveTripDialog';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence } from 'framer-motion';
import { MapPin, Route, Sparkles, RotateCcw, Loader2, Navigation, User, FolderOpen, LogOut } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { useDirections } from '@/hooks/useDirections';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const Index = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, signOut } = useAuth();
  const [locations, setLocations] = useState<Location[]>([]);
  const [vehicleType, setVehicleType] = useState<VehicleType>('car');
  const [optimizationResult, setOptimizationResult] = useState<OptimizationResult | null>(null);
  const [showOptimized, setShowOptimized] = useState(true);
  const [isOptimizing, setIsOptimizing] = useState(false);

  const { 
    isLoading: isLoadingDirections, 
    directions, 
    optimizedDirections, 
    getRoutes,
    clearDirections 
  } = useDirections();

  // Load trip from navigation state
  useEffect(() => {
    const state = location.state as { loadedTrip?: { locations: Location[]; vehicleType: VehicleType; optimizationResult: OptimizationResult } } | null;
    if (state?.loadedTrip) {
      setLocations(state.loadedTrip.locations);
      setVehicleType(state.loadedTrip.vehicleType);
      setOptimizationResult(state.loadedTrip.optimizationResult);
      setShowOptimized(true);
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  const handleOptimize = useCallback(async () => {
    if (locations.length < 2) {
      toast.error('Please add at least 2 destinations to optimize');
      return;
    }

    setIsOptimizing(true);
    
    try {
      // Fetch live directions from Google Maps
      const { original, optimized } = await getRoutes(locations, vehicleType);
      
      if (original && optimized) {
        // Calculate savings from live data
        const savingsDistance = (original.totalDistance.value - optimized.totalDistance.value) / 1000; // km
        const savingsTime = (original.totalDuration.value - optimized.totalDuration.value) / 60; // minutes
        const savingsPercentage = (savingsDistance / (original.totalDistance.value / 1000)) * 100;

        // Create optimization result with live data
        const liveResult: OptimizationResult = {
          originalRoute: {
            path: locations.map((_, i) => i),
            totalDistance: original.totalDistance.value / 1000, // Convert to km
            estimatedTime: original.totalDurationInTraffic.value / 60, // Convert to minutes
          },
          optimizedRoute: {
            path: [0, ...optimized.waypointOrder.map(i => i + 1)],
            totalDistance: optimized.totalDistance.value / 1000,
            estimatedTime: optimized.totalDurationInTraffic.value / 60,
          },
          savingsDistance: Math.max(0, savingsDistance),
          savingsTime: Math.max(0, savingsTime),
          savingsPercentage: Math.max(0, savingsPercentage),
        };

        setOptimizationResult(liveResult);
        setShowOptimized(true);

        if (savingsPercentage > 0) {
          toast.success(`Route optimized! Save ${savingsPercentage.toFixed(1)}% travel distance with live traffic data`);
        } else {
          toast.info('Your route is already optimal based on current traffic!');
        }
      } else {
        // Fallback to TSP calculation if API fails
        const result = solveTSP(locations, vehicleType);
        setOptimizationResult(result);
        setShowOptimized(true);
        toast.info('Using estimated route (live data unavailable)');
      }
    } catch (error) {
      console.error('Optimization error:', error);
      // Fallback to TSP
      const result = solveTSP(locations, vehicleType);
      setOptimizationResult(result);
      setShowOptimized(true);
      toast.warning('Using estimated route - live traffic unavailable');
    } finally {
      setIsOptimizing(false);
    }
  }, [locations, vehicleType, getRoutes]);

  const handleReset = () => {
    setLocations([]);
    setOptimizationResult(null);
    clearDirections();
    setShowOptimized(true);
    toast.info('All destinations cleared');
  };

  const handleLoadSample = () => {
    setLocations(SAMPLE_LOCATIONS);
    setOptimizationResult(null);
    clearDirections();
    toast.success('Sample locations loaded');
  };

  const handleSignOut = async () => {
    await signOut();
    toast.success('Signed out successfully');
  };

  const isLoading = isOptimizing || isLoadingDirections;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 glass-strong border-b border-border/50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gradient-to-br from-primary to-accent rounded-xl">
                <Navigation className="w-6 h-6 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-foreground">Smart Travel Planner</h1>
                <p className="text-xs text-muted-foreground">Live Route Optimization</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleLoadSample}
                className="hidden sm:flex"
              >
                <MapPin className="w-4 h-4 mr-2" />
                Load Sample
              </Button>
              
              {user ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="gap-2">
                      <User className="w-4 h-4" />
                      <span className="hidden sm:inline">{user.email?.split('@')[0]}</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => navigate('/saved-trips')}>
                      <FolderOpen className="w-4 h-4 mr-2" />
                      Saved Trips
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={handleSignOut}>
                      <LogOut className="w-4 h-4 mr-2" />
                      Sign Out
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : (
                <Button variant="outline" size="sm" onClick={() => navigate('/auth')}>
                  <User className="w-4 h-4 mr-2" />
                  Sign In
                </Button>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        <div className="grid lg:grid-cols-[400px_1fr] gap-6 h-[calc(100vh-120px)]">
          {/* Sidebar */}
          <div className="space-y-6 overflow-y-auto pb-6">
            {/* Vehicle Selection */}
            <motion.section
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="p-5 bg-card border border-border rounded-2xl shadow-md"
            >
              <div className="flex items-center gap-2 mb-4">
                <Route className="w-5 h-5 text-accent" />
                <h2 className="font-semibold text-foreground">Select Vehicle</h2>
              </div>
              <VehicleSelector selected={vehicleType} onSelect={setVehicleType} />
            </motion.section>

            {/* Destinations */}
            <motion.section
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="p-5 bg-card border border-border rounded-2xl shadow-md"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <MapPin className="w-5 h-5 text-accent" />
                  <h2 className="font-semibold text-foreground">Destinations</h2>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleLoadSample}
                  className="text-xs sm:hidden"
                >
                  Load Sample
                </Button>
              </div>
              <LocationInput
                locations={locations}
                onLocationsChange={setLocations}
              />
            </motion.section>

            {/* Actions */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="flex gap-3"
            >
              <Button
                onClick={handleOptimize}
                disabled={locations.length < 2 || isLoading}
                className="flex-1 h-12 bg-gradient-to-r from-accent to-accent/80 hover:from-accent/90 hover:to-accent/70 text-accent-foreground font-semibold shadow-lg shadow-accent/20"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    {isLoadingDirections ? 'Getting live routes...' : 'Optimizing...'}
                  </>
                ) : (
                  <>
                    <Sparkles className="w-5 h-5 mr-2" />
                    Get Live Route
                  </>
                )}
              </Button>
              <Button
                variant="outline"
                onClick={handleReset}
                disabled={locations.length === 0}
                className="h-12 px-4"
              >
                <RotateCcw className="w-5 h-5" />
              </Button>
            </motion.div>

            {/* Results */}
            <AnimatePresence mode="wait">
              {optimizationResult && (
                <motion.section
                  key="results"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="p-5 bg-card border border-border rounded-2xl shadow-md"
                >
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-5 h-5 text-accent" />
                      <h2 className="font-semibold text-foreground">Route Comparison</h2>
                      {directions && (
                        <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
                          Live
                        </span>
                      )}
                    </div>
                    <SaveTripDialog
                      locations={locations}
                      vehicleType={vehicleType}
                      optimizationResult={optimizationResult}
                    />
                  </div>
                  <RouteComparison
                    result={optimizationResult}
                    locations={locations}
                    showOptimized={showOptimized}
                    onToggleView={setShowOptimized}
                  />
                </motion.section>
              )}
            </AnimatePresence>
          </div>

          {/* Map */}
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2 }}
            className="relative bg-card border border-border rounded-2xl shadow-xl overflow-hidden"
          >
            <TravelMap
              locations={locations}
              optimizationResult={optimizationResult}
              showOptimized={showOptimized}
              directions={directions}
              optimizedDirections={optimizedDirections}
            />
            
            {/* Empty State Overlay */}
            {locations.length === 0 && (
              <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-muted/80 to-muted/60 backdrop-blur-sm">
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="text-center p-8"
                >
                  <div className="inline-flex p-4 bg-gradient-to-br from-primary to-accent rounded-2xl mb-4 animate-float">
                    <MapPin className="w-10 h-10 text-primary-foreground" />
                  </div>
                  <h3 className="text-xl font-bold text-foreground mb-2">Plan Your Journey</h3>
                  <p className="text-muted-foreground max-w-xs">
                    Add destinations to get live routes with real-time traffic data
                  </p>
                </motion.div>
              </div>
            )}
          </motion.div>
        </div>
      </main>
    </div>
  );
};

export default Index;
