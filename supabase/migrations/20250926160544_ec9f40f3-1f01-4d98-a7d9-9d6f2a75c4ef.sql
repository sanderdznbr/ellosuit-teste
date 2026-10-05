-- Enable RLS on the remaining table that doesn't have it
ALTER TABLE public.room_participants ENABLE ROW LEVEL SECURITY;

-- Create appropriate RLS policies for room_participants
-- Users can only see participants in rooms they are part of
CREATE POLICY "Users can view participants in their rooms" 
ON public.room_participants 
FOR SELECT 
TO authenticated
USING (
  room_id IN (
    SELECT id FROM public.meeting_rooms 
    WHERE created_by = auth.uid() 
    OR id IN (
      SELECT DISTINCT room_id 
      FROM public.room_participants 
      WHERE user_id = auth.uid()
    )
  )
);

-- Users can join rooms (insert participants)
CREATE POLICY "Users can join rooms" 
ON public.room_participants 
FOR INSERT 
TO authenticated
WITH CHECK (
  user_id = auth.uid() OR user_id IS NULL -- Allow guest participants
);

-- Users can update their own participant status
CREATE POLICY "Users can update their participant status" 
ON public.room_participants 
FOR UPDATE 
TO authenticated
USING (user_id = auth.uid() OR user_id IS NULL)
WITH CHECK (user_id = auth.uid() OR user_id IS NULL);

-- Room creators can delete participants
CREATE POLICY "Room creators can remove participants" 
ON public.room_participants 
FOR DELETE 
TO authenticated
USING (
  room_id IN (
    SELECT id FROM public.meeting_rooms 
    WHERE created_by = auth.uid()
  )
  OR user_id = auth.uid() -- Users can remove themselves
);