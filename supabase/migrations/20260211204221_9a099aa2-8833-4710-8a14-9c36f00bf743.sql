-- Delete messages from newsletter conversations
DELETE FROM public.whatsapp_messages 
WHERE conversation_id IN (
  SELECT id FROM public.whatsapp_conversations 
  WHERE contact_phone IN (
    '120363155488152222', '120363156868354609', '120363169022331392',
    '120363170942886188', '120363171716472546', '120363172358466435', 
    '120363173003902460'
  )
);

-- Delete the newsletter conversations themselves
DELETE FROM public.whatsapp_conversations 
WHERE contact_phone IN (
  '120363155488152222', '120363156868354609', '120363169022331392',
  '120363170942886188', '120363171716472546', '120363172358466435', 
  '120363173003902460'
);