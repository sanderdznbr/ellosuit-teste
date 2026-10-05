
-- Migrate messages from old 12-digit conversations to normalized 13-digit ones
-- Then update phone numbers and delete empty duplicates

-- 1. For 554185334806 -> 5541985334806: migrate messages to 4f03a0ee
UPDATE whatsapp_messages SET conversation_id = '4f03a0ee-1f58-4c2c-9c23-deaed4697f2b' 
WHERE conversation_id IN ('87afb905-7861-4ce2-bdbc-7d347025cb99', 'a816b940-7cad-4d18-a842-7ceb1532be60');

-- 2. For 554185350504 -> 5541985350504: migrate messages to 6bb8c8d9
UPDATE whatsapp_messages SET conversation_id = '6bb8c8d9-11b9-4247-86fa-2840cdf92e58' 
WHERE conversation_id = '59d004e2-3500-4f95-a1d9-9db111c58f3e';

-- 3. For 554196875461 -> 5541996875461: migrate messages to c224a6dd
UPDATE whatsapp_messages SET conversation_id = 'c224a6dd-ca13-43fe-bae0-2b99e0cbe043' 
WHERE conversation_id IN ('7d390bf2-df8c-418f-8450-4791c70abdde', 'fe5ac4a4-c090-465a-bcb2-e319262e12af');

-- Copy best contact_name and profile_picture from old conversations to new ones
UPDATE whatsapp_conversations new_conv SET 
  contact_name = COALESCE(
    (SELECT c.contact_name FROM whatsapp_conversations c 
     WHERE c.company_id = new_conv.company_id 
     AND c.contact_phone = SUBSTRING(new_conv.contact_phone, 1, 4) || SUBSTRING(new_conv.contact_phone, 6)
     AND c.contact_name IS NOT NULL AND c.contact_name != c.contact_phone
     ORDER BY c.last_message_at DESC LIMIT 1),
    new_conv.contact_name
  ),
  profile_picture = COALESCE(
    new_conv.profile_picture,
    (SELECT c.profile_picture FROM whatsapp_conversations c 
     WHERE c.company_id = new_conv.company_id 
     AND c.contact_phone = SUBSTRING(new_conv.contact_phone, 1, 4) || SUBSTRING(new_conv.contact_phone, 6)
     AND c.profile_picture IS NOT NULL
     ORDER BY c.last_message_at DESC LIMIT 1)
  )
WHERE new_conv.contact_phone IN ('5541985334806', '5541985350504', '5541996875461');

-- Delete old 12-digit duplicate conversations
DELETE FROM whatsapp_conversations WHERE id IN (
  '87afb905-7861-4ce2-bdbc-7d347025cb99',
  'a816b940-7cad-4d18-a842-7ceb1532be60',
  '59d004e2-3500-4f95-a1d9-9db111c58f3e',
  '7d390bf2-df8c-418f-8450-4791c70abdde',
  'fe5ac4a4-c090-465a-bcb2-e319262e12af'
);

-- Also normalize ALL existing 12-digit Brazilian phones to 13-digit
UPDATE whatsapp_conversations 
SET contact_phone = SUBSTRING(contact_phone, 1, 4) || '9' || SUBSTRING(contact_phone, 5)
WHERE contact_phone LIKE '55%' 
  AND LENGTH(contact_phone) = 12
  AND NOT EXISTS (
    SELECT 1 FROM whatsapp_conversations c2 
    WHERE c2.company_id = whatsapp_conversations.company_id 
    AND c2.contact_phone = SUBSTRING(whatsapp_conversations.contact_phone, 1, 4) || '9' || SUBSTRING(whatsapp_conversations.contact_phone, 5)
  );
