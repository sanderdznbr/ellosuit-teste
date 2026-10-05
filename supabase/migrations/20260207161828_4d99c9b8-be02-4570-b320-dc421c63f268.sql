
-- Desconectar/expirar todas as sessões WhatsApp para a empresa do usuário sander@criativize.co
UPDATE whatsapp_sessions 
SET 
  phone_number = NULL,
  phone_name = NULL,
  push_name = NULL,
  profile_picture = NULL,
  connected_at = NULL,
  last_seen_at = NULL,
  qr_code = NULL
WHERE company_id IN (
  SELECT cu.company_id 
  FROM company_users cu 
  JOIN auth.users u ON cu.user_id = u.id 
  WHERE u.email = 'sander@criativize.co'
);

-- Também limpar as conversas antigas para começar do zero (opcional, mas recomendado)
-- DELETE FROM whatsapp_messages WHERE conversation_id IN (
--   SELECT id FROM whatsapp_conversations WHERE company_id = '92c0552b-2985-4ff7-8cf5-78298f564a72'
-- );
-- DELETE FROM whatsapp_conversations WHERE company_id = '92c0552b-2985-4ff7-8cf5-78298f564a72';
