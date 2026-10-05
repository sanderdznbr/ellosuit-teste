import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Download, Eye, FileText, Folder, ArrowRight, ExternalLink } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import ellosuitLogo from '@/assets/ellosuit-logo.png';

interface SharedFile {
  id: string;
  name: string;
  file_type: string;
  file_size?: number;
  file_url?: string;
  created_at: string;
}

interface SharedFolder {
  id: string;
  name: string;
  description?: string;
  color: string;
  created_at: string;
  files: SharedFile[];
}

const SharedContent = () => {
  const { shareId } = useParams();
  const { toast } = useToast();
  const [content, setContent] = useState<SharedFile | SharedFolder | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (shareId) loadSharedContent();
  }, [shareId]);

  const loadSharedContent = async () => {
    if (!shareId) return;
    try {
      setLoading(true);
      const { data: result, error } = await supabase.functions.invoke('get-shared-content', {
        body: { shareId }
      });
      if (error) throw error;
      if (result?.error) throw new Error(result.error);
      setContent(result.data);
    } catch (error) {
      console.error('Error loading shared content:', error);
      setError('Conteúdo não encontrado ou não disponível para compartilhamento');
    } finally {
      setLoading(false);
    }
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return '0 B';
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`;
  };

  const getFileIcon = (fileType: string) => {
    if (fileType.includes('image')) return '🖼️';
    if (fileType.includes('video')) return '🎥';
    if (fileType.includes('audio')) return '🎵';
    if (fileType.includes('pdf')) return '📄';
    if (fileType.includes('word')) return '📝';
    if (fileType.includes('excel') || fileType.includes('spreadsheet')) return '📊';
    if (fileType.includes('powerpoint') || fileType.includes('presentation')) return '📈';
    return '📄';
  };

  const downloadFile = (file: SharedFile) => {
    if (file.file_url) {
      const link = document.createElement('a');
      link.href = file.file_url;
      link.download = file.name;
      link.click();
    }
  };

  const downloadFolderAsZip = async (folder: SharedFolder) => {
    try {
      const JSZip = (await import('jszip')).default;
      if (folder.files.length === 0) {
        toast({ title: 'Pasta vazia', description: 'Esta pasta não contém arquivos para download', variant: 'destructive' });
        return;
      }
      toast({ title: 'Preparando download...', description: `Preparando ${folder.files.length} arquivos para download` });
      const zip = new JSZip();
      for (const file of folder.files) {
        if (file.file_url) {
          try {
            const response = await fetch(file.file_url);
            const blob = await response.blob();
            zip.file(file.name, blob);
          } catch (e) {
            console.error(`Error adding file ${file.name} to ZIP:`, e);
          }
        }
      }
      const zipBlob = await zip.generateAsync({ type: 'blob' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(zipBlob);
      link.download = `${folder.name}.zip`;
      link.click();
      URL.revokeObjectURL(link.href);
      toast({ title: 'Download concluído', description: `Pasta "${folder.name}" baixada como ZIP` });
    } catch (e) {
      console.error('Error downloading folder as ZIP:', e);
      toast({ title: 'Erro', description: 'Erro ao baixar pasta como ZIP', variant: 'destructive' });
    }
  };

  const canPreview = (fileType: string) => {
    return fileType.includes('image') || fileType.includes('video') || fileType.includes('audio') || fileType.includes('pdf');
  };

  const renderFilePreview = (file: SharedFile) => {
    if (!file.file_url) return null;
    const type = file.file_type;

    if (type.includes('image')) {
      return (
        <div className="w-full flex items-center justify-center bg-gray-950/5 rounded-2xl overflow-hidden" style={{ maxHeight: '70vh' }}>
          <img src={file.file_url} alt={file.name} className="max-w-full max-h-[70vh] object-contain" />
        </div>
      );
    }
    if (type.includes('video')) {
      return (
        <div className="w-full rounded-2xl overflow-hidden bg-black">
          <video controls className="w-full max-h-[70vh]" src={file.file_url} />
        </div>
      );
    }
    if (type.includes('audio')) {
      return (
        <div className="w-full p-8 bg-gradient-to-br from-purple-50 to-[#F0F2FE] rounded-2xl flex flex-col items-center gap-4">
          <div className="text-6xl">🎵</div>
          <p className="text-lg font-medium text-gray-700">{file.name}</p>
          <audio controls className="w-full max-w-md" src={file.file_url} />
        </div>
      );
    }
    if (type.includes('pdf')) {
      return (
        <div className="w-full rounded-2xl overflow-hidden border border-gray-200" style={{ height: '70vh' }}>
          <iframe src={file.file_url} className="w-full h-full" title={file.name} />
        </div>
      );
    }
    return null;
  };

  // --- LOADING ---
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <img src={ellosuitLogo} alt="Ellosuit" className="h-10 w-auto animate-pulse" />
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-400"></div>
        </div>
      </div>
    );
  }

  // --- ERROR ---
  if (error || !content) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex flex-col items-center justify-center gap-6">
        <img src={ellosuitLogo} alt="Ellosuit" className="h-10 w-auto" />
        <div className="bg-white rounded-3xl shadow-lg border border-gray-100 p-10 max-w-md text-center">
          <FileText className="h-16 w-16 mx-auto mb-4 text-gray-300" />
          <h2 className="text-xl font-semibold mb-2 text-gray-800">Conteúdo não encontrado</h2>
          <p className="text-gray-500 text-sm">{error || 'Este link pode ter expirado ou o conteúdo foi removido.'}</p>
        </div>
      </div>
    );
  }

  const isFolder = 'files' in content;

  // --- MAIN ---
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100 relative">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-xl border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
          <img src={ellosuitLogo} alt="Ellosuit" className="h-8 w-auto" />
          <a
            href="https://www.ellosuit.online/dashboard"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-violet-600 to-indigo-600 text-white rounded-full text-sm font-medium hover:from-violet-700 hover:to-indigo-700 transition-all shadow-md hover:shadow-lg"
          >
            Conhecer Ellosuit
            <ArrowRight className="h-4 w-4" />
          </a>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        {isFolder ? (
          /* --- FOLDER VIEW --- */
          <div className="space-y-6">
            <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-6 sm:p-8">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                <div className="flex items-center gap-4">
                  <div
                    className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0"
                    style={{ backgroundColor: (content as SharedFolder).color + '15' }}
                  >
                    <Folder className="h-7 w-7" style={{ color: (content as SharedFolder).color }} />
                  </div>
                  <div>
                    <h1 className="text-2xl font-bold text-gray-900">{content.name}</h1>
                    {(content as SharedFolder).description && (
                      <p className="text-gray-500 text-sm mt-1">{(content as SharedFolder).description}</p>
                    )}
                    <p className="text-xs text-gray-400 mt-1">
                      {(content as SharedFolder).files.length} arquivo{(content as SharedFolder).files.length !== 1 ? 's' : ''} · Compartilhado em {new Date(content.created_at).toLocaleDateString('pt-BR')}
                    </p>
                  </div>
                </div>
                <Button
                  onClick={() => downloadFolderAsZip(content as SharedFolder)}
                  className="bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white rounded-xl shadow-md"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Baixar tudo (ZIP)
                </Button>
              </div>

              {(content as SharedFolder).files.length > 0 ? (
                <div className="grid gap-3">
                  {(content as SharedFolder).files.map((file) => (
                    <div
                      key={file.id}
                      className="flex items-center justify-between p-4 rounded-2xl border border-gray-100 hover:bg-gray-50 transition-colors group"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        {file.file_type.includes('image') && file.file_url ? (
                          <img src={file.file_url} alt="" className="w-10 h-10 rounded-lg object-cover shrink-0" />
                        ) : (
                          <span className="text-2xl shrink-0">{getFileIcon(file.file_type)}</span>
                        )}
                        <div className="min-w-0">
                          <p className="font-medium text-gray-800 truncate">{file.name}</p>
                          <p className="text-xs text-gray-400">{formatFileSize(file.file_size)}</p>
                        </div>
                      </div>
                      <div className="flex gap-2 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                        {file.file_url && (
                          <>
                            <Button variant="ghost" size="sm" onClick={() => window.open(file.file_url, '_blank')} className="rounded-xl">
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => downloadFile(file)} className="rounded-xl">
                              <Download className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center text-gray-400 py-12">Esta pasta está vazia</p>
              )}
            </div>
          </div>
        ) : (
          /* --- FILE VIEW --- */
          <div className="space-y-6">
            {/* File info bar */}
            <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-6 sm:p-8">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-4 min-w-0">
                  <span className="text-3xl shrink-0">{getFileIcon((content as SharedFile).file_type)}</span>
                  <div className="min-w-0">
                    <h1 className="text-xl sm:text-2xl font-bold text-gray-900 truncate">{content.name}</h1>
                    <p className="text-sm text-gray-400">
                      {formatFileSize((content as SharedFile).file_size)} · Compartilhado em {new Date(content.created_at).toLocaleDateString('pt-BR')}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2 shrink-0">
                  {(content as SharedFile).file_url && !canPreview((content as SharedFile).file_type) && (
                    <Button
                      variant="outline"
                      onClick={() => window.open((content as SharedFile).file_url, '_blank')}
                      className="rounded-xl"
                    >
                      <ExternalLink className="h-4 w-4 mr-2" />
                      Abrir
                    </Button>
                  )}
                  {(content as SharedFile).file_url && (
                    <Button
                      onClick={() => downloadFile(content as SharedFile)}
                      className="bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white rounded-xl shadow-md"
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Baixar
                    </Button>
                  )}
                </div>
              </div>
            </div>

            {/* Inline Preview */}
            {canPreview((content as SharedFile).file_type) && (content as SharedFile).file_url && (
              <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-4 sm:p-6">
                {renderFilePreview(content as SharedFile)}
              </div>
            )}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-100 mt-12">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-sm text-gray-400">
            <img src={ellosuitLogo} alt="Ellosuit" className="h-5 w-auto opacity-60" />
            <span>Compartilhado via Ellosuit</span>
          </div>
          <a
            href="https://www.ellosuit.online"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-violet-600 hover:text-violet-700 font-medium transition-colors"
          >
            Saiba mais sobre a Ellosuit →
          </a>
        </div>
      </footer>
    </div>
  );
};

export default SharedContent;
