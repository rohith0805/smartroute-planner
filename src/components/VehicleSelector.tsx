import React from 'react';
import { cn } from '@/lib/utils';
import { Car, Bike, Truck } from 'lucide-react';
import { VehicleType } from '@/lib/tsp';
import { motion } from 'framer-motion';

interface VehicleSelectorProps {
  selected: VehicleType;
  onSelect: (type: VehicleType) => void;
}

const vehicles: { type: VehicleType; label: string; icon: React.ElementType; description: string }[] = [
  {
    type: 'car',
    label: 'Car',
    icon: Car,
    description: 'Avoids narrow roads',
  },
  {
    type: 'bike',
    label: 'Bike',
    icon: Bike,
    description: 'All roads accessible',
  },
  {
    type: 'truck',
    label: 'Big Vehicle',
    icon: Truck,
    description: 'Main roads only',
  },
];

export function VehicleSelector({ selected, onSelect }: VehicleSelectorProps) {
  return (
    <div className="flex gap-3">
      {vehicles.map((vehicle) => {
        const Icon = vehicle.icon;
        const isSelected = selected === vehicle.type;

        return (
          <motion.button
            key={vehicle.type}
            onClick={() => onSelect(vehicle.type)}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className={cn(
              'relative flex-1 flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all duration-300',
              isSelected
                ? 'border-accent bg-accent/10 shadow-md'
                : 'border-border bg-card hover:border-accent/50 hover:bg-accent/5'
            )}
          >
            <div
              className={cn(
                'p-3 rounded-lg transition-colors duration-300',
                isSelected ? 'bg-accent text-accent-foreground' : 'bg-muted text-muted-foreground'
              )}
            >
              <Icon className="w-6 h-6" />
            </div>
            <div className="text-center">
              <p className={cn('font-semibold text-sm', isSelected ? 'text-foreground' : 'text-muted-foreground')}>
                {vehicle.label}
              </p>
              <p className="text-xs text-muted-foreground">{vehicle.description}</p>
            </div>
            {isSelected && (
              <motion.div
                layoutId="vehicle-indicator"
                className="absolute inset-0 rounded-xl border-2 border-accent"
                transition={{ type: 'spring', bounce: 0.2, duration: 0.6 }}
              />
            )}
          </motion.button>
        );
      })}
    </div>
  );
}
