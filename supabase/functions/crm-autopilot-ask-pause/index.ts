import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { conversationId } = await req.json();
    if (!conversationId) {
      return new Response(JSON.stringify({ error: "conversationId required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: conv } = await admin.from("whatsapp_conversations")
      .select("id, company_id, contact_name, contact_phone, human_takeover, human_takeover_reason")
      .eq("id", conversationId).maybeSingle();
    if (!conv?.company_id) return new Response(JSON.stringify({ skipped: "no_conv" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    if (!conv.human_takeover) return new Response(JSON.stringify({ skipped: "no_takeover" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const { data: cfg } = await admin.from("crm_autopilot_configs")
      .select("id, is_active, parent_phone, parent_session_id, metadata")
      .eq("company_id", conv.company_id).maybeSingle();
    if (!cfg?.is_active || !cfg.parent_phone || !cfg.parent_session_id) {
      return new Response(JSON.stringify({ skipped: "autopilot_inactive" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Não perguntar se a própria conversa alvo é o número do Pai
    const parentDigits = String(cfg.parent_phone || "").replace(/\D/g, "");
    const convDigits = String(conv.contact_phone || "").replace(/\D/g, "");
    if (parentDigits && parentDigits === convDigits) {
      return new Response(JSON.stringify({ skipped: "target_is_parent" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const meta = (cfg.metadata as Record<string, any>) || {};
    const pending = meta.pending_pause_prompt as { conversation_id?: string } | undefined;
    if (pending?.conversation_id) {
      return new Response(JSON.stringify({ skipped: "already_pending", pending_conv: pending.conversation_id }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const history = (meta.pause_prompt_history || {}) as Record<string, string>;
    const recent = history[conversationId];
    if (recent) {
      const t = new Date(recent).getTime();
      if (Number.isFinite(t) && Date.now() - t < 6 * 60 * 60 * 1000) {
        return new Response(JSON.stringify({ skipped: "recent", at: recent }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    const contactName = conv.contact_name || conv.contact_phone || "esse cliente";
    const msg = `Vi que você respondeu direto pra ${contactName}.\n\nQuer que eu:\n1 - pause o Piloto SÓ nessa conversa\n2 - pause o Piloto em TODAS as conversas\n\nResponde só "1" ou "2".`;

    const askedAt = new Date().toISOString();
    await admin.from("crm_autopilot_configs").update({
      metadata: {
        ...meta,
        pending_pause_prompt: { conversation_id: conversationId, contact_name: contactName, asked_at: askedAt },
        pause_prompt_history: { ...history, [conversationId]: askedAt },
      },
    }).eq("id", cfg.id);

    // Registra o evento imediatamente pra garantir SLA <5s no gatilho.
    await admin.from("crm_autopilot_events").insert({
      company_id: conv.company_id,
      conversation_id: conversationId,
      event_type: "pause_prompt_sent",
      description: `Perguntado ao Pai se deve pausar Piloto (só essa conversa ou todas) após intervenção humana em ${contactName}`,
      metadata: { dispatch: "background" },
    });

    // Dispara o envio pro WhatsApp em background — não bloqueia a resposta HTTP.
    const sendPromise = fetch(`${SUPABASE_URL}/functions/v1/whatsapp-api`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` },
      body: JSON.stringify({ action: "send_message", manualTakeover: false, sessionId: cfg.parent_session_id, phone: cfg.parent_phone, message: msg }),
    }).then(async (r) => {
      const ok = r.ok;
      await r.text().catch(() => "");
      if (!ok) console.warn("[ask-pause] whatsapp-api returned non-ok");
    }).catch((err) => console.warn("[ask-pause] whatsapp-api send failed:", err));

    // @ts-ignore — EdgeRuntime available in Supabase Edge Functions
    if (typeof EdgeRuntime !== "undefined" && (EdgeRuntime as any).waitUntil) {
      // @ts-ignore
      (EdgeRuntime as any).waitUntil(sendPromise);
    }

    return new Response(JSON.stringify({ ok: true, dispatched: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[crm-autopilot-ask-pause]", err);
    return new Response(JSON.stringify({ error: (err as Error).message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});