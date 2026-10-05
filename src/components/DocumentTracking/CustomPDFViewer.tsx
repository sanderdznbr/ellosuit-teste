import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ChevronLeft, ChevronRight, Loader2, ZoomIn, ZoomOut, Download, Maximize2, FileText } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface TrackableDocument {
  id: string;
  title: string;
  original_filename: string;
  file_url: string;
  tracking_enabled: boolean;
}

interface CustomPDFViewerProps {
  document: TrackableDocument;
}

const CustomPDFViewer: React.FC<CustomPDFViewerProps> = ({ document }) => {
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [pageImages, setPageImages] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [zoom, setZoom] = useState(100);
  const [pageStartTime, setPageStartTime] = useState<Record<number, number>>({});
  const [sessionStartTime] = useState(Date.now());
  const [blobUrl, setBlobUrl] = useState<string>('');
  const [useFallback, setUseFallback] = useState(false);
  
  const sessionId = useRef<string>(Math.random().toString(36).substring(7));
  const visitorId = useRef<string>(
    localStorage.getItem('visitor_id') || 
    (() => {
      const id = Math.random().toString(36).substring(7);
      localStorage.setItem('visitor_id', id);
      return id;
    })()
  );
  const timeInterval = useRef<NodeJS.Timeout | null>(null);
  const trackingInitialized = useRef(false);

  // Tracking function via fetch (uses apikey, no auth required)
  const trackEvent = useCallback(async (eventType: string, pageNumber: number, data?: any) => {
    try {
      const response = await fetch('https://jwddiyuezqrpuakazvgg.supabase.co/functions/v1/document-tracking', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp3ZGRpeXVlenFycHVha2F6dmdnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTEzNDIzNTgsImV4cCI6MjA2NjkxODM1OH0.CrUu3HGCfWh6cPfGsbDXGQNG5AWOsi9X2GGix1-7izg'
        },
        body: JSON.stringify({
          documentId: document.id,
          sessionId: sessionId.current,
          eventType,
          pageNumber,
          data: {
            ...data,
            timestamp: Date.now(),
            userAgent: navigator.userAgent,
            screenWidth: window.innerWidth,
            screenHeight: window.innerHeight
          },
          visitorId: visitorId.current
        })
      });
      
      if (!response.ok) {
        console.error('Tracking failed:', response.status);
      }
    } catch (error) {
      // Silent fail - don't interrupt user experience
    }
  }, [document.id]);

  const loadPDF = async () => {
    try {
      setLoading(true);
      setError(null);

      // Try to load pre-extracted images from storage first
      const { data: extracted, error: listError } = await supabase.storage
        .from('trackable-documents')
        .list(`pages/${document.id}`, { limit: 500, sortBy: { column: 'name', order: 'asc' } });

      if (!listError && extracted && extracted.length > 0) {
        const urls = extracted
          .filter((f) => f.name.endsWith('.webp') || f.name.endsWith('.png') || f.name.endsWith('.jpg'))
          .map((f) => supabase.storage.from('trackable-documents').getPublicUrl(`pages/${document.id}/${f.name}`).data.publicUrl);

        if (urls.length > 0) {
          setPageImages(urls);
          setTotalPages(urls.length);

          // Track document open
          if (!trackingInitialized.current) {
            trackingInitialized.current = true;
            await trackEvent('document_open', 1, {
              title: document.title,
              filename: document.original_filename,
              totalPages: urls.length,
              method: 'images'
            });
            setPageStartTime({ 1: Date.now() });
            await trackEvent('page_view', 1);
          }

          setLoading(false);
          return;
        }
      }

      // Fallback: Load PDF via blob
      const match = document.file_url.match(/\/storage\/v1\/object\/public\/trackable-documents\/(.+)$/);
      const storagePath = match ? decodeURIComponent(match[1]) : null;
      
      if (storagePath) {
        const { data: blob, error: downloadError } = await supabase.storage
          .from('trackable-documents')
          .download(storagePath);

        if (!downloadError && blob) {
          const url = URL.createObjectURL(blob);
          setBlobUrl(url);
          setUseFallback(true);
          
          if (!trackingInitialized.current) {
            trackingInitialized.current = true;
            await trackEvent('document_open', 1, {
              title: document.title,
              filename: document.original_filename,
              method: 'iframe'
            });
          }
          
          setLoading(false);
          return;
        }
      }

      setError('Não foi possível carregar o documento');
      setLoading(false);
      
    } catch (err) {
      console.error('Error in loadPDF:', err);
      setError('Erro ao carregar documento');
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPDF();
    
    return () => {
      if (blobUrl) {
        URL.revokeObjectURL(blobUrl);
      }
    };
  }, [document]);

  // Time tracking
  useEffect(() => {
    if (!loading && totalPages > 0 && !useFallback) {
      if (timeInterval.current) {
        clearInterval(timeInterval.current);
      }

      timeInterval.current = setInterval(() => {
        const startTime = pageStartTime[currentPage];
        if (startTime) {
          const currentDuration = Date.now() - startTime;
          
          // Track every 15 seconds
          if (currentDuration % 15000 < 1000) {
            trackEvent('time_spent', currentPage, { 
              duration: currentDuration,
              cumulativeSessionTime: Date.now() - sessionStartTime
            });
          }
        }
      }, 1000);

      return () => {
        if (timeInterval.current) {
          clearInterval(timeInterval.current);
        }
      };
    }
  }, [currentPage, loading, totalPages, useFallback]);

  // Track when user leaves
  useEffect(() => {
    const handleBeforeUnload = () => {
      const startTime = pageStartTime[currentPage];
      if (startTime) {
        trackEvent('session_end', currentPage, { 
          totalDuration: Date.now() - startTime,
          finalPage: currentPage,
          totalPagesVisited: Object.keys(pageStartTime).length,
          totalSessionTime: Date.now() - sessionStartTime
        });
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [currentPage, pageStartTime]);

  const navigateToPage = async (newPage: number) => {
    if (newPage < 1 || newPage > totalPages || newPage === currentPage) return;

    const startTime = pageStartTime[currentPage];
    if (startTime) {
      await trackEvent('page_leave', currentPage, { 
        duration: Date.now() - startTime,
        nextPage: newPage
      });
    }

    setCurrentPage(newPage);
    setPageStartTime(prev => ({ ...prev, [newPage]: Date.now() }));
    
    await trackEvent('page_navigation', newPage, {
      fromPage: currentPage,
      toPage: newPage
    });
    await trackEvent('page_view', newPage);
  };

  const handleZoomIn = () => setZoom(prev => Math.min(prev + 25, 200));
  const handleZoomOut = () => setZoom(prev => Math.max(prev - 25, 50));

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
        <Card className="p-8 shadow-2xl border-0">
          <div className="text-center">
            <Loader2 className="h-12 w-12 animate-spin mx-auto mb-4 text-primary" />
            <p className="text-lg font-medium text-slate-700">Preparando documento...</p>
            <p className="text-sm text-slate-500 mt-2">{document.title}</p>
          </div>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
        <Card className="p-8 shadow-2xl border-0 max-w-md w-full text-center">
          <FileText className="h-16 w-16 mx-auto mb-4 text-slate-300" />
          <h2 className="text-xl font-semibold text-slate-700 mb-2">Documento não disponível</h2>
          <p className="text-slate-500 mb-6">{error}</p>
          <Button 
            onClick={() => window.open(document.file_url, '_blank')}
            className="w-full"
          >
            <Download className="h-4 w-4 mr-2" />
            Tentar baixar diretamente
          </Button>
        </Card>
      </div>
    );
  }

  // Fallback iframe viewer
  if (useFallback && blobUrl) {
    return (
      <div className="h-screen w-full bg-slate-900 flex flex-col">
        {/* Header */}
        <div className="bg-slate-800 border-b border-slate-700 px-6 py-3">
          <div className="flex items-center justify-between max-w-7xl mx-auto">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/20 rounded-lg">
                <FileText className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h1 className="text-white font-semibold truncate max-w-[300px] md:max-w-none">
                  {document.title}
                </h1>
                <p className="text-slate-400 text-xs">{document.original_filename}</p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const a = window.document.createElement('a');
                a.href = document.file_url;
                a.download = document.original_filename;
                a.click();
              }}
              className="bg-slate-700 border-slate-600 text-white hover:bg-slate-600"
            >
              <Download className="h-4 w-4 mr-2" />
              Baixar
            </Button>
          </div>
        </div>

        {/* PDF Viewer */}
        <div className="flex-1 min-h-0">
          <iframe
            src={blobUrl}
            className="w-full h-full border-0"
            title={document.title}
          />
        </div>
      </div>
    );
  }

  // Image-based viewer with full control
  return (
    <div className="min-h-screen bg-slate-900 flex flex-col">
      {/* Header */}
      <div className="bg-slate-800 border-b border-slate-700 sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            {/* Document Info */}
            <div className="flex items-center gap-3 min-w-0">
              <div className="p-2 bg-primary/20 rounded-lg shrink-0">
                <FileText className="h-5 w-5 text-primary" />
              </div>
              <div className="min-w-0">
                <h1 className="text-white font-semibold truncate">
                  {document.title}
                </h1>
                <p className="text-slate-400 text-xs">
                  Página {currentPage} de {totalPages}
                </p>
              </div>
            </div>
            
            {/* Controls */}
            <div className="flex items-center gap-2">
              {/* Zoom Controls */}
              <div className="hidden md:flex items-center gap-1 bg-slate-700/50 rounded-lg p-1">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleZoomOut}
                  disabled={zoom <= 50}
                  className="h-8 w-8 text-white hover:bg-slate-600"
                >
                  <ZoomOut className="h-4 w-4" />
                </Button>
                <span className="text-white text-sm px-2 min-w-[3rem] text-center">{zoom}%</span>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleZoomIn}
                  disabled={zoom >= 200}
                  className="h-8 w-8 text-white hover:bg-slate-600"
                >
                  <ZoomIn className="h-4 w-4" />
                </Button>
              </div>

              {/* Navigation */}
              <div className="flex items-center gap-1 bg-slate-700/50 rounded-lg p-1">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => navigateToPage(currentPage - 1)}
                  disabled={currentPage <= 1}
                  className="h-8 w-8 text-white hover:bg-slate-600"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-white text-sm px-2">
                  {currentPage} / {totalPages}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => navigateToPage(currentPage + 1)}
                  disabled={currentPage >= totalPages}
                  className="h-8 w-8 text-white hover:bg-slate-600"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>

              {/* Download */}
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  const a = window.document.createElement('a');
                  a.href = document.file_url;
                  a.download = document.original_filename;
                  a.click();
                }}
                className="h-8 w-8 text-white hover:bg-slate-600"
                title="Baixar documento"
              >
                <Download className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Document Content */}
      <div className="flex-1 overflow-auto py-6 px-4">
        <div className="max-w-4xl mx-auto">
          <div 
            className="bg-white rounded-lg shadow-2xl overflow-hidden transition-all duration-200"
            style={{ 
              transform: `scale(${zoom / 100})`,
              transformOrigin: 'top center'
            }}
          >
            {pageImages[currentPage - 1] && (
              <img
                src={pageImages[currentPage - 1]}
                alt={`Página ${currentPage}`}
                className="w-full h-auto select-none"
                draggable={false}
              />
            )}
          </div>
        </div>
      </div>

      {/* Bottom Navigation (Mobile friendly) */}
      <div className="bg-slate-800 border-t border-slate-700 p-4 md:hidden">
        <div className="flex items-center justify-between gap-4">
          <Button
            variant="outline"
            onClick={() => navigateToPage(currentPage - 1)}
            disabled={currentPage <= 1}
            className="flex-1 bg-slate-700 border-slate-600 text-white"
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            Anterior
          </Button>
          <span className="text-white font-medium px-4">
            {currentPage}/{totalPages}
          </span>
          <Button
            variant="outline"
            onClick={() => navigateToPage(currentPage + 1)}
            disabled={currentPage >= totalPages}
            className="flex-1 bg-slate-700 border-slate-600 text-white"
          >
            Próxima
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      </div>

      {/* Page Thumbnails Sidebar */}
      <div className="fixed right-4 top-1/2 -translate-y-1/2 hidden xl:flex flex-col gap-2 bg-slate-800/90 backdrop-blur rounded-lg p-2 max-h-[60vh] overflow-y-auto">
        {pageImages.slice(0, 10).map((_, index) => (
          <button
            key={index}
            onClick={() => navigateToPage(index + 1)}
            className={`w-12 h-16 rounded border-2 transition-all text-xs font-medium flex items-center justify-center ${
              currentPage === index + 1
                ? 'border-primary bg-primary/20 text-primary'
                : 'border-slate-600 bg-slate-700 text-slate-300 hover:border-primary/50'
            }`}
          >
            {index + 1}
          </button>
        ))}
        {totalPages > 10 && (
          <div className="text-slate-400 text-xs text-center py-1">
            +{totalPages - 10}
          </div>
        )}
      </div>
    </div>
  );
};

export default CustomPDFViewer;
