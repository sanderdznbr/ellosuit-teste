import { createClient } from "npm:@supabase/supabase-js@2";
import { EXTENDED_ACTIONS, handleExtendedAction } from './extended.ts';
import { handleApprovalReply } from './approval-reply.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-api-key, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

async function fetchJsonSafely(response: Response): Promise<{ ok: boolean; data?: any; error?: string }> {
  const contentType = response.headers.get('content-type') || '';
  const text = await response.text();

  if (contentType.includes('text/html') || text.trimStart().startsWith('<!DOCTYPE') || text.trimStart().startsWith('<html')) {
    return { ok: false, error: `Servidor retornou HTML em vez de JSON (status ${response.status}): ${text.substring(0, 200)}` };
  }

  try {
    const data = JSON.parse(text);
    return { ok: response.ok, data, error: response.ok ? undefined : text };
  } catch {
    return { ok: false, error: `Resposta inválida (status ${response.status}): ${text.substring(0, 200)}` };
  }
}

/**
 * Resolve o JID correto de um número usando o endpoint /api/number/check do Baileys.
 * Se o número não for encontrado e for brasileiro (55), tenta variações com/sem 9o dígito.
 */
async function resolveWhatsAppJid(
  baileysUrl: string,
  instanceName: string,
  phone: string
): Promise<{ success: true; jid: string } | { success: false; error: string }> {
  const cleanPhone = phone.replace(/\D/g, '');
  const checkUrl = `${baileysUrl}/api/number/check`;

  // Função auxiliar para verificar um número
  async function checkNumber(phoneToCheck: string): Promise<string | null> {
    try {
      const res = await fetch(checkUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ instanceName, phone: phoneToCheck }),
      });
      const result = await fetchJsonSafely(res);
      if (result.ok && result.data?.exists && result.data?.jid) {
        console.log(`[resolveJid] Número ${phoneToCheck} encontrado: ${result.data.jid}`);
        return result.data.jid;
      }
      return null;
    } catch (e) {
      console.error(`[resolveJid] Erro ao verificar ${phoneToCheck}: ${e}`);
      return null;
    }
  }

  // 1. Tentar o número original
  const originalJid = await checkNumber(cleanPhone);
  if (originalJid) return { success: true, jid: originalJid };

  // 2. Se brasileiro, tentar variação do 9o dígito
  if (cleanPhone.startsWith('55') && cleanPhone.length >= 12) {
    const ddd = cleanPhone.substring(2, 4);
    const rest = cleanPhone.substring(4);
    let altPhone: string | null = null;

    if (rest.length === 9 && rest.startsWith('9')) {
      altPhone = `55${ddd}${rest.substring(1)}`;
    } else if (rest.length === 8) {
      altPhone = `55${ddd}9${rest}`;
    }

    if (altPhone) {
      console.log(`[resolveJid] Tentando variação brasileira: ${altPhone}`);
      const altJid = await checkNumber(altPhone);
      if (altJid) return { success: true, jid: altJid };
    }
  }

  // 3. FALLBACK: se a validação falhou, enviar mesmo assim com o número original
  // Isso cobre casos de números com LID ou quando o endpoint /api/number/check não funciona corretamente
  const fallbackJid = `${cleanPhone}@s.whatsapp.net`;
  console.log(`[resolveJid] Validação não encontrou o número, usando fallback JID: ${fallbackJid}`);
  return { success: true, jid: fallbackJid };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // Internal route: client replies to post approvals, forwarded by whatsapp-webhook with the service key
  if (req.headers.get('x-internal-route') === 'approval-reply') {
    if (req.headers.get('Authorization') !== `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`) {
      return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    return await handleApprovalReply(supabase, await req.json(), SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  }

  const apiKey = req.headers.get('x-api-key');
  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'Missing X-API-Key header' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const { data: keyData, error: keyError } = await supabase
    .from('whatsapp_api_keys')
    .select('*, whatsapp_sessions(*)')
    .eq('api_key', apiKey)
    .eq('is_active', true)
    .single();

  if (keyError || !keyData) {
    return new Response(JSON.stringify({ error: 'Invalid or inactive API key' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 
             req.headers.get('x-real-ip') || 'unknown';

  const oneMinuteAgo = new Date(Date.now() - 60000).toISOString();
  const { count: recentCount } = await supabase
    .from('whatsapp_api_logs')
    .select('*', { count: 'exact', head: true })
    .eq('api_key_id', keyData.id)
    .gte('created_at', oneMinuteAgo);

  if ((recentCount || 0) >= keyData.rate_limit_per_minute) {
    await supabase.from('whatsapp_api_logs').insert({
      api_key_id: keyData.id, phone: 'N/A', status: 'rate_limited',
      error_message: `Exceeded ${keyData.rate_limit_per_minute} msgs/min`, ip_address: ip,
    });
    return new Response(JSON.stringify({ error: 'Rate limit exceeded', limit: keyData.rate_limit_per_minute, retry_after_seconds: 60 }), {
      status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const body = await req.json();
  const { action } = body;
  const session = keyData.whatsapp_sessions;

  switch (action) {
    case 'check_status': {
      const isConnected = session?.status === 'connected';
      return new Response(JSON.stringify({
        success: true, status: session?.status || 'unknown',
        is_connected: isConnected, phone_number: session?.phone_number,
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    case 'send_text': {
      const { phone, message } = body;
      if (!phone || !message) {
        return new Response(JSON.stringify({ error: 'phone and message are required' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      if (session?.status !== 'connected') {
        await supabase.from('whatsapp_api_logs').insert({
          api_key_id: keyData.id, phone, message_preview: message.substring(0, 100),
          status: 'failed', error_message: 'Session not connected', ip_address: ip,
        });
        return new Response(JSON.stringify({ error: 'WhatsApp session is not connected' }), {
          status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const preview = message.substring(0, 100);
      try {
        const r = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/whatsapp-api`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}` },
          body: JSON.stringify({ action: 'send_message', message, sessionId: keyData.session_id, companyId: keyData.company_id, phone: String(phone), aiEnabled: true, manualTakeover: false }),
        });
        const data = await r.json().catch(() => ({}));
        if (!r.ok || data?.error) {
          const errorDetail = String(data?.error || data?.details || `status ${r.status}`).substring(0, 500);
          await supabase.from('whatsapp_api_logs').insert({ api_key_id: keyData.id, phone: phone, message_preview: preview, status: 'failed', error_message: errorDetail, ip_address: ip });
          return new Response(JSON.stringify({ error: 'Failed to send', details: errorDetail }), { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
        await supabase.from('whatsapp_api_logs').insert({ api_key_id: keyData.id, phone: phone, message_preview: preview, status: 'sent', ip_address: ip });
        await supabase.from('whatsapp_api_keys').update({ total_messages_sent: (keyData.total_messages_sent || 0) + 1, last_used_at: new Date().toISOString() }).eq('id', keyData.id);
        const clean = String(phone).replace(/\D/g, '');
        const variants = [clean, `+${clean}`];
        if (clean.startsWith('55') && clean.length === 13) { const w = clean.slice(0, 4) + clean.slice(5); variants.push(w, `+${w}`); }
        else if (clean.startsWith('55') && clean.length === 12) { const w = clean.slice(0, 4) + '9' + clean.slice(4); variants.push(w, `+${w}`); }
        await supabase.from('whatsapp_conversations').update({ api_managed: true }).eq('company_id', keyData.company_id).in('contact_phone', variants);
        const messageId = data?.messageId || data?.message_id || data?.key?.id || data?.data?.key?.id || null;
        return new Response(JSON.stringify({ success: true, message_id: messageId }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      } catch (e) {
        const errMsg = e instanceof Error ? e.message : String(e);
        await supabase.from('whatsapp_api_logs').insert({ api_key_id: keyData.id, phone: phone, message_preview: preview, status: 'failed', error_message: errMsg, ip_address: ip });
        return new Response(JSON.stringify({ error: 'Internal error', details: errMsg }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
    }

    case 'send_media': {
      const { phone: mediaPhone, media_url, caption, media_type } = body;
      if (!mediaPhone || !media_url) {
        return new Response(JSON.stringify({ error: 'phone and media_url are required' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      if (session?.status !== 'connected') {
        await supabase.from('whatsapp_api_logs').insert({
          api_key_id: keyData.id, phone: mediaPhone,
          message_preview: `[media] ${caption || media_url}`.substring(0, 100),
          status: 'failed', error_message: 'Session not connected', ip_address: ip,
        });
        return new Response(JSON.stringify({ error: 'WhatsApp session is not connected' }), {
          status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const preview = `[${media_type || 'media'}] ${caption || media_url}`.substring(0, 100);
      try {
        const r = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/whatsapp-api`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}` },
          body: JSON.stringify({ action: 'send_media', mediaUrl: media_url, mediaType: media_type || 'image', caption: caption || '', sessionId: keyData.session_id, companyId: keyData.company_id, phone: String(mediaPhone), aiEnabled: true, manualTakeover: false }),
        });
        const data = await r.json().catch(() => ({}));
        if (!r.ok || data?.error) {
          const errorDetail = String(data?.error || data?.details || `status ${r.status}`).substring(0, 500);
          await supabase.from('whatsapp_api_logs').insert({ api_key_id: keyData.id, phone: mediaPhone, message_preview: preview, status: 'failed', error_message: errorDetail, ip_address: ip });
          return new Response(JSON.stringify({ error: 'Failed to send', details: errorDetail }), { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
        await supabase.from('whatsapp_api_logs').insert({ api_key_id: keyData.id, phone: mediaPhone, message_preview: preview, status: 'sent', ip_address: ip });
        await supabase.from('whatsapp_api_keys').update({ total_messages_sent: (keyData.total_messages_sent || 0) + 1, last_used_at: new Date().toISOString() }).eq('id', keyData.id);
        const clean = String(mediaPhone).replace(/\D/g, '');
        const variants = [clean, `+${clean}`];
        if (clean.startsWith('55') && clean.length === 13) { const w = clean.slice(0, 4) + clean.slice(5); variants.push(w, `+${w}`); }
        else if (clean.startsWith('55') && clean.length === 12) { const w = clean.slice(0, 4) + '9' + clean.slice(4); variants.push(w, `+${w}`); }
        await supabase.from('whatsapp_conversations').update({ api_managed: true }).eq('company_id', keyData.company_id).in('contact_phone', variants);
        const messageId = data?.messageId || data?.message_id || data?.key?.id || data?.data?.key?.id || null;
        return new Response(JSON.stringify({ success: true, message_id: messageId }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      } catch (e) {
        const errMsg = e instanceof Error ? e.message : String(e);
        await supabase.from('whatsapp_api_logs').insert({ api_key_id: keyData.id, phone: mediaPhone, message_preview: preview, status: 'failed', error_message: errMsg, ip_address: ip });
        return new Response(JSON.stringify({ error: 'Internal error', details: errMsg }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
    }

    default: {
      if (EXTENDED_ACTIONS.includes(action)) {
        const result: any = await handleExtendedAction(supabase, keyData, body, {
          url: Deno.env.get('SUPABASE_URL')!, key: Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
        });
        const status = result?.__status || 200;
        if (result) delete result.__status;
        await supabase.from('whatsapp_api_keys').update({ last_used_at: new Date().toISOString() }).eq('id', keyData.id);
        return new Response(JSON.stringify(result), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
    }
    // falls through
      return new Response(JSON.stringify({ 
        error: 'Unknown action', 
        available_actions: ['send_text', 'send_media', 'check_status', ...EXTENDED_ACTIONS] 
      }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
  }
});
