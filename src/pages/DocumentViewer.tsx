import React from 'react';
import { useParams } from 'react-router-dom';
import PublicDocumentViewer from '@/components/DocumentTracking/PublicDocumentViewer';

const DocumentViewer = () => {
  const { linkId } = useParams<{ linkId: string }>();

  if (!linkId) {
    return <div>Link inválido</div>;
  }

  return <PublicDocumentViewer linkId={linkId} />;
};

export default DocumentViewer;