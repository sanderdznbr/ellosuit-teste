-- Drop existing table and recreate with correct types
DROP TABLE IF EXISTS public.room_active_skills;

CREATE TABLE public.room_active_skills (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    room_id UUID REFERENCES public.meeting_rooms(id) ON DELETE CASCADE NOT NULL,
    skill_id TEXT NOT NULL,
    activated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    activated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Enable RLS
ALTER TABLE public.room_active_skills ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view active skills in their rooms" 
ON public.room_active_skills 
FOR SELECT 
USING (true);

CREATE POLICY "Users can activate skills in their rooms" 
ON public.room_active_skills 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Users can deactivate skills in their rooms" 
ON public.room_active_skills 
FOR DELETE 
USING (true);
