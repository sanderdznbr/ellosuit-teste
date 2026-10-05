
-- Adicionar a coluna custom_favicon_url na tabela user_sidebar_settings
ALTER TABLE public.user_sidebar_settings 
ADD COLUMN custom_favicon_url text;
