import React, { useState, useRef, useCallback, useEffect } from 'react';
import { X, Mic, Square, Volume2, VolumeX, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface VoiceMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

interface VoiceConversationProps {
  open: boolean;
  onClose: () => void;
  bgColor: string;
  companyId: string | null;
}

type VoiceState = 'idle' | 'listening' | 'transcribing' | 'thinking' | 'speaking';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

const VoiceConversation: React.FC<VoiceConversationProps> = ({ open, onClose, bgColor, companyId }) => {
  const { user } = useAuth();
  const [state, setState] = useState<VoiceState>('idle');
  const [messages, setMessages] = useState<VoiceMessage[]>([]);
  const [currentTranscript, setCurrentTranscript] = useState('');
  const [currentResponse, setCurrentResponse] = useState('');
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);
  const [muted, setMuted] = useState(false);

  // Cleanup on close
  useEffect(() => {
    if (!open) {
      stopEverything();
      setMessages([]);
      setCurrentTranscript('');
      setCurrentResponse('');
      setState('idle');
    }
  }, [open]);

  const stopEverything = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current = null;
    }
  }, []);

  const startListening = useCallback(async () => {
    if (state !== 'idle' && state !== 'speaking') return;

    // Stop any playing audio
    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current = null;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        if (audioBlob.size < 1000) {
          setState('idle');
          return;
        }
        await processAudio(audioBlob);
      };

      mediaRecorder.start();
      setState('listening');
      setCurrentTranscript('');
      setCurrentResponse('');
    } catch {
      setState('idle');
    }
  }, [state]);

  const stopListening = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    setState('transcribing');
  }, []);

  const processAudio = async (audioBlob: Blob) => {
    setState('transcribing');

    try {
      // 1. Transcribe
      const formData = new FormData();
      formData.append('audio', audioBlob, 'recording.webm');

      const sttResponse = await fetch(`${SUPABASE_URL}/functions/v1/elevenlabs-stt`, {
        method: 'POST',
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`,
        },
        body: formData,
      });

      if (!sttResponse.ok) throw new Error('STT failed');
      const sttData = await sttResponse.json();
      const transcript = sttData.text?.trim();

      if (!transcript) {
        setState('idle');
        return;
      }

      setCurrentTranscript(transcript);
      const userMsg: VoiceMessage = { id: `u-${Date.now()}`, role: 'user', content: transcript };
      setMessages(prev => [...prev, userMsg]);

      // 2. AI response
      setState('thinking');
      const { data, error } = await supabase.functions.invoke('ai-assistant', {
        body: {
          message: transcript,
          userId: user?.id,
          companyId,
          messages: messages.map(m => ({ role: m.role, content: m.content })),
        },
      });

      if (error) throw error;
      const responseText = data.response || 'Desculpe, não entendi.';

      setCurrentResponse(responseText);
      const assistantMsg: VoiceMessage = { id: `a-${Date.now()}`, role: 'assistant', content: responseText };
      setMessages(prev => [...prev, assistantMsg]);

      // 3. TTS
      if (!muted) {
        setState('speaking');
        const cleanText = responseText
          .replace(/[→←↑↓]/g, '')
          .replace(/[*_~`#]/g, '')
          .replace(/\[.*?\]/g, '')
          .replace(/https?:\/\/\S+/g, '')
          .trim();

        if (cleanText) {
          const ttsResponse = await fetch(`${SUPABASE_URL}/functions/v1/elevenlabs-tts`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              apikey: SUPABASE_KEY,
              Authorization: `Bearer ${SUPABASE_KEY}`,
            },
            body: JSON.stringify({ text: cleanText, voiceId: 'RGymW84CSmfVugnA5tvA' }),
          });

          if (ttsResponse.ok) {
            const audioBlob = await ttsResponse.blob();
            const audioUrl = URL.createObjectURL(audioBlob);
            const audio = new Audio(audioUrl);
            currentAudioRef.current = audio;

            audio.onended = () => {
              currentAudioRef.current = null;
              URL.revokeObjectURL(audioUrl);
              setState('idle');
            };
            audio.onerror = () => {
              currentAudioRef.current = null;
              setState('idle');
            };

            await audio.play();
            return;
          }
        }
      }

      setState('idle');
    } catch (err) {
      console.error('Voice conversation error:', err);
      setState('idle');
    }
  };

  const handleOrbClick = () => {
    if (state === 'listening') {
      stopListening();
    } else if (state === 'idle' || state === 'speaking') {
      startListening();
    }
  };

  const stateLabel: Record<VoiceState, string> = {
    idle: 'Toque para falar',
    listening: 'Ouvindo...',
    transcribing: 'Transcrevendo...',
    thinking: 'Pensando...',
    speaking: 'Respondendo...',
  };

  if (!open) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] flex flex-col items-center justify-center"
        style={{ background: `linear-gradient(135deg, ${bgColor}, ${bgColor}dd, ${bgColor}bb)` }}
      >
        {/* Header - high z-index and safe padding for mobile */}
        <div className="absolute top-0 left-0 right-0 z-[110] flex items-center justify-between px-5 pt-[env(safe-area-inset-top,20px)] pb-2">
          <button
            onClick={() => setMuted(!muted)}
            className="p-3.5 rounded-full bg-white/15 hover:bg-white/25 active:scale-95 transition-all"
          >
            {muted ? <VolumeX className="h-6 w-6 text-white/80" /> : <Volume2 className="h-6 w-6 text-white/80" />}
          </button>
          <button
            onClick={() => { stopEverything(); onClose(); }}
            className="p-3.5 rounded-full bg-white/15 hover:bg-white/25 active:scale-95 transition-all"
          >
            <X className="h-6 w-6 text-white" />
          </button>
        </div>

        {/* Transcript area */}
        <div className="flex-1 flex flex-col items-center justify-center w-full px-6 max-w-lg">
          {/* AI response text */}
          <AnimatePresence mode="wait">
            {currentResponse && (state === 'speaking' || state === 'idle') && (
              <motion.p
                key="response"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="text-white text-center text-lg md:text-xl font-medium leading-relaxed mb-8 max-h-[30vh] overflow-y-auto"
              >
                {currentResponse}
              </motion.p>
            )}
            {currentTranscript && state === 'thinking' && (
              <motion.p
                key="transcript"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="text-white/60 text-center text-base mb-8"
              >
                "{currentTranscript}"
              </motion.p>
            )}
          </AnimatePresence>

          {/* The Orb */}
          <motion.button
            onClick={handleOrbClick}
            disabled={state === 'transcribing' || state === 'thinking'}
            className="relative flex items-center justify-center w-28 h-28 md:w-36 md:h-36 rounded-full focus:outline-none disabled:cursor-wait"
            whileTap={{ scale: 0.92 }}
          >
            {/* Outer glow ring */}
            <motion.div
              className="absolute inset-0 rounded-full"
              style={{ border: '2px solid rgba(255,255,255,0.2)' }}
              animate={
                state === 'listening'
                  ? { scale: [1, 1.25, 1], opacity: [0.4, 0.1, 0.4] }
                  : state === 'speaking'
                  ? { scale: [1, 1.15, 1], opacity: [0.3, 0.1, 0.3] }
                  : { scale: 1, opacity: 0.2 }
              }
              transition={
                state === 'listening' || state === 'speaking'
                  ? { duration: 1.5, repeat: Infinity, ease: 'easeInOut' }
                  : { duration: 0.3 }
              }
            />

            {/* Second ring */}
            {(state === 'listening' || state === 'speaking') && (
              <motion.div
                className="absolute inset-[-8px] rounded-full"
                style={{ border: '1.5px solid rgba(255,255,255,0.1)' }}
                animate={{ scale: [1, 1.3, 1], opacity: [0.3, 0, 0.3] }}
                transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut', delay: 0.3 }}
              />
            )}

            {/* Inner orb */}
            <motion.div
              className="w-24 h-24 md:w-32 md:h-32 rounded-full flex items-center justify-center"
              style={{
                background: state === 'listening'
                  ? 'radial-gradient(circle, rgba(255,255,255,0.35) 0%, rgba(255,255,255,0.1) 70%)'
                  : state === 'speaking'
                  ? 'radial-gradient(circle, rgba(255,255,255,0.25) 0%, rgba(255,255,255,0.08) 70%)'
                  : 'radial-gradient(circle, rgba(255,255,255,0.2) 0%, rgba(255,255,255,0.05) 70%)',
                backdropFilter: 'blur(20px)',
              }}
              animate={
                state === 'listening'
                  ? { scale: [1, 1.06, 1] }
                  : state === 'speaking'
                  ? { scale: [1, 1.04, 1] }
                  : {}
              }
              transition={
                state === 'listening' || state === 'speaking'
                  ? { duration: 1.2, repeat: Infinity, ease: 'easeInOut' }
                  : {}
              }
            >
              {state === 'transcribing' || state === 'thinking' ? (
                <Loader2 className="h-10 w-10 md:h-12 md:w-12 text-white animate-spin" />
              ) : state === 'listening' ? (
                <Square className="h-8 w-8 md:h-10 md:w-10 text-white" fill="white" />
              ) : (
                <Mic className="h-10 w-10 md:h-12 md:w-12 text-white" />
              )}
            </motion.div>
          </motion.button>

          {/* State label */}
          <motion.p
            key={state}
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-6 text-white/60 text-sm font-medium tracking-wide"
          >
            {stateLabel[state]}
          </motion.p>
        </div>

        {/* Conversation history at bottom */}
        {messages.length > 0 && (
          <div className="w-full max-w-lg px-6 pb-8 max-h-[20vh] overflow-y-auto">
            <div className="space-y-2">
              {messages.slice(-4).map((msg) => (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 0.6 }}
                  className={`text-xs ${msg.role === 'user' ? 'text-white/40 text-right' : 'text-white/55 text-left'}`}
                >
                  <span className="font-medium">{msg.role === 'user' ? 'Você' : 'IA'}:</span>{' '}
                  {msg.content.slice(0, 80)}{msg.content.length > 80 ? '...' : ''}
                </motion.div>
              ))}
            </div>
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
};

export default VoiceConversation;
