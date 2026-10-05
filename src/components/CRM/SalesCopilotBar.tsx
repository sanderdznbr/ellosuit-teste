import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Sparkles, Flame, Loader2, RefreshCw, ArrowRight, Send, ChevronDown, ChevronUp, Copy, AlertCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

export interface CopilotMsg { from_me: boolean; content: string; timestamp?: string }

interface CopilotData {
  tier: string;
  temperature: number;
  score: number;
  intent: string;
  urgency: 'baixa' | 'media' | 'alta';
  hot: boolean;
  stage: string;
  headline: string;
  signals: string[];
  objection: string | null;
  next_action: string;
  suggested_reply: string;
  confidence: number;
}

interface Props {
  conversationId: string;
  messages: CopilotMsg[];
  contactName?: string;
  onUseSuggestion: (text: string) => void;
  autoRun?: boolean;
}

const CACHE_TTL_MS = 5 * 60 * 1000;
const cacheKey = (id: string) => `salesCopilot:${id}`;

function tierStyle(tier: string) {
  const t = (tier || '').toLowerCase();
  if (t.includes('muito')) return { bg: 'from-rose-500 to-red-600', ring: 'ring-rose-500/30', dot: 'bg-rose-500', text: 'text-rose-500', emoji: '🔥' };
  if (t.includes('quente')) return { bg: 'from-orange-500 to-amber-600', ring: 'ring-orange-500/30', dot: 'bg-orange-500', text: 'text-orange-500', emoji: '🔥' };
  if (t.includes('morno')) return { bg: 'from-amber-400 to-yellow-500', ring: 'ring-amber-400/30', dot: 'bg-amber-400', text: 'text-amber-500', emoji: '🟡' };
  return { bg: 'from-sky-500 to-[#2F428D]', ring: 'ring-sky-500/30', dot: 'bg-sky-500', text: 'text-sky-500', emoji: '🔵' };
}

