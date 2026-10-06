import { createClient } from "npm:@supabase/supabase-js@2";
import { chatCompletion } from '../_shared/llm.ts';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ELEVENLABS_API_KEY = Deno.env.get("ELEVENLABS_API_KEY");

async function callAi(messages: any[]) {
  const r = await chatCompletion({ model: "google/gemini-2.5-flash", messages, response_format: { type: "json_object" } });
  if (!r.ok) throw new Error(`ai_${r.status}: ${await r.text()}`);
  const j = await r.json();
  return j?.choices?.[0]?.message?.content || "";
}

async function transcribeAudio(url: string): Promise<string> {
  if (!ELEVENLABS_API_KEY) return "";
  try {
    const audio = await fetch(url);
    const blob = await audio.blob();
    const form = new FormData();
    form.append("file", new File([blob], "voice.ogg", { type: blob.type || "audio/ogg" }));
    form.append("model_id", "scribe_v2");
    form.append("language_code", "por");
    const r = await fetch("https://api.elevenlabs.io/v1/speech-to-text", {
      method: "POST", headers: { "xi-api-key": ELEVENLABS_API_KEY }, body: form,
    });
    if (!r.ok) return "";
    const j = await r.json();
    return j.text || "";
  } catch { return ""; }
}

function stripEmojis(s: string): string {
  if (!s) return s;
  return s
    .replace(/[\u{1F1E6}-\u{1F1FF}\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{1F000}-\u{1F02F}\u{1F0A0}-\u{1F0FF}\u{1F100}-\u{1F1FF}\u{1F200}-\u{1F2FF}\u{1F300}-\u{1F5FF}\u{1F600}-\u{1F64F}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{FE0F}\u{200D}]/gu, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function onlyDigits(value: unknown): string {
  return String(value || "").replace(/\D/g, "");
}

function phoneVariants(value: unknown): string[] {
  const digits = onlyDigits(value);
  const variants = new Set<string>();
  if (digits) variants.add(digits);
  if (digits.startsWith("55") && digits.length === 13) variants.add(digits.slice(0, 4) + digits.slice(5));
  else if (digits.startsWith("55") && digits.length === 12) variants.add(digits.slice(0, 4) + "9" + digits.slice(4));
  return Array.from(variants);
}

function phonesMatch(a: unknown, b: unknown): boolean {
  const aSet = new Set(phoneVariants(a));
  return phoneVariants(b).some((v) => aSet.has(v));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  let claimedPendingId: string | null = null;
  try {
    const { companyId, parentPhone, messageContent, messageType, mediaUrl } = await req.json();
    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: cfg } = await admin.from("crm_autopilot_configs").select("*")
      .eq("company_id", companyId).eq("parent_phone", parentPhone).maybeSingle();
    if (!cfg || !cfg.is_active) return new Response(JSON.stringify({ skipped: "no_config" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

    // ==================== PAUSE PROMPT SHORT-CIRCUIT ====================
    // Se há uma pergunta pendente "pausa só essa conversa ou todas?" e o Pai responde 1/2,
    // trata aqui antes do fluxo normal de escalonamento.
    const cfgMeta = (cfg.metadata as Record<string, any>) || {};
    const pendingPause = cfgMeta.pending_pause_prompt as { conversation_id?: string; contact_name?: string } | undefined;
    if (pendingPause?.conversation_id) {
      const raw = String(messageContent || "").trim();
      const normalized = raw.toLowerCase()
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
      let choice: 1 | 2 | null = null;
      if (/^1\b/.test(normalized) || /\bso ess[ae]\b/.test(normalized) || /\bsomente ess[ae]\b/.test(normalized) || /\bapenas ess[ae]\b/.test(normalized)) choice = 1;
      else if (/^2\b/.test(normalized) || /\btod[ao]s\b/.test(normalized) || /\bpausa tudo\b/.test(normalized) || /\bpiloto todo\b/.test(normalized) || /\bpiloto inteiro\b/.test(normalized)) choice = 2;

      if (choice !== null) {
        const newMeta = { ...cfgMeta };
        delete newMeta.pending_pause_prompt;
        let confirmMsg = "";
        if (choice === 2) {
          await admin.from("crm_autopilot_configs")
            .update({ is_active: false, metadata: newMeta })
            .eq("id", cfg.id);
          // Marca todas as conversas da empresa como "Piloto pausado" (global)
          await admin.from("whatsapp_conversations")
            .update({
              autopilot_paused: true,
              autopilot_paused_at: new Date().toISOString(),
              autopilot_paused_scope: "global",
            } as any)
            .eq("company_id", companyId);
          confirmMsg = "Prontinho. Pausei o Piloto em TODAS as conversas. Quando quiser reativar, é só me avisar pelo app.";
        } else {
          // Choice 1: só aquela conversa (já está com human_takeover=true pelo webhook)
          await admin.from("crm_autopilot_configs")
            .update({ metadata: newMeta })
            .eq("id", cfg.id);
          // Marca apenas essa conversa como "Piloto pausado"
          await admin.from("whatsapp_conversations")
            .update({
              autopilot_paused: true,
              autopilot_paused_at: new Date().toISOString(),
              autopilot_paused_scope: "conversation",
            } as any)
            .eq("id", pendingPause.conversation_id);
          confirmMsg = `Beleza. Pausei o Piloto SÓ na conversa com ${pendingPause.contact_name || "esse cliente"}. Nas outras sigo respondendo normalmente.`;
        }
        await fetch(`${SUPABASE_URL}/functions/v1/whatsapp-api`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` },
          body: JSON.stringify({ action: "send_message", manualTakeover: false, sessionId: cfg.parent_session_id, phone: cfg.parent_phone, message: confirmMsg }),
        }).catch(() => {});
        await admin.from("crm_autopilot_events").insert({
          company_id: companyId,
          conversation_id: pendingPause.conversation_id,
          event_type: choice === 2 ? "piloto_paused_global" : "piloto_paused_conversation",
          description: choice === 2 ? "Pai pausou o Piloto em todas as conversas" : `Pai pausou o Piloto apenas na conversa com ${pendingPause.contact_name || pendingPause.conversation_id}`,
        });
        return new Response(JSON.stringify({ ok: true, pause_choice: choice }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      // Resposta não foi 1/2 — segue o fluxo normal (pode ser orientação a outro cliente).
    }

    const { data: pend } = await admin.from("crm_autopilot_pending_escalations")
      .select("*").eq("company_id", companyId).eq("status", "waiting")
      .order("created_at", { ascending: true }).limit(1).maybeSingle();
    if (!pend) return new Response(JSON.stringify({ skipped: "no_pending" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const { data: claimed } = await admin.from("crm_autopilot_pending_escalations")
      .update({ status: "processing", metadata: { ...((pend.metadata as Record<string, unknown>) || {}), processing_started_at: new Date().toISOString() } })
      .eq("id", pend.id)
      .eq("status", "waiting")
      .select("id")
      .maybeSingle();
    if (!claimed?.id) {
      return new Response(JSON.stringify({ skipped: "already_processing" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    claimedPendingId = pend.id;

    let ownerAnswer = String(messageContent || "").trim();
    if ((!ownerAnswer || messageType === "audio") && mediaUrl) {
      const transcript = await transcribeAudio(mediaUrl);
      if (transcript) ownerAnswer = transcript;
    }
    if (!ownerAnswer) {
      await admin.from("crm_autopilot_pending_escalations").update({ status: "waiting" }).eq("id", pend.id);
      return new Response(JSON.stringify({ skipped: "empty_reply" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const normalizedOwnerAnswer = ownerAnswer
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9\s]/g, "")
      .replace(/\s+/g, " ")
      .trim();
    const insufficientAnswers = new Set([
      "ok", "okay", "okk", "blz", "beleza", "ta", "esta bem", "certo", "sim", "isso", "pode", "pode sim",
    ]);
    if (insufficientAnswers.has(normalizedOwnerAnswer) || normalizedOwnerAnswer.length < 4) {
      const { data: convInfo } = await admin.from("whatsapp_conversations")
        .select("contact_name, contact_phone").eq("id", pend.conversation_id).maybeSingle();
      const clarify = `Preciso da resposta exata que devo enviar ao cliente ${convInfo?.contact_name || convInfo?.contact_phone || ""}.

Dúvida pendente: ${pend.question_sent}

Me responda com a orientação completa, por texto ou áudio.`;
      await fetch(`${SUPABASE_URL}/functions/v1/whatsapp-api`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` },
        body: JSON.stringify({ action: "send_message", manualTakeover: false, sessionId: cfg.parent_session_id, phone: cfg.parent_phone, message: clarify }),
      }).catch(() => {});
      await admin.from("crm_autopilot_events").insert({
        company_id: companyId,
        conversation_id: pend.conversation_id,
        event_type: "parent_reply_insufficient",
        description: `Resposta do Pai insuficiente: "${ownerAnswer.slice(0, 80)}"`,
        metadata: { escalation_id: pend.id },
      });
      await admin.from("crm_autopilot_pending_escalations").update({ status: "waiting" }).eq("id", pend.id);
      return new Response(JSON.stringify({ skipped: "insufficient_parent_reply" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: msgs } = await admin.from("whatsapp_messages")
      .select("from_me, content, message_type").eq("conversation_id", pend.conversation_id)
      .order("timestamp", { ascending: false }).limit(15);
    const transcript = (msgs || []).slice().reverse()
      .map((m: any) => `${m.from_me ? "EMPRESA" : "CLIENTE"}: ${(m.content || `[${m.message_type}]`).slice(0, 300)}`).join("\n");

    const raw = await callAi([
      { role: "system", content: `Você fala em nome do dono do negócio no WhatsApp. Ele acabou de te dar uma orientação em resposta a uma dúvida sua. Escreva a resposta final para o cliente, natural, em português do Brasil, respeitando o estilo do dono. Máximo ${cfg.max_chars} caracteres. Nunca diga que é IA. Nunca use emoji, emoticon ou pictograma. Retorne APENAS JSON: {"message":"..."}` },
      { role: "user", content: `CONVERSA COM CLIENTE:\n${transcript}\n\nDÚVIDA ENVIADA AO DONO: ${pend.question_sent}\n\nORIENTAÇÃO DO DONO: ${ownerAnswer}\n\nGere a resposta final ao cliente.` },
    ]);
    let finalMsg = "";
    try { finalMsg = stripEmojis(String(JSON.parse(raw.replace(/^```json\s*/i, "").replace(/```$/i, "").trim()).message || "")).slice(0, cfg.max_chars).trim(); } catch {}
    if (!finalMsg) finalMsg = stripEmojis(ownerAnswer).slice(0, cfg.max_chars);

    const { data: conv } = await admin.from("whatsapp_conversations")
      .select("session_id, contact_phone").eq("id", pend.conversation_id).maybeSingle();
    if (!conv?.session_id || !conv?.contact_phone || phonesMatch(conv.contact_phone, cfg.parent_phone)) {
      await admin.from("crm_autopilot_pending_escalations").update({
        status: "cancelled",
        parent_answer: ownerAnswer,
        final_answer_sent: null,
        answered_at: new Date().toISOString(),
        metadata: { ...((pend.metadata as Record<string, unknown>) || {}), cancel_reason: "invalid_customer_conversation_is_parent" },
      }).eq("id", pend.id);
      await admin.from("crm_autopilot_events").insert({
        company_id: companyId,
        conversation_id: pend.conversation_id,
        event_type: "skipped",
        description: "Resposta do Pai bloqueada: conversa de destino também é o Pai do Piloto",
        metadata: { escalation_id: pend.id },
      });
      return new Response(JSON.stringify({ skipped: "invalid_parent_destination" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const sendRes = await fetch(`${SUPABASE_URL}/functions/v1/whatsapp-api`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` },
      body: JSON.stringify({ action: "send_message", manualTakeover: false, sessionId: conv.session_id, phone: conv.contact_phone, message: finalMsg, conversationId: pend.conversation_id }),
    });
    if (!sendRes.ok) {
      const details = await sendRes.text().catch(() => "");
      await admin.from("crm_autopilot_pending_escalations").update({
        status: "waiting",
        parent_answer: ownerAnswer,
        final_answer_sent: null,
        metadata: { ...((pend.metadata as Record<string, unknown>) || {}), last_send_error: details.slice(0, 500), last_send_error_at: new Date().toISOString() },
      }).eq("id", pend.id);
      await admin.from("crm_autopilot_events").insert({
        company_id: companyId,
        conversation_id: pend.conversation_id,
        event_type: "error",
        description: `Falha ao enviar resposta do Pai ao cliente: ${details.slice(0, 160)}`,
        metadata: { escalation_id: pend.id },
      });
      return new Response(JSON.stringify({ error: "send_failed" }), { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    await admin.from("crm_autopilot_pending_escalations").update({
      status: "answered", parent_answer: ownerAnswer, final_answer_sent: finalMsg, answered_at: new Date().toISOString(),
    }).eq("id", pend.id);

    await admin.from("crm_autopilot_events").insert({
      company_id: companyId, conversation_id: pend.conversation_id, event_type: "answered_after_parent",
      description: `Dono orientou: "${ownerAnswer.slice(0, 100)}"`, metadata: { escalation_id: pend.id },
    });

    return new Response(JSON.stringify({ ok: true, escalation_id: pend.id }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    console.error("[crm-autopilot-parent-reply]", err);
    try {
      if (claimedPendingId) {
        const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
        await admin.from("crm_autopilot_pending_escalations").update({ status: "waiting" }).eq("id", claimedPendingId).eq("status", "processing");
      }
    } catch (_) {}
    return new Response(JSON.stringify({ error: (err as Error).message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});