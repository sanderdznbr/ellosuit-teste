import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

async function getHash(text: string): Promise<string> {
  const msgUint8 = new TextEncoder().encode(text);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

async function logUsage(params: { service_type: string; action: string; model?: string; characters_used?: number; total_cost: number; company_id?: string; user_id?: string; metadata?: Record<string, any> }) {
  try {
    const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    await sb.from('api_usage_logs').insert({
      service_type: params.service_type,
      action: params.action,
      model: params.model || null,
      characters_used: params.characters_used || 0,
      total_cost: params.total_cost,
      unit_cost: params.characters_used ? params.total_cost / params.characters_used : params.total_cost,
      company_id: params.company_id || null,
      user_id: params.user_id || null,
      metadata: params.metadata || {},
    });
  } catch (e) { console.error('logUsage error:', e); }
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Convert numbers to pt-BR words for TTS pronunciation
const unidades = ['zero','um','dois','três','quatro','cinco','seis','sete','oito','nove',
  'dez','onze','doze','treze','quatorze','quinze','dezesseis','dezessete','dezoito','dezenove'];
const dezenas = ['','','vinte','trinta','quarenta','cinquenta'];
const centenas = ['','cento','duzentos','trezentos','quatrocentos','quinhentos','seiscentos','setecentos','oitocentos','novecentos'];

const meses = ['','janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];

function numberToWords(n: number): string {
  if (n < 20) return unidades[n];
  const d = Math.floor(n / 10);
  const u = n % 10;
  return u === 0 ? dezenas[d] : `${dezenas[d]} e ${unidades[u]}`;
}

function numberToWordsFem(n: number): string {
  if (n === 1) return 'uma';
  if (n === 2) return 'duas';
  return numberToWords(n);
}

function yearToWords(y: number): string {
  if (y === 2000) return 'dois mil';
  if (y > 2000 && y < 2100) {
    const remainder = y - 2000;
    return `dois mil e ${numberToWords(remainder)}`;
  }
  const mil = Math.floor(y / 1000);
  const rest = y % 1000;
  let result = numberToWords(mil) + ' mil';
  if (rest === 0) return result;
  if (rest === 100) return result + ' e cem';
  if (rest < 100) return result + ' e ' + numberToWords(rest);
  const c = Math.floor(rest / 100);
  const r = rest % 100;
  if (r === 0) {
    return rest === 100 ? result + ' e cem' : result + ' e ' + centenas[c];
  }
  return result + ' ' + centenas[c] + ' e ' + numberToWords(r);
}

function dateToPortuguese(text: string): string {
  // Match DD/MM/YYYY or DD/MM/YY
  return text.replace(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})/g, (_match, d, m, y) => {
    const day = parseInt(d, 10);
    const month = parseInt(m, 10);
    let year = parseInt(y, 10);
    if (year < 100) year += 2000;
    if (month < 1 || month > 12) return _match;
    const dayWord = day === 1 ? 'primeiro' : numberToWords(day);
    return `${dayWord} de ${meses[month]} de ${yearToWords(year)}`;
  });
}

function timeToPortuguese(text: string): string {
  return text.replace(/(\d{1,2})[h:](\d{2})/g, (_match, h, m) => {
    const hour = parseInt(h, 10);
    const min = parseInt(m, 10);
    let result = numberToWordsFem(hour) + (hour === 1 ? ' hora' : ' horas');
    if (min > 0) {
      result += ' e ' + numberToWords(min) + (min === 1 ? ' minuto' : ' minutos');
    }
    return result;
  });
}

function preprocessForTTS(text: string): string {
  let result = dateToPortuguese(text);
  result = timeToPortuguese(result);
  return result;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { text, voiceId, action, voiceIds } = await req.json();
    const ELEVENLABS_API_KEY = Deno.env.get("ELEVENLABS_API_KEY");

    if (!ELEVENLABS_API_KEY) {
      throw new Error("ELEVENLABS_API_KEY not configured");
    }

    if (action === 'voice-previews') {
      if (!Array.isArray(voiceIds) || voiceIds.length === 0 || voiceIds.length > 20 || voiceIds.some((id) => typeof id !== 'string')) {
        return new Response(JSON.stringify({ error: 'voiceIds inválidos' }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const previews: Record<string, string> = {};
      await Promise.all(voiceIds.map(async (id: string) => {
        const voiceResponse = await fetch(`https://api.elevenlabs.io/v1/voices/${encodeURIComponent(id)}`, {
          headers: { "xi-api-key": ELEVENLABS_API_KEY },
        });
        if (!voiceResponse.ok) return;
        const voice = await voiceResponse.json();
        if (typeof voice.preview_url === 'string') previews[id] = voice.preview_url;
      }));

      return new Response(JSON.stringify({ previews }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!text || text.trim().length === 0) {
      return new Response(JSON.stringify({ error: "Text is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const selectedVoice = voiceId || "ORgG8rwdAiMYRug8RJwR";
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey);

    // Check cache
    const textHash = await getHash(text.trim() + selectedVoice);
    const { data: cachedEntry } = await supabaseClient
      .from('tts_cache')
      .select('file_path')
      .eq('text_hash', textHash)
      .eq('voice_id', selectedVoice)
      .maybeSingle();

    if (cachedEntry) {
      console.log("🎯 TTS Cache hit:", cachedEntry.file_path);
      const { data: audioData, error: downloadError } = await supabaseClient
        .storage
        .from('tts-cache')
        .download(cachedEntry.file_path);

      if (!downloadError && audioData) {
        return new Response(audioData, {
          headers: { ...corsHeaders, "Content-Type": "audio/mpeg" },
        });
      }
      console.error("❌ Failed to download from cache storage:", downloadError);
    }

    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${selectedVoice}?output_format=mp3_44100_128`,
      {
        method: "POST",
        headers: {
          "xi-api-key": ELEVENLABS_API_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text: preprocessForTTS(text.slice(0, 5000)),
          model_id: "eleven_multilingual_v2",
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75,
            style: 0.3,
            use_speaker_boost: true,
            speed: 1.0,
          },
        }),
      }
    );

    if (!response.ok) {
      const errText = await response.text();
      console.error("ElevenLabs TTS error:", response.status, errText);
      
      // Fallback to OpenAI TTS when ElevenLabs fails (quota, auth, etc.)
      console.log("⚡ Falling back to OpenAI TTS...");
      const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
      if (OPENAI_API_KEY) {
        try {
          const processedText = preprocessForTTS(text.slice(0, 4000));
          const openaiResponse = await fetch('https://api.openai.com/v1/audio/speech', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${OPENAI_API_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model: 'tts-1',
              input: processedText,
              voice: 'alloy',
              response_format: 'mp3',
              speed: 1.0,
            }),
          });

          if (openaiResponse.ok) {
            const fallbackBuffer = await openaiResponse.arrayBuffer();
            const charCount = processedText.length;
            const cost = (charCount / 1000) * 0.015;
            logUsage({
              service_type: 'openai_tts',
              action: 'tts_fallback',
              model: 'tts-1',
              characters_used: charCount,
              total_cost: cost,
              metadata: { voice: 'nova', fallback_reason: 'elevenlabs_error', original_status: response.status },
            });
            console.log("✅ OpenAI TTS fallback succeeded:", fallbackBuffer.byteLength, "bytes");
            return new Response(fallbackBuffer, {
              headers: { ...corsHeaders, "Content-Type": "audio/mpeg" },
            });
          } else {
            console.error("OpenAI TTS fallback also failed:", openaiResponse.status);
          }
        } catch (fallbackErr) {
          console.error("OpenAI TTS fallback error:", fallbackErr);
        }
      }

      // If fallback also fails, return original error
      let errorMessage = "TTS generation failed";
      try {
        const errData = JSON.parse(errText);
        if (errData?.detail?.status === "quota_exceeded") {
          errorMessage = `Cota de caracteres ElevenLabs esgotada.`;
        } else {
          errorMessage = errData?.detail?.message || errData?.detail || errorMessage;
        }
      } catch {}
      
      return new Response(
        JSON.stringify({ error: errorMessage }),
        {
          status: response.status === 401 ? 401 : 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const audioBuffer = await response.arrayBuffer();
    const fileName = `${textHash}.mp3`;

    // Save to storage cache
    const { error: uploadError } = await supabaseClient
      .storage
      .from('tts-cache')
      .upload(fileName, audioBuffer, { contentType: 'audio/mpeg', upsert: true });

    if (!uploadError) {
      await supabaseClient.from('tts_cache').insert({
        text_hash: textHash,
        original_text: text,
        voice_id: selectedVoice,
        file_path: fileName
      });
      console.log("✅ Saved TTS to cache:", fileName);
    } else {
      console.error("❌ Failed to save to cache storage:", uploadError);
    }

    const charCount = preprocessForTTS(text.slice(0, 5000)).length;
    const cost = (charCount / 1000) * 0.30;
    logUsage({
      service_type: 'elevenlabs_tts',
      action: 'tts_generate',
      model: 'eleven_multilingual_v2',
      characters_used: charCount,
      total_cost: cost,
      metadata: { voice_id: selectedVoice, audio_size: audioBuffer.byteLength },
    });

    return new Response(audioBuffer, {
      headers: { ...corsHeaders, "Content-Type": "audio/mpeg" },
    });
  } catch (e) {
    console.error("TTS error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
