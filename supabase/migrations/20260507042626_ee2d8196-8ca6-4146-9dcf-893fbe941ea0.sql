DROP POLICY IF EXISTS "Only admins can modify hub logos" ON public.hub_logos;

CREATE POLICY "Adminmasters can modify hub logos"
ON public.hub_logos
FOR ALL
TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.company_users
  WHERE company_users.user_id = auth.uid()
    AND company_users.role = 'adminmaster'
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.company_users
  WHERE company_users.user_id = auth.uid()
    AND company_users.role = 'adminmaster'
));