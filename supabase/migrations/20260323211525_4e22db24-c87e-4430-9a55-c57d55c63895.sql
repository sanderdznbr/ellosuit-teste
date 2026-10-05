CREATE TABLE public.ycloud_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id text NOT NULL,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  contact_phone text NOT NULL,
  contact_name text,
  profile_picture text,
  last_message_at timestamptz,
  status text DEFAULT 'active',
  source text DEFAULT 'ycloud_api',
  has_conversation boolean DEFAULT false,
  ycloud_contact_id text,
  conversation_id text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(session_id, contact_phone)
);

ALTER TABLE public.ycloud_contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their company ycloud contacts"
ON public.ycloud_contacts FOR SELECT TO authenticated
USING (public.user_belongs_to_company(company_id, auth.uid()));

CREATE POLICY "Users can insert ycloud contacts for their company"
ON public.ycloud_contacts FOR INSERT TO authenticated
WITH CHECK (public.user_belongs_to_company(company_id, auth.uid()));

CREATE POLICY "Users can update ycloud contacts for their company"
ON public.ycloud_contacts FOR UPDATE TO authenticated
USING (public.user_belongs_to_company(company_id, auth.uid()));

CREATE POLICY "Service role full access ycloud contacts"
ON public.ycloud_contacts FOR ALL TO service_role
USING (true) WITH CHECK (true);

CREATE INDEX idx_ycloud_contacts_session ON public.ycloud_contacts(session_id);
CREATE INDEX idx_ycloud_contacts_company ON public.ycloud_contacts(company_id);
CREATE INDEX idx_ycloud_contacts_phone ON public.ycloud_contacts(contact_phone);