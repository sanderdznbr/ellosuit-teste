import { createClient } from "npm:@supabase/supabase-js@2";
import { isWithinActiveHours, normalizeActiveHours } from "../_shared/active-hours.ts";
import { classifyPipelineStage } from "../_shared/pipelineClassifier.ts";

function normalizeEvolutionBaseUrl(value: string): string {
  const trimmed = (value || '').trim().replace(/\/+$/, '');
  if (!trimmed) return '';
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

const EVOLUTION_API_URL = normalizeEvolutionBaseUrl(Deno.env.get('EVOLUTION_API_URL') || '');
const EVOLUTION_API_KEY = Deno.env.get('EVOLUTION_API_KEY') || '';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-webhook-secret',
};

// Deterministic Kanban stage classifier lives in
// supabase/functions/_shared/pipelineClassifier.ts so both this webhook and the
// async whatsapp-ai-auto-reply worker stay in sync and are covered by tests.

function dispatchAiAutoReply(params: {
  supabaseUrl: string;
  serviceRoleKey: string;
  conversationId: string;
  messageId?: string | null;
  sessionId: string;
  companyId: string;
  content: string;
  messageType: string;
}) {
  console.log(`🤖 [AI-DISPATCH] Dispatching to auto-reply worker for conv ${params.conversationId}`);
  const work = fetch(`${params.supabaseUrl}/functions/v1/whatsapp-ai-auto-reply`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${params.serviceRoleKey}`,
    },
    body: JSON.stringify(params),
  })
  .then(res => {
    if (res.ok) console.log(`🤖 [AI-DISPATCH] Worker accepted task for conv ${params.conversationId}`);
    else console.warn(`🤖 [AI-DISPATCH] Worker returned ${res.status} for conv ${params.conversationId}`);
  })
  .catch((error) => console.error('🤖 [AI-DISPATCH] Failed:', error));

  const runtime = globalThis as unknown as { EdgeRuntime?: { waitUntil?: (promise: Promise<unknown>) => void } };
  if (runtime.EdgeRuntime?.waitUntil) runtime.EdgeRuntime.waitUntil(work);
}

// ============== HELPER: Persist last message preview into whatsapp_messages ==============
// chats.upsert events carry the last message preview from Evolution API.
// Sometimes a separate messages.upsert event is not received or arrives later.
// Without this the sidebar shows a fresh preview while the conversation view stays empty.
async function persistChatLastMessage(
  supabase: any,
  args: {
    conversationId: string;
    companyId: string;
    sessionId: string;
    chat: any;
    content: string;
    timestamp: string;
  }
) {
  try {
    const { conversationId, companyId, sessionId, chat, content, timestamp } = args;
    const lastEnvelope = (chat?.messages && chat.messages.length > 0)
      ? chat.messages[chat.messages.length - 1]
      : (chat?.lastMessage || chat?.message || chat);
    const lastMsg = lastEnvelope?.message || lastEnvelope;
    const finalContent = content || lastMsg?.conversation || lastMsg?.text || lastMsg?.extendedTextMessage?.text || 
      lastMsg?.imageMessage?.caption || lastMsg?.videoMessage?.caption || 
      lastMsg?.interactiveMessage?.body?.text || lastMsg?.buttonsMessage?.contentText || 
      lastMsg?.templateMessage?.hydratedTemplate?.hydratedContentText || '';
    const key = lastEnvelope?.key || lastEnvelope?.messageKey || lastMsg?.key || lastMsg?.messageKey || {};
    const rawMessageId: string = key.id || lastEnvelope?.id || lastMsg?.id || '';
    const fromMeRaw = key.fromMe ?? lastEnvelope?.fromMe ?? lastMsg?.fromMe;
    const fromMeKnown = typeof fromMeRaw === 'boolean';
    const fromMe: boolean = !!fromMeRaw;
    // SAFETY: chats.upsert previews are unreliable. Only persist when we have ALL of:
    //  - real wa_message_id (so messages.upsert can dedupe / replace later)
    //  - non-empty content (avoid "[Mensagem]" placeholder rows)
    //  - explicit fromMe flag (avoid mis-attributing outgoing msgs to the contact)
    // The sidebar preview is already updated via whatsapp_conversations.last_message —
    // real message rows must come from the messages.upsert event.
    if (!rawMessageId || !finalContent || !fromMeKnown) {
      console.log(`[CHAT->MSG] Skipping unreliable preview (id=${!!rawMessageId} content=${!!finalContent} fromMeKnown=${fromMeKnown})`);
      return;
    }
    const msgBody = lastMsg?.message || lastMsg || {};
    let messageType = 'text';
    if (msgBody?.imageMessage) messageType = 'image';
    else if (msgBody?.videoMessage) messageType = 'video';
    else if (msgBody?.audioMessage) messageType = 'audio';
    else if (msgBody?.documentMessage) messageType = 'document';
    else if (msgBody?.stickerMessage) messageType = 'sticker';
    else if (msgBody?.locationMessage) messageType = 'location';
    const waMessageId = rawMessageId;
    // Skip if already stored
    const { data: existing } = await supabase
      .from('whatsapp_messages')
      .select('id')
      .eq('wa_message_id', waMessageId)
      .eq('company_id', companyId)
      .maybeSingle();
    if (existing) return;
    const { error } = await supabase.from('whatsapp_messages').insert({
      conversation_id: conversationId,
      session_id: sessionId,
      company_id: companyId,
      from_me: fromMe,
      content: finalContent,
      message_type: messageType,
      status: fromMe ? 'sent' : 'received',
      timestamp,
      wa_message_id: waMessageId,
    });
    if (error) console.error('[CHAT->MSG] Insert error:', error.message);
    else console.log(`[CHAT->MSG] Persisted preview message ${waMessageId}`);
  } catch (e) {
    console.error('[CHAT->MSG] persistChatLastMessage error:', e);
  }
}

// ============== HELPER: Compat fetch that routes send calls to Evolution API ==============
// Many legacy code paths still call `${serverUrl}/api/message/send`, `/api/message/send-media`,
// and `/api/message/send-voice`. We migrated to Evolution API,
// so this wrapper rewrites those calls transparently.
async function compatFetch(input: string, init?: RequestInit): Promise<Response> {
  try {
    const url = String(input);
    const evolutionKey = Deno.env.get('EVOLUTION_API_KEY') || '';
    const evolutionBase = (Deno.env.get('EVOLUTION_API_URL') || '').replace(/\/+$/, '');
    const m = url.match(/^(https?:\/\/[^/]+)\/api\/message\/(send|send-media|send-voice)$/i);
    if (m) {
      const serverBase = m[1].replace(/\/+$/, '');
      const kind = m[2].toLowerCase();
      const isEvolution = !!evolutionKey && (
        /evolution/i.test(serverBase) ||
        (evolutionBase && serverBase === evolutionBase)
      );
      if (isEvolution) {
        let body: any = {};
        try { body = init?.body ? JSON.parse(String(init.body)) : {}; } catch { body = {}; }
        const instanceName = body.instanceName || body.instance || '';
        const jid: string = body.jid || body.remoteJid || '';
        const number = String(jid).replace(/@.*/, '').replace(/\D+/g, '');
        const rawMsg = body.message;
        const text = typeof rawMsg === 'string' ? rawMsg : (rawMsg?.text || rawMsg?.caption || body.text || body.caption || '');
        const mediaUrl = body.mediaUrl || body.url || rawMsg?.url || '';
        const mediaType = (body.mediaType || rawMsg?.type || '').toLowerCase();
        const headers = { 'Content-Type': 'application/json', apikey: evolutionKey } as Record<string, string>;

        if (kind === 'send' || (!mediaUrl && !body.audio)) {
          const evoUrl = `${serverBase}/message/sendText/${instanceName}`;
          console.log(`[COMPAT->EVO] sendText -> ${evoUrl} number=${number} len=${text?.length || 0}`);
          return await fetch(evoUrl, {
            method: 'POST',
            headers,
            body: JSON.stringify({ number, text }),
          });
        }
        if (kind === 'send-voice' || mediaType === 'audio' || body.audio) {
          const audioUrl = body.audio || mediaUrl;
          const evoUrl = `${serverBase}/message/sendWhatsAppAudio/${instanceName}`;
          console.log(`[COMPAT->EVO] sendAudio -> ${evoUrl} number=${number}`);
          return await fetch(evoUrl, {
            method: 'POST',
            headers,
            body: JSON.stringify({ number, audio: audioUrl }),
          });
        }
        // media (image/video/document)
        const evoKind = mediaType === 'video' ? 'video'
          : mediaType === 'document' ? 'document'
          : 'image';
        const evoUrl = `${serverBase}/message/sendMedia/${instanceName}`;
        console.log(`[COMPAT->EVO] sendMedia(${evoKind}) -> ${evoUrl} number=${number}`);
        return await fetch(evoUrl, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            number,
            mediatype: evoKind,
            media: mediaUrl,
            caption: text || undefined,
            fileName: body.fileName || rawMsg?.fileName || undefined,
          }),
        });
      }
    }
  } catch (e) {
    console.error('[COMPAT-FETCH] rewrite error:', (e as Error)?.message);
  }
  return await fetch(input, init);
}

async function chatbotFetch(
  supabase: any,
  conversationId: string,
  executionId: string | null | undefined,
  input: string,
  init?: RequestInit,
): Promise<Response> {
  if (conversationId) {
    const { data: conv } = await supabase
      .from('whatsapp_conversations')
      .select('human_takeover')
      .eq('id', conversationId)
      .maybeSingle();

    if (conv?.human_takeover) {
      await supabase
        .from('chatbot_executions')
        .update({ status: 'stopped', completed_at: new Date().toISOString() })
        .eq('conversation_id', conversationId)
        .eq('status', 'running');

      console.log(`👤🛑 [CHATBOT-FETCH] Blocked send: human takeover active for ${conversationId}`);
      return new Response(JSON.stringify({ error: 'human_takeover_active' }), { status: 409 });
    }
  }

  if (executionId) {
    const { data: exec } = await supabase
      .from('chatbot_executions')
      .select('status')
      .eq('id', executionId)
      .maybeSingle();

    if (!exec || exec.status !== 'running') {
      console.log(`👤🛑 [CHATBOT-FETCH] Blocked send: execution ${executionId} is not running`);
      return new Response(JSON.stringify({ error: 'chatbot_execution_stopped' }), { status: 409 });
    }
  }

  return await compatFetch(input, init);
}

// ============== HELPER: Send admin notification ==============
async function notifyAdmin(supabase: any, params: {
  event_type: string;
  event_title: string;
  event_description?: string;
  user_id?: string;
  user_email?: string;
  company_id?: string;
  company_name?: string;
  metadata?: Record<string, unknown>;
}) {
  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY");
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return;
    
    await fetch(`${SUPABASE_URL}/functions/v1/admin-notify`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify(params),
    });
    console.log(`[ADMIN-NOTIFY] Sent: ${params.event_type}`);
  } catch (e) {
    console.error("[ADMIN-NOTIFY] Failed:", e);
  }
}
// ============== HELPER: Check if JID is a group ==============
function isGroupJid(jid: string): boolean {
  return jid?.includes('@g.us') || false;
}

// ============== HELPER: Download media from Baileys/Evolution and upload to Storage ==============
async function downloadMediaToStorage(
  supabase: any,
  params: {
    baileysServerUrl: string;
    instanceName: string;
    messageId: string;
    remoteJid: string;
    sessionId: string;
    mediaType: 'image' | 'video' | 'sticker' | 'document' | 'audio' | 'ptt';
    messageKey?: Record<string, unknown>;
    mimeType?: string;
    fileNameHint?: string;
  }
): Promise<string | null> {
  const { baileysServerUrl, instanceName, messageId, remoteJid, sessionId, mediaType, messageKey, mimeType, fileNameHint } = params;
  if (!baileysServerUrl || !messageId) return null;

  const EXT_BY_TYPE: Record<string, string> = {
    image: 'jpg',
    sticker: 'webp',
    video: 'mp4',
    audio: 'ogg',
    ptt: 'ogg',
    document: 'bin',
  };
  const CT_BY_TYPE: Record<string, string> = {
    image: 'image/jpeg',
    sticker: 'image/webp',
    video: 'video/mp4',
    audio: 'audio/ogg',
    ptt: 'audio/ogg',
    document: 'application/octet-stream',
  };

  try {
    const baseUrl = baileysServerUrl.replace(/\/+$/, '');
    const apiKey = Deno.env.get('EVOLUTION_API_KEY') || '';
    const key = { ...(messageKey || {}), id: messageId, remoteJid: (messageKey?.remoteJid as string) || remoteJid };
    const attempts = [
      {
        label: 'custom-media-download',
        url: `${baseUrl}/api/media/download`,
        headers: { 'Content-Type': 'application/json' },
        body: { instanceName, messageId, remoteJid, message: { key } },
      },
      {
        label: 'evolution-get-base64',
        url: `${baseUrl}/chat/getBase64FromMediaMessage/${instanceName}`,
        headers: { 'Content-Type': 'application/json', ...(apiKey ? { apikey: apiKey } : {}) },
        body: { message: { key }, convertToMp4: mediaType === 'video' },
      },
    ];

    let data: any = null;
    for (const attempt of attempts) {
      try {
        const resp = await fetch(attempt.url, {
          method: 'POST',
          headers: attempt.headers,
          body: JSON.stringify(attempt.body),
          signal: AbortSignal.timeout(25000),
        });
        if (!resp.ok) {
          console.log(`[MEDIA-DL] ${attempt.label} returned ${resp.status} for ${mediaType}/${messageId}`);
          continue;
        }
        data = await resp.json().catch(() => null);
        if (data) break;
      } catch (attemptErr: any) {
        console.warn(`[MEDIA-DL] ${attempt.label} failed for ${mediaType}/${messageId}:`, attemptErr?.message);
      }
    }

    const base64Value = data?.base64 || data?.data?.base64 || data?.file?.base64 || data?.message?.base64;
    const urlValue = data?.url || data?.data?.url || data?.mediaUrl;
    if (base64Value) {
      const rawContentType = data?.mimetype || data?.mimeType || data?.data?.mimetype || mimeType || CT_BY_TYPE[mediaType] || 'application/octet-stream';
      const cleanBase64 = String(base64Value).includes(',') ? String(base64Value).split(',').pop()! : String(base64Value);
      const extFromMime = rawContentType.includes('/') ? rawContentType.split('/').pop()!.replace('jpeg', 'jpg').replace('mpeg', 'mp3') : '';
      const ext = extFromMime || EXT_BY_TYPE[mediaType] || 'bin';
      const safeName = (fileNameHint || messageId).replace(/[^a-zA-Z0-9._-]/g, '_').replace(/\.[a-z0-9]+$/i, '');
      const fileName = `incoming-${mediaType}/${sessionId}/${safeName}.${ext}`;
      const binary = atob(cleanBase64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      const { error: upErr } = await supabase.storage
        .from('whatsapp-media')
        .upload(fileName, bytes, { contentType: rawContentType, upsert: true });
      if (upErr) {
        console.error(`[MEDIA-DL] Upload error for ${mediaType}:`, upErr);
        return null;
      }
      const { data: pub } = supabase.storage.from('whatsapp-media').getPublicUrl(fileName);
      console.log(`[MEDIA-DL] ${mediaType} uploaded -> ${pub.publicUrl.substring(0, 80)}`);
      return pub.publicUrl;
    }
    if (urlValue) {
      console.log(`[MEDIA-DL] Using ${mediaType} URL from server: ${String(urlValue).substring(0, 80)}`);
      return String(urlValue);
    }
    console.log(`[MEDIA-DL] No base64/url returned for ${mediaType}/${messageId}`);
    return null;
  } catch (e: any) {
    console.error(`[MEDIA-DL] Failed for ${mediaType}:`, e?.message);
    return null;
  }
}

// ============== HELPER: Check if JID is a newsletter/channel ==============
function isNewsletterJid(jid: string): boolean {
  if (!jid) return false;
  // WhatsApp Channels/Newsletters use @newsletter suffix
  if (jid.includes('@newsletter')) return true;
  // Some Baileys versions send newsletters as @g.us but with specific patterns
  // Newsletter JIDs from "Updates" tab - detect by checking if it's a status broadcast variant
  return false;
}

// ============== HELPER: Validate phone/group ID ==============
function isValidIdentifier(id: string, isGroup: boolean): boolean {
  if (!id) return false;
  
  const digits = id.replace(/\D/g, '');
  
  if (isGroup) {
    // Groups have longer IDs (typically 18+ digits) - just check minimum
    return digits.length >= 8;
  } else {
    // Individual chats: 8+ digits (includes LIDs which can be 15+ digits)
    return digits.length >= 8;
  }
}

// ============== HELPER: Check if JID is a LID (Linked ID) ==============
function isLidJid(jid: string): boolean {
  return jid?.includes('@lid') || false;
}

// ============== HELPER: Normalize Brazilian phone (add 9th digit if missing) ==============
function normalizeBrazilianPhone(phone: string): string {
  // Brazilian numbers: country code 55 + 2-digit DDD + 8 or 9 digit number
  // Mobile numbers should always have 9 digits (starting with 9)
  // If we get 55 + DD + 8 digits (total 12), add the 9
  if (phone.startsWith('55') && phone.length === 12) {
    const ddd = phone.slice(2, 4);
    const local = phone.slice(4);
    if (local.length === 8) {
      const normalized = `55${ddd}9${local}`;
      console.log(`[NORMALIZE-BR] ${phone} -> ${normalized}`);
      return normalized;
    }
  }
  return phone;
}

// ============== HELPER: Normalize avatar URL for identity matching ==============
function normalizeAvatarUrl(url?: string | null): string {
  if (!url) return '';
  return url.split('?')[0].trim().toLowerCase();
}

// ============== HELPER: Normalize LID JID variants ==============
function normalizeLidJid(jid?: string | null): string {
  if (!jid) return '';
  // Some payloads can come as 159051732242678:4@lid
  return jid.replace(/:\d+(?=@lid$)/, '');
}

// ============== HELPER: Clean phone/ID from JID ==============
function extractPhoneFromJid(jid: string, allowGroups: boolean = false): string | null {
  if (!jid) return null;
  
  const isGroup = isGroupJid(jid);
  const isLid = isLidJid(jid);
  
  // Skip groups if not allowed
  if (isGroup && !allowGroups) {
    return null;
  }
  
  // Extract identifier from JID (handle @lid, @s.whatsapp.net, @g.us, @c.us)
  let identifier = jid
    .replace('@s.whatsapp.net', '')
    .replace('@g.us', '')
    .replace('@c.us', '')
    .replace('@lid', '')
    .replace(/\D/g, ''); // Remove any remaining non-digits
  
  // Validate the extracted identifier
  if (!isValidIdentifier(identifier, isGroup)) {
    console.log(`[FILTER] Invalid identifier: ${identifier} (length: ${identifier.length}, isGroup: ${isGroup}, isLid: ${isLid})`);
    return null;
  }
  
  // Normalize Brazilian phone numbers (add 9th digit if missing)
  if (!isGroup && !isLid) {
    identifier = normalizeBrazilianPhone(identifier);
  }
  
  return identifier;
}

async function markHumanTakeoverAndStopAutomations(supabase: any, params: {
  companyId: string;
  conversation: any;
  phoneVariants?: string[];
  remoteJid?: string | null;
  messageDbId?: string | null;
  reason: string;
}) {
  const { companyId, conversation, phoneVariants = [], remoteJid, messageDbId, reason } = params;
  if (!conversation?.id) return;

  const nowIso = new Date().toISOString();
  const conversationIds = new Set<string>([conversation.id]);
  const digitsFromJid = remoteJid ? String(remoteJid).replace(/@.*$/, '').replace(/\D/g, '') : '';
  const allPhones = Array.from(new Set([
    ...(phoneVariants || []),
    conversation.contact_phone,
    digitsFromJid,
  ].filter(Boolean).map((v) => String(v).replace(/\D/g, ''))));

  // Guard: outbound messages produced by a bulk dispatch (texto/mídia/áudio de Voz IA)
  // arrive back from the phone as fromMe echoes. They are NOT a human intervention —
  // marking takeover here silently kills the AI agent linked to the campaign.
  try {
    if (allPhones.length > 0) {
      const since = new Date(Date.now() - 20 * 60_000).toISOString();
      const { data: recentDispatch } = await supabase
        .from('dispatch_jobs')
        .select('id, phone, status, updated_at')
        .in('phone', allPhones)
        .eq('status', 'sent')
        .gte('updated_at', since)
        .limit(1);
      if (recentDispatch && recentDispatch.length > 0) {
        console.log(`🤖🛡️ [HUMAN-TAKEOVER] Ignorado (${reason}) — eco de disparo automático para ${allPhones.join('/')}.`);
        return;
      }
    }
  } catch (dispatchGuardError) {
    console.warn('[HUMAN-TAKEOVER] Dispatch echo guard failed:', (dispatchGuardError as Error).message);
  }


  if (allPhones.length > 0) {
    const { data: phoneMatches } = await supabase
      .from('whatsapp_conversations')
      .select('id')
      .eq('company_id', companyId)
      .in('contact_phone', allPhones);
    (phoneMatches || []).forEach((row: any) => row?.id && conversationIds.add(row.id));
  }

  if (remoteJid) {
    const { data: jidMatches } = await supabase
      .from('whatsapp_conversations')
      .select('id')
      .eq('company_id', companyId)
      .eq('remote_jid', normalizeLidJid(remoteJid));
    (jidMatches || []).forEach((row: any) => row?.id && conversationIds.add(row.id));
  }

  if (digitsFromJid) {
    const { data: lidMatches } = await supabase
      .from('whatsapp_conversations')
      .select('id')
      .eq('company_id', companyId)
      .eq('contact_lid', digitsFromJid);
    (lidMatches || []).forEach((row: any) => row?.id && conversationIds.add(row.id));
  }

  const ids = Array.from(conversationIds);
  if (ids.length === 0) return;

  const { error: stopExecError } = await supabase
    .from('chatbot_executions')
    .update({ status: 'stopped', completed_at: nowIso })
    .in('conversation_id', ids)
    .eq('status', 'running');
  if (stopExecError) {
    console.error('[HUMAN-TAKEOVER] Failed to stop chatbot_executions:', stopExecError.message);
    throw stopExecError;
  }

  const updateData: Record<string, unknown> = {
    human_takeover: true,
    human_takeover_at: nowIso,
    human_takeover_reason: reason,
    last_human_interaction_at: nowIso,
    ai_auto_reply_enabled: false,
  };
  if (messageDbId) updateData.last_human_interaction_message_id = messageDbId;

  const { error: updateConversationError } = await supabase
    .from('whatsapp_conversations')
    .update(updateData)
    .in('id', ids);
  if (updateConversationError) {
    console.error('[HUMAN-TAKEOVER] Failed to update whatsapp_conversations:', updateConversationError.message);
    throw updateConversationError;
  }

  console.log(`👤🛑 [HUMAN-TAKEOVER] Automations stopped for ${ids.length} conversation row(s): ${ids.join(', ')}`);

  try {
    const eventRows = ids.map((cid) => ({
      conversation_id: cid,
      company_id: companyId,
      event_type: 'human_takeover',
      actor_type: 'system',
      actor_name: reason?.toLowerCase().includes('crm') ? 'Operador (CRM)' : 'Celular conectado',
      reason,
      metadata: messageDbId ? { message_id: messageDbId } : {},
    }));
    await supabase.from('conversation_events').insert(eventRows);
  } catch (logErr) {
    console.warn('[HUMAN-TAKEOVER] Failed to log conversation_events:', logErr);
  }

  // Se a intervenção foi feita pelo celular conectado (dono digitou direto),
  // pergunta ao Pai se ele quer pausar só essa conversa ou o Piloto todo.
  if (typeof reason === 'string' && reason.toLowerCase().includes('celular conectado')) {
    try {
      console.log(`[PILOTO-PAUSE-PROMPT] Trigger for conv=${conversation.id} company=${companyId}`);
      await askParentAboutInterference(supabase, {
        companyId,
        conversationId: conversation.id,
        contactName: conversation.contact_name || conversation.contact_phone || 'o cliente',
      });
    } catch (askErr) {
      console.warn('[PILOTO-PAUSE-PROMPT] Failed to ask parent:', askErr);
    }
  }
}

async function askParentAboutInterference(supabase: any, params: {
  companyId: string;
  conversationId: string;
  contactName: string;
}) {
  const { companyId, conversationId, contactName } = params;

  const { data: cfg } = await supabase
    .from('crm_autopilot_configs')
    .select('id, is_active, parent_phone, parent_session_id, metadata')
    .eq('company_id', companyId)
    .maybeSingle();
  if (!cfg?.is_active || !cfg.parent_phone || !cfg.parent_session_id) {
    console.log(`[PILOTO-PAUSE-PROMPT] Skip — no active config with parent for company ${companyId}`);
    return;
  }

  const meta = (cfg.metadata as Record<string, any>) || {};
  const pending = meta.pending_pause_prompt as { conversation_id?: string; asked_at?: string } | undefined;

  // Dedupe: se já há uma pergunta pendente OU se pediu para essa conversa há < 6h, não repete.
  if (pending?.conversation_id) {
    console.log(`[PILOTO-PAUSE-PROMPT] Skip — pending prompt already exists for conv ${pending.conversation_id}`);
    return;
  }
  const recentPromptedRaw = meta?.pause_prompt_history?.[conversationId] as string | undefined;
  if (recentPromptedRaw) {
    const promptedTs = new Date(recentPromptedRaw).getTime();
    if (Number.isFinite(promptedTs) && Date.now() - promptedTs < 6 * 60 * 60 * 1000) {
      console.log(`[PILOTO-PAUSE-PROMPT] Skip — recent prompt for conv ${conversationId} at ${recentPromptedRaw}`);
      return;
    }
  }
  console.log(`[PILOTO-PAUSE-PROMPT] Sending WhatsApp to parent ${cfg.parent_phone} about conv ${conversationId}`);

  const msg = `Vi que você respondeu direto pra ${contactName}.\n\nQuer que eu:\n1 - pause o Piloto SÓ nessa conversa\n2 - pause o Piloto em TODAS as conversas\n\nResponde só "1" ou "2".`;

  const askedAt = new Date().toISOString();
  const history = { ...(meta.pause_prompt_history || {}), [conversationId]: askedAt };
  await supabase
    .from('crm_autopilot_configs')
    .update({
      metadata: {
        ...meta,
        pending_pause_prompt: { conversation_id: conversationId, contact_name: contactName, asked_at: askedAt },
        pause_prompt_history: history,
      },
    })
    .eq('id', cfg.id);

  await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/whatsapp-api`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
    },
    body: JSON.stringify({
      action: 'send_message',
      manualTakeover: false,
      sessionId: cfg.parent_session_id,
      phone: cfg.parent_phone,
      message: msg,
    }),
  }).catch((err) => console.warn('[PILOTO-PAUSE-PROMPT] send failed:', err));

  await supabase.from('crm_autopilot_events').insert({
    company_id: companyId,
    conversation_id: conversationId,
    event_type: 'pause_prompt_sent',
    description: `Perguntado ao Pai se deve pausar Piloto (só essa conversa ou todas) após intervenção em ${contactName}`,
  });
}

function normalizePhoneDigits(value: unknown): string {
  return String(value || '').replace(/\D/g, '');
}

function phoneVariants(value: unknown): string[] {
  const digits = normalizePhoneDigits(value);
  const variants = new Set<string>();
  if (digits) variants.add(digits);
  if (digits.startsWith('55') && digits.length === 13) {
    variants.add(digits.slice(0, 4) + digits.slice(5));
  } else if (digits.startsWith('55') && digits.length === 12) {
    variants.add(digits.slice(0, 4) + '9' + digits.slice(4));
  }
  return Array.from(variants);
}

async function ensureAutopilotParentLabel(supabase: any, companyId: string, conversation: any): Promise<string | null> {
  if (!companyId || !conversation?.id) return null;
  const labelName = 'PAI DO PILOTO';

  let { data: label } = await supabase
    .from('conversation_labels')
    .select('id')
    .eq('company_id', companyId)
    .eq('name', labelName)
    .maybeSingle();

  if (!label?.id) {
    const { data: owner } = await supabase
      .from('company_users')
      .select('user_id')
      .eq('company_id', companyId)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (owner?.user_id) {
      const { data: created, error } = await supabase
        .from('conversation_labels')
        .insert({ company_id: companyId, created_by: owner.user_id, name: labelName, color: '#FF4500' })
        .select('id')
        .maybeSingle();
      if (created?.id) label = created;
      if (error) {
        const { data: existingAfterRace } = await supabase
          .from('conversation_labels')
          .select('id')
          .eq('company_id', companyId)
          .eq('name', labelName)
          .maybeSingle();
        if (existingAfterRace?.id) label = existingAfterRace;
      }
    }
  }

  if (!label?.id) return null;
  const currentLabels = Array.isArray(conversation.labels) ? conversation.labels : [];
  if (!currentLabels.includes(label.id)) {
    const nextLabels = [...currentLabels, label.id];
    await supabase.from('whatsapp_conversations').update({ labels: nextLabels }).eq('id', conversation.id);
    conversation.labels = nextLabels;
  }
  return label.id;
}

async function isolateAutopilotParentChannel(supabase: any, params: {
  companyId: string;
  conversation: any;
  targetSessionId?: string | null;
  phoneNumber?: string | null;
}): Promise<{ isParentChannel: boolean; parentPhone?: string }> {
  const { companyId, conversation, targetSessionId, phoneNumber } = params;
  if (!companyId || !conversation?.id) return { isParentChannel: false };

  const { data: cfg } = await supabase
    .from('crm_autopilot_configs')
    .select('id, is_active, parent_phone, parent_session_id')
    .eq('company_id', companyId)
    .maybeSingle();

  if (!cfg?.is_active || !cfg.parent_phone || !cfg.parent_session_id) return { isParentChannel: false };
  // NOTE: We intentionally do NOT filter by session_id here. If the phone matches the parent number,
  // it must always be treated as the Parent channel — no matter which session receives the message.
  const incomingVariants = new Set([
    ...phoneVariants(phoneNumber),
    ...phoneVariants(conversation.contact_phone),
  ]);
  const parentMatches = phoneVariants(cfg.parent_phone).some((p) => incomingVariants.has(p));
  if (!parentMatches) return { isParentChannel: false };

  await ensureAutopilotParentLabel(supabase, companyId, conversation);
  await supabase
    .from('chatbot_executions')
    .update({ status: 'stopped', completed_at: new Date().toISOString() })
    .eq('conversation_id', conversation.id)
    .eq('status', 'running');

  await supabase
    .from('whatsapp_conversations')
    .update({
      human_takeover: false,
      human_takeover_at: null,
      human_takeover_reason: null,
      ai_auto_reply_enabled: false,
      assigned_agent_id: null,
    })
    .eq('id', conversation.id);

  conversation.human_takeover = false;
  conversation.ai_auto_reply_enabled = false;
  conversation.assigned_agent_id = null;
  return { isParentChannel: true, parentPhone: cfg.parent_phone };
}

function dispatchAutopilotParentReply(params: {
  supabaseUrl: string;
  serviceRoleKey: string;
  companyId: string;
  parentPhone: string;
  messageContent: string;
  messageType: string;
  mediaUrl?: string | null;
}) {
  const work = fetch(`${params.supabaseUrl}/functions/v1/crm-autopilot-parent-reply`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${params.serviceRoleKey}` },
    body: JSON.stringify({
      companyId: params.companyId,
      parentPhone: params.parentPhone,
      messageContent: params.messageContent,
      messageType: params.messageType,
      mediaUrl: params.mediaUrl || '',
    }),
  }).then(async (res) => {
    if (!res.ok) console.warn(`[PILOTO-PAI] parent-reply returned ${res.status}: ${await res.text()}`);
  }).catch((error) => console.error('[PILOTO-PAI] parent-reply dispatch failed:', error));

  const runtime = globalThis as unknown as { EdgeRuntime?: { waitUntil?: (promise: Promise<unknown>) => void } };
  if (runtime.EdgeRuntime?.waitUntil) runtime.EdgeRuntime.waitUntil(work);
}

function isAutomatedOutboundMessage(row: any): boolean {
  const sender = String(row?.sender_name || '').trim().toLowerCase();
  if (row?.is_ai_response === true) return true;
  if (['chatbot', 'ia', 'sistema', 'chatbot (fora de horário)', 'chatbot (webhook)'].includes(sender)) return true;
  // Detect WhatsApp Business auto-reply (away/greeting message) by common Portuguese phrasing.
  const content = String(row?.content || '').toLowerCase();
  const autoReplyPatterns = [
    'agradecemos sua mensagem',
    'não estamos disponíveis',
    'nao estamos disponiveis',
    'horário comercial',
    'horario comercial',
    'responderemos assim que',
    'retornaremos assim que',
    'assim que possível',
    'assim que possivel',
    'fora do horário',
    'fora do horario',
    'mensagem automática',
    'mensagem automatica',
    'obrigado por entrar em contato',
    'obrigada por entrar em contato',
  ];
  if (autoReplyPatterns.some((p) => content.includes(p))) return true;
  return false;
}

function normalizeBotComparableText(value: unknown): string {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\{\{\s*\w+\s*\}\}/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function getNodeMessageCandidates(node: any): string[] {
  const cfg = node?.data?.config || {};
  const base = cfg.message || cfg.content || node?.data?.label || '';
  if (!base) return [];

  const candidates = [String(base)];
  const buttons = Array.isArray(cfg.buttons) ? cfg.buttons : [];
  if (buttons.length > 0) {
    candidates.push(`${base}\n\n${buttons.map((b: string, i: number) => `${i + 1}. ${b}`).join('\n')}`);
  }
  return candidates;
}

async function isLikelyChatbotOutboundEcho(supabase: any, conversationId: string, row: any): Promise<boolean> {
  const content = String(row?.content || '').trim();
  if (!conversationId || !content) return false;

  const rowTs = row?.timestamp ? new Date(row.timestamp).getTime() : Date.now();
  const startedBefore = new Date(rowTs + 60_000).toISOString();
  const completedAfter = new Date(rowTs - 10 * 60_000).toISOString();

  const { data: execs, error } = await supabase
    .from('chatbot_executions')
    .select('id, flow_id, started_at, completed_at, current_node_id, execution_path, status')
    .eq('conversation_id', conversationId)
    .lte('started_at', startedBefore)
    .or(`completed_at.is.null,completed_at.gte.${completedAfter}`)
    .order('started_at', { ascending: false })
    .limit(5);

  if (error) {
    console.warn('[HUMAN-TAKEOVER] Could not inspect chatbot executions for echo:', error.message);
    return false;
  }

  const normalizedContent = normalizeBotComparableText(content);
  if (!normalizedContent) return false;

  for (const exec of execs || []) {
    if (!exec?.flow_id) continue;
    const { data: flow } = await supabase
      .from('chatbot_flows')
      .select('nodes, edges')
      .eq('id', exec.flow_id)
      .maybeSingle();

    const nodes = Array.isArray(flow?.nodes) ? flow.nodes : [];
    const edges = Array.isArray(flow?.edges) ? flow.edges : [];
    if (!nodes.length) continue;

    const candidateNodes: any[] = [];
    const currentNode = exec.current_node_id ? nodes.find((n: any) => n.id === exec.current_node_id) : null;
    if (currentNode) candidateNodes.push(currentNode);

    const path = Array.isArray(exec.execution_path) ? exec.execution_path : [];
    for (const nodeId of path.slice(-3)) {
      const n = nodes.find((node: any) => node.id === nodeId);
      if (n && !candidateNodes.some((c) => c.id === n.id)) candidateNodes.push(n);
    }

    const triggerNode = nodes.find((n: any) => n.type === 'trigger');
    const firstEdge = triggerNode ? edges.find((e: any) => e.source === triggerNode.id) : null;
    const firstNode = firstEdge ? nodes.find((n: any) => n.id === firstEdge.target) : null;
    if (firstNode && !candidateNodes.some((c) => c.id === firstNode.id)) candidateNodes.push(firstNode);

    // Final fallback: legacy executions sometimes receive the WhatsApp echo before
    // current_node_id/execution_path are persisted. Match against message/media nodes
    // from the same active flow so the bot's own echo never becomes "humano".
    for (const n of nodes) {
      if ((n.type === 'message' || n.type === 'media') && !candidateNodes.some((c) => c.id === n.id)) {
        candidateNodes.push(n);
      }
    }

    for (const node of candidateNodes) {
      const candidates = getNodeMessageCandidates(node).map(normalizeBotComparableText).filter(Boolean);
      if (candidates.some((text) => text === normalizedContent || (text.length > 24 && normalizedContent.includes(text)))) {
        console.log(`[HUMAN-TAKEOVER] Ignoring outbound ${row?.id || '(no-id)'}; matches chatbot flow ${exec.flow_id} node ${node.id}.`);
        return true;
      }
    }
  }

  return false;
}

async function findRecentHumanOutboundMessage(supabase: any, conversationId: string) {
  // Only inspect the last 6h — beyond that we consider the human absent and
  // the chatbot may resume automatically.
  const since = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();
  const { data: recentOutbound, error } = await supabase
    .from('whatsapp_messages')
    .select('id, content, sender_name, is_ai_response, timestamp')
    .eq('conversation_id', conversationId)
    .eq('from_me', true)
    .gte('timestamp', since)
    .order('timestamp', { ascending: false })
    .limit(25);

  if (error) {
    console.warn('[HUMAN-TAKEOVER] Could not inspect recent outbound messages:', error.message);
    return null;
  }

  for (const msg of recentOutbound || []) {
    if (isAutomatedOutboundMessage(msg)) continue;

    const content = String(msg?.content || '').trim();
    if (!content) continue;

    if (await isLikelyChatbotOutboundEcho(supabase, conversationId, msg)) {
      await supabase
        .from('whatsapp_messages')
        .update({ sender_name: 'Chatbot', is_ai_response: true })
        .eq('id', msg.id);
      continue;
    }

    // Auto-reply heuristic: WhatsApp Business away/greeting messages fire within
    // a couple of seconds of the customer's inbound message. A real human doesn't
    // type a full reply in <5s. If the previous inbound is very recent, treat
    // this outbound as an auto-reply and skip.
    try {
      const msgTs = msg?.timestamp ? new Date(msg.timestamp).getTime() : Date.now();
      const { data: prevInbound } = await supabase
        .from('whatsapp_messages')
        .select('id, timestamp')
        .eq('conversation_id', conversationId)
        .eq('from_me', false)
        .lte('timestamp', new Date(msgTs).toISOString())
        .order('timestamp', { ascending: false })
        .limit(1);
      const prevTs = prevInbound?.[0]?.timestamp
        ? new Date(prevInbound[0].timestamp).getTime()
        : null;
      if (prevTs !== null && msgTs - prevTs <= 5000) {
        console.log(`[HUMAN-TAKEOVER] Ignoring outbound ${msg.id}; sent ${msgTs - prevTs}ms after inbound (likely WhatsApp Business auto-reply).`);
        continue;
      }
    } catch (_) { /* ignore */ }

    // Echo guard: Evolution/Baileys can send the chatbot's own message back as
    // from_me=true with sender_name=null. If an automated message with identical
    // text exists around the same time, this is not a real human takeover.
    const msgTime = msg?.timestamp ? new Date(msg.timestamp).getTime() : Date.now();
    const echoWindowStart = new Date(msgTime - 2 * 60 * 1000).toISOString();
    const echoWindowEnd = new Date(msgTime + 2 * 60 * 1000).toISOString();
    const { data: automatedTwins } = await supabase
      .from('whatsapp_messages')
      .select('id, sender_name, is_ai_response')
      .eq('conversation_id', conversationId)
      .eq('from_me', true)
      .eq('content', content)
      .gte('timestamp', echoWindowStart)
      .lte('timestamp', echoWindowEnd)
      .neq('id', msg.id)
      .limit(5);

    if ((automatedTwins || []).some((t: any) => isAutomatedOutboundMessage(t))) {
      console.log(`[HUMAN-TAKEOVER] Ignoring outbound echo candidate ${msg.id}; automated twin found.`);
      continue;
    }

    return msg;
  }

  return null;
}


// ============== HELPER: Trigger background profile picture sync ==============
function triggerProfileSync(supabaseUrl: string, serviceRoleKey: string, companyId: string) {
  const work = fetch(`${supabaseUrl}/functions/v1/whatsapp-sync-profile-pictures`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${serviceRoleKey}`,
    },
    body: JSON.stringify({ company_id: companyId, limit: 100, force: false }),
  })
  .then(res => {
    if (res.ok) console.log(`[SYNC-TRIGGER] Background sync started for company ${companyId}`);
    else console.warn(`[SYNC-TRIGGER] Background sync returned ${res.status} for ${companyId}`);
  })
  .catch((error) => console.error('[SYNC-TRIGGER] Failed:', error));

  const runtime = globalThis as unknown as { EdgeRuntime?: { waitUntil?: (promise: Promise<unknown>) => void } };
  if (runtime.EdgeRuntime?.waitUntil) runtime.EdgeRuntime.waitUntil(work);
}

