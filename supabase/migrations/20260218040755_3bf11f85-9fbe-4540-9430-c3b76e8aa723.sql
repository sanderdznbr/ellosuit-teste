-- Disable the WhatsApp message notification trigger to prevent cross-company notification leaks
-- This was previously decided to be disabled to avoid notification overload
DROP TRIGGER IF EXISTS notify_whatsapp_message ON public.whatsapp_messages;

-- Also clean up notifications that were incorrectly sent to the peptirze user
DELETE FROM public.notifications 
WHERE company_id = '56b803cf-2ad9-4526-b588-e4712f33f71f' 
AND category = 'crm' 
AND title = 'Nova mensagem no WhatsApp';