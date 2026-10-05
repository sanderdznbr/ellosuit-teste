
-- Insert fictitious trackable documents (with mime_type)
INSERT INTO public.trackable_documents (company_id, user_id, title, original_filename, file_url, mime_type, tracking_enabled) VALUES 
('92c0552b-2985-4ff7-8cf5-78298f564a72', '332371f9-6010-4ec0-b576-da80bad552dd', 'Proposta Comercial 2026', 'proposta-2026.pdf', 'https://example.com/proposta.pdf', 'application/pdf', true),
('92c0552b-2985-4ff7-8cf5-78298f564a72', '332371f9-6010-4ec0-b576-da80bad552dd', 'Contrato de Serviço', 'contrato.pdf', 'https://example.com/contrato.pdf', 'application/pdf', true),
('92c0552b-2985-4ff7-8cf5-78298f564a72', '332371f9-6010-4ec0-b576-da80bad552dd', 'Apresentação Institucional', 'apresentacao.pdf', 'https://example.com/apresentacao.pdf', 'application/pdf', true),
('92c0552b-2985-4ff7-8cf5-78298f564a72', '332371f9-6010-4ec0-b576-da80bad552dd', 'Media Kit 2026', 'mediakit.pdf', 'https://example.com/mediakit.pdf', 'application/pdf', true);

-- Insert fictitious emails
INSERT INTO public.emails (company_id, user_id, recipient_email, recipient_name, subject, content_html, status) VALUES 
('92c0552b-2985-4ff7-8cf5-78298f564a72', '332371f9-6010-4ec0-b576-da80bad552dd', 'joao@empresa.com', 'João Silva', 'Proposta Comercial - Criativize', '<p>Olá João</p>', 'sent'),
('92c0552b-2985-4ff7-8cf5-78298f564a72', '332371f9-6010-4ec0-b576-da80bad552dd', 'maria@corp.com.br', 'Maria Santos', 'Follow-up Reunião', '<p>Olá Maria</p>', 'sent'),
('92c0552b-2985-4ff7-8cf5-78298f564a72', '332371f9-6010-4ec0-b576-da80bad552dd', 'pedro@tech.io', 'Pedro Oliveira', 'Apresentação de Serviços', '<p>Olá Pedro</p>', 'sent'),
('92c0552b-2985-4ff7-8cf5-78298f564a72', '332371f9-6010-4ec0-b576-da80bad552dd', 'ana@startup.com', 'Ana Costa', 'Parceria Estratégica', '<p>Olá Ana</p>', 'sent'),
('92c0552b-2985-4ff7-8cf5-78298f564a72', '332371f9-6010-4ec0-b576-da80bad552dd', 'lucas@agency.com', 'Lucas Ferreira', 'Orçamento Campanha Digital', '<p>Olá Lucas</p>', 'sent'),
('92c0552b-2985-4ff7-8cf5-78298f564a72', '332371f9-6010-4ec0-b576-da80bad552dd', 'carla@design.co', 'Carla Mendes', 'Briefing Projeto Visual', '<p>Olá Carla</p>', 'sent'),
('92c0552b-2985-4ff7-8cf5-78298f564a72', '332371f9-6010-4ec0-b576-da80bad552dd', 'roberto@vendas.com', 'Roberto Lima', 'Condições Especiais', '<p>Olá Roberto</p>', 'sent'),
('92c0552b-2985-4ff7-8cf5-78298f564a72', '332371f9-6010-4ec0-b576-da80bad552dd', 'joao@empresa.com', 'João Silva', 'Novo Catálogo de Produtos', '<p>Confira nosso catálogo</p>', 'sent'),
('92c0552b-2985-4ff7-8cf5-78298f564a72', '332371f9-6010-4ec0-b576-da80bad552dd', 'maria@corp.com.br', 'Maria Santos', 'Renovação de Contrato', '<p>Olá Maria</p>', 'sent'),
('92c0552b-2985-4ff7-8cf5-78298f564a72', '332371f9-6010-4ec0-b576-da80bad552dd', 'pedro@tech.io', 'Pedro Oliveira', 'Convite Workshop Tech', '<p>Olá Pedro</p>', 'sent'),
('92c0552b-2985-4ff7-8cf5-78298f564a72', '332371f9-6010-4ec0-b576-da80bad552dd', 'ana@startup.com', 'Ana Costa', 'Case de Sucesso', '<p>Olá Ana</p>', 'sent'),
('92c0552b-2985-4ff7-8cf5-78298f564a72', '332371f9-6010-4ec0-b576-da80bad552dd', 'lucas@agency.com', 'Lucas Ferreira', 'Newsletter Fevereiro', '<p>Olá Lucas</p>', 'sent');

-- Insert email open events for some of those emails
INSERT INTO public.email_events (email_id, event_type, device_type, browser, os)
SELECT id, 'opened', 'desktop', 'Chrome', 'Windows'
FROM public.emails 
WHERE company_id = '92c0552b-2985-4ff7-8cf5-78298f564a72'
  AND user_id = '332371f9-6010-4ec0-b576-da80bad552dd'
  AND recipient_name IN ('João Silva', 'Maria Santos', 'Ana Costa', 'Carla Mendes', 'Pedro Oliveira')
LIMIT 5;
