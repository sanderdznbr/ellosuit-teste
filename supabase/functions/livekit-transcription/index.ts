// LiveKit Transcription

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, roomName, trackId } = await req.json();
    
    const livekitUrl = Deno.env.get('LIVEKIT_URL');
    const apiKey = Deno.env.get('LIVEKIT_API_KEY');
    const apiSecret = Deno.env.get('LIVEKIT_API_SECRET');
    const deepgramKey = Deno.env.get('DEEPGRAM_API_KEY');

    if (!livekitUrl || !apiKey || !apiSecret) {
      throw new Error('LiveKit credentials not configured');
    }

    if (!deepgramKey) {
      throw new Error('Deepgram API key not configured');
    }

    const livekitHost = livekitUrl.replace('wss://', '').replace('ws://', '');

    if (action === 'start') {
      console.log('🎤 Starting LiveKit transcription for room:', roomName);
      
      // Start transcription using LiveKit API
      const egressUrl = `https://${livekitHost}/twirp/livekit.Egress/StartTrackCompositeEgress`;
      
      const response = await fetch(egressUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}:${apiSecret}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          room_name: roomName,
          audio_only: true,
          file_outputs: [],
          segment_outputs: [],
          image_outputs: [],
          audio_track_id: trackId,
        })
      });

      if (!response.ok) {
        const error = await response.text();
        console.error('LiveKit transcription error:', error);
        throw new Error(`Failed to start transcription: ${error}`);
      }

      const data = await response.json();
      console.log('✅ Transcription started:', data);

      return new Response(JSON.stringify({ 
        success: true,
        egress_id: data.egress_id 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });

    } else if (action === 'stop') {
      console.log('🛑 Stopping LiveKit transcription');
      
      return new Response(JSON.stringify({ 
        success: true 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    throw new Error('Invalid action');

  } catch (error) {
    console.error('Error in livekit-transcription:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
