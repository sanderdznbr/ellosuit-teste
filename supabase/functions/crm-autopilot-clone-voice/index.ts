import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ELEVENLABS_API_KEY = Deno.env.get("ELEVENLABS_API_KEY");

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    if (!ELEVENLABS_API_KEY) throw new Error("elevenlabs_not_configured");
    const authHeader = req.headers.get("Authorization") || "";
    const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: authHeader } } });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const { companyId, voiceName } = await req.json();
    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: membership } = await admin.from("company_users").select("role").eq("company_id", companyId).eq("user_id", user.id).maybeSingle();
    if (!membership) return new Response(JSON.stringify({ error: "forbidden" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    await admin.from("crm_autopilot_configs").update({ voice_status: "cloning" }).eq("company_id", companyId);

    // Grab up to 15 recent audio messages sent by the user (from_me=true)
    const { data: audioMsgs } = await admin
      .from("whatsapp_messages")
      .select("id, media_url, conversation_id, timestamp")
      .eq("company_id", companyId)
      .eq("from_me", true)
      .eq("message_type", "audio")
      .not("media_url", "is", null)
      .order("timestamp", { ascending: false })
      .limit(15);

    if (!audioMsgs || audioMsgs.length < 1) {
      await admin.from("crm_autopilot_configs").update({ voice_status: "needs_samples" }).eq("company_id", companyId);
      return new Response(JSON.stringify({ error: "no_audio_samples", message: "Envie ao menos 1 áudio pelo WhatsApp antes de clonar" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Download samples
    const form = new FormData();
    form.append("name", voiceName || `Voz Autopilot ${new Date().toISOString().slice(0, 10)}`);
    form.append("description", "Voz clonada do usuário via Piloto Automático");
    form.append("remove_background_noise", "true");
    let attached = 0;
    for (const m of audioMsgs) {
      try {
        const r = await fetch(m.media_url as string);
        if (!r.ok) continue;
        const blob = await r.blob();
        if (blob.size < 500) continue;
        form.append("files", new File([blob], `sample-${m.id}.ogg`, { type: blob.type || "audio/ogg" }));
        await admin.from("crm_autopilot_voice_samples").insert({
          company_id: companyId, message_id: m.id, storage_path: m.media_url, used_for_cloning: true,
        });
        attached++;
        if (attached >= 10) break;
      } catch (e) { console.error("sample fetch err", e); }
    }
    if (attached === 0) {
      await admin.from("crm_autopilot_configs").update({ voice_status: "needs_samples" }).eq("company_id", companyId);
      return new Response(JSON.stringify({ error: "download_failed" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const res = await fetch("https://api.elevenlabs.io/v1/voices/add", {
      method: "POST",
      headers: { "xi-api-key": ELEVENLABS_API_KEY },
      body: form,
    });
    if (!res.ok) {
      const t = await res.text();
      await admin.from("crm_autopilot_configs").update({ voice_status: "failed", metadata: { last_error: t.slice(0, 400) } }).eq("company_id", companyId);
      return new Response(JSON.stringify({ error: "elevenlabs_error", details: t }), { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const json = await res.json();
    const voice_id = json.voice_id;
    await admin.from("crm_autopilot_configs").update({ voice_id, voice_status: "ready" }).eq("company_id", companyId);
    return new Response(JSON.stringify({ ok: true, voice_id, samples_used: attached }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    console.error("[crm-autopilot-clone-voice]", err);
    return new Response(JSON.stringify({ error: (err as Error).message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});