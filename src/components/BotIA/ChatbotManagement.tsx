import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, GitBranch, Search, Pencil, BarChart3, Copy, Trash2, MoreVertical, Loader2, MessageSquare, Users, Clock, ArrowRight, Zap, Smartphone, Calendar, Activity, Link2, Atom } from 'lucide-react';
import RadialGlowOrb from '@/components/ChatBot/RadialGlowOrb';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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

const OMNI_COLOR = '#374DA4';

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

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" style={{ color: OMNI_COLOR }} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#faf9f7] dark:bg-background">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
        {/* Header - Simple & Clean */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
          <div className="flex items-center gap-4">
            <div className="min-w-0">
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight uppercase" style={{ color: OMNI_COLOR }}>BOT IA</h1>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button 
                  className="rounded-xl h-11 px-5 gap-2 text-white shadow-lg shadow-[#374DA4]/20 hover:scale-[1.02] active:scale-[0.98] transition-all border-none"
                  style={{ backgroundColor: OMNI_COLOR }}
                >
                  <Plus className="h-4 w-4" />
                  <span className="hidden sm:inline">Novo chatbot</span>
                  <span className="sm:hidden">Novo</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 rounded-2xl p-2 border-border shadow-xl">
                <DropdownMenuItem 
                  onClick={() => setShowCreateModal(true)}
                  className="rounded-xl py-3 cursor-pointer gap-3"
                >
                  <div className="h-8 w-8 rounded-lg bg-gray-100 flex items-center justify-center">
                    <Plus className="h-4 w-4 text-gray-600" />
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
                  <div className="h-8 w-8 rounded-lg bg-[#F0F2FE] flex items-center justify-center">
                    <Atom className="h-4 w-4 text-[#374DA4] animate-spin-slow" />
                  </div>
                  <div className="flex flex-col">
                    <span className="font-semibold text-sm">Criar com IA</span>
                    <span className="text-[10px] text-muted-foreground">Gere um fluxo completo</span>
                  </div>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <style>{`
              .animate-spin-slow { animation: spin 8s linear infinite; }
              @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
            `}</style>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="bg-white dark:bg-card rounded-2xl border border-border shadow-[0_2px_8px_rgba(0,0,0,0.04)] overflow-hidden">
          {/* Search + Actions */}
          <div className="p-4 sm:p-5 flex flex-wrap items-center gap-3 border-b border-border bg-gray-50/30">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Pesquisar chatbot..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 h-10 rounded-xl bg-white border-border focus:ring-1 focus:ring-[#374DA4]/20 transition-all"
              />
            </div>
            
            <div className="flex items-center gap-2">
              <Select value={statusFilter} onValueChange={(v: any) => setStatusFilter(v)}>
                <SelectTrigger className="w-[130px] h-10 rounded-xl bg-white border-border">
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
                  size="sm" 
                  className="rounded-xl h-10 gap-2"
                  onClick={() => {
                    if(confirm(`Excluir ${selectedFlows.length} chatbots selecionados?`)) {
                      handleBulkDelete();
                    }
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                  <span className="hidden sm:inline">Excluir ({selectedFlows.length})</span>
                </Button>
              )}
            </div>
          </div>

          {/* Desktop Table Header (lg+) */}
          <div className="hidden lg:grid grid-cols-[32px_minmax(0,1fr)_150px_90px_120px_44px_104px] gap-3 px-5 py-3.5 border-b border-border bg-gray-50/50 text-[11px] font-bold text-gray-400 uppercase tracking-wider">
            <div className="flex items-center justify-center">
              <Checkbox
                checked={selectedFlows.length === filteredFlows.length && filteredFlows.length > 0}
                onCheckedChange={toggleSelectAll}
                className="rounded-md border-gray-300"
              />
            </div>
            <div>Chatbot</div>
            <div>Canal</div>
            <div className="text-center">Execuções</div>
            <div>Última exec.</div>
            <div className="text-center">Ativo</div>
            <div className="text-right">Ações</div>
          </div>

          {/* List */}
          {filteredFlows.length === 0 ? (
            <div className="text-center py-16">
              <GitBranch className="h-12 w-12 text-muted-foreground/40 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-foreground mb-2">Nenhum chatbot encontrado</h3>
              <p className="text-muted-foreground mb-6">
                {searchQuery ? 'Tente uma busca diferente' : 'Crie seu primeiro chatbot para começar'}
              </p>
              {!searchQuery && (
                <Button 
                  onClick={() => setShowCreateModal(true)}
                  style={{ backgroundColor: OMNI_COLOR }}
                  className="text-white rounded-xl"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Criar Chatbot
                </Button>
              )}
            </div>
          ) : (
            <TooltipProvider delayDuration={200}>
              <div className="divide-y divide-border/60">
                {filteredFlows.map(flow => {
                  const s = stats[flow.id];
                  const totalExec = Math.max(s?.total ?? 0, flow.execution_count ?? 0);
                  const lastExec = s?.last ?? null;
                  const linked = s?.linkedAutomations ?? 0;
                  const channel = getFlowChannel(flow);
                  
                  return (
                    <React.Fragment key={flow.id}>
                      {/* Desktop Row (lg+) */}
                      <div className="hidden lg:grid grid-cols-[32px_minmax(0,1fr)_150px_90px_120px_44px_104px] gap-3 px-5 py-3.5 items-center transition-all hover:bg-gray-50/80">
                        <div className="flex items-center justify-center">
                          <Checkbox 
                            checked={selectedFlows.includes(flow.id)} 
                            onCheckedChange={() => toggleSelectFlow(flow.id)} 
                            className="rounded-md border-gray-300"
                          />
                        </div>
                        {/* Chatbot */}
                        <div className="min-w-0 flex items-center gap-3">
                          <div className={`h-2 w-2 rounded-full shrink-0 ${flow.is_active ? 'bg-emerald-500 shadow-[0_0_0_4px_rgba(16,185,129,0.1)]' : 'bg-gray-300'}`} />
                          <div className="flex flex-col min-w-0">
                            <span className="font-semibold text-foreground truncate text-sm">{flow.name}</span>
                            {flow.description && (
                              <span className="text-[10px] text-muted-foreground truncate max-w-[200px]">{flow.description}</span>
                            )}
                          </div>
                          {linked > 0 && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Badge className="bg-violet-50 text-violet-600 border-violet-100 text-[10px] rounded-full px-1.5 py-0 h-4 shrink-0 font-medium">
                                  <Link2 className="h-2.5 w-2.5 mr-0.5" />{linked}
                                </Badge>
                              </TooltipTrigger>
                              <TooltipContent>{linked} {linked === 1 ? 'automação vinculada' : 'automações vinculadas'}</TooltipContent>
                            </Tooltip>
                          )}
                        </div>
                        {/* Canal */}
                        <div className="min-w-0 flex items-center gap-1.5 text-xs text-muted-foreground">
                          {channel ? (
                            <>
                              <Smartphone className="h-3 w-3 text-gray-400" />
                              <span className="truncate">{channel.phone_number || channel.instance_name}</span>
                            </>
                          ) : (
                            <span className="text-muted-foreground/50 italic">Todos canais</span>
                          )}
                        </div>
                        {/* Execuções */}
                        <div className="text-center">
                          <span className="text-sm font-bold text-[#374DA4] tabular-nums">{totalExec}</span>
                        </div>
                        {/* Última exec */}
                        <div className="text-[11px] text-muted-foreground font-medium">{formatDateTime(lastExec)}</div>
                        {/* Toggle */}
                        <div className="flex items-center justify-center">
                          <Switch 
                            checked={flow.is_active} 
                            onCheckedChange={() => handleToggleActive(flow)}
                            className="data-[state=checked]:bg-emerald-500"
                          />
                        </div>
                        {/* Ações */}
                        <div className="flex items-center justify-end gap-0.5">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                className="h-8 w-8 p-0 text-muted-foreground hover:bg-gray-100 hover:text-[#374DA4] rounded-lg transition-colors" 
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
                                className="h-8 w-8 p-0 rounded-lg hover:bg-gray-100 group relative overflow-hidden transition-colors" 
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
                                className="h-8 w-8 p-0 text-muted-foreground hover:bg-gray-100 hover:text-[#374DA4] rounded-lg transition-colors" 
                                onClick={() => handleOpenStats(flow)}
                              >
                                <BarChart3 className="h-3.5 w-3.5" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Análise e Logs</TooltipContent>
                          </Tooltip>

                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-muted-foreground hover:bg-gray-100 rounded-lg">
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
                      </div>

                      {/* Mobile Card */}
                      <div className="lg:hidden p-4 hover:bg-gray-50/50 transition-colors">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className={`h-2.5 w-2.5 rounded-full shrink-0 mt-1.5 ${flow.is_active ? 'bg-emerald-500' : 'bg-gray-300'}`} />
                            <div className="min-w-0">
                              <h4 className="font-semibold text-foreground text-[15px] truncate">{flow.name}</h4>
                              <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground mt-0.5">
                                <Smartphone className="h-3 w-3" />
                                <span className="truncate">{channel ? (channel.phone_number || channel.instance_name) : 'Todos canais'}</span>
                              </div>
                            </div>
                          </div>
                          <Switch checked={flow.is_active} onCheckedChange={() => handleToggleActive(flow)} className="data-[state=checked]:bg-emerald-500" />
                        </div>

                        <div className="mt-4 flex items-center justify-between">
                          <div className="flex items-center gap-4 text-[11px] text-muted-foreground">
                            <div className="flex flex-col">
                              <span className="text-[9px] uppercase font-bold text-gray-400">Execuções</span>
                              <span className="font-bold text-foreground tabular-nums text-xs">{totalExec}</span>
                            </div>
                            <div className="flex flex-col">
                              <span className="text-[9px] uppercase font-bold text-gray-400">Última</span>
                              <span className="font-medium text-foreground text-xs">{formatDateTime(lastExec)}</span>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-1">
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-muted-foreground hover:bg-gray-100 rounded-lg" onClick={() => navigate(`/dashboard/chatbot-builder?flowId=${flow.id}`)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0 rounded-lg hover:bg-gray-100" onClick={() => handleEditWithAI(flow)}>
                              <RadialGlowOrb size={20} />
                            </Button>
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-muted-foreground hover:bg-gray-100 rounded-lg" onClick={() => handleOpenStats(flow)}>
                              <BarChart3 className="h-4 w-4" />
                            </Button>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-muted-foreground hover:bg-accent rounded-lg">
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
                        </div>
                      </div>
                    </React.Fragment>
                  );
                })}
              </div>
            </TooltipProvider>
          )}
        </div>
      </div>

      {/* Create Modal */}
      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent className="sm:max-w-md rounded-[24px] border-none shadow-2xl p-0 overflow-hidden">
          <DialogHeader className="p-6 pb-2">
            <DialogTitle className="text-xl font-bold">Criar Novo Chatbot</DialogTitle>
            <DialogDescription className="text-gray-500">Configure as informações básicas do seu chatbot</DialogDescription>
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
          
          <DialogFooter className="p-6 bg-gray-50/80 gap-3 border-t border-gray-100">
            <Button variant="ghost" onClick={() => setShowCreateModal(false)} className="rounded-xl hover:bg-white transition-colors">
              Cancelar
            </Button>
            <Button 
              onClick={handleCreateFlow}
              className="rounded-xl text-white px-6 shadow-lg shadow-[#374DA4]/20 hover:scale-[1.02] active:scale-[0.98] transition-all"
              style={{ backgroundColor: OMNI_COLOR }}
            >
              Criar e Editar Fluxo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Stats Modal */}
      <Dialog open={showStatsModal} onOpenChange={setShowStatsModal}>
        <DialogContent className="sm:max-w-3xl rounded-[24px] max-h-[90vh] overflow-hidden flex flex-col p-0 border-none shadow-2xl">
          <DialogHeader className="p-6 pb-2">
            <DialogTitle className="flex items-center gap-3 text-xl font-bold">
              <div className="h-10 w-10 rounded-xl bg-[#F0F2FE] flex items-center justify-center">
                <BarChart3 className="h-5 w-5" style={{ color: OMNI_COLOR }} />
              </div>
              <div className="flex flex-col">
                <span>Análise de Fluxo</span>
                <span className="text-sm font-normal text-gray-500">{statsFlow?.name}</span>
              </div>
            </DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-hidden p-6 pt-2 space-y-6">

          {/* Summary Cards */}
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-[#F0F2FE] rounded-2xl p-4 text-center border border-[#374DA4]/5">
                <p className="text-3xl font-black" style={{ color: OMNI_COLOR }}>{statsData.executions.length}</p>
                <p className="text-[11px] font-bold uppercase tracking-wider text-[#374DA4]/60">Execuções</p>
              </div>
              <div className="bg-[#F0F2FE] rounded-2xl p-4 text-center border border-[#374DA4]/5">
                <p className="text-3xl font-black text-[#2F428D]">
                  {new Set(statsData.executions.map(e => e.conversation_id).filter(Boolean)).size}
                </p>
                <p className="text-[11px] font-bold uppercase tracking-wider text-[#2F428D]/60">Conversas</p>
              </div>
              <div className="bg-emerald-50 rounded-2xl p-4 text-center border border-emerald-100">
                <p className="text-3xl font-black text-emerald-600">
                  {statsData.executions.filter(e => e.status === 'completed').length}
                </p>
                <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-600/60">Concluídas</p>
              </div>
            </div>

            <div className="flex-1 overflow-hidden flex flex-col">
              <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-3 px-1">Log de Atividades Recentes</p>
            <ScrollArea className="h-[340px]">
              {statsData.loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin" style={{ color: OMNI_COLOR }} />
                </div>
              ) : statsData.executions.length === 0 ? (
                <div className="text-center py-12 text-gray-400">
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
                      <div key={exec.id} className="group border border-gray-100 rounded-2xl p-4 transition-all hover:bg-gray-50/50 hover:border-gray-200">
                        <div className="flex items-start justify-between gap-4 mb-3">
                          <div className="flex items-center gap-3">
                            <div className={`h-2.5 w-2.5 rounded-full shrink-0 ${statusColor} shadow-sm`} />
                            <div className="min-w-0">
                              <p className="text-sm font-bold text-gray-800 tabular-nums">
                                {startedAt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                              </p>
                              <p className="text-[10px] font-medium text-gray-500">
                                {startedAt.toLocaleDateString('pt-BR')}
                              </p>
                            </div>
                          </div>
                          
                          <div className="flex flex-col items-end gap-1.5">
                            <Badge variant="outline" className={`text-[9px] px-2 py-0.5 font-bold uppercase tracking-tighter ${
                              exec.status === 'completed' ? 'text-emerald-600 border-emerald-100 bg-emerald-50' : 
                              exec.status === 'failed' ? 'text-red-600 border-red-100 bg-red-50' : 
                              'text-amber-600 border-amber-100 bg-amber-50'
                            }`}>
                              {exec.status === 'completed' ? 'Concluído' : exec.status === 'failed' ? 'Falhou' : 'Executando'}
                            </Badge>
                            {exec.contact_phone && (
                              <span className="text-[10px] text-gray-400 font-medium flex items-center gap-1">
                                <MessageSquare className="h-2.5 w-2.5" />
                                {exec.contact_phone}
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-4 text-xs text-gray-500">
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
                                <span className="text-[10px] bg-gray-100 px-1.5 py-0.5 rounded whitespace-nowrap">
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
