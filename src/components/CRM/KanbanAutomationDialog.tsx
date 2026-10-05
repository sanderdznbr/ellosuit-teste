import React, { useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Zap, Send, Loader2, Facebook, Globe, Webhook, Tag, MessageSquare, Trash2, Check, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import type { KanbanColumn } from './WhatsAppKanbanView';

type SourceType = 'meta_ad' | 'meta_pixel' | 'webhook' | 'utm' | 'keyword';

interface AutomationRule {
  id: string;
  name: string;
  sourceType: SourceType;
  sourceValue: string;
  targetStage: string;
  enabled: boolean;
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  proposedRules?: Omit<AutomationRule, 'id'>[];
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  columns: KanbanColumn[];
  companyId: string | null;
}

const SOURCE_ICON: Record<SourceType, React.ComponentType<any>> = {
  meta_ad: Facebook,
  meta_pixel: Globe,
  webhook: Webhook,
  utm: Tag,
  keyword: MessageSquare,
};

const SOURCE_LABEL: Record<SourceType, string> = {
  meta_ad: 'Anúncio Meta',
  meta_pixel: 'Meta Pixel',
  webhook: 'Webhook',
  utm: 'UTM',
  keyword: 'Palavra-chave',
};

const INITIAL_GREETING = 'Olá! Eu configuro as regras de automação do seu Kanban. Me diga por exemplo: *"Leads que vierem do anúncio Black Friday do Facebook devem cair na coluna Novos"*.';

const KanbanAutomationDialog: React.FC<Props> = ({ open, onOpenChange, columns, companyId }) => {
  const storageKey = `kanban_automation_rules_${companyId || 'anon'}`;
  const [rules, setRules] = useState<AutomationRule[]>(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: 'assistant', content: INITIAL_GREETING },
  ]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, sending]);

  const persistRules = (next: AutomationRule[]) => {
    setRules(next);
    localStorage.setItem(storageKey, JSON.stringify(next));
  };

  const toggleRule = (id: string) => persistRules(rules.map(r => r.id === id ? { ...r, enabled: !r.enabled } : r));
  const removeRule = (id: string) => persistRules(rules.filter(r => r.id !== id));

  const applyProposed = (proposed: Omit<AutomationRule, 'id'>[]) => {
    const valid = proposed.filter(r => columns.some(c => c.id === r.targetStage));
    if (!valid.length) { toast.error('Nenhuma regra válida'); return; }
    const next = [...rules, ...valid.map(r => ({ ...r, id: crypto.randomUUID() }))];
    persistRules(next);
    toast.success(`${valid.length} regra${valid.length > 1 ? 's' : ''} adicionada${valid.length > 1 ? 's' : ''}`);
  };

  const send = async () => {
    const text = input.trim();
    if (!text || sending) return;
    const nextMessages: ChatMessage[] = [...messages, { role: 'user', content: text }];
    setMessages(nextMessages);
    setInput('');
    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke('kanban-automation-ai', {
        body: {
          messages: nextMessages.map(m => ({ role: m.role, content: m.content })),
          currentColumns: columns,
          currentRules: rules.map(({ id, ...r }) => r),
        },
      });
      if (error) throw error;
      if (data?.error) {
        toast.error(data.detail || data.error);
        setMessages(prev => [...prev, { role: 'assistant', content: 'Deu erro aqui. Tente reformular.' }]);
      } else {
        setMessages(prev => [...prev, { role: 'assistant', content: data.reply || '...', proposedRules: data.proposedRules || undefined }]);
      }
    } catch (e: any) {
      toast.error('Erro', { description: e.message });
      setMessages(prev => [...prev, { role: 'assistant', content: 'Erro ao contatar a IA.' }]);
    } finally {
      setSending(false);
    }
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl h-[85vh] p-0 overflow-hidden flex flex-col gap-0">
        <DialogHeader className="px-5 py-4 border-b border-border/60 bg-gradient-to-r from-[#374DA4]/5 to-[#007DE3]/5">
          <DialogTitle className="flex items-center gap-2.5">
            <span className="inline-flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-br from-[#374DA4] to-[#007DE3] text-white shadow-sm">
              <Zap className="h-4 w-4" fill="currentColor" />
            </span>
            <div className="flex flex-col">
              <span className="text-[15px]">Automatizar com IA</span>
              <span className="text-[11px] font-normal text-muted-foreground">Converse e a IA cria regras de roteamento</span>
            </div>
          </DialogTitle>
          <DialogDescription className="sr-only">Chat para criar regras de automação do Kanban</DialogDescription>
        </DialogHeader>

        <div className="flex flex-1 min-h-0">
          {/* Chat panel */}
          <div className="flex-1 flex flex-col min-w-0 border-r border-border/60">
            <ScrollArea className="flex-1">
              <div ref={scrollRef} className="p-4 space-y-4">
                {messages.map((m, i) => (
                  <div key={i} className={cn('flex gap-2.5', m.role === 'user' ? 'justify-end' : 'justify-start')}>
                    {m.role === 'assistant' && (
                      <div className="flex-shrink-0 w-7 h-7 rounded-full bg-gradient-to-br from-[#374DA4] to-[#007DE3] flex items-center justify-center text-white">
                        <Sparkles className="h-3.5 w-3.5" />
                      </div>
                    )}
                    <div className={cn('max-w-[80%] space-y-2', m.role === 'user' ? 'items-end' : 'items-start')}>
                      <div className={cn(
                        'rounded-2xl px-3.5 py-2 text-sm',
                        m.role === 'user'
                          ? 'bg-[#374DA4] text-white rounded-br-md'
                          : 'bg-muted text-foreground rounded-bl-md'
                      )}>
                        <div className="prose prose-sm dark:prose-invert max-w-none [&_p]:my-0 [&_p+p]:mt-2">
                          <ReactMarkdown>{m.content}</ReactMarkdown>
                        </div>
                      </div>
                      {m.proposedRules && m.proposedRules.length > 0 && (
                        <div className="rounded-xl border border-[#007DE3]/30 bg-[#007DE3]/5 p-3 space-y-2">
                          <div className="text-[11px] font-semibold uppercase tracking-wide text-[#007DE3]">Regras propostas</div>
                          {m.proposedRules.map((r, ri) => {
                            const Icon = SOURCE_ICON[r.sourceType] || Zap;
                            const col = columns.find(c => c.id === r.targetStage);
                            return (
                              <div key={ri} className="flex items-center gap-2 text-xs">
                                <Icon className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                                <span className="font-medium truncate">{r.name}</span>
                                <span className="text-muted-foreground truncate">→</span>
                                {col && (
                                  <Badge variant="outline" className="gap-1 text-[10px]">
                                    <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: col.color }} />
                                    {col.title}
                                  </Badge>
                                )}
                              </div>
                            );
                          })}
                          <Button
                            size="sm"
                            onClick={() => applyProposed(m.proposedRules!)}
                            className="w-full h-8 bg-gradient-to-r from-[#374DA4] to-[#007DE3] hover:opacity-90 text-white"
                          >
                            <Check className="h-3.5 w-3.5 mr-1.5" />
                            Aplicar {m.proposedRules.length} regra{m.proposedRules.length > 1 ? 's' : ''}
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                {sending && (
                  <div className="flex gap-2.5">
                    <div className="flex-shrink-0 w-7 h-7 rounded-full bg-gradient-to-br from-[#374DA4] to-[#007DE3] flex items-center justify-center text-white">
                      <Sparkles className="h-3.5 w-3.5" />
                    </div>
                    <div className="bg-muted rounded-2xl rounded-bl-md px-3.5 py-2 text-sm text-muted-foreground inline-flex items-center gap-2">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" /> pensando...
                    </div>
                  </div>
                )}
              </div>
            </ScrollArea>

            <div className="border-t border-border/60 p-3 bg-background">
              <div className="flex gap-2 items-end">
                <Textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={onKeyDown}
                  placeholder="Ex.: leads do anúncio Black Friday → Novos"
                  rows={2}
                  className="resize-none min-h-[44px] max-h-32"
                  disabled={sending}
                />
                <Button
                  onClick={send}
                  disabled={!input.trim() || sending}
                  size="icon"
                  className="h-11 w-11 flex-shrink-0 bg-gradient-to-r from-[#374DA4] to-[#007DE3] hover:opacity-90 text-white"
                >
                  {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          </div>

          {/* Rules sidebar */}
          <div className="w-[260px] flex-shrink-0 flex flex-col bg-muted/20">
            <div className="px-4 py-3 border-b border-border/60">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Regras ativas</div>
              <div className="text-xs text-muted-foreground/70">{rules.length} configurada{rules.length === 1 ? '' : 's'}</div>
            </div>
            <ScrollArea className="flex-1">
              <div className="p-3 space-y-2">
                {rules.length === 0 ? (
                  <div className="text-center py-8 text-xs text-muted-foreground">
                    Nenhuma regra ainda.
                  </div>
                ) : rules.map(rule => {
                  const Icon = SOURCE_ICON[rule.sourceType] || Zap;
                  const col = columns.find(c => c.id === rule.targetStage);
                  return (
                    <div key={rule.id} className="p-2.5 rounded-lg border border-border/60 bg-background space-y-1.5">
                      <div className="flex items-start gap-2">
                        <Icon className="h-3.5 w-3.5 text-muted-foreground mt-0.5 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-medium text-foreground truncate">{rule.name}</div>
                          <div className="text-[10px] text-muted-foreground truncate">{SOURCE_LABEL[rule.sourceType]}: {rule.sourceValue}</div>
                        </div>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        {col && (
                          <Badge variant="outline" className="gap-1 text-[10px] h-5">
                            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: col.color }} />
                            {col.title}
                          </Badge>
                        )}
                        <div className="flex items-center gap-1">
                          <Switch checked={rule.enabled} onCheckedChange={() => toggleRule(rule.id)} className="scale-75" />
                          <button
                            onClick={() => removeRule(rule.id)}
                            className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
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
};

export default KanbanAutomationDialog;