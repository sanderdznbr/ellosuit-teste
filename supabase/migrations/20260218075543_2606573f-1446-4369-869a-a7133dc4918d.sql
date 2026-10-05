-- Create function to send welcome email via edge function (using pg_net)
CREATE OR REPLACE FUNCTION public.send_welcome_email()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  user_email TEXT;
  user_name TEXT;
  supabase_url TEXT;
  anon_key TEXT;
BEGIN
  -- Get user details from auth.users
  SELECT email, raw_user_meta_data->>'username'
  INTO user_email, user_name
  FROM auth.users
  WHERE id = NEW.user_id;

  IF user_email IS NULL THEN
    RETURN NEW;
  END IF;

  -- Use net.http_post to call edge function asynchronously
  PERFORM net.http_post(
    url := current_setting('app.settings.supabase_url', true) || '/functions/v1/send-system-email',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.anon_key', true)
    ),
    body := jsonb_build_object(
      'template_key', 'welcome',
      'recipient_email', user_email,
      'recipient_name', COALESCE(user_name, split_part(user_email, '@', 1))
    )
  );

  RETURN NEW;
END;
$$;

-- Create trigger on company_users (fires when a new user-company link is created, which happens on registration)
DROP TRIGGER IF EXISTS trigger_send_welcome_email ON public.company_users;
CREATE TRIGGER trigger_send_welcome_email
  AFTER INSERT ON public.company_users
  FOR EACH ROW
  WHEN (NEW.role != 'adminmaster')
  EXECUTE FUNCTION public.send_welcome_email();