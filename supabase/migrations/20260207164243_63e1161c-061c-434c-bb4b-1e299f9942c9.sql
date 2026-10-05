-- Update session status to connected since messages are flowing
UPDATE whatsapp_sessions 
SET status = 'connected'
WHERE id = '9fc68ea8-32fb-4c67-8065-59dc2a9d8ad5'
AND phone_number = '554187942674';