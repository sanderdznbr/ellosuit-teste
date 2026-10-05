-- Criar empresa para o usuário gustavo@runavimedia.com
DO $$
DECLARE
    user_uuid UUID;
    company_uuid UUID;
BEGIN
    -- Buscar o UUID do usuário
    SELECT id INTO user_uuid 
    FROM auth.users 
    WHERE email = 'gustavo@runavimedia.com';
    
    -- Criar empresa
    INSERT INTO public.companies (name, domain, settings)
    VALUES ('Runavi Media', 'runavimedia.com', '{}')
    RETURNING id INTO company_uuid;
    
    -- Associar usuário à empresa como admin
    INSERT INTO public.company_users (company_id, user_id, role)
    VALUES (company_uuid, user_uuid, 'admin');
    
    RAISE NOTICE 'Empresa criada com sucesso para gustavo@runavimedia.com';
END $$;