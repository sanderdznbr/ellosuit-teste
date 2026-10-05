import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  GitBranch, Save, Play, ArrowLeft, Plus, BarChart3,
  Pause, Settings, ChevronDown, Trash2, Sparkles, MessageCircle, Clock,
  FileText, AlertTriangle, CheckCircle
} from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';
import ChatBotMobileBuilder from './ChatBotMobileBuilder';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger,
  DropdownMenuSeparator 
} from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import ChatBotSidebar from './ChatBotSidebar';
import ChatBotCanvas from './ChatBotCanvas';
import ChatBotPropertiesPanel from './ChatBotPropertiesPanel';
import ChatBotAIAssistant from './ChatBotAIAssistant';
import ChatBotTestSimulator from './ChatBotTestSimulator';
import Draggable from 'react-draggable';
import { FlowNode, FlowEdge, BlockDefinition, ChatBotFlow } from './types';
import ActiveHoursDialog from '@/components/shared/ActiveHoursDialog';
import { ActiveHoursConfig, normalizeActiveHours, summarizeActiveHours } from '@/lib/active-hours';

const BRAND_COLOR = '#374DA4';

const ChatBotBuilder: React.FC = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const { isMobile } = useIsMobile();
  
  // State
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [flows, setFlows] = useState<ChatBotFlow[]>([]);
  const [currentFlow, setCurrentFlow] = useState<ChatBotFlow | null>(null);
  const [nodes, setNodes] = useState<FlowNode[]>([]);
  const [edges, setEdges] = useState<FlowEdge[]>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [flowName, setFlowName] = useState('Novo Fluxo');
  const [isSaving, setIsSaving] = useState(false);
  const [showNewFlowDialog, setShowNewFlowDialog] = useState(false);
  const [newFlowName, setNewFlowName] = useState('');
  const [loading, setLoading] = useState(true);
  const [showAIPanel, setShowAIPanel] = useState(false);
  const [showTestPanel, setShowTestPanel] = useState(false);
  const [showActiveHours, setShowActiveHours] = useState(false);
  const [showSummary, setShowSummary] = useState(false);

  // Get company ID
  useEffect(() => {
    const getCompanyId = async () => {
      if (!user?.id) return;
      
      const { data } = await supabase
        .from('company_users')
        .select('company_id')
        .eq('user_id', user.id)
        .single();
      
      if (data?.company_id) {
        setCompanyId(data.company_id);
      }
    };
    getCompanyId();
  }, [user?.id]);

  // Load flows
  useEffect(() => {
    const loadFlows = async () => {
      if (!companyId) return;
      
      const { data, error } = await supabase
        .from('chatbot_flows')
        .select('*')
        .eq('company_id', companyId)
        .order('updated_at', { ascending: false });
      
      if (!error && data) {
        const typedFlows = data.map(flow => ({
          ...flow,
          nodes: (Array.isArray(flow.nodes) ? flow.nodes : []) as unknown as FlowNode[],
          edges: (Array.isArray(flow.edges) ? flow.edges : []) as unknown as FlowEdge[],
          trigger_config: flow.trigger_config as Record<string, any> | undefined
        })) as ChatBotFlow[];
        setFlows(typedFlows);
        
        if (typedFlows.length > 0 && !currentFlow) {
          selectFlow(typedFlows[0]);
        }
      }
      setLoading(false);
    };
    
    loadFlows();
  }, [companyId]);

  const selectFlow = (flow: ChatBotFlow) => {
    setCurrentFlow(flow);
    setFlowName(flow.name);
    setNodes(flow.nodes || []);
    setEdges(flow.edges || []);
    setSelectedNodeId(null);
  };

  const handleDragStart = useCallback((block: BlockDefinition) => {
    // Optional: track drag state
  }, []);

  const handleNodeSelect = useCallback((node: FlowNode | null) => {
    setSelectedNodeId(node?.id || null);
  }, []);

  const handleNodeUpdate = useCallback((nodeId: string, updates: Partial<FlowNode>) => {
    setNodes(prev => prev.map(node => 
      node.id === nodeId ? { ...node, ...updates } : node
    ));
  }, []);

  const handleApplyAIFlow = useCallback((newNodes: FlowNode[], newEdges: FlowEdge[]) => {
    setNodes(newNodes);
    setEdges(newEdges);
  }, []);

  const saveFlow = async () => {
    if (!companyId || !user?.id) {
      toast({ title: 'Erro', description: 'Usuário não autenticado', variant: 'destructive' });
      return;
    }
    
    setIsSaving(true);
    
    try {
      if (currentFlow) {
        const { error } = await supabase
          .from('chatbot_flows')
          .update({
            name: flowName,
            nodes: nodes as any,
            edges: edges as any,
            updated_at: new Date().toISOString()
          })
          .eq('id', currentFlow.id);
        
        if (error) throw error;
        
        setFlows(prev => prev.map(f => 
          f.id === currentFlow.id 
            ? { ...f, name: flowName, nodes, edges, updated_at: new Date().toISOString() }
            : f
        ));
      } else {
        const { data, error } = await supabase
          .from('chatbot_flows')
          .insert({
            company_id: companyId,
            created_by: user.id,
            name: flowName,
            nodes: nodes as any,
            edges: edges as any
          })
          .select()
          .single();
        
        if (error) throw error;
        
        const newFlow = {
          ...data,
          nodes: (Array.isArray(data.nodes) ? data.nodes : []) as unknown as FlowNode[],
          edges: (Array.isArray(data.edges) ? data.edges : []) as unknown as FlowEdge[]
        } as ChatBotFlow;
        
        setFlows(prev => [newFlow, ...prev]);
        setCurrentFlow(newFlow);
      }
      
      toast({ title: 'Salvo!', description: 'Fluxo salvo com sucesso' });
    } catch (error: any) {
      toast({ title: 'Erro', description: error.message || 'Erro ao salvar fluxo', variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const createNewFlow = async () => {
    if (!newFlowName.trim() || !companyId || !user?.id) return;
    
    try {
      const { data, error } = await supabase
        .from('chatbot_flows')
        .insert({
          company_id: companyId,
          created_by: user.id,
          name: newFlowName,
          nodes: [],
          edges: []
        })
        .select()
        .single();
      
      if (error) throw error;
      
      const newFlow = {
        ...data,
        nodes: [] as FlowNode[],
        edges: [] as FlowEdge[]
      } as ChatBotFlow;
      
      setFlows(prev => [newFlow, ...prev]);
      selectFlow(newFlow);
      setShowNewFlowDialog(false);
      setNewFlowName('');
      toast({ title: 'Criado!', description: 'Novo fluxo criado' });
    } catch (error: any) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    }
  };

  const toggleFlowActive = async () => {
    if (!currentFlow) return;
    
    try {
      const { error } = await supabase
        .from('chatbot_flows')
        .update({ is_active: !currentFlow.is_active })
        .eq('id', currentFlow.id);
      
      if (error) throw error;

      // When activating a flow, clear "humano" tag (human_takeover) from all
      // conversations of this company so the bot can respond on next inbound.
      if (!currentFlow.is_active && companyId) {
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

      setCurrentFlow(prev => prev ? { ...prev, is_active: !prev.is_active } : null);
      setFlows(prev => prev.map(f => 
        f.id === currentFlow.id ? { ...f, is_active: !f.is_active } : f
      ));
      
      toast({ 
        title: currentFlow.is_active ? 'Desativado' : 'Ativado',
        description: `Fluxo ${currentFlow.is_active ? 'desativado' : 'ativado'} com sucesso`
      });
    } catch (error: any) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    }
  };

  const deleteFlow = async () => {
    if (!currentFlow) return;
    
    if (!confirm(`Excluir o fluxo "${currentFlow.name}"? Esta ação não pode ser desfeita.`)) {
      return;
    }
    
    try {
      const { error } = await supabase
        .from('chatbot_flows')
        .delete()
        .eq('id', currentFlow.id);
      
      if (error) throw error;
      
      const remaining = flows.filter(f => f.id !== currentFlow.id);
      setFlows(remaining);
      
      if (remaining.length > 0) {
        selectFlow(remaining[0]);
      } else {
        setCurrentFlow(null);
        setNodes([]);
        setEdges([]);
        setFlowName('Novo Fluxo');
      }
      
      toast({ title: 'Excluído', description: 'Fluxo removido com sucesso' });
    } catch (error: any) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    }
  };

  const selectedNode = nodes.find(n => n.id === selectedNodeId) || null;

  const saveActiveHours = async (cfg: ActiveHoursConfig) => {
    if (!currentFlow) {
      toast({ title: 'Salve o fluxo primeiro', description: 'Crie/salve o fluxo antes de configurar horário.', variant: 'destructive' });
      return;
    }
    const newTrigger = { ...(currentFlow.trigger_config || {}), active_hours: cfg };
    const { error } = await supabase
      .from('chatbot_flows')
      .update({ trigger_config: newTrigger as any })
      .eq('id', currentFlow.id);
    if (error) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
      return;
    }
    setCurrentFlow(prev => prev ? { ...prev, trigger_config: newTrigger } : null);
    setFlows(prev => prev.map(f => f.id === currentFlow.id ? { ...f, trigger_config: newTrigger } : f));
    toast({ title: 'Horário salvo', description: cfg.enabled ? summarizeActiveHours(cfg) : 'Restrição de horário desativada' });
  };

  const validateFlow = () => {
    const issues: { type: 'error' | 'warning'; message: string }[] = [];
    const triggerNodes = nodes.filter(n => n.type === 'trigger');
    
    if (triggerNodes.length === 0) {
      issues.push({ type: 'error', message: 'O fluxo precisa de pelo menos um gatilho de início.' });
    }

    triggerNodes.forEach(n => {
      if (n.subType === 'whatsapp_channel' && !n.data.config?.sessionId) {
        issues.push({ type: 'error', message: `Gatilho "${n.data.label}": canal WhatsApp não selecionado.` });
      }
    });

    nodes.forEach(n => {
      // Disconnected nodes (no incoming edges, except triggers)
      if (n.type !== 'trigger') {
        const hasIncoming = edges.some(e => e.target === n.id);
        if (!hasIncoming) {
          issues.push({ type: 'warning', message: `Bloco "${n.data.label}" está desconectado (sem entrada).` });
        }
      }

      // Dead ends (no outgoing edges, except for terminal actions)
      const terminalSubtypes = ['transfer_human', 'transfer_ai_agent'];
      const isTerminal = terminalSubtypes.includes(n.subType);
      
      if (!isTerminal) {
        const hasOutgoing = edges.some(e => e.source === n.id);
        if (!hasOutgoing) {
          issues.push({ type: 'warning', message: `Bloco "${n.data.label}" é um fim de linha (sem saída conectada).` });
        }
      }

      // Missing message content
      if (n.type === 'message' && n.subType === 'text' && !n.data.config?.content) {
        issues.push({ type: 'warning', message: `Bloco "${n.data.label}" está sem conteúdo de mensagem.` });
      }
    });

    return issues;
  };

  const flowIssues = validateFlow();

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2" style={{ borderColor: BRAND_COLOR }}></div>
      </div>
    );
  }

  if (isMobile) {
    return (
      <ChatBotMobileBuilder
        nodes={nodes}
        edges={edges}
        flowName={flowName}
        isActive={currentFlow?.is_active || false}
        isSaving={isSaving}
        onNodesChange={setNodes}
        onEdgesChange={setEdges}
        onFlowNameChange={setFlowName}
        onSave={saveFlow}
        onToggleActive={toggleFlowActive}
        onBack={() => navigate(-1)}
        onNodeUpdate={handleNodeUpdate}
      />
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#ecebe4] dark:bg-background overflow-hidden relative">
      {/* Header — Claude style: flat, quiet, single row */}
      <header className="flex-shrink-0 border-b border-border bg-[#f3f2ee] dark:bg-[#161616] backdrop-blur-xl">
        <div className="h-14 px-4 flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(-1)}
            className="h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>

          <div className="min-w-0 flex items-center gap-2">
            <Input
              value={flowName}
              onChange={(e) => setFlowName(e.target.value)}
              className="h-8 w-[220px] max-w-[38vw] text-sm font-medium border-0 px-2 bg-transparent rounded-lg hover:bg-muted/60 focus-visible:bg-muted/60 focus-visible:ring-0 truncate"
              placeholder="Nome do fluxo"
            />
            <span
              className={`hidden sm:inline-flex items-center gap-1.5 text-[11px] px-2 py-0.5 rounded-full border ${
                currentFlow?.is_active
                  ? 'border-emerald-500/25 text-emerald-600 bg-emerald-500/10'
                  : 'border-border text-muted-foreground bg-muted/50'
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${currentFlow?.is_active ? 'bg-emerald-500' : 'bg-muted-foreground/50'}`} />
              {currentFlow?.is_active ? 'Ativo' : 'Inativo'}
            </span>
          </div>

          <div className="ml-auto flex items-center gap-1.5">
            <button
              onClick={() => { setShowTestPanel(!showTestPanel); if (!showTestPanel) setShowAIPanel(false); }}
              className={`h-7 px-2.5 inline-flex items-center gap-1.5 rounded-md text-xs font-medium transition-colors ${
                showTestPanel ? 'bg-muted shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <MessageCircle className="h-3.5 w-3.5" />
              Testar
            </button>
            <button
              onClick={() => {
                const url = currentFlow?.id ? `/dashboard/criar-chatbot?flowId=${currentFlow.id}&prompt=Edite o fluxo "${flowName}"` : '/dashboard/criar-chatbot';
                navigate(url);
              }}
              className={`h-7 px-2.5 inline-flex items-center gap-1.5 rounded-md text-xs font-medium transition-colors text-muted-foreground hover:text-foreground hover:bg-muted`}
            >
              <Sparkles className="h-3.5 w-3.5" />
              Criação de chatbot com IA
            </button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowSummary(true)}
              className="h-7 px-2.5 gap-1.5 rounded-md text-xs text-muted-foreground hover:text-foreground"
            >
              <FileText className="h-3.5 w-3.5" />
              Resumo
            </Button>



            {/* Flow Selector */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-8 gap-1.5 rounded-lg text-xs text-muted-foreground hover:text-foreground">
                  <span className="max-w-[110px] truncate">{currentFlow?.name || 'Selecionar'}</span>
                  <ChevronDown className="h-3.5 w-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 rounded-xl">
                <DropdownMenuItem onClick={() => setShowNewFlowDialog(true)} className="rounded-lg text-sm">
                  <Plus className="h-4 w-4 mr-2" />
                  Novo fluxo
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                {flows.map(flow => (
                  <DropdownMenuItem
                    key={flow.id}
                    onClick={() => selectFlow(flow)}
                    className={`rounded-lg text-sm ${currentFlow?.id === flow.id ? 'bg-muted' : ''}`}
                  >
                    <div className="flex items-center justify-between w-full gap-2">
                      <span className="truncate">{flow.name}</span>
                      {flow.is_active && <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />}
                    </div>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {currentFlow && (
              <>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={toggleFlowActive}
                  title={currentFlow.is_active ? 'Pausar fluxo' : 'Ativar fluxo'}
                  className="h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground"
                >
                  {currentFlow.is_active ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                </Button>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground">
                      <Settings className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="rounded-xl">
                    <DropdownMenuItem className="rounded-lg text-sm">
                      <BarChart3 className="h-4 w-4 mr-2" />
                      Ver estatísticas
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setShowActiveHours(true)} className="rounded-lg text-sm">
                      <Clock className="h-4 w-4 mr-2" />
                      Horário de funcionamento
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={deleteFlow} className="text-destructive rounded-lg text-sm">
                      <Trash2 className="h-4 w-4 mr-2" />
                      Excluir fluxo
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            )}

            <div className="w-px h-5 bg-border mx-0.5" />

            <Button
              onClick={saveFlow}
              disabled={isSaving}
              size="sm"
              className="h-8 gap-1.5 rounded-lg text-white text-xs font-medium shadow-none hover:opacity-90"
              style={{ backgroundColor: BRAND_COLOR }}
            >
              <Save className="h-3.5 w-3.5" />
              {isSaving ? 'Salvando...' : 'Salvar'}
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 min-h-0 flex overflow-hidden">
        <ChatBotSidebar onDragStart={handleDragStart} />
        
        <ChatBotCanvas
          nodes={nodes}
          edges={edges}
          onNodesChange={setNodes}
          onEdgesChange={setEdges}
          onNodeSelect={handleNodeSelect}
          selectedNodeId={selectedNodeId}
        />
        
        {selectedNode && (
          <ChatBotPropertiesPanel
            node={selectedNode}
            flowId={currentFlow?.id || null}
            onClose={() => setSelectedNodeId(null)}
            onUpdate={handleNodeUpdate}
          />
        )}

        {showAIPanel && !selectedNode && !showTestPanel && (
          <div className="w-[400px] border-l border-border bg-background animate-in slide-in-from-right duration-300">
            <ChatBotAIAssistant
              onApplyFlow={handleApplyAIFlow}
              currentNodes={nodes}
              currentEdges={edges}
            />
          </div>
        )}

        {showTestPanel && (
          <Draggable handle=".drag-handle" bounds="parent">
            <div className="absolute top-20 right-8 z-[100] w-[380px] h-[600px] shadow-2xl rounded-2xl overflow-hidden border border-border bg-background animate-in fade-in zoom-in-95 duration-200">
              <ChatBotTestSimulator
                nodes={nodes}
                edges={edges}
                onClose={() => setShowTestPanel(false)}
              />
            </div>
          </Draggable>
        )}
      </div>

      {/* New Flow Dialog */}
      <Dialog open={showNewFlowDialog} onOpenChange={setShowNewFlowDialog}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle>Criar Novo Fluxo</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Input
              value={newFlowName}
              onChange={(e) => setNewFlowName(e.target.value)}
              placeholder="Nome do fluxo"
              className="rounded-xl"
              onKeyDown={(e) => e.key === 'Enter' && createNewFlow()}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewFlowDialog(false)} className="rounded-xl">
              Cancelar
            </Button>
            <Button 
              onClick={createNewFlow} 
              disabled={!newFlowName.trim()}
              className="rounded-xl text-white"
              style={{ backgroundColor: BRAND_COLOR }}
            >
              Criar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ActiveHoursDialog
        open={showActiveHours}
        onOpenChange={setShowActiveHours}
        value={normalizeActiveHours((currentFlow?.trigger_config as any)?.active_hours)}
        onSave={saveActiveHours}
        targetLabel={currentFlow?.name}
      />

      <Dialog open={showSummary} onOpenChange={setShowSummary}>
        <DialogContent className="rounded-2xl max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" style={{ color: BRAND_COLOR }} />
              Resumo do Fluxo
            </DialogTitle>
          </DialogHeader>
          
          <ScrollArea className="max-h-[60vh] pr-4">
            <div className="space-y-6 py-2">
              <div>
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                  Estrutura do Atendimento
                </h4>
                <div className="space-y-3">
                  {nodes.length === 0 ? (
                    <p className="text-sm text-muted-foreground italic">Nenhum bloco adicionado ainda.</p>
                  ) : (
                    nodes.map((n, idx) => (
                      <div key={n.id} className="flex gap-3">
                        <div className="flex flex-col items-center gap-1">
                          <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-[10px] font-bold">
                            {idx + 1}
                          </div>
                          {idx < nodes.length - 1 && <div className="w-px h-full bg-border" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{n.data.label}</p>
                          <p className="text-[11px] text-muted-foreground line-clamp-1">{n.subType.replace(/_/g, ' ')}</p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div>
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                  Validação & Integridade
                </h4>
                <div className="space-y-2">
                  {flowIssues.length === 0 ? (
                    <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 border border-emerald-100 dark:border-emerald-500/20">
                      <CheckCircle className="h-4 w-4 shrink-0" />
                      <p className="text-xs font-medium">Fluxo validado! Tudo parece correto.</p>
                    </div>
                  ) : (
                    flowIssues.map((issue, i) => (
                      <div 
                        key={i} 
                        className={cn(
                          "flex items-start gap-2 p-3 rounded-xl border",
                          issue.type === 'error' 
                            ? "bg-rose-50 dark:bg-rose-500/10 text-rose-600 border-rose-100 dark:border-rose-500/20"
                            : "bg-amber-50 dark:bg-amber-500/10 text-amber-600 border-amber-100 dark:border-amber-500/20"
                        )}
                      >
                        <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                        <p className="text-xs leading-relaxed">{issue.message}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </ScrollArea>

          <DialogFooter>
            <Button onClick={() => setShowSummary(false)} className="rounded-xl w-full">
              Entendido
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ChatBotBuilder;
