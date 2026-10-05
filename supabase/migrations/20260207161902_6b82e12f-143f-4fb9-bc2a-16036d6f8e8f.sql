
-- Deletar todas as mensagens das conversas dessa empresa
DELETE FROM whatsapp_messages 
WHERE conversation_id IN (
  SELECT id FROM whatsapp_conversations 
  WHERE company_id = '92c0552b-2985-4ff7-8cf5-78298f564a72'
);

-- Deletar todas as conversas dessa empresa
DELETE FROM whatsapp_conversations 
WHERE company_id = '92c0552b-2985-4ff7-8cf5-78298f564a72';

-- Deletar sessões antigas, mantendo apenas 1
DELETE FROM whatsapp_sessions 
WHERE company_id = '92c0552b-2985-4ff7-8cf5-78298f564a72'
AND id NOT IN (
  SELECT id FROM whatsapp_sessions 
  WHERE company_id = '92c0552b-2985-4ff7-8cf5-78298f564a72'
  ORDER BY created_at DESC
  LIMIT 1
);
