-- Atualizar a conversa mais recente de Gustavo com os dados corretos (nome e foto)
-- Os dados existem em registros mais antigos, então vamos copiar para o mais recente
UPDATE whatsapp_conversations 
SET 
  contact_name = 'Gustavo Oliveira',
  profile_picture = 'https://pps.whatsapp.net/v/t61.24694-24/592099636_1280429700571255_2581524364492902910_n.jpg?ccb=11-4&oh=01_Q5Aa3wEpNlFS0ZMPdlDzPzPiCW_IkC29UCIqhc3OS439vozUMg&oe=69948AD8&_nc_sid=5e03e0&_nc_cat=105'
WHERE id = '0e89d0fb-78e8-456c-b6d2-df0bf3fc774f';

-- Também corrigir o outro registro sem dados
UPDATE whatsapp_conversations 
SET 
  contact_name = 'Gustavo Oliveira',
  profile_picture = 'https://pps.whatsapp.net/v/t61.24694-24/592099636_1280429700571255_2581524364492902910_n.jpg?ccb=11-4&oh=01_Q5Aa3wEpNlFS0ZMPdlDzPzPiCW_IkC29UCIqhc3OS439vozUMg&oe=69948AD8&_nc_sid=5e03e0&_nc_cat=105'
WHERE id = '7b6410a6-055f-48b1-8788-f7e2f0e6b937';

-- Criar uma função que será usada para prevenir conversas duplicadas futuras
-- Esta função busca dados existentes (nome/foto) de conversas duplicadas e preenche registros vazios
CREATE OR REPLACE FUNCTION fix_empty_conversation_data()
RETURNS TRIGGER AS $$
DECLARE
  existing_data RECORD;
BEGIN
  -- Se o novo registro não tem nome ou foto, buscar de conversas anteriores do mesmo contato
  IF (NEW.contact_name IS NULL OR NEW.contact_name = NEW.contact_phone) 
     OR NEW.profile_picture IS NULL THEN
    
    SELECT contact_name, profile_picture INTO existing_data
    FROM whatsapp_conversations
    WHERE company_id = NEW.company_id 
      AND contact_phone = NEW.contact_phone
      AND id != NEW.id
      AND (contact_name IS NOT NULL AND contact_name != contact_phone)
    ORDER BY last_message_at DESC
    LIMIT 1;
    
    IF FOUND THEN
      -- Preencher nome se estava vazio
      IF (NEW.contact_name IS NULL OR NEW.contact_name = NEW.contact_phone) 
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

-- Criar trigger que roda antes de INSERT e UPDATE
DROP TRIGGER IF EXISTS fix_conversation_data_trigger ON whatsapp_conversations;
CREATE TRIGGER fix_conversation_data_trigger
  BEFORE INSERT OR UPDATE ON whatsapp_conversations
  FOR EACH ROW
  EXECUTE FUNCTION fix_empty_conversation_data();