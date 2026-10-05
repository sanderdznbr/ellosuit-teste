import React, { useState, useEffect, useRef } from 'react';
import { FileText, ChevronDown, ChevronUp, Eye, Image as ImageIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

function formatComment(text: string): string {
  return text
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/\n/g, '<br/>');
}

interface PageAnalysis {
  page: number;
  comment: string;
}

interface PdfAnalysisProps {
  fileUrl: string;
  fileName?: string;
  pages?: PageAnalysis[];
  overallScore?: number;
  overallSummary?: string;
}

const AIAssistantPdfAnalysis: React.FC<PdfAnalysisProps> = ({ fileUrl, fileName, pages, overallScore, overallSummary }) => {
  const [pageImages, setPageImages] = useState<Map<number, string>>(new Map());
  const [imagesLoading, setImagesLoading] = useState(false);
  const [expandedPage, setExpandedPage] = useState<number | null>(null);
  const attemptedRef = useRef(false);

  const analysisPages = pages || [];

  // Auto-expand first page
  useEffect(() => {
    if (analysisPages.length > 0 && expandedPage === null) {
      setExpandedPage(analysisPages[0].page);
    }
  }, [analysisPages]);

  // Try to load PDF page images in background (non-blocking)
  useEffect(() => {
    if (!fileUrl || attemptedRef.current || analysisPages.length === 0) return;
    attemptedRef.current = true;

    const loadImages = async () => {
      setImagesLoading(true);
      
      // Create an abort controller with 10s timeout
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);

      try {
        const pdfjsLib = await import('pdfjs-dist');
        pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.worker.min.js`;

        const response = await fetch(fileUrl, { 
          mode: 'cors', 
          cache: 'no-cache',
          signal: controller.signal 
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        
        const arrayBuffer = await response.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

        const pagesToRender = analysisPages.map(p => p.page);
        const images = new Map<number, string>();

        for (const pageNum of pagesToRender) {
          if (pageNum > pdf.numPages || controller.signal.aborted) break;
          try {
            const page = await pdf.getPage(pageNum);
            const viewport = page.getViewport({ scale: 1 });
            const scale = Math.min(500 / viewport.width, 1.2);
            const scaledViewport = page.getViewport({ scale });

            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            if (!ctx) continue;

            canvas.width = Math.floor(scaledViewport.width);
            canvas.height = Math.floor(scaledViewport.height);
            await page.render({ canvasContext: ctx, viewport: scaledViewport }).promise;

            images.set(pageNum, canvas.toDataURL('image/jpeg', 0.75));
            canvas.width = 0;
            canvas.height = 0;
            
            // Update incrementally so user sees images appear
            setPageImages(new Map(images));
          } catch {
            // Skip failed pages silently
          }
        }
      } catch {
        // Silently fail - analysis text is shown regardless
      } finally {
        clearTimeout(timeout);
        setImagesLoading(false);
      }
    };

    // Start after a small delay to not block UI
    const timer = setTimeout(loadImages, 200);
    return () => clearTimeout(timer);
  }, [fileUrl, analysisPages]);

  if (analysisPages.length === 0) return null;

  return (
    <div className="mt-3 space-y-2.5">
      {/* Header */}
      <motion.div 
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center gap-2.5 p-2.5 rounded-xl bg-muted/40 border border-border"
      >
        <div className="w-9 h-9 rounded-lg bg-red-100 dark:bg-red-900/30 flex items-center justify-center shrink-0">
          <FileText className="h-4.5 w-4.5 text-red-600 dark:text-red-400" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-foreground truncate">{fileName || 'Documento PDF'}</p>
          <div className="flex items-center gap-2 mt-0.5">
            <p className="text-[10px] text-muted-foreground">
              {analysisPages.length} página{analysisPages.length !== 1 ? 's' : ''} analisada{analysisPages.length !== 1 ? 's' : ''}
            </p>
            {overallScore && (
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-primary/10 text-primary">
                {overallScore}/10
              </span>
            )}
          </div>
        </div>
      </motion.div>

      {/* Overall summary */}
      {overallSummary && (
        <motion.p 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="text-[11px] text-muted-foreground px-1 leading-relaxed"
        >
          {overallSummary}
        </motion.p>
      )}

      {/* Page-by-page analysis */}
      {analysisPages.map((pageAnalysis, idx) => {
        const isExpanded = expandedPage === pageAnalysis.page;
        const imgSrc = pageImages.get(pageAnalysis.page);

        return (
          <motion.div
            key={pageAnalysis.page}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, delay: idx * 0.04 }}
            className="rounded-xl border border-border overflow-hidden bg-card"
          >
            {/* Page header - always clickable */}
            <button
              onClick={() => setExpandedPage(isExpanded ? null : pageAnalysis.page)}
              className="w-full flex items-center gap-2.5 p-2.5 hover:bg-muted/40 transition-colors text-left"
            >
              {imgSrc ? (
                <div className="w-10 h-14 rounded-md overflow-hidden border border-border shrink-0 bg-white shadow-sm">
                  <img src={imgSrc} alt={`Pg ${pageAnalysis.page}`} className="w-full h-full object-cover object-top" />
                </div>
              ) : (
                <div className="w-10 h-14 rounded-md border border-border shrink-0 bg-muted/30 flex flex-col items-center justify-center gap-0.5">
                  <ImageIcon className="h-3.5 w-3.5 text-muted-foreground/50" />
                  <span className="text-[9px] font-bold text-muted-foreground">{pageAnalysis.page}</span>
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-foreground">Página {pageAnalysis.page}</p>
                <p className="text-[10px] text-muted-foreground line-clamp-2 mt-0.5"
                   dangerouslySetInnerHTML={{ __html: formatComment(pageAnalysis.comment.substring(0, 140)) + (pageAnalysis.comment.length > 140 ? '...' : '') }}
                />
              </div>
              {isExpanded ? (
                <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" />
              ) : (
                <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
              )}
            </button>

            {/* Expanded content */}
            <AnimatePresence>
              {isExpanded && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <div className="p-3 border-t border-border space-y-3">
                    {imgSrc && (
                      <div className="rounded-lg overflow-hidden border border-border bg-white shadow-sm">
                        <img
                          src={imgSrc}
                          alt={`Página ${pageAnalysis.page}`}
                          className="w-full h-auto max-h-[400px] object-contain"
                        />
                      </div>
                    )}
                    <div className="text-xs text-foreground leading-relaxed"
                         dangerouslySetInnerHTML={{ __html: formatComment(pageAnalysis.comment) }}
                    />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        );
      })}

      {/* View full document */}
      <a
        href={fileUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full bg-muted text-foreground hover:bg-muted/80 border border-border transition-colors"
      >
        <Eye className="h-3.5 w-3.5" />
        Ver documento completo
      </a>
    </div>
  );
};

export default AIAssistantPdfAnalysis;
