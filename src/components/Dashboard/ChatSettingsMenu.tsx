import React, { useEffect, useState } from 'react';
import { Settings, Volume2, VolumeX, ZoomIn, ZoomOut, Contrast, RotateCcw, BookOpen } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Switch } from '@/components/ui/switch';
import { useTTSAccessibility } from '@/hooks/useTTSAccessibility';
import { toast } from '@/hooks/use-toast';

const HUB_KEY = 'knowledge-hub-hidden';
const A11Y_FONT_KEY = 'ellosuit_a11y_fontsize';
const A11Y_CONTRAST_KEY = 'ellosuit_a11y_contrast';
const TTS_VOLUME_KEY = 'ellosuit_tts_volume';
const FONT_STEPS = [90, 100, 110, 120, 130];

interface Props {
  isDark?: boolean;
  trigger?: React.ReactNode;
}

const ChatSettingsMenu: React.FC<Props> = ({ isDark, trigger }) => {
  const { ttsEnabled, toggleTTS } = useTTSAccessibility();

  const [hubHidden, setHubHidden] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    const stored = localStorage.getItem(HUB_KEY);
    return stored === null ? true : stored === 'true';
  });

  const [fontScale, setFontScale] = useState<number>(() => {
    try { return Number(localStorage.getItem(A11Y_FONT_KEY)) || 100; } catch { return 100; }
  });

  const [highContrast, setHighContrast] = useState<boolean>(() => {
    try { return localStorage.getItem(A11Y_CONTRAST_KEY) === 'true'; } catch { return false; }
  });

  const [ttsVolume, setTtsVolume] = useState<number>(() => {
    try {
      const v = Number(localStorage.getItem(TTS_VOLUME_KEY));
      return Number.isFinite(v) && v > 0 ? v : 100;
    } catch { return 100; }
  });

  useEffect(() => {
    localStorage.setItem(HUB_KEY, hubHidden ? 'true' : 'false');
    window.dispatchEvent(new CustomEvent('knowledge-hub-visibility-changed', { detail: { hidden: hubHidden } }));
  }, [hubHidden]);

  useEffect(() => {
    document.documentElement.style.fontSize = `${fontScale}%`;
    try { localStorage.setItem(A11Y_FONT_KEY, String(fontScale)); } catch {}
  }, [fontScale]);

  useEffect(() => {
    document.documentElement.classList.toggle('high-contrast', highContrast);
    try { localStorage.setItem(A11Y_CONTRAST_KEY, String(highContrast)); } catch {}
  }, [highContrast]);

  useEffect(() => {
    try { localStorage.setItem(TTS_VOLUME_KEY, String(ttsVolume)); } catch {}
    window.dispatchEvent(new CustomEvent('tts-volume-changed', { detail: { volume: ttsVolume / 100 } }));
  }, [ttsVolume]);

  const fontIdx = FONT_STEPS.indexOf(fontScale);
  const increaseFont = () => fontIdx < FONT_STEPS.length - 1 && setFontScale(FONT_STEPS[fontIdx + 1]);
  const decreaseFont = () => fontIdx > 0 && setFontScale(FONT_STEPS[fontIdx - 1]);

  const resetAll = () => {
    setFontScale(100);
    setHighContrast(false);
    setTtsVolume(100);
    setHubHidden(true);
    toast({ title: '♿ Configurações restauradas' });
  };

  const handleToggleTTS = () => {
    toggleTTS();
    toast({
      title: !ttsEnabled ? '🔊 Voz ativada' : '🔇 Voz desativada',
    });
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        {trigger || (
          <button
            type="button"
            aria-label="Configurações"
            title="Configurações"
            className={`p-2.5 rounded-xl transition-all duration-200 active:scale-90 ${isDark ? 'hover:bg-white/5' : 'hover:bg-gray-100/80'} group`}
          >
            <Settings className={`h-5 w-5 transition-colors ${isDark ? 'text-white/40 group-hover:text-white/70' : 'text-gray-400 group-hover:text-gray-600'}`} />
          </button>
        )}
      </PopoverTrigger>
      <PopoverContent
        side="top"
        align="end"
        className="w-80 p-0 bg-popover border border-border shadow-xl rounded-xl z-[100]"
      >
        <div className="p-3 border-b border-border">
          <p className="text-sm font-semibold text-foreground">Configurações</p>
          <p className="text-xs text-muted-foreground mt-0.5">Acessibilidade e exibição</p>
        </div>

        <div className="p-3 space-y-1">
          {/* Knowledge Hub */}
          <div className="flex items-center gap-3 py-2 px-2">
            <BookOpen className="h-4 w-4 text-muted-foreground" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground">Knowledge Hub</p>
              <p className="text-[11px] text-muted-foreground">Aba de tutoriais no rodapé</p>
            </div>
            <Switch checked={!hubHidden} onCheckedChange={(c) => setHubHidden(!c)} />
          </div>

          <div className="h-px bg-border my-1" />

          {/* Font size */}
          <div className="flex items-center justify-between py-2 px-2">
            <span className="text-sm font-medium text-foreground">Tamanho do texto</span>
            <div className="flex items-center gap-1">
              <button
                onClick={decreaseFont}
                disabled={fontScale <= FONT_STEPS[0]}
                className="p-1.5 rounded-lg hover:bg-muted disabled:opacity-30 transition-colors"
                aria-label="Diminuir texto"
              >
                <ZoomOut className="h-4 w-4 text-foreground" />
              </button>
              <span className="text-xs font-mono text-muted-foreground w-9 text-center">{fontScale}%</span>
              <button
                onClick={increaseFont}
                disabled={fontScale >= FONT_STEPS[FONT_STEPS.length - 1]}
                className="p-1.5 rounded-lg hover:bg-muted disabled:opacity-30 transition-colors"
                aria-label="Aumentar texto"
              >
                <ZoomIn className="h-4 w-4 text-foreground" />
              </button>
            </div>
          </div>

          {/* High contrast */}
          <button
            onClick={() => setHighContrast(p => !p)}
            className={`w-full flex items-center gap-3 py-2 px-2 rounded-lg transition-colors ${highContrast ? 'bg-primary/10' : 'hover:bg-muted'}`}
          >
            <Contrast className={`h-4 w-4 ${highContrast ? 'text-primary' : 'text-muted-foreground'}`} />
            <span className="text-sm font-medium text-foreground flex-1 text-left">Alto contraste</span>
            <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${highContrast ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
              {highContrast ? 'ON' : 'OFF'}
            </span>
          </button>

          {/* TTS toggle */}
          <button
            onClick={handleToggleTTS}
            className={`w-full flex items-center gap-3 py-2 px-2 rounded-lg transition-colors ${ttsEnabled ? 'bg-primary/10' : 'hover:bg-muted'}`}
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

          {/* Volume */}
          <div className="px-2 py-2">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-sm font-medium text-foreground">Volume da voz</span>
              <span className="text-xs font-mono text-muted-foreground">{ttsVolume}%</span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              step={5}
              value={ttsVolume}
              onChange={(e) => setTtsVolume(Number(e.target.value))}
              disabled={!ttsEnabled}
              aria-label="Volume da voz"
              className="w-full accent-primary disabled:opacity-40 cursor-pointer"
            />
          </div>
        </div>

        <div className="px-3 pb-3 pt-1 border-t border-border">
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
};

export default ChatSettingsMenu;