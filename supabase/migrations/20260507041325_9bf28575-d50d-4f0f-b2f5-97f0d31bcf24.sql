-- Standard helper for admin checks if not exists
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TABLE IF NOT EXISTS public.hub_logos (
  hub_id TEXT PRIMARY KEY,
  svg_content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Enable RLS
ALTER TABLE public.hub_logos ENABLE ROW LEVEL SECURITY;

-- Policies
DROP POLICY IF EXISTS "Hub logos are viewable by everyone authenticated" ON public.hub_logos;
CREATE POLICY "Hub logos are viewable by everyone authenticated"
ON public.hub_logos FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "Only admins can modify hub logos" ON public.hub_logos;
CREATE POLICY "Only admins can modify hub logos"
ON public.hub_logos FOR ALL
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- Trigger for updated_at
DROP TRIGGER IF EXISTS update_hub_logos_updated_at ON public.hub_logos;
CREATE TRIGGER update_hub_logos_updated_at
BEFORE UPDATE ON public.hub_logos
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
