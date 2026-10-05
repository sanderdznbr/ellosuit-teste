import React, { useState } from 'react';
import { Sparkles, Thermometer, ClipboardList, RotateCw, Loader2, Check, X as XIcon, Pencil, Copy, Gauge, TrendingUp, TrendingDown, Minus, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

export interface SalesAIMessage {
  from_me: boolean;
  content: string;
  timestamp?: string;
}

interface Props {
  messages: SalesAIMessage[];
  contactName?: string;
  onUseSuggestion: (text: string) => void;
}

type Action = 'suggest_reply' | 'analyze_lead' | 'summary_next_steps' | 'follow_up' | 'lead_score';

const TITLES: Record<Action, string> = {
  suggest_reply: 'Sugestão de resposta',
  analyze_lead: 'Análise do lead',
  summary_next_steps: 'Resumo + próximos passos',
  follow_up: 'Follow-up para o lead',
  lead_score: 'Score do lead & estágio sugerido',
};

interface LeadScoreReason { label: string; impact: '+' | '-' | '='; weight: number; detail: string }
interface LeadScoreData {
  score: number; tier: string; temperature: number; intent: string;
  suggested_stage: string; confidence: number; reasons: LeadScoreReason[];
  next_action: string; stage_reason: string;
}

function tierColor(tier: string) {
  const t = (tier || '').toLowerCase();
  if (t.includes('muito')) return { bg: 'bg-rose-500', text: 'text-rose-500', ring: 'ring-rose-500/30' };
  if (t.includes('quente')) return { bg: 'bg-orange-500', text: 'text-orange-500', ring: 'ring-orange-500/30' };
  if (t.includes('morno')) return { bg: 'bg-amber-500', text: 'text-amber-500', ring: 'ring-amber-500/30' };
  return { bg: 'bg-sky-500', text: 'text-sky-500', ring: 'ring-sky-500/30' };
}

// minimal markdown → html (bold, italic, lists, line breaks, checkbox)
function renderMd(src: string): string {
  const esc = src
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  return esc
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/^- \[ \] (.*)$/gm, '<div class="flex gap-2 items-start my-1"><span class="mt-1 h-3.5 w-3.5 rounded border border-border shrink-0"></span><span>$1</span></div>')
    .replace(/^- \[x\] (.*)$/gim, '<div class="flex gap-2 items-start my-1"><span class="mt-1 h-3.5 w-3.5 rounded border border-primary bg-primary shrink-0"></span><span>$1</span></div>')
    .replace(/^- (.*)$/gm, '<div class="flex gap-2 items-start my-1"><span class="text-primary">•</span><span>$1</span></div>')
    .replace(/\n/g, '<br/>');
}

