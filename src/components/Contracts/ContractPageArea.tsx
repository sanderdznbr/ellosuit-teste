import React, { useEffect, useRef } from 'react';
import { Plus, Trash2, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

const SUITE_COLOR = '#374DA4';

interface Props {
  pages: string[];
  currentPage: number;
  pageRefs: React.MutableRefObject<(HTMLDivElement | null)[]>;
  contentVersion: number;
  logoUrl: string;
  letterheadUrl: string;
  pageBgColor: string;
  pageTextColor: string;
  savePageContent: () => void;
  goToPage: (index: number) => void;
  addPage: () => void;
  deletePage: (index: number) => void;
}

const ContractPageArea: React.FC<Props> = ({
  pages, currentPage, pageRefs, contentVersion, logoUrl, letterheadUrl,
  pageBgColor, pageTextColor,
  savePageContent, goToPage, addPage, deletePage,
}) => {
  const editorRef = useRef<HTMLDivElement>(null);

  // Track which contentVersion we last applied to avoid re-setting on every render
  const appliedVersion = useRef<string>('');

  // Sync innerHTML when page changes or content is loaded/imported
  useEffect(() => {
    const key = `${currentPage}-${contentVersion}`;
    if (appliedVersion.current === key) return;
    appliedVersion.current = key;

    const el = editorRef.current;
    if (el) {
      const content = pages[currentPage] ?? '';
      el.innerHTML = content;
      requestAnimationFrame(() => {
        el.focus();
      });
    }
  }, [currentPage, contentVersion, pages]);

  // Keep parent ref in sync
  useEffect(() => {
    pageRefs.current[currentPage] = editorRef.current;
  }, [currentPage]);

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="flex-1 overflow-auto flex justify-center py-8 bg-muted/50">
        <div
          className="shadow-xl rounded-sm relative"
          style={{
            width: '210mm',
            minHeight: '297mm',
            backgroundColor: pageBgColor,
            color: pageTextColor,
            backgroundImage: letterheadUrl ? `url(${letterheadUrl})` : undefined,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            backgroundRepeat: 'no-repeat',
          }}
        >
          {logoUrl && currentPage === 0 && (
            <div className="flex justify-center pt-8 pb-2">
              <img src={logoUrl} alt="Logo" className="max-h-20 object-contain" />
            </div>
          )}

          <div
            ref={editorRef}
            contentEditable={true}
            className="outline-none px-16 py-8 text-sm leading-relaxed contract-editor-area"
            style={{
              fontFamily: "'Times New Roman', serif",
              fontSize: '12pt',
              lineHeight: '1.8',
              color: pageTextColor,
              minHeight: '240mm',
              cursor: 'text',
              wordWrap: 'break-word',
            }}
            suppressContentEditableWarning
            onBlur={savePageContent}
            onPaste={e => {
              // Allow image paste
              const items = e.clipboardData.items;
              for (let i = 0; i < items.length; i++) {
                if (items[i].type.startsWith('image/')) {
                  e.preventDefault();
                  const file = items[i].getAsFile();
                  if (!file) return;
                  const reader = new FileReader();
                  reader.onload = () => {
                    const imgHtml = `<img src="${reader.result}" style="max-width:300px;height:auto;display:inline-block;margin:4px;" />`;
                    document.execCommand('insertHTML', false, imgHtml);
                  };
                  reader.readAsDataURL(file);
                  return;
                }
              }
              // Plain text paste
              e.preventDefault();
              const text = e.clipboardData.getData('text/html') || e.clipboardData.getData('text/plain');
              if (e.clipboardData.getData('text/html')) {
                document.execCommand('insertHTML', false, text);
              } else {
                document.execCommand('insertText', false, text);
              }
            }}
          />
        </div>
      </div>

      {/* Pagination bar */}
      <div className="h-12 bg-background border-t flex items-center justify-center gap-2 px-4 flex-shrink-0">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 rounded-lg"
          disabled={currentPage === 0}
          onClick={() => goToPage(currentPage - 1)}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>

        <div className="flex items-center gap-1 overflow-x-auto max-w-[400px]">
          {pages.map((_, i) => (
            <button
              key={i}
              onClick={() => goToPage(i)}
              className="h-8 min-w-[2rem] px-2 rounded-lg text-xs font-medium transition-all flex-shrink-0"
              style={
                i === currentPage
                  ? { backgroundColor: SUITE_COLOR, color: 'white' }
                  : {}
              }
            >
              {i + 1}
            </button>
          ))}
        </div>

        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 rounded-lg"
          disabled={currentPage === pages.length - 1}
          onClick={() => goToPage(currentPage + 1)}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>

        <div className="w-px h-5 bg-border mx-2" />

        <Button variant="outline" size="sm" className="rounded-lg gap-1 text-xs h-8" onClick={addPage}>
          <Plus className="h-3.5 w-3.5" /> Página
        </Button>

        {pages.length > 1 && (
          <Button
            variant="ghost"
            size="sm"
            className="rounded-lg gap-1 text-xs h-8 text-destructive hover:text-destructive"
            onClick={() => deletePage(currentPage)}
          >
            <Trash2 className="h-3.5 w-3.5" /> Remover
          </Button>
        )}

        <span className="text-xs text-muted-foreground ml-2">
          Página {currentPage + 1} de {pages.length}
        </span>
      </div>
    </div>
  );
};

export default ContractPageArea;
