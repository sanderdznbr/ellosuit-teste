import { useEffect, useMemo, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Check, Link2, Loader2, Send, Sparkles, Trash2, Workflow, Zap } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import {
  ACTION_LABELS,
  AutomationAction,
  AutomationTrigger,
  FunnelAutomation,
  PipelineColumn,
  TRIGGER_LABELS,
  uid,
} from './types';

/** Proposta da IA antes de virar regra salva. */
interface ProposedAutomation {
  stageId: string;
  trigger: AutomationTrigger;
  days?: number;
  action: AutomationAction;
  config?: string;
  summary?: string;
}

/**
 * Proposta de etapa compartilhada: a etapa `stageId` deste funil passa a mostrar
 * os leads da etapa `sourceStageId` do funil `funnelId`.
 */
export interface ProposedLink {
  stageId: string;
  funnelId: string;
  sourceStageId: string;
  summary?: string;
}

/** Funil e etapas, como o chat precisa conhecer para vincular. */
export interface FunnelCatalog {
  id: string;
  name: string;
  stages: { id: string; title: string }[];
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  proposed?: ProposedAutomation[];
  links?: ProposedLink[];
}

const TRIGGERS: AutomationTrigger[] = ['on_enter', 'after_days', 'no_response_days', 'moved'];
const ACTIONS: AutomationAction[] = [
  'send_whatsapp',
  'start_chatbot',
  'create_task',
  'send_email',
  'advance_stage',
  'notify_team',
  'webhook',
];

const SYSTEM = `Você configura AUTOMAÇÕES e ETAPAS COMPARTILHADAS de um funil de vendas. Fale português do Brasil, curto, direto e amigável.

Cada automação é: uma etapa + um GATILHO + uma AÇÃO.

Gatilhos (trigger):
${TRIGGERS.map((t) => `- "${t}" → ${TRIGGER_LABELS[t]}`).join('\n')}

Ações (action):
${ACTIONS.map((a) => `- "${a}" → ${ACTION_LABELS[a]}`).join('\n')}

Como preencher:
- "days": obrigatório (número) apenas em "after_days" e "no_response_days".
- "config": texto curto com o conteúdo da ação. Para "send_whatsapp" é a mensagem; "create_task" a tarefa; "send_email" o assunto; "notify_team" o aviso; "webhook" a URL.
- Para "advance_stage" com uma etapa de destino específica, use "config" com o ID da etapa de destino. Sem config, avança para a próxima.
- "stageId": ID da etapa onde a regra vale. Use o ID informado no contexto, salvo se o usuário pedir outra etapa.

Regras de conversa:
- Faça no MÁXIMO 1 pergunta por vez quando faltar informação essencial. Se já dá para montar a regra, monte.
- SEMPRE explique em linguagem simples o que vai acontecer, em 1 a 3 frases, antes do bloco.
- Quando propuser regras, inclua no FINAL um bloco:
  \`\`\`json
  { "automations": [ { "stageId": "<id>", "trigger": "on_enter", "action": "send_whatsapp", "config": "...", "summary": "frase curta" } ] }
  \`\`\`
- Se ainda estiver perguntando, NÃO inclua o bloco.
- Se o pedido NÃO for uma automação do funil (ex.: "receber leads de um formulário"), explique como fazer usando o recurso certo — por exemplo o webhook de entrada da etapa — e NÃO invente regra.
- Nunca prometa integrações que a lista de ações não cobre.

ETAPAS COMPARTILHADAS ENTRE FUNIS:
Uma etapa DESTE funil pode ser ligada a uma etapa de OUTRO funil. A etapa passa a mostrar os mesmos leads da etapa de origem — um lead só, visto nos dois funis — e mover o lead em qualquer um dos dois lugares move nos dois.
- Use este recurso quando o usuário pedir para "vincular", "puxar os leads", "usar a mesma etapa", "espelhar a etapa" de outro funil.
- É o oposto de copiar leads: nada é duplicado, a etapa é compartilhada. Diga isso em 1 frase.
- Os ids de funil e de etapa são os do contexto. NUNCA invente id.
- Proponha no bloco:
  \`\`\`json
  { "links": [ { "stageId": "<etapa DESTE funil>", "funnelId": "<funil de origem>", "sourceStageId": "<etapa do funil de origem>", "summary": "frase curta" } ] }
  \`\`\`
- Quando o pedido for só o vínculo, responda com o bloco de links e nada de automations.
- Se a etapa de origem tiver leads parados, você pode sugerir também uma automação — mas só inclua o bloco de automations se o usuário pedir.`;

