
-- Categorias de tutoriais
CREATE TABLE public.tutorial_categories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  icon TEXT,
  color TEXT DEFAULT '#3000E3',
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.tutorial_categories ENABLE ROW LEVEL SECURITY;

-- Todos podem ver categorias ativas
CREATE POLICY "Anyone can view active categories"
  ON public.tutorial_categories FOR SELECT
  USING (is_active = true);

-- Apenas adminmaster pode gerenciar
CREATE POLICY "Adminmaster can manage categories"
  ON public.tutorial_categories FOR ALL
  USING (public.is_adminmaster(auth.uid()))
  WITH CHECK (public.is_adminmaster(auth.uid()));

-- Tutoriais
CREATE TABLE public.tutorials (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  category_id UUID NOT NULL REFERENCES public.tutorial_categories(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  video_url TEXT NOT NULL,
  thumbnail_url TEXT,
  duration_seconds INTEGER,
  sort_order INTEGER DEFAULT 0,
  is_published BOOLEAN DEFAULT false,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.tutorials ENABLE ROW LEVEL SECURITY;

-- Todos autenticados podem ver tutoriais publicados
CREATE POLICY "Anyone can view published tutorials"
  ON public.tutorials FOR SELECT
  USING (is_published = true);

-- Adminmaster pode gerenciar
CREATE POLICY "Adminmaster can manage tutorials"
  ON public.tutorials FOR ALL
  USING (public.is_adminmaster(auth.uid()))
  WITH CHECK (public.is_adminmaster(auth.uid()));

-- Trigger updated_at
CREATE TRIGGER update_tutorial_categories_updated_at
  BEFORE UPDATE ON public.tutorial_categories
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER update_tutorials_updated_at
  BEFORE UPDATE ON public.tutorials
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Storage bucket para vídeos de tutoriais
INSERT INTO storage.buckets (id, name, public) VALUES ('tutorials', 'tutorials', true);

CREATE POLICY "Anyone can view tutorial files"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'tutorials');

CREATE POLICY "Adminmaster can upload tutorial files"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'tutorials');

CREATE POLICY "Adminmaster can update tutorial files"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'tutorials');

CREATE POLICY "Adminmaster can delete tutorial files"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'tutorials');

-- Inserir categorias padrão
INSERT INTO public.tutorial_categories (name, slug, icon, color, sort_order) VALUES
  ('Omni', 'omni', 'MessageSquare', '#FF4500', 1),
  ('Flow', 'flow', 'Calendar', '#3000E3', 2),
  ('Track', 'track', 'BarChart3', '#10B981', 3),
  ('Geral', 'geral', 'BookOpen', '#6366F1', 4);
