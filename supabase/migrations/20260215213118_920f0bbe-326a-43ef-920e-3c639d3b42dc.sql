-- Insert Ellosuit Assistant AI Agent
INSERT INTO public.ai_agents (
  company_id, created_by, name, personality, instructions, is_active, model,
  settings, whatsapp_enabled, description
) VALUES (
  '60008c43-e536-482d-a090-91904de57534',
  'c63ba931-0c34-4461-ae8d-2908aed7dd20',
  'Ellosuit Assistant',
  'Assistente profissional, amigável e eficiente da plataforma Ellosuit. Comunicação clara e direta, como um atendente real no WhatsApp.',
  'Você é o assistente oficial da Ellosuit via WhatsApp. O cliente já foi autenticado e você tem acesso à conta dele.

CAPACIDADES:
- Listar e criar tarefas
- Ver e criar eventos na agenda
- Listar contatos/cadastros do CRM
- Verificar status da assinatura
- Listar documentos no Drive
- Informações gerais sobre a plataforma

REGRAS:
1. Responda APENAS o que foi perguntado. Seja direto e conciso.
2. Use as ferramentas para executar ações reais na conta do cliente.
3. Confirme sempre o que foi feito.
4. Se não conseguir resolver, ofereça transferir para atendente humano.
5. Responda em português brasileiro, sem formatação markdown.',
  true,
  'google/gemini-3-flash-preview',
  '{"temperature": 0.7, "maxResponseChars": 500, "humor": "profissional", "is_platform_agent": true, "audioResponseMode": "when_audio", "ttsVoice": "nova"}'::jsonb,
  true,
  'Agente IA da plataforma Ellosuit que permite clientes gerenciarem suas contas via WhatsApp'
);

-- Insert Ellosuit Support Chatbot Flow
INSERT INTO public.chatbot_flows (
  company_id, created_by, name, description, is_active,
  trigger_config, nodes, edges
) VALUES (
  '60008c43-e536-482d-a090-91904de57534',
  'c63ba931-0c34-4461-ae8d-2908aed7dd20',
  'Ellosuit Support',
  'Fluxo de autenticação de clientes via WhatsApp para acesso à plataforma Ellosuit',
  true,
  '{"type": "whatsapp_channel"}'::jsonb,
  '[
    {"id": "trigger_1", "type": "trigger", "subType": "whatsapp_channel", "position": {"x": 250, "y": 50}, "data": {"label": "Nova conversa WhatsApp", "config": {}}},
    {"id": "msg_welcome", "type": "message", "subType": "text", "position": {"x": 250, "y": 200}, "data": {"label": "Boas-vindas", "config": {"content": "Olá! 👋 Sou o assistente da Ellosuit.\n\nPara acessar sua conta e te ajudar, preciso confirmar sua identidade.\n\nPor favor, me informe o e-mail cadastrado na plataforma:"}}},
    {"id": "action_lookup", "type": "action", "subType": "lookup_account", "position": {"x": 250, "y": 400}, "data": {"label": "Buscar conta", "config": {"actionType": "lookup_account"}}},
    {"id": "cond_found", "type": "condition", "subType": "check_variable", "position": {"x": 250, "y": 600}, "data": {"label": "Conta encontrada?", "config": {"variable": "account_found", "value": "true"}}},
    {"id": "msg_confirm", "type": "message", "subType": "text", "position": {"x": 100, "y": 800}, "data": {"label": "Confirmar identidade", "config": {"content": "Encontrei! Você é {{authenticated_user_name}} da empresa {{authenticated_company_name}}. Correto?", "buttons": ["Sim, sou eu!", "Não, errei o e-mail"]}}},
    {"id": "msg_not_found", "type": "message", "subType": "text", "position": {"x": 400, "y": 800}, "data": {"label": "Não encontrado", "config": {"content": "Não encontrei uma conta com esse e-mail. 😕\n\nPor favor, verifique e digite o e-mail correto:"}}},
    {"id": "action_transfer", "type": "action", "subType": "transfer_ai_agent", "position": {"x": 0, "y": 1000}, "data": {"label": "Transferir para IA", "config": {"actionType": "transfer_ai_agent", "aiEntryBehavior": "send_welcome"}}},
    {"id": "msg_retry", "type": "message", "subType": "text", "position": {"x": 200, "y": 1000}, "data": {"label": "Tentar novamente", "config": {"content": "Sem problema! Por favor, digite o e-mail correto:"}}}
  ]'::jsonb,
  '[
    {"id": "e1", "source": "trigger_1", "target": "msg_welcome"},
    {"id": "e2", "source": "msg_welcome", "target": "action_lookup"},
    {"id": "e3", "source": "action_lookup", "target": "cond_found"},
    {"id": "e4", "source": "cond_found", "target": "msg_confirm", "sourceHandle": "true"},
    {"id": "e5", "source": "cond_found", "target": "msg_not_found", "sourceHandle": "false"},
    {"id": "e6", "source": "msg_confirm", "target": "action_transfer", "sourceHandle": "btn_0"},
    {"id": "e7", "source": "msg_confirm", "target": "msg_retry", "sourceHandle": "btn_1"},
    {"id": "e8", "source": "msg_not_found", "target": "action_lookup"},
    {"id": "e9", "source": "msg_retry", "target": "action_lookup"}
  ]'::jsonb
);