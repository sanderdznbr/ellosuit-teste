import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// LiveKit JWT Token implementation (compatible with LiveKit server SDK)
class LiveKitAccessToken {
  private apiKey: string;
  private apiSecret: string;
  private identity: string;
  private name?: string;
  private ttl: string;
  private grants: any = {};

  constructor(apiKey: string, apiSecret: string, options: { identity: string; name?: string; ttl: string }) {
    this.apiKey = apiKey;
    this.apiSecret = apiSecret;
    this.identity = options.identity;
    this.name = options.name;
    this.ttl = options.ttl;
  }

  addGrant(grant: any) {
    this.grants = { ...this.grants, ...grant };
  }

  async toJwt(): Promise<string> {
    const now = Math.floor(Date.now() / 1000);
    const exp = now + this.parseTTL(this.ttl);

    const header = {
      alg: 'HS256',
      typ: 'JWT'
    };

    const payload = {
      iss: this.apiKey,
      sub: this.identity,
      name: this.name,
      iat: now,
      exp: exp,
      video: this.grants
    };

    const encodedHeader = this.base64UrlEncode(JSON.stringify(header));
    const encodedPayload = this.base64UrlEncode(JSON.stringify(payload));
    const signature = await this.sign(`${encodedHeader}.${encodedPayload}`, this.apiSecret);

    return `${encodedHeader}.${encodedPayload}.${signature}`;
  }

  private parseTTL(ttl: string): number {
    if (ttl.endsWith('h')) {
      return parseInt(ttl) * 3600;
    }
    if (ttl.endsWith('m')) {
      return parseInt(ttl) * 60;
    }
    return parseInt(ttl);
  }

  private base64UrlEncode(str: string): string {
    const encoder = new TextEncoder();
    const data = encoder.encode(str);
    return btoa(String.fromCharCode(...data))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
  }

  private async sign(data: string, secret: string): Promise<string> {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    
    const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(data));
    return btoa(String.fromCharCode(...new Uint8Array(signature)))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Optional auth: if provided, we'll use the user id, otherwise join as guest
    const authHeader = req.headers.get('Authorization');
    let userId: string | null = null;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const { data: { user } } = await supabaseClient.auth.getUser(
        authHeader.replace('Bearer ', '')
      );
      userId = user?.id ?? null;
    }

    const { roomName, participantName } = await req.json();
    
    if (!roomName) {
      throw new Error('roomName is required');
    }

    if (!participantName || participantName.trim() === '') {
      throw new Error('participantName is required');
    }

    // Validate room exists and is active
    const { data: room, error: roomError } = await supabaseClient
      .from('meeting_rooms')
      .select('id, is_active, ended_at')
      .eq('room_code', roomName)
      .single();

    if (roomError || !room) {
      throw new Error('Sala não encontrada');
    }

    if (!room.is_active) {
      throw new Error('Sala inativa');
    }

    console.log('Generating token for:', { roomName, participantName, userId: userId ?? 'guest' });

    let livekitUrl = (Deno.env.get('LIVEKIT_URL') || '').trim();
    const apiKey = Deno.env.get('LIVEKIT_API_KEY');
    const apiSecret = Deno.env.get('LIVEKIT_API_SECRET');

    if (!livekitUrl || !apiKey || !apiSecret) {
      throw new Error('LiveKit credentials not configured');
    }

    // Ensure the URL has a valid protocol prefix
    if (!livekitUrl.startsWith('wss://') && !livekitUrl.startsWith('https://')) {
      livekitUrl = `wss://${livekitUrl}`;
    }
    
    console.log('🌐 LiveKit URL being used:', livekitUrl);

    // Create unique identity to prevent conflicts (even for authenticated users)
    const identity = userId ? `${userId}-${crypto.randomUUID()}` : `guest-${crypto.randomUUID()}`;
    const displayName = participantName.trim();

    console.log('Creating token with identity:', identity, 'name:', displayName);

    const at = new LiveKitAccessToken(apiKey, apiSecret, {
      identity,
      name: displayName, // Use the actual name entered by the user
      ttl: '8760h', // ~1 year for practical "no expiry"
    });

    at.addGrant({
      roomJoin: true,
      room: roomName,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
    });

    const token = await at.toJwt();

    console.log('Token generated successfully for:', displayName, 'in room:', roomName);

    return new Response(JSON.stringify({ 
      token,
      url: livekitUrl,
      roomName,
      participantName: displayName,
      userId: identity
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error generating LiveKit token:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});