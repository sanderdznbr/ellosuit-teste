// TURN Config

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RTCIceServerConfig {
  urls: string | string[];
  username?: string;
  credential?: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Build ICE servers configuration
    const iceServers: RTCIceServerConfig[] = [
      // Always include STUN servers
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' }
    ];

    // Add TURN servers if configured
    const turnUrls = Deno.env.get('TURN_URLS');
    const turnUsername = Deno.env.get('TURN_USERNAME');
    const turnCredential = Deno.env.get('TURN_CREDENTIAL');

    if (turnUrls && turnUsername && turnCredential) {
      const urls = turnUrls.split(',').map(url => url.trim());
      
      // Add TURN servers with credentials
      iceServers.push({
        urls: urls,
        username: turnUsername,
        credential: turnCredential
      });
      
      console.log('🔧 TURN servers configured:', urls);
    } else {
      console.log('⚠️ TURN servers not configured, using STUN only');
    }

    return new Response(JSON.stringify({ 
      iceServers 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('❌ Error in turn-config function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return new Response(JSON.stringify({ 
      error: errorMessage 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});