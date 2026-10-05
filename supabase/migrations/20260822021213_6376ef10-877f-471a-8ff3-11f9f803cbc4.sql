CREATE TABLE IF NOT EXISTS public.dispatch_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  phone text NOT NULL,
  name text,
  source text DEFAULT 'import',
  notes text,
  tags text[] NOT NULL DEFAULT '{}',
  total_dispatches integer NOT NULL DEFAULT 0,
  last_dispatch_at timestamptz,
  last_dispatch_status text,
  last_campaign_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, phone)
);

CREATE TABLE IF NOT EXISTS public.dispatch_contact_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  contact_id uuid REFERENCES public.dispatch_contacts(id) ON DELETE CASCADE,
  phone text NOT NULL,
  campaign_id uuid,
  job_id uuid,
  status text NOT NULL,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dispatch_contacts_company ON public.dispatch_contacts (company_id, phone);
CREATE INDEX IF NOT EXISTS idx_dispatch_contact_events_contact ON public.dispatch_contact_events (contact_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_dispatch_contact_events_company_phone ON public.dispatch_contact_events (company_id, phone);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.dispatch_contacts TO authenticated;
GRANT ALL ON public.dispatch_contacts TO service_role;
GRANT SELECT, INSERT ON public.dispatch_contact_events TO authenticated;
GRANT ALL ON public.dispatch_contact_events TO service_role;

ALTER TABLE public.dispatch_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dispatch_contact_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company members manage dispatch contacts"
  ON public.dispatch_contacts FOR ALL TO authenticated
  USING (public.user_belongs_to_company(company_id, auth.uid()))
  WITH CHECK (public.user_belongs_to_company(company_id, auth.uid()));

CREATE POLICY "Company members view dispatch contact events"
  ON public.dispatch_contact_events FOR SELECT TO authenticated
  USING (public.user_belongs_to_company(company_id, auth.uid()));

CREATE POLICY "Company members insert dispatch contact events"
  ON public.dispatch_contact_events FOR INSERT TO authenticated
  WITH CHECK (public.user_belongs_to_company(company_id, auth.uid()));

CREATE TRIGGER trg_dispatch_contacts_updated_at
  BEFORE UPDATE ON public.dispatch_contacts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.sync_dispatch_contact_from_job()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_contact_id uuid;
BEGIN
  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;
  IF NEW.status NOT IN ('sent', 'failed', 'error') THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.dispatch_contacts (company_id, phone, name, source, total_dispatches, last_dispatch_at, last_dispatch_status, last_campaign_id)
  VALUES (NEW.company_id, NEW.phone, NEW.contact_name, 'dispatch', 1, now(), NEW.status, NEW.campaign_id)
  ON CONFLICT (company_id, phone) DO UPDATE
    SET total_dispatches = public.dispatch_contacts.total_dispatches + 1,
        last_dispatch_at = now(),
        last_dispatch_status = EXCLUDED.last_dispatch_status,
        last_campaign_id = EXCLUDED.last_campaign_id,
        name = COALESCE(public.dispatch_contacts.name, EXCLUDED.name),
        updated_at = now()
  RETURNING id INTO v_contact_id;

  INSERT INTO public.dispatch_contact_events (company_id, contact_id, phone, campaign_id, job_id, status, error_message)
  VALUES (NEW.company_id, v_contact_id, NEW.phone, NEW.campaign_id, NEW.id, NEW.status, NEW.error_message);

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_dispatch_contact ON public.dispatch_jobs;
CREATE TRIGGER trg_sync_dispatch_contact
  AFTER UPDATE ON public.dispatch_jobs
  FOR EACH ROW EXECUTE FUNCTION public.sync_dispatch_contact_from_job();