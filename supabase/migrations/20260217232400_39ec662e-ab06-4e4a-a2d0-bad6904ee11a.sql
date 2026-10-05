
-- Restore Ellosuit session that was incorrectly marked as disconnected
UPDATE public.whatsapp_sessions SET status = 'connected' 
WHERE id = 'f24eae2e-bf99-49b3-9db3-348c0d6385d2';
