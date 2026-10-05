-- Drop all problematic RLS policies on room_participants
DROP POLICY IF EXISTS "Hosts can remove participants" ON public.room_participants;
DROP POLICY IF EXISTS "Participants can view room participants" ON public.room_participants;
DROP POLICY IF EXISTS "Users can view room participants" ON public.room_participants;
DROP POLICY IF EXISTS "Anyone can join active rooms" ON public.room_participants;

-- Drop the old function if exists
DROP FUNCTION IF EXISTS public.can_view_room_participants(uuid, uuid);

-- Create security definer function to check if user is participant in a room
CREATE OR REPLACE FUNCTION public.is_participant_in_room(_room_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.room_participants
    WHERE room_id = _room_id
      AND (user_id = _user_id OR user_id IS NULL)
      AND left_at IS NULL
  );
$$;

-- Create security definer function to check if room is active
CREATE OR REPLACE FUNCTION public.is_room_active(_room_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.meeting_rooms
    WHERE id = _room_id
      AND is_active = true
  );
$$;

-- Create security definer function to check if user is room creator
CREATE OR REPLACE FUNCTION public.is_room_creator(_room_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.meeting_rooms
    WHERE id = _room_id
      AND created_by = _user_id
  );
$$;

-- Recreate SELECT policy without recursion
CREATE POLICY "Participants can view room participants"
ON public.room_participants
FOR SELECT
USING (
  public.is_participant_in_room(room_id, auth.uid())
  OR public.is_room_active(room_id)
  OR public.is_room_creator(room_id, auth.uid())
);

-- Recreate INSERT policy for active rooms
CREATE POLICY "Anyone can join active rooms"
ON public.room_participants
FOR INSERT
WITH CHECK (
  public.is_room_active(room_id)
);

-- Recreate DELETE policy for hosts without recursion
CREATE POLICY "Hosts can remove participants"
ON public.room_participants
FOR DELETE
USING (
  public.is_room_host(room_id, auth.uid())
  OR public.is_room_creator(room_id, auth.uid())
  OR (user_id = auth.uid() OR user_id IS NULL)
);

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.is_participant_in_room(uuid, uuid) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.is_room_active(uuid) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.is_room_creator(uuid, uuid) TO authenticated, anon;