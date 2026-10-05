import React, { useState, useEffect } from 'react';
import { Play, Download, Trash2, Search, Calendar, Clock, History as HistoryIcon, Loader2, CheckCircle2, AlertCircle, Info, RefreshCw, Video } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface MeetingRecording {
  id: string;
  title: string;
  file_url: string;
  file_size: number | null;
  duration_seconds: number | null;
  transcript?: string;
  created_at: string;
  created_by: string;
  room_id: string;
  meeting_type?: string;
  status?: string;
  livekit_recording_id?: string | null;
  resolved_file_url?: string;
  resolved_file_path?: string;
  storage_status?: 'ready' | 'waiting' | 'missing';
  room?: {
    title: string;
    room_code: string;
  };
}

const MeetingRecordings: React.FC = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [recordings, setRecordings] = useState<MeetingRecording[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRecording, setSelectedRecording] = useState<MeetingRecording | null>(null);
  const [showPlayer, setShowPlayer] = useState(false);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [playbackUrl, setPlaybackUrl] = useState<string>('');
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [recordingToDelete, setRecordingToDelete] = useState<MeetingRecording | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    const fetchCompanyId = async () => {
      if (!user?.id) return;
      
      const { data, error } = await supabase
        .from('company_users')
        .select('company_id')
        .eq('user_id', user.id)
        .single();
      
      if (!error && data?.company_id) {
        setCompanyId(data.company_id);
      } else {
        setLoading(false);
      }
    };
    
    fetchCompanyId();
  }, [user?.id]);

  const loadRecordings = async () => {
    if (!companyId) return;
    
    try {
      const { data, error } = await supabase
        .from('meeting_recordings')
        .select(`
          *,
          room:meeting_rooms(title, room_code)
        `)
        .eq('company_id', companyId)
        .order('created_at', { ascending: false });
      
      if (error) {
        toast({
          title: 'Erro',
          description: 'Erro ao carregar gravações',
          variant: 'destructive'
        });
        return;
      }
      
      const enriched = await Promise.all((data || []).map(enrichRecording));
      setRecordings(enriched);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (companyId) {
      loadRecordings();
    }
  }, [companyId]);

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDuration = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  const getStoragePath = (value?: string | null): string => {
    if (!value) return '';
    const cleanValue = value.split('?')[0];
    const markers = [
      '/storage/v1/object/public/meeting-recordings/',
      '/storage/v1/s3/meeting-recordings/',
      '/meeting-recordings/',
    ];
    const marker = markers.find(item => cleanValue.includes(item));
    if (marker) return decodeURIComponent(cleanValue.split(marker)[1] || '');
    if (cleanValue.startsWith('meeting-recordings/')) return cleanValue.replace('meeting-recordings/', '');
    return /\.(mp4|webm|mov|m4a)$/i.test(cleanValue) ? cleanValue : '';
  };

  const getPublicRecordingUrl = (path: string): string => {
    return supabase.storage.from('meeting-recordings').getPublicUrl(path).data.publicUrl;
  };

  const checkStorageFile = async (path: string) => {
    try {
      const response = await fetch(getPublicRecordingUrl(path), { method: 'HEAD', cache: 'no-store' });
      return {
        exists: response.ok,
        size: Number(response.headers.get('content-length') || 0),
      };
    } catch {
      return { exists: false, size: 0 };
    }
  };

  const resolveManifestFile = async (egressId?: string | null) => {
    if (!egressId) return null;
    try {
      const manifestUrl = getPublicRecordingUrl(`${egressId}.json`);
      const response = await fetch(manifestUrl, { cache: 'no-store' });
      if (!response.ok) return null;
      const manifest = await response.json();
      const file = manifest?.files?.find((item: any) => /\.(mp4|webm|mov|m4a)$/i.test(item?.filename || item?.location || '')) || manifest?.files?.[0];
      const path = getStoragePath(file?.location) || file?.filename || '';
      const duration = manifest?.started_at && manifest?.ended_at
        ? Math.max(0, Math.floor((Number(manifest.ended_at) - Number(manifest.started_at)) / 1_000_000_000))
        : null;
      return path ? { path, duration } : null;
    } catch {
      return null;
    }
  };

  const enrichRecording = async (recording: MeetingRecording): Promise<MeetingRecording> => {
    let path = getStoragePath(recording.file_url);
    let duration = recording.duration_seconds;

    if (!path && recording.livekit_recording_id) {
      const manifestFile = await resolveManifestFile(recording.livekit_recording_id);
      if (manifestFile) {
        path = manifestFile.path;
        duration = duration || manifestFile.duration;
      }
    }

    if (!path) {
      return { ...recording, storage_status: recording.status === 'failed' ? 'missing' : 'waiting' };
    }

    const storageFile = await checkStorageFile(path);
    return {
      ...recording,
      status: storageFile.exists ? 'completed' : recording.status,
      duration_seconds: duration,
      file_size: recording.file_size || storageFile.size || null,
      resolved_file_path: path,
      resolved_file_url: getPublicRecordingUrl(path),
      storage_status: storageFile.exists ? 'ready' : 'waiting',
    };
  };

  const resolveRecordingUrl = async (recording: MeetingRecording): Promise<string> => {
    if (recording.resolved_file_url && recording.storage_status === 'ready') return recording.resolved_file_url;
    const enriched = await enrichRecording(recording);
    if (enriched.resolved_file_url && enriched.storage_status === 'ready') {
      setRecordings(prev => prev.map(item => item.id === recording.id ? enriched : item));
      return enriched.resolved_file_url;
    }
    return '';
  };

  const filteredRecordings = recordings.filter(recording =>
    recording.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    recording.room?.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    recording.room?.room_code?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const playRecording = async (recording: MeetingRecording) => {
    setSelectedRecording(recording);
    const url = await resolveRecordingUrl(recording);
    if (!url) {
      toast({ title: 'Arquivo indisponível', description: 'Não foi possível abrir esta gravação.', variant: 'destructive' });
      return;
    }
    setPlaybackUrl(url);
    setShowPlayer(true);
  };

  const downloadRecording = async (recording: MeetingRecording) => {
    try {
      const url = await resolveRecordingUrl(recording);
      if (!url) throw new Error('URL inválida');
      const link = document.createElement('a');
      link.href = url;
      link.download = recording.resolved_file_path?.split('/').pop() || `${recording.title}.mp4`;
      link.click();
      toast({ title: 'Download iniciado', description: 'O download da gravação foi iniciado' });
    } catch (error) {
      toast({ title: 'Erro', description: 'Erro ao baixar gravação', variant: 'destructive' });
    }
  };

  const handleDeleteClick = (recording: MeetingRecording) => {
    setRecordingToDelete(recording);
    setShowDeleteDialog(true);
  };

  const handleDeleteConfirm = async () => {
    if (!recordingToDelete) return;
    setDeletingId(recordingToDelete.id);
    
    try {
      if (recordingToDelete.file_url) {
        const filePath = recordingToDelete.resolved_file_path || getStoragePath(recordingToDelete.file_url);
        if (filePath) {
          await supabase.storage.from('meeting-recordings').remove([filePath]);
        }
      }

      const { error } = await supabase
        .from('meeting_recordings')
        .delete()
        .eq('id', recordingToDelete.id);

      if (error) throw error;
      setRecordings(prev => prev.filter(r => r.id !== recordingToDelete.id));
      toast({ title: "Gravação Excluída", description: "A gravação foi excluída com sucesso" });
    } catch (error) {
      toast({ title: "Erro", description: "Não foi possível excluir a gravação", variant: "destructive" });
    } finally {
      setDeletingId(null);
      setShowDeleteDialog(false);
      setRecordingToDelete(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[400px] flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#374DA4] mx-auto mb-4"></div>
          <p className="text-muted-foreground">Carregando gravações...</p>
        </div>
      </div>
    );
  }

   return (
     <div className="bg-transparent p-6">
       <div className="mb-6">
         <div className="relative">
            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-muted-foreground/30 h-4 w-4" />
            <Input
              placeholder="Pesquisar reuniões..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-12 h-12 bg-card border-border text-foreground placeholder:text-muted-foreground/30 rounded-xl shadow-sm focus:ring-[#374DA4]/50 transition-all text-sm"
            />
         </div>
       </div>

       {(() => {
          const completed = filteredRecordings.filter(r => r.status !== 'failed' && r.storage_status === 'ready');
          const processing = filteredRecordings.filter(r => r.status !== 'failed' && r.storage_status !== 'ready');
         const failed = filteredRecordings.filter(r => r.status === 'failed');

         if (filteredRecordings.length === 0) {
           return (
              <div className="text-center py-16 bg-card border border-border rounded-2xl shadow-sm">
                <Video className="h-10 w-10 text-muted-foreground/20 mx-auto mb-3" />
                <p className="text-muted-foreground text-sm font-medium mb-1">Nenhuma gravação ainda</p>
                <p className="text-muted-foreground/30 text-xs">As gravações das suas reuniões aparecerão aqui automaticamente.</p>
              </div>
           );
         }

         const renderItem = (recording: MeetingRecording) => {
            const isProcessing = recording.status !== 'failed' && recording.storage_status !== 'ready';
           const isFailed = recording.status === 'failed';
            const isCompleted = recording.storage_status === 'ready';
            const clickable = isCompleted && !!recording.resolved_file_url;

           return (
             <div
               key={recording.id}
               onClick={() => clickable && playRecording(recording)}
                className={`group flex items-center justify-between p-4 rounded-xl bg-card border border-border shadow-sm transition-all ${
                  clickable ? 'hover:bg-muted hover:border-foreground/10 cursor-pointer' : 'cursor-default'
                }`}
             >
               <div className="flex-1 min-w-0 pr-4">
                 <div className="flex items-center gap-2 flex-wrap">
                   <h3 className="text-sm font-semibold text-foreground truncate">
                     {recording.room?.title || recording.title}
                   </h3>
                    {isProcessing && (
                     <Badge className="bg-amber-600/10 text-amber-700 border-none px-2 py-0.5 h-5 text-[9px] font-bold uppercase tracking-wider flex items-center gap-1">
                        <Loader2 className="h-2.5 w-2.5 animate-spin" /> Aguardando arquivo
                     </Badge>
                   )}
                   {isCompleted && (
                     <Badge className="bg-emerald-600/10 text-emerald-700 border-none px-2 py-0.5 h-5 text-[9px] font-bold uppercase tracking-wider flex items-center gap-1">
                       <CheckCircle2 className="h-2.5 w-2.5" /> Pronta
                     </Badge>
                   )}
                   {isFailed && (
                     <Badge className="bg-red-600/10 text-red-700 border-none px-2 py-0.5 h-5 text-[9px] font-bold uppercase tracking-wider flex items-center gap-1">
                       <AlertCircle className="h-2.5 w-2.5" /> Falhou
                     </Badge>
                   )}
                   {recording.room?.room_code && (
                     <span className="text-[9px] font-mono text-muted-foreground/30 bg-muted px-1.5 py-0.5 rounded">
                       {recording.room.room_code}
                     </span>
                   )}
                 </div>
                 <div className="flex items-center gap-3 mt-1.5 text-[10px] text-muted-foreground/40">
                   <span className="flex items-center gap-1">
                     <Calendar className="h-3 w-3" />
                     {format(new Date(recording.created_at), "dd 'de' MMM, yyyy 'às' HH:mm", { locale: ptBR })}
                   </span>
                    {isCompleted && !!recording.duration_seconds && recording.duration_seconds > 0 && (
                     <span className="flex items-center gap-1">
                       <Clock className="h-3 w-3" />
                       {formatDuration(recording.duration_seconds)}
                     </span>
                   )}
                    {isCompleted && !!recording.file_size && recording.file_size > 0 && (
                     <span>{formatFileSize(recording.file_size)}</span>
                   )}
                    {isProcessing && (
                      <span className="text-amber-700/70">O registro existe, mas o MP4 ainda não foi vinculado ao histórico.</span>
                   )}
                 </div>
               </div>

               <div className="flex items-center gap-1">
                 {isCompleted && (
                   <>
                     <Button
                       size="icon"
                       variant="ghost"
                       onClick={(e) => { e.stopPropagation(); playRecording(recording); }}
                         className="h-8 w-8 rounded-lg text-muted-foreground/60 hover:text-foreground hover:bg-muted"
                       title="Reproduzir"
                     >
                       <Play className="h-4 w-4" />
                     </Button>
                     <Button
                       size="icon"
                       variant="ghost"
                       onClick={(e) => { e.stopPropagation(); downloadRecording(recording); }}
                       className="h-8 w-8 rounded-lg text-muted-foreground/60 hover:text-foreground hover:bg-muted"
                       title="Baixar"
                     >
                       <Download className="h-4 w-4" />
                     </Button>
                   </>
                 )}
                 <Button
                   size="icon"
                   variant="ghost"
                   onClick={(e) => { e.stopPropagation(); handleDeleteClick(recording); }}
                   className="h-8 w-8 rounded-lg text-muted-foreground/40 hover:text-red-600 hover:bg-red-600/5"
                   title="Excluir"
                 >
                   <Trash2 className="h-4 w-4" />
                 </Button>
               </div>
             </div>
           );
         };

         return (
           <div className="space-y-6">
             {processing.length > 0 && (
               <div>
                 <div className="flex items-center justify-between mb-3">
                   <div className="flex items-center gap-2">
                     <Loader2 className="h-3.5 w-3.5 text-amber-400 animate-spin" />
                     <h4 className="text-xs font-bold uppercase tracking-wider text-amber-400">
                       Processando ({processing.length})
                     </h4>
                   </div>
                   <Button
                     size="sm"
                     variant="ghost"
                     onClick={loadRecordings}
                     className="h-7 text-[10px] text-muted-foreground/50 hover:text-foreground hover:bg-muted gap-1"
                   >
                     <RefreshCw className="h-3 w-3" /> Atualizar
                   </Button>
                 </div>
                 <div className="flex items-start gap-2 mb-3 p-3 rounded-lg bg-amber-500/5 border border-amber-500/20">
                   <Info className="h-3.5 w-3.5 text-amber-400 mt-0.5 flex-shrink-0" />
                   <p className="text-[11px] text-amber-200/80 leading-relaxed">
                     A gravação está sendo finalizada pelo servidor. Pode levar de <strong>1 a 5 minutos</strong> após o término da reunião para aparecer como "Pronta". Clique em <strong>Atualizar</strong> para verificar.
                   </p>
                 </div>
                 <div className="space-y-2">{processing.map(renderItem)}</div>
               </div>
             )}

              {completed.length > 0 && (
               <div>
                 <div className="flex items-center gap-2 mb-3">
                   <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                   <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                     Disponíveis ({completed.length})
                   </h4>
                 </div>
                 <div className="space-y-2">{completed.map(renderItem)}</div>
               </div>
             )}

             {failed.length > 0 && (
               <div>
                 <div className="flex items-center gap-2 mb-3">
                   <AlertCircle className="h-3.5 w-3.5 text-red-400" />
                   <h4 className="text-xs font-bold uppercase tracking-wider text-red-400">
                     Com falha ({failed.length})
                   </h4>
                 </div>
                 <div className="space-y-2">{failed.map(renderItem)}</div>
               </div>
             )}
           </div>
         );
       })()}

      <Dialog open={showPlayer} onOpenChange={setShowPlayer}>
        <DialogContent className="max-w-4xl max-h-[90vh] bg-background border-border text-foreground">
          <DialogHeader>
            <DialogTitle>{selectedRecording?.title}</DialogTitle>
          </DialogHeader>
          
          {selectedRecording && (
            <div className="space-y-4">
              <div className="aspect-video bg-black rounded-lg overflow-hidden">
                <video
                  src={playbackUrl || selectedRecording.resolved_file_url || selectedRecording.file_url}
                  controls
                  className="w-full h-full"
                >
                  Seu navegador não suporta reprodução de vídeo.
                </video>
              </div>
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-muted-foreground">
                <div>
                  <span>Duração:</span>
                   <div className="font-medium text-foreground">{selectedRecording.duration_seconds ? formatDuration(selectedRecording.duration_seconds) : '—'}</div>
                </div>
                <div>
                  <span>Tamanho:</span>
                   <div className="font-medium text-foreground">{selectedRecording.file_size ? formatFileSize(selectedRecording.file_size) : '—'}</div>
                </div>
                <div>
                  <span>Data:</span>
                   <div className="font-medium text-foreground">
                    {format(new Date(selectedRecording.created_at), 'dd/MM/yyyy HH:mm', { locale: ptBR })}
                  </div>
                </div>
                <div>
                  <span>Sala:</span>
                  <div className="font-medium text-foreground">{selectedRecording.room?.room_code}</div>
                </div>
              </div>
              
              {selectedRecording.transcript && (
                <div>
                   <h4 className="font-medium mb-2 text-foreground">Transcrição:</h4>
                   <ScrollArea className="max-h-40 bg-muted rounded p-3">
                     <p className="text-sm text-muted-foreground">
                      {selectedRecording.transcript}
                    </p>
                  </ScrollArea>
                </div>
              )}
              
              <div className="flex justify-end gap-2">
                 <Button variant="outline" onClick={() => downloadRecording(selectedRecording)} className="border-border hover:bg-muted text-foreground">
                   <Download className="h-4 w-4 mr-2" /> Baixar
                 </Button>
                 <Button onClick={() => setShowPlayer(false)} className="bg-foreground text-background hover:bg-foreground/90">
                   Fechar
                 </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent className="rounded-2xl bg-background border-border text-foreground">
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              Tem certeza que deseja excluir a gravação "{recordingToDelete?.title}"? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-transparent border-border text-foreground hover:bg-muted">Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm} className="bg-red-500 hover:bg-red-600 text-white border-none">Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default MeetingRecordings;
