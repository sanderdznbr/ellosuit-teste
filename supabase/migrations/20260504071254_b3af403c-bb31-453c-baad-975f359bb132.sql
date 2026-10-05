-- Add meeting_type to meeting_recordings
ALTER TABLE public.meeting_recordings ADD COLUMN IF NOT EXISTS meeting_type TEXT DEFAULT 'online';

-- Add meeting_type to in_person_meetings (optional, but good for consistency)
ALTER TABLE public.in_person_meetings ADD COLUMN IF NOT EXISTS meeting_type TEXT DEFAULT 'in_person';

-- Update RLS policies if necessary (usually they cover all columns)
-- No changes needed to RLS if it's already using SELECT * or specific columns are not restricted.
