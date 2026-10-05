-- Drop the problematic trigger
DROP TRIGGER IF EXISTS update_room_participants_updated_at ON public.room_participants;

-- Add updated_at column if it doesn't exist
ALTER TABLE public.room_participants 
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT now();

-- Recreate the trigger correctly
CREATE TRIGGER update_room_participants_updated_at
BEFORE UPDATE ON public.room_participants
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();

-- Update existing rows to set updated_at = joined_at where NULL
UPDATE public.room_participants
SET updated_at = joined_at
WHERE updated_at IS NULL;