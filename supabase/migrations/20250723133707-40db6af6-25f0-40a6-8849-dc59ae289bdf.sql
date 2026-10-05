
-- Criar tabela para configurações de notificação do usuário
CREATE TABLE public.notification_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users NOT NULL,
  company_id UUID NOT NULL,
  calendar_notifications_enabled BOOLEAN NOT NULL DEFAULT true,
  event_start_notifications BOOLEAN NOT NULL DEFAULT true,
  reminder_notifications_enabled BOOLEAN NOT NULL DEFAULT true,
  default_reminder_minutes INTEGER NOT NULL DEFAULT 15,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

-- Criar tabela para configurações específicas de eventos
CREATE TABLE public.event_notification_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID NOT NULL,
  user_id UUID REFERENCES auth.users NOT NULL,
  company_id UUID NOT NULL,
  notifications_enabled BOOLEAN NOT NULL DEFAULT true,
  reminder_minutes INTEGER[] NOT NULL DEFAULT ARRAY[15],
  notification_at_start BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(event_id, user_id)
);

-- Adicionar RLS para notification_settings
ALTER TABLE public.notification_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own notification settings" 
  ON public.notification_settings 
  FOR ALL 
  USING (user_id = auth.uid());

-- Adicionar RLS para event_notification_settings
ALTER TABLE public.event_notification_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own event notification settings" 
  ON public.event_notification_settings 
  FOR ALL 
  USING (user_id = auth.uid());

-- Adicionar triggers para updated_at
CREATE TRIGGER handle_updated_at_notification_settings
  BEFORE UPDATE ON public.notification_settings
  FOR EACH ROW EXECUTE PROCEDURE public.handle_updated_at();

CREATE TRIGGER handle_updated_at_event_notification_settings
  BEFORE UPDATE ON public.event_notification_settings
  FOR EACH ROW EXECUTE PROCEDURE public.handle_updated_at();

-- Inserir configurações padrão para usuários existentes
INSERT INTO public.notification_settings (user_id, company_id)
SELECT DISTINCT cu.user_id, cu.company_id
FROM public.company_users cu
LEFT JOIN public.notification_settings ns ON cu.user_id = ns.user_id
WHERE ns.user_id IS NULL;
