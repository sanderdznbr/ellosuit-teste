import { createClient } from "npm:@supabase/supabase-js@2";
import { chatCompletion } from '../_shared/llm.ts';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

type Suggestion = {
  kind: "retomada" | "cobranca" | "satisfacao" | "lembrete" | "reengajamento" | "outro";
  reason: string;
  message: string;
  delay_hours: number;
};

const SYSTEM_PROMPT = `Voce e um analista de vendas brasileiro. Recebe a transcricao de uma conversa de WhatsApp entre uma empresa e um cliente e precisa sugerir ate 3 follow-ups inteligentes para reabrir, qualificar ou encerrar a venda.

Regras:
- Tom humanizado, em portugues do Brasil, na mesma vibe da conversa.
- NUNCA cite nomes de plataformas, marcas internas ou que voce e uma IA.
- Cada follow-up deve ter um motivo claro, uma mensagem pronta para enviar e um intervalo em horas a partir de agora.
- Tipos validos: retomada, cobranca, satisfacao, lembrete, reengajamento, outro.
- Se o cliente JA respondeu recentemente e a conversa esta ativa, retorne lista vazia.
- Se a venda foi finalizada, prefira "satisfacao" entre 24h e 72h.
- Se cliente sumiu apos pedir preco/proposta, prefira "cobranca" ou "retomada" entre 24h e 96h.
- Mensagens curtas (max 2 paragrafos, sem emojis exagerados).

Responda APENAS um JSON valido no formato:
{"suggestions":[{"kind":"...","reason":"...","message":"...","delay_hours": 24}]}
Nada antes ou depois do JSON.`;

async function fetchAi(messages: Array<{ role: string; content: string }>) {
  if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY missing");
  const res = await chatCompletion({
      model: "google/gemini-2.5-flash",
      messages,
      response_format: { type: "json_object" },
    });
  if (res.status === 402) throw new Error("ai_credits_exhausted");
  if (res.status === 429) throw new Error("ai_rate_limited");
  if (!res.ok) throw new Error(`ai_error_${res.status}: ${await res.text()}`);
  const data = await res.json();
  return data?.choices?.[0]?.message?.content ?? "";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization") || "";
    const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { conversationId } = await req.json();
    if (!conversationId || typeof conversationId !== "string") {
      return new Response(JSON.stringify({ error: "conversationId required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: conv, error: convErr } = await admin
      .from("whatsapp_conversations")
      .select("id, company_id, session_id, contact_name, contact_phone, pipeline_stage, human_takeover, last_message_at")
      .eq("id", conversationId)
      .maybeSingle();
    if (convErr || !conv) {
      return new Response(JSON.stringify({ error: "conversation_not_found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Authorization: same company
    const { data: membership } = await admin
      .from("company_users")
      .select("user_id")
      .eq("company_id", conv.company_id)
      .eq("user_id", user.id)
      .maybeSingle();
    if (!membership) {
      return new Response(JSON.stringify({ error: "forbidden" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: messages } = await admin
      .from("whatsapp_messages")
      .select("from_me, content, created_at, message_type")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: false })
      .limit(50);

    const ordered = (messages ?? []).slice().reverse();
    if (ordered.length === 0) {
      return new Response(JSON.stringify({ suggestions: [], saved: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const transcript = ordered
      .map((m: any) => {
        const who = m.from_me ? "EMPRESA" : "CLIENTE";
        const when = new Date(m.created_at).toLocaleString("pt-BR");
        const body = m.content || `[${m.message_type || "mídia"}]`;
        return `[${when}] ${who}: ${body}`;
      })
      .join("\n");

    const lastMsg = ordered[ordered.length - 1];
    const lastMsgAt = new Date(lastMsg.created_at);
    const hoursSinceLast = (Date.now() - lastMsgAt.getTime()) / 36e5;

    const userPrompt = `Contexto:
- Cliente: ${conv.contact_name || conv.contact_phone}
- Estagio atual no funil: ${conv.pipeline_stage || "novo"}
- Ultima mensagem foi ha ${hoursSinceLast.toFixed(1)} horas (${lastMsg.from_me ? "empresa" : "cliente"})
- Conversa em takeover humano? ${conv.human_takeover ? "sim" : "nao"}

Transcricao (cronologica):
${transcript}

Sugira ate 3 follow-ups. Se nao fizer sentido, retorne {"suggestions": []}.`;

    let raw: string;
    try {
      raw = await fetchAi([
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ]);
    } catch (err) {
      const msg = (err as Error).message;
      const status = msg === "ai_credits_exhausted" ? 402 : msg === "ai_rate_limited" ? 429 : 500;
      return new Response(JSON.stringify({ error: msg }), {
        status, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let parsed: { suggestions?: Suggestion[] } = {};
    try {
      const cleaned = raw.replace(/^```json\s*/i, "").replace(/```$/i, "").trim();
      parsed = JSON.parse(cleaned);
    } catch {
      parsed = { suggestions: [] };
    }

    const VALID_KINDS = new Set(["retomada", "cobranca", "satisfacao", "lembrete", "reengajamento", "outro"]);
    const suggestions: Suggestion[] = Array.isArray(parsed.suggestions)
      ? parsed.suggestions
          .filter((s) => s && typeof s.message === "string" && s.message.trim().length > 0)
          .map((s) => ({
            kind: VALID_KINDS.has(s.kind as string) ? s.kind : "outro",
            reason: typeof s.reason === "string" ? s.reason.slice(0, 500) : "",
            message: s.message.slice(0, 1500).trim(),
            delay_hours: Math.min(Math.max(Number(s.delay_hours) || 24, 1), 24 * 30),
          }))
          .slice(0, 3)
      : [];

    if (suggestions.length === 0) {
      return new Response(JSON.stringify({ suggestions: [], saved: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const rows = suggestions.map((s) => ({
      company_id: conv.company_id,
      conversation_id: conv.id,
      session_id: conv.session_id,
      created_by: user.id,
      status: "suggested",
      kind: s.kind,
      reason: s.reason,
      message: s.message,
      scheduled_for: new Date(Date.now() + s.delay_hours * 36e5).toISOString(),
      ai_model: "google/gemini-2.5-flash",
    }));

    const { data: inserted, error: insErr } = await admin
      .from("crm_followups")
      .insert(rows)
      .select("*");

    if (insErr) {
      return new Response(JSON.stringify({ error: insErr.message }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ suggestions, saved: inserted ?? [] }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[crm-followup-suggest] error", err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});