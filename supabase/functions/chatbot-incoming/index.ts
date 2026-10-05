// Endpoint público que permite que sistemas externos (CRM, ERP, Zapier, Make, scripts próprios)
// disparem um fluxo do chatbot via HTTP POST. Faz parte do "trigger.webhook".
//
// Uso:
//   POST /functions/v1/chatbot-incoming?flow_id=<uuid>
//   Headers (opcional): x-webhook-secret: <segredo definido no node trigger>
//   Body JSON: { phone: "5511999999999", name?: "João", variables?: { qualquer: "coisa" } }
//
// Resposta: { ok: true, execution_id, conversation_id, message?: "primeira msg enviada" }

import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-webhook-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const url = new URL(req.url);
  const flowId = url.searchParams.get('flow_id');
  if (!flowId) return json({ error: 'missing_flow_id' }, 400);

  let payload: any = {};
  try { payload = await req.json(); } catch { payload = {}; }

  const rawPhone = String(payload.phone || payload.telefone || '').replace(/\D/g, '');
  if (!rawPhone) return json({ error: 'missing_phone' }, 400);

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  // Carrega o fluxo
  const { data: flow, error: flowErr } = await supabase
    .from('chatbot_flows')
    .select('id, company_id, nodes, edges, settings, execution_count, is_active')
    .eq('id', flowId)
    .maybeSingle();
  if (flowErr || !flow) return json({ error: 'flow_not_found' }, 404);
  if (flow.is_active === false) return json({ error: 'flow_inactive' }, 403);

  const nodes: any[] = Array.isArray(flow.nodes) ? flow.nodes : [];
  const edges: any[] = Array.isArray(flow.edges) ? flow.edges : [];

  // Procura o node trigger.webhook e valida secret (se configurado)
  const triggerNode = nodes.find((n) => n?.type === 'trigger' && n?.subType === 'webhook');
  const expectedSecret: string = triggerNode?.data?.config?.secret || '';
  if (expectedSecret) {
    const got = req.headers.get('x-webhook-secret') || '';
    if (got !== expectedSecret) return json({ error: 'invalid_secret' }, 401);
  }

  // Pega a primeira sessão WhatsApp ativa da empresa para abrir/identificar a conversa
  const { data: session } = await supabase
    .from('whatsapp_sessions')
    .select('id, instance_name, baileys_server_url, status')
    .eq('company_id', flow.company_id)
    .eq('status', 'connected')
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  // Conversa: tenta achar uma existente pra esse telefone+empresa, senão cria
  let conversationId: string | null = null;
  const { data: existingConv } = await supabase
    .from('whatsapp_conversations')
    .select('id, human_takeover')
    .eq('company_id', flow.company_id)
    .eq('phone_number', rawPhone)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (existingConv?.id) {
    if (existingConv.human_takeover) {
      return json({ ok: false, blocked: true, reason: 'human_takeover_active', conversation_id: existingConv.id }, 409);
    }
    conversationId = existingConv.id;
  } else {
    const { data: newConv, error: convErr } = await supabase
      .from('whatsapp_conversations')
      .insert({
        company_id: flow.company_id,
        session_id: session?.id ?? null,
        phone_number: rawPhone,
        contact_name: payload.name || rawPhone,
        status: 'open',
      })
      .select('id')
      .single();
    if (convErr) return json({ error: 'conversation_failed', detail: convErr.message }, 500);
    conversationId = newConv.id;
  }

  // Garante que não existe outra execução em curso pra mesma conversa
  const { data: running } = await supabase
    .from('chatbot_executions')
    .select('id')
    .eq('conversation_id', conversationId)
    .eq('status', 'running')
    .limit(1);
  if (running && running.length > 0) {
    return json({ ok: true, execution_id: running[0].id, conversation_id: conversationId, reused: true });
  }

  // Cria execução com as variáveis enviadas
  const incomingVars =
    payload.variables && typeof payload.variables === 'object' ? payload.variables : {};
  const variables = {
    nome: payload.name || rawPhone,
    telefone: rawPhone,
    ...incomingVars,
    ...payload, // mantém tudo acessível em {{phone}}, {{pedido_id}}, etc.
  };

  const { data: exec, error: execErr } = await supabase
    .from('chatbot_executions')
    .insert({
      flow_id: flow.id,
      company_id: flow.company_id,
      conversation_id: conversationId,
      contact_phone: rawPhone,
      status: 'running',
      variables,
      execution_path: [],
      last_activity_at: new Date().toISOString(),
    })
    .select('id')
    .single();
  if (execErr) return json({ error: 'execution_failed', detail: execErr.message }, 500);

  await supabase
    .from('chatbot_flows')
    .update({ execution_count: (flow.execution_count || 0) + 1 })
    .eq('id', flow.id);

  // Tenta enviar imediatamente o primeiro bloco "message" alcançável a partir do trigger
  let sentMessage: string | undefined;
  try {
    if (session?.baileys_server_url && session?.instance_name && triggerNode) {
      const interp = (s: string) =>
        (s || '').replace(/\{\{([\w.]+)\}\}/g, (_: string, k: string) => {
          const path = k.split('.');
          let v: any = variables;
          for (const p of path) v = v?.[p];
          return v === undefined || v === null ? `{{${k}}}` : String(v);
        });
      // BFS pelo primeiro message a partir do trigger
      const visited = new Set<string>();
      const queue: string[] = [triggerNode.id];
      let firstMsg: any = null;
      while (queue.length) {
        const id = queue.shift()!;
        if (visited.has(id)) continue;
        visited.add(id);
        const node = nodes.find((n) => n.id === id);
        if (!node) continue;
        if (node.type === 'message' && id !== triggerNode.id) { firstMsg = node; break; }
        for (const e of edges) if (e.source === id && !visited.has(e.target)) queue.push(e.target);
      }
      if (firstMsg) {
        const cfg = firstMsg.data?.config || {};
        let text = interp(cfg.content || cfg.message || '');
        const buttons: string[] = Array.isArray(cfg.buttons) ? cfg.buttons : [];
        if (buttons.length > 0) {
          text += '\n\n' + buttons.map((b, i) => `${i + 1}. ${b}`).join('\n');
        }
        const jid = `${rawPhone}@s.whatsapp.net`;
        await fetch(`${session.baileys_server_url}/api/message/send`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ instanceName: session.instance_name, jid, message: { text } }),
        });
        await supabase.from('whatsapp_messages').insert({
          company_id: flow.company_id,
          session_id: session.id,
          conversation_id: conversationId,
          content: text,
          from_me: true,
          status: 'sent',
          message_type: 'text',
          sender_name: 'Chatbot (webhook)',
        });
        await supabase
          .from('chatbot_executions')
          .update({ current_node_id: firstMsg.id, execution_path: [firstMsg.id] })
          .eq('id', exec.id);
        sentMessage = text;
      }
    }
  } catch (sendErr) {
    console.error('[chatbot-incoming] send first message failed', sendErr);
  }

  return json({
    ok: true,
    execution_id: exec.id,
    conversation_id: conversationId,
    first_message_sent: !!sentMessage,
    message: sentMessage,
  });
});