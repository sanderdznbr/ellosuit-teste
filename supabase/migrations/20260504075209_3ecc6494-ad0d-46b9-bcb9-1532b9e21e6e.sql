-- Add status column to meeting_recordings
ALTER TABLE public.meeting_recordings ADD COLUMN status TEXT DEFAULT 'completed';

-- Update existing records
UPDATE public.meeting_recordings SET status = 'completed' WHERE file_url IS NOT NULL;
UPDATE public.meeting_recordings SET status = 'processing' WHERE file_url IS NULL;

-- Enable RLS for the new column (it's already enabled for the table)
-- No new policies needed as the existing ones cover the table
