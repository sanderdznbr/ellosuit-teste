
-- Table to store receipt design/theme settings per company
CREATE TABLE public.receipt_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  created_by UUID NOT NULL,
  
  -- Company info displayed on receipt
  company_name TEXT,
  company_cnpj TEXT,
  company_address TEXT,
  company_phone TEXT,
  company_email TEXT,
  company_website TEXT,
  
  -- Logo
  logo_url TEXT,
  logo_position TEXT DEFAULT 'left' CHECK (logo_position IN ('left', 'center', 'right')),
  
  -- Colors
  primary_color TEXT DEFAULT '#1E00C8',
  secondary_color TEXT DEFAULT '#F5F5FF',
  text_color TEXT DEFAULT '#1E1E1E',
  accent_color TEXT DEFAULT '#6B7280',
  
  -- Layout
  layout_style TEXT DEFAULT 'modern' CHECK (layout_style IN ('modern', 'classic', 'minimal', 'corporate')),
  show_border BOOLEAN DEFAULT true,
  show_watermark BOOLEAN DEFAULT false,
  watermark_text TEXT,
  
  -- Footer
  footer_text TEXT DEFAULT 'Documento gerado eletronicamente',
  show_signature_line BOOLEAN DEFAULT true,
  signature_label TEXT DEFAULT 'Assinatura',
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  UNIQUE(company_id)
);

-- Enable RLS
ALTER TABLE public.receipt_settings ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view their company receipt settings"
  ON public.receipt_settings FOR SELECT
  USING (public.user_belongs_to_company(company_id, auth.uid()));

CREATE POLICY "Users can insert their company receipt settings"
  ON public.receipt_settings FOR INSERT
  WITH CHECK (public.user_belongs_to_company(company_id, auth.uid()));

CREATE POLICY "Users can update their company receipt settings"
  ON public.receipt_settings FOR UPDATE
  USING (public.user_belongs_to_company(company_id, auth.uid()));

-- Auto-update updated_at
CREATE TRIGGER update_receipt_settings_updated_at
  BEFORE UPDATE ON public.receipt_settings
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
