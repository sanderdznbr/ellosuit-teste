-- Add company_id to chatbot_executions
ALTER TABLE public.chatbot_executions ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE;

-- Populate company_id for existing records
UPDATE public.chatbot_executions ce
SET company_id = wc.company_id
FROM public.whatsapp_conversations wc
WHERE ce.conversation_id = wc.id
AND ce.company_id IS NULL;

-- Create an index for performance
CREATE INDEX IF NOT EXISTS idx_chatbot_executions_company_id ON public.chatbot_executions(company_id);

-- Deactivate the specific flow requested by the user (Atendimento Criativizetec)
-- We use the ID found earlier for precision
UPDATE public.chatbot_flows
SET is_active = false
WHERE id = '24d877b7-039a-4745-968e-7f60925fdcde';
