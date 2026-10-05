
-- Restore sessions that were marked disconnected by the health check test
UPDATE public.whatsapp_sessions SET status = 'connected' 
WHERE id IN ('4225bbbf-d912-46d5-84fa-78c232fa663b', 'f24eae2e-bf99-49b3-9db3-348c0d6385d2');
