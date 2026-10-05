import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

async function logUsage(params: { service_type: string; action: string; model?: string; total_cost: number; metadata?: Record<string, any> }) {
  try {
    const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    await sb.from('api_usage_logs').insert({
      service_type: params.service_type, action: params.action, model: params.model || null,
      total_cost: params.total_cost, unit_cost: params.total_cost, metadata: params.metadata || {},
    });
  } catch (e) { console.error('logUsage error:', e); }
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function downloadAudio(url: string): Promise<File> {
  console.log("Downloading audio from URL:", url);
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`Failed to download audio: ${resp.status}`);
  const blob = await resp.blob();
  return new File([blob], "audio.ogg", { type: blob.type || "audio/ogg" });
}

async function transcribeWithElevenLabs(audioFile: File, apiKey: string): Promise<string> {
  const apiFormData = new FormData();
  apiFormData.append("file", audioFile);
  apiFormData.append("model_id", "scribe_v2");
  apiFormData.append("language_code", "por");

  const response = await fetch("https://api.elevenlabs.io/v1/speech-to-text", {
    method: "POST",
    headers: { "xi-api-key": apiKey },
    body: apiFormData,
  });

  if (!response.ok) {
    const errText = await response.text();
    console.error("ElevenLabs STT error:", response.status, errText);
    throw new Error(`ElevenLabs STT failed: ${response.status}`);
  }

  const result = await response.json();
  return result.text || "";
}

async function transcribeWithOpenAI(audioFile: File, apiKey: string): Promise<string> {
  const apiFormData = new FormData();
  apiFormData.append("file", audioFile);
  apiFormData.append("model", "whisper-1");
  apiFormData.append("language", "pt");

  const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { "Authorization": `Bearer ${apiKey}` },
    body: apiFormData,
  });

  if (!response.ok) {
    const errText = await response.text();
    console.error("OpenAI Whisper error:", response.status, errText);
    throw new Error(`OpenAI Whisper failed: ${response.status}`);
  }

  const result = await response.json();
  return result.text || "";
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const contentType = req.headers.get("content-type") || "";
    let audioFile: File | null = null;
    let audioUrl: string | null = null;
    let messageId: string | null = null;

    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      audioFile = formData.get("audio") as File | null;
      messageId = formData.get("message_id") as string | null;
      audioUrl = formData.get("audio_url") as string | null;
    } else {
      // JSON body
      const body = await req.json();
      audioUrl = body.audio_url || null;
      messageId = body.message_id || null;
    }

    // Download audio from URL if needed
    if (!audioFile && audioUrl) {
      audioFile = await downloadAudio(audioUrl);
    }

    if (!audioFile) {
      return new Response(JSON.stringify({ error: "Audio file or audio_url required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Keep a copy of the audio bytes for fallback (FormData consumes the file)
    const audioBytes = await audioFile.arrayBuffer();
    const audioType = audioFile.type || "audio/webm";
    const audioName = audioFile.name || "recording.webm";

    let text = "";
    let usedProvider = "";

    // Try ElevenLabs first
    const ELEVENLABS_API_KEY = Deno.env.get("ELEVENLABS_API_KEY");
    if (ELEVENLABS_API_KEY) {
      try {
        const elFile = new File([audioBytes], audioName, { type: audioType });
        text = await transcribeWithElevenLabs(elFile, ELEVENLABS_API_KEY);
        usedProvider = "elevenlabs";
        console.log("✅ ElevenLabs transcription successful, length:", text.length);
      } catch (e) {
        console.warn("⚠️ ElevenLabs STT failed, trying OpenAI fallback:", e.message);
      }
    } else {
      console.warn("⚠️ ELEVENLABS_API_KEY not set, skipping to OpenAI fallback");
    }

    // Fallback to OpenAI Whisper
    if (!text) {
      const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
      if (!OPENAI_API_KEY) {
        throw new Error("No STT provider available (both ElevenLabs and OpenAI keys missing or failed)");
      }
      const whisperFile = new File([audioBytes], audioName, { type: audioType });
      text = await transcribeWithOpenAI(whisperFile, OPENAI_API_KEY);
      usedProvider = "openai_whisper";
      console.log("✅ OpenAI Whisper transcription successful, length:", text.length);
    }

    // Save transcription to database if message_id provided
    if (messageId && text) {
      const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
      await sb.from('ycloud_messages').update({ transcription: text }).eq('id', messageId);
      console.log("💾 Saved transcription for message:", messageId);
    }

    logUsage({
      service_type: usedProvider === 'elevenlabs' ? 'elevenlabs_stt' : 'openai_whisper',
      action: 'speech_to_text',
      model: usedProvider === 'elevenlabs' ? 'scribe_v2' : 'whisper-1',
      total_cost: usedProvider === 'elevenlabs' ? 0.0033 : 0.006,
      metadata: { text_length: text.length, message_id: messageId, provider: usedProvider },
    });

    return new Response(JSON.stringify({ text, provider: usedProvider }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("STT error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
