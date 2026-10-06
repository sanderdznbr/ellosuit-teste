import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, GitBranch, Search, Pencil, Play, Pause, BarChart3, Copy, Trash2, MoreVertical, Loader2, MessageSquare, Users, Clock, ArrowRight, Smartphone, Activity, Link2, Atom } from 'lucide-react';
import RadialGlowOrb from '@/components/ChatBot/RadialGlowOrb';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { Switch } from '@/components/ui/switch';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

interface ChatbotFlow {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  nodes: any[];
  edges: any[];
  execution_count: number;
  trigger_config: any;
  created_at: string;
  updated_at: string;
}

interface WhatsAppSession {
  id: string;
  instance_name: string;
  phone_number: string | null;
  status: string;
}

const ChatbotManagement: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [flows, setFlows] = useState<ChatbotFlow[]>([]);
  const [sessions, setSessions] = useState<WhatsAppSession[]>([]);
  const [stats, setStats] = useState<Record<string, { total: number; last: string | null; linkedAutomations: number }>>({});
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [loading, setLoading] = useState(true);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFlows, setSelectedFlows] = useState<string[]>([]);
  
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showStatsModal, setShowStatsModal] = useState(false);
  const [statsFlow, setStatsFlow] = useState<ChatbotFlow | null>(null);
  const [statsData, setStatsData] = useState<{
    executions: any[];
    loading: boolean;
  }>({ executions: [], loading: false });
  const [newFlow, setNewFlow] = useState({
    name: '',
    description: '',
    triggerType: 'keyword',
    triggerValue: '',
    sessionId: ''
  });

  useEffect(() => {
    const getCompanyId = async () => {
      if (!user?.id) return;
      const metadataCompanyId = user.user_metadata?.company_id;
      if (metadataCompanyId) {
        setCompanyId(metadataCompanyId);
        return;
      }
      const { data } = await supabase
        .from('company_users')
        .select('company_id')
        .eq('user_id', user.id)
        .single();
      if (data?.company_id) setCompanyId(data.company_id);
    };
    getCompanyId();
  }, [user?.id]);

  useEffect(() => {
    const loadData = async () => {
      if (!companyId) return;
      setLoading(true);

      const { data: flowsData } = await supabase
        .from('chatbot_flows')
        .select('*')
        .eq('company_id', companyId)
        .order('created_at', { ascending: false });

      if (flowsData) {
        const typedFlows: ChatbotFlow[] = flowsData.map(f => ({
          ...f,
          description: f.description || null,
          nodes: f.nodes as any[] || [],
          edges: f.edges as any[] || [],
          trigger_config: f.trigger_config as any,
          execution_count: f.execution_count || 0
        }));
        setFlows(typedFlows);
      }

      const { data: sessionsData } = await supabase
        .from('whatsapp_sessions')
        .select('id, instance_name, phone_number, status')
        .eq('company_id', companyId);
      if (sessionsData) setSessions(sessionsData);

      // Aggregate execution stats per flow (filter by flows pertencentes à empresa, sem depender de company_id na execução)
      const flowIds = (flowsData || []).map((f: any) => f.id);
      const { data: execs } = flowIds.length
        ? await supabase
            .from('chatbot_executions')
            .select('flow_id, started_at')
            .in('flow_id', flowIds)
            .order('started_at', { ascending: false })
            .limit(5000)
        : { data: [] as any[] };
      const acc: Record<string, { total: number; last: string | null; linkedAutomations: number }> = {};
      (execs || []).forEach((e: any) => {
        if (!e.flow_id) return;
        if (!acc[e.flow_id]) acc[e.flow_id] = { total: 0, last: null, linkedAutomations: 0 };
        acc[e.flow_id].total += 1;
        if (!acc[e.flow_id].last) acc[e.flow_id].last = e.started_at;
      });

      // Linked automations by name reference in actions/nodes
      const { data: autos } = await supabase
        .from('automations')
        .select('id, name, nodes, actions')
        .eq('company_id', companyId);
      (flowsData || []).forEach((f: any) => {
        const linked = (autos || []).filter((a: any) => {
          const str = JSON.stringify(a.nodes || []) + JSON.stringify(a.actions || []);
          return str.includes(f.id);
        }).length;
        if (!acc[f.id]) acc[f.id] = { total: 0, last: null, linkedAutomations: 0 };
        acc[f.id].linkedAutomations = linked;
      });
      setStats(acc);

      setLoading(false);
    };
    loadData();
  }, [companyId]);

  const handleCreateFlow = async () => {
    if (!newFlow.name.trim() || !companyId || !user?.id) {
      toast({ title: 'Erro', description: 'Preencha o nome do chatbot', variant: 'destructive' });
      return;
    }

    const triggerConfig = {
      type: newFlow.triggerType,
      value: newFlow.triggerValue,
      sessionId: newFlow.sessionId || null
    };

    const { data, error } = await supabase
      .from('chatbot_flows')
      .insert({
        name: newFlow.name,
        description: newFlow.description || null,
        company_id: companyId,
        created_by: user.id,
        is_active: false,
        nodes: [{
          id: 'trigger-1',
          type: 'trigger',
          subType: newFlow.triggerType === 'whatsapp_channel' ? 'whatsapp_channel' : 'keyword',
          position: { x: 100, y: 100 },
          data: { label: 'Gatilho', config: triggerConfig }
        }],
        edges: [],
        trigger_config: triggerConfig
      })
      .select()
      .single();

    if (error) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
      return;
    }

    setShowCreateModal(false);
    setNewFlow({ name: '', description: '', triggerType: 'keyword', triggerValue: '', sessionId: '' });
    toast({ title: 'Sucesso!', description: 'Chatbot criado.' });
    navigate(`/dashboard/chatbot-builder?flowId=${data.id}`);
  };

  const handleDeleteFlow = async (flowId: string) => {
    if (!confirm('Tem certeza que deseja excluir este chatbot?')) return;
    await supabase.from('chatbot_flows').delete().eq('id', flowId);
    setFlows(prev => prev.filter(f => f.id !== flowId));
    toast({ title: 'Excluído', description: 'Chatbot removido' });
  };

  const handleEditWithAI = async (flow: ChatbotFlow) => {
    if (!user?.id || !companyId) return;
    try {
      // Reaproveita uma sessão de builder já ligada a este flow, se existir
      const { data: existing } = await supabase
        .from('chatbot_builder_sessions')
        .select('id')
        .eq('user_id', user.id)
        .eq('published_flow_id', flow.id)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (existing?.id) {
        navigate(`/dashboard/criar-chatbot/${existing.id}`);
        return;
      }
      // Cria nova sessão linkada, copiando o flow atual
      const intro = {
        id: 'intro',
        role: 'assistant',
        content: `Carreguei o chatbot **${flow.name}** aqui. Me diga o que você quer ajustar ou adicionar e eu atualizo o fluxo em tempo real.`,
      };
      const { data: created, error } = await supabase
        .from('chatbot_builder_sessions')
        .insert({
          user_id: user.id,
          company_id: companyId,
          title: `Editar: ${flow.name}`,
          flow_name: flow.name,
          published_flow_id: flow.id,
          is_active: flow.is_active,
          nodes: (flow.nodes || []) as any,
          edges: (flow.edges || []) as any,
          messages: [intro] as any,
        })
        .select('id')
        .single();
      if (error) throw error;
      navigate(`/dashboard/criar-chatbot/${created.id}`);
    } catch (err: any) {
      toast({ title: 'Erro ao abrir editor com IA', description: err.message, variant: 'destructive' });
    }
  };

  const handleToggleActive = async (flow: ChatbotFlow) => {
    const newState = !flow.is_active;
    const { error } = await supabase
      .from('chatbot_flows')
      .update({ is_active: newState })
      .eq('id', flow.id);
    if (!error) {
      setFlows(prev => prev.map(f => f.id === flow.id ? { ...f, is_active: newState } : f));
      if (newState && companyId) {
        await supabase
          .from('whatsapp_conversations')
          .update({
            human_takeover: false,
            human_takeover_at: null,
            human_takeover_reason: null,
          })
          .eq('company_id', companyId)
          .eq('human_takeover', true);
      }
      toast({ title: newState ? 'Ativado' : 'Desativado', description: `Chatbot "${flow.name}" ${newState ? 'ativado' : 'desativado'}` });
    }
  };

  const handleDuplicateFlow = async (flow: ChatbotFlow) => {
    if (!companyId || !user?.id) return;
    const { data, error } = await supabase
      .from('chatbot_flows')
      .insert({
        name: `${flow.name} (cópia)`,
        description: flow.description,
        company_id: companyId,
        created_by: user.id,
        is_active: false,
        nodes: flow.nodes as any,
        edges: flow.edges as any,
        trigger_config: flow.trigger_config,
      })
      .select()
      .single();
    if (!error && data) {
      setFlows(prev => [{ ...data, nodes: data.nodes as any[] || [], edges: data.edges as any[] || [], execution_count: 0, trigger_config: data.trigger_config } as ChatbotFlow, ...prev]);
      toast({ title: 'Duplicado!', description: `Chatbot "${flow.name}" duplicado com sucesso` });
    }
  };

  const handleOpenStats = async (flow: ChatbotFlow) => {
    setStatsFlow(flow);
    setShowStatsModal(true);
    setStatsData({ executions: [], loading: true });

    const { data } = await supabase
      .from('chatbot_executions')
      .select('*')
      .eq('flow_id', flow.id)
      .order('started_at', { ascending: false })
      .limit(50);

    setStatsData({ executions: data || [], loading: false });
  };

  const filteredFlows = flows.filter(flow => {
    const matchesText = flow.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      flow.description?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' ? true : statusFilter === 'active' ? flow.is_active : !flow.is_active;
    return matchesText && matchesStatus;
  });

  const getFlowChannel = (flow: ChatbotFlow): WhatsAppSession | null => {
    const sid = flow.trigger_config?.sessionId;
    if (sid) return sessions.find(s => s.id === sid) || null;
    return null;
  };

  const formatDateTime = (dateStr: string | null) => {
    if (!dateStr) return 'Nunca';
    const d = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return 'Agora';
    if (diffMin < 60) return `${diffMin}min atrás`;
    const diffH = Math.floor(diffMin / 60);
    if (diffH < 24) return `${diffH}h atrás`;
    const diffD = Math.floor(diffH / 24);
    if (diffD < 7) return `${diffD}d atrás`;
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
  };

  const formatRelativeDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Hoje';
    if (diffDays === 1) return 'Ontem';
    if (diffDays < 7) return `${diffDays} dias atrás`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} semanas atrás`;
    return `${Math.floor(diffDays / 30)} meses atrás`;
  };

  const handleBulkDelete = async () => {
    if (selectedFlows.length === 0) return;
    if (!confirm(`Tem certeza que deseja excluir ${selectedFlows.length} chatbots?`)) return;
    
    const { error } = await supabase
      .from('chatbot_flows')
      .delete()
      .in('id', selectedFlows);
      
    if (error) {
      toast({ title: 'Erro', description: 'Erro ao excluir chatbots', variant: 'destructive' });
      return;
    }
    
    setFlows(prev => prev.filter(f => !selectedFlows.includes(f.id)));
    setSelectedFlows([]);
    toast({ title: 'Excluídos', description: 'Chatbots removidos com sucesso' });
  };

  const toggleSelectFlow = (id: string) => {
    setSelectedFlows(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const toggleSelectAll = () => {
    if (selectedFlows.length === filteredFlows.length) {
      setSelectedFlows([]);
    } else {
      setSelectedFlows(filteredFlows.map(f => f.id));
    }
  };

  // Dados derivados exibidos na lista (tabela no desktop + cards no mobile)
  const rows = filteredFlows.map((flow) => {
    const s = stats[flow.id];
    return {
      flow,
      totalExec: Math.max(s?.total ?? 0, flow.execution_count ?? 0),
      lastExec: s?.last ?? null,
      linked: s?.linkedAutomations ?? 0,
      channel: getFlowChannel(flow),
    };
  });

  const emptyState = (
    <div className="py-12 text-center">
      <GitBranch className="h-10 w-10 text-gray-300 dark:text-foreground/30 mx-auto mb-3" />
      <h3 className="text-sm font-medium text-gray-500 dark:text-muted-foreground">Nenhum chatbot encontrado</h3>
      <p className="text-xs text-gray-400 dark:text-foreground/50 mt-1">
        {searchQuery || statusFilter !== 'all'
          ? 'Tente ajustar a busca ou o filtro.'
          : 'Crie seu primeiro chatbot para começar.'}
      </p>
      {!searchQuery && statusFilter === 'all' && (
        <Button onClick={() => setShowCreateModal(true)} className="mt-4 bg-primary text-white rounded-full">
          <Plus className="h-4 w-4 mr-2" />
          Criar Chatbot
        </Button>
      )}
    </div>
  );

  if (loading) {
    return (
      <div className="min-h-full bg-[#faf9f7] dark:bg-background flex items-center justify-center p-6">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-full bg-[#faf9f7] dark:bg-background p-4 sm:p-6 pb-[13rem] md:pb-32 lg:pb-6 overscroll-contain">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-xl sm:text-2xl font-bold text-primary">Chatbots</h1>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button className="bg-primary text-white rounded-full shrink-0">
                <Plus className="h-4 w-4 mr-2" />
                <span className="hidden sm:inline">Novo chatbot</span>
                <span className="sm:hidden">Novo</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 rounded-2xl p-2 border-border shadow-xl">
              <DropdownMenuItem
                onClick={() => setShowCreateModal(true)}
                className="rounded-xl py-3 cursor-pointer gap-3"
              >
                <div className="h-8 w-8 rounded-lg bg-gray-100 dark:bg-white/5 flex items-center justify-center">
                  <Plus className="h-4 w-4 text-gray-600 dark:text-foreground/70" />
                </div>
                <div className="flex flex-col">
                  <span className="font-semibold text-sm">Criar manualmente</span>
                  <span className="text-[10px] text-muted-foreground">Configure do seu jeito</span>
                </div>
              </DropdownMenuItem>
              <DropdownMenuSeparator className="my-1 mx-2" />
              <DropdownMenuItem
                onClick={() => navigate('/dashboard/criar-chatbot')}
                className="rounded-xl py-3 cursor-pointer gap-3"
              >
                <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Atom className="h-4 w-4 text-primary animate-spin-slow" />
                </div>
                <div className="flex flex-col">
                  <span className="font-semibold text-sm">Criar com IA</span>
                  <span className="text-[10px] text-muted-foreground">Gere um fluxo completo</span>
                </div>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <style>{`
          .animate-spin-slow { animation: spin 8s linear infinite; }
          @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        `}</style>

        {/* Busca e filtros */}
        <Card className="rounded-2xl border-none shadow-sm">
          <div className="p-4 sm:p-5 flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Pesquisar chatbot..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 h-10"
              />
            </div>

            <div className="flex items-center gap-2">
              <Select
                value={statusFilter}
                onValueChange={(v) => setStatusFilter(v as 'all' | 'active' | 'inactive')}
              >
                <SelectTrigger className="w-[140px] h-10">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="active">Ativos</SelectItem>
                  <SelectItem value="inactive">Inativos</SelectItem>
                </SelectContent>
              </Select>

              {selectedFlows.length > 0 && (
                <Button
                  variant="destructive"
                  className="rounded-full h-10 gap-2"
                  onClick={handleBulkDelete}
                >
                  <Trash2 className="h-4 w-4" />
                  <span className="hidden sm:inline">Excluir ({selectedFlows.length})</span>
                </Button>
              )}
            </div>
          </div>
        </Card>

        <TooltipProvider delayDuration={200}>
          {/* Lista mobile (cards) */}
          <div className="lg:hidden space-y-3">
            {rows.length === 0 ? (
              <Card className="rounded-2xl border-none shadow-sm p-4">{emptyState}</Card>
            ) : (
              rows.map(({ flow, totalExec, lastExec, linked, channel }) => (
                <Card key={flow.id} className="rounded-2xl border-none shadow-sm p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium text-gray-900 dark:text-foreground truncate">{flow.name}</p>
                      <p className="text-[10px] text-gray-400 dark:text-foreground/50 flex items-center gap-1 mt-0.5">
                        <Smartphone className="h-3 w-3 shrink-0" />
                        <span className="truncate">
                          {channel ? (channel.phone_number || channel.instance_name) : 'Todos canais'}
                        </span>
                      </p>
                    </div>
                    <Badge
                      variant="secondary"
                      className={`text-[10px] shrink-0 rounded-full px-3 py-1 font-bold ${
                        flow.is_active
                          ? 'bg-emerald-50 dark:bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                          : 'bg-gray-50 dark:bg-white/5 text-gray-500 dark:text-muted-foreground'
                      }`}
                    >
                      {flow.is_active ? 'Ativo' : 'Inativo'}
                    </Badge>
                  </div>

                  <div className="flex items-center gap-3 mt-3 text-xs text-gray-500 dark:text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Activity className="h-3.5 w-3.5" />{totalExec}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5" />{formatDateTime(lastExec)}
                    </span>
                    {linked > 0 && (
                      <span className="flex items-center gap-1 text-violet-600 dark:text-violet-400">
                        <Link2 className="h-3.5 w-3.5" />{linked}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2 mt-3">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 rounded-full h-9 border-gray-200 dark:border-white/15"
                      onClick={() => navigate(`/dashboard/chatbot-builder?flowId=${flow.id}`)}
                    >
                      <Pencil className="h-4 w-4 mr-2" /> Abrir fluxo
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      aria-label="Editar com IA"
                      className="rounded-full h-9 w-9 border-gray-200 dark:border-white/15"
                      onClick={() => handleEditWithAI(flow)}
                    >
                      <RadialGlowOrb size={18} />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      aria-label="Análise e logs"
                      className="rounded-full h-9 w-9 border-gray-200 dark:border-white/15"
                      onClick={() => handleOpenStats(flow)}
                    >
                      <BarChart3 className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      aria-label={flow.is_active ? 'Desativar chatbot' : 'Ativar chatbot'}
                      className={`rounded-full h-9 w-9 border-gray-200 dark:border-white/15 ${
                        flow.is_active ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'
                      }`}
                      onClick={() => handleToggleActive(flow)}
                    >
                      {flow.is_active ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="outline"
                          size="icon"
                          aria-label="Mais ações"
                          className="rounded-full h-9 w-9 border-gray-200 dark:border-white/15 text-muted-foreground"
                        >
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="rounded-xl w-44">
                        <DropdownMenuItem onClick={() => handleDuplicateFlow(flow)}>
                          <Copy className="h-4 w-4 mr-2" />Duplicar
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleDeleteFlow(flow.id)} className="text-red-600 focus:text-red-600">
                          <Trash2 className="h-4 w-4 mr-2" />Excluir
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </Card>
              ))
            )}
          </div>

          {/* Lista desktop (tabela) */}
          <Card className="hidden lg:block rounded-2xl border-none shadow-sm overflow-x-auto">
            <Table className="min-w-[820px]">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[44px]">
                    <Checkbox
                      checked={selectedFlows.length === filteredFlows.length && filteredFlows.length > 0}
                      onCheckedChange={toggleSelectAll}
                      className="rounded-md border-gray-300"
                      aria-label="Selecionar todos"
                    />
                  </TableHead>
                  <TableHead>Chatbot</TableHead>
                  <TableHead>Canal</TableHead>
                  <TableHead className="text-center">Execuções</TableHead>
                  <TableHead>Última exec.</TableHead>
                  <TableHead className="text-center">Ativo</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.length === 0 ? (
                  <TableRow className="hover:bg-transparent">
                    <TableCell colSpan={7}>{emptyState}</TableCell>
                  </TableRow>
                ) : (
                  rows.map(({ flow, totalExec, lastExec, linked, channel }) => (
                    <TableRow key={flow.id} className="hover:bg-gray-50/50 dark:hover:bg-white/5 transition-colors">
                      {/* Seleção */}
                      <TableCell className="w-[44px]">
                        <Checkbox
                          checked={selectedFlows.includes(flow.id)}
                          onCheckedChange={() => toggleSelectFlow(flow.id)}
                          className="rounded-md border-gray-300"
                          aria-label={`Selecionar ${flow.name}`}
                        />
                      </TableCell>

                      {/* Chatbot */}
                      <TableCell>
                        <div className="min-w-0 flex items-center gap-3">
                          <div className={`h-2 w-2 rounded-full shrink-0 ${flow.is_active ? 'bg-emerald-500' : 'bg-gray-300 dark:bg-white/20'}`} />
                          <div className="flex flex-col min-w-0">
                            <span className="font-medium text-gray-900 dark:text-foreground truncate text-sm">{flow.name}</span>
                            {flow.description && (
                              <span className="text-[10px] text-gray-400 dark:text-foreground/50 truncate max-w-[240px]">{flow.description}</span>
                            )}
                          </div>
                          {linked > 0 && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Badge className="bg-violet-50 dark:bg-violet-500/15 text-violet-600 dark:text-violet-400 border-violet-100 dark:border-violet-500/20 text-[10px] rounded-full px-2 py-0 h-4 shrink-0 font-medium">
                                  <Link2 className="h-2.5 w-2.5 mr-0.5" />{linked}
                                </Badge>
                              </TooltipTrigger>
                              <TooltipContent>{linked} {linked === 1 ? 'automação vinculada' : 'automações vinculadas'}</TooltipContent>
                            </Tooltip>
                          )}
                        </div>
                      </TableCell>

                      {/* Canal */}
                      <TableCell>
                        <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-muted-foreground">
                          {channel ? (
                            <>
                              <Smartphone className="h-3 w-3 shrink-0" />
                              <span className="truncate max-w-[150px]">{channel.phone_number || channel.instance_name}</span>
                            </>
                          ) : (
                            <span className="text-gray-400 dark:text-foreground/50 italic">Todos canais</span>
                          )}
                        </div>
                      </TableCell>

                      {/* Execuções */}
                      <TableCell className="text-center text-sm font-bold text-primary tabular-nums">
                        {totalExec}
                      </TableCell>

                      {/* Última execução */}
                      <TableCell className="text-[11px] font-medium text-gray-500 dark:text-muted-foreground">
                        {formatDateTime(lastExec)}
                      </TableCell>

                      {/* Ativo */}
                      <TableCell className="text-center">
                        <Switch
                          checked={flow.is_active}
                          onCheckedChange={() => handleToggleActive(flow)}
                          className="data-[state=checked]:bg-emerald-500"
                        />
                      </TableCell>

                      {/* Ações */}
                      <TableCell>
                        <div className="flex items-center justify-end gap-0.5">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                aria-label="Editar fluxo"
                                className="h-8 w-8 p-0 text-muted-foreground hover:bg-gray-100 dark:hover:bg-white/5 hover:text-primary rounded-full transition-colors"
                                onClick={() => navigate(`/dashboard/chatbot-builder?flowId=${flow.id}`)}
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Editar Fluxo</TooltipContent>
                          </Tooltip>

                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                aria-label="Editar com IA"
                                className="h-8 w-8 p-0 rounded-full hover:bg-gray-100 dark:hover:bg-white/5 transition-colors"
                                onClick={() => handleEditWithAI(flow)}
                              >
                                <RadialGlowOrb size={18} />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Inteligência Artificial</TooltipContent>
                          </Tooltip>

                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                aria-label="Análise e logs"
                                className="h-8 w-8 p-0 text-muted-foreground hover:bg-gray-100 dark:hover:bg-white/5 hover:text-primary rounded-full transition-colors"
                                onClick={() => handleOpenStats(flow)}
                              >
                                <BarChart3 className="h-3.5 w-3.5" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Análise e Logs</TooltipContent>
                          </Tooltip>

                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                aria-label="Mais ações"
                                className="h-8 w-8 p-0 text-muted-foreground hover:bg-gray-100 dark:hover:bg-white/5 rounded-full"
                              >
                                <MoreVertical className="h-3.5 w-3.5" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="rounded-xl w-44 shadow-lg border-border">
                              <DropdownMenuItem onClick={() => handleDuplicateFlow(flow)} className="rounded-lg">
                                <Copy className="h-4 w-4 mr-2 text-gray-400" />Duplicar
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleDeleteFlow(flow.id)} className="text-red-600 focus:text-red-600 rounded-lg">
                                <Trash2 className="h-4 w-4 mr-2" />Excluir
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </Card>
        </TooltipProvider>
      </div>

      {/* Create Modal */}
      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent className="sm:max-w-md rounded-3xl border-none p-0 overflow-hidden">
          <DialogHeader className="p-6 pb-2">
            <DialogTitle className="text-xl font-bold">Criar Novo Chatbot</DialogTitle>
            <DialogDescription className="text-muted-foreground">Configure as informações básicas do seu chatbot</DialogDescription>
          </DialogHeader>

          <div className="space-y-5 p-6 pt-2">
            <div className="space-y-2">
              <Label>Nome do Chatbot *</Label>
              <Input
                placeholder="Ex: Atendimento Inicial"
                value={newFlow.name}
                onChange={e => setNewFlow(prev => ({ ...prev, name: e.target.value }))}
                className="rounded-xl"
              />
            </div>

            <div className="space-y-2">
              <Label>Descrição</Label>
              <Textarea
                placeholder="Descreva o objetivo deste chatbot..."
                value={newFlow.description}
                onChange={e => setNewFlow(prev => ({ ...prev, description: e.target.value }))}
                className="rounded-xl"
              />
            </div>

            <div className="space-y-2">
              <Label>Tipo de Gatilho</Label>
              <Select
                value={newFlow.triggerType}
                onValueChange={v => setNewFlow(prev => ({ ...prev, triggerType: v }))}
              >
                <SelectTrigger className="rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="keyword">Palavra-chave</SelectItem>
                  <SelectItem value="whatsapp_channel">Canal WhatsApp</SelectItem>
                  <SelectItem value="start">Início da conversa</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {newFlow.triggerType === 'whatsapp_channel' && sessions.length > 0 && (
              <div className="space-y-2">
                <Label>Canal WhatsApp</Label>
                <Select
                  value={newFlow.sessionId}
                  onValueChange={v => setNewFlow(prev => ({ ...prev, sessionId: v }))}
                >
                  <SelectTrigger className="rounded-xl">
                    <SelectValue placeholder="Selecione um canal" />
                  </SelectTrigger>
                  <SelectContent>
                    {sessions.map(s => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.instance_name} ({s.phone_number || 'Sem número'})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <DialogFooter className="p-6 bg-muted/40 gap-3 border-t border-border">
            <Button variant="ghost" onClick={() => setShowCreateModal(false)} className="rounded-full">
              Cancelar
            </Button>
            <Button onClick={handleCreateFlow} className="rounded-full bg-primary text-white px-6">
              Criar e Editar Fluxo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Stats Modal */}
      <Dialog open={showStatsModal} onOpenChange={setShowStatsModal}>
        <DialogContent className="sm:max-w-3xl w-[calc(100vw-2rem)] rounded-3xl max-h-[85dvh] overflow-hidden flex flex-col p-0 border-none">
          <DialogHeader className="p-6 pb-2">
            <DialogTitle className="flex items-center gap-3 text-xl font-bold">
              <div className="h-10 w-10 rounded-2xl bg-primary/10 flex items-center justify-center">
                <BarChart3 className="h-5 w-5 text-primary" />
              </div>
              <div className="flex flex-col">
                <span>Análise de Fluxo</span>
                <span className="text-sm font-normal text-muted-foreground">{statsFlow?.name}</span>
              </div>
            </DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-hidden p-6 pt-2 space-y-6">

            {/* Resumo */}
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: 'Execuções', value: statsData.executions.length, accent: 'text-primary' },
                { label: 'Conversas', value: new Set(statsData.executions.map(e => e.conversation_id).filter(Boolean)).size, accent: 'text-primary' },
                { label: 'Concluídas', value: statsData.executions.filter(e => e.status === 'completed').length, accent: 'text-emerald-600 dark:text-emerald-400' },
              ].map(stat => (
                <div key={stat.label} className="bg-white dark:bg-card rounded-2xl border border-gray-100 dark:border-white/10 shadow-sm p-4 text-center">
                  <p className={`text-2xl sm:text-3xl font-bold tabular-nums ${stat.accent}`}>{stat.value}</p>
                  <p className="text-[10px] font-bold text-gray-400 dark:text-foreground/50 uppercase tracking-widest mt-1">{stat.label}</p>
                </div>
              ))}
            </div>

            <div className="flex-1 overflow-hidden flex flex-col">
              <p className="text-[10px] font-black text-gray-400 dark:text-foreground/50 uppercase tracking-widest mb-3 px-1">Log de Atividades Recentes</p>
              <ScrollArea className="h-[320px]">
                {statsData.loading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  </div>
                ) : statsData.executions.length === 0 ? (
                  <div className="text-center py-12 text-gray-400 dark:text-foreground/50">
                    <BarChart3 className="h-10 w-10 mx-auto mb-2 opacity-40" />
                    <p className="text-sm">Nenhuma execução registrada</p>
                  </div>
                ) : (
                  <div className="space-y-2 pr-4">
                    {statsData.executions.map((exec: any) => {
                      const startedAt = new Date(exec.started_at);
                      const completedAt = exec.completed_at ? new Date(exec.completed_at) : null;
                      const duration = completedAt ? Math.round((completedAt.getTime() - startedAt.getTime()) / 1000) : null;
                      const pathLength = Array.isArray(exec.execution_path) ? exec.execution_path.length : 0;
                      const variables = exec.variables || {};
                      const statusColor = exec.status === 'completed' ? 'bg-emerald-500' : exec.status === 'failed' ? 'bg-red-500' : 'bg-amber-500';

                      return (
                        <div key={exec.id} className="group rounded-2xl border border-gray-100 dark:border-white/10 shadow-sm p-4 transition-all hover:border-gray-200 dark:hover:border-white/20">
                          <div className="flex items-start justify-between gap-4 mb-3">
                            <div className="flex items-center gap-3">
                              <div className={`h-2.5 w-2.5 rounded-full shrink-0 ${statusColor} shadow-sm`} />
                              <div className="min-w-0">
                                <p className="text-sm font-bold text-gray-800 dark:text-foreground tabular-nums">
                                  {startedAt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                                </p>
                                <p className="text-[10px] font-medium text-gray-500 dark:text-muted-foreground">
                                  {startedAt.toLocaleDateString('pt-BR')}
                                </p>
                              </div>
                            </div>

                            <div className="flex flex-col items-end gap-1.5">
                              <Badge variant="outline" className={`text-[9px] px-2 py-0.5 font-bold uppercase tracking-tighter rounded-full ${
                                exec.status === 'completed' ? 'text-emerald-600 border-emerald-100 bg-emerald-50 dark:bg-emerald-500/15 dark:border-emerald-500/20 dark:text-emerald-400' :
                                exec.status === 'failed' ? 'text-red-600 border-red-100 bg-red-50 dark:bg-red-500/15 dark:border-red-500/20 dark:text-red-400' :
                                'text-amber-600 border-amber-100 bg-amber-50 dark:bg-amber-500/15 dark:border-amber-500/20 dark:text-amber-400'
                              }`}>
                                {exec.status === 'completed' ? 'Concluído' : exec.status === 'failed' ? 'Falhou' : 'Executando'}
                              </Badge>
                              {exec.contact_phone && (
                                <span className="text-[10px] text-gray-400 dark:text-foreground/50 font-medium flex items-center gap-1">
                                  <MessageSquare className="h-2.5 w-2.5" />
                                  {exec.contact_phone}
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-muted-foreground">
                            {duration !== null && (
                              <span className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {duration < 60 ? `${duration}s` : `${Math.floor(duration / 60)}m ${duration % 60}s`}
                              </span>
                            )}
                            {pathLength > 0 && (
                              <span className="flex items-center gap-1">
                                <ArrowRight className="h-3 w-3" />
                                {pathLength} nós percorridos
                              </span>
                            )}
                            {Object.keys(variables).length > 0 && (
                              <span className="flex items-center gap-1">
                                <Users className="h-3 w-3" />
                                {variables.nome || 'Sem nome'}
                              </span>
                            )}
                          </div>

                          {/* Variables detail */}
                          {Object.keys(variables).length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-1">
                              {Object.entries(variables).map(([k, v]) => (
                                <Badge key={k} variant="secondary" className="text-[10px] rounded-md">
                                  {k}: {String(v).substring(0, 30)}
                                </Badge>
                              ))}
                            </div>
                          )}

                          {/* Execution path */}
                          {pathLength > 0 && (
                            <div className="mt-2 flex items-center gap-1 overflow-x-auto">
                              {(exec.execution_path as string[]).slice(0, 8).map((nodeId: string, i: number) => (
                                <React.Fragment key={i}>
                                  {i > 0 && <ArrowRight className="h-3 w-3 text-gray-300 flex-shrink-0" />}
                                  <span className="text-[10px] bg-gray-100 dark:bg-white/5 px-1.5 py-0.5 rounded whitespace-nowrap">
                                    {nodeId.substring(0, 12)}
                                  </span>
                                </React.Fragment>
                              ))}
                              {pathLength > 8 && <span className="text-[10px] text-gray-400">+{pathLength - 8}</span>}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </ScrollArea>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ChatbotManagement;
