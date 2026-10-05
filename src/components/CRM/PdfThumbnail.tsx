import { useEffect, useRef, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import { FileText, Loader2 } from 'lucide-react';

// pdfjs v4 ships worker as .mjs. Match exactly the installed version.
const PDFJS_VERSION = (pdfjsLib as any).version || '4.10.38';
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS_VERSION}/pdf.worker.min.mjs`;
console.info('[PdfThumbnail] pdfjs version =', PDFJS_VERSION, 'worker =', pdfjsLib.GlobalWorkerOptions.workerSrc);

// Simple in-memory cache so we don't re-render the same PDF on every scroll
const thumbCache = new Map<string, string>();

interface PdfThumbnailProps {
  url: string;
  className?: string;
  height?: number;
  onError?: () => void;
}

export function PdfThumbnail({ url, className = '', height = 180, onError }: PdfThumbnailProps) {
  const [dataUrl, setDataUrl] = useState<string | null>(thumbCache.get(url) ?? null);
  const [error, setError] = useState(false);
  const cancelledRef = useRef(false);

  useEffect(() => {
    cancelledRef.current = false;
    if (thumbCache.has(url)) {
      setDataUrl(thumbCache.get(url)!);
      return;
    }
    (async () => {
      try {
        console.info('[PdfThumbnail] loading', url);
        const loadingTask = pdfjsLib.getDocument({ url, disableRange: false, withCredentials: false });
        const pdf = await loadingTask.promise;
        console.info('[PdfThumbnail] loaded pages=', pdf.numPages, 'for', url);
        const page = await pdf.getPage(1);
        const viewport = page.getViewport({ scale: 1 });
        const targetWidth = 320;
        const scale = targetWidth / viewport.width;
        const scaledViewport = page.getViewport({ scale });
        const canvas = document.createElement('canvas');
        canvas.width = scaledViewport.width;
        canvas.height = scaledViewport.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('no ctx');
        await page.render({ canvas, canvasContext: ctx, viewport: scaledViewport } as any).promise;
        const png = canvas.toDataURL('image/png');
        console.info('[PdfThumbnail] rendered thumbnail', url, 'size=', png.length);
        thumbCache.set(url, png);
        if (!cancelledRef.current) setDataUrl(png);
      } catch (e) {
        console.warn('[PdfThumbnail] render failed for', url, e);
        if (!cancelledRef.current) {
          setError(true);
          onError?.();
        }
      }
    })();
    return () => {
      cancelledRef.current = true;
    };
  }, [url]);

  if (error) {
    // Render nothing — parent shows generic document card with download button.
    return null;
  }

  if (!dataUrl) {
    return (
      <div
        className={`flex items-center justify-center bg-muted ${className}`}
        style={{ height }}
      >
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <img
      src={dataUrl}
      alt="Pré-visualização PDF"
      className={`object-cover object-top w-full ${className}`}
      style={{ height }}
      loading="lazy"
    />
  );
}