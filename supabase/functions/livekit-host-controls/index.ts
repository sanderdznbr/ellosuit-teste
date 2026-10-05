import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Generate LiveKit admin JWT (roomAdmin grant)
async function generateAdminToken(apiKey: string, apiSecret: string, roomName: string): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: apiKey,
    sub: 'host-controls',
    iat: now,
    exp: now + 600,
    video: { roomAdmin: true, room: roomName },
  };
  const header = { alg: 'HS256', typ: 'JWT' };
  const enc = (o: any) => btoa(String.fromCharCode(...new TextEncoder().encode(JSON.stringify(o))))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  const data = `${enc(header)}.${enc(payload)}`;
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(apiSecret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data));
  const sigB64 = btoa(String.fromCharCode(...new Uint8Array(sig)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  return `${data}.${sigB64}`;
}

function httpUrl(livekitUrl: string): string {
  let u = livekitUrl.trim();
  if (u.startsWith('wss://')) u = 'https://' + u.slice(6);
  else if (u.startsWith('ws://')) u = 'http://' + u.slice(5);
  else if (!u.startsWith('http')) u = 'https://' + u;
  return u.replace(/\/$/, '');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('Auth required');
    const { data: { user } } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
    if (!user) throw new Error('Invalid auth');

    const { action, roomName, identity, trackSid, mute } = await req.json();
    if (!action || !roomName || !identity) throw new Error('Missing params');

    // Verify caller is the host of this room
    const { data: room } = await supabase
      .from('meeting_rooms').select('id, created_by').eq('room_code', roomName).single();
    if (!room || room.created_by !== user.id) throw new Error('Only host can perform this action');

    const livekitUrl = (Deno.env.get('LIVEKIT_URL') || '').trim();
    const apiKey = Deno.env.get('LIVEKIT_API_KEY')!;
    const apiSecret = Deno.env.get('LIVEKIT_API_SECRET')!;
    const token = await generateAdminToken(apiKey, apiSecret, roomName);
    const base = httpUrl(livekitUrl);

    let endpoint = '';
    let body: any = {};
    if (action === 'kick') {
      endpoint = '/twirp/livekit.RoomService/RemoveParticipant';
      body = { room: roomName, identity };
    } else if (action === 'mute') {
      if (!trackSid) throw new Error('trackSid required');
      endpoint = '/twirp/livekit.RoomService/MutePublishedTrack';
      body = { room: roomName, identity, track_sid: trackSid, muted: !!mute };
    } else {
      throw new Error('Unknown action');
    }

    const res = await fetch(base + endpoint, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const text = await res.text();
    if (!res.ok) throw new Error(`LiveKit ${res.status}: ${text}`);

    return new Response(JSON.stringify({ ok: true, result: text }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('host-controls error', e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : 'error' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});