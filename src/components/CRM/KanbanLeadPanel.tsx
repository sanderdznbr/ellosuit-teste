import React, { useEffect, useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import {
  Phone, MessageSquare, Tag, DollarSign, User as UserIcon, Bot, Play, Pause,
  UserPlus, Save, Copy, Mail, StickyNote, TrendingUp, Clock, ExternalLink, Loader2,
  Users, Sparkles, PauseCircle,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import type { KanbanColumn } from './WhatsAppKanbanView';

interface ConversationLabel { id: string; name: string; color: string }
interface Teammate { user_id: string; name: string; avatar_url?: string | null }
interface AIAgentLite { id: string; name: string }

interface Conversation {
  id: string;
  contact_phone: string;
  contact_name?: string;
  last_message_at: string;
  last_message?: string;
  profile_picture?: string;
  pipeline_stage?: string;
  labels?: string[];
  notes?: string;
  ai_auto_reply_enabled?: boolean;
  human_takeover?: boolean;
  ai_agent_id?: string | null;
  assigned_user_id?: string | null;
  lead_score_data?: any;
  unread_count?: number;
  created_at?: string;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  conversation: Conversation | null;
  columns: KanbanColumn[];
  labels: ConversationLabel[];
  teammates?: Teammate[];
  aiAgents?: AIAgentLite[];
  onOpenChat: (conv: Conversation) => void;
  onManageLabels: (conv: Conversation) => void;
  onSaveLead: (conv: Conversation) => void;
  onStageChange?: (conversationId: string, stage: string) => void;
  onLocalUpdate?: (conv: Partial<Conversation> & { id: string }) => void;
}

const formatBRL = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });

const formatDate = (iso?: string) => {
  if (!iso) return '-';
  const d = new Date(iso);
  return d.toLocaleString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
};

const KanbanLeadPanel: React.FC<Props> = ({
  open, onOpenChange, conversation, columns, labels, teammates = [], aiAgents = [],
  onOpenChat, onManageLabels, onSaveLead, onStageChange, onLocalUpdate,
}) => {
  const [notes, setNotes] = useState('');
  const [dealValue, setDealValue] = useState<string>('');
  const [savingNotes, setSavingNotes] = useState(false);
  const [savingDeal, setSavingDeal] = useState(false);
  const [stage, setStage] = useState<string>('');
  const [savingMode, setSavingMode] = useState(false);
  const [savingAgent, setSavingAgent] = useState(false);
  const [savingAssignee, setSavingAssignee] = useState(false);

  useEffect(() => {
    if (!conversation) return;
    setNotes(conversation.notes || '');
    setStage(conversation.pipeline_stage || columns[0]?.id || '');
    const v = conversation.lead_score_data?.deal_value;
    setDealValue(typeof v === 'number' && v > 0 ? String(v) : '');
  }, [conversation, columns]);

  if (!conversation) return null;

  const displayName = conversation.contact_name || conversation.contact_phone;
  const initials = displayName.substring(0, 2).toUpperCase();
  const conversationLabels = labels.filter(l => conversation.labels?.includes(l.id));
  const isHuman = !!conversation.human_takeover;
  const isBot = !isHuman && conversation.ai_auto_reply_enabled !== false;
  const isPaused = !isHuman && conversation.ai_auto_reply_enabled === false;
  const currentMode: 'bot' | 'human' | 'paused' = isHuman ? 'human' : isBot ? 'bot' : 'paused';
  const scoreData = conversation.lead_score_data || {};
  const currentStageColor = columns.find(c => c.id === stage)?.color || '#374DA4';

  const copyPhone = () => {
    navigator.clipboard.writeText(conversation.contact_phone);
    toast.success('Telefone copiado');
  };

  const openWhatsApp = () => {
    const phone = conversation.contact_phone.replace(/\D/g, '');
    window.open(`https://wa.me/${phone}`, '_blank');
  };

  const handleStageChange = async (newStage: string) => {
    setStage(newStage);
    const { error } = await supabase
      .from('whatsapp_conversations')
      .update({ pipeline_stage: newStage })
      .eq('id', conversation.id);
    if (error) { toast.error('Erro ao mudar coluna', { description: error.message }); return; }
    onStageChange?.(conversation.id, newStage);
    onLocalUpdate?.({ id: conversation.id, pipeline_stage: newStage });
    toast.success('Coluna atualizada');
  };

  const saveNotes = async () => {
    setSavingNotes(true);
    const { error } = await supabase
      .from('whatsapp_conversations')
      .update({ notes })
      .eq('id', conversation.id);
    setSavingNotes(false);
    if (error) { toast.error('Erro ao salvar', { description: error.message }); return; }
    onLocalUpdate?.({ id: conversation.id, notes });
    toast.success('Anotações salvas');
  };

  const saveDealValue = async () => {
    const num = parseFloat(dealValue.replace(',', '.'));
    if (isNaN(num) || num < 0) { toast.error('Valor inválido'); return; }
    setSavingDeal(true);
    const merged = { ...(scoreData || {}), deal_value: num, deal_value_manual: true };
    const { error } = await supabase
      .from('whatsapp_conversations')
      .update({ lead_score_data: merged })
      .eq('id', conversation.id);
    setSavingDeal(false);
    if (error) { toast.error('Erro ao salvar valor', { description: error.message }); return; }
    onLocalUpdate?.({ id: conversation.id, lead_score_data: merged });
    toast.success('Valor da negociação atualizado');
  };

  const setMode = async (mode: 'bot' | 'human' | 'paused') => {
    if (mode === currentMode) return;
    setSavingMode(true);
    const patch: any = {};
    if (mode === 'bot') {
      patch.ai_auto_reply_enabled = true;
      patch.human_takeover = false;
      patch.human_takeover_at = null;
      patch.human_takeover_reason = null;
    } else if (mode === 'human') {
      patch.ai_auto_reply_enabled = false;
      patch.human_takeover = true;
      patch.human_takeover_at = new Date().toISOString();
      patch.human_takeover_reason = 'Assumido manualmente pelo atendente';
    } else {
      patch.ai_auto_reply_enabled = false;
      patch.human_takeover = false;
      patch.human_takeover_at = null;
      patch.human_takeover_reason = null;
    }
    const { error } = await supabase.from('whatsapp_conversations').update(patch).eq('id', conversation.id);
    setSavingMode(false);
    if (error) { toast.error('Erro', { description: error.message }); return; }
    onLocalUpdate?.({ id: conversation.id, ...patch });
    toast.success(
      mode === 'bot' ? 'Chatbot IA no comando' :
      mode === 'human' ? 'Atendimento humano ativo' :
      'Atendimento pausado'
    );
  };

  const setAgent = async (agentId: string) => {
    setSavingAgent(true);
    const value = agentId === '__none__' ? null : agentId;
    const { error } = await supabase
      .from('whatsapp_conversations')
      .update({ ai_agent_id: value })
      .eq('id', conversation.id);
    setSavingAgent(false);
    if (error) { toast.error('Erro ao trocar agente', { description: error.message }); return; }
    onLocalUpdate?.({ id: conversation.id, ai_agent_id: value });
    toast.success(value ? 'Agente de IA atribuído' : 'Agente removido');
  };

  const setAssignee = async (userId: string) => {
    setSavingAssignee(true);
    const value = userId === '__none__' ? null : userId;
    const { error } = await supabase
      .from('whatsapp_conversations')
      .update({ assigned_user_id: value })
      .eq('id', conversation.id);
    setSavingAssignee(false);
    if (error) { toast.error('Erro ao atribuir', { description: error.message }); return; }
    onLocalUpdate?.({ id: conversation.id, assigned_user_id: value });
    toast.success(value ? 'Conversa atribuída' : 'Atribuição removida');
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md p-0 flex flex-col gap-0">
        {/* Header */}
        <SheetHeader className="p-5 pb-4 border-b border-border/60 bg-gradient-to-br from-[#374DA4]/[0.04] via-background to-background">
          <div className="flex items-start gap-3">
            <Avatar className="h-14 w-14 ring-2 ring-background shadow-md">
              <AvatarImage src={conversation.profile_picture} />
              <AvatarFallback className="bg-gradient-to-br from-[#374DA4] to-[#007DE3] text-white text-sm font-bold">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <SheetTitle className="text-base leading-tight truncate">{displayName}</SheetTitle>
              <button
                onClick={copyPhone}
                className="mt-0.5 inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors group"
              >
                <Phone className="h-3 w-3" />
                <span className="tabular-nums">{conversation.contact_phone}</span>
                <Copy className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
              </button>
              <div className="flex flex-wrap gap-1 mt-2">
                {isHuman && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-orange-500/15 text-orange-600 dark:text-orange-400">
                    <UserIcon className="h-2.5 w-2.5" /> Humano
                  </span>
                )}
                {isBot && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-violet-500/15 text-violet-600 dark:text-violet-400">
                    <Bot className="h-2.5 w-2.5" /> Chatbot ativo
                  </span>
                )}
                {(conversation.unread_count || 0) > 0 && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-emerald-500/15 text-emerald-600">
                    {conversation.unread_count} não lidas
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Primary actions */}
          <div className="grid grid-cols-3 gap-2 mt-4">
            <Button
              onClick={() => onOpenChat(conversation)}
              className="h-9 bg-gradient-to-r from-[#374DA4] to-[#007DE3] hover:opacity-90 text-white text-xs"
            >
              <MessageSquare className="h-3.5 w-3.5 mr-1" />
              Conversa
            </Button>
            <Button
              variant="outline"
              onClick={() => onManageLabels(conversation)}
              className="h-9 text-xs"
            >
              <Tag className="h-3.5 w-3.5 mr-1" />
              Etiquetas
            </Button>
            <Button variant="outline" onClick={openWhatsApp} className="h-9 text-xs">
              <ExternalLink className="h-3.5 w-3.5 mr-1" />
              WhatsApp
            </Button>
          </div>
        </SheetHeader>

        {/* Body */}
        <ScrollArea className="flex-1">
          <div className="p-5 space-y-5">

            {/* Etapa (Coluna) */}
            <section className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Etapa do funil</Label>
                <span
                  className="inline-flex items-center gap-1.5 text-[10px] font-medium px-2 py-0.5 rounded-full"
                  style={{ backgroundColor: `${currentStageColor}18`, color: currentStageColor }}
                >
                  <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: currentStageColor }} />
                  {columns.find(c => c.id === stage)?.title || 'Sem etapa'}
                </span>
              </div>
              <Select value={stage} onValueChange={handleStageChange}>
                <SelectTrigger className="h-9"><SelectValue placeholder="Selecionar coluna" /></SelectTrigger>
                <SelectContent>
                  {columns.map(c => (
                    <SelectItem key={c.id} value={c.id}>
                      <span className="inline-flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: c.color }} />
                        {c.title}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </section>

            <Separator />

            {/* Modo de atendimento */}
            <section className="space-y-2">
              <Label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
                <Bot className="h-3 w-3" /> Modo de atendimento
                {savingMode && <Loader2 className="h-3 w-3 animate-spin ml-1" />}
              </Label>
              <ToggleGroup
                type="single"
                value={currentMode}
                onValueChange={(v) => v && setMode(v as any)}
                className="grid grid-cols-3 gap-1.5 w-full"
              >
                <ToggleGroupItem
                  value="bot"
                  className="h-auto py-2 px-2 flex-col gap-1 border border-border/60 data-[state=on]:bg-violet-500/10 data-[state=on]:border-violet-500/40 data-[state=on]:text-violet-600 dark:data-[state=on]:text-violet-400"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  <span className="text-[10px] font-semibold">Chatbot IA</span>
                </ToggleGroupItem>
                <ToggleGroupItem
                  value="human"
                  className="h-auto py-2 px-2 flex-col gap-1 border border-border/60 data-[state=on]:bg-orange-500/10 data-[state=on]:border-orange-500/40 data-[state=on]:text-orange-600 dark:data-[state=on]:text-orange-400"
                >
                  <UserIcon className="h-3.5 w-3.5" />
                  <span className="text-[10px] font-semibold">Humano</span>
                </ToggleGroupItem>
                <ToggleGroupItem
                  value="paused"
                  className="h-auto py-2 px-2 flex-col gap-1 border border-border/60 data-[state=on]:bg-muted data-[state=on]:border-border"
                >
                  <PauseCircle className="h-3.5 w-3.5" />
                  <span className="text-[10px] font-semibold">Pausado</span>
                </ToggleGroupItem>
              </ToggleGroup>
              <p className="text-[10px] text-muted-foreground italic">
                {currentMode === 'bot' && 'A IA responde automaticamente às mensagens.'}
                {currentMode === 'human' && 'Somente o atendente responde. IA em standby.'}
                {currentMode === 'paused' && 'Nenhuma resposta automática será enviada.'}
              </p>
            </section>

            {/* Agente de IA */}
            {aiAgents.length > 0 && (
              <section className="space-y-2">
                <Label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
                  <Sparkles className="h-3 w-3" /> Agente de IA
                  {savingAgent && <Loader2 className="h-3 w-3 animate-spin ml-1" />}
                </Label>
                <Select value={conversation.ai_agent_id || '__none__'} onValueChange={setAgent}>
                  <SelectTrigger className="h-9"><SelectValue placeholder="Nenhum agente" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">
                      <span className="text-muted-foreground">Nenhum agente</span>
                    </SelectItem>
                    {aiAgents.map(a => (
                      <SelectItem key={a.id} value={a.id}>
                        <span className="inline-flex items-center gap-2">
                          <Sparkles className="h-3 w-3 text-violet-500" />
                          {a.name}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </section>
            )}

            {/* Atribuir a atendente */}
            <section className="space-y-2">
              <Label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
                <Users className="h-3 w-3" /> Atendente responsável
                {savingAssignee && <Loader2 className="h-3 w-3 animate-spin ml-1" />}
              </Label>
              <Select value={conversation.assigned_user_id || '__none__'} onValueChange={setAssignee}>
                <SelectTrigger className="h-9"><SelectValue placeholder="Ninguém atribuído" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">
                    <span className="text-muted-foreground">Ninguém atribuído</span>
                  </SelectItem>
                  {teammates.map(t => (
                    <SelectItem key={t.user_id} value={t.user_id}>
                      <span className="inline-flex items-center gap-2">
                        <Avatar className="h-4 w-4">
                          <AvatarImage src={t.avatar_url || undefined} />
                          <AvatarFallback className="text-[8px]">{t.name.substring(0, 2).toUpperCase()}</AvatarFallback>
                        </Avatar>
                        {t.name}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </section>

            {/* Valor da negociação */}
            <section className="space-y-2">
              <Label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
                <DollarSign className="h-3 w-3" /> Valor da negociação
              </Label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">R$</span>
                  <Input
                    type="number"
                    inputMode="decimal"
                    value={dealValue}
                    onChange={(e) => setDealValue(e.target.value)}
                    placeholder="0"
                    className="h-9 pl-8 tabular-nums"
                  />
                </div>
                <Button onClick={saveDealValue} disabled={savingDeal} size="sm" className="h-9">
                  {savingDeal ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                </Button>
              </div>
              {scoreData?.deal_reason && !scoreData?.deal_value_manual && (
                <p className="text-[10px] text-muted-foreground italic flex items-start gap-1">
                  <TrendingUp className="h-3 w-3 mt-0.5 flex-shrink-0" />
                  Sugestão IA: {scoreData.deal_reason}
                </p>
              )}
            </section>

            <Separator />

            {/* Etiquetas */}
            <section className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
                  <Tag className="h-3 w-3" /> Etiquetas
                </Label>
                <button
                  onClick={() => onManageLabels(conversation)}
                  className="text-[11px] text-[#374DA4] font-medium hover:underline"
                >
                  Gerenciar
                </button>
              </div>
              {conversationLabels.length === 0 ? (
                <button
                  onClick={() => onManageLabels(conversation)}
                  className="w-full text-xs text-muted-foreground py-3 border border-dashed border-border/60 rounded-lg hover:border-[#374DA4]/40 hover:text-foreground transition-colors"
                >
                  + Adicionar etiqueta
                </button>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {conversationLabels.map(l => (
                    <span
                      key={l.id}
                      className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-1 rounded-full"
                      style={{ backgroundColor: `${l.color}18`, color: l.color }}
                    >
                      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: l.color }} />
                      {l.name}
                    </span>
                  ))}
                </div>
              )}
            </section>

            <Separator />

            {/* Notas */}
            <section className="space-y-2">
              <Label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
                <StickyNote className="h-3 w-3" /> Anotações
              </Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Ex.: cliente quer proposta até sexta..."
                rows={4}
                className="text-xs resize-none"
              />
              <Button
                onClick={saveNotes}
                disabled={savingNotes || notes === (conversation.notes || '')}
                size="sm"
                variant="outline"
                className="w-full h-8 text-xs"
              >
                {savingNotes ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Save className="h-3.5 w-3.5 mr-1" />}
                Salvar anotações
              </Button>
            </section>

            <Separator />

            {/* Última interação */}
            <section className="space-y-2">
              <Label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
                <Clock className="h-3 w-3" /> Última mensagem
              </Label>
              <div className="rounded-lg bg-muted/40 p-3 border border-border/40">
                <p className="text-xs text-foreground line-clamp-3 leading-relaxed">
                  {conversation.last_message || <span className="italic text-muted-foreground">Sem mensagens</span>}
                </p>
                <p className="text-[10px] text-muted-foreground mt-1.5 tabular-nums">
                  {formatDate(conversation.last_message_at)}
                </p>
              </div>
            </section>

            <Separator />

            {/* Salvar como Lead */}
            <Button
              variant="outline"
              onClick={() => onSaveLead(conversation)}
              className="w-full h-9 text-xs"
            >
              <UserPlus className="h-3.5 w-3.5 mr-1.5" />
              Salvar como Lead no CRM
            </Button>
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
};

export default KanbanLeadPanel;