-- Fix the critical security issue with secret_config table
-- Enable RLS on secret_config table to prevent public access to sensitive data

ALTER TABLE IF EXISTS public.secret_config ENABLE ROW LEVEL SECURITY;

-- Create restrictive RLS policy for secret_config table
-- Only allow service role access (no regular user access)
CREATE POLICY "Only service role can access secret config" 
ON public.secret_config 
FOR ALL 
TO service_role
USING (true)
WITH CHECK (true);

-- Ensure no public access to sensitive config data
CREATE POLICY "Block all authenticated user access to secret config" 
ON public.secret_config 
FOR ALL 
TO authenticated
USING (false)
WITH CHECK (false);

-- Also check if there are any other security-related tables we missed
-- Enable RLS on any other config tables if they exist
DO $$
BEGIN
    -- Enable RLS on any existing config/settings tables
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'app_config') THEN
        ALTER TABLE public.app_config ENABLE ROW LEVEL SECURITY;
    END IF;
    
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'system_config') THEN
        ALTER TABLE public.system_config ENABLE ROW LEVEL SECURITY;
    END IF;
END $$;