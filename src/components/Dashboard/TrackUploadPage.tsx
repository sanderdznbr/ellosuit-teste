import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, FileText, Link2, PlayCircle, Image, Copy, Check, ExternalLink, Trash2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

const TRACK_COLOR = "#2ECC71";

interface TrackedFile {
  id: string;
  title: string;
  original_filename: string;
  mime_type: string;
  public_link_id: string;
  created_at: string;
  file_url: string;
}

const getFileIcon = (mimeType: string) => {
  if (mimeType?.startsWith('video/')) return PlayCircle;
  if (mimeType?.startsWith('image/')) return Image;
  if (mimeType?.includes('pdf')) return FileText;
  return FileText;
};

const getFileType = (mimeType: string) => {
  if (mimeType?.startsWith('video/')) return 'Vídeo';
  if (mimeType?.startsWith('image/')) return 'Imagem';
  if (mimeType?.includes('pdf')) return 'PDF';
  return 'Documento';
};

export default function TrackUploadPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const { data: companyId } = useQuery({
    queryKey: ['user-company', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data } = await supabase
        .from('company_users')
        .select('company_id')
        .eq('user_id', user.id)
        .single();
      return data?.company_id || null;
    },
    enabled: !!user?.id,
  });

  const { data: trackedFiles = [], isLoading } = useQuery({
    queryKey: ['tracked-files', companyId],
    queryFn: async () => {
      if (!companyId) return [];
      const { data } = await supabase
        .from('trackable_documents')
        .select('*')
        .eq('company_id', companyId)
        .order('created_at', { ascending: false });
      return (data || []) as TrackedFile[];
    },
    enabled: !!companyId,
  });

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (!user?.id || !companyId) return;
    setUploading(true);

    for (const file of acceptedFiles) {
      try {
        const fileExt = file.name.split('.').pop();
        const filePath = `tracked/${companyId}/${crypto.randomUUID()}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from('documents')
          .upload(filePath, file);

        if (uploadError) throw uploadError;

        const { data: publicUrl } = supabase.storage
          .from('documents')
          .getPublicUrl(filePath);

        const { error: insertError } = await supabase
          .from('trackable_documents')
          .insert({
            company_id: companyId,
            user_id: user.id,
            title: file.name.replace(/\.[^/.]+$/, ''),
            original_filename: file.name,
            file_url: publicUrl.publicUrl,
            mime_type: file.type,
            file_size: file.size,
            tracking_enabled: true,
          });

        if (insertError) throw insertError;

        toast({ title: 'Arquivo enviado!', description: `${file.name} agora está sendo rastreado.` });
      } catch (error) {
        console.error('Upload error:', error);
        toast({ title: 'Erro no upload', description: `Falha ao enviar ${file.name}`, variant: 'destructive' });
      }
    }

    queryClient.invalidateQueries({ queryKey: ['tracked-files'] });
    setUploading(false);
  }, [user, companyId, toast, queryClient]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'video/*': ['.mp4', '.webm', '.mov'],
      'image/*': ['.jpg', '.jpeg', '.png', '.gif', '.webp'],
    },
  });

  const copyLink = (publicLinkId: string) => {
    const link = `${window.location.origin}/document/${publicLinkId}`;
    navigator.clipboard.writeText(link);
    setCopiedId(publicLinkId);
    toast({ title: 'Link copiado!' });
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-5xl mx-auto px-6 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Rastreamento de Conteúdo</h1>
          <p className="text-sm text-gray-500">Envie qualquer arquivo e gere um link rastreável automaticamente</p>
        </div>

        {/* Drop Zone */}
        <div
          {...getRootProps()}
          className={`relative border-2 border-dashed rounded-3xl p-16 text-center cursor-pointer transition-all duration-300 mb-8 ${
            isDragActive
              ? 'border-green-400 bg-green-50'
              : 'border-gray-200 hover:border-green-300 hover:bg-green-50/30'
          }`}
        >
          <input {...getInputProps()} />
          <div className="flex flex-col items-center gap-4">
            <div
              className="w-20 h-20 rounded-3xl flex items-center justify-center"
              style={{ backgroundColor: `${TRACK_COLOR}15` }}
            >
              <Upload className="h-10 w-10" style={{ color: TRACK_COLOR }} />
            </div>
            <div>
              <p className="text-lg font-semibold text-gray-900">
                {uploading ? 'Enviando...' : isDragActive ? 'Solte o arquivo aqui!' : 'Arraste seu arquivo aqui'}
              </p>
              <p className="text-sm text-gray-500 mt-1">
                PDF, Vídeo ou Imagem — reconhecemos automaticamente e geramos o link rastreável
              </p>
            </div>
            <Button
              variant="outline"
              className="mt-2 rounded-xl"
              style={{ borderColor: TRACK_COLOR, color: TRACK_COLOR }}
              disabled={uploading}
            >
              {uploading ? 'Enviando...' : 'Escolher arquivo'}
            </Button>
          </div>
        </div>

        {/* Tracked Files List */}
        {trackedFiles.length > 0 && (
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Arquivos rastreados ({trackedFiles.length})
            </h2>
            <div className="space-y-3">
              {trackedFiles.map((file) => {
                const Icon = getFileIcon(file.mime_type);
                const type = getFileType(file.mime_type);
                return (
                  <div
                    key={file.id}
                    className="flex items-center gap-4 p-4 bg-white border border-gray-100 rounded-2xl hover:shadow-sm transition-all"
                  >
                    <div
                      className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{ backgroundColor: `${TRACK_COLOR}12` }}
                    >
                      <Icon className="h-5 w-5" style={{ color: TRACK_COLOR }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 truncate">{file.title}</p>
                      <p className="text-xs text-gray-500">
                        {type} · {file.original_filename} · {new Date(file.created_at).toLocaleDateString('pt-BR')}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="rounded-lg text-xs gap-1.5"
                        onClick={() => copyLink(file.public_link_id)}
                      >
                        {copiedId === file.public_link_id ? (
                          <><Check className="h-3.5 w-3.5 text-green-600" /> Copiado</>
                        ) : (
                          <><Copy className="h-3.5 w-3.5" /> Copiar link</>
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="rounded-lg h-8 w-8"
                        onClick={() => window.open(`/document/${file.public_link_id}`, '_blank')}
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {trackedFiles.length === 0 && !isLoading && (
          <div className="text-center py-12 text-gray-400">
            <FileText className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p className="font-medium">Nenhum arquivo rastreado ainda</p>
            <p className="text-sm">Envie seu primeiro arquivo para começar</p>
          </div>
        )}
      </div>
    </div>
  );
}
