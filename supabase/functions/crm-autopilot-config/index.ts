import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const EVOLUTION_API_URL_RAW = (Deno.env.get("EVOLUTION_API_URL") || "").trim().replace(/\/+$/, "");
const EVOLUTION_API_URL = !EVOLUTION_API_URL_RAW
  ? ""
  : (/^https?:\/\//i.test(EVOLUTION_API_URL_RAW) ? EVOLUTION_API_URL_RAW : `https://${EVOLUTION_API_URL_RAW}`);
const EVOLUTION_API_KEY = Deno.env.get("EVOLUTION_API_KEY") || "";

function normalizePhone(input: string): string {
  const digits = String(input || "").replace(/\D/g, "");
  if (!digits) return "";
  // Assume Brazil DDI if 10-11 digits (local) and missing 55 prefix
  if (digits.length <= 11 && !digits.startsWith("55")) return `55${digits}`;
  return digits;
}

async function evolutionNumberExists(instanceName: string, phone: string): Promise<boolean | null> {
  if (!EVOLUTION_API_URL || !EVOLUTION_API_KEY || !instanceName) return null;
  try {
    const r = await fetch(`${EVOLUTION_API_URL}/chat/whatsappNumbers/${instanceName}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: EVOLUTION_API_KEY },
      body: JSON.stringify({ numbers: [phone] }),
    });
    if (!r.ok) return null;
    const j = await r.json();
    const arr = Array.isArray(j) ? j : (j?.numbers || j?.data || []);
    const hit = arr.find((x: any) => String(x?.number || x?.jid || "").includes(phone));
    if (!hit) return false;
    if (typeof hit.exists === "boolean") return hit.exists;
    return true;
  } catch { return null; }
}

async function getUser(req: Request) {
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
    const user = await getUser(req);
    if (!user) return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const body = await req.json();
    const { action, companyId } = body;
    if (!companyId) return new Response(JSON.stringify({ error: "companyId required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: membership } = await admin.from("company_users").select("role").eq("company_id", companyId).eq("user_id", user.id).maybeSingle();
    if (!membership) return new Response(JSON.stringify({ error: "forbidden" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    if (action === "get") {
      const { data } = await admin.from("crm_autopilot_configs").select("*").eq("company_id", companyId).maybeSingle();
      // stats
      const { count: totalConvs } = await admin.from("whatsapp_conversations").select("id", { count: "exact", head: true }).eq("company_id", companyId);
      const { count: samples } = await admin.from("crm_autopilot_voice_samples").select("id", { count: "exact", head: true }).eq("company_id", companyId);
      const { count: styleCount } = await admin.from("crm_autopilot_style_corpus").select("id", { count: "exact", head: true }).eq("company_id", companyId);
      const { count: availableAudios } = await admin.from("whatsapp_messages")
        .select("id", { count: "exact", head: true })
        .eq("company_id", companyId)
        .eq("from_me", true)
        .eq("message_type", "audio")
        .not("media_url", "is", null);
      return new Response(JSON.stringify({ config: data, stats: { totalConvs: totalConvs || 0, voiceSamples: samples || 0, styleItems: styleCount || 0, availableAudios: availableAudios || 0 } }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "save") {
      const patch = body.config || {};
      delete patch.id; delete patch.company_id; delete patch.created_at; delete patch.updated_at;
      const { data: existing } = await admin.from("crm_autopilot_configs").select("id").eq("company_id", companyId).maybeSingle();
      if (existing) {
        const { data, error } = await admin.from("crm_autopilot_configs").update(patch).eq("company_id", companyId).select().single();
        if (error) throw error;
        return new Response(JSON.stringify({ config: data }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      } else {
        const { data, error } = await admin.from("crm_autopilot_configs").insert({ company_id: companyId, ...patch }).select().single();
        if (error) throw error;
        return new Response(JSON.stringify({ config: data }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    if (action === "activate" || action === "deactivate") {
      if (!["admin", "manager", "adminmaster"].includes(membership.role)) {
        return new Response(JSON.stringify({ error: "admin_only" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const activating = action === "activate";
      const { error } = await admin.from("crm_autopilot_configs").update({
        is_active: activating,
        activated_at: activating ? new Date().toISOString() : null,
        activated_by: activating ? user.id : null,
      }).eq("company_id", companyId);
      if (error) throw error;

      if (activating) {
        // Release human_takeover in all conversations to let the autopilot answer
        await admin.from("whatsapp_conversations").update({
          human_takeover: false,
          human_takeover_reason: null,
          ai_auto_reply_enabled: true,
          autopilot_paused: false,
          autopilot_paused_at: null,
          autopilot_paused_scope: null,
        }).eq("company_id", companyId).eq("human_takeover", true);
        // Também limpa marcações de pausa restantes (ex.: pausa por conversa anterior)
        await admin.from("whatsapp_conversations").update({
          autopilot_paused: false,
          autopilot_paused_at: null,
          autopilot_paused_scope: null,
        }).eq("company_id", companyId).eq("autopilot_paused", true);
      } else {
        // Ao DESLIGAR o Piloto Automático: remove qualquer marcação de "Piloto"
        // e "Piloto pausado" de TODAS as conversas da empresa, além de limpar
        // pendências de prompt ao Pai.
        await admin.from("whatsapp_conversations").update({
          autopilot_paused: false,
          autopilot_paused_at: null,
          autopilot_paused_scope: null,
        }).eq("company_id", companyId);

        // Limpa metadata.pending_pause_prompt (se houver) para não reaparecer
        const { data: cfgRow } = await admin
          .from("crm_autopilot_configs")
          .select("id, metadata")
          .eq("company_id", companyId)
          .maybeSingle();
        if (cfgRow) {
          const meta = { ...((cfgRow.metadata as Record<string, unknown>) || {}) };
          delete (meta as any).pending_pause_prompt;
          await admin.from("crm_autopilot_configs")
            .update({ metadata: meta })
            .eq("id", cfgRow.id);
        }
      }

      await admin.from("crm_autopilot_events").insert({
        company_id: companyId,
        event_type: activating ? "autopilot_activated" : "autopilot_deactivated",
        description: activating ? "Piloto Automático ligado — assumindo todas as conversas" : "Piloto Automático desligado",
        metadata: { by: user.id },
      });

      return new Response(JSON.stringify({ ok: true, active: activating }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "validate_parent") {
      if (!["admin", "manager", "adminmaster"].includes(membership.role)) {
        return new Response(JSON.stringify({ error: "admin_only" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const rawPhone = String(body.parentPhone || "").trim();
      const sessionId = String(body.parentSessionId || "").trim();
      if (!rawPhone || !sessionId) {
        return new Response(JSON.stringify({ error: "missing_fields", message: "Informe o número e a sessão." }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const phone = normalizePhone(rawPhone);
      if (phone.length < 12 || phone.length > 15) {
        return new Response(JSON.stringify({ error: "invalid_phone", message: "Número inválido. Use o formato +55 11 99999-9999." }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const { data: session } = await admin.from("whatsapp_sessions")
        .select("id, instance_name, status, company_id, deleted_at")
        .eq("id", sessionId).maybeSingle();
      if (!session || session.company_id !== companyId || session.deleted_at) {
        return new Response(JSON.stringify({ error: "session_not_found", message: "Sessão não encontrada." }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      if (session.status !== "connected") {
        return new Response(JSON.stringify({ error: "session_not_connected", message: "A sessão selecionada não está conectada. Conecte-a e tente novamente." }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // 1) Try to verify number exists on WhatsApp (best-effort)
      const exists = await evolutionNumberExists(session.instance_name, phone);
      if (exists === false) {
        return new Response(JSON.stringify({ error: "not_on_whatsapp", message: "Esse número não existe no WhatsApp." }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // 2) Fetch company name for the confirmation message
      const { data: company } = await admin.from("companies").select("name").eq("id", companyId).maybeSingle();
      const companyName = company?.name || "sua conta";
      const welcome = `🤖 Olá! Você foi configurado como *Número Pai* da conta "${companyName}".\n\nSempre que a IA tiver dúvida sobre como responder um cliente, ela vai te perguntar aqui — é só me responder por texto ou áudio que eu volto ao cliente com base na sua orientação.\n\nSe você não reconhece esta conta, ignore esta mensagem.`;

      // 3) Send message via whatsapp-api
      const sendRes = await fetch(`${SUPABASE_URL}/functions/v1/whatsapp-api`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` },
        body: JSON.stringify({ action: "send_message", manualTakeover: false, sessionId: session.id, phone, message: welcome }),
      });
      const sendJson = await sendRes.json().catch(() => ({}));
      if (!sendRes.ok || sendJson?.error) {
        return new Response(JSON.stringify({ error: "send_failed", message: sendJson?.error || "Não consegui enviar a mensagem de confirmação. Verifique o número e a sessão." }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // 4) Persist parent config
      const { data: existing } = await admin.from("crm_autopilot_configs").select("id").eq("company_id", companyId).maybeSingle();
      const patch = { parent_phone: phone, parent_session_id: session.id };
      if (existing) {
        await admin.from("crm_autopilot_configs").update(patch).eq("company_id", companyId);
      } else {
        await admin.from("crm_autopilot_configs").insert({ company_id: companyId, ...patch });
      }
      const { data: updated } = await admin.from("crm_autopilot_configs").select("*").eq("company_id", companyId).maybeSingle();

      await admin.from("crm_autopilot_events").insert({
        company_id: companyId,
        event_type: "parent_configured",
        description: `Número Pai configurado: +${phone}`,
        metadata: { by: user.id, phone, session_id: session.id },
      });

      return new Response(JSON.stringify({ ok: true, config: updated, phone, existsChecked: exists === true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ error: "unknown_action" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    console.error("[crm-autopilot-config]", err);
    return new Response(JSON.stringify({ error: (err as Error).message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});