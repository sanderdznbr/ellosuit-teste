
-- Corrigir a função de criação automática de empresa para garantir que sempre funcione
CREATE OR REPLACE FUNCTION public.handle_new_user_company()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  company_name TEXT;
  company_domain TEXT;
  new_company_id UUID;
  user_company_name TEXT;
BEGIN
  -- Extrair domínio do email do usuário
  company_domain := split_part(NEW.email, '@', 2);
  
  -- Obter nome da empresa dos metadados do usuário (se fornecido)
  user_company_name := NEW.raw_user_meta_data->>'company_name';
  
  -- Log para debug
  RAISE LOG 'Creating company for user: %, domain: %, company_name: %', NEW.email, company_domain, user_company_name;
  
  -- Para domínios corporativos, verificar se já existe empresa
  IF company_domain NOT IN ('gmail.com', 'hotmail.com', 'yahoo.com', 'outlook.com', 'icloud.com', 'live.com', 'msn.com') THEN
    -- Verificar se já existe uma empresa com este domínio
    SELECT id INTO new_company_id 
    FROM public.companies 
    WHERE domain = company_domain 
    LIMIT 1;

    -- Se não encontrou empresa existente, criar uma nova
    IF new_company_id IS NULL THEN
      company_name := COALESCE(user_company_name, INITCAP(split_part(company_domain, '.', 1)));
      
      INSERT INTO public.companies (name, domain, settings)
      VALUES (company_name, company_domain, '{}')
      RETURNING id INTO new_company_id;
      
      RAISE LOG 'Created corporate company: % with ID: %', company_name, new_company_id;
    END IF;
  ELSE
    -- Para domínios pessoais, sempre criar nova empresa
    IF user_company_name IS NOT NULL AND user_company_name != '' THEN
      company_name := user_company_name;
    ELSE
      -- Se não forneceu nome da empresa, criar com nome baseado no usuário
      company_name := COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)) || ' Company';
    END IF;
    
    INSERT INTO public.companies (name, domain, settings)
    VALUES (company_name, NULL, '{}')
    RETURNING id INTO new_company_id;
    
    RAISE LOG 'Created personal company: % with ID: %', company_name, new_company_id;
  END IF;

  -- Sempre vincular usuário à empresa como admin
  IF new_company_id IS NOT NULL THEN
    INSERT INTO public.company_users (company_id, user_id, role)
    VALUES (new_company_id, NEW.id, 'admin'::company_role);
    
    RAISE LOG 'Associated user % with company %', NEW.id, new_company_id;
  ELSE
    RAISE LOG 'Failed to create or find company for user %', NEW.id;
  END IF;

  RETURN NEW;
END;
$$;

-- Criar função para associar usuários existentes sem empresa
CREATE OR REPLACE FUNCTION public.associate_existing_users_with_companies()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
    -- Extrair nome da empresa dos metadados
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

-- Executar a função para associar usuários existentes
SELECT public.associate_existing_users_with_companies();
