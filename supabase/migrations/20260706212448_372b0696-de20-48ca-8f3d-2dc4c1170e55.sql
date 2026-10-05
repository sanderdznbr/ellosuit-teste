WITH parent_configs AS (
  SELECT
    company_id,
    parent_session_id,
    regexp_replace(parent_phone, '\D', '', 'g') AS parent_phone
  FROM public.crm_autopilot_configs
  WHERE is_active = true
    AND parent_phone IS NOT NULL
    AND parent_session_id IS NOT NULL
), parent_phone_variants AS (
  SELECT company_id, parent_session_id, parent_phone AS phone FROM parent_configs
  UNION
  SELECT company_id, parent_session_id, substring(parent_phone from 1 for 4) || substring(parent_phone from 6) AS phone
  FROM parent_configs
  WHERE parent_phone LIKE '55%' AND length(parent_phone) = 13
  UNION
  SELECT company_id, parent_session_id, substring(parent_phone from 1 for 4) || '9' || substring(parent_phone from 5) AS phone
  FROM parent_configs
  WHERE parent_phone LIKE '55%' AND length(parent_phone) = 12
), parent_conversations AS (
  SELECT DISTINCT c.id, c.company_id
  FROM public.whatsapp_conversations c
  JOIN parent_phone_variants p
    ON p.company_id = c.company_id
   AND p.parent_session_id = c.session_id
   AND p.phone = regexp_replace(c.contact_phone, '\D', '', 'g')
), owners AS (
  SELECT DISTINCT ON (company_id) company_id, user_id
  FROM public.company_users
  ORDER BY company_id, created_at ASC
), inserted_labels AS (
  INSERT INTO public.conversation_labels (company_id, created_by, name, color)
  SELECT pc.company_id, o.user_id, 'PAI DO PILOTO', '#FF4500'
  FROM (SELECT DISTINCT company_id FROM parent_conversations) pc
  JOIN owners o ON o.company_id = pc.company_id
  WHERE NOT EXISTS (
    SELECT 1 FROM public.conversation_labels l
    WHERE l.company_id = pc.company_id AND l.name = 'PAI DO PILOTO'
  )
  RETURNING id, company_id
), all_parent_labels AS (
  SELECT id, company_id
  FROM public.conversation_labels
  WHERE name = 'PAI DO PILOTO'
), label_updates AS (
  UPDATE public.whatsapp_conversations c
  SET labels = CASE
    WHEN c.labels IS NULL THEN ARRAY[l.id]
    WHEN NOT (l.id = ANY(c.labels)) THEN array_append(c.labels, l.id)
    ELSE c.labels
  END
  FROM parent_conversations pc
  JOIN all_parent_labels l ON l.company_id = pc.company_id
  WHERE c.id = pc.id
  RETURNING c.id, c.company_id
), stopped_chatbots AS (
  UPDATE public.chatbot_executions ce
  SET status = 'stopped', completed_at = now()
  WHERE ce.status = 'running'
    AND ce.conversation_id IN (SELECT id FROM parent_conversations)
  RETURNING ce.id, ce.conversation_id
), cleaned_conversations AS (
  UPDATE public.whatsapp_conversations c
  SET
    human_takeover = false,
    human_takeover_at = NULL,
    human_takeover_reason = NULL,
    ai_auto_reply_enabled = false,
    assigned_agent_id = NULL
  WHERE c.id IN (SELECT id FROM parent_conversations)
  RETURNING c.id, c.company_id
)
INSERT INTO public.conversation_events (
  conversation_id,
  company_id,
  event_type,
  actor_type,
  actor_name,
  reason,
  metadata
)
SELECT
  cc.id,
  cc.company_id,
  'autopilot_parent_channel_isolated',
  'system',
  'Piloto Automático',
  'Canal do Número Pai isolado: sem Humano, sem Chatbot e sem agente comum.',
  jsonb_build_object('label', 'PAI DO PILOTO')
FROM cleaned_conversations cc;