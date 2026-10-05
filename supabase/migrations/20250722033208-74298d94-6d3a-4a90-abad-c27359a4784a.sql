
-- Adicionar a coluna sidebar_background_color na tabela user_sidebar_settings
ALTER TABLE public.user_sidebar_settings 
ADD COLUMN sidebar_background_color text DEFAULT '#ffffff';
