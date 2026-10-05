
-- Adicionar campos extras para clientes
ALTER TABLE public.clients 
ADD COLUMN IF NOT EXISTS avatar_url TEXT,
ADD COLUMN IF NOT EXISTS birth_date DATE,
ADD COLUMN IF NOT EXISTS profession TEXT,
ADD COLUMN IF NOT EXISTS website TEXT,
ADD COLUMN IF NOT EXISTS linkedin TEXT,
ADD COLUMN IF NOT EXISTS instagram TEXT,
ADD COLUMN IF NOT EXISTS facebook TEXT,
ADD COLUMN IF NOT EXISTS whatsapp_business TEXT,
ADD COLUMN IF NOT EXISTS tags TEXT[],
ADD COLUMN IF NOT EXISTS client_type TEXT DEFAULT 'individual',
ADD COLUMN IF NOT EXISTS company_size TEXT,
ADD COLUMN IF NOT EXISTS industry TEXT,
ADD COLUMN IF NOT EXISTS annual_revenue DECIMAL(15,2);

-- Criar tabela para configurações personalizadas da sidebar do usuário
CREATE TABLE IF NOT EXISTS public.user_sidebar_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users NOT NULL,
  company_id UUID NOT NULL,
  sidebar_color TEXT DEFAULT '#3600FF',
  custom_logo_url TEXT,
  menu_order JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, company_id)
);

-- Habilitar RLS na tabela de configurações da sidebar
ALTER TABLE public.user_sidebar_settings ENABLE ROW LEVEL SECURITY;

-- Política para que usuários possam gerenciar suas próprias configurações
CREATE POLICY "Users can manage their own sidebar settings" 
  ON public.user_sidebar_settings 
  FOR ALL 
  USING (user_id = auth.uid());

-- Trigger para atualizar updated_at
CREATE OR REPLACE TRIGGER update_user_sidebar_settings_updated_at
  BEFORE UPDATE ON public.user_sidebar_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- Adicionar campo para hierarquia de pastas nos documentos
ALTER TABLE public.document_folders 
ADD COLUMN IF NOT EXISTS description TEXT,
ADD COLUMN IF NOT EXISTS color TEXT DEFAULT '#3B82F6';

-- Criar tabela para armazenamento de arquivos
CREATE TABLE IF NOT EXISTS public.document_files (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  document_id UUID REFERENCES public.documents(id) ON DELETE CASCADE NOT NULL,
  file_path TEXT NOT NULL,
  file_size BIGINT NOT NULL,
  mime_type TEXT NOT NULL,
  original_filename TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(document_id, file_path)
);

-- Habilitar RLS na tabela de arquivos
ALTER TABLE public.document_files ENABLE ROW LEVEL SECURITY;

-- Política para arquivos - usuários podem ver arquivos de documentos da empresa
CREATE POLICY "Users can view company document files" 
  ON public.document_files 
  FOR SELECT 
  USING (
    document_id IN (
      SELECT d.id FROM public.documents d
      WHERE d.company_id IN (
        SELECT company_id FROM public.company_users 
        WHERE user_id = auth.uid()
      )
    )
  );

-- Política para inserir arquivos
CREATE POLICY "Users can create document files" 
  ON public.document_files 
  FOR INSERT 
  WITH CHECK (
    document_id IN (
      SELECT d.id FROM public.documents d
      WHERE d.company_id IN (
        SELECT company_id FROM public.company_users 
        WHERE user_id = auth.uid()
      )
    )
  );

-- Política para deletar arquivos
CREATE POLICY "Users can delete document files" 
  ON public.document_files 
  FOR DELETE 
  USING (
    document_id IN (
      SELECT d.id FROM public.documents d
      WHERE d.created_by = auth.uid()
    )
  );
