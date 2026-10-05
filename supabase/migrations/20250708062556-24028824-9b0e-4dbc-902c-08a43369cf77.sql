-- Adicionar campos de configuração do Zoom na tabela de meeting_integrations
ALTER TABLE meeting_integrations 
ADD COLUMN redirect_uri TEXT DEFAULT 'https://ellosuit.online/dashboard';

-- Atualizar registros existentes do Zoom para usar a URL correta
UPDATE meeting_integrations 
SET redirect_uri = 'https://ellosuit.online/dashboard' 
WHERE provider = 'zoom';