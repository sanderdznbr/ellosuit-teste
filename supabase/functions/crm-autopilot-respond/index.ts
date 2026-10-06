import { createClient } from "npm:@supabase/supabase-js@2";
import { encode as base64Encode } from "https://deno.land/std@0.168.0/encoding/base64.ts";
import { chatCompletion } from '../_shared/llm.ts';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
const ELEVENLABS_API_KEY = Deno.env.get("ELEVENLABS_API_KEY");

async function callAi(messages: any[]) {
  const r = await chatCompletion({ model: "google/gemini-2.5-flash", messages, response_format: { type: "json_object" } });
  if (r.status === 402) throw new Error("ai_credits_exhausted");
  if (r.status === 429) throw new Error("ai_rate_limited");
  if (!r.ok) throw new Error(`ai_${r.status}: ${await r.text()}`);
  const j = await r.json();
  return j?.choices?.[0]?.message?.content || "";
}

function safe(raw: string) {
  try { return JSON.parse(raw.replace(/^```json\s*/i, "").replace(/```$/i, "").trim()); }
  catch { return {}; }
}

// Remove qualquer emoji / pictográfico. O piloto NUNCA envia emoji.
function stripEmojis(s: string): string {
  if (!s) return s;
  return s
    .replace(/[\u{1F1E6}-\u{1F1FF}\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{1F000}-\u{1F02F}\u{1F0A0}-\u{1F0FF}\u{1F100}-\u{1F1FF}\u{1F200}-\u{1F2FF}\u{1F300}-\u{1F5FF}\u{1F600}-\u{1F64F}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{FE0F}\u{200D}]/gu, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function normalizeForDedupe(s: string): string {
  return (s || "").toLowerCase().replace(/[^a-z0-9áéíóúâêôãõç ]/gi, "").replace(/\s+/g, " ").trim();
}

function onlyDigits(value: unknown): string {
  return String(value || "").replace(/\D/g, "");
}

function phoneVariants(value: unknown): string[] {
  const digits = onlyDigits(value);
  const variants = new Set<string>();
  if (digits) variants.add(digits);
  if (digits.startsWith("55") && digits.length === 13) {
    variants.add(digits.slice(0, 4) + digits.slice(5));
  } else if (digits.startsWith("55") && digits.length === 12) {
    variants.add(digits.slice(0, 4) + "9" + digits.slice(4));
  }
  return Array.from(variants);
}

function phonesMatch(a: unknown, b: unknown): boolean {
  const aSet = new Set(phoneVariants(a));
  return phoneVariants(b).some((v) => aSet.has(v));
}

function waitUntil(work: Promise<unknown>) {
  const runtime = globalThis as unknown as { EdgeRuntime?: { waitUntil?: (promise: Promise<unknown>) => void } };
  if (runtime.EdgeRuntime?.waitUntil) runtime.EdgeRuntime.waitUntil(work);
}

function scheduleCustomerHoldMessage(params: {
  escalationId: string;
  delayMs?: number;
}) {
  const delayMs = params.delayMs ?? 4500;
  waitUntil((async () => {
    await new Promise((resolve) => setTimeout(resolve, delayMs));
    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: pending } = await admin
      .from("crm_autopilot_pending_escalations")
      .select("id, company_id, conversation_id, status, metadata")
      .eq("id", params.escalationId)
      .maybeSingle();
    if (!pending || pending.status !== "waiting") return;
    const meta = (pending.metadata as Record<string, unknown>) || {};
    if (meta.hold_sent) return;
    const { data: conv } = await admin
      .from("whatsapp_conversations")
      .select("session_id, contact_phone")
      .eq("id", pending.conversation_id)
      .maybeSingle();
    if (!conv?.session_id || !conv?.contact_phone) return;
    const message = "Só um momento, estou confirmando isso pra te responder certinho.";
    await fetch(`${SUPABASE_URL}/functions/v1/whatsapp-api`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` },
      body: JSON.stringify({
        action: "send_message",
        manualTakeover: false,
        sessionId: conv.session_id,
        phone: conv.contact_phone,
        conversationId: pending.conversation_id,
        message,
      }),
    }).catch(() => {});
    await admin.from("crm_autopilot_pending_escalations")
      .update({ metadata: { ...meta, hold_sent: true, hold_sent_at: new Date().toISOString() } })
      .eq("id", pending.id);
    await admin.from("crm_autopilot_events").insert({
      company_id: pending.company_id,
      conversation_id: pending.conversation_id,
      event_type: "hold_message_sent",
      description: "Cliente avisado em até 5s enquanto o Pai responde",
      metadata: { escalation_id: pending.id, message },
    });
  })().catch((error) => console.error("hold_message_failed", error)));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY missing");
    const { conversationId, incomingMessageId, force, mode } = await req.json();
    if (!conversationId) return new Response(JSON.stringify({ error: "conversationId required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: conv } = await admin.from("whatsapp_conversations")
      .select("id, company_id, session_id, contact_name, contact_phone, human_takeover, ai_auto_reply_enabled, last_message, last_message_at")
      .eq("id", conversationId).maybeSingle();
    if (!conv) return new Response(JSON.stringify({ error: "conv_not_found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    // human_takeover só bloqueia o piloto se um humano REAL respondeu depois da
    // última mensagem do cliente (mensagem manual da equipe, não do bot/piloto/system).
    if (conv.human_takeover) {
      const { data: lastIn } = await admin.from("whatsapp_messages")
        .select("timestamp").eq("conversation_id", conv.id).eq("from_me", false)
        .order("timestamp", { ascending: false }).limit(1).maybeSingle();
      if (lastIn?.timestamp) {
        const { data: humanReply } = await admin.from("whatsapp_messages")
          .select("id").eq("conversation_id", conv.id).eq("from_me", true)
          .neq("message_type", "system").eq("is_ai_response", false)
          .gt("timestamp", lastIn.timestamp).limit(1).maybeSingle();
        if (humanReply) {
          return new Response(JSON.stringify({ skipped: "human_replied" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
      }
      // nenhum humano respondeu depois do cliente → piloto assume mesmo com takeover
    }

    const { data: cfg } = await admin.from("crm_autopilot_configs").select("*").eq("company_id", conv.company_id).maybeSingle();
    if (!cfg || !cfg.is_active) return new Response(JSON.stringify({ skipped: "autopilot_off" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

    // O número PAI DO PILOTO nunca pode ser atendido pelo próprio piloto.
    // Ele é apenas canal de orientação; responder ali cria loop e envia resposta ao destinatário errado.
    if (cfg.parent_phone && phonesMatch(conv.contact_phone, cfg.parent_phone)) {
      await admin.from("whatsapp_conversations").update({
        human_takeover: false,
        human_takeover_at: null,
        human_takeover_reason: null,
        ai_auto_reply_enabled: false,
        assigned_agent_id: null,
      }).eq("id", conv.id);
      await admin.from("crm_autopilot_events").insert({
        company_id: conv.company_id,
        conversation_id: conv.id,
        event_type: "skipped",
        description: "Canal PAI DO PILOTO ignorado pelo autopilot para evitar loop",
      });
      return new Response(JSON.stringify({ skipped: "parent_channel" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Debounce: se o piloto já respondeu nos últimos 5s, não dispara de novo (a menos que seja force).
    if (!force) {
      const { data: veryRecent } = await admin.from("crm_autopilot_events")
        .select("created_at").eq("conversation_id", conv.id).eq("event_type", "answered")
        .order("created_at", { ascending: false }).limit(1).maybeSingle();
      if (veryRecent?.created_at && (Date.now() - new Date(veryRecent.created_at).getTime()) < 5000) {
        return new Response(JSON.stringify({ skipped: "debounce" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    // MODO PROATIVO: se o piloto disse "estou verificando/vou confirmar/etc." e não
    // escalou pro Pai, força escalonamento agora sem esperar o cliente reagir.
    if (mode === "proactive_followup" && cfg.parent_phone && cfg.parent_session_id) {
      const { data: msgsP } = await admin.from("whatsapp_messages")
        .select("from_me, content, timestamp, is_ai_response, message_type")
        .eq("conversation_id", conv.id).order("timestamp", { ascending: false }).limit(40);
      const orderedP = (msgsP || []).slice().reverse();
      const transcriptP = orderedP
        .map((m: any) => `${m.from_me ? "EMPRESA" : "CLIENTE"}: ${(m.content || `[${m.message_type}]`).slice(0, 400)}`)
        .join("\n");
      const lastCustomer = (msgsP || []).find((m: any) => !m.from_me)?.content || "";
      const { data: pending } = await admin.from("crm_autopilot_pending_escalations")
        .select("id").eq("conversation_id", conv.id).in("status", ["waiting", "processing"]).limit(1).maybeSingle();
      const { data: lastEsc } = await admin.from("crm_autopilot_pending_escalations")
        .select("created_at").eq("conversation_id", conv.id)
        .in("status", ["waiting", "processing"])
        .order("created_at", { ascending: false }).limit(1).maybeSingle();
      const escTooRecent = lastEsc?.created_at && (Date.now() - new Date(lastEsc.created_at).getTime()) < 90_000;
      if (!pending && !escTooRecent) {
        // Gera um briefing rico pro Pai: resumo do caso + dúvida específica pra ele responder
        let summary = "";
        let doubt = "";
        try {
          const briefRaw = await callAi([
            { role: "system", content: `Você é um assistente que analisa uma conversa de WhatsApp entre EMPRESA e CLIENTE e prepara um briefing curto pro dono da empresa responder. Nunca use emoji. Retorne APENAS JSON: {"resumo":"1-2 frases explicando quem é o cliente e o que ele quer/dúvida principal","pergunta":"pergunta objetiva pro dono responder, focada no que a IA não sabe (preço, disponibilidade, decisão, dado específico)"}` },
            { role: "user", content: `Conversa (cronológica):\n${transcriptP}\n\nCliente: ${conv.contact_name || conv.contact_phone}\n\nPrepare o briefing.` },
          ]);
          const bp = safe(briefRaw);
          summary = stripEmojis(String(bp.resumo || "")).slice(0, 500);
          doubt = stripEmojis(String(bp.pergunta || "")).slice(0, 400);
        } catch (e) {
          console.warn("brief_ai_failed", e);
        }
        if (!summary) summary = `Cliente ${conv.contact_name || conv.contact_phone} está aguardando resposta.`;
        if (!doubt) doubt = `Como você quer que eu responda? Última mensagem dele: "${(lastCustomer || "").slice(0,200)}"`;

        const question = doubt;
        const promptForParent = `Preciso da sua orientação pra responder um cliente:\n\nContato: ${conv.contact_name || conv.contact_phone}\n\nSituação: ${summary}\n\nÚltima mensagem do cliente: "${(lastCustomer || "").slice(0,200)}"\n\nPergunta: ${doubt}\n\nResponda aqui (texto ou áudio) que eu envio pra ele.`;
        const sendRes = await fetch(`${SUPABASE_URL}/functions/v1/whatsapp-api`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` },
          body: JSON.stringify({ action: "send_message", manualTakeover: false, sessionId: cfg.parent_session_id, phone: cfg.parent_phone, message: promptForParent }),
        });
        const sendJson = await sendRes.json().catch(() => ({}));
        const { data: insertedPending } = await admin.from("crm_autopilot_pending_escalations").insert({
          company_id: conv.company_id, conversation_id: conv.id, session_id: conv.session_id,
          customer_phone: conv.contact_phone, question_sent: question, original_customer_message: lastCustomer,
          parent_message_id: sendJson?.messageId || null, status: "waiting",
          timeout_at: new Date(Date.now() + (cfg.parent_timeout_minutes || 15) * 60000).toISOString(),
        }).select("id").maybeSingle();
        if (insertedPending?.id) scheduleCustomerHoldMessage({ escalationId: insertedPending.id });
        await admin.from("crm_autopilot_events").insert({
          company_id: conv.company_id, conversation_id: conv.id, event_type: "escalated_to_parent",
          description: `Proativo: pediu orientação ao Pai — cliente aguardando`,
        });
        return new Response(JSON.stringify({ escalated: true, proactive: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      return new Response(JSON.stringify({ skipped: "already_pending" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Chatbot coexistence rule: NUNCA deixar o cliente sem resposta.
    // - Se o chatbot está rodando E já respondeu a última mensagem do cliente
    //   nos últimos 90s, deixa o chatbot conduzir (piloto aguarda).
    // - Se o cliente mandou algo novo que o chatbot não respondeu (ficou perdido,
    //   saudação, pergunta fora do fluxo, etc.), o piloto assume imediatamente.
    const { data: recentMsgs } = await admin.from("whatsapp_messages")
      .select("from_me, timestamp")
      .eq("conversation_id", conv.id)
      .order("timestamp", { ascending: false })
      .limit(10);
    const lastInboundTs = (recentMsgs || []).find((m: any) => !m.from_me)?.timestamp;
    const lastOutboundTs = (recentMsgs || []).find((m: any) => m.from_me)?.timestamp;
    const { data: activeExec } = await admin.from("chatbot_executions")
      .select("id, status, last_activity_at, started_at")
      .eq("conversation_id", conv.id)
      .eq("status", "running")
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (activeExec && lastInboundTs && lastOutboundTs) {
      const inT = new Date(lastInboundTs).getTime();
      const outT = new Date(lastOutboundTs).getTime();
      const botAnsweredRecently = outT > inT && (Date.now() - outT) < 90_000;
      if (botAnsweredRecently) {
        await admin.from("crm_autopilot_events").insert({
          company_id: conv.company_id, conversation_id: conv.id, event_type: "skipped",
          description: `Chatbot respondeu — piloto em espera`,
          metadata: { chatbot_execution_id: activeExec.id },
        });
        return new Response(JSON.stringify({ skipped: "chatbot_answered" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      // Chatbot não respondeu esta mensagem → piloto assume e encerra a execução
      await admin.from("chatbot_executions")
        .update({ status: "stopped", completed_at: new Date().toISOString() })
        .eq("id", activeExec.id);
      await admin.from("crm_autopilot_events").insert({
        company_id: conv.company_id, conversation_id: conv.id, event_type: "chatbot_handoff",
        description: `Chatbot não respondeu — piloto assumindo para não deixar cliente esperando`,
        metadata: { chatbot_execution_id: activeExec.id },
      });
    }

    // Business hours check
    const now = new Date();
    const hourBR = (now.getUTCHours() - 3 + 24) % 24;
    if (hourBR < cfg.send_hour_start || hourBR >= cfg.send_hour_end) {
      await admin.from("crm_autopilot_events").insert({
        company_id: conv.company_id, conversation_id: conv.id, event_type: "skipped",
        description: "Fora do horário permitido", metadata: { hourBR },
      });
      return new Response(JSON.stringify({ skipped: "outside_hours" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Rate limit per contact per hour — apenas para respostas diretas do piloto.
    // NÃO bloqueia escalonamento pro Pai, senão o cliente fica sem resposta.
    const hourAgo = new Date(Date.now() - 36e5).toISOString();
    const { count: recentSent } = await admin.from("crm_autopilot_events")
      .select("id", { count: "exact", head: true })
      .eq("conversation_id", conv.id).eq("event_type", "answered")
      .gte("created_at", hourAgo);
    const rateLimited = (recentSent || 0) >= cfg.max_msgs_per_hour_per_contact;

    // Load last 30 messages of the conversation
    const { data: msgs } = await admin.from("whatsapp_messages")
      .select("from_me, content, message_type, timestamp")
      .eq("conversation_id", conv.id).order("timestamp", { ascending: false }).limit(30);
    const ordered = (msgs || []).slice().reverse();
    const newestStoredTs = ordered.length > 0
      ? new Date(ordered[ordered.length - 1].timestamp).getTime()
      : 0;
    const conversationPreviewTs = conv.last_message_at ? new Date(conv.last_message_at).getTime() : 0;
    const lastStoredOutbound = [...ordered].reverse().find((m: any) => m.from_me)?.content || "";
    const previewLooksInbound = !!conv.last_message
      && conversationPreviewTs > newestStoredTs + 1000
      && normalizeForDedupe(conv.last_message) !== normalizeForDedupe(lastStoredOutbound);
    if (previewLooksInbound) {
      ordered.push({
        from_me: false,
        content: conv.last_message,
        message_type: "text",
        timestamp: conv.last_message_at,
      });
    }
    const latestInboundTs = [...ordered].reverse().find((m: any) => !m.from_me)?.timestamp || null;
    const transcript = ordered.map((m: any) => `${m.from_me ? "EMPRESA" : "CLIENTE"}: ${(m.content || `[${m.message_type}]`).slice(0, 500)}`).join("\n");

    // User style: last 30 messages the user actually wrote (from_me=true, text) across all conversations
    const { data: styleMsgs } = await admin.from("whatsapp_messages")
      .select("content").eq("company_id", conv.company_id)
      .eq("from_me", true).eq("message_type", "text")
      .not("content", "is", null)
      .order("timestamp", { ascending: false }).limit(30);
    const styleText = (styleMsgs || [])
      .filter((m: any) => (m.content || "").trim().length > 10)
      .map((m: any) => `- ${m.content.slice(0, 220)}`).join("\n");

    const learnedBlock = (cfg.auto_configure && cfg.learned_prompt)
      ? `INSTRUÇÕES APRENDIDAS AUTOMATICAMENTE (siga à risca — foram derivadas do jeito real de escrever do dono):\n${cfg.learned_prompt}\n`
      : "";

    const systemPrompt = `Você é o assistente pessoal do dono de um negócio, respondendo por ele no WhatsApp. Você aprendeu o estilo, o tom e o vocabulário dele estudando mensagens anteriores. NUNCA revele que é IA, não cite plataformas nem marcas internas. Escreva em português do Brasil, natural, como se fosse a própria pessoa.

${learnedBlock}OBJETIVO / MISSÃO: ${cfg.objective || "atender bem e avançar cada conversa"}
PERSONALIDADE / TOM: ${cfg.personality || cfg.tone_preset}
LIMITE: máximo ${cfg.max_chars} caracteres por mensagem.
PODE ENVIAR ÁUDIO? ${cfg.allow_audio ? "sim (marque want_audio:true quando um áudio for MUITO mais natural que texto)" : "não"}

ESTILO DE ESCRITA DO USUÁRIO (imite):
${styleText || "(sem amostras — use tom natural e brasileiro)"}

REGRAS ABSOLUTAS (invioláveis):
1. NUNCA use emoji, emoticon ou pictograma. Nenhum. Texto puro sempre.
2. NUNCA repita mensagem já enviada — leia a conversa e evite reescrever o que você já disse.
3. NUNCA envie frases genéricas de espera do tipo "estou verificando", "vou confirmar", "um instante", "aguarde" quando você NÃO tem a informação. Se não sabe, é ESCALATE puro (sem mandar nada pro cliente).
4. NUNCA deixe o cliente sem resposta quando você TEM a informação — responda direto, curto, imediato.
5. Se responder, seja instantâneo e específico. Nada de enrolação.
6. NUNCA invente, deduza ou "chute" o que a empresa vende, oferece, faz, cobra, ou o ramo dela. Se o cliente perguntar sobre PRODUTO, CARDÁPIO, SERVIÇO, PREÇO, PROMOÇÃO, ESTOQUE, DISPONIBILIDADE, HORÁRIO, ENDEREÇO, PRAZO, FORMA DE PAGAMENTO, ou qualquer coisa factual do negócio que NÃO esteja LITERALMENTE escrita na conversa acima ou nas INSTRUÇÕES APRENDIDAS — é ESCALATE. Sem exceção.
7. É PROIBIDO afirmar "não vendemos X", "nosso foco é Y", "trabalhamos com Z", "temos W", ou qualquer categoria/segmento/linha de produto que você não viu explicitamente na conversa ou nas instruções. Isso é hallucination e quebra o negócio do dono. Na dúvida: ESCALATE.
8. Só use "answer" quando: (a) for saudação/agradecimento/small talk sem conteúdo factual, OU (b) a resposta exata já apareceu antes nesta mesma conversa, OU (c) estiver LITERALMENTE nas INSTRUÇÕES APRENDIDAS. Fora disso, ESCALATE.

DECISÃO:
- Saudação, agradecimento, small talk, pergunta simples que você sabe → action:"answer", resposta direta e curta.
- QUALQUER pergunta sobre o que a empresa vende/faz/oferece, produto específico, preço, disponibilidade, estoque, cardápio, promoção, horário, endereço, prazo, pagamento, política, ou decisão do dono → action:"escalate" (o cliente NÃO recebe mensagem de espera; apenas o dono é consultado em silêncio).
- Threshold de confiança para responder: ${cfg.confidence_threshold}. Abaixo disso → escalate.
- Na MENOR dúvida se você tem a informação de verdade → escalate. É muito melhor perguntar ao dono do que inventar.

Retorne APENAS JSON: {
  "action":"answer"|"escalate",
  "confidence":0-1,
  "message":"(resposta pro cliente; sem emoji; sem frase de espera)",
  "want_audio":true|false,
  "situation_summary":"(quando action=escalate: 1-2 frases explicando quem é o cliente e o que ele quer/dúvida principal)",
  "question_for_owner":"(quando action=escalate: pergunta objetiva pro dono responder — foco no que só ele sabe: preço, disponibilidade, dado específico, decisão)"
}`;

    const userPrompt = `CLIENTE: ${conv.contact_name || conv.contact_phone}

CONVERSA (cronológica):
${transcript}

Gere a próxima resposta.`;

    const raw = await callAi([{ role: "system", content: systemPrompt }, { role: "user", content: userPrompt }]);
    const parsed = safe(raw);
    const action = parsed.action === "escalate" ? "escalate" : "answer";
    const confidence = Math.max(0, Math.min(1, Number(parsed.confidence) || 0));

    // Escalate path
    if ((action === "escalate" || confidence < Number(cfg.confidence_threshold)) && cfg.parent_phone && cfg.parent_session_id) {
      // GUARD: não duplicar consulta ao Pai se já houver uma escalação pendente
      // ou se uma escalação recente foi enviada/respondida nos últimos 90s.
      const { data: alreadyWaiting } = await admin.from("crm_autopilot_pending_escalations")
        .select("id").eq("conversation_id", conv.id).in("status", ["waiting", "processing"]).limit(1).maybeSingle();
      if (alreadyWaiting) {
        await admin.from("crm_autopilot_events").insert({
          company_id: conv.company_id, conversation_id: conv.id, event_type: "skipped",
          description: "Escalação já pendente — não perguntar de novo ao Pai",
        });
        return new Response(JSON.stringify({ skipped: "already_pending" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const { data: recentEsc } = await admin.from("crm_autopilot_pending_escalations")
        .select("created_at").eq("conversation_id", conv.id)
        .in("status", ["waiting", "processing"])
        .order("created_at", { ascending: false }).limit(1).maybeSingle();
      if (recentEsc?.created_at && (Date.now() - new Date(recentEsc.created_at).getTime()) < 90_000) {
        return new Response(JSON.stringify({ skipped: "recent_escalation" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const question = stripEmojis((parsed.question_for_owner || parsed.message || "Preciso da sua orientação").toString()).slice(0, 800);
      const summary = stripEmojis(String(parsed.situation_summary || "")).slice(0, 500)
        || `Cliente ${conv.contact_name || conv.contact_phone} está aguardando resposta.`;
      const lastCustomer = ordered.filter((m: any) => !m.from_me).slice(-1)[0]?.content || "";
      const promptForParent = `Preciso da sua orientação pra responder um cliente:

Contato: ${conv.contact_name || conv.contact_phone}

Situação: ${summary}

Última mensagem do cliente: "${lastCustomer.slice(0, 200)}"

Pergunta: ${question}

Responda aqui (texto ou áudio) que eu envio pra ele.`;

      const sendRes = await fetch(`${SUPABASE_URL}/functions/v1/whatsapp-api`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` },
        body: JSON.stringify({ action: "send_message", manualTakeover: false, sessionId: cfg.parent_session_id, phone: cfg.parent_phone, message: promptForParent }),
      });
      const sendJson = await sendRes.json().catch(() => ({}));

      // NÃO enviamos mensagem de espera pro cliente. O dono responde em silêncio
      // e o piloto envia a resposta real assim que ele retornar.

      const { data: insertedPending } = await admin.from("crm_autopilot_pending_escalations").insert({
        company_id: conv.company_id,
        conversation_id: conv.id,
        session_id: conv.session_id,
        customer_phone: conv.contact_phone,
        question_sent: question,
        original_customer_message: lastCustomer,
        parent_message_id: sendJson?.messageId || null,
        status: "waiting",
        timeout_at: new Date(Date.now() + cfg.parent_timeout_minutes * 60000).toISOString(),
      }).select("id").maybeSingle();
      if (insertedPending?.id) scheduleCustomerHoldMessage({ escalationId: insertedPending.id });
      await admin.from("crm_autopilot_events").insert({
        company_id: conv.company_id, conversation_id: conv.id, event_type: "escalated_to_parent",
        description: `Dúvida enviada ao número Pai: ${question.slice(0, 120)}`, metadata: { confidence },
      });
      return new Response(JSON.stringify({ escalated: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Answer path
    let message = stripEmojis(String(parsed.message || "")).slice(0, cfg.max_chars).trim();
    // Se atingiu o rate-limit, NUNCA travar: força escalate pro Pai com briefing.
    if (rateLimited && cfg.parent_phone && cfg.parent_session_id) {
      const { data: alreadyWaitingRL } = await admin.from("crm_autopilot_pending_escalations")
        .select("id").eq("conversation_id", conv.id).in("status", ["waiting", "processing"]).limit(1).maybeSingle();
      const { data: recentEscRL } = await admin.from("crm_autopilot_pending_escalations")
        .select("created_at").eq("conversation_id", conv.id)
        .in("status", ["waiting", "processing"])
        .order("created_at", { ascending: false }).limit(1).maybeSingle();
      const tooRecentRL = recentEscRL?.created_at && (Date.now() - new Date(recentEscRL.created_at).getTime()) < 90_000;
      if (alreadyWaitingRL || tooRecentRL) {
        return new Response(JSON.stringify({ skipped: alreadyWaitingRL ? "already_pending" : "recent_escalation" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const lastCustomer = ordered.filter((m: any) => !m.from_me).slice(-1)[0]?.content || "";
      let sumRL = ""; let doubtRL = "";
      try {
        const briefRaw = await callAi([
          { role: "system", content: `Você analisa uma conversa WhatsApp EMPRESA/CLIENTE e prepara briefing curto pro dono responder. Sem emoji. Retorne APENAS JSON: {"resumo":"1-2 frases sobre o cliente e a dúvida","pergunta":"pergunta objetiva pro dono responder"}` },
          { role: "user", content: `Conversa:\n${transcript}\n\nCliente: ${conv.contact_name || conv.contact_phone}` },
        ]);
        const bp = safe(briefRaw);
        sumRL = stripEmojis(String(bp.resumo || "")).slice(0, 500);
        doubtRL = stripEmojis(String(bp.pergunta || "")).slice(0, 400);
      } catch (_) {}
      if (!sumRL) sumRL = `Cliente ${conv.contact_name || conv.contact_phone} está aguardando resposta.`;
      if (!doubtRL) doubtRL = `Como devo responder? Última mensagem: "${lastCustomer.slice(0,200)}"`;
      const promptForParent = `Preciso da sua orientação pra responder um cliente:\n\nContato: ${conv.contact_name || conv.contact_phone}\n\nSituação: ${sumRL}\n\nÚltima mensagem do cliente: "${lastCustomer.slice(0,200)}"\n\nPergunta: ${doubtRL}\n\nResponda aqui (texto ou áudio) que eu envio pra ele.`;
      const sendRes = await fetch(`${SUPABASE_URL}/functions/v1/whatsapp-api`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` },
        body: JSON.stringify({ action: "send_message", manualTakeover: false, sessionId: cfg.parent_session_id, phone: cfg.parent_phone, message: promptForParent }),
      });
      const sendJson = await sendRes.json().catch(() => ({}));
      const { data: insertedPending } = await admin.from("crm_autopilot_pending_escalations").insert({
        company_id: conv.company_id, conversation_id: conv.id, session_id: conv.session_id,
        customer_phone: conv.contact_phone, question_sent: doubtRL, original_customer_message: lastCustomer,
        parent_message_id: sendJson?.messageId || null, status: "waiting",
        timeout_at: new Date(Date.now() + (cfg.parent_timeout_minutes || 15) * 60000).toISOString(),
      }).select("id").maybeSingle();
      if (insertedPending?.id) scheduleCustomerHoldMessage({ escalationId: insertedPending.id });
      await admin.from("crm_autopilot_events").insert({
        company_id: conv.company_id, conversation_id: conv.id, event_type: "escalated_to_parent",
        description: `Rate limit atingido — escalando pro Pai: ${doubtRL.slice(0, 120)}`, metadata: { rate_limited: true },
      });
      return new Response(JSON.stringify({ escalated: true, reason: "rate_limit_escalate" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    // Bloqueia frases genéricas de espera quando o piloto está respondendo direto
    const fillerPatterns = [
      /estou verificando/i, /vou verificar/i, /vou confirmar/i, /já te confirmo/i,
      /um instante/i, /aguarde um momento/i, /só um momento/i, /vou checar/i,
    ];
    if (fillerPatterns.some((r) => r.test(message))) {
      await admin.from("crm_autopilot_events").insert({
        company_id: conv.company_id, conversation_id: conv.id, event_type: "skipped",
        description: "Resposta genérica bloqueada — escalando para o Pai",
      });
      // Força escalate silencioso com briefing gerado por IA
      if (cfg.parent_phone && cfg.parent_session_id) {
        // GUARD: idem — não duplicar se já pendente ou muito recente
        const { data: alreadyWaiting2 } = await admin.from("crm_autopilot_pending_escalations")
          .select("id").eq("conversation_id", conv.id).in("status", ["waiting", "processing"]).limit(1).maybeSingle();
        const { data: recentEsc2 } = await admin.from("crm_autopilot_pending_escalations")
          .select("created_at").eq("conversation_id", conv.id)
          .in("status", ["waiting", "processing"])
          .order("created_at", { ascending: false }).limit(1).maybeSingle();
        const tooRecent = recentEsc2?.created_at && (Date.now() - new Date(recentEsc2.created_at).getTime()) < 90_000;
        if (alreadyWaiting2 || tooRecent) {
          return new Response(JSON.stringify({ skipped: alreadyWaiting2 ? "already_pending" : "recent_escalation" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
        const lastCustomer = ordered.filter((m: any) => !m.from_me).slice(-1)[0]?.content || "";
        let sum = ""; let doubt = "";
        try {
          const briefRaw = await callAi([
            { role: "system", content: `Você analisa uma conversa WhatsApp EMPRESA/CLIENTE e prepara briefing curto pro dono responder. Sem emoji. Retorne APENAS JSON: {"resumo":"1-2 frases sobre o cliente e a dúvida","pergunta":"pergunta objetiva pro dono responder"}` },
            { role: "user", content: `Conversa:\n${transcript}\n\nCliente: ${conv.contact_name || conv.contact_phone}` },
          ]);
          const bp = safe(briefRaw);
          sum = stripEmojis(String(bp.resumo || "")).slice(0, 500);
          doubt = stripEmojis(String(bp.pergunta || "")).slice(0, 400);
        } catch (_) {}
        if (!sum) sum = `Cliente ${conv.contact_name || conv.contact_phone} está aguardando resposta.`;
        if (!doubt) doubt = `Como devo responder? Última mensagem: "${lastCustomer.slice(0,200)}"`;
        await fetch(`${SUPABASE_URL}/functions/v1/whatsapp-api`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` },
          body: JSON.stringify({ action: "send_message", manualTakeover: false, sessionId: cfg.parent_session_id, phone: cfg.parent_phone,
            message: `Preciso da sua orientação pra responder um cliente:\n\nContato: ${conv.contact_name || conv.contact_phone}\n\nSituação: ${sum}\n\nÚltima mensagem: "${lastCustomer.slice(0,200)}"\n\nPergunta: ${doubt}\n\nResponda aqui que eu envio pra ele.` }),
        }).catch(() => {});
        // registra a escalação também no filler path pra alimentar o guard
        const { data: insertedPending } = await admin.from("crm_autopilot_pending_escalations").insert({
          company_id: conv.company_id,
          conversation_id: conv.id,
          session_id: conv.session_id,
          customer_phone: conv.contact_phone,
          question_sent: doubt,
          original_customer_message: lastCustomer,
          status: "waiting",
          timeout_at: new Date(Date.now() + (cfg.parent_timeout_minutes || 15) * 60000).toISOString(),
        }).select("id").maybeSingle();
        if (insertedPending?.id) scheduleCustomerHoldMessage({ escalationId: insertedPending.id });
      }
      return new Response(JSON.stringify({ escalated: true, reason: "filler_blocked" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (!message) {
      await admin.from("crm_autopilot_events").insert({ company_id: conv.company_id, conversation_id: conv.id, event_type: "skipped", description: "Sem mensagem gerada" });
      return new Response(JSON.stringify({ skipped: "empty" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Dedupe: nunca repetir mensagem igual/quase igual às últimas 5 do piloto
    let outboundsQuery = admin.from("whatsapp_messages")
      .select("content").eq("conversation_id", conv.id).eq("from_me", true)
      .not("content", "is", null).order("timestamp", { ascending: false }).limit(5);
    if (latestInboundTs) outboundsQuery = outboundsQuery.gt("timestamp", latestInboundTs);
    const { data: lastOutbounds } = await outboundsQuery;
    const normNew = normalizeForDedupe(message);
    const isDup = (lastOutbounds || []).some((m: any) => {
      const n = normalizeForDedupe(m.content || "");
      return n && (n === normNew || (n.length > 15 && (n.includes(normNew) || normNew.includes(n))));
    });
    if (isDup) {
      await admin.from("crm_autopilot_events").insert({
        company_id: conv.company_id, conversation_id: conv.id, event_type: "skipped",
        description: "Mensagem duplicada bloqueada", metadata: { message: message.slice(0, 120) },
      });
      return new Response(JSON.stringify({ skipped: "duplicate" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const wantAudio = cfg.allow_audio && cfg.voice_id && cfg.voice_status === "ready" && parsed.want_audio === true && ELEVENLABS_API_KEY;

    if (wantAudio) {
      try {
        const ttsRes = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${cfg.voice_id}?output_format=mp3_44100_128`, {
          method: "POST",
          headers: { "xi-api-key": ELEVENLABS_API_KEY!, "Content-Type": "application/json" },
          body: JSON.stringify({ text: message, model_id: "eleven_multilingual_v2" }),
        });
        if (ttsRes.ok) {
          const buf = await ttsRes.arrayBuffer();
          const b64 = base64Encode(new Uint8Array(buf));
          const sendRes = await fetch(`${SUPABASE_URL}/functions/v1/whatsapp-api`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` },
            body: JSON.stringify({
              action: "send_media", sessionId: conv.session_id, phone: conv.contact_phone,
              conversationId: conv.id, mediaType: "audio", mediaBase64: b64, mimeType: "audio/mpeg",
            }),
          });
          if (sendRes.ok) {
            await admin.from("crm_autopilot_events").insert({
              company_id: conv.company_id, conversation_id: conv.id, event_type: "answered",
              description: `Áudio enviado: ${message.slice(0, 120)}`, metadata: { mode: "audio", confidence },
            });
            return new Response(JSON.stringify({ answered: true, mode: "audio" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
          }
        }
      } catch (e) { console.error("audio send fail", e); }
    }

    // Text
    const sendRes = await fetch(`${SUPABASE_URL}/functions/v1/whatsapp-api`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` },
      body: JSON.stringify({ action: "send_message", manualTakeover: false, sessionId: conv.session_id, phone: conv.contact_phone, message, conversationId: conv.id }),
    });
    if (!sendRes.ok) {
      const t = await sendRes.text();
      await admin.from("crm_autopilot_events").insert({ company_id: conv.company_id, conversation_id: conv.id, event_type: "error", description: `Falha ao enviar: ${t.slice(0, 200)}` });
      return new Response(JSON.stringify({ error: "send_failed", details: t }), { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    await admin.from("crm_autopilot_events").insert({
      company_id: conv.company_id, conversation_id: conv.id, event_type: "answered",
      description: message.slice(0, 200), metadata: { mode: "text", confidence },
    });
    return new Response(JSON.stringify({ answered: true, mode: "text" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    console.error("[crm-autopilot-respond]", err);
    return new Response(JSON.stringify({ error: (err as Error).message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});