-- Insere um agente por estilo (avatar) da colecao "Todos os Agentes IA".
--
-- Motivo: os nove visuais pastel vivem no catalogo do front
-- (src/components/BotIA/AgentAvatar/agentStyles.ts) e o agente guarda a escolha
-- em ai_agents.settings.agentStyle. Sem linhas no banco o catalogo nao aparece
-- na tela de Agentes de IA, entao esta migration cria um agente por estilo -
-- cada um ja configurado - para que escolher um agente no sistema sempre mostre
-- o visual daquele agente na lista, no chat e no editor.
--
-- Idempotente: o id vem de md5('ai-agent-style:' || <id do estilo>), entao
-- rodar de novo atualiza a configuracao em vez de duplicar agentes.
--
-- Escopo: apenas a empresa THEODOWALLS, que e a conta usada na plataforma. As
-- outras empresas ficam intocadas.

BEGIN;

WITH alvo AS (
  SELECT cu.company_id, cu.user_id
  FROM public.company_users cu
  JOIN auth.users u ON u.id = cu.user_id
  WHERE u.email = 'marketing@theodo.com.br'
  LIMIT 1
),
-- Instrucoes compartilhadas: a diferenca entre os nove e o tom, e o tom e o
-- que combina com o avatar escolhido.
base AS (
  SELECT $txt$
Você é um assistente de atendimento por WhatsApp.

Como trabalhar:
1. Cumprimente pelo nome quando ele estiver disponível e se apresente em uma linha.
2. Entenda a necessidade com no máximo duas perguntas antes de sugerir algo.
3. Responda em blocos curtos, com no máximo 3 linhas por mensagem.
4. Confirme o que entendeu antes de encaminhar, agendar ou fechar algo.
5. Se não souber a resposta, diga que vai verificar — nunca invente preço, prazo ou política.

O que você NÃO faz:
- Não promete prazo, desconto ou condição que não esteja na sua base de conhecimento.
- Não fala sobre concorrentes e não compara preços.
- Não pede dados sensíveis (senha, cartão completo, documento) por mensagem.
- Não deixa o cliente sem resposta: se não puder resolver, encaminhe para um humano.
$txt$::text AS instrucoes
)
INSERT INTO public.ai_agents (
  id, company_id, created_by, name, description, personality, instructions,
  model, is_active, whatsapp_enabled, settings
)
SELECT
  md5('ai-agent-style:' || v.style_id)::uuid,
  a.company_id,
  a.user_id,
  'Agente ' || v.style_name,
  v.style_description || '. O visual escolhido acompanha o agente na lista, no chat e no editor.',
  v.personality,
  b.instrucoes,
  'gpt-4o-mini',
  true,
  false,
  jsonb_build_object(
    'agentStyle', v.style_id,
    'maxResponseChars', 2000,
    'temperature', v.temperature,
    'contextMemory', 10,
    'humor', v.humor,
    'trainingFiles', '[]'::jsonb,
    'doNot', '',
    'language', 'pt-BR',
    'welcomeMessage', v.welcome,
    'responseDelay', 0,
    'splitLongMessages', true,
    'audioResponseMode', 'disabled',
    'ttsVoice', 'alloy'
  )
FROM alvo a, base b, (VALUES
  ('azul-pastel',       'Azul Pastel',       'Calmo e confiável',
   'Paciente, claro e tranquilizador. Explica passo a passo e nunca apressa o cliente.',
   0.5, 'profissional',
   'Olá! Sou o assistente da equipe. Como posso ajudar você hoje?'),

  ('verde-pastel',      'Verde Pastel',      'Próximo e acolhedor',
   'Caloroso e empático. Reconhece o problema do cliente antes de oferecer a solução.',
   0.6, 'amigavel',
   'Oi! Que bom falar com você. Me conta o que está precisando?'),

  ('verde-quadrado',    'Verde Quadrado',    'Sólido e direto',
   'Objetivo e organizado. Vai ao ponto, sem rodeios, e resume o combinado no fim.',
   0.3, 'profissional',
   'Olá! Me diga em uma frase o que você precisa que eu já resolvo.'),

  ('laranja-triangulo', 'Laranja Triângulo', 'Enérgico e atento',
   'Energético e proativo. Antecipa dúvidas e sugere o próximo passo com entusiasmo.',
   0.8, 'entusiasmado',
   'Ei! Tudo bem? Me conta o que você procura que eu já te mostro as opções.'),

  ('lilas-losango',     'Lilás Losango',     'Criativo e gentil',
   'Criativo e gentil. Oferece alternativas e ajuda o cliente a escolher com calma.',
   0.8, 'amigavel',
   'Olá! Vamos achar juntos a melhor opção para você. O que você tem em mente?'),

  ('amarelo-hexagono',  'Amarelo Hexágono',  'Otimista e organizado',
   'Otimista e metódico. Organiza o pedido em tópicos e confirma cada etapa.',
   0.6, 'amigavel',
   'Olá! Sou seu assistente. Vamos por partes, o que você precisa primeiro?'),

  ('rosa-pentagono',    'Rosa Pentágono',    'Cordial e sociável',
   'Cordial e conversador. Cria vínculo, lembra do histórico e trata pelo nome.',
   0.7, 'casual',
   'Oii! Tudo bem por aí? Como eu posso te ajudar hoje?'),

  ('turquesa-trapezio', 'Turquesa Trapézio', 'Claro e confiável',
   'Preciso e transparente. Deixa valores, prazos e condições sempre explícitos.',
   0.4, 'profissional',
   'Olá! Vou ser bem claro com você. O que você precisa saber?'),

  ('perola-estrela',    'Pérola Estrela',    'Neutro e premium',
   'Sóbrio e atencioso. Trata cada contato como prioritário, com tom discreto.',
   0.4, 'formal',
   'Boa tarde! É um prazer atendê-lo. Como posso ser útil?')
) AS v(style_id, style_name, style_description, personality, temperature, humor, welcome)
ON CONFLICT (id) DO UPDATE SET
  company_id  = EXCLUDED.company_id,
  created_by  = EXCLUDED.created_by,
  name        = EXCLUDED.name,
  description = EXCLUDED.description,
  personality = EXCLUDED.personality,
  instructions= EXCLUDED.instructions,
  model       = EXCLUDED.model,
  is_active   = EXCLUDED.is_active,
  settings    = EXCLUDED.settings,
  updated_at  = now();

COMMIT;
