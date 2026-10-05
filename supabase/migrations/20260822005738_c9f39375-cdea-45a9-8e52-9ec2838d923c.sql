ALTER TABLE public.dispatch_campaigns
  ADD COLUMN IF NOT EXISTS delay_mode text NOT NULL DEFAULT 'fixed',
  ADD COLUMN IF NOT EXISTS delay_variants jsonb NOT NULL DEFAULT '[120,180,240,300,480]'::jsonb,
  ADD COLUMN IF NOT EXISTS reply_ai_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS reply_ai_link text,
  ADD COLUMN IF NOT EXISTS reply_ai_offer text,
  ADD COLUMN IF NOT EXISTS reply_ai_interested_message text,
  ADD COLUMN IF NOT EXISTS reply_ai_not_interested_message text;

CREATE TABLE IF NOT EXISTS public.dispatch_reply_watch (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  campaign_id uuid NOT NULL REFERENCES public.dispatch_campaigns(id) ON DELETE CASCADE,
  conversation_id uuid NOT NULL,
  phone text NOT NULL,
  contact_name text,
  status text NOT NULL DEFAULT 'waiting',
  classification text,
  replied_at timestamptz,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS dispatch_reply_watch_unique ON public.dispatch_reply_watch (campaign_id, conversation_id);
CREATE INDEX IF NOT EXISTS dispatch_reply_watch_conv_idx ON public.dispatch_reply_watch (conversation_id, status);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.dispatch_reply_watch TO authenticated;
GRANT ALL ON public.dispatch_reply_watch TO service_role;

ALTER TABLE public.dispatch_reply_watch ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company members can view reply watch" ON public.dispatch_reply_watch
FOR SELECT TO authenticated
USING (company_id IN (SELECT company_users.company_id FROM public.company_users WHERE company_users.user_id = auth.uid()));

CREATE POLICY "Company members can manage reply watch" ON public.dispatch_reply_watch
FOR ALL TO authenticated
USING (company_id IN (SELECT company_users.company_id FROM public.company_users WHERE company_users.user_id = auth.uid()))
WITH CHECK (company_id IN (SELECT company_users.company_id FROM public.company_users WHERE company_users.user_id = auth.uid()));