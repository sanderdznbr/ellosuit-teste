-- Criar tabela para reuniões presenciais
CREATE TABLE IF NOT EXISTS public.in_person_meetings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  transcript TEXT,
  file_url TEXT,
  duration_seconds INTEGER,
  created_by UUID NOT NULL,
  company_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.in_person_meetings ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
CREATE POLICY "Users can create in-person meetings"
ON public.in_person_meetings
FOR INSERT
WITH CHECK (
  company_id IN (
    SELECT company_id FROM public.company_users WHERE user_id = auth.uid()
  ) AND created_by = auth.uid()
);

CREATE POLICY "Users can view company in-person meetings"
ON public.in_person_meetings
FOR SELECT
USING (
  company_id IN (
    SELECT company_id FROM public.company_users WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Users can update their in-person meetings"
ON public.in_person_meetings
FOR UPDATE
USING (created_by = auth.uid());

CREATE POLICY "Users can delete their in-person meetings"
ON public.in_person_meetings
FOR DELETE
USING (created_by = auth.uid());