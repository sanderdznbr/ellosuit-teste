import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Play, Pause, Mic } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AudioPlayerBubbleProps {
  url: string;
  fromMe: boolean;
}

const formatTime = (s: number) => {
  if (!isFinite(s) || s < 0) return '0:00';
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, '0')}`;
};

const AudioPlayerBubble: React.FC<AudioPlayerBubbleProps> = ({ url, fromMe }) => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [dragging, setDragging] = useState(false);
  const barRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onLoaded = () => setDuration(audio.duration);
    const onTime = () => { if (!dragging) setCurrentTime(audio.currentTime); };
    const onEnd = () => { setPlaying(false); setCurrentTime(0); };
    audio.addEventListener('loadedmetadata', onLoaded);
    audio.addEventListener('timeupdate', onTime);
    audio.addEventListener('ended', onEnd);
    return () => {
      audio.removeEventListener('loadedmetadata', onLoaded);
      audio.removeEventListener('timeupdate', onTime);
      audio.removeEventListener('ended', onEnd);
    };
  }, [dragging]);

  const togglePlay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) { audio.pause(); } else { audio.play(); }
    setPlaying(!playing);
  }, [playing]);

  const seek = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const bar = barRef.current;
    const audio = audioRef.current;
    if (!bar || !audio || !duration) return;
    const rect = bar.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    audio.currentTime = pct * duration;
    setCurrentTime(audio.currentTime);
  }, [duration]);

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  // Generate waveform bars (static visual)
  const bars = 28;
  const waveform = useRef(
    Array.from({ length: bars }, (_, i) => {
      const x = i / bars;
      return 0.3 + 0.7 * Math.abs(Math.sin(x * 8 + i * 0.7)) * (0.5 + 0.5 * Math.random());
    })
  ).current;

  return (
    <div className="flex items-center gap-3 min-w-[260px] max-w-[320px]">
      <audio ref={audioRef} src={url} preload="metadata" />

      {/* Mic icon */}
      <div className={cn(
        "h-10 w-10 rounded-full flex items-center justify-center flex-shrink-0 shadow-sm",
        fromMe ? "bg-white/25" : "bg-[#374DA4]/10"
      )}>
        <Mic className={cn("h-5 w-5", fromMe ? "text-white" : "text-[#374DA4]")} />
      </div>

      {/* Play/Pause button */}
      <button
        onClick={togglePlay}
        className={cn(
          "h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0 transition-transform active:scale-90",
          fromMe ? "bg-white/25 hover:bg-white/35 text-white" : "bg-[#374DA4]/10 hover:bg-[#374DA4]/20 text-[#374DA4]"
        )}
      >
        {playing
          ? <Pause className="h-4 w-4 fill-current" />
          : <Play className="h-4 w-4 fill-current ml-0.5" />}
      </button>

      {/* Waveform + time */}
      <div className="flex-1 min-w-0 flex flex-col gap-1">
        <div
          ref={barRef}
          className="h-7 flex items-center gap-[2px] cursor-pointer"
          onClick={seek}
        >
          {waveform.map((h, i) => {
            const barPct = (i / bars) * 100;
            const active = barPct < progress;
            return (
              <div
                key={i}
                className={cn(
                  "flex-1 rounded-full transition-colors duration-150",
                  active
                    ? fromMe ? "bg-white" : "bg-[#374DA4]"
                    : fromMe ? "bg-white/30" : "bg-[#374DA4]/25"
                )}
                style={{ height: `${h * 100}%`, minWidth: 2 }}
              />
            );
          })}
        </div>
        <div className={cn(
          "flex justify-between text-[10px] font-mono leading-none",
          fromMe ? "text-white/70" : "text-muted-foreground"
        )}>
          <span>{formatTime(currentTime)}</span>
          <span>{formatTime(duration)}</span>
        </div>
      </div>
    </div>
  );
};

export default AudioPlayerBubble;
