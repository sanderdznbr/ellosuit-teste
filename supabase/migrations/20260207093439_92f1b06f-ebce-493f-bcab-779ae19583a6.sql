-- Add is_ai_response column to track AI-generated messages
ALTER TABLE whatsapp_messages 
ADD COLUMN IF NOT EXISTS is_ai_response BOOLEAN DEFAULT false;

-- Add index for quick filtering
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_ai_response 
ON whatsapp_messages(is_ai_response) WHERE is_ai_response = true;