-- Table for AI Skills definitions
CREATE TABLE public.ai_skills (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    category TEXT NOT NULL,
    price DECIMAL(10,2) NOT NULL DEFAULT 0,
    icon_name TEXT,
    system_prompt TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Table for tracking purchased skills per company
CREATE TABLE public.purchased_skills (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
    skill_id UUID REFERENCES public.ai_skills(id) ON DELETE CASCADE,
    purchased_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    UNIQUE(company_id, skill_id)
);

-- Table for tracking active skills in a meeting room
CREATE TABLE public.room_active_skills (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id UUID REFERENCES public.meeting_rooms(id) ON DELETE CASCADE,
    skill_id UUID REFERENCES public.ai_skills(id) ON DELETE CASCADE,
    activated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    activated_by UUID REFERENCES auth.users(id),
    UNIQUE(room_id, skill_id)
);

-- Enable RLS
ALTER TABLE public.ai_skills ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchased_skills ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.room_active_skills ENABLE ROW LEVEL SECURITY;

-- Policies for ai_skills (read by everyone)
CREATE POLICY "Everyone can view AI skills" ON public.ai_skills FOR SELECT USING (true);

-- Policies for purchased_skills
CREATE POLICY "Users can view their company's purchased skills" 
ON public.purchased_skills FOR SELECT 
USING (company_id IN (SELECT company_id FROM public.company_users WHERE user_id = auth.uid()));

-- Policies for room_active_skills
CREATE POLICY "Users can view active skills in their rooms" 
ON public.room_active_skills FOR SELECT 
USING (room_id IN (SELECT id FROM public.meeting_rooms));

CREATE POLICY "Users can activate skills in their rooms" 
ON public.room_active_skills FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Users can deactivate skills in their rooms" 
ON public.room_active_skills FOR DELETE 
USING (true);

-- Insert initial skills
INSERT INTO public.ai_skills (name, description, category, price, icon_name, system_prompt) VALUES
('Agente de Vendas', 'Acompanha a reunião e analisa o cliente para criar uma estratégia completa de fechamento.', 'vendas', 49.90, 'TrendingUp', 'Você é um especialista em vendas de alto nível. Analise a transcrição da reunião, identifique as dores do cliente, nível de interesse e crie uma estratégia de fechamento personalizada.'),
('Análise de Satisfação', 'Analisa o tom de voz e objeções para medir a satisfação e dar dicas de relacionamento.', 'atendimento', 29.90, 'Heart', 'Você é um especialista em Customer Success. Analise o tom da conversa e o nível de satisfação dos participantes. Identifique frustrações e dê dicas acionáveis para melhorar o relacionamento.');
