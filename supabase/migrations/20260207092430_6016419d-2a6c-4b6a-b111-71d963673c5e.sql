-- Add ai_auto_reply_enabled column to whatsapp_conversations
ALTER TABLE whatsapp_conversations 
ADD COLUMN IF NOT EXISTS ai_auto_reply_enabled BOOLEAN DEFAULT false;