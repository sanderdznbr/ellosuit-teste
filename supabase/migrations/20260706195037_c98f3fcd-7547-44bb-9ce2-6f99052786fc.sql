
CREATE OR REPLACE FUNCTION public.validate_meeting_link()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_link text;
BEGIN
  v_link := btrim(COALESCE(NEW.meeting_link, ''));
  IF v_link = '' THEN
    RETURN NEW;
  END IF;

  IF v_link LIKE 'https://www.ellosuit.app/%'
     OR v_link LIKE 'https://meet.google.com/%'
     OR v_link LIKE 'https://zoom.us/%'
     OR v_link LIKE 'https://us02web.zoom.us/%'
     OR v_link LIKE 'https://us04web.zoom.us/%'
     OR v_link LIKE 'https://us05web.zoom.us/%'
     OR v_link LIKE 'https://us06web.zoom.us/%'
     OR v_link LIKE 'https://teams.microsoft.com/%'
     OR v_link LIKE 'https://teams.live.com/%'
     OR v_link LIKE 'https://whereby.com/%'
  THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'Link de reunião inválido: apenas links iniciados por https://www.ellosuit.app são permitidos (valor recebido: %)', v_link
    USING ERRCODE = '22023';
END;
$$;

DROP TRIGGER IF EXISTS validate_meeting_link_trigger ON public.calendar_events;
CREATE TRIGGER validate_meeting_link_trigger
BEFORE INSERT OR UPDATE OF meeting_link ON public.calendar_events
FOR EACH ROW EXECUTE FUNCTION public.validate_meeting_link();