const SalesCopilotBar: React.FC<Props> = ({ conversationId, messages, contactName, onUseSuggestion, autoRun = true }) => {
  const { toast } = useToast();
  const [data, setData] = useState<CopilotData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const ranForRef = useRef<string | null>(null);

  const hasMessages = useMemo(() => messages.some(m => m.content?.trim()), [messages]);
  const msgSig = useMemo(() => `${messages.length}:${messages[messages.length - 1]?.content?.slice(0, 40) || ''}`, [messages]);

  const analyze = async (force = false) => {
    if (!hasMessages) {
      setError('Sem histórico para analisar');
      return;
    }
    if (loading) return;

    if (!force) {
      try {
        const cached = sessionStorage.getItem(cacheKey(conversationId));
        if (cached) {
          const parsed = JSON.parse(cached);
          if (parsed.sig === msgSig && Date.now() - parsed.at < CACHE_TTL_MS) {
            setData(parsed.data);
            return;
          }
        }
      } catch {}
    }

    setLoading(true);
    setError(null);
    try {
      const { data: resp, error: err } = await supabase.functions.invoke('crm-sales-ai', {
        body: { action: 'copilot', messages, contactName },
      });
      if (err) throw err;
      const s = resp?.structured as CopilotData | undefined;
      if (!s) throw new Error('Resposta inválida do copiloto');
      setData(s);
      try {
        sessionStorage.setItem(cacheKey(conversationId), JSON.stringify({ sig: msgSig, at: Date.now(), data: s }));
      } catch {}
    } catch (e: any) {
      const msg = e?.message || 'Falha ao analisar conversa';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  // Auto-run once per conversation when it opens (or when messages change significantly)
  useEffect(() => {
    if (!autoRun || !conversationId || !hasMessages) return;
    if (ranForRef.current === conversationId) return;
    ranForRef.current = conversationId;
    setData(null);
    setError(null);
    setCollapsed(false);
    void analyze(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId, hasMessages]);

  if (!hasMessages && !data) return null;

  const style = data ? tierStyle(data.tier) : tierStyle('Frio');

  return (
    <div className={cn('mx-3 mb-2 rounded-2xl border border-border/60 bg-gradient-to-br from-background to-muted/30 overflow-hidden shadow-sm')}>
      {/* Header */}
      <button
        type="button"
        onClick={() => setCollapsed(c => !c)}
        className="w-full flex items-center gap-2.5 px-3.5 py-2.5 hover:bg-muted/30 transition-colors"
      >
        <span className={cn('h-7 w-7 rounded-full bg-gradient-to-br flex items-center justify-center shrink-0 shadow', style.bg)}>
          <Sparkles className="h-3.5 w-3.5 text-white" />
        </span>
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <span className="text-[11px] font-bold tracking-wide text-[#374DA4] uppercase">Copiloto</span>
          {data && (
            <>
              <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold text-white bg-gradient-to-br shrink-0', style.bg)}>
                {data.hot ? <Flame className="h-2.5 w-2.5" /> : <span>{style.emoji}</span>}
                {data.tier}
              </span>
              <span className="text-[10px] font-semibold tabular-nums text-muted-foreground shrink-0">{data.score}/100</span>
              <span className="text-xs text-foreground/80 truncate hidden sm:inline">{data.headline}</span>
            </>
          )}
          {loading && !data && (
            <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" /> analisando conversa…
            </span>
          )}
          {error && !data && !loading && (
            <span className="flex items-center gap-1.5 text-[11px] text-rose-500">
              <AlertCircle className="h-3 w-3" /> {error}
            </span>
          )}
        </div>
        <span
          role="button"
          onClick={(e) => { e.stopPropagation(); void analyze(true); }}
          className="h-6 w-6 rounded-md hover:bg-muted flex items-center justify-center text-muted-foreground"
          title="Reanalisar"
        >
          <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
        </span>
        {collapsed ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronUp className="h-4 w-4 text-muted-foreground" />}
      </button>

      {/* Body */}
      {!collapsed && data && (
        <div className="px-3.5 pb-3.5 pt-1 space-y-2.5">
          {/* Mobile headline */}
          <p className="text-[13px] leading-snug text-foreground sm:hidden">{data.headline}</p>

          {/* Signals */}
          {data.signals?.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {data.signals.slice(0, 4).map((s, i) => (
                <span key={i} className="inline-flex items-center gap-1 text-[10.5px] font-medium px-2 py-0.5 rounded-full bg-muted text-foreground/70 border border-border/50">
                  <span className={cn('h-1.5 w-1.5 rounded-full', style.dot)} /> {s}
                </span>
              ))}
              {data.objection && (
                <span className="inline-flex items-center gap-1 text-[10.5px] font-medium px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-600 border border-rose-500/20">
                  ⚠️ {data.objection}
                </span>
              )}
            </div>
          )}

          {/* Next action */}
          <div className="flex items-start gap-2 rounded-xl border border-[#374DA4]/20 bg-[#374DA4]/5 px-3 py-2">
            <ArrowRight className="h-3.5 w-3.5 text-[#374DA4] shrink-0 mt-0.5" />
            <div className="min-w-0">
              <div className="text-[10px] font-bold uppercase tracking-wide text-[#374DA4]">Próxima ação · {data.stage}</div>
              <p className="text-[12.5px] leading-snug text-foreground mt-0.5">{data.next_action}</p>
            </div>
          </div>

          {/* Suggested reply */}
          {data.suggested_reply && (
            <div className="rounded-xl border border-border bg-card p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Resposta sugerida</span>
                <span className="text-[10px] text-muted-foreground">confiança {data.confidence}%</span>
              </div>
              <p className="text-[13px] leading-relaxed whitespace-pre-wrap text-foreground">{data.suggested_reply}</p>
              <div className="flex gap-2 pt-1">
                <button
                  onClick={() => { onUseSuggestion(data.suggested_reply); toast({ title: 'Resposta colada', description: 'Revise e envie quando estiver pronto.' }); }}
                  className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full text-[11.5px] font-semibold bg-[#374DA4] text-white hover:bg-[#2400B5] transition-colors"
                >
                  <Send className="h-3.5 w-3.5" /> Usar resposta
                </button>
                <button
                  onClick={async () => { await navigator.clipboard.writeText(data.suggested_reply); toast({ title: 'Copiado' }); }}
                  className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full text-[11.5px] font-medium border border-border bg-background hover:bg-muted transition-colors"
                >
                  <Copy className="h-3.5 w-3.5" /> Copiar
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default SalesCopilotBar;