-- Stop all running executions for the specific company
UPDATE public.chatbot_executions
SET status = 'stopped', completed_at = now()
WHERE company_id = '60008c43-e536-482d-a090-91904de57534'
AND status = 'running';

-- Deactivate AI agents for the company to stop auto-replies
UPDATE public.ai_agents
SET is_active = false
WHERE company_id = '60008c43-e536-482d-a090-91904de57534';
