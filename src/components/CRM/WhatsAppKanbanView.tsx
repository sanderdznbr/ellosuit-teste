import React, { useState, useEffect, useRef } from 'react';
import { DndContext, DragEndEvent, closestCorners, DragOverlay, DragStartEvent, useDroppable, PointerSensor, TouchSensor, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, horizontalListSortingStrategy, arrayMove } from '@dnd-kit/sortable';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { MessageSquare, Tag, UserPlus, Settings, MoreHorizontal, GripVertical, Inbox, Bot, User, Sparkles, Play, Pause, Atom, Wand2, Loader2, Zap, ArrowRight, MoveRight, Thermometer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search, X, Filter, Users, Mail, MailOpen } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import SwipeToConfirm from './SwipeToConfirm';
import { Avatar as AvatarComp } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import KanbanAIOrganizer from './KanbanAIOrganizer';
import KanbanAutomationDialog from './KanbanAutomationDialog';
import KanbanLeadPanel from './KanbanLeadPanel';
import KanbanCardActionsDialog from './KanbanCardActionsDialog';
import LeadScoreBadge from './LeadScoreBadge';
import type { LeadScoreData } from '@/lib/leadScore';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface ConversationLabel {
  id: string;
  name: string;
  color: string;
}

interface WhatsAppConversationData {
  id: string;
  contact_phone: string;
  contact_name?: string;
  last_message_at: string;
  last_message?: string;
  status: string;
  unread_count?: number;
  profile_picture?: string;
  pipeline_stage?: string;
  labels?: string[];
  is_demo?: boolean;
  typing_status?: string | null;
  typing_updated_at?: string;
  human_takeover?: boolean;
  ai_auto_reply_enabled?: boolean;
  ai_agent_id?: string | null;
  assigned_user_id?: string | null;
  temperature_stage?: string | null;
}

export interface KanbanColumn {
  id: string;
  title: string;
  color: string;
}

export const DEFAULT_COLUMNS: KanbanColumn[] = [
  { id: 'novo', title: 'Novos', color: '#374DA4' },
  { id: 'em_atendimento', title: 'Em Atendimento', color: '#F59E0B' },
  { id: 'aguardando', title: 'Aguardando', color: '#8B5CF6' },
  { id: 'qualificado', title: 'Qualificados', color: '#10B981' },
  { id: 'finalizado', title: 'Finalizados', color: '#6B7280' },
];

export const TEMPERATURE_COLUMNS: KanbanColumn[] = [
  { id: 'frio', title: 'Frio', color: '#60A5FA' },
  { id: 'morno', title: 'Morno', color: '#F59E0B' },
  { id: 'quente', title: 'Quente', color: '#EF4444' },
  { id: 'negociando', title: 'Negociando', color: '#8B5CF6' },
  { id: 'pagou', title: 'Pagou', color: '#10B981' },
  { id: 'perdido', title: 'Perdido', color: '#6B7280' },
];

interface KanbanCardProps {
  conversation: WhatsAppConversationData;
  labels: ConversationLabel[];
  onSelect: (conv: WhatsAppConversationData) => void;
  onSaveLead: (conv: WhatsAppConversationData) => void;
  onManageLabels: (conv: WhatsAppConversationData) => void;
  onToggleBot: (conv: WhatsAppConversationData) => void;
  stage?: string;
}

const KanbanCard: React.FC<KanbanCardProps> = ({ 
  conversation, 
  labels, 
  onSelect,
  onSaveLead,
  onManageLabels,
  onToggleBot,
  stage,
}) => {
  const [dealValue, setDealValue] = useState<number | null>(null);
  const [dealReason, setDealReason] = useState<string | null>(null);
  const formatBRL = (n: number) =>
    n >= 1000
      ? n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
      : n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: conversation.id,
    data: { type: 'card', columnId: stage || conversation.pipeline_stage || 'novo' },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const formatTime = (date: string) => {
    const d = new Date(date);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    const minutes = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(diff / (1000 * 60 * 60));
    
    if (minutes < 1) return 'Agora';
    if (minutes < 60) return `${minutes}min`;
    if (hours < 24) return `${hours}h`;
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  };

  const conversationLabels = labels.filter(l => 
    conversation.labels?.includes(l.id)
  );

  const hasUnread = (conversation.unread_count || 0) > 0;
  const isHuman = !!conversation.human_takeover;
  // Default do sistema: se não houver takeover humano, o chatbot é quem está atendendo.
  // (ai_auto_reply_enabled só é falso quando explicitamente pausado pelo usuário)
  const isBot = !isHuman && conversation.ai_auto_reply_enabled !== false;

  const handleInteractiveClick = (e: React.MouseEvent | React.PointerEvent, callback: () => void) => {
    e.stopPropagation();
    e.preventDefault();
    callback();
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={cn(
        "group bg-card/80 backdrop-blur-sm rounded-xl border border-border/60 transition-all duration-200 cursor-pointer",
        "hover:shadow-md hover:-translate-y-0.5 hover:border-[#374DA4]/40",
        isDragging && "opacity-40 rotate-2 scale-105 shadow-2xl"
      )}
      onClick={() => onSelect(conversation)}
    >
      {/* Compact card */}
      <div className="p-2.5">
        <div className="flex items-start gap-2">
          {/* Drag hint (whole card is draggable) */}
          <div
            className="opacity-0 group-hover:opacity-40 transition-opacity mt-1 flex-shrink-0 cursor-grab active:cursor-grabbing pointer-events-none"
            title="Arrastar"
          >
            <GripVertical className="h-3 w-3 text-muted-foreground" />
          </div>

          {/* Avatar */}
          <div className="relative flex-shrink-0">
            <Avatar className="h-8 w-8 ring-1 ring-background shadow-sm">
              <AvatarImage src={conversation.profile_picture} />
              <AvatarFallback className="bg-gradient-to-br from-[#374DA4]/20 to-[#374DA4]/5 text-[#374DA4] text-[10px] font-bold">
                {(conversation.contact_name || conversation.contact_phone).substring(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
          </div>
          
          <div className="flex-1 min-w-0">
            {/* Name + time */}
            <div className="flex items-center justify-between gap-1.5">
              <div className="flex items-center gap-1 min-w-0">
                <span className="text-[12px] truncate font-semibold text-foreground/90">
                  {conversation.contact_name || conversation.contact_phone}
                </span>
                <LeadScoreBadge
                  conversationId={conversation.id}
                  contactName={conversation.contact_name}
                  lastMessage={conversation.last_message}
                  lastMessageAt={conversation.last_message_at}
                  onScored={(d: LeadScoreData | null) => {
                    setDealValue(d?.deal_value ?? null);
                    setDealReason(d?.deal_reason ?? null);
                  }}
                />
              </div>
              <span className="text-[9px] text-muted-foreground/70 flex-shrink-0 tabular-nums">
                {formatTime(conversation.last_message_at)}
              </span>
            </div>

            {/* Last message (single line) */}
            <p className="text-[11px] truncate leading-snug text-muted-foreground mt-0.5">
              {conversation.last_message || ''}
            </p>

            {/* Bottom row: badges + deal value */}
            <div className="flex items-center justify-between gap-1.5 mt-1.5">
              <div className="flex items-center gap-1 min-w-0">
                {isHuman && (
                  <span title="Humano" className="inline-flex items-center justify-center w-4 h-4 rounded-md bg-orange-500/15 text-orange-600 dark:text-orange-400">
                    <User className="h-2.5 w-2.5" />
                  </span>
                )}
                {isBot && (
                  <span title="Chatbot" className="inline-flex items-center justify-center w-4 h-4 rounded-md bg-violet-500/15 text-violet-600 dark:text-violet-400">
                    <Bot className="h-2.5 w-2.5" />
                  </span>
                )}
                {hasUnread && (
                  <span className="inline-flex items-center justify-center min-w-[16px] h-4 px-1 rounded-full bg-emerald-500 text-white text-[9px] font-bold tabular-nums">
                    {conversation.unread_count}
                  </span>
                )}
              </div>
              {dealValue != null && dealValue > 0 && (
                <span
                  title={dealReason || 'Valor detectado pela IA'}
                  className="inline-flex items-center text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 tabular-nums"
                >
                  {formatBRL(dealValue)}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Labels — inline compact */}
        {conversationLabels.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2 pl-[26px]">
            {conversationLabels.slice(0, 3).map(label => (
              <span
                key={label.id}
                className="inline-flex items-center text-[9px] font-medium px-1.5 py-0 rounded-full h-4"
                style={{ backgroundColor: `${label.color}18`, color: label.color }}
              >
                <span className="w-1 h-1 rounded-full mr-1" style={{ backgroundColor: label.color }} />
                {label.name}
              </span>
            ))}
            {conversationLabels.length > 3 && (
              <span className="text-[9px] text-muted-foreground px-1">+{conversationLabels.length - 3}</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

// Droppable Column Component
const DroppableColumn: React.FC<{
  column: KanbanColumn;
  children: React.ReactNode;
}> = ({ column, children }) => {
  const { setNodeRef, isOver } = useDroppable({
    id: column.id,
    data: { type: 'column-body', columnId: column.id },
  });

  return (
    <div 
      ref={setNodeRef}
      className={cn(
        "space-y-1.5 min-h-[120px] transition-all duration-300 rounded-lg p-1",
        isOver && "bg-[#374DA4]/5 ring-2 ring-[#374DA4]/30 ring-offset-2 ring-offset-background scale-[1.01]"
      )}
    >
      {children}
    </div>
  );
};

// Sortable column wrapper — makes the entire column draggable via its drag handle.
const SortableColumn: React.FC<{
  column: KanbanColumn;
  count: number;
  children: React.ReactNode;
}> = ({ column, count, children }) => {
  const {
    attributes, listeners, setNodeRef, transform, transition, isDragging,
  } = useSortable({ id: `col:${column.id}`, data: { type: 'column', columnId: column.id } });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex-shrink-0 w-[260px] flex flex-col rounded-xl bg-muted/30 backdrop-blur-sm border border-border/40 shadow-sm",
        isDragging && "opacity-50 ring-2 ring-[#374DA4]/40 z-20"
      )}
    >
      {/* Column header (drag handle here) */}
      <div className="px-3 py-2.5 flex items-center justify-between">
        <div className="flex items-center gap-1.5 flex-1 min-w-0">
          <button
            {...attributes}
            {...listeners}
            title="Arrastar coluna"
            className="cursor-grab active:cursor-grabbing text-muted-foreground/40 hover:text-muted-foreground p-0.5 -ml-0.5"
          >
            <GripVertical className="h-3.5 w-3.5" />
          </button>
          <div
            className="w-2.5 h-2.5 rounded-full shadow-sm flex-shrink-0"
            style={{ backgroundColor: column.color, boxShadow: `0 0 0 2px ${column.color}25` }}
          />
          <h3 className="font-semibold text-[13px] text-foreground tracking-tight truncate">
            {column.title}
          </h3>
          <span
            className="text-[10px] font-bold px-1.5 py-0 rounded-full tabular-nums flex-shrink-0"
            style={{ backgroundColor: `${column.color}15`, color: column.color }}
          >
            {count}
          </span>
        </div>
        <button className="p-0.5 rounded hover:bg-background/80 transition-colors text-muted-foreground/50 hover:text-muted-foreground flex-shrink-0">
          <MoreHorizontal className="h-3.5 w-3.5" />
        </button>
      </div>
      {children}
    </div>
  );
};

interface WhatsAppKanbanViewProps {
  conversations: WhatsAppConversationData[];
  labels: ConversationLabel[];
  columns: KanbanColumn[];
  companyId: string | null;
  teammates?: Array<{ user_id: string; name: string; avatar_url?: string | null }>;
  aiAgents?: Array<{ id: string; name: string }>;
  onSelectConversation: (conv: WhatsAppConversationData) => void;
  onSaveLead: (conv: WhatsAppConversationData) => void;
  onManageLabels: (conv: WhatsAppConversationData) => void;
  onUpdateStage: (conversationId: string, newStage: string, reason?: string) => void;
  onConfigureColumns: () => void;
  onColumnsChange?: (cols: KanbanColumn[]) => void;
}

const WhatsAppKanbanView: React.FC<WhatsAppKanbanViewProps> = ({
  conversations,
  labels,
  columns,
  companyId,
  teammates = [],
  aiAgents = [],
  onSelectConversation,
  onSaveLead,
  onManageLabels,
  onUpdateStage,
  onConfigureColumns,
  onColumnsChange,
}) => {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [stageChangePrompt, setStageChangePrompt] = useState<null | {
    conversationId: string;
    sourceStage: string;
    targetStage: string;
    overCardId?: string;
    contactName: string;
  }>(null);
  const [stageChangeReason, setStageChangeReason] = useState('');
  const [savingStageChange, setSavingStageChange] = useState(false);
  const [leadPanelOpen, setLeadPanelOpen] = useState(false);
  const [actionsOpen, setActionsOpen] = useState(false);
  const [actionsConversation, setActionsConversation] = useState<WhatsAppConversationData | null>(null);
  const [leadPanelConversation, setLeadPanelConversation] = useState<WhatsAppConversationData | null>(null);
  const [aiOrganizerOpen, setAiOrganizerOpen] = useState(false);
  const [automationOpen, setAutomationOpen] = useState(false);
  const [reclassifying, setReclassifying] = useState(false);
  const [classifyingTemp, setClassifyingTemp] = useState(false);
  const tempAutoRanRef = useRef(false);
  const customAutoRanRef = useRef(false);
  const [tempReady, setTempReady] = useState(false);
  const [customReady, setCustomReady] = useState(false);
  const [search, setSearch] = useState('');
  const [filterAssignee, setFilterAssignee] = useState<string>('all'); // 'all' | 'unassigned' | user_id
  const [filterMode, setFilterMode] = useState<string>('all'); // 'all' | 'bot' | 'human' | 'paused'
  const [filterLabels, setFilterLabels] = useState<string[]>([]);
  const [filterUnread, setFilterUnread] = useState(false);
  const [filterAgent, setFilterAgent] = useState<string>('all'); // 'all' | agent_id | 'none'
  const [filterOpen, setFilterOpen] = useState(false);

  // Board mode: customizable pipeline vs temperature pipeline
  const boardModeKey = `kanban_board_mode_${companyId || 'anon'}`;
  const [boardMode, setBoardModeState] = useState<'custom' | 'temperature'>(() => {
    if (typeof window === 'undefined') return 'custom';
    return (localStorage.getItem(`kanban_board_mode_${companyId || 'anon'}`) as any) === 'temperature' ? 'temperature' : 'custom';
  });
  const setBoardMode = (mode: 'custom' | 'temperature') => {
    setBoardModeState(mode);
    try { localStorage.setItem(boardModeKey, mode); } catch {}
  };
  const isTemperature = boardMode === 'temperature';
  const activeColumns = isTemperature ? TEMPERATURE_COLUMNS : columns;
  const boardBusy = isTemperature
    ? (classifyingTemp || !tempReady)
    : (reclassifying || !customReady);

  // Optimistic temperature overrides (conversationId -> stage)
  const [tempStages, setTempStages] = useState<Record<string, string>>({});
  const stageOf = (c: WhatsAppConversationData) =>
    isTemperature
      ? (tempStages[c.id] || (c as any).temperature_stage || 'frio')
      : (c.pipeline_stage || 'novo');

  // Per-column card ordering, persisted in localStorage
  const cardOrderKey = `kanban_card_order_${companyId || 'anon'}_${boardMode}`;
  const [cardOrder, setCardOrder] = useState<Record<string, string[]>>({});

  useEffect(() => {
    try {
      const raw = localStorage.getItem(cardOrderKey);
      setCardOrder(raw ? JSON.parse(raw) : {});
    } catch { setCardOrder({}); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cardOrderKey]);

  useEffect(() => {
    try { localStorage.setItem(cardOrderKey, JSON.stringify(cardOrder)); } catch {}
  }, [cardOrder, cardOrderKey]);

  const normalizedSearch = search.trim().toLowerCase();
  const filteredConversations = conversations.filter(c => {
    if (normalizedSearch) {
      const hay = `${c.contact_name || ''} ${c.contact_phone || ''} ${c.last_message || ''}`.toLowerCase();
      if (!hay.includes(normalizedSearch)) return false;
    }
    if (filterAssignee !== 'all') {
      if (filterAssignee === 'unassigned' && c.assigned_user_id) return false;
      if (filterAssignee !== 'unassigned' && c.assigned_user_id !== filterAssignee) return false;
    }
    if (filterMode !== 'all') {
      const isHuman = !!c.human_takeover;
      const isBot = !isHuman && c.ai_auto_reply_enabled !== false;
      const isPaused = !isHuman && c.ai_auto_reply_enabled === false;
      if (filterMode === 'bot' && !isBot) return false;
      if (filterMode === 'human' && !isHuman) return false;
      if (filterMode === 'paused' && !isPaused) return false;
    }
    if (filterAgent !== 'all') {
      if (filterAgent === 'none' && c.ai_agent_id) return false;
      if (filterAgent !== 'none' && c.ai_agent_id !== filterAgent) return false;
    }
    if (filterLabels.length > 0) {
      const cl = c.labels || [];
      if (!filterLabels.every(l => cl.includes(l))) return false;
    }
    if (filterUnread && (c.unread_count || 0) === 0) return false;
    return true;
  });

  const activeFilterCount =
    (filterAssignee !== 'all' ? 1 : 0) +
    (filterMode !== 'all' ? 1 : 0) +
    (filterAgent !== 'all' ? 1 : 0) +
    (filterLabels.length > 0 ? 1 : 0) +
    (filterUnread ? 1 : 0);

  const clearFilters = () => {
    setFilterAssignee('all');
    setFilterMode('all');
    setFilterAgent('all');
    setFilterLabels([]);
    setFilterUnread(false);
  };

  const toggleLabelFilter = (id: string) => {
    setFilterLabels(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const handleReclassify = async (silent = false) => {
    if (reclassifying) return;
    if (!conversations.length) {
      if (!silent) toast.info('Sem conversas para reclassificar');
      return;
    }
    setReclassifying(true);
    const t = silent ? null : toast.loading('Reclassificando leads com IA...');
    try {
      const payload = conversations.slice(0, 300).map(c => ({
        id: c.id,
        contact_name: c.contact_name || '',
        last_message: (c.last_message || '').slice(0, 200),
        current_stage: c.pipeline_stage || '',
        bot_active: !!c.ai_auto_reply_enabled && !c.human_takeover,
        human_takeover: !!c.human_takeover,
      }));
      const { data, error } = await supabase.functions.invoke('kanban-organize-ai', {
        body: { mode: 'classify', columns, conversations: payload },
      });
      if (error) throw error;
      const assignments: Array<{ id: string; stage: string }> = data?.assignments ?? [];
      const byStage = new Map<string, string[]>();
      for (const a of assignments) {
        if (!columns.some(c => c.id === a.stage)) continue;
        if (!byStage.has(a.stage)) byStage.set(a.stage, []);
        byStage.get(a.stage)!.push(a.id);
      }
      await Promise.all(
        Array.from(byStage.entries()).map(([stage, ids]) =>
          supabase.from('whatsapp_conversations').update({ pipeline_stage: stage }).in('id', ids)
        )
      );
      if (t) toast.success(`${assignments.length} leads reclassificados`, { id: t });
    } catch (e: any) {
      if (t) toast.error('Erro ao reclassificar', { id: t, description: e.message });
      else console.error('kanban reclassify failed', e);
    } finally {
      setReclassifying(false);
    }
  };

  const handleCardClick = (conv: WhatsAppConversationData) => {
    setActionsConversation(conv);
    setActionsOpen(true);
  };

  const handleMoveStageFromDialog = (conv: WhatsAppConversationData, targetStage: string) => {
    const source = stageOf(conv);
    if (source === targetStage) return;
    if (isTemperature) {
      moveTemperature(conv.id, source, targetStage);
    } else {
      reorderCards(conv.id, source, targetStage);
      onUpdateStage(conv.id, targetStage);
      const col = columns.find(c => c.id === targetStage);
      toast.success(`Movido para ${col?.title || targetStage}`);
    }
  };

  const openChatFromPanel = (conv: WhatsAppConversationData) => {
    // Abre a conversa real na view "Conversas" (sem sidebar/pop-up)
    onSelectConversation(conv);
  };

  const handleToggleBot = async (conv: WhatsAppConversationData) => {
    const enabling = !conv.ai_auto_reply_enabled;
    const patch: any = { ai_auto_reply_enabled: enabling };
    if (enabling) {
      patch.human_takeover = false;
      patch.human_takeover_at = null;
      patch.human_takeover_reason = null;
    }
    const { error } = await supabase.from('whatsapp_conversations').update(patch).eq('id', conv.id);
    if (error) { toast.error('Erro', { description: error.message }); return; }
    toast.success(enabling ? 'Chatbot ativado' : 'Chatbot pausado');
  };

  const getConversationsByStage = (stage: string) => {
    const list = filteredConversations.filter(c => stageOf(c) === stage);
    const order = cardOrder[stage] || [];
    if (order.length === 0) return list;
    const indexById = new Map(order.map((id, i) => [id, i] as const));
    return [...list].sort((a, b) => {
      const ai = indexById.has(a.id) ? indexById.get(a.id)! : Number.MAX_SAFE_INTEGER;
      const bi = indexById.has(b.id) ? indexById.get(b.id)! : Number.MAX_SAFE_INTEGER;
      if (ai === bi) return 0;
      return ai - bi;
    });
  };

  const handleDragStart = (event: DragStartEvent) => {
    const activeType = event.active.data.current?.type;
    if (activeType === 'column') {
      // no floating card overlay for columns
      setActiveId(null);
    } else {
      setActiveId(event.active.id as string);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
    if (!over) return;

    const activeType = active.data.current?.type;

    // COLUMN reorder (only on the customizable board)
    if (activeType === 'column') {
      if (isTemperature) return;
      if (active.id === over.id) return;
      const activeColId = (active.data.current?.columnId as string) || String(active.id).replace(/^col:/, '');
      const overColId = (over.data.current?.columnId as string) || String(over.id).replace(/^col:/, '');
      const oldIndex = columns.findIndex(c => c.id === activeColId);
      const newIndex = columns.findIndex(c => c.id === overColId);
      if (oldIndex < 0 || newIndex < 0 || oldIndex === newIndex) return;
      const next = arrayMove(columns, oldIndex, newIndex);
      onColumnsChange?.(next);
      return;
    }

    // CARD move / reorder
    const conversationId = active.id as string;
    const conv = conversations.find(c => c.id === conversationId);
    if (!conv) return;

    const overType = over.data.current?.type;
    let targetStage: string | undefined;
    let overCardId: string | undefined;

    if (overType === 'card') {
      targetStage = over.data.current?.columnId as string;
      overCardId = over.id as string;
    } else if (overType === 'column-body') {
      targetStage = (over.data.current?.columnId as string) || (over.id as string);
    } else if (activeColumns.some(c => c.id === over.id)) {
      targetStage = over.id as string;
    }

    if (!targetStage || !activeColumns.some(c => c.id === targetStage)) return;

    const sourceStage = stageOf(conv);

    if (sourceStage === targetStage) {
      // Same-column reorder: apply immediately, no reason required.
      setCardOrder(prev => {
        const next: Record<string, string[]> = { ...prev };
        const baseTarget = next[targetStage!]
          ? [...next[targetStage!]]
          : filteredConversations.filter(c => stageOf(c) === targetStage).map(c => c.id);
        const cleanTarget = baseTarget.filter(id => id !== conversationId);
        const insertIdx = overCardId ? Math.max(0, cleanTarget.indexOf(overCardId)) : cleanTarget.length;
        cleanTarget.splice(insertIdx, 0, conversationId);
        next[targetStage!] = cleanTarget;
        return next;
      });
      return;
    }

    // Temperature board: move instantly, no reason required.
    if (isTemperature) {
      moveTemperature(conversationId, sourceStage, targetStage, overCardId);
      return;
    }

    // Cross-column move: ask for a reason before persisting.
    setStageChangeReason('');
    setStageChangePrompt({
      conversationId,
      sourceStage,
      targetStage,
      overCardId,
      contactName: conv.contact_name || conv.contact_phone,
    });
  };

  const reorderCards = (conversationId: string, sourceStage: string, targetStage: string, overCardId?: string) => {
    setCardOrder(prev => {
      const next: Record<string, string[]> = { ...prev };
      const currentSource = (next[sourceStage] || filteredConversations.filter(c => stageOf(c) === sourceStage).map(c => c.id));
      next[sourceStage] = currentSource.filter(id => id !== conversationId);
      const baseTarget = next[targetStage]
        ? [...next[targetStage]]
        : filteredConversations.filter(c => stageOf(c) === targetStage).map(c => c.id);
      const cleanTarget = baseTarget.filter(id => id !== conversationId);
      const insertIdx = overCardId ? Math.max(0, cleanTarget.indexOf(overCardId)) : cleanTarget.length;
      cleanTarget.splice(insertIdx, 0, conversationId);
      next[targetStage] = cleanTarget;
      return next;
    });
  };

  const moveTemperature = async (conversationId: string, sourceStage: string, targetStage: string, overCardId?: string) => {
    reorderCards(conversationId, sourceStage, targetStage, overCardId);
    setTempStages(prev => ({ ...prev, [conversationId]: targetStage }));
    const { error } = await supabase
      .from('whatsapp_conversations')
      .update({ temperature_stage: targetStage } as any)
      .eq('id', conversationId);
    if (error) {
      setTempStages(prev => ({ ...prev, [conversationId]: sourceStage }));
      toast.error('Erro ao mover', { description: error.message });
      return;
    }
    const col = TEMPERATURE_COLUMNS.find(c => c.id === targetStage);
    toast.success(`Movido para ${col?.title || targetStage}`);
  };

  const handleClassifyTemperature = async (silent = false) => {
    if (classifyingTemp) return;
    if (!conversations.length) {
      if (!silent) toast.info('Sem conversas para classificar');
      return;
    }
    setClassifyingTemp(true);
    const t = silent ? null : toast.loading('Analisando temperatura dos leads com IA...');
    try {
      const { data, error } = await supabase.functions.invoke('crm-temperature-classifier', {
        body: { conversationIds: conversations.slice(0, 200).map(c => c.id) },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      const assignments: Array<{ id: string; stage: string }> = data?.assignments ?? [];
      if (assignments.length) {
        setTempStages(prev => {
          const next = { ...prev };
          for (const a of assignments) next[a.id] = a.stage;
          return next;
        });
      }
      if (t) toast.success(`${assignments.length} leads classificados por temperatura`, { id: t });
    } catch (e: any) {
      if (t) toast.error('Erro ao classificar', { id: t, description: e.message });
      else console.error('temperature classify failed', e);
    } finally {
      setClassifyingTemp(false);
    }
  };

  // Auto-classify once when entering temperature mode with unclassified leads
  useEffect(() => {
    if (!isTemperature || tempAutoRanRef.current) return;
    if (!conversations.length) { setTempReady(true); return; }
    tempAutoRanRef.current = true;
    const unclassified = conversations.filter(c => !(c as any).temperature_stage).length;
    if (unclassified > 0) {
      handleClassifyTemperature(true).finally(() => setTempReady(true));
    } else {
      setTempReady(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isTemperature, conversations.length]);

  // Auto-organize the custom pipeline once before opening the columns
  useEffect(() => {
    if (isTemperature || customAutoRanRef.current) return;
    if (!conversations.length || !columns.length) { setCustomReady(true); return; }
    customAutoRanRef.current = true;
    const unclassified = conversations.filter(
      c => !c.pipeline_stage || !columns.some(col => col.id === c.pipeline_stage)
    ).length;
    if (unclassified > 0) {
      handleReclassify(true).finally(() => setCustomReady(true));
    } else {
      setCustomReady(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isTemperature, conversations.length, columns.length]);

  const confirmStageChange = async () => {
    if (!stageChangePrompt) return;
    const reason = stageChangeReason.trim();
    if (reason.length < 3) {
      toast.error('Escreva o motivo da mudança (mínimo 3 caracteres).');
      return;
    }
    const { conversationId, sourceStage, targetStage, overCardId } = stageChangePrompt;
    setSavingStageChange(true);
    try {
      reorderCards(conversationId, sourceStage, targetStage, overCardId);
      await onUpdateStage(conversationId, targetStage, reason);
      setStageChangePrompt(null);
      setStageChangeReason('');
    } finally {
      setSavingStageChange(false);
    }
  };

  const activeConversation = conversations.find(c => c.id === activeId);
  const totalConversations = filteredConversations.length;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 6 } }),
  );

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex flex-col h-full">
        {/* Refined toolbar — clean, editorial */}
        <div className="flex items-center gap-4 px-6 py-3 border-b border-border/60 bg-background/80 backdrop-blur-xl">
          <div className="flex items-baseline gap-2 flex-shrink-0">
            <h2 className="text-[15px] font-semibold text-foreground tracking-tight">{isTemperature ? 'Temperatura' : 'Pipeline'}</h2>
            <span className="text-xs text-muted-foreground tabular-nums">
              {totalConversations}
            </span>
          </div>

          {/* Search */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/70 pointer-events-none" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nome, telefone ou mensagem…"
              className="h-9 pl-9 pr-9 text-[13px] bg-muted/40 border-transparent focus-visible:bg-background focus-visible:border-border rounded-full"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-full text-muted-foreground/70 hover:text-foreground hover:bg-muted transition-colors"
                aria-label="Limpar busca"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-1.5 flex-shrink-0 ml-auto">
            {/* Filters */}
            <Popover open={filterOpen} onOpenChange={setFilterOpen}>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className={cn(
                    "relative inline-flex items-center gap-2 h-9 px-3 rounded-full text-[13px] font-medium transition-colors",
                    activeFilterCount > 0
                      ? "text-[#374DA4] bg-[#374DA4]/10 hover:bg-[#374DA4]/15"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                  )}
                >
                  <Filter className="h-3.5 w-3.5" />
                  <span className="hidden md:inline">Filtros</span>
                  {activeFilterCount > 0 && (
                    <span className="ml-0.5 inline-flex items-center justify-center min-w-[16px] h-4 px-1 rounded-full bg-[#374DA4] text-white text-[10px] font-bold tabular-nums">
                      {activeFilterCount}
                    </span>
                  )}
                </button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-[320px] p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold">Filtros</h4>
                  {activeFilterCount > 0 && (
                    <button onClick={clearFilters} className="text-[11px] text-[#374DA4] font-medium hover:underline">
                      Limpar tudo
                    </button>
                  )}
                </div>

                {/* Attendant */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Atendente</label>
                  <select
                    value={filterAssignee}
                    onChange={(e) => setFilterAssignee(e.target.value)}
                    className="w-full h-9 px-2 rounded-md border border-input bg-background text-[13px]"
                  >
                    <option value="all">Todos</option>
                    <option value="unassigned">Sem atendente</option>
                    {teammates.map(t => (
                      <option key={t.user_id} value={t.user_id}>{t.name}</option>
                    ))}
                  </select>
                </div>

                {/* Mode */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Modo de atendimento</label>
                  <div className="grid grid-cols-4 gap-1">
                    {[
                      { v: 'all', label: 'Todos' },
                      { v: 'bot', label: 'IA', icon: Bot },
                      { v: 'human', label: 'Humano', icon: User },
                      { v: 'paused', label: 'Pausado', icon: Pause },
                    ].map(o => (
                      <button
                        key={o.v}
                        onClick={() => setFilterMode(o.v)}
                        className={cn(
                          "h-8 rounded-md text-[11px] font-medium border transition-colors",
                          filterMode === o.v
                            ? "bg-[#374DA4] text-white border-[#374DA4]"
                            : "bg-background border-border text-muted-foreground hover:text-foreground hover:bg-muted/60"
                        )}
                      >
                        {o.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Agent */}
                {aiAgents.length > 0 && (
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Agente de IA</label>
                    <select
                      value={filterAgent}
                      onChange={(e) => setFilterAgent(e.target.value)}
                      className="w-full h-9 px-2 rounded-md border border-input bg-background text-[13px]"
                    >
                      <option value="all">Todos</option>
                      <option value="none">Sem agente</option>
                      {aiAgents.map(a => (
                        <option key={a.id} value={a.id}>{a.name}</option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Labels */}
                {labels.length > 0 && (
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Etiquetas</label>
                    <div className="flex flex-wrap gap-1.5 max-h-32 overflow-auto">
                      {labels.map(l => {
                        const active = filterLabels.includes(l.id);
                        return (
                          <button
                            key={l.id}
                            onClick={() => toggleLabelFilter(l.id)}
                            className={cn(
                              "inline-flex items-center gap-1 text-[11px] font-medium px-2 py-1 rounded-full border transition-all",
                              active ? "ring-2 ring-offset-1 ring-offset-background" : "opacity-70 hover:opacity-100"
                            )}
                            style={{
                              backgroundColor: active ? `${l.color}25` : `${l.color}12`,
                              color: l.color,
                              borderColor: active ? l.color : 'transparent',
                              ...(active ? { boxShadow: `0 0 0 1px ${l.color}` } : {}),
                            }}
                          >
                            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: l.color }} />
                            {l.name}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Unread */}
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={filterUnread}
                    onChange={(e) => setFilterUnread(e.target.checked)}
                    className="h-4 w-4 rounded border-border accent-[#374DA4]"
                  />
                  <span className="text-[13px]">Somente não lidas</span>
                </label>
              </PopoverContent>
            </Popover>

            {/* Board switch: Personalizado <-> Temperatura */}
            <button
              type="button"
              onClick={() => setBoardMode(isTemperature ? 'custom' : 'temperature')}
              title={isTemperature ? 'Voltar ao pipeline personalizado' : 'Abrir pipeline por temperatura (frio, morno, quente, pagou)'}
              className={cn(
                "inline-flex items-center gap-2 h-9 px-3 rounded-full text-[13px] font-medium transition-colors",
                isTemperature
                  ? "text-[#E4572E] bg-[#E4572E]/10 hover:bg-[#E4572E]/15"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
              )}
            >
              <Thermometer className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{isTemperature ? 'Personalizado' : 'Temperatura'}</span>
            </button>

            {isTemperature && (
              <button
                type="button"
                onClick={() => handleClassifyTemperature(false)}
                disabled={classifyingTemp}
                title="Analisa as mensagens com IA e organiza os leads por temperatura"
                className="inline-flex items-center gap-2 h-9 px-3 rounded-full text-[13px] font-medium text-[#E4572E] bg-[#E4572E]/10 hover:bg-[#E4572E]/15 transition-colors disabled:opacity-60"
              >
                {classifyingTemp ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wand2 className="h-3.5 w-3.5" />}
                <span className="hidden md:inline">{classifyingTemp ? 'Classificando…' : 'Classificar IA'}</span>
              </button>
            )}

            {!isTemperature && (
              <button
                type="button"
                onClick={() => handleReclassify()}
                disabled={reclassifying}
                title="Reanalisa todas as conversas e move para as colunas certas"
                className="inline-flex items-center gap-2 h-9 px-3 rounded-full text-[13px] font-medium text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors disabled:opacity-60"
              >
                {reclassifying ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wand2 className="h-3.5 w-3.5" />}
                <span className="hidden md:inline">{reclassifying ? 'Reclassificando…' : 'Reclassificar'}</span>
              </button>
            )}
            {!isTemperature && (
              <button
                type="button"
                onClick={onConfigureColumns}
                className="inline-flex items-center gap-2 h-9 px-3 rounded-full text-[13px] font-medium text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
              >
                <Settings className="h-3.5 w-3.5" />
                <span className="hidden md:inline">Colunas</span>
              </button>
            )}
            <div className="w-px h-5 bg-border/70 mx-1.5" />
            <button
              type="button"
              onClick={() => setAiOrganizerOpen(true)}
              className="inline-flex items-center gap-2 h-9 px-3.5 rounded-full text-[13px] font-medium text-foreground bg-muted/60 hover:bg-muted transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Sparkles className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Organizar</span>
            </button>
            <button
              type="button"
              onClick={() => setAutomationOpen(true)}
              title="Regras para rotear leads (Meta Ads, Pixel, webhooks) para colunas"
              className="inline-flex items-center gap-2 h-9 px-3.5 rounded-full text-[13px] font-semibold text-white bg-gradient-to-r from-[#374DA4] to-[#007DE3] hover:from-[#2500B8] hover:to-[#0066B8] shadow-sm hover:shadow transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-[#007DE3]"
            >
              <Zap className="h-3.5 w-3.5" fill="currentColor" />
              <span className="hidden sm:inline">Automatizar</span>
            </button>
          </div>
        </div>

        {/* Classification gate: columns only open after AI finishes */}
        {boardBusy && (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 bg-muted/20">
            <Loader2 className="h-6 w-6 animate-spin text-[#374DA4]" />
            <p className="text-[13px] font-medium text-foreground">
              {isTemperature ? 'Classificando leads por temperatura…' : 'Organizando o pipeline com IA…'}
            </p>
            <p className="text-[11px] text-muted-foreground">As colunas abrem assim que a IA terminar.</p>
          </div>
        )}

        {/* Kanban board */}
        <div className={cn("flex gap-3 h-full overflow-x-auto p-4 bg-muted/20", boardBusy && "hidden")}>

          <SortableContext
            items={activeColumns.map(c => `col:${c.id}`)}
            strategy={horizontalListSortingStrategy}
          >
            {activeColumns.map(column => {
              const columnConversations = getConversationsByStage(column.id);
              return (
                <SortableColumn
                  key={column.id}
                  column={column}
                  count={columnConversations.length}
                >
                  <ScrollArea className="flex-1 px-1.5 pb-2">
                    <SortableContext
                      items={columnConversations.map(c => c.id)}
                      strategy={verticalListSortingStrategy}
                    >
                      <DroppableColumn column={column}>
                        {columnConversations.length === 0 ? (
                          <div className="flex flex-col items-center justify-center h-24 border border-dashed border-border/40 rounded-xl text-muted-foreground/50 bg-background/30">
                            <Inbox className="h-5 w-5 mb-1.5 opacity-40" />
                            <span className="text-[10px] font-medium">Arraste aqui</span>
                          </div>
                        ) : (
                          columnConversations.map(conversation => (
                            <KanbanCard
                              key={conversation.id}
                              conversation={conversation}
                              labels={labels}
                              onSelect={handleCardClick}
                              onSaveLead={onSaveLead}
                              onManageLabels={onManageLabels}
                              onToggleBot={handleToggleBot}
                              stage={column.id}
                            />
                          ))
                        )}
                      </DroppableColumn>
                    </SortableContext>
                  </ScrollArea>
                </SortableColumn>
              );
            })}
          </SortableContext>
        </div>
      </div>

      {/* Drag overlay */}
      <DragOverlay>
        {activeConversation ? (
          <div className="bg-card rounded-2xl border-2 border-[#374DA4]/40 shadow-2xl p-3.5 w-[300px] rotate-2 scale-105">
            <div className="flex items-center gap-3">
              <Avatar className="h-10 w-10 ring-2 ring-[#374DA4]/20">
                <AvatarImage src={activeConversation.profile_picture} />
                <AvatarFallback className="bg-gradient-to-br from-[#374DA4]/20 to-[#374DA4]/5 text-[#374DA4] text-xs font-bold">
                  {(activeConversation.contact_name || activeConversation.contact_phone).substring(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm truncate">
                  {activeConversation.contact_name || activeConversation.contact_phone}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  {activeConversation.last_message}
                </p>
              </div>
            </div>
          </div>
        ) : null}
      </DragOverlay>


      {/* AI Organizer */}
      <KanbanAIOrganizer
        open={aiOrganizerOpen}
        onOpenChange={setAiOrganizerOpen}
        currentColumns={columns}
        conversations={conversations}
        onApply={(cols) => onColumnsChange?.(cols)}
      />

      {/* Automation Rules */}
      <KanbanAutomationDialog
        open={automationOpen}
        onOpenChange={setAutomationOpen}
        columns={columns}
        companyId={companyId}
      />

      {/* Lead detail panel (RD Station style) */}
      <KanbanLeadPanel
        open={leadPanelOpen}
        onOpenChange={setLeadPanelOpen}
        conversation={leadPanelConversation as any}
        columns={columns}
        labels={labels}
        teammates={teammates}
        aiAgents={aiAgents}
        onOpenChat={(conv) => {
          setLeadPanelOpen(false);
          openChatFromPanel(conv as any);
        }}
        onManageLabels={(conv) => onManageLabels(conv as any)}
        onSaveLead={(conv) => onSaveLead(conv as any)}
        onStageChange={(convId, stage) => onUpdateStage(convId, stage)}
        onLocalUpdate={(patch) => {
          setLeadPanelConversation(prev => prev && prev.id === patch.id ? { ...prev, ...patch } as any : prev);
        }}
      />

      {/* Card actions pop-up */}
      <KanbanCardActionsDialog
        open={actionsOpen}
        onOpenChange={setActionsOpen}
        conversation={actionsConversation as any}
        columns={activeColumns}
        currentStage={actionsConversation ? stageOf(actionsConversation) : ''}
        isTemperature={isTemperature}
        aiAgents={aiAgents}
        onOpenConversation={(conv) => onSelectConversation(conv as any)}
        onMoveStage={(conv, stage) => handleMoveStageFromDialog(conv as any, stage)}
        onToggleBot={(conv) => handleToggleBot(conv as any)}
        onSaveLead={(conv) => onSaveLead(conv as any)}
      />


      {/* Reason prompt on cross-column drag */}
      <Dialog
        open={!!stageChangePrompt}
        onOpenChange={(open) => {
          if (!open && !savingStageChange) {
            setStageChangePrompt(null);
            setStageChangeReason('');
          }
        }}
      >
        <DialogContent className="sm:max-w-lg p-0 overflow-hidden border-border/60">
          {stageChangePrompt && (() => {
            const src = columns.find(c => c.id === stageChangePrompt.sourceStage);
            const dst = columns.find(c => c.id === stageChangePrompt.targetStage);
            const srcColor = src?.color || '#94a3b8';
            const dstColor = dst?.color || '#374DA4';
            const reasonOk = stageChangeReason.trim().length >= 3;
            const quickReasons = [
              'Cliente confirmou interesse',
              'Aguardando retorno',
              'Proposta enviada',
              'Sem resposta',
              'Fechou negócio',
              'Não qualificado',
            ];
            return (
              <>
                {/* Header with gradient from source to target color */}
                <div
                  className="relative px-6 pt-6 pb-5"
                  style={{
                    background: `linear-gradient(135deg, ${srcColor}12 0%, ${dstColor}18 100%)`,
                  }}
                >
                  <div className="absolute inset-0 pointer-events-none opacity-40" style={{
                    backgroundImage: `radial-gradient(circle at 20% 20%, ${srcColor}22, transparent 50%), radial-gradient(circle at 80% 80%, ${dstColor}30, transparent 55%)`,
                  }} />
                  <DialogHeader className="relative space-y-3">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-background/70 backdrop-blur-sm text-[10px] font-bold uppercase tracking-wider text-muted-foreground ring-1 ring-border/50">
                        <MoveRight className="h-3 w-3" />
                        Mudança de coluna
                      </span>
                    </div>
                    <DialogTitle className="text-[18px] font-semibold tracking-tight text-foreground">
                      Por que {stageChangePrompt.contactName} está mudando?
                    </DialogTitle>

                    {/* Column transition visual */}
                    <div className="flex items-center gap-2 pt-1">
                      <span
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-background/80 backdrop-blur-sm ring-1 ring-border/50 text-[12px] font-medium"
                      >
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: srcColor, boxShadow: `0 0 0 2px ${srcColor}30` }} />
                        <span className="text-foreground truncate max-w-[140px]">{src?.title || stageChangePrompt.sourceStage}</span>
                      </span>
                      <ArrowRight className="h-3.5 w-3.5 text-muted-foreground/70 flex-shrink-0" />
                      <span
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-semibold text-white shadow-sm"
                        style={{ background: `linear-gradient(135deg, ${dstColor}, ${dstColor}D0)` }}
                      >
                        <span className="w-2 h-2 rounded-full bg-white/90" />
                        <span className="truncate max-w-[140px]">{dst?.title || stageChangePrompt.targetStage}</span>
                      </span>
                    </div>
                  </DialogHeader>
                </div>

                {/* Body */}
                <div className="px-6 py-5 space-y-4">
                  <div className="space-y-2">
                    <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Motivo
                    </label>
                    <Textarea
                      autoFocus
                      value={stageChangeReason}
                      onChange={(e) => setStageChangeReason(e.target.value)}
                      placeholder="Descreva o que motivou a mudança…"
                      rows={3}
                      className="resize-none text-[13px] rounded-xl border-border/60 focus-visible:ring-1 focus-visible:ring-[#374DA4]/40"
                      maxLength={500}
                    />
                    <div className="flex items-center justify-between text-[10px]">
                      <span className={cn(
                        'font-medium transition-colors',
                        reasonOk ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground/70'
                      )}>
                        {reasonOk ? 'Pronto para confirmar' : 'Mínimo 3 caracteres'}
                      </span>
                      <span className="tabular-nums text-muted-foreground/60">
                        {stageChangeReason.length}/500
                      </span>
                    </div>
                  </div>

                  {/* Quick reasons */}
                  <div className="flex flex-wrap gap-1.5">
                    {quickReasons.map(r => (
                      <button
                        key={r}
                        type="button"
                        onClick={() => setStageChangeReason(r)}
                        className={cn(
                          'inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-medium border transition-all',
                          stageChangeReason === r
                            ? 'bg-[#374DA4] text-white border-[#374DA4] shadow-sm'
                            : 'bg-muted/40 border-border/60 text-muted-foreground hover:text-foreground hover:bg-muted'
                        )}
                      >
                        {r}
                      </button>
                    ))}
                  </div>

                  <p className="text-[11px] text-muted-foreground/80 leading-relaxed">
                    O motivo ficará registrado no histórico da conversa com data, hora e autor.
                  </p>
                </div>

                {/* Footer with swipe */}
                <div className="px-6 pb-6 pt-1 space-y-2.5">
                  <SwipeToConfirm
                    onConfirm={confirmStageChange}
                    disabled={!reasonOk}
                    loading={savingStageChange}
                    label={reasonOk ? 'Arraste para confirmar' : 'Escreva um motivo'}
                    confirmedLabel="Movido"
                    color={dstColor}
                  />
                  <button
                    type="button"
                    onClick={() => { setStageChangePrompt(null); setStageChangeReason(''); }}
                    disabled={savingStageChange}
                    className="w-full text-center text-[12px] font-medium text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
                  >
                    Cancelar
                  </button>
                </div>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>
    </DndContext>
  );
};

export default WhatsAppKanbanView;
