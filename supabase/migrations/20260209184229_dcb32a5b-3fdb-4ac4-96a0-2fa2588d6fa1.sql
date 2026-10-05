
-- Helper function first
CREATE OR REPLACE FUNCTION public.is_adminmaster(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.company_users
    WHERE user_id = _user_id
      AND role = 'adminmaster'
  );
$$;
