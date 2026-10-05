-- Add waiting_approval field to room_participants
ALTER TABLE public.room_participants 
ADD COLUMN IF NOT EXISTS waiting_approval boolean DEFAULT false;

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_room_participants_waiting 
ON public.room_participants(room_id, waiting_approval) 
WHERE waiting_approval = true;