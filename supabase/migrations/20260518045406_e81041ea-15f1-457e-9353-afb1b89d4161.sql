CREATE TABLE IF NOT EXISTS public.tutorial_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tutorial_id UUID NOT NULL REFERENCES public.tutorials(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  author_name TEXT,
  author_avatar TEXT,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tutorial_comments_tutorial ON public.tutorial_comments(tutorial_id, created_at DESC);

ALTER TABLE public.tutorial_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can read tutorial comments"
ON public.tutorial_comments FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Users insert their own tutorial comments"
ON public.tutorial_comments FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update their own tutorial comments"
ON public.tutorial_comments FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users delete their own tutorial comments"
ON public.tutorial_comments FOR DELETE
TO authenticated
USING (auth.uid() = user_id);