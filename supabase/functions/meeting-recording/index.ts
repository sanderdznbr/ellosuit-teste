import { createClient } from "npm:@supabase/supabase-js@2";
import { EgressClient, EncodedFileOutput, EncodedFileType, S3Upload } from 'npm:livekit-server-sdk@2.13.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

const LIVEKIT_API_KEY = Deno.env.get('LIVEKIT_API_KEY') ?? '';
const LIVEKIT_API_SECRET = Deno.env.get('LIVEKIT_API_SECRET') ?? '';
const LIVEKIT_URL = (Deno.env.get('LIVEKIT_URL') ?? '').replace('wss://', 'https://');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? '';

const LIVEKIT_S3_ENDPOINT = Deno.env.get('LIVEKIT_S3_ENDPOINT') ?? '';
const LIVEKIT_S3_REGION = Deno.env.get('LIVEKIT_S3_REGION') ?? '';
const LIVEKIT_S3_ACCESS_KEY = Deno.env.get('LIVEKIT_S3_ACCESS_KEY') ?? '';
const LIVEKIT_S3_SECRET = Deno.env.get('LIVEKIT_S3_SECRET') ?? '';
const LIVEKIT_S3_BUCKET = Deno.env.get('LIVEKIT_S3_BUCKET') ?? 'meeting-recordings';

const getPublicRecordingUrl = (path: string) =>
  `${SUPABASE_URL}/storage/v1/object/public/meeting-recordings/${encodeURIComponent(path).replace(/%2F/g, '/')}`;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, roomName, userId, companyId, recordingId, livekitRecordingId } = await req.json();
    console.log('📹 [meeting-recording] ===== INÍCIO =====');
    console.log('📹 [meeting-recording] Action:', action);
    console.log('📹 [meeting-recording] Room Name:', roomName);
    console.log('📹 [meeting-recording] User ID:', userId);
    console.log('📹 [meeting-recording] Company ID:', companyId);
    console.log('📹 [meeting-recording] Recording ID:', recordingId);
    console.log('📹 [meeting-recording] LiveKit Recording ID:', livekitRecordingId);

    // Resolve room_id (uuid) from room_code (text) first
    const { data: room, error: roomErr } = await supabase
      .from('meeting_rooms')
      .select('id')
      .eq('room_code', roomName)
      .single();

    if (roomErr || !room) {
      console.error('❌ [meeting-recording] Room lookup error:', roomErr);
      // If LiveKit fails, still allow fallback recording by returning a success response
      if (action === 'start') {
        console.warn('⚠️ [meeting-recording] Using fallback recording method');
        return new Response(JSON.stringify({ 
          success: true, 
          fallback: true,
          message: 'Using fallback recording method'
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      throw new Error('Sala não encontrada');
    }

    const roomId: string = room.id as string;
    console.log('✅ [meeting-recording] Room ID resolved:', roomId);

    // Check LiveKit credentials - if missing, use fallback
    if (!LIVEKIT_API_KEY || !LIVEKIT_API_SECRET || !LIVEKIT_URL) {
      console.warn('⚠️ [meeting-recording] LiveKit credentials not configured, using fallback');
      if (action === 'start') {
        return new Response(JSON.stringify({ 
          success: true, 
          fallback: true,
          message: 'LiveKit not configured, using fallback recording'
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // Initialize LiveKit Egress Client
    console.log('🔧 [meeting-recording] Initializing LiveKit Egress Client');
    const egressClient = new EgressClient(LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET);

    if (action === 'start') {
      console.log('🎬 [meeting-recording] Starting recording...');
      
      // Create the recording record FIRST to ensure we have a valid file path
      let recording = null;
      const timestamp = Date.now();
      const fileName = `${roomName}-${timestamp}.mp4`;
      const bucketName = 'meeting-recordings';
      const filePath = `${fileName}`;
      
      console.log('📝 [meeting-recording] Creating database record...');
      console.log('📝 [meeting-recording] File path:', filePath);
      const publicFileUrl = getPublicRecordingUrl(filePath);
      
      if (roomId && companyId && userId) {
        const { data: rec, error } = await supabase
          .from('meeting_recordings')
          .insert({
            room_id: roomId,
            company_id: companyId,
            created_by: userId,
            title: `Gravação - ${new Date().toLocaleString('pt-BR')}`,
            file_url: publicFileUrl, // caminho público conhecido antes da finalização do S3
             livekit_recording_id: '', // Será atualizado após iniciar egress
             status: 'recording',
          })
          .select()
          .single();

        if (error) {
          console.error('❌ [meeting-recording] Database error:', error);
          throw new Error('Erro ao criar registro de gravação');
        } else {
          recording = rec;
          console.log('✅ [meeting-recording] Recording record created:', recording.id);
        }
      }

      try {
        // Configure RoomComposite Egress request using v2 API format
        // LiveKit salvará no próprio storage temporário
        // O webhook irá fazer download e upload para Supabase
        const s3Upload: S3Upload = {
          accessKey: LIVEKIT_S3_ACCESS_KEY,
          secret: LIVEKIT_S3_SECRET,
          region: LIVEKIT_S3_REGION,
          bucket: LIVEKIT_S3_BUCKET,
          endpoint: LIVEKIT_S3_ENDPOINT,
          forcePathStyle: true,
        };

        const fileOutput: EncodedFileOutput = {
          fileType: EncodedFileType.MP4,
          filepath: filePath,
          output: { case: 's3', value: s3Upload },
        } as EncodedFileOutput;

        console.log('🚀 [meeting-recording] Starting LiveKit Egress...');
        console.log('🚀 [meeting-recording] Room:', roomName);
        console.log('🚀 [meeting-recording] File path:', filePath);

        // The correct signature for v2 SDK:
        // startRoomCompositeEgress(roomName, output, options)
        // output can be EncodedFileOutput directly
        console.log('🚀 [meeting-recording] Calling startRoomCompositeEgress with proper params');
        const egressInfo = await egressClient.startRoomCompositeEgress(
          roomName, 
          fileOutput, 
          { layout: 'speaker-dark' }
        );
        
        console.log('✅ [meeting-recording] LiveKit recording started!');
        console.log('✅ [meeting-recording] Egress ID:', egressInfo.egressId);
        console.log('✅ [meeting-recording] Full egress info:', JSON.stringify(egressInfo, null, 2));

        // Atualizar registro com LiveKit Recording ID
        if (recording) {
          console.log('📝 [meeting-recording] Updating database with LiveKit Recording ID...');
          const { error: updateError } = await supabase
            .from('meeting_recordings')
            .update({ livekit_recording_id: egressInfo.egressId, file_url: publicFileUrl })
            .eq('id', recording.id);

          if (updateError) {
            console.error('❌ [meeting-recording] Error updating record:', updateError);
          } else {
            console.log('✅ [meeting-recording] Database record updated successfully');
          }
        }

        console.log('🎉 [meeting-recording] Recording start complete!');
        return new Response(JSON.stringify({ 
          success: true, 
          recording_id: recording?.id || '',
          livekit_recording_id: egressInfo.egressId || ''
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });

      } catch (error) {
        console.error('❌ [meeting-recording] LiveKit recording error:', error);
        console.error('❌ [meeting-recording] Error details:', JSON.stringify(error, null, 2));
        
        // If LiveKit fails but we created a database record, keep it for manual recording
        if (recording) {
          console.log('⚠️ [meeting-recording] Recording started: manual/fallback mode');
          return new Response(JSON.stringify({ 
            success: true, 
            recording_id: recording.id,
            fallback: true,
            message: 'Gravação iniciada em modo manual - certifique-se de gravar localmente'
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        } else {
          throw error;
        }
      }

    } else if (action === 'stop') {
      console.log('🛑 [meeting-recording] Stopping recording...');
      console.log('🛑 [meeting-recording] LiveKit Recording ID:', livekitRecordingId);
      console.log('🛑 [meeting-recording] Database Recording ID:', recordingId);
      let stoppedEgressInfo: any = null;
      
      // Stop recording via LiveKit SDK
      if (livekitRecordingId && LIVEKIT_API_KEY && LIVEKIT_API_SECRET && LIVEKIT_URL) {
        try {
          console.log('🛑 [meeting-recording] Calling LiveKit stopEgress...');
          const egressInfo = await egressClient.stopEgress(livekitRecordingId);
          stoppedEgressInfo = egressInfo;
          console.log('✅ [meeting-recording] LiveKit recording stopped successfully!');
          console.log('✅ [meeting-recording] Egress info:', JSON.stringify(egressInfo, null, 2));
        } catch (error) {
          console.error('❌ [meeting-recording] Failed to stop LiveKit recording:', error);
          console.error('❌ [meeting-recording] Error details:', JSON.stringify(error, null, 2));
        }
      } else {
        console.warn('⚠️ [meeting-recording] Missing LiveKit credentials or recording ID, skipping LiveKit stop');
      }

      // Update recording status only if we have a valid recordingId
      if (recordingId) {
        console.log('📝 [meeting-recording] Updating database record...');
         const filename = stoppedEgressInfo?.fileResults?.[0]?.filename || stoppedEgressInfo?.file?.filename || '';
         const rawDuration = Number(stoppedEgressInfo?.fileResults?.[0]?.duration || stoppedEgressInfo?.file?.duration || 0);
         const durationSeconds = rawDuration > 0
           ? Math.floor(rawDuration / 1_000_000_000)
           : 0;
         const { error } = await supabase
           .from('meeting_recordings')
           .update({ 
             status: 'finalizing',
             file_url: filename ? getPublicRecordingUrl(filename) : undefined,
             duration_seconds: durationSeconds
           })
           .eq('id', recordingId);

        if (error) {
          console.error('❌ [meeting-recording] Database update error:', error);
        } else {
          console.log('✅ [meeting-recording] Recording database record updated');
        }
      }

      console.log('🎉 [meeting-recording] Recording stop complete!');
      console.log('🎉 [meeting-recording] Recording ID:', livekitRecordingId || 'fallback');

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Invalid action' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in meeting-recording function:', error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});