// Baileys may rotate its socket for several minutes after pairing and emit
// misleading connecting/close(401)/QR events during that stabilization.
const TRANSIENT_CONNECTING_GRACE_MS = 15 * 60 * 1000;
const TRANSIENT_CLOSE_GRACE_MS = 15 * 60 * 1000;

function isRecentIso(value?: string | null, windowMs = TRANSIENT_CONNECTING_GRACE_MS) {
  if (!value) return false;
  const time = new Date(value).getTime();
  return Number.isFinite(time) && Date.now() - time < windowMs;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    const webhookSecret = req.headers.get('x-webhook-secret');
    const body = await req.json();
    
    let { event, sessionId, instanceName, data, instance } = body;

    // Normalize Evolution instance property
    if (!instanceName && instance) {
      instanceName = typeof instance === 'string' ? instance : instance.instanceName;
    }

    // ============= EVOLUTION API NORMALIZATION =============
    // Map Evolution event names to internal event names
    if (event === 'QRCODE_UPDATED') event = 'qr.update';
    if (event === 'qrcode.updated') event = 'qr.update';
    if (event === 'MESSAGES_SET' || event === 'messages.set') {
      console.log(`[FILTER] Skipping MESSAGES_SET/history sync for session ${sessionId || instanceName}`);
      return new Response(JSON.stringify({ success: true, filtered: true, reason: 'history_sync_skipped' }), { headers: corsHeaders });
    }
    if (event === 'MESSAGES_UPSERT' || event === 'messages.upsert') event = 'messages.upsert';
    if (event === 'CHATS_SET' || event === 'chats.set') {
      console.log(`[FILTER] Skipping CHATS_SET/history sync for session ${sessionId || instanceName}`);
      return new Response(JSON.stringify({ success: true, filtered: true, reason: 'history_sync_skipped' }), { headers: corsHeaders });
    }
    if (event === 'CHATS_UPSERT' || event === 'chats.upsert' || event === 'CHATS_UPDATE' || event === 'chats.update') event = 'chats.upsert';
    if (event === 'CONNECTION_UPDATE' || event === 'connection.update') event = 'connection.update';
    if (event === 'PRESENCE_UPDATE' || event === 'presence.update') event = 'presence.update';

    if (!sessionId && instanceName) {
      const { data: sess } = await supabase
        .from('whatsapp_sessions')
        .select('id')
        .eq('instance_name', instanceName)
        .maybeSingle();
      if (sess) sessionId = sess.id;
    }

    // Normalize data shape for connection.update
    if (event === 'connection.update' && data) {
      const state = data.state || data.connection;
      const wuid = data.wuid || data.owner || '';
      const phoneFromWuid = String(wuid).replace(/@.*$/, '').replace(/\D/g, '') || undefined;
      data = {
        ...data,
        connection: state === 'open'
          ? 'open'
          : (state === 'close' || state === 'closed' || state === 'refused')
            ? 'close'
            : state,
        isConnected: state === 'open',
        phoneNumber: data.phoneNumber || phoneFromWuid,
        profilePicture: data.profilePicture || data.profilePictureUrl,
        pushName: data.pushName,
      };
    }

    console.log(`[WhatsApp Webhook] Event: ${event}, Session: ${sessionId || instanceName}`);

    // Validate webhook secret if provided
    if (webhookSecret && sessionId) {
      const { data: session } = await supabase
        .from('whatsapp_sessions')
        .select('webhook_secret')
        .eq('id', sessionId)
        .single();
      
      if (session && session.webhook_secret !== webhookSecret) {
        console.error('Invalid webhook secret');
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    // Log webhook event for debugging
    await supabase
      .from('whatsapp_webhook_events')
      .insert({
        session_id: sessionId,
        event_type: event,
        payload: body
      });

    switch (event) {
      // ==================== QR CODE RECEIVED ====================
      case 'qr':
      case 'qr.update': {
        const qrCode = data?.qrCode
          || data?.qr
          || data?.qrcode?.base64
          || data?.qrcode?.base64Image
          || data?.base64;
        
        if (qrCode && sessionId) {
          const { data: currentSession } = await supabase
            .from('whatsapp_sessions')
            .select('status, connected_at, session_data')
            .eq('id', sessionId)
            .maybeSingle();
          const currentSessionData = (currentSession?.session_data || {}) as Record<string, unknown>;
          const connectionWasOpened = currentSession?.status === 'connected'
            || isRecentIso(String(currentSessionData.last_connection_open_at || ''), TRANSIENT_CONNECTING_GRACE_MS)
            || isRecentIso(currentSession?.connected_at, TRANSIENT_CONNECTING_GRACE_MS);

          // Evolution may emit a stale QRCODE_UPDATED after the phone has already linked.
          // Never let that event downgrade a captured session back to waiting_qr.
          if (connectionWasOpened) {
            console.log(`[QR-GUARD] Ignored stale QR after open for session ${sessionId}`);
            break;
          }

          await supabase
            .from('whatsapp_sessions')
            .update({ qr_code: qrCode, status: 'waiting_qr' })
            .eq('id', sessionId);

          console.log('QR Code updated for session:', sessionId);
        }
        break;
      }

      // ==================== CONNECTION UPDATE ====================
      case 'connection.update':
      case 'connection': {
        const { connection, isConnected, qr, phoneNumber, pushName, profilePicture, statusReason, lastDisconnect } = data || {};
        
        if (sessionId) {
          const updateData: Record<string, unknown> = {};
          const { data: existingSession } = await supabase
            .from('whatsapp_sessions')
            .select('status, connected_at, last_seen_at, phone_number, session_data')
            .eq('id', sessionId)
            .maybeSingle();
          const existingSessionData = ((existingSession?.session_data || {}) as Record<string, unknown>);
          const wasRecentlyAlive = existingSession?.status === 'connected' && (
            isRecentIso(existingSession?.last_seen_at, TRANSIENT_CONNECTING_GRACE_MS) ||
            isRecentIso(existingSession?.connected_at, TRANSIENT_CONNECTING_GRACE_MS)
          );
          
          if (connection === 'open' || isConnected === true) {
            updateData.status = 'connected';
            updateData.connected_at = new Date().toISOString();
            updateData.last_seen_at = new Date().toISOString();
            updateData.session_data = {
              ...existingSessionData,
              connection_state: 'open',
              last_connection_open_at: new Date().toISOString(),
              transient_connecting_count: 0,
              transient_close_count: 0,
            };
            
            // MIGRATE: When reconnecting, update all conversations from old sessions of same company+phone
            try {
              const { data: currentSession } = await supabase
                .from('whatsapp_sessions')
                .select('company_id, phone_number')
                .eq('id', sessionId)
                .single();
              
              const linkedPhone = currentSession?.phone_number || phoneNumber;
              if (currentSession?.company_id && linkedPhone) {
                // Find all OTHER sessions with same phone number in same company
                const { data: oldSessions } = await supabase
                  .from('whatsapp_sessions')
                  .select('id')
                  .eq('company_id', currentSession.company_id)
                  .eq('phone_number', linkedPhone)
                  .neq('id', sessionId);
                
                if (oldSessions && oldSessions.length > 0) {
                  const oldSessionIds = oldSessions.map(s => s.id);
                  
                  // Migrate conversations to new session
                  const { data: migratedConvs } = await supabase
                    .from('whatsapp_conversations')
                    .update({ session_id: sessionId })
                    .in('session_id', oldSessionIds)
                    .select('id');
                  
                  // Migrate messages to new session
                  await supabase
                    .from('whatsapp_messages')
                    .update({ session_id: sessionId })
                    .in('session_id', oldSessionIds);
                  
                  console.log(`[SESSION-MIGRATE] Migrated ${migratedConvs?.length || 0} conversations from ${oldSessionIds.length} old sessions to ${sessionId}`);
                  
                  // Also migrate conversations that belong to the same company but have no session
                  await supabase
                    .from('whatsapp_conversations')
                    .update({ session_id: sessionId })
                    .eq('company_id', currentSession.company_id)
                    .is('session_id', null);
                }
              }
            } catch (migrationErr) {
              console.error('[SESSION-MIGRATE] Error migrating sessions:', migrationErr);
            }
          } else if (connection === 'close') {
            const reason = String(statusReason || lastDisconnect?.error?.output?.statusCode || lastDisconnect?.reason || '').toLowerCase();
            const looksLikeLogout = reason.includes('logged') || reason.includes('logout') || reason === '401' || reason === '403';
            const wasJustOpen = isRecentIso(String(existingSessionData.last_connection_open_at || ''), TRANSIENT_CLOSE_GRACE_MS);

            // Baileys commonly emits close/401 while replacing the QR transport with
            // the authenticated socket. A close immediately after open is transient;
            // an explicit logout is handled outside this short stabilization window.
            if (wasRecentlyAlive || wasJustOpen) {
              updateData.status = 'connected';
              updateData.session_data = {
                ...existingSessionData,
                connection_state: 'close_transient_ignored',
                last_transient_close_at: new Date().toISOString(),
                last_transient_close_reason: statusReason || lastDisconnect || null,
                transient_close_count: Number(existingSessionData.transient_close_count || 0) + 1,
              };
              console.log(`[CONNECTION-DEBOUNCE] Ignored transient close for ${sessionId}`);
            } else {
              updateData.status = 'disconnected';
              updateData.session_data = {
                ...existingSessionData,
                connection_state: 'close',
                last_connection_close_at: new Date().toISOString(),
                last_connection_close_reason: statusReason || lastDisconnect || null,
              };
            }
          } else if (connection === 'connecting') {
            // Evolution/Baileys can emit duplicate "connecting" events after an "open" event.
            // Do not downgrade a recently connected instance, otherwise the CRM flickers red/green every second.
            if (wasRecentlyAlive) {
              updateData.status = 'connected';
              updateData.session_data = {
                ...existingSessionData,
                connection_state: 'connecting_transient_ignored',
                last_transient_connecting_at: new Date().toISOString(),
                transient_connecting_count: Number(existingSessionData.transient_connecting_count || 0) + 1,
              };
              console.log(`[CONNECTION-DEBOUNCE] Ignored transient connecting for ${sessionId}`);
            } else {
              updateData.status = 'connecting';
              updateData.session_data = {
                ...existingSessionData,
                connection_state: 'connecting',
                last_connection_connecting_at: new Date().toISOString(),
              };
            }
          }
          
          if (qr) updateData.qr_code = qr;
          if (phoneNumber) updateData.phone_number = phoneNumber;
          if (pushName) updateData.push_name = pushName;
          if (profilePicture) updateData.profile_picture = profilePicture;
          
          if (Object.keys(updateData).length > 0) {
            await supabase
              .from('whatsapp_sessions')
              .update(updateData)
              .eq('id', sessionId);
            
            console.log('Connection updated:', updateData);
            
            // Notify admin on connection/disconnection (with dedup)
            if (updateData.status === 'connected' || updateData.status === 'disconnected') {
              // Get session owner info
              const { data: sessionInfo } = await supabase
                .from('whatsapp_sessions')
                .select('company_id, phone_number, push_name')
                .eq('id', sessionId)
                .single();
              
              if (sessionInfo) {
                let shouldNotify = true;

                // For disconnection: only notify if there's NO other connected session for this company
                // This prevents spam when Baileys rotates sessions (old disconnects, new connects)
                if (updateData.status === 'disconnected') {
                  const { data: otherConnected } = await supabase
                    .from('whatsapp_sessions')
                    .select('id')
                    .eq('company_id', sessionInfo.company_id)
                    .eq('status', 'connected')
                    .neq('id', sessionId)
                    .limit(1);
                  
                  if (otherConnected && otherConnected.length > 0) {
                    console.log(`[NOTIFY-SKIP] Skipping disconnect notification for ${sessionId} - another session is still connected`);
                    shouldNotify = false;
                  }
                }

                if (shouldNotify) {
                  const { data: companyInfo } = await supabase
                    .from('companies')
                    .select('name')
                    .eq('id', sessionInfo.company_id)
                    .single();
                  
                  const isConnected = updateData.status === 'connected';
                  notifyAdmin(supabase, {
                    event_type: isConnected ? 'whatsapp_connected' : 'whatsapp_disconnected',
                    event_title: isConnected
                      ? `Parabéns ${companyInfo?.name || sessionInfo.push_name || 'Usuário'}! Seu WhatsApp foi conectado em nosso sistema.`
                      : `O WhatsApp de ${companyInfo?.name || sessionInfo.push_name || 'Usuário'} foi desconectado.`,
                    event_description: `Número: ${sessionInfo.phone_number || phoneNumber || 'Desconhecido'}`,
                    company_id: sessionInfo.company_id,
                    company_name: companyInfo?.name,
                    metadata: { phone_number: sessionInfo.phone_number || phoneNumber, push_name: sessionInfo.push_name || pushName },
                  });
                }
              }
            }
          }
        }
        break;
      }

      case 'presence.update': {
        const { id, presences } = data || {};
        if (!id || !presences) break;

        // Evolution API sends participant JID in presences object
        const remoteJid = id;
        const participantJids = Object.keys(presences);
        if (participantJids.length === 0) break;

        const presenceValue = presences[participantJids[0]]?.lastKnownPresence || presences[participantJids[0]]?.presence;
        
        if (sessionId) {
          let typingStatus = null;
          if (presenceValue === 'composing') typingStatus = 'composing';
          else if (presenceValue === 'recording') typingStatus = 'recording';
          
          const phone = remoteJid.replace(/@.*$/, '').replace(/\D/g, '');
          
          // Clear status after 10 seconds automatically via updated_at filter in UI, 
          // but here we just persist what we got.
          await supabase
            .from('whatsapp_conversations')
            .update({ 
              typing_status: typingStatus,
              typing_updated_at: new Date().toISOString()
            })
            .eq('session_id', sessionId)
            .eq('contact_phone', phone);
            
          console.log(`[PRESENCE] Updated status for ${phone} to ${typingStatus}`);
        }
        break;
      }

      // ==================== CHATS SYNC ====================
      case 'chats.upsert':
      case 'chats.update':
      case 'chats.set': {
        const chats = Array.isArray(data) ? data : (data?.chats || (data ? [data] : []));
        console.log(`[CHATS] Processing ${chats.length} chats for session ${sessionId || instanceName}`);
        
        // Get session info
        let targetSessionId = sessionId;
        let companyId = '';
        
        if (!targetSessionId && instanceName) {
          const { data: session } = await supabase
            .from('whatsapp_sessions')
            .select('id, company_id')
            .eq('instance_name', instanceName)
            .single();
          
          if (session) {
            targetSessionId = session.id;
            companyId = session.company_id;
          }
        } else if (targetSessionId) {
          const { data: session } = await supabase
            .from('whatsapp_sessions')
            .select('company_id')
            .eq('id', targetSessionId)
            .single();
          
          if (session) companyId = session.company_id;
        }
        
        if (!targetSessionId || !companyId) {
          console.log('Could not find session for chats');
          break;
        }
        
        let processedCount = 0;
        for (const chat of chats) {
          try {
            // Evolution API can send `chat.id` as its internal DB CUID (e.g., "cmovqt3...")
            // instead of a real WhatsApp JID. Always prefer fields that contain a JID suffix
            // (`@s.whatsapp.net`, `@g.us`, `@lid`, `@newsletter`).
            const candidates = [
              chat.remoteJid, chat.remote_jid, chat.jid, chat.id,
              chat.chatId, chat.key?.remoteJid, chat.senderPn, chat.senderPhoneJid,
            ].filter((v: unknown): v is string => typeof v === 'string' && v.length > 0);
            const jid = candidates.find((v) => v.includes('@')) || '';
            if (!jid || jid === 'status@broadcast') {
              console.log(`[CHAT SKIP] No valid JID found in chat payload (id=${chat.id})`);
              continue;
            }
            
            // Skip WhatsApp Channels/Newsletters (Updates tab)
            if (isNewsletterJid(jid)) {
              console.log(`[FILTER] Skipping newsletter/channel: ${jid}`);
              continue;
            }
            
            const isGroup = isGroupJid(jid);
            
            // Groups are disabled platform-wide — never create/sync them
            if (isGroup) {
              console.log(`[FILTER] Skipping group chat: ${jid}`);
              continue;
            }

            // For LID chats, try to resolve to real phone using alternative JID fields
            let resolvedJid = jid;
            if (isLidJid(jid) && !isGroup) {
              const altJid = chat.lidJid || chat.phoneJid || chat.altJid || chat.senderPn || chat.senderPhoneJid;
              if (altJid && !isLidJid(altJid)) {
                console.log(`[CHAT LID] Resolved ${jid} -> ${altJid}`);
                resolvedJid = altJid;
              } else {
                const lidDigits = jid.replace(/@.*$/, '').replace(/\D/g, '');
                const { data: mappedConv } = await supabase
                  .from('whatsapp_conversations')
                  .select('contact_phone, remote_jid')
                  .eq('company_id', companyId)
                  .eq('contact_lid', lidDigits)
                  .order('last_message_at', { ascending: false })
                  .limit(1)
                  .maybeSingle();
                if (mappedConv?.contact_phone) {
                  resolvedJid = mappedConv.remote_jid && !isLidJid(mappedConv.remote_jid)
                    ? mappedConv.remote_jid
                    : `${mappedConv.contact_phone}@s.whatsapp.net`;
                  console.log(`[CHAT LID-MAP] Resolved ${jid} -> ${resolvedJid}`);
                } else {
                  console.log(`[CHAT LID-SKIP] Skipping unresolvable LID chat: ${jid}`);
                  continue;
                }
              }
            }
            
            // Extract and validate identifier (phone number or group ID)
            const phoneNumber = extractPhoneFromJid(resolvedJid, true);
            if (!phoneNumber) continue;
            
            // ============== IMPROVED: Get contact/group name ==============
            // For groups: prioritize groupSubject, subject, groupName
            // For individuals: prioritize name, notify, pushName - NEVER fall back to raw LID
            let contactName: string;
            if (isGroup) {
              contactName = chat.groupSubject || chat.subject || chat.groupName || 
                           chat.name || chat.metadata?.subject || phoneNumber;
              console.log(`[CHAT GROUP] ${phoneNumber} => "${contactName}"`);
            } else {
              contactName = chat.name || chat.notify || chat.pushName || chat.verifiedName || '';
              // If no name available, use phone number (not LID identifier)
              if (!contactName) contactName = phoneNumber;
            }
            
            // Profile picture - from enriched data or chat object
            const profilePicture = chat.profilePicture || chat.imgUrl || chat.picture || null;
            
            // Get last message info - handle multiple formats from Evolution API
            const lastMsg = chat.conversationTimestamp || chat.lastMessage?.messageTimestamp;
            let lastMessageAt = new Date().toISOString();
            
            // Robust timestamp parsing
            const parseTimestamp = (ts: unknown): string | null => {
              try {
                if (!ts) return null;
                
                let timestamp: number;
                
                // Handle {high, low, unsigned} Long format from protobuf
                if (typeof ts === 'object' && ts !== null) {
                  const obj = ts as Record<string, unknown>;
                  if ('low' in obj && typeof obj.low === 'number') {
                    timestamp = obj.low;
                  } else if ('toNumber' in obj && typeof obj.toNumber === 'function') {
                    timestamp = (obj as { toNumber: () => number }).toNumber();
                  } else {
                    return null;
                  }
                } else if (typeof ts === 'string') {
                  timestamp = parseInt(ts, 10);
                } else if (typeof ts === 'number') {
                  timestamp = ts;
                } else {
                  return null;
                }
                
                // Validate timestamp is reasonable (after 2000, before 2100)
                if (isNaN(timestamp) || timestamp <= 0) return null;
                
                // Check if timestamp is in milliseconds (> year 2100 in seconds)
                const isMillis = timestamp > 4102444800;
                const dateMs = isMillis ? timestamp : timestamp * 1000;
                
                // Validate date range
                if (dateMs < 946684800000 || dateMs > 4102444800000) return null;
                
                const date = new Date(dateMs);
                if (isNaN(date.getTime())) return null;
                
                return date.toISOString();
              } catch {
                return null;
              }
            };
            
            const parsedTime = parseTimestamp(lastMsg);
            if (parsedTime) {
              lastMessageAt = parsedTime;
            }
            
            // Extract last message content
            let lastMessageContent = '';
            if (chat.messages && chat.messages.length > 0) {
              // Get last message from messages array
              const lastMsgObj = chat.messages[chat.messages.length - 1];
              const msgData = lastMsgObj?.message?.message || lastMsgObj?.message || {};
              lastMessageContent = msgData.conversation || 
                                   msgData.extendedTextMessage?.text ||
                                   msgData.imageMessage?.caption ||
                                   '[Mídia]';
            } else if (chat.lastMessage) {
              const msgContent = chat.lastMessage.message || chat.lastMessage;
              lastMessageContent = msgContent.conversation || 
                                   msgContent.extendedTextMessage?.text ||
                                   msgContent.imageMessage?.caption ||
                                   msgContent.videoMessage?.caption ||
                                   '';
            }
            
            // IMPROVED: Find existing conversation by company_id + contact_phone
            // Also check for the variant without 9th digit (Brazilian normalization)
            const phoneVariants = [phoneNumber];
            if (phoneNumber.startsWith('55') && phoneNumber.length === 13) {
              // Also search without 9th digit: 55 + DD + 9XXXXXXXX -> 55 + DD + XXXXXXXX
              const withoutNinth = phoneNumber.slice(0, 4) + phoneNumber.slice(5);
              phoneVariants.push(withoutNinth);
            }
            
            const { data: existingConv } = await supabase
              .from('whatsapp_conversations')
              .select('id, session_id, contact_name, profile_picture, contact_phone')
              .eq('company_id', companyId)
              .in('contact_phone', phoneVariants)
              .order('last_message_at', { ascending: false })
              .limit(1)
              .maybeSingle();
            
            if (existingConv) {
              // Update existing conversation
              // ============== PRESERVE DATA: Never overwrite with empty values ==============
              // Only update name if:
              // 1. We have a valid new name (not empty, not just the phone number)
              // 2. AND either the existing name is empty OR it's a group (groups can have name changes)
              const hasValidNewName = contactName && contactName.trim() && contactName !== phoneNumber;
              const existingNameEmpty = !existingConv.contact_name || existingConv.contact_name === phoneNumber;
              const shouldUpdateName = hasValidNewName && (isGroup || existingNameEmpty);

              // Do NOT overwrite status if there's a running chatbot execution — the
              // Evolution "chats.upsert" event was flipping conversations to 'archived'
              // mid-flow, making the chatbot disappear from the CRM list.
              const { data: runningExec } = await supabase
                .from('chatbot_executions')
                .select('id')
                .eq('conversation_id', existingConv.id)
                .eq('status', 'running')
                .limit(1)
                .maybeSingle();

              const updatePayload: Record<string, unknown> = {
                session_id: targetSessionId,
                last_message: lastMessageContent || chat.lastMessage?.conversation || '',
                last_message_at: lastMessageAt,
                unread_count: chat.unreadCount || 0
              };
              if (!runningExec) {
                updatePayload.status = chat.archive ? 'archived' : 'open';
              }
              
              // Normalize phone if it was stored without 9th digit
              if (existingConv.contact_phone !== phoneNumber) {
                updatePayload.contact_phone = phoneNumber;
                console.log(`[NORMALIZE] Updating phone: ${existingConv.contact_phone} -> ${phoneNumber}`);
              }
              
              // Only update contact_name if we have a valid new name
              if (shouldUpdateName) {
                updatePayload.contact_name = contactName;
                console.log(`[CHAT] Updating name: "${existingConv.contact_name}" -> "${contactName}"`);
              }
              
              // Only update profile_picture if we have a valid new one
              // NEVER overwrite existing picture with null/empty
              if (profilePicture && profilePicture.trim()) {
                updatePayload.profile_picture = profilePicture;
                updatePayload.sync_status = 'synced';
              } else if (!existingConv.profile_picture) {
                // If we don't have a picture yet, mark as queued for background sync
                updatePayload.sync_status = 'queued';
              }
              
              await supabase
                .from('whatsapp_conversations')
                .update(updatePayload)
                .eq('id', existingConv.id);
              
              // Trigger background sync if picture is missing
              if (!profilePicture || !profilePicture.trim()) {
                triggerProfileSync(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, companyId);
              }
              processedCount++;
              // Persist the last message itself so the conversation view isn't empty
              await persistChatLastMessage(supabase, {
                conversationId: existingConv.id,
                companyId,
                sessionId: targetSessionId,
                chat,
                content: lastMessageContent,
                timestamp: lastMessageAt,
              });
            } else {
              // Create new conversation
               const { data: created, error } = await supabase
                .from('whatsapp_conversations')
                .insert({
                  session_id: targetSessionId,
                  company_id: companyId,
                  contact_phone: phoneNumber,
                  contact_name: contactName,
                  profile_picture: profilePicture,
                  remote_jid: chat.id || (phoneNumber + '@s.whatsapp.net'),
                  status: chat.archive ? 'archived' : 'open',
                  last_message: lastMessageContent || chat.lastMessage?.conversation || '',
                  last_message_at: lastMessageAt,
                  unread_count: chat.unreadCount || 0,
                  sync_status: profilePicture ? 'synced' : 'queued'
                })
                .select('id')
                .maybeSingle();
              
              if (!error) {
                processedCount++;
                if (created?.id) {
                  // Trigger background sync if picture is missing
                  if (!profilePicture) {
                    triggerProfileSync(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, companyId);
                  }

                  await persistChatLastMessage(supabase, {
                    conversationId: created.id,
                    companyId,
                    sessionId: targetSessionId,
                    chat,
                    content: lastMessageContent,
                    timestamp: lastMessageAt,
                  });
                }
              } else console.error(`[CHAT] Error creating ${contactName}:`, error.message);
            }
          } catch (e) {
            console.error(`[CHAT] Error syncing chat:`, e);
          }
        }
        
        console.log(`[CHATS] Finished: ${processedCount}/${chats.length} processed`);
        break;
      }

      // ==================== NEW MESSAGE ====================
      case 'messages.upsert':
      case 'message':
      case 'message.received': {
        const messages = Array.isArray(data) ? data : (data?.messages || (data ? [data] : []));

        // Resolve session context ONCE (fixes ReferenceError + improves perf)
        let targetSessionId = sessionId as string | undefined;
        let companyId = '';
        let sessionPhone = '';
        let sessionOwnerLid = '';
        let sessionInstanceName = (instanceName as string) || '';
        let sessionServerUrl = '';

        // Try by sessionId first
        if (targetSessionId) {
          const { data: session } = await supabase
            .from('whatsapp_sessions')
            .select('company_id, phone_number, instance_name, baileys_server_url, session_data')
            .eq('id', targetSessionId)
            .single();

          if (session) {
            companyId = session.company_id;
            sessionPhone = session.phone_number || '';
            sessionInstanceName = session.instance_name || sessionInstanceName;
            sessionServerUrl = session.baileys_server_url || '';
            sessionOwnerLid = ((session.session_data as any)?.owner_lid || '').replace(/\D/g, '');
          }
        }

        // Fallback: if sessionId didn't resolve OR wasn't provided, try instanceName
        if (!companyId && instanceName) {
          const { data: session } = await supabase
            .from('whatsapp_sessions')
            .select('id, company_id, phone_number, instance_name, baileys_server_url, session_data')
            .eq('instance_name', instanceName)
            .single();

          if (session) {
            targetSessionId = session.id;
            companyId = session.company_id;
            sessionPhone = session.phone_number || '';
            sessionInstanceName = session.instance_name || sessionInstanceName;
            sessionServerUrl = session.baileys_server_url || '';
            sessionOwnerLid = ((session.session_data as any)?.owner_lid || '').replace(/\D/g, '');
            console.log(`[Session] Resolved via instanceName fallback: ${instanceName} -> ${session.id}`);
          }
        }

        if (!targetSessionId || !companyId) {
          console.log(`Could not find session for message batch. sessionId=${sessionId}, instanceName=${instanceName}`);
          
          // REMOVED dangerous last-resort fallback that could route messages to wrong company
          // If sessionId is stale, we should NOT guess - just drop the message
          console.log(`[Session] No fallback available. Dropping message for stale sessionId=${sessionId}`);
          
          if (!targetSessionId || !companyId) {
            break;
          }
        }

        // SELF-HEAL: receiving messages is proof-of-life. If health-check marked
        // this session as disconnected/connecting but Baileys is still pushing
        // messages, restore status to 'connected' so the UI reflects reality.
        if (targetSessionId) {
          try {
            const { data: sessNow } = await supabase
              .from('whatsapp_sessions')
              .select('status, session_data')
              .eq('id', targetSessionId)
              .single();
            if (sessNow && sessNow.status !== 'connected') {
              const sd = (sessNow.session_data || {}) as Record<string, unknown>;
              sd.consecutive_failures = 0;
              sd.reconnected_by = 'webhook_proof_of_life';
              sd.reconnected_at = new Date().toISOString();
              await supabase
                .from('whatsapp_sessions')
                .update({
                  status: 'connected',
                  last_seen_at: new Date().toISOString(),
                  session_data: sd,
                })
                .eq('id', targetSessionId);
              console.log(`[SELF-HEAL] Session ${targetSessionId} restored to connected via incoming message`);
            } else if (sessNow) {
              await supabase
                .from('whatsapp_sessions')
                .update({ last_seen_at: new Date().toISOString() })
                .eq('id', targetSessionId);
            }
          } catch (healErr) {
            console.warn('[SELF-HEAL] Failed to update session liveness:', healErr);
          }
        }

        for (const msg of messages) {
          const messageKey = msg.key || {};
          const keySenderPn = messageKey.senderPn || msg.senderPn || msg.senderPhoneJid || msg.participant || msg.sender || null;

          // Prioritize non-LID alternatives when available (senderPn/remoteJidAlt)
          let remoteJid = messageKey.remoteJidAlt || msg.remoteJidAlt || keySenderPn || messageKey.remoteJid || msg.from || msg.remoteJid || msg.chatJid;
          remoteJid = normalizeLidJid(remoteJid);

          // Log all available JID fields for debugging LID issues
          console.log(`[JID-DEBUG] remoteJid=${messageKey.remoteJid}, remoteJidAlt=${messageKey.remoteJidAlt}, senderPn=${messageKey.senderPn || msg.senderPn}, msg.from=${msg.from}, msg.remoteJidAlt=${msg.remoteJidAlt}, msg.chatJid=${msg.chatJid}, msg.sender=${msg.sender}, resolved=${remoteJid}`);

          // Skip WhatsApp Channels/Newsletters (Updates tab)
          if (isNewsletterJid(remoteJid)) {
            console.log(`[FILTER] Skipping newsletter message from: ${remoteJid}`);
            continue;
          }

          // If still a LID, try to get real JID from other fields
          if (isLidJid(remoteJid)) {
            const altJidRaw = messageKey.remoteJidAlt || msg.remoteJidAlt || keySenderPn || msg.chatJid || msg.from;
            const altJid = normalizeLidJid(altJidRaw);
            if (altJid && !isLidJid(altJid)) {
              console.log(`[LID] Resolved LID ${remoteJid} to real JID ${altJid}`);
              remoteJid = altJid;
            } else {
              // PRIORITY: Lookup LID mapping in our conversations table (contact_lid column)
              try {
                const lidDigits = remoteJid.replace(/@.*$/, '').replace(/\D/g, '');
                if (lidDigits) {
                  const { data: mappedConv } = await supabase
                    .from('whatsapp_conversations')
                    .select('contact_phone, remote_jid')
                    .eq('company_id', companyId)
                    .eq('contact_lid', lidDigits)
                    .order('last_message_at', { ascending: false })
                    .limit(1)
                    .maybeSingle();
                  if (mappedConv?.contact_phone) {
                    remoteJid = mappedConv.remote_jid && !isLidJid(mappedConv.remote_jid)
                      ? mappedConv.remote_jid
                      : `${mappedConv.contact_phone}@s.whatsapp.net`;
                    console.log(`[LID-MAP] Resolved LID ${lidDigits} -> ${remoteJid} via contact_lid mapping`);
                  }
                }
              } catch (mapErr: any) {
                console.warn('[LID-MAP] lookup failed:', mapErr?.message);
              }
            }

            if (isLidJid(remoteJid)) {
              // LAST RESORT: Try to resolve LID via Baileys /api/number/check
              console.log(`[LID-WARN] No alt JID available for ${remoteJid}, trying Baileys server resolution...`);
              try {
                const { data: sessLid } = await supabase
                  .from('whatsapp_sessions')
                  .select('baileys_server_url, instance_name')
                  .eq('id', targetSessionId)
                  .single();
                if (sessLid?.baileys_server_url) {
                  const lidDigits = remoteJid.replace(/@.*$/, '').replace(/\D/g, '');
                  const EVOLUTION_API_KEY = Deno.env.get('EVOLUTION_API_KEY') || '';
                  const evoUrl = (sessLid.baileys_server_url || '').replace(/\/+$/, '');

                  // 1) Try Evolution's /chat/findContacts to resolve LID -> phone JID
                  try {
                    const r = await fetch(`${evoUrl}/chat/findContacts/${sessLid.instance_name}`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json', 'apikey': EVOLUTION_API_KEY },
                      body: JSON.stringify({ where: { } }),
                      signal: AbortSignal.timeout(10000),
                    });
                    if (r.ok) {
                      const list = await r.json();
                      const items = Array.isArray(list) ? list : (list?.data || []);
                      const match = items.find((c: any) => {
                        const cLid = (c.lid || c.remoteJidLid || '').replace(/@.*$/, '').replace(/\D/g, '');
                        return cLid === lidDigits;
                      });
                      if (match?.id || match?.remoteJid) {
                        const resolved = String(match.id || match.remoteJid);
                        if (!isLidJid(resolved)) {
                          remoteJid = resolved;
                          console.log(`[LID-EVO] Resolved via findContacts: ${lidDigits} -> ${resolved}`);
                        }
                      }
                    }
                  } catch (_) { /* ignore */ }

                  // 2) Fallback: existing conversations - match by LID in remote_jid column
                  if (isLidJid(remoteJid)) {
                    const { data: lidConv } = await supabase
                      .from('whatsapp_conversations')
                      .select('contact_phone, remote_jid')
                      .eq('company_id', companyId)
                      .like('remote_jid', `%${lidDigits}%`)
                      .not('contact_phone', 'like', `%${lidDigits}%`)
                      .limit(1)
                      .maybeSingle();
                    if (lidConv && lidConv.contact_phone.startsWith('55')) {
                      remoteJid = lidConv.contact_phone + '@s.whatsapp.net';
                      console.log(`[LID-DB] Found existing mapping: LID ${lidDigits} -> ${remoteJid}`);
                    }
                  }
                }
              } catch (lidErr: any) {
                console.error(`[LID-ERR] Error resolving LID: ${lidErr.message}`);
              }
              
              // If STILL a LID after all attempts:
              //   - For outgoing messages (key.fromMe = true) we KEEP them, attached to whichever
              //     existing conversation matches the LID. This is critical: when the user sends
              //     from his phone, Evolution often puts the recipient's @lid in remoteJid.
              //     Skipping these would hide all "my" messages from the chat.
              //   - For incoming we still skip ghost LIDs.
              if (isLidJid(remoteJid)) {
                const isOutgoing = messageKey.fromMe || msg.fromMe;
                if (!isOutgoing) {
                  console.log(`[LID-SKIP] Skipping incoming message - could not resolve LID: ${remoteJid}`);
                  continue;
                }
                console.log(`[LID-KEEP] Keeping outgoing message with unresolved LID: ${remoteJid}`);
              }
            }
          }

          // ============== IMPROVED: Determine fromMe more reliably ==============
          // Compare sender with session phone to fix cases where Baileys misflags fromMe
          let fromMe = messageKey.fromMe || msg.fromMe || false;

          // Collect ALL possible sender JIDs (used for both fromMe detection and LID learning)
          const allSenderCandidates: string[] = [
            messageKey.participant,
            messageKey.participantPn,
            messageKey.participantAlt,
            messageKey.participantLid,
            messageKey.senderPn,
            messageKey.senderLid,
            msg.participant,
            msg.participantPn,
            msg.participantLid,
            msg.senderPhone,
            msg.senderJid,
            msg.senderLid,
            (!isGroupJid(messageKey.remoteJid || '') ? messageKey.remoteJid : ''),
          ].filter(Boolean) as string[];

          // 1. Match by LID against the session's stored owner_lid
          if (!fromMe && sessionOwnerLid) {
            for (const cand of allSenderCandidates) {
              const raw = String(cand).replace(/@.*$/, '').replace(/\D/g, '');
              if (raw && raw === sessionOwnerLid) {
                console.log(`[MESSAGE] Correcting fromMe via owner_lid match ${cand}`);
                fromMe = true;
                break;
              }
            }
          }

          // 2. Match by phone tail against session phone number
          if (!fromMe && sessionPhone) {
            const sessionPhoneRaw = sessionPhone.replace(/\D/g, '');
            const sessionTail = sessionPhoneRaw.slice(-8);
            for (const cand of allSenderCandidates) {
              const raw = String(cand).replace(/@.*$/, '').replace(/\D/g, '');
              // Only match by tail when the candidate is a real phone (not a LID).
              // LIDs are 15-digit pseudo numbers that may coincidentally share suffixes.
              const candIsLid = String(cand).includes('@lid');
              if (!candIsLid && raw && sessionTail && raw.includes(sessionTail)) {
                console.log(`[MESSAGE] Correcting fromMe via candidate ${cand} matching session ${sessionPhoneRaw}`);
                fromMe = true;
                break;
              }
            }
          }

          // 3. AUTO-LEARN owner_lid: when fromMe is confirmed (via key.fromMe or phone match)
          //    AND a LID participant is present, save it so future group messages from this
          //    device are correctly attributed even when key.fromMe is missing.
          if (fromMe && !sessionOwnerLid && targetSessionId) {
            for (const cand of allSenderCandidates) {
              if (String(cand).includes('@lid')) {
                const lidDigits = String(cand).replace(/@.*$/, '').replace(/\D/g, '');
                if (lidDigits && lidDigits.length >= 10) {
                  sessionOwnerLid = lidDigits;
                  console.log(`[OWNER-LID] Learned owner LID ${lidDigits} for session ${targetSessionId}`);
                  // Persist to session_data (fire-and-forget)
                  (async () => {
                    const { data } = await supabase
                      .from('whatsapp_sessions')
                      .select('session_data')
                      .eq('id', targetSessionId)
                      .single();
                      const sd = ((data?.session_data as any) || {}) as Record<string, unknown>;
                      sd.owner_lid = lidDigits;
                      sd.owner_lid_learned_at = new Date().toISOString();
                      await supabase
                        .from('whatsapp_sessions')
                        .update({ session_data: sd })
                        .eq('id', targetSessionId!);
                      console.log(`[OWNER-LID] Persisted for ${targetSessionId}`);
                  })().catch((e: any) => console.warn('[OWNER-LID] Persist failed:', e?.message));
                  break;
                }
              }
            }
          }

          const messageId = messageKey.id || msg.id;
          
          // Skip protocol messages (sync notifications)
          if (msg.message?.protocolMessage) {
            console.log('Skipping protocol message');
            continue;
          }
          
          const isGroup = isGroupJid(remoteJid);
          
          // Groups are disabled platform-wide — never ingest group messages
          if (isGroup) {
            console.log(`[FILTER] Skipping group message from ${remoteJid}`);
            continue;
          }

          // ============== GROUP MESSAGE: Extract actual sender ==============
          // Server v3.5.0+ sends senderPhone, senderName, and groupName directly
          // Fallback to extracting from messageKey.participant for older servers
          let senderPhone = '';
          let senderName = '';
          
          // First try direct fields from server v3.5.0+
          if (msg.senderPhone) {
            senderPhone = msg.senderPhone;
          }
          if (msg.senderName) {
            senderName = msg.senderName;
          }
          
          // Fallback: extract from participant JID for older server versions
          if (isGroup && !fromMe && !senderPhone) {
            const participantJid = messageKey.participant || msg.participant;
            if (participantJid) {
              senderPhone = extractPhoneFromJid(participantJid, false) || '';
              if (!senderName) {
                senderName = msg.pushName || '';
              }
            }
          }
          
          // For individual chats, sender is the contact
          if (!isGroup && !fromMe && !senderName) {
            senderName = msg.pushName || '';
          }
          
          if (isGroup && (senderName || senderPhone)) {
            console.log(`[GROUP MSG] Sender: ${senderName} (${senderPhone})`);
          }
          
          // Extract and validate identifier (allows groups now)
          const phoneNumber = extractPhoneFromJid(remoteJid, true);
          if (!phoneNumber) {
            console.log(`[FILTER] Skipping message - invalid identifier from JID: ${remoteJid}`);
            continue;
          }
          
          // Extract message content
          let content = '';
          let messageType = 'text';
          let mediaUrl = msg.mediaUrl || '';
          let mediaCaption = msg.mediaCaption || '';
          
          // Handle media from server v3.0.0+
          if (msg.mediaType) {
            messageType = msg.mediaType;
            if (msg.mediaUrl) {
              mediaUrl = msg.mediaUrl;
            }
          }
          
          const messageContent = msg.message || msg;
          
          if (messageContent.conversation) {
            content = messageContent.conversation;
          } else if (messageContent.extendedTextMessage) {
            content = messageContent.extendedTextMessage.text || '';
          } else if (messageContent.imageMessage) {
            messageType = 'image';
            mediaCaption = messageContent.imageMessage.caption || '';
            content = mediaCaption || '[Imagem]';
            mediaUrl = mediaUrl || messageContent.imageMessage.url || '';
            if (targetSessionId) {
              try {
                const { data: sessMedia } = await supabase
                  .from('whatsapp_sessions')
                  .select('baileys_server_url, instance_name')
                  .eq('id', targetSessionId)
                  .single();
                if (sessMedia?.baileys_server_url) {
                  const url = await downloadMediaToStorage(supabase, {
                    baileysServerUrl: sessMedia.baileys_server_url,
                    instanceName: sessMedia.instance_name,
                    messageId,
                    remoteJid,
                    sessionId: targetSessionId,
                    mediaType: 'image',
                    messageKey,
                    mimeType: messageContent.imageMessage.mimetype,
                  });
                  if (url) mediaUrl = url;
                }
              } catch (e) {
                console.error('[MEDIA-DL] Image error:', e);
              }
            }
          } else if (messageContent.videoMessage) {
            messageType = 'video';
            mediaCaption = messageContent.videoMessage.caption || '';
            content = mediaCaption || '[Vídeo]';
            mediaUrl = mediaUrl || messageContent.videoMessage.url || '';
            if (targetSessionId) {
              try {
                const { data: sessMedia } = await supabase
                  .from('whatsapp_sessions')
                  .select('baileys_server_url, instance_name')
                  .eq('id', targetSessionId)
                  .single();
                if (sessMedia?.baileys_server_url) {
                  const url = await downloadMediaToStorage(supabase, {
                    baileysServerUrl: sessMedia.baileys_server_url,
                    instanceName: sessMedia.instance_name,
                    messageId,
                    remoteJid,
                    sessionId: targetSessionId,
                    mediaType: 'video',
                    messageKey,
                    mimeType: messageContent.videoMessage.mimetype,
                  });
                  if (url) mediaUrl = url;
                }
              } catch (e) {
                console.error('[MEDIA-DL] Video error:', e);
              }
            }
          } else if (messageContent.audioMessage) {
            messageType = messageContent.audioMessage.ptt ? 'ptt' : 'audio';
            content = '[Áudio]';
            mediaUrl = mediaUrl || messageContent.audioMessage.url || '';
            console.log(`🎙️ [AUDIO-PARSE] Audio message detected. mediaUrl=${mediaUrl ? 'YES' : 'NO'}, fromMe=${fromMe}, sessionId=${targetSessionId}`);
            // Always persist audio; WhatsApp CDN URLs are temporary/not browser-playable.
            if (targetSessionId) {
              try {
                const { data: sessAudio } = await supabase
                  .from('whatsapp_sessions')
                  .select('baileys_server_url, instance_name')
                  .eq('id', targetSessionId)
                  .single();
                if (sessAudio?.baileys_server_url) {
                  const url = await downloadMediaToStorage(supabase, {
                    baileysServerUrl: sessAudio.baileys_server_url,
                    instanceName: sessAudio.instance_name,
                    messageId,
                    remoteJid,
                    sessionId: targetSessionId,
                    mediaType: messageType as 'audio' | 'ptt',
                    messageKey,
                    mimeType: messageContent.audioMessage.mimetype || 'audio/ogg',
                  });
                  if (url) mediaUrl = url;
                } else {
                  console.log('🎙️ [AUDIO-DL] No baileys_server_url for session');
                }
              } catch (dlErr) {
                console.error('🎙️ [AUDIO-DL] Error downloading audio:', dlErr);
              }
            }
          } else if (messageContent.documentMessage) {
            messageType = 'document';
            content = messageContent.documentMessage.fileName || '[Documento]';
            mediaCaption = messageContent.documentMessage.fileName || mediaCaption;
            mediaUrl = mediaUrl || messageContent.documentMessage.url || '';
            if (targetSessionId) {
              try {
                const { data: sessMedia } = await supabase
                  .from('whatsapp_sessions')
                  .select('baileys_server_url, instance_name')
                  .eq('id', targetSessionId)
                  .single();
                if (sessMedia?.baileys_server_url) {
                  const url = await downloadMediaToStorage(supabase, {
                    baileysServerUrl: sessMedia.baileys_server_url,
                    instanceName: sessMedia.instance_name,
                    messageId,
                    remoteJid,
                    sessionId: targetSessionId,
                    mediaType: 'document',
                    fileNameHint: messageContent.documentMessage.fileName,
                    messageKey,
                    mimeType: messageContent.documentMessage.mimetype,
                  });
                  if (url) mediaUrl = url;
                }
              } catch (e) {
                console.error('[MEDIA-DL] Document error:', e);
              }
            }
          } else if (messageContent.stickerMessage) {
            messageType = 'sticker';
            content = '[Sticker]';
            mediaUrl = mediaUrl || messageContent.stickerMessage.url || '';
            if (targetSessionId) {
              try {
                const { data: sessMedia } = await supabase
                  .from('whatsapp_sessions')
                  .select('baileys_server_url, instance_name')
                  .eq('id', targetSessionId)
                  .single();
                if (sessMedia?.baileys_server_url) {
                  const url = await downloadMediaToStorage(supabase, {
                    baileysServerUrl: sessMedia.baileys_server_url,
                    instanceName: sessMedia.instance_name,
                    messageId,
                    remoteJid,
                    sessionId: targetSessionId,
                    mediaType: 'sticker',
                    messageKey,
                    mimeType: messageContent.stickerMessage.mimetype || 'image/webp',
                  });
                  if (url) mediaUrl = url;
                }
              } catch (e) {
                console.error('[MEDIA-DL] Sticker error:', e);
              }
            }
          } else if (messageContent.locationMessage) {
            messageType = 'location';
            content = '[Localização]';
          } else if (messageContent.contactMessage) {
            messageType = 'contact';
            try {
              const cm = messageContent.contactMessage;
              const vcard = cm.vcard || '';
              const phoneMatch = vcard.match(/TEL[^:]*:([^\r\n]+)/i);
              const nameMatch = vcard.match(/FN:([^\r\n]+)/i);
              const phone = phoneMatch?.[1]?.replace(/[^\d+]/g, '') || '';
              const name = nameMatch?.[1]?.trim() || cm.displayName || 'Contato';
              content = JSON.stringify({ type: 'contacts', contacts: [{ name, phone, vcard }] });
            } catch {
              content = JSON.stringify({ type: 'contacts', contacts: [{ name: messageContent.contactMessage.displayName || 'Contato', phone: '', vcard: '' }] });
            }
          } else if (messageContent.contactsArrayMessage) {
            messageType = 'contact';
            try {
              const arr = messageContent.contactsArrayMessage.contacts || [];
              const parsed = arr.map((c: any) => {
                const vcard = c.vcard || '';
                const phoneMatch = vcard.match(/TEL[^:]*:([^\r\n]+)/i);
                const nameMatch = vcard.match(/FN:([^\r\n]+)/i);
                return {
                  name: nameMatch?.[1]?.trim() || c.displayName || 'Contato',
                  phone: phoneMatch?.[1]?.replace(/[^\d+]/g, '') || '',
                  vcard,
                };
              });
              content = JSON.stringify({ type: 'contacts', contacts: parsed });
            } catch {
              content = JSON.stringify({ type: 'contacts', contacts: [] });
            }
          } else if (messageContent.interactiveMessage) {
            messageType = 'interactive';
            const im = messageContent.interactiveMessage;
            content = im.body?.text || im.header?.title || '[Mensagem Interativa]';
          } else if (messageContent.buttonsMessage) {
            messageType = 'buttons';
            content = messageContent.buttonsMessage.contentText || '[Botões]';
          } else if (messageContent.listMessage) {
            messageType = 'list';
            content = messageContent.listMessage.description || messageContent.listMessage.title || '[Lista]';
          } else if (messageContent.templateMessage) {
            messageType = "template";
            const tm = messageContent.templateMessage;
            content = tm.hydratedTemplate?.hydratedContentText || tm.content || tm.contentText || "[Template]";
          } else if (messageContent.reactionMessage) {
            messageType = 'reaction';
            const reactionEmoji = messageContent.reactionMessage.text || '';
            const targetMessageId = messageContent.reactionMessage.key?.id;
            content = reactionEmoji ? `[Reação: ${reactionEmoji}]` : '[Reação removida]';
            
            if (targetMessageId) {
              console.log(`[REACTION] Updating target message ${targetMessageId} with emoji ${reactionEmoji || '(removed)'}`);
              try {
                const { error: reactionError } = await supabase
                  .from('whatsapp_messages')
                  .update({ reaction: reactionEmoji || null })
                  .eq('wa_message_id', targetMessageId)
                  .eq('company_id', companyId);
                  
                if (reactionError) {
                  console.error(`[REACTION] Error updating message:`, reactionError.message);
                }
              } catch (reErr) {
                console.error(`[REACTION] Exception:`, reErr);
              }
            }
          } else if (msg.text || msg.content) {
            content = msg.text || msg.content;
          } else if (msg.messageStubType === 'CALL_MISSED_VOICE' || msg.messageStubType === 'CALL_MISSED_VIDEO') {
            messageType = 'call';
            content = '[Chamada Perdida]';
          }
          
          if (!content && !mediaUrl) {
            console.log('Skipping message without jid or content');
            continue;
          }
          
          // Session context (targetSessionId/companyId/sessionPhone) resolved once per request above
          // (kept here intentionally blank)

          
          // SELF-MESSAGE FILTER: Skip messages where contact matches the session's own phone
          // But DO NOT filter for groups - we want to see our own messages in groups
          if (!isGroup) {
            const normalizedSessionPhone = sessionPhone.replace(/\D/g, '');
            const normalizedContactPhone = phoneNumber.replace(/\D/g, '');
            
            if (normalizedSessionPhone && normalizedContactPhone && (
              normalizedSessionPhone === normalizedContactPhone ||
              normalizedSessionPhone.endsWith(normalizedContactPhone) ||
              normalizedContactPhone.endsWith(normalizedSessionPhone)
            )) {
              console.log(`[SKIP] Self-message detected: session=${normalizedSessionPhone}, contact=${normalizedContactPhone}`);
              continue;
            }
          }
          
          // ============== v4.1.0: Extract enhanced metadata ==============
          // Server v4.1.0 sends contactMetadata with profile picture, status, group info
          const contactMetadata = msg.contactMetadata || {};
          
          // Profile picture: prioritize contactMetadata (v4.1.0), then fallback to old fields
          const profilePicture = contactMetadata.profilePicture || 
                                 msg.profilePicture || 
                                 msg.senderProfilePic || 
                                 msg.groupProfilePic || 
                                 null;
          
          // Contact status (bio) - v4.1.0 only
          const contactStatus = contactMetadata.status || null;
          
          // Group description - v4.1.0 only
          const groupDescription = contactMetadata.groupDescription || null;
          
          // Group participants - v4.1.0 only
          const groupParticipants = contactMetadata.groupParticipants || null;
          
          // ============== IMPROVED: Contact/Group name resolution ==============
          // For groups: use groupName from server v3.5.0+
          // For individuals: use pushName only for incoming messages
          let contactName = phoneNumber;
          if (isGroup) {
            // Groups: prioritize groupName, groupSubject from server
            contactName = msg.groupName || msg.groupSubject || msg.subject || 
                          msg.groupMetadata?.subject || phoneNumber;
            console.log(`[GROUP] Resolved name: "${contactName}", description: ${groupDescription ? 'yes' : 'no'}, participants: ${groupParticipants?.length || 0}`);
          } else if (!fromMe) {
            // Individual incoming: use sender's pushName
            contactName = msg.pushName || msg.senderName || phoneNumber;
            if (contactStatus) {
              console.log(`[CONTACT] ${contactName} status: "${contactStatus}"`);
            }
          }
          
          // IMPROVED: Find conversation by company_id + contact_phone (with Brazilian 9th digit variants)
          const msgPhoneVariants = [phoneNumber];
          if (phoneNumber.startsWith('55') && phoneNumber.length === 13) {
            msgPhoneVariants.push(phoneNumber.slice(0, 4) + phoneNumber.slice(5));
          } else if (phoneNumber.startsWith('55') && phoneNumber.length === 12) {
            msgPhoneVariants.push(phoneNumber.slice(0, 4) + '9' + phoneNumber.slice(4));
          }

          let { data: conversation } = await supabase
            .from('whatsapp_conversations')
            .select('*')
            .eq('company_id', companyId)
            .in('contact_phone', msgPhoneVariants)
            .order('last_message_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          // Fallback 1: match by remote_jid (helps when contact_phone is still stale)
          if (!conversation && remoteJid) {
            const { data: byJid } = await supabase
              .from('whatsapp_conversations')
              .select('*')
              .eq('company_id', companyId)
              .eq('remote_jid', normalizeLidJid(remoteJid))
              .order('last_message_at', { ascending: false })
              .limit(1)
              .maybeSingle();

            if (byJid) {
              conversation = byJid;
            }
          }

          // Fallback 2: merge legacy LID rows with real-phone rows by avatar fingerprint
          if (!conversation && !isGroup && profilePicture) {
            const avatarKey = normalizeAvatarUrl(profilePicture);
            if (avatarKey) {
              const { data: avatarCandidates } = await supabase
                .from('whatsapp_conversations')
                .select('*')
                .eq('company_id', companyId)
                .not('profile_picture', 'is', null)
                .order('last_message_at', { ascending: false })
                .limit(100);

              const matchedByAvatar = (avatarCandidates || []).find((c: any) => {
                const candidateAvatar = normalizeAvatarUrl(c.profile_picture);
                const candidateDigits = (c.contact_phone || '').replace(/\D/g, '');
                const isRealBrPhone = candidateDigits.startsWith('55') && (candidateDigits.length === 12 || candidateDigits.length === 13);
                return Boolean(candidateAvatar && candidateAvatar === avatarKey && isRealBrPhone);
              });

              if (matchedByAvatar) {
                conversation = matchedByAvatar;
                console.log(`[DEDUP-LID] Matched avatar ${avatarKey} to existing conversation ${matchedByAvatar.id}`);
              }
            }
          }
          
          let autopilotParentChannel = false;
          let autopilotParentPhone = '';

          if (!conversation) {
            // Build insert payload with v4.1.0 enhanced fields
             const insertPayload: Record<string, unknown> = {
              session_id: targetSessionId,
              company_id: companyId,
              contact_phone: phoneNumber,
              contact_name: contactName,
              profile_picture: profilePicture,
              remote_jid: remoteJid,
              status: 'open',
              last_message: content,
              last_message_at: new Date().toISOString(),
              unread_count: fromMe ? 0 : 1,
              sync_status: profilePicture ? 'synced' : 'queued'
            };

            // Auto-set kanban pipeline stage based on message direction.
            // Inbound (customer) => "aguardando" (I haven't replied).
            // Outbound (me/bot)  => "em_atendimento".
            insertPayload.pipeline_stage = fromMe ? 'em_atendimento' : 'aguardando';
            
            // v4.1.0: Add enhanced metadata fields
            if (contactStatus) insertPayload.contact_status = contactStatus;
            if (groupDescription) insertPayload.group_description = groupDescription;
            if (groupParticipants) insertPayload.group_participants = groupParticipants;
            
            const { data: newConv } = await supabase
              .from('whatsapp_conversations')
              .insert(insertPayload)
              .select()
              .single();
            
            conversation = newConv;

            // Trigger background sync if picture is missing
            if (!profilePicture || !profilePicture.trim()) {
              triggerProfileSync(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, companyId);
            }

              const parentIsolation = await isolateAutopilotParentChannel(supabase, {
                companyId,
                conversation,
                targetSessionId,
                phoneNumber,
              });
              autopilotParentChannel = parentIsolation.isParentChannel;
              autopilotParentPhone = parentIsolation.parentPhone || '';

            // ==================== AUTO-TRIGGER CHATBOT FOR NEW CONVERSATIONS ====================
            // When a new conversation is created from an incoming message, check if there's
            // an active chatbot flow configured to auto-trigger on new WhatsApp conversations
            // SKIP if conversation is managed by external API
            // Also check if this phone was recently contacted via the public API (api_logs)
            let isApiManaged = conversation?.api_managed || false;
            if (!isApiManaged && !fromMe && conversation) {
              try {
                const { data: recentApiLog } = await supabase
                  .from('whatsapp_api_logs')
                  .select('id')
                  .in('phone', msgPhoneVariants)
                  .eq('status', 'sent')
                  .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
                  .limit(1);
                if (recentApiLog && recentApiLog.length > 0) {
                  isApiManaged = true;
                  // Also mark the conversation so future checks are fast
                  await supabase
                    .from('whatsapp_conversations')
                    .update({ api_managed: true })
                    .eq('id', conversation.id);
                  console.log(`🔌 [API-MANAGED] Phone ${phoneNumber} was recently contacted via API, marking conversation as api_managed`);
                }
              } catch (apiCheckErr) {
                console.error('🔌 [API-MANAGED] Error checking API logs:', apiCheckErr);
              }
            }
            if (!fromMe && conversation && !isGroup && !isApiManaged && !autopilotParentChannel && !(conversation as any).human_takeover) {
              try {
                console.log(`🤖🆕 [AUTO-TRIGGER] New conversation detected, checking for auto-trigger flows...`);
                
                // Find active chatbot flows with whatsapp_channel trigger for this company
                const { data: autoFlows } = await supabase
                  .from('chatbot_flows')
                  .select('id, name, nodes, edges, trigger_config, execution_count')
                  .eq('company_id', companyId)
                  .eq('is_active', true)
                  .order('updated_at', { ascending: false });

                if (autoFlows && autoFlows.length > 0) {
                  // Find flow with whatsapp_channel trigger (or conversation_start)
                  // IMPORTANT: Respect sessionId filter — only trigger if flow matches this session or has no session filter
                  const triggerFlow = autoFlows.find((f: any) => {
                    const tc = f.trigger_config as Record<string, unknown> | null;
                    if (!tc) return false;
                    const tcType = (tc.type || tc.triggerType) as string;
                    if (tcType !== 'whatsapp_channel' && tcType !== 'conversation_start') return false;
                    // Check sessionId from trigger_config or from trigger node inside nodes array
                    let tcSessionId = tc.sessionId as string | undefined;
                    let triggerNodeCfg: any = null;
                    if (!tcSessionId && Array.isArray(f.nodes)) {
                      const triggerNode = (f.nodes as any[]).find((n: any) => n.type === 'trigger');
                      triggerNodeCfg = triggerNode?.data?.config || null;
                      tcSessionId = triggerNode?.data?.config?.sessionId;
                    }
                    if (tcSessionId && tcSessionId !== targetSessionId) return false;
                    // Respect triggerWhen: new_conversation/any_message allowed here; reopened is handled by re-trigger branch
                    const triggerWhen = (triggerNodeCfg?.triggerWhen || (tc as any).triggerWhen || 'any_message') as string;
                    if (triggerWhen === 'reopened') return false;
                    return true;
                  });

                  // Only use a default flow if it doesn't have a session restriction
                  const fallbackFlow = autoFlows.find((f: any) => {
                    const tc = f.trigger_config as Record<string, unknown> | null;
                    return !tc?.sessionId; // Only use flows without session filter as fallback
                  });
                  const flowToTrigger = triggerFlow || fallbackFlow;

                  if (flowToTrigger) {
                    // Active-hours gate: if outside the configured window, skip execution
                    // and optionally send the configured out-of-hours message.
                    const ahRaw = (flowToTrigger as any).trigger_config?.active_hours;
                    const outsideHours = ahRaw && !isWithinActiveHours(ahRaw);
                    if (outsideHours) {
                      const ahCfg = normalizeActiveHours(ahRaw);
                      console.log(`🤖🕒 [ACTIVE-HOURS] Flow "${flowToTrigger.name}" skipped (outside hours)`);
                      try {
                        const { data: ahSess } = await supabase
                          .from('whatsapp_sessions')
                          .select('baileys_server_url, instance_name')
                          .eq('id', targetSessionId)
                          .single();
                        const ahServerUrl = ahSess?.baileys_server_url;
                        const ahInstanceName = ahSess?.instance_name;
                        if (ahServerUrl && ahInstanceName && ahCfg.outOfHoursMessage) {
                          const jid = remoteJid.includes('@') ? remoteJid : `${remoteJid}@s.whatsapp.net`;
                          await fetch(`${ahServerUrl}/api/message/send`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ instanceName: ahInstanceName, jid, message: { text: ahCfg.outOfHoursMessage } }),
                          }).catch(() => {});
                          await supabase.from('whatsapp_messages').insert({
                            company_id: companyId,
                            session_id: targetSessionId,
                            conversation_id: conversation.id,
                            content: ahCfg.outOfHoursMessage,
                            from_me: true,
                            status: 'sent',
                            message_type: 'text',
                            sender_name: 'Chatbot (fora de horário)',
                          });
                        }
                      } catch (ahErr) {
                        console.error('🤖🕒 [ACTIVE-HOURS] Failed to send off-hours message:', ahErr);
                      }
                    } else {
                      // Check there's no existing execution for this conversation
                      const { data: existingExec } = await supabase
                      .from('chatbot_executions')
                      .select('id')
                      .eq('conversation_id', conversation.id)
                      .eq('status', 'running')
                      .limit(1);

                    if (!existingExec || existingExec.length === 0) {
                      console.log(`🤖🆕 [AUTO-TRIGGER] Starting flow "${flowToTrigger.name}" for new conversation ${conversation.id}`);

                      // Merge initialVariables from trigger node config (persistence of popup settings)
                      let initialVars: Record<string, unknown> = {};
                      try {
                        const tNode = Array.isArray(flowToTrigger.nodes)
                          ? (flowToTrigger.nodes as any[]).find((n: any) => n.type === 'trigger')
                          : null;
                        const iv = tNode?.data?.config?.initialVariables;
                        if (iv && typeof iv === 'object') initialVars = iv as Record<string, unknown>;
                      } catch { /* ignore */ }

                      // Create execution record
                      const { data: newExec } = await supabase
                        .from('chatbot_executions')
                        .insert({
                          flow_id: flowToTrigger.id,
                          company_id: companyId,
                          conversation_id: conversation.id,
                          contact_phone: phoneNumber,
                          status: 'running',
                          variables: {
                            ...initialVars,
                            nome: contactName || phoneNumber,
                            telefone: phoneNumber,
                          },
                          execution_path: [],
                          last_activity_at: new Date().toISOString(),
                        })
                        .select()
                        .single();

                      if (newExec) {
                        // Increment execution count
                        await supabase
                          .from('chatbot_flows')
                          .update({ execution_count: (flowToTrigger.execution_count || 0) + 1 })
                          .eq('id', flowToTrigger.id);

                        console.log(`🤖🆕 [AUTO-TRIGGER] Execution created: ${newExec.id}`);
                      }
                    } else {
                      console.log(`🤖🆕 [AUTO-TRIGGER] Execution already exists for conversation ${conversation.id}`);
                    }
                    }
                  }
                } else {
                  console.log(`🤖🆕 [AUTO-TRIGGER] No active chatbot flows found for company ${companyId}`);
                }
              } catch (autoTriggerErr) {
                console.error('🤖🆕 [AUTO-TRIGGER] Error:', autoTriggerErr);
              }
            }

            // ==================== AUTO-ASSIGN AI AGENT BY SESSION ====================
            // Check if any AI agent is configured to auto-respond on this specific WhatsApp session
            // SKIP if conversation is managed by external API
            if (!fromMe && conversation && !isGroup && !isApiManaged && !autopilotParentChannel && !(conversation as any).human_takeover) {
              try {
                // Check if a chatbot was already triggered for this conversation
                const { data: runningExec } = await supabase
                  .from('chatbot_executions')
                  .select('id')
                  .eq('conversation_id', conversation.id)
                  .eq('status', 'running')
                  .limit(1);

                const chatbotAlreadyRunning = runningExec && runningExec.length > 0;

                if (!chatbotAlreadyRunning) {
                  // Find an active AI agent bound to this specific WhatsApp session
                  const { data: boundAgent } = await supabase
                    .from('ai_agents')
                    .select('id, name')
                    .eq('company_id', companyId)
                    .eq('whatsapp_enabled', true)
                    .eq('whatsapp_session_id', targetSessionId)
                    .eq('is_active', true)
                    .limit(1)
                    .single();

                  if (boundAgent) {
                    console.log(`🤖🔗 [AUTO-ASSIGN] Agent "${boundAgent.name}" bound to session ${targetSessionId}, auto-assigning to conversation ${conversation.id}`);
                    await supabase
                      .from('whatsapp_conversations')
                      .update({
                        assigned_agent_id: boundAgent.id,
                        ai_auto_reply_enabled: true,
                      })
                      .eq('id', conversation.id);

                    // Send system message
                    await supabase.from('whatsapp_messages').insert({
                      company_id: companyId,
                      session_id: targetSessionId,
                      conversation_id: conversation.id,
                      content: `🤖 Agente "${boundAgent.name}" assumiu a conversa automaticamente.`,
                      from_me: true,
                      status: 'sent',
                      message_type: 'system',
                      sender_name: 'Sistema',
                    });
                  }
                }
              } catch (autoAssignErr) {
                console.error('🤖🔗 [AUTO-ASSIGN] Error:', autoAssignErr);
              }
            }
          } else {
            // Update conversation with latest info
            const updateData: Record<string, unknown> = {
              session_id: targetSessionId, // ALWAYS keep session_id current
              last_message: content,
              last_message_at: new Date().toISOString(),
              unread_count: fromMe ? conversation.unread_count : (conversation.unread_count || 0) + 1,
            };

            // Kanban column changes are decided ONLY by the AI classifier
            // (or manual drag-and-drop). Do NOT auto-move here based on
            // message direction — that would undo the user's classification.
            
            // ============== PRESERVE DATA: Never overwrite with empty values ==============
            // Only update name if:
            // 1. We have a valid new name (not empty, not just phone number)
            // 2. AND either existing is empty OR it's a group (groups can have name changes)
            const hasValidNewName = contactName && contactName.trim() && contactName !== phoneNumber;
            const existingNameEmpty = !conversation.contact_name || conversation.contact_name === phoneNumber;
            
            if (isGroup && hasValidNewName) {
              // For groups: update if we have a valid name
              updateData.contact_name = contactName;
              console.log(`[GROUP] Updating name to: "${contactName}"`);
            } else if (!fromMe && hasValidNewName && existingNameEmpty) {
              // For individuals: only update if incoming AND existing is empty
              updateData.contact_name = contactName;
            }
            // If incoming name is empty/null, DO NOT update - preserve existing
            
            // Only update profile_picture if we have valid new one
            // NEVER overwrite existing picture with null/empty
            if (profilePicture && profilePicture.trim()) {
              updateData.profile_picture = profilePicture;
              updateData.sync_status = 'synced';
            } else if (!conversation.profile_picture) {
              updateData.sync_status = 'queued';
            }
            
            // v4.1.0: Update enhanced metadata fields if provided
            if (contactStatus && !conversation.contact_status) {
              updateData.contact_status = contactStatus;
            }
            if (groupDescription && (!conversation.group_description || conversation.group_description !== groupDescription)) {
              updateData.group_description = groupDescription;
            }
            if (groupParticipants && groupParticipants.length > 0) {
              updateData.group_participants = groupParticipants;
            }

            // Normalize legacy contact_phone when we now have a real BR number
            const currentDigits = (conversation.contact_phone || '').replace(/\D/g, '');
            const nextDigits = phoneNumber.replace(/\D/g, '');
            const nextIsRealBrPhone = nextDigits.startsWith('55') && (nextDigits.length === 12 || nextDigits.length === 13);
            if (nextIsRealBrPhone && currentDigits !== nextDigits) {
              updateData.contact_phone = nextDigits;
            }

            // Keep remote_jid current, but avoid replacing a real jid with a LID fallback
            if (remoteJid && remoteJid.includes('@')) {
              const currentRemoteJid = conversation.remote_jid || '';
              const incomingIsLid = isLidJid(remoteJid);
              const currentIsLid = isLidJid(currentRemoteJid);

              if (!incomingIsLid || !currentRemoteJid || currentIsLid) {
                updateData.remote_jid = normalizeLidJid(remoteJid);
              }
            }
            
            await supabase
              .from('whatsapp_conversations')
              .update(updateData)
              .eq('id', conversation.id);

            // Trigger background sync if picture is missing
            if (!profilePicture || !profilePicture.trim() || !conversation.profile_picture) {
              triggerProfileSync(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, companyId);
            }

            const parentIsolation = await isolateAutopilotParentChannel(supabase, {
              companyId,
              conversation,
              targetSessionId,
              phoneNumber,
            });
            autopilotParentChannel = parentIsolation.isParentChannel;
            autopilotParentPhone = parentIsolation.parentPhone || '';
          }

          // ============== LEARN CONTACT LID ==============
          // Persist the contact's @lid identifier on the conversation so future
          // outgoing messages from the user's phone (where remoteJid arrives as @lid)
          // can be matched back to this conversation instead of creating a duplicate.
          if (conversation && !isGroup && !(conversation as any).contact_lid) {
            try {
              const lidCandidates = [
                messageKey.remoteJid,
                msg.remoteJid,
                messageKey.remoteJidAlt,
                messageKey.senderLid,
                messageKey.participantLid,
                messageKey.remoteJidLid,
                msg.senderLid,
                msg.remoteJidLid,
              ].filter(Boolean) as string[];
              for (const cand of lidCandidates) {
                if (String(cand).includes('@lid')) {
                  const lidDigits = String(cand).replace(/@.*$/, '').replace(/\D/g, '');
                  if (lidDigits && lidDigits.length >= 10) {
                    await supabase
                      .from('whatsapp_conversations')
                      .update({ contact_lid: lidDigits })
                      .eq('id', conversation.id);
                    (conversation as any).contact_lid = lidDigits;
                    console.log(`[CONTACT-LID] Learned LID ${lidDigits} for conversation ${conversation.id}`);
                    break;
                  }
                }
              }
            } catch (lidLearnErr: any) {
              console.warn('[CONTACT-LID] learn failed:', lidLearnErr?.message);
            }
          }

          // ==================== HUMAN TAKEOVER REPAIR GUARD ====================
          // Some phone-sent messages can arrive before/inside dedupe paths and fail to persist
          // human_takeover. Before any re-trigger, inspect the recent conversation history and
          // repair the flag if a real human outbound message exists.
          // ==================== HUMAN TAKEOVER AUTO-EXPIRY ====================
          // If the last human interaction is older than 24h, release the takeover so a new
          // inbound message can restart the chatbot automatically.
          // TTL for human takeover: after this window of no human interaction,
          // the next inbound customer message releases the flag and re-triggers the bot.
          const HUMAN_TAKEOVER_TTL_MS = 6 * 60 * 60 * 1000; // 6h
          if (!fromMe && conversation?.id && !isGroup && !autopilotParentChannel && (conversation as any).human_takeover) {
            try {
              const lastHumanAtRaw =
                (conversation as any).last_human_interaction_at ||
                (conversation as any).human_takeover_at;
              const lastHumanAt = lastHumanAtRaw ? new Date(lastHumanAtRaw).getTime() : 0;
              if (lastHumanAt && Date.now() - lastHumanAt > HUMAN_TAKEOVER_TTL_MS) {
                await supabase
                  .from('whatsapp_conversations')
                  .update({
                    human_takeover: false,
                    human_takeover_reason: null,
                    ai_auto_reply_enabled: true,
                  })
                  .eq('id', conversation.id);
                try {
                  await supabase.from('conversation_events').insert({
                    conversation_id: conversation.id,
                    company_id: companyId,
                    event_type: 'human_takeover_expired',
                    reason: 'inatividade > 24h — chatbot reativado automaticamente',
                     metadata: { ttl_hours: 6, last_human_at: new Date(lastHumanAt).toISOString() },
                  });
                } catch (_e) { /* table optional */ }
                (conversation as any).human_takeover = false;
                 console.log(`🤖⏱️ [TAKEOVER-EXPIRY] Released human_takeover for ${conversation.id} after >6h inactivity`);
              }
            } catch (expErr) {
              console.warn('[TAKEOVER-EXPIRY] Failed to release takeover:', expErr);
            }
          }

          if (!fromMe && conversation?.id && !isGroup && !autopilotParentChannel && !(conversation as any).human_takeover) {
            try {
              const humanOutbound = await findRecentHumanOutboundMessage(supabase, conversation.id);
              if (humanOutbound) {
                console.log(`👤🛑 [HUMAN-TAKEOVER-REPAIR] Blocking chatbot restart for ${conversation.id}; human message ${humanOutbound.id} at ${humanOutbound.timestamp}`);
                await markHumanTakeoverAndStopAutomations(supabase, {
                  companyId,
                  conversation,
                  phoneVariants: msgPhoneVariants,
                  remoteJid,
                  messageDbId: humanOutbound.id,
                  reason: 'mensagem do celular conectado',
                });
                (conversation as any).human_takeover = true;
                continue;
              }
            } catch (repairErr) {
              console.error('[HUMAN-TAKEOVER-REPAIR] Error:', repairErr);
            }
          }

          // ==================== RE-TRIGGER CHATBOT FOR EXISTING CONVERSATIONS ====================
          // If incoming message, no AI agent active, no chatbot running, try to start chatbot
          // SKIP if conversation is managed by external API
          // Re-check api_managed for existing conversations (variable was set above for new ones)
          let isApiManagedExisting = conversation?.api_managed || false;
          if (!isApiManagedExisting && !fromMe && conversation && !autopilotParentChannel) {
            try {
              const { data: recentApiLogExist } = await supabase
                .from('whatsapp_api_logs')
                .select('id')
                .in('phone', msgPhoneVariants)
                .eq('status', 'sent')
                .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
                .limit(1);
              if (recentApiLogExist && recentApiLogExist.length > 0) {
                isApiManagedExisting = true;
                await supabase
                  .from('whatsapp_conversations')
                  .update({ api_managed: true })
                  .eq('id', conversation.id);
                console.log(`🔌 [API-MANAGED] Existing conv ${conversation.id} marked as api_managed from API logs`);
              }
            } catch (e) { /* ignore */ }
          }
          if (!fromMe && conversation && !isGroup && !isApiManagedExisting && !autopilotParentChannel && !(conversation as any).human_takeover) {
            try {
              const { data: convState } = await supabase
                .from('whatsapp_conversations')
                .select('assigned_agent_id, ai_auto_reply_enabled, human_takeover')
                .eq('id', conversation.id)
                .single();

              if (convState?.human_takeover) {
                (conversation as any).human_takeover = true;
                console.log(`🤖🔄 [RE-TRIGGER] Conversation ${conversation.id} has human_takeover=true. Skipping re-trigger.`);
                continue;
              }

              const hasActiveAgent = convState?.assigned_agent_id && convState?.ai_auto_reply_enabled;

              if (!hasActiveAgent) {
                // Check if chatbot is already running
                const { data: runningExecCheck } = await supabase
                  .from('chatbot_executions')
                  .select('id')
                  .eq('conversation_id', conversation.id)
                  .eq('status', 'running')
                  .limit(1);

                const chatbotRunning = runningExecCheck && runningExecCheck.length > 0;

                // Check if chatbot was manually stopped recently (within last 30 min) to avoid re-trigger
                const { data: recentlyStopped } = await supabase
                  .from('chatbot_executions')
                  .select('id')
                  .eq('conversation_id', conversation.id)
                  .eq('status', 'stopped')
                  .gte('completed_at', new Date(Date.now() - 30 * 60 * 1000).toISOString())
                  .limit(1);

                const wasManuallyStoppedRecently = recentlyStopped && recentlyStopped.length > 0;

                // Check if conversation was handed off to a human — if so, never auto-restart the bot
                const { data: handoffExec } = await supabase
                  .from('chatbot_executions')
                  .select('id, variables')
                  .eq('conversation_id', conversation.id)
                  .order('started_at', { ascending: false })
                  .limit(1);
                const wasHandedOff = !!handoffExec?.[0] && (handoffExec[0].variables as any)?.handoff === true;
                if (wasHandedOff) {
                  console.log(`🤖🔄 [RE-TRIGGER] Conversation ${conversation.id} is in human handoff. Skipping re-trigger.`);
                }

                if (!chatbotRunning && !wasManuallyStoppedRecently && !wasHandedOff) {
                  // Find active chatbot flows for this company
                  const { data: reactivateFlows } = await supabase
                    .from('chatbot_flows')
                    .select('id, name, nodes, trigger_config, execution_count')
                    .eq('company_id', companyId)
                    .eq('is_active', true);

                  if (reactivateFlows && reactivateFlows.length > 0) {
                    const reactivateFlow = reactivateFlows.find((f: any) => {
                      const tc = f.trigger_config as Record<string, unknown> | null;
                      if (!tc) return false;
                      const tcType = (tc.type || tc.triggerType) as string;
                      if (tcType !== 'whatsapp_channel' && tcType !== 'conversation_start') return false;
                      // Check sessionId from trigger_config or from trigger node inside nodes array
                      let tcSessionId = tc.sessionId as string | undefined;
                      let triggerNodeCfg: any = null;
                      if (!tcSessionId && Array.isArray(f.nodes)) {
                        const triggerNode = (f.nodes as any[]).find((n: any) => n.type === 'trigger');
                        triggerNodeCfg = triggerNode?.data?.config || null;
                        tcSessionId = triggerNode?.data?.config?.sessionId;
                      }
                      if (tcSessionId && tcSessionId !== targetSessionId) return false;
                      const triggerWhen = (triggerNodeCfg?.triggerWhen || (tc as any).triggerWhen || 'any_message') as string;
                      if (triggerWhen === 'new_conversation') return false; // existing convs not allowed
                      if (triggerWhen === 'reopened') {
                        const hours = Number(triggerNodeCfg?.inactivityHours || (tc as any).inactivityHours || 24);
                        const lastAt = (conversation as any)?.last_message_at ? new Date((conversation as any).last_message_at).getTime() : 0;
                        const elapsedH = lastAt ? (Date.now() - lastAt) / 3600000 : Infinity;
                        if (elapsedH < hours) return false;
                      }
                      return true;
                    }) || reactivateFlows.find((f: any) => {
                      const tc = f.trigger_config as Record<string, unknown> | null;
                      const tcType = (tc?.type || tc?.triggerType) as string;
                      return tc && (tcType === 'whatsapp_channel' || tcType === 'conversation_start') && !tc.sessionId;
                    });

                    if (reactivateFlow) {
                      // Default policy: only auto re-trigger if ≥6h since last contact
                      // (unless the flow's trigger explicitly requests "any_message" behavior).
                      let allowReTrigger = true;
                      try {
                        const rtNode = Array.isArray(reactivateFlow.nodes)
                          ? (reactivateFlow.nodes as any[]).find((n: any) => n.type === 'trigger')
                          : null;
                        const rtCfg = rtNode?.data?.config || {};
                        const rtTc = (reactivateFlow as any).trigger_config || {};
                        const triggerWhen = (rtCfg.triggerWhen || rtTc.triggerWhen || 'reopened') as string;
                        if (triggerWhen !== 'any_message') {
                          const requiredHours = Number(rtCfg.inactivityHours || rtTc.inactivityHours || 6);
                          // Look at the previous inbound message (exclude the one we just stored)
                          const { data: prevInbound } = await supabase
                            .from('whatsapp_messages')
                            .select('created_at')
                            .eq('conversation_id', conversation.id)
                            .eq('from_me', false)
                            .order('created_at', { ascending: false })
                            .range(1, 1)
                            .limit(1);
                          const lastInboundAt = prevInbound?.[0]?.created_at
                            ? new Date(prevInbound[0].created_at).getTime()
                            : 0;
                          const elapsedH = lastInboundAt ? (Date.now() - lastInboundAt) / 3600000 : Infinity;
                          if (elapsedH < requiredHours) {
                            console.log(`🤖🔄 [RE-TRIGGER] Skipped — only ${elapsedH.toFixed(2)}h since last inbound (needs ${requiredHours}h).`);
                            allowReTrigger = false;
                          }
                        }
                      } catch (gateErr) {
                        console.error('🤖🔄 [RE-TRIGGER] Inactivity gate error:', gateErr);
                      }
                      if (!allowReTrigger) continue;
                      console.log(`🤖🔄 [RE-TRIGGER] Restarting flow "${reactivateFlow.name}" for existing conversation ${conversation.id}`);
                      let initialVarsRe: Record<string, unknown> = {};
                      try {
                        const tNode = Array.isArray(reactivateFlow.nodes)
                          ? (reactivateFlow.nodes as any[]).find((n: any) => n.type === 'trigger')
                          : null;
                        const iv = tNode?.data?.config?.initialVariables;
                        if (iv && typeof iv === 'object') initialVarsRe = iv as Record<string, unknown>;
                      } catch { /* ignore */ }
                      const { data: newExec } = await supabase
                        .from('chatbot_executions')
                        .insert({
                          flow_id: reactivateFlow.id,
                          company_id: companyId,
                          conversation_id: conversation.id,
                          contact_phone: phoneNumber,
                          status: 'running',
                          variables: {
                            ...initialVarsRe,
                            nome: contactName || phoneNumber,
                            telefone: phoneNumber,
                          },
                          execution_path: [],
                          last_activity_at: new Date().toISOString(),
                        })
                        .select()
                        .single();

                      if (newExec) {
                        await supabase
                          .from('chatbot_flows')
                          .update({ execution_count: (reactivateFlow.execution_count || 0) + 1 })
                          .eq('id', reactivateFlow.id);
                        console.log(`🤖🔄 [RE-TRIGGER] Execution created: ${newExec.id}`);
                      }
                    }
                  }
                }
              }
            } catch (retriggerErr) {
              console.error('🤖🔄 [RE-TRIGGER] Error:', retriggerErr);
            }
          }

          // ==================== CONTACT BACKFILL (from messages) ====================
          // Garante que a aba Contatos não fique zerada mesmo quando o Baileys não emite contacts.set
          if (!isGroup && remoteJid) {
            try {
              const waId = remoteJid;
              const validPushName = contactName && contactName.trim() && contactName !== phoneNumber ? contactName.trim() : null;

              const { data: existingContact } = await supabase
                .from('whatsapp_contacts')
                .select('push_name, profile_picture')
                .eq('company_id', companyId)
                .eq('wa_id', waId)
                .maybeSingle();

              const contactUpsert: Record<string, unknown> = {
                company_id: companyId,
                session_id: targetSessionId,
                wa_id: waId,
                phone_number: phoneNumber,
                is_business: false,
              };

              if (validPushName) {
                contactUpsert.push_name = validPushName;
              } else if (existingContact?.push_name) {
                contactUpsert.push_name = existingContact.push_name;
              }

              if (profilePicture && profilePicture.trim()) {
                contactUpsert.profile_picture = profilePicture;
              } else if (existingContact?.profile_picture) {
                contactUpsert.profile_picture = existingContact.profile_picture;
              }

              const { error: contactErr } = await supabase
                .from('whatsapp_contacts')
                .upsert(contactUpsert, { onConflict: 'company_id,wa_id' });

              if (contactErr) {
                console.error('[CONTACTS] Backfill upsert error:', contactErr.message);
              }
            } catch (e) {
              console.error('[CONTACTS] Backfill error:', e);
            }
          }
          
          // Parse timestamp safely
          let msgTimestamp = new Date().toISOString();
          if (msg.messageTimestamp) {
            try {
              const ts = typeof msg.messageTimestamp === 'object' && msg.messageTimestamp.low
                ? msg.messageTimestamp.low
                : parseInt(msg.messageTimestamp);
              if (!isNaN(ts) && ts > 0) {
                const dateMs = ts > 4102444800 ? ts : ts * 1000;
                msgTimestamp = new Date(dateMs).toISOString();
              }
            } catch (e) {
              console.log('Timestamp parse error, using now');
            }
          }

          // ============== DEDUPLICATION + REPAIR ==============
          // If the same WhatsApp message was previously saved without media or under
          // an unresolved @lid conversation, repair it instead of dropping the update.
          if (messageId && messageId.trim()) {
            const { data: existingMsg } = await supabase
              .from('whatsapp_messages')
              .select('id, media_url, conversation_id, from_me, content, is_ai_response, sender_name')
              .eq('wa_message_id', messageId)
              .eq('company_id', companyId)
              .maybeSingle();

            if (existingMsg) {
              const repairData: Record<string, unknown> = {};
              if (conversation?.id && existingMsg.conversation_id !== conversation.id) {
                repairData.conversation_id = conversation.id;
                repairData.session_id = targetSessionId;
                repairData.company_id = companyId;
              }
              if (mediaUrl && !existingMsg.media_url) {
                repairData.media_url = mediaUrl;
                repairData.media_caption = mediaCaption;
                repairData.message_type = messageType;
                repairData.content = content;
              }
              if (Object.keys(repairData).length > 0) {
                await supabase.from('whatsapp_messages').update(repairData).eq('id', existingMsg.id);
                console.log(`[DEDUP-REPAIR] Updated existing message ${messageId}`);
              }
              if (!autopilotParentChannel && fromMe && conversation?.id) {
                const normalizedExistingContent = String(existingMsg.content || content || '').trim();
                let isAutomatedEcho = existingMsg?.is_ai_response === true || ['Chatbot', 'IA', 'Sistema'].includes(String(existingMsg?.sender_name || ''));

                if (!isAutomatedEcho && normalizedExistingContent) {
                  const twoMinAgo = new Date(Date.now() - 2 * 60 * 1000).toISOString();
                  const { data: recentAutomated } = await supabase
                    .from('whatsapp_messages')
                    .select('id, is_ai_response, sender_name')
                    .eq('conversation_id', conversation.id)
                    .eq('from_me', true)
                    .eq('content', normalizedExistingContent)
                    .gte('timestamp', twoMinAgo)
                    .neq('id', existingMsg.id)
                    .limit(5);

                  isAutomatedEcho = (recentAutomated || []).some((m: any) =>
                    m?.is_ai_response === true || ['Chatbot', 'IA', 'Sistema'].includes(String(m?.sender_name || ''))
                  );
                }

                if (!isAutomatedEcho) {
                  isAutomatedEcho = await isLikelyChatbotOutboundEcho(supabase, conversation.id, existingMsg);
                  if (isAutomatedEcho) {
                    await supabase
                      .from('whatsapp_messages')
                      .update({ sender_name: 'Chatbot', is_ai_response: true })
                      .eq('id', existingMsg.id);
                  }
                }

                if (!isAutomatedEcho) {
                  await markHumanTakeoverAndStopAutomations(supabase, {
                    companyId,
                    conversation,
                    phoneVariants: msgPhoneVariants,
                    remoteJid,
                    messageDbId: existingMsg.id,
                    reason: 'mensagem do celular conectado',
                  });
                  (conversation as any).human_takeover = true;
                  console.log(`[DEDUP] Existing fromMe message treated as human takeover: ${messageId}`);
                } else {
                  console.log(`[DEDUP] Existing fromMe message is automated echo: ${messageId}`);
                }
              }
              console.log(`[DEDUP] Message already exists: ${messageId}`);
              continue;
            }
          }
          
          // Build message data
          const messageData: Record<string, unknown> = {
            conversation_id: conversation?.id,
            session_id: targetSessionId,
            company_id: companyId,
            from_me: fromMe,
            content: content,
            message_type: messageType,
            media_url: mediaUrl,
            media_caption: mediaCaption,
            status: fromMe ? 'sent' : 'received',
            timestamp: msgTimestamp
          };
          
          // Add sender info for group messages (non-fromMe only)
          if (senderPhone) {
            messageData.sender_phone = senderPhone;
          }
          if (senderName) {
            messageData.sender_name = senderName;
          }
          let asyncAiDispatched = false;
          
          // Use upsert only if we have a valid message ID, otherwise insert
          if (messageId && messageId.trim()) {
              const { data: insertedMessage, error: msgError } = await supabase
                .from('whatsapp_messages')
                .insert({
                  ...messageData,
                  wa_message_id: messageId
                })
                .select('id')
                .maybeSingle();
            
            if (msgError) {
              console.error(`Message upsert error:`, msgError.message);
            } else {
              console.log(`Message saved: ${content.substring(0, 50)}...`);
              let takeoverBlocksAutomations = false;
              if (autopilotParentChannel && !fromMe && conversation?.id) {
                console.log(`[PILOTO-PAI] Incoming owner guidance routed only to Piloto for parent conversation ${conversation.id}`);
                if (autopilotParentPhone) {
                  dispatchAutopilotParentReply({
                    supabaseUrl: SUPABASE_URL,
                    serviceRoleKey: SUPABASE_SERVICE_ROLE_KEY,
                    companyId,
                    parentPhone: autopilotParentPhone,
                    messageContent: content,
                    messageType,
                    mediaUrl,
                  });
                }
                asyncAiDispatched = true;
              }
              if (!autopilotParentChannel && !fromMe && conversation?.id) {
                const { data: takeoverStateBeforeAi } = await supabase
                  .from('whatsapp_conversations')
                  .select('human_takeover')
                  .eq('id', conversation.id)
                  .maybeSingle();

                if (takeoverStateBeforeAi?.human_takeover) {
                  takeoverBlocksAutomations = true;
                  await supabase
                    .from('chatbot_executions')
                    .update({ status: 'stopped', completed_at: new Date().toISOString() })
                    .eq('conversation_id', conversation.id)
                    .eq('status', 'running');
                }
              }

              // API pública: encaminha toda mensagem recebida para o webhook das chaves desta conexão
              if (!fromMe && !isGroup && targetSessionId) {
                const fwd = (async () => {
                  const { data: hookKeys } = await supabase
                    .from('whatsapp_api_keys')
                    .select('id')
                    .eq('session_id', targetSessionId)
                    .eq('is_active', true)
                    .not('webhook_url', 'is', null);
                  if (!hookKeys?.length) return;
                  const { sendWebhook } = await import('../_shared/post-approval.ts');
                  for (const k of hookKeys) {
                    await sendWebhook(supabase, {
                      companyId, apiKeyId: k.id, event: 'message.received',
                      data: {
                        message_id: messageId, phone: phoneNumber, contact_name: (conversation as any)?.contact_name || null,
                        type: messageType, text: content || '', media_url: mediaUrl || null, caption: mediaCaption || null,
                        conversation_id: conversation?.id || null, session_id: targetSessionId,
                        timestamp: msgTimestamp,
                      },
                    }).catch((e: unknown) => console.error('[API-WEBHOOK] forward failed:', e));
                  }
                })();
                const rt = globalThis as unknown as { EdgeRuntime?: { waitUntil?: (p: Promise<unknown>) => void } };
                if (rt.EdgeRuntime?.waitUntil) rt.EdgeRuntime.waitUntil(fwd);
              }

              // Aprovação de post via API pública: a resposta do cliente vai para o fluxo de aprovação
              let dispatchReplyHandled = false;
              if (!autopilotParentChannel && !fromMe && conversation?.id && content?.trim()) {
                const { data: pendingApproval } = await supabase
                  .from('post_approvals')
                  .select('id')
                  .eq('conversation_id', conversation.id)
                  .in('status', ['pending', 'awaiting_decision'])
                  .limit(1)
                  .maybeSingle();
                if (pendingApproval?.id) {
                  dispatchReplyHandled = true;
                  asyncAiDispatched = true;
                  takeoverBlocksAutomations = true;
                  const work = fetch(`${SUPABASE_URL}/functions/v1/whatsapp-public-api`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`, 'x-internal-route': 'approval-reply' },
                    body: JSON.stringify({ conversation_id: conversation.id, content }),
                  }).catch((e) => console.error('[POST-APPROVAL] dispatch failed:', e));
                  const runtime = globalThis as unknown as { EdgeRuntime?: { waitUntil?: (p: Promise<unknown>) => void } };
                  if (runtime.EdgeRuntime?.waitUntil) runtime.EdgeRuntime.waitUntil(work as Promise<unknown>);
                }
              }

              // Resposta a um disparo com qualificação por IA: classifica interesse e envia o link configurado
              if (!dispatchReplyHandled && !autopilotParentChannel && !fromMe && conversation?.id && content?.trim() && !takeoverBlocksAutomations) {
                const { data: replyWatch } = await supabase
                  .from('dispatch_reply_watch')
                  .select('id')
                  .eq('conversation_id', conversation.id)
                  .eq('status', 'waiting')
                  .gt('expires_at', new Date().toISOString())
                  .limit(1)
                  .maybeSingle();

                if (replyWatch?.id) {
                  dispatchReplyHandled = true;
                  asyncAiDispatched = true;
                  const work = fetch(`${SUPABASE_URL}/functions/v1/dispatch-reply-qualifier`, {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                      'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
                    },
                    body: JSON.stringify({ conversation_id: conversation.id, content }),
                  }).catch((e) => console.error('[DISPATCH-QUALIFIER] dispatch failed:', e));
                  const runtime = globalThis as unknown as { EdgeRuntime?: { waitUntil?: (p: Promise<unknown>) => void } };
                  if (runtime.EdgeRuntime?.waitUntil) runtime.EdgeRuntime.waitUntil(work as Promise<unknown>);
                }
              }

              if (!dispatchReplyHandled && !autopilotParentChannel && !fromMe && conversation?.id && content?.trim() && !takeoverBlocksAutomations) {
                dispatchAiAutoReply({
                  supabaseUrl: SUPABASE_URL,
                  serviceRoleKey: SUPABASE_SERVICE_ROLE_KEY,
                  conversationId: conversation.id,
                  messageId,
                  sessionId: targetSessionId,
                  companyId,
                  content,
                  messageType,
                });
                asyncAiDispatched = true;
              }
              
              // ==================== OWNER INTERVENES → STOP AI ====================
              // If the owner/agent sends a message and AI auto-reply is active, disable it
              if (!autopilotParentChannel && fromMe && conversation) {
                try {
                  // Skip if this fromMe message is actually the AI's own echo coming back
                  // from Evolution/Baileys. The AI inserts its message first with
                  // is_ai_response=true and a custom wa_message_id; the WhatsApp echo
                  // arrives later with a different wa_message_id but identical content.
                  const twoMinAgo = new Date(Date.now() - 2 * 60 * 1000).toISOString();
                   const normalized = (content || '').trim();
                    let isAiEcho = false;
                   if (normalized) {
                     const recentAutomatedQuery = supabase
                       .from('whatsapp_messages')
                       .select('id, is_ai_response, sender_name')
                       .eq('conversation_id', conversation.id)
                       .eq('from_me', true)
                       .eq('content', normalized)
                       .gte('timestamp', twoMinAgo)
                       .limit(5);

                     if (insertedMessage?.id) {
                       recentAutomatedQuery.neq('id', insertedMessage.id);
                     }

                     const { data: recentAutomated } = await recentAutomatedQuery;
                     const automatedMatch = (recentAutomated || []).find((m: any) =>
                       m?.is_ai_response === true || ['Chatbot', 'IA', 'Sistema'].includes(String(m?.sender_name || ''))
                     );
                     
                     if (automatedMatch) {
                       isAiEcho = true;
                       console.log(`🤖🔁 Detected automated echo for conv ${conversation.id}. Updating message ID to match WhatsApp.`);
                       const originalAiMsgId = automatedMatch.id;
                       
                       await supabase
                         .from('whatsapp_messages')
                         .update({ wa_message_id: messageId })
                         .eq('id', originalAiMsgId);
                         
                       return new Response(JSON.stringify({ success: true, reason: 'automated_echo_handled' }), { headers: corsHeaders });
                     }
                   }

                    if (!isAiEcho) {
                      isAiEcho = await isLikelyChatbotOutboundEcho(supabase, conversation.id, {
                        id: insertedMessage?.id,
                        content,
                        timestamp: msgTimestamp,
                      });
                      if (isAiEcho && insertedMessage?.id) {
                        await supabase
                          .from('whatsapp_messages')
                          .update({ sender_name: 'Chatbot', is_ai_response: true })
                          .eq('id', insertedMessage.id);
                        console.log(`🤖🔁 Detected chatbot outbound echo for conv ${conversation.id}; not marking human takeover.`);
                      }
                    }

                  const { data: convCheck } = await supabase
                    .from('whatsapp_conversations')
                    .select('id, assigned_agent_id, ai_auto_reply_enabled')
                    .eq('id', conversation.id)
                    .single();
                  
                  if (!isAiEcho && convCheck?.ai_auto_reply_enabled && convCheck?.assigned_agent_id) {
                    console.log(`👤 Owner sent a message in conversation ${conversation.id}; keeping assigned AI active until user presses Parar`);
                  }

                  // ==================== OWNER INTERVENES → STOP CHATBOT ====================
                  // Also stop any active chatbot execution when the owner sends a message
                  const { data: activeChatbotExecs } = isAiEcho ? { data: [] as any[] } : await supabase
                    .from('chatbot_executions')
                    .select('id, started_at, execution_path')
                    .eq('conversation_id', conversation.id)
                    .eq('status', 'running');
                  
                  if (activeChatbotExecs && activeChatbotExecs.length > 0) {
                     // Guard: WhatsApp Business "away message"/quick-reply on the phone arrives
                     // as fromMe with sender_name=null seconds after the user's message. Ignore it
                     // so we don't kill a freshly-started chatbot execution.
                     const isLikelyPhoneAutoReply = !senderName;
                     const youngestExecAgeMs = Math.min(
                       ...activeChatbotExecs.map((e: any) => {
                         const t = e.started_at ? new Date(e.started_at).getTime() : 0;
                         return t ? Date.now() - t : Number.POSITIVE_INFINITY;
                       })
                     );
                     const execIsFresh = youngestExecAgeMs < 15_000; // 15s grace
                     const execNothingSentYet = activeChatbotExecs.every(
                       (e: any) => !Array.isArray(e.execution_path) || e.execution_path.length === 0
                     );

                      if (isAiEcho) {
                        console.log(`🤖🛡️ Ignoring fromMe "${(content || '').slice(0, 40)}" — chatbot echo. Keeping chatbot alive.`);
                      } else if (isLikelyPhoneAutoReply && execIsFresh && execNothingSentYet) {
                       console.log(
                         `🤖🛡️ Ignoring fromMe "${(content || '').slice(0, 40)}" — looks like WA Business away/auto-reply ` +
                         `(no sender_name, exec age ${Math.round(youngestExecAgeMs)}ms, no nodes executed yet). Keeping chatbot alive.`
                       );
                     } else {
                      console.log(`👤 Owner intervened - stopping ${activeChatbotExecs.length} active chatbot execution(s)`);
                      await supabase
                        .from('chatbot_executions')
                        .update({ status: 'stopped', completed_at: new Date().toISOString() })
                        .eq('conversation_id', conversation.id)
                        .eq('status', 'running');
                    
                    // Insert system message only if no AI message was already inserted
                    if (!convCheck?.ai_auto_reply_enabled) {
                      await supabase.from('whatsapp_messages').insert({
                        company_id: companyId,
                        session_id: targetSessionId,
                        conversation_id: conversation.id,
                        content: '👤 Atendente assumiu a conversa. Chatbot encerrado.',
                        from_me: true,
                        status: 'sent',
                        message_type: 'system',
                        sender_name: 'Sistema',
                      });
                    }
                     }
                  }

                  // ==================== MARK HUMAN TAKEOVER ====================
                  // Any fromMe message that is NOT an AI echo and NOT a phone auto-reply means
                  // a real human (operator) sent it — either via the CRM composer or by typing
                  // directly on the connected phone. Flag the conversation so all IA/Chatbot
                  // automations pause until the human explicitly hands it back.
                  if (!isAiEcho) {
                    const isLikelyPhoneAutoReplyHT = !senderName && (() => {
                      // reuse a simple heuristic when no chatbot execs are active
                      return false;
                    })();
                    if (!isLikelyPhoneAutoReplyHT) {
                      await markHumanTakeoverAndStopAutomations(supabase, {
                        companyId,
                        conversation,
                        phoneVariants: msgPhoneVariants,
                        remoteJid,
                        messageDbId: insertedMessage?.id || null,
                        reason: 'mensagem do celular conectado',
                      });
                      (conversation as any).human_takeover = true;
                    }
                  }
                } catch (ownerErr) {
                  console.error('Owner intervene check error:', ownerErr);
                }
              }

              // Hard guard: after a human takeover, no incoming message may continue or
              // restart chatbot/AI in this same webhook cycle (prevents race conditions).
              if (!fromMe && conversation?.id) {
                const { data: takeoverState } = await supabase
                  .from('whatsapp_conversations')
                  .select('human_takeover')
                  .eq('id', conversation.id)
                  .maybeSingle();

                if (takeoverState?.human_takeover) {
                  await supabase
                    .from('chatbot_executions')
                    .update({ status: 'stopped', completed_at: new Date().toISOString() })
                    .eq('conversation_id', conversation.id)
                    .eq('status', 'running');

                  console.log(`👤🛑 [HUMAN-TAKEOVER] Incoming message stored, automations blocked for ${conversation.id}`);
                  continue;
                }
              }

              // ==================== ORDER DETECTION: Skip chatbot for orders ====================
              let orderDetected = false;
              if (!autopilotParentChannel && !fromMe && conversation && content) {
                const upperContent = content.toUpperCase();
                const isOrder = upperContent.includes('PEDIDO VIA WHATSAPP') ||
                  upperContent.includes('CÓDIGO DO PEDIDO') ||
                  (upperContent.includes('*PEDIDO') && upperContent.includes('*PRODUTOS*')) ||
                  (upperContent.includes('DADOS DO CLIENTE') && upperContent.includes('ENDEREÇO DE ENTREGA'));
                
                if (isOrder) {
                  orderDetected = true;
                  console.log(`📦 [ORDER] Order message detected in conversation ${conversation.id}, skipping chatbot/AI`);
                  
                  try {
                    // Send acknowledgement
                    const { data: sess } = await supabase
                      .from('whatsapp_sessions')
                      .select('baileys_server_url, instance_name')
                      .eq('id', targetSessionId)
                      .single();
                    
                    if (sess?.baileys_server_url) {
                      const jid = remoteJid.includes('@') ? remoteJid : `${remoteJid}@s.whatsapp.net`;
                      const orderReply = `✅ Pedido recebido com sucesso!\n\nEstamos encaminhando para um atendente que irá dar andamento ao seu pedido. Aguarde, por favor! 🙏`;
                      
                      await compatFetch(`${sess.baileys_server_url}/api/message/send`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ instanceName: sess.instance_name, jid, message: orderReply }),
                      });
                      
                      // Save the reply as a message
                      await supabase.from('whatsapp_messages').insert({
                        session_id: targetSessionId,
                        conversation_id: conversation.id,
                        company_id: companyId,
                        content: orderReply,
                        from_me: true,
                        message_type: 'text',
                        status: 'sent',
                        sender_name: 'Sistema',
                      });
                      
                      console.log(`📦 [ORDER] Acknowledgement sent to ${phoneNumber}`);
                    }
                    
                    // Stop any active chatbot execution
                    await supabase
                      .from('chatbot_executions')
                      .update({ status: 'completed', completed_at: new Date().toISOString() })
                      .eq('conversation_id', conversation.id)
                      .eq('status', 'running');
                    
                    // Disable AI auto-reply if active
                    await supabase
                      .from('whatsapp_conversations')
                      .update({ ai_auto_reply_enabled: false, assigned_agent_id: null })
                      .eq('id', conversation.id);
                      
                  } catch (orderErr) {
                    console.error('📦 [ORDER] Error handling order:', orderErr);
                  }
                }
              }

              // ==================== MEETING RSVP DETECTION ====================
              // Check if incoming message is a response to a meeting invite
              let rsvpHandled = false;
              // ==================== KEYWORD HANDOFF: "atendente" ====================
              // If the user mentions "atendente" (or close variants), always transfer to a human.
              let humanHandoffByKeyword = false;
              if (!autopilotParentChannel && !fromMe && conversation && content && !orderDetected) {
                try {
                  const normalized = content
                    .toLowerCase()
                    .normalize('NFD')
                    .replace(/[\u0300-\u036f]/g, '');
                  // matches: atendente, atendentes, falar com atendente, um atendente humano, etc.
                  const wantsHuman = /\batendent[ea]s?\b/.test(normalized);
                  if (wantsHuman) {
                    humanHandoffByKeyword = true;
                    console.log(`🙋 [HANDOFF-KEYWORD] User asked for "atendente" in conversation ${conversation.id}. Transferring to human.`);

                    const { data: sess } = await supabase
                      .from('whatsapp_sessions')
                      .select('baileys_server_url, instance_name')
                      .eq('id', targetSessionId)
                      .single();

                    if (sess?.baileys_server_url) {
                      const jid = remoteJid.includes('@') ? remoteJid : `${remoteJid}@s.whatsapp.net`;
                      const transferReply = `Tudo bem! 👋 Já estou te transferindo para um de nossos atendentes. Em instantes alguém da equipe vai continuar o atendimento por aqui. 🙏`;

                      await compatFetch(`${sess.baileys_server_url}/api/message/send`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ instanceName: sess.instance_name, jid, message: transferReply }),
                      });

                      await supabase.from('whatsapp_messages').insert({
                        session_id: targetSessionId,
                        conversation_id: conversation.id,
                        company_id: companyId,
                        content: transferReply,
                        from_me: true,
                        message_type: 'text',
                        status: 'sent',
                        sender_name: 'Sistema',
                      });
                    }

                    // Stop any active chatbot execution and mark as handoff so it never re-triggers
                    const { data: runningExecs } = await supabase
                      .from('chatbot_executions')
                      .select('id, variables')
                      .eq('conversation_id', conversation.id)
                      .eq('status', 'running');

                    if (runningExecs && runningExecs.length > 0) {
                      for (const ex of runningExecs) {
                        const prevVars = (ex.variables as any) || {};
                        await supabase
                          .from('chatbot_executions')
                          .update({
                            status: 'stopped',
                            completed_at: new Date().toISOString(),
                            variables: { ...prevVars, handoff: true, handoff_reason: 'keyword:atendente' },
                          })
                          .eq('id', ex.id);
                      }
                    } else {
                      // Insert a stopped/handoff marker so future re-trigger logic skips this conversation
                      await supabase.from('chatbot_executions').insert({
                        conversation_id: conversation.id,
                        company_id: companyId,
                        status: 'stopped',
                        completed_at: new Date().toISOString(),
                        variables: { handoff: true, handoff_reason: 'keyword:atendente' },
                      });
                    }

                    // Disable AI auto-reply and unassign AI agent
                    await supabase
                      .from('whatsapp_conversations')
                      .update({ ai_auto_reply_enabled: false, assigned_agent_id: null })
                      .eq('id', conversation.id);
                  }
                } catch (handoffErr) {
                  console.error('🙋 [HANDOFF-KEYWORD] Error:', handoffErr);
                }
              }

              if (!autopilotParentChannel && !fromMe && conversation && content && !orderDetected && !humanHandoffByKeyword) {
                try {
                  const upperContent = content.trim().toUpperCase();
                  const isYes = upperContent === 'SIM' || upperContent === '1' || upperContent === 'YES' || upperContent === 'CONFIRMO';
                  const isNo = upperContent === 'NÃO' || upperContent === 'NAO' || upperContent === '2' || upperContent === 'NO';

                  if (isYes || isNo) {
                    const cleanPhone = phoneNumber.replace(/\D/g, '');
                    const phoneVariants = new Set<string>([cleanPhone]);
                    
                    // Use conversation's contact_phone
                    if (conversation?.contact_phone) {
                      const convPhone = conversation.contact_phone.replace(/\D/g, '');
                      phoneVariants.add(convPhone);
                    }

                    // Detect if this is a LID (Linked Identity Device) - not a real phone number
                    const isLidPhone = isLidJid(remoteJid) || (!cleanPhone.startsWith('55') && !cleanPhone.startsWith('1') && cleanPhone.length > 13);
                    
                    let pendingRsvps: any[] | null = null;

                    if (isLidPhone && companyId) {
                      // ===== LID FALLBACK: Search ALL pending RSVPs for this company =====
                      // When message comes from a LID, we can't match by phone number.
                      // Instead, search for the most recent pending RSVP in this company.
                      // The user just responded Sim/Não, so the most recent pending RSVP is likely the one.
                      console.log(`📋 [RSVP] LID detected (${cleanPhone}), searching ALL pending RSVPs for company ${companyId}`);
                      
                      const { data } = await supabase
                        .from('meeting_rsvp')
                        .select('id, event_id, company_id, attendee_name')
                        .eq('company_id', companyId)
                        .in('status', ['pending', 'reminded'])
                        .order('invited_at', { ascending: false })
                        .limit(1);
                      
                      pendingRsvps = data;
                      console.log(`📋 [RSVP] LID fallback found ${pendingRsvps?.length || 0} pending RSVPs`);
                    } else {
                      // ===== Normal phone matching =====
                      // Add 9th digit variants for Brazilian numbers
                      const expandedVariants = new Set<string>(phoneVariants);
                      for (const pv of phoneVariants) {
                        if (pv.startsWith('55') && pv.length === 13) {
                          expandedVariants.add(pv.slice(0, 4) + pv.slice(5));
                        } else if (pv.startsWith('55') && pv.length === 12) {
                          expandedVariants.add(pv.slice(0, 4) + '9' + pv.slice(4));
                        }
                      }

                      const jidVariants = new Set<string>([remoteJid]);
                      for (const pv of expandedVariants) {
                        jidVariants.add(`${pv}@s.whatsapp.net`);
                      }

                      const phoneArr = Array.from(expandedVariants);
                      const jidArr = Array.from(jidVariants);
                      console.log(`📋 [RSVP] Normal phone check for: ${phoneArr.join(', ')}`);

                      const { data } = await supabase
                        .from('meeting_rsvp')
                        .select('id, event_id, company_id, attendee_name')
                        .in('status', ['pending', 'reminded'])
                        .or(
                          phoneArr.map(p => `attendee_phone.eq.${p}`).join(',') + ',' +
                          jidArr.map(j => `resolved_jid.eq.${j}`).join(',')
                        )
                        .order('invited_at', { ascending: false })
                        .limit(1);
                      
                      pendingRsvps = data;
                    }

                    if (pendingRsvps && pendingRsvps.length > 0) {
                      const rsvp = pendingRsvps[0];
                      const newStatus = isYes ? 'confirmed' : 'declined';

                      await supabase
                        .from('meeting_rsvp')
                        .update({ status: newStatus, responded_at: new Date().toISOString() })
                        .eq('id', rsvp.id);

                      console.log(`📋 [RSVP] ${phoneNumber} responded "${newStatus}" to event ${rsvp.event_id}`);
                      rsvpHandled = true; // Prevent AI from responding

                      // Get event details for notification
                      const { data: eventInfo } = await supabase
                        .from('calendar_events')
                        .select('title, created_by, start_date, company_id')
                        .eq('id', rsvp.event_id)
                        .single();

                      if (eventInfo) {
                        // Send confirmation reply via WhatsApp
                        const { data: sess } = await supabase
                          .from('whatsapp_sessions')
                          .select('baileys_server_url, instance_name')
                          .eq('id', targetSessionId)
                          .single();

                        if (sess?.baileys_server_url) {
                          const replyJid = remoteJid.includes('@') ? remoteJid : `${remoteJid}@s.whatsapp.net`;
                          let replyMsg = '';
                          
                          if (isYes) {
                            replyMsg = `✅ *Presença confirmada!*\n\nSua participação na reunião *"${eventInfo.title}"* foi registrada.\n\nObrigado!`;
                          } else {
                            replyMsg = `❌ *Participação recusada*\n\nRegistramos que você não poderá participar da reunião *"${eventInfo.title}"*.\n\nVocê gostaria de *remarcar para outro dia* ou *cancelar definitivamente*?\n\nResponda livremente, por exemplo:\n• _"Quero remarcar para quinta às 15h"_\n• _"Cancelar"_`;
                            
                            // Create a reschedule request in awaiting_response state
                            await supabase.from('meeting_reschedule_requests').insert({
                              event_id: rsvp.event_id,
                              rsvp_id: rsvp.id,
                              company_id: eventInfo.company_id,
                              attendee_phone: phoneNumber,
                              attendee_name: rsvp.attendee_name || contactName || phoneNumber,
                              status: 'awaiting_response',
                            });
                            console.log(`📅 [RESCHEDULE] Created awaiting_response record for ${phoneNumber} on event ${rsvp.event_id}`);
                          }

                          await compatFetch(`${sess.baileys_server_url}/api/message/send`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ instanceName: sess.instance_name, jid: replyJid, message: { text: replyMsg } }),
                          });

                          // Save reply as message
                          await supabase.from('whatsapp_messages').insert({
                            session_id: targetSessionId,
                            conversation_id: conversation.id,
                            company_id: companyId,
                            content: replyMsg,
                            from_me: true,
                            message_type: 'text',
                            status: 'sent',
                            sender_name: 'Sistema',
                          });
                        }

                        // Notify organizer
                        const contactDisplayName = rsvp.attendee_name || contactName || phoneNumber;
                        await supabase.from('notifications').insert({
                          user_id: eventInfo.created_by,
                          company_id: eventInfo.company_id,
                          title: isYes ? '✅ Presença confirmada' : '❌ Participação recusada',
                          message: `${contactDisplayName} ${isYes ? 'confirmou presença' : 'recusou participar'} na reunião "${eventInfo.title}"`,
                          type: isYes ? 'success' : 'warning',
                          category: 'calendar',
                          icon: 'Calendar',
                          action_url: '/dashboard/agenda',
                          metadata: { event_id: rsvp.event_id, rsvp_id: rsvp.id, status: newStatus },
                        });
                      }
                    }
                  }
                } catch (rsvpErr) {
                  console.error('[RSVP] Error processing RSVP response:', rsvpErr);
                }
              }

              // ==================== MEETING RESCHEDULE DETECTION ====================
              // Check if there's a pending reschedule request awaiting the participant's response
              let rescheduleHandled = false;
              if (!autopilotParentChannel && !fromMe && conversation && content && !orderDetected && !rsvpHandled && !humanHandoffByKeyword) {
                try {
                  const cleanPhone = phoneNumber.replace(/\D/g, '');
                  const phoneVariants = [cleanPhone];
                  if (conversation?.contact_phone) {
                    phoneVariants.push(conversation.contact_phone.replace(/\D/g, ''));
                  }
                  // Add 9th digit variants
                  const expanded = [...phoneVariants];
                  for (const pv of phoneVariants) {
                    if (pv.startsWith('55') && pv.length === 13) expanded.push(pv.slice(0, 4) + pv.slice(5));
                    else if (pv.startsWith('55') && pv.length === 12) expanded.push(pv.slice(0, 4) + '9' + pv.slice(4));
                  }

                  // Only consider awaiting_response records created more than 10 seconds ago
                  // to avoid processing the same message that triggered the reschedule prompt
                  const tenSecondsAgo = new Date(Date.now() - 10000).toISOString();
                  const { data: pendingReschedule } = await supabase
                    .from('meeting_reschedule_requests')
                    .select('id, event_id, rsvp_id, company_id, attendee_phone')
                    .eq('status', 'awaiting_response')
                    .in('attendee_phone', expanded)
                    .lt('created_at', tenSecondsAgo)
                    .order('created_at', { ascending: false })
                    .limit(1);

                  if (pendingReschedule && pendingReschedule.length > 0) {
                    const req = pendingReschedule[0];
                    console.log(`📅 [RESCHEDULE] Processing response from ${phoneNumber}: "${content}"`);
                    rescheduleHandled = true;

                    // Call the edge function to interpret via AI
                    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
                    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
                    
                    await fetch(`${SUPABASE_URL}/functions/v1/handle-meeting-reschedule`, {
                      method: 'POST',
                      headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
                      },
                      body: JSON.stringify({
                        action: 'interpret',
                        message: content,
                        attendee_phone: phoneNumber,
                        rsvp_id: req.rsvp_id,
                        event_id: req.event_id,
                        company_id: req.company_id,
                        session_id: targetSessionId,
                        conversation_id: conversation.id,
                        remote_jid: remoteJid,
                      }),
                    });

                    // Delete the awaiting_response record (it's been processed)
                    await supabase
                      .from('meeting_reschedule_requests')
                      .delete()
                      .eq('id', req.id);
                  }
                } catch (rescheduleErr) {
                  console.error('[RESCHEDULE] Error:', rescheduleErr);
                }
              }

              // ==================== CHATBOT FLOW ENGINE ====================
              // Check if there's an active chatbot execution for this conversation
              let chatbotHandled = false;
              if (!autopilotParentChannel && !fromMe && conversation && !orderDetected && !rsvpHandled && !rescheduleHandled && !humanHandoffByKeyword) {
                try {
                  // First check if AI auto-reply is already active — skip chatbot if so
                  const { data: convAiCheck } = await supabase
                    .from('whatsapp_conversations')
                    .select('ai_auto_reply_enabled')
                    .eq('id', conversation.id)
                    .single();
                  
                  if (convAiCheck?.ai_auto_reply_enabled) {
                    console.log(`🤖🔄 [CHATBOT] AI auto-reply is active, skipping chatbot engine`);
                    // Clean up any stale running executions
                    await supabase
                      .from('chatbot_executions')
                      .update({ status: 'completed', completed_at: new Date().toISOString() })
                      .eq('conversation_id', conversation.id)
                      .eq('status', 'running');
                    chatbotHandled = false; // Let AI auto-reply handle it
                  }

                  // Use limit 1 + order to avoid "multiple rows" error
                  const { data: execRows } = await supabase
                    .from('chatbot_executions')
                    .select('id, flow_id, current_node_id, variables, execution_path, last_activity_at')
                    .eq('conversation_id', conversation.id)
                    .eq('status', 'running')
                    .order('started_at', { ascending: false })
                    .limit(1);

                  let activeExec = (!convAiCheck?.ai_auto_reply_enabled) ? (execRows?.[0] || null) : null;

                  // ===== INACTIVITY TIMEOUT: 10 minutes =====
                  const CHATBOT_TIMEOUT_MS = 10 * 60 * 1000;
                  if (activeExec && activeExec.last_activity_at) {
                    const lastActivity = new Date(activeExec.last_activity_at).getTime();
                    const elapsed = Date.now() - lastActivity;
                    if (elapsed > CHATBOT_TIMEOUT_MS) {
                      console.log(`🤖⏰ [CHATBOT] Execution ${activeExec.id} timed out (${Math.round(elapsed/1000/60)}min inactive). Restarting flow...`);
                      
                      // Complete the stale execution
                      await supabase.from('chatbot_executions')
                        .update({ status: 'timeout', completed_at: new Date().toISOString() })
                        .eq('id', activeExec.id);
                      
                      // Find the same flow to restart
                      const { data: flowToRestart } = await supabase
                        .from('chatbot_flows')
                        .select('id, name, nodes, edges, trigger_config, execution_count')
                        .eq('id', activeExec.flow_id)
                        .single();
                      
                      if (flowToRestart) {
                        const { data: restartedExec } = await supabase
                          .from('chatbot_executions')
                          .insert({
                            flow_id: flowToRestart.id,
                            company_id: companyId,
                            conversation_id: conversation.id,
                            contact_phone: phoneNumber,
                            status: 'running',
                            variables: { nome: contactName || phoneNumber, telefone: phoneNumber },
                            execution_path: [],
                            last_activity_at: new Date().toISOString(),
                          })
                          .select()
                          .single();
                        
                        if (restartedExec) {
                          console.log(`🤖🔄 [CHATBOT] Flow restarted: ${flowToRestart.name}`);
                          const restartNodes = (flowToRestart.nodes || []) as any[];
                          const restartEdges = (flowToRestart.edges || []) as any[];
                          const rootNode = restartNodes.find((n: any) => n.type === 'trigger') || restartNodes[0];
                          
                          if (rootNode) {
                            const firstEdge = restartEdges.find((e: any) => e.source === rootNode.id);
                            const firstNode = firstEdge ? restartNodes.find((n: any) => n.id === firstEdge.target) : null;
                            
                            if (firstNode && firstNode.type === 'message') {
                              let finalMsg = firstNode.data?.config?.message || firstNode.data?.label || '';
                              const msgButtons: string[] = firstNode.data?.config?.buttons || [];
                              const imgUrl = firstNode.data?.config?.imageUrl || null;
                              const vars = restartedExec.variables as Record<string, unknown> || {};
                              Object.entries(vars).forEach(([k, v]) => {
                                finalMsg = finalMsg.replace(new RegExp(`\\{\\{${k}\\}\\}`, 'gi'), String(v || ''));
                              });
                              if (msgButtons.length > 0) {
                                finalMsg += '\n\n' + msgButtons.map((b: string, i: number) => `${i + 1}. ${b}`).join('\n');
                              }
                              
                              const { data: sess } = await supabase
                                .from('whatsapp_sessions')
                                .select('baileys_server_url, instance_name')
                                .eq('id', targetSessionId)
                                .single();
                              
                              if (sess?.baileys_server_url) {
                                const jid = remoteJid.includes('@') ? remoteJid : `${remoteJid}@s.whatsapp.net`;
                                await compatFetch(`${sess.baileys_server_url}/api/message/send`, {
                                  method: 'POST',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({ instanceName: sess.instance_name, jid, message: finalMsg }),
                                });
                                await supabase.from('whatsapp_messages').insert({
                                  session_id: targetSessionId, conversation_id: conversation.id,
                                  remote_jid: remoteJid, from_me: true, content: finalMsg,
                                  message_type: 'text', status: 'sent',
                                  media_url: imgUrl || null, sender_name: 'Chatbot',
                                });
                              }
                              
                              await supabase.from('chatbot_executions').update({
                                current_node_id: firstNode.id,
                                execution_path: [firstNode.id],
                                last_activity_at: new Date().toISOString(),
                              }).eq('id', restartedExec.id);
                            }
                          }
                          chatbotHandled = true;
                          activeExec = null;
                        }
                      } else {
                        activeExec = null;
                      }
                    }
                  }

                  // Update last_activity_at for active execution
                  if (activeExec) {
                    await supabase.from('chatbot_executions').update({
                      last_activity_at: new Date().toISOString(),
                    }).eq('id', activeExec.id);
                  }

                  if (activeExec) {
                    console.log(`🤖🔄 [CHATBOT] Active execution found: ${activeExec.id}, current_node: ${activeExec.current_node_id}`);

                    // Load flow
                    const { data: flow } = await supabase
                      .from('chatbot_flows')
                      .select('nodes, edges, settings')
                      .eq('id', activeExec.flow_id)
                      .single();

                    if (flow) {
                      const nodes = Array.isArray(flow.nodes) ? flow.nodes : [];
                      const edges = Array.isArray(flow.edges) ? flow.edges : [];
                      const flowSettings = (flow.settings as Record<string, unknown> | null) || {};
                      const responseDelayMs = Math.max(0, Math.min(15000, Number(flowSettings.responseDelayMs ?? 3000)));
                      const isChatbotExecutionStillRunning = async () => {
                        const { data: convGuard } = await supabase
                          .from('whatsapp_conversations')
                          .select('human_takeover')
                          .eq('id', conversation.id)
                          .maybeSingle();

                        if (convGuard?.human_takeover) {
                          await supabase
                            .from('chatbot_executions')
                            .update({ status: 'stopped', completed_at: new Date().toISOString() })
                            .eq('conversation_id', conversation.id)
                            .eq('status', 'running');
                          console.log(`👤🛑 [CHATBOT] Stopped before sending: human takeover active for ${conversation.id}`);
                          return false;
                        }

                        const { data: execGuard } = await supabase
                          .from('chatbot_executions')
                          .select('status')
                          .eq('id', activeExec.id)
                          .maybeSingle();

                        if (!execGuard || execGuard.status !== 'running') {
                          console.log(`👤🛑 [CHATBOT] Execution ${activeExec.id} is no longer running`);
                          return false;
                        }

                        return true;
                      };
                      const sleepDelay = async () => {
                        if (!(await isChatbotExecutionStillRunning())) throw new Error('chatbot_execution_stopped');
                        await new Promise(r => setTimeout(r, responseDelayMs));
                        if (!(await isChatbotExecutionStillRunning())) throw new Error('chatbot_execution_stopped');
                      };

                      // If current_node_id is null, find the first message node (after trigger)
                      let currentNode = nodes.find((n: any) => n.id === activeExec.current_node_id);
                      if (!currentNode) {
                        console.log(`🤖🔄 [CHATBOT] current_node_id is null, finding first node...`);
                        const triggerNode = nodes.find((n: any) => n.type === 'trigger');
                        if (triggerNode) {
                          const firstEdge = edges.find((e: any) => e.source === triggerNode.id);
                          currentNode = firstEdge ? nodes.find((n: any) => n.id === firstEdge.target) : null;
                        }
                        if (!currentNode) {
                          // Fallback: find node with no incoming edges
                          const targetIds = new Set(edges.map((e: any) => e.target));
                          currentNode = nodes.find((n: any) => n.type !== 'trigger' && !targetIds.has(n.id));
                        }
                        
                        // If we found a starting node, send its message first (the initial greeting)
                        if (currentNode) {
                          console.log(`🤖🔄 [CHATBOT] Resolved to first node: ${currentNode.id}`);
                          
                          // Get session server URL
                          const { data: sessionData } = await supabase
                            .from('whatsapp_sessions')
                            .select('baileys_server_url, instance_name')
                            .eq('id', targetSessionId)
                            .single();
                          const serverUrl = sessionData?.baileys_server_url;
                          const instanceName2 = sessionData?.instance_name;
                          
                          console.log(`🤖🔄 [CHATBOT] serverUrl=${serverUrl}, nodeType=${currentNode.type}, phoneNumber=${phoneNumber}`);
                          if (serverUrl && currentNode.type === 'message') {
                            const vars = (activeExec.variables as Record<string, string>) || {};
                            let greetMsg = currentNode.data?.config?.message || currentNode.data?.config?.content || currentNode.data?.label || '';
                            greetMsg = greetMsg.replace(/\{\{(\w+)\}\}/g, (_: string, key: string) => vars[key] || `{{${key}}}`);
                            
                            const greetButtons: string[] = currentNode.data?.config?.buttons || [];
                            if (greetButtons.length > 0) {
                              greetMsg += '\n\n' + greetButtons.map((b: string, i: number) => `${i + 1}. ${b}`).join('\n');
                            }
                            
                            // Use remoteJid (already resolved from remoteJidAlt) instead of phoneNumber (which may be a LID)
                            const jid = remoteJid.includes('@') ? remoteJid : `${remoteJid}@s.whatsapp.net`;
                            console.log(`🤖🔄 [CHATBOT] Using JID for send: ${jid} (remoteJid=${remoteJid}, phoneNumber=${phoneNumber})`);
                            const imageUrl = currentNode.data?.config?.imageUrl || currentNode.data?.config?.url || '';
                            console.log(`🤖🔄 [CHATBOT] Initial node subType=${currentNode.subType}, imageUrl=${imageUrl ? 'YES' : 'NO'}`);
                            
                            try {
                              let ok = false;
                              const mediaKind = currentNode.subType === 'audio' ? 'audio'
                                : currentNode.subType === 'video' ? 'video'
                                : currentNode.subType === 'file' ? 'document'
                                : currentNode.subType === 'image' ? 'image'
                                : (imageUrl ? 'image' : '');
                              if (imageUrl && mediaKind) {
                                await sleepDelay();
                                const mediaBody: any = { instanceName: instanceName2, jid, mediaUrl: imageUrl, mediaType: mediaKind };
                                if (mediaKind === 'image' || mediaKind === 'video') mediaBody.caption = greetMsg;
                                if (mediaKind === 'audio') mediaBody.ptt = currentNode.data?.config?.ptt !== false;
                                if (mediaKind === 'document') mediaBody.fileName = currentNode.data?.config?.filename || 'arquivo';
                                const r = await chatbotFetch(supabase, conversation.id, activeExec.id, `${serverUrl}/api/message/send-media`, {
                                  method: 'POST', headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify(mediaBody),
                                });
                                ok = r.ok;
                              } else {
                                await sleepDelay();
                                const r = await chatbotFetch(supabase, conversation.id, activeExec.id, `${serverUrl}/api/message/send`, {
                                  method: 'POST', headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({ instanceName: instanceName2, jid, message: { text: greetMsg } }),
                                });
                                console.log(`🤖🔄 [CHATBOT] Send response: ${r.status} ${r.statusText}`);
                                if (!r.ok) {
                                  const body = await r.text();
                                  console.error(`🤖🔄 [CHATBOT] Send failed body: ${body}`);
                                }
                                ok = r.ok;
                              }
                              
                              if (ok) {
                                await supabase.from('whatsapp_messages').insert({
                                  company_id: companyId, session_id: targetSessionId,
                                  conversation_id: conversation.id, content: greetMsg,
                                  from_me: true, status: 'sent',
                                  message_type: imageUrl ? 'image' : 'text',
                                  media_url: imageUrl || null, sender_name: 'Chatbot',
                                });
                                
                                await supabase.from('chatbot_executions').update({
                                  current_node_id: currentNode.id,
                                  execution_path: [currentNode.id],
                                }).eq('id', activeExec.id);
                                
                                console.log(`🤖🔄 [CHATBOT] Sent initial greeting for node ${currentNode.id}`);
                                chatbotHandled = true;
                              }
                            } catch (e) {
                              console.error('🤖🔄 [CHATBOT] Initial greeting error:', e);
                            }
                          }
                        }
                      }

                      if (currentNode && !chatbotHandled) {
                        const userInput = (content || '').trim();
                        let nextNodeId: string | null = null;

                        // If current node has buttons (choice node), match user input
                        const buttons: string[] = currentNode.data?.config?.buttons || [];
                        if (buttons.length > 0) {
                          // === MULTI-SELECTION SUPPORT ===
                          // Parse inputs like "4 e 9", "4, 9", "4 9", "4,9", "1, 3 e 5"
                          const multiPattern = /[\s,]+e\s+|[,;\s]+/gi;
                          const parts = userInput.split(multiPattern).map((p: string) => p.trim()).filter(Boolean);
                          
                          // Check if it's a multi-selection (2+ valid numbers)
                          const parsedIndices: number[] = [];
                          for (const part of parts) {
                            const num = parseInt(part);
                            if (!isNaN(num) && num >= 1 && num <= buttons.length) {
                              parsedIndices.push(num - 1); // 0-based
                            } else {
                              const partLower = part.toLowerCase().trim();
                              // 1) Exact match
                              let idx = buttons.findIndex((b: string) => b.toLowerCase().trim() === partLower);
                              // 2) Button starts with user input (e.g. "Sim" matches "Sim, sou eu!")
                              if (idx < 0) idx = buttons.findIndex((b: string) => b.toLowerCase().trim().startsWith(partLower));
                              // 3) User input starts with button text
                              if (idx < 0) idx = buttons.findIndex((b: string) => partLower.startsWith(b.toLowerCase().trim()));
                              // 4) Keyword contained in button text
                              if (idx < 0 && partLower.length >= 3) idx = buttons.findIndex((b: string) => b.toLowerCase().includes(partLower));
                              if (idx >= 0) parsedIndices.push(idx);
                            }
                          }
                          
                          // Deduplicate
                          const uniqueIndices = [...new Set(parsedIndices)];
                          
                          if (uniqueIndices.length > 1) {
                            // *** MULTI-SELECTION: process each choice sequentially ***
                            console.log(`🤖🔄 [CHATBOT] Multi-selection detected: ${uniqueIndices.map(i => `${i+1}. ${buttons[i]}`).join(', ')}`);
                            
                            // Get session data once for all sends
                            const { data: sessionData } = await supabase
                              .from('whatsapp_sessions')
                              .select('baileys_server_url, instance_name')
                              .eq('id', targetSessionId)
                              .single();
                            const serverUrlMulti = sessionData?.baileys_server_url;
                            const instanceNameMulti = sessionData?.instance_name;
                            const jidMulti = remoteJid.includes('@') ? remoteJid : `${remoteJid}@s.whatsapp.net`;
                            
                            if (serverUrlMulti) {
                              for (const selectedIndex of uniqueIndices) {
                                const edge = edges.find((e: any) =>
                                  e.source === currentNode.id && e.sourceHandle === `btn_${selectedIndex}`
                                );
                                const targetId = edge?.target;
                                if (!targetId) continue;
                                
                                const targetNode = nodes.find((n: any) => n.id === targetId);
                                if (!targetNode || targetNode.type !== 'message') continue;
                                
                                const vars = (activeExec.variables as Record<string, string>) || {};
                                let msgContent = targetNode.data?.config?.message || targetNode.data?.config?.content || targetNode.data?.label || '';
                                msgContent = msgContent.replace(/\{\{(\w+)\}\}/g, (_: string, key: string) => vars[key] || `{{${key}}}`);
                                
                                const targetButtons: string[] = targetNode.data?.config?.buttons || [];
                                if (targetButtons.length > 0) {
                                  msgContent += '\n\n' + targetButtons.map((b: string, i: number) => `${i + 1}. ${b}`).join('\n');
                                }
                                
                                const imgUrl = targetNode.data?.config?.imageUrl || targetNode.data?.config?.url || '';
                                
                                try {
                                  let sent = false;
                                  if (imgUrl) {
                                    await sleepDelay();
                                    const res = await chatbotFetch(supabase, conversation.id, activeExec.id, `${serverUrlMulti}/api/message/send-media`, {
                                      method: 'POST',
                                      headers: { 'Content-Type': 'application/json' },
                                      body: JSON.stringify({ instanceName: instanceNameMulti, jid: jidMulti, mediaUrl: imgUrl, mediaType: 'image', caption: msgContent }),
                                    });
                                    sent = res.ok;
                                    if (!res.ok) {
                                      const fallback = await chatbotFetch(supabase, conversation.id, activeExec.id, `${serverUrlMulti}/api/message/send`, {
                                        method: 'POST',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({ instanceName: instanceNameMulti, jid: jidMulti, message: { text: msgContent + '\n\n📷 ' + imgUrl } }),
                                      });
                                      sent = fallback.ok;
                                    }
                                  } else {
                                    await sleepDelay();
                                    const res = await chatbotFetch(supabase, conversation.id, activeExec.id, `${serverUrlMulti}/api/message/send`, {
                                      method: 'POST',
                                      headers: { 'Content-Type': 'application/json' },
                                      body: JSON.stringify({ instanceName: instanceNameMulti, jid: jidMulti, message: { text: msgContent } }),
                                    });
                                    sent = res.ok;
                                  }
                                  
                                  if (sent) {
                                    await supabase.from('whatsapp_messages').insert({
                                      company_id: companyId, session_id: targetSessionId,
                                      conversation_id: conversation.id, content: msgContent,
                                      from_me: true, status: 'sent',
                                      message_type: imgUrl ? 'image' : 'text',
                                      media_url: imgUrl || null, sender_name: 'Chatbot',
                                    });
                                    console.log(`🤖🔄 [CHATBOT] Multi-select: sent response for option ${selectedIndex + 1}`);
                                  }
                                  
                                  // Inter-card delay handled by sleepDelay() before next send
                                } catch (err) {
                                  console.error(`🤖🔄 [CHATBOT] Multi-select send error for option ${selectedIndex + 1}:`, err);
                                }
                              }
                              
                              // After multi-select, stay on current node so user can pick more or continue
                              const execPath = Array.isArray(activeExec.execution_path) ? activeExec.execution_path : [];
                              await supabase.from('chatbot_executions').update({
                                current_node_id: currentNode.id,
                                execution_path: [...execPath, `multi:${uniqueIndices.map(i => i+1).join(',')}`],
                              }).eq('id', activeExec.id);
                              
                              chatbotHandled = true;
                            }
                          } else if (uniqueIndices.length === 1) {
                            // Single selection (original logic)
                            const matchedIndex = uniqueIndices[0];
                            const edge = edges.find((e: any) =>
                              e.source === currentNode.id && e.sourceHandle === `btn_${matchedIndex}`
                            );
                            nextNodeId = edge?.target || null;
                            console.log(`🤖🔄 [CHATBOT] Matched button ${matchedIndex}: "${buttons[matchedIndex]}" -> ${nextNodeId}`);
                          } else {
                            // === AI DEEP FALLBACK: Scan entire flow tree to find matching product/option ===
                            let aiMatchedIndex = -1;
                            try {
                              const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
                              if (LOVABLE_API_KEY) {
                                // Build a complete map of all reachable nodes from current node
                                const flowMap: { path: string; nodeId: string; content: string; btns: string[] }[] = [];
                                const visited = new Set<string>();
                                
                                const traverseNodes = (nodeId: string, pathPrefix: string, depth: number) => {
                                  if (depth > 6 || visited.has(nodeId)) return;
                                  visited.add(nodeId);
                                  const outEdges = edges.filter((e: any) => e.source === nodeId);
                                  for (const oe of outEdges) {
                                    const tn = nodes.find((n: any) => n.id === oe.target);
                                    if (!tn) continue;
                                    const nc = tn.data?.config?.message || tn.data?.config?.content || tn.data?.label || '';
                                    const nb: string[] = tn.data?.config?.buttons || [];
                                    const lbl = tn.data?.label || tn.id;
                                    const np = `${pathPrefix} > ${lbl}`;
                                    flowMap.push({ path: np, nodeId: tn.id, content: nc, btns: nb });
                                    traverseNodes(tn.id, np, depth + 1);
                                  }
                                };
                                
                                traverseNodes(currentNode.id, currentNode.data?.label || 'Menu', 0);
                                
                                const currentButtonsDesc = buttons.map((b: string, i: number) => `${i + 1}. ${b}`).join('\n');
                                const flowTreeDesc = flowMap.map((fm, i) => 
                                  `[Nó ${i+1}] ${fm.path}\nConteúdo: ${fm.content}${fm.btns.length > 0 ? '\nSub-opções: ' + fm.btns.join(', ') : ''}`
                                ).join('\n---\n');
                                
                                const aiPrompt = `Você é um assistente que interpreta mensagens de clientes em chatbots de WhatsApp de farmácia/e-commerce.

MENU ATUAL apresentado ao cliente:
${currentButtonsDesc}

MENSAGEM DO CLIENTE: "${userInput}"

MAPA COMPLETO DO FLUXO (todos os produtos e caminhos acessíveis a partir de cada opção):
${flowTreeDesc}

TAREFA: Determine qual opção do MENU ATUAL o cliente quer acessar, analisando todo o fluxo.

REGRAS IMPORTANTES:
- O cliente pode ter erros de digitação (ex: "Terzec" = "Tirzec", "sema" = "Semaglutida")  
- Se o cliente menciona um produto específico com dosagem (ex: "15mg"), busque no mapa qual opção do menu atual leva a esse produto
- Analise nomes comerciais, princípios ativos, abreviações
- Só responda se tiver ALTA confiança no match

Responda SOMENTE o número da opção (1, 2, 3...). Se não conseguir determinar com confiança, responda 0.`;

                                console.log(`🤖🧠 [CHATBOT-AI] Deep fallback: "${userInput}" - ${flowMap.length} nodes scanned`);
                                
                                const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
                                  method: "POST",
                                  headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
                                  body: JSON.stringify({
                                    model: "google/gemini-3-flash-preview",
                                    messages: [
                                      { role: "system", content: aiPrompt },
                                      { role: "user", content: userInput },
                                    ],
                                    temperature: 0.05,
                                  }),
                                });
                                
                                if (aiResp.ok) {
                                  const aiData = await aiResp.json();
                                  const aiAnswer = (aiData.choices?.[0]?.message?.content || '').trim();
                                  const numMatch = aiAnswer.match(/\d+/);
                                  const aiNum = numMatch ? parseInt(numMatch[0]) : 0;
                                  if (aiNum >= 1 && aiNum <= buttons.length) {
                                    aiMatchedIndex = aiNum - 1;
                                    console.log(`🤖🧠 [CHATBOT-AI] Matched "${userInput}" → option ${aiNum}: "${buttons[aiMatchedIndex]}"`);
                                  } else {
                                    console.log(`🤖🧠 [CHATBOT-AI] No match. AI said: "${aiAnswer}"`);
                                  }
                                }
                              }
                            } catch (aiErr) {
                              console.error(`🤖🧠 [CHATBOT-AI] Deep fallback error:`, aiErr);
                            }
                            
                            if (aiMatchedIndex >= 0) {
                              const edge = edges.find((e: any) =>
                                e.source === currentNode.id && e.sourceHandle === `btn_${aiMatchedIndex}`
                              );
                              nextNodeId = edge?.target || null;
                              console.log(`🤖🧠 [CHATBOT-AI] Routed → btn ${aiMatchedIndex}: "${buttons[aiMatchedIndex]}" -> ${nextNodeId}`);
                            } else {
                              const invalidEdge = edges.find((e: any) =>
                                e.source === currentNode.id && e.sourceHandle === 'invalid'
                              );
                              nextNodeId = invalidEdge?.target || null;
                              console.log(`🤖🔄 [CHATBOT] AI deep match failed for "${userInput}" -> invalid edge ${nextNodeId}`);
                            }
                          }
                        } else {
                          // Non-choice node: follow default edge (no sourceHandle or first edge)
                          const edge = edges.find((e: any) => e.source === currentNode.id && !e.sourceHandle) ||
                                       edges.find((e: any) => e.source === currentNode.id);
                          nextNodeId = edge?.target || null;
                        }

                        if (nextNodeId) {
                          const nextNode = nodes.find((n: any) => n.id === nextNodeId);

                          if (nextNode) {
                            // Get session server URL for sending
                            const { data: sessionData } = await supabase
                              .from('whatsapp_sessions')
                              .select('baileys_server_url, instance_name')
                              .eq('id', targetSessionId)
                              .single();

                            const serverUrl = sessionData?.baileys_server_url;
                            const instanceName2 = sessionData?.instance_name;

                            if (nextNode.type === 'action') {
                              // ===== HANDLE ACTION NODES =====
                              const actionSubType = nextNode.subType || nextNode.data?.config?.actionType || '';
                              console.log(`🤖🔄 [CHATBOT] Processing action node: ${actionSubType}`);

                              if (actionSubType === 'transfer_ai_agent') {
                                const agentId = nextNode.data?.config?.agentId;
                                const aiEntryBehavior = nextNode.data?.config?.aiEntryBehavior || 'send_welcome';
                                console.log(`🤖🔄 [CHATBOT] Transferring to AI agent: ${agentId}, behavior: ${aiEntryBehavior}`);

                                if (agentId) {
                                  // Enable AI auto-reply on the conversation
                                  await supabase
                                    .from('whatsapp_conversations')
                                    .update({
                                      assigned_agent_id: agentId,
                                      ai_auto_reply_enabled: true,
                                    })
                                    .eq('id', conversation.id);

                                  // Send system message indicating AI took over
                                  await supabase.from('whatsapp_messages').insert({
                                    company_id: companyId,
                                    session_id: targetSessionId,
                                    conversation_id: conversation.id,
                                    content: '🤖 Agente de IA entrou na conversa.',
                                    from_me: true,
                                    status: 'sent',
                                    message_type: 'system',
                                    sender_name: 'Sistema',
                                  });

                                  // Complete ALL running chatbot executions for this conversation (not just current)
                                  await supabase
                                    .from('chatbot_executions')
                                    .update({
                                      status: 'completed',
                                      completed_at: new Date().toISOString(),
                                    })
                                    .eq('conversation_id', conversation.id)
                                    .eq('status', 'running');

                                  // If behavior is send_welcome, trigger AI to send first message
                                  if (aiEntryBehavior === 'send_welcome') {
                                    console.log(`🤖🔄 [CHATBOT] AI will send welcome message`);
                                    // Fetch agent to get greeting
                                    const { data: aiAgent } = await supabase
                                      .from('ai_agents')
                                      .select('id, name, personality, instructions, is_active, settings')
                                      .eq('id', agentId)
                                      .maybeSingle();

                                    if (aiAgent) {
                                      if (aiAgent.is_active === false) {
                                        console.log(`🤖🔄 [CHATBOT] Agent ${agentId} was inactive but is assigned by this flow; reactivating to avoid silent handoff failure`);
                                        await supabase
                                          .from('ai_agents')
                                          .update({ is_active: true })
                                          .eq('id', agentId);
                                        aiAgent.is_active = true;
                                      }

                                      const agentSettings = (aiAgent.settings as Record<string, unknown>) || {};
                                      const isPlatformAgent = !!(agentSettings.is_platform_agent);
                                      const agentHumor = (agentSettings.humor as string) ?? 'profissional';
                                      let welcomeMsg = '';

                                      // Re-resolve session server URL/instance in case the upstream variables were lost
                                      let sendServerUrl = serverUrl;
                                      let sendInstanceName = instanceName2;
                                      if (!sendServerUrl || !sendInstanceName) {
                                        const { data: sessRefetch } = await supabase
                                          .from('whatsapp_sessions')
                                          .select('baileys_server_url, instance_name')
                                          .eq('id', targetSessionId)
                                          .single();
                                        sendServerUrl = sessRefetch?.baileys_server_url || sendServerUrl;
                                        sendInstanceName = sessRefetch?.instance_name || sendInstanceName;
                                      }

                                      try {
                                        if (isPlatformAgent) {
                                          // Platform agent (Ellosuit Support): route welcome through ellosuit-whatsapp-agent
                                          console.log('🤖🔄 [CHATBOT] Platform agent welcome via ellosuit-whatsapp-agent');
                                          const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
                                          const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

                                          // Pick up authentication context from latest chatbot execution
                                          const { data: recentExec } = await supabase
                                            .from('chatbot_executions')
                                            .select('variables')
                                            .eq('conversation_id', conversation.id)
                                            .order('started_at', { ascending: false })
                                            .limit(1)
                                            .single();
                                          const execVars = (recentExec?.variables as Record<string, string>) || {};
                                          const authedUserId = execVars.authenticated_user_id || '';
                                          const authedCompanyId = execVars.authenticated_company_id || companyId;

                                          const welcomeResp = await fetch(`${SUPABASE_URL}/functions/v1/ellosuit-whatsapp-agent`, {
                                            method: 'POST',
                                            headers: {
                                              'Content-Type': 'application/json',
                                              'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
                                            },
                                            body: JSON.stringify({
                                              messages: [
                                                { role: 'user', content: '__welcome__' },
                                              ],
                                              userId: authedUserId,
                                              companyId: authedCompanyId,
                                              contactPhone: phoneNumber,
                                              agentInstructions: aiAgent.instructions || '',
                                              agentPersonality: aiAgent.personality || '',
                                              agentSettings,
                                              isWelcome: true,
                                            }),
                                          });

                                          if (welcomeResp.ok) {
                                            const data = await welcomeResp.json();
                                            welcomeMsg = (data.response || '').trim();
                                            console.log(`🤖🔄 [CHATBOT] Platform welcome length=${welcomeMsg.length}`);
                                          } else {
                                            console.error('🤖🔄 [CHATBOT] Platform welcome HTTP error:', welcomeResp.status, await welcomeResp.text());
                                          }
                                        } else {
                                          // Standard agent → use Lovable AI Gateway directly
                                          const welcomePrompt = `Personalidade: ${aiAgent.personality || 'profissional e atencioso'}\nTom: ${agentHumor}\n\n${aiAgent.instructions || ''}\n\nVocê acabou de entrar na conversa com o cliente. Envie uma saudação breve e natural (1-2 frases). Não faça perguntas complexas, apenas cumprimente.`;
                                          const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
                                          if (LOVABLE_API_KEY) {
                                            const aiResp = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
                                              method: 'POST',
                                              headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, 'Content-Type': 'application/json' },
                                              body: JSON.stringify({
                                                model: (agentSettings.model as string) || 'google/gemini-3-flash-preview',
                                                messages: [
                                                  { role: 'system', content: welcomePrompt },
                                                  { role: 'user', content: 'O cliente foi transferido do chatbot para você. Envie sua saudação.' },
                                                ],
                                              }),
                                            });
                                            if (aiResp.ok) {
                                              const aiData = await aiResp.json();
                                              welcomeMsg = (aiData.choices?.[0]?.message?.content || '').trim();
                                              console.log(`🤖🔄 [CHATBOT] Gateway welcome length=${welcomeMsg.length}`);
                                            } else {
                                              console.error('🤖🔄 [CHATBOT] AI Gateway welcome HTTP error:', aiResp.status, await aiResp.text());
                                            }
                                          } else {
                                            console.error('🤖🔄 [CHATBOT] LOVABLE_API_KEY missing');
                                          }
                                        }

                                        // Fallback if AI produced nothing
                                        if (!welcomeMsg) {
                                          welcomeMsg = `Olá! 👋 Sou ${aiAgent.name || 'o assistente'} e vou continuar te atendendo a partir daqui. Como posso te ajudar?`;
                                          console.log('🤖🔄 [CHATBOT] Using fallback welcome message');
                                        }

                                        // Clean markdown
                                        welcomeMsg = welcomeMsg
                                          .replace(/\*\*(.*?)\*\*/g, '$1')
                                          .replace(/\*(.*?)\*/g, '$1')
                                          .replace(/`{1,3}(.*?)`{1,3}/gs, '$1')
                                          .replace(/\[HANDOFF\]/g, '')
                                          .replace(/\[STAGE:\w+\]/g, '')
                                          .trim();

                                        if (sendServerUrl && welcomeMsg) {
                                          const jid = remoteJid.includes('@') ? remoteJid : `${remoteJid}@s.whatsapp.net`;
                                          const sendRes = await chatbotFetch(supabase, conversation.id, activeExec.id, `${sendServerUrl}/api/message/send`, {
                                            method: 'POST',
                                            headers: { 'Content-Type': 'application/json' },
                                            body: JSON.stringify({ instanceName: sendInstanceName, jid, message: { text: welcomeMsg } }),
                                          });
                                          console.log(`🤖🔄 [CHATBOT] Welcome send status: ${sendRes.status}`);
                                          if (sendRes.ok) {
                                            await supabase.from('whatsapp_messages').insert({
                                              company_id: companyId,
                                              session_id: targetSessionId,
                                              conversation_id: conversation.id,
                                              content: welcomeMsg,
                                              from_me: true,
                                              status: 'sent',
                                              message_type: 'text',
                                              sender_name: aiAgent.name,
                                              is_ai_response: true,
                                            });
                                          } else {
                                            console.error('🤖🔄 [CHATBOT] Welcome send failed body:', await sendRes.text());
                                          }
                                        } else {
                                          console.error(`🤖🔄 [CHATBOT] Cannot send welcome - serverUrl=${sendServerUrl ? 'YES' : 'NO'}, msg=${welcomeMsg ? 'YES' : 'NO'}`);
                                        }
                                      } catch (aiErr) {
                                        console.error('🤖🔄 [CHATBOT] AI welcome error:', aiErr);
                                      }
                                    }
                                  }

                                  chatbotHandled = true;
                                  console.log(`🤖🔄 [CHATBOT] Transfer to AI completed`);
                                }
                              } else if (actionSubType === 'transfer_human') {
                                // Verifica se o Piloto Automático está ativo pra esta empresa.
                                // Se sim: NÃO marca human_takeover — encerra o chatbot e delega ao piloto.
                                const { data: autopilotCfg } = await supabase
                                  .from('crm_autopilot_configs')
                                  .select('is_active')
                                  .eq('company_id', companyId)
                                  .maybeSingle();
                                const autopilotOn = !!autopilotCfg?.is_active;
                                console.log(`🤖🔄 [CHATBOT] transfer_human — autopilotOn=${autopilotOn}`);

                                const execPath = Array.isArray(activeExec.execution_path) ? activeExec.execution_path : [];
                                const prevVars = (activeExec.variables as Record<string, unknown>) || {};

                                if (autopilotOn) {
                                  // Transfere para o PILOTO: encerra o chatbot sem tocar em human_takeover
                                  await supabase
                                    .from('chatbot_executions')
                                    .update({
                                      current_node_id: nextNodeId,
                                      execution_path: [...execPath, nextNodeId],
                                      status: 'stopped',
                                      variables: { ...prevVars, handoff: 'autopilot' },
                                      completed_at: new Date().toISOString(),
                                    })
                                    .eq('id', activeExec.id);

                                  // Dispara o piloto imediatamente sem travar o webhook.
                                  try {
                                    const work = fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/crm-autopilot-respond`, {
                                      method: 'POST',
                                      headers: {
                                        'Content-Type': 'application/json',
                                        Authorization: `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
                                      },
                                      body: JSON.stringify({ conversationId: conversation.id, force: true }),
                                    }).catch((e) => console.warn('[CHATBOT] Falha ao acionar piloto:', e));
                                    const runtime = globalThis as unknown as { EdgeRuntime?: { waitUntil?: (promise: Promise<unknown>) => void } };
                                    if (runtime.EdgeRuntime?.waitUntil) runtime.EdgeRuntime.waitUntil(work);
                                  } catch (e) {
                                    console.warn('[CHATBOT] Falha ao acionar piloto:', e);
                                  }
                                } else {
                                  // Comportamento clássico: transferir para humano
                                  await supabase
                                    .from('whatsapp_conversations')
                                    .update({ assigned_agent_id: null, ai_auto_reply_enabled: false })
                                    .eq('id', conversation.id);

                                  await sleepDelay();
                                  await supabase.from('whatsapp_messages').insert({
                                    company_id: companyId,
                                    session_id: targetSessionId,
                                    conversation_id: conversation.id,
                                    content: 'Conversa transferida para atendimento humano.',
                                    from_me: true,
                                    status: 'sent',
                                    message_type: 'system',
                                    sender_name: 'Sistema',
                                  });

                                  await supabase
                                    .from('chatbot_executions')
                                    .update({
                                      current_node_id: nextNodeId,
                                      execution_path: [...execPath, nextNodeId],
                                      status: 'stopped',
                                      variables: { ...prevVars, handoff: true },
                                      completed_at: new Date().toISOString(),
                                    })
                                    .eq('id', activeExec.id);
                                }

                                chatbotHandled = true;
                              // ===== LOOKUP ACCOUNT ACTION =====
                              } else if (actionSubType === 'lookup_account') {
                                console.log(`🤖🔄 [CHATBOT] Lookup account action`);
                                // The user's last message should contain their email
                                const emailInput = (content || '').trim().toLowerCase();
                                const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
                                const emailMatch = emailInput.match(emailRegex);
                                
                                const execPath = Array.isArray(activeExec.execution_path) ? activeExec.execution_path : [];
                                const vars = (activeExec.variables as Record<string, unknown>) || {};
                                
                                if (emailMatch) {
                                  const email = emailMatch[0];
                                  console.log(`🤖🔄 [CHATBOT] Looking up account for: ${email}`);
                                  
                                  // Search for user by email using service role
                                  const { data: authUsers } = await supabase.auth.admin.listUsers({ perPage: 1000 });
                                  const foundUser = authUsers?.users?.find((u: any) => u.email?.toLowerCase() === email);
                                  
                                  if (foundUser) {
                                    // Get company info
                                    const { data: compUser } = await supabase
                                      .from('company_users')
                                      .select('company_id, role')
                                      .eq('user_id', foundUser.id)
                                      .limit(1)
                                      .single();
                                    
                                    if (compUser) {
                                      const { data: comp } = await supabase
                                        .from('companies')
                                        .select('name')
                                        .eq('id', compUser.company_id)
                                        .single();
                                      
                                      const userName = foundUser.user_metadata?.username || foundUser.email?.split('@')[0] || 'Usuário';
                                      const companyName = comp?.name || 'N/A';
                                      
                                      // Store in execution variables
                                      await supabase.from('chatbot_executions').update({
                                        current_node_id: nextNodeId,
                                        execution_path: [...execPath, nextNodeId],
                                        variables: {
                                          ...vars,
                                          email,
                                          authenticated_user_id: foundUser.id,
                                          authenticated_company_id: compUser.company_id,
                                          authenticated_user_name: userName,
                                          authenticated_company_name: companyName,
                                          account_found: 'true',
                                        },
                                      }).eq('id', activeExec.id);
                                      
                                      console.log(`🤖🔄 [CHATBOT] Account found: ${userName} (${companyName})`);
                                    } else {
                                      await supabase.from('chatbot_executions').update({
                                        current_node_id: nextNodeId,
                                        execution_path: [...execPath, nextNodeId],
                                        variables: { ...vars, email, account_found: 'false' },
                                      }).eq('id', activeExec.id);
                                    }
                                  } else {
                                    await supabase.from('chatbot_executions').update({
                                      current_node_id: nextNodeId,
                                      execution_path: [...execPath, nextNodeId],
                                      variables: { ...vars, email, account_found: 'false' },
                                    }).eq('id', activeExec.id);
                                  }
                                } else {
                                  // Not an email - store as not found
                                  await supabase.from('chatbot_executions').update({
                                    current_node_id: nextNodeId,
                                    execution_path: [...execPath, nextNodeId],
                                    variables: { ...vars, account_found: 'false' },
                                  }).eq('id', activeExec.id);
                                }
                                
                                // Now follow the edge from this action node to the next node (condition checking account_found)
                                const afterActionEdge = edges.find((e: any) => e.source === nextNodeId);
                                if (afterActionEdge) {
                                  const afterNode = nodes.find((n: any) => n.id === afterActionEdge.target);
                                  if (afterNode && afterNode.type === 'condition') {
                                    // Re-read updated variables
                                    const { data: updatedExec } = await supabase
                                      .from('chatbot_executions')
                                      .select('variables')
                                      .eq('id', activeExec.id)
                                      .single();
                                    const updVars = (updatedExec?.variables as Record<string, string>) || {};
                                    const checkVar = afterNode.data?.config?.variable || 'account_found';
                                    const checkValue = afterNode.data?.config?.value || 'true';
                                    const varValue = updVars[checkVar] || '';
                                    
                                    // Find correct edge based on condition result
                                    const condResult = varValue === checkValue;
                                    const condEdge = edges.find((e: any) => 
                                      e.source === afterNode.id && e.sourceHandle === (condResult ? 'true' : 'false')
                                    ) || edges.find((e: any) => 
                                      e.source === afterNode.id && e.sourceHandle === (condResult ? 'yes' : 'no')
                                    );
                                    
                                    if (condEdge) {
                                      const responseNode = nodes.find((n: any) => n.id === condEdge.target);
                                      if (responseNode && responseNode.type === 'message' && serverUrl) {
                                        let rMsg = responseNode.data?.config?.message || responseNode.data?.config?.content || '';
                                        rMsg = rMsg.replace(/\{\{(\w+)\}\}/g, (_: string, key: string) => updVars[key] || `{{${key}}}`);
                                        
                                        const rButtons: string[] = responseNode.data?.config?.buttons || [];
                                        if (rButtons.length > 0) {
                                          rMsg += '\n\n' + rButtons.map((b: string, i: number) => `${i + 1}. ${b}`).join('\n');
                                        }
                                        
                                        const jid = remoteJid.includes('@') ? remoteJid : `${remoteJid}@s.whatsapp.net`;
                                        await sleepDelay();
                                        const sendRes = await chatbotFetch(supabase, conversation.id, activeExec.id, `${serverUrl}/api/message/send`, {
                                          method: 'POST',
                                          headers: { 'Content-Type': 'application/json' },
                                          body: JSON.stringify({ instanceName: instanceName2, jid, message: { text: rMsg } }),
                                        });
                                        
                                        if (sendRes.ok) {
                                          await supabase.from('whatsapp_messages').insert({
                                            company_id: companyId, session_id: targetSessionId,
                                            conversation_id: conversation.id, content: rMsg,
                                            from_me: true, status: 'sent', message_type: 'text', sender_name: 'Chatbot',
                                          });
                                          
                                          const updPath = [...execPath, nextNodeId, afterNode.id, responseNode.id];
                                          const hasMore = edges.some((e: any) => e.source === responseNode.id);
                                          await supabase.from('chatbot_executions').update({
                                            current_node_id: responseNode.id,
                                            execution_path: updPath,
                                            ...(hasMore ? {} : { status: 'completed', completed_at: new Date().toISOString() }),
                                          }).eq('id', activeExec.id);
                                        }
                                      } else if (responseNode && responseNode.type === 'action') {
                                        // The condition leads to another action (e.g., transfer_ai_agent)
                                        // Update execution to point to this action node so next message triggers it
                                        const updPath2 = [...execPath, nextNodeId, afterNode.id, responseNode.id];
                                        await supabase.from('chatbot_executions').update({
                                          current_node_id: afterNode.id,
                                          execution_path: updPath2,
                                        }).eq('id', activeExec.id);
                                        
                                        // If it's transfer_ai_agent, execute it immediately
                                        const actionSub = responseNode.subType || responseNode.data?.config?.actionType || '';
                                        if (actionSub === 'transfer_ai_agent') {
                                          const agentIdLookup = responseNode.data?.config?.agentId;
                                          if (agentIdLookup) {
                                            await supabase.from('whatsapp_conversations').update({
                                              assigned_agent_id: agentIdLookup,
                                              ai_auto_reply_enabled: true,
                                            }).eq('id', conversation.id);
                                            
                                            await supabase.from('whatsapp_messages').insert({
                                              company_id: companyId, session_id: targetSessionId,
                                              conversation_id: conversation.id,
                                              content: '🤖 Agente de IA entrou na conversa.',
                                              from_me: true, status: 'sent', message_type: 'system', sender_name: 'Sistema',
                                            });
                                            
                                            await supabase.from('chatbot_executions').update({
                                              status: 'completed', completed_at: new Date().toISOString(),
                                            }).eq('conversation_id', conversation.id).eq('status', 'running');
                                          }
                                        }
                                      }
                                    }
                                  }
                                }
                                
                                chatbotHandled = true;
                              // ===== INLINE AI AGENT ACTION =====
                              } else if (actionSubType === 'ai_agent_inline') {
                                const cfg = nextNode.data?.config || {};
                                const userPrompt: string = cfg.systemPrompt || cfg.instructions || '';
                                const HUMANIZED_BASE = [
                                  'Você é um atendente humano e simpático, conversando pelo WhatsApp em português brasileiro.',
                                  'Regras IMPORTANTES (siga sempre):',
                                  '- Responda de forma curta, natural, calorosa, como uma pessoa real. Use no máximo 2-3 frases por mensagem.',
                                  '- Se for a primeira interação do dia ou o cliente acabou de chegar, cumprimente (ex.: "Oi! Tudo bem?") antes de continuar.',
                                  '- NUNCA encerre, desligue, transfira ou diga que vai sair da conversa por conta própria. Continue atendendo até o cliente pedir algo específico.',
                                  '- NÃO use as tags [HANDOFF], [STAGE:...], colchetes ou markdown. Apenas texto puro, como em uma conversa de WhatsApp.',
                                  '- Se não souber alguma informação, peça mais detalhes ou diga que vai verificar — nunca abandone a conversa.',
                                  '- Use o histórico abaixo para manter contexto e não repetir perguntas já respondidas.',
                                ].join('\n');
                                const systemPrompt = userPrompt
                                  ? `${HUMANIZED_BASE}\n\n--- Instruções específicas deste atendimento ---\n${userPrompt}`
                                  : HUMANIZED_BASE;
                                // Conhecimento extra do agente: texto livre + arquivos (txt/json/csv/pdf-extraído)
                                const extraKnowledge: string = (cfg.knowledgeText || cfg.extraKnowledge || '').toString();
                                const knowledgeFiles: any[] = Array.isArray(cfg.knowledgeFiles) ? cfg.knowledgeFiles : [];
                                let knowledgeBlock = '';
                                if (extraKnowledge.trim()) {
                                  knowledgeBlock += `\n\n--- Base de conhecimento (texto) ---\n${extraKnowledge.slice(0, 8000)}`;
                                }
                                if (knowledgeFiles.length > 0) {
                                  // Inclui apenas os preview textuais salvos no builder; URLs viram referência.
                                  const filesText = knowledgeFiles
                                    .map((f: any, i: number) => {
                                      const t = (f?.textPreview || f?.content || '').toString();
                                      const head = `• ${f?.name || `arquivo_${i + 1}`}`;
                                      return t ? `${head}\n${t.slice(0, 4000)}` : `${head} (${f?.url || 'sem texto extraído'})`;
                                    })
                                    .join('\n\n');
                                  knowledgeBlock += `\n\n--- Arquivos de referência ---\n${filesText}`;
                                }
                                const finalSystemPrompt = knowledgeBlock ? systemPrompt + knowledgeBlock : systemPrompt;
                                const model: string = cfg.model || 'google/gemini-2.5-flash';
                                const saveAs: string = cfg.saveAs || 'ai_response';
                                const sendReply: boolean = cfg.sendReply !== false;
                                const fallback: string = cfg.fallbackMessage || 'Desculpe, não consegui processar agora.';
                                const userText = (content || '').toString();

                                console.log(`🧠 [CHATBOT][ai_agent_inline] running model=${model}, userText="${userText.slice(0, 80)}"`);

                                // Carrega histórico recente da conversa para o agente lembrar do contexto
                                const { data: historyRows } = await supabase
                                  .from('whatsapp_messages')
                                  .select('content, from_me, message_type, created_at')
                                  .eq('conversation_id', conversation.id)
                                  .order('created_at', { ascending: false })
                                  .limit(20);
                                const history = (historyRows || [])
                                  .reverse()
                                  .filter((m: any) => m?.content && m.message_type !== 'system')
                                  .map((m: any) => ({
                                    role: m.from_me ? ('assistant' as const) : ('user' as const),
                                    content: String(m.content).slice(0, 1000),
                                  }));

                                let aiText = fallback;
                                try {
                                  const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
                                  if (LOVABLE_API_KEY) {
                                    const aiRes = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
                                      method: 'POST',
                                      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${LOVABLE_API_KEY}` },
                                      body: JSON.stringify({
                                        model,
                                        messages: [
                                          { role: 'system', content: finalSystemPrompt },
                                          ...history,
                                          ...(userText && (history.length === 0 || history[history.length - 1].content !== userText)
                                            ? [{ role: 'user' as const, content: userText }]
                                            : []),
                                          ...(history.length === 0 && !userText
                                            ? [{ role: 'user' as const, content: 'Cumprimente o cliente de forma calorosa e pergunte como pode ajudar hoje.' }]
                                            : []),
                                        ],
                                      }),
                                    });
                                    if (aiRes.ok) {
                                      const j = await aiRes.json();
                                      aiText = j?.choices?.[0]?.message?.content?.toString() || fallback;
                                    } else {
                                      console.error('🧠 [ai_agent_inline] gateway error', aiRes.status, await aiRes.text());
                                    }
                                  } else {
                                    console.warn('🧠 [ai_agent_inline] LOVABLE_API_KEY missing');
                                  }
                                } catch (aiErr) {
                                  console.error('🧠 [ai_agent_inline] exception', aiErr);
                                }

                                // Limpa tags internas que jamais devem chegar ao cliente
                                aiText = aiText
                                  .replace(/\[HANDOFF\]/gi, '')
                                  .replace(/\[STAGE:[^\]]*\]/gi, '')
                                  .replace(/```[\s\S]*?```/g, (m) => m.replace(/```/g, ''))
                                  .trim();
                                if (!aiText) aiText = fallback;

                                const execPath2 = Array.isArray(activeExec.execution_path) ? activeExec.execution_path : [];
                                const vars2 = (activeExec.variables as Record<string, unknown>) || {};
                                await supabase.from('chatbot_executions').update({
                                  current_node_id: nextNodeId,
                                  execution_path: [...execPath2, nextNodeId],
                                  variables: { ...vars2, [saveAs]: aiText },
                                }).eq('id', activeExec.id);

                                if (sendReply && serverUrl) {
                                  const jid = remoteJid.includes('@') ? remoteJid : `${remoteJid}@s.whatsapp.net`;
                                  try {
                                    await sleepDelay();
                                    await chatbotFetch(supabase, conversation.id, activeExec.id, `${serverUrl}/api/message/send`, {
                                      method: 'POST',
                                      headers: { 'Content-Type': 'application/json' },
                                      body: JSON.stringify({ instanceName: instanceName2, jid, message: { text: aiText } }),
                                    });
                                    await supabase.from('whatsapp_messages').insert({
                                      company_id: companyId,
                                      session_id: targetSessionId,
                                      conversation_id: conversation.id,
                                      content: aiText,
                                      from_me: true,
                                      status: 'sent',
                                      message_type: 'text',
                                      sender_name: 'Agente IA',
                                    });
                                  } catch (sendErr) {
                                    console.error('🧠 [ai_agent_inline] send failed', sendErr);
                                  }
                                }
                                chatbotHandled = true;
                              // ===== SET VARIABLE ACTION =====
                              } else if (actionSubType === 'set_variable') {
                                const varName = nextNode.data?.config?.variableName || '';
                                const varValue = nextNode.data?.config?.variableValue || content || '';
                                console.log(`🤖🔄 [CHATBOT] Set variable: ${varName} = ${varValue}`);
                                
                                const execPath = Array.isArray(activeExec.execution_path) ? activeExec.execution_path : [];
                                const vars = (activeExec.variables as Record<string, unknown>) || {};
                                
                                await supabase.from('chatbot_executions').update({
                                  current_node_id: nextNodeId,
                                  execution_path: [...execPath, nextNodeId],
                                  variables: { ...vars, [varName]: varValue },
                                }).eq('id', activeExec.id);
                                
                                // Auto-follow to next node
                                const nextEdge = edges.find((e: any) => e.source === nextNodeId);
                                if (nextEdge) {
                                  // Will be processed on next message
                                }
                                chatbotHandled = true;
                              // ===== SEND WHATSAPP TO ANOTHER NUMBER =====
                              } else if (actionSubType === 'send_whatsapp') {
                                try {
                                  const cfg = nextNode.data?.config || {};
                                  const vars = (activeExec.variables as Record<string, string>) || {};
                                  const interp = (s: string) => (s || '').replace(/\{\{(\w+)\}\}/g, (_: string, k: string) => (vars as any)[k] ?? `{{${k}}}`);
                                  const rawPhone = interp(String(cfg.phone || cfg.to || '')).replace(/\D/g, '');
                                  const msg = interp(String(cfg.message || cfg.content || ''));
                                  console.log(`🤖🔄 [CHATBOT] send_whatsapp -> ${rawPhone} | "${msg.slice(0,60)}"`);
                                  if (rawPhone && msg && serverUrl) {
                                    const { data: sess2 } = await supabase
                                      .from('whatsapp_sessions')
                                      .select('baileys_server_url, instance_name')
                                      .eq('id', targetSessionId)
                                      .single();
                                    if (sess2?.baileys_server_url) {
                                      const targetJid = `${rawPhone}@s.whatsapp.net`;
                                      await chatbotFetch(supabase, conversation.id, activeExec.id, `${sess2.baileys_server_url}/api/message/send`, {
                                        method: 'POST',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({ instanceName: sess2.instance_name, jid: targetJid, message: msg }),
                                      });
                                    }
                                  }
                                } catch (notifyErr) {
                                  console.error('🤖🔄 [CHATBOT] send_whatsapp error:', notifyErr);
                                }
                                const execPath = Array.isArray(activeExec.execution_path) ? activeExec.execution_path : [];
                                await supabase.from('chatbot_executions').update({
                                  current_node_id: nextNodeId,
                                  execution_path: [...execPath, nextNodeId],
                                }).eq('id', activeExec.id);
                                chatbotHandled = true;
                              // ===== SEND EMAIL =====
                              } else if (actionSubType === 'send_email') {
                                try {
                                  const cfg = nextNode.data?.config || {};
                                  const vars = (activeExec.variables as Record<string, string>) || {};
                                  const interp = (s: string) => (s || '').replace(/\{\{(\w+)\}\}/g, (_: string, k: string) => (vars as any)[k] ?? `{{${k}}}`);
                                  const to = interp(String(cfg.to || cfg.email || '')).trim();
                                  const subject = interp(String(cfg.subject || 'Notificação do chatbot'));
                                  const bodyText = interp(String(cfg.body || cfg.message || cfg.content || ''));
                                  const fromName = String(cfg.fromName || 'Chatbot');
                                  console.log(`🤖🔄 [CHATBOT] send_email -> ${to} | "${subject}"`);
                                  if (to && /.+@.+\..+/.test(to)) {
                                    const htmlBody = `<div style="font-family:Arial,sans-serif;font-size:14px;color:#111;white-space:pre-wrap;">${bodyText.replace(/&/g,'&amp;').replace(/</g,'&lt;')}</div>`;
                                    await supabase.functions.invoke('send-email', {
                                      body: {
                                        recipient_email: to,
                                        subject,
                                        content_html: htmlBody,
                                        content_text: bodyText,
                                        from_name: fromName,
                                        provider: 'resend',
                                      },
                                    });
                                  }
                                } catch (emailErr) {
                                  console.error('🤖🔄 [CHATBOT] send_email error:', emailErr);
                                }
                                const execPath = Array.isArray(activeExec.execution_path) ? activeExec.execution_path : [];
                                await supabase.from('chatbot_executions').update({
                                  current_node_id: nextNodeId,
                                  execution_path: [...execPath, nextNodeId],
                                }).eq('id', activeExec.id);
                                chatbotHandled = true;
                              // ===== CALL EXTERNAL API =====
                              } else if (actionSubType === 'call_api') {
                                try {
                                  const cfg = nextNode.data?.config || {};
                                  const vars = (activeExec.variables as Record<string, any>) || {};
                                  const interp = (s: string) => (s || '').replace(/\{\{([\w.]+)\}\}/g, (_: string, k: string) => {
                                    const path = k.split('.');
                                    let v: any = vars;
                                    for (const p of path) v = v?.[p];
                                    return v === undefined || v === null ? `{{${k}}}` : String(v);
                                  });
                                  const url = interp(String(cfg.url || ''));
                                  const method = String(cfg.method || 'POST').toUpperCase();
                                  let headers: Record<string, string> = { 'Content-Type': 'application/json' };
                                  try {
                                    const raw = typeof cfg.headers === 'string' ? cfg.headers : JSON.stringify(cfg.headers || {});
                                    const parsed = JSON.parse(interp(raw || '{}'));
                                    if (parsed && typeof parsed === 'object') headers = { ...headers, ...parsed };
                                  } catch (_) { /* ignore */ }
                                  let body: string | undefined;
                                  if (method !== 'GET' && method !== 'DELETE') {
                                    const raw = typeof cfg.bodyJson === 'string' ? cfg.bodyJson : JSON.stringify(cfg.bodyJson || cfg.body || {});
                                    body = interp(raw || '{}');
                                  }
                                  console.log(`🌐 [call_api] ${method} ${url}`);
                                  const timeoutMs = Math.min(Math.max(parseInt(String(cfg.timeoutMs || 15000), 10) || 15000, 1000), 30000);
                                  const ctrl = new AbortController();
                                  const to = setTimeout(() => ctrl.abort(), timeoutMs);
                                  let respJson: any = null;
                                  let respStatus = 0;
                                  try {
                                    const r = await fetch(url, { method, headers, body, signal: ctrl.signal });
                                    respStatus = r.status;
                                    const txt = await r.text();
                                    try { respJson = JSON.parse(txt); } catch { respJson = txt; }
                                  } catch (e) {
                                    console.error('🌐 [call_api] error', e);
                                    respJson = { error: String((e as any)?.message || e) };
                                  } finally {
                                    clearTimeout(to);
                                  }
                                  const saveAs = String(cfg.saveAs || 'api_response');
                                  const newVars: Record<string, any> = { ...vars, [saveAs]: respJson, [`${saveAs}_status`]: respStatus };
                                  // Mapeamento opcional: { "nome": "data.user.name" }
                                  const mapping = cfg.responseMap && typeof cfg.responseMap === 'object' ? cfg.responseMap : null;
                                  if (mapping) {
                                    for (const [k, pathExpr] of Object.entries(mapping)) {
                                      try {
                                        const parts = String(pathExpr).split('.');
                                        let cur: any = respJson;
                                        for (const p of parts) cur = cur?.[p];
                                        newVars[k] = cur;
                                      } catch { /* skip */ }
                                    }
                                  }
                                  const execPath = Array.isArray(activeExec.execution_path) ? activeExec.execution_path : [];
                                  await supabase.from('chatbot_executions').update({
                                    current_node_id: nextNodeId,
                                    execution_path: [...execPath, nextNodeId],
                                    variables: newVars,
                                  }).eq('id', activeExec.id);
                                  activeExec.variables = newVars;
                                } catch (apiErr) {
                                  console.error('🌐 [call_api] fatal', apiErr);
                                }
                                chatbotHandled = true;
                              }
                            } else if (serverUrl && nextNode.type === 'message') {
                              const vars = (activeExec.variables as Record<string, string>) || {};
                              let msgContent = nextNode.data?.config?.message || nextNode.data?.config?.content || '';
                              // Replace variables
                              msgContent = msgContent.replace(/\{\{(\w+)\}\}/g, (_: string, key: string) => vars[key] || `{{${key}}}`);

                              const nextButtons: string[] = nextNode.data?.config?.buttons || [];
                              // If it has buttons, append numbered list
                              if (nextButtons.length > 0) {
                                msgContent += '\n\n' + nextButtons.map((b: string, i: number) => `${i + 1}. ${b}`).join('\n');
                              }

                              // Check for image
                              const imageUrl = nextNode.data?.config?.imageUrl || nextNode.data?.config?.url || '';
                              console.log(`🤖🔄 [CHATBOT] Next node subType=${nextNode.subType}, imageUrl=${imageUrl ? 'YES' : 'NO'}`);

                              // Use remoteJid (already resolved from remoteJidAlt) instead of phoneNumber (which may be a LID)
                              const jid = remoteJid.includes('@') ? remoteJid : `${remoteJid}@s.whatsapp.net`;
                              console.log(`🤖🔄 [CHATBOT] Using JID for next node send: ${jid}`);

                              try {
                                let sendSuccess = false;

                                const mediaKind = nextNode.subType === 'audio' ? 'audio'
                                  : nextNode.subType === 'video' ? 'video'
                                  : nextNode.subType === 'file' ? 'document'
                                  : nextNode.subType === 'image' ? 'image'
                                  : (imageUrl ? 'image' : '');
                                if (imageUrl && mediaKind) {
                                  console.log(`🤖🔄 [CHATBOT] Sending media (${mediaKind}): url=${imageUrl.substring(0, 100)}`);
                                  try {
                                    await sleepDelay();
                                    const mediaBody: any = {
                                      instanceName: instanceName2,
                                      jid,
                                      mediaUrl: imageUrl,
                                      mediaType: mediaKind,
                                    };
                                    if (mediaKind === 'image' || mediaKind === 'video') mediaBody.caption = msgContent;
                                    if (mediaKind === 'audio') mediaBody.ptt = nextNode.data?.config?.ptt !== false;
                                    if (mediaKind === 'document') mediaBody.fileName = nextNode.data?.config?.filename || 'arquivo';
                                    const sendRes = await chatbotFetch(supabase, conversation.id, activeExec.id, `${serverUrl}/api/message/send-media`, {
                                      method: 'POST',
                                      headers: { 'Content-Type': 'application/json' },
                                      body: JSON.stringify(mediaBody),
                                    });
                                    console.log(`🤖🔄 [CHATBOT] send-media response: ${sendRes.status} ${sendRes.statusText}`);
                                    if (!sendRes.ok) {
                                      const errBody = await sendRes.text();
                                      console.error(`🤖🔄 [CHATBOT] send-media error: ${errBody}`);
                                      // Fallback: send as text only
                                      console.log(`🤖🔄 [CHATBOT] Falling back to text-only send`);
                                      const fallbackRes = await chatbotFetch(supabase, conversation.id, activeExec.id, `${serverUrl}/api/message/send`, {
                                        method: 'POST',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({ instanceName: instanceName2, jid, message: { text: (msgContent || '') + '\n\n🔗 ' + imageUrl } }),
                                      });
                                      sendSuccess = fallbackRes.ok;
                                    } else {
                                      sendSuccess = true;
                                    }
                                  } catch (imgErr) {
                                    console.error(`🤖🔄 [CHATBOT] send-media exception:`, imgErr);
                                    // Fallback: send as text only
                                    try {
                                      const fallbackRes = await chatbotFetch(supabase, conversation.id, activeExec.id, `${serverUrl}/api/message/send`, {
                                        method: 'POST',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({ instanceName: instanceName2, jid, message: { text: (msgContent || '') + '\n\n🔗 ' + imageUrl } }),
                                      });
                                      sendSuccess = fallbackRes.ok;
                                    } catch (e2) {
                                      console.error(`🤖🔄 [CHATBOT] Fallback text also failed:`, e2);
                                    }
                                  }
                                } else {
                                  // Send text
                                  await sleepDelay();
                                  const sendRes = await chatbotFetch(supabase, conversation.id, activeExec.id, `${serverUrl}/api/message/send`, {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ instanceName: instanceName2, jid, message: { text: msgContent } }),
                                  });
                                  sendSuccess = sendRes.ok;
                                }

                                if (sendSuccess) {
                                  console.log(`🤖🔄 [CHATBOT] Sent message for node ${nextNodeId}`);

                                  // Save the bot message
                                  await supabase.from('whatsapp_messages').insert({
                                    company_id: companyId,
                                    session_id: targetSessionId,
                                    conversation_id: conversation.id,
                                    content: msgContent,
                                    from_me: true,
                                    status: 'sent',
                                    message_type: imageUrl ? 'image' : 'text',
                                    media_url: imageUrl || null,
                                    sender_name: 'Chatbot',
                                  });

                                  // Update execution state
                                  const execPath = Array.isArray(activeExec.execution_path) ? activeExec.execution_path : [];
                                  const hasMoreEdges = edges.some((e: any) => e.source === nextNodeId);

                                  await supabase
                                    .from('chatbot_executions')
                                    .update({
                                      current_node_id: nextNodeId,
                                      execution_path: [...execPath, nextNodeId],
                                      ...(hasMoreEdges ? {} : { status: 'completed', completed_at: new Date().toISOString() }),
                                    })
                                    .eq('id', activeExec.id);

                                  chatbotHandled = true;
                                }
                              } catch (sendErr) {
                                console.error('🤖🔄 [CHATBOT] Send error:', sendErr);
                              }
                            }
                          }
                        } else {
                          // No next node - flow completed
                          console.log(`🤖🔄 [CHATBOT] Flow completed, no next node`);
                          await supabase
                            .from('chatbot_executions')
                            .update({ status: 'completed', completed_at: new Date().toISOString() })
                            .eq('id', activeExec.id);
                          chatbotHandled = true;
                        }
                      }
                    }
                  }
                } catch (chatbotErr) {
                  console.error('🤖🔄 [CHATBOT] Engine error:', chatbotErr);
                }
              }

              // ==================== AI AUTO-RESPONSE ====================
              // Check if conversation has an AI agent assigned and auto-reply is enabled
              if (!autopilotParentChannel && !asyncAiDispatched && !fromMe && conversation && !chatbotHandled && !orderDetected && !rsvpHandled && !rescheduleHandled && !humanHandoffByKeyword) {
                try {
                  console.log(`🤖 Checking AI auto-reply for conversation: ${conversation.id}`);
                  
                  // Fetch conversation with agent info
                  const { data: convWithAgent, error: convError } = await supabase
                    .from('whatsapp_conversations')
                    .select('id, assigned_agent_id, ai_auto_reply_enabled')
                    .eq('id', conversation.id)
                    .single();
                  
                  console.log(`🤖 Conv data: agent_id=${convWithAgent?.assigned_agent_id}, auto_reply=${convWithAgent?.ai_auto_reply_enabled}`);
                  
                  if (convWithAgent?.assigned_agent_id && convWithAgent?.ai_auto_reply_enabled) {
                    console.log('🤖 AI Auto-reply triggered for conversation:', conversation.id);
                    
                    // Fetch the AI agent's configuration. If this conversation already has an
                    // assigned agent with auto-reply on, keep the handoff alive even if the
                    // dashboard-level active flag was accidentally paused.
                    const { data: agent } = await supabase
                      .from('ai_agents')
                      .select('id, name, personality, instructions, is_active, settings')
                      .eq('id', convWithAgent.assigned_agent_id)
                      .maybeSingle();
                    
                    if (agent) {
                      if (agent.is_active === false) {
                        console.log(`🤖 Assigned agent ${agent.name} is inactive; reactivating because conversation auto-reply is enabled`);
                        await supabase
                          .from('ai_agents')
                          .update({ is_active: true })
                          .eq('id', agent.id);
                        agent.is_active = true;
                      }

                      console.log('🤖 Using AI agent:', agent.name);
                      
                      // Get agent settings
                      const agentSettings = (agent.settings as Record<string, unknown>) || {};
                      const agentTemperature = (agentSettings.temperature as number) ?? 0.7;
                      const agentMaxChars = (agentSettings.maxResponseChars as number) ?? 500;
                      const agentHumor = (agentSettings.humor as string) ?? 'profissional';
                      const MESSAGE_SEPARATOR = '|||';
                      
                      // Load agent media files
                      const { data: agentMedia } = await supabase
                        .from('ai_agent_media')
                        .select('id, file_url, file_name, file_type, description, context_keywords')
                        .eq('agent_id', agent.id)
                        .eq('is_active', true);
                      
                      const mediaList = agentMedia || [];
                      console.log(`🤖📸 Agent has ${mediaList.length} active media files`);
                      
                      // ============== PLATFORM AGENT: Route to ellosuit-whatsapp-agent ==============
                      const isPlatformAgent = !!(agentSettings.is_platform_agent);
                      if (isPlatformAgent) {
                        console.log('🤖🌐 [PLATFORM-AGENT] Detected platform agent, routing to ellosuit-whatsapp-agent');
                        
                        // Get authenticated user context from chatbot execution variables
                        let authenticatedUserId = '';
                        let authenticatedCompanyId = '';
                        
                        // Look for the most recent completed chatbot execution for this conversation
                        const { data: recentExec } = await supabase
                          .from('chatbot_executions')
                          .select('variables')
                          .eq('conversation_id', conversation.id)
                          .order('started_at', { ascending: false })
                          .limit(1)
                          .single();
                        
                        if (recentExec?.variables) {
                          const vars = recentExec.variables as Record<string, string>;
                          authenticatedUserId = vars.authenticated_user_id || '';
                          authenticatedCompanyId = vars.authenticated_company_id || '';
                          console.log(`🤖🌐 [PLATFORM-AGENT] Auth context: userId=${authenticatedUserId}, companyId=${authenticatedCompanyId}`);
                        }
                        
                        if (!authenticatedUserId || !authenticatedCompanyId) {
                          console.log('🤖🌐 [PLATFORM-AGENT] No auth context found, sending error message');
                          // Send message asking to re-authenticate
                          const { data: sessionData } = await supabase
                            .from('whatsapp_sessions')
                            .select('baileys_server_url, instance_name')
                            .eq('id', targetSessionId)
                            .single();
                          if (sessionData?.baileys_server_url) {
                            const jid = remoteJid.includes('@') ? remoteJid : `${phoneNumber}@s.whatsapp.net`;
                            await compatFetch(`${sessionData.baileys_server_url}/api/message/send`, {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({
                                instanceName: sessionData.instance_name,
                                jid,
                                message: { text: 'Sua sessão expirou. Por favor, envie "oi" para iniciar uma nova autenticação.' }
                              }),
                            });
                          }
                          // Disable AI and let chatbot re-trigger
                          await supabase
                            .from('whatsapp_conversations')
                            .update({ ai_auto_reply_enabled: false, assigned_agent_id: null })
                            .eq('id', conversation.id);
                          break;
                        }
                        
                        // Transcribe audio if needed
                        let platformInputContent = content;
                        if ((messageType === 'audio' || messageType === 'ptt')) {
                          // If mediaUrl is empty, try downloading from Baileys server first
                          if (!mediaUrl && targetSessionId) {
                            try {
                              const { data: sessAudioPlatform } = await supabase
                                .from('whatsapp_sessions')
                                .select('baileys_server_url, instance_name')
                                .eq('id', targetSessionId)
                                .single();
                              if (sessAudioPlatform?.baileys_server_url) {
                                console.log(`🎙️🌐 [PLATFORM-AUDIO-DL] Downloading audio via Baileys for msg ${messageId}`);
                                const dlResp = await fetch(`${sessAudioPlatform.baileys_server_url}/api/media/download`, {
                                  method: 'POST',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({ instanceName: sessAudioPlatform.instance_name, messageId, remoteJid }),
                                });
                                if (dlResp.ok) {
                                  const dlData = await dlResp.json();
                                  if (dlData.url) {
                                    mediaUrl = dlData.url;
                                    console.log(`🎙️🌐 [PLATFORM-AUDIO-DL] Got URL: ${mediaUrl.substring(0, 80)}`);
                                  } else if (dlData.base64) {
                                    const audioFileName = `incoming-audio/${targetSessionId}/${messageId}.ogg`;
                                    const binaryStr = atob(dlData.base64);
                                    const audioBytes = new Uint8Array(binaryStr.length);
                                    for (let i = 0; i < binaryStr.length; i++) audioBytes[i] = binaryStr.charCodeAt(i);
                                    const { error: upErr } = await supabase.storage.from('whatsapp-media').upload(audioFileName, audioBytes, { contentType: 'audio/ogg', upsert: true });
                                    if (!upErr) {
                                      const { data: pubData } = supabase.storage.from('whatsapp-media').getPublicUrl(audioFileName);
                                      mediaUrl = pubData.publicUrl;
                                      console.log(`🎙️🌐 [PLATFORM-AUDIO-DL] Uploaded: ${mediaUrl.substring(0, 80)}`);
                                    }
                                  }
                                } else {
                                  console.log(`🎙️🌐 [PLATFORM-AUDIO-DL] Download returned ${dlResp.status}`);
                                }
                              }
                            } catch (dlErr) {
                              console.error('🎙️🌐 [PLATFORM-AUDIO-DL] Error:', dlErr);
                            }
                          }

                          if (mediaUrl) {
                          try {
                            const ELEVENLABS_API_KEY = Deno.env.get('ELEVENLABS_API_KEY');
                            if (ELEVENLABS_API_KEY) {
                              const audioResp = await fetch(mediaUrl);
                              if (audioResp.ok) {
                                const audioBuffer = await audioResp.arrayBuffer();
                                const scribeForm = new FormData();
                                scribeForm.append('file', new Blob([audioBuffer], { type: 'audio/ogg' }), 'audio.ogg');
                                scribeForm.append('model_id', 'scribe_v2');
                                scribeForm.append('language_code', 'por');
                                const scribeResp = await fetch('https://api.elevenlabs.io/v1/speech-to-text', {
                                  method: 'POST',
                                  headers: { 'xi-api-key': ELEVENLABS_API_KEY },
                                  body: scribeForm,
                                });
                                if (scribeResp.ok) {
                                  const scribeResult = await scribeResp.json();
                                  if (scribeResult.text?.trim()?.length > 2) {
                                    platformInputContent = scribeResult.text.trim();
                                    console.log(`🎙️🌐 [PLATFORM] Transcribed: ${platformInputContent.substring(0, 100)}`);
                                    await supabase.from('whatsapp_messages').update({ content: `🎙️ ${platformInputContent}` }).eq('wa_message_id', messageId);
                                  } else {
                                    platformInputContent = '[O usuário enviou um áudio mas não foi possível entender. Peça educadamente para repetir ou digitar.]';
                                  }
                                } else {
                                  console.error('🤖🌐 [PLATFORM-AGENT] Scribe error:', scribeResp.status);
                                  // Fallback to OpenAI Whisper
                                  console.log('🤖🌐 [PLATFORM-AGENT] Trying Whisper fallback...');
                                  try {
                                    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
                                    if (OPENAI_API_KEY) {
                                      const whisperForm = new FormData();
                                      whisperForm.append('file', new Blob([audioBuffer], { type: 'audio/ogg' }), 'audio.ogg');
                                      whisperForm.append('model', 'whisper-1');
                                      whisperForm.append('language', 'pt');
                                      const whisperResp = await fetch('https://api.openai.com/v1/audio/transcriptions', {
                                        method: 'POST',
                                        headers: { 'Authorization': `Bearer ${OPENAI_API_KEY}` },
                                        body: whisperForm,
                                      });
                                      if (whisperResp.ok) {
                                        const whisperResult = await whisperResp.json();
                                        if (whisperResult.text?.trim()?.length > 2) {
                                          platformInputContent = whisperResult.text.trim();
                                          console.log(`🎙️🌐 [PLATFORM] Whisper Transcribed: ${platformInputContent.substring(0, 100)}`);
                                          await supabase.from('whatsapp_messages').update({ content: `🎙️ ${platformInputContent}` }).eq('wa_message_id', messageId);
                                        }
                                      }
                                    }
                                  } catch (whisperErr) {
                                    console.error('🤖🌐 [PLATFORM-AGENT] Whisper fallback error:', whisperErr);
                                  }
                                  if (platformInputContent === content) {
                                    platformInputContent = '[O usuário enviou um áudio mas houve erro na transcrição. Peça para digitar.]';
                                  }
                                }
                              }
                            }
                          } catch (sttErr) {
                            console.error('🤖🌐 [PLATFORM-AGENT] STT error:', sttErr);
                            platformInputContent = '[O usuário enviou um áudio mas ocorreu um erro. Peça para digitar.]';
                          }
                          } else {
                            console.log('🤖🌐 [PLATFORM-AGENT] Audio without mediaUrl after download attempt');
                            platformInputContent = '[O usuário enviou um áudio mas o sistema não conseguiu acessar o arquivo. Peça educadamente para digitar ou enviar novamente.]';
                          }
                        }
                        // Load conversation history
                        const { data: histMsgs } = await supabase
                          .from('whatsapp_messages')
                          .select('from_me, content, is_ai_response')
                          .eq('conversation_id', conversation.id)
                          .neq('wa_message_id', messageId)
                          .order('timestamp', { ascending: false })
                          .limit(10);
                        
                        const history = (histMsgs || []).reverse().map((m: any) => ({
                          role: m.from_me ? 'assistant' : 'user',
                          content: m.content || ''
                        }));
                        
                        // ============== CHECK AI CREDITS (PLATFORM AGENT) ==============
                        const PLATFORM_CREDIT_COST = 0.10;
                        const { data: platCreditResult } = await supabase.rpc('consume_ai_credits', {
                          p_company_id: companyId,
                          p_agent_id: agent.id,
                          p_amount: PLATFORM_CREDIT_COST,
                          p_description: `Agente "${agent.name}" (plataforma) respondeu no WhatsApp`
                        });
                        
                        if (platCreditResult && !platCreditResult.success) {
                          console.log(`🤖💳 Insufficient AI credits for platform agent. Balance: ${platCreditResult.balance}`);
                          break;
                        }
                        console.log(`🤖💳 Platform agent credit consumed: ${PLATFORM_CREDIT_COST}. Remaining: ${platCreditResult?.balance}`);
                        
                        // Call ellosuit-whatsapp-agent
                        const agentResp = await fetch(`${SUPABASE_URL}/functions/v1/ellosuit-whatsapp-agent`, {
                          method: 'POST',
                          headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
                          },
                          body: JSON.stringify({
                            messages: [...history, { role: 'user', content: platformInputContent }],
                            userId: authenticatedUserId,
                            companyId: authenticatedCompanyId,
                            contactPhone: phoneNumber,
                            agentInstructions: agent.instructions,
                            agentPersonality: agent.personality,
                            agentSettings: agentSettings,
                            lastMedia: mediaUrl ? {
                              url: mediaUrl,
                              fileName: (messageType === 'document' && content && content !== '[Documento]') ? content : (mediaCaption || `whatsapp-${Date.now()}.${messageType === 'image' ? 'jpg' : messageType === 'video' ? 'mp4' : 'bin'}`),
                              type: messageType,
                              mimeType: messageType === 'image' ? 'image/jpeg' : messageType === 'video' ? 'video/mp4' : messageType === 'document' ? 'application/octet-stream' : 'application/octet-stream',
                            } : undefined,
                          }),
                        });
                        
                        if (agentResp.ok) {
                          const agentData = await agentResp.json();
                          let aiReply = agentData.response || '';
                          
                          if (aiReply) {
                            // Clean markdown
                            aiReply = aiReply
                              .replace(/\*\*(.*?)\*\*/g, '$1')
                              .replace(/\*(.*?)\*/g, '$1')
                              .replace(/#{1,6}\s?/g, '')
                              .replace(/`{1,3}(.*?)`{1,3}/gs, '$1')
                              .replace(/\[(.*?)\]\((.*?)\)/g, '$2')
                              .trim();
                            
                            // Check for handoff
                            const isHandoff = aiReply.includes('[HANDOFF]');
                            if (isHandoff) aiReply = aiReply.replace('[HANDOFF]', '').trim();
                            
                            // Remove stage tags
                            aiReply = aiReply.replace(/\[STAGE:\w+\]/g, '').trim();
                            
                            // Send response
                            const { data: sessionData } = await supabase
                              .from('whatsapp_sessions')
                              .select('baileys_server_url, instance_name')
                              .eq('id', targetSessionId)
                              .single();
                            
                            if (sessionData?.baileys_server_url) {
                              const sendJid = remoteJid.includes('@') ? remoteJid : `${phoneNumber}@s.whatsapp.net`;
                              const aiMsgId = `ai-${Date.now()}-${Math.random().toString(36).substring(7)}`;
                              
                              // Determine audio mode
                              const audioResponseMode = (agentSettings.audioResponseMode as string) || 'disabled';
                              // Force 'ello' voice for platform agent
                              const ttsVoice = 'ello';
                              console.log(`🤖🌐 [PLATFORM-AGENT] Forced ttsVoice=ello, audioResponseMode=${audioResponseMode}, messageType=${messageType}`);
                              const shouldSendAudio = audioResponseMode === 'always' || 
                                (audioResponseMode === 'when_audio' && (messageType === 'audio' || messageType === 'ptt'));
                              
                              let sendSuccess = false;
                              
                              if (shouldSendAudio) {
                                let audioBase64 = '';
                                let audioContentType = 'audio/ogg; codecs=opus';
                                
                                if (ttsVoice === 'ello') {
                                  // Use ElevenLabs TTS with Ello voice
                                  const ELEVENLABS_API_KEY = Deno.env.get('ELEVENLABS_API_KEY');
                                  if (ELEVENLABS_API_KEY) {
                                    const elloResp = await fetch(
                                      `https://api.elevenlabs.io/v1/text-to-speech/RGymW84CSmfVugnA5tvA?output_format=mp3_44100_128`,
                                      {
                                        method: 'POST',
                                        headers: { 'xi-api-key': ELEVENLABS_API_KEY, 'Content-Type': 'application/json' },
                                        body: JSON.stringify({ text: aiReply.slice(0, 5000), model_id: 'eleven_multilingual_v2', voice_settings: { stability: 0.5, similarity_boost: 0.75, style: 0.3, use_speaker_boost: true } }),
                                      }
                                    );
                                    if (elloResp.ok) {
                                      const elloBuffer = await elloResp.arrayBuffer();
                                      const elloBytes = new Uint8Array(elloBuffer);
                                      // Safe base64 encoding for large buffers
                                      let binary = '';
                                      for (let i = 0; i < elloBytes.length; i++) binary += String.fromCharCode(elloBytes[i]);
                                      audioBase64 = btoa(binary);
                                      audioContentType = 'audio/mpeg';
                                    } else {
                                      console.error('❌ ElevenLabs Ello TTS failed:', elloResp.status);
                                    }
                                  }
                                }
                                
                                // Fallback to OpenAI TTS for non-ello voices or if ElevenLabs failed
                                if (!audioBase64) {
                                  const ttsResp = await fetch(`${SUPABASE_URL}/functions/v1/tts-openai`, {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` },
                                    body: JSON.stringify({ text: aiReply, voice: ttsVoice === 'ello' ? 'nova' : ttsVoice, speed: 1.0, format: 'opus' }),
                                  });
                                  if (ttsResp.ok) {
                                    const ttsData = await ttsResp.json();
                                    audioBase64 = ttsData.audio_base64;
                                    audioContentType = 'audio/ogg; codecs=opus';
                                  }
                                }
                                
                                if (audioBase64) {
                                  const audioFileName = `ai-audio/${aiMsgId}.${audioContentType.includes('mpeg') ? 'mp3' : 'ogg'}`;
                                  const binaryStr = atob(audioBase64);
                                  const bytes = new Uint8Array(binaryStr.length);
                                  for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i);
                                  
                                  const { error: uploadErr } = await supabase.storage.from('whatsapp-media').upload(audioFileName, bytes, { contentType: audioContentType, upsert: true });
                                  if (!uploadErr) {
                                    const { data: pubUrl } = supabase.storage.from('whatsapp-media').getPublicUrl(audioFileName);
                                    const voiceResp = await compatFetch(`${sessionData.baileys_server_url}/api/message/send-voice`, {
                                      method: 'POST',
                                      headers: { 'Content-Type': 'application/json' },
                                      body: JSON.stringify({ instanceName: sessionData.instance_name, jid: sendJid, audioUrl: pubUrl.publicUrl, mimetype: audioContentType }),
                                    });
                                    sendSuccess = voiceResp.ok;
                                    if (sendSuccess) {
                                      await supabase.from('whatsapp_messages').insert({
                                        conversation_id: conversation.id, session_id: targetSessionId, company_id: companyId,
                                        wa_message_id: aiMsgId, from_me: true, content: '[Áudio]', message_type: 'ptt',
                                        media_url: pubUrl.publicUrl, status: 'sent', is_ai_response: true, sender_name: agent.name,
                                      });
                                    }
                                  }
                                }
                              }
                              
                              if (!sendSuccess) {
                                // Send as text
                                const sendResp = await compatFetch(`${sessionData.baileys_server_url}/api/message/send`, {
                                  method: 'POST',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({ instanceName: sessionData.instance_name, jid: sendJid, message: { text: aiReply } }),
                                });
                                sendSuccess = sendResp.ok;
                                await supabase.from('whatsapp_messages').insert({
                                  conversation_id: conversation.id, session_id: targetSessionId, company_id: companyId,
                                  wa_message_id: aiMsgId, from_me: true, content: aiReply, message_type: 'text',
                                  status: sendSuccess ? 'sent' : 'failed', is_ai_response: true, sender_name: agent.name,
                                });
                              }
                              
                              // Update conversation
                              const convUpd: Record<string, unknown> = {
                                last_message: shouldSendAudio && sendSuccess ? '🎙️ Áudio' : aiReply.substring(0, 100),
                                last_message_at: new Date().toISOString(),
                              };
                              if (isHandoff) {
                                convUpd.ai_auto_reply_enabled = false;
                                convUpd.assigned_agent_id = null;
                              }
                              await supabase.from('whatsapp_conversations').update(convUpd).eq('id', conversation.id);
                            }
                          }
                        } else {
                          console.error('🤖🌐 [PLATFORM-AGENT] Agent call failed:', await agentResp.text());
                        }
                        
                        // Skip normal AI flow - platform agent handled it
                        break;
                      }
                      // ============== END PLATFORM AGENT ==============
                      
                      // Build proper system prompt - concise, one message at a time
                      const systemPrompt = [
                        `Personalidade: ${agent.personality}`,
                        `Tom/Humor: ${agentHumor}`,
                        '',
                        agent.instructions,
                        '',
                        'REGRAS ESSENCIAIS DE COMPORTAMENTO NO WHATSAPP:',
                        '1. Responda APENAS o que foi perguntado. Seja direto e conciso.',
                        '2. NUNCA antecipe perguntas que o cliente nao fez. Espere ele perguntar.',
                        '3. Envie UMA UNICA mensagem curta por vez. NAO divida em multiplas mensagens.',
                        '4. Se o cliente perguntar algo simples, responda em 1-2 frases no maximo.',
                        '5. NAO despeje todas as informacoes de uma vez. Va respondendo conforme o cliente pergunta.',
                        '6. Aja como um vendedor real no WhatsApp: respostas curtas, naturais e objetivas.',
                        '',
                        'FORMATACAO:',
                        '- NAO use asteriscos, negrito, italico, markdown ou formatacao especial.',
                        '- Escreva texto corrido e natural, como uma pessoa digitando no WhatsApp.',
                        '- NAO use listas com marcadores. Escreva em frases corridas.',
                        '- NAO use links com formatacao markdown. Escreva a URL direta.',
                        '',
                        `LIMITE: Responda com NO MAXIMO ${agentMaxChars} caracteres. Prefira respostas bem mais curtas.`,
                        `NUNCA use o separador "|||". Envie sempre UMA unica mensagem.`,
                        '',
                        'TRANSFERENCIA PARA ATENDENTE HUMANO:',
                        'Se o cliente pedir para falar com um atendente humano, ou se voce perceber que nao consegue resolver a situacao (ex: problemas de pagamento, reclamacoes graves, assuntos que exigem um humano), inclua a tag [HANDOFF] no FINAL da sua resposta.',
                        'Ao usar [HANDOFF], envie uma mensagem gentil dizendo que vai transferir para um atendente. Exemplo: "Vou te transferir para um atendente que poderá te ajudar melhor com isso! [HANDOFF]"',
                        'A tag [HANDOFF] sera removida automaticamente e nao aparecera para o cliente.',
                        '',
                        'CLASSIFICACAO AUTOMATICA DO ATENDIMENTO:',
                        'Ao final de CADA resposta, inclua uma tag de classificacao do estagio da conversa. Use EXATAMENTE uma destas tags:',
                        '- [STAGE:novo] - Contato novo, primeira interacao ou sem contexto suficiente.',
                        '- [STAGE:em_atendimento] - Conversa ativa, cliente está sendo atendido agora.',
                        '- [STAGE:aguardando] - Voce fez uma pergunta ou pediu informacao ao cliente e está esperando resposta.',
                        '- [STAGE:qualificado] - Cliente demonstrou interesse real, pediu preco, quer fechar, ou é um lead quente.',
                        '- [STAGE:finalizado] - Conversa encerrada, cliente agradeceu, despedida, ou assunto resolvido.',
                        'SEMPRE inclua a tag [STAGE:xxx] no FINAL da resposta. Ela sera removida automaticamente.',
                        '',
                        'LINKS E URLs:',
                        'Quando precisar enviar links ou URLs, SEMPRE inclua o link na sua resposta em texto. O sistema automaticamente enviara o texto com o link clicavel e depois o audio separadamente.',
                        '',
                        ...(mediaList.length > 0 ? [
                          'MIDIAS DISPONIVEIS PARA ENVIO:',
                          'Voce tem acesso a estes arquivos que pode enviar ao cliente quando for relevante.',
                          'Para enviar uma midia, inclua a tag [MEDIA:ID] na sua resposta (o ID sera substituido pelo sistema).',
                          'Envie a midia JUNTO com uma mensagem de texto contextual.',
                          'NAO envie midia se o cliente nao pediu algo relacionado. So envie quando fizer sentido.',
                          '',
                          ...mediaList.map((m: any) => `- ID: ${m.id} | Arquivo: ${m.file_name} | Quando enviar: ${m.description}${m.context_keywords?.length > 0 ? ` | Palavras-chave: ${m.context_keywords.join(', ')}` : ''}`),
                          '',
                        ] : []),
                        'Responda sempre em português brasileiro.'
                      ].join('\n');
                      
                      // Load recent conversation history for context (exclude the current message)
                      const { data: recentMessages } = await supabase
                        .from('whatsapp_messages')
                        .select('from_me, content, is_ai_response')
                        .eq('conversation_id', conversation.id)
                        .neq('wa_message_id', messageId)
                        .order('timestamp', { ascending: false })
                        .limit(10);
                      
                      const historyMessages = (recentMessages || []).reverse().map(m => ({
                        role: m.from_me ? 'assistant' as const : 'user' as const,
                        content: m.content || ''
                      }));
                      
                      // If message is audio/ptt, try to transcribe it before sending to AI
                      let aiInputContent = content;
                      if ((messageType === 'audio' || messageType === 'ptt')) {
                        // If mediaUrl is empty, try downloading from Baileys server
                        if (!mediaUrl && targetSessionId) {
                          try {
                            const { data: sessAudioAgent } = await supabase
                              .from('whatsapp_sessions')
                              .select('baileys_server_url, instance_name')
                              .eq('id', targetSessionId)
                              .single();
                            if (sessAudioAgent?.baileys_server_url) {
                              console.log(`🎙️ [AGENT-AUDIO-DL] Downloading audio via Baileys for msg ${messageId}`);
                              const dlResp = await fetch(`${sessAudioAgent.baileys_server_url}/api/media/download`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ instanceName: sessAudioAgent.instance_name, messageId, remoteJid }),
                              });
                              if (dlResp.ok) {
                                const dlData = await dlResp.json();
                                if (dlData.url) {
                                  mediaUrl = dlData.url;
                                  console.log(`🎙️ [AGENT-AUDIO-DL] Got URL: ${mediaUrl.substring(0, 80)}`);
                                } else if (dlData.base64) {
                                  const audioFileName = `incoming-audio/${targetSessionId}/${messageId}.ogg`;
                                  const binaryStr = atob(dlData.base64);
                                  const audioBytes = new Uint8Array(binaryStr.length);
                                  for (let i = 0; i < binaryStr.length; i++) audioBytes[i] = binaryStr.charCodeAt(i);
                                  const { error: upErr } = await supabase.storage.from('whatsapp-media').upload(audioFileName, audioBytes, { contentType: 'audio/ogg', upsert: true });
                                  if (!upErr) {
                                    const { data: pubData } = supabase.storage.from('whatsapp-media').getPublicUrl(audioFileName);
                                    mediaUrl = pubData.publicUrl;
                                    console.log(`🎙️ [AGENT-AUDIO-DL] Uploaded: ${mediaUrl.substring(0, 80)}`);
                                  }
                                }
                              } else {
                                console.log(`🎙️ [AGENT-AUDIO-DL] Download returned ${dlResp.status}`);
                              }
                            }
                          } catch (dlErr) {
                            console.error('🎙️ [AGENT-AUDIO-DL] Error:', dlErr);
                          }
                        }

                        if (mediaUrl) {
                          console.log('🎙️ Audio message detected, attempting transcription via ElevenLabs Scribe...');
                          try {
                            const ELEVENLABS_API_KEY = Deno.env.get('ELEVENLABS_API_KEY');
                            if (ELEVENLABS_API_KEY) {
                              const audioResponse = await fetch(mediaUrl);
                              if (audioResponse.ok) {
                                const audioBuffer = await audioResponse.arrayBuffer();
                                console.log(`🎙️ Audio downloaded: ${audioBuffer.byteLength} bytes`);
                                const scribeForm = new FormData();
                                const audioBlob = new Blob([audioBuffer], { type: 'audio/ogg' });
                                scribeForm.append('file', audioBlob, 'audio.ogg');
                                scribeForm.append('model_id', 'scribe_v2');
                                scribeForm.append('language_code', 'por');
                                const scribeResponse = await fetch('https://api.elevenlabs.io/v1/speech-to-text', {
                                  method: 'POST',
                                  headers: { 'xi-api-key': ELEVENLABS_API_KEY },
                                  body: scribeForm,
                                });
                                if (scribeResponse.ok) {
                                  const scribeResult = await scribeResponse.json();
                                  const transcribedText = scribeResult.text?.trim();
                                  if (transcribedText && transcribedText.length > 2) {
                                    console.log(`🎙️ ElevenLabs Transcription: ${transcribedText.substring(0, 100)}`);
                                    aiInputContent = `[O cliente enviou um áudio dizendo]: ${transcribedText}`;
                                    await supabase.from('whatsapp_messages').update({ content: `🎙️ ${transcribedText}` }).eq('wa_message_id', messageId);
                                  } else {
                                    console.log('🎙️ Transcription empty or too short');
                                    aiInputContent = '[O cliente enviou um áudio mas não foi possível entender o conteúdo. Peça educadamente para ele repetir ou digitar.]';
                                  }
                                } else {
                                  const errText = await scribeResponse.text();
                                  console.error('🎙️ ElevenLabs Scribe API error:', scribeResponse.status, errText);
                                  // Fallback to OpenAI Whisper
                                  console.log('🎙️ Trying OpenAI Whisper fallback...');
                                  try {
                                    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
                                    if (OPENAI_API_KEY) {
                                      const whisperForm = new FormData();
                                      whisperForm.append('file', new Blob([audioBuffer], { type: 'audio/ogg' }), 'audio.ogg');
                                      whisperForm.append('model', 'whisper-1');
                                      whisperForm.append('language', 'pt');
                                      const whisperResp = await fetch('https://api.openai.com/v1/audio/transcriptions', {
                                        method: 'POST',
                                        headers: { 'Authorization': `Bearer ${OPENAI_API_KEY}` },
                                        body: whisperForm,
                                      });
                                      if (whisperResp.ok) {
                                        const whisperResult = await whisperResp.json();
                                        if (whisperResult.text?.trim()?.length > 2) {
                                          console.log(`🎙️ Whisper Transcription: ${whisperResult.text.trim().substring(0, 100)}`);
                                          aiInputContent = `[O cliente enviou um áudio dizendo]: ${whisperResult.text.trim()}`;
                                          await supabase.from('whatsapp_messages').update({ content: `🎙️ ${whisperResult.text.trim()}` }).eq('wa_message_id', messageId);
                                        }
                                      }
                                    }
                                  } catch (whisperErr) {
                                    console.error('🎙️ Whisper fallback error:', whisperErr);
                                  }
                                  if (!aiInputContent.includes('[O cliente enviou um áudio dizendo]')) {
                                    aiInputContent = '[O cliente enviou um áudio. Não foi possível transcrevê-lo no momento. Peça educadamente para ele digitar a mensagem.]';
                                  }
                                }
                              } else {
                                console.error('🎙️ Failed to download audio:', audioResponse.status);
                                aiInputContent = '[O cliente enviou um áudio mas não foi possível acessá-lo. Peça educadamente para ele digitar.]';
                              }
                            } else {
                              aiInputContent = '[O cliente enviou um áudio. Peça para ele digitar a mensagem pois não há serviço de transcrição configurado.]';
                            }
                          } catch (transcribeErr) {
                            console.error('🎙️ Transcription error:', transcribeErr);
                            aiInputContent = '[O cliente enviou um áudio mas ocorreu um erro na transcrição. Peça educadamente para ele digitar.]';
                          }
                        } else {
                          console.log('🎙️ Audio message without mediaUrl after download attempt');
                          aiInputContent = '[O cliente enviou um áudio mas o sistema não conseguiu acessar o arquivo de áudio para transcrição. Peça educadamente para ele digitar ou enviar novamente.]';
                        }
                      }
                      
                      const apiMessages = [
                        { role: 'system' as const, content: systemPrompt },
                        ...historyMessages,
                        { role: 'user' as const, content: aiInputContent }
                      ];
                      
                      // ============== CHECK AI CREDITS BEFORE RESPONDING ==============
                      const CREDIT_COST = 0.10;
                      const { data: creditResult } = await supabase.rpc('consume_ai_credits', {
                        p_company_id: companyId,
                        p_agent_id: agent.id,
                        p_amount: CREDIT_COST,
                        p_description: `Agente "${agent.name}" respondeu no WhatsApp`
                      });
                      
                      if (creditResult && !creditResult.success) {
                        console.log(`🤖💳 Insufficient AI credits for company ${companyId}. Balance: ${creditResult.balance}`);
                        // Don't respond - credits exhausted
                        break;
                      }
                      console.log(`🤖💳 AI credit consumed: ${CREDIT_COST}. Remaining: ${creditResult?.balance}`);
                      
                      // Call the ai-chat edge function with full messages array
                      const aiResponse = await fetch(`${SUPABASE_URL}/functions/v1/ai-chat`, {
                        method: 'POST',
                        headers: {
                          'Content-Type': 'application/json',
                          'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
                        },
                        body: JSON.stringify({
                          messages: apiMessages,
                          model: 'google/gemini-3-flash-preview',
                          temperature: agentTemperature
                        })
                      });
                      
                      if (aiResponse.ok) {
                        const aiData = await aiResponse.json();
                        let aiReply = aiData.response || aiData.message;
                        
                        if (aiReply) {
                          // Clean markdown from response
                          aiReply = aiReply
                            .replace(/\*\*(.*?)\*\*/g, '$1')
                            .replace(/\*(.*?)\*/g, '$1')
                            .replace(/#{1,6}\s?/g, '')
                            .replace(/`{1,3}(.*?)`{1,3}/gs, '$1')
                            .replace(/\[(.*?)\]\((.*?)\)/g, '$2')
                            .replace(/^[-*+]\s/gm, '• ')
                            .trim();
                          
                          console.log('🤖 AI Response (cleaned):', aiReply.substring(0, 100) + '...');
                          
                          // Check for handoff signal - if present, remove the tag from the message and flag for handoff
                          const isHandoff = aiReply.includes('[HANDOFF]');
                          if (isHandoff) {
                            aiReply = aiReply.replace('[HANDOFF]', '').trim();
                            console.log('🤖🔄 HANDOFF detected! Will disable AI auto-reply after sending message.');
                          }
                          
                          // Check for pipeline stage classification tag
                          const validStages = ['novo', 'em_atendimento', 'aguardando', 'qualificado', 'finalizado'];
                          const stageMatch = aiReply.match(/\[STAGE:(\w+)\]/);
                          let detectedStage: string | null = null;
                          if (stageMatch && validStages.includes(stageMatch[1])) {
                            detectedStage = stageMatch[1];
                            console.log(`📊 AI classified conversation stage: ${detectedStage}`);
                          }
                          // Remove ALL stage tags from the reply
                          aiReply = aiReply.replace(/\[STAGE:\w+\]/g, '').trim();
                          
                          // ============== DETECT AND EXTRACT MEDIA TAGS ==============
                          const mediaTagRegex = /\[MEDIA:([a-f0-9-]+)\]/gi;
                          const detectedMediaIds: string[] = [];
                          let mediaMatch;
                          while ((mediaMatch = mediaTagRegex.exec(aiReply)) !== null) {
                            detectedMediaIds.push(mediaMatch[1]);
                          }
                          // Remove media tags from the text reply
                          aiReply = aiReply.replace(/\[MEDIA:[a-f0-9-]+\]/gi, '').trim();
                          console.log(`🤖📸 Detected ${detectedMediaIds.length} media tags in response`);
                          
                          // Split response by separator
                          const messageParts = aiReply.split(MESSAGE_SEPARATOR).map((p: string) => p.trim()).filter((p: string) => p.length > 0);
                          console.log(`🤖 Message parts: ${messageParts.length}`);
                          
                          // Get session server URL
                          const { data: sessionData } = await supabase
                            .from('whatsapp_sessions')
                            .select('id, baileys_server_url, instance_name')
                            .eq('id', targetSessionId)
                            .single();
                          
                          if (sessionData?.baileys_server_url) {
                            // Determine if we should respond with audio
                            const audioResponseMode = (agentSettings.audioResponseMode as string) || 'disabled';
                            const ttsVoice = (agentSettings.ttsVoice as string) || 'nova';
                            const shouldSendAudio = audioResponseMode === 'always' || 
                              (audioResponseMode === 'when_audio' && (messageType === 'audio' || messageType === 'ptt'));
                            
                            console.log(`🤖 Audio mode: ${audioResponseMode}, ttsVoice: ${ttsVoice}, messageType: ${messageType}, shouldSendAudio: ${shouldSendAudio}`);
                            
                            // Use remoteJid directly - it's already resolved from remoteJidAlt in the webhook
                            // For LID contacts, the remoteJid is the best we have
                            const sendJid = remoteJid.includes('@') ? remoteJid : `${phoneNumber}@s.whatsapp.net`;
                            console.log(`🤖 Send JID: ${sendJid}, remoteJid: ${remoteJid}, phoneNumber: ${phoneNumber}`);
                            
                            // Detect URLs in the response - if audio mode is on and response contains links,
                            // extract links to send as text separately, then send audio without the links
                            const urlRegex = /(https?:\/\/[^\s,)]+)/gi;
                            
                            // Send each message part
                            for (let partIndex = 0; partIndex < messageParts.length; partIndex++) {
                              const partContent = messageParts[partIndex];
                              const containsUrl = urlRegex.test(partContent);
                              urlRegex.lastIndex = 0; // Reset regex
                              
                              // If audio mode is on and content has URLs, send text first then audio
                              if (shouldSendAudio && partIndex === 0 && containsUrl) {
                                console.log('🔗 Response contains URLs - sending text first, then audio');
                                
                                // 1. Send text message with the full content (including links)
                                const textMsgId = `ai-${Date.now()}-${Math.random().toString(36).substring(7)}`;
                                await supabase
                                  .from('whatsapp_messages')
                                  .insert({
                                    conversation_id: conversation.id,
                                    session_id: targetSessionId,
                                    company_id: companyId,
                                    wa_message_id: textMsgId,
                                    from_me: true,
                                    content: partContent,
                                    message_type: 'text',
                                    status: 'sending',
                                    is_ai_response: true,
                                    sender_name: agent.name,
                                    timestamp: new Date().toISOString()
                                  });
                                
                                const textSendResp = await compatFetch(`${sessionData.baileys_server_url}/api/message/send`, {
                                  method: 'POST',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({
                                    instanceName: sessionData.instance_name,
                                    jid: sendJid,
                                    message: { text: partContent }
                                  })
                                });
                                
                                await supabase
                                  .from('whatsapp_messages')
                                  .update({ status: textSendResp.ok ? 'sent' : 'failed' })
                                  .eq('wa_message_id', textMsgId);
                                
                                if (textSendResp.ok) {
                                  console.log('🔗 Text with links sent successfully');
                                } else {
                                  console.error('🔗 Failed to send text with links:', await textSendResp.text());
                                }
                                
                                // Small delay before sending audio
                                await new Promise(r => setTimeout(r, 1000));
                                
                                // 2. Now send audio version (without URLs for cleaner speech)
                                const audioContent = partContent.replace(urlRegex, '').replace(/\s{2,}/g, ' ').trim();
                                urlRegex.lastIndex = 0;
                                
                                if (audioContent.length > 5) {
                                  const audioMsgId = `ai-${Date.now()}-${Math.random().toString(36).substring(7)}`;
                                  await supabase
                                    .from('whatsapp_messages')
                                    .insert({
                                      conversation_id: conversation.id,
                                      session_id: targetSessionId,
                                      company_id: companyId,
                                      wa_message_id: audioMsgId,
                                      from_me: true,
                                      content: '[Áudio]',
                                      message_type: 'ptt',
                                      status: 'sending',
                                      is_ai_response: true,
                                      sender_name: agent.name,
                                      timestamp: new Date(Date.now() + 1000).toISOString()
                                    });
                                  
                                  // Generate TTS for the text without URLs
                                  let ttsResponse: Response | null = null;
                                  
                                  if (ttsVoice === 'ello') {
                                    const ELEVENLABS_API_KEY = Deno.env.get('ELEVENLABS_API_KEY');
                                    if (ELEVENLABS_API_KEY) {
                                      const elloResp = await fetch(
                                        `https://api.elevenlabs.io/v1/text-to-speech/RGymW84CSmfVugnA5tvA?output_format=mp3_44100_128`,
                                        {
                                          method: 'POST',
                                          headers: { 'xi-api-key': ELEVENLABS_API_KEY, 'Content-Type': 'application/json' },
                                          body: JSON.stringify({ text: audioContent.slice(0, 5000), model_id: 'eleven_multilingual_v2', voice_settings: { stability: 0.5, similarity_boost: 0.75, style: 0.3, use_speaker_boost: true } }),
                                        }
                                      );
                                      if (elloResp.ok) {
                                        const elloBuffer = await elloResp.arrayBuffer();
                                        const elloBytes = new Uint8Array(elloBuffer);
                                        let binary = '';
                                        for (let i = 0; i < elloBytes.length; i++) binary += String.fromCharCode(elloBytes[i]);
                                        ttsResponse = new Response(JSON.stringify({ audio_base64: btoa(binary), format: 'mp3' }), { status: 200 });
                                        console.log('🎙️ ElevenLabs TTS (URL path) generated successfully');
                                      }
                                    }
                                  }
                                  
                                  if (!ttsResponse) {
                                    ttsResponse = await fetch(`${SUPABASE_URL}/functions/v1/tts-openai`, {
                                    method: 'POST',
                                    headers: {
                                      'Content-Type': 'application/json',
                                      'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
                                    },
                                    body: JSON.stringify({
                                      text: audioContent,
                                      voice: ttsVoice === 'ello' ? 'nova' : ttsVoice,
                                      speed: 1.0,
                                      format: 'opus'
                                    })
                                    });
                                  }
                                  
                                  let audioSent = false;
                                  if (ttsResponse.ok) {
                                    const ttsData = await ttsResponse.json();
                                    const audioBase64 = ttsData.audio_base64;
                                    const audioFormat = ttsData.format || 'opus';
                                    const fileExt = audioFormat === 'mp3' ? 'mp3' : 'ogg';
                                    const contentType = audioFormat === 'mp3' ? 'audio/mpeg' : 'audio/ogg; codecs=opus';
                                    const audioFileName = `ai-audio/${audioMsgId}.${fileExt}`;
                                    
                                    const binaryString = atob(audioBase64);
                                    const audioBytes = new Uint8Array(binaryString.length);
                                    for (let i = 0; i < binaryString.length; i++) {
                                      audioBytes[i] = binaryString.charCodeAt(i);
                                    }
                                    
                                    const { error: uploadError } = await supabase.storage
                                      .from('whatsapp-media')
                                      .upload(audioFileName, audioBytes, { contentType, upsert: true });
                                    
                                    if (!uploadError) {
                                      const { data: publicUrlData } = supabase.storage
                                        .from('whatsapp-media')
                                        .getPublicUrl(audioFileName);
                                      
                                      const sendVoiceResp = await compatFetch(`${sessionData.baileys_server_url}/api/message/send-voice`, {
                                        method: 'POST',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({
                                          instanceName: sessionData.instance_name,
                                          jid: sendJid,
                                          audioUrl: publicUrlData.publicUrl,
                                          mimetype: contentType
                                        })
                                      });
                                      
                                      audioSent = sendVoiceResp.ok;
                                      await supabase
                                        .from('whatsapp_messages')
                                        .update({ media_url: publicUrlData.publicUrl, status: audioSent ? 'sent' : 'failed' })
                                        .eq('wa_message_id', audioMsgId);
                                    }
                                  }
                                  
                                  if (!audioSent) {
                                    // Remove failed audio message from DB
                                    await supabase.from('whatsapp_messages').delete().eq('wa_message_id', audioMsgId);
                                    console.log('🎙️ Audio generation failed for link message, text already sent');
                                  }
                                }
                                
                                continue; // Skip the normal send logic below
                              }
                              
                              const aiMessageId = `ai-${Date.now()}-${Math.random().toString(36).substring(7)}`;
                              
                              // Save to database
                              await supabase
                                .from('whatsapp_messages')
                                .insert({
                                  conversation_id: conversation.id,
                                  session_id: targetSessionId,
                                  company_id: companyId,
                                  wa_message_id: aiMessageId,
                                  from_me: true,
                                  content: shouldSendAudio && partIndex === 0 ? '[Áudio]' : partContent,
                                  message_type: shouldSendAudio && partIndex === 0 ? 'ptt' : 'text',
                                  status: 'sending',
                                  is_ai_response: true,
                                  sender_name: agent.name,
                                  timestamp: new Date(Date.now() + partIndex * 1000).toISOString()
                                });
                              
                              try {
                                let sendSuccess = false;
                                
                                if (shouldSendAudio && partIndex === 0) {
                                  // Generate TTS audio for first part only
                                  console.log(`🎙️ Generating TTS audio with voice: ${ttsVoice}`);
                                  
                                  let ttsResponse: Response | null = null;
                                  let isElevenLabs = false;
                                  
                                  if (ttsVoice === 'ello') {
                                    // Use ElevenLabs TTS
                                    const ELEVENLABS_API_KEY = Deno.env.get('ELEVENLABS_API_KEY');
                                    if (ELEVENLABS_API_KEY) {
                                      const elloResp = await fetch(
                                        `https://api.elevenlabs.io/v1/text-to-speech/RGymW84CSmfVugnA5tvA?output_format=mp3_44100_128`,
                                        {
                                          method: 'POST',
                                          headers: { 'xi-api-key': ELEVENLABS_API_KEY, 'Content-Type': 'application/json' },
                                          body: JSON.stringify({ text: partContent.slice(0, 5000), model_id: 'eleven_multilingual_v2', voice_settings: { stability: 0.5, similarity_boost: 0.75, style: 0.3, use_speaker_boost: true } }),
                                        }
                                      );
                                      if (elloResp.ok) {
                                        const elloBuffer = await elloResp.arrayBuffer();
                                        const elloBytes = new Uint8Array(elloBuffer);
                                        let binary = '';
                                        for (let i = 0; i < elloBytes.length; i++) binary += String.fromCharCode(elloBytes[i]);
                                        const audioBase64 = btoa(binary);
                                        // Create a fake response-like object for compatibility
                                        ttsResponse = new Response(JSON.stringify({ audio_base64: audioBase64, format: 'mp3' }), { status: 200 });
                                        isElevenLabs = true;
                                        console.log('🎙️ ElevenLabs TTS generated successfully');
                                      } else {
                                        console.error('🎙️ ElevenLabs TTS failed:', elloResp.status, '- falling back to OpenAI');
                                      }
                                    }
                                  }
                                  
                                  // Fallback to OpenAI TTS
                                  if (!ttsResponse) {
                                    ttsResponse = await fetch(`${SUPABASE_URL}/functions/v1/tts-openai`, {
                                    method: 'POST',
                                    headers: {
                                      'Content-Type': 'application/json',
                                      'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
                                    },
                                    body: JSON.stringify({
                                      text: partContent,
                                      voice: ttsVoice === 'ello' ? 'nova' : ttsVoice,
                                      speed: 1.0,
                                      format: 'opus'
                                    })
                                    });
                                  }
                                  
                                  if (ttsResponse.ok) {
                                    const ttsData = await ttsResponse.json();
                                    const audioBase64 = ttsData.audio_base64;
                                    const audioFormat = ttsData.format || 'opus';
                                    const fileExt = audioFormat === 'mp3' ? 'mp3' : 'ogg';
                                    const contentType = audioFormat === 'mp3' ? 'audio/mpeg' : 'audio/ogg; codecs=opus';
                                    const audioFileName = `ai-audio/${aiMessageId}.${fileExt}`;
                                    
                                    // Decode base64 to binary
                                    const binaryString = atob(audioBase64);
                                    const audioBytes = new Uint8Array(binaryString.length);
                                    for (let i = 0; i < binaryString.length; i++) {
                                      audioBytes[i] = binaryString.charCodeAt(i);
                                    }
                                    
                                    const { error: uploadError } = await supabase.storage
                                      .from('whatsapp-media')
                                      .upload(audioFileName, audioBytes, {
                                        contentType: contentType,
                                        upsert: true
                                      });
                                    
                                    if (!uploadError) {
                                      const { data: publicUrlData } = supabase.storage
                                        .from('whatsapp-media')
                                        .getPublicUrl(audioFileName);
                                      
                                      const audioPublicUrl = publicUrlData.publicUrl;
                                      console.log(`🎙️ Audio uploaded: ${audioPublicUrl} (${contentType})`);
                                      
                                      // Send via send-voice - OGG Opus with ptt:true for WhatsApp voice note
                                      const sendResponse = await compatFetch(`${sessionData.baileys_server_url}/api/message/send-voice`, {
                                        method: 'POST',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({
                                          instanceName: sessionData.instance_name,
                                          jid: sendJid,
                                          audioUrl: audioPublicUrl,
                                          mimetype: contentType
                                        })
                                      });
                                      
                                      sendSuccess = sendResponse.ok;
                                      if (!sendSuccess) {
                                        const errText = await sendResponse.text();
                                        console.error('🎙️ send-voice failed:', sendResponse.status, errText);
                                      } else {
                                        console.log('🎙️ Audio sent successfully via send-voice as PTT');
                                      }
                                      await supabase
                                        .from('whatsapp_messages')
                                        .update({ media_url: audioPublicUrl })
                                        .eq('wa_message_id', aiMessageId);
                                    } else {
                                      console.error('🎙️ Audio upload failed:', uploadError.message);
                                    }
                                  } else {
                                    const ttsErr = await ttsResponse.text();
                                    console.error('🎙️ TTS generation failed:', ttsResponse.status, ttsErr);
                                  }
                                  
                                  // Fallback to text if audio failed
                                  if (!sendSuccess) {
                                    console.log('🎙️ Audio failed, falling back to text');
                                    const sendResponse = await compatFetch(`${sessionData.baileys_server_url}/api/message/send`, {
                                      method: 'POST',
                                      headers: { 'Content-Type': 'application/json' },
                                      body: JSON.stringify({
                                        instanceName: sessionData.instance_name,
                                        jid: sendJid,
                                        message: { text: partContent }
                                      })
                                    });
                                    sendSuccess = sendResponse.ok;
                                    await supabase
                                      .from('whatsapp_messages')
                                      .update({ content: partContent, message_type: 'text' })
                                      .eq('wa_message_id', aiMessageId);
                                  }
                                } else {
                                  // Send as text using correct Baileys format
                                  const sendResponse = await compatFetch(`${sessionData.baileys_server_url}/api/message/send`, {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({
                                      instanceName: sessionData.instance_name,
                                      jid: sendJid,
                                      message: { text: partContent }
                                    })
                                  });
                                  sendSuccess = sendResponse.ok;
                                  if (!sendSuccess) {
                                    console.error('🤖 Failed to send AI message part:', await sendResponse.text());
                                  }
                                }
                                
                                if (sendSuccess) {
                                  console.log(`🤖 AI message part ${partIndex + 1}/${messageParts.length} sent successfully`);
                                  await supabase
                                    .from('whatsapp_messages')
                                    .update({ status: 'sent' })
                                    .eq('wa_message_id', aiMessageId);
                                } else {
                                  await supabase
                                    .from('whatsapp_messages')
                                    .update({ status: 'failed' })
                                    .eq('wa_message_id', aiMessageId);
                                }
                              } catch (sendError) {
                                console.error('🤖 Error sending AI message part:', sendError);
                                await supabase
                                  .from('whatsapp_messages')
                                  .update({ status: 'failed' })
                                  .eq('wa_message_id', aiMessageId);
                              }
                              
                              // Small delay between parts to simulate typing
                              if (partIndex < messageParts.length - 1) {
                                await new Promise(r => setTimeout(r, 1500));
                              }
                            }
                            
                            // ============== SEND DETECTED MEDIA FILES ==============
                            if (detectedMediaIds.length > 0 && sessionData?.baileys_server_url) {
                              for (const mediaId of detectedMediaIds) {
                                const mediaItem = mediaList.find((m: any) => m.id === mediaId);
                                if (!mediaItem) {
                                  console.log(`🤖📸 Media ID ${mediaId} not found in agent media list`);
                                  continue;
                                }
                                
                                console.log(`🤖📸 Sending media: ${mediaItem.file_name} (${mediaItem.file_type})`);
                                const mediaMsgId = `ai-media-${Date.now()}-${Math.random().toString(36).substring(7)}`;
                                
                                try {
                                  const mediaType = mediaItem.file_type === 'image' ? 'image' : 
                                                    mediaItem.file_type === 'video' ? 'video' : 'document';
                                  
                                  const sendMediaResp = await compatFetch(`${sessionData.baileys_server_url}/api/message/send-media`, {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({
                                      instanceName: sessionData.instance_name,
                                      jid: sendJid,
                                      mediaUrl: mediaItem.file_url,
                                      mediaType: mediaType,
                                      caption: '',
                                    }),
                                  });
                                  
                                  const mediaSent = sendMediaResp.ok;
                                  console.log(`🤖📸 Media send result: ${mediaSent ? 'success' : 'failed'}`);
                                  
                                  // Save media message to DB
                                  await supabase.from('whatsapp_messages').insert({
                                    conversation_id: conversation.id,
                                    session_id: targetSessionId,
                                    company_id: companyId,
                                    wa_message_id: mediaMsgId,
                                    from_me: true,
                                    content: `[${mediaType === 'image' ? 'Imagem' : mediaType === 'video' ? 'Vídeo' : 'Documento'}]`,
                                    message_type: mediaType,
                                    media_url: mediaItem.file_url,
                                    status: mediaSent ? 'sent' : 'failed',
                                    is_ai_response: true,
                                    sender_name: agent.name,
                                    timestamp: new Date().toISOString(),
                                  });
                                  
                                  if (!mediaSent) {
                                    // Fallback: send URL as text
                                    await compatFetch(`${sessionData.baileys_server_url}/api/message/send`, {
                                      method: 'POST',
                                      headers: { 'Content-Type': 'application/json' },
                                      body: JSON.stringify({
                                        instanceName: sessionData.instance_name,
                                        jid: sendJid,
                                        message: { text: mediaItem.file_url }
                                      }),
                                    });
                                  }
                                  
                                  // Small delay between media sends
                                  await new Promise(r => setTimeout(r, 1000));
                                } catch (mediaErr) {
                                  console.error(`🤖📸 Error sending media ${mediaId}:`, mediaErr);
                                }
                              }
                            }
                            // ============== END SEND MEDIA ==============
                            
                            // Update conversation last message
                            const convUpdate: Record<string, unknown> = {
                              last_message: shouldSendAudio ? '🎙️ Áudio' : messageParts[messageParts.length - 1].substring(0, 100),
                              last_message_at: new Date().toISOString()
                            };
                            
                            // If handoff was triggered, disable AI auto-reply
                            if (isHandoff) {
                              convUpdate.ai_auto_reply_enabled = false;
                              convUpdate.assigned_agent_id = null;
                              convUpdate.pipeline_stage = 'aguardando'; // Handoff = awaiting human
                              console.log('🤖🔄 HANDOFF: AI auto-reply DISABLED for conversation:', conversation.id);
                            }
                            
                            // Update pipeline stage ONLY when the AI explicitly
                            // decides via the [STAGE:xxx] tag. No deterministic
                            // fallback — the user requested that columns only
                            // change on real AI decisions or manual drag.
                            if (!isHandoff && detectedStage && detectedStage !== conversation.pipeline_stage) {
                              convUpdate.pipeline_stage = detectedStage;
                              console.log(
                                `📊 AI moved pipeline_stage to: ${detectedStage} ` +
                                `(prev=${conversation.pipeline_stage ?? 'null'})`
                              );
                            }
                            
                            await supabase
                              .from('whatsapp_conversations')
                              .update(convUpdate)
                              .eq('id', conversation.id);
                          }
                        }
                      } else {
                        console.error('🤖 AI chat error:', await aiResponse.text());
                      }
                    }
                  }
                } catch (aiError) {
                  console.error('🤖 AI auto-reply error:', aiError);
                }
              }
            }
          } else {
            // Insert without wa_message_id (for messages without IDs)
            const { error: msgError } = await supabase
              .from('whatsapp_messages')
              .insert(messageData);
            
            if (msgError) {
              console.error(`Message insert error:`, msgError.message);
            } else {
              console.log(`Message inserted: ${content.substring(0, 50)}...`);
              if (autopilotParentChannel && !fromMe && autopilotParentPhone) {
                console.log(`[PILOTO-PAI] Incoming owner guidance without message ID routed only to Piloto for parent conversation ${conversation?.id}`);
                dispatchAutopilotParentReply({
                  supabaseUrl: SUPABASE_URL,
                  serviceRoleKey: SUPABASE_SERVICE_ROLE_KEY,
                  companyId,
                  parentPhone: autopilotParentPhone,
                  messageContent: content,
                  messageType,
                  mediaUrl,
                });
              }
            }
          }
        }
        break;
      }

      // ==================== MESSAGE STATUS UPDATE ====================
      case 'messages.update': {
        const updates = data?.updates || [];
        console.log(`[MSG UPDATE] Processing ${updates.length} updates`);
        
        // Get session context for unread count updates
        let targetSessionId = sessionId;
        let companyId = '';
        
        if (!targetSessionId && instanceName) {
          const { data: session } = await supabase
            .from('whatsapp_sessions')
            .select('id, company_id')
            .eq('instance_name', instanceName)
            .single();
          
          if (session) {
            targetSessionId = session.id;
            companyId = session.company_id;
          }
        } else if (targetSessionId) {
          const { data: session } = await supabase
            .from('whatsapp_sessions')
            .select('company_id')
            .eq('id', targetSessionId)
            .single();
          
          if (session) companyId = session.company_id;
        }
        
        for (const update of updates) {
          const messageId = update.key?.id;
          const remoteJid = update.key?.remoteJid;
          const status = update.update?.status;
          
          if (messageId && status !== undefined) {
            // Map status numbers to strings
            const statusMap: Record<number, string> = {
              0: 'error',
              1: 'pending',
              2: 'sent',
              3: 'delivered',
              4: 'read',
              5: 'played'
            };
            
            const statusStr = typeof status === 'number' ? statusMap[status] || 'unknown' : status;
            
            console.log(`[MSG UPDATE] ${messageId} -> ${statusStr}, jid: ${remoteJid}`);
            
            // Update message status
            await supabase
              .from('whatsapp_messages')
              .update({ status: statusStr })
              .eq('wa_message_id', messageId);
            
            // ============== CRITICAL: Reset unread_count when messages are read ==============
            // When status is 'read' (4) or 'played' (5), it means INCOMING messages were read
            // This happens when the user views messages on their phone
            if ((statusStr === 'read' || statusStr === 'played') && remoteJid && companyId) {
              // Extract phone number from JID
              const phoneNumber = remoteJid
                .replace('@s.whatsapp.net', '')
                .replace('@g.us', '')
                .replace('@c.us', '')
                .replace(/\D/g, '');
              
              if (phoneNumber) {
                console.log(`[MSG UPDATE] Resetting unread_count for conversation with ${phoneNumber}`);
                
                await supabase
                  .from('whatsapp_conversations')
                  .update({ unread_count: 0 })
                  .eq('company_id', companyId)
                  .eq('contact_phone', phoneNumber);
              }
            }
          }
        }
        break;
      }

      // ==================== CONTACTS SYNC ====================
      case 'contacts.set':
      case 'contacts.update':
      case 'contacts.upsert': {
        const contacts = Array.isArray(data) ? data : (data?.contacts || (data ? [data] : []));
        console.log(`[CONTACTS] Processing ${contacts.length} contacts for session ${sessionId || instanceName}`);

        // Get session info
        let targetSessionId = sessionId;
        let companyId = '';

        if (!targetSessionId && instanceName) {
          const { data: session } = await supabase
            .from('whatsapp_sessions')
            .select('id, company_id')
            .eq('instance_name', instanceName)
            .single();

          if (session) {
            targetSessionId = session.id;
            companyId = session.company_id;
          }
        } else if (targetSessionId) {
          const { data: session } = await supabase
            .from('whatsapp_sessions')
            .select('company_id')
            .eq('id', targetSessionId)
            .single();

          if (session) companyId = session.company_id;
        }

        if (!companyId) break;

        let upserted = 0;
        for (const contact of contacts) {
          try {
            const jid = contact.id || contact.jid;
            if (!jid) continue;

            // Ignore groups here; whatsapp_contacts é só para pessoas/negócios
            if (isGroupJid(jid)) continue;

            const phoneNumber = extractPhoneFromJid(jid, false);
            if (!phoneNumber) continue;

            const pushName = (contact.name || contact.notify || contact.verifiedName || '').trim();
            const profilePicture = (contact.imgUrl || contact.profilePicture || null) as string | null;

            // Preserve existing values (never overwrite with empty)
            const { data: existingContact } = await supabase
              .from('whatsapp_contacts')
              .select('push_name, profile_picture, business_name, is_business')
              .eq('company_id', companyId)
              .eq('wa_id', jid)
              .maybeSingle();

            const upsertData: Record<string, unknown> = {
              company_id: companyId,
              session_id: targetSessionId,
              wa_id: jid,
              phone_number: phoneNumber,
              is_business: contact.isBusiness ?? existingContact?.is_business ?? false,
            };

            // push_name
            if (pushName && pushName !== phoneNumber) {
              upsertData.push_name = pushName;
            } else if (existingContact?.push_name) {
              upsertData.push_name = existingContact.push_name;
            } else {
              upsertData.push_name = null;
            }

            // profile_picture
            if (profilePicture && profilePicture.trim()) {
              upsertData.profile_picture = profilePicture;
            } else if (existingContact?.profile_picture) {
              upsertData.profile_picture = existingContact.profile_picture;
            }

            // business_name (quando disponível)
            const businessName = (contact.businessName || contact.business_name || '').trim();
            if (businessName) {
              upsertData.business_name = businessName;
            } else if (existingContact?.business_name) {
              upsertData.business_name = existingContact.business_name;
            }

            const { error: upsertError } = await supabase
              .from('whatsapp_contacts')
              .upsert(upsertData, { onConflict: 'company_id,wa_id' });

            if (upsertError) {
              console.error('[CONTACTS] Upsert error:', upsertError);
              continue;
            }
            upserted++;

            // Also update conversation name if exists AND we have a valid name AND conv name is empty
            if (pushName && pushName !== phoneNumber) {
              const { data: conv } = await supabase
                .from('whatsapp_conversations')
                .select('id, contact_name')
                .eq('company_id', companyId)
                .eq('contact_phone', phoneNumber)
                .maybeSingle();

              if (conv && (!conv.contact_name || conv.contact_name === phoneNumber)) {
                await supabase
                  .from('whatsapp_conversations')
                  .update({ contact_name: pushName })
                  .eq('id', conv.id);
              }
            }
          } catch (e) {
            console.error('[CONTACTS] Contact processing error:', e);
          }
        }

        console.log(`[CONTACTS] Upserted ${upserted}/${contacts.length}`);
        break;
      }

      // ==================== SYNC CONTACT (Manual Refresh) ====================
      case 'sync.contact': {
        const { jid, phone, isGroup, name, profilePicture, groupDescription, groupParticipants } = data || {};
        
        console.log(`[SYNC.CONTACT] Processing: ${jid}, name: ${name}, hasPic: ${!!profilePicture}`);
        
        // Get session info
        let targetSessionId = sessionId;
        let companyId = '';
        
        if (!targetSessionId && instanceName) {
          const { data: session } = await supabase
            .from('whatsapp_sessions')
            .select('id, company_id')
            .eq('instance_name', instanceName)
            .single();
          
          if (session) {
            targetSessionId = session.id;
            companyId = session.company_id;
          }
        } else if (targetSessionId) {
          const { data: session } = await supabase
            .from('whatsapp_sessions')
            .select('company_id')
            .eq('id', targetSessionId)
            .single();
          
          if (session) companyId = session.company_id;
        }
        
        if (!companyId || !phone) {
          console.log('[SYNC.CONTACT] Missing companyId or phone');
          break;
        }
        
        // Update conversation with new photo and name
        const updateData: Record<string, unknown> = {};
        
        if (profilePicture) {
          updateData.profile_picture = profilePicture;
        }
        if (name && name !== phone) {
          updateData.contact_name = name;
        }
        
        if (Object.keys(updateData).length > 0) {
          const { error } = await supabase
            .from('whatsapp_conversations')
            .update(updateData)
            .eq('company_id', companyId)
            .eq('contact_phone', phone);
          
          if (error) {
            console.error('[SYNC.CONTACT] Update error:', error);
          } else {
            console.log(`[SYNC.CONTACT] Updated ${phone}:`, updateData);
          }
        }
        
        // Also update whatsapp_contacts table
        const { data: existingContact } = await supabase
          .from('whatsapp_contacts')
          .select('id, push_name, profile_picture')
          .eq('company_id', companyId)
          .eq('wa_id', jid)
          .maybeSingle();
        
        const contactUpsert: Record<string, unknown> = {
          company_id: companyId,
          wa_id: jid,
          phone_number: phone
        };
        
        if (name && name !== phone) {
          contactUpsert.push_name = name;
        } else if (existingContact?.push_name) {
          contactUpsert.push_name = existingContact.push_name;
        }
        
        if (profilePicture) {
          contactUpsert.profile_picture = profilePicture;
        } else if (existingContact?.profile_picture) {
          contactUpsert.profile_picture = existingContact.profile_picture;
        }
        
        await supabase
          .from('whatsapp_contacts')
          .upsert(contactUpsert, { onConflict: 'company_id,wa_id' });
        
        break;
      }

      default:
        console.log(`Unhandled event: ${event}`);
    }

    return new Response(JSON.stringify({ success: true, event }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
    
  } catch (error: any) {
    console.error('Webhook error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
