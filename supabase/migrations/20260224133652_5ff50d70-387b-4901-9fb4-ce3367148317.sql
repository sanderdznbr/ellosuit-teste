
-- Table for Ellosuit brand assets (logos, screenshots, etc.)
CREATE TABLE public.brand_assets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  file_url TEXT NOT NULL,
  file_type TEXT NOT NULL DEFAULT 'image',
  category TEXT NOT NULL DEFAULT 'screenshot',
  tags TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.brand_assets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view brand assets of their company"
  ON public.brand_assets FOR SELECT
  USING (public.user_belongs_to_company(company_id, auth.uid()));

CREATE POLICY "Users can insert brand assets for their company"
  ON public.brand_assets FOR INSERT
  WITH CHECK (public.user_belongs_to_company(company_id, auth.uid()));

CREATE POLICY "Users can update brand assets of their company"
  ON public.brand_assets FOR UPDATE
  USING (public.user_belongs_to_company(company_id, auth.uid()));

CREATE POLICY "Users can delete brand assets of their company"
  ON public.brand_assets FOR DELETE
  USING (public.user_belongs_to_company(company_id, auth.uid()));

CREATE TRIGGER update_brand_assets_updated_at
  BEFORE UPDATE ON public.brand_assets
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Storage bucket for brand assets
INSERT INTO storage.buckets (id, name, public) VALUES ('brand-assets', 'brand-assets', true);

CREATE POLICY "Users can upload brand assets"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'brand-assets');

CREATE POLICY "Brand assets are publicly readable"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'brand-assets');

CREATE POLICY "Users can delete brand assets"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'brand-assets');
