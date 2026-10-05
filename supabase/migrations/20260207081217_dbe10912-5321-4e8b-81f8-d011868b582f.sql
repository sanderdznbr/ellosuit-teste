-- Clean up phantom WhatsApp sessions
-- Delete test sessions (with fake phone numbers)
DELETE FROM whatsapp_sessions 
WHERE phone_number = '+55 11 99999-9999';

-- Delete old disconnected/waiting sessions (keep only connected and recent ones)
DELETE FROM whatsapp_sessions 
WHERE status NOT IN ('connected') 
AND created_at < NOW() - INTERVAL '1 hour';

-- Keep only the most recent connected session per company
DELETE FROM whatsapp_sessions s1
WHERE status = 'connected'
AND EXISTS (
  SELECT 1 FROM whatsapp_sessions s2
  WHERE s2.company_id = s1.company_id
  AND s2.status = 'connected'
  AND s2.connected_at > s1.connected_at
);