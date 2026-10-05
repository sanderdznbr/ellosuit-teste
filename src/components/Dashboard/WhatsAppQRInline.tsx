import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { CheckCircle2, Loader2, RefreshCw, Smartphone } from 'lucide-react';

interface WhatsAppQRInlineProps {
  qrCode: string;
  sessionId: string;
  onConnected: () => void;
}

const WhatsAppQRInline: React.FC<WhatsAppQRInlineProps> = ({ qrCode, sessionId, onConnected }) => {
  const [status, setStatus] = useState<'scanning' | 'connected' | 'error'>('scanning');
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    // Poll session status every 3 seconds
    intervalRef.current = setInterval(async () => {
      const { data } = await supabase
        .from('whatsapp_sessions')
        .select('status')
        .eq('id', sessionId)
        .single();

      if (data?.status === 'connected') {
        setStatus('connected');
        if (intervalRef.current) clearInterval(intervalRef.current);
        onConnected();
      }
    }, 3000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [sessionId, onConnected]);

  if (status === 'connected') {
    return (
      <div className="mt-3 flex items-center gap-2 p-3 rounded-xl bg-green-500/10 border border-green-500/20">
        <CheckCircle2 className="h-5 w-5 text-green-500" />
        <span className="text-sm font-medium text-green-600">WhatsApp vinculado com sucesso!</span>
      </div>
    );
  }

  return (
    <div className="mt-3 flex flex-col items-center gap-3 p-4 rounded-xl bg-muted/50 border border-border">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Smartphone className="h-4 w-4" />
        <span>{qrCode ? 'Escaneie com seu WhatsApp' : 'agora o qrcode gera?'}</span>
      </div>
      <div className="bg-white p-3 rounded-xl min-h-[200px] flex items-center justify-center">
        {qrCode ? (
          <img
            src={
              qrCode.startsWith('data:') || qrCode.startsWith('http')
                ? qrCode
                : `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qrCode)}`
            }
            alt="QR Code WhatsApp"
            className="w-48 h-48"
          />
        ) : (
          <div className="w-48 h-48 flex items-center justify-center bg-gray-50 rounded-lg">
            <Loader2 className="h-8 w-8 animate-spin text-primary/20" />
          </div>
        )}
      </div>
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Loader2 className="h-3 w-3 animate-spin" />
        <span>{qrCode ? 'Aguardando conexão...' : 'Gerando instância...'}</span>
      </div>
    </div>
  );
};

export default WhatsAppQRInline;