function describe(a: FunnelAutomation | ProposedAutomation, stages: PipelineColumn[]) {
  const stage = stages.find((s) => s.id === a.stageId);
  const trigger = TRIGGER_LABELS[a.trigger] ?? a.trigger;
  const days = a.days ? ` (${a.days}d)` : '';
  const action = ACTION_LABELS[a.action] ?? a.action;
  return { stage, text: `${trigger}${days} → ${action}`, action };
}

function AutomationChatDialog({
  open,
  onOpenChange,
  stage,
  stages,
  existing,
  webhookStageId,
  funnelId,
  funnels,
  sharedStages,
  onApply,
  onRemove,
  onApplyLinks,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  stage: PipelineColumn;
  stages: PipelineColumn[];
  existing: FunnelAutomation[];
  webhookStageId?: string | null;
  funnelId: string;
  funnels: FunnelCatalog[];
  /** Etapas já compartilhadas deste funil, para a IA não repetir vínculo. */
  sharedStages: { title: string; origin: string }[];
  onApply: (automations: FunnelAutomation[]) => void;
  onRemove: (id: string) => void;
  onApplyLinks: (links: ProposedLink[]) => void;
}) {
  const { toast } = useToast();
  const greeting = useMemo(
    () =>
      `Vamos automatizar a etapa **${stage.title}**.\n\n` +
      'Me diga o que deve acontecer aqui. Por exemplo:\n' +
      '- *“Todo lead que entrar aqui recebe uma mensagem de boas-vindas no WhatsApp.”*\n' +
      '- *“Se o lead ficar 2 dias parado sem responder, cria uma tarefa para a equipe.”*\n' +
      '- *“Quando o lead mandar comprovante de pagamento, move para Venda Ganha.”*\n' +
      '- *“Puxa para esta etapa os leads da etapa Orçamento do funil Comercial.”*\n\n' +
      'Eu explico o que dá para fazer e monto a regra para você conferir.',
    [stage.title],
  );

  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: 'assistant', content: greeting },
  ]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Ao trocar de etapa, recomeça a conversa com o contexto certo.
  useEffect(() => {
    setMessages([{ role: 'assistant', content: greeting }]);
    setInput('');
  }, [greeting]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, sending]);

  const stageAutomations = existing.filter((a) => a.stageId === stage.id);

  const send = async () => {
    const text = input.trim();
    if (!text || sending) return;
    const next: ChatMessage[] = [...messages, { role: 'user', content: text }];
    setMessages(next);
    setInput('');
    setSending(true);
    try {
      const context = [
        `Funil aberto: ${funnels.find((f) => f.id === funnelId)?.name ?? 'este funil'} (id: ${funnelId})`,
        `Etapa alvo: ${stage.title} (id: ${stage.id})`,
        `Etapas deste funil:\n${stages.map((s) => `- ${s.title} (id: ${s.id})`).join('\n')}`,
        `Todos os funis da empresa e suas etapas:\n${funnels
          .map(
            (f) =>
              `- ${f.name} (id: ${f.id})${f.id === funnelId ? ' ← ESTE' : ''}:\n${f.stages
                .map((s) => `    - ${s.title} (id: ${s.id})`)
                .join('\n')}`,
          )
          .join('\n')}`,
        `Etapas deste funil que já são compartilhadas com outro funil:\n${
          sharedStages.length
            ? sharedStages.map((s) => `- ${s.title} ← ${s.origin}`).join('\n')
            : 'nenhuma'
        }`,
        webhookStageId
          ? `A etapa que recebe leads de webhook/formulário é: ${stages.find((s) => s.id === webhookStageId)?.title ?? webhookStageId} (id: ${webhookStageId})`
          : 'Nenhuma etapa está marcada como destino de webhook.',
        `Regras já existentes neste funil:\n${JSON.stringify(
          existing.map((a) => ({ stageId: a.stageId, trigger: a.trigger, days: a.days, action: a.action, config: a.config, active: a.active })),
        )}`,
      ].join('\n\n');

      const { data, error } = await supabase.functions.invoke('ai-chat', {
        body: {
          model: 'google/gemini-2.5-flash',
          temperature: 0.3,
          messages: [
            { role: 'system', content: SYSTEM },
            { role: 'system', content: context },
            ...next.map((m) => ({ role: m.role, content: m.content })),
          ],
        },
      });
      if (error) throw error;

      const raw: string = data?.response || data?.message || '';
      const match = raw.match(/```json\s*([\s\S]*?)```/i);
      let proposed: ProposedAutomation[] | undefined;
      let links: ProposedLink[] | undefined;
      if (match) {
        try {
          const parsed = JSON.parse(match[1]);
          if (Array.isArray(parsed?.automations)) {
            proposed = parsed.automations
              .filter(
                (a: ProposedAutomation) =>
                  a &&
                  TRIGGERS.includes(a.trigger) &&
                  ACTIONS.includes(a.action) &&
                  stages.some((s) => s.id === a.stageId),
              )
              .map((a: ProposedAutomation) => ({
                ...a,
                stageId: stages.some((s) => s.id === a.stageId) ? a.stageId : stage.id,
              }));
            if (proposed.length === 0) proposed = undefined;
          }
          // Vínculo entre funis: só vale com ids reais do contexto, e nunca com
          // uma etapa do próprio funil.
          if (Array.isArray(parsed?.links)) {
            links = (parsed.links as ProposedLink[]).filter((l) => {
              if (!l?.stageId || !l.funnelId || !l.sourceStageId) return false;
              if (l.funnelId === funnelId) return false;
              if (!stages.some((s) => s.id === l.stageId)) return false;
              const source = funnels.find((f) => f.id === l.funnelId);
              return !!source?.stages.some((s) => s.id === l.sourceStageId);
            });
            if (links.length === 0) links = undefined;
          }
        } catch {
          proposed = undefined;
          links = undefined;
        }
      }

      const clean = raw.replace(/```json[\s\S]*?```/gi, '').trim();
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: clean || 'Certo!', proposed, links },
      ]);
    } catch (e) {
      console.error('[funil] automation chat error', e);
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: 'Não consegui falar com a IA agora. Tente de novo.' },
      ]);
      toast({ title: 'Erro', description: 'Falha ao consultar a IA.', variant: 'destructive' });
    } finally {
      setSending(false);
    }
  };

  /** "Comercial › Orçamento" — origem do vínculo proposto. */
  const describeLink = (l: ProposedLink) => {
    const source = funnels.find((f) => f.id === l.funnelId);
    const sourceStage = source?.stages.find((s) => s.id === l.sourceStageId);
    const here = stages.find((s) => s.id === l.stageId);
    return {
      here: here?.title ?? 'etapa',
      origin: `${source?.name ?? 'outro funil'} › ${sourceStage?.title ?? 'etapa'}`,
    };
  };

  const apply = (proposed: ProposedAutomation[]) => {
    onApply(
      proposed.map((p) => ({
        id: uid(),
        stageId: p.stageId,
        trigger: p.trigger,
        days: p.trigger === 'after_days' || p.trigger === 'no_response_days' ? p.days ?? 2 : undefined,
        action: p.action,
        config: p.config,
        active: true,
      })),
    );
    toast({
      title: `Automação${proposed.length > 1 ? 's' : ''} criada${proposed.length > 1 ? 's' : ''}`,
      description: `${proposed.length} regra${proposed.length > 1 ? 's' : ''} ativa${proposed.length > 1 ? 's' : ''} em ${stage.title}.`,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[85vh] max-w-3xl flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="border-b border-border/60 bg-gradient-to-r from-[#374DA4]/5 to-[#007DE3]/5 px-5 py-4">
          <DialogTitle className="flex items-center gap-2.5">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-[#374DA4] to-[#007DE3] text-white shadow-sm">
              <Zap className="h-4 w-4" fill="currentColor" />
            </span>
            <div className="flex flex-col text-left">
              <span className="text-[15px]">Automatizar “{stage.title}”</span>
              <span className="text-[11px] font-normal text-muted-foreground">
                Descreva o que deve acontecer nesta etapa
              </span>
            </div>
          </DialogTitle>
          <DialogDescription className="sr-only">
            Chat para criar automações da etapa {stage.title}
          </DialogDescription>
        </DialogHeader>

        <div className="flex min-h-0 flex-1">
          <div className="flex min-w-0 flex-1 flex-col border-r border-border/60">
            <ScrollArea className="flex-1">
              <div ref={scrollRef} className="space-y-4 p-4">
                {messages.map((m, i) => (
                  <div
                    key={i}
                    className={`flex gap-2.5 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    {m.role === 'assistant' && (
                      <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#374DA4] to-[#007DE3] text-white">
                        <Sparkles className="h-3.5 w-3.5" />
                      </div>
                    )}
                    <div className={`max-w-[85%] space-y-2 ${m.role === 'user' ? 'items-end' : 'items-start'}`}>
                      <div
                        className={`rounded-2xl px-3.5 py-2 text-sm ${
                          m.role === 'user'
                            ? 'rounded-br-md bg-[#374DA4] text-white'
                            : 'rounded-bl-md bg-muted text-foreground'
                        }`}
                      >
                        {m.role === 'user' ? (
                          <p className="whitespace-pre-wrap">{m.content}</p>
                        ) : (
                          <div className="prose prose-sm max-w-none dark:prose-invert [&_p]:my-0 [&_p+p]:mt-2">
                            <ReactMarkdown>{m.content}</ReactMarkdown>
                          </div>
                        )}
                      </div>

                      {m.proposed && m.proposed.length > 0 && (
                        <div className="space-y-2 rounded-xl border border-[#007DE3]/30 bg-[#007DE3]/5 p-3">
                          <div className="text-[11px] font-semibold uppercase tracking-wide text-[#007DE3]">
                            {m.proposed.length > 1 ? 'Regras propostas' : 'Regra proposta'}
                          </div>
                          {m.proposed.map((p, pi) => {
                            const info = describe(p, stages);
                            return (
                              <div key={pi} className="space-y-1 rounded-lg bg-background/70 p-2.5">
                                <div className="flex flex-wrap items-center gap-1.5 text-xs">
                                  {info.stage && (
                                    <Badge variant="outline" className="gap-1 text-[10px]">
                                      <span
                                        className="h-1.5 w-1.5 rounded-full"
                                        style={{ backgroundColor: info.stage.color }}
                                      />
                                      {info.stage.title}
                                    </Badge>
                                  )}
                                  <span className="font-medium text-foreground">{info.text}</span>
                                </div>
                                {p.config && (
                                  <p className="text-[11px] text-muted-foreground">{p.config}</p>
                                )}
                              </div>
                            );
                          })}
                          <Button
                            size="sm"
                            onClick={() => apply(m.proposed!)}
                            className="h-8 w-full bg-gradient-to-r from-[#374DA4] to-[#007DE3] text-white hover:opacity-90"
                          >
                            <Check className="mr-1.5 h-3.5 w-3.5" />
                            Aplicar {m.proposed.length} regra{m.proposed.length > 1 ? 's' : ''}
                          </Button>
                        </div>
                      )}

                      {m.links && m.links.length > 0 && (
                        <div className="space-y-2 rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-3">
                          <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-400">
                            <Link2 className="h-3.5 w-3.5" />
                            {m.links.length > 1
                              ? 'Etapas compartilhadas propostas'
                              : 'Etapa compartilhada proposta'}
                          </div>
                          {m.links.map((l, li) => {
                            const info = describeLink(l);
                            return (
                              <div key={li} className="space-y-1 rounded-lg bg-background/70 p-2.5">
                                <div className="text-xs font-medium text-foreground">
                                  {info.here} ← {info.origin}
                                </div>
                                <p className="text-[11px] text-muted-foreground">
                                  Mesmos leads nos dois funis — mover aqui move no funil de origem.
                                </p>
                              </div>
                            );
                          })}
                          <Button
                            size="sm"
                            onClick={() => onApplyLinks(m.links!)}
                            className="h-8 w-full bg-emerald-600 text-white hover:bg-emerald-600/90"
                          >
                            <Check className="mr-1.5 h-3.5 w-3.5" />
                            Compartilhar {m.links.length} etapa{m.links.length > 1 ? 's' : ''}
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}

                {sending && (
                  <div className="flex gap-2.5">
                    <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#374DA4] to-[#007DE3] text-white">
                      <Sparkles className="h-3.5 w-3.5" />
                    </div>
                    <div className="inline-flex items-center gap-2 rounded-2xl rounded-bl-md bg-muted px-3.5 py-2 text-sm text-muted-foreground">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" /> pensando...
                    </div>
                  </div>
                )}
              </div>
            </ScrollArea>

            <div className="border-t border-border/60 bg-background p-3">
              <div className="flex items-end gap-2">
                <Textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      void send();
                    }
                  }}
                  placeholder="Ex.: quem chegar aqui e mandar comprovante de pagamento vai para Venda Ganha"
                  rows={2}
                  className="max-h-32 min-h-[44px] resize-none"
                  disabled={sending}
                />
                <Button
                  onClick={() => void send()}
                  disabled={!input.trim() || sending}
                  size="icon"
                  className="h-11 w-11 flex-shrink-0 bg-gradient-to-r from-[#374DA4] to-[#007DE3] text-white hover:opacity-90"
                >
                  {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          </div>

          <div className="hidden w-[250px] flex-shrink-0 flex-col bg-muted/20 md:flex">
            <div className="border-b border-border/60 px-4 py-3">
              <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                <Workflow className="h-3.5 w-3.5" /> Regras desta etapa
              </div>
              <div className="text-xs text-muted-foreground/70">
                {stageAutomations.length === 0
                  ? 'Nenhuma ainda'
                  : `${stageAutomations.length} ativa${stageAutomations.length > 1 ? 's' : ''}`}
              </div>
            </div>
            <ScrollArea className="flex-1">
              <div className="space-y-2 p-3">
                {stageAutomations.map((a) => {
                  const info = describe(a, stages);
                  return (
                    <div key={a.id} className="space-y-1 rounded-lg border border-border/60 bg-background p-2.5">
                      <div className="text-[11px] font-semibold leading-snug text-foreground">
                        {info.text}
                      </div>
                      {a.config && (
                        <p className="line-clamp-2 text-[10px] text-muted-foreground">{a.config}</p>
                      )}
                      <div className="flex items-center justify-between">
                        <span
                          className={`text-[10px] font-medium ${a.active ? 'text-emerald-600' : 'text-muted-foreground'}`}
                        >
                          {a.active ? 'ativa' : 'pausada'}
                        </span>
                        <button
                          type="button"
                          onClick={() => onRemove(a.id)}
                          className="rounded p-1 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                          aria-label="Remover regra"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Chat de automação de uma etapa do funil.
 *
 * A IA conversa, explica em linguagem simples o que vai acontecer e devolve
 * regras no mesmo formato salvo pelo painel de Automações (gatilho + ação).
 * Nada é salvo sem o usuário clicar em aplicar.
 */
export function StageAutomationChat({
  open,
  onOpenChange,
  stage,
  stages,
  automations,
  webhookStageId,
  funnelId,
  funnels,
  sharedStages,
  onAutomationsChange,
  onLinkStages,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** Etapa clicada no construtor. */
  stage: PipelineColumn | null;
  stages: PipelineColumn[];
  automations: FunnelAutomation[];
  webhookStageId?: string | null;
  /** Funil aberto e os demais, para compartilhar etapas entre eles. */
  funnelId: string;
  funnels: FunnelCatalog[];
  sharedStages: { title: string; origin: string }[];
  onAutomationsChange: (automations: FunnelAutomation[]) => void;
  onLinkStages: (links: ProposedLink[]) => void;
}) {
  if (!stage) return null;
  return (
    <AutomationChatDialog
      open={open}
      onOpenChange={onOpenChange}
      stage={stage}
      stages={stages}
      existing={automations}
      webhookStageId={webhookStageId}
      funnelId={funnelId}
      funnels={funnels}
      sharedStages={sharedStages}
      onApply={(created) => onAutomationsChange([...automations, ...created])}
      onRemove={(id) => onAutomationsChange(automations.filter((a) => a.id !== id))}
      onApplyLinks={onLinkStages}
    />
  );
}

export default StageAutomationChat;
