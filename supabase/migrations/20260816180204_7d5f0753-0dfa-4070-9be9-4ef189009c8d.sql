
CREATE TABLE IF NOT EXISTS public.cloned_voices (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  voice_id TEXT NOT NULL UNIQUE,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.cloned_voices ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, DELETE ON public.cloned_voices TO authenticated;
GRANT ALL ON public.cloned_voices TO service_role;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can view own company voices') THEN
    CREATE POLICY "Users can view own company voices"
      ON public.cloned_voices FOR SELECT
      TO authenticated
      USING (public.user_belongs_to_company(company_id, auth.uid()));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can insert own company voices') THEN
    CREATE POLICY "Users can insert own company voices"
      ON public.cloned_voices FOR INSERT
      TO authenticated
      WITH CHECK (public.user_belongs_to_company(company_id, auth.uid()));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can delete own company voices') THEN
    CREATE POLICY "Users can delete own company voices"
      ON public.cloned_voices FOR DELETE
      TO authenticated
      USING (public.user_belongs_to_company(company_id, auth.uid()));
  END IF;
END
$$;
