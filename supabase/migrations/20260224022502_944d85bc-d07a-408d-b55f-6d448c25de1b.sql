
-- Merge Sander's LID conversations into the real phone conversation
-- Target: 6bb8c8d9 (5541985350504 - real phone)
-- Sources: 67df6178 (LID @lid), 1ff8c94f (LID @s.whatsapp.net)

-- Move messages from LID conversations to real one
UPDATE whatsapp_messages 
SET conversation_id = '6bb8c8d9-11b9-4247-86fa-2840cdf92e58'
WHERE conversation_id IN ('67df6178-37f9-46d9-81e5-b314c98030eb', '1ff8c94f-492f-4131-88c0-6f625d050df8');

-- Update the real conversation with correct name and latest timestamp
UPDATE whatsapp_conversations 
SET contact_name = 'Sander',
    last_message_at = (SELECT MAX(created_at) FROM whatsapp_messages WHERE conversation_id = '6bb8c8d9-11b9-4247-86fa-2840cdf92e58'),
    remote_jid = '5541985350504@s.whatsapp.net'
WHERE id = '6bb8c8d9-11b9-4247-86fa-2840cdf92e58';

-- Delete the duplicate LID conversations
DELETE FROM whatsapp_conversations 
WHERE id IN ('67df6178-37f9-46d9-81e5-b314c98030eb', '1ff8c94f-492f-4131-88c0-6f625d050df8');
