import React, { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import {
  Loader2, Send, Sparkles, MessageSquare, CheckCircle2,
  XCircle, Users, ArrowLeft, Lightbulb, Wand2, ArrowRight,
} from 'lucide-react';

interface Candidate {
  conversation_id: string;
  contact_name: string;
  contact_phone: string;
  session_id: string | null;
  last_message_at: string | null;
  reason: string;
  interest_score: number;
  suggested_message: string;
}

interface Idea {
  title: string;
  angle?: string;
  why?: string;
  target?: string;
  product?: string;
  offer?: string;
  goal?: string;
  tone?: string;
  extra?: string;
  estimated_leads?: number;
}

interface Props {
  companyId: string;
  onBack?: () => void;
}

type Phase = 'idle' | 'thinking' | 'ideas' | 'scanning' | 'review' | 'done';

const WhatsAppLeadRecovery: React.FC<Props> = ({ companyId, onBack }) => {
  const { toast } = useToast();
  const [phase, setPhase] = useState<Phase>('idle');
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [chosen, setChosen] = useState<Idea | null>(null);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [scanned, setScanned] = useState(0);
  const [approving, setApproving] = useState(false);
  const [sentCount, setSentCount] = useState(0);

  const generateIdeas = async () => {
    setPhase('thinking');
    setIdeas([]);
    setCandidates([]);
    setChosen(null);
    try {
      const { data, error } = await supabase.functions.invoke('crm-lead-recovery', {
        body: { action: 'ideas', companyId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      const list: Idea[] = data?.ideas || [];
      setIdeas(list);
      setPhase('ideas');
      if (list.length === 0) {
        toast({ title: 'Nenhuma conversa parada encontrada', description: 'Não há leads para recuperar agora.' });
      }
    } catch (e: any) {
      setPhase('idle');
      toast({ title: 'Erro ao analisar conversas', description: e?.message || 'Tente novamente', variant: 'destructive' });
    }
  };

  const runIdea = async (idea: Idea) => {
    setChosen(idea);
    setPhase('scanning');
    try {
      const { data, error } = await supabase.functions.invoke('crm-lead-recovery', {
        body: {
          action: 'scan',
          companyId,
          mode: 'campaign',
          daysBack: 60,
          minSilenceHours: 24,
          maxConversations: 60,
          campaign: {
            product: idea.product || idea.title,
            offer: idea.offer || '',
            goal: idea.goal || 'reengajar e vender',
            tone: idea.tone || 'cordial e direto',
            extra: [idea.angle, idea.target, idea.extra].filter(Boolean).join(' | '),
          },
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setCandidates(data?.candidates || []);
      setScanned(data?.scanned || 0);
      setPhase('review');
    } catch (e: any) {
      setPhase('ideas');
      toast({ title: 'Erro na análise', description: e?.message || 'Tente novamente', variant: 'destructive' });
    }
  };

  const authorize = async () => {
    if (candidates.length === 0) return;
    setApproving(true);
    try {
      const { data, error } = await supabase.functions.invoke('crm-lead-recovery', {
        body: {
          action: 'approve',
          companyId,
          items: candidates.map((c) => ({
            conversation_id: c.conversation_id,
            session_id: c.session_id,
            message: c.suggested_message,
            reason: c.reason,
          })),
          scheduleInHours: 0,
          respectBusinessHours: true,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setSentCount(data?.approved ?? candidates.length);
      setPhase('done');
    } catch (e: any) {
      toast({ title: 'Erro ao autorizar', description: e?.message || 'Tente novamente', variant: 'destructive' });
    } finally {
      setApproving(false);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto bg-background">
      <div className="max-w-5xl mx-auto px-4 md:px-8 py-6 md:py-10 space-y-8">
        {/* Header */}
        <div className="flex items-start gap-3">
          {onBack && (
            <Button variant="ghost" size="icon" onClick={onBack} className="mt-1">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          )}
          <div>
            <div className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#374DA4]">
              <Sparkles className="h-3.5 w-3.5" /> Recuperar Leads • IA
            </div>
            <h1 className="mt-2 text-2xl md:text-[28px] font-semibold text-foreground tracking-tight">
              Traga de volta quem ficou pra trás
            </h1>
            <p className="mt-1 text-sm text-muted-foreground max-w-2xl">
              A IA lê suas conversas, cria as ideias de recuperação sozinha e escreve cada mensagem.
              NADA é enviado sem sua conferência e aprovação manual.
            </p>
          </div>
        </div>

        {/* Start */}
        {(phase === 'idle' || phase === 'thinking') && (
          <div className="rounded-3xl border border-border/60 bg-card p-10 text-center">
            <Wand2 className="h-8 w-8 text-[#374DA4] mx-auto mb-4" />
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              Nenhuma configuração necessária. A IA analisa as conversas paradas e sugere as melhores
              estratégias de recuperação para o seu negócio.
            </p>
            <Button onClick={generateIdeas} disabled={phase === 'thinking'} className="mt-6 gap-2 bg-[#374DA4] hover:bg-[#2500B8]">
              {phase === 'thinking' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              {phase === 'thinking' ? 'Analisando conversas...' : 'Gerar ideias com IA'}
            </Button>
          </div>
        )}

        {/* Ideas */}
        {phase === 'ideas' && ideas.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-sm font-medium text-foreground inline-flex items-center gap-2">
                <Lightbulb className="h-4 w-4 text-[#374DA4]" /> Ideias criadas pela IA
              </div>
              <Button variant="ghost" size="sm" onClick={generateIdeas}>Gerar outras</Button>
            </div>
            {ideas.map((idea, i) => (
              <button
                key={i}
                onClick={() => runIdea(idea)}
                className="w-full text-left rounded-2xl border border-border/60 bg-card p-5 hover:border-[#374DA4]/50 transition-colors group"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-foreground">{idea.title}</div>
                    {idea.angle && <div className="mt-0.5 text-xs text-[#374DA4]">{idea.angle}</div>}
                    {idea.why && <p className="mt-2 text-[13px] text-muted-foreground leading-relaxed">{idea.why}</p>}
                    {idea.target && (
                      <p className="mt-1.5 text-xs text-muted-foreground">
                        <span className="font-medium text-foreground">Público:</span> {idea.target}
                      </p>
                    )}
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-[#374DA4] shrink-0 mt-1" />
                </div>
              </button>
            ))}
          </div>
        )}

        {phase === 'ideas' && ideas.length === 0 && (
          <div className="rounded-3xl border border-dashed border-border/70 bg-card/40 p-10 text-center">
            <XCircle className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">
              Não encontramos conversas paradas suficientes para gerar ideias agora.
            </p>
          </div>
        )}

        {/* Scanning */}
        {phase === 'scanning' && (
          <div className="rounded-3xl border border-border/60 bg-card p-10 text-center">
            <Loader2 className="h-7 w-7 text-[#374DA4] mx-auto mb-4 animate-spin" />
            <p className="text-sm text-foreground font-medium">{chosen?.title}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              A IA está lendo as conversas e escrevendo uma mensagem para cada lead...
            </p>
          </div>
        )}

        {/* Review */}
        {phase === 'review' && (
          <div className="space-y-4">
            <div className="rounded-2xl border border-[#374DA4]/30 bg-[#374DA4]/[0.04] p-5 flex items-start justify-between gap-4 flex-wrap">
              <div>
                <div className="text-sm font-semibold text-foreground">{chosen?.title}</div>
                <div className="mt-1 text-xs text-muted-foreground inline-flex items-center gap-1.5">
                  <Users className="h-3.5 w-3.5" /> {scanned} conversa(s) analisada(s) • {candidates.length} lead(s) recuperável(is)
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => setPhase('ideas')}>Voltar às ideias</Button>
                <Button onClick={authorize} disabled={approving || candidates.length === 0} className="gap-2 bg-[#374DA4] hover:bg-[#2500B8]">
                  {approving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  Confirmar e Enviar ({candidates.length})
                </Button>
              </div>
            </div>

            {candidates.map((c) => (
              <div key={c.conversation_id} className="rounded-2xl border border-border/60 bg-card p-4 md:p-5">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-foreground truncate">{c.contact_name}</div>
                    <div className="text-xs text-muted-foreground">{c.contact_phone}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] uppercase tracking-wider font-medium text-muted-foreground">Interesse</span>
                    <span className={`text-sm font-semibold tabular-nums ${
                      c.interest_score >= 70 ? 'text-emerald-600' : c.interest_score >= 40 ? 'text-amber-600' : 'text-muted-foreground'
                    }`}>{c.interest_score}%</span>
                  </div>
                </div>
                {c.reason && (
                  <p className="mt-2 text-[13px] text-muted-foreground leading-relaxed">
                    <span className="font-medium text-foreground">Motivo:</span> {c.reason}
                  </p>
                )}
                <div className="mt-3 rounded-xl bg-muted/40 border border-border/50 p-3">
                  <div className="text-[11px] uppercase tracking-wider text-muted-foreground flex items-center gap-1.5 mb-1.5">
                    <MessageSquare className="h-3 w-3" /> Mensagem criada pela IA
                  </div>
                  <p className="text-[13.5px] text-foreground whitespace-pre-wrap leading-relaxed">{c.suggested_message}</p>
                </div>
              </div>
            ))}

            {candidates.length === 0 && (
              <div className="rounded-3xl border border-dashed border-border/70 bg-card/40 p-10 text-center">
                <XCircle className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">Nenhum lead compatível com essa ideia. Tente outra.</p>
              </div>
            )}
          </div>
        )}

        {/* Done */}
        {phase === 'done' && (
          <div className="rounded-3xl border border-border/60 bg-card p-10 text-center">
            <CheckCircle2 className="h-8 w-8 text-emerald-600 mx-auto mb-3" />
            <p className="text-sm font-medium text-foreground">{sentCount} recuperação(ões) confirmada(s)</p>
            <p className="mt-1 text-sm text-muted-foreground">
              O envio começa agora, respeitando o horário comercial (8h–20h). Se o cliente responder antes, o disparo é cancelado automaticamente.
            </p>
            <Button variant="outline" className="mt-6" onClick={generateIdeas}>Gerar novas ideias</Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default WhatsAppLeadRecovery;
