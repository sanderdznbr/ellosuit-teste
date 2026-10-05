import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import CustomPDFViewer from './CustomPDFViewer';

interface TrackableDocument {
  id: string;
  title: string;
  original_filename: string;
  file_url: string;
  tracking_enabled: boolean;
}

interface PublicDocumentViewerProps {
  linkId: string;
}

const PublicDocumentViewer: React.FC<PublicDocumentViewerProps> = ({ linkId }) => {
  const [trackableDoc, setTrackableDoc] = useState<TrackableDocument | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchDocument();
  }, [linkId]);

  const fetchDocument = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('trackable_documents')
        .select('id, title, original_filename, file_url, tracking_enabled')
        .eq('public_link_id', linkId)
        .eq('tracking_enabled', true)
        .single();

      if (fetchError || !data) {
        setError('Documento não encontrado ou não está disponível para visualização pública');
        return;
      }

      setTrackableDoc(data);
    } catch (err) {
      console.error('Error fetching document:', err);
      setError('Erro ao carregar documento');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="w-96">
          <CardContent className="p-6 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p>Carregando documento...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error || !trackableDoc) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="w-96">
          <CardContent className="p-6">
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error || 'Documento não encontrado'}</AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      </div>
    );
  }

  return <CustomPDFViewer document={trackableDoc} />;
};

export default PublicDocumentViewer;