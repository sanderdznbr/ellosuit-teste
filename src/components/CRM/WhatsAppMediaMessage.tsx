import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { 
  Image, Music, FileText, Play, Pause, Download, MapPin, User, 
  Sticker, Video, Mic, X, ZoomIn, Phone, MessageCircle, UserPlus
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { PdfThumbnail } from './PdfThumbnail';

interface MediaMessageProps {
  messageType: string;
  content: string;
  mediaUrl?: string;
  mediaCaption?: string;
  fromMe: boolean;
}

const WhatsAppMediaMessage: React.FC<MediaMessageProps> = ({
  messageType,
  content,
  mediaUrl,
  mediaCaption,
  fromMe
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [showFullscreen, setShowFullscreen] = useState(false);
  const [fullscreenType, setFullscreenType] = useState<'image' | 'video' | 'document'>('image');
  const [audioDuration, setAudioDuration] = useState(0);
  const [audioProgress, setAudioProgress] = useState(0);
  const [pdfThumbFailed, setPdfThumbFailed] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const updateProgress = () => {
      if (audio.duration) {
        setAudioProgress((audio.currentTime / audio.duration) * 100);
      }
    };

    const handleLoadedMetadata = () => {
      setAudioDuration(audio.duration);
    };

    const handleEnded = () => {
      setIsPlaying(false);
      setAudioProgress(0);
    };

    audio.addEventListener('timeupdate', updateProgress);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.removeEventListener('timeupdate', updateProgress);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('ended', handleEnded);
    };
  }, [mediaUrl]);

  const toggleAudio = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!audioRef.current || !audioDuration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const percentage = clickX / rect.width;
    audioRef.current.currentTime = percentage * audioDuration;
    setAudioProgress(percentage * 100);
  };

  const handleDownload = async (url: string, filename?: string) => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const downloadUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = filename || 'download';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(downloadUrl);
    } catch (error) {
      window.open(url, '_blank');
    }
  };

  // Get icon and label based on message type
  const getMediaInfo = () => {
    switch (messageType) {
      case 'image':
        return { icon: Image, label: 'Foto' };
      case 'video':
        return { icon: Video, label: 'Vídeo' };
      case 'audio':
      case 'ptt':
        return { icon: messageType === 'ptt' ? Mic : Music, label: 'Áudio' };
      case 'document':
        return { icon: FileText, label: 'Documento' };
      case 'sticker':
        return { icon: Sticker, label: 'Figurinha' };
      case 'location':
        return { icon: MapPin, label: 'Localização' };
      case 'contact':
        return { icon: User, label: 'Contato' };
      default:
        return { icon: FileText, label: 'Arquivo' };
    }
  };

  const { icon: Icon, label } = getMediaInfo();

  const fullscreenModal = showFullscreen && mediaUrl ? createPortal(
    <div 
      className="fixed inset-0 z-[9999] bg-black/95 flex items-center justify-center p-4"
      onClick={() => setShowFullscreen(false)}
    >
      <button
        onClick={() => setShowFullscreen(false)}
        className="absolute top-4 right-4 p-2 text-white/80 hover:text-white transition-colors z-10"
      >
        <X className="h-8 w-8" />
      </button>
      <button
        onClick={(e) => {
          e.stopPropagation();
          handleDownload(mediaUrl, fullscreenType === 'video' ? 'video.mp4' : 'arquivo');
        }}
        className="absolute top-4 left-4 p-2 text-white/80 hover:text-white transition-colors flex items-center gap-2 z-10"
      >
        <Download className="h-6 w-6" />
        <span className="text-sm">Baixar</span>
      </button>
      {fullscreenType === 'image' && (
        <img src={mediaUrl} alt="Imagem em tela cheia" className="max-w-full max-h-full object-contain" onClick={(e) => e.stopPropagation()} />
      )}
      {fullscreenType === 'video' && (
        <video src={mediaUrl} controls autoPlay className="max-w-full max-h-full" onClick={(e) => e.stopPropagation()} />
      )}
      {fullscreenType === 'document' && (
        <iframe src={mediaUrl} className="w-full h-full max-w-4xl rounded-lg bg-white" title="Documento" onClick={(e) => e.stopPropagation()} />
      )}
    </div>,
    document.body
  ) : null;

  // === IMAGE ===
  if (messageType === 'image' && mediaUrl && !imageError) {
    return (
      <>
        <div className="space-y-1">
          <div
            className="relative rounded-lg overflow-hidden max-w-[240px] group cursor-pointer"
            onClick={(e) => { e.stopPropagation(); setFullscreenType('image'); setShowFullscreen(true); }}
          >
            <img
              src={mediaUrl}
              alt="Imagem"
              className="w-full h-auto rounded-lg cursor-pointer transition-transform hover:scale-[1.02]"
              onError={() => setImageError(true)}
            />
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
              <ZoomIn className="h-8 w-8 text-white drop-shadow-lg" />
            </div>
            <button
              onClick={(e) => { e.stopPropagation(); handleDownload(mediaUrl, 'imagem.jpg'); }}
              className="absolute bottom-2 right-2 p-2 bg-black/60 rounded-full hover:bg-black/80 transition-colors"
            >
              <Download className="h-4 w-4 text-white" />
            </button>
          </div>
          {mediaCaption && (
            <p className="text-sm whitespace-pre-wrap break-words">{mediaCaption.split(/(\s+)/).map((part, i) => {
              if (part.match(/^(https?:\/\/[^\s]+)$|^www\.[^\s]+$/i)) {
                const url = part.startsWith('http') ? part : `https://${part}`;
                return (
                  <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="underline hover:no-underline break-all" onClick={(e) => e.stopPropagation()}>{part}</a>
                );
              }
              return part;
            })}</p>
          )}
        </div>
        {fullscreenModal}
      </>
    );
  }

  // === AUDIO / PTT (WhatsApp Style) ===
  if ((messageType === 'audio' || messageType === 'ptt') && mediaUrl) {
    const isPTT = messageType === 'ptt';
    
    return (
      <div className="space-y-1">
        <div className={cn(
          "flex items-center gap-3 p-2 rounded-2xl w-full max-w-[280px] overflow-hidden",
          fromMe 
            ? "bg-white/20" 
            : "bg-gray-100 dark:bg-white/5"
        )}>
          {/* Play/Pause Button */}
          <button
            onClick={toggleAudio}
            className={cn(
              "flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center transition-all",
              isPTT 
                ? "bg-[#FF8C00] hover:bg-[#374DA4]" 
                : "bg-[#FF8C00] hover:bg-[#374DA4]"
            )}
          >
            {isPlaying ? (
              <Pause className="h-5 w-5 text-white" fill="white" />
            ) : (
              <Play className="h-5 w-5 text-white ml-0.5" fill="white" />
            )}
          </button>

          {/* Waveform / Progress */}
          <div className="flex-1 flex flex-col gap-1">
            <div 
              className="h-[24px] flex items-center gap-[2px] cursor-pointer relative"
              onClick={handleProgressClick}
            >
              {/* Simulated Waveform Bars */}
              {Array.from({ length: 30 }).map((_, i) => {
                const heights = [12, 8, 16, 10, 20, 14, 8, 18, 12, 6, 14, 20, 10, 16, 8, 12, 18, 6, 14, 10, 20, 8, 16, 12, 6, 18, 14, 10, 8, 12];
                const isActive = (i / 30) * 100 <= audioProgress;
                return (
                  <div
                    key={i}
                    className={cn(
                      "w-[3px] rounded-full transition-colors",
                      isActive 
                        ? (fromMe ? "bg-[#374DA4]" : "bg-[#374DA4]")
                        : "bg-gray-400/40"
                    )}
                    style={{ height: `${heights[i % heights.length]}px` }}
                  />
                );
              })}
            </div>
            
            {/* Duration */}
            <div className="flex justify-between items-center">
              <span className="text-[10px] text-gray-500 dark:text-gray-400">
                {audioDuration > 0 
                  ? formatDuration(isPlaying ? (audioProgress / 100) * audioDuration : audioDuration)
                  : '0:00'
                }
              </span>
              {isPTT && (
                <Mic className="h-3 w-3 text-[#374DA4]" />
              )}
            </div>
          </div>

          {/* Microphone Icon for PTT */}
          {isPTT && (
            <div className="w-10 h-10 rounded-full bg-gray-300 dark:bg-gray-600 flex items-center justify-center flex-shrink-0 overflow-hidden">
              <User className="h-6 w-6 text-gray-500 dark:text-gray-400" />
            </div>
          )}

          <audio
            ref={audioRef}
            src={mediaUrl}
            preload="metadata"
            className="hidden"
          />
        </div>
        {mediaCaption && (
          <p className="text-sm whitespace-pre-wrap mt-1">{mediaCaption}</p>
        )}
      </div>
    );
  }

  // === VIDEO ===
  if (messageType === 'video' && mediaUrl) {
    return (
      <>
        <div className="space-y-1">
          <div 
            className="relative rounded-lg overflow-hidden max-w-[240px] bg-black cursor-pointer group"
            onClick={(e) => { e.stopPropagation(); setFullscreenType('video'); setShowFullscreen(true); }}
          >
            <video
              src={mediaUrl}
              className="w-full h-auto rounded-lg"
              preload="metadata"
            />
            <div className="absolute inset-0 bg-black/30 flex items-center justify-center group-hover:bg-black/50 transition-colors">
              <Play className="h-10 w-10 text-white drop-shadow-lg" fill="white" />
            </div>
            <button
              onClick={(e) => { e.stopPropagation(); handleDownload(mediaUrl, 'video.mp4'); }}
              className="absolute top-2 right-2 p-2 bg-black/60 rounded-full hover:bg-black/80 transition-colors"
            >
              <Download className="h-4 w-4 text-white" />
            </button>
          </div>
          {mediaCaption && (
            <p className="text-sm whitespace-pre-wrap">{mediaCaption}</p>
          )}
        </div>
        {fullscreenModal}
      </>
    );
  }

  // === DOCUMENT ===
  if (messageType === 'document' && mediaUrl) {
    const fileName = mediaCaption || content || 'Documento';
    const isPreviewable = mediaUrl.match(/\.(pdf|png|jpg|jpeg|gif|webp|svg)$/i);
    const isPdf = /\.pdf(\?|$)/i.test(mediaUrl) || /pdf/i.test(fileName);

    if (isPdf) {
      return (
        <>
          <div
            className="rounded-lg overflow-hidden cursor-pointer transition-colors min-w-[240px] max-w-[300px] bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/15"
            onClick={(e) => {
              e.stopPropagation();
              setFullscreenType('document');
              setShowFullscreen(true);
            }}
          >
            <PdfThumbnail
              url={mediaUrl}
              height={200}
              onError={() => setPdfThumbFailed(true)}
            />
            <div className="flex items-center gap-3 p-3">
              <div className="w-9 h-10 rounded flex items-center justify-center flex-shrink-0 bg-[#374DA4]">
                <FileText className="h-4 w-4 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate text-foreground">{fileName}</p>
                <p className="text-xs text-muted-foreground">
                  {pdfThumbFailed ? 'PDF · Pré-visualização indisponível' : 'PDF · Toque para abrir'}
                </p>
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); handleDownload(mediaUrl, fileName); }}
                className="p-1"
                aria-label="Baixar PDF"
              >
                <Download className="h-5 w-5 flex-shrink-0 text-muted-foreground" />
              </button>
            </div>
          </div>
          {fullscreenModal}
        </>
      );
    }

    return (
      <>
        <div 
          className={cn(
            "flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors min-w-[200px] max-w-[280px]",
            "bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/15"
          )}
          onClick={(e) => {
            e.stopPropagation();
            if (isPreviewable) {
              setFullscreenType('document');
              setShowFullscreen(true);
            } else {
              window.open(mediaUrl, '_blank');
            }
          }}
        >
          <div className="w-10 h-12 rounded flex items-center justify-center flex-shrink-0 bg-[#374DA4]">
            <FileText className="h-5 w-5 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate text-foreground">{fileName}</p>
            <p className="text-xs text-muted-foreground">Toque para visualizar</p>
          </div>
          <button
            onClick={(e) => { e.stopPropagation(); handleDownload(mediaUrl, fileName); }}
            className="p-1"
          >
            <Download className="h-5 w-5 flex-shrink-0 text-muted-foreground" />
          </button>
        </div>
        {fullscreenModal}
      </>
    );
  }

  // === STICKER ===
  if (messageType === 'sticker' && mediaUrl) {
    return (
      <div className="max-w-[150px]">
        <img
          src={mediaUrl}
          alt="Sticker"
          className="w-full h-auto"
          onError={() => setImageError(true)}
        />
      </div>
    );
  }

  // === CONTACT (vCard) ===
  if (messageType === 'contact') {
    let contacts: Array<{ name: string; phone: string; vcard?: string }> = [];
    try {
      const parsed = JSON.parse(content);
      if (parsed?.type === 'contacts' && Array.isArray(parsed.contacts)) {
        contacts = parsed.contacts;
      }
    } catch {
      // Legacy format: content is just the display name
      if (content && !content.startsWith('[')) {
        contacts = [{ name: content, phone: '' }];
      }
    }

    if (contacts.length === 0) {
      contacts = [{ name: 'Contato', phone: '' }];
    }

    const downloadVcard = (c: { name: string; vcard?: string; phone: string }) => {
      const vcard = c.vcard || `BEGIN:VCARD\nVERSION:3.0\nFN:${c.name}\nTEL:${c.phone}\nEND:VCARD`;
      const blob = new Blob([vcard], { type: 'text/vcard' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${c.name.replace(/[^a-z0-9]+/gi, '_')}.vcf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    };

    return (
      <div className="space-y-2 w-full max-w-[280px]">
        {contacts.map((c, idx) => {
          const initials = c.name
            .split(/\s+/)
            .slice(0, 2)
            .map((s) => s[0]?.toUpperCase() || '')
            .join('');
          const cleanPhone = (c.phone || '').replace(/\D/g, '');
          const formattedPhone = c.phone || '';
          return (
            <div
              key={idx}
              className={cn(
                'rounded-xl overflow-hidden border',
                fromMe
                  ? 'bg-white/15 border-white/20'
                  : 'bg-background border-border'
              )}
            >
              <div className="flex items-center gap-3 p-3">
                <div
                  className={cn(
                    'w-11 h-11 rounded-full flex items-center justify-center font-semibold text-sm shrink-0',
                    fromMe ? 'bg-white/25 text-white' : 'bg-[#25D366]/15 text-[#075E54]'
                  )}
                >
                  {initials || <User className="h-5 w-5" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p
                    className={cn(
                      'text-sm font-semibold truncate',
                      fromMe ? 'text-white' : 'text-foreground'
                    )}
                  >
                    {c.name}
                  </p>
                  {formattedPhone && (
                    <p
                      className={cn(
                        'text-xs truncate',
                        fromMe ? 'text-white/80' : 'text-muted-foreground'
                      )}
                    >
                      {formattedPhone}
                    </p>
                  )}
                </div>
              </div>
              <div
                className={cn(
                  'grid grid-cols-2 border-t text-xs font-medium',
                  fromMe ? 'border-white/15' : 'border-border'
                )}
              >
                <a
                  href={cleanPhone ? `https://wa.me/${cleanPhone}` : '#'}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (!cleanPhone) e.preventDefault();
                  }}
                  className={cn(
                    'flex items-center justify-center gap-1.5 py-2.5 transition-colors border-r',
                    fromMe ? 'border-white/15' : 'border-border',
                    cleanPhone
                      ? fromMe
                        ? 'text-white hover:bg-white/10'
                        : 'text-[#075E54] hover:bg-muted'
                      : 'opacity-40 cursor-not-allowed'
                  )}
                >
                  <MessageCircle className="h-3.5 w-3.5" />
                  WhatsApp
                </a>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    downloadVcard(c);
                  }}
                  className={cn(
                    'flex items-center justify-center gap-1.5 py-2.5 transition-colors',
                    fromMe
                      ? 'text-white hover:bg-white/10'
                      : 'text-foreground hover:bg-muted'
                  )}
                >
                  <UserPlus className="h-3.5 w-3.5" />
                  Salvar
                </button>
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  // === PLACEHOLDER (No URL) ===
  return (
    <div className="space-y-1">
      <div className={cn(
        "flex items-center gap-3 px-4 py-3 rounded-lg",
        fromMe 
          ? "bg-[#005c4b]/30" 
          : "bg-gray-100 dark:bg-gray-800"
      )}>
        <div className={cn(
          "w-10 h-10 rounded-full flex items-center justify-center",
          messageType === 'image' && "bg-emerald-500",
          messageType === 'video' && "bg-purple-500",
          (messageType === 'audio' || messageType === 'ptt') && "bg-[#25D366]",
          messageType === 'document' && "bg-red-500",
          messageType === 'sticker' && "bg-pink-500",
          messageType === 'location' && "bg-red-500",
          messageType === 'contact' && "bg-cyan-500",
          !['image', 'video', 'audio', 'ptt', 'document', 'sticker', 'location', 'contact'].includes(messageType) && "bg-gray-500"
        )}>
          <Icon className="h-5 w-5 text-white" />
        </div>
        <div>
          <p className="text-sm font-medium">{label}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Mídia não disponível
          </p>
        </div>
      </div>
      {mediaCaption && (
        <p className="text-sm whitespace-pre-wrap break-words mt-1">{mediaCaption.split(/(\s+)/).map((part, i) => {
          if (part.match(/^(https?:\/\/[^\s]+)$|^www\.[^\s]+$/i)) {
            const url = part.startsWith('http') ? part : `https://${part}`;
            return (
              <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="underline hover:no-underline break-all" onClick={(e) => e.stopPropagation()}>{part}</a>
            );
          }
          return part;
        })}</p>
      )}
      {content && content !== `[${label}]` && !content.startsWith('[') && (
        <p className="text-sm whitespace-pre-wrap break-words mt-1">{content.split(/(\s+)/).map((part, i) => {
          if (part.match(/^(https?:\/\/[^\s]+)$|^www\.[^\s]+$/i)) {
            const url = part.startsWith('http') ? part : `https://${part}`;
            return (
              <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="underline hover:no-underline break-all" onClick={(e) => e.stopPropagation()}>{part}</a>
            );
          }
          return part;
        })}</p>
      )}
    </div>
  );
};

export default WhatsAppMediaMessage;
