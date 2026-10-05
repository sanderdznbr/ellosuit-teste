
-- Catálogo de serviços/produtos da empresa
CREATE TABLE public.company_services (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  created_by UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  unit_price NUMERIC(12,2) NOT NULL DEFAULT 0,
  unit_label TEXT DEFAULT 'unidade',
  category TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Templates de proposta
CREATE TABLE public.proposal_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  created_by UUID NOT NULL,
  name TEXT NOT NULL,
  is_default BOOLEAN DEFAULT false,
  primary_color TEXT DEFAULT '#3000E3',
  secondary_color TEXT DEFAULT '#007DE3',
  accent_color TEXT DEFAULT '#FF4500',
  logo_url TEXT,
  header_text TEXT,
  footer_text TEXT,
  terms_text TEXT,
  cover_image_url TEXT,
  layout_config JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Propostas geradas
CREATE TABLE public.proposals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  created_by UUID NOT NULL,
  template_id UUID REFERENCES public.proposal_templates(id) ON DELETE SET NULL,
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  proposal_number TEXT,
  status TEXT NOT NULL DEFAULT 'rascunho',
  valid_until DATE,
  notes TEXT,
  discount_type TEXT DEFAULT 'none',
  discount_value NUMERIC(12,2) DEFAULT 0,
  subtotal NUMERIC(12,2) DEFAULT 0,
  total NUMERIC(12,2) DEFAULT 0,
  custom_colors JSONB DEFAULT '{}',
  custom_logo_url TEXT,
  custom_terms TEXT,
  custom_header TEXT,
  custom_footer TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Itens de cada proposta
CREATE TABLE public.proposal_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  proposal_id UUID NOT NULL REFERENCES public.proposals(id) ON DELETE CASCADE,
  service_id UUID REFERENCES public.company_services(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  description TEXT,
  quantity NUMERIC(10,2) NOT NULL DEFAULT 1,
  unit_price NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_price NUMERIC(12,2) NOT NULL DEFAULT 0,
  position INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.company_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proposal_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proposal_items ENABLE ROW LEVEL SECURITY;

-- Policies: company_services
CREATE POLICY "Users can view company services" ON public.company_services
  FOR SELECT USING (public.user_belongs_to_company(company_id, auth.uid()));
CREATE POLICY "Users can create company services" ON public.company_services
  FOR INSERT WITH CHECK (public.user_belongs_to_company(company_id, auth.uid()));
CREATE POLICY "Users can update company services" ON public.company_services
  FOR UPDATE USING (public.user_belongs_to_company(company_id, auth.uid()));
CREATE POLICY "Users can delete company services" ON public.company_services
  FOR DELETE USING (public.user_belongs_to_company(company_id, auth.uid()));

-- Policies: proposal_templates
CREATE POLICY "Users can view templates" ON public.proposal_templates
  FOR SELECT USING (public.user_belongs_to_company(company_id, auth.uid()));
CREATE POLICY "Users can create templates" ON public.proposal_templates
  FOR INSERT WITH CHECK (public.user_belongs_to_company(company_id, auth.uid()));
CREATE POLICY "Users can update templates" ON public.proposal_templates
  FOR UPDATE USING (public.user_belongs_to_company(company_id, auth.uid()));
CREATE POLICY "Users can delete templates" ON public.proposal_templates
  FOR DELETE USING (public.user_belongs_to_company(company_id, auth.uid()));

-- Policies: proposals
CREATE POLICY "Users can view proposals" ON public.proposals
  FOR SELECT USING (public.user_belongs_to_company(company_id, auth.uid()));
CREATE POLICY "Users can create proposals" ON public.proposals
  FOR INSERT WITH CHECK (public.user_belongs_to_company(company_id, auth.uid()));
CREATE POLICY "Users can update proposals" ON public.proposals
  FOR UPDATE USING (public.user_belongs_to_company(company_id, auth.uid()));
CREATE POLICY "Users can delete proposals" ON public.proposals
  FOR DELETE USING (public.user_belongs_to_company(company_id, auth.uid()));

-- Policies: proposal_items
CREATE POLICY "Users can view proposal items" ON public.proposal_items
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM public.proposals p WHERE p.id = proposal_id AND public.user_belongs_to_company(p.company_id, auth.uid())
  ));
CREATE POLICY "Users can create proposal items" ON public.proposal_items
  FOR INSERT WITH CHECK (EXISTS (
    SELECT 1 FROM public.proposals p WHERE p.id = proposal_id AND public.user_belongs_to_company(p.company_id, auth.uid())
  ));
CREATE POLICY "Users can update proposal items" ON public.proposal_items
  FOR UPDATE USING (EXISTS (
    SELECT 1 FROM public.proposals p WHERE p.id = proposal_id AND public.user_belongs_to_company(p.company_id, auth.uid())
  ));
CREATE POLICY "Users can delete proposal items" ON public.proposal_items
  FOR DELETE USING (EXISTS (
    SELECT 1 FROM public.proposals p WHERE p.id = proposal_id AND public.user_belongs_to_company(p.company_id, auth.uid())
  ));

-- Triggers for updated_at
CREATE TRIGGER update_company_services_updated_at BEFORE UPDATE ON public.company_services
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER update_proposal_templates_updated_at BEFORE UPDATE ON public.proposal_templates
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER update_proposals_updated_at BEFORE UPDATE ON public.proposals
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Auto-generate proposal number
CREATE OR REPLACE FUNCTION public.generate_proposal_number()
RETURNS TRIGGER AS $$
DECLARE
  next_num INTEGER;
BEGIN
  SELECT COALESCE(MAX(CAST(SUBSTRING(proposal_number FROM '[0-9]+$') AS INTEGER)), 0) + 1
  INTO next_num
  FROM public.proposals
  WHERE company_id = NEW.company_id;
  
  NEW.proposal_number := 'PROP-' || LPAD(next_num::TEXT, 4, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER generate_proposal_number_trigger
  BEFORE INSERT ON public.proposals
  FOR EACH ROW
  WHEN (NEW.proposal_number IS NULL)
  EXECUTE FUNCTION public.generate_proposal_number();
