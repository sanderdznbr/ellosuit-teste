-- Add theme_preference column to profiles if it doesn't exist
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'theme_preference') THEN
        ALTER TABLE public.profiles ADD COLUMN theme_preference TEXT DEFAULT 'light';
    END IF;
END $$;
