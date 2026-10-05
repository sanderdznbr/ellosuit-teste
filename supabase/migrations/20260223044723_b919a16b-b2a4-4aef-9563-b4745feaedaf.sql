
-- Add unique short meeting code to calendar events
ALTER TABLE public.calendar_events ADD COLUMN IF NOT EXISTS meeting_code TEXT UNIQUE;

-- Create function to generate short meeting codes like 'ello023a'
CREATE OR REPLACE FUNCTION public.generate_meeting_code()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = 'public'
AS $$
DECLARE
  new_code TEXT;
  code_exists BOOLEAN;
BEGIN
  IF NEW.event_type IN ('meeting', 'appointment') AND NEW.meeting_code IS NULL THEN
    LOOP
      new_code := 'ello' || LPAD(floor(random() * 1000)::text, 3, '0') || chr(97 + floor(random() * 26)::int);
      SELECT EXISTS(SELECT 1 FROM public.calendar_events WHERE meeting_code = new_code) INTO code_exists;
      EXIT WHEN NOT code_exists;
    END LOOP;
    NEW.meeting_code := new_code;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_generate_meeting_code ON public.calendar_events;
CREATE TRIGGER trg_generate_meeting_code
BEFORE INSERT ON public.calendar_events
FOR EACH ROW
EXECUTE FUNCTION public.generate_meeting_code();

-- Backfill existing events one by one using a loop to avoid collisions
DO $$
DECLARE
  rec RECORD;
  new_code TEXT;
  code_exists BOOLEAN;
BEGIN
  FOR rec IN SELECT id FROM public.calendar_events WHERE event_type IN ('meeting', 'appointment') AND meeting_code IS NULL
  LOOP
    LOOP
      new_code := 'ello' || LPAD(floor(random() * 1000)::text, 3, '0') || chr(97 + floor(random() * 26)::int);
      SELECT EXISTS(SELECT 1 FROM public.calendar_events WHERE meeting_code = new_code) INTO code_exists;
      EXIT WHEN NOT code_exists;
    END LOOP;
    UPDATE public.calendar_events SET meeting_code = new_code WHERE id = rec.id;
  END LOOP;
END;
$$;
