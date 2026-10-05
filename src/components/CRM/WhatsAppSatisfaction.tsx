import React, { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import {
  RefreshCw, TrendingUp, TrendingDown, Minus,
  ArrowUpRight, ArrowDownRight, Loader2, Gauge, Lightbulb, Sparkles,
} from 'lucide-react';
import WhatsAppLeadRecovery from './WhatsAppLeadRecovery';

interface Topic {
  label: string;
  rate: number;
  type: 'gain' | 'loss' | 'neutral';
  insight: string;
}

interface Analysis {
  overall_score?: number;
  sentiment?: 'positivo' | 'neutro' | 'negativo';
  summary?: string;
  topics?: Topic[];
  gains?: string[];
  losses?: string[];
  recommendations?: string[];
  analyzed_conversations?: number;
  generated_at?: string;
  empty?: boolean;
  message?: string;
}

interface Props {
  companyId: string;
}

const TWELVE_HOURS_MS = 12 * 60 * 60 * 1000;

const WhatsAppSatisfaction: React.FC<Props> = ({ companyId }) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [data, setData] = useState<Analysis | null>(null);
  const [view, setView] = useState<'satisfaction' | 'recovery'>('satisfaction');
  const triggeredRef = useRef(false);

  const runAnalysis = useCallback(async (force = false) => {
    if (!companyId) return;
    setLoading(true);
    try {
      const { data: res, error } = await supabase.functions.invoke('crm-satisfaction-ai', {
        body: { companyId, limit: 60, force },
      });
      if (error) throw error;
      if (res?.error) throw new Error(res.error);
      setData(res);
    } catch (e: any) {
      toast({ title: 'Erro na análise', description: e?.message || 'Tente novamente', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [companyId, toast]);

  // Load latest from DB; if missing or stale (>12h), trigger a fresh analysis automatically
  useEffect(() => {
    if (!companyId || triggeredRef.current) return;
    triggeredRef.current = true;
    (async () => {
      try {
        const { data: latest } = await supabase
          .from('crm_satisfaction_analyses')
          .select('*')
          .eq('company_id', companyId)
          .order('generated_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (latest) {
          setData({
            ...(latest.data as any),
            analyzed_conversations: latest.analyzed_conversations,
            generated_at: latest.generated_at,
          });
          const age = Date.now() - new Date(latest.generated_at).getTime();
          if (age >= TWELVE_HOURS_MS) {
            runAnalysis(false);
          }
        } else {
          await runAnalysis(false);
        }
      } catch (e) {
        console.error('load satisfaction failed', e);
        await runAnalysis(false);
      } finally {
        setInitialLoading(false);
      }
    })();
  }, [companyId, runAnalysis]);

  const score = Math.max(0, Math.min(100, Math.round(data?.overall_score ?? 0)));
  const scoreColor = score >= 75 ? '#10b981' : score >= 50 ? '#f59e0b' : '#ef4444';
  const generated = data?.generated_at ? new Date(data.generated_at).toLocaleString('pt-BR') : null;
  const nextRun = data?.generated_at
    ? new Date(new Date(data.generated_at).getTime() + TWELVE_HOURS_MS).toLocaleString('pt-BR')
    : null;

  if (view === 'recovery') {
    return <WhatsAppLeadRecovery companyId={companyId} onBack={() => setView('satisfaction')} />;
  }

  return (
    <div className="flex-1 overflow-y-auto bg-background">
      <div className="max-w-6xl mx-auto px-4 md:px-8 py-6 md:py-10 space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#374DA4]">
              Satisfação • IA
            </div>
            <h1 className="mt-2 text-2xl md:text-[28px] font-semibold text-foreground tracking-tight">
              Análise de ganhos e perdas
            </h1>
            <p className="mt-1 text-sm text-muted-foreground max-w-xl">
              A IA lê suas conversas reais e descobre, sozinha, quais indicadores importam para o seu negócio.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {loading && (
              <div className="inline-flex items-center gap-2 h-9 px-4 rounded-full bg-muted/60 text-[12px] font-medium text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Atualizando análise...
              </div>
            )}
            <button
              onClick={() => setView('recovery')}
              className="inline-flex items-center gap-2 h-9 px-4 rounded-full bg-[#374DA4] text-white text-[12px] font-semibold hover:bg-[#2500B8] transition-colors"
            >
              <Sparkles className="h-3.5 w-3.5" />
              Recuperar leads
            </button>
          </div>
        </div>

        {generated && (
          <div className="text-[11px] text-muted-foreground -mt-4 flex flex-wrap items-center gap-x-3 gap-y-1">
            <span>Última análise: {generated}</span>
            <span className="opacity-40">•</span>
            <span>{data?.analyzed_conversations || 0} conversas</span>
            {nextRun && (
              <>
                <span className="opacity-40">•</span>
                <span className="inline-flex items-center gap-1">
                  <RefreshCw className="h-3 w-3" /> Próxima atualização automática: {nextRun}
                </span>
              </>
            )}
          </div>
        )}

        {data?.empty && (
          <div className="rounded-3xl border border-border/60 bg-card p-10 text-center">
            <p className="text-sm text-muted-foreground">{data.message}</p>
          </div>
        )}

        {(initialLoading || (loading && !data)) && <SkeletonGrid />}

        {!initialLoading && !loading && !data && (
          <div className="rounded-3xl border border-dashed border-border/70 bg-card/40 p-10 text-center">
            <p className="text-sm text-muted-foreground">
              Sem dados de satisfação ainda. A análise será gerada automaticamente assim que houver conversas suficientes.
            </p>
          </div>
        )}

        {data && !data.empty && (
          <>
            {/* Score + Summary */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
              <div className="lg:col-span-1 rounded-3xl border border-border/60 bg-card p-6 flex flex-col items-center justify-center">
                <ScoreRing value={score} color={scoreColor} />
                <div className="mt-4 text-[11px] uppercase tracking-[0.14em] font-semibold text-muted-foreground">
                  Score de satisfação
                </div>
                <div className="mt-1.5 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-muted/60 text-[12px] font-medium capitalize">
                  <SentimentIcon s={data.sentiment} />
                  {data.sentiment || 'neutro'}
                </div>
              </div>
              <div className="lg:col-span-2 rounded-3xl border border-border/60 bg-card p-6 md:p-7">
                <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.14em] font-semibold text-muted-foreground">
                  <Gauge className="h-3.5 w-3.5" /> Resumo executivo
                </div>
                <p className="mt-3 text-[15px] leading-relaxed text-foreground">
                  {data.summary || 'Nenhum resumo gerado.'}
                </p>
              </div>
            </div>

            {/* Dynamic topics */}
            {data.topics && data.topics.length > 0 && (
              <section>
                <SectionTitle>Indicadores descobertos pela IA</SectionTitle>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {data.topics.map((t, i) => <TopicCard key={i} topic={t} />)}
                </div>
              </section>
            )}

            {/* Gains / Losses */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <ListCard
                title="Ganhos"
                items={data.gains || []}
                icon={<TrendingUp className="h-4 w-4" />}
                accent="#10b981"
                emptyLabel="Nenhum ganho evidente ainda."
              />
              <ListCard
                title="Perdas / Atritos"
                items={data.losses || []}
                icon={<TrendingDown className="h-4 w-4" />}
                accent="#ef4444"
                emptyLabel="Nenhuma perda relevante identificada."
              />
            </div>

            {/* Recommendations */}
            {data.recommendations && data.recommendations.length > 0 && (
              <section className="rounded-3xl border border-border/60 bg-card p-6 md:p-7">
                <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.14em] font-semibold text-muted-foreground">
                  <Lightbulb className="h-3.5 w-3.5" /> Recomendações
                </div>
                <ul className="mt-4 space-y-3">
                  {data.recommendations.map((r, i) => (
                    <li key={i} className="flex gap-3 text-[14px] leading-relaxed text-foreground">
                      <span className="mt-2 h-1.5 w-1.5 rounded-full bg-[#374DA4] flex-shrink-0" />
                      <span>{r}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </>
        )}
      </div>
    </div>
  );
};

/* ---------- pieces ---------- */

const SectionTitle: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="mb-4 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
    {children}
  </div>
);

const SentimentIcon: React.FC<{ s?: string }> = ({ s }) => {
  if (s === 'positivo') return <ArrowUpRight className="h-3.5 w-3.5 text-emerald-500" />;
  if (s === 'negativo') return <ArrowDownRight className="h-3.5 w-3.5 text-red-500" />;
  return <Minus className="h-3.5 w-3.5 text-muted-foreground" />;
};

const ScoreRing: React.FC<{ value: number; color: string }> = ({ value, color }) => {
  const size = 148;
  const stroke = 12;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - (value / 100) * c;
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} strokeWidth={stroke} className="stroke-muted" fill="none" />
        <circle
          cx={size / 2} cy={size / 2} r={r} strokeWidth={stroke}
          stroke={color} fill="none" strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 0.9s cubic-bezier(.22,1,.36,1)' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-4xl font-semibold tabular-nums text-foreground">{value}</span>
        <span className="text-[11px] text-muted-foreground">/ 100</span>
      </div>
    </div>
  );
};

const TopicCard: React.FC<{ topic: Topic }> = ({ topic }) => {
  const rate = Math.max(0, Math.min(100, Math.round(topic.rate)));
  const isGain = topic.type === 'gain';
  const isLoss = topic.type === 'loss';
  const accent = isGain ? '#10b981' : isLoss ? '#ef4444' : '#374DA4';
  return (
    <div className="group rounded-3xl border border-border/60 bg-card p-5 hover:border-border transition-colors">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[13px] font-semibold text-foreground line-clamp-2">{topic.label}</div>
          <div className="mt-0.5 text-[11px] uppercase tracking-wider font-medium" style={{ color: accent }}>
            {isGain ? 'Ganho' : isLoss ? 'Perda' : 'Observação'}
          </div>
        </div>
        <div className="text-right">
          <div className="text-[26px] font-semibold tabular-nums leading-none" style={{ color: accent }}>
            {rate}<span className="text-[14px] font-medium text-muted-foreground">%</span>
          </div>
        </div>
      </div>
      <div className="mt-4 h-1.5 rounded-full bg-muted overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${rate}%`, backgroundColor: accent }}
        />
      </div>
      {topic.insight && (
        <p className="mt-3 text-[12.5px] leading-relaxed text-muted-foreground">{topic.insight}</p>
      )}
    </div>
  );
};

const ListCard: React.FC<{ title: string; items: string[]; icon: React.ReactNode; accent: string; emptyLabel: string }> = ({
  title, items, icon, accent, emptyLabel,
}) => (
  <div className="rounded-3xl border border-border/60 bg-card p-6">
    <div className="flex items-center gap-2 text-[13px] font-semibold" style={{ color: accent }}>
      {icon}<span>{title}</span>
      <span className="ml-auto text-[11px] font-medium text-muted-foreground tabular-nums">{items.length}</span>
    </div>
    {items.length === 0 ? (
      <p className="mt-4 text-[13px] text-muted-foreground">{emptyLabel}</p>
    ) : (
      <ul className="mt-4 space-y-3">
        {items.map((it, i) => (
          <li key={i} className="flex gap-3 text-[13.5px] leading-relaxed text-foreground">
            <span className="mt-2 h-1.5 w-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: accent }} />
            <span>{it}</span>
          </li>
        ))}
      </ul>
    )}
  </div>
);

const SkeletonGrid: React.FC = () => (
  <div className="space-y-5">
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
      <div className="h-56 rounded-3xl bg-muted/40 animate-pulse" />
      <div className="lg:col-span-2 h-56 rounded-3xl bg-muted/40 animate-pulse" />
    </div>
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="h-40 rounded-3xl bg-muted/40 animate-pulse" />
      ))}
    </div>
  </div>
);

export default WhatsAppSatisfaction;