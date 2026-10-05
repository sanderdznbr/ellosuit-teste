import React, { useState } from 'react';
import { ChevronLeft, X, Check, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';

export interface BoardBackground {
  type: 'gradient' | 'solid' | 'image';
  value: string; // CSS gradient, hex color, or image URL
  emoji?: string;
  label?: string;
}

const gradientPresets: BoardBackground[] = [
  { type: 'gradient', value: 'linear-gradient(135deg, #1a1a4e 0%, #2d3561 100%)', emoji: '⚙️', label: 'Noturno' },
  { type: 'gradient', value: 'linear-gradient(135deg, #1e6091 0%, #48a9a6 100%)', emoji: '❄️', label: 'Gelo' },
  { type: 'gradient', value: 'linear-gradient(135deg, #0052d4 0%, #4364f7 50%, #6fb1fc 100%)', emoji: '🌊', label: 'Oceano' },
  { type: 'gradient', value: 'linear-gradient(135deg, #5b2c8e 0%, #8e44ad 50%, #c39bd3 100%)', emoji: '🔮', label: 'Cristal' },
  { type: 'gradient', value: 'linear-gradient(135deg, #9b59b6 0%, #e8a0bf 100%)', emoji: '🌈', label: 'Aurora' },
  { type: 'gradient', value: 'linear-gradient(135deg, #e96443 0%, #f09819 100%)', emoji: '🍑', label: 'Pêssego' },
  { type: 'gradient', value: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)', emoji: '🌸', label: 'Sakura' },
  { type: 'gradient', value: 'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)', emoji: '🌍', label: 'Floresta' },
  { type: 'gradient', value: 'linear-gradient(135deg, #373b44 0%, #4286f4 100%)', emoji: '👽', label: 'Nebulosa' },
  { type: 'gradient', value: 'linear-gradient(135deg, #c94b4b 0%, #4b134f 100%)', emoji: '🌋', label: 'Vulcão' },
];

const solidColors: BoardBackground[] = [
  { type: 'solid', value: '#0079BF', label: 'Azul' },
  { type: 'solid', value: '#D29034', label: 'Âmbar' },
  { type: 'solid', value: '#519839', label: 'Verde' },
  { type: 'solid', value: '#B04632', label: 'Vermelho' },
  { type: 'solid', value: '#89609E', label: 'Roxo' },
  { type: 'solid', value: '#CD5A91', label: 'Rosa' },
  { type: 'solid', value: '#00AECC', label: 'Turquesa' },
  { type: 'solid', value: '#838C91', label: 'Cinza' },
  { type: 'solid', value: '#FFFFFF', label: 'Branco' },
  { type: 'solid', value: '#1D2125', label: 'Preto' },
  { type: 'solid', value: '#172B4D', label: 'Marinho' },
  { type: 'solid', value: '#F4F5F7', label: 'Neve' },
];

const photoBackgrounds: BoardBackground[] = [
  { type: 'image', value: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=1920&q=80', label: 'Montanhas' },
  { type: 'image', value: 'https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?w=1920&q=80', label: 'Floresta' },
  { type: 'image', value: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=1920&q=80', label: 'Praia' },
  { type: 'image', value: 'https://images.unsplash.com/photo-1519681393784-d120267933ba?w=1920&q=80', label: 'Neve' },
  { type: 'image', value: 'https://images.unsplash.com/photo-1475924156734-496f6cac6ec1?w=1920&q=80', label: 'Pôr do Sol' },
  { type: 'image', value: 'https://images.unsplash.com/photo-1534088568595-a066f410bcda?w=1920&q=80', label: 'Noite Estrelada' },
];

type View = 'main' | 'gradients' | 'colors' | 'photos';

interface FluxosBoardBackgroundPickerProps {
  currentBackground: BoardBackground;
  onBackgroundChange: (bg: BoardBackground) => void;
  onClose: () => void;
}

export const FluxosBoardBackgroundPicker: React.FC<FluxosBoardBackgroundPickerProps> = ({
  currentBackground, onBackgroundChange, onClose
}) => {
  const [view, setView] = useState<View>('main');
  const [searchQuery, setSearchQuery] = useState('');

  const isSelected = (bg: BoardBackground) =>
    bg.type === currentBackground.type && bg.value === currentBackground.value;

  const getStyle = (bg: BoardBackground): React.CSSProperties => {
    if (bg.type === 'gradient') return { background: bg.value };
    if (bg.type === 'image') return { backgroundImage: `url(${bg.value})`, backgroundSize: 'cover', backgroundPosition: 'center' };
    return { backgroundColor: bg.value };
  };

  const isLightColor = (hex: string) => {
    const c = hex.replace('#', '');
    const r = parseInt(c.substring(0, 2), 16);
    const g = parseInt(c.substring(2, 4), 16);
    const b = parseInt(c.substring(4, 6), 16);
    return (r * 299 + g * 587 + b * 114) / 1000 > 155;
  };

  if (view === 'gradients') {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <button onClick={() => setView('main')} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
            <ChevronLeft className="h-5 w-5" />
          </button>
          <h4 className="text-sm font-semibold flex-1 text-center">Cores</h4>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="grid grid-cols-2 gap-2.5">
          {gradientPresets.map((bg, i) => (
            <button
              key={i}
              onClick={() => onBackgroundChange(bg)}
              className={`relative h-24 rounded-xl overflow-hidden transition-all hover:scale-[1.03] hover:shadow-lg ${isSelected(bg) ? 'ring-2 ring-primary ring-offset-2' : ''}`}
              style={getStyle(bg)}
            >
              {bg.emoji && <span className="absolute bottom-2 left-2.5 text-xl">{bg.emoji}</span>}
              {isSelected(bg) && (
                <div className="absolute top-2 right-2 bg-white/30 backdrop-blur rounded-full p-0.5">
                  <Check className="h-4 w-4 text-white" />
                </div>
              )}
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (view === 'colors') {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <button onClick={() => setView('main')} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
            <ChevronLeft className="h-5 w-5" />
          </button>
          <h4 className="text-sm font-semibold flex-1 text-center">Cores Sólidas</h4>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="grid grid-cols-3 gap-2.5">
          {solidColors.map((bg, i) => (
            <button
              key={i}
              onClick={() => onBackgroundChange(bg)}
              className={`relative h-16 rounded-xl overflow-hidden transition-all hover:scale-[1.03] hover:shadow-lg border ${bg.value === '#FFFFFF' || bg.value === '#F4F5F7' ? 'border-border' : 'border-transparent'} ${isSelected(bg) ? 'ring-2 ring-primary ring-offset-2' : ''}`}
              style={getStyle(bg)}
            >
              <span className={`absolute bottom-1.5 left-2 text-[10px] font-medium ${isLightColor(bg.value) ? 'text-gray-600' : 'text-white/80'}`}>{bg.label}</span>
              {isSelected(bg) && (
                <div className={`absolute top-1.5 right-1.5 rounded-full p-0.5 ${isLightColor(bg.value) ? 'bg-black/20' : 'bg-white/30'}`}>
                  <Check className={`h-3.5 w-3.5 ${isLightColor(bg.value) ? 'text-gray-700' : 'text-white'}`} />
                </div>
              )}
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (view === 'photos') {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <button onClick={() => setView('main')} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
            <ChevronLeft className="h-5 w-5" />
          </button>
          <h4 className="text-sm font-semibold flex-1 text-center">Fotos</h4>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Fotos"
            className="pl-9 rounded-xl h-10"
          />
        </div>
        <div className="grid grid-cols-2 gap-2.5">
          {photoBackgrounds.map((bg, i) => (
            <button
              key={i}
              onClick={() => onBackgroundChange(bg)}
              className={`relative h-28 rounded-xl overflow-hidden transition-all hover:scale-[1.03] hover:shadow-lg ${isSelected(bg) ? 'ring-2 ring-primary ring-offset-2' : ''}`}
              style={getStyle(bg)}
            >
              {isSelected(bg) && (
                <div className="absolute top-2 right-2 bg-white/30 backdrop-blur rounded-full p-0.5">
                  <Check className="h-4 w-4 text-white" />
                </div>
              )}
            </button>
          ))}
        </div>
        <p className="text-[10px] text-muted-foreground text-center">
          Imagens do Unsplash sob licença gratuita
        </p>
      </div>
    );
  }

  // Main view
  return (
    <div className="space-y-4">
      <h4 className="text-sm font-semibold text-center">Alterar Tela de Fundo</h4>

      {/* Category cards */}
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={() => setView('photos')}
          className="relative h-28 rounded-xl overflow-hidden hover:scale-[1.02] transition-all group"
        >
          <div className="absolute inset-0 grid grid-cols-2 grid-rows-2 gap-0.5 p-1">
            {photoBackgrounds.slice(0, 4).map((bg, i) => (
              <div key={i} className="rounded-md overflow-hidden" style={getStyle(bg)} />
            ))}
          </div>
          <div className="absolute inset-0 bg-black/10 group-hover:bg-black/20 transition-colors" />
        </button>
        <button
          onClick={() => setView('gradients')}
          className="relative h-28 rounded-xl overflow-hidden hover:scale-[1.02] transition-all"
          style={{ background: 'linear-gradient(135deg, #0052d4 0%, #9b59b6 100%)' }}
        >
          <div className="absolute inset-x-4 top-1/3 space-y-2">
            <div className="h-3 rounded-full" style={{ background: 'linear-gradient(90deg, #e96443, #f5576c, #c39bd3)' }} />
            <div className="h-3 rounded-full" style={{ background: 'linear-gradient(90deg, #f093fb, #f5576c, #e96443)' }} />
          </div>
        </button>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <span className="text-xs font-medium text-center text-muted-foreground">Fotos</span>
        <span className="text-xs font-medium text-center text-muted-foreground">Cores</span>
      </div>

      {/* Solid colors row */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h5 className="text-xs font-semibold">Cores Sólidas</h5>
          <button onClick={() => setView('colors')} className="text-[10px] text-primary hover:underline">Ver todas</button>
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {solidColors.slice(0, 8).map((bg, i) => (
            <button
              key={i}
              onClick={() => onBackgroundChange(bg)}
              className={`w-9 h-7 rounded-lg transition-all hover:scale-110 border ${bg.value === '#FFFFFF' || bg.value === '#F4F5F7' ? 'border-border' : 'border-transparent'} ${isSelected(bg) ? 'ring-2 ring-primary ring-offset-1 scale-110' : ''}`}
              style={getStyle(bg)}
            />
          ))}
        </div>
      </div>
    </div>
  );
};
