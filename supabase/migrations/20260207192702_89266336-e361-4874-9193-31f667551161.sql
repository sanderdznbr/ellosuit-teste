-- Adicionar colunas extras para metadados de grupo e contato
ALTER TABLE whatsapp_conversations 
ADD COLUMN IF NOT EXISTS group_description TEXT,
ADD COLUMN IF NOT EXISTS group_participants JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS contact_status TEXT;

-- Comentários para documentação
COMMENT ON COLUMN whatsapp_conversations.group_description IS 'Descrição do grupo (para grupos)';
COMMENT ON COLUMN whatsapp_conversations.group_participants IS 'Lista de participantes do grupo com roles [{jid, isAdmin, isSuperAdmin}]';
COMMENT ON COLUMN whatsapp_conversations.contact_status IS 'Status/bio do contato individual';