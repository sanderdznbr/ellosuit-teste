-- Aggressive cleanup: Delete ALL sessions that are not connected
DELETE FROM whatsapp_sessions 
WHERE status != 'connected' OR status IS NULL;