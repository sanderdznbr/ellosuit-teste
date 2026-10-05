import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Video, Play, Clock, Eye, TrendingUp, Upload, Plus, BarChart3, Link, Copy, ExternalLink, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useDropzone } from 'react-dropzone';

interface TrackedVideo {
  id: string;
  title: string;
  url: string;
  file_url?: string;
  duration: number;
  views: number;
  avgWatchTime: number;
  completionRate: number;
  createdAt: string;
  publicId: string;
  is_uploaded?: boolean;
}

const VideoTrackingDashboard = () => {
  const { toast } = useToast();
  const { user } = useAuth();
  const [newVideoUrl, setNewVideoUrl] = useState('');
  const [newVideoTitle, setNewVideoTitle] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [videos, setVideos] = useState<TrackedVideo[]>([
    {
      id: '1', title: 'Apresentação do Produto', url: 'https://youtube.com/watch?v=example1',
      duration: 180, views: 524, avgWatchTime: 120, completionRate: 67,
      createdAt: new Date().toISOString(), publicId: 'vid-apresentacao-123',
    },
    {
      id: '2', title: 'Tutorial de Uso', url: 'https://vimeo.com/example2',
      duration: 420, views: 1250, avgWatchTime: 280, completionRate: 45,
      createdAt: new Date(Date.now() - 172800000).toISOString(), publicId: 'vid-tutorial-456',
    },
  ]);
  const [selectedVideo, setSelectedVideo] = useState<TrackedVideo | null>(null);
  const [showShareModal, setShowShareModal] = useState(false);
  const [shareVideo, setShareVideo] = useState<TrackedVideo | null>(null);

  useEffect(() => {
    const fetchCompanyId = async () => {
      if (!user?.id) return;
      const { data } = await supabase.from('company_users').select('company_id').eq('user_id', user.id).single();
      if (data?.company_id) setCompanyId(data.company_id);
    };
    fetchCompanyId();
  }, [user?.id]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: { 'video/*': ['.mp4', '.webm', '.mov', '.avi', '.mkv'] },
    maxSize: 500 * 1024 * 1024,
    onDrop: async (acceptedFiles) => {
      if (acceptedFiles.length > 0) await handleVideoUpload(acceptedFiles[0]);
    }
  });

  const handleVideoUpload = async (file: File) => {
    if (!user?.id || !companyId) { toast({ title: 'Erro', description: 'Faça login para fazer upload', variant: 'destructive' }); return; }
    setUploading(true); setUploadProgress(0);
    try {
      const progressInterval = setInterval(() => { setUploadProgress(prev => Math.min(prev + 10, 90)); }, 200);
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}.${fileExt}`;
      const filePath = `${companyId}/videos/${fileName}`;
      const { error: uploadError } = await supabase.storage.from('documents').upload(filePath, file);
      clearInterval(progressInterval);
      if (uploadError) throw uploadError;
      const { data: { publicUrl } } = supabase.storage.from('documents').getPublicUrl(filePath);
      setUploadProgress(100);
      const publicId = `vid-${Math.random().toString(36).substring(7)}`;
      const newVideo: TrackedVideo = { id: Math.random().toString(36).substring(7), title: newVideoTitle || file.name.replace(/\.[^/.]+$/, ''), url: publicUrl, file_url: publicUrl, duration: 0, views: 0, avgWatchTime: 0, completionRate: 0, createdAt: new Date().toISOString(), publicId, is_uploaded: true };
      setVideos([newVideo, ...videos]); setNewVideoTitle('');
      toast({ title: 'Upload concluído!', description: 'Vídeo pronto para rastreamento.' });
    } catch (error) {
      console.error('Upload error:', error);
      toast({ title: 'Erro no upload', description: 'Não foi possível fazer upload do vídeo', variant: 'destructive' });
    } finally { setUploading(false); setUploadProgress(0); }
  };

  const handleAddVideo = () => {
    if (!newVideoUrl) { toast({ title: 'URL obrigatória', description: 'Digite a URL do vídeo', variant: 'destructive' }); return; }
    const publicId = `vid-${Math.random().toString(36).substring(7)}`;
    const newVideo: TrackedVideo = { id: Math.random().toString(36).substring(7), title: newVideoTitle || 'Vídeo sem título', url: newVideoUrl, duration: Math.floor(Math.random() * 300) + 60, views: 0, avgWatchTime: 0, completionRate: 0, createdAt: new Date().toISOString(), publicId };
    setVideos([newVideo, ...videos]); setNewVideoUrl(''); setNewVideoTitle('');
    toast({ title: 'Vídeo adicionado!', description: 'O vídeo foi configurado para rastreamento.' });
  };

  const formatDuration = (seconds: number) => { const mins = Math.floor(seconds / 60); const secs = seconds % 60; return `${mins}:${secs.toString().padStart(2, '0')}`; };
  const getPublicLink = (video: TrackedVideo) => `${window.location.origin}/video/${video.publicId}`;
  const copyLink = async (video: TrackedVideo) => { await navigator.clipboard.writeText(getPublicLink(video)); toast({ title: 'Link copiado!' }); };
  const deleteVideo = (videoId: string) => { setVideos(videos.filter(v => v.id !== videoId)); if (selectedVideo?.id === videoId) setSelectedVideo(null); toast({ title: 'Vídeo removido' }); };

  const stats = [
    { label: "Vídeos", value: videos.length, icon: Video, color: "#2ECC71" },
    { label: "Visualizações", value: videos.reduce((a, b) => a + b.views, 0), icon: Eye, color: "#10B981" },
    { label: "Tempo Médio", value: formatDuration(Math.round(videos.reduce((a, b) => a + b.avgWatchTime, 0) / videos.length || 0)), icon: Clock, color: "#8B5CF6" },
    { label: "Taxa Conclusão", value: `${Math.round(videos.reduce((a, b) => a + b.completionRate, 0) / videos.length || 0)}%`, icon: TrendingUp, color: "#F59E0B" },
  ];

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {stats.map((stat, i) => {
          const Icon = stat.icon;
          return (
            <div key={i} className="bg-white rounded-2xl border border-gray-100 p-5 flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${stat.color}12` }}>
                <Icon className="h-5 w-5" style={{ color: stat.color }} />
              </div>
              <div>
                <p className="text-xl font-bold text-gray-900">{stat.value}</p>
                <p className="text-xs text-gray-500">{stat.label}</p>
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Upload */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6">
          <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2 mb-4">
            <Upload className="h-5 w-5 text-gray-500" />
            Upload de Vídeo
          </h3>
          <div className="space-y-4">
            <div>
              <Label className="text-sm text-gray-600">Título do Vídeo</Label>
              <Input placeholder="Nome do vídeo" value={newVideoTitle} onChange={(e) => setNewVideoTitle(e.target.value)} className="mt-1 rounded-xl h-10" />
            </div>
            <div
              {...getRootProps()}
              className={`border-2 border-dashed rounded-xl p-8 text-center transition-all cursor-pointer ${isDragActive ? 'border-green-400 bg-green-50' : 'border-gray-200 hover:border-gray-300'}`}
            >
              <input {...getInputProps()} />
              {uploading ? (
                <div className="space-y-3">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-500 mx-auto" />
                  <Progress value={uploadProgress} className="w-full" />
                  <p className="text-sm text-gray-500">{uploadProgress}% concluído</p>
                </div>
              ) : (
                <>
                  <Upload className={`h-8 w-8 mx-auto mb-2 ${isDragActive ? 'text-green-500' : 'text-gray-400'}`} />
                  <p className="text-sm text-gray-500">{isDragActive ? 'Solte aqui...' : 'Arraste um vídeo ou clique'}</p>
                  <p className="text-xs text-gray-400 mt-1">MP4, WebM, MOV (máx. 500MB)</p>
                </>
              )}
            </div>
            <div className="relative">
              <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-100" /></div>
              <div className="relative flex justify-center text-xs"><span className="bg-white px-2 text-gray-400">ou adicione por URL</span></div>
            </div>
            <div>
              <Label className="text-sm text-gray-600">URL do Vídeo</Label>
              <Input placeholder="https://youtube.com/watch?v=..." value={newVideoUrl} onChange={(e) => setNewVideoUrl(e.target.value)} className="mt-1 rounded-xl h-10" />
            </div>
            <Button onClick={handleAddVideo} className="w-full h-10 rounded-xl" disabled={!newVideoUrl}>
              <Plus className="h-4 w-4 mr-2" />Adicionar por URL
            </Button>
          </div>
        </div>

        {/* Videos List */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6">
          <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2 mb-4">
            <BarChart3 className="h-5 w-5 text-gray-500" />
            Seus Vídeos ({videos.length})
          </h3>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {videos.map((video) => (
              <div
                key={video.id}
                className={`p-3 rounded-xl border cursor-pointer transition-all ${
                  selectedVideo?.id === video.id ? 'border-green-300 bg-green-50/50' : 'border-gray-100 hover:border-gray-200'
                }`}
                onClick={() => setSelectedVideo(video)}
              >
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-gray-50 rounded-lg"><Play className="h-4 w-4 text-gray-500" /></div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-sm truncate text-gray-900">{video.title}</p>
                      {video.is_uploaded && <Badge variant="secondary" className="text-[10px] rounded-md">Upload</Badge>}
                    </div>
                    <div className="flex items-center gap-3 mt-1.5 text-xs text-gray-500">
                      <span className="flex items-center gap-1"><Eye className="h-3 w-3" />{video.views}</span>
                      <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{formatDuration(video.duration)}</span>
                      <span className="flex items-center gap-1"><TrendingUp className="h-3 w-3" />{video.completionRate}%</span>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg" onClick={(e) => { e.stopPropagation(); copyLink(video); }}>
                      <Link className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg text-destructive" onClick={(e) => { e.stopPropagation(); deleteVideo(video.id); }}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Selected Video Details */}
      {selectedVideo && (
        <div className="bg-white rounded-2xl border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-semibold text-gray-900">Análise: {selectedVideo.title}</h3>
            <Button variant="outline" size="sm" onClick={() => copyLink(selectedVideo)} className="rounded-xl">
              <Link className="h-4 w-4 mr-2" />Compartilhar
            </Button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            <div className="p-4 bg-green-50 rounded-xl text-center">
              <p className="text-2xl font-bold text-green-700">{selectedVideo.views}</p>
              <p className="text-xs text-gray-500 mt-1">Visualizações</p>
            </div>
            <div className="p-4 bg-[#F0F2FE] rounded-xl text-center">
              <p className="text-2xl font-bold text-[#253573]">{formatDuration(selectedVideo.avgWatchTime)}</p>
              <p className="text-xs text-gray-500 mt-1">Tempo Médio</p>
            </div>
            <div className="p-4 bg-purple-50 rounded-xl text-center">
              <p className="text-2xl font-bold text-purple-700">{selectedVideo.completionRate}%</p>
              <p className="text-xs text-gray-500 mt-1">Taxa Conclusão</p>
            </div>
            <div className="p-4 bg-amber-50 rounded-xl text-center">
              <p className="text-2xl font-bold text-amber-700">{formatDuration(selectedVideo.duration)}</p>
              <p className="text-xs text-gray-500 mt-1">Duração Total</p>
            </div>
          </div>
          {/* Engagement */}
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-gray-700">Engajamento</h4>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Retenção média</span>
                <span className="font-medium text-gray-900">{selectedVideo.completionRate}%</span>
              </div>
              <Progress value={selectedVideo.completionRate} className="h-2" />
            </div>
          </div>
        </div>
      )}

      {/* Share Modal */}
      <Dialog open={showShareModal} onOpenChange={setShowShareModal}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle>Compartilhar Vídeo</DialogTitle>
          </DialogHeader>
          {shareVideo && (
            <div className="space-y-4">
              <div>
                <Label className="text-sm text-gray-600">Link Público</Label>
                <div className="p-3 bg-gray-50 rounded-xl flex items-center justify-between mt-1">
                  <code className="text-sm break-all text-gray-700">{getPublicLink(shareVideo)}</code>
                  <Button size="sm" variant="outline" onClick={() => copyLink(shareVideo)} className="rounded-lg ml-2">
                    <Copy className="h-3.5 w-3.5 mr-1" />Copiar
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default VideoTrackingDashboard;
