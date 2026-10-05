
-- Tabela para armazenar conexões de redes sociais (Facebook/Instagram)
CREATE TABLE public.social_connections (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  platform TEXT NOT NULL CHECK (platform IN ('facebook', 'instagram')),
  access_token TEXT NOT NULL,
  long_lived_token TEXT,
  page_id TEXT,
  page_name TEXT,
  page_access_token TEXT,
  instagram_account_id TEXT,
  instagram_username TEXT,
  token_expires_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.social_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own company connections"
  ON public.social_connections FOR SELECT
  USING (public.user_belongs_to_company(company_id, auth.uid()));

CREATE POLICY "Users can insert own company connections"
  ON public.social_connections FOR INSERT
  WITH CHECK (public.user_belongs_to_company(company_id, auth.uid()));

CREATE POLICY "Users can update own company connections"
  ON public.social_connections FOR UPDATE
  USING (public.user_belongs_to_company(company_id, auth.uid()));

CREATE POLICY "Users can delete own company connections"
  ON public.social_connections FOR DELETE
  USING (public.user_belongs_to_company(company_id, auth.uid()));

CREATE TRIGGER update_social_connections_updated_at
  BEFORE UPDATE ON public.social_connections
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Tabela para posts agendados/publicados
CREATE TABLE public.social_posts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  connection_id UUID REFERENCES public.social_connections(id) ON DELETE SET NULL,
  platform TEXT NOT NULL CHECK (platform IN ('facebook', 'instagram')),
  post_type TEXT NOT NULL DEFAULT 'carousel' CHECK (post_type IN ('carousel', 'image', 'video', 'text')),
  caption TEXT,
  media_urls TEXT[] DEFAULT '{}',
  carousel_id UUID,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'publishing', 'published', 'failed')),
  scheduled_at TIMESTAMPTZ,
  published_at TIMESTAMPTZ,
  external_post_id TEXT,
  error_message TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.social_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own company posts"
  ON public.social_posts FOR SELECT
  USING (public.user_belongs_to_company(company_id, auth.uid()));

CREATE POLICY "Users can insert own company posts"
  ON public.social_posts FOR INSERT
  WITH CHECK (public.user_belongs_to_company(company_id, auth.uid()));

CREATE POLICY "Users can update own company posts"
  ON public.social_posts FOR UPDATE
  USING (public.user_belongs_to_company(company_id, auth.uid()));

CREATE POLICY "Users can delete own company posts"
  ON public.social_posts FOR DELETE
  USING (public.user_belongs_to_company(company_id, auth.uid()));

CREATE TRIGGER update_social_posts_updated_at
  BEFORE UPDATE ON public.social_posts
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
