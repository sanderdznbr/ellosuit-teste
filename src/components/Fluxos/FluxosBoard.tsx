import React, { useEffect, useState, useRef, useCallback } from 'react';
import { Plus, MoreHorizontal, Calendar, GripVertical, X, Trash2, Edit2, Clock, CheckSquare, Star, Filter, Paperclip, MessageSquare, Link2, Users, Share2, Copy, ExternalLink, Image, FileText, Tag, User, FolderOpen, Upload, HardDrive, Loader2, Download, Eye, List, LayoutGrid, Sparkles, Send, Command, ArrowLeft } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { DndContext, PointerSensor, useSensor, useSensors, DragEndEvent, DragOverlay, DragStartEvent, closestCorners, DragOverEvent, KeyboardSensor } from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useCompanyEmployees } from '@/hooks/useCompanyEmployees';
import { useTheme } from '@/hooks/useTheme';
import { WorkflowGroup, Workflow, WorkflowColumn, WorkflowCard, EnrichedWorkflow, priorityConfig, labelColors, columnColors } from './types';
import { TrelloColumnComponent } from './TrelloColumn';
import { FluxosListView } from './FluxosListView';
import { EnhancedCardModal } from './EnhancedCardModal';



// ─── Main Component ────────────────────────────────────────────────
const FluxosBoard: React.FC = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const { theme } = useTheme();
  const { boardId } = useParams<{ boardId?: string }>();
  const { employees } = useCompanyEmployees();

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));

  const [groups, setGroups] = useState<WorkflowGroup[]>([]);
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [columns, setColumns] = useState<WorkflowColumn[]>([]);
  const [cards, setCards] = useState<WorkflowCard[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<string>('');
  const [selectedWorkflow, setSelectedWorkflow] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [activeCard, setActiveCard] = useState<WorkflowCard | null>(null);
  const [viewMode, setViewMode] = useState<'kanban' | 'list'>('kanban');
  const [allWorkflows, setAllWorkflows] = useState<EnrichedWorkflow[]>([]);
  const [showCardModal, setShowCardModal] = useState(false);
  const [selectedCard, setSelectedCard] = useState<WorkflowCard | null>(null);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [isFavorite, setIsFavorite] = useState(false);
  const [showBoardHome, setShowBoardHome] = useState(false);
  const [newColumnName, setNewColumnName] = useState('');
  const [showAddColumn, setShowAddColumn] = useState(false);
  const [newCardColumnId, setNewCardColumnId] = useState<string | null>(null);

  const addColumn = async () => {
    if (!selectedWorkflow || !newColumnName.trim()) return;
    const position = columns.length;
    const { error } = await supabase.from('workflow_columns').insert([{
      workflow_id: selectedWorkflow,
      name: newColumnName.trim(),
      position,
      company_id: companyId!,
    }]);
    if (error) { toast({ title: 'Erro ao criar coluna', description: error.message, variant: 'destructive' }); return; }
    setNewColumnName('');
    setShowAddColumn(false);
    loadColumns();
    toast({ title: 'Coluna criada' });
  };

  useEffect(() => {
    const fetchCompanyId = async () => {
      if (!user?.id) return;
      const { data } = await supabase.from('company_users').select('company_id').eq('user_id', user.id).single();
      if (data?.company_id) setCompanyId(data.company_id);
    };
    fetchCompanyId();
  }, [user?.id]);

  const loadGroups = async () => {
    if (!companyId) return;
    const { data } = await supabase.from('workflow_groups').select('*').eq('company_id', companyId).order('created_at');
    setGroups(data || []);
    if (data && data.length > 0 && !selectedGroup) setSelectedGroup(data[0].id);
  };

  const loadWorkflows = async () => {
    if (!selectedGroup) return;
    const { data } = await supabase.from('workflows').select('*').eq('group_id', selectedGroup).order('created_at');
    setWorkflows(data || []);
  };

  const loadColumns = async () => {
    if (!selectedWorkflow) return;
    const { data } = await supabase.from('workflow_columns').select('*').eq('workflow_id', selectedWorkflow).order('position');
    setColumns(data || []);
  };

  const loadCards = async () => {
    if (!selectedWorkflow) return;
    const { data } = await supabase.from('workflow_cards').select(`*, workflow_columns!inner(workflow_id)`).eq('workflow_columns.workflow_id', selectedWorkflow).order('position');
    setCards((data || []).map((d: any) => ({
      id: d.id, column_id: d.column_id, title: d.title, description: d.description, position: d.position,
      priority: d.priority, due_date: d.due_date, tags: d.tags, created_by: d.created_by,
      attachments: d.attachments, links: d.links, comments: d.comments as any, assigned_user_id: d.assigned_user_id,
      checklist: (d.checklist as any) || [], cover_url: d.cover_url || null,
      automation_buttons: (d.automation_buttons as any) || [],
    })));
  };

  useEffect(() => { if (companyId) { loadGroups(); setLoading(false); } }, [companyId]);

  useEffect(() => {
    const loadAllWorkflows = async () => {
      if (!companyId) return;
      const { data: wfs } = await supabase.from('workflows').select('*').eq('company_id', companyId);
      if (wfs) {
        const enriched = wfs.map(wf => {
          const grp = groups.find(g => g.id === wf.group_id);
          return { ...wf, group_name: grp?.name || '', group_color: grp?.color || '#6B7280' };
        });
        setAllWorkflows(enriched);
      }
    };
    if (groups.length > 0) loadAllWorkflows();
  }, [groups, companyId]);

  useEffect(() => {
    if (boardId && allWorkflows.length > 0) {
      const wf = allWorkflows.find(w => w.id === boardId);
      if (wf) {
        setSelectedGroup(wf.group_id);
        setSelectedWorkflow(wf.id);
        setShowBoardHome(false);
      }
    }
  }, [boardId, allWorkflows]);

  useEffect(() => { if (selectedGroup) loadWorkflows(); }, [selectedGroup]);
  useEffect(() => { if (selectedWorkflow) { loadColumns(); loadCards(); } }, [selectedWorkflow]);

  const openWorkflow = (workflowId: string, groupId: string) => {
    setSelectedGroup(groupId); setSelectedWorkflow(workflowId); setShowBoardHome(false);
    navigate(`/dashboard/fluxos/${workflowId}`, { replace: true });
  };

  const goHome = () => { setSelectedWorkflow(''); setShowBoardHome(true); navigate('/dashboard/fluxos', { replace: true }); };

  const currentWorkflow = workflows.find(w => w.id === selectedWorkflow);
  const currentGroup = groups.find(g => g.id === selectedGroup);




  const handleDragStart = (e: DragStartEvent) => setActiveCard(cards.find(c => c.id === e.active.id) || null);
  const handleDragOver = (e: DragOverEvent) => {
    const { active, over } = e;
    if (!over) return;
    const ac = cards.find(c => c.id === active.id);
    if (!ac) return;
    const overColumn = columns.find(col => col.id === over.id);
    if (overColumn && ac.column_id !== overColumn.id) setCards(prev => prev.map(card => card.id === ac.id ? { ...card, column_id: overColumn.id } : card));
  };

  const handleDragEnd = async (e: DragEndEvent) => {
    setActiveCard(null);
    const { active, over } = e;
    if (!over) return;
    const activeId = active.id.toString();
    const overId = over.id.toString();
    const activeCardData = cards.find(c => c.id === activeId);
    if (!activeCardData) return;
    let targetColumnId = activeCardData.column_id;
    let targetPosition = 0;
    const overCardData = cards.find(c => c.id === overId);
    const overColumnData = columns.find(col => col.id === overId);
    if (overCardData) { targetColumnId = overCardData.column_id; targetPosition = overCardData.position; }
    else if (overColumnData) { targetColumnId = overColumnData.id; const columnCards = cards.filter(c => c.column_id === targetColumnId); targetPosition = columnCards.length > 0 ? Math.max(...columnCards.map(c => c.position)) + 1 : 0; }
    await supabase.from('workflow_cards').update({ column_id: targetColumnId, position: targetPosition }).eq('id', activeId);
    loadCards();
  };

  const saveCard = async (data: any) => {
    if (selectedCard) {
      await supabase.from('workflow_cards').update(data).eq('id', selectedCard.id);
    } else {
      const colId = newCardColumnId || columns[0]?.id;
      const colCards = cards.filter(c => c.column_id === colId);
      const pos = colCards.length > 0 ? Math.max(...colCards.map(c => c.position)) + 1 : 0;
      await supabase.from('workflow_cards').insert({ ...data, column_id: colId, position: pos, company_id: companyId, created_by: user?.id });
    }
    await loadCards();
    setShowCardModal(false);
    setNewCardColumnId(null);
  };

  const deleteCard = async (id: string) => {
    await supabase.from('workflow_cards').delete().eq('id', id);
    loadCards();
    setShowCardModal(false);
  };

  if (loading) return <div>Carregando...</div>;

  if (showBoardHome || !selectedWorkflow) {
    return (
      <div className={`min-h-full flex ${theme === 'dark' ? 'bg-background text-[#B6C2CF]' : 'bg-[#faf9f7] text-[#172b4d]'} transition-colors duration-300`}>
        {/* Sidebar */}
        <div className={`w-64 border-r py-10 px-4 hidden md:block ${theme === 'dark' ? 'border-white/5 bg-black/20' : 'border-border/40 bg-[#ecebe4]/20'}`}>
          <div className="space-y-8">
            <div className="space-y-2">
              <Button 
                variant="ghost" 
                onClick={goHome} 
                className={`w-full justify-start rounded-lg h-9 px-3 ${!selectedWorkflow ? (theme === 'dark' ? 'bg-[#374DA4]/20 text-[#374DA4]' : 'bg-[#374DA4]/10 text-[#374DA4]') : (theme === 'dark' ? 'text-[#B6C2CF] hover:bg-white/5' : 'text-gray-600 hover:bg-[#ecebe4]')}`}
              >
                <LayoutGrid className="h-4 w-4 mr-2" /> Quadros
              </Button>
              <Button 
                variant="ghost" 
                onClick={() => {
                  toast({
                    title: "Em breve",
                    description: "A galeria de modelos estará disponível em breve.",
                  });
                }}
                className={`w-full justify-start rounded-lg h-9 px-3 ${theme === 'dark' ? 'text-[#B6C2CF] hover:bg-white/5' : 'text-gray-600 hover:bg-gray-100'}`}
              >
                <Sparkles className="h-4 w-4 mr-2" /> Modelos
              </Button>
              <Button 
                variant="ghost" 
                onClick={goHome}
                className={`w-full justify-start rounded-lg h-9 px-3 ${theme === 'dark' ? 'text-[#B6C2CF] hover:bg-white/5' : 'text-gray-600 hover:bg-gray-100'}`}
              >
                <LayoutGrid className="h-4 w-4 mr-2" /> Início
              </Button>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between px-3">
                <h4 className={`text-[12px] font-bold uppercase tracking-wider ${theme === 'dark' ? 'text-[#B6C2CF]/40' : 'text-gray-400'}`}>Workspaces</h4>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={() => {
                    toast({
                      title: "Criação de Workspace",
                      description: "Use o botão 'Criar novo quadro' abaixo para gerenciar seus fluxos.",
                    });
                  }}
                  className={`h-6 w-6 rounded ${theme === 'dark' ? 'hover:bg-white/5' : 'hover:bg-gray-100'}`}
                >
                  <Plus className="h-3 w-3" />
                </Button>
              </div>
              <div className="space-y-1">
                {groups.map(group => (
                  <Button 
                    key={group.id} 
                    variant="ghost" 
                    onClick={() => setSelectedGroup(group.id)}
                    className={`w-full justify-start text-xs font-bold rounded-lg h-9 px-3 transition-colors ${selectedGroup === group.id ? (theme === 'dark' ? 'bg-white/5 text-white' : 'bg-[#ecebe4] text-gray-900 shadow-sm') : (theme === 'dark' ? 'text-[#B6C2CF] hover:bg-white/5' : 'text-gray-600 hover:bg-[#ecebe4]')}`}
                  >
                    <div className="h-5 w-5 rounded mr-2 flex items-center justify-center text-[10px]" style={{ backgroundColor: group.color }}>{group.name[0]}</div>
                    {group.name}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        </div>


        {/* Main Content */}
        <div className="flex-1 py-10 px-8 overflow-y-auto">
          <div className="max-w-5xl mx-auto space-y-12">
            <div className="flex items-center gap-3 mb-2">
              <Clock className={`h-5 w-5 ${theme === 'dark' ? 'text-[#B6C2CF]' : 'text-gray-500'}`} />
              <h2 className={`text-base font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>Visualizados recentemente</h2>
            </div>

            
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {allWorkflows.slice(0, 4).map(wf => (
                <button 
                  key={wf.id} 
                  onClick={() => openWorkflow(wf.id, wf.group_id)} 
                  className="group relative h-24 rounded-lg overflow-hidden transition-all text-left p-3 flex flex-col justify-between shadow-sm hover:shadow-md hover:scale-[1.02] active:scale-[0.98]"
                  style={{ backgroundColor: wf.group_color }}
                >
                  <div className="absolute inset-0 bg-black/20 group-hover:bg-black/10 transition-colors" />
                  <span className="relative z-10 font-bold text-white text-sm tracking-tight">{wf.name}</span>
                  <div className="relative z-10 flex items-center justify-between">
                    <span className="text-[10px] font-bold text-white/60 uppercase tracking-widest">{wf.group_name}</span>
                    <Star className="h-3 w-3 text-white/40 hover:text-white transition-colors" />
                  </div>
                </button>
              ))}
              <button 
                className={`h-24 rounded-lg transition-all flex items-center justify-center text-sm font-bold border-2 border-dashed hover:scale-[1.02] active:scale-[0.98] ${theme === 'dark' ? 'bg-white/5 hover:bg-white/10 border-white/5 text-[#B6C2CF]' : 'bg-white hover:bg-white border-border/60 text-gray-400'}`}
                onClick={() => {
                  toast({
                    title: "Criação de Quadro",
                    description: "A funcionalidade de criar novos quadros diretamente por aqui está sendo preparada.",
                  });
                }}
              >
                <Plus className="h-4 w-4 mr-2" /> Criar novo quadro
              </button>

            </div>

            <div className="space-y-8">
              <div className="flex items-center justify-between">
                <h2 className={`text-base font-bold uppercase tracking-wider px-1 ${theme === 'dark' ? 'text-[#B6C2CF]/60' : 'text-gray-400'}`}>Meus Fluxos</h2>
              </div>


              {groups.map(group => (
                <div key={group.id} className="space-y-4">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="h-8 w-8 rounded flex items-center justify-center font-bold text-white shadow-lg" style={{ backgroundColor: group.color }}>{group.name[0]}</div>
                    <h3 className={`text-base font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{group.name}</h3>
                    <div className="flex gap-2 ml-4">
                       <Button variant="secondary" size="sm" className={`h-8 rounded-lg font-bold text-xs shadow-sm ${theme === 'dark' ? 'bg-white/5 hover:bg-white/10 text-white' : 'bg-white hover:bg-[#ecebe4] text-gray-700 border-border/40'}`}>Quadros</Button>
                       <Button variant="ghost" size="sm" className={`h-8 rounded font-bold text-xs ${theme === 'dark' ? 'text-[#B6C2CF] hover:text-white' : 'text-gray-500 hover:text-gray-900'}`}>Participantes</Button>
                       <Button variant="ghost" size="sm" className={`h-8 rounded font-bold text-xs ${theme === 'dark' ? 'text-[#B6C2CF] hover:text-white' : 'text-gray-500 hover:text-gray-900'}`}>Configurações</Button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 pb-4">
                    {allWorkflows.filter(w => w.group_id === group.id).map(wf => (
                      <button 
                        key={wf.id} 
                        onClick={() => openWorkflow(wf.id, group.id)} 
                        className="group relative h-24 rounded-lg overflow-hidden transition-all text-left p-3 flex flex-col justify-between"
                        style={{ backgroundColor: group.color }}
                      >
                        <div className="absolute inset-0 bg-black/30 group-hover:bg-black/20 transition-colors" />
                        <span className="relative z-10 font-bold text-white text-sm drop-shadow-md">{wf.name}</span>
                        <Star className="absolute top-3 right-3 h-4 w-4 text-white/40 opacity-0 group-hover:opacity-100 transition-all hover:scale-110" />
                      </button>
                    ))}
                    <button className={`h-24 rounded-lg transition-colors flex flex-col items-center justify-center text-xs font-bold gap-2 ${theme === 'dark' ? 'bg-white/5 hover:bg-white/10 text-[#B6C2CF]' : 'bg-gray-50 hover:bg-gray-100 text-gray-400'}`}
                      onClick={() => {
                        toast({
                          title: "Criação de Quadro",
                          description: "A funcionalidade de criar novos quadros diretamente por aqui está sendo preparada.",
                        });
                      }}
                    >
                      Criar novo quadro
                    </button>

                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }


  return (
    <div className="min-h-full flex flex-col bg-gradient-to-b from-[#374DA4]/5 via-background to-background dark:from-[#374DA4]/10 dark:via-background dark:to-background">
      {/* Board toolbar — semantic tokens, light + dark padronizado */}
      <div className="sticky top-0 z-20 bg-card/90 backdrop-blur-xl border-b border-border shadow-sm">
        <div className="px-4 md:px-6 py-2.5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <Button variant="ghost" size="icon" onClick={goHome} className="h-8 w-8 rounded-lg shrink-0">
              <ArrowLeft className="h-4 w-4" />
            </Button>
            {currentGroup && (
              <div className="h-6 w-6 rounded-md flex items-center justify-center text-[10px] font-bold text-white shrink-0" style={{ backgroundColor: currentGroup.color }}>
                {currentGroup.name[0]}
              </div>
            )}
            <h1 className="text-base md:text-lg font-bold text-foreground truncate">
              {currentWorkflow?.name}
            </h1>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                setIsFavorite(!isFavorite);
                toast({ title: !isFavorite ? 'Adicionado aos favoritos' : 'Removido dos favoritos', description: currentWorkflow?.name });
              }}
              className="h-8 w-8 rounded-lg shrink-0"
            >
              <Star className={`h-4 w-4 ${isFavorite ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground'}`} />
            </Button>
            <Badge variant="secondary" className="hidden md:inline-flex rounded-full text-[10px] h-6 px-2 font-medium">
              <Users className="h-3 w-3 mr-1" /> Equipe
            </Badge>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <Button variant="ghost" size="sm" className="h-8 rounded-lg text-xs hidden sm:inline-flex">
              <Filter className="h-3.5 w-3.5 mr-1.5" /> Filtrar
            </Button>
            <Button
              size="sm"
              onClick={() => {
                navigator.clipboard.writeText(window.location.href);
                toast({ title: 'Link copiado!', description: 'O link do quadro foi copiado.' });
              }}
              className="h-8 rounded-lg px-3 text-xs bg-[#374DA4] hover:bg-[#2400b3] text-white"
            >
              <Share2 className="h-3.5 w-3.5 mr-1.5" /> Compartilhar
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* View switcher — glass pill */}
        <div className="px-4 md:px-6 pb-2">
          <div className="glass-pill inline-flex gap-1 p-1 rounded-full">
            {[
              { id: 'kanban' as const, label: 'Quadro', icon: LayoutGrid },
              { id: 'list' as const, label: 'Lista', icon: List },
            ].map(v => {
              const Icon = v.icon;
              const active = viewMode === v.id;
              return (
                <button
                  key={v.id}
                  onClick={() => setViewMode(v.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                    active
                      ? 'bg-[#374DA4] text-white shadow-md shadow-[#374DA4]/30'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" /> {v.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-hidden">
        {viewMode === 'kanban' ? (
          <div className="px-4 md:px-6 pb-12 pt-6 overflow-x-auto h-full">
            <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={handleDragStart} onDragOver={handleDragOver} onDragEnd={handleDragEnd}>
              <div className="flex gap-4 min-w-max h-full items-start">
                {columns.map(column => (
                  <TrelloColumnComponent
                    key={column.id}
                    column={column}
                    cards={cards.filter(c => c.column_id === column.id)}
                    employees={employees}
                    onAddCard={async (columnId, title) => {
                      if (title) {
                        const colCards = cards.filter(c => c.column_id === columnId);
                        const pos = colCards.length > 0 ? Math.max(...colCards.map(c => c.position)) + 1 : 0;
                        await supabase.from('workflow_cards').insert({ title, column_id: columnId, position: pos, company_id: companyId!, created_by: user?.id });
                        await loadCards();
                      } else {
                        setNewCardColumnId(columnId);
                        setSelectedCard(null);
                        setShowCardModal(true);
                      }
                    }}
                    onEditCard={(card) => { setSelectedCard(card); setShowCardModal(true); }}
                    onDeleteCard={deleteCard}
                    onDeleteColumn={() => {}}
                    onEditColumn={() => {}}
                  />
                ))}
                <div className="flex-shrink-0 pt-2">
                  {showAddColumn ? (
                    <div className="w-64 bg-white/95 dark:bg-neutral-900/95 backdrop-blur rounded-2xl p-3 shadow-lg border border-white/20">
                      <Input autoFocus value={newColumnName} onChange={(e) => setNewColumnName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') addColumn(); if (e.key === 'Escape') { setShowAddColumn(false); setNewColumnName(''); } }} placeholder="Nome da coluna" className="mb-2 rounded-xl" />
                      <div className="flex gap-2">
                        <Button size="sm" onClick={addColumn} className="bg-[#374DA4] hover:bg-[#2400b8] text-white rounded-xl">Adicionar</Button>
                        <Button size="sm" variant="ghost" onClick={() => { setShowAddColumn(false); setNewColumnName(''); }} className="rounded-xl"><X className="h-4 w-4" /></Button>
                      </div>
                    </div>
                  ) : (
                    <button onClick={() => setShowAddColumn(true)} aria-label="Adicionar coluna" title="Adicionar coluna" className="h-9 w-9 flex items-center justify-center rounded-full bg-[#374DA4] hover:bg-[#2400b8] text-white shadow-md transition">
                      <Plus className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
            </DndContext>
          </div>
        ) : (
          <div className="px-4 md:px-8 pt-4 h-full overflow-y-auto">
            <FluxosListView columns={columns} cards={cards} employees={employees} onEditCard={(card) => { setSelectedCard(card); setShowCardModal(true); }} />
          </div>
        )}
      </div>

      <EnhancedCardModal card={selectedCard} open={showCardModal} onClose={() => setShowCardModal(false)} onSave={(data) => saveCard(data)} onDelete={selectedCard ? () => deleteCard(selectedCard.id) : undefined} onDuplicate={() => loadCards()} employees={employees} companyId={companyId} userId={user?.id} columnName={columns.find(c => c.id === selectedCard?.column_id)?.name} />
    </div>
  );
};

export default FluxosBoard;
