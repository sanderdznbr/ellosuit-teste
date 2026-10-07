import { createClient } from "npm:@supabase/supabase-js@2";

async function encodeQrToDataUrl(text: string): Promise<string | null> {
  try {
    const mod: any = await import("npm:qrcode@1.5.4");
    const QRCode = mod?.default ?? mod;
    return await QRCode.toDataURL(text, { margin: 2, width: 360 });
  } catch (_e) {
    try {
      const res = await fetch(
        `https://api.qrserver.com/v1/create-qr-code/?size=360x360&data=${encodeURIComponent(text)}`,
      );
      if (!res.ok) return null;
      const buf = new Uint8Array(await res.arrayBuffer());
      let binary = '';
      for (let i = 0; i < buf.length; i += 8192) {
        binary += String.fromCharCode(...buf.subarray(i, i + 8192));
      }
      return `data:image/png;base64,${btoa(binary)}`;
    } catch {
      return null;
    }
  }
}

function normalizeEvolutionBaseUrl(value: string): string {
  const trimmed = (value || '').trim().replace(/\/+$/, '');
  if (!trimmed) return '';
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

 // URL e API Key da instância Evolution API (sem fallbacks mortos)
const DEFAULT_EVOLUTION_URL = 'https://evolution-api-production-5eeb.up.railway.app';
const EVOLUTION_API_URL = normalizeEvolutionBaseUrl(Deno.env.get('EVOLUTION_API_URL') || DEFAULT_EVOLUTION_URL);
const EVOLUTION_API_KEY = (Deno.env.get('EVOLUTION_API_KEY') || '').trim();

// Anti-flood: última recriação de instância por sessão
const recreateCooldown = new Map<string, number>();
 const WEBHOOK_URL = `${Deno.env.get('SUPABASE_URL')}/functions/v1/whatsapp-webhook`;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

/**
 * Valida o JWT do chamador e exige que ele seja proprietário da sessão.
 * Mesmo com verify_jwt = false (padrão do projeto), o RLS da empresa existe — o que
 * hoje protege apenas a escrita no banco, não a leitura de QRs e a reconexão de dispositivos.
 * Assinaturas reais do Supabase sempre vêm do domínio do projeto e não acionam aqui.
 */
async function requireSessionOwner(supabase: any, sessionId: string, caller: any): Promise<void | Response> {
  if (!sessionId) return undefined;
  if (!caller || !caller.app_metadata || !caller.app_metadata.installation_id) {
    return new Response(JSON.stringify({ error: 'Não autorizado: faça a chamada pelo app (WhatsAppCRM), não diretamente.' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  const { data: sessionRow } = await supabase
    .from('whatsapp_sessions')
    .select('id, company_id, user_id')
    .eq('id', sessionId)
    .maybeSingle();

  if (!sessionRow) {
    return new Response(JSON.stringify({ error: 'Sessão não encontrada' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  // Só quem tem user_id == caller uid (ou admin do projeto) toca na sessão do empresa.
  if (sessionRow.user_id !== caller?.id) {
    // adm master pode administrar sessões de qualquer empresa (só read-only de QR).
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', caller?.id)
      .maybeSingle();
    if ((profile?.role as string) !== 'adminmaster') {
      return new Response(JSON.stringify({ error: 'Não autorizado: sessão pertence a outro usuário' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
  }

  return undefined;
}

const PAIRING_STABILIZATION_MS = 15 * 60 * 1000;

function normalizeContactPhone(input: string): string {
  const digits = (input || '').replace(/\D/g, '');
  if (!digits) return '';

  // Keep group identifiers untouched
  if (digits.length >= 18) return digits;

  let normalized = digits;
  if (!normalized.startsWith('55') && normalized.length <= 11) {
    normalized = `55${normalized}`;
  }

  // Keep original form to allow buildPhoneVariants to try both (with/without 9)

  return normalized;
}

function buildPhoneVariants(normalizedPhone: string): string[] {
  if (!normalizedPhone) return [];

  const variants = new Set<string>([normalizedPhone]);
  if (normalizedPhone.startsWith('55') && normalizedPhone.length === 13) {
    variants.add(normalizedPhone.slice(0, 4) + normalizedPhone.slice(5));
  }
  if (normalizedPhone.startsWith('55') && normalizedPhone.length === 12) {
    variants.add(normalizedPhone.slice(0, 4) + '9' + normalizedPhone.slice(4));
  }

  return Array.from(variants);
}

async function fetchWithTimeout(input: string, init: RequestInit = {}, timeoutMs = 10000): Promise<Response> {
  try {
    return await fetch(input, {
      ...init,
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (error: any) {
    const timedOut = error?.name === 'TimeoutError' || error?.name === 'AbortError';
    if (timedOut) {
      return new Response(JSON.stringify({
        error: 'Evolution request timeout',
        details: `Timeout após ${Math.round(timeoutMs / 1000)}s`,
      }), { status: 504, headers: { 'Content-Type': 'application/json' } });
    }
    throw error;
  }
}

async function extractQrCodeDataUrl(data: any): Promise<string | null> {
  const explicitImage = data?.base64 || data?.qrcode?.base64 || data?.qrcode?.base64Image || data?.qrCode;
  if (typeof explicitImage === 'string' && explicitImage.trim()) {
    const image = explicitImage.trim();
    return image.startsWith('data:image') ? image : `data:image/png;base64,${image}`;
  }

  const rawCode = data?.code || data?.qr || data?.qrcode?.code || data?.data?.code;
  if (typeof rawCode === 'string' && rawCode.trim()) {
    const code = rawCode.trim();
    if (code.startsWith('data:image')) return code;
    return await encodeQrToDataUrl(code);
  }

  return null;
}

async function markHumanTakeoverForRelatedConversations(supabase: any, params: {
  companyId: string;
  conversationId?: string | null;
  phoneVariants?: string[];
  remoteJid?: string | null;
  sessionId?: string | null;
  lastMessage?: string | null;
  messageDbId?: string | null;
  reason: string;
}) {
  const { companyId, conversationId, phoneVariants = [], remoteJid, sessionId, lastMessage, messageDbId, reason } = params;
  const ids = new Set<string>();
  if (conversationId) ids.add(conversationId);

  const cleanPhones = Array.from(new Set(
    (phoneVariants || []).filter(Boolean).map((p) => String(p).replace(/\D/g, ''))
  ));

  if (cleanPhones.length > 0) {
    const { data } = await supabase
      .from('whatsapp_conversations')
      .select('id')
      .eq('company_id', companyId)
      .in('contact_phone', cleanPhones);
    (data || []).forEach((row: any) => row?.id && ids.add(row.id));
  }

  if (remoteJid) {
    const { data } = await supabase
      .from('whatsapp_conversations')
      .select('id')
      .eq('company_id', companyId)
      .eq('remote_jid', remoteJid);
    (data || []).forEach((row: any) => row?.id && ids.add(row.id));
  }

  const targetIds = Array.from(ids);
  if (targetIds.length === 0) return;

  // HARD GUARD: nunca marcar human_takeover em conversas do "Pai do Piloto".
  // Se qualquer telefone/conversa envolvida for um parent_phone configurado, aborta.
  try {
    const { data: parents } = await supabase
      .from('crm_autopilot_configs')
      .select('parent_phone')
      .eq('company_id', companyId);
    const parentPhones = new Set(
      (parents || [])
        .map((r: any) => String(r?.parent_phone || '').replace(/\D/g, ''))
        .filter(Boolean),
    );
    if (parentPhones.size > 0) {
      const phoneHit = cleanPhones.some((p) => parentPhones.has(p));
      let convHit = false;
      if (!phoneHit && targetIds.length > 0) {
        const { data: convs } = await supabase
          .from('whatsapp_conversations')
          .select('contact_phone')
          .in('id', targetIds);
        convHit = (convs || []).some((c: any) =>
          parentPhones.has(String(c?.contact_phone || '').replace(/\D/g, '')),
        );
      }
      if (phoneHit || convHit) {
        console.log('[HUMAN-TAKEOVER] Skipped — target is a Pai do Piloto number');
        return;
      }
    }
  } catch (e) {
    console.warn('[HUMAN-TAKEOVER] parent-guard check failed', e);
  }

  const nowIso = new Date().toISOString();
  await supabase
    .from('chatbot_executions')
    .update({ status: 'stopped', completed_at: nowIso })
    .in('conversation_id', targetIds)
    .eq('status', 'running');

  const updateData: Record<string, unknown> = {
    human_takeover: true,
    human_takeover_at: nowIso,
    human_takeover_reason: reason,
    last_human_interaction_at: nowIso,
    ai_auto_reply_enabled: false,
  };
  if (sessionId) updateData.session_id = sessionId;
  if (lastMessage != null) {
    updateData.last_message = lastMessage;
    updateData.last_message_at = nowIso;
  }
  if (remoteJid) updateData.remote_jid = remoteJid;
  if (messageDbId) updateData.last_human_interaction_message_id = messageDbId;

  await supabase
    .from('whatsapp_conversations')
    .update(updateData)
    .in('id', targetIds);

  console.log(`[HUMAN-TAKEOVER] Stopped automations for ${targetIds.length} related conversation row(s)`);
}

async function evolutionInstanceExists(instanceName: string): Promise<boolean> {
  try {
    const r = await fetchWithTimeout(`${EVOLUTION_API_URL}/instance/fetchInstances?instanceName=${encodeURIComponent(instanceName)}`, {
      headers: { 'apikey': EVOLUTION_API_KEY }
    }, 8000);
    if (!r.ok) return false;
    const list = await r.json().catch(() => []);
    const arr = Array.isArray(list) ? list : [list];
    return arr.some((i: any) => (i?.name || i?.instance?.instanceName || i?.instanceName) === instanceName);
  } catch {
    return false;
  }
}

async function deleteEvolutionInstance(instanceName: string) {
  for (const path of [`/instance/logout/${instanceName}`, `/instance/delete/${instanceName}`]) {
    try {
      const r = await fetchWithTimeout(`${EVOLUTION_API_URL}${path}`, {
        method: 'DELETE',
        headers: { 'apikey': EVOLUTION_API_KEY },
      }, 8000);
      console.log(`[CLEANUP] ${path} -> ${r.status}`);
    } catch (e) {
      console.log(`[CLEANUP] ${path} falhou: ${String((e as any)?.message || e)}`);
    }
  }
}

async function createEvolutionInstanceForSession(session: any, forceCreate = false): Promise<{ status: number; body: string }> {
  const webhookSecret = session.webhook_secret || crypto.randomUUID();
  const createBody = {
    instanceName: session.instance_name,
    token: webhookSecret,
    integration: "WHATSAPP-BAILEYS",
    qrcode: true,
    // Evolution API v2 nested webhook object
    webhook: {
      url: WEBHOOK_URL,
      byEvents: true,
      base64: true,
      events: ["QRCODE_UPDATED", "MESSAGES_SET", "MESSAGES_UPSERT", "CONNECTION_UPDATE", "CHATS_SET", "CHATS_UPSERT"],
    },
  };

  console.log(`[CREATE] Ensuring Evolution instance ${session.instance_name}`);

  if (!forceCreate && await evolutionInstanceExists(session.instance_name)) {
    console.log(`[CREATE] Instance ${session.instance_name} already exists. checking health...`);
    const state = await getEvolutionInstanceState(session.instance_name);
    if (state === 'open' || state === 'connecting') {
      console.log(`[CREATE] Instance ${session.instance_name} is already ${state}. Reusing.`);
      await ensureEvolutionWebhook(session.instance_name);
      return { status: 200, body: JSON.stringify({ reused: true, state }) };
    }
    console.log(`[CREATE] Instance ${session.instance_name} exists but state is ${state}. Recreating to ensure clean QR.`);
    forceCreate = true;
  }

  if (forceCreate) {
    // Remove qualquer resíduo antes de recriar (ignora erros)
    await deleteEvolutionInstance(session.instance_name);
  }

  const res = await fetchWithTimeout(`${EVOLUTION_API_URL}/instance/create`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'apikey': EVOLUTION_API_KEY },
    body: JSON.stringify(createBody)
  }, 30000);
  const body = await res.text().catch(() => '');
  console.log(`[CREATE] ${session.instance_name} -> status=${res.status} body=${body.slice(0, 400)}`);
  if (res.ok) await ensureEvolutionWebhook(session.instance_name);
  return { status: res.status, body };
}

// Guarantees the webhook is configured for a given instance (Evolution API v2)
async function ensureEvolutionWebhook(instanceName: string) {
  try {
    const body = {
      webhook: {
        enabled: true,
        url: WEBHOOK_URL,
        byEvents: true,
        base64: true,
        events: ["QRCODE_UPDATED", "MESSAGES_SET", "MESSAGES_UPSERT", "CONNECTION_UPDATE", "CHATS_SET", "CHATS_UPSERT"],
      }
    };
    const r = await fetch(`${EVOLUTION_API_URL}/webhook/set/${instanceName}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': EVOLUTION_API_KEY },
      body: JSON.stringify(body),
    });
    const txt = await r.text();
    console.log(`[WEBHOOK] set ${instanceName} -> ${r.status} ${txt.slice(0, 200)}`);
  } catch (e) {
    console.error('[WEBHOOK] Falha ao configurar webhook:', e);
  }
}

// Retorna o estado atual da instância no Evolution: 'open' | 'connecting' | 'close' | 'missing' | 'unknown'
async function getEvolutionInstanceState(instanceName: string, timeoutMs = 1500): Promise<string> {
  try {
    const resp = await fetchWithTimeout(`${EVOLUTION_API_URL}/instance/connectionState/${instanceName}`, {
      headers: { 'apikey': EVOLUTION_API_KEY }
    }, timeoutMs);
    if (resp.status === 404) return 'missing';
    const data = await resp.json().catch(() => ({}));
    const state = data?.instance?.state || data?.state;
    if (typeof state === 'string') return state;
    const txt = JSON.stringify(data || {});
    if (resp.status === 404 || txt.includes('does not exist')) return 'missing';
    return 'unknown';
  } catch (e) {
    console.error('[STATE] Erro ao consultar connectionState:', e);
    return 'unknown';
  }
}

/**
 * O logot/delete do Evolution é assíncrono: o `instance/create` logo em seguida
 * falha com "This name \"x\" is already in use". Espera a instância desaparecer.
 */
async function waitForInstanceGone(instanceName: string, timeoutMs = 25000): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if ((await getEvolutionInstanceState(instanceName)) === 'missing') return true;
    await new Promise((r) => setTimeout(r, 1000));
  }
  return (await getEvolutionInstanceState(instanceName)) === 'missing';
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    
    const body = await req.json();
     const { action, sessionId, instanceName, companyId, userId, phone, message, baileysServerUrl, aiEnabled, aiAgentId, conversationId, manualTakeover } = body;
    
     console.log(`[WhatsApp API] Action: ${action}, Instance: ${instanceName || sessionId}, API: Evolution`);

    switch (action) {
      // ==================== DIAGNOSE ====================
      case 'diagnose': {
        const probe = async (path: string, init: RequestInit = {}) => {
          try {
            const r = await fetchWithTimeout(`${EVOLUTION_API_URL}${path}`, {
              ...init,
              headers: { 'apikey': EVOLUTION_API_KEY, 'Content-Type': 'application/json', ...(init.headers || {}) },
            }, 15000);
            const txt = await r.text().catch(() => '');
            return { path, status: r.status, body: txt.slice(0, 300) };
          } catch (e: any) {
            return { path, status: 0, body: String(e?.message || e) };
          }
        };

        const results = [
          await probe('/'),
          await probe('/instance/fetchInstances'),
        ];

        return new Response(JSON.stringify({
          baseUrl: EVOLUTION_API_URL,
          hasApiKey: EVOLUTION_API_KEY.length > 0,
          apiKeyLength: EVOLUTION_API_KEY.length,
          webhookUrl: WEBHOOK_URL,
          results,
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      // ==================== CREATE INSTANCE ====================
       case 'create_instance': {
         if (!instanceName || !companyId || !userId) {
           return new Response(JSON.stringify({ error: 'instanceName, companyId e userId são obrigatórios' }), { status: 400, headers: corsHeaders });
         }
         const webhookSecret = crypto.randomUUID();
         const { data: session, error: sessionError } = await supabase
           .from('whatsapp_sessions')
           .insert({
             company_id: companyId,
             user_id: userId,
             instance_name: instanceName,
             status: 'connecting',
             webhook_secret: webhookSecret,
             baileys_server_url: EVOLUTION_API_URL,
           })
           .select().single();
         if (sessionError) return new Response(JSON.stringify({ error: 'Falha ao criar sessão' }), { status: 500, headers: corsHeaders });
 
         try {
           const created = await createEvolutionInstanceForSession(session);
           const evoData = JSON.parse(created.body || '{}');
           if (created.status < 200 || created.status >= 300) {
             await supabase.from('whatsapp_sessions').delete().eq('id', session.id);
             return new Response(JSON.stringify({
               error: 'Falha ao criar instância no Evolution',
               details: evoData?.response?.message || evoData?.message || evoData?.error || `HTTP ${created.status}`,
             }), { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
           }

           // Evolution v2 pode devolver o QR já na criação. Persistimos imediatamente.
           const initialQr = await extractQrCodeDataUrl(evoData);
           if (initialQr) {
             await supabase.from('whatsapp_sessions').update({ qr_code: initialQr, status: 'waiting_qr' }).eq('id', session.id);
             session.qr_code = initialQr;
             session.status = 'waiting_qr';
           }

           return new Response(JSON.stringify({ success: true, session, qrCode: initialQr }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
         } catch (e: any) {
           console.error('[CREATE] Evolution Error:', e?.message || e);
           await supabase.from('whatsapp_sessions').delete().eq('id', session.id);
           return new Response(JSON.stringify({
             error: 'Evolution API indisponível',
             details: String(e?.message || e),
           }), { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
         }
       }

      // ==================== GET QR CODE ====================
       case 'get_qr_code': {
         const caller = (await req.json().catch(() => ({}))) as any; // JWT do Supabase vai em headers (req.headers), body pode ser vazio.
         const unauthorized = await requireSessionOwner(supabase, sessionId, (caller.auth as any)?.session);
         if (unauthorized instanceof Response) return unauthorized;

         const { data: session } = await supabase.from('whatsapp_sessions').select('*').eq('id', sessionId).single();
         if (!session) return new Response(JSON.stringify({ error: 'Sessão não encontrada' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

          const sessionAgeSeconds = Math.floor((Date.now() - new Date(session.created_at).getTime()) / 1000);
          const sessionData = (session.session_data || {}) as Record<string, unknown>;
          const lastOpenAt = new Date(String(sessionData.last_connection_open_at || session.connected_at || '')).getTime();
          const recentlyOpened = Number.isFinite(lastOpenAt) && Date.now() - lastOpenAt < PAIRING_STABILIZATION_MS;
          if (session.status === 'connected' || recentlyOpened) {
            return new Response(JSON.stringify({ status: 'connected', isConnected: true }), {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }
         const qrUrl = `${EVOLUTION_API_URL}/instance/connect/${session.instance_name}`;

         try {
            console.log(`[QR] Session age: ${sessionAgeSeconds}s. GET ${qrUrl}`);

            let response = await fetchWithTimeout(qrUrl, {
              method: 'GET', headers: { 'apikey': EVOLUTION_API_KEY }
            }, 30000); 

            
            let data = await response.json().catch(() => ({}));
            console.log(`[QR] Evolution status=${response.status} body=${JSON.stringify(data).slice(0, 300)}`);

            const evolutionMessage = JSON.stringify(data || {});
            const isMissing = response.status === 404
              || evolutionMessage.includes('does not exist')
              || evolutionMessage.includes('not found')
              || (response.status === 200 && (data?.instance?.state === 'close' || data?.state === 'close'));
            
             const stateBeforeRecreate = await getEvolutionInstanceState(session.instance_name, 3000);
             const handshakeProtected = session.status === 'connecting'
               || session.status === 'waiting_qr'
               || stateBeforeRecreate === 'connecting'
               || stateBeforeRecreate === 'close';

             if ((isMissing || response.status === 401) && !handshakeProtected) {
               console.log(`[QR] Instance ${session.instance_name} missing or unauthorized. Recreating...`);
               const created = await createEvolutionInstanceForSession(session, true);
               console.log(`[QR] Recreate status=${created.status} body=${created.body.slice(0, 300)}`);
               
               if (created.status >= 200 && created.status < 300) {
                 const createdData = JSON.parse(created.body || '{}');
                 const createdQr = await extractQrCodeDataUrl(createdData);
                 if (createdQr) {
                   await supabase.from('whatsapp_sessions').update({ qr_code: createdQr, status: 'waiting_qr' }).eq('id', sessionId);
                   return new Response(JSON.stringify({ qrCode: createdQr, status: 'waiting_qr' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
             }

             if ((isMissing || response.status === 401) && handshakeProtected) {
               console.log(`[QR-GUARD] Recreation blocked during handshake: db=${session.status} evolution=${stateBeforeRecreate}`);
               return new Response(JSON.stringify({
                 qrCode: session.qr_code || null,
                 status: session.status === 'waiting_qr' ? 'waiting_qr' : 'connecting',
                 evolutionState: stateBeforeRecreate,
                 regenerationBlocked: true,
               }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
             }
                 
                 // Até 3 tentativas curtas no /instance/connect dentro da mesma chamada
                 for (let attempt = 1; attempt <= 3; attempt++) {
                   await new Promise(r => setTimeout(r, 1500));
                   response = await fetchWithTimeout(qrUrl, {
                     method: 'GET', headers: { 'apikey': EVOLUTION_API_KEY }
                   }, 15000);
                   data = await response.json().catch(() => ({}));
                   console.log(`[QR] Tentativa ${attempt} após recriar status=${response.status} body=${JSON.stringify(data).slice(0, 200)}`);
                   const retryQr = await extractQrCodeDataUrl(data);
                   if (retryQr) {
                     await supabase.from('whatsapp_sessions').update({ qr_code: retryQr, status: 'waiting_qr' }).eq('id', sessionId);
                     return new Response(JSON.stringify({ qrCode: retryQr, status: 'waiting_qr' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
                   }
                 }
                 return new Response(JSON.stringify({
                   qrCode: null,
                   status: 'error',
                   error: 'Evolution criou a instância mas não devolveu QR Code',
                   details: JSON.stringify(data || {}).slice(0, 300),
                 }), { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
               } else {
                 return new Response(JSON.stringify({
                   qrCode: null,
                   status: 'error',
                   error: 'Evolution recusou a criação da instância',
                   details: created.body || `HTTP ${created.status}`,
                 }), { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
               }
            }

            const qrCode = await extractQrCodeDataUrl(data);
            
            if (qrCode) {
              await supabase
                .from('whatsapp_sessions')
                .update({ qr_code: qrCode, status: 'waiting_qr' })
                .eq('id', sessionId);
              return new Response(JSON.stringify({ qrCode, status: 'waiting_qr' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
            }

            if (data?.instance?.state === 'open' || data?.state === 'open') {
              await supabase.from('whatsapp_sessions').update({ status: 'connected' }).eq('id', sessionId);
              return new Response(JSON.stringify({ status: 'connected' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
            }

            console.log(`[QR] No QR yet. State: ${data?.instance?.state || data?.state || 'unknown'}`);

            if (sessionAgeSeconds < 45) {
              return new Response(JSON.stringify({
                qrCode: null,
                status: 'initializing',
                message: 'Aguardando servidor inicializar sessão...',
                sessionAge: sessionAgeSeconds
              }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
            }

            return new Response(JSON.stringify({
              qrCode: null,
              status: 'generating',
              message: 'Gerando QR Code, aguarde...',
              evolutionStatus: response.status,
              evolutionState: data?.instance?.state || data?.state || null,
              sessionAge: sessionAgeSeconds
            }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
         } catch (e: any) {
            console.error('[QR] Falha ao obter QR Code:', e?.message || e);
            return new Response(JSON.stringify({
              qrCode: null,
              status: 'error',
              error: 'Falha ao obter QR Code no Evolution',
              details: String(e?.message || e),
              sessionAge: sessionAgeSeconds
            }), { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
         }
       }

      // ==================== CHECK STATUS ====================
      case 'check_status': {
        if (!sessionId) {
          return new Response(JSON.stringify({ error: 'sessionId é obrigatório' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        const { data: session } = await supabase
          .from('whatsapp_sessions')
          .select('*')
          .eq('id', sessionId)
          .single();

        if (!session) {
          return new Response(JSON.stringify({ error: 'Sessão não encontrada' }), {
            status: 404,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        try {
          const statusUrl = `${EVOLUTION_API_URL}/instance/connectionState/${session.instance_name}`;
          console.log(`[STATUS] Checking Evolution: ${statusUrl}`);
          
          const response = await fetch(statusUrl, {
            headers: { 'apikey': EVOLUTION_API_KEY }
          });

          if (response.ok) {
            const data = await response.json();
            const isConnected = data.instance?.state === 'open' || data.state === 'open' || data.status === 'open';
            const evolutionState = data.instance?.state || data.state || data.status || 'unknown';
            const sessionData = (session.session_data || {}) as Record<string, unknown>;
            const lastOpenAt = new Date(String(sessionData.last_connection_open_at || session.connected_at || '')).getTime();
            const recentlyOpened = Number.isFinite(lastOpenAt) && Date.now() - lastOpenAt < PAIRING_STABILIZATION_MS;
            const stableConnected = isConnected || session.status === 'connected' || recentlyOpened;

            if (stableConnected && session.status !== 'connected') {
              await supabase
                .from('whatsapp_sessions')
                .update({ status: 'connected', last_seen_at: new Date().toISOString() })
                .eq('id', sessionId);
            }
            
            if (isConnected && session.status !== 'connected') {
              await supabase
                .from('whatsapp_sessions')
                .update({
                  status: 'connected',
                  connected_at: new Date().toISOString(),
                  last_seen_at: new Date().toISOString(),
                })
                .eq('id', sessionId);
              // Backfill: guarantee webhook is set for instances created before this fix
              await ensureEvolutionWebhook(session.instance_name);
            }

            return new Response(JSON.stringify({ 
              status: stableConnected ? 'connected' : evolutionState,
              isConnected: stableConnected,
              evolutionState
            }), {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }
        } catch (e) {
          console.error('[STATUS] Evolution Error:', e);
        }

        return new Response(JSON.stringify({ 
          status: session.status,
          phoneNumber: session.phone_number,
          pushName: session.push_name
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // ==================== REGENERATE QR / FORCE RECONNECT ====================
      case 'regenerate_qr':
      case 'force_reconnect':
      case 'regenerate_qr_forced': {
        if (!sessionId) {
          return new Response(JSON.stringify({ error: 'sessionId é obrigatório' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        const { data: session } = await supabase
          .from('whatsapp_sessions')
          .select('*')
          .eq('id', sessionId)
          .single();

        if (!session) {
          return new Response(JSON.stringify({ error: 'Sessão não encontrada' }), {
            status: 404,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        const forced = action === 'force_reconnect' || action === 'regenerate_qr_forced';
        console.log(`[RECONNECT] ${forced ? 'FORCED' : 'Regenerate'} for session ${sessionId} (Evolution)`);

        try {
          // Anti-flood: no máximo 1 recriação a cada 20s por sessão
          const lastRecreate = recreateCooldown.get(sessionId) || 0;
          if (Date.now() - lastRecreate < 20000) {
            console.log(`[RECONNECT] Ignorado (cooldown) para ${sessionId}`);
            return new Response(JSON.stringify({ success: false, skipped: true, message: 'Recriação em cooldown' }), {
              status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }

          // Nunca destruir uma instância já conectada
          const caller = (await req.json().catch(() => ({}))) as any;
          const unauthorized = await requireSessionOwner(supabase, sessionId, (caller.auth as any)?.session);
          if (unauthorized instanceof Response) return unauthorized;

          const liveState = await getEvolutionInstanceState(session.instance_name);
          if (liveState === 'open') {
            return new Response(JSON.stringify({ success: false, skipped: true, state: liveState, message: 'Sessão já conectada' }), {
              status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }
          recreateCooldown.set(sessionId, Date.now());

          if (!forced) {
            // Trava: nunca destruir/recriar uma instância ativa ou em handshake
            const currentState = await getEvolutionInstanceState(session.instance_name);
            console.log(`[REGENERATE] Estado atual de ${session.instance_name}: ${currentState}`);
            if (currentState === 'open' || currentState === 'connecting') {
              return new Response(JSON.stringify({
                success: false,
                skipped: true,
                state: currentState,
                message: currentState === 'open'
                  ? 'Sessão já está conectada — regeneração bloqueada para preservar a conexão.'
                  : 'Sessão está em processo de conexão — aguarde antes de regenerar o QR.'
              }), {
                status: 409,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
              });
            }
          }

          // Para o Evolution, regenerar é simplesmente deletar e recriar.
          // Um celular deslogado (401/device_removed) deixa a instância em `close`:
          // o delete funciona mas é assíncrono, então precisamos esperar.
          const logoutResp = await fetch(`${EVOLUTION_API_URL}/instance/logout/${session.instance_name}`, {
            method: 'DELETE', headers: { 'apikey': EVOLUTION_API_KEY }
          }).catch(() => null);
          console.log(`[RECONNECT] logout -> ${logoutResp?.status ?? 'erro'}`);

          const deleteResp = await fetch(`${EVOLUTION_API_URL}/instance/delete/${session.instance_name}`, {
            method: 'DELETE', headers: { 'apikey': EVOLUTION_API_KEY }
          }).catch(() => null);
          console.log(`[RECONNECT] delete -> ${deleteResp?.status ?? 'erro'}`);

          const gone = await waitForInstanceGone(session.instance_name);
          console.log(`[RECONNECT] instância removida do Evolution: ${gone}`);

          const webhookSecret = session.webhook_secret || crypto.randomUUID();
          const createBody = {
            instanceName: session.instance_name,
            token: webhookSecret,
            integration: "WHATSAPP-BAILEYS",
            qrcode: true,
            webhook: {
              url: WEBHOOK_URL,
              byEvents: true,
              base64: true,
              events: ["QRCODE_UPDATED", "MESSAGES_SET", "MESSAGES_UPSERT", "CONNECTION_UPDATE", "CHATS_SET", "CHATS_UPSERT"],
            },
          };

          // O delete pode terminar de propagar depois do nosso timeout — tenta criar
          // algumas vezes quando o Evolution reclamar que o nome ainda está em uso.
          let response: Response | null = null;
          let evoData: any = {};
          for (let attempt = 1; attempt <= 4; attempt++) {
            response = await fetch(`${EVOLUTION_API_URL}/instance/create`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'apikey': EVOLUTION_API_KEY },
              body: JSON.stringify(createBody)
            });
            evoData = await response.json().catch(() => ({}));
            console.log(`[RECONNECT] Evolution instance recreated (tentativa ${attempt}):`, JSON.stringify(evoData).slice(0, 400));
            if (response.ok) break;
            const detail = JSON.stringify(evoData).toLowerCase();
            if (attempt < 4 && (detail.includes('already in use') || detail.includes('already exists'))) {
              console.log('[RECONNECT] Nome ainda em uso — aguardando propagação do delete...');
              await new Promise((r) => setTimeout(r, 3000));
              continue;
            }
            break;
          }

          if (!response || !response.ok) {
            return new Response(JSON.stringify({
              error: 'Falha ao recriar instância no Evolution',
              details: evoData?.response?.message || evoData?.message || evoData?.error || `HTTP ${response?.status ?? 'sem resposta'}`,
            }), { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
          }
          await ensureEvolutionWebhook(session.instance_name);

          const regeneratedQr = await extractQrCodeDataUrl(evoData);

          // Marca sessão como aguardando QR
          await supabase
            .from('whatsapp_sessions')
            .update({
              status: regeneratedQr ? 'waiting_qr' : 'connecting',
              qr_code: regeneratedQr,
              connected_at: null,
              webhook_secret: webhookSecret,
            })
            .eq('id', sessionId);

          return new Response(JSON.stringify({ success: true, message: 'Instância recriada', qrCode: regeneratedQr }), { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          });
        } catch (e: any) {
          console.error('[RECONNECT] Error:', e);
          return new Response(JSON.stringify({ error: 'Erro ao regenerar instância', details: String(e?.message || e) }), {
            status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
      }

      // ==================== SEND MESSAGE ====================
      case 'send_message': {
        if (!sessionId || !phone || !message) {
          return new Response(JSON.stringify({ error: 'sessionId, phone e message são obrigatórios' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        const { data: session } = await supabase
          .from('whatsapp_sessions')
          .select('*')
          .eq('id', sessionId)
          .single();

        if (!session) {
          return new Response(JSON.stringify({ error: 'Sessão não encontrada' }), {
            status: 404,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        const serverUrl = EVOLUTION_API_URL;
        const normalizedServerUrl = (serverUrl || '').replace(/\/+$/, '');
        const normalizedPhone = normalizeContactPhone(phone || '');
        const phoneVariants = buildPhoneVariants(normalizedPhone);
        const messageText = typeof message === 'string' ? message.trim() : String(message ?? '').trim();
        const isAutomatedSend = manualTakeover === false;

        if (!messageText) {
          return new Response(JSON.stringify({ error: 'message não pode ser vazio' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        if (!normalizedPhone) {
          return new Response(JSON.stringify({ error: 'phone inválido' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        const fallbackJid = normalizedPhone.length >= 18
          ? `${normalizedPhone}@g.us`
          : `${normalizedPhone}@s.whatsapp.net`;

        // Find or create conversation. Prefer the explicit conversationId from CRM so
        // human takeover is applied to the exact opened chat, even when phone/LID
        // duplicates exist.
        let conversation: any = null;
        if (conversationId) {
          const { data: byId } = await supabase
            .from('whatsapp_conversations')
            .select('*')
            .eq('id', conversationId)
            .eq('company_id', session.company_id)
            .maybeSingle();
          conversation = byId;
        }

        if (!conversation) {
          const { data: byPhone } = await supabase
            .from('whatsapp_conversations')
            .select('*')
            .eq('company_id', session.company_id)
            .in('contact_phone', phoneVariants)
            .order('last_message_at', { ascending: false })
            .limit(1)
            .maybeSingle();
          conversation = byPhone;
        }

        if (!conversation) {
          const { data: newConv } = await supabase
            .from('whatsapp_conversations')
            .insert({
              session_id: sessionId,
              company_id: session.company_id,
              contact_phone: normalizedPhone,
              remote_jid: fallbackJid,
              status: 'open',
               last_message_at: new Date().toISOString(),
               ai_auto_reply_enabled: aiEnabled === true,
               ai_agent_id: aiAgentId || null
            })
            .select()
            .single();
          conversation = newConv;
        }

        // Use stored remote_jid if available, otherwise construct from normalized phone
        const storedJid = conversation?.remote_jid;
        const jid = storedJid && storedJid.includes('@')
          ? storedJid
          : fallbackJid;

        // Send via Evolution API if connected
        if (normalizedServerUrl && session.status === 'connected') {
          try {
            // Evolution API expects: POST /message/sendText/{instance}
            // body: { number, text }  with header apikey
            const evoNumber = jid.replace(/@.*/, '');
            const evoUrl = `${normalizedServerUrl}/message/sendText/${session.instance_name}`;
            console.log(`[SEND] Sending to ${evoNumber} via Evolution ${evoUrl}`);

            const doSend = () => fetchWithTimeout(evoUrl, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'apikey': EVOLUTION_API_KEY,
              },
              body: JSON.stringify({
                number: evoNumber,
                text: messageText,
              })
            }, 7000);

            let sendResponse = await doSend();

            // Auto-recover: Evolution sometimes reports "Connection Closed" even
            // while the session is still recoverable. Restart the instance without
            // deleting credentials, wait for it to reopen, and retry a few times.
            for (let attempt = 1; attempt <= 1 && !sendResponse.ok; attempt++) {
              const peek = await sendResponse.clone().text();
              if (!/connection close|session not connected|desconect/i.test(peek)) break;

              console.warn(`[SEND] Connection issue detected on attempt ${attempt} — restarting instance and retrying...`);
              try {
                await fetchWithTimeout(`${normalizedServerUrl}/instance/restart/${session.instance_name}`, {
                  method: 'POST',
                  headers: { 'apikey': EVOLUTION_API_KEY },
                }, 3000);
              } catch (restartErr) {
                console.error('[SEND] Restart request failed:', restartErr);
              }

              // Keep total retry budget under the edge function timeout so the
              // client always gets a response (previously ~80s => timeout, no error).
              let reopened = false;
              for (let waitTry = 0; waitTry < 2; waitTry++) {
                await new Promise((r) => setTimeout(r, waitTry === 0 ? 1000 : 1000));
                const state = await getEvolutionInstanceState(session.instance_name);
                console.log(`[SEND] State after restart attempt ${attempt}.${waitTry + 1}: ${state}`);
                if (state === 'open') {
                  reopened = true;
                  break;
                }
              }

              if (!reopened) {
                console.warn('[SEND] Instance did not report open state yet; retrying send once anyway');
              }
              sendResponse = await doSend();
            }

            if (sendResponse.ok) {
              const sendData = await sendResponse.json();
              const waMessageId =
                sendData?.key?.id ||
                sendData?.messageId ||
                sendData?.message?.key?.id ||
                `panel-${Date.now()}`;
              console.log(`[SEND] Message sent OK, waMessageId: ${waMessageId}`);

              // Save sent message to database without PostgREST upsert. The table
              // has a partial unique index on (wa_message_id, company_id), so
              // onConflict: 'wa_message_id' always logs an error even for OK sends.
              let savedMsgId = null;
              try {
                const { data: existingMsg } = await supabase
                  .from('whatsapp_messages')
                  .select('id')
                  .eq('wa_message_id', waMessageId)
                  .eq('company_id', session.company_id)
                  .maybeSingle();

                if (existingMsg) {
                  savedMsgId = existingMsg.id;
                  const { error: updateError } = await supabase
                    .from('whatsapp_messages')
                    .update({
                      conversation_id: conversation?.id,
                      session_id: sessionId,
                      from_me: true,
                      content: messageText,
                      message_type: 'text',
                      status: 'sent',
                      timestamp: new Date().toISOString(),
                      sender_name: isAutomatedSend ? 'Chatbot' : null,
                      is_ai_response: isAutomatedSend,
                    })
                    .eq('id', existingMsg.id);
                  if (updateError) {
                    console.error(`[SEND] Existing message update failed: ${updateError.message}`);
                  }
                  console.log(`[SEND] Message already existed and was updated: ${savedMsgId}`);
                } else {
                  const { data: insertedMsg, error: insertError } = await supabase
                    .from('whatsapp_messages')
                    .insert({
                      conversation_id: conversation?.id,
                      session_id: sessionId,
                      company_id: session.company_id,
                      wa_message_id: waMessageId,
                      from_me: true,
                      content: messageText,
                      message_type: 'text',
                      status: 'sent',
                      timestamp: new Date().toISOString(),
                      sender_name: isAutomatedSend ? 'Chatbot' : null,
                      is_ai_response: isAutomatedSend,
                    })
                    .select('id')
                    .single();

                  if (insertError) {
                    console.error(`[SEND] Insert failed: ${insertError.message}`);
                  } else {
                    savedMsgId = insertedMsg?.id;
                    console.log(`[SEND] Insert OK: ${savedMsgId}`);
                  }
                }
              } catch (dbErr) {
                console.error(`[SEND] DB save exception:`, dbErr);
              }

              const nowIso = new Date().toISOString();
              const shouldMarkHumanTakeover = manualTakeover !== false;

              // Always persist the sidebar/header preview for the exact conversation.
              // Human-takeover may intentionally be skipped for parent/autopilot channels,
              // but the CRM still must show the just-sent message immediately after reload.
              if (conversation?.id) {
                const { error: previewUpdateError } = await supabase
                  .from('whatsapp_conversations')
                  .update({
                    session_id: sessionId,
                    contact_phone: normalizedPhone,
                    remote_jid: jid,
                    last_message: messageText,
                    last_message_at: nowIso,
                    unread_count: 0,
                    ai_auto_reply_enabled: aiEnabled === true,
                    ai_agent_id: aiAgentId || null,
                  })
                  .eq('id', conversation.id)
                  .eq('company_id', session.company_id);

                if (previewUpdateError) {
                  console.error(`[SEND] Conversation preview update failed: ${previewUpdateError.message}`);
                }
              }

              if (shouldMarkHumanTakeover) {
                console.log(`[SEND] Manual CRM message detected. Stopping automations for conversation ${conversation.id}`);
                await markHumanTakeoverForRelatedConversations(supabase, {
                  companyId: session.company_id,
                  conversationId: conversation?.id,
                  phoneVariants,
                  remoteJid: jid,
                  sessionId,
                  lastMessage: messageText,
                  messageDbId: savedMsgId,
                  reason: 'mensagem do humano no CRM',
                });
              }

              return new Response(JSON.stringify({
                success: true,
                messageId: waMessageId,
                dbId: savedMsgId
              }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
              });
            } else {
              const errorText = await sendResponse.text();
              console.error('Evolution send error:', errorText);

              // Parse error message for better user feedback
              let errorMessage = 'Falha ao enviar mensagem';
              let errorDetails = errorText;

              try {
                const errorJson = JSON.parse(errorText);
                const rawErr = String(errorJson?.error || errorJson?.message || '');

                const combined = (rawErr + ' ' + errorText).toLowerCase();
                if (
                  combined.includes('session not connected') ||
                  combined.includes('sessão não encontrada') ||
                  combined.includes('sessao nao encontrada') ||
                  combined.includes('desconect') ||
                  combined.includes('connection closed') ||
                  combined.includes('connection close')
                ) {
                  errorMessage = 'WhatsApp desconectado';
                  errorDetails = 'A conexão do WhatsApp caiu no servidor. Abra a tela do QR Code e reconecte lendo o QR novamente.';

                  // Update session status in database
                  await supabase
                    .from('whatsapp_sessions')
                    .update({ status: 'disconnected', connected_at: null })
                    .eq('id', sessionId);
                }
              } catch {
                // Not JSON, use raw error
              }

              return new Response(JSON.stringify({ error: errorMessage, details: errorDetails }), {
                status: 500,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
              });
            }
          } catch (e: any) {
            console.error('Error sending via Evolution:', e);
            return new Response(JSON.stringify({
              error: 'Erro de conexão com servidor',
              details: e.message || 'Não foi possível conectar ao servidor WhatsApp'
            }), {
              status: 500,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }
        }


        // Demo mode - save locally
        const { data: demoMsg } = await supabase
          .from('whatsapp_messages')
          .insert({
            conversation_id: conversation?.id,
            session_id: sessionId,
            company_id: session.company_id,
            from_me: true,
            content: messageText,
            message_type: 'text',
            status: 'sent',
            timestamp: new Date().toISOString(),
            sender_name: isAutomatedSend ? 'Chatbot' : null,
            is_ai_response: isAutomatedSend,
          })
          .select('id')
          .maybeSingle();

        const demoNowIso = new Date().toISOString();
        const shouldMarkDemoHumanTakeover = manualTakeover !== false;
        if (conversation?.id) {
          const { error: demoPreviewUpdateError } = await supabase
            .from('whatsapp_conversations')
            .update({
              session_id: sessionId,
              contact_phone: normalizedPhone,
              remote_jid: jid,
              last_message: messageText,
              last_message_at: demoNowIso,
              unread_count: 0,
              ai_auto_reply_enabled: aiEnabled === true,
              ai_agent_id: aiAgentId || null,
            })
            .eq('id', conversation.id)
            .eq('company_id', session.company_id);

          if (demoPreviewUpdateError) {
            console.error(`[SEND] Demo conversation preview update failed: ${demoPreviewUpdateError.message}`);
          }
        }

        if (shouldMarkDemoHumanTakeover) {
          await markHumanTakeoverForRelatedConversations(supabase, {
            companyId: session.company_id,
            conversationId: conversation?.id,
            phoneVariants,
            remoteJid: jid,
            sessionId,
            lastMessage: messageText,
            messageDbId: demoMsg?.id,
            reason: 'mensagem do humano no CRM',
          });
        }


        return new Response(JSON.stringify({ 
          success: true, 
          isDemo: !serverUrl || session.status !== 'connected',
          message: 'Mensagem salva localmente (modo demo)'
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // ==================== SEND MEDIA ====================
      case 'send_media': {
        const { mediaUrl, mediaType, caption, fileName } = body;
        const isAutomatedMediaSend = manualTakeover === false;
        
        if (!sessionId || !phone || !mediaUrl) {
          return new Response(JSON.stringify({ error: 'sessionId, phone e mediaUrl são obrigatórios' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        const { data: session } = await supabase
          .from('whatsapp_sessions')
          .select('*')
          .eq('id', sessionId)
          .single();

        if (!session) {
          return new Response(JSON.stringify({ error: 'Sessão não encontrada' }), {
            status: 404,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        const serverUrl = EVOLUTION_API_URL;
        const normalizedServerUrl = (serverUrl || '').replace(/\/+$/, '');
        const normalizedPhone = normalizeContactPhone(phone || '');
        const phoneVariants = buildPhoneVariants(normalizedPhone);
        const jid = normalizedPhone.length >= 18
          ? `${normalizedPhone}@g.us`
          : `${normalizedPhone}@s.whatsapp.net`;

        // Check if server is configured and session is connected
        if (!serverUrl) {
          return new Response(JSON.stringify({ error: 'Servidor Evolution não configurado' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        if (session.status !== 'connected') {
          return new Response(JSON.stringify({ 
            error: 'WhatsApp desconectado', 
            details: 'Reconecte escaneando o QR Code' 
          }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        try {
          const evoNumber = jid.replace(/@.*/, '');
          const mt = (mediaType || 'image').toLowerCase();
          console.log(`[SEND MEDIA] Sending ${mt} to ${evoNumber} via Evolution (instance=${session.instance_name})`);

          // Evolution API endpoints:
          //  - POST /message/sendMedia/{instance}        body: { number, mediatype, mimetype, caption, media, fileName }
          //  - POST /message/sendWhatsAppAudio/{instance} body: { number, audio }
          let endpoint = `${normalizedServerUrl}/message/sendMedia/${session.instance_name}`;
          let payload: Record<string, unknown>;

          if (mt === 'audio' || mt === 'ptt') {
            endpoint = `${normalizedServerUrl}/message/sendWhatsAppAudio/${session.instance_name}`;
            payload = {
              number: evoNumber,
              audio: mediaUrl,
            };
          } else {
            // Map UI types to Evolution mediatype
            const mediatype =
              mt === 'video' ? 'video' :
              mt === 'document' || mt === 'file' ? 'document' :
              'image';

            // Best-effort mimetype guess
            const guessMime = (() => {
              const url = String(mediaUrl).toLowerCase();
              if (mediatype === 'image') {
                if (url.endsWith('.png')) return 'image/png';
                if (url.endsWith('.webp')) return 'image/webp';
                if (url.endsWith('.gif')) return 'image/gif';
                return 'image/jpeg';
              }
              if (mediatype === 'video') return 'video/mp4';
              return 'application/octet-stream';
            })();

            payload = {
              number: evoNumber,
              mediatype,
              mimetype: guessMime,
              caption: caption || '',
              media: mediaUrl,
              fileName: fileName || (mediatype === 'document' ? 'arquivo' : undefined),
            };
          }

          const sendResponse = await fetch(endpoint, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'apikey': EVOLUTION_API_KEY,
            },
            body: JSON.stringify(payload)
          });

          if (sendResponse.ok) {
            const sendData = await sendResponse.json();
            console.log(`[SEND MEDIA] Success:`, sendData);

            // Find existing conversation with phone variants to prevent duplicates.
            // Prefer explicit conversationId so manual takeover is applied to the
            // exact chat opened in CRM.
            let conversation: any = null;
            if (conversationId) {
              const { data: byId } = await supabase
                .from('whatsapp_conversations')
                .select('id')
                .eq('id', conversationId)
                .eq('company_id', session.company_id)
                .maybeSingle();
              conversation = byId;
            }

            if (!conversation) {
              const { data: byPhone } = await supabase
                .from('whatsapp_conversations')
                .select('id')
                .eq('company_id', session.company_id)
                .in('contact_phone', phoneVariants)
                .order('last_message_at', { ascending: false })
                .limit(1)
                .maybeSingle();
              conversation = byPhone;
            }

            if (!conversation) {
              const { data: newConv } = await supabase
                .from('whatsapp_conversations')
                .insert({
                  session_id: sessionId,
                  company_id: session.company_id,
                  contact_phone: normalizedPhone,
                  remote_jid: jid,
                  status: 'open',
                  last_message_at: new Date().toISOString(),
                  ai_auto_reply_enabled: aiEnabled === true,
                  ai_agent_id: aiAgentId || null
                })
                .select('id')
                .single();
              conversation = newConv;
            }

            if (!conversation?.id) {
              return new Response(JSON.stringify({ error: 'Não foi possível resolver a conversa para salvar a mídia' }), {
                status: 500,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
              });
            }

            // Save the message to database with media_url.
            // For documents, prefer the original file name so the bubble shows it
            // instead of a generic "[Documento]" placeholder.
            const contentText = mediaType === 'audio' || mediaType === 'ptt'
              ? '[Áudio]'
              : mediaType === 'document'
                ? (caption || fileName || '[Documento]')
                : (caption || `[${mediaType === 'image' ? 'Imagem' : 'Vídeo'}]`);

            const { data: savedMediaMsg } = await supabase
              .from('whatsapp_messages')
              .insert({
                conversation_id: conversation.id,
                session_id: sessionId,
                company_id: session.company_id,
                from_me: true,
                content: contentText,
                message_type: mediaType === 'ptt' ? 'ptt' : mediaType,
                media_url: mediaUrl,
                media_caption: caption || (mediaType === 'document' ? (fileName || null) : null),
                status: 'sent',
                timestamp: new Date().toISOString(),
                wa_message_id: sendData?.key?.id || sendData?.messageId || sendData?.message?.key?.id || null,
                sender_name: isAutomatedMediaSend ? 'Chatbot' : null,
                is_ai_response: isAutomatedMediaSend,
              })
              .select('id')
              .maybeSingle();

            const mediaNowIso = new Date().toISOString();
            const shouldMarkMediaHumanTakeover = manualTakeover !== false;

            if (conversation?.id) {
              const { error: mediaPreviewUpdateError } = await supabase
                .from('whatsapp_conversations')
                .update({
                  session_id: sessionId,
                  contact_phone: normalizedPhone,
                  remote_jid: jid,
                  last_message: contentText,
                  last_message_at: mediaNowIso,
                  unread_count: 0,
                  ai_auto_reply_enabled: aiEnabled === true,
                  ai_agent_id: aiAgentId || null,
                })
                .eq('id', conversation.id)
                .eq('company_id', session.company_id);

              if (mediaPreviewUpdateError) {
                console.error(`[SEND MEDIA] Conversation preview update failed: ${mediaPreviewUpdateError.message}`);
              }
            }

            if (shouldMarkMediaHumanTakeover) {
              await markHumanTakeoverForRelatedConversations(supabase, {
                companyId: session.company_id,
                conversationId: conversation.id,
                phoneVariants,
                remoteJid: jid,
                sessionId,
                lastMessage: contentText,
                messageDbId: savedMediaMsg?.id,
                reason: 'mensagem do humano no CRM',
              });
            }

            return new Response(JSON.stringify({
              success: true,
              messageId: sendData?.key?.id || sendData?.messageId || sendData?.message?.key?.id
            }), {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          } else {
            const errorText = await sendResponse.text();
            console.error('[SEND MEDIA] Server error:', errorText);
            
            // Try to parse error
            let errorMessage = 'Falha ao enviar mídia';
            try {
              const errorJson = JSON.parse(errorText);
              if (errorJson.error) {
                errorMessage = errorJson.error;
                
                // Update session status if disconnected
                if (errorJson.error.includes('not connected') || errorJson.error.includes('disconnected') || errorJson.error.includes('não encontrada')) {
                  await supabase
                    .from('whatsapp_sessions')
                    .update({ status: 'disconnected', connected_at: null })
                    .eq('id', sessionId);
                }
              }
            } catch {
              // Not JSON
            }
            
            return new Response(JSON.stringify({ error: errorMessage, details: errorText }), {
              status: 500,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }
        } catch (e: any) {
          console.error('[SEND MEDIA] Exception:', e);
          return new Response(JSON.stringify({ 
            error: 'Erro de conexão', 
            details: e.message || 'Não foi possível conectar ao servidor' 
          }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
      }

      // ==================== GET CONVERSATIONS ====================
      case 'get_conversations': {
        if (!companyId) {
          return new Response(JSON.stringify({ error: 'companyId é obrigatório' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        const { data: conversations, error } = await supabase
          .from('whatsapp_conversations')
          .select(`
            *,
            whatsapp_messages!inner (
              id,
              content,
              from_me,
              status,
              timestamp
            )
          `)
          .eq('company_id', companyId)
          .order('last_message_at', { ascending: false })
          .limit(100);

        if (error) {
          console.error('Error fetching conversations:', error);
        }

        return new Response(JSON.stringify({ conversations: conversations || [] }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // ==================== GET MESSAGES ====================
      case 'get_messages': {
        const { conversationId, limit = 50 } = body;
        
        if (!conversationId) {
          return new Response(JSON.stringify({ error: 'conversationId é obrigatório' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        const { data: messages } = await supabase
          .from('whatsapp_messages')
          .select('*')
          .eq('conversation_id', conversationId)
          .order('timestamp', { ascending: true })
          .limit(limit);

        return new Response(JSON.stringify({ messages: messages || [] }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

       // ==================== DISCONNECT / LOGOUT ====================
       case 'disconnect':
       case 'logout': {
         if (!sessionId) {
           return new Response(JSON.stringify({ error: 'sessionId é obrigatório' }), { status: 400, headers: corsHeaders });
         }
         const { data: session } = await supabase.from('whatsapp_sessions').select('*').eq('id', sessionId).single();
         if (session) {
           try {
             console.log(`[${action.toUpperCase()}] Performing full logout/delete for instance: ${session.instance_name}`);
             
             // 1. First attempt logout
             const logoutRes = await fetch(`${EVOLUTION_API_URL}/instance/logout/${session.instance_name}`, {
               method: 'DELETE', headers: { 'apikey': EVOLUTION_API_KEY }
             });
             console.log(`[LOGOUT] Response status: ${logoutRes.status}`);
             
             // 2. Then attempt delete
             const deleteRes = await fetch(`${EVOLUTION_API_URL}/instance/delete/${session.instance_name}`, {
               method: 'DELETE', headers: { 'apikey': EVOLUTION_API_KEY }
             });
             console.log(`[DELETE] Response status: ${deleteRes.status}`);
             
           } catch (e) { 
             console.error(`Evolution ${action} Error:`, e); 
           }
         }
         
         // Always update status to disconnected in DB
         await supabase.from('whatsapp_sessions').update({ 
           status: 'disconnected',
           connected_at: null 
         }).eq('id', sessionId);
         
         return new Response(JSON.stringify({ success: true, message: 'Sessão desconectada e removida da Evolution API' }), { 
           headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
         });
       }
 
       // ==================== CONFIGURE SERVER ====================
       case 'configure_server': {
         if (!sessionId) {
           return new Response(JSON.stringify({ error: 'sessionId é obrigatório' }), {
             status: 400,
             headers: { ...corsHeaders, 'Content-Type': 'application/json' }
           });
         }
 
         // Configure to use Evolution API
         await supabase
           .from('whatsapp_sessions')
           .update({ baileys_server_url: EVOLUTION_API_URL })
           .eq('id', sessionId);
 
         return new Response(JSON.stringify({ success: true, serverUrl: EVOLUTION_API_URL, message: 'Servidor Evolution configurado com sucesso' }), {
           headers: { ...corsHeaders, 'Content-Type': 'application/json' }
         });
       }

      // ==================== SYNC CHAT HISTORY ====================
      case 'sync_chat_history': {
        const { conversationId, limit = 200 } = body;
        if (!conversationId) {
          return new Response(JSON.stringify({ error: 'conversationId é obrigatório' }), {
            status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        const { data: conv } = await supabase
          .from('whatsapp_conversations')
          .select('id, remote_jid, contact_phone, session_id, company_id')
          .eq('id', conversationId)
          .single();
        if (!conv) {
          return new Response(JSON.stringify({ error: 'Conversa não encontrada' }), {
            status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        const { data: session } = await supabase
          .from('whatsapp_sessions')
          .select('id, instance_name, baileys_server_url, webhook_secret')
          .eq('id', conv.session_id)
          .single();
        if (!session) {
          return new Response(JSON.stringify({ error: 'Sessão não encontrada' }), {
            status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        const evoUrl = (session.baileys_server_url || EVOLUTION_API_URL).replace(/\/+$/, '');
        const rawJid = conv.remote_jid || conv.contact_phone;
        const isGroup = String(rawJid).includes('@g.us');
        const cleanId = String(rawJid).replace(/@.*$/, '').replace(/\D/g, '');
        const jid = String(rawJid).includes('@')
          ? rawJid
          : (isGroup ? `${cleanId}@g.us` : `${cleanId}@s.whatsapp.net`);

        console.log(`[SYNC HISTORY] Fetching messages for ${jid} from ${evoUrl} (instance: ${session.instance_name})`);

        let messages: any[] = [];
        try {
          const resp = await fetch(`${evoUrl}/chat/findMessages/${session.instance_name}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'apikey': EVOLUTION_API_KEY },
            body: JSON.stringify({
              where: { key: { remoteJid: jid } },
              limit,
            }),
            signal: AbortSignal.timeout(30000),
          });

          // 2) Trigger a profile update for this contact specifically
          try {
            console.log(`[SYNC HISTORY] Refreshing profile for ${jid}`);
            fetch(`${evoUrl}/chat/updatePresence/${session.instance_name}`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'apikey': EVOLUTION_API_KEY },
              body: JSON.stringify({ number: cleanId, presence: 'available' }),
            }).catch(() => {});
            
            // This endpoint in Evolution triggers a contact refresh that usually sends profilePic
            fetch(`${evoUrl}/chat/findContacts/${session.instance_name}`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'apikey': EVOLUTION_API_KEY },
              body: JSON.stringify({ where: { remoteJid: jid } }),
            }).then(async r => {
              if (r.ok) {
                const data = await r.json();
                const contact = Array.isArray(data) ? data[0] : (data?.data?.[0] || data);
                const pic = contact?.profilePicture || contact?.imgUrl;
                if (pic) {
                   console.log(`[SYNC HISTORY] Found pic for ${jid}: ${pic.substring(0, 50)}...`);
                   await supabase.from('whatsapp_conversations').update({ profile_picture: pic }).eq('id', conversationId);
                }
              }
            }).catch(() => {});
          } catch (e) {
            console.warn('[SYNC HISTORY] Non-critical profile refresh failed');
          }
          if (!resp.ok) {
            const txt = await resp.text();
            console.error('[SYNC HISTORY] Evolution responded:', resp.status, txt.substring(0, 300));
            return new Response(JSON.stringify({ error: `Evolution retornou ${resp.status}`, detail: txt.substring(0, 300) }), {
              status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }
          const json = await resp.json();
          messages = Array.isArray(json) ? json : (json?.messages?.records || json?.records || json?.data || []);
        } catch (e: any) {
          console.error('[SYNC HISTORY] Fetch error:', e?.message);
          return new Response(JSON.stringify({ error: 'Falha ao consultar Evolution', detail: e?.message }), {
            status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        console.log(`[SYNC HISTORY] Got ${messages.length} messages from Evolution for ${jid}`);

        if (!messages.length) {
          return new Response(JSON.stringify({ success: true, synced: 0, message: 'Nenhuma mensagem antiga encontrada no servidor.' }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        // Re-inject into webhook in batches so existing processing pipeline handles them
        const BATCH = 25;
        let injected = 0;
        for (let i = 0; i < messages.length; i += BATCH) {
          const batch = messages.slice(i, i + BATCH);
          try {
            const r = await fetch(WEBHOOK_URL, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'x-webhook-secret': session.webhook_secret || '',
              },
              body: JSON.stringify({
                event: 'messages.upsert',
                sessionId: session.id,
                instanceName: session.instance_name,
                data: { messages: batch },
              }),
              signal: AbortSignal.timeout(60000),
            });
            if (r.ok) injected += batch.length;
            else console.error('[SYNC HISTORY] Webhook batch failed:', r.status);
          } catch (e: any) {
            console.error('[SYNC HISTORY] Webhook batch error:', e?.message);
          }
        }

        return new Response(JSON.stringify({ success: true, synced: injected, total: messages.length }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // ==================== MARK AS READ ====================
      case 'mark_as_read': {
        const { conversationId } = body;
        
        if (!sessionId || !phone) {
          return new Response(JSON.stringify({ error: 'sessionId e phone são obrigatórios' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        const { data: session } = await supabase
          .from('whatsapp_sessions')
          .select('*')
          .eq('id', sessionId)
          .single();

        if (!session) {
          return new Response(JSON.stringify({ error: 'Sessão não encontrada' }), {
            status: 404,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        const serverUrl = EVOLUTION_API_URL;
        const normalizedServerUrl = (serverUrl || '').replace(/\/+$/, '');
        const cleanPhone = phone.replace(/\D/g, '');
        // Evolution expects simple numbers for some endpoints or JIDs for others
        // but typically just the number for sendText/read
        const number = cleanPhone.replace(/@.*/, '');

        // Update unread_count in database first
        if (conversationId) {
          await supabase
            .from('whatsapp_conversations')
            .update({ unread_count: 0 })
            .eq('id', conversationId);
        }

        // If connected, also notify Baileys server to send read receipts
        if (normalizedServerUrl && session.status === 'connected') {
          try {
            // Evolution API uses: POST /chat/markMessageAsRead/{instance}
            // body: { number }
            console.log(`[MARK READ] Sending markMessageAsRead to Evolution for ${number}`);
            
            const evoUrl = `${normalizedServerUrl}/chat/markMessageAsRead/${session.instance_name}`;
            await fetch(evoUrl, {
              method: 'POST',
              headers: { 
                'Content-Type': 'application/json',
                'apikey': EVOLUTION_API_KEY 
              },
              body: JSON.stringify({ number })
            });

            // Update message statuses in database to 'read'
            await supabase
              .from('whatsapp_messages')
              .update({ status: 'read' })
              .eq('conversation_id', conversationId)
              .eq('from_me', false)
              .in('status', ['sent', 'delivered']);
          } catch (e) {
            console.error('[MARK READ] Error sending read receipts:', e);
            // Don't fail - we already updated the database
          }
        }

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

       // ==================== DELETE SESSION ====================
       case 'delete_session': {
         if (!sessionId) {
           return new Response(JSON.stringify({ error: 'sessionId é obrigatório' }), { status: 400, headers: corsHeaders });
         }
 
         const { data: session } = await supabase.from('whatsapp_sessions').select('*').eq('id', sessionId).single();
         if (!session) return new Response(JSON.stringify({ error: 'Sessão não encontrada' }), { status: 404, headers: corsHeaders });
 
         try {
           // Logout/Delete instance on Evolution
           await fetch(`${EVOLUTION_API_URL}/instance/logout/${session.instance_name}`, {
             method: 'DELETE', headers: { 'apikey': EVOLUTION_API_KEY }
           });
           await fetch(`${EVOLUTION_API_URL}/instance/delete/${session.instance_name}`, {
             method: 'DELETE', headers: { 'apikey': EVOLUTION_API_KEY }
           });
         } catch (e) { console.error('Evolution Delete Error:', e); }
 
          // Soft delete: channel + conversations stay in the database so a future
          // connection with the same number re-attaches everything.
          await supabase.from('whatsapp_sessions')
            .update({ deleted_at: new Date().toISOString(), status: 'disconnected', qr_code: null, updated_at: new Date().toISOString() })
            .eq('id', sessionId);
  
          return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
       }
 
       default:
         return new Response(JSON.stringify({ error: `Ação desconhecida: ${action}` }), {
           status: 400,
           headers: { ...corsHeaders, 'Content-Type': 'application/json' }
         });
    }
  } catch (error) {
    console.error('WhatsApp API Error:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Erro interno do servidor' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

// Generate demo QR code
function generateDemoQrCode(): string {
  return "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyMDAiIGhlaWdodD0iMjAwIiB2aWV3Qm94PSIwIDAgMjAwIDIwMCI+PHJlY3Qgd2lkdGg9IjIwMCIgaGVpZ2h0PSIyMDAiIGZpbGw9IiNmZmYiLz48cmVjdCB4PSI0MCIgeT0iNDAiIHdpZHRoPSI0MCIgaGVpZ2h0PSI0MCIgZmlsbD0iIzI1RDM2NiIvPjxyZWN0IHg9IjEyMCIgeT0iNDAiIHdpZHRoPSI0MCIgaGVpZ2h0PSI0MCIgZmlsbD0iIzI1RDM2NiIvPjxyZWN0IHg9IjQwIiB5PSIxMjAiIHdpZHRoPSI0MCIgaGVpZ2h0PSI0MCIgZmlsbD0iIzI1RDM2NiIvPjxyZWN0IHg9IjgwIiB5PSI4MCIgd2lkdGg9IjQwIiBoZWlnaHQ9IjQwIiBmaWxsPSIjMjVEMzY2Ii8+PHRleHQgeD0iMTAwIiB5PSIxODAiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIxMiIgZmlsbD0iIzY2NiI+RXNjYW5laWUgY29tIFdoYXRzQXBwPC90ZXh0Pjwvc3ZnPg==";
}