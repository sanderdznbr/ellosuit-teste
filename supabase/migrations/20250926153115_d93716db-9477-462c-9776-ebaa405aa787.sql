-- Add menu_groups column to user_sidebar_settings table
ALTER TABLE public.user_sidebar_settings 
ADD COLUMN menu_groups jsonb DEFAULT '[]'::jsonb;