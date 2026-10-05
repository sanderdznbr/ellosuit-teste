-- Limpa human_takeover do número Pai (nunca deve ter)
UPDATE public.whatsapp_conversations c
SET human_takeover = false,
    human_takeover_at = NULL,
    human_takeover_reason = NULL,
    ai_auto_reply_enabled = true
FROM public.crm_autopilot_configs cfg
WHERE cfg.company_id = c.company_id
  AND regexp_replace(cfg.parent_phone, '\D', '', 'g') = regexp_replace(c.contact_phone, '\D', '', 'g')
  AND c.human_takeover = true;

-- Limpa human_takeover das conversas de clientes marcadas por engano quando o piloto respondeu via whatsapp-api
UPDATE public.whatsapp_conversations
SET human_takeover = false,
    human_takeover_at = NULL,
    human_takeover_reason = NULL,
    ai_auto_reply_enabled = true
WHERE id IN ('53acfc06-4bd2-4756-b66f-ae684444fecc','55b0e0c7-6c69-47fc-a478-6bed0551e4a0');