import React, { useState, useEffect, useRef, useCallback } from 'react';
import { X, CheckCircle2 } from 'lucide-react';
import elloLogo from '@/assets/ellosuit-logo.png';
import { supabase } from '@/integrations/supabase/client';

interface WhatsAppSyncScreenProps {
  onComplete: () => void;
  sessionId: string;
}

const POLL_INTERVAL_MS = 3000;
const MAX_DURATION_MS = 120000; // 2 min max wait
const MIN_DISPLAY_MS = 8000; // show at least 8s

const syncMessages = [
  'Conectando ao WhatsApp...',
  'Puxando conversas...',
  'Sincronizando contatos...',
  'Carregando grupos...',
  'Baixando mensagens recentes...',
  'Processando mídias...',
  'Quase pronto...',
];

const WhatsAppSyncScreen: React.FC<WhatsAppSyncScreenProps> = ({ onComplete, sessionId }) => {
  const [progress, setProgress] = useState(0);
  const [messageIndex, setMessageIndex] = useState(0);
  const [isDone, setIsDone] = useState(false);
  const onCompleteRef = useRef(onComplete);
  const startTimeRef = useRef(Date.now());
  const hasCompletedRef = useRef(false);

  onCompleteRef.current = onComplete;

  const finishSync = useCallback(() => {
    if (hasCompletedRef.current) return;
    hasCompletedRef.current = true;
    setIsDone(true);
    setProgress(100);
    setMessageIndex(syncMessages.length - 1);
    setTimeout(() => {
      onCompleteRef.current();
    }, 1500);
  }, []);

  // Poll for actual sync status
  useEffect(() => {
    let pollTimer: ReturnType<typeof setInterval>;
    let maxTimer: ReturnType<typeof setTimeout>;

    const checkSync = async () => {
      try {
        const { data, error } = await supabase
          .from('whatsapp_conversations')
          .select('id', { count: 'exact', head: true })
          .eq('session_id', sessionId);

        const count = data ? (Array.isArray(data) ? data.length : 0) : 0;
        const elapsed = Date.now() - startTimeRef.current;

        // If we have conversations and minimum display time passed, complete
        if ((count > 0 || !error) && elapsed >= MIN_DISPLAY_MS) {
          finishSync();
        }
      } catch (e) {
        console.error('[SyncScreen] Poll error:', e);
      }
    };

    pollTimer = setInterval(checkSync, POLL_INTERVAL_MS);
    
    // Hard max timeout
    maxTimer = setTimeout(() => {
      finishSync();
    }, MAX_DURATION_MS);

    return () => {
      clearInterval(pollTimer);
      clearTimeout(maxTimer);
    };
  }, [sessionId, finishSync]);

  // Animated progress (visual only, smooth increment)
  useEffect(() => {
    if (isDone) return;

    const interval = setInterval(() => {
      const elapsed = Date.now() - startTimeRef.current;
      // Ease-out curve: fast start, slow towards 90%
      const raw = Math.min(elapsed / MAX_DURATION_MS, 1);
      const eased = 1 - Math.pow(1 - raw, 3); // cubic ease-out
      const visualProgress = Math.min(eased * 90, 90); // cap at 90% until truly done

      setProgress(visualProgress);

      const msgIdx = Math.min(
        Math.floor((visualProgress / 90) * (syncMessages.length - 1)),
        syncMessages.length - 2 // reserve last message for completion
      );
      setMessageIndex(msgIdx);
    }, 200);

    return () => clearInterval(interval);
  }, [isDone]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center" style={{ backgroundColor: '#374DA4' }}>
      {/* Close button */}
      <button
        onClick={() => {
          hasCompletedRef.current = true;
          onCompleteRef.current();
        }}
        className="absolute top-5 right-5 p-2 rounded-full text-white/60 hover:text-white hover:bg-white/10 transition-colors"
        aria-label="Fechar"
      >
        <X className="h-5 w-5" />
      </button>

      {/* Logo */}
      <div className="mb-10">
        <img src={elloLogo} alt="Ellosuit" className="h-16 w-auto object-contain brightness-0 invert" />
      </div>

      {/* Progress bar */}
      <div className="w-72 max-w-[80%] mb-6">
        <div className="h-2.5 rounded-full overflow-hidden bg-white/20 backdrop-blur-sm">
          <div
            className="h-full rounded-full transition-all duration-500 ease-out"
            style={{
              width: `${progress}%`,
              background: isDone
                ? 'linear-gradient(90deg, #4ade80, #22c55e)'
                : 'linear-gradient(90deg, #fff 0%, rgba(255,255,255,0.85) 100%)',
            }}
          />
        </div>
        <p className="text-center text-sm text-white/80 mt-2 font-medium tabular-nums">
          {Math.round(progress)}%
        </p>
      </div>

      {/* Status message */}
      <div className="flex items-center gap-2">
        {isDone && <CheckCircle2 className="h-5 w-5 text-green-300 animate-in fade-in" />}
        <p className="text-lg font-semibold text-white transition-all duration-300">
          {isDone ? 'Sincronização concluída!' : syncMessages[messageIndex]}
        </p>
      </div>
    </div>
  );
};

export default WhatsAppSyncScreen;
