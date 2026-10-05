import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Official Ellosuit WhatsApp channel — used for all system codes (signup, password reset, etc.)
const OFFICIAL_PHONE_NUMBER = '554189015612';

function generateCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { phone } = await req.json();

    if (!phone) {
      return new Response(JSON.stringify({ error: 'Telefone é obrigatório' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const cleanPhone = phone.replace(/\D/g, '');
    const code = generateCode();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    // Store code in DB
    await supabase.from('phone_verifications').insert({
      phone: cleanPhone,
      code,
      expires_at: expiresAt,
    });

    // Pick the OFFICIAL Ellosuit channel (554189015612) — this is the system number.
    // If it's not connected for some reason, fall back to any connected session.
    let { data: sessions } = await supabase
      .from('whatsapp_sessions')
      .select('id, instance_name, baileys_server_url, status, phone_number')
      .eq('phone_number', OFFICIAL_PHONE_NUMBER)
      .eq('status', 'connected')
      .limit(1);

    if (!sessions || sessions.length === 0) {
      console.warn(`[VERIFY] Official channel ${OFFICIAL_PHONE_NUMBER} not connected. Falling back.`);
      const fallback = await supabase
        .from('whatsapp_sessions')
        .select('id, instance_name, baileys_server_url, status, phone_number')
        .eq('status', 'connected')
        .order('updated_at', { ascending: false })
        .limit(1);
      sessions = fallback.data;
    }

    const session = sessions?.[0];
    if (!session) {
      console.error('[VERIFY] No connected WhatsApp session found');
      return new Response(JSON.stringify({ error: 'Nenhuma sessão WhatsApp disponível. Tente novamente mais tarde.' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Format phone - add Brazil country code if missing
    let phoneForJid = cleanPhone;
    if (phoneForJid.length <= 11 && !phoneForJid.startsWith('55')) {
      phoneForJid = '55' + phoneForJid;
    }

    const messageText = `🔐 *Código de verificação Ellosuit*\n\nSeu código é: *${code}*\n\nEle é válido por 10 minutos.\n\nSe você não solicitou este código, ignore esta mensagem.`;

    // Send via Evolution API
    const EVOLUTION_API_URL = Deno.env.get('EVOLUTION_API_URL') || (session.baileys_server_url ?? '');
    const EVOLUTION_API_KEY = Deno.env.get('EVOLUTION_API_KEY') || '';
    const trimmedUrl = EVOLUTION_API_URL.trim().replace(/\/+$/, '');
    const normalizedUrl = !trimmedUrl
      ? ''
      : (/^https?:\/\//i.test(trimmedUrl) ? trimmedUrl : `https://${trimmedUrl}`);

    if (!normalizedUrl) {
      console.error('[VERIFY] No Evolution API URL configured');
      return new Response(JSON.stringify({ error: 'Servidor WhatsApp não configurado.' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`[VERIFY] Sending code to ${phoneForJid} via official channel ${session.phone_number} (${session.instance_name})`);

    const sendResponse = await fetch(`${normalizedUrl}/message/sendText/${session.instance_name}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': EVOLUTION_API_KEY,
      },
      body: JSON.stringify({
        number: phoneForJid,
        text: messageText,
      }),
    });

    const responseText = await sendResponse.text();
    console.log(`[VERIFY] Evolution response: ${sendResponse.status} - ${responseText}`);

    if (!sendResponse.ok) {
      console.error(`[VERIFY] Failed to send WhatsApp message:`, responseText);
      return new Response(JSON.stringify({ error: 'Falha ao enviar código via WhatsApp.' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ success: true, message: 'Código enviado via WhatsApp' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[VERIFY] Error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
