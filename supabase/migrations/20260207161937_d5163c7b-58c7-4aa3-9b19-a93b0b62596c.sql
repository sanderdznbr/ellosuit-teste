
-- Forçar deleção de qualquer conversa ou mensagem restante
DELETE FROM whatsapp_messages WHERE conversation_id IN (
  SELECT id FROM whatsapp_conversations WHERE company_id = '92c0552b-2985-4ff7-8cf5-78298f564a72'
);
DELETE FROM whatsapp_conversations WHERE company_id = '92c0552b-2985-4ff7-8cf5-78298f564a72';
