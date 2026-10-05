import React, { useEffect, useRef, useState } from 'react';
import { ArrowRight, Check, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SwipeToConfirmProps {
  onConfirm: () => void | Promise<void>;
  disabled?: boolean;
  loading?: boolean;
  label?: string;
  confirmedLabel?: string;
  color?: string; // hex for the fill gradient
}

/**
 * iOS-style swipe-to-confirm slider.
 * Drag the handle to the right end to fire onConfirm.
 */
const SwipeToConfirm: React.FC<SwipeToConfirmProps> = ({
  onConfirm,
  disabled = false,
  loading = false,
  label = 'Arraste para confirmar',
  confirmedLabel = 'Confirmado',
  color = '#374DA4',
}) => {
  const trackRef = useRef<HTMLDivElement>(null);
  const [dragX, setDragX] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const startXRef = useRef(0);
  const maxRef = useRef(0);

  const HANDLE = 48; // px

  const measureMax = () => {
    const w = trackRef.current?.clientWidth ?? 0;
    maxRef.current = Math.max(0, w - HANDLE - 4);
  };

  useEffect(() => { measureMax(); }, []);
  useEffect(() => {
    const on = () => measureMax();
    window.addEventListener('resize', on);
    return () => window.removeEventListener('resize', on);
  }, []);

  useEffect(() => {
    if (!dragging) return;
    const move = (e: PointerEvent) => {
      const delta = e.clientX - startXRef.current;
      setDragX(Math.max(0, Math.min(maxRef.current, delta)));
    };
    const up = async () => {
      setDragging(false);
      if (dragX >= maxRef.current - 4 && maxRef.current > 0) {
        setConfirmed(true);
        setDragX(maxRef.current);
        try { await onConfirm(); } finally {
          // caller controls unmount / reset; if still mounted, reset softly
          setTimeout(() => { setConfirmed(false); setDragX(0); }, 400);
        }
      } else {
        setDragX(0);
      }
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up, { once: true });
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
  }, [dragging, dragX, onConfirm]);

  const onPointerDown = (e: React.PointerEvent) => {
    if (disabled || loading || confirmed) return;
    measureMax();
    startXRef.current = e.clientX - dragX;
    setDragging(true);
  };

  const progress = maxRef.current > 0 ? dragX / maxRef.current : 0;
  const isActive = !disabled && !loading;

  return (
    <div
      ref={trackRef}
      className={cn(
        'relative h-14 w-full rounded-full overflow-hidden select-none',
        'bg-muted/60 ring-1 ring-border/60',
        !isActive && 'opacity-60 pointer-events-none',
      )}
    >
      {/* Filled progress */}
      <div
        className="absolute inset-y-0 left-0 rounded-full transition-[width] duration-100"
        style={{
          width: `${dragX + HANDLE / 2 + 2}px`,
          background: `linear-gradient(90deg, ${color} 0%, ${color}CC 100%)`,
        }}
      />

      {/* Label */}
      <div
        className="absolute inset-0 flex items-center justify-center pointer-events-none text-[13px] font-semibold tracking-wide transition-colors"
        style={{
          color: progress > 0.35 ? '#fff' : 'hsl(var(--muted-foreground))',
          opacity: confirmed ? 0 : Math.max(0.35, 1 - progress * 0.7),
        }}
      >
        {loading ? 'Salvando…' : label}
      </div>

      {/* Confirmed label */}
      {confirmed && (
        <div className="absolute inset-0 flex items-center justify-center text-[13px] font-semibold text-white">
          {loading ? 'Salvando…' : confirmedLabel}
        </div>
      )}

      {/* Shimmer hint arrows */}
      {!dragging && !confirmed && !loading && (
        <div
          className="absolute inset-y-0 flex items-center gap-0.5 pointer-events-none"
          style={{ left: `${HANDLE + 12}px`, opacity: Math.max(0, 0.5 - progress) }}
        >
          <ArrowRight className="h-3 w-3 text-white/80 animate-pulse" />
          <ArrowRight className="h-3 w-3 text-white/60 animate-pulse [animation-delay:150ms]" />
          <ArrowRight className="h-3 w-3 text-white/40 animate-pulse [animation-delay:300ms]" />
        </div>
      )}

      {/* Handle */}
      <button
        type="button"
        onPointerDown={onPointerDown}
        disabled={!isActive}
        aria-label={label}
        className={cn(
          'absolute top-1/2 -translate-y-1/2 h-12 w-12 rounded-full bg-white shadow-lg',
          'flex items-center justify-center touch-none',
          dragging ? 'cursor-grabbing' : 'cursor-grab',
          !dragging && 'transition-[left] duration-200 ease-out',
        )}
        style={{ left: `${dragX + 2}px` }}
      >
        {loading ? (
          <Loader2 className="h-5 w-5 animate-spin" style={{ color }} />
        ) : confirmed ? (
          <Check className="h-5 w-5" style={{ color }} />
        ) : (
          <ArrowRight className="h-5 w-5" style={{ color }} />
        )}
      </button>
    </div>
  );
};

export default SwipeToConfirm;