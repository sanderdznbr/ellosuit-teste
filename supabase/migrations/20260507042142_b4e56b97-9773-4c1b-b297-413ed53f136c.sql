-- Create user_roles table if it's missing (it seems it was expected by is_admin function)
CREATE TABLE IF NOT EXISTS public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('admin', 'user')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(user_id, role)
);

-- Enable RLS
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Policies for user_roles
CREATE POLICY "Admins can view all roles" ON public.user_roles
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.role = 'admin'
    )
  );

CREATE POLICY "Users can view their own roles" ON public.user_roles
  FOR SELECT USING (auth.uid() = user_id);

-- Ensure the current user is an admin so they can actually save the logos
-- Note: We use a subquery to get the current user ID
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM auth.users WHERE id = auth.uid()) THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (auth.uid(), 'admin')
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
END $$;

-- Refresh the hub_logos policies to ensure they work with the fixed is_admin()
DROP POLICY IF EXISTS "Only admins can modify hub logos" ON public.hub_logos;
CREATE POLICY "Only admins can modify hub logos" 
ON public.hub_logos 
FOR ALL 
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);
