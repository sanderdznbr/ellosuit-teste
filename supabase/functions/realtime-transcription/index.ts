// Realtime Transcription
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
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

 const DEEPGRAM_API_KEY = Deno.env.get('DEEPGRAM_API_KEY');

// Convert PCM16 to WAV
const pcmToWav = (pcmData: Uint8Array, sampleRate: number = 48000): Uint8Array => {
  const wavHeader = new ArrayBuffer(44);
  const view = new DataView(wavHeader);
  
  view.setUint32(0, 0x52494646, false);
  view.setUint32(4, 36 + pcmData.length, true);
  view.setUint32(8, 0x57415645, false);
  view.setUint32(12, 0x666d7420, false);
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  view.setUint32(36, 0x64617461, false);
  view.setUint32(40, pcmData.length, true);
  
  const wavFile = new Uint8Array(44 + pcmData.length);
  wavFile.set(new Uint8Array(wavHeader), 0);
  wavFile.set(pcmData, 44);
  
  return wavFile;
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { audio, roomId, sampleRate, audioMimeType } = await req.json();

    if (!audio || typeof audio !== 'string') {
      return new Response(JSON.stringify({ error: 'No audio data provided' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

     if (!DEEPGRAM_API_KEY) {
       return new Response(JSON.stringify({ error: 'DEEPGRAM_API_KEY not configured' }), {
         status: 500,
         headers: { ...corsHeaders, 'Content-Type': 'application/json' },
       });
     }

    // Decode base64 PCM audio
    const binaryString = atob(audio);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    if (bytes.length < 1000) {
      return new Response(JSON.stringify({ text: '', filtered: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const isEncodedAudio = typeof audioMimeType === 'string' && audioMimeType.startsWith('audio/');
    const audioFile = isEncodedAudio ? bytes : (() => {
      const safeSampleRate = typeof sampleRate === 'number' && sampleRate >= 8000 && sampleRate <= 48000
        ? sampleRate
        : 48000;
      return pcmToWav(bytes, safeSampleRate);
    })();

     // Transcribe with Deepgram (Nova-2 is excellent for real-time)
     const response = await fetch('https://api.deepgram.com/v1/listen?model=nova-2&language=pt-BR&smart_format=true&filler_words=false', {
       method: 'POST',
       headers: {
         'Authorization': `Token ${DEEPGRAM_API_KEY}`,
         'Content-Type': isEncodedAudio ? audioMimeType : 'audio/wav',
       },
       body: audioFile,
     });
 
     if (!response.ok) {
       const errorText = await response.text();
       console.error('Deepgram API error:', response.status, errorText);
       return new Response(JSON.stringify({ error: `Deepgram API error: ${response.status}` }), {
         status: 502,
         headers: { ...corsHeaders, 'Content-Type': 'application/json' },
       });
     }
 
     const result = await response.json();
     const text = result.results?.channels?.[0]?.alternatives?.[0]?.transcript?.trim() || '';
     const confidence = result.results?.channels?.[0]?.alternatives?.[0]?.confidence || 0;
 
     // Filter silence / low-confidence garbage
     if (text.length < 3 || confidence < 0.4) {
       return new Response(JSON.stringify({ text: '', filtered: true }), {
         headers: { ...corsHeaders, 'Content-Type': 'application/json' },
       });
     }

    // Filter noise / hallucination patterns
    const noisePatterns = [
      /^[,.!?;:\s]+$/,
      /^(uh+|um+|ah+|eh+|hm+|mhm+|mmm+|hmm+)$/i,
      /^(\w)\1{8,}$/,
      /^[^a-zA-ZÀ-ÿ]+$/,
      /^\[.*\]$/,
      // Common Whisper hallucinations in PT-BR on silence
      /se inscreva.*canal/i,
      /se inscreve.*canal/i,
      /ative o sino/i,
      /obrigado por (assistir|ver)/i,
      /legendado por/i,
      /legendas? pelo/i,
      /tradu[çc][ãa]o.*comunidade.*amara/i,
      /^(muito )?obrigad[oa]\.?$/i,
      /^valeu\.?$/i,
      /^até (mais|breve|logo)\.?$/i,
      /^tchau\.?$/i,
      /^um abra[çc]o\.?$/i,
      /^(é )?isso a[ií]\.?$/i,
      /^isso\.?$/i,
      /^ignore ru[ií]dos? de fundo\.?$/i,
    ];
    
    for (const pattern of noisePatterns) {
      if (pattern.test(text)) {
        console.log('🚫 [Whisper] Padrão de alucinação descartado:', text.substring(0, 80));
        return new Response(JSON.stringify({ text: '', filtered: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // Detect repeated word/phrase loops ("Não. Não. Não." / "É um pote? É um pote?")
    const tokens = text.toLowerCase().split(/[\s.,!?;:]+/).filter(Boolean);
    if (tokens.length >= 4) {
      const counts = new Map<string, number>();
      for (const t of tokens) counts.set(t, (counts.get(t) || 0) + 1);
      const maxRepeat = Math.max(...counts.values());
      if (maxRepeat / tokens.length > 0.5) {
        console.log('🚫 [Whisper] Loop de repetição descartado:', text.substring(0, 80));
        return new Response(JSON.stringify({ text: '', filtered: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      // Detect repeated short phrases like "É isso aí. É isso aí. É isso aí."
      const sentences = text.split(/[.!?]+/).map(s => s.trim().toLowerCase()).filter(s => s.length > 0);
      if (sentences.length >= 3) {
        const uniq = new Set(sentences);
        if (uniq.size <= Math.ceil(sentences.length / 3)) {
          console.log('🚫 [Whisper] Frases repetidas descartadas:', text.substring(0, 80));
          return new Response(JSON.stringify({ text: '', filtered: true }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
      }
    }

    console.log('✅ Transcription:', text.substring(0, 80));

     // Deepgram: ~$0.004 per minute, estimate ~5s chunks
     logUsage({
       service_type: 'deepgram', action: 'realtime_transcription', model: 'nova-2',
       total_cost: 0.0003, // ~5s chunk = $0.0003
       metadata: { text_length: text.length, confidence },
     });

    return new Response(JSON.stringify({
      text,
      is_final: true,
      timestamp: new Date().toISOString(),
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error:', error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
