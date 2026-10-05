// WebRTC Signaling Server for Real-time Meetings
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Store WebSocket connections by room
const roomConnections = new Map<string, Map<string, WebSocket>>();

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const upgradeHeader = req.headers.get('upgrade') || '';
    if (upgradeHeader.toLowerCase() !== 'websocket') {
      return new Response('Expected WebSocket connection', { status: 400, headers: corsHeaders });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { socket, response } = Deno.upgradeWebSocket(req);

    let peerId: string | null = null;
    let roomId: string | null = null;

    socket.onopen = () => {
      console.log('🔌 WebSocket opened');
    };

    socket.onmessage = async (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log('📨 Received:', data.type);

        if (data.type === 'join-room') {
          const roomCode: string = data.roomCode;
          const displayName: string = data.displayName;
          const userId = data.userId ?? null;

          // Get room
          const { data: room, error: roomError } = await supabase
            .from('meeting_rooms')
            .select('*')
            .eq('room_code', roomCode)
            .eq('is_active', true)
            .single();
          
          if (roomError || !room) {
            socket.send(JSON.stringify({ type: 'error', message: 'Room not found or inactive' }));
            return;
          }

          // Generate peer ID
          peerId = `peer_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
          roomId = room.id;
          
          if (!roomId) {
            socket.send(JSON.stringify({ type: 'error', message: 'Invalid room ID' }));
            return;
          }

          // Add participant
          const { data: participant, error: participantError } = await supabase
            .from('room_participants')
            .insert({
              room_id: room.id,
              user_id: userId,
              display_name: displayName,
              peer_id: peerId,
              is_host: userId ? room.created_by === userId : false,
              connection_status: 'connected',
            })
            .select()
            .single();
          
          if (participantError || !participant) {
            console.error('❌ Error adding participant:', participantError);
            socket.send(JSON.stringify({ type: 'error', message: 'Failed to join room' }));
            return;
          }

          // Store connection
          if (!roomConnections.has(roomId)) {
            roomConnections.set(roomId, new Map());
          }
          roomConnections.get(roomId)!.set(peerId, socket);

          // Get other active participants (exclude this one)
          const { data: others } = await supabase
            .from('room_participants')
            .select('id, peer_id, display_name, is_host')
            .eq('room_id', room.id)
            .is('left_at', null)
            .neq('id', participant.id);

          // Send success response
          socket.send(JSON.stringify({
            type: 'joined-room',
            room,
            participant,
            peerId,
            otherParticipants: others ?? [],
          }));

          // Notify other participants
          const roomSockets = roomConnections.get(roomId);
          if (roomSockets) {
            const newParticipantMessage = JSON.stringify({
              type: 'participant-joined',
              participant: {
                id: participant.id,
                peer_id: peerId,
                display_name: displayName,
                is_host: participant.is_host
              }
            });

            for (const [otherPeerId, otherSocket] of roomSockets) {
              if (otherPeerId !== peerId && otherSocket.readyState === WebSocket.OPEN) {
                otherSocket.send(newParticipantMessage);
              }
            }
          }

          console.log(`✅ Participant joined: ${displayName} (${peerId}) in room ${room.id}`);

        } else if (data.type === 'webrtc-offer' || data.type === 'webrtc-answer' || data.type === 'webrtc-ice-candidate') {
          // Forward WebRTC signaling messages to specific peer
          if (!roomId || !peerId) {
            socket.send(JSON.stringify({ type: 'error', message: 'Not joined to any room' }));
            return;
          }

          const targetPeerId = data.targetPeerId;
          const roomSockets = roomConnections.get(roomId);
          
          if (roomSockets && roomSockets.has(targetPeerId)) {
            const targetSocket = roomSockets.get(targetPeerId);
            if (targetSocket && targetSocket.readyState === WebSocket.OPEN) {
              // Forward the message with sender info
              const forwardedMessage = {
                ...data,
                fromPeerId: peerId
              };
              targetSocket.send(JSON.stringify(forwardedMessage));
              console.log(`📤 Forwarded ${data.type} from ${peerId} to ${targetPeerId}`);
            }
          }

        } else if (data.type === 'chat-message') {
          // Broadcast chat message to all participants in room
          if (!roomId || !peerId) {
            socket.send(JSON.stringify({ type: 'error', message: 'Not joined to any room' }));
            return;
          }

          const roomSockets = roomConnections.get(roomId);
          if (roomSockets) {
            const chatMessage = JSON.stringify({
              type: 'chat-message',
              message: data.message,
              senderName: data.senderName,
              timestamp: new Date().toISOString()
            });

            for (const [otherPeerId, otherSocket] of roomSockets) {
              if (otherPeerId !== peerId && otherSocket.readyState === WebSocket.OPEN) {
                otherSocket.send(chatMessage);
              }
            }
          }
          
        } else if (data.type === 'ping') {
          socket.send(JSON.stringify({ type: 'pong' }));
        }
      } catch (e) {
        console.error('❌ onmessage error:', e);
        try { 
          socket.send(JSON.stringify({ type: 'error', message: 'Failed to process message' })); 
        } catch (_) {}
      }
    };

    socket.onclose = async () => {
      console.log('🔌 WebSocket closed');
      
      // Clean up participant and notify others
      if (peerId && roomId) {
        try {
          // Mark participant as left
          await supabase
            .from('room_participants')
            .update({ left_at: new Date().toISOString() })
            .eq('peer_id', peerId);

          // Remove from connections
          const roomSockets = roomConnections.get(roomId);
          if (roomSockets) {
            roomSockets.delete(peerId);
            
            // Notify other participants
            const leftMessage = JSON.stringify({
              type: 'participant-left',
              peerId: peerId
            });

            for (const [otherPeerId, otherSocket] of roomSockets) {
              if (otherSocket.readyState === WebSocket.OPEN) {
                otherSocket.send(leftMessage);
              }
            }

            // Clean up empty room connections
            if (roomSockets.size === 0) {
              roomConnections.delete(roomId);
            }
          }

          console.log(`👋 Participant left: ${peerId} from room ${roomId}`);
        } catch (error) {
          console.error('❌ Error cleaning up participant:', error);
        }
      }
    };

    socket.onerror = (err) => console.error('❌ WebSocket error:', err);

    return response;
  } catch (error) {
    console.error('❌ Server error:', error);
    return new Response(JSON.stringify({ error: (error as Error).message }), { 
      status: 500, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });
  }
});