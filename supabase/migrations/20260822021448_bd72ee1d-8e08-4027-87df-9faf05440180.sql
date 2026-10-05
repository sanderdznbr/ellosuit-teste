ALTER TABLE public.dispatch_campaigns ADD COLUMN IF NOT EXISTS client_key text;
CREATE UNIQUE INDEX IF NOT EXISTS uniq_dispatch_campaigns_client_key
  ON public.dispatch_campaigns (company_id, client_key)
  WHERE client_key IS NOT NULL;