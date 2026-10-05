
-- Add automations for receipt generation
INSERT INTO public.automations (company_id, created_by, name, description, trigger_type, trigger_config, actions, is_active, nodes, edges) VALUES
-- Receipt on trial activation
('60008c43-e536-482d-a090-91904de57534', 'c63ba931-0c34-4461-ae8d-2908aed7dd20',
 'Recibo - Ativacao Trial',
 'Gera recibo automaticamente e envia email quando usuario ativa o periodo de teste gratuito de 7 dias',
 'subscription_change',
 '{"event": "trial.activated"}',
 '[{"type": "create_receipt", "config": {"title": "Trial 7 Dias", "amount": 0, "payment_method": "Trial Gratuito"}},{"type": "send_email", "config": {"template_key": "trial_started", "from_email": "contato@ellosuit.com"}}]',
 true,
 '[{"id":"trigger-1","type":"trigger","position":{"x":250,"y":50},"data":{"label":"Trial Ativado","trigger_type":"subscription_change","config":{"event":"trial.activated"}}},{"id":"action-1","type":"action","position":{"x":250,"y":200},"data":{"label":"Criar Recibo (R$ 0,00)","action_type":"create_receipt","config":{"amount":0}}},{"id":"action-2","type":"action","position":{"x":250,"y":350},"data":{"label":"Enviar Email Trial","action_type":"send_email","config":{"template_key":"trial_started"}}},{"id":"action-3","type":"action","position":{"x":250,"y":500},"data":{"label":"Enviar Recibo por Email","action_type":"send_receipt","config":{"from_email":"contato@ellosuit.com"}}}]',
 '[{"id":"e1","source":"trigger-1","target":"action-1"},{"id":"e2","source":"action-1","target":"action-2"},{"id":"e3","source":"action-2","target":"action-3"}]'),

-- Receipt on payment
('60008c43-e536-482d-a090-91904de57534', 'c63ba931-0c34-4461-ae8d-2908aed7dd20',
 'Recibo - Pagamento Confirmado',
 'Gera recibo automaticamente com dados da fatura e envia por email quando pagamento e confirmado pelo Pagar.me',
 'webhook',
 '{"event": "charge.paid", "provider": "pagarme"}',
 '[{"type": "create_receipt", "config": {"title": "Pagamento Plano Business", "payment_method": "auto_detect"}},{"type": "send_email", "config": {"template_key": "payment_confirmed", "from_email": "contato@ellosuit.com"}},{"type": "send_receipt", "config": {"method": "email", "from_email": "contato@ellosuit.com"}}]',
 true,
 '[{"id":"trigger-1","type":"trigger","position":{"x":250,"y":50},"data":{"label":"Pagamento Confirmado","trigger_type":"webhook","config":{"event":"charge.paid"}}},{"id":"action-1","type":"action","position":{"x":250,"y":200},"data":{"label":"Gerar Recibo Automatico","action_type":"create_receipt","config":{"title":"Pagamento Plano Business"}}},{"id":"action-2","type":"action","position":{"x":250,"y":350},"data":{"label":"Enviar Fatura por Email","action_type":"send_email","config":{"template_key":"payment_confirmed"}}},{"id":"action-3","type":"action","position":{"x":250,"y":500},"data":{"label":"Enviar Recibo PDF por Email","action_type":"send_receipt","config":{"method":"email"}}}]',
 '[{"id":"e1","source":"trigger-1","target":"action-1"},{"id":"e2","source":"action-1","target":"action-2"},{"id":"e3","source":"action-2","target":"action-3"}]');
