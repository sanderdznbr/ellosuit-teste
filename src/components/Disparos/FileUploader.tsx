import React, { useState, useCallback, useRef } from 'react';
import { Upload, X, Loader2, FileText, Image, Video, Mic } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

const OMNI_COLOR = '#374DA4';

interface FileUploaderProps {
  onFileUrl: (url: string) => void;
  accept: string;
  type: 'image' | 'video' | 'audio' | 'document';
  disabled?: boolean;
  currentUrl?: string;
}

const typeConfig = {
  image: { icon: Image, label: 'Imagem', folder: 'images', preview: true },
  video: { icon: Video, label: 'Vídeo', folder: 'videos', preview: false },
  audio: { icon: Mic, label: 'Áudio', folder: 'audios', preview: false },
  document: { icon: FileText, label: 'Documento', folder: 'docs', preview: false },
};

export default function FileUploader({ onFileUrl, accept, type, disabled, currentUrl }: FileUploaderProps) {
  const { toast } = useToast();
  const [isUploading, setIsUploading] = useState(false);
  const [fileName, setFileName] = useState('');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const config = typeConfig[type];
  const Icon = config.icon;

  const handleFile = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // 20MB limit
    if (file.size > 20 * 1024 * 1024) {
      toast({ title: 'Arquivo muito grande', description: 'Máximo 20MB', variant: 'destructive' });
      return;
    }

    setIsUploading(true);
    setFileName(file.name);

    try {
      // Preview for images
      if (type === 'image' && file.type.startsWith('image/')) {
        setPreviewUrl(URL.createObjectURL(file));
      }

      const ext = file.name.split('.').pop() || 'bin';
      const filePath = `${config.folder}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;

      const { error } = await supabase.storage
        .from('disparos-media')
        .upload(filePath, file, { contentType: file.type });

      if (error) throw error;

      const { data: publicData } = supabase.storage
        .from('disparos-media')
        .getPublicUrl(filePath);

      onFileUrl(publicData.publicUrl);
      toast({ title: `${config.label} enviado com sucesso!` });
    } catch (err: any) {
      toast({ title: 'Erro no upload', description: err.message, variant: 'destructive' });
      setFileName('');
      setPreviewUrl(null);
    } finally {
      setIsUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }, [type, config, onFileUrl, toast]);

  const clearFile = useCallback(() => {
    setFileName('');
    setPreviewUrl(null);
    onFileUrl('');
  }, [onFileUrl]);

  const hasFile = !!currentUrl || !!fileName;

  return (
    <div className="space-y-2">
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={handleFile}
        disabled={disabled || isUploading}
      />

      {!hasFile ? (
        <button
          onClick={() => inputRef.current?.click()}
          disabled={disabled || isUploading}
          className="w-full flex flex-col items-center gap-2 py-8 border-2 border-dashed border-gray-200 rounded-xl hover:border-gray-300 hover:bg-gray-50/50 transition-all disabled:opacity-50"
        >
          {isUploading ? (
            <>
              <Loader2 className="h-8 w-8 text-gray-400 animate-spin" />
              <span className="text-sm text-gray-500">Enviando {fileName}...</span>
            </>
          ) : (
            <>
              <div className="h-12 w-12 rounded-full flex items-center justify-center bg-gray-100">
                <Upload className="h-5 w-5 text-gray-500" />
              </div>
              <div className="text-center">
                <span className="text-sm font-medium" style={{ color: OMNI_COLOR }}>
                  Clique para enviar {config.label.toLowerCase()}
                </span>
                <p className="text-xs text-gray-400 mt-0.5">Máximo 20MB</p>
              </div>
            </>
          )}
        </button>
      ) : (
        <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
          {previewUrl && type === 'image' ? (
            <img src={previewUrl} alt="preview" className="h-14 w-14 rounded-lg object-cover" />
          ) : (
            <div className="h-14 w-14 rounded-lg flex items-center justify-center bg-gray-200">
              <Icon className="h-6 w-6 text-gray-500" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-700 truncate">{fileName || 'Arquivo carregado'}</p>
            <p className="text-xs text-green-600">✓ Upload concluído</p>
          </div>
          {!disabled && (
            <button onClick={clearFile} className="text-gray-400 hover:text-red-500 p-1">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
