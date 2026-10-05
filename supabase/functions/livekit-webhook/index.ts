import { createClient } from "npm:@supabase/supabase-js@2";
import { WebhookReceiver } from 'npm:livekit-server-sdk@2.13.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🎯 [LiveKit Webhook] Received webhook request');

    const livekitApiKey = Deno.env.get('LIVEKIT_API_KEY');
    const livekitApiSecret = Deno.env.get('LIVEKIT_API_SECRET');
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    if (!livekitApiKey || !livekitApiSecret) {
      console.error('❌ Missing LiveKit credentials');
      return new Response(JSON.stringify({ error: 'Server configuration error' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get all headers for debugging
    const headers: Record<string, string> = {};
    req.headers.forEach((value, key) => {
      headers[key] = key.toLowerCase().includes('auth') || key.toLowerCase().includes('key') ? '[REDACTED]' : value;
    });
    console.log('📋 [LiveKit Webhook] Headers:', JSON.stringify(headers));

    const body = await req.text();
    const authHeader = req.headers.get('Authorization') || '';
    const livekitSignature = req.headers.get('X-Livekit-Signature') || '';
    
    // LiveKit usually sends the token in the Authorization header as "Bearer <token>"
    // or in the X-Livekit-Signature header directly.
    let token = '';
    if (authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    } else if (livekitSignature) {
      token = livekitSignature;
    } else if (authHeader) {
      token = authHeader;
    }

    console.log('🔑 [LiveKit Webhook] Token length:', token.length);
    console.log('📦 [LiveKit Webhook] Body length:', body.length);
    
    // Decode token for debugging without verification
    try {
      const parts = token.split('.');
      if (parts.length === 3) {
        const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
        console.log('🎫 [LiveKit Webhook] Token Issuer (iss):', payload.iss);
        console.log('🎫 [LiveKit Webhook] Token Subject (sub):', payload.sub);
        console.log('🎫 [LiveKit Webhook] Token Expiry (exp):', new Date(payload.exp * 1000).toISOString());
        
        if (payload.iss !== livekitApiKey) {
          console.warn('⚠️ [LiveKit Webhook] Token issuer does not match LIVEKIT_API_KEY!');
          console.warn(`⚠️ [LiveKit Webhook] Token iss: ${payload.iss}, Env key: ${livekitApiKey}`);
        }
      }
    } catch (e) {
      console.warn('⚠️ [LiveKit Webhook] Could not decode token for debugging:', e.message);
    }

    const receiver = new WebhookReceiver(livekitApiKey, livekitApiSecret);
    let event;
    
    try {
      console.log('🛡️ [LiveKit Webhook] Verifying signature...');
      // receiver.receive returns the decoded event if valid
      event = await receiver.receive(body, token);
      console.log('✅ [LiveKit Webhook] Signature validated for event:', event.event);
    } catch (error) {
      console.error('❌ [LiveKit Webhook] Signature verification failed:', error.message);
      
      // Parse body anyway to see what we received
      const rawData = JSON.parse(body);
      console.log('⚠️ [LiveKit Webhook] Unverified event type:', rawData.event);
      
      // DEBUG: If it's a recording event, we REALLY want to process it.
      // If we are in a situation where signature is failing but we trust the environment,
      // we could potentially proceed, but let's try to fix the verification first.
      // For now, let's check if the API keys match.
      console.log('🔑 Env API Key:', livekitApiKey?.substring(0, 5) + '...');
      
      return new Response(JSON.stringify({ 
        error: 'Invalid signature', 
        message: error.message 
      }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('📦 [LiveKit Webhook] Event type:', event.event);
    console.log('📦 [LiveKit Webhook] Egress ID:', event.egressInfo?.egressId);

     const egressInfo = event.egressInfo;
     const supabase = createClient(supabaseUrl, supabaseServiceKey);
 
     // Handle Egress Started
     if (event.event === 'egress_started') {
       console.log('📹 [LiveKit Webhook] Egress started:', egressInfo?.egressId);
       if (egressInfo?.egressId) {
         await supabase
           .from('meeting_recordings')
           .update({ status: 'recording' })
           .eq('livekit_recording_id', egressInfo.egressId);
       }
       return new Response(JSON.stringify({ message: 'Egress started processed' }), {
         status: 200,
         headers: { ...corsHeaders, 'Content-Type': 'application/json' },
       });
     }
 
     // Processar apenas eventos de conclusão de gravação
     if (event.event !== 'egress_ended') {
       console.log('ℹ️ [LiveKit Webhook] Ignoring event type:', event.event);
       return new Response(JSON.stringify({ message: 'Event processed' }), {
         status: 200,
         headers: { ...corsHeaders, 'Content-Type': 'application/json' },
       });
     }
    if (!egressInfo) {
      console.error('❌ [LiveKit Webhook] No egress info in event');
      return new Response(JSON.stringify({ error: 'No egress info' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

     console.log('📹 [LiveKit Webhook] Processing egress_ended event');
     console.log('🔍 [LiveKit Webhook] Egress status:', egressInfo.status);
 
     // Update status to processing
     if (egressInfo?.egressId) {
       await supabase
         .from('meeting_recordings')
         .update({ status: 'processing' })
         .eq('livekit_recording_id', egressInfo.egressId);
     }
 
     // Verificar se a gravação foi bem-sucedida
     if (egressInfo.status !== 'EGRESS_COMPLETE') {
       console.error('❌ [LiveKit Webhook] Egress failed with status:', egressInfo.status);
       console.error('❌ [LiveKit Webhook] Error:', egressInfo.error);
       
       // Atualizar registro no database com erro
       await supabase
         .from('meeting_recordings')
         .update({
           file_url: null,
           duration_seconds: 0,
           status: 'failed'
         })
         .eq('livekit_recording_id', egressInfo.egressId);
 
       return new Response(JSON.stringify({ message: 'Egress failed', error: egressInfo.error }), {
         status: 200,
         headers: { ...corsHeaders, 'Content-Type': 'application/json' },
       });
     }

    // Extrair informações do arquivo
    const fileResult = egressInfo.fileResults?.[0];
    if (!fileResult || !fileResult.downloadUrl) {
      console.error('❌ [LiveKit Webhook] No file result or download URL');
      return new Response(JSON.stringify({ error: 'No file result' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const downloadUrl = fileResult.downloadUrl;
    const duration = Math.floor((fileResult.duration || 0) / 1_000_000_000); // Nanosegundos para segundos
    const fileSize = fileResult.size || 0;

    console.log('⬇️ [LiveKit Webhook] Downloading file from:', downloadUrl);
    console.log('⏱️ [LiveKit Webhook] Duration:', duration, 'seconds');
    console.log('📊 [LiveKit Webhook] Size:', fileSize, 'bytes');

    // Optimized download and upload using streams to handle large files and save memory
    console.log('⬇️ [LiveKit Webhook] Starting download/upload stream...');
    
    const downloadResponse = await fetch(downloadUrl);
    if (!downloadResponse.ok || !downloadResponse.body) {
      console.error('❌ [LiveKit Webhook] Failed to download file from LiveKit');
      throw new Error(`Failed to download: ${downloadResponse.statusText}`);
    }

    // Create filename
    const fileName = `recording_${egressInfo.egressId}_${Date.now()}.mp4`;
    const filePath = `recordings/${fileName}`;

    // In Deno, we can pass the ReadableStream directly to Supabase storage.upload
    console.log('⬆️ [LiveKit Webhook] Uploading stream to Supabase Storage:', filePath);
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('meeting-recordings')
      .upload(filePath, downloadResponse.body, {
        contentType: 'video/mp4',
        duplex: 'half', // Required for streaming in some fetch implementations
        upsert: false,
      } as any);

    if (uploadError) {
      console.error('❌ [LiveKit Webhook] Upload error:', uploadError);
      throw uploadError;
    }

    console.log('✅ [LiveKit Webhook] File uploaded to Supabase Storage');

    // Obter URL pública (ou gerar signed URL se bucket for privado)
    const { data: publicUrlData } = supabase.storage
      .from('meeting-recordings')
      .getPublicUrl(filePath);

    const publicUrl = publicUrlData.publicUrl;
    console.log('🔗 [LiveKit Webhook] Public URL:', publicUrl);

     // Atualizar registro no database
     const { error: updateError } = await supabase
       .from('meeting_recordings')
       .update({
         file_url: publicUrl,
         duration_seconds: duration,
         file_size: fileSize,
         status: 'completed',
         updated_at: new Date().toISOString(),
       })
       .eq('livekit_recording_id', egressInfo.egressId);

    if (updateError) {
      console.error('❌ [LiveKit Webhook] Database update error:', updateError);
      throw updateError;
    }

    console.log('✅ [LiveKit Webhook] Database updated successfully');
    console.log('🎉 [LiveKit Webhook] Recording processing complete');

    return new Response(JSON.stringify({ 
      message: 'Recording processed successfully',
      file_url: publicUrl,
      duration_seconds: duration,
      file_size: fileSize,
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('❌ [LiveKit Webhook] Error:', error);
    return new Response(JSON.stringify({ 
      error: error.message,
      details: error.toString(),
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
