-- Limpar integrações expiradas do Google
DELETE FROM meeting_integrations 
WHERE provider = 'google' 
AND (expires_at IS NOT NULL AND expires_at < now());