
-- Enable WhatsApp for the AI agent and link it to the correct session
UPDATE public.ai_agents 
SET whatsapp_enabled = true, 
    whatsapp_session_id = '14c10e04-215b-4a72-bfa8-470ad80d6922',
    updated_at = now()
WHERE id = '599563f9-6392-4ae5-9f53-6b2d866344df';
