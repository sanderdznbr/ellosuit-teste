import { encodeBase64 as base64Encode } from "https://deno.land/std@0.224.0/encoding/base64.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

async function logUsage(params: { service_type: string; action: string; model?: string; characters_used?: number; total_cost: number; metadata?: Record<string, any> }) {
  try {
    const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    await sb.from('api_usage_logs').insert({
      service_type: params.service_type,
      action: params.action,
      model: params.model || null,
      characters_used: params.characters_used || 0,
      total_cost: params.total_cost,
      unit_cost: params.characters_used ? params.total_cost / params.characters_used : params.total_cost,
      metadata: params.metadata || {},
    });
  } catch (e) { console.error('logUsage error:', e); }
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { text, voice = 'alloy', speed = 1.0, format = 'opus' } = await req.json();

    if (!text || typeof text !== 'string') {
      return new Response(JSON.stringify({ error: 'Text is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    if (!OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY is not configured');
    }

    // Limit text to ~4000 chars for TTS
    const trimmedText = text.slice(0, 4000);
    
    // Use opus format for WhatsApp PTT compatibility, mp3 as fallback
    const responseFormat = format === 'mp3' ? 'mp3' : 'opus';

    console.log(`🎙️ TTS request: voice=${voice}, format=${responseFormat}, text length=${trimmedText.length}`);

    const response = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'tts-1',
        input: trimmedText,
        voice: voice,
        response_format: responseFormat,
        speed: speed,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ OpenAI TTS error:', response.status, errorText);

      if (response.status === 429) {
        return new Response(JSON.stringify({ error: 'Rate limit exceeded' }), {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      throw new Error(`OpenAI TTS error: ${response.status}`);
    }

    const audioBuffer = await response.arrayBuffer();
    const base64Audio = base64Encode(audioBuffer);

    // Log cost: OpenAI TTS-1 ~$0.015 per 1K chars
    const charCount = trimmedText.length;
    const cost = (charCount / 1000) * 0.015;
    logUsage({
      service_type: 'openai_tts',
      action: 'tts_generate',
      model: 'tts-1',
      characters_used: charCount,
      total_cost: cost,
      metadata: { voice, format: responseFormat, audio_size: audioBuffer.byteLength },
    });

    console.log(`✅ TTS audio generated: ${audioBuffer.byteLength} bytes, format: ${responseFormat}`);

    return new Response(JSON.stringify({
      audio_base64: base64Audio,
      format: responseFormat,
      size: audioBuffer.byteLength,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('❌ TTS error:', error);
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : 'Internal server error',
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
