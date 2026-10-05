-- Remove duplicate conversation row created from Evolution chat.id (CUID) being mis-parsed as a phone number.
DELETE FROM public.whatsapp_conversations
WHERE id = '7c2cba90-0f14-4572-9833-ce392df97927';
