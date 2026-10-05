-- =============================================
-- SISTEMA DE PERMISSÕES PARA FUNCIONÁRIOS
-- =============================================

-- 1. Criar enum para tipos de permissões
CREATE TYPE public.permission_type AS ENUM (
  'view_calendar',
  'manage_calendar',
  'view_clients',
  'manage_clients',
  'view_emails',
  'send_emails',
  'manage_email_campaigns',
  'view_documents',
  'manage_documents',
  'view_meetings',
  'create_meetings',
  'view_tasks',
  'manage_tasks',
  'view_analytics',
  'manage_settings',
  'manage_users',
  'view_crm',
  'manage_crm',
  'view_tracking',
  'manage_tracking'
);

-- 2. Criar tabela de permissões de usuários
CREATE TABLE IF NOT EXISTS public.user_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  permission permission_type NOT NULL,
  granted_by UUID REFERENCES auth.users(id),
  granted_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(user_id, company_id, permission)
);

-- 3. Habilitar RLS
ALTER TABLE public.user_permissions ENABLE ROW LEVEL SECURITY;

-- 4. Criar função security definer para verificar permissões
CREATE OR REPLACE FUNCTION public.user_has_permission(
  _user_id UUID,
  _company_id UUID,
  _permission permission_type
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_permissions
    WHERE user_id = _user_id
      AND company_id = _company_id
      AND permission = _permission
  ) OR EXISTS (
    -- Admins têm todas as permissões
    SELECT 1
    FROM public.company_users
    WHERE user_id = _user_id
      AND company_id = _company_id
      AND role = 'admin'
  );
$$;

-- 5. Função para verificar se é admin ou gerente
CREATE OR REPLACE FUNCTION public.is_company_admin(
  _user_id UUID,
  _company_id UUID
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.company_users
    WHERE user_id = _user_id
      AND company_id = _company_id
      AND role IN ('admin', 'manager')
  );
$$;

-- 6. Políticas RLS para user_permissions
CREATE POLICY "Admins podem ver todas as permissões da empresa"
  ON public.user_permissions
  FOR SELECT
  USING (
    is_company_admin(auth.uid(), company_id)
  );

CREATE POLICY "Admins podem criar permissões"
  ON public.user_permissions
  FOR INSERT
  WITH CHECK (
    is_company_admin(auth.uid(), company_id)
  );

CREATE POLICY "Admins podem atualizar permissões"
  ON public.user_permissions
  FOR UPDATE
  USING (
    is_company_admin(auth.uid(), company_id)
  );

CREATE POLICY "Admins podem deletar permissões"
  ON public.user_permissions
  FOR DELETE
  USING (
    is_company_admin(auth.uid(), company_id)
  );

CREATE POLICY "Usuários podem ver suas próprias permissões"
  ON public.user_permissions
  FOR SELECT
  USING (
    user_id = auth.uid()
  );

-- 7. Criar índices para performance
CREATE INDEX idx_user_permissions_user_company ON public.user_permissions(user_id, company_id);
CREATE INDEX idx_user_permissions_permission ON public.user_permissions(permission);

-- =============================================
-- MELHORAR RASTREAMENTO DE DOCUMENTOS
-- =============================================

-- 8. Adicionar campos para rastreamento página por página
ALTER TABLE public.document_tracking_events
ADD COLUMN IF NOT EXISTS duration_seconds INTEGER,
ADD COLUMN IF NOT EXISTS scroll_depth INTEGER,
ADD COLUMN IF NOT EXISTS device_type TEXT,
ADD COLUMN IF NOT EXISTS browser TEXT,
ADD COLUMN IF NOT EXISTS os TEXT,
ADD COLUMN IF NOT EXISTS screen_resolution TEXT,
ADD COLUMN IF NOT EXISTS referrer TEXT;

-- 9. Criar tabela para configurações de dashboard personalizável
CREATE TABLE IF NOT EXISTS public.dashboard_widgets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  widget_type TEXT NOT NULL, -- 'calendar', 'emails', 'clients', 'meetings', 'analytics', etc.
  position INTEGER NOT NULL DEFAULT 0,
  size TEXT DEFAULT 'medium', -- 'small', 'medium', 'large'
  is_visible BOOLEAN DEFAULT true,
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 10. Habilitar RLS para dashboard_widgets
ALTER TABLE public.dashboard_widgets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuários podem gerenciar seus próprios widgets"
  ON public.dashboard_widgets
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- 11. Criar trigger para updated_at
CREATE TRIGGER update_dashboard_widgets_updated_at
  BEFORE UPDATE ON public.dashboard_widgets
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- 12. Comentários para documentação
COMMENT ON TABLE public.user_permissions IS 'Permissões granulares de usuários por empresa';
COMMENT ON TABLE public.dashboard_widgets IS 'Configurações personalizadas de widgets do dashboard por usuário';
COMMENT ON TYPE public.permission_type IS 'Tipos de permissões disponíveis no sistema';
