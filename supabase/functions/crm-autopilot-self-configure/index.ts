import { createClient } from "npm:@supabase/supabase-js@2";
import { chatCompletion } from '../_shared/llm.ts';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization") || "";
    const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const { companyId } = await req.json();
    if (!companyId) return new Response(JSON.stringify({ error: "companyId required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: membership } = await admin.from("company_users").select("role").eq("company_id", companyId).eq("user_id", user.id).maybeSingle();
    if (!membership) return new Response(JSON.stringify({ error: "forbidden" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    // Pull recent style corpus (up to 200 latest samples)
    const { data: corpus } = await admin
      .from("crm_autopilot_style_corpus")
      .select("content")
      .eq("company_id", companyId)
      .order("created_at", { ascending: false })
      .limit(200);

    let samples = (corpus || []).map((c: any) => String(c.content || "").trim()).filter((s) => s.length > 4);

    // Backfill: if corpus is thin (trigger only collects going forward), read recent outbound WhatsApp messages
    if (samples.length < 20) {
      const { data: convs } = await admin
        .from("whatsapp_conversations")
        .select("id")
        .eq("company_id", companyId)
        .limit(500);
      const convIds = (convs || []).map((c: any) => c.id);
      if (convIds.length) {
        const { data: msgs } = await admin
          .from("whatsapp_messages")
          .select("content")
          .in("conversation_id", convIds)
          .eq("from_me", true)
          .eq("message_type", "text")
          .not("content", "is", null)
          .order("timestamp", { ascending: false })
          .limit(300);
        const extra = (msgs || [])
          .map((m: any) => String(m.content || "").trim())
          .filter((s) => s.length > 4);
        samples = [...samples, ...extra];
      }
    }

    // De-duplicate
    samples = Array.from(new Set(samples)).slice(0, 250);

    if (samples.length < 3) {
      return new Response(JSON.stringify({ error: "not_enough_samples", samples: samples.length }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Basic stats — average length gives a starting point for max_chars
    const avgLen = Math.round(samples.reduce((a, s) => a + s.length, 0) / samples.length);
    const p90 = [...samples.map((s) => s.length)].sort((a, b) => a - b)[Math.floor(samples.length * 0.9)] || avgLen;

    const prompt = `Você é um analista de estilo de escrita. Analise as ${samples.length} mensagens abaixo (todas escritas pelo mesmo usuário no WhatsApp) e retorne SOMENTE um JSON com este formato exato:
{
  "personality": "descrição curta (até 400 chars) de como esta pessoa escreve — tom, uso de emojis, gírias, formalidade, pontuação, saudações típicas",
  "objective": "objetivo provável desta pessoa nas conversas (vender, atender, tirar dúvidas, agendar, etc), até 200 chars",
  "tone_preset": "cordial | vendedor | consultivo | direto | descontraido",
  "max_chars": número inteiro entre 100 e 2000 (tamanho ideal de mensagem baseado nas amostras),
  "avg_msgs_per_turn": número decimal 1 a 4 (quantas mensagens curtas ela costuma mandar em sequência),
  "writing_style_summary": "1-2 frases resumindo o estilo",
  "learned_prompt": "SYSTEM PROMPT completo em português (até 1500 chars) para uma IA imitar exatamente este estilo, incluindo regras de tom, formatação, emojis, uso de nome do cliente, saudações e despedidas típicas. Escreva em segunda pessoa: 'Você deve...'"
}

Retorne APENAS JSON, sem markdown, sem comentários.

MENSAGENS:
${samples.slice(0, 120).map((s, i) => `${i + 1}. ${s.slice(0, 400)}`).join("\n")}`;

    const aiRes = await chatCompletion({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: "Você é um assistente que responde apenas com JSON válido." },
        { role: "user", content: prompt },
      ],
      response_format: { type: "json_object" },
    });

    if (!aiRes.ok) {
      const txt = await aiRes.text();
      return new Response(JSON.stringify({ error: "ai_failed", detail: txt }), { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const aiJson = await aiRes.json();
    let parsed: any = {};
    try {
      parsed = JSON.parse(aiJson.choices?.[0]?.message?.content || "{}");
    } catch {
      parsed = {};
    }

    const patch: Record<string, unknown> = {
      personality: String(parsed.personality || "").slice(0, 2000) || null,
      objective: String(parsed.objective || "").slice(0, 1000) || null,
      tone_preset: ["cordial", "vendedor", "consultivo", "direto", "descontraido"].includes(parsed.tone_preset) ? parsed.tone_preset : "cordial",
      max_chars: Math.min(2000, Math.max(100, Number(parsed.max_chars) || Math.min(1200, Math.max(200, p90)))),
      avg_msgs_per_turn: Math.min(4, Math.max(1, Number(parsed.avg_msgs_per_turn) || 1)),
      writing_style_summary: String(parsed.writing_style_summary || "").slice(0, 500) || null,
      learned_prompt: String(parsed.learned_prompt || "").slice(0, 4000) || null,
      last_self_config_at: new Date().toISOString(),
    };

    const { data: existing } = await admin.from("crm_autopilot_configs").select("id").eq("company_id", companyId).maybeSingle();
    if (existing) {
      const { error } = await admin.from("crm_autopilot_configs").update(patch).eq("company_id", companyId);
      if (error) throw error;
    } else {
      const { error } = await admin.from("crm_autopilot_configs").insert({ company_id: companyId, ...patch });
      if (error) throw error;
    }

    await admin.from("crm_autopilot_events").insert({
      company_id: companyId,
      event_type: "autopilot_self_configured",
      description: `Auto-configuração concluída (baseada em ${samples.length} amostras)`,
      metadata: { samples: samples.length, avg_len: avgLen, p90 },
    });

    return new Response(JSON.stringify({ ok: true, applied: patch, samples: samples.length }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    console.error("[crm-autopilot-self-configure]", err);
    return new Response(JSON.stringify({ error: (err as Error).message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});