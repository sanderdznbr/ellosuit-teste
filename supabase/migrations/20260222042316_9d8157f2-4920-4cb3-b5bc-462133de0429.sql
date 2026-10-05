
-- Add remote_jid column to store the original WhatsApp JID (e.g. 114392511307798@lid or 5541999999999@s.whatsapp.net)
ALTER TABLE public.whatsapp_conversations ADD COLUMN IF NOT EXISTS remote_jid TEXT;

-- Backfill existing conversations: assume @s.whatsapp.net for standard numbers, @g.us for groups
UPDATE public.whatsapp_conversations 
SET remote_jid = CASE 
  WHEN length(regexp_replace(contact_phone, '\D', '', 'g')) >= 18 THEN contact_phone || '@g.us'
  ELSE contact_phone || '@s.whatsapp.net'
END
WHERE remote_jid IS NULL;
