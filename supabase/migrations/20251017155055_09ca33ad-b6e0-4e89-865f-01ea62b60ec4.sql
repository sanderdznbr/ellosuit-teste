-- Create recording_consents table to track participant consent for recording
CREATE TABLE IF NOT EXISTS public.recording_consents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  room_id UUID NOT NULL REFERENCES public.meeting_rooms(id) ON DELETE CASCADE,
  participant_name TEXT NOT NULL,
  consented BOOLEAN NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.recording_consents ENABLE ROW LEVEL SECURITY;

-- Anyone in the room can insert their consent
CREATE POLICY "Participants can record their consent"
ON public.recording_consents
FOR INSERT
WITH CHECK (true);

-- Anyone in the room can view consents
CREATE POLICY "Participants can view room consents"
ON public.recording_consents
FOR SELECT
USING (true);

-- Add index for faster lookups by room
CREATE INDEX IF NOT EXISTS idx_recording_consents_room_id 
ON public.recording_consents(room_id);

-- Add comment
COMMENT ON TABLE public.recording_consents 
IS 'Tracks participant consent for meeting recordings';