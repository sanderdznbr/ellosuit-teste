import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Brazilian business hours: 08:00 - 20:00 in America/Sao_Paulo (UTC-3).
// Avoids waking people up at dawn.
function isBusinessHourBR(d: Date): boolean {
  const hourBR = (d.getUTCHours() - 3 + 24) % 24;
  const dow = new Date(d.getTime() - 3 * 36e5).getUTCDay(); // 0=Sun
  if (dow === 0) return false; // skip Sunday
  return hourBR >= 8 && hourBR < 20;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const now = new Date();
  const results: any[] = [];

  try {
    const { data: due, error } = await admin
      .from("crm_followups")
      .select("*")
      .eq("status", "approved")
      .lte("scheduled_for", now.toISOString())
      .order("scheduled_for", { ascending: true })
      .limit(50);

    if (error) throw error;
    if (!due || due.length === 0) {
      return new Response(JSON.stringify({ processed: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    for (const f of due) {
      try {
        // Respect business hours when requested. Reschedule to next 08:00 BR.
        if (f.respect_business_hours && !isBusinessHourBR(now)) {
          const next = new Date(now);
          const hourBR = (next.getUTCHours() - 3 + 24) % 24;
          if (hourBR < 8) next.setUTCHours(11, 0, 0, 0); // 08:00 BR
          else next.setUTCDate(next.getUTCDate() + 1), next.setUTCHours(11, 0, 0, 0);
          await admin.from("crm_followups").update({ scheduled_for: next.toISOString() }).eq("id", f.id);
          results.push({ id: f.id, action: "rescheduled_business_hours", next });
          continue;
        }

        const { data: conv } = await admin
          .from("whatsapp_conversations")
          .select("id, contact_phone, session_id, human_takeover, company_id")
          .eq("id", f.conversation_id)
          .maybeSingle();

        if (!conv) {
          await admin.from("crm_followups").update({
            status: "canceled", canceled_at: now.toISOString(),
            canceled_reason: "Conversa nao encontrada",
          }).eq("id", f.id);
          results.push({ id: f.id, action: "canceled_no_conv" });
          continue;
        }

        // Auto-cancel if the customer replied after approval.
        if (f.auto_cancel_if_replied && f.approved_at) {
          const { data: replies } = await admin
            .from("whatsapp_messages")
            .select("id")
            .eq("conversation_id", f.conversation_id)
            .eq("from_me", false)
            .gt("created_at", f.approved_at)
            .limit(1);
          if (replies && replies.length > 0) {
            await admin.from("crm_followups").update({
              status: "canceled", canceled_at: now.toISOString(),
              canceled_reason: "Cliente respondeu antes do envio agendado",
            }).eq("id", f.id);
            await admin.from("conversation_events").insert({
              conversation_id: f.conversation_id,
              company_id: f.company_id,
              event_type: "followup_canceled",
              description: `Follow-up "${f.kind}" cancelado porque o cliente respondeu.`,
              metadata: { followup_id: f.id },
            });
            results.push({ id: f.id, action: "canceled_replied" });
            continue;
          }
        }

        // Hold while a human is handling the conversation.
        if (conv.human_takeover) {
          const next = new Date(now.getTime() + 60 * 60 * 1000); // try again in 1h
          await admin.from("crm_followups").update({ scheduled_for: next.toISOString() }).eq("id", f.id);
          results.push({ id: f.id, action: "postponed_takeover" });
          continue;
        }

        const sessionId = f.session_id || conv.session_id;
        if (!sessionId || !conv.contact_phone) {
          await admin.from("crm_followups").update({
            status: "failed", last_error: "missing_session_or_phone",
          }).eq("id", f.id);
          results.push({ id: f.id, action: "failed_missing" });
          continue;
        }

        const sendRes = await fetch(`${SUPABASE_URL}/functions/v1/whatsapp-api`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          },
          body: JSON.stringify({
            action: "send_message",
            sessionId,
            phone: conv.contact_phone,
            message: f.message,
            conversationId: conv.id,
          }),
        });

        if (!sendRes.ok) {
          const txt = await sendRes.text();
          await admin.from("crm_followups").update({
            status: "failed", last_error: `whatsapp-api ${sendRes.status}: ${txt.slice(0, 300)}`,
          }).eq("id", f.id);
          results.push({ id: f.id, action: "failed_send", status: sendRes.status });
          continue;
        }

        await admin.from("crm_followups").update({
          status: "sent", sent_at: now.toISOString(),
        }).eq("id", f.id);

        await admin.from("conversation_events").insert({
          conversation_id: conv.id,
          company_id: f.company_id,
          event_type: "followup_sent",
          description: `Follow-up automatico "${f.kind}" enviado.`,
          metadata: { followup_id: f.id, kind: f.kind },
        });

        results.push({ id: f.id, action: "sent" });
      } catch (innerErr) {
        console.error("[dispatch] item error", f.id, innerErr);
        await admin.from("crm_followups").update({
          status: "failed", last_error: (innerErr as Error).message,
        }).eq("id", f.id);
        results.push({ id: f.id, action: "exception", error: (innerErr as Error).message });
      }
    }

    return new Response(JSON.stringify({ processed: due.length, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[crm-followup-dispatch] error", err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});