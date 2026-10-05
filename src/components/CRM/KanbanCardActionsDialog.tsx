import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  MessageSquare,
  MoveRight,
  Bot,
  Sparkles,
  UserPlus,
  ChevronLeft,
  Loader2,
  Check,
  Pause,
  Play,
  Copy,
} from 'lucide-react';

export interface KanbanActionConversation {
  id: string;
  contact_phone: string;
  contact_name?: string;
  profile_picture?: string;
  pipeline_stage?: string;
  temperature_stage?: string | null;
  ai_auto_reply_enabled?: boolean;
  human_takeover?: boolean;
  ai_agent_id?: string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conversation: KanbanActionConversation | null;
  columns: Array<{ id: string; title: string; color: string }>;
  currentStage: string;
  isTemperature: boolean;
  aiAgents: Array<{ id: string; name: string }>;
  onOpenConversation: (conv: KanbanActionConversation) => void;
  onMoveStage: (conv: KanbanActionConversation, targetStage: string) => void;
  onToggleBot: (conv: KanbanActionConversation) => void;
  onSaveLead: (conv: KanbanActionConversation) => void;
}

type Suggestion = { id?: string; message: string; reason?: string; kind?: string; scheduled_for?: string };

const KanbanCardActionsDialog: React.FC<Props> = ({
  open,
  onOpenChange,
  conversation,
  columns,
  currentStage,
  isTemperature,
  aiAgents,
  onOpenConversation,
  onMoveStage,
  onToggleBot,
  onSaveLead,
}) => {
  const [screen, setScreen] = useState<'menu' | 'move' | 'bot' | 'followup'>('menu');
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [assigning, setAssigning] = useState<string | null>(null);

  React.useEffect(() => {
    if (open) {
      setScreen('menu');
      setSuggestions([]);
    }
  }, [open, conversation?.id]);

  if (!conversation) return null;

  const name = conversation.contact_name || conversation.contact_phone;
  const botOn = !conversation.human_takeover && conversation.ai_auto_reply_enabled !== false;

  const runSuggestions = async () => {
    setScreen('followup');
    if (suggestions.length || loadingSuggestions) return;
    setLoadingSuggestions(true);
    try {
      const { data, error } = await supabase.functions.invoke('crm-followup-suggest', {
        body: { conversationId: conversation.id },
      });
      if (error) throw error;
      const saved = ((data as any)?.saved ?? (data as any)?.suggestions ?? []) as Suggestion[];
      setSuggestions(saved);
      if (!saved.length) toast.info('A IA não viu motivo para follow-up agora');
    } catch (e: any) {
      toast.error('Não foi possível analisar', { description: e?.message });
    } finally {
      setLoadingSuggestions(false);
    }
  };

  const assignAgent = async (agentId: string | null) => {
    setAssigning(agentId || 'none');
    const { error } = await supabase
      .from('whatsapp_conversations')
      .update({
        ai_agent_id: agentId,
        ai_auto_reply_enabled: !!agentId,
        human_takeover: false,
      } as any)
      .eq('id', conversation.id);
    setAssigning(null);
    if (error) {
      toast.error('Erro ao acionar bot', { description: error.message });
      return;
    }
    toast.success(agentId ? 'Agente acionado nesta conversa' : 'Agente removido');
    onOpenChange(false);
  };

  const menuItem = (
    icon: React.ReactNode,
    title: string,
    subtitle: string,
    onClick: () => void,
    accent?: boolean,
  ) => (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'w-full flex items-center gap-3 p-3 rounded-xl border border-border/60 bg-card hover:bg-muted/60 transition-colors text-left',
        accent && 'border-[#374DA4]/40 bg-[#374DA4]/5 hover:bg-[#374DA4]/10',
      )}
    >
      <span
        className={cn(
          'h-9 w-9 rounded-lg flex items-center justify-center shrink-0',
          accent ? 'bg-[#374DA4] text-white' : 'bg-muted text-foreground/70',
        )}
      >
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[13px] font-semibold text-foreground truncate">{title}</span>
        <span className="block text-[11px] text-muted-foreground truncate">{subtitle}</span>
      </span>
    </button>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm p-0 gap-0 overflow-hidden">
        <DialogHeader className="p-4 pb-3 border-b border-border/60">
          <div className="flex items-center gap-3">
            {screen !== 'menu' && (
              <button
                type="button"
                onClick={() => setScreen('menu')}
                className="h-8 w-8 rounded-lg hover:bg-muted flex items-center justify-center shrink-0"
                aria-label="Voltar"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
            )}
            <Avatar className="h-10 w-10">
              <AvatarImage src={conversation.profile_picture} />
              <AvatarFallback className="bg-[#374DA4]/10 text-[#374DA4] text-[11px] font-bold">
                {name.substring(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 text-left">
              <DialogTitle className="text-[14px] truncate">{name}</DialogTitle>
              <DialogDescription className="text-[11px] truncate">
                {screen === 'move'
                  ? 'Escolha a coluna de destino'
                  : screen === 'bot'
                  ? 'Acionar um agente de IA'
                  : screen === 'followup'
                  ? 'Sugestões de follow-up'
                  : conversation.contact_phone}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh]">
          <div className="p-3 space-y-2">
            {screen === 'menu' && (
              <>
                {menuItem(
                  <MessageSquare className="h-4 w-4" />,
                  'Abrir conversa',
                  'Abrir no chat do CRM',
                  () => {
                    onOpenChange(false);
                    onOpenConversation(conversation);
                  },
                  true,
                )}
                {menuItem(
                  <MoveRight className="h-4 w-4" />,
                  'Mover de coluna',
                  isTemperature ? 'Alterar temperatura do lead' : 'Alterar etapa do funil',
                  () => setScreen('move'),
                )}
                {menuItem(
                  botOn ? <Pause className="h-4 w-4" /> : <Bot className="h-4 w-4" />,
                  'Acionar bot',
                  botOn ? 'Bot ativo — pausar ou trocar agente' : 'Bot pausado — ativar agente',
                  () => setScreen('bot'),
                )}
                {menuItem(
                  <Sparkles className="h-4 w-4" />,
                  'Sugestões de follow-up',
                  'IA cria mensagens para reengajar',
                  runSuggestions,
                )}
                {menuItem(
                  <UserPlus className="h-4 w-4" />,
                  'Salvar lead',
                  'Cadastrar contato no CRM',
                  () => {
                    onOpenChange(false);
                    onSaveLead(conversation);
                  },
                )}
              </>
            )}

            {screen === 'move' &&
              columns.map(col => {
                const active = col.id === currentStage;
                return (
                  <button
                    key={col.id}
                    type="button"
                    disabled={active}
                    onClick={() => {
                      onMoveStage(conversation, col.id);
                      onOpenChange(false);
                    }}
                    className={cn(
                      'w-full flex items-center gap-3 p-3 rounded-xl border border-border/60 transition-colors text-left',
                      active ? 'bg-muted/60 cursor-default' : 'bg-card hover:bg-muted/60',
                    )}
                  >
                    <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: col.color }} />
                    <span className="text-[13px] font-medium flex-1 truncate">{col.title}</span>
                    {active && <Check className="h-4 w-4 text-[#374DA4]" />}
                  </button>
                );
              })}

            {screen === 'bot' && (
              <>
                <button
                  type="button"
                  onClick={() => {
                    onToggleBot(conversation);
                    onOpenChange(false);
                  }}
                  className="w-full flex items-center gap-3 p-3 rounded-xl border border-border/60 bg-card hover:bg-muted/60 transition-colors text-left"
                >
                  <span className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center">
                    {botOn ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                  </span>
                  <span className="text-[13px] font-semibold">{botOn ? 'Pausar bot nesta conversa' : 'Ativar bot nesta conversa'}</span>
                </button>

                {aiAgents.length === 0 && (
                  <p className="text-[12px] text-muted-foreground px-1 py-2">Nenhum agente de IA criado ainda.</p>
                )}
                {aiAgents.map(agent => {
                  const active = conversation.ai_agent_id === agent.id;
                  return (
                    <button
                      key={agent.id}
                      type="button"
                      disabled={assigning !== null}
                      onClick={() => assignAgent(agent.id)}
                      className={cn(
                        'w-full flex items-center gap-3 p-3 rounded-xl border transition-colors text-left',
                        active ? 'border-[#374DA4]/40 bg-[#374DA4]/5' : 'border-border/60 bg-card hover:bg-muted/60',
                      )}
                    >
                      <Bot className="h-4 w-4 text-[#374DA4] shrink-0" />
                      <span className="text-[13px] font-medium flex-1 truncate">{agent.name}</span>
                      {assigning === agent.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : active ? (
                        <Check className="h-4 w-4 text-[#374DA4]" />
                      ) : null}
                    </button>
                  );
                })}
              </>
            )}

            {screen === 'followup' && (
              <>
                {loadingSuggestions && (
                  <div className="flex items-center gap-2 p-4 text-[13px] text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin text-[#374DA4]" />
                    A IA está analisando a conversa…
                  </div>
                )}
                {!loadingSuggestions && suggestions.length === 0 && (
                  <p className="text-[12px] text-muted-foreground px-1 py-3">Nenhuma sugestão no momento.</p>
                )}
                {suggestions.map((s, i) => (
                  <div key={s.id || i} className="p-3 rounded-xl border border-border/60 bg-card space-y-2">
                    {s.reason && <p className="text-[11px] text-muted-foreground">{s.reason}</p>}
                    <p className="text-[13px] text-foreground whitespace-pre-wrap">{s.message}</p>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(s.message);
                        toast.success('Mensagem copiada');
                      }}
                      className="inline-flex items-center gap-1.5 text-[11px] font-medium text-[#374DA4] hover:underline"
                    >
                      <Copy className="h-3 w-3" /> Copiar
                    </button>
                  </div>
                ))}
              </>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};

export default KanbanCardActionsDialog;
