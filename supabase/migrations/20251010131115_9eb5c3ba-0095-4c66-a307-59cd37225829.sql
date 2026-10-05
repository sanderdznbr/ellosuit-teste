-- Drop all existing UPDATE policies on room_participants
DROP POLICY IF EXISTS "Participants can update their own status" ON public.room_participants;
DROP POLICY IF EXISTS "Hosts can approve participants" ON public.room_participants;
DROP POLICY IF EXISTS "Anyone can approve participants" ON public.room_participants;
DROP POLICY IF EXISTS "Hosts can manage room participants" ON public.room_participants;

-- Create a simple, comprehensive policy for hosts to manage participants
CREATE POLICY "Allow hosts and room creators to manage participants"
  ON public.room_participants
  FOR UPDATE
  USING (
    -- User is authenticated and either:
    -- 1. Is a host in this specific room, OR
    -- 2. Created the meeting room
    auth.uid() IS NOT NULL AND (
      -- Check if user is a host participant in this room
      EXISTS (
        SELECT 1 FROM public.room_participants rp
        WHERE rp.room_id = room_participants.room_id
          AND rp.user_id = auth.uid()
          AND rp.is_host = true
          AND rp.left_at IS NULL
      )
      OR
      -- Check if user created the meeting room
      EXISTS (
        SELECT 1 FROM public.meeting_rooms mr
        WHERE mr.id = room_participants.room_id
          AND mr.created_by = auth.uid()
      )
    )
  );

-- Allow participants to update their own status (audio/video)
CREATE POLICY "Participants can update their own record"
  ON public.room_participants
  FOR UPDATE
  USING (
    auth.uid() = user_id OR
    (user_id IS NULL AND peer_id IS NOT NULL)
  );