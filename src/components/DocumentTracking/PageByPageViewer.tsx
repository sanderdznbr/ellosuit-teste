import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Download, Maximize2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface PageByPageViewerProps {
  documentId: string;
  pages: string[]; // Array of image URLs
  documentTitle: string;
  visitorId: string;
  sessionId: string;
}

const PageByPageViewer: React.FC<PageByPageViewerProps> = ({
  documentId,
  pages,
  documentTitle,
  visitorId,
  sessionId
}) => {
  const [currentPage, setCurrentPage] = useState(0);
  const [zoom, setZoom] = useState(100);
  const [pageStartTime, setPageStartTime] = useState(Date.now());
  const [scrollDepth, setScrollDepth] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  // Detectar informações do dispositivo
  const getDeviceInfo = () => {
    const ua = navigator.userAgent;
    let deviceType = 'desktop';
    
    if (/(tablet|ipad|playbook|silk)|(android(?!.*mobi))/i.test(ua)) {
      deviceType = 'tablet';
    } else if (/Mobile|Android|iP(hone|od)|IEMobile|BlackBerry|Kindle|Silk-Accelerated|(hpw|web)OS|Opera M(obi|ini)/.test(ua)) {
      deviceType = 'mobile';
    }

    return {
      deviceType,
      browser: getBrowser(),
      os: getOS(),
      screenResolution: `${window.screen.width}x${window.screen.height}`,
      referrer: document.referrer || 'direct'
    };
  };

  const getBrowser = () => {
    const ua = navigator.userAgent;
    if (ua.includes('Firefox')) return 'Firefox';
    if (ua.includes('Chrome')) return 'Chrome';
    if (ua.includes('Safari')) return 'Safari';
    if (ua.includes('Edge')) return 'Edge';
    return 'Unknown';
  };

  const getOS = () => {
    const ua = navigator.userAgent;
    if (ua.includes('Win')) return 'Windows';
    if (ua.includes('Mac')) return 'MacOS';
    if (ua.includes('Linux')) return 'Linux';
    if (ua.includes('Android')) return 'Android';
    if (ua.includes('iOS')) return 'iOS';
    return 'Unknown';
  };

  // Rastrear visualização de página
  const trackPageView = async (pageNumber: number, duration: number) => {
    const deviceInfo = getDeviceInfo();
    
    try {
      await supabase.from('document_tracking_events').insert({
        document_id: documentId,
        visitor_id: visitorId,
        session_id: sessionId,
        event_type: 'page_view',
        page_number: pageNumber + 1, // 1-indexed para o usuário
        duration_seconds: Math.floor(duration / 1000),
        scroll_depth: scrollDepth,
        device_type: deviceInfo.deviceType,
        browser: deviceInfo.browser,
        os: deviceInfo.os,
        screen_resolution: deviceInfo.screenResolution,
        referrer: deviceInfo.referrer,
        data: {
          zoom_level: zoom,
          timestamp: new Date().toISOString()
        }
      });
    } catch (error) {
      console.error('Erro ao rastrear página:', error);
    }
  };

  // Rastrear mudança de página
  const trackPageNavigation = async (fromPage: number, toPage: number, action: 'next' | 'previous' | 'jump') => {
    try {
      await supabase.from('document_tracking_events').insert({
        document_id: documentId,
        visitor_id: visitorId,
        session_id: sessionId,
        event_type: 'navigation',
        page_number: toPage + 1,
        data: {
          from_page: fromPage + 1,
          to_page: toPage + 1,
          action,
          timestamp: new Date().toISOString()
        }
      });
    } catch (error) {
      console.error('Erro ao rastrear navegação:', error);
    }
  };

  // Rastrear scroll
  const handleScroll = () => {
    if (containerRef.current) {
      const element = containerRef.current;
      const scrolled = element.scrollTop;
      const total = element.scrollHeight - element.clientHeight;
      const depth = total > 0 ? Math.round((scrolled / total) * 100) : 0;
      setScrollDepth(Math.max(scrollDepth, depth));
    }
  };

  // Ao mudar de página
  useEffect(() => {
    const duration = Date.now() - pageStartTime;
    
    // Se passou pelo menos 1 segundo na página anterior
    if (duration > 1000 && currentPage > 0) {
      trackPageView(currentPage, duration);
    }
    
    setPageStartTime(Date.now());
    setScrollDepth(0);
  }, [currentPage]);

  // Ao sair da página
  useEffect(() => {
    const handleBeforeUnload = () => {
      const duration = Date.now() - pageStartTime;
      if (duration > 1000) {
        trackPageView(currentPage, duration);
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      handleBeforeUnload();
    };
  }, [currentPage, pageStartTime]);

  const goToNextPage = () => {
    if (currentPage < pages.length - 1) {
      trackPageNavigation(currentPage, currentPage + 1, 'next');
      setCurrentPage(currentPage + 1);
    }
  };

  const goToPreviousPage = () => {
    if (currentPage > 0) {
      trackPageNavigation(currentPage, currentPage - 1, 'previous');
      setCurrentPage(currentPage - 1);
    }
  };

  const goToPage = (pageNum: number) => {
    if (pageNum >= 0 && pageNum < pages.length && pageNum !== currentPage) {
      trackPageNavigation(currentPage, pageNum, 'jump');
      setCurrentPage(pageNum);
    }
  };

  const handleZoomIn = () => {
    if (zoom < 200) setZoom(zoom + 25);
  };

  const handleZoomOut = () => {
    if (zoom > 50) setZoom(zoom - 25);
  };

  const handleFullscreen = () => {
    if (containerRef.current) {
      if (document.fullscreenElement) {
        document.exitFullscreen();
      } else {
        containerRef.current.requestFullscreen();
      }
    }
  };

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Header com controles */}
      <div className="border-b bg-card p-4">
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          <div>
            <h2 className="text-xl font-semibold">{documentTitle}</h2>
            <p className="text-sm text-muted-foreground">
              Página {currentPage + 1} de {pages.length}
            </p>
          </div>
          
          <div className="flex items-center gap-2">
            {/* Controles de zoom */}
            <Button variant="outline" size="icon" onClick={handleZoomOut} disabled={zoom <= 50}>
              <ZoomOut className="h-4 w-4" />
            </Button>
            <span className="text-sm font-medium w-16 text-center">{zoom}%</span>
            <Button variant="outline" size="icon" onClick={handleZoomIn} disabled={zoom >= 200}>
              <ZoomIn className="h-4 w-4" />
            </Button>
            
            <div className="w-px h-6 bg-border mx-2" />
            
            {/* Fullscreen */}
            <Button variant="outline" size="icon" onClick={handleFullscreen}>
              <Maximize2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Visualizador */}
      <div 
        ref={containerRef}
        className="flex-1 overflow-auto"
        onScroll={handleScroll}
      >
        <div className="flex items-center justify-center min-h-full p-8">
          <img
            src={pages[currentPage]}
            alt={`Página ${currentPage + 1}`}
            style={{ 
              width: `${zoom}%`,
              maxWidth: 'none',
              height: 'auto'
            }}
            className="shadow-2xl"
          />
        </div>
      </div>

      {/* Footer com navegação */}
      <div className="border-t bg-card p-4">
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          <Button
            variant="outline"
            onClick={goToPreviousPage}
            disabled={currentPage === 0}
          >
            <ChevronLeft className="h-4 w-4 mr-2" />
            Anterior
          </Button>

          {/* Navegação rápida por página */}
          <div className="flex items-center gap-2">
            {pages.map((_, idx) => {
              // Mostrar páginas próximas à atual
              if (
                idx === 0 ||
                idx === pages.length - 1 ||
                (idx >= currentPage - 2 && idx <= currentPage + 2)
              ) {
                return (
                  <Button
                    key={idx}
                    variant={idx === currentPage ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => goToPage(idx)}
                    className="w-10"
                  >
                    {idx + 1}
                  </Button>
                );
              } else if (idx === currentPage - 3 || idx === currentPage + 3) {
                return <span key={idx} className="text-muted-foreground">...</span>;
              }
              return null;
            })}
          </div>

          <Button
            variant="outline"
            onClick={goToNextPage}
            disabled={currentPage === pages.length - 1}
          >
            Próxima
            <ChevronRight className="h-4 w-4 ml-2" />
          </Button>
        </div>
      </div>
    </div>
  );
};

export default PageByPageViewer;
