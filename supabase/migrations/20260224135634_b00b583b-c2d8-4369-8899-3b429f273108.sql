
-- Table to store generated carousels
CREATE TABLE public.generated_carousels (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  topic TEXT NOT NULL,
  keywords TEXT[] DEFAULT '{}',
  carousel_data JSONB NOT NULL,
  style_config JSONB DEFAULT '{}',
  card_count INTEGER NOT NULL DEFAULT 7,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.generated_carousels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own company carousels"
  ON public.generated_carousels FOR SELECT
  USING (public.user_belongs_to_company(company_id, auth.uid()));

CREATE POLICY "Users can create carousels"
  ON public.generated_carousels FOR INSERT
  WITH CHECK (public.user_belongs_to_company(company_id, auth.uid()));

CREATE POLICY "Users can update own carousels"
  ON public.generated_carousels FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own carousels"
  ON public.generated_carousels FOR DELETE
  USING (auth.uid() = user_id);

CREATE TRIGGER update_generated_carousels_updated_at
  BEFORE UPDATE ON public.generated_carousels
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE INDEX idx_generated_carousels_company ON public.generated_carousels(company_id);
CREATE INDEX idx_generated_carousels_user ON public.generated_carousels(user_id);
