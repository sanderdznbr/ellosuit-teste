ALTER TABLE public.meeting_recordings 
ADD COLUMN IF NOT EXISTS participant_count INTEGER,
ADD COLUMN IF NOT EXISTS skill_feedback TEXT,
ADD COLUMN IF NOT EXISTS skill_id TEXT,
ADD COLUMN IF NOT EXISTS meeting_metadata JSONB;