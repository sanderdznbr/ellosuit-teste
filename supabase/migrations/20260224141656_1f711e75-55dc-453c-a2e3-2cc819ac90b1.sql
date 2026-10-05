
CREATE TABLE public.carousel_style_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  images JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.carousel_style_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own company style templates"
ON public.carousel_style_templates FOR SELECT
USING (public.user_belongs_to_company(company_id, auth.uid()));

CREATE POLICY "Users can create style templates"
ON public.carousel_style_templates FOR INSERT
WITH CHECK (public.user_belongs_to_company(company_id, auth.uid()));

CREATE POLICY "Users can update own style templates"
ON public.carousel_style_templates FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own style templates"
ON public.carousel_style_templates FOR DELETE
USING (auth.uid() = user_id);

CREATE TRIGGER update_carousel_style_templates_updated_at
BEFORE UPDATE ON public.carousel_style_templates
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