const SalesAIToolbar: React.FC<Props> = ({ messages, contactName, onUseSuggestion }) => {
  const { toast } = useToast();
  const [loadingAction, setLoadingAction] = useState<Action | null>(null);
  const [openAction, setOpenAction] = useState<Action | null>(null);
  const [result, setResult] = useState<string>('');
  const [structured, setStructured] = useState<LeadScoreData | null>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');

  const hasMessages = messages.some(m => m.content?.trim());

  const run = async (action: Action) => {
    if (!hasMessages) {
      toast({ title: 'Sem histórico', description: 'Esta conversa ainda não tem mensagens para analisar.' });
      return;
    }
    setLoadingAction(action);
    setOpenAction(action);
    setResult('');
    setStructured(null);
    setEditing(false);
    try {
      const { data, error } = await supabase.functions.invoke('crm-sales-ai', {
        body: { action, messages, contactName },
      });
      if (error) throw error;
      const text: string = data?.result || '';
      setResult(text);
      setDraft(text);
      if (action === 'lead_score' && data?.structured) setStructured(data.structured as LeadScoreData);
    } catch (e: any) {
      const msg = e?.message || 'Não foi possível gerar a resposta.';
      toast({ title: 'Erro da IA', description: msg, variant: 'destructive' });
      setOpenAction(null);
    } finally {
      setLoadingAction(null);
    }
  };

  const isSuggest = openAction === 'suggest_reply' || openAction === 'follow_up';
  const isScore = openAction === 'lead_score';

  return (
    <>
      <div className="flex items-center gap-1.5 px-3 py-2 border-t border-border/60 bg-card/60 backdrop-blur overflow-x-auto scrollbar-hide">
        <span className="flex items-center gap-1 text-[11px] font-semibold text-[#374DA4] shrink-0 mr-1">
          <Sparkles className="h-3.5 w-3.5" /> IA Vendas
        </span>
        <ToolbarBtn icon={<Sparkles className="h-3.5 w-3.5" />} label="Sugerir resposta"
          loading={loadingAction === 'suggest_reply'} onClick={() => run('suggest_reply')} primary />
        <ToolbarBtn icon={<Thermometer className="h-3.5 w-3.5" />} label="Analisar lead"
          loading={loadingAction === 'analyze_lead'} onClick={() => run('analyze_lead')} />
        <ToolbarBtn icon={<ClipboardList className="h-3.5 w-3.5" />} label="Resumo + próximos"
          loading={loadingAction === 'summary_next_steps'} onClick={() => run('summary_next_steps')} />
        <ToolbarBtn icon={<RotateCw className="h-3.5 w-3.5" />} label="Follow-up"
          loading={loadingAction === 'follow_up'} onClick={() => run('follow_up')} />
        <ToolbarBtn icon={<Gauge className="h-3.5 w-3.5" />} label="Score & estágio"
          loading={loadingAction === 'lead_score'} onClick={() => run('lead_score')} />
      </div>

      <Sheet open={!!openAction} onOpenChange={(o) => { if (!o) setOpenAction(null); }}>
        <SheetContent side="right" className="w-full sm:max-w-md flex flex-col p-0">
          <SheetHeader className="px-5 pt-5 pb-3 border-b">
            <SheetTitle className="flex items-center gap-2">
              <span className="h-7 w-7 rounded-full bg-gradient-to-br from-[#374DA4] to-[#5B33F0] flex items-center justify-center">
                <Sparkles className="h-3.5 w-3.5 text-white" />
              </span>
              {openAction ? TITLES[openAction] : ''}
            </SheetTitle>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto p-5">
            {loadingAction ? (
              <div className="flex flex-col items-center justify-center py-12 gap-3 text-muted-foreground">
                <Loader2 className="h-6 w-6 animate-spin text-[#374DA4]" />
                <span className="text-sm">Analisando conversa…</span>
              </div>
            ) : isSuggest ? (
              editing ? (
                <Textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  className="min-h-[200px] text-sm rounded-xl"
                  autoFocus
                />
              ) : (
                <div className="rounded-2xl border border-[#374DA4]/20 bg-[#374DA4]/5 p-4 text-sm whitespace-pre-wrap leading-relaxed">
                  {result}
                </div>
              )
            ) : isScore ? (
              structured ? <LeadScoreCard data={structured} /> : (
                <div className="prose prose-sm dark:prose-invert max-w-none text-sm leading-relaxed"
                  dangerouslySetInnerHTML={{ __html: renderMd(result) }} />
              )
            ) : (
              <div
                className="prose prose-sm dark:prose-invert max-w-none text-sm leading-relaxed"
                dangerouslySetInnerHTML={{ __html: renderMd(result) }}
              />
            )}
          </div>

          <div className="border-t p-4 flex items-center gap-2">
            {isSuggest ? (
              <>
                {editing ? (
                  <Button variant="outline" className="rounded-full" onClick={() => setEditing(false)}>
                    <XIcon className="h-4 w-4 mr-1" /> Cancelar edição
                  </Button>
                ) : (
                  <Button variant="outline" className="rounded-full" onClick={() => setEditing(true)} disabled={!result}>
                    <Pencil className="h-4 w-4 mr-1" /> Editar
                  </Button>
                )}
                <div className="flex-1" />
                <Button
                  className="rounded-full bg-[#374DA4] hover:bg-[#2400B5] text-white"
                  disabled={!draft.trim()}
                  onClick={() => {
                    onUseSuggestion(draft);
                    setOpenAction(null);
                    toast({ title: 'Pronto para enviar', description: 'Revise o texto no campo e clique enviar.' });
                  }}
                >
                  <Check className="h-4 w-4 mr-1" /> Usar resposta
                </Button>
              </>
            ) : (
              <>
                <Button
                  variant="outline"
                  className="rounded-full"
                  onClick={async () => {
                    await navigator.clipboard.writeText(result);
                    toast({ title: 'Copiado para a área de transferência' });
                  }}
                  disabled={!result}
                >
                  <Copy className="h-4 w-4 mr-1" /> Copiar
                </Button>
                <div className="flex-1" />
                <Button className="rounded-full" variant="ghost" onClick={() => setOpenAction(null)}>
                  Fechar
                </Button>
              </>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
};

const ToolbarBtn: React.FC<{
  icon: React.ReactNode; label: string; loading?: boolean; onClick: () => void; primary?: boolean;
}> = ({ icon, label, loading, onClick, primary }) => (
  <button
    onClick={onClick}
    disabled={loading}
    className={cn(
      'inline-flex items-center gap-1.5 h-7 px-3 rounded-full text-[11px] font-medium border shrink-0 transition-all',
      primary
        ? 'bg-[#374DA4] text-white border-[#374DA4] hover:bg-[#2400B5]'
        : 'bg-background/80 text-foreground border-border hover:border-[#374DA4] hover:text-[#374DA4]',
      loading && 'opacity-70 cursor-wait',
    )}
  >
    {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : icon}
    <span className="whitespace-nowrap">{label}</span>
  </button>
);

export default SalesAIToolbar;

const LeadScoreCard: React.FC<{ data: LeadScoreData }> = ({ data }) => {
  const c = tierColor(data.tier);
  const score = Math.max(0, Math.min(100, Number(data.score) || 0));
  const temp = Math.max(0, Math.min(100, Number(data.temperature) || 0));
  const conf = Math.max(0, Math.min(100, Number(data.confidence) || 0));
  return (
    <div className="space-y-4">
      {/* Score hero */}
      <div className={cn('rounded-2xl border p-4 ring-1', c.ring, 'border-border bg-gradient-to-br from-background to-muted/40')}>
        <div className="flex items-center gap-4">
          <div className="relative h-20 w-20 shrink-0">
            <svg viewBox="0 0 36 36" className="h-full w-full -rotate-90">
              <circle cx="18" cy="18" r="16" fill="none" stroke="currentColor" className="text-muted" strokeWidth="3" />
              <circle cx="18" cy="18" r="16" fill="none" stroke="currentColor"
                className={c.text} strokeWidth="3" strokeLinecap="round"
                strokeDasharray={`${(score / 100) * 100.53} 100.53`} />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-xl font-bold leading-none">{score}</span>
              <span className="text-[9px] text-muted-foreground">/100</span>
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={cn('inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold text-white', c.bg)}>
                <Thermometer className="h-3 w-3" /> {data.tier}
              </span>
              <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-medium border border-border bg-background">
                Intenção: <strong className="ml-0.5">{data.intent}</strong>
              </span>
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2 text-[11px]">
              <Meter label="Temperatura" value={temp} color={c.bg} />
              <Meter label="Confiança" value={conf} color="bg-[#374DA4]" />
            </div>
          </div>
        </div>
      </div>

      {/* Stage suggestion */}
      <div className="rounded-2xl border border-[#374DA4]/20 bg-[#374DA4]/5 p-4">
        <div className="flex items-center gap-2 text-[11px] uppercase tracking-wide text-[#374DA4] font-semibold">
          <ArrowRight className="h-3.5 w-3.5" /> Estágio sugerido
        </div>
        <div className="mt-1.5 text-base font-semibold">{data.suggested_stage}</div>
        <p className="mt-1 text-xs text-muted-foreground leading-relaxed">{data.stage_reason}</p>
      </div>

      {/* Reasons */}
      <div>
        <div className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold mb-2">
          Por que esse score
        </div>
        <div className="space-y-1.5">
          {(data.reasons || []).map((r, i) => (
            <ReasonRow key={i} reason={r} />
          ))}
        </div>
      </div>

      {/* Next action */}
      <div className="rounded-2xl border border-border bg-card p-4">
        <div className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold mb-1">
          Próxima ação
        </div>
        <p className="text-sm leading-relaxed">{data.next_action}</p>
      </div>
    </div>
  );
};

const Meter: React.FC<{ label: string; value: number; color: string }> = ({ label, value, color }) => (
  <div>
    <div className="flex items-center justify-between mb-0.5">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-semibold">{value}%</span>
    </div>
    <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
      <div className={cn('h-full rounded-full transition-all', color)} style={{ width: `${value}%` }} />
    </div>
  </div>
);

const ReasonRow: React.FC<{ reason: LeadScoreReason }> = ({ reason }) => {
  const Icon = reason.impact === '+' ? TrendingUp : reason.impact === '-' ? TrendingDown : Minus;
  const tone = reason.impact === '+' ? 'text-emerald-600 bg-emerald-500/10 border-emerald-500/20'
    : reason.impact === '-' ? 'text-rose-600 bg-rose-500/10 border-rose-500/20'
    : 'text-muted-foreground bg-muted border-border';
  const sign = reason.impact === '=' ? '±' : reason.impact;
  return (
    <div className="flex items-start gap-2.5 rounded-xl border border-border bg-background p-2.5">
      <span className={cn('mt-0.5 inline-flex items-center justify-center h-6 w-6 rounded-full border text-[10px] font-bold', tone)}>
        <Icon className="h-3 w-3" />
      </span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-semibold truncate">{reason.label}</span>
          <span className={cn('text-[10px] font-bold tabular-nums shrink-0', tone.split(' ')[0])}>{sign}{reason.weight}</span>
        </div>
        <p className="text-[11px] text-muted-foreground leading-snug mt-0.5">{reason.detail}</p>
      </div>
    </div>
  );
};