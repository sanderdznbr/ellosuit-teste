import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const ELEVENLABS_API_KEY = Deno.env.get("ELEVENLABS_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    if (!ELEVENLABS_API_KEY) return json({ error: "elevenlabs_not_configured" }, 500);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "missing_auth" }, 401);

    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);
    
    // Validate user
    const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
    if (authError || !user) return json({ error: "unauthorized" }, 401);

    // Get user company
    const { data: cuData } = await supabase
      .from("company_users")
      .select("company_id")
      .eq("user_id", user.id)
      .maybeSingle();
    const companyId = cuData?.company_id;

    // Detect action from body if it's a POST
    let action = null;
    if (req.method === "POST") {
      const contentType = req.headers.get("content-type") || "";
      if (contentType.includes("application/json")) {
        try {
          const body = await req.clone().json();
          action = body.action;
        } catch (e) {
          console.error("Error parsing JSON body:", e);
        }
      }
    }

    const isList = req.method === "GET" || action === "list";

    if (isList) {
      console.log(`Listing voices for company: ${companyId}`);
      const { data: metadata, error: dbError } = await supabase
        .from("cloned_voices" as any)
        .select("voice_id, name")
        .eq("company_id", companyId);

      if (dbError) {
        console.error("Database error fetching metadata:", dbError);
        return json({ error: "db_metadata_failed", details: dbError.message }, 500);
      }

      const voiceIds = metadata?.map(m => m.voice_id) || [];
      
      if (voiceIds.length === 0) {
        return json({ voices: [] });
      }

      const res = await fetch("https://api.elevenlabs.io/v1/voices", {
        headers: { "xi-api-key": ELEVENLABS_API_KEY },
      });
      
      if (!res.ok) {
        console.error("ElevenLabs list failed:", await res.text());
        return json({ error: "list_failed" }, res.status);
      }
      
      const data = await res.json();
      const voices = (data.voices || [])
        .filter((v: any) => voiceIds.includes(v.voice_id))
        .map((v: any) => ({ 
          voice_id: v.voice_id, 
          name: metadata?.find(m => m.voice_id === v.voice_id)?.name || v.name 
        }));
        
      return json({ voices });
    }

    // CREATE cloned voice
    const form = await req.formData();
    const name = String(form.get("name") || "").trim();
    const files = form.getAll("files").filter((f) => f instanceof File) as File[];

    if (!name) return json({ error: "missing_name", message: "Informe um título para a voz." }, 400);
    if (files.length === 0) return json({ error: "missing_files", message: "Envie ao menos 1 áudio." }, 400);

    const upstream = new FormData();
    upstream.append("name", name);
    upstream.append("description", `Voz clonada por ${user.email} na Ellosuit`);
    upstream.append("remove_background_noise", "true");
    for (const f of files) upstream.append("files", f, f.name || "sample.mp3");

    const res = await fetch("https://api.elevenlabs.io/v1/voices/add", {
      method: "POST",
      headers: { "xi-api-key": ELEVENLABS_API_KEY },
      body: upstream,
    });

    if (!res.ok) {
      const details = await res.text();
      return json({ error: "clone_failed", details }, res.status);
    }

    const data = await res.json();
    const voiceId = data.voice_id;

    // Save mapping to database
    await supabase.from("cloned_voices" as any).insert({
      voice_id: voiceId,
      company_id: companyId,
      user_id: user.id,
      name: name
    });

    return json({ voice_id: voiceId, name });
  } catch (error) {
    console.error("Runtime error in edge function:", error);
    return json({ error: (error as Error).message }, 500);
  }
});