import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

type Candidate = {
  conversation_id: string;
  contact_name: string;
  contact_phone: string;
  session_id: string | null;
  last_message_at: string | null;
  reason: string;
  interest_score: number; // 0-100
  suggested_message: string;
};

async function callAi(messages: any[], schemaName = "response") {
  if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY missing");
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Lovable-API-Key": LOVABLE_API_KEY,
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages,
      response_format: { type: "json_object" },
    }),
  });
  if (res.status === 402) throw new Error("ai_credits_exhausted");
  if (res.status === 429) throw new Error("ai_rate_limited");
  if (!res.ok) throw new Error(`ai_error_${res.status}: ${await res.text()}`);
  const data = await res.json();
  return data?.choices?.[0]?.message?.content ?? "";
}

function safeParse(raw: string): any {
  try {
    const cleaned = raw.replace(/^```json\s*/i, "").replace(/```$/i, "").trim();
    return JSON.parse(cleaned);
  } catch {
    return {};
  }
}

async function authorize(req: Request) {
  const authHeader = req.headers.get("Authorization") || "";
  const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user } } = await userClient.auth.getUser();
  return user;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const user = await authorize(req);
    if (!user) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const action = body.action as string;
    const companyId = body.companyId as string;
    if (!companyId) {
      return new Response(JSON.stringify({ error: "companyId required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: membership } = await admin
      .from("company_users")
      .select("user_id")
      .eq("company_id", companyId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (!membership) {
      return new Response(JSON.stringify({ error: "forbidden" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ---------- AUTO: IA cria as ideias de recuperacao sozinha ----------
    if (action === "ideas") {
      const daysBack = 60;
      const minSilenceHours = 24;
      const since = new Date(Date.now() - daysBack * 24 * 36e5).toISOString();
      const cutoff = new Date(Date.now() - minSilenceHours * 36e5).toISOString();

      const { data: convs, error: convErr } = await admin
        .from("whatsapp_conversations")
        .select("id, contact_name, contact_phone, last_message_at, pipeline_stage")
        .eq("company_id", companyId)
        .gte("last_message_at", since)
        .lte("last_message_at", cutoff)
        .order("last_message_at", { ascending: false })
        .limit(60);
      if (convErr) throw convErr;

      const sample = (convs ?? []).slice(0, 20);
      const digests: string[] = [];
      for (const c of sample) {
        const { data: msgs } = await admin
          .from("whatsapp_messages")
          .select("from_me, content, message_type, timestamp")
          .eq("conversation_id", c.id)
          .order("timestamp", { ascending: false })
          .limit(8);
        const ordered = (msgs ?? []).slice().reverse();
        if (ordered.length < 2) continue;
        digests.push(
          `--- ${c.contact_name || c.contact_phone} (etapa: ${c.pipeline_stage || "n/d"})\n` +
            ordered
              .map((m: any) => `${m.from_me ? "EMPRESA" : "CLIENTE"}: ${(m.content || `[${m.message_type || "midia"}]`).slice(0, 200)}`)
              .join("\n"),
        );
      }

      if (digests.length === 0) {
        return new Response(JSON.stringify({ ideas: [], analyzed: 0, pool: convs?.length ?? 0 }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const raw = await callAi([
        {
          role: "system",
          content:
            `Voce e um estrategista de vendas B2C brasileiro. Recebe amostras reais de conversas de WhatsApp que pararam sem fechamento. Sua tarefa: criar de 3 a 4 IDEIAS/CAMPANHAS de recuperacao de clientes, cada uma com um angulo diferente (ex: duvida de preco, sumiu apos orcamento, pediu pra pensar, interesse em produto especifico). Nao mencione plataformas, marcas internas nem que voce e IA. Portugues do Brasil. Retorne APENAS JSON no formato: {"ideas":[{"title":"...","angle":"...","why":"...","target":"...","product":"...","offer":"...","goal":"...","tone":"...","extra":"...","estimated_leads":0}]}. "why" explica por que essa ideia faz sentido com base nas conversas. Os campos product/offer/goal/tone/extra serao usados como briefing automatico para gerar as mensagens.`,
        },
        {
          role: "user",
          content: `AMOSTRA DE CONVERSAS PARADAS (${digests.length} de ${convs?.length ?? 0}):\n\n${digests.join("\n\n")}`,
        },
      ]);
      const parsed = safeParse(raw);
      const ideas = Array.isArray(parsed?.ideas) ? parsed.ideas.slice(0, 4) : [];
      return new Response(JSON.stringify({ ideas, analyzed: digests.length, pool: convs?.length ?? 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "scan") {
      const mode = (body.mode as "campaign" | "sweep") || "sweep";
      const campaign = body.campaign as {
        product?: string;
        offer?: string;
        goal?: string;
        tone?: string;
        extra?: string;
      } | undefined;
      const daysBack = Math.min(Math.max(Number(body.daysBack) || 30, 1), 180);
      const maxConversations = Math.min(Math.max(Number(body.maxConversations) || 40, 5), 80);
      const minSilenceHours = Math.min(Math.max(Number(body.minSilenceHours) || 24, 1), 24 * 30);

      // Fetch candidate conversations: last activity within window, and last message from customer OR silence gap
      const since = new Date(Date.now() - daysBack * 24 * 36e5).toISOString();
      const cutoff = new Date(Date.now() - minSilenceHours * 36e5).toISOString();

      const { data: convs, error: convErr } = await admin
        .from("whatsapp_conversations")
        .select("id, contact_name, contact_phone, session_id, last_message_at, pipeline_stage, human_takeover")
        .eq("company_id", companyId)
        .gte("last_message_at", since)
        .lte("last_message_at", cutoff)
        .order("last_message_at", { ascending: false })
        .limit(maxConversations);
      if (convErr) throw convErr;
      if (!convs || convs.length === 0) {
        return new Response(JSON.stringify({ candidates: [], scanned: 0 }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // For each conversation, pull last 25 messages
      const candidates: Candidate[] = [];
      for (const c of convs) {
        const { data: msgs } = await admin
          .from("whatsapp_messages")
          .select("from_me, content, timestamp, created_at, message_type")
          .eq("conversation_id", c.id)
          .order("timestamp", { ascending: false })
          .limit(25);
        const ordered = (msgs ?? []).slice().reverse();
        if (ordered.length < 2) continue;

        const transcript = ordered.map((m: any) => {
          const who = m.from_me ? "EMPRESA" : "CLIENTE";
          const body = (m.content || `[${m.message_type || "midia"}]`).slice(0, 400);
          return `${who}: ${body}`;
        }).join("\n");

        const systemPrompt = mode === "campaign"
          ? `Voce e um analista de vendas B2C brasileiro. Recebe uma conversa de WhatsApp e uma OFERTA/CAMPANHA para lancar. Sua tarefa: decidir se este cliente demonstrou interesse (mesmo que indireto) que se conecta com a oferta, e criar uma mensagem HUMANIZADA para reengaja-lo com a oferta. Nao mencione plataformas, marcas internas nem que voce e IA. Escreva em portugues do Brasil, curto (max 2 paragrafos), sem emojis exagerados. Retorne APENAS JSON: {"is_candidate":true|false,"interest_score":0-100,"reason":"...","suggested_message":"..."}. Se nao houver conexao com a oferta ou o cliente ja fechou/rejeitou, retorne is_candidate:false.`
          : `Voce e um analista de vendas brasileiro. Recebe uma conversa de WhatsApp que nao teve tomada de decisao (cliente parou de responder, ficou em duvida, ou empresa parou de responder). Identifique o MOTIVO da parada e sugira uma mensagem HUMANIZADA para reativar a venda do que estava sendo conversado. Nao mencione plataformas, marcas internas ou que voce e IA. Portugues do Brasil, curto (max 2 paragrafos). Retorne APENAS JSON: {"is_candidate":true|false,"interest_score":0-100,"reason":"...","suggested_message":"..."}. Se a venda ja foi fechada, cancelada ou nao ha o que recuperar, retorne is_candidate:false.`;

        const userPrompt = mode === "campaign"
          ? `OFERTA/CAMPANHA:
Produto: ${campaign?.product || "(nao informado)"}
Oferta: ${campaign?.offer || "(nao informado)"}
Objetivo: ${campaign?.goal || "reengajar e vender"}
Tom desejado: ${campaign?.tone || "cordial e direto"}
Instrucoes extras: ${campaign?.extra || "(nenhuma)"}

CONVERSA (cronologica):
${transcript}`
          : `CONVERSA (cronologica):
${transcript}

Instrucoes extras do usuario para a mensagem de recuperacao: ${body.customInstruction || "(nenhuma)"}`;

        try {
          const raw = await callAi([
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ]);
          const parsed = safeParse(raw);
          if (parsed?.is_candidate && typeof parsed.suggested_message === "string" && parsed.suggested_message.trim().length > 5) {
            candidates.push({
              conversation_id: c.id,
              contact_name: c.contact_name || c.contact_phone,
              contact_phone: c.contact_phone,
              session_id: c.session_id,
              last_message_at: c.last_message_at,
              reason: String(parsed.reason || "").slice(0, 400),
              interest_score: Math.max(0, Math.min(100, Number(parsed.interest_score) || 50)),
              suggested_message: parsed.suggested_message.slice(0, 1500).trim(),
            });
          }
        } catch (err) {
          const m = (err as Error).message;
          if (m === "ai_credits_exhausted" || m === "ai_rate_limited") {
            return new Response(JSON.stringify({ error: m, partial: candidates }), {
              status: m === "ai_credits_exhausted" ? 402 : 429,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }
          console.error("[lead-recovery] scan item error", c.id, err);
        }
      }

      candidates.sort((a, b) => b.interest_score - a.interest_score);
      return new Response(JSON.stringify({
        candidates,
        scanned: convs.length,
        mode,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "approve") {
      const items = body.items as Array<{
        conversation_id: string;
        session_id: string | null;
        message: string;
        reason?: string;
      }>;
      const scheduleInHours = Math.min(Math.max(Number(body.scheduleInHours) || 0, 0), 24 * 30);
      const respectBusinessHours = body.respectBusinessHours !== false;
      if (!Array.isArray(items) || items.length === 0) {
        return new Response(JSON.stringify({ error: "items required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const now = Date.now();
      const scheduled = new Date(now + scheduleInHours * 36e5).toISOString();
      const rows = items
        .filter((it) => it && it.conversation_id && typeof it.message === "string" && it.message.trim().length > 0)
        .slice(0, 200)
        .map((it) => ({
          company_id: companyId,
          conversation_id: it.conversation_id,
          session_id: it.session_id,
          created_by: user.id,
          approved_by: user.id,
          approved_at: new Date().toISOString(),
          status: "approved",
          kind: "reengajamento",
          reason: (it.reason || "Recuperacao de lead").slice(0, 500),
          message: it.message.slice(0, 1500).trim(),
          scheduled_for: scheduled,
          respect_business_hours: respectBusinessHours,
          auto_cancel_if_replied: true,
          ai_model: "google/gemini-2.5-flash",
          metadata: { source: "lead_recovery" },
        }));

      const { data: inserted, error: insErr } = await admin
        .from("crm_followups")
        .insert(rows)
        .select("id, conversation_id, scheduled_for");
      if (insErr) throw insErr;

      // Trigger dispatch immediately (respects business hours inside)
      fetch(`${SUPABASE_URL}/functions/v1/crm-followup-dispatch`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        },
        body: JSON.stringify({ trigger: "lead_recovery" }),
      }).catch(() => {});

      return new Response(JSON.stringify({ approved: inserted?.length ?? 0, followups: inserted }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "unknown_action" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[crm-lead-recovery] error", err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});