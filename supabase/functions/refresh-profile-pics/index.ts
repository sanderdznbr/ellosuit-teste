import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const EVOLUTION_API_URL_RAW = (Deno.env.get('EVOLUTION_API_URL') || '').trim();
const EVOLUTION_API_URL = EVOLUTION_API_URL_RAW
  ? (/^https?:\/\//i.test(EVOLUTION_API_URL_RAW)
      ? EVOLUTION_API_URL_RAW.replace(/\/+$/, '')
      : `https://${EVOLUTION_API_URL_RAW.replace(/\/+$/, '')}`)
  : '';
const EVOLUTION_API_KEY = Deno.env.get('EVOLUTION_API_KEY') || '';

Deno.serve(async (req) => {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  
  try {
    console.log("🚀 [PIC-REFRESH] Starting automatic profile picture refresh...");
    
    // Find sessions that are connected
    const { data: sessions } = await supabase
      .from('whatsapp_sessions')
      .select('id, instance_name, baileys_server_url')
      .eq('status', 'connected');
      
    if (!sessions || sessions.length === 0) {
      return new Response("No connected sessions", { status: 200 });
    }
    
    let totalRefreshed = 0;
    
    for (const session of sessions) {
      const baseUrl = (session.baileys_server_url || EVOLUTION_API_URL || '').trim();
      const evoUrl = baseUrl
        ? (/^https?:\/\//i.test(baseUrl)
            ? baseUrl.replace(/\/+$/, '')
            : `https://${baseUrl.replace(/\/+$/, '')}`)
        : '';
      if (!evoUrl) continue;
      
      // Get conversations for this session that might need a pic
      const { data: convs } = await supabase
        .from('whatsapp_conversations')
        .select('id, contact_phone, remote_jid, profile_picture')
        .eq('session_id', session.id)
        .order('last_message_at', { ascending: false })
        .limit(20); // Only refresh active ones to avoid rate limits
        
      if (!convs) continue;
      
      for (const conv of convs) {
        try {
          const jid = conv.remote_jid || (conv.contact_phone.includes('-') ? `${conv.contact_phone}@g.us` : `${conv.contact_phone}@s.whatsapp.net`);
          
          const r = await fetch(`${evoUrl}/chat/findContacts/${session.instance_name}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'apikey': EVOLUTION_API_KEY },
            body: JSON.stringify({ where: { remoteJid: jid } }),
          });
          
          if (r.ok) {
            const list = await r.json();
            const contact = Array.isArray(list) ? list[0] : (list?.data?.[0] || list);
            const pic = contact?.profilePicture || contact?.imgUrl;
            
            if (pic && pic !== conv.profile_picture) {
              await supabase.from('whatsapp_conversations').update({ profile_picture: pic }).eq('id', conv.id);
              totalRefreshed++;
            }
          }
        } catch (e) {
          console.error(`Error refreshing pic for ${conv.contact_phone}:`, e);
        }
      }
    }
    
    return new Response(JSON.stringify({ success: true, refreshed: totalRefreshed }), {
      headers: { "Content-Type": "application/json" }
    });
  } catch (error) {
    console.error("PIC-REFRESH Error:", error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
});
