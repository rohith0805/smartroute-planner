CREATE POLICY "Users can update their own trips"
ON public.saved_trips
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);