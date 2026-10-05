-- Remover integração antiga expirada
DELETE FROM public.meeting_integrations 
WHERE provider = 'google_meet' 
AND expires_at < NOW();