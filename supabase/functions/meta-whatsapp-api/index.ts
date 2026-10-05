import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const META_API_BASE = 'https://graph.facebook.com/v22.0';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { action, session_id, ...params } = await req.json();

    // Get session with access token
    const { data: session, error: sessionError } = await supabase
      .from('meta_whatsapp_sessions')
      .select('*')
      .eq('id', session_id)
      .single();

    if (sessionError || !session) {
      throw new Error('Session not found: ' + sessionError?.message);
    }

    // Use stored token or fallback to env secret
    const accessToken = session.access_token || Deno.env.get('META_WHATSAPP_ACCESS_TOKEN');
    if (!accessToken) {
      throw new Error('Access token not configured for this session');
    }

    switch (action) {
      case 'send_message': {
        const { to, message, message_type = 'text' } = params;
        
        let body: any = {
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: to.replace(/\D/g, ''),
        };

        if (message_type === 'text') {
          body.type = 'text';
          body.text = { preview_url: true, body: message };
        } else if (message_type === 'template') {
          body.type = 'template';
          body.template = params.template;
        } else if (message_type === 'image') {
          body.type = 'image';
          body.image = { link: params.media_url, caption: message || '' };
        } else if (message_type === 'document') {
          body.type = 'document';
          body.document = { link: params.media_url, filename: params.filename || 'document' };
        } else if (message_type === 'audio') {
          body.type = 'audio';
          body.audio = { link: params.media_url };
        }

        const response = await fetch(
          `${META_API_BASE}/${session.phone_number_id}/messages`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(body),
          }
        );

        const result = await response.json();

        if (!response.ok) {
          throw new Error(`Meta API error [${response.status}]: ${JSON.stringify(result)}`);
        }

        const waMessageId = result.messages?.[0]?.id;
        if (!waMessageId) {
          throw new Error('No message ID returned from Meta API');
        }

        // Upsert conversation
        const { data: convo } = await supabase
          .from('meta_whatsapp_conversations')
          .select('id')
          .eq('company_id', session.company_id)
          .eq('contact_phone', to.replace(/\D/g, ''))
          .single();

        let conversationId: string;
        const cleanPhone = to.replace(/\D/g, '');

        if (convo) {
          conversationId = convo.id;
          await supabase
            .from('meta_whatsapp_conversations')
            .update({
              last_message: message || `[${message_type}]`,
              last_message_at: new Date().toISOString(),
              session_id: session.id,
            })
            .eq('id', convo.id);
        } else {
          const { data: newConvo } = await supabase
            .from('meta_whatsapp_conversations')
            .insert({
              session_id: session.id,
              company_id: session.company_id,
              contact_phone: cleanPhone,
              contact_name: cleanPhone,
              last_message: message || `[${message_type}]`,
              last_message_at: new Date().toISOString(),
            })
            .select('id')
            .single();
          conversationId = newConvo!.id;
        }

        // Save message
        await supabase
          .from('meta_whatsapp_messages')
          .insert({
            conversation_id: conversationId,
            session_id: session.id,
            content: message || `[${message_type}]`,
            from_me: true,
            status: 'sent',
            wa_message_id: waMessageId,
            message_type: message_type,
            media_url: params.media_url || null,
          });

        return new Response(
          JSON.stringify({ success: true, message_id: waMessageId }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'get_media': {
        const { media_id } = params;
        
        // Step 1: Get media URL
        const mediaResponse = await fetch(`${META_API_BASE}/${media_id}`, {
          headers: { 'Authorization': `Bearer ${accessToken}` },
        });
        const mediaData = await mediaResponse.json();

        if (!mediaResponse.ok) {
          throw new Error(`Failed to get media URL: ${JSON.stringify(mediaData)}`);
        }

        // Step 2: Download media
        const downloadResponse = await fetch(mediaData.url, {
          headers: { 'Authorization': `Bearer ${accessToken}` },
        });

        if (!downloadResponse.ok) {
          throw new Error('Failed to download media');
        }

        const mediaBuffer = await downloadResponse.arrayBuffer();
        const base64 = btoa(String.fromCharCode(...new Uint8Array(mediaBuffer)));

        return new Response(
          JSON.stringify({
            success: true,
            mime_type: mediaData.mime_type,
            data: base64,
            url: mediaData.url,
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'check_connection': {
        // Check if the access token is valid
        const response = await fetch(
          `${META_API_BASE}/${session.phone_number_id}`,
          {
            headers: { 'Authorization': `Bearer ${accessToken}` },
          }
        );
        const result = await response.json();

        if (!response.ok) {
          return new Response(
            JSON.stringify({ success: false, connected: false, error: result }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Update session with phone info
        await supabase
          .from('meta_whatsapp_sessions')
          .update({
            status: 'connected',
            phone_number: result.display_phone_number,
            phone_name: result.verified_name || result.display_phone_number,
            connected_at: new Date().toISOString(),
          })
          .eq('id', session.id);

        return new Response(
          JSON.stringify({
            success: true,
            connected: true,
            phone_number: result.display_phone_number,
            verified_name: result.verified_name,
            quality_rating: result.quality_rating,
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      default:
        throw new Error(`Unknown action: ${action}`);
    }
  } catch (error) {
    console.error('[META-API] Error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
