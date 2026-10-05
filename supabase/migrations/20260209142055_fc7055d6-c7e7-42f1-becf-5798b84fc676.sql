
-- Rename existing company to SAYD
UPDATE public.companies SET name = 'SAYD' WHERE id = 'f4c902ec-fc62-4bf8-9176-20873469e0bf';

-- Create trigger to auto-create company on new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_company_id uuid;
  company_name_val text;
BEGIN
  -- Get company name from metadata or use email prefix
  company_name_val := COALESCE(
    NEW.raw_user_meta_data->>'company_name',
    split_part(NEW.email, '@', 1)
  );

  -- Create a new company for the user
  INSERT INTO public.companies (name)
  VALUES (company_name_val)
  RETURNING id INTO new_company_id;

  -- Link user to company as admin
  INSERT INTO public.company_users (user_id, company_id, role)
  VALUES (NEW.id, new_company_id, 'admin');

  RETURN NEW;
END;
$$;

-- Drop existing trigger if any
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Create trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();
