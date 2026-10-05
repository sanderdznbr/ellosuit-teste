-- Drop existing policies that may be too restrictive
DROP POLICY IF EXISTS "Hosts can manage room participants" ON public.room_participants;
DROP POLICY IF EXISTS "Participants can update their own status" ON public.room_participants;

-- Allow participants to update their own status (audio, video, etc.)
CREATE POLICY "Participants can update their own status"
  ON public.room_participants
  FOR UPDATE
  USING (
    -- Can update own record via peer_id (for guests) or user_id (for authenticated users)
    peer_id = current_setting('request.headers')::json->>'peer_id' OR
    user_id = auth.uid()
  );

-- Allow hosts to approve/reject any participant in their room
CREATE POLICY "Hosts can approve participants"
  ON public.room_participants
  FOR UPDATE
  USING (
    -- User is a host in this room
    EXISTS (
      SELECT 1 FROM public.room_participants rp
      WHERE rp.room_id = room_participants.room_id
        AND rp.is_host = true
        AND (rp.user_id = auth.uid() OR rp.peer_id IS NOT NULL)
        AND rp.left_at IS NULL
    )
    OR
    -- User is the creator of the room
    room_id IN (
      SELECT id FROM public.meeting_rooms
      WHERE created_by = auth.uid()
    )
  );

-- Allow anyone to update waiting_approval status (for simpler host approval)
CREATE POLICY "Anyone can approve participants"
  ON public.room_participants
  FOR UPDATE
  USING (true)
  WITH CHECK (true);