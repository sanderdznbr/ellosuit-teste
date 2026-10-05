
-- Criar tabela para campanhas de email
CREATE TABLE public.email_campaigns (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'paused', 'completed'))
);

-- Criar tabela para emails enviados
CREATE TABLE public.emails (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  campaign_id UUID REFERENCES public.email_campaigns(id),
  recipient_email TEXT NOT NULL,
  recipient_name TEXT,
  subject TEXT NOT NULL,
  content_html TEXT NOT NULL,
  content_text TEXT,
  tracking_pixel_id UUID NOT NULL DEFAULT gen_random_uuid(),
  sent_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  status TEXT NOT NULL DEFAULT 'sent' CHECK (status IN ('draft', 'sent', 'delivered', 'bounced', 'failed')),
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Criar tabela para eventos de rastreamento
CREATE TABLE public.email_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email_id UUID REFERENCES public.emails(id) NOT NULL,
  event_type TEXT NOT NULL CHECK (event_type IN ('sent', 'delivered', 'opened', 'clicked', 'bounced', 'complained')),
  timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  user_agent TEXT,
  ip_address INET,
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Criar índices para performance
CREATE INDEX idx_emails_recipient ON public.emails(recipient_email);
CREATE INDEX idx_emails_campaign ON public.emails(campaign_id);
CREATE INDEX idx_emails_tracking_pixel ON public.emails(tracking_pixel_id);
CREATE INDEX idx_email_events_email_id ON public.email_events(email_id);
CREATE INDEX idx_email_events_type ON public.email_events(event_type);
CREATE INDEX idx_email_events_timestamp ON public.email_events(timestamp);

-- Habilitar RLS (Row Level Security)
ALTER TABLE public.email_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.emails ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_events ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para permitir acesso total por enquanto (vamos refinar depois)
CREATE POLICY "Allow all access to email_campaigns" ON public.email_campaigns FOR ALL USING (true);
CREATE POLICY "Allow all access to emails" ON public.emails FOR ALL USING (true);
CREATE POLICY "Allow all access to email_events" ON public.email_events FOR ALL USING (true);

-- Função para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger para atualizar updated_at na tabela email_campaigns
CREATE TRIGGER update_email_campaigns_updated_at BEFORE UPDATE ON public.email_campaigns FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
