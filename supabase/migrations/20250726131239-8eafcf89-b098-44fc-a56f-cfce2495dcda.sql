-- Limpar integrações expiradas do Google Meet
DELETE FROM meeting_integrations 
WHERE provider = 'google_meet' 
AND (expires_at IS NOT NULL AND expires_at < now());