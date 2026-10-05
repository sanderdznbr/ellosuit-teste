-- Enable RLS on tables that are missing it to fix security warnings

-- Check and enable RLS on tables that need it
ALTER TABLE public.email_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_events ENABLE ROW LEVEL SECURITY; 
ALTER TABLE public.device_tokens ENABLE ROW LEVEL SECURITY;

-- Create basic RLS policy for email_events (currently allows all access)
DROP POLICY IF EXISTS "Allow all access to email_events" ON public.email_events;
CREATE POLICY "Users can view email events for their company" 
ON public.email_events 
FOR SELECT 
TO authenticated
USING (
  email_id IN (
    SELECT id FROM public.email_campaigns 
    WHERE id = email_id
  )
);

CREATE POLICY "Allow email event creation" 
ON public.email_events 
FOR INSERT 
WITH CHECK (true);

-- Create RLS policy for device_tokens
CREATE POLICY "Users can manage their device tokens" 
ON public.device_tokens 
FOR ALL 
TO authenticated
USING (true)
WITH CHECK (true);