
-- Primeiro, corrigir as políticas RLS que estão causando recursão infinita
-- Remover as políticas problemáticas da tabela company_users
DROP POLICY IF EXISTS "Company admins can manage company users" ON public.company_users;
DROP POLICY IF EXISTS "Users can view company users from their companies" ON public.company_users;

-- Criar função SECURITY DEFINER para verificar se usuário é admin/manager de uma empresa
CREATE OR REPLACE FUNCTION public.is_company_admin_or_manager(company_id uuid, user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM public.company_users 
    WHERE company_users.company_id = $1 
      AND company_users.user_id = $2 
      AND company_users.role IN ('admin', 'manager')
  );
$$;

-- Criar função SECURITY DEFINER para verificar se usuário pertence a uma empresa
CREATE OR REPLACE FUNCTION public.user_belongs_to_company(company_id uuid, user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM public.company_users 
    WHERE company_users.company_id = $1 
      AND company_users.user_id = $2
  );
$$;

-- Recriar políticas RLS sem recursão usando as funções SECURITY DEFINER
CREATE POLICY "Company admins can manage company users"
  ON public.company_users
  FOR ALL
  USING (public.is_company_admin_or_manager(company_id, auth.uid()));

CREATE POLICY "Users can view company users from their companies"
  ON public.company_users
  FOR SELECT
  USING (public.user_belongs_to_company(company_id, auth.uid()));

-- Modificar a função de criação automática de empresa para sempre criar uma empresa
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
    END IF;
  ELSE
    -- Para domínios pessoais, sempre criar nova empresa com nome fornecido
    IF user_company_name IS NOT NULL AND user_company_name != '' THEN
      company_name := user_company_name;
      
      INSERT INTO public.companies (name, domain, settings)
      VALUES (company_name, NULL, '{}')
      RETURNING id INTO new_company_id;
    ELSE
      -- Se não forneceu nome da empresa, criar com nome baseado no usuário
      company_name := COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)) || ' Company';
      
      INSERT INTO public.companies (name, domain, settings)
      VALUES (company_name, NULL, '{}')
      RETURNING id INTO new_company_id;
    END IF;
  END IF;

  -- Sempre vincular usuário à empresa como admin
  IF new_company_id IS NOT NULL THEN
    INSERT INTO public.company_users (company_id, user_id, role)
    VALUES (new_company_id, NEW.id, 'admin'::company_role);
  END IF;

  RETURN NEW;
END;
$$;
