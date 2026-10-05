-- Disable the trigger that creates notifications for every incoming WhatsApp message
DROP TRIGGER IF EXISTS trigger_notify_whatsapp_message ON whatsapp_messages;