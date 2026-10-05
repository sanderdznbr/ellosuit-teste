

-- Função para criar empresa automaticamente quando um usuário se registra
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
BEGIN
  -- Extrair domínio do email do usuário
  company_domain := split_part(NEW.email, '@', 2);
  
  -- Só criar empresa para domínios corporativos (não pessoais)
  IF company_domain NOT IN ('gmail.com', 'hotmail.com', 'yahoo.com', 'outlook.com', 'icloud.com', 'live.com', 'msn.com') THEN
    -- Verificar se já existe uma empresa com este domínio
    SELECT id INTO new_company_id 
    FROM public.companies 
    WHERE domain = company_domain 
    LIMIT 1;

    -- Se não encontrou empresa existente, criar uma nova
    IF new_company_id IS NULL THEN
      company_name := INITCAP(split_part(company_domain, '.', 1));
      
      INSERT INTO public.companies (name, domain, settings)
      VALUES (company_name, company_domain, '{}')
      RETURNING id INTO new_company_id;
    END IF;

    -- Vincular usuário à empresa como admin
    INSERT INTO public.company_users (company_id, user_id, role)
    VALUES (new_company_id, NEW.id, 'admin'::company_role);
  END IF;
  -- Para domínios pessoais, não criar empresa automaticamente

  RETURN NEW;
END;
$$;

-- Criar trigger para executar a função quando um usuário é criado
DROP TRIGGER IF EXISTS on_auth_user_created_company ON auth.users;
CREATE TRIGGER on_auth_user_created_company
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_company();

