-- Add onboarding_completed column to profiles if it doesn't exist
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'onboarding_completed') THEN
        ALTER TABLE public.profiles ADD COLUMN onboarding_completed BOOLEAN DEFAULT FALSE;
    END IF;
END $$;
