import { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  Brain,
  Building2,
  Calendar,
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  Flame,
  Gauge,
  Loader2,
  Mail,
  MessageSquare,
  Phone,
  RefreshCw,
  Send,
  Sparkles,
  Tag,
  Trash2,
  User,
  Wallet,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { formatBRL, relativeTime, TEMP_COLORS } from './FunnelKanban';
import { FunnelDeal, LocalDeal } from './types';
import { FunnelData, isFrioAt, StageView } from './useFunnelData';
import { useTeamMembers } from './useFunis';

const TEMPS = ['frio', 'morno', 'quente', 'negociando', 'pagou', 'perdido'];

export interface LeadTarget {
  /** id da conversa no CRM ou do lead local. */
  id: string;
  kind: 'crm' | 'local';
}

interface AiMsg {
  from_me: boolean;
  content: string;
  timestamp?: string;
}

interface CopilotData {
  tier?: string;
  temperature?: number;
  score?: number;
  intent?: string;
  urgency?: string;
  hot?: boolean;
  stage?: string;
  headline?: string;
  signals?: string[];
  objection?: string | null;
  next_action?: string;
  suggested_reply?: string;
  confidence?: number;
}

/**
 * Modal do lead: todas as abas em um lugar só — dados, negociação, conversa,
 * análise com IA e ações — com navegação entre os leads da lista.
 */
export function LeadModal({
  data,
  target,
  onClose,
  onNavigate,
  onOpenCRM,
}: {
  data: FunnelData;
  target: LeadTarget;
  onClose: () => void;
  /** Vai para o lead anterior (-1) ou seguinte (+1) dentro da lista aberta. */
  onNavigate: (dir: -1 | 1) => void;
  onOpenCRM: () => void;
}) {
  const { toast } = useToast();
  const { funnel, rows, stages, isCrmPipeline, companyId, deals, localDeals } = data;
  const { members } = useTeamMembers(companyId);

  const crmLead = target.kind === 'crm' ? rows.find((r) => r.id === target.id) : null;
  const localLead =
    target.kind === 'local' ? localDeals.find((d) => d.id === target.id) : null;
  const deal: Partial<FunnelDeal & LocalDeal> =
    target.kind === 'crm' ? deals[target.id] || {} : localLead || {};

  const name =
    target.kind === 'crm'
      ? deal.contact || crmLead?.contact_name || crmLead?.contact_phone || 'Lead'
      : deal.contact || deal.name || 'Lead';
  const phone = target.kind === 'crm' ? crmLead?.contact_phone : deal.phone;
  /**
   * A etapa mostrada no seletor é a COLUNA que exibe o lead: numa etapa
   * compartilhada o lead mora na etapa de origem, mas quem o mostra aqui é a
   * coluna compartilhada.
   */
  const dataStageId =
    target.kind === 'crm' ? crmLead?.pipeline_stage || '' : deal.stageId || '';
  const stageId = data.displayStageIdOf(dataStageId) || dataStageId;
  const stage = stages.find((s) => s.id === stageId);
  const temp = deal.temperature || crmLead?.temperature_stage || null;

  const patch = (p: Partial<FunnelDeal & LocalDeal>) => {
    if (target.kind === 'crm') data.setDeal(target.id, p);
    else data.setLocalDeal(target.id, p);
  };

  /* ─── Conversa (IA + histórico) ──────────────────────────── */
  const [messages, setMessages] = useState<AiMsg[]>([]);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [aiResult, setAiResult] = useState('');
  const [aiAction, setAiAction] = useState<string | null>(null);
  const [copilot, setCopilot] = useState<CopilotData | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

  useEffect(() => {
    if (target.kind !== 'crm') {
      setMessages([]);
      return;
    }
    let cancelled = false;
    setLoadingMsgs(true);
    supabase
      .from('whatsapp_messages')
      .select('from_me, content, timestamp, media_type')
      .eq('conversation_id', target.id)
      .order('timestamp', { ascending: true })
      .limit(200)
      .then(({ data: rowsData }) => {
        if (cancelled) return;
        setMessages(
          ((rowsData || []) as unknown as AiMsg[]).filter(
            (m) => m.content && m.content.trim(),
          ),
        );
        setLoadingMsgs(false);
      });
    return () => {
      cancelled = true;
    };
  }, [target.id, target.kind]);

  const runAi = async (action: string) => {
    if (!messages.length) {
      toast({
        title: 'Sem histórico',
        description: 'Este lead ainda não tem mensagens para analisar.',
        variant: 'destructive',
      });
      return;
    }
    setAiAction(action);
    setAiLoading(true);
    setAiResult('');
    try {
      const { data: resp, error } = await supabase.functions.invoke('crm-sales-ai', {
        body: { action, messages, contactName: name },
      });
      if (error) throw error;
      const text: string = (resp as { result?: string })?.result || '';
      setAiResult(text);
      if (action === 'copilot') setCopilot((resp as { structured?: CopilotData })?.structured || null);
      if (action === 'analyze_lead' || action === 'lead_score') {
        const structured = (resp as { structured?: CopilotData })?.structured;
        if (structured) setCopilot(structured);
      }
    } catch (e) {
      toast({
        title: 'Erro da IA',
        description: e instanceof Error ? e.message : 'Não foi possível gerar a análise.',
        variant: 'destructive',
      });
    } finally {
      setAiLoading(false);
    }
  };

  /* ─── Etiquetas ──────────────────────────────────────────── */
  const [tagDraft, setTagDraft] = useState('');
  const tags = deal.tags || [];
  const addTag = () => {
    const t = tagDraft.trim();
    if (!t || tags.includes(t)) return;
    patch({ tags: [...tags, t] });
    setTagDraft('');
  };

  const assign = (userId: string) => {
    if (!userId) {
      patch({ owner: undefined, ownerId: undefined });
      if (target.kind === 'crm') {
        void supabase
          .from('whatsapp_conversations')
          .update({ assigned_user_id: null })
          .eq('id', target.id);
      }
      return;
    }
    const m = members.find((x) => x.userId === userId);
    patch({ ownerId: userId, owner: m?.name });
    if (target.kind === 'crm') {
      void supabase
        .from('whatsapp_conversations')
        .update({ assigned_user_id: userId })
        .eq('id', target.id);
    }
  };

  const phoneDigits = (phone || '').replace(/\D/g, '');

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-3xl max-h-[92vh] flex flex-col p-0 gap-0 overflow-hidden">
        {/* Cabeçalho */}
        <div className="flex items-center gap-3 border-b border-border/60 bg-muted/20 px-5 py-3 shrink-0">
          <span
            className="h-9 w-9 shrink-0 rounded-full flex items-center justify-center text-xs font-bold text-white"
            style={{ backgroundColor: stage?.color || '#374DA4' }}
          >
            {name.slice(0, 2).toUpperCase()}
          </span>
          <div className="min-w-0 flex-1">
            <DialogTitle className="text-base truncate">{name}</DialogTitle>
            <DialogDescription className="flex flex-wrap items-center gap-2 mt-0.5">
              {deal.company && (
                <span className="flex items-center gap-1">
                  <Building2 className="h-3 w-3" />
                  {deal.company}
                </span>
              )}
              {temp && (
                <span
                  className="rounded-full px-1.5 py-0.5 text-[10px] font-medium"
                  style={{
                    backgroundColor: `${TEMP_COLORS[temp] || '#6B7280'}1f`,
                    color: TEMP_COLORS[temp] || '#6B7280',
                  }}
                >
                  {temp}
                </span>
              )}
              <span className="text-[11px]">
                atividade {relativeTime(target.kind === 'crm' ? crmLead?.last_message_at : deal.updatedAt as string)}
              </span>
            </DialogDescription>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              title="Lead anterior"
              onClick={() => onNavigate(-1)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              title="Próximo lead"
              onClick={() => onNavigate(1)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-full"
              onClick={onClose}
              aria-label="Fechar"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Abas */}
        <Tabs defaultValue="resumo" className="flex-1 min-h-0 flex flex-col">
          <TabsList className="w-full justify-start border-b bg-muted/40 px-5 shrink-0">
            <TabsTrigger value="resumo" className="gap-1.5">
              <User className="h-3.5 w-3.5" /> Resumo
            </TabsTrigger>
            <TabsTrigger value="negociacao" className="gap-1.5">
              <Wallet className="h-3.5 w-3.5" /> Negociação
            </TabsTrigger>
            <TabsTrigger value="conversa" className="gap-1.5">
              <MessageSquare className="h-3.5 w-3.5" /> Conversa
            </TabsTrigger>
            <TabsTrigger value="ia" className="gap-1.5">
              <Brain className="h-3.5 w-3.5" /> IA
            </TabsTrigger>
            <TabsTrigger value="acoes" className="gap-1.5">
              <Send className="h-3.5 w-3.5" /> Ações
            </TabsTrigger>
          </TabsList>

          <div className="flex-1 overflow-y-auto scroll-smooth">
            {/* ── RESUMO ─────────────────────────────────── */}
            <TabsContent value="resumo" className="p-5 space-y-5">
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Contato / negócio">
                  <Input
                    value={name}
                    onChange={(e) => patch({ contact: e.target.value })}
                  />
                </Field>
                <Field label="Empresa">
                  <Input
                    value={deal.company || ''}
                    placeholder="Nome da empresa"
                    onChange={(e) => patch({ company: e.target.value })}
                  />
                </Field>
                <Field label="Email">
                  <Input
                    value={deal.email || ''}
                    placeholder="email@empresa.com"
                    onChange={(e) => patch({ email: e.target.value })}
                  />
                </Field>
                <Field label="Produto / serviço">
                  <Input
                    value={deal.product || ''}
                    placeholder="O que está vendendo"
                    onChange={(e) => patch({ product: e.target.value })}
                  />
                </Field>
                <Field label="Origem do lead">
                  <Input
                    value={deal.origin || (target.kind === 'local' ? localLead?.source : '') || ''}
                    placeholder="Indicação, site, anúncio…"
                    onChange={(e) => patch({ origin: e.target.value })}
                  />
                </Field>
                <Field label="Responsável">
                  <select
                    value={deal.ownerId || ''}
                    onChange={(e) => assign(e.target.value)}
                    className="h-9 w-full rounded-md border bg-background px-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                  >
                    <option value="">Sem responsável</option>
                    {members.map((m) => (
                      <option key={m.userId} value={m.userId}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>

              <Field label="Telefone">
                {phone ? (
                  <div className="flex items-center gap-2 rounded-lg border px-3 py-2">
                    <Phone className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <span className="flex-1 text-sm tabular-nums">{phone}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      title="Copiar"
                      onClick={() => {
                        void navigator.clipboard.writeText(phone);
                        toast({ title: 'Telefone copiado' });
                      }}
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                    {phoneDigits && (
                      <a
                        href={`https://wa.me/${phoneDigits}`}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-md bg-emerald-500/10 px-2 py-1 text-[11px] font-medium text-emerald-600"
                      >
                        WhatsApp
                      </a>
                    )}
                  </div>
                ) : (
                  <Input
                    value={deal.phone || ''}
                    placeholder="(00) 00000-0000"
                    onChange={(e) => patch({ phone: e.target.value })}
                  />
                )}
              </Field>

              <Field label="Observações da equipe">
                <Textarea
                  value={deal.notes || ''}
                  rows={5}
                  placeholder="Contexto da negociação, Combined, combinados, pendências…"
                  onChange={(e) => patch({ notes: e.target.value })}
                />
              </Field>
            </TabsContent>

            {/* ── NEGOCIAÇÃO ───────────────────────────── */}
            <TabsContent value="negociacao" className="p-5 space-y-5">
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Valor da negociação (R$)">
                  <Input
                    type="number"
                    min={0}
                    step={10}
                    value={deal.value ?? ''}
                    placeholder="0"
                    onChange={(e) => patch({ value: Number(e.target.value) || 0 })}
                  />
                </Field>
                <Field label="Orçamento do cliente (R$)">
                  <Input
                    type="number"
                    min={0}
                    step={10}
                    value={deal.budget ?? ''}
                    placeholder="0"
                    onChange={(e) => patch({ budget: Number(e.target.value) || 0 })}
                  />
                </Field>
                <Field label="Previsão de fechamento">
                  <Input
                    type="date"
                    value={deal.expectedClose || ''}
                    onChange={(e) => patch({ expectedClose: e.target.value })}
                  />
                </Field>
                <Field label="Etapa do funil">
                  <select
                    value={stageId}
                    onChange={(e) => e.target.value && data.moveTo(target.id, e.target.value)}
                    className="h-9 w-full rounded-md border bg-background px-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                  >
                    {stages.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.title}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>

              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <Gauge className="h-3.5 w-3.5" />
                  Probabilidade de fechar: {deal.probability ?? 0}%
                </Label>
                <Slider
                  value={[deal.probability ?? 0]}
                  min={0}
                  max={100}
                  step={5}
                  onValueChange={([v]) => patch({ probability: v })}
                />
              </div>

              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Temperatura</Label>
                <div className="flex flex-wrap gap-1.5">
                  <TempButton active={!temp} label="Automático (IA)" onClick={() => patch({ temperature: undefined })} />
                  {TEMPS.map((t) => (
                    <TempButton
                      key={t}
                      active={temp === t}
                      label={t}
                      color={TEMP_COLORS[t]}
                      onClick={() => patch({ temperature: t })}
                    />
                  ))}
                </div>
                {crmLead?.temperature_stage && (
                  <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                    <Flame className="h-3 w-3" /> IA classificou como {crmLead.temperature_stage}
                    {temp && temp !== crmLead.temperature_stage && ' (você sobrescreveu)'}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <Tag className="h-3.5 w-3.5" /> Etiquetas
                </Label>
                <div className="flex flex-wrap gap-1.5">
                  {tags.map((t) => (
                    <Badge key={t} variant="secondary" className="gap-1">
                      {t}
                      <button
                        onClick={() => patch({ tags: tags.filter((x) => x !== t) })}
                        aria-label={`Remover ${t}`}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Input
                    value={tagDraft}
                    placeholder="Nova etiqueta…"
                    onChange={(e) => setTagDraft(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())}
                    className="h-9"
                  />
                  <Button variant="outline" size="sm" onClick={addTag}>
                    Adicionar
                  </Button>
                </div>
              </div>
            </TabsContent>

            {/* ── CONVERSA ─────────────────────────────── */}
            <TabsContent value="conversa" className="p-5">
              {target.kind !== 'crm' ? (
                <p className="py-10 text-center text-sm text-muted-foreground">
                  Este lead é local e não tem conversa no WhatsApp.
                </p>
              ) : loadingMsgs ? (
                <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Carregando conversa…
                </div>
              ) : !messages.length ? (
                <p className="py-10 text-center text-sm text-muted-foreground">
                  Nenhuma mensagem registrada nesta conversa.
                </p>
              ) : (
                <ul className="space-y-2">
                  {messages.map((m, i) => (
                    <li
                      key={i}
                      className={`flex ${m.from_me ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${
                          m.from_me
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-muted'
                        }`}
                      >
                        <p className="whitespace-pre-wrap break-words">{m.content}</p>
                        {m.timestamp && (
                          <p className="mt-0.5 text-[10px] opacity-70">
                            {new Date(m.timestamp).toLocaleString('pt-BR')}
                          </p>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </TabsContent>

            {/* ── IA ───────────────────────────────────── */}
            <TabsContent value="ia" className="p-5 space-y-4">
              <div className="flex flex-wrap gap-2">
                <Button size="sm" onClick={() => runAi('copilot')} disabled={aiLoading}>
                  {aiLoading && aiAction === 'copilot' ? (
                    <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />
                  ) : (
                    <Sparkles className="h-3.5 w-3.5 mr-2" />
                  )}
                  Analisar conversa
                </Button>
                <Button size="sm" variant="outline" onClick={() => runAi('analyze_lead')} disabled={aiLoading}>
                  Análise completa
                </Button>
                <Button size="sm" variant="outline" onClick={() => runAi('lead_score')} disabled={aiLoading}>
                  Score
                </Button>
                <Button size="sm" variant="outline" onClick={() => runAi('summary_next_steps')} disabled={aiLoading}>
                  Follow-up
                </Button>
                <Button size="sm" variant="outline" onClick={() => runAi('suggest_reply')} disabled={aiLoading}>
                  Sugerir resposta
                </Button>
              </div>

              {copilot && (
                <div className="rounded-xl border p-4 space-y-2">
                  <div className="flex items-center gap-2">
                    <Badge className="bg-primary/10 text-primary">{copilot.tier || '—'}</Badge>
                    {typeof copilot.score === 'number' && (
                      <Badge variant="secondary">Score {copilot.score}</Badge>
                    )}
                    {copilot.urgency && <Badge variant="outline">Urgência {copilot.urgency}</Badge>}
                  </div>
                  {copilot.headline && <p className="text-sm font-medium">{copilot.headline}</p>}
                  {copilot.next_action && (
                    <p className="text-sm text-muted-foreground">
                      <b>Próximo passo:</b> {copilot.next_action}
                    </p>
                  )}
                  {!!copilot.signals?.length && (
                    <ul className="text-xs text-muted-foreground list-disc pl-4">
                      {copilot.signals.map((s) => (
                        <li key={s}>{s}</li>
                      ))}
                    </ul>
                  )}
                  {copilot.objection && (
                    <p className="text-xs text-amber-600">Objeção: {copilot.objection}</p>
                  )}
                </div>
              )}

              {aiResult && (
                <div className="rounded-xl border bg-muted/30 p-4">
                  <pre className="whitespace-pre-wrap text-sm font-sans leading-relaxed">{aiResult}</pre>
                </div>
              )}

              {!aiResult && !copilot && !aiLoading && (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  Escolha uma ação para a IA analisar a conversa deste lead.
                </p>
              )}
              {aiLoading && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Pensando…
                </div>
              )}
            </TabsContent>

            {/* ── AÇÕES ────────────────────────────────── */}
            <TabsContent value="acoes" className="p-5 space-y-4">
              <div className="grid gap-2 sm:grid-cols-2">
                {isCrmPipeline && (
                  <Button onClick={onOpenCRM}>
                    <MessageSquare className="h-4 w-4 mr-2" /> Abrir conversa no CRM
                  </Button>
                )}
                {phoneDigits && (
                  <Button variant="outline" onClick={() => window.open(`https://wa.me/${phoneDigits}`, '_blank')}>
                    <Phone className="h-4 w-4 mr-2" /> Chamar no WhatsApp
                  </Button>
                )}
                {deal.email && (
                  <Button
                    variant="outline"
                    onClick={() => window.open(`mailto:${deal.email}?subject=${encodeURIComponent(`Proposta — ${name}`)}`)}
                  >
                    <Mail className="h-4 w-4 mr-2" /> Enviar email
                  </Button>
                )}
                <Button
                  variant="outline"
                  onClick={() => {
                    const stage = stages.find((s) => s.id === stageId);
                    void navigator.clipboard.writeText(
                      `${name} — ${stage?.title || ''} — ${formatBRL(deal.value) || 'sem valor'} — ${phone || ''}`,
                    );
                    toast({ title: 'Resumo copiado' });
                  }}
                >
                  <Copy className="h-4 w-4 mr-2" /> Copiar resumo
                </Button>
              </div>

              <div className="rounded-xl border p-4 space-y-2">
                <p className="text-sm font-medium flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5" /> Próximo passo
                </p>
                <p className="text-xs text-muted-foreground">
                  Registre o combinado da última ligação nas observações, ou peça para a IA gerar
                  um follow-up na aba IA.
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    const next = new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10);
                    patch({ expectedClose: next });
                    toast({ title: 'Previsão marcada para 3 dias' });
                  }}
                >
                  <ArrowRight className="h-3.5 w-3.5 mr-2" />
                  Marcar follow-up em 3 dias
                </Button>
              </div>

              {isFrioAt(target.kind === 'crm' ? crmLead?.last_message_at : (deal.updatedAt as string)) && (
                <p className="rounded-lg bg-sky-500/10 px-3 py-2 text-xs text-sky-600">
                  Este lead está parado há mais de 7 dias. Considere uma campanha de reativação.
                </p>
              )}

              {target.kind === 'local' && (
                <Button
                  variant="outline"
                  className="text-destructive"
                  onClick={() => {
                    data.deleteLocalDeal(target.id);
                    onClose();
                    toast({ title: 'Lead excluído' });
                  }}
                >
                  <Trash2 className="h-4 w-4 mr-2" /> Excluir lead
                </Button>
              )}
            </TabsContent>
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

function TempButton({
  active,
  label,
  color,
  onClick,
}: {
  active: boolean;
  label: string;
  color?: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs capitalize transition-colors ${
        active ? 'border-primary bg-primary text-primary-foreground' : 'bg-background hover:bg-muted'
      }`}
    >
      {active && <Check className="h-3 w-3" />}
      {color && !active && (
        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
      )}
      {label}
    </button>
  );
}
