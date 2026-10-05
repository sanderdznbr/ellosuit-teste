import React, { useState, useEffect } from 'react';
import { Settings2, Volume2, VolumeX, ZoomIn, ZoomOut, Contrast, RotateCcw } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useTTSAccessibility } from '@/hooks/useTTSAccessibility';
import { toast } from '@/hooks/use-toast';

const A11Y_FONT_KEY = 'ellosuit_a11y_fontsize';
const A11Y_CONTRAST_KEY = 'ellosuit_a11y_contrast';

const FONT_STEPS = [90, 100, 110, 120, 130];

export function AccessibilityMenu() {
  const { ttsEnabled, toggleTTS } = useTTSAccessibility();

  const [fontScale, setFontScale] = useState(() => {
    try {
      return Number(localStorage.getItem(A11Y_FONT_KEY)) || 100;
    } catch { return 100; }
  });

  const [highContrast, setHighContrast] = useState(() => {
    try {
      return localStorage.getItem(A11Y_CONTRAST_KEY) === 'true';
    } catch { return false; }
  });

  useEffect(() => {
    document.documentElement.style.fontSize = `${fontScale}%`;
    try { localStorage.setItem(A11Y_FONT_KEY, String(fontScale)); } catch {}
  }, [fontScale]);

  useEffect(() => {
    document.documentElement.classList.toggle('high-contrast', highContrast);
    try { localStorage.setItem(A11Y_CONTRAST_KEY, String(highContrast)); } catch {}
  }, [highContrast]);

  const increaseFontSize = () => {
    setFontScale(prev => {
      const idx = FONT_STEPS.indexOf(prev);
      if (idx < FONT_STEPS.length - 1) return FONT_STEPS[idx + 1];
      return prev;
    });
  };

  const decreaseFontSize = () => {
    setFontScale(prev => {
      const idx = FONT_STEPS.indexOf(prev);
      if (idx > 0) return FONT_STEPS[idx - 1];
      return prev;
    });
  };

  const resetAll = () => {
    setFontScale(100);
    if (highContrast) setHighContrast(false);
    toast({ title: '♿ Acessibilidade resetada', description: 'Configurações restauradas ao padrão.' });
  };

  const handleToggleTTS = () => {
    toggleTTS();
    toast({
      title: !ttsEnabled ? '🔊 Voz ativada' : '🔇 Voz desativada',
      description: !ttsEnabled
        ? 'As respostas do assistente serão lidas em voz alta.'
        : 'As respostas do assistente não serão mais lidas.',
    });
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          className="p-2.5 rounded-xl transition-all duration-200 hover:bg-gray-100/80 group"
          title="Acessibilidade"
          aria-label="Configurações de acessibilidade"
        >
          <Settings2 className="h-5 w-5 text-gray-400 group-hover:text-gray-600 transition-colors" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        side="top"
        align="end"
        className="w-64 p-3 bg-popover border border-border shadow-xl rounded-xl z-[100]"
      >
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Acessibilidade</p>

        {/* Font Size */}
        <div className="flex items-center justify-between py-2">
          <span className="text-sm font-medium text-foreground">Tamanho do texto</span>
          <div className="flex items-center gap-1">
            <button
              onClick={decreaseFontSize}
              disabled={fontScale <= FONT_STEPS[0]}
              className="p-1.5 rounded-lg hover:bg-muted disabled:opacity-30 transition-colors"
              aria-label="Diminuir texto"
            >
              <ZoomOut className="h-4 w-4 text-foreground" />
            </button>
            <span className="text-xs font-mono text-muted-foreground w-8 text-center">{fontScale}%</span>
            <button
              onClick={increaseFontSize}
              disabled={fontScale >= FONT_STEPS[FONT_STEPS.length - 1]}
              className="p-1.5 rounded-lg hover:bg-muted disabled:opacity-30 transition-colors"
              aria-label="Aumentar texto"
            >
              <ZoomIn className="h-4 w-4 text-foreground" />
            </button>
          </div>
        </div>

        {/* Contrast */}
        <button
          onClick={() => setHighContrast(prev => !prev)}
          className={`w-full flex items-center gap-3 py-2.5 px-2 rounded-lg transition-colors ${highContrast ? 'bg-primary/10' : 'hover:bg-muted'}`}
        >
          <Contrast className={`h-4 w-4 ${highContrast ? 'text-primary' : 'text-muted-foreground'}`} />
          <span className="text-sm font-medium text-foreground flex-1 text-left">Alto contraste</span>
          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${highContrast ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
            {highContrast ? 'ON' : 'OFF'}
          </span>
        </button>

        {/* TTS Toggle */}
        <button
          onClick={handleToggleTTS}
          className={`w-full flex items-center gap-3 py-2.5 px-2 rounded-lg transition-colors ${ttsEnabled ? 'bg-primary/10' : 'hover:bg-muted'}`}
        >
          {ttsEnabled ? (
            <Volume2 className="h-4 w-4 text-primary" />
          ) : (
            <VolumeX className="h-4 w-4 text-muted-foreground" />
          )}
          <span className="text-sm font-medium text-foreground flex-1 text-left">Áudio de fala</span>
          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${ttsEnabled ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
            {ttsEnabled ? 'ON' : 'OFF'}
          </span>
        </button>

        {/* Reset */}
        <div className="mt-2 pt-2 border-t border-border">
          <button
            onClick={resetAll}
            className="w-full flex items-center justify-center gap-1.5 py-2 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Restaurar padrão
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export default AccessibilityMenu;
