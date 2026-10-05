-- 1. Ativar o agente de IA para WhatsApp e vincular à sessão correta
UPDATE public.ai_agents
SET 
  whatsapp_enabled = true,
  whatsapp_session_id = '0f2a7718-3ab2-43a8-b9e8-bd09ffb518dd'
WHERE id = '01cd4561-9a4a-4934-bb7b-d305e24a9e8e';

-- 2. Garantir que a conversa com a VIZEPAY na conta Theodo tenha a IA ativada
UPDATE public.whatsapp_conversations
SET ai_auto_reply_enabled = true
WHERE id = '1fb8b7f8-b6ca-4450-9906-44ada910627a';