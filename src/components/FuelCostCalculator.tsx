import React, { useState, useMemo, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Fuel, TrendingDown, ChevronDown, ChevronUp, Loader2, RefreshCw, MapPin } from 'lucide-react';
import { VehicleType } from '@/lib/tsp';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface FuelCostCalculatorProps {
  originalDistance: number;
  optimizedDistance: number;
  vehicleType: VehicleType;
}

const DEFAULT_EFFICIENCY: Record<VehicleType, number> = {
  car: 15,
  bike: 40,
  truck: 8,
};

const DEFAULT_FUEL_PRICE: Record<VehicleType, number> = {
  car: 105,
  bike: 105,
  truck: 95,
};

interface FuelPrices {
  petrol: number;
  diesel: number;
  cng: number;
  city: string;
  date: string;
}

function getFuelPriceForVehicle(prices: FuelPrices | null, vehicleType: VehicleType): number {
  if (!prices) return DEFAULT_FUEL_PRICE[vehicleType];
  switch (vehicleType) {
    case 'car': return prices.petrol;
    case 'bike': return prices.petrol;
    case 'truck': return prices.diesel;
  }
}

function getFuelLabel(vehicleType: VehicleType): string {
  switch (vehicleType) {
    case 'car': return 'Petrol';
    case 'bike': return 'Petrol';
    case 'truck': return 'Diesel';
  }
}

export function FuelCostCalculator({ originalDistance, optimizedDistance, vehicleType }: FuelCostCalculatorProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [efficiency, setEfficiency] = useState(DEFAULT_EFFICIENCY[vehicleType]);
  const [fuelPrice, setFuelPrice] = useState(DEFAULT_FUEL_PRICE[vehicleType]);
  const [livePrices, setLivePrices] = useState<FuelPrices | null>(null);
  const [isLoadingPrices, setIsLoadingPrices] = useState(false);
  const [city, setCity] = useState('Hyderabad');
  const [isLive, setIsLive] = useState(false);

  useEffect(() => {
    setEfficiency(DEFAULT_EFFICIENCY[vehicleType]);
    if (livePrices) {
      setFuelPrice(getFuelPriceForVehicle(livePrices, vehicleType));
    } else {
      setFuelPrice(DEFAULT_FUEL_PRICE[vehicleType]);
    }
  }, [vehicleType, livePrices]);

  const fetchLivePrices = async (selectedCity?: string) => {
    setIsLoadingPrices(true);
    try {
      const { data, error } = await supabase.functions.invoke('get-fuel-prices', {
        body: { city: selectedCity || city },
      });

      if (error) throw new Error(error.message);
      if (!data?.success) throw new Error(data?.error || 'Failed to fetch prices');

      const prices = data.prices as FuelPrices;
      setLivePrices(prices);
      setFuelPrice(getFuelPriceForVehicle(prices, vehicleType));
      setCity(prices.city);
      setIsLive(true);
      toast.success(`Live fuel prices loaded for ${prices.city}`);
    } catch (err) {
      console.error('Fuel price fetch error:', err);
      toast.error('Could not fetch live prices, using defaults');
      setIsLive(false);
    } finally {
      setIsLoadingPrices(false);
    }
  };

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
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full p-4 flex items-center justify-between bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30 border-b border-amber-200/50 dark:border-amber-800/50 hover:from-amber-100 hover:to-orange-100 dark:hover:from-amber-950/40 dark:hover:to-orange-950/40 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="p-2 bg-amber-500/20 rounded-lg">
            <Fuel className="w-5 h-5 text-amber-600 dark:text-amber-400" />
          </div>
          <div className="text-left">
            <div className="flex items-center gap-2">
              <p className="font-semibold text-foreground text-sm">Fuel Cost Estimator</p>
              {isLive && (
                <span className="text-[10px] bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400 px-1.5 py-0.5 rounded-full font-medium">
                  Live
                </span>
              )}
            </div>
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

      {/* Expanded */}
      {isExpanded && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          className="p-4 space-y-4 bg-card"
        >
          {/* Live price fetch */}
          <div className="flex items-center gap-2">
            <div className="flex-1">
              <Label className="text-xs text-muted-foreground">City</Label>
              <div className="flex gap-2 mt-1">
                <Input
                  type="text"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="Enter city name"
                  className="h-9 text-sm flex-1"
                />
                <button
                  onClick={() => fetchLivePrices()}
                  disabled={isLoadingPrices || !city.trim()}
                  className={cn(
                    "h-9 px-3 rounded-md text-xs font-medium flex items-center gap-1.5 transition-colors border",
                    isLoadingPrices
                      ? "bg-muted text-muted-foreground border-border cursor-not-allowed"
                      : "bg-accent text-accent-foreground border-accent hover:bg-accent/90"
                  )}
                >
                  {isLoadingPrices ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <RefreshCw className="w-3.5 h-3.5" />
                  )}
                  {isLoadingPrices ? 'Fetching...' : 'Get Live Prices'}
                </button>
              </div>
            </div>
          </div>

          {/* Live price display */}
          {livePrices && (
            <div className="space-y-1.5">
              <div className="flex items-center gap-3 p-2.5 rounded-lg bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 text-xs">
                <MapPin className="w-3.5 h-3.5 text-green-600 dark:text-green-400 shrink-0" />
                <span className="text-green-700 dark:text-green-300">
                  <strong>{livePrices.city}</strong> — Petrol: ₹{livePrices.petrol}/L · Diesel: ₹{livePrices.diesel}/L · CNG: ₹{livePrices.cng}/kg
                </span>
              </div>
              <p className="text-[10px] text-muted-foreground italic px-1">
                ⚠️ Prices are AI-estimated approximations and may differ by ₹1-2 from actual rates. For exact prices, check your local fuel station.
              </p>
            </div>
          )}

          {/* Editable inputs */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-muted-foreground">Mileage (km/L)</Label>
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
                {getFuelLabel(vehicleType)} Price (₹/L)
              </Label>
              <Input
                type="number"
                min={1}
                max={500}
                step={1}
                value={fuelPrice}
                onChange={(e) => {
                  setFuelPrice(Number(e.target.value) || 1);
                  setIsLive(false);
                }}
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

          {/* Savings */}
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
