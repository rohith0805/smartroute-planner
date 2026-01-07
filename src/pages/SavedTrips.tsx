import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Navigation, ArrowLeft, Trash2, MapPin, Clock, Route, Loader2, Play } from 'lucide-react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { formatDistance, formatTime } from '@/lib/tsp';

interface SavedTrip {
  id: string;
  name: string;
  locations: any[];
  vehicle_type: string;
  original_distance: number;
  optimized_distance: number;
  original_time: number;
  optimized_time: number;
  savings_percentage: number;
  created_at: string;
}

const SavedTrips = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [trips, setTrips] = useState<SavedTrip[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user) {
      fetchTrips();
    }
  }, [user]);

  const fetchTrips = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('saved_trips')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      toast.error('Failed to load saved trips');
    } else {
      setTrips((data || []) as unknown as SavedTrip[]);
    }
    setLoading(false);
  };

  const handleDelete = async (id: string) => {
    setDeleting(id);
    const { error } = await supabase.from('saved_trips').delete().eq('id', id);
    setDeleting(null);

    if (error) {
      toast.error('Failed to delete trip');
    } else {
      setTrips(trips.filter((t) => t.id !== id));
      toast.success('Trip deleted');
    }
  };

  const handleLoadTrip = (trip: SavedTrip) => {
    navigate('/', { 
      state: { 
        loadedTrip: {
          locations: trip.locations,
          vehicleType: trip.vehicle_type,
          optimizationResult: {
            originalRoute: {
              order: trip.locations.map((_: any, i: number) => i),
              totalDistance: trip.original_distance,
              estimatedTime: trip.original_time,
            },
            optimizedRoute: {
              order: trip.locations.map((_: any, i: number) => i),
              totalDistance: trip.optimized_distance,
              estimatedTime: trip.optimized_time,
            },
            savingsPercentage: trip.savings_percentage,
          }
        }
      } 
    });
    toast.success(`Loading "${trip.name}"`);
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-accent" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 glass-strong border-b border-border/50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <div className="flex items-center gap-3">
                <div className="p-2 bg-gradient-to-br from-primary to-accent rounded-xl">
                  <Navigation className="w-6 h-6 text-primary-foreground" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-foreground">Saved Trips</h1>
                  <p className="text-xs text-muted-foreground">{trips.length} trips saved</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {trips.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center py-16"
          >
            <div className="inline-flex p-4 bg-muted rounded-full mb-4">
              <Route className="w-10 h-10 text-muted-foreground" />
            </div>
            <h2 className="text-xl font-semibold text-foreground mb-2">No saved trips yet</h2>
            <p className="text-muted-foreground mb-6">
              Create and optimize a route, then save it to access it later
            </p>
            <Button onClick={() => navigate('/')}>Plan a Trip</Button>
          </motion.div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {trips.map((trip, index) => (
              <motion.div
                key={trip.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
              >
                <Card className="h-full hover:shadow-lg transition-shadow">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-lg">{trip.name}</CardTitle>
                        <CardDescription>
                          {new Date(trip.created_at).toLocaleDateString()}
                        </CardDescription>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(trip.id)}
                        disabled={deleting === trip.id}
                        className="text-muted-foreground hover:text-destructive"
                      >
                        {deleting === trip.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Trash2 className="w-4 h-4" />
                        )}
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <MapPin className="w-4 h-4" />
                      <span>{trip.locations.length} destinations</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Route className="w-4 h-4" />
                      <span>{formatDistance(trip.optimized_distance)}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Clock className="w-4 h-4" />
                      <span>{formatTime(trip.optimized_time)}</span>
                    </div>
                    {trip.savings_percentage > 0 && (
                      <div className="pt-2 border-t border-border">
                        <span className="text-sm font-medium text-accent">
                          {trip.savings_percentage.toFixed(1)}% route savings
                        </span>
                      </div>
                    )}
                    <Button
                      onClick={() => handleLoadTrip(trip)}
                      className="w-full mt-3"
                      size="sm"
                    >
                      <Play className="w-4 h-4 mr-2" />
                      Load Trip
                    </Button>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default SavedTrips;
