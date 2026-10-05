import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { ExternalLink, Download, AlertCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface PDFViewerFallbackProps {
  document: {
    id: string;
    title: string;
    file_url: string;
    original_filename: string;
  };
  onTrackEvent: (eventType: string, data?: any) => void;
}

const PDFViewerFallback: React.FC<PDFViewerFallbackProps> = ({ document, onTrackEvent }) => {
  const [blobUrl, setBlobUrl] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    const loadPDF = async () => {
      try {
        setLoading(true);
        setError('');

        // Try to get the storage path from the URL and use Supabase SDK
        const match = document.file_url.match(/\/storage\/v1\/object\/public\/trackable-documents\/(.+)$/);
        const storagePath = match ? decodeURIComponent(match[1]) : null;
        
        if (!storagePath) {
          throw new Error('Caminho do arquivo inválido');
        }

        const { data: blob, error: downloadError } = await supabase.storage
          .from('trackable-documents')
          .download(storagePath);

        if (downloadError || !blob) {
          throw new Error('Falha ao baixar PDF');
        }

        const url = URL.createObjectURL(blob);
        setBlobUrl(url);
        
        // Track that we opened via fallback method
        onTrackEvent('document_open_fallback', {
          method: 'iframe',
          title: document.title,
          filename: document.original_filename
        });

      } catch (err) {
        console.error('Error loading PDF for fallback:', err);
        setError(err instanceof Error ? err.message : 'Erro ao carregar PDF');
      } finally {
        setLoading(false);
      }
    };

    loadPDF();

    return () => {
      if (blobUrl) {
        URL.revokeObjectURL(blobUrl);
      }
    };
  }, [document, onTrackEvent]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Carregando documento...</p>
        </div>
      </div>
    );
  }

  if (error || !blobUrl) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full text-center">
          <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-4">Não foi possível carregar o documento</h3>
          <p className="text-muted-foreground mb-6">
            {error || 'Erro desconhecido ao carregar o PDF'}
          </p>
          <div className="flex flex-col gap-2">
            <Button
              onClick={() => window.open(document.file_url, '_blank')}
              className="w-full gap-2"
            >
              <ExternalLink className="h-4 w-4" />
              Abrir em nova aba
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const a = window.document.createElement('a');
                a.href = document.file_url;
                a.download = document.original_filename;
                a.click();
              }}
              className="w-full gap-2"
            >
              <Download className="h-4 w-4" />
              Baixar PDF
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-full bg-gray-50 flex flex-col">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-semibold text-gray-900 truncate">
            {document.title}
          </h1>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.open(document.file_url, '_blank')}
              className="gap-2"
            >
              <ExternalLink className="h-4 w-4" />
              Nova aba
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const a = window.document.createElement('a');
                a.href = document.file_url;
                a.download = document.original_filename;
                a.click();
              }}
              className="gap-2"
            >
              <Download className="h-4 w-4" />
              Baixar
            </Button>
          </div>
        </div>
      </div>

      {/* PDF Viewer */}
      <div className="flex-1 min-h-0">
        <iframe
          ref={iframeRef}
          src={blobUrl}
          className="w-full h-full border-0"
          title={document.title}
        />
      </div>
    </div>
  );
};

export default PDFViewerFallback;