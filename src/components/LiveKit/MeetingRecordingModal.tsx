import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { PlayCircle, Loader2, AlertCircle, ExternalLink, Video } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';

interface MeetingRecordingModalProps {
  isOpen: boolean;
  onClose: () => void;
  meetingId: string | null;
  roomId?: string | null;
}

const MeetingRecordingModal: React.FC<MeetingRecordingModalProps> = ({
  isOpen,
  onClose,
  meetingId,
  roomId
}) => {
  const [loading, setLoading] = useState(true);
  const [recording, setRecording] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && (meetingId || roomId)) {
      fetchRecording();
      // Polling for status update if it's processing
      const interval = setInterval(() => {
        if (!recording?.file_url || recording?.status === 'processing' || recording?.status === 'finalizing') {
          fetchRecording();
        }
      }, 5000);
      return () => clearInterval(interval);
    }
  }, [isOpen, meetingId, roomId]);

  const fetchRecording = async () => {
    try {
      let data: any = null;

      // Prefer recording rows tied to the room that actually have a file_url / livekit egress
      if (roomId) {
        const { data: rows } = await supabase
          .from('meeting_recordings')
          .select('*')
          .eq('room_id', roomId)
          .order('created_at', { ascending: false });

        if (rows && rows.length > 0) {
          data =
            rows.find((r: any) => r.file_url && r.file_url !== '') ||
            rows.find((r: any) => r.livekit_recording_id) ||
            rows[0];
        }
      }

      if (!data && meetingId) {
        const { data: rec, error: fetchError } = await supabase
          .from('meeting_recordings')
          .select('*')
          .eq('id', meetingId)
          .single();
        if (fetchError) throw fetchError;
        data = rec;
      }

      setRecording(data);
    } catch (err) {
      console.error('Error fetching recording:', err);
      setError('Não foi possível carregar as informações da gravação.');
    } finally {
      setLoading(false);
    }
  };

   const isProcessing = !recording?.file_url && (recording?.status === 'processing' || recording?.status === 'finalizing' || (recording?.status !== 'completed' && !recording?.file_url));

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl p-0 bg-[#0A0A0B] border-white/10 rounded-[32px] overflow-hidden text-white shadow-2xl">
        <DialogHeader className="px-8 py-6 border-b border-white/5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center">
              <Video className="w-5 h-5 text-purple-400" />
            </div>
            <div>
              <DialogTitle className="text-xl font-bold">Gravação da Reunião</DialogTitle>
              <DialogDescription className="text-zinc-500">
                {recording?.title || 'Carregando detalhes...'}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="p-8 min-h-[400px] flex flex-col items-center justify-center bg-zinc-950/50">
          {loading ? (
            <div className="flex flex-col items-center gap-4">
              <Loader2 className="w-12 h-12 text-purple-500 animate-spin" />
              <p className="text-zinc-400 font-medium">Buscando gravação...</p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center gap-4 text-center max-w-sm">
              <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mb-2">
                <AlertCircle className="w-8 h-8 text-red-500" />
              </div>
              <p className="text-white font-semibold">{error}</p>
              <Button onClick={fetchRecording} variant="outline" className="mt-2">
                Tentar novamente
              </Button>
            </div>
          ) : isProcessing ? (
            <div className="flex flex-col items-center gap-6 text-center max-w-md animate-in fade-in duration-700">
              <div className="relative">
                <div className="w-24 h-24 rounded-full border-4 border-purple-500/20 flex items-center justify-center">
                  <Loader2 className="w-10 h-10 text-purple-500 animate-spin" />
                </div>
                <div className="absolute inset-0 w-24 h-24 rounded-full border-t-4 border-purple-500 animate-spin" />
              </div>
              <div className="space-y-2">
                <h3 className="text-2xl font-bold text-white">Processando Vídeo</h3>
                <p className="text-zinc-400 font-light leading-relaxed">
                  A gravação está sendo finalizada e otimizada para reprodução. 
                  Isso pode levar alguns minutos dependendo da duração da reunião.
                </p>
              </div>
              <div className="px-4 py-2 bg-purple-500/10 border border-purple-500/20 rounded-full">
                <span className="text-xs font-bold text-purple-400 uppercase tracking-widest">
                  Status: {recording?.status === 'finalizing' ? 'Finalizando' : 'Processando'}
                </span>
              </div>
            </div>
          ) : recording?.file_url ? (
            <div className="w-full aspect-video rounded-2xl overflow-hidden border border-white/5 bg-black shadow-inner">
              <video 
                src={recording.file_url} 
                controls 
                className="w-full h-full object-contain"
                poster="/placeholder.svg"
                autoPlay
              />
            </div>
          ) : (
            <div className="flex flex-col items-center gap-4 text-center">
              <div className="w-16 h-16 rounded-full bg-zinc-800 flex items-center justify-center">
                <PlayCircle className="w-8 h-8 text-zinc-600" />
              </div>
              <p className="text-zinc-400">Nenhum arquivo de vídeo encontrado para esta reunião.</p>
            </div>
          )}
        </div>

        <div className="px-8 py-6 border-t border-white/5 bg-zinc-900/30 flex items-center justify-between">
          <p className="text-[10px] text-zinc-600 uppercase tracking-[0.2em] font-bold">
            Powered by ElloSuit Egress
          </p>
          <Button 
            variant="ghost" 
            className="text-zinc-400 hover:text-white transition-colors gap-2"
            onClick={() => window.open(`/meet-hub?meetingId=${meetingId}`, '_blank')}
          >
            <ExternalLink className="w-4 h-4" />
            Ver no Histórico
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default MeetingRecordingModal;