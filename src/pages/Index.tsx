import React, { useState, useCallback } from 'react';
import { Location, VehicleType, OptimizationResult, solveTSP } from '@/lib/tsp';
import { SAMPLE_LOCATIONS } from '@/lib/geocoding';
import { TravelMap } from '@/components/TravelMap';
import { LocationInput } from '@/components/LocationInput';
import { VehicleSelector } from '@/components/VehicleSelector';
import { RouteComparison } from '@/components/RouteComparison';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence } from 'framer-motion';
import { MapPin, Route, Sparkles, RotateCcw, Loader2, Navigation } from 'lucide-react';
import { toast } from 'sonner';

const Index = () => {
  const [locations, setLocations] = useState<Location[]>([]);
  const [vehicleType, setVehicleType] = useState<VehicleType>('car');
  const [optimizationResult, setOptimizationResult] = useState<OptimizationResult | null>(null);
  const [showOptimized, setShowOptimized] = useState(true);
  const [isOptimizing, setIsOptimizing] = useState(false);

  const handleOptimize = useCallback(async () => {
    if (locations.length < 2) {
      toast.error('Please add at least 2 destinations to optimize');
      return;
    }

    setIsOptimizing(true);
    
    // Simulate processing time for UX
    await new Promise((resolve) => setTimeout(resolve, 800));

    const result = solveTSP(locations, vehicleType);
    setOptimizationResult(result);
    setShowOptimized(true);
    setIsOptimizing(false);

    if (result && result.savingsPercentage > 0) {
      toast.success(`Route optimized! Save ${result.savingsPercentage.toFixed(1)}% travel distance`);
    } else if (result) {
      toast.info('Your route is already optimally ordered!');
    }
  }, [locations, vehicleType]);

  const handleReset = () => {
    setLocations([]);
    setOptimizationResult(null);
    setShowOptimized(true);
    toast.info('All destinations cleared');
  };

  const handleLoadSample = () => {
    setLocations(SAMPLE_LOCATIONS);
    setOptimizationResult(null);
    toast.success('Sample locations loaded');
  };

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
                <p className="text-xs text-muted-foreground">TSP Route Optimization</p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleLoadSample}
              className="hidden sm:flex"
            >
              <MapPin className="w-4 h-4 mr-2" />
              Load Sample
            </Button>
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
                disabled={locations.length < 2 || isOptimizing}
                className="flex-1 h-12 bg-gradient-to-r from-accent to-accent/80 hover:from-accent/90 hover:to-accent/70 text-accent-foreground font-semibold shadow-lg shadow-accent/20"
              >
                {isOptimizing ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Optimizing...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-5 h-5 mr-2" />
                    Optimize Route
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
                  <div className="flex items-center gap-2 mb-4">
                    <Sparkles className="w-5 h-5 text-accent" />
                    <h2 className="font-semibold text-foreground">Route Comparison</h2>
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
                    Add destinations to visualize your route and find the most efficient path
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
