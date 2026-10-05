import { createClient } from "npm:@supabase/supabase-js@2";
import { decode as decodeBase64 } from "https://deno.land/std@0.168.0/encoding/base64.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, ycloud-signature',
};

const YCLOUD_BASE = 'https://api.ycloud.com/v2';

const normalizePhone = (phone: string | null | undefined): string => {
  const digits = (phone || '').replace(/\D/g, '');
  if (!digits) return '';

  if (digits.startsWith('55') && digits.length === 12) {
    return `+${digits.slice(0, 4)}9${digits.slice(4)}`;
  }

  if (!digits.startsWith('55') && digits.length === 10) {
    return `+55${digits.slice(0, 2)}9${digits.slice(2)}`;
  }

  if (!digits.startsWith('55') && digits.length === 11) {
    return `+55${digits}`;
  }

  return `+${digits}`;
};

/**
 * Parse Brazilian date/time from natural language text.
 * Supports: "segunda 15:00", "28/03 às 10:30", "amanhã 14h", "hoje 16:00"
 */
function parseBrazilianDateTime(text: string): Date | null {
  const now = new Date();
  // Use São Paulo timezone offset (UTC-3)
  const spNow = new Date(now.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
  
  let targetDate: Date | null = null;

  // Extract time first
  const timeMatch = text.match(/(\d{1,2})[h:](\d{2})?/i);
  let hours = timeMatch ? parseInt(timeMatch[1]) : null;
  let minutes = timeMatch && timeMatch[2] ? parseInt(timeMatch[2]) : 0;

  if (hours === null) return null;
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;

  // Check for "hoje" (today)
  if (/hoje/i.test(text)) {
    targetDate = new Date(spNow);
  }
  // Check for "amanhã" (tomorrow)
  else if (/amanh[aã]/i.test(text)) {
    targetDate = new Date(spNow);
    targetDate.setDate(targetDate.getDate() + 1);
  }
  // Check for day of week
  else {
    const weekdays: Record<string, number> = {
      'domingo': 0, 'dom': 0,
      'segunda': 1, 'seg': 1,
      'terça': 2, 'terca': 2, 'ter': 2,
      'quarta': 3, 'qua': 3,
      'quinta': 4, 'qui': 4,
      'sexta': 5, 'sex': 5,
      'sábado': 6, 'sabado': 6, 'sab': 6,
    };
    
    const lower = text.toLowerCase();
    for (const [name, dayNum] of Object.entries(weekdays)) {
      if (lower.includes(name)) {
        targetDate = new Date(spNow);
        const currentDay = spNow.getDay();
        let diff = dayNum - currentDay;
        if (diff <= 0) diff += 7;
        targetDate.setDate(targetDate.getDate() + diff);
        break;
      }
    }
  }

  // Check for dd/mm format
  if (!targetDate) {
    const dateMatch = text.match(/(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?/);
    if (dateMatch) {
      const day = parseInt(dateMatch[1]);
      const month = parseInt(dateMatch[2]) - 1;
      const year = dateMatch[3] ? (dateMatch[3].length === 2 ? 2000 + parseInt(dateMatch[3]) : parseInt(dateMatch[3])) : spNow.getFullYear();
      targetDate = new Date(year, month, day);
      if (targetDate < spNow) {
        targetDate.setFullYear(targetDate.getFullYear() + 1);
      }
    }
  }

  if (!targetDate) return null;

  // Set time in São Paulo timezone (approximate by setting directly)
  targetDate.setHours(hours, minutes, 0, 0);
  
  // Convert from São Paulo local to UTC
  // São Paulo is UTC-3
  const utcDate = new Date(targetDate.getTime() + 3 * 60 * 60 * 1000);
  
  return utcDate;
}

/**
 * Downloads media from YCloud's temporary URL and uploads to Supabase Storage.
 * Returns the persistent public URL or null if download/upload fails.
 */
async function downloadAndStoreMedia(
  supabase: any,
  mediaLink: string,
  mediaType: string,
  mimeType: string,
  sessionId: string,
): Promise<string | null> {
  if (!mediaLink) return null;

  try {
    console.log(`[ycloud-webhook] 📥 Downloading ${mediaType} from YCloud:`, mediaLink.substring(0, 80));

    const res = await fetch(mediaLink);
    if (!res.ok) {
      console.error(`[ycloud-webhook] ❌ Failed to download media: ${res.status}`);
      return null;
    }

    const buffer = await res.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    if (bytes.length === 0) {
      console.error('[ycloud-webhook] ❌ Downloaded media is empty');
      return null;
    }

    // Determine file extension from mime
    const extMap: Record<string, string> = {
      'audio/ogg': 'ogg', 'audio/mpeg': 'mp3', 'audio/mp3': 'mp3',
      'audio/mp4': 'm4a', 'audio/aac': 'aac', 'audio/amr': 'amr',
      'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp',
      'video/mp4': 'mp4', 'video/3gpp': '3gp',
      'application/pdf': 'pdf',
    };
    const ext = extMap[mimeType.split(';')[0].trim().toLowerCase()] || 'bin';
    const fileName = `ycloud/${sessionId}/${mediaType}/${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${ext}`;

    const contentType = mimeType.split(';')[0].trim() || 'application/octet-stream';

    const { data, error } = await supabase.storage
      .from('whatsapp-media')
      .upload(fileName, bytes, { contentType, upsert: false });

    if (error) {
      console.error('[ycloud-webhook] ❌ Supabase upload error:', error.message);
      return null;
    }

    const { data: urlData } = supabase.storage.from('whatsapp-media').getPublicUrl(fileName);
    console.log(`[ycloud-webhook] ✅ Media stored: ${urlData.publicUrl}`);
    return urlData.publicUrl;
  } catch (e) {
    console.error('[ycloud-webhook] ❌ Media download/upload error:', e);
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    const body = await req.json();
    console.log('[ycloud-webhook] Event received:', body.type);

    // Handle inbound messages
    if (body.type === 'whatsapp.inbound_message.received') {
      const inbound = body.whatsappInboundMessage;
      if (!inbound) {
        console.log('[ycloud-webhook] No inbound message data');
        return new Response('OK', { status: 200, headers: corsHeaders });
      }

      const fromPhone = inbound.from;
      const toPhone = inbound.to;
      const messageType = inbound.type || 'text';
      let content = '';
      let mediaUrl = '';

      let mediaMimeType = '';

      switch (messageType) {
        case 'text':
          content = inbound.text?.body || '';
          break;
        case 'image':
          content = inbound.image?.caption || '[Imagem]';
          mediaUrl = inbound.image?.link || '';
          mediaMimeType = inbound.image?.mime_type || 'image/jpeg';
          break;
        case 'video':
          content = inbound.video?.caption || '[Vídeo]';
          mediaUrl = inbound.video?.link || '';
          mediaMimeType = inbound.video?.mime_type || 'video/mp4';
          break;
        case 'audio':
          content = '[Áudio]';
          mediaUrl = inbound.audio?.link || '';
          mediaMimeType = inbound.audio?.mime_type || 'audio/ogg';
          break;
        case 'document':
          content = inbound.document?.filename || '[Documento]';
          mediaUrl = inbound.document?.link || '';
          mediaMimeType = inbound.document?.mime_type || 'application/octet-stream';
          break;
        case 'location': {
          const lat = inbound.location?.latitude || 0;
          const lng = inbound.location?.longitude || 0;
          const locName = inbound.location?.name || '';
          const locAddr = inbound.location?.address || '';
          content = JSON.stringify({ type: 'location', latitude: lat, longitude: lng, name: locName, address: locAddr });
          break;
        }
        case 'sticker':
          content = '[Sticker]';
          mediaUrl = inbound.sticker?.link || '';
          break;
        case 'contacts': {
          const contactsList = (inbound.contacts || []).map((c: any) => ({
            name: c.name?.formatted_name || c.name?.first_name || 'Sem nome',
            phones: (c.phones || []).map((p: any) => p.phone || p.wa_id),
            emails: (c.emails || []).map((e: any) => e.email),
          }));
          content = JSON.stringify({ type: 'contacts', contacts: contactsList });
          break;
        }
        case 'interactive': {
          const interactiveType = inbound.interactive?.type;
          if (interactiveType === 'button_reply') {
            content = inbound.interactive?.button_reply?.title || '[Resposta de botão]';
          } else if (interactiveType === 'list_reply') {
            content = inbound.interactive?.list_reply?.title || '[Resposta de lista]';
          } else {
            content = inbound.interactive?.body?.text || '[Interativo]';
          }
          break;
        }
        case 'reaction': {
          const emoji = inbound.reaction?.emoji || '';
          const reactedMsgId = inbound.reaction?.message_id || '';
          content = emoji ? `[Reação: ${emoji}]` : '[Reação removida]';
          
          if (reactedMsgId) {
            console.log(`[REACTION] Updating target message ${reactedMsgId} with emoji ${emoji || '(removed)'}`);
            try {
              const { error: reactionError } = await supabase
                .from('ycloud_messages')
                .update({ reaction: emoji || null })
                .eq('ycloud_message_id', reactedMsgId)
                .eq('company_id', session.company_id);
                
              if (reactionError) {
                console.error(`[REACTION] Error updating message:`, reactionError.message);
              }
            } catch (reErr) {
              console.error(`[REACTION] Exception:`, reErr);
            }
          }
          break;
        }
        case 'order':
          content = '[Pedido recebido]';
          break;
        default:
          if (messageType === 'unsupported') {
            const firstError = Array.isArray(inbound.errors) ? inbound.errors[0] : null;
            const errorDetails = String(
              firstError?.errorDataDetails ||
              firstError?.error_data?.details ||
              firstError?.message ||
              ''
            ).toLowerCase();

            if (firstError?.code === 131060 || errorDetails.includes('unavailable')) {
              // Meta doesn't support some message types (animated stickers, polls, etc.)
              content = '[Sticker ou mídia não suportada pela API]';
              // Store as sticker type for better UI
            } else {
              content = '[Mensagem não suportada]';
            }
          } else {
            content = `[${messageType}]`;
          }
      }

      // Find session
      const cleanTo = toPhone?.replace(/\D/g, '') || '';
      const phoneVariants = [toPhone, cleanTo, `+${cleanTo}`];

      let session: any = null;
      if (inbound.wabaId) {
        const { data: wabaSession } = await supabase
          .from('ycloud_sessions')
          .select('*')
          .eq('waba_id', inbound.wabaId)
          .eq('status', 'active')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        session = wabaSession;
      }

      if (!session) {
        const { data: phoneSession } = await supabase
          .from('ycloud_sessions')
          .select('*')
          .eq('status', 'active')
          .in('phone_number', phoneVariants)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        session = phoneSession;
      }

      if (!session) {
        console.log(`[ycloud-webhook] No session found for phone ${toPhone} or wabaId ${inbound.wabaId}`);
        return new Response('OK', { status: 200, headers: corsHeaders });
      }

      return await processInbound(supabase, session, fromPhone, content, messageType, mediaUrl, mediaMimeType, inbound, body, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    }

    // Handle message status updates
    if (body.type === 'whatsapp.message.updated') {
      const msg = body.whatsappMessage;
      if (msg?.id) {
        const updateData: Record<string, unknown> = { status: msg.status };
        if (msg.status === 'failed') {
          updateData.raw_payload = msg;
        }
        await supabase
          .from('ycloud_messages')
          .update(updateData)
          .eq('ycloud_message_id', msg.id);
        console.log(`[ycloud-webhook] Updated message ${msg.id} status to ${msg.status}`);
      }
    }

    return new Response('OK', { status: 200, headers: corsHeaders });
  } catch (e) {
    console.error('[ycloud-webhook] Error:', e);
    return new Response('Error', { status: 500, headers: corsHeaders });
  }
});

async function processInbound(
  supabase: any,
  session: any,
  fromPhone: string,
  content: string,
  messageType: string,
  mediaUrl: string,
  mediaMimeType: string,
  inbound: any,
  rawEvent: any,
  SUPABASE_URL: string,
  SUPABASE_SERVICE_ROLE_KEY: string,
) {
  // Download media from YCloud and store in Supabase Storage for persistent access
  let persistentMediaUrl = mediaUrl;
  if (mediaUrl && ['image', 'audio', 'video', 'document', 'sticker'].includes(messageType)) {
    const stored = await downloadAndStoreMedia(supabase, mediaUrl, messageType, mediaMimeType, session.id);
    if (stored) {
      persistentMediaUrl = stored;
    } else {
      console.log('[ycloud-webhook] ⚠️ Could not persist media, keeping original URL');
    }
  }
  const normalizedFromPhone = normalizePhone(fromPhone);
  const contactName = inbound.customerProfile?.name || inbound.contacts?.[0]?.profile?.name || normalizedFromPhone;
  
  // Try to get profile picture from Baileys WhatsApp conversations (same company)
  let profilePicture: string | null = null;
  try {
    const digits = normalizedFromPhone.replace(/\D/g, '');
    const phoneVariants = [
      normalizedFromPhone,
      `+${digits}`,
      digits.length === 13 && digits.startsWith('55') ? `+${digits.slice(0, 4)}${digits.slice(5)}` : null,
      digits.length === 12 && digits.startsWith('55') ? `+${digits.slice(0, 4)}9${digits.slice(4)}` : null,
    ].filter(Boolean);
    
    const { data: wpConv } = await supabase
      .from('whatsapp_conversations')
      .select('profile_picture')
      .eq('company_id', session.company_id)
      .in('contact_phone', phoneVariants)
      .not('profile_picture', 'is', null)
      .limit(1)
      .maybeSingle();
    
    if (wpConv?.profile_picture) {
      profilePicture = wpConv.profile_picture;
    }
  } catch {}

  // Upsert conversation
  const upsertData: Record<string, unknown> = {
    session_id: session.id,
    company_id: session.company_id,
    contact_phone: normalizedFromPhone,
    contact_name: contactName,
    last_message: (() => {
      // Friendly preview for structured types
      if (messageType === 'location') return '📍 Localização';
      if (messageType === 'contacts') return '👤 Contato compartilhado';
      if (messageType === 'reaction') {
        try { return JSON.parse(content).emoji || '❤️'; } catch { return '❤️'; }
      }
      if (messageType === 'order') return '🛒 Pedido';
      return content.substring(0, 200);
    })(),
    last_message_at: new Date().toISOString(),
  };
  
  // Add profile picture if found from Baileys
  if (profilePicture) {
    upsertData.profile_picture = profilePicture;
  }

  const { data: conv } = await supabase
    .from('ycloud_conversations')
    .upsert(upsertData, { onConflict: 'session_id,contact_phone' })
    .select()
    .single();

  if (!conv) {
    return new Response('OK', { status: 200, headers: { 'Content-Type': 'text/plain' } });
  }

  // Increment unread
  await supabase
    .from('ycloud_conversations')
    .update({ unread_count: (conv.unread_count || 0) + 1 })
    .eq('id', conv.id);

  // Insert message - use YCloud's timestamp for proper ordering
  const messageTimestamp = inbound.createTime || inbound.timestamp || rawEvent.createTime || new Date().toISOString();
  await supabase.from('ycloud_messages').insert({
    conversation_id: conv.id,
    company_id: session.company_id,
    ycloud_message_id: inbound.id,
    wamid: inbound.wamid,
    from_me: false,
    content,
    message_type: messageType,
    media_url: persistentMediaUrl || null,
    status: 'received',
    raw_payload: rawEvent,
    created_at: messageTimestamp,
  });

  console.log(`[ycloud-webhook] Saved inbound from ${fromPhone}: ${content.substring(0, 50)}`);

  // ============== RSVP BUTTON REPLY ==============
  const buttonId = inbound.interactive?.button_reply?.id;
  if (messageType === 'interactive' && (buttonId === 'rsvp_yes' || buttonId === 'rsvp_no')) {
    const rsvpStatus = buttonId === 'rsvp_yes' ? 'confirmed' : 'declined';
    const normalizedPhone = normalizePhone(fromPhone).replace(/\D/g, '');
    const phoneVariants = [normalizedPhone];
    if (normalizedPhone.startsWith('55') && normalizedPhone.length === 13) {
      phoneVariants.push(normalizedPhone.slice(0, 4) + normalizedPhone.slice(5));
    }
    if (normalizedPhone.startsWith('55') && normalizedPhone.length === 12) {
      phoneVariants.push(normalizedPhone.slice(0, 4) + '9' + normalizedPhone.slice(4));
    }

    const { data: rsvp } = await supabase
      .from('meeting_rsvp')
      .select('id, event_id')
      .eq('company_id', session.company_id)
      .in('attendee_phone', phoneVariants)
      .in('status', ['pending', 'reminded'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (rsvp) {
      await supabase.from('meeting_rsvp')
        .update({ status: rsvpStatus, responded_at: new Date().toISOString() })
        .eq('id', rsvp.id);

      // Get full event details for confirmation message
      const { data: event } = await supabase
        .from('calendar_events')
        .select('attendees, title, start_date, created_by, company_id')
        .eq('id', rsvp.event_id)
        .single();

      if (event?.attendees && Array.isArray(event.attendees)) {
        const updatedAttendees = (event.attendees as any[]).map((a: any) => {
          const aPhone = (a.phone || '').replace(/\D/g, '');
          if (phoneVariants.includes(aPhone)) {
            return { ...a, status: rsvpStatus };
          }
          return a;
        });
        await supabase.from('calendar_events')
          .update({ attendees: updatedAttendees })
          .eq('id', rsvp.event_id);
      }

      // Send confirmation/decline message back to the contact
      try {
        const contactName = inbound.customerProfile?.name || conv.contact_name || fromPhone;
        const eventTitle = event?.title || 'Reunião';
        const eventDate = event?.start_date 
          ? new Date(event.start_date).toLocaleString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' })
          : '';

        if (rsvpStatus === 'confirmed') {
          const confirmMsg = `✅ *Presença Confirmada!*\n\nObrigado, ${contactName}! Sua presença na reunião *${eventTitle}* foi confirmada.\n\n📅 ${eventDate}\n\nNos vemos lá! 🎉`;

          const formattedFrom = session.phone_number.startsWith('+') ? session.phone_number : `+${session.phone_number.replace(/\D/g, '')}`;
          const sendRes = await fetch(`${YCLOUD_BASE}/whatsapp/messages/sendDirectly`, {
            method: 'POST',
            headers: { 'X-API-Key': session.ycloud_api_key, 'Content-Type': 'application/json' },
            body: JSON.stringify({ from: formattedFrom, to: normalizePhone(fromPhone), type: 'text', text: { body: confirmMsg } }),
          });
          const sendData = await sendRes.json();

          await supabase.from('ycloud_messages').insert({
            conversation_id: conv.id, company_id: session.company_id,
            ycloud_message_id: sendData?.id || `rsvp-reply-${Date.now()}`,
            wamid: sendData?.wamid || null, from_me: true, content: confirmMsg,
            message_type: 'text', status: sendRes.ok ? 'sent' : 'failed',
          });

          await supabase.from('ycloud_conversations')
            .update({ last_message: confirmMsg.substring(0, 100), last_message_at: new Date().toISOString() })
            .eq('id', conv.id);

          // Notify creator
          if (event?.created_by) {
            await supabase.from('notifications').insert({
              user_id: event.created_by, company_id: event.company_id,
              title: 'Presença confirmada',
              message: `${conv.contact_name || fromPhone} confirmou presença ✅ na reunião "${event.title || 'Reunião'}"`,
              type: 'success', category: 'calendar', icon: 'Calendar',
              action_url: '/dashboard/agenda',
              metadata: { event_id: rsvp.event_id, rsvp_status: rsvpStatus },
            });
          }
        } else {
          // DECLINED — ask if they want to reschedule
          const rescheduleMsg = `❌ *Presença Recusada*\n\nEntendido, ${contactName}. Registramos que você não poderá participar da reunião *${eventTitle}*.\n\n📅 ${eventDate}\n\nGostaria de *reagendar* para outro dia e horário?`;

          const formattedFrom = session.phone_number.startsWith('+') ? session.phone_number : `+${session.phone_number.replace(/\D/g, '')}`;
          const sendRes = await fetch(`${YCLOUD_BASE}/whatsapp/messages/sendDirectly`, {
            method: 'POST',
            headers: { 'X-API-Key': session.ycloud_api_key, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              from: formattedFrom, to: normalizePhone(fromPhone),
              type: 'interactive',
              interactive: {
                type: 'button',
                body: { text: rescheduleMsg },
                action: {
                  buttons: [
                    { type: 'reply', reply: { id: `reschedule_yes_${rsvp.event_id}`, title: '✅ Sim, reagendar' } },
                    { type: 'reply', reply: { id: `reschedule_no_${rsvp.event_id}`, title: '❌ Não, obrigado' } },
                  ],
                },
              },
            }),
          });
          const sendData = await sendRes.json();

          await supabase.from('ycloud_messages').insert({
            conversation_id: conv.id, company_id: session.company_id,
            ycloud_message_id: sendData?.id || `rsvp-reschedule-${Date.now()}`,
            wamid: sendData?.wamid || null, from_me: true, content: rescheduleMsg,
            message_type: 'interactive', status: sendRes.ok ? 'sent' : 'failed',
          });

          await supabase.from('ycloud_conversations')
            .update({ last_message: rescheduleMsg.substring(0, 100), last_message_at: new Date().toISOString() })
            .eq('id', conv.id);

          // Notify creator about decline
          if (event?.created_by) {
            await supabase.from('notifications').insert({
              user_id: event.created_by, company_id: event.company_id,
              title: 'Presença recusada',
              message: `${conv.contact_name || fromPhone} recusou o convite ❌ na reunião "${event.title || 'Reunião'}"`,
              type: 'warning', category: 'calendar', icon: 'Calendar',
              action_url: '/dashboard/agenda',
              metadata: { event_id: rsvp.event_id, rsvp_status: rsvpStatus },
            });
          }
        }

        console.log(`[ycloud-webhook] ✅ RSVP reply sent to ${fromPhone}`);
      } catch (replyErr) {
        console.error('[ycloud-webhook] ❌ Failed to send RSVP reply:', replyErr);
      }

      console.log(`[ycloud-webhook] 📋 RSVP ${rsvpStatus} for ${fromPhone}`);
    }
  }

  // ============== RESCHEDULE FLOW ==============
  if (messageType === 'interactive' && buttonId?.startsWith('reschedule_')) {
    const isYes = buttonId.startsWith('reschedule_yes_');
    const eventId = buttonId.replace(/^reschedule_(yes|no)_/, '');
    const formattedFrom = session.phone_number.startsWith('+') ? session.phone_number : `+${session.phone_number.replace(/\D/g, '')}`;

    if (!isYes) {
      // User doesn't want to reschedule — thank them
      const thankMsg = `Tudo bem! 😊 Obrigado pela resposta. Se precisar de algo, é só chamar!`;
      const sendRes = await fetch(`${YCLOUD_BASE}/whatsapp/messages/sendDirectly`, {
        method: 'POST',
        headers: { 'X-API-Key': session.ycloud_api_key, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: formattedFrom, to: normalizePhone(fromPhone), type: 'text', text: { body: thankMsg } }),
      });
      const sendData = await sendRes.json();
      await supabase.from('ycloud_messages').insert({
        conversation_id: conv.id, company_id: session.company_id,
        ycloud_message_id: sendData?.id || `reschedule-no-${Date.now()}`,
        wamid: sendData?.wamid || null, from_me: true, content: thankMsg,
        message_type: 'text', status: sendRes.ok ? 'sent' : 'failed',
      });
      await supabase.from('ycloud_conversations')
        .update({ last_message: thankMsg, last_message_at: new Date().toISOString() })
        .eq('id', conv.id);
    } else {
      // User wants to reschedule — ask for date and time
      const askDateMsg = `📅 *Reagendamento*\n\nPor favor, informe o *dia e horário* desejado para a nova reunião.\n\nExemplo: _segunda 15:00_ ou _28/03 às 10:30_`;
      const sendRes = await fetch(`${YCLOUD_BASE}/whatsapp/messages/sendDirectly`, {
        method: 'POST',
        headers: { 'X-API-Key': session.ycloud_api_key, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: formattedFrom, to: normalizePhone(fromPhone), type: 'text', text: { body: askDateMsg } }),
      });
      const sendData = await sendRes.json();
      await supabase.from('ycloud_messages').insert({
        conversation_id: conv.id, company_id: session.company_id,
        ycloud_message_id: sendData?.id || `reschedule-ask-${Date.now()}`,
        wamid: sendData?.wamid || null, from_me: true, content: askDateMsg,
        message_type: 'text', status: sendRes.ok ? 'sent' : 'failed',
      });
      await supabase.from('ycloud_conversations')
        .update({ 
          last_message: askDateMsg.substring(0, 100), 
          last_message_at: new Date().toISOString(),
          reschedule_event_id: eventId,
        })
        .eq('id', conv.id);
    }
  }

  // ============== RESCHEDULE DATE PARSER ==============
  if (messageType === 'text' && conv.reschedule_event_id) {
    const eventId = conv.reschedule_event_id;
    const formattedFrom = session.phone_number.startsWith('+') ? session.phone_number : `+${session.phone_number.replace(/\D/g, '')}`;

    // Clear the reschedule flag
    await supabase.from('ycloud_conversations')
      .update({ reschedule_event_id: null })
      .eq('id', conv.id);

    // Parse date/time from user text
    const parsedDate = parseBrazilianDateTime(content);
    
    if (!parsedDate) {
      const errorMsg = `❌ Não consegui entender a data/horário. Por favor, tente novamente com um formato como:\n\n_segunda 15:00_\n_28/03 às 10:30_\n_amanhã 14h_`;
      await fetch(`${YCLOUD_BASE}/whatsapp/messages/sendDirectly`, {
        method: 'POST',
        headers: { 'X-API-Key': session.ycloud_api_key, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: formattedFrom, to: normalizePhone(fromPhone), type: 'text', text: { body: errorMsg } }),
      });
      // Re-set the flag so they can try again
      await supabase.from('ycloud_conversations')
        .update({ reschedule_event_id: eventId })
        .eq('id', conv.id);
      return new Response('OK', { status: 200, headers: corsHeaders });
    }

    // Get original event details
    const { data: origEvent } = await supabase
      .from('calendar_events')
      .select('*')
      .eq('id', eventId)
      .single();

    if (!origEvent) {
      const errMsg = `❌ Não foi possível encontrar a reunião original. Por favor, entre em contato.`;
      await fetch(`${YCLOUD_BASE}/whatsapp/messages/sendDirectly`, {
        method: 'POST',
        headers: { 'X-API-Key': session.ycloud_api_key, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: formattedFrom, to: normalizePhone(fromPhone), type: 'text', text: { body: errMsg } }),
      });
      return new Response('OK', { status: 200, headers: corsHeaders });
    }

    // Calculate duration from original event
    const origStart = new Date(origEvent.start_date);
    const origEnd = new Date(origEvent.end_date);
    const durationMs = origEnd.getTime() - origStart.getTime();
    const newStart = parsedDate;
    const newEnd = new Date(newStart.getTime() + durationMs);

    // Check for calendar conflicts
    const { data: conflicts } = await supabase
      .from('calendar_events')
      .select('id, title, start_date, end_date')
      .eq('company_id', origEvent.company_id)
      .eq('created_by', origEvent.created_by)
      .lt('start_date', newEnd.toISOString())
      .gt('end_date', newStart.toISOString());

    if (conflicts && conflicts.length > 0) {
      const conflictMsg = `⚠️ *Horário indisponível!*\n\nJá existe um compromisso nesse horário:\n📌 *${conflicts[0].title}*\n\nPor favor, sugira outro dia/horário:`;
      await fetch(`${YCLOUD_BASE}/whatsapp/messages/sendDirectly`, {
        method: 'POST',
        headers: { 'X-API-Key': session.ycloud_api_key, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: formattedFrom, to: normalizePhone(fromPhone), type: 'text', text: { body: conflictMsg } }),
      });
      // Re-set the flag
      await supabase.from('ycloud_conversations')
        .update({ reschedule_event_id: eventId })
        .eq('id', conv.id);
      return new Response('OK', { status: 200, headers: corsHeaders });
    }

    // No conflict — create new event
    const dateStr = newStart.toLocaleString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' });

    const { data: newEvent } = await supabase.from('calendar_events').insert({
      company_id: origEvent.company_id,
      created_by: origEvent.created_by,
      title: origEvent.title,
      description: origEvent.description,
      start_date: newStart.toISOString(),
      end_date: newEnd.toISOString(),
      event_type: origEvent.event_type,
      meeting_link: origEvent.meeting_link,
      meeting_code: origEvent.meeting_code,
      meeting_provider: origEvent.meeting_provider,
      color: origEvent.color,
      attendees: origEvent.attendees,
      status: 'scheduled',
    }).select('id').single();

    // Create RSVP for the new event
    if (newEvent) {
      const normalizedPhone = normalizePhone(fromPhone).replace(/\D/g, '');
      await supabase.from('meeting_rsvp').insert({
        event_id: newEvent.id,
        company_id: origEvent.company_id,
        attendee_phone: normalizedPhone,
        attendee_name: conv.contact_name || fromPhone,
        status: 'confirmed',
        responded_at: new Date().toISOString(),
      });
    }

    // Send confirmation
    const successMsg = `✅ *Reunião Reagendada!*\n\n*${origEvent.title}*\n📅 ${dateStr}${origEvent.meeting_link ? `\n🔗 ${origEvent.meeting_link}` : ''}\n\nSua presença foi confirmada automaticamente. Nos vemos lá! 🎉`;
    const sendRes = await fetch(`${YCLOUD_BASE}/whatsapp/messages/sendDirectly`, {
      method: 'POST',
      headers: { 'X-API-Key': session.ycloud_api_key, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: formattedFrom, to: normalizePhone(fromPhone), type: 'text', text: { body: successMsg } }),
    });
    const sendData = await sendRes.json();
    await supabase.from('ycloud_messages').insert({
      conversation_id: conv.id, company_id: session.company_id,
      ycloud_message_id: sendData?.id || `reschedule-done-${Date.now()}`,
      wamid: sendData?.wamid || null, from_me: true, content: successMsg,
      message_type: 'text', status: sendRes.ok ? 'sent' : 'failed',
    });
    await supabase.from('ycloud_conversations')
      .update({ last_message: successMsg.substring(0, 100), last_message_at: new Date().toISOString() })
      .eq('id', conv.id);

    // Notify creator
    if (origEvent.created_by) {
      await supabase.from('notifications').insert({
        user_id: origEvent.created_by, company_id: origEvent.company_id,
        title: 'Reunião reagendada',
        message: `${conv.contact_name || fromPhone} reagendou a reunião "${origEvent.title}" para ${dateStr}`,
        type: 'info', category: 'calendar', icon: 'Calendar',
        action_url: '/dashboard/agenda',
        metadata: { event_id: newEvent?.id, original_event_id: eventId },
      });
    }

    console.log(`[ycloud-webhook] 📅 Meeting rescheduled for ${fromPhone}`);
  }

  // ============== AI AUTO-REPLY ==============
  if (conv.assigned_agent_id && conv.ai_auto_reply_enabled) {
    console.log(`[ycloud-webhook] 🤖 AI auto-reply triggered for conv ${conv.id}`);

    // DEBOUNCE: Check if already thinking (another webhook instance is handling it)
    const { data: currentConv } = await supabase
      .from('ycloud_conversations')
      .select('ai_thinking, ai_thinking_since')
      .eq('id', conv.id)
      .single();

    if (currentConv?.ai_thinking) {
      const thinkingSince = currentConv.ai_thinking_since ? new Date(currentConv.ai_thinking_since).getTime() : 0;
      const elapsed = Date.now() - thinkingSince;
      // If already thinking and started less than 60s ago, skip — the first instance will
      // re-read all messages after the debounce period anyway
      if (elapsed < 60000) {
        // Reset the timer so the first instance waits for this new message too
        await supabase.from('ycloud_conversations')
          .update({ ai_thinking_since: new Date().toISOString() })
          .eq('id', conv.id);
        console.log(`[ycloud-webhook] 🤖 Already thinking, reset timer for new message`);
        return new Response('OK', { status: 200, headers: { 'Content-Type': 'text/plain' } });
      }
    }

    // Set thinking state with timestamp
    await supabase.from('ycloud_conversations')
      .update({ ai_thinking: true, ai_thinking_since: new Date().toISOString() })
      .eq('id', conv.id);

    // Wait 10 seconds to batch multiple rapid messages, then check if more arrived
    await new Promise(resolve => setTimeout(resolve, 10000));

    // Re-check: if ai_thinking_since was updated (new message arrived during wait), wait more
    const { data: recheckConv } = await supabase
      .from('ycloud_conversations')
      .select('ai_thinking_since')
      .eq('id', conv.id)
      .single();
    
    if (recheckConv?.ai_thinking_since) {
      const sinceLast = Date.now() - new Date(recheckConv.ai_thinking_since).getTime();
      // If a new message arrived less than 8 seconds ago, wait a bit more
      if (sinceLast < 8000) {
        const extraWait = 8000 - sinceLast;
        console.log(`[ycloud-webhook] 🤖 New message arrived recently, waiting ${extraWait}ms more`);
        await new Promise(resolve => setTimeout(resolve, extraWait));
      }
    }

    try {
      // Get agent config
      const { data: agent } = await supabase
        .from('ai_agents')
        .select('id, name, personality, instructions, is_active, settings')
        .eq('id', conv.assigned_agent_id)
        .eq('is_active', true)
        .single();

      if (!agent) {
        console.log('[ycloud-webhook] 🤖 Agent not found or inactive');
        await supabase.from('ycloud_conversations')
          .update({ ai_thinking: false, ai_thinking_since: null, assigned_agent_id: null, ai_auto_reply_enabled: false })
          .eq('id', conv.id);
        return new Response('OK', { status: 200, headers: { 'Content-Type': 'text/plain' } });
      }

      const agentSettings = (agent.settings as Record<string, unknown>) || {};
      const agentTemperature = (agentSettings.temperature as number) ?? 0.7;
      const agentMaxChars = (agentSettings.maxResponseChars as number) ?? 500;
      const agentHumor = (agentSettings.humor as string) ?? 'profissional';

      // Check AI credits
      const CREDIT_COST = 0.10;
      const { data: creditResult } = await supabase.rpc('consume_ai_credits', {
        p_company_id: session.company_id,
        p_agent_id: agent.id,
        p_amount: CREDIT_COST,
        p_description: `Agente "${agent.name}" respondeu no YCloud WhatsApp`
      });

      if (creditResult && !creditResult.success) {
        console.log(`[ycloud-webhook] 🤖💳 Insufficient credits`);
        await supabase.from('ycloud_conversations').update({ ai_thinking: false, ai_thinking_since: null }).eq('id', conv.id);
        return new Response('OK', { status: 200, headers: { 'Content-Type': 'text/plain' } });
      }

      // Re-fetch ALL recent messages AFTER the debounce to get full context
      const { data: recentMessages } = await supabase
        .from('ycloud_messages')
        .select('from_me, content, is_ai_response')
        .eq('conversation_id', conv.id)
        .order('created_at', { ascending: false })
        .limit(20);

      const historyMessages = (recentMessages || []).reverse().map((m: any) => ({
        role: m.from_me ? 'assistant' : 'user',
        content: m.content || ''
      }));

      // Build system prompt
      const systemPrompt = [
        `Personalidade: ${agent.personality}`,
        `Tom/Humor: ${agentHumor}`,
        '',
        agent.instructions,
        '',
        'REGRAS ESSENCIAIS DE COMPORTAMENTO NO WHATSAPP:',
        '1. Responda APENAS o que foi perguntado. Seja direto e conciso.',
        '2. NUNCA antecipe perguntas que o cliente nao fez.',
        '3. Envie UMA UNICA mensagem curta por vez.',
        '4. Se o cliente enviar VARIAS mensagens seguidas, leia TODAS e responda com UMA UNICA resposta que aborde tudo.',
        '5. NAO despeje todas as informacoes de uma vez.',
        '6. Aja como um vendedor real no WhatsApp: respostas curtas, naturais e objetivas.',
        '7. NUNCA envie mensagens duplicadas ou repetidas.',
        '',
        'FORMATACAO:',
        '- NAO use asteriscos, negrito, italico, markdown.',
        '- Escreva texto corrido e natural.',
        '- NAO use listas com marcadores.',
        '',
        `LIMITE: Responda com NO MAXIMO ${agentMaxChars} caracteres.`,
        '',
        'TRANSFERENCIA PARA ATENDENTE HUMANO:',
        'Se o cliente pedir para falar com um atendente humano, inclua a tag [HANDOFF] no FINAL da sua resposta.',
        '',
        'Responda sempre em português brasileiro.'
      ].join('\n');

      const apiMessages = [
        { role: 'system', content: systemPrompt },
        ...historyMessages,
      ];

      // Call AI
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

      if (!aiResponse.ok) {
        console.error('[ycloud-webhook] 🤖 AI response error:', aiResponse.status);
        await supabase.from('ycloud_conversations').update({ ai_thinking: false, ai_thinking_since: null }).eq('id', conv.id);
        return new Response('OK', { status: 200, headers: { 'Content-Type': 'text/plain' } });
      }

      const aiData = await aiResponse.json();
      let aiReply = aiData.response || aiData.message || '';

      if (!aiReply) {
        await supabase.from('ycloud_conversations').update({ ai_thinking: false, ai_thinking_since: null }).eq('id', conv.id);
        return new Response('OK', { status: 200, headers: { 'Content-Type': 'text/plain' } });
      }

      // Clean markdown
      aiReply = aiReply
        .replace(/\*\*(.*?)\*\*/g, '$1')
        .replace(/\*(.*?)\*/g, '$1')
        .replace(/#{1,6}\s?/g, '')
        .replace(/`{1,3}(.*?)`{1,3}/gs, '$1')
        .replace(/\[(.*?)\]\((.*?)\)/g, '$2')
        .replace(/^[-*+]\s/gm, '• ')
        .trim();

      // Check handoff
      const isHandoff = aiReply.includes('[HANDOFF]');
      if (isHandoff) aiReply = aiReply.replace('[HANDOFF]', '').trim();
      aiReply = aiReply.replace(/\[STAGE:\w+\]/g, '').trim();

      console.log(`[ycloud-webhook] 🤖 AI Reply: ${aiReply.substring(0, 100)}...`);

      // Send via YCloud API
      const formattedFrom = session.phone_number.startsWith('+') ? session.phone_number : `+${session.phone_number.replace(/\D/g, '')}`;

      const sendRes = await fetch(`${YCLOUD_BASE}/whatsapp/messages/sendDirectly`, {
        method: 'POST',
        headers: {
          'X-API-Key': session.ycloud_api_key,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: formattedFrom,
          to: normalizedFromPhone,
          type: 'text',
          text: { body: aiReply },
        }),
      });

      const sendData = await sendRes.json();

      if (!sendRes.ok) {
        console.error('[ycloud-webhook] 🤖 Failed to send AI reply:', JSON.stringify(sendData));
      }

      // Save AI message
      await supabase.from('ycloud_messages').insert({
        conversation_id: conv.id,
        company_id: session.company_id,
        ycloud_message_id: sendData?.id || `ai-ycloud-${Date.now()}`,
        wamid: sendData?.wamid || null,
        from_me: true,
        content: aiReply,
        message_type: 'text',
        status: sendRes.ok ? 'sent' : 'failed',
        is_ai_response: true,
      });

      // Update conversation
      const convUpdate: Record<string, unknown> = {
        last_message: aiReply.substring(0, 100),
        last_message_at: new Date().toISOString(),
        ai_thinking: false,
        ai_thinking_since: null,
      };

      if (isHandoff) {
        convUpdate.ai_auto_reply_enabled = false;
        convUpdate.assigned_agent_id = null;
        console.log('[ycloud-webhook] 🤖🔄 HANDOFF - AI disabled');
      }

      await supabase.from('ycloud_conversations').update(convUpdate).eq('id', conv.id);

    } catch (aiErr) {
      console.error('[ycloud-webhook] 🤖 AI error:', aiErr);
      await supabase.from('ycloud_conversations').update({ ai_thinking: false, ai_thinking_since: null }).eq('id', conv.id);
    }
  }

  return new Response('OK', { status: 200, headers: { 'Content-Type': 'text/plain' } });
}
