
-- Contract Templates table
CREATE TABLE public.contract_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  created_by UUID NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  content TEXT NOT NULL DEFAULT '',
  fields JSONB NOT NULL DEFAULT '[]',
  logo_url TEXT,
  letterhead_url TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.contract_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view company contract templates"
  ON public.contract_templates FOR SELECT
  USING (public.user_belongs_to_company(company_id, auth.uid()));

CREATE POLICY "Users can create contract templates"
  ON public.contract_templates FOR INSERT
  WITH CHECK (public.user_belongs_to_company(company_id, auth.uid()));

CREATE POLICY "Users can update company contract templates"
  ON public.contract_templates FOR UPDATE
  USING (public.user_belongs_to_company(company_id, auth.uid()));

CREATE POLICY "Users can delete company contract templates"
  ON public.contract_templates FOR DELETE
  USING (public.user_belongs_to_company(company_id, auth.uid()));

CREATE TRIGGER update_contract_templates_updated_at
  BEFORE UPDATE ON public.contract_templates
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Generated Contracts table
CREATE TABLE public.generated_contracts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  template_id UUID NOT NULL REFERENCES public.contract_templates(id) ON DELETE CASCADE,
  created_by UUID NOT NULL,
  title TEXT NOT NULL,
  filled_fields JSONB NOT NULL DEFAULT '{}',
  final_content TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'draft',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.generated_contracts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view company generated contracts"
  ON public.generated_contracts FOR SELECT
  USING (public.user_belongs_to_company(company_id, auth.uid()));

CREATE POLICY "Users can create generated contracts"
  ON public.generated_contracts FOR INSERT
  WITH CHECK (public.user_belongs_to_company(company_id, auth.uid()));

CREATE POLICY "Users can update company generated contracts"
  ON public.generated_contracts FOR UPDATE
  USING (public.user_belongs_to_company(company_id, auth.uid()));

CREATE POLICY "Users can delete company generated contracts"
  ON public.generated_contracts FOR DELETE
  USING (public.user_belongs_to_company(company_id, auth.uid()));

CREATE TRIGGER update_generated_contracts_updated_at
  BEFORE UPDATE ON public.generated_contracts
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Storage bucket for contract assets (logos, letterheads)
INSERT INTO storage.buckets (id, name, public) VALUES ('contract-assets', 'contract-assets', true);

CREATE POLICY "Users can upload contract assets"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'contract-assets' AND auth.uid() IS NOT NULL);

CREATE POLICY "Contract assets are publicly accessible"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'contract-assets');

CREATE POLICY "Users can update their contract assets"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'contract-assets' AND auth.uid() IS NOT NULL);

CREATE POLICY "Users can delete their contract assets"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'contract-assets' AND auth.uid() IS NOT NULL);
