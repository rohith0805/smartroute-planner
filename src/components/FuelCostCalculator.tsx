import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Fuel, Zap, IndianRupee, TrendingDown, ChevronDown, ChevronUp } from 'lucide-react';
import { VehicleType } from '@/lib/tsp';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

interface FuelCostCalculatorProps {
  originalDistance: number; // km
  optimizedDistance: number; // km
  vehicleType: VehicleType;
}

// Default fuel efficiency (km per liter or km per kWh for EV)
const DEFAULT_EFFICIENCY: Record<VehicleType, number> = {
  car: 15,    // 15 km/L
  bike: 40,   // 40 km/L
  truck: 8,   // 8 km/L
};

// Default fuel price (₹ per liter)
const DEFAULT_FUEL_PRICE: Record<VehicleType, number> = {
  car: 105,
  bike: 105,
  truck: 95,   // diesel
};

const VEHICLE_FUEL_LABELS: Record<VehicleType, string> = {
  car: 'Petrol/Diesel',
  bike: 'Petrol',
  truck: 'Diesel',
};

export function FuelCostCalculator({ originalDistance, optimizedDistance, vehicleType }: FuelCostCalculatorProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [efficiency, setEfficiency] = useState(DEFAULT_EFFICIENCY[vehicleType]);
  const [fuelPrice, setFuelPrice] = useState(DEFAULT_FUEL_PRICE[vehicleType]);

  // Update defaults when vehicle type changes
  React.useEffect(() => {
    setEfficiency(DEFAULT_EFFICIENCY[vehicleType]);
    setFuelPrice(DEFAULT_FUEL_PRICE[vehicleType]);
  }, [vehicleType]);

  const costs = useMemo(() => {
    const originalFuel = originalDistance / efficiency;
    const optimizedFuel = optimizedDistance / efficiency;
    const originalCost = originalFuel * fuelPrice;
    const optimizedCost = optimizedFuel * fuelPrice;
    const savings = originalCost - optimizedCost;
    const savingsPercent = originalCost > 0 ? (savings / originalCost) * 100 : 0;

    return {
      originalFuel,
      optimizedFuel,
      originalCost,
      optimizedCost,
      savings: Math.max(0, savings),
      savingsPercent: Math.max(0, savingsPercent),
      fuelSaved: Math.max(0, originalFuel - optimizedFuel),
    };
  }, [originalDistance, optimizedDistance, efficiency, fuelPrice]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border border-border overflow-hidden"
    >
      {/* Header - always visible */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full p-4 flex items-center justify-between bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30 border-b border-amber-200/50 dark:border-amber-800/50 hover:from-amber-100 hover:to-orange-100 dark:hover:from-amber-950/40 dark:hover:to-orange-950/40 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="p-2 bg-amber-500/20 rounded-lg">
            <Fuel className="w-5 h-5 text-amber-600 dark:text-amber-400" />
          </div>
          <div className="text-left">
            <p className="font-semibold text-foreground text-sm">Fuel Cost Estimator</p>
            <p className="text-xs text-muted-foreground">
              {costs.savings > 0
                ? `Save ₹${costs.savings.toFixed(0)} with optimized route`
                : 'Route is already cost-optimal'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {costs.savings > 0 && (
            <span className="text-sm font-bold text-green-600 dark:text-green-400">
              -₹{costs.savings.toFixed(0)}
            </span>
          )}
          {isExpanded ? (
            <ChevronUp className="w-4 h-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="w-4 h-4 text-muted-foreground" />
          )}
        </div>
      </button>

      {/* Expanded content */}
      {isExpanded && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          className="p-4 space-y-4 bg-card"
        >
          {/* Editable inputs */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-muted-foreground">
                Mileage (km/L)
              </Label>
              <Input
                type="number"
                min={1}
                max={100}
                step={0.5}
                value={efficiency}
                onChange={(e) => setEfficiency(Number(e.target.value) || 1)}
                className="mt-1 h-9 text-sm"
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">
                {VEHICLE_FUEL_LABELS[vehicleType]} Price (₹/L)
              </Label>
              <Input
                type="number"
                min={1}
                max={500}
                step={1}
                value={fuelPrice}
                onChange={(e) => setFuelPrice(Number(e.target.value) || 1)}
                className="mt-1 h-9 text-sm"
              />
            </div>
          </div>

          {/* Cost comparison */}
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 rounded-lg bg-destructive/5 border border-destructive/15">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Original Route</p>
              <p className="text-lg font-bold text-destructive">₹{costs.originalCost.toFixed(0)}</p>
              <p className="text-[11px] text-muted-foreground">{costs.originalFuel.toFixed(1)} L fuel</p>
            </div>
            <div className="p-3 rounded-lg bg-accent/5 border border-accent/15">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Optimized Route</p>
              <p className="text-lg font-bold text-accent">₹{costs.optimizedCost.toFixed(0)}</p>
              <p className="text-[11px] text-muted-foreground">{costs.optimizedFuel.toFixed(1)} L fuel</p>
            </div>
          </div>

          {/* Savings summary */}
          {costs.savings > 0 && (
            <div className="flex items-center gap-3 p-3 rounded-lg bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800">
              <TrendingDown className="w-5 h-5 text-green-600 dark:text-green-400 shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-semibold text-green-700 dark:text-green-300">
                  Save ₹{costs.savings.toFixed(0)} ({costs.savingsPercent.toFixed(1)}%)
                </p>
                <p className="text-[11px] text-green-600 dark:text-green-400">
                  {costs.fuelSaved.toFixed(1)} L fuel saved · ~{(costs.fuelSaved * 2.31).toFixed(1)} kg CO₂ reduced
                </p>
              </div>
            </div>
          )}
        </motion.div>
      )}
    </motion.div>
  );
}
