import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
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

const normalizeMime = (mime: string | null | undefined): string => {
  return (mime || '').split(';')[0].trim().toLowerCase();
};

const detectMimeFromBytes = (bytes: Uint8Array, fallback?: string): string => {
  if (bytes.length >= 4) {
    // WEBM/Matroska
    if (bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3) {
      return 'audio/webm';
    }

    // OGG
    if (bytes[0] === 0x4f && bytes[1] === 0x67 && bytes[2] === 0x67 && bytes[3] === 0x53) {
      return 'audio/ogg';
    }
  }

  // MP3 (ID3)
  if (bytes.length >= 3 && bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33) {
    return 'audio/mpeg';
  }

  // MP3 frame sync
  if (bytes.length >= 2 && bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0) {
    return 'audio/mpeg';
  }

  // AAC ADTS
  if (bytes.length >= 2 && bytes[0] === 0xff && (bytes[1] & 0xf0) === 0xf0) {
    return 'audio/aac';
  }

  // MP4/ISOBMFF
  if (bytes.length >= 12 && bytes[4] === 0x66 && bytes[5] === 0x74 && bytes[6] === 0x79 && bytes[7] === 0x70) {
    return 'audio/mp4';
  }

  return normalizeMime(fallback);
};

const getUploadFileName = (fileName: string, mime: string): string => {
  const hasExt = /\.[a-z0-9]+$/i.test(fileName);

  if (mime === 'audio/mp4') {
    if (/\.mp4$/i.test(fileName)) return fileName.replace(/\.mp4$/i, '.m4a');
    return hasExt ? fileName : `${fileName}.m4a`;
  }

  if (mime === 'audio/mpeg') {
    if (/\.mp3$/i.test(fileName)) return fileName;
    return hasExt ? fileName : `${fileName}.mp3`;
  }

  return fileName;
};

const decodeBase64ToBytes = (base64: string): Uint8Array => {
  const cleanBase64 = base64.includes(',') ? base64.split(',').pop() || '' : base64;
  const binary = atob(cleanBase64);
  const bytes = new Uint8Array(binary.length);

  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }

  return bytes;
};

const YCLOUD_SUPPORTED_AUDIO_MIME_TYPES = new Set([
  'audio/mpeg',
  'audio/mp3',
  'audio/ogg',
  'audio/mp4',
  'audio/aac',
  'audio/amr',
]);

const isYCloudSupportedAudioMime = (mime: string): boolean => {
  return YCLOUD_SUPPORTED_AUDIO_MIME_TYPES.has(normalizeMime(mime));
};

const extractYCloudMessageId = (payload: any): string | null => {
  return payload?.id || payload?.messageId || payload?.message_id || payload?.messages?.[0]?.id || null;
};

const extractYCloudWamid = (payload: any): string | null => {
  return payload?.wamid || payload?.messages?.[0]?.id || null;
};

const getYCloudSendError = (payload: any): { code: string | null; message: string | null } => {
  const code = payload?.errorCode || payload?.error?.code || null;
  const message = payload?.errorMessage || payload?.error?.message || null;
  return {
    code: code ? String(code) : null,
    message: message ? String(message) : null,
  };
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const { data: { user }, error: authError } = await supabase.auth.getUser(
    authHeader.replace('Bearer ', '')
  );
  if (authError || !user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Verify user belongs to at least one company
  const { data: companyUser } = await supabase
    .from('company_users')
    .select('company_id, role')
    .eq('user_id', user.id)
    .limit(1)
    .maybeSingle();

  if (!companyUser) {
    return new Response(JSON.stringify({ error: 'No company associated' }), {
      status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const body = await req.json();
  const { action } = body;

  switch (action) {
    case 'create_session': {
      const { company_id, api_key, phone_number } = body;
      if (!company_id || !api_key) {
        return new Response(JSON.stringify({ error: 'company_id and api_key required' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const phoneRes = await fetch(`${YCLOUD_BASE}/whatsapp/phoneNumbers`, {
        headers: { 'X-API-Key': api_key },
      });
      const phoneData = await phoneRes.json();
      console.log('[ycloud-api] Phone numbers response:', JSON.stringify(phoneData));

      if (!phoneRes.ok) {
        return new Response(JSON.stringify({ error: 'Invalid API Key', details: phoneData }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const phones = phoneData?.items || [];
      const first = phones[0];
      const detectedPhone = first?.phoneNumber || first?.phone_number || first?.value || phone_number || null;
      const phoneNumberId = first?.id || null;
      const wabaId = first?.wabaId || first?.waba_id || null;

      // Upsert to avoid duplicates for same company + phone
      const { data: session, error: insertError } = await supabase
        .from('ycloud_sessions')
        .upsert({
          company_id,
          ycloud_api_key: api_key,
          phone_number: detectedPhone,
          ycloud_phone_number_id: phoneNumberId,
          waba_id: wabaId,
          status: 'active',
          created_by: user.id,
        }, { onConflict: 'company_id,phone_number' })
        .select()
        .single();

      if (insertError) {
        return new Response(JSON.stringify({ error: insertError.message }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify({ success: true, session, phone_numbers: phones }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    case 'list_sessions': {
      // Each user only sees their own sessions; adminmaster sees all
      const isAdmin = companyUser.role === 'adminmaster';
      let query = supabase
        .from('ycloud_sessions')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (!isAdmin) {
        query = query.eq('created_by', user.id);
      }

      const { data: sessions } = await query;

      return new Response(JSON.stringify({ sessions: sessions || [] }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    case 'send_message': {
      const { session_id, to, message, message_type, media_url, media_id, media_mime_type, interactive, context_message_id } = body;
      if (!session_id || !to) {
        return new Response(JSON.stringify({ error: 'session_id and to required' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { data: session } = await supabase
        .from('ycloud_sessions')
        .select('*')
        .eq('id', session_id)
        .single();

      if (!session) {
        return new Response(JSON.stringify({ error: 'Session not found' }), {
          status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      if (!session.phone_number) {
        return new Response(JSON.stringify({ error: 'Session has no phone number configured.' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const e164To = normalizePhone(to);
      const formattedFrom = session.phone_number.startsWith('+') ? session.phone_number : `+${session.phone_number.replace(/\D/g, '')}`;
      console.log('[ycloud-api] Sending from:', formattedFrom, 'to:', e164To);

      const sendPayload: any = {
        from: formattedFrom,
        to: e164To,
      };

      const effectiveType = message_type || 'text';
      const transportType = effectiveType; // Always use native type, YCloud handles format via media_id

      if (transportType === 'image') {
        sendPayload.type = 'image';
        sendPayload.image = media_id ? { id: media_id } : { link: media_url || message };
        if (message && (media_url || media_id)) sendPayload.image.caption = message;
      } else if (transportType === 'audio') {
        sendPayload.type = 'audio';
        sendPayload.audio = media_id ? { id: media_id } : { link: media_url || message };
      } else if (transportType === 'video') {
        sendPayload.type = 'video';
        sendPayload.video = media_id ? { id: media_id } : { link: media_url || message };
        if (message && (media_url || media_id)) sendPayload.video.caption = message;
      } else if (transportType === 'document') {
        sendPayload.type = 'document';
        sendPayload.document = media_id ? { id: media_id } : { link: media_url || message };
        if (message && (media_url || media_id)) sendPayload.document.caption = message;
      } else if (transportType === 'interactive' && interactive) {
        // WhatsApp Interactive Messages (buttons or list)
        sendPayload.type = 'interactive';
        sendPayload.interactive = interactive;
      } else {
        sendPayload.type = 'text';
        sendPayload.text = { body: message };
      }

      // Add context for reply-to-message
      if (context_message_id) {
        sendPayload.context = { message_id: context_message_id };
        console.log('[ycloud-api] Reply context:', context_message_id);
      }

      console.log('[ycloud-api] Sending payload:', JSON.stringify(sendPayload));

      const sendRes = await fetch(`${YCLOUD_BASE}/whatsapp/messages/sendDirectly`, {
        method: 'POST',
        headers: {
          'X-API-Key': session.ycloud_api_key,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(sendPayload),
      });

      const sendData = await sendRes.json();
      console.log('[ycloud-api] Send response:', JSON.stringify(sendData));

      const sendStatus = String(sendData?.status || '').toLowerCase();
      const messageId = extractYCloudMessageId(sendData);
      const wamid = extractYCloudWamid(sendData);
      const sendError = getYCloudSendError(sendData);
      const bodyIndicatesFailure = sendStatus === 'failed' || !!sendError.code || !!sendError.message;

      if (!sendRes.ok || bodyIndicatesFailure || !messageId) {
        const status = !sendRes.ok ? 502 : 422;
        const errorCode = sendError.code ? Number(sendError.code) : null;
        const customerCareWindowClosed = errorCode === 131047;

        const reason = customerCareWindowClosed
          ? 'Janela de 24h encerrada para este contato. Use mensagem template para reabrir a conversa.'
          : !sendRes.ok
            ? 'Failed to send'
            : bodyIndicatesFailure
              ? (sendError.message || 'YCloud accepted request but returned failed delivery status')
              : 'YCloud response missing message id';

        return new Response(JSON.stringify({
          error: reason,
          details: sendData,
          ycloud_error_code: sendError.code,
          ycloud_error_message: sendError.message,
          hint: customerCareWindowClosed
            ? 'No WhatsApp oficial, fora da janela de 24h só é permitido envio de template aprovado.'
            : undefined,
        }), {
          status,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { data: conv } = await supabase
        .from('ycloud_conversations')
        .upsert({
          session_id,
          company_id: session.company_id,
          contact_phone: e164To,
          last_message: (effectiveType === 'text' ? message : `[${effectiveType}]`).substring(0, 200),
          last_message_at: new Date().toISOString(),
        }, { onConflict: 'session_id,contact_phone' })
        .select()
        .single();

      if (conv) {
        await supabase.from('ycloud_messages').insert({
          conversation_id: conv.id,
          company_id: session.company_id,
          ycloud_message_id: messageId,
          wamid,
          from_me: true,
          content: effectiveType === 'text' ? message : (message || `[${effectiveType}]`),
          message_type: effectiveType,
          media_url: media_url || null,
          status: sendStatus || 'sent',
          raw_payload: sendData,
        });
      }

      return new Response(JSON.stringify({ 
        success: true, 
        message_id: messageId,
        wamid,
        status: sendStatus || 'sent',
        transport_type: transportType,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    case 'upload_media': {
      const { session_id, media_url, media_base64, content_type, file_name } = body;
      if (!session_id || (!media_url && !media_base64)) {
        return new Response(JSON.stringify({ error: 'session_id and (media_url or media_base64) required' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { data: session } = await supabase
        .from('ycloud_sessions')
        .select('*')
        .eq('id', session_id)
        .single();

      if (!session || !session.phone_number) {
        return new Response(JSON.stringify({ error: 'Session not found or no phone number' }), {
          status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      try {
        let bytes: Uint8Array;
        let headerContentType = '';

        if (media_base64) {
          bytes = decodeBase64ToBytes(media_base64);
        } else {
          console.log('[ycloud-api] Downloading media from:', media_url);
          const fileRes = await fetch(media_url);
          if (!fileRes.ok) {
            return new Response(JSON.stringify({ error: 'Failed to download media file', status: fileRes.status }), {
              status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
          }

          const fileBuffer = await fileRes.arrayBuffer();
          bytes = new Uint8Array(fileBuffer);
          headerContentType = fileRes.headers.get('content-type') || '';
        }

        const phoneNumber = session.phone_number.replace('+', '');

        const providedContentType = normalizeMime(content_type || headerContentType || '');
        const detectedContentType = normalizeMime(detectMimeFromBytes(bytes, ''));
        const actualContentType = detectedContentType || providedContentType || 'application/octet-stream';
        const actualFileName = file_name || 'media';
        const uploadFileName = getUploadFileName(actualFileName, actualContentType);

        if (providedContentType.startsWith('audio/') && !detectedContentType.startsWith('audio/')) {
          return new Response(JSON.stringify({
            error: 'Uploaded audio bytes are invalid or not recognized as audio container',
            details: `Provided content type was ${providedContentType}, but binary signature could not be identified as audio.`,
          }), {
            status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        if (actualContentType.startsWith('audio/') && !isYCloudSupportedAudioMime(actualContentType)) {
          return new Response(JSON.stringify({
            error: `Unsupported audio type for YCloud: ${actualContentType}`,
            details: 'Supported audio types: audio/mpeg, audio/mp3, audio/ogg, audio/mp4, audio/aac, audio/amr',
          }), {
            status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        console.log('[ycloud-api] Uploading to YCloud media API, phone:', phoneNumber, 'type:', actualContentType, 'size:', bytes.byteLength);

        const formData = new FormData();
        const uploadFile = new File([bytes], uploadFileName, { type: actualContentType });
        formData.append('file', uploadFile);

        const uploadRes = await fetch(`${YCLOUD_BASE}/whatsapp/media/${phoneNumber}/upload`, {
          method: 'POST',
          headers: {
            'X-API-Key': session.ycloud_api_key,
          },
          body: formData,
        });

        const uploadData = await uploadRes.json();
        console.log('[ycloud-api] Media upload response:', JSON.stringify(uploadData));

        if (!uploadRes.ok) {
          const upstreamStatus = Number(uploadData?.error?.status || uploadRes.status || 502);
          const status = upstreamStatus >= 500 ? 502 : 400;
          return new Response(JSON.stringify({ error: 'Failed to upload media to YCloud', details: uploadData }), {
            status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        return new Response(JSON.stringify({ 
          success: true, 
          media_id: uploadData.id,
          media_mime_type: actualContentType,
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      } catch (e) {
        console.error('[ycloud-api] Media upload error:', e);
        return new Response(JSON.stringify({ error: 'Media upload failed', details: String(e) }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    case 'get_conversations': {
      const { session_id } = body;
      const { data: convs } = await supabase
        .from('ycloud_conversations')
        .select('*')
        .eq('session_id', session_id)
        .neq('status', 'archived')
        .order('last_message_at', { ascending: false });

      return new Response(JSON.stringify({ conversations: convs || [] }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    case 'get_messages': {
      const { conversation_id, limit: msgLimit } = body;
      const { data: msgs } = await supabase
        .from('ycloud_messages')
        .select('*')
        .eq('conversation_id', conversation_id)
        .order('created_at', { ascending: true })
        .limit(msgLimit || 100);

      await supabase
        .from('ycloud_conversations')
        .update({ unread_count: 0 })
        .eq('id', conversation_id);

      return new Response(JSON.stringify({ messages: msgs || [] }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    case 'refresh_session': {
      const { session_id } = body;
      const { data: sess } = await supabase
        .from('ycloud_sessions')
        .select('*')
        .eq('id', session_id)
        .single();
      if (!sess) {
        return new Response(JSON.stringify({ error: 'Session not found' }), {
          status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const phoneRes = await fetch(`${YCLOUD_BASE}/whatsapp/phoneNumbers`, {
        headers: { 'X-API-Key': sess.ycloud_api_key },
      });
      const phoneData = await phoneRes.json();
      const phones = phoneData?.items || [];
      const first = phones[0];
      const newPhone = first?.phoneNumber || first?.phone_number || first?.value || null;
      const newPhoneId = first?.id || null;
      const newWabaId = first?.wabaId || first?.waba_id || null;
      if (newPhone) {
        await supabase.from('ycloud_sessions').update({
          phone_number: newPhone,
          ycloud_phone_number_id: newPhoneId,
          waba_id: newWabaId,
        }).eq('id', session_id);
      }
      return new Response(JSON.stringify({ success: true, phone_number: newPhone, phone_numbers: phones }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    case 'delete_session': {
      const { session_id } = body;
      await supabase.from('ycloud_sessions').delete().eq('id', session_id);
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    case 'merge_duplicates': {
      const { session_id } = body;
      const { data: convs } = await supabase
        .from('ycloud_conversations')
        .select('*')
        .eq('session_id', session_id)
        .order('created_at', { ascending: true });

      if (!convs || convs.length === 0) {
        return new Response(JSON.stringify({ merged: 0 }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const phoneMap: Record<string, any[]> = {};
      for (const c of convs) {
        const normalized = normalizePhone(c.contact_phone);
        if (!phoneMap[normalized]) phoneMap[normalized] = [];
        phoneMap[normalized].push(c);
      }

      let merged = 0;
      for (const [, group] of Object.entries(phoneMap)) {
        if (group.length <= 1) continue;
        group.sort((a: any, b: any) => new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime());
        const keep = group[0];
        const duplicates = group.slice(1);

        for (const dup of duplicates) {
          await supabase.from('ycloud_messages')
            .update({ conversation_id: keep.id })
            .eq('conversation_id', dup.id);
          await supabase.from('ycloud_conversations').delete().eq('id', dup.id);
          merged++;
        }

        await supabase.from('ycloud_conversations')
          .update({ contact_phone: normalizePhone(keep.contact_phone) })
          .eq('id', keep.id);
      }

      return new Response(JSON.stringify({ success: true, merged }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    case 'get_contact_profile': {
      const { session_id, phone } = body;
      const { data: sess } = await supabase
        .from('ycloud_sessions')
        .select('ycloud_api_key')
        .eq('id', session_id)
        .single();
      if (!sess) {
        return new Response(JSON.stringify({ error: 'Session not found' }), {
          status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const normalized = normalizePhone(phone);
      try {
        const contactRes = await fetch(`${YCLOUD_BASE}/whatsapp/contacts`, {
          method: 'POST',
          headers: {
            'X-API-Key': sess.ycloud_api_key,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ blocking: 'wait', contacts: [normalized.replace('+', '')] }),
        });
        const contactData = await contactRes.json();
        return new Response(JSON.stringify({ profile: contactData }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      } catch (e) {
        return new Response(JSON.stringify({ profile: null, error: String(e) }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    case 'assign_agent': {
      const { conversation_id, agent_id } = body;
      if (!conversation_id) {
        return new Response(JSON.stringify({ error: 'conversation_id required' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      await supabase.from('ycloud_conversations')
        .update({
          assigned_agent_id: agent_id || null,
          ai_auto_reply_enabled: !!agent_id,
          ai_thinking: false,
        })
        .eq('id', conversation_id);

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    case 'archive_conversation': {
      const { conversation_id } = body;
      if (!conversation_id) {
        return new Response(JSON.stringify({ error: 'conversation_id required' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      await supabase.from('ycloud_conversations')
        .update({ status: 'archived' })
        .eq('id', conversation_id);

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    case 'connect_call': {
      const { session_id, to, sdp } = body;
      if (!session_id || !to || !sdp) {
        return new Response(JSON.stringify({ error: 'session_id, to, and sdp are required' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Get session API key
      const { data: sessionData } = await supabase.from('ycloud_sessions')
        .select('ycloud_api_key, phone_number')
        .eq('id', session_id)
        .single();

      if (!sessionData?.ycloud_api_key) {
        return new Response(JSON.stringify({ error: 'Session not found or no API key' }), {
          status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const fromPhone = normalizePhone(sessionData.phone_number);
      const toPhone = normalizePhone(to);

      console.log(`[YCloud Call] Connecting call from ${fromPhone} to ${toPhone}`);

      const callRes = await fetch(`${YCLOUD_BASE}/whatsapp/calls/connect`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': sessionData.ycloud_api_key,
        },
        body: JSON.stringify({
          from: fromPhone,
          to: toPhone,
          sdpType: 'offer',
          sdp: sdp,
        }),
      });

      const callBody = await callRes.json();
      console.log('[YCloud Call] Response:', JSON.stringify(callBody));

      if (!callRes.ok || !callBody.success) {
        const providerError = callBody?.error || null;
        const providerCode = providerError?.code || callBody?.code || null;
        const isPermissionDenied = callRes.status === 403 || providerCode === 'FORBIDDEN';

        return new Response(JSON.stringify({
          success: false,
          code: isPermissionDenied ? 'CALL_PERMISSION_DENIED' : 'CALL_CONNECT_FAILED',
          error: isPermissionDenied
            ? 'Your YCloud API key does not have permission to use WhatsApp Calls.'
            : (providerError?.message || callBody?.message || 'Call connection failed'),
          provider_error: {
            status: providerError?.status || callRes.status,
            code: providerCode,
            requestId: providerError?.requestId || null,
            docUrl: providerError?.docUrl || null,
          },
          details: callBody,
        }), {
          status: callRes.status,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify({
        success: true,
        wacid: callBody.wacid,
        sdp: callBody.sdp,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    case 'get_contacts': {
      const { session_id } = body;
      if (!session_id) {
        return new Response(JSON.stringify({ error: 'session_id required' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { data: sessionData } = await supabase
        .from('ycloud_sessions')
        .select('id, ycloud_api_key, phone_number, company_id')
        .eq('id', session_id)
        .single();

      if (!sessionData?.ycloud_api_key) {
        return new Response(JSON.stringify({ error: 'Session not found or no API key' }), {
          status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Fetch contacts from YCloud Contact List API (paginated)
      const allContacts: any[] = [];
      const pageSize = 100;
      const maxPages = 100; // up to 10000 contacts

      for (let page = 1; page <= maxPages; page++) {
        const params = new URLSearchParams({
          page: String(page),
          limit: String(pageSize),
          includeTotal: 'true',
        });

        const ycRes = await fetch(`${YCLOUD_BASE}/contact/contacts?${params.toString()}`, {
          method: 'GET',
          headers: {
            'X-API-Key': sessionData.ycloud_api_key,
            'Accept': 'application/json',
            'Content-Type': 'application/json',
          },
        });

        const rawText = await ycRes.text();
        let ycData: any = null;
        try {
          ycData = rawText ? JSON.parse(rawText) : null;
        } catch {
          ycData = null;
        }

        if (!ycRes.ok) {
          return new Response(JSON.stringify({
            error: 'Failed to fetch contacts from YCloud',
            details: ycData || rawText,
            status: ycRes.status,
          }), {
            status: ycRes.status,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        const items = Array.isArray(ycData?.items)
          ? ycData.items
          : Array.isArray(ycData?.data?.items)
            ? ycData.data.items
            : [];

        allContacts.push(...items);

        if (items.length < pageSize) break;
      }

      // Also get local conversations for richer mapping and quick open chat
      const { data: convContacts } = await supabase
        .from('ycloud_conversations')
        .select('id, contact_phone, contact_name, profile_picture, last_message_at, status')
        .eq('session_id', session_id)
        .neq('status', 'archived')
        .order('contact_name', { ascending: true, nullsFirst: false });

      const contactMap = new Map<string, any>();

      // Add YCloud contacts
      for (const c of allContacts) {
        const rawPhone = c.phoneNumber || c.phone_number || c.waId || c.wa_id || '';
        const phone = normalizePhone(rawPhone);
        if (!phone) continue;

        const key = phone.replace(/\D/g, '');
        contactMap.set(key, {
          id: String(c.id || phone),
          contact_phone: phone,
          contact_name: c.nickname || c.name || c.displayName || null,
          profile_picture: null,
          last_message_at: c.updatedAt || c.createdAt || null,
          status: 'active',
          source: 'ycloud_api',
          has_conversation: false,
        });
      }

      // Overlay conversation contacts
      for (const c of (convContacts || [])) {
        const key = normalizePhone(c.contact_phone).replace(/\D/g, '');
        const existing = contactMap.get(key);

        contactMap.set(key, {
          ...(existing || {}),
          id: c.id,
          contact_phone: c.contact_phone,
          contact_name: c.contact_name || existing?.contact_name || null,
          profile_picture: c.profile_picture || existing?.profile_picture || null,
          last_message_at: c.last_message_at || existing?.last_message_at || null,
          status: c.status || 'active',
          source: existing ? 'ycloud+conversation' : 'conversation',
          has_conversation: true,
        });
      }

      const contacts = Array.from(contactMap.values())
        .sort((a, b) => (a.contact_name || a.contact_phone || '').localeCompare(b.contact_name || b.contact_phone || ''));

      // Save contacts to Supabase cache (background, don't block response)
      const companyId = sessionData.company_id;
      if (companyId) {
        const upsertBatch = contacts.map((c: any) => ({
          session_id: session_id,
          company_id: companyId,
          contact_phone: c.contact_phone,
          contact_name: c.contact_name || null,
          profile_picture: c.profile_picture || null,
          last_message_at: c.last_message_at || null,
          status: c.status || 'active',
          source: c.source || 'ycloud_api',
          has_conversation: c.has_conversation || false,
          ycloud_contact_id: c.source === 'ycloud_api' || c.source === 'ycloud+conversation' ? String(c.id) : null,
          conversation_id: c.has_conversation ? String(c.id) : null,
          updated_at: new Date().toISOString(),
        }));

        // Upsert in batches of 500
        for (let i = 0; i < upsertBatch.length; i += 500) {
          const batch = upsertBatch.slice(i, i + 500);
          await supabase.from('ycloud_contacts').upsert(batch, { onConflict: 'session_id,contact_phone' });
        }
        console.log(`[YCloud] Cached ${upsertBatch.length} contacts for company ${companyId}`);
      }

      return new Response(JSON.stringify({
        contacts,
        total: contacts.length,
        ycloud_contacts_count: allContacts.length,
        session_phone: sessionData.phone_number,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    case 'sync_profile_pictures': {
      const { session_id } = body;
      if (!session_id) {
        return new Response(JSON.stringify({ error: 'session_id required' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Get ycloud session to find company
      const { data: ycSession } = await supabase
        .from('ycloud_sessions')
        .select('company_id')
        .eq('id', session_id)
        .single();

      if (!ycSession) {
        return new Response(JSON.stringify({ error: 'Session not found' }), {
          status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Find a connected Baileys session for the same company
      const { data: baileysSession } = await supabase
        .from('whatsapp_sessions')
        .select('id, baileys_server_url, instance_name')
        .eq('company_id', ycSession.company_id)
        .eq('status', 'connected')
        .limit(1)
        .maybeSingle();

      if (!baileysSession?.baileys_server_url) {
        return new Response(JSON.stringify({ 
          updated: 0,
          skipped: true,
          reason: 'No connected Baileys session found for this company.',
        }), {
          status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Get all ycloud conversations without profile pictures
      const { data: convs } = await supabase
        .from('ycloud_conversations')
        .select('id, contact_phone, profile_picture')
        .eq('session_id', session_id);

      const CLOUD_BAILEYS_URL = Deno.env.get('BAILEYS_SERVER_URL') || baileysSession.baileys_server_url;
      let updated = 0;
      const errors: string[] = [];

      // For each conversation without a picture, try to get it from the Baileys WhatsApp conversations
      const phonesToCheck = (convs || []).filter(c => !c.profile_picture).map(c => c.contact_phone);

      if (phonesToCheck.length > 0) {
        // Try to find matching whatsapp_conversations that DO have profile pictures
        for (const phone of phonesToCheck) {
          const digits = phone.replace(/\D/g, '');
          const phoneVariants = [
            `+${digits}`,
            phone,
            digits.length === 13 && digits.startsWith('55') ? `+${digits.slice(0, 4)}${digits.slice(5)}` : null,
            digits.length === 12 && digits.startsWith('55') ? `+${digits.slice(0, 4)}9${digits.slice(4)}` : null,
          ].filter(Boolean);

          const { data: wpConv } = await supabase
            .from('whatsapp_conversations')
            .select('profile_picture')
            .eq('company_id', ycSession.company_id)
            .in('contact_phone', phoneVariants)
            .not('profile_picture', 'is', null)
            .limit(1)
            .maybeSingle();

          if (wpConv?.profile_picture) {
            await supabase
              .from('ycloud_conversations')
              .update({ profile_picture: wpConv.profile_picture })
              .eq('session_id', session_id)
              .in('contact_phone', phoneVariants);
            updated++;
          }
        }
      }

      return new Response(JSON.stringify({ 
        success: true, 
        updated,
        total_checked: phonesToCheck.length,
        message: `${updated} fotos de perfil atualizadas de ${phonesToCheck.length} contatos verificados.`
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    case 'list_templates': {
      const { session_id } = body;
      if (!session_id) {
        return new Response(JSON.stringify({ error: 'session_id required' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { data: session } = await supabase
        .from('ycloud_sessions')
        .select('*')
        .eq('id', session_id)
        .single();

      if (!session) {
        return new Response(JSON.stringify({ error: 'Session not found' }), {
          status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Fetch templates from YCloud API
      const wabaId = session.waba_id;
      if (!wabaId) {
        return new Response(JSON.stringify({ error: 'Session has no WABA ID' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const tmplRes = await fetch(`${YCLOUD_BASE}/whatsapp/templates?wabaId=${wabaId}&limit=100`, {
        headers: { 'X-API-Key': session.ycloud_api_key },
      });

      const tmplData = await tmplRes.json();
      console.log('[ycloud-api] Templates response items:', tmplData?.items?.length ?? 0);

      if (!tmplRes.ok) {
        return new Response(JSON.stringify({ error: 'Failed to fetch templates', details: tmplData }), {
          status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Filter only APPROVED templates
      const approved = (tmplData.items || []).filter((t: any) => t.status === 'APPROVED');

      return new Response(JSON.stringify({ templates: approved }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    case 'send_template': {
      const { session_id, to, template_name, template_language, components } = body;
      if (!session_id || !to || !template_name) {
        return new Response(JSON.stringify({ error: 'session_id, to and template_name required' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { data: session } = await supabase
        .from('ycloud_sessions')
        .select('*')
        .eq('id', session_id)
        .single();

      if (!session || !session.phone_number) {
        return new Response(JSON.stringify({ error: 'Session not found or no phone number' }), {
          status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const e164To = normalizePhone(to);
      const formattedFrom = session.phone_number.startsWith('+') ? session.phone_number : `+${session.phone_number.replace(/\D/g, '')}`;

      const templatePayload: any = {
        from: formattedFrom,
        to: e164To,
        type: 'template',
        template: {
          name: template_name,
          language: { code: template_language || 'pt_BR' },
        },
      };

      if (components && components.length > 0) {
        templatePayload.template.components = components;
      }

      console.log('[ycloud-api] Sending template:', JSON.stringify(templatePayload));

      const sendRes = await fetch(`${YCLOUD_BASE}/whatsapp/messages/sendDirectly`, {
        method: 'POST',
        headers: {
          'X-API-Key': session.ycloud_api_key,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(templatePayload),
      });

      const sendData = await sendRes.json();
      console.log('[ycloud-api] Template send response:', JSON.stringify(sendData));

      const sendStatus = String(sendData?.status || '').toLowerCase();
      const messageId = extractYCloudMessageId(sendData);
      const wamid = extractYCloudWamid(sendData);

      if (!sendRes.ok || !messageId) {
        return new Response(JSON.stringify({ error: 'Failed to send template', details: sendData }), {
          status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Upsert conversation and save message
      const { data: conv } = await supabase
        .from('ycloud_conversations')
        .upsert({
          session_id,
          company_id: session.company_id,
          contact_phone: e164To,
          last_message: `[Template: ${template_name}]`,
          last_message_at: new Date().toISOString(),
        }, { onConflict: 'session_id,contact_phone' })
        .select()
        .single();

      if (conv) {
        await supabase.from('ycloud_messages').insert({
          conversation_id: conv.id,
          company_id: session.company_id,
          ycloud_message_id: messageId,
          wamid,
          from_me: true,
          content: `[Template: ${template_name}]`,
          message_type: 'template',
          status: sendStatus || 'sent',
          raw_payload: sendData,
        });
      }

      return new Response(JSON.stringify({ 
        success: true, 
        message_id: messageId,
        wamid,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    default:
      return new Response(JSON.stringify({ error: 'Unknown action', available: ['create_session', 'list_sessions', 'send_message', 'upload_media', 'get_conversations', 'get_messages', 'refresh_session', 'delete_session', 'merge_duplicates', 'get_contact_profile', 'assign_agent', 'archive_conversation', 'connect_call', 'get_contacts', 'sync_profile_pictures', 'list_templates', 'send_template'] }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
  }
});
