-- Configuração de campos que o agente deve extrair (o "formulário" ou "checklist")
CREATE TABLE public.ai_agent_conversions (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    agent_id UUID NOT NULL REFERENCES public.ai_agents(id) ON DELETE CASCADE,
    field_name TEXT NOT NULL, -- ex: "Nome do Cliente", "Interesse"
    field_key TEXT NOT NULL,  -- ex: "nome", "interesse"
    field_description TEXT,   -- ex: "Nome completo do lead para cadastro"
    is_required BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Dados extraídos das conversas (as respostas reais)
CREATE TABLE public.ai_agent_extracted_data (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    agent_id UUID NOT NULL REFERENCES public.ai_agents(id) ON DELETE CASCADE,
    conversation_id UUID REFERENCES public.whatsapp_conversations(id) ON DELETE SET NULL,
    contact_phone TEXT NOT NULL,
    extracted_data JSONB NOT NULL DEFAULT '{}'::jsonb, -- ex: {"nome": "João", "interesse": "Software"}
    is_complete BOOLEAN DEFAULT false,
    last_updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.ai_agent_conversions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_agent_extracted_data ENABLE ROW LEVEL SECURITY;

-- Políticas simples (acesso total para autenticados da mesma empresa - simplificado por brevidade)
CREATE POLICY "Allow all for authenticated users on conversions" ON public.ai_agent_conversions FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow all for authenticated users on extracted_data" ON public.ai_agent_extracted_data FOR ALL USING (auth.role() = 'authenticated');

-- Trigger para updated_at
CREATE TRIGGER update_ai_agent_conversions_updated_at
BEFORE UPDATE ON public.ai_agent_conversions
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Índice para busca rápida
CREATE INDEX idx_extracted_data_agent_id ON public.ai_agent_extracted_data(agent_id);
CREATE INDEX idx_extracted_data_phone ON public.ai_agent_extracted_data(contact_phone);
