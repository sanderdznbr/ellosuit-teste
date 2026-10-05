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
    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const now = new Date().toISOString();

    // ============================================================
    // STEP 1 — Interim "hold" message
    // If the parent hasn't replied within 5 minutes, send the customer
    // a natural "aguarde só um momento" message so they aren't left in silence.
    // Send it AT MOST ONCE per escalation (tracked via metadata.hold_sent).
    // ============================================================
    const HOLD_AFTER_MS = 5 * 60 * 1000;
    const holdCutoff = new Date(Date.now() - HOLD_AFTER_MS).toISOString();
    const { data: needHold } = await admin
      .from("crm_autopilot_pending_escalations")
      .select("*")
      .eq("status", "waiting")
      .lte("created_at", holdCutoff)
      .gt("timeout_at", now)
      .limit(50);
    let holdsSent = 0;
    for (const p of needHold || []) {
      const meta = (p.metadata as Record<string, unknown>) || {};
      if (meta.hold_sent) continue;
      const { data: conv } = await admin.from("whatsapp_conversations")
        .select("session_id, contact_phone, contact_name").eq("id", p.conversation_id).maybeSingle();
      if (!conv?.session_id || !conv?.contact_phone) continue;
      const holdMsgs = [
        "Só um momento, estou verificando isso pra te dar uma resposta certa.",
        "Já já te retorno, estou confirmando um detalhe aqui.",
        "Aguarde só um instante enquanto confirmo essa informação pra você.",
      ];
      const message = holdMsgs[Math.floor(Math.random() * holdMsgs.length)];
      await fetch(`${SUPABASE_URL}/functions/v1/whatsapp-api`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` },
        body: JSON.stringify({
          action: "send_message", manualTakeover: false,
          sessionId: conv.session_id,
          phone: conv.contact_phone,
          conversationId: p.conversation_id,
          message,
        }),
      }).catch(() => {});
      await admin.from("crm_autopilot_pending_escalations")
        .update({ metadata: { ...meta, hold_sent: true, hold_sent_at: new Date().toISOString() } })
        .eq("id", p.id);
      await admin.from("crm_autopilot_events").insert({
        company_id: p.company_id,
        conversation_id: p.conversation_id,
        event_type: "hold_message_sent",
        description: "Enviado 'aguarde um momento' ao cliente enquanto Pai não responde",
        metadata: { escalation_id: p.id, message },
      });
      holdsSent++;
    }

    // ============================================================
    // STEP 2 — Timeout handling (unchanged behavior)
    // ============================================================
    const { data: expired } = await admin.from("crm_autopilot_pending_escalations")
      .select("*").eq("status", "waiting").lte("timeout_at", now).limit(50);
    let processed = 0;
    for (const p of expired || []) {
      const { data: cfg } = await admin.from("crm_autopilot_configs").select("parent_fallback_behavior").eq("company_id", p.company_id).maybeSingle();
      await admin.from("crm_autopilot_pending_escalations").update({ status: "timeout" }).eq("id", p.id);
      if (cfg?.parent_fallback_behavior === "answer_anyway") {
        const { data: conv } = await admin.from("whatsapp_conversations").select("session_id, contact_phone").eq("id", p.conversation_id).maybeSingle();
        if (conv?.session_id && conv?.contact_phone) {
          await fetch(`${SUPABASE_URL}/functions/v1/whatsapp-api`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` },
            body: JSON.stringify({ action: "send_message", manualTakeover: false, sessionId: conv.session_id, phone: conv.contact_phone, conversationId: p.conversation_id,
              message: "Oi! Ainda estou confirmando um detalhe aqui e te retorno em breve." }),
          });
        }
      }
      await admin.from("crm_autopilot_events").insert({
        company_id: p.company_id, conversation_id: p.conversation_id, event_type: "parent_timeout",
        description: "Número Pai não respondeu no tempo configurado", metadata: { escalation_id: p.id, fallback: cfg?.parent_fallback_behavior },
      });
      processed++;
    }
    return new Response(JSON.stringify({ processed, holdsSent }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});