import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Location, VehicleType, OptimizationResult } from '@/lib/tsp';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Save, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';

interface SaveTripDialogProps {
  locations: Location[];
  vehicleType: VehicleType;
  optimizationResult: OptimizationResult;
}

export function SaveTripDialog({ locations, vehicleType, optimizationResult }: SaveTripDialogProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error('Please enter a trip name');
      return;
    }

    if (!user) {
      toast.error('Please sign in to save trips');
      navigate('/auth');
      return;
    }

    setSaving(true);
    const { error } = await supabase.from('saved_trips').insert([{
      user_id: user.id,
      name: name.trim(),
      locations: locations as any,
      vehicle_type: vehicleType,
      original_distance: optimizationResult.originalRoute.totalDistance,
      optimized_distance: optimizationResult.optimizedRoute.totalDistance,
      original_time: optimizationResult.originalRoute.estimatedTime,
      optimized_time: optimizationResult.optimizedRoute.estimatedTime,
      savings_percentage: optimizationResult.savingsPercentage,
    }]);

    setSaving(false);

    if (error) {
      toast.error('Failed to save trip');
    } else {
      toast.success('Trip saved successfully!');
      setOpen(false);
      setName('');
    }
  };

  const handleClick = () => {
    if (!user) {
      toast.error('Please sign in to save trips');
      navigate('/auth');
      return;
    }
    setOpen(true);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          onClick={handleClick}
          className="gap-2"
        >
          <Save className="w-4 h-4" />
          Save Trip
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Save Your Trip</DialogTitle>
          <DialogDescription>
            Give your trip a name to save it for later access.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 pt-4">
          <div className="space-y-2">
            <Label htmlFor="trip-name">Trip Name</Label>
            <Input
              id="trip-name"
              placeholder="e.g., City Tour, Delivery Route..."
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={saving}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save Trip'
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
