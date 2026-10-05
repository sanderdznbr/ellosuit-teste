import React from 'react';
import { Mic, Image as ImageIcon, Video, FileText, MapPin, User, Sticker as StickerIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface LastMessagePreviewProps {
  text?: string | null;
  className?: string;
}

// Maps "[Áudio]", "[Foto]", "[Vídeo]" etc. used as last_message to icon+label.
const TOKEN_MAP: Record<string, { icon: React.ComponentType<{ className?: string }>; label: string }> = {
  '[áudio]': { icon: Mic, label: 'Mensagem de voz' },
  '[audio]': { icon: Mic, label: 'Mensagem de voz' },
  '[imagem]': { icon: ImageIcon, label: 'Foto' },
  '[foto]': { icon: ImageIcon, label: 'Foto' },
  '[vídeo]': { icon: Video, label: 'Vídeo' },
  '[video]': { icon: Video, label: 'Vídeo' },
  '[documento]': { icon: FileText, label: 'Documento' },
  '[sticker]': { icon: StickerIcon, label: 'Figurinha' },
  '[figurinha]': { icon: StickerIcon, label: 'Figurinha' },
  '[localização]': { icon: MapPin, label: 'Localização' },
  '[localizacao]': { icon: MapPin, label: 'Localização' },
  '[contato]': { icon: User, label: 'Contato' },
};

export const LastMessagePreview: React.FC<LastMessagePreviewProps> = ({ text, className }) => {
  const raw = (text || '').trim();
  if (!raw) {
    return null;
  }
  const key = raw.toLowerCase();
  const match = TOKEN_MAP[key];
  if (match) {
    const Icon = match.icon;
    return (
      <span className={cn('flex items-center gap-1.5 truncate', className)}>
        <Icon className="h-3.5 w-3.5 flex-shrink-0 opacity-80" />
        <span className="truncate italic">{match.label}</span>
      </span>
    );
  }
  // If text starts with a bracket token followed by caption (e.g. "[Imagem] legenda")
  const bracketPrefix = raw.match(/^\[([^\]]+)\]\s*(.*)$/);
  if (bracketPrefix) {
    const inner = `[${bracketPrefix[1].toLowerCase()}]`;
    const found = TOKEN_MAP[inner];
    if (found) {
      const Icon = found.icon;
      const caption = bracketPrefix[2].trim();
      return (
        <span className={cn('flex items-center gap-1.5 truncate', className)}>
          <Icon className="h-3.5 w-3.5 flex-shrink-0 opacity-80" />
          <span className="truncate">{caption || found.label}</span>
        </span>
      );
    }
  }
  return <span className={cn('truncate', className)}>{raw}</span>;
};

export default LastMessagePreview;