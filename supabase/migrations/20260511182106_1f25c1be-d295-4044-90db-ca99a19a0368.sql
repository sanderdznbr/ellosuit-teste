-- Restore active WhatsApp sessions that were soft-deleted (still receiving messages)
UPDATE whatsapp_sessions SET deleted_at = NULL WHERE id IN ('1eb44b77-9107-47c8-846b-40447025d297','8cf1d32c-1b66-4228-b4ea-04bdd781ca73');

-- Mark stale chatbot executions as 'timeout' when no activity for > 30 min
UPDATE chatbot_executions
SET status = 'timeout', completed_at = COALESCE(completed_at, now())
WHERE status = 'running'
  AND last_activity_at < now() - INTERVAL '30 minutes';