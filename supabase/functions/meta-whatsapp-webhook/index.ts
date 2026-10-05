import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  // ─── GET: Webhook Verification (Meta challenge) ───
  if (req.method === 'GET') {
    const mode = url.searchParams.get('hub.mode');
    const token = url.searchParams.get('hub.verify_token');
    const challenge = url.searchParams.get('hub.challenge');

    if (mode === 'subscribe' && token) {
      // Accept a known master verify token
      const MASTER_VERIFY_TOKEN = 'ellosuit_meta_webhook_2024';
      if (token === MASTER_VERIFY_TOKEN) {
        console.log('[META-WEBHOOK] Master token verification successful');
        return new Response(challenge, { status: 200, headers: { 'Content-Type': 'text/plain' } });
      }

      // Or find a session matching this verify token
      const { data: session } = await supabase
        .from('meta_whatsapp_sessions')
        .select('id')
        .eq('webhook_verify_token', token)
        .single();

      if (session) {
        console.log('[META-WEBHOOK] Verification successful for session:', session.id);
        return new Response(challenge, { status: 200, headers: { 'Content-Type': 'text/plain' } });
      }
    }

    return new Response('Forbidden', { status: 403 });
  }

  // ─── POST: Incoming messages from Meta ───
  if (req.method === 'POST') {
    try {
      const body = await req.json();
      console.log('[META-WEBHOOK] Received:', JSON.stringify(body).substring(0, 500));

      if (body.object !== 'whatsapp_business_account') {
        return new Response('Not a WhatsApp event', { status: 200, headers: corsHeaders });
      }

      for (const entry of body.entry || []) {
        const wabaId = entry.id;
        
        for (const change of entry.changes || []) {
          if (change.field !== 'messages') continue;
          
          const value = change.value;
          const phoneNumberId = value.metadata?.phone_number_id;
          
          // Find the session for this phone_number_id
          const { data: session } = await supabase
            .from('meta_whatsapp_sessions')
            .select('*')
            .eq('phone_number_id', phoneNumberId)
            .single();

          if (!session) {
            console.log('[META-WEBHOOK] No session found for phone_number_id:', phoneNumberId);
            continue;
          }

          // Update session status to connected
          if (session.status !== 'connected') {
            await supabase
              .from('meta_whatsapp_sessions')
              .update({ status: 'connected', connected_at: new Date().toISOString() })
              .eq('id', session.id);
          }

          // Process contact info
          const contacts = value.contacts || [];
          
          // Process messages
          for (const msg of value.messages || []) {
            const senderPhone = msg.from;
            const contactInfo = contacts.find((c: any) => c.wa_id === senderPhone);
            const contactName = contactInfo?.profile?.name || senderPhone;

            // Upsert conversation
            const { data: convo } = await supabase
              .from('meta_whatsapp_conversations')
              .select('id, unread_count')
              .eq('company_id', session.company_id)
              .eq('contact_phone', senderPhone)
              .single();

            let conversationId: string;

            if (convo) {
              conversationId = convo.id;
              await supabase
                .from('meta_whatsapp_conversations')
                .update({
                  contact_name: contactName,
                  last_message: msg.text?.body || `[${msg.type}]`,
                  last_message_at: new Date(parseInt(msg.timestamp) * 1000).toISOString(),
                  unread_count: (convo.unread_count || 0) + 1,
                  session_id: session.id,
                })
                .eq('id', convo.id);
            } else {
              const { data: newConvo } = await supabase
                .from('meta_whatsapp_conversations')
                .insert({
                  session_id: session.id,
                  company_id: session.company_id,
                  contact_phone: senderPhone,
                  contact_name: contactName,
                  last_message: msg.text?.body || `[${msg.type}]`,
                  last_message_at: new Date(parseInt(msg.timestamp) * 1000).toISOString(),
                  unread_count: 1,
                })
                .select('id')
                .single();
              conversationId = newConvo!.id;
            }

            // Determine message type and content
            let content = '';
            let messageType = msg.type || 'text';
            let mediaUrl = null;

            switch (msg.type) {
              case 'text':
                content = msg.text?.body || '';
                break;
              case 'image':
                content = msg.image?.caption || '[Imagem]';
                mediaUrl = msg.image?.id; // Will need to download via API
                break;
              case 'audio':
                content = '[Áudio]';
                mediaUrl = msg.audio?.id;
                break;
              case 'video':
                content = msg.video?.caption || '[Vídeo]';
                mediaUrl = msg.video?.id;
                break;
              case 'document':
                content = msg.document?.filename || '[Documento]';
                mediaUrl = msg.document?.id;
                break;
              case 'sticker':
                content = '[Sticker]';
                mediaUrl = msg.sticker?.id;
                break;
              case 'reaction':
                content = msg.reaction?.emoji || '👍';
                messageType = 'reaction';
                break;
              default:
                content = `[${msg.type}]`;
            }

            // Save message
            await supabase
              .from('meta_whatsapp_messages')
              .insert({
                conversation_id: conversationId,
                session_id: session.id,
                content,
                from_me: false,
                status: 'received',
                sender_name: contactName,
                wa_message_id: msg.id,
                message_type: messageType,
                media_url: mediaUrl,
              });

            console.log('[META-WEBHOOK] Saved message from', senderPhone, 'type:', messageType);
          }

          // Process status updates
          for (const status of value.statuses || []) {
            const waMessageId = status.id;
            const newStatus = status.status; // sent, delivered, read, failed

            await supabase
              .from('meta_whatsapp_messages')
              .update({ status: newStatus })
              .eq('wa_message_id', waMessageId);

            console.log('[META-WEBHOOK] Status update:', waMessageId, '->', newStatus);
          }
        }
      }

      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    } catch (error) {
      console.error('[META-WEBHOOK] Error:', error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  }

  return new Response('Method not allowed', { status: 405, headers: corsHeaders });
});
