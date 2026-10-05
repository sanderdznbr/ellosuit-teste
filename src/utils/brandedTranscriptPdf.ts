import jsPDF from 'jspdf';
import logoEllosuit from '@/assets/logoellosuit.png';

let cachedLogoDataUrl: string | null = null;
const loadLogoDataUrl = async (): Promise<string | null> => {
  if (cachedLogoDataUrl) return cachedLogoDataUrl;
  try {
    const res = await fetch(logoEllosuit);
    const blob = await res.blob();
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
    cachedLogoDataUrl = dataUrl;
    return dataUrl;
  } catch (e) {
    console.warn('[brandedTranscriptPdf] Failed to load logo:', e);
    return null;
  }
};

export interface BrandedPdfOptions {
  title: string;
  roomName: string;
  body: string;
  subtitle?: string;
}

/**
 * Build a branded Ellosuit PDF with header (logo + meeting id + timestamp),
 * footer with page numbering, and infinite pagination for the body.
 */
export const buildBrandedTranscriptPdf = async ({
  title,
  roomName,
  body,
  subtitle,
}: BrandedPdfOptions): Promise<jsPDF> => {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const marginX = 20;
  const marginBottom = 25;
  const lineHeight = 6;
  const contentWidth = pageWidth - marginX * 2;

  const logoDataUrl = await loadLogoDataUrl();

  const drawHeader = () => {
    if (logoDataUrl) {
      try {
        // Original dimensions: 1194x320
        // Aspect ratio: 1194 / 320 = 3.73125
        const logoWidth = 35;
        const logoHeight = logoWidth / 3.73125; // ~9.38mm
        doc.addImage(logoDataUrl, 'PNG', marginX, 12, logoWidth, logoHeight);
      } catch {
        /* ignore */
      }
    }
    doc.setFontSize(9);
    doc.setTextColor(100);
    doc.text(`ID: ${roomName}`, pageWidth - marginX, 16, { align: 'right' });
    doc.text(
      new Date().toLocaleString('pt-BR'),
      pageWidth - marginX,
      21,
      { align: 'right' },
    );
    doc.setDrawColor(54, 0, 255);
    doc.setLineWidth(0.5);
    doc.line(marginX, 26, pageWidth - marginX, 26);
    doc.setTextColor(0);
  };

  const drawFooter = (pageNumber: number) => {
    doc.setFontSize(8);
    doc.setTextColor(120);
    doc.text(
      `Ellosuit Meeting · Página ${pageNumber}`,
      pageWidth / 2,
      pageHeight - 10,
      { align: 'center' },
    );
    doc.setTextColor(0);
  };

  let pageNumber = 1;
  drawHeader();

  let y = 38;
  doc.setFontSize(16);
  doc.setTextColor(20);
  doc.text(title, marginX, y);
  y += 8;
  if (subtitle) {
    doc.setFontSize(10);
    doc.setTextColor(80);
    const subtitleLines = doc.splitTextToSize(subtitle, contentWidth);
    doc.text(subtitleLines, marginX, y);
    y += subtitleLines.length * 5 + 2;
  }
  doc.setTextColor(0);
  doc.setFontSize(11);
  y += 4;

  const lines = doc.splitTextToSize(body || '(sem conteúdo)', contentWidth);
  for (const line of lines) {
    if (y + lineHeight > pageHeight - marginBottom) {
      drawFooter(pageNumber);
      doc.addPage();
      pageNumber += 1;
      drawHeader();
      y = 38;
      doc.setFontSize(11);
    }
    doc.text(line, marginX, y);
    y += lineHeight;
  }
  drawFooter(pageNumber);

  return doc;
};