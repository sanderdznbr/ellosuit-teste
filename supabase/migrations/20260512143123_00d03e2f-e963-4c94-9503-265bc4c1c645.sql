UPDATE public.whatsapp_conversations
SET ai_auto_reply_enabled = true,
    updated_at = now()
WHERE id = '1fb8b7f8-b6ca-4450-9906-44ada910627a'
  AND assigned_agent_id IS NOT NULL;