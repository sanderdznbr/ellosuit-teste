import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Phone, PhoneOff, Mic, MicOff, Volume2, VolumeX, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';

type CallState = 'connecting' | 'ringing' | 'connected' | 'ended' | 'failed';

interface WhatsAppCallOverlayProps {
  contactName: string;
  contactPhone: string;
  profilePicture?: string | null;
  sessionId: string;
  callApi: (action: string, data: Record<string, unknown>) => Promise<any>;
  onClose: () => void;
}

const formatDuration = (seconds: number) => {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
};

const WhatsAppCallOverlay: React.FC<WhatsAppCallOverlayProps> = ({
  contactName,
  contactPhone,
  profilePicture,
  sessionId,
  callApi,
  onClose,
}) => {
  const [callState, setCallState] = useState<CallState>('connecting');
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeaker, setIsSpeaker] = useState(false);
  const [duration, setDuration] = useState(0);
  const [errorMessage, setErrorMessage] = useState('');

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement>(null);
  const unmountedRef = useRef(false);

  const cleanup = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    localStreamRef.current?.getTracks().forEach(t => t.stop());
    pcRef.current?.close();
    pcRef.current = null;
    localStreamRef.current = null;
  }, []);

  const startCall = useCallback(async () => {
    try {
      setCallState('connecting');

      // Get microphone access
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (unmountedRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      localStreamRef.current = stream;

      // Create RTCPeerConnection
      const pc = new RTCPeerConnection({
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
      });
      pcRef.current = pc;

      // Add audio track
      stream.getAudioTracks().forEach(track => pc.addTrack(track, stream));

      // Handle remote audio
      pc.ontrack = (event) => {
        if (remoteAudioRef.current && event.streams[0]) {
          remoteAudioRef.current.srcObject = event.streams[0];
          remoteAudioRef.current.play().catch(() => {});
        }
      };

      pc.oniceconnectionstatechange = () => {
        if (pc.iceConnectionState === 'connected' || pc.iceConnectionState === 'completed') {
          setCallState('connected');
          timerRef.current = setInterval(() => setDuration(d => d + 1), 1000);
        } else if (pc.iceConnectionState === 'disconnected' || pc.iceConnectionState === 'failed') {
          setCallState('ended');
          cleanup();
        }
      };

      // Create SDP offer
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      // Wait for ICE gathering to complete (or timeout)
      await new Promise<void>((resolve) => {
        if (pc.iceGatheringState === 'complete') { resolve(); return; }
        const timeout = setTimeout(resolve, 3000);
        pc.onicegatheringstatechange = () => {
          if (pc.iceGatheringState === 'complete') { clearTimeout(timeout); resolve(); }
        };
      });

      if (unmountedRef.current) return;

      const finalSdp = pc.localDescription?.sdp;
      if (!finalSdp) throw new Error('Failed to generate SDP offer');

      setCallState('ringing');

      // Send to YCloud API
      const result = await callApi('connect_call', {
        session_id: sessionId,
        to: contactPhone,
        sdp: finalSdp,
      });

      if (unmountedRef.current) return;

      if (!result.success) {
        throw new Error(result.error || 'Chamada não foi aceita');
      }

      // Set remote description (answer)
      if (result.sdp) {
        const answer = new RTCSessionDescription({ type: 'answer', sdp: result.sdp });
        await pc.setRemoteDescription(answer);
      }

    } catch (err: any) {
      if (unmountedRef.current) return;

      console.error('[WhatsApp Call] Error:', err);

      const details = (err?.details || {}) as Record<string, any>;
      const providerCode = details?.provider_error?.code;
      const internalCode = details?.code;
      const permissionDenied = internalCode === 'CALL_PERMISSION_DENIED' || providerCode === 'FORBIDDEN';

      setErrorMessage(
        permissionDenied
          ? 'Sua API key YCloud não possui permissão para WhatsApp Calls.'
          : (err.message || 'Erro ao realizar chamada')
      );
      setCallState('failed');
      cleanup();
    }
  }, [sessionId, contactPhone, callApi, cleanup]);

  useEffect(() => {
    unmountedRef.current = false;
    startCall();

    return () => {
      unmountedRef.current = true;
      cleanup();
    };
  }, [startCall, cleanup]);

  const handleEndCall = () => {
    setCallState('ended');
    cleanup();
    setTimeout(onClose, 1500);
  };

  const toggleMute = () => {
    const tracks = localStreamRef.current?.getAudioTracks();
    if (tracks) {
      tracks.forEach(t => { t.enabled = !t.enabled; });
      setIsMuted(!isMuted);
    }
  };

  const toggleSpeaker = () => {
    setIsSpeaker(!isSpeaker);
    // Speaker toggle is mainly for mobile - adjusts audio output
    if (remoteAudioRef.current) {
      (remoteAudioRef.current as any).setSinkId?.('default').catch(() => {});
    }
  };

  const stateLabel: Record<CallState, string> = {
    connecting: 'Conectando...',
    ringing: 'Chamando...',
    connected: formatDuration(duration),
    ended: 'Chamada encerrada',
    failed: errorMessage || 'Falha na chamada',
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <audio ref={remoteAudioRef} autoPlay />
      
      <div className="w-full max-w-sm mx-auto flex flex-col items-center gap-8 py-16 px-6">
        {/* Pulse ring behind avatar when ringing */}
        <div className="relative">
          {(callState === 'ringing' || callState === 'connecting') && (
            <>
              <div className="absolute inset-0 rounded-full bg-green-500/20 animate-ping" style={{ animationDuration: '2s' }} />
              <div className="absolute -inset-3 rounded-full bg-green-500/10 animate-pulse" />
            </>
          )}
          <Avatar className="h-28 w-28 border-4 border-white/20 shadow-2xl relative z-10">
            {profilePicture && <AvatarImage src={profilePicture} />}
            <AvatarFallback className="bg-gradient-to-br from-[#5A74D1] to-red-500 text-white text-3xl font-bold">
              {(contactName || contactPhone).substring(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
        </div>

        {/* Contact info */}
        <div className="text-center space-y-2">
          <h2 className="text-2xl font-bold text-white">{contactName || contactPhone}</h2>
          <p className={cn(
            "text-lg font-medium",
            callState === 'connected' ? "text-green-400" :
            callState === 'failed' ? "text-red-400" :
            "text-white/70"
          )}>
            {stateLabel[callState]}
          </p>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-6 mt-8">
          {callState !== 'ended' && callState !== 'failed' && (
            <>
              <button
                onClick={toggleMute}
                className={cn(
                  "h-14 w-14 rounded-full flex items-center justify-center transition-all",
                  isMuted ? "bg-red-500 text-white" : "bg-white/15 text-white hover:bg-white/25"
                )}
              >
                {isMuted ? <MicOff className="h-6 w-6" /> : <Mic className="h-6 w-6" />}
              </button>

              <button
                onClick={handleEndCall}
                className="h-16 w-16 rounded-full bg-red-600 hover:bg-red-700 text-white flex items-center justify-center shadow-lg shadow-red-600/30 transition-all active:scale-90"
              >
                <PhoneOff className="h-7 w-7" />
              </button>

              <button
                onClick={toggleSpeaker}
                className={cn(
                  "h-14 w-14 rounded-full flex items-center justify-center transition-all",
                  isSpeaker ? "bg-[#374DA4] text-white" : "bg-white/15 text-white hover:bg-white/25"
                )}
              >
                {isSpeaker ? <Volume2 className="h-6 w-6" /> : <VolumeX className="h-6 w-6" />}
              </button>
            </>
          )}

          {(callState === 'ended' || callState === 'failed') && (
            <button
              onClick={onClose}
              className="h-14 w-14 rounded-full bg-white/15 text-white hover:bg-white/25 flex items-center justify-center transition-all"
            >
              <X className="h-6 w-6" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default WhatsAppCallOverlay;
