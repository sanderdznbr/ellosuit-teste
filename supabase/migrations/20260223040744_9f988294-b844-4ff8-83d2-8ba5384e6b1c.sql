-- Fix the trigger that references NEW.name instead of NEW.title
CREATE OR REPLACE FUNCTION public.notify_on_meeting_created()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.notifications (user_id, company_id, title, message, type, category, icon, action_url, metadata)
  VALUES (
    NEW.created_by,
    NEW.company_id,
    'Sala de reunião criada',
    'Sala "' || NEW.title || '" está ativa e pronta para participantes',
    'info',
    'meeting',
    'Video',
    '/dashboard/reunioes',
    jsonb_build_object('room_id', NEW.id)
  );
  RETURN NEW;
END;
$function$;