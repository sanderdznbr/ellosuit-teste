-- Corrigir o grupo sem nome (copiar do registro que tem nome)
UPDATE whatsapp_conversations 
SET contact_name = 'Família de zinho'
WHERE id = 'f0d83fca-02ba-4f52-9cf5-298d73c9742c';

-- Atualizar a função para também copiar nome/foto para registros existentes do mesmo contato
CREATE OR REPLACE FUNCTION fix_empty_conversation_data()
RETURNS TRIGGER AS $$
DECLARE
  existing_data RECORD;
BEGIN
  -- Se o novo registro não tem nome ou foto, buscar de conversas anteriores do mesmo contato
  IF (NEW.contact_name IS NULL OR NEW.contact_name = NEW.contact_phone OR NEW.contact_name LIKE 'Grupo %') 
     OR NEW.profile_picture IS NULL THEN
    
    SELECT contact_name, profile_picture INTO existing_data
    FROM whatsapp_conversations
    WHERE company_id = NEW.company_id 
      AND contact_phone = NEW.contact_phone
      AND id != NEW.id
      AND (contact_name IS NOT NULL AND contact_name != contact_phone AND contact_name NOT LIKE 'Grupo %')
    ORDER BY last_message_at DESC
    LIMIT 1;
    
    IF FOUND THEN
      -- Preencher nome se estava vazio ou é genérico "Grupo 123..."
      IF (NEW.contact_name IS NULL OR NEW.contact_name = NEW.contact_phone OR NEW.contact_name LIKE 'Grupo %') 
         AND existing_data.contact_name IS NOT NULL THEN
        NEW.contact_name := existing_data.contact_name;
      END IF;
      
      -- Preencher foto se estava vazia
      IF NEW.profile_picture IS NULL AND existing_data.profile_picture IS NOT NULL THEN
        NEW.profile_picture := existing_data.profile_picture;
      END IF;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;