-- Primeiro, criar empresa para usuários existentes sem empresa
DO $$
DECLARE
  user_record RECORD;
  company_name TEXT;
  new_company_id UUID;
BEGIN
  -- Encontrar usuários que não têm empresa associada
  FOR user_record IN 
    SELECT u.id, u.email, u.raw_user_meta_data
    FROM auth.users u
    LEFT JOIN public.company_users cu ON u.id = cu.user_id
    WHERE cu.user_id IS NULL
  LOOP
    -- Extrair nome da empresa dos metadados ou criar baseado no email
    company_name := user_record.raw_user_meta_data->>'company_name';
    
    -- Se não tem nome da empresa, criar baseado no username ou email
    IF company_name IS NULL OR company_name = '' THEN
      company_name := COALESCE(user_record.raw_user_meta_data->>'username', split_part(user_record.email, '@', 1)) || ' Company';
    END IF;
    
    -- Criar nova empresa
    INSERT INTO public.companies (name, domain, settings)
    VALUES (company_name, NULL, '{}')
    RETURNING id INTO new_company_id;
    
    -- Associar usuário à empresa como admin
    INSERT INTO public.company_users (company_id, user_id, role)
    VALUES (new_company_id, user_record.id, 'admin'::company_role);
    
    RAISE LOG 'Associated existing user % with new company % (%)', user_record.email, company_name, new_company_id;
  END LOOP;
END;
$$;