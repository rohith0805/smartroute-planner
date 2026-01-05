import React from 'react';
import { OptimizationResult, formatDistance, formatTime, Location } from '@/lib/tsp';
import { motion } from 'framer-motion';
import { TrendingDown, Clock, Route, ArrowRight, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

interface RouteComparisonProps {
  result: OptimizationResult;
  locations: Location[];
  showOptimized: boolean;
  onToggleView: (optimized: boolean) => void;
}

export function RouteComparison({ result, locations, showOptimized, onToggleView }: RouteComparisonProps) {
  const getOrderedLocations = (path: number[]) => {
    return path.map((idx) => locations[idx]);
  };

  const originalLocations = getOrderedLocations(result.originalRoute.path);
  const optimizedLocations = getOrderedLocations(result.optimizedRoute.path);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      {/* Toggle Buttons */}
      <div className="flex gap-2 p-1 bg-muted rounded-xl">
        <button
          onClick={() => onToggleView(false)}
          className={cn(
            'flex-1 py-2.5 px-4 rounded-lg text-sm font-medium transition-all duration-300',
            !showOptimized
              ? 'bg-card shadow-md text-foreground'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          Original Route
        </button>
        <button
          onClick={() => onToggleView(true)}
          className={cn(
            'flex-1 py-2.5 px-4 rounded-lg text-sm font-medium transition-all duration-300 flex items-center justify-center gap-2',
            showOptimized
              ? 'bg-card shadow-md text-foreground'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          <Sparkles className="w-4 h-4" />
          Optimized
        </button>
      </div>

      {/* Stats Comparison */}
      <div className="grid grid-cols-2 gap-3">
        <div className={cn(
          'p-4 rounded-xl border transition-all duration-300',
          !showOptimized ? 'bg-destructive/5 border-destructive/20' : 'bg-muted/50 border-border'
        )}>
          <div className="flex items-center gap-2 mb-2">
            <Route className="w-4 h-4 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Distance</span>
          </div>
          <p className={cn(
            'text-xl font-bold',
            !showOptimized ? 'text-destructive' : 'text-muted-foreground'
          )}>
            {formatDistance(result.originalRoute.totalDistance)}
          </p>
          <p className="text-xs text-muted-foreground mt-1">Original</p>
        </div>
        <div className={cn(
          'p-4 rounded-xl border transition-all duration-300',
          showOptimized ? 'bg-accent/10 border-accent/20' : 'bg-muted/50 border-border'
        )}>
          <div className="flex items-center gap-2 mb-2">
            <Route className="w-4 h-4 text-accent" />
            <span className="text-xs text-muted-foreground">Distance</span>
          </div>
          <p className={cn(
            'text-xl font-bold',
            showOptimized ? 'text-accent' : 'text-muted-foreground'
          )}>
            {formatDistance(result.optimizedRoute.totalDistance)}
          </p>
          <p className="text-xs text-muted-foreground mt-1">Optimized</p>
        </div>
        <div className={cn(
          'p-4 rounded-xl border transition-all duration-300',
          !showOptimized ? 'bg-destructive/5 border-destructive/20' : 'bg-muted/50 border-border'
        )}>
          <div className="flex items-center gap-2 mb-2">
            <Clock className="w-4 h-4 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Time</span>
          </div>
          <p className={cn(
            'text-xl font-bold',
            !showOptimized ? 'text-destructive' : 'text-muted-foreground'
          )}>
            {formatTime(result.originalRoute.estimatedTime)}
          </p>
          <p className="text-xs text-muted-foreground mt-1">Original</p>
        </div>
        <div className={cn(
          'p-4 rounded-xl border transition-all duration-300',
          showOptimized ? 'bg-accent/10 border-accent/20' : 'bg-muted/50 border-border'
        )}>
          <div className="flex items-center gap-2 mb-2">
            <Clock className="w-4 h-4 text-accent" />
            <span className="text-xs text-muted-foreground">Time</span>
          </div>
          <p className={cn(
            'text-xl font-bold',
            showOptimized ? 'text-accent' : 'text-muted-foreground'
          )}>
            {formatTime(result.optimizedRoute.estimatedTime)}
          </p>
          <p className="text-xs text-muted-foreground mt-1">Optimized</p>
        </div>
      </div>

      {/* Savings Banner */}
      {result.savingsPercentage > 0 && (
        <motion.div
          initial={{ scale: 0.95 }}
          animate={{ scale: 1 }}
          className="p-4 rounded-xl bg-gradient-to-r from-accent/20 to-accent/10 border border-accent/30"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 bg-accent rounded-lg">
              <TrendingDown className="w-5 h-5 text-accent-foreground" />
            </div>
            <div>
              <p className="font-semibold text-foreground">
                Save {result.savingsPercentage.toFixed(1)}% with optimization!
              </p>
              <p className="text-sm text-muted-foreground">
                {formatDistance(result.savingsDistance)} less · {formatTime(result.savingsTime)} faster
              </p>
            </div>
          </div>
        </motion.div>
      )}

      {/* Route Order */}
      <div className="space-y-3">
        <p className="text-sm font-semibold text-foreground">
          {showOptimized ? 'Optimized' : 'Original'} Route Order
        </p>
        <div className="flex flex-wrap items-center gap-2">
          {(showOptimized ? optimizedLocations : originalLocations).map((location, index) => (
            <React.Fragment key={location.id}>
              <div className={cn(
                'flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-all',
                showOptimized
                  ? 'bg-accent/10 text-accent border border-accent/20'
                  : 'bg-muted text-muted-foreground border border-border'
              )}>
                <span className={cn(
                  'w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold',
                  showOptimized
                    ? 'bg-accent text-accent-foreground'
                    : 'bg-primary text-primary-foreground'
                )}>
                  {index + 1}
                </span>
                <span className="truncate max-w-[100px]">{location.name}</span>
              </div>
              {index < (showOptimized ? optimizedLocations : originalLocations).length - 1 && (
                <ArrowRight className="w-3 h-3 text-muted-foreground" />
              )}
            </React.Fragment>
          ))}
          <ArrowRight className="w-3 h-3 text-muted-foreground" />
          <div className={cn(
            'px-3 py-1.5 rounded-full text-xs font-medium border',
            showOptimized
              ? 'bg-accent/10 text-accent border-accent/20'
              : 'bg-muted text-muted-foreground border-border'
          )}>
            Return to Start
          </div>
        </div>
      </div>
    </motion.div>
  );
}
