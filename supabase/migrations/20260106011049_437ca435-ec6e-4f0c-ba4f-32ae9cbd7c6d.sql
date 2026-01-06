-- Create saved_trips table
CREATE TABLE public.saved_trips (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  locations JSONB NOT NULL,
  vehicle_type TEXT NOT NULL,
  original_distance NUMERIC NOT NULL,
  optimized_distance NUMERIC NOT NULL,
  original_time NUMERIC NOT NULL,
  optimized_time NUMERIC NOT NULL,
  savings_percentage NUMERIC NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.saved_trips ENABLE ROW LEVEL SECURITY;

-- Users can view their own trips
CREATE POLICY "Users can view their own trips"
ON public.saved_trips
FOR SELECT
USING (auth.uid() = user_id);

-- Users can create their own trips
CREATE POLICY "Users can create their own trips"
ON public.saved_trips
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can delete their own trips
CREATE POLICY "Users can delete their own trips"
ON public.saved_trips
FOR DELETE
USING (auth.uid() = user_id);