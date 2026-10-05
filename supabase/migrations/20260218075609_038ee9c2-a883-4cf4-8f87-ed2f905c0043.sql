-- Drop the trigger that won't work without app.settings
DROP TRIGGER IF EXISTS trigger_send_welcome_email ON public.company_users;
DROP FUNCTION IF EXISTS public.send_welcome_email();