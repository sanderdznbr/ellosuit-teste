-- Adicionar colunas necessárias para Voz IA e Mídias na tabela dispatch_campaigns
ALTER TABLE public.dispatch_campaigns 
ADD COLUMN IF NOT EXISTS media_type text DEFAULT 'text',
ADD COLUMN IF NOT EXISTS media_url text,
ADD COLUMN IF NOT EXISTS voice_ia_script text,
ADD COLUMN IF NOT EXISTS voice_ia_mention_names boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS voice_ia_voice_id text;

-- Adicionar coluna contact_name na tabela dispatch_jobs para suportar personalização
ALTER TABLE public.dispatch_jobs
ADD COLUMN IF NOT EXISTS contact_name text;

-- Atualizar grants para garantir que as novas colunas sejam acessíveis
GRANT SELECT, INSERT, UPDATE, DELETE ON public.dispatch_campaigns TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.dispatch_jobs TO authenticated;
GRANT ALL ON public.dispatch_campaigns TO service_role;
GRANT ALL ON public.dispatch_jobs TO service_role;
