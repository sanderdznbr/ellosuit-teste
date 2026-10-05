import React, { useEffect, useRef, useState } from 'react';
import { Loader2, RefreshCw, Sparkles } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import {
  LeadScoreData,
  computeSig,
  getCachedLeadScore,
  scoreConversation,
  tierStyle,
} from '@/lib/leadScore';

interface Props {
  conversationId: string;
  contactName?: string;
  lastMessage?: string;
  lastMessageAt?: string;
  size?: 'sm' | 'xs';
  autoLoad?: boolean;
  onClickStop?: boolean;
  onScored?: (data: LeadScoreData | null) => void;
}

/**
 * Compact Lead Score IA badge with 🔥/🟡/🔵 tier + tooltip explaining reasons.
 * Auto-fetches when scrolled into view (unless already cached).
 */
const LeadScoreBadge: React.FC<Props> = ({
  conversationId,
  contactName,
  lastMessage,
  lastMessageAt,
  size = 'xs',
  autoLoad = true,
  onClickStop = true,
  onScored,
}) => {
  const sig = computeSig(lastMessageAt, lastMessage);
  const [data, setData] = useState<LeadScoreData | null>(() =>
    getCachedLeadScore(conversationId, sig)
  );
  useEffect(() => {
    if (onScored) onScored(data);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ref = useRef<HTMLSpanElement | null>(null);
  const visibleRef = useRef(false);

  const load = async (force = false) => {
    if (loading) return;
    setLoading(true);
    setError(null);
    try {
      const res = await scoreConversation({
        conversationId,
        contactName,
        lastMessage,
        sig,
        force,
      });
      setData(res);
      if (!res) setError('Sem dados suficientes');
    } catch (e: any) {
      setError(e?.message || 'Falha ao pontuar lead');
    } finally {
      setLoading(false);
    }
  };

  // Reset when signature changes (new message arrived)
  useEffect(() => {
    const cached = getCachedLeadScore(conversationId, sig);
    setData(cached);
    setError(null);
  }, [conversationId, sig]);

  // IntersectionObserver → autoload once visible
  useEffect(() => {
    if (!autoLoad) return;
    if (data) return;
    if (!ref.current) return;
    const el = ref.current;
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting && !visibleRef.current) {
            visibleRef.current = true;
            void load();
          }
        }
      },
      { rootMargin: '100px' }
    );
    io.observe(el);
    return () => io.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId, sig, autoLoad, data]);

  const style = data ? tierStyle(data.tier) : null;

  const sizing =
    size === 'sm'
      ? 'text-[11px] px-2 py-0.5 gap-1'
      : 'text-[10px] px-1.5 py-0.5 gap-0.5';

  const stopIfNeeded = (e: React.SyntheticEvent) => {
    if (onClickStop) {
      e.stopPropagation();
      e.preventDefault();
    }
  };

  const trigger = (
    <span
      ref={ref}
      role="button"
      tabIndex={0}
      onClick={(e) => {
        stopIfNeeded(e);
        void load(!!data);
      }}
      onPointerDown={stopIfNeeded}
      className={cn(
        'inline-flex items-center rounded-full cursor-pointer select-none transition-colors',
        data && style
          ? 'gap-1 px-1.5 py-0.5 text-[10px] font-medium'
          : 'h-5 px-1.5 text-[10px] font-medium text-muted-foreground bg-black/[0.04] dark:bg-white/[0.05] hover:bg-black/[0.07] dark:hover:bg-white/[0.08]',
        data && style ? `${style.text} ${style.bg}` : ''
      )}
      title={data ? undefined : 'Lead Score IA'}
    >
      {loading && !data ? (
        <Loader2 className="h-2.5 w-2.5 animate-spin" />
      ) : data && style ? (
        <>
          <span className={cn('h-1.5 w-1.5 rounded-full', style.dot)} aria-hidden />
          <span className="tabular-nums">{data.score}</span>
        </>
      ) : (
        <>
          <Sparkles className="h-2.5 w-2.5" />
          <span>IA</span>
        </>
      )}
    </span>
  );

  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>{trigger}</TooltipTrigger>
        <TooltipContent
          side="top"
          align="center"
          sideOffset={8}
          collisionPadding={16}
          className="w-[280px] max-w-[calc(100vw-24px)] p-0 overflow-hidden border-border/60 bg-popover text-popover-foreground shadow-xl"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        >
          {data && style ? (
            <div className="w-[280px]">
              <div className={cn('flex items-center gap-2 px-3 py-2 border-b border-border/60', style.bg)}>
                <span className="text-lg leading-none" aria-hidden>
                  {style.emoji}
                </span>
                <div className="flex-1 min-w-0">
                  <div className={cn('text-[11px] font-bold uppercase tracking-wide', style.text)}>
                    {data.tier || style.label}
                  </div>
                  <div className="text-[10.5px] text-muted-foreground">
                    Intenção {data.intent} · confiança {data.confidence}%
                  </div>
                </div>
                <div className={cn('text-lg font-bold tabular-nums', style.text)}>{data.score}</div>
              </div>
              {data.reasons?.length > 0 && (
                <ul className="px-3 py-2 space-y-1.5">
                  {data.reasons.slice(0, 5).map((r, i) => (
                    <li key={i} className="flex items-start gap-2 text-[11.5px] leading-snug">
                      <span
                        className={cn(
                          'mt-[3px] inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px] font-bold',
                          r.impact === '+'
                            ? 'bg-emerald-500/15 text-emerald-600'
                            : r.impact === '-'
                            ? 'bg-rose-500/15 text-rose-600'
                            : 'bg-muted text-muted-foreground'
                        )}
                      >
                        {r.impact}
                      </span>
                      <div className="min-w-0">
                        <div className="font-semibold text-foreground">{r.label}</div>
                        <div className="text-muted-foreground">{r.detail}</div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              {data.next_action && (
                <div className="px-3 py-2 border-t border-border/60 bg-[#374DA4]/5">
                  <div className="text-[10px] font-bold uppercase tracking-wide text-[#374DA4]">
                    Próxima ação
                  </div>
                  <p className="text-[11.5px] leading-snug text-foreground mt-0.5">
                    {data.next_action}
                  </p>
                </div>
              )}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  void load(true);
                }}
                className="w-full flex items-center justify-center gap-1.5 text-[10.5px] font-medium text-muted-foreground hover:text-foreground py-1.5 border-t border-border/60 bg-muted/30"
              >
                <RefreshCw className={cn('h-3 w-3', loading && 'animate-spin')} />
                Reanalisar
              </button>
            </div>
          ) : (
            <div className="px-3 py-2 text-[11.5px] text-muted-foreground">
              {loading ? 'Analisando conversa…' : error || 'Toque para pontuar este lead com IA'}
            </div>
          )}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

export default LeadScoreBadge;