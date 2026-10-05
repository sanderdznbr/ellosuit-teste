
-- Fix "Email - Upgrade de Plano"
UPDATE automations SET nodes = '[
  {"id":"t1","type":"trigger","position":{"x":250,"y":50},"data":{"label":"Upgrade de Plano","trigger_type":"subscription_change","config":{"event":"subscription.upgraded"}}},
  {"id":"a1","type":"action","position":{"x":250,"y":200},"data":{"label":"Enviar Email Upgrade","action_type":"send_email","config":{"template_key":"plan_upgrade","template_id":"b1000001-0001-4000-8000-000000000001","to":"{{client.email}}","subject":"Upgrade Confirmado, {{client.name}}! 🚀","from_email":"contato@ellosuit.com"}}}
]'::jsonb WHERE id = 'ca472f87-dae2-4d92-b8eb-9ea3b984fb80';

-- Fix "Email - Lembrete de Reuniao"
UPDATE automations SET nodes = '[
  {"id":"t1","type":"trigger","position":{"x":250,"y":50},"data":{"label":"30 Min para Reunião","trigger_type":"scheduled","config":{"schedule":"meeting_reminder_30min"}}},
  {"id":"a1","type":"action","position":{"x":250,"y":200},"data":{"label":"Enviar Lembrete","action_type":"send_email","config":{"template_key":"meeting_reminder","template_id":"b1000001-0007-4000-8000-000000000007","to":"{{client.email}}","subject":"Lembrete: Reunião em 30 minutos","from_email":"contato@ellosuit.com"}}}
]'::jsonb WHERE id = '1b769c8b-5e0c-4224-be35-830c1dc6dda0';

-- Fix "Email - Assinatura Renovada"
UPDATE automations SET nodes = '[
  {"id":"t1","type":"trigger","position":{"x":250,"y":50},"data":{"label":"Assinatura Renovada","trigger_type":"webhook","config":{"event":"subscription.renewed"}}},
  {"id":"a1","type":"action","position":{"x":250,"y":200},"data":{"label":"Enviar Email Renovação","action_type":"send_email","config":{"template_key":"subscription_renewed","template_id":"b1000001-0002-4000-8000-000000000002","to":"{{client.email}}","subject":"Assinatura renovada com sucesso!","from_email":"contato@ellosuit.com"}}}
]'::jsonb WHERE id = '112d3777-c3ac-4d83-8f40-dcdc683d2443';

-- Fix "Email - Falha no Pagamento"
UPDATE automations SET nodes = '[
  {"id":"t1","type":"trigger","position":{"x":250,"y":50},"data":{"label":"Cobrança Falhou","trigger_type":"webhook","config":{"event":"charge.failed"}}},
  {"id":"a1","type":"action","position":{"x":250,"y":200},"data":{"label":"Alertar Cliente","action_type":"send_email","config":{"template_key":"payment_failed","template_id":"b1000001-0003-4000-8000-000000000003","to":"{{client.email}}","subject":"Atenção: Falha no pagamento","from_email":"contato@ellosuit.com"}}}
]'::jsonb WHERE id = '37d7db8c-31df-4785-991a-22a5b17b449f';

-- Fix "Email - Cancelamento Confirmado"
UPDATE automations SET nodes = '[
  {"id":"t1","type":"trigger","position":{"x":250,"y":50},"data":{"label":"Assinatura Cancelada","trigger_type":"webhook","config":{"event":"subscription.canceled"}}},
  {"id":"a1","type":"action","position":{"x":250,"y":200},"data":{"label":"Enviar Confirmação Cancelamento","action_type":"send_email","config":{"template_key":"cancellation_confirmed","template_id":"b1000001-0004-4000-8000-000000000004","to":"{{client.email}}","subject":"Cancelamento confirmado","from_email":"contato@ellosuit.com"}}}
]'::jsonb WHERE id = 'ada1cef8-30ee-4ce2-8bf6-75a7d22a2b52';

-- Fix "Email - Documento Compartilhado"
UPDATE automations SET nodes = '[
  {"id":"t1","type":"trigger","position":{"x":250,"y":50},"data":{"label":"Documento Compartilhado","trigger_type":"document_event","config":{"event":"document.shared"}}},
  {"id":"a1","type":"action","position":{"x":250,"y":200},"data":{"label":"Enviar por Email","action_type":"send_email","config":{"template_key":"document_shared","template_id":"b1000001-0008-4000-8000-000000000008","to":"{{client.email}}","subject":"Um documento foi compartilhado com você","from_email":"contato@ellosuit.com"}}}
]'::jsonb WHERE id = '5d201b10-c059-4d01-b674-e6da8ba1ca02';

-- Fix "Email - Proposta/OS Enviada"
UPDATE automations SET nodes = '[
  {"id":"t1","type":"trigger","position":{"x":250,"y":50},"data":{"label":"Proposta Criada","trigger_type":"document_event","config":{"event":"proposal.created"}}},
  {"id":"a1","type":"action","position":{"x":250,"y":200},"data":{"label":"Enviar Proposta por Email","action_type":"send_email","config":{"template_key":"proposal_sent","template_id":"b1000001-0009-4000-8000-000000000009","to":"{{client.email}}","subject":"Nova proposta disponível para você","from_email":"contato@ellosuit.com"}}}
]'::jsonb WHERE id = '81166040-0d52-4c3c-a898-c361aeebe84a';

-- Fix "Email - Novo Contato CRM"
UPDATE automations SET nodes = '[
  {"id":"t1","type":"trigger","position":{"x":250,"y":50},"data":{"label":"Novo Contato Cadastrado","trigger_type":"new_client","config":{"event":"client.created"}}},
  {"id":"a1","type":"action","position":{"x":250,"y":200},"data":{"label":"Email de Confirmação","action_type":"send_email","config":{"template_key":"new_contact","template_id":"b1000001-0005-4000-8000-000000000005","to":"{{client.email}}","subject":"Contato cadastrado com sucesso!","from_email":"contato@ellosuit.com"}}}
]'::jsonb WHERE id = 'ff2b78cb-6848-4ba5-a9ad-08858434a4b3';

-- Fix "Email - Reembolso Processado"
UPDATE automations SET nodes = '[
  {"id":"t1","type":"trigger","position":{"x":250,"y":50},"data":{"label":"Reembolso Processado","trigger_type":"webhook","config":{"event":"refund.processed"}}},
  {"id":"a1","type":"action","position":{"x":250,"y":200},"data":{"label":"Enviar Confirmação Reembolso","action_type":"send_email","config":{"template_key":"refund_processed","template_id":"b1000001-0010-4000-8000-000000000010","to":"{{client.email}}","subject":"Reembolso processado com sucesso","from_email":"contato@ellosuit.com"}}}
]'::jsonb WHERE id = '834d5593-3835-4267-a797-893ce56914d9';

-- Fix "Email - Reuniao Agendada"
UPDATE automations SET nodes = '[
  {"id":"t1","type":"trigger","position":{"x":250,"y":50},"data":{"label":"Reunião Agendada","trigger_type":"calendar_event","config":{"event":"meeting.scheduled"}}},
  {"id":"a1","type":"action","position":{"x":250,"y":200},"data":{"label":"Enviar Confirmação","action_type":"send_email","config":{"template_key":"meeting_scheduled","template_id":"b1000001-0006-4000-8000-000000000006","to":"{{client.email}}","subject":"Reunião agendada com sucesso!","from_email":"contato@ellosuit.com"}}}
]'::jsonb WHERE id = '011fe490-fa8b-438e-a342-17c1d2d94eb8';
