-- Add livekit_recording_id column to meeting_recordings table
ALTER TABLE public.meeting_recordings
ADD COLUMN IF NOT EXISTS livekit_recording_id TEXT;

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_meeting_recordings_livekit_id 
ON public.meeting_recordings(livekit_recording_id);

-- Add comment to document the column
COMMENT ON COLUMN public.meeting_recordings.livekit_recording_id 
IS 'LiveKit egress ID used to track the recording status via webhook';