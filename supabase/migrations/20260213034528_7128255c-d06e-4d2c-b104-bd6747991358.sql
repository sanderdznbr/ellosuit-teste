
-- Add client_id to contact_group_members to link with clients table
ALTER TABLE public.contact_group_members ADD COLUMN client_id uuid REFERENCES public.clients(id) ON DELETE CASCADE;

-- Create index for faster lookups
CREATE INDEX idx_contact_group_members_client_id ON public.contact_group_members(client_id);
CREATE INDEX idx_contact_group_members_group_id ON public.contact_group_members(group_id);

-- Create table for form integration tokens
CREATE TABLE public.form_integration_tokens (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  created_by uuid NOT NULL,
  token text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  name text NOT NULL DEFAULT 'Formulário Padrão',
  contact_type text NOT NULL DEFAULT 'prospecto',
  is_active boolean NOT NULL DEFAULT true,
  fields_config jsonb DEFAULT '["name","email","phone"]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.form_integration_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their company form tokens"
ON public.form_integration_tokens
FOR ALL
USING (public.user_belongs_to_company(company_id, auth.uid()));

CREATE TRIGGER update_form_integration_tokens_updated_at
BEFORE UPDATE ON public.form_integration_tokens
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
