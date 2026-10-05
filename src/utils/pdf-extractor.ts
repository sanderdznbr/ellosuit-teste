import * as pdfjsLib from 'pdfjs-dist';
import { supabase } from '@/integrations/supabase/client';

// Configure worker for browser usage via CDN to avoid bundling issues
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.worker.min.js`;

export async function extractAndUploadPdfPages(
  fileUrl: string, 
  documentId: string, 
  options?: { 
    maxWidth?: number; 
    format?: 'image/webp' | 'image/png'; 
    quality?: number;
    onProgress?: (current: number, total: number) => void;
  }
): Promise<number> {
  const maxWidth = options?.maxWidth ?? 1400;
  const format = options?.format ?? 'image/png';
  const quality = options?.quality ?? 0.85;
  const onProgress = options?.onProgress;

  console.log(`[PDF Extractor] Starting extraction for document: ${documentId}`);
  console.log(`[PDF Extractor] PDF URL: ${fileUrl}`);

  // Fetch PDF with retry logic
  let response: Response | null = null;
  let retries = 3;
  
  while (retries > 0 && !response?.ok) {
    try {
      response = await fetch(fileUrl, { 
        mode: 'cors',
        cache: 'no-cache',
      });
      
      if (!response.ok) {
        console.warn(`[PDF Extractor] Fetch attempt failed with status: ${response.status}`);
        retries--;
        if (retries > 0) {
          await new Promise(r => setTimeout(r, 1000));
        }
      }
    } catch (fetchError) {
      console.error('[PDF Extractor] Fetch error:', fetchError);
      retries--;
      if (retries > 0) {
        await new Promise(r => setTimeout(r, 1000));
      }
    }
  }

  if (!response?.ok) {
    throw new Error(`Falha ao baixar PDF após múltiplas tentativas. Status: ${response?.status || 'unknown'}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  console.log(`[PDF Extractor] PDF downloaded, size: ${arrayBuffer.byteLength} bytes`);

  // Load PDF document
  let pdf;
  try {
    pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    console.log(`[PDF Extractor] PDF loaded successfully. Pages: ${pdf.numPages}`);
  } catch (pdfError) {
    console.error('[PDF Extractor] Failed to parse PDF:', pdfError);
    throw new Error('Falha ao processar o PDF. O arquivo pode estar corrompido.');
  }

  let uploaded = 0;
  const totalPages = pdf.numPages;

  for (let i = 1; i <= totalPages; i++) {
    try {
      const page = await pdf.getPage(i);
      const viewport = page.getViewport({ scale: 1 });

      // Compute scale to fit maxWidth
      const scale = Math.min(maxWidth / viewport.width, 2);
      const scaledViewport = page.getViewport({ scale });

      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        console.error(`[PDF Extractor] Canvas context not available for page ${i}`);
        continue;
      }

      canvas.width = Math.floor(scaledViewport.width);
      canvas.height = Math.floor(scaledViewport.height);

      await page.render({ canvasContext: ctx, viewport: scaledViewport }).promise;

      // Convert to blob with retry
      const blob: Blob = await new Promise((resolve, reject) => {
        canvas.toBlob(
          (b) => (b ? resolve(b) : reject(new Error(`Falha ao converter página ${i} em imagem`))), 
          format, 
          quality
        );
      });

      // Upload to storage
      const ext = format === 'image/png' ? 'png' : 'webp';
      const path = `pages/${documentId}/page-${String(i).padStart(4, '0')}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from('trackable-documents')
        .upload(path, blob, { upsert: true, cacheControl: '3600' });

      if (uploadError) {
        console.error(`[PDF Extractor] Upload error for page ${i}:`, uploadError);
        // Try one more time
        const { error: retryError } = await supabase.storage
          .from('trackable-documents')
          .upload(path, blob, { upsert: true, cacheControl: '3600' });
        
        if (retryError) {
          console.error(`[PDF Extractor] Retry also failed for page ${i}`);
          continue;
        }
      }

      uploaded++;
      console.log(`[PDF Extractor] Page ${i}/${totalPages} uploaded successfully`);
      
      if (onProgress) {
        onProgress(i, totalPages);
      }

      // Clean up canvas
      canvas.width = 0;
      canvas.height = 0;

    } catch (pageError) {
      console.error(`[PDF Extractor] Error processing page ${i}:`, pageError);
      // Continue with next page instead of failing completely
    }
  }

  console.log(`[PDF Extractor] Extraction complete. ${uploaded}/${totalPages} pages uploaded.`);
  return uploaded;
}

export async function listExtractedPageUrls(documentId: string) {
  const { data, error } = await supabase.storage
    .from('trackable-documents')
    .list(`pages/${documentId}`, { limit: 500, sortBy: { column: 'name', order: 'asc' } });

  if (error) return [] as string[];
  if (!data || data.length === 0) return [] as string[];

  return data
    .filter((f) => f.name.endsWith('.webp') || f.name.endsWith('.png') || f.name.endsWith('.jpg'))
    .map((f) => supabase.storage.from('trackable-documents').getPublicUrl(`pages/${documentId}/${f.name}`).data.publicUrl);
}
