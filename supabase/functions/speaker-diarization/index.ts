// Speaker Diarization
import { createClient } from "npm:@supabase/supabase-js@2";

async function logUsage(params: { service_type: string; action: string; model?: string; total_cost: number; duration_seconds?: number; metadata?: Record<string, any> }) {
  try {
    const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    await sb.from('api_usage_logs').insert({
      service_type: params.service_type, action: params.action, model: params.model || null,
      total_cost: params.total_cost, unit_cost: params.total_cost,
      duration_seconds: params.duration_seconds || null, metadata: params.metadata || {},
    });
  } catch (e) { console.error('logUsage error:', e); }
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
     const { audioUrl, speakers_expected } = await req.json();
    
    if (!audioUrl) {
      throw new Error('URL do áudio não fornecida');
    }

    const assemblyAIKey = Deno.env.get('ASSEMBLYAI_API_KEY');
    if (!assemblyAIKey) {
      throw new Error('ASSEMBLYAI_API_KEY não configurada');
    }

    console.log('🎤 Iniciando speaker diarization com AssemblyAI...');
    console.log('📍 Audio URL:', audioUrl);

    // Step 1: Submit audio for transcription with speaker diarization
    console.log('📤 Submitting to AssemblyAI API...');
    const transcriptResponse = await fetch('https://api.assemblyai.com/v2/transcript', {
      method: 'POST',
      headers: {
        'Authorization': assemblyAIKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        audio_url: audioUrl,
        speaker_labels: true,
        speakers_expected: speakers_expected ? parseInt(speakers_expected) : undefined,
        language_code: 'pt',
      }),
    });
    
    console.log('📊 AssemblyAI Response Status:', transcriptResponse.status);

    if (!transcriptResponse.ok) {
      const errorText = await transcriptResponse.text();
      console.error('❌ Erro AssemblyAI:', errorText);
      throw new Error(`AssemblyAI API error: ${errorText}`);
    }

    const { id: transcriptId } = await transcriptResponse.json();
    console.log('✅ Transcrição enviada. ID:', transcriptId);
    console.log('⚙️ Configuração: speaker_labels=true, language=pt');

    // Step 2: Poll for completion
    let transcriptResult;
    let attempts = 0;
    const maxAttempts = 60; // 5 minutes max (5s intervals)

    while (attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds

      const statusResponse = await fetch(`https://api.assemblyai.com/v2/transcript/${transcriptId}`, {
        headers: {
          'Authorization': assemblyAIKey,
        },
      });

      if (!statusResponse.ok) {
        throw new Error('Erro ao verificar status da transcrição');
      }

      transcriptResult = await statusResponse.json();
      console.log(`📊 Status: ${transcriptResult.status} | Audio Duration: ${transcriptResult.audio_duration}s`);

      if (transcriptResult.status === 'completed') {
        console.log('✅ Transcrição completa!');
        break;
      } else if (transcriptResult.status === 'error') {
        throw new Error(`Erro na transcrição: ${transcriptResult.error}`);
      }

      attempts++;
    }

    if (attempts >= maxAttempts) {
      throw new Error('Timeout: transcrição demorou muito tempo');
    }

    // Step 3: Process utterances for natural phrase separation
    console.log('🔍 Utterances retornadas:', transcriptResult.utterances?.length || 0);
    
    const speakerMap = new Map<string, number>();
    let speakerCounter = 1;

    // Use utterances directly - they already have perfect speaker and phrase separation
    const segments = transcriptResult.utterances?.map((utterance: any) => {
      if (!utterance.speaker) return null;

      // Map AssemblyAI speaker IDs to sequential numbers
      if (!speakerMap.has(utterance.speaker)) {
        speakerMap.set(utterance.speaker, speakerCounter++);
      }

      return {
        speaker: `Pessoa ${speakerMap.get(utterance.speaker)}`,
        text: utterance.text,
        start: utterance.start,
        end: utterance.end,
        confidence: utterance.confidence,
      };
    }).filter(Boolean) || [];

    // Verify actual unique speakers in final segments
    const actualUniqueSpeakers = new Set(segments.map(seg => seg.speaker));
    
    console.log(`✅ Processado ${segments.length} segmentos com ${actualUniqueSpeakers.size} speakers únicos detectados`);
    console.log('👥 Speakers únicos nos segmentos finais:', Array.from(actualUniqueSpeakers));
    
    // Log speaker distribution for debugging
    const speakerCounts = new Map<string, number>();
    segments.forEach(seg => {
      speakerCounts.set(seg.speaker, (speakerCounts.get(seg.speaker) || 0) + 1);
    });
    console.log('📊 Distribuição de speakers:', Object.fromEntries(speakerCounts));

    // Log cost: AssemblyAI ~$0.65 per hour
    const audioDuration = transcriptResult.audio_duration || 0;
    const cost = (audioDuration / 3600) * 0.65;
    logUsage({
      service_type: 'assemblyai', action: 'speaker_diarization', model: 'assemblyai_v2',
      total_cost: cost, duration_seconds: audioDuration,
      metadata: { speaker_count: actualUniqueSpeakers.size, segments: segments.length },
    });

    return new Response(
      JSON.stringify({
        success: true,
        speakerCount: actualUniqueSpeakers.size,
        segments,
        fullText: transcriptResult.text,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('❌ Erro:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Erro desconhecido',
        success: false,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
