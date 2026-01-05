import React, { useState, useCallback } from 'react';
import { Location } from '@/lib/tsp';
import { searchPlaces } from '@/lib/geocoding';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { MapPin, X, GripVertical, Search, Loader2 } from 'lucide-react';
import { motion, AnimatePresence, Reorder } from 'framer-motion';
import { cn } from '@/lib/utils';

interface LocationInputProps {
  locations: Location[];
  onLocationsChange: (locations: Location[]) => void;
  maxLocations?: number;
}

interface Suggestion {
  display_name: string;
  lat: string;
  lon: string;
}

export function LocationInput({ locations, onLocationsChange, maxLocations = 10 }: LocationInputProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const handleSearch = useCallback(async (query: string) => {
    setSearchQuery(query);
    if (query.length >= 3) {
      setIsSearching(true);
      const results = await searchPlaces(query);
      setSuggestions(results);
      setShowSuggestions(true);
      setIsSearching(false);
    } else {
      setSuggestions([]);
      setShowSuggestions(false);
    }
  }, []);

  const handleSelectSuggestion = (suggestion: Suggestion) => {
    const newLocation: Location = {
      id: crypto.randomUUID(),
      name: suggestion.display_name.split(',')[0],
      lat: parseFloat(suggestion.lat),
      lng: parseFloat(suggestion.lon),
      address: suggestion.display_name,
    };
    onLocationsChange([...locations, newLocation]);
    setSearchQuery('');
    setSuggestions([]);
    setShowSuggestions(false);
  };

  const handleRemoveLocation = (id: string) => {
    onLocationsChange(locations.filter((loc) => loc.id !== id));
  };

  const handleReorder = (newOrder: Location[]) => {
    onLocationsChange(newOrder);
  };

  return (
    <div className="space-y-4">
      {/* Search Input */}
      <div className="relative">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search for a location..."
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
            className="pl-10 pr-10 h-12 bg-background border-border focus:border-accent focus:ring-accent/20"
            disabled={locations.length >= maxLocations}
          />
          {isSearching && (
            <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground animate-spin" />
          )}
        </div>

        {/* Suggestions Dropdown */}
        <AnimatePresence>
          {showSuggestions && suggestions.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="absolute z-50 w-full mt-2 py-2 bg-card border border-border rounded-xl shadow-lg overflow-hidden"
            >
              {suggestions.map((suggestion, index) => (
                <button
                  key={index}
                  onClick={() => handleSelectSuggestion(suggestion)}
                  className="w-full px-4 py-3 text-left hover:bg-muted/50 transition-colors flex items-start gap-3"
                >
                  <MapPin className="w-4 h-4 text-accent mt-0.5 flex-shrink-0" />
                  <span className="text-sm line-clamp-2">{suggestion.display_name}</span>
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Locations List */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {locations.length} destination{locations.length !== 1 ? 's' : ''} added
          </p>
          {locations.length > 0 && (
            <p className="text-xs text-muted-foreground">Drag to reorder</p>
          )}
        </div>

        <Reorder.Group axis="y" values={locations} onReorder={handleReorder} className="space-y-2">
          <AnimatePresence mode="popLayout">
            {locations.map((location, index) => (
              <Reorder.Item
                key={location.id}
                value={location}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.2 }}
                className={cn(
                  'flex items-center gap-3 p-3 bg-card border border-border rounded-xl cursor-grab active:cursor-grabbing hover:border-accent/50 transition-colors',
                  index === 0 && 'border-accent/30 bg-accent/5'
                )}
              >
                <GripVertical className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                <div
                  className={cn(
                    'flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold flex-shrink-0',
                    index === 0
                      ? 'bg-accent text-accent-foreground'
                      : 'bg-primary text-primary-foreground'
                  )}
                >
                  {index + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{location.name}</p>
                  {location.address && (
                    <p className="text-xs text-muted-foreground truncate">{location.address}</p>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleRemoveLocation(location.id)}
                  className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 flex-shrink-0"
                >
                  <X className="w-4 h-4" />
                </Button>
              </Reorder.Item>
            ))}
          </AnimatePresence>
        </Reorder.Group>

        {locations.length === 0 && (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <MapPin className="w-10 h-10 text-muted-foreground/30 mb-3" />
            <p className="text-muted-foreground text-sm">No destinations added yet</p>
            <p className="text-muted-foreground/70 text-xs">Search and add locations above</p>
          </div>
        )}
      </div>
    </div>
  );
}
