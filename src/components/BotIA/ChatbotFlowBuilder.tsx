import React, { useState, useCallback } from 'react';
import { 
  Plus, MessageCircle, ArrowRight, Trash2, Settings2, 
  Play, Pause, Zap, GitBranch, Clock, Reply, Send,
  ChevronDown, ChevronUp, GripVertical, Link2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';

interface FlowNode {
  id: string;
  type: 'trigger' | 'message' | 'condition' | 'action' | 'delay';
  data: {
    label: string;
    content?: string;
    triggerType?: string;
    triggerValue?: string;
    delaySeconds?: number;
    buttons?: { id: string; label: string; nextNodeId?: string }[];
    condition?: { field: string; operator: string; value: string };
    action?: { type: string; value: string };
  };
  nextNodeId?: string;
}

interface ChatbotFlow {
  id: string;
  name: string;
  description?: string;
  nodes: FlowNode[];
  active: boolean;
  createdAt: string;
}

const NODE_TYPES = [
  { type: 'message', label: 'Mensagem', icon: MessageCircle, color: 'bg-[#374DA4]' },
  { type: 'condition', label: 'Condição', icon: GitBranch, color: 'bg-amber-500' },
  { type: 'delay', label: 'Aguardar', icon: Clock, color: 'bg-purple-500' },
  { type: 'action', label: 'Ação', icon: Zap, color: 'bg-green-500' },
];

const TRIGGER_TYPES = [
  { value: 'keyword', label: 'Palavra-chave' },
  { value: 'start', label: 'Início da Conversa' },
  { value: 'button', label: 'Clique em Botão' },
  { value: 'schedule', label: 'Horário Específico' },
  { value: 'inactivity', label: 'Inatividade' },
];

const ChatbotFlowBuilder: React.FC = () => {
  const { toast } = useToast();
  const [flows, setFlows] = useState<ChatbotFlow[]>([
    {
      id: '1',
      name: 'Boas-vindas',
      description: 'Mensagem inicial para novos contatos',
      nodes: [
        { id: 'trigger-1', type: 'trigger', data: { label: 'Gatilho', triggerType: 'start', triggerValue: '' } },
        { id: 'msg-1', type: 'message', data: { label: 'Saudação', content: 'Olá! 👋 Bem-vindo! Como posso ajudar?' }, nextNodeId: 'msg-2' },
        { id: 'msg-2', type: 'message', data: { label: 'Menu', content: 'Escolha uma opção:', buttons: [
          { id: 'btn-1', label: '📋 Ver Produtos' },
          { id: 'btn-2', label: '💬 Falar com Atendente' },
          { id: 'btn-3', label: '❓ Dúvidas' }
        ] } }
      ],
      active: true,
      createdAt: new Date().toISOString()
    },
    {
      id: '2',
      name: 'Horário de Funcionamento',
      description: 'Resposta automática sobre horários',
      nodes: [
        { id: 'trigger-2', type: 'trigger', data: { label: 'Gatilho', triggerType: 'keyword', triggerValue: 'horário, funcionamento, aberto' } },
        { id: 'msg-3', type: 'message', data: { label: 'Resposta', content: '🕐 Nosso horário de atendimento:\n\nSegunda a Sexta: 8h às 18h\nSábado: 9h às 13h\nDomingo: Fechado' } }
      ],
      active: true,
      createdAt: new Date().toISOString()
    }
  ]);

  const [selectedFlow, setSelectedFlow] = useState<ChatbotFlow | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showNodeModal, setShowNodeModal] = useState(false);
  const [editingNode, setEditingNode] = useState<FlowNode | null>(null);
  const [newFlow, setNewFlow] = useState({ name: '', description: '', triggerType: 'keyword', triggerValue: '' });
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());

  const createFlow = () => {
    if (!newFlow.name) {
      toast({ title: 'Erro', description: 'Digite um nome para o fluxo', variant: 'destructive' });
      return;
    }

    const flow: ChatbotFlow = {
      id: Date.now().toString(),
      name: newFlow.name,
      description: newFlow.description,
      nodes: [
        { 
          id: `trigger-${Date.now()}`, 
          type: 'trigger', 
          data: { 
            label: 'Gatilho', 
            triggerType: newFlow.triggerType, 
            triggerValue: newFlow.triggerValue 
          } 
        }
      ],
      active: true,
      createdAt: new Date().toISOString()
    };

    setFlows(prev => [...prev, flow]);
    setSelectedFlow(flow);
    setNewFlow({ name: '', description: '', triggerType: 'keyword', triggerValue: '' });
    setShowCreateModal(false);
    toast({ title: 'Sucesso', description: 'Fluxo criado! Adicione os nós.' });
  };

  const addNode = (type: FlowNode['type']) => {
    if (!selectedFlow) return;

    const newNode: FlowNode = {
      id: `node-${Date.now()}`,
      type,
      data: {
        label: NODE_TYPES.find(n => n.type === type)?.label || 'Novo Nó',
        content: type === 'message' ? '' : undefined,
        delaySeconds: type === 'delay' ? 5 : undefined,
      }
    };

    const updatedFlow = {
      ...selectedFlow,
      nodes: [...selectedFlow.nodes, newNode]
    };

    setFlows(prev => prev.map(f => f.id === selectedFlow.id ? updatedFlow : f));
    setSelectedFlow(updatedFlow);
    setEditingNode(newNode);
    setShowNodeModal(true);
  };

  const updateNode = (nodeId: string, data: Partial<FlowNode['data']>) => {
    if (!selectedFlow) return;

    const updatedNodes = selectedFlow.nodes.map(node =>
      node.id === nodeId ? { ...node, data: { ...node.data, ...data } } : node
    );

    const updatedFlow = { ...selectedFlow, nodes: updatedNodes };
    setFlows(prev => prev.map(f => f.id === selectedFlow.id ? updatedFlow : f));
    setSelectedFlow(updatedFlow);
  };

  const deleteNode = (nodeId: string) => {
    if (!selectedFlow) return;

    const updatedNodes = selectedFlow.nodes.filter(node => node.id !== nodeId);
    const updatedFlow = { ...selectedFlow, nodes: updatedNodes };
    setFlows(prev => prev.map(f => f.id === selectedFlow.id ? updatedFlow : f));
    setSelectedFlow(updatedFlow);
    toast({ title: 'Nó removido', description: 'O nó foi excluído do fluxo' });
  };

  const toggleFlow = (flowId: string) => {
    setFlows(prev => prev.map(f => 
      f.id === flowId ? { ...f, active: !f.active } : f
    ));
  };

  const deleteFlow = (flowId: string) => {
    setFlows(prev => prev.filter(f => f.id !== flowId));
    if (selectedFlow?.id === flowId) setSelectedFlow(null);
    toast({ title: 'Fluxo excluído', description: 'O fluxo foi removido' });
  };

  const toggleNodeExpand = (nodeId: string) => {
    setExpandedNodes(prev => {
      const next = new Set(prev);
      if (next.has(nodeId)) next.delete(nodeId);
      else next.add(nodeId);
      return next;
    });
  };

  const getNodeIcon = (type: FlowNode['type']) => {
    if (type === 'trigger') return Zap;
    return NODE_TYPES.find(n => n.type === type)?.icon || MessageCircle;
  };

  const getNodeColor = (type: FlowNode['type']) => {
    if (type === 'trigger') return 'bg-rose-500';
    return NODE_TYPES.find(n => n.type === type)?.color || 'bg-gray-500';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-foreground">Fluxos de Chatbot</h2>
          <p className="text-sm text-muted-foreground">Configure automações visuais estilo Umblertalk</p>
        </div>
        <Button 
          onClick={() => setShowCreateModal(true)} 
          className="rounded-xl bg-gradient-to-r from-[#374DA4] to-indigo-600 hover:from-[#2F428D] hover:to-indigo-700 shadow-lg"
        >
          <Plus className="h-4 w-4 mr-2" />
          Novo Fluxo
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Flows List */}
        <div className="space-y-4">
          <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">Meus Fluxos</h3>
          {flows.map(flow => (
            <Card 
              key={flow.id} 
              className={`bg-white border-0 shadow-md rounded-2xl cursor-pointer transition-all hover:shadow-lg ${
                selectedFlow?.id === flow.id ? 'ring-2 ring-[#374DA4]' : ''
              }`}
              onClick={() => setSelectedFlow(flow)}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`p-2.5 rounded-xl ${flow.active ? 'bg-[#DFE4FB]' : 'bg-gray-100'}`}>
                      <GitBranch className={`h-5 w-5 ${flow.active ? 'text-[#2F428D]' : 'text-gray-400'}`} />
                    </div>
                    <div>
                      <h4 className="font-semibold text-foreground">{flow.name}</h4>
                      <p className="text-xs text-muted-foreground">{flow.nodes.length} nós</p>
                    </div>
                  </div>
                  <Switch 
                    checked={flow.active} 
                    onCheckedChange={() => toggleFlow(flow.id)}
                    onClick={(e) => e.stopPropagation()}
                  />
                </div>
                {flow.description && (
                  <p className="text-sm text-muted-foreground mt-2 line-clamp-2">{flow.description}</p>
                )}
              </CardContent>
            </Card>
          ))}

          {flows.length === 0 && (
            <Card className="bg-white border-0 shadow-md rounded-2xl">
              <CardContent className="p-8 text-center">
                <GitBranch className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground">Nenhum fluxo criado</p>
                <Button 
                  variant="outline" 
                  className="mt-4 rounded-xl"
                  onClick={() => setShowCreateModal(true)}
                >
                  Criar Primeiro Fluxo
                </Button>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Flow Builder */}
        <div className="lg:col-span-2">
          {selectedFlow ? (
            <Card className="bg-white border-0 shadow-lg rounded-2xl">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h3 className="text-lg font-bold text-foreground">{selectedFlow.name}</h3>
                    <p className="text-sm text-muted-foreground">{selectedFlow.description || 'Sem descrição'}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="rounded-xl text-red-600 hover:bg-red-50"
                      onClick={() => deleteFlow(selectedFlow.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {/* Add Node Buttons */}
                <div className="flex flex-wrap gap-2 mb-6 p-4 bg-gradient-to-r from-[#F0F2FE] to-indigo-50 rounded-xl">
                  <span className="text-sm font-medium text-muted-foreground mr-2 self-center">Adicionar:</span>
                  {NODE_TYPES.map(nodeType => {
                    const Icon = nodeType.icon;
                    return (
                      <Button
                        key={nodeType.type}
                        variant="outline"
                        size="sm"
                        onClick={() => addNode(nodeType.type as FlowNode['type'])}
                        className="rounded-xl border-[#B3BFF0] hover:bg-[#F0F2FE]"
                      >
                        <Icon className="h-4 w-4 mr-1" />
                        {nodeType.label}
                      </Button>
                    );
                  })}
                </div>

                {/* Flow Nodes */}
                <div className="space-y-3">
                  {selectedFlow.nodes.map((node, index) => {
                    const Icon = getNodeIcon(node.type);
                    const isExpanded = expandedNodes.has(node.id);
                    
                    return (
                      <div key={node.id} className="relative">
                        {/* Connection Line */}
                        {index > 0 && (
                          <div className="absolute left-7 -top-3 w-0.5 h-3 bg-[#879CE0]" />
                        )}
                        
                        <Card className={`bg-white border shadow-sm rounded-xl overflow-hidden transition-all ${
                          node.type === 'trigger' ? 'border-rose-200' : 'border-[#DFE4FB] hover:border-[#879CE0]'
                        }`}>
                          <CardContent className="p-0">
                            {/* Node Header */}
                            <div 
                              className="flex items-center gap-3 p-4 cursor-pointer hover:bg-gray-50"
                              onClick={() => toggleNodeExpand(node.id)}
                            >
                              <div className="cursor-grab text-muted-foreground hover:text-foreground">
                                <GripVertical className="h-4 w-4" />
                              </div>
                              <div className={`p-2 rounded-lg ${getNodeColor(node.type)}`}>
                                <Icon className="h-4 w-4 text-white" />
                              </div>
                              <div className="flex-1">
                                <div className="flex items-center gap-2">
                                  <span className="font-medium text-sm">{node.data.label}</span>
                                  <Badge variant="outline" className="text-xs capitalize">
                                    {node.type === 'trigger' ? 'Gatilho' : node.type}
                                  </Badge>
                                </div>
                                {node.type === 'trigger' && (
                                  <p className="text-xs text-muted-foreground">
                                    {TRIGGER_TYPES.find(t => t.value === node.data.triggerType)?.label}
                                    {node.data.triggerValue && `: ${node.data.triggerValue}`}
                                  </p>
                                )}
                                {node.type === 'message' && node.data.content && (
                                  <p className="text-xs text-muted-foreground line-clamp-1">{node.data.content}</p>
                                )}
                              </div>
                  <div className="flex items-center gap-2">
                    {selectedFlow && index < selectedFlow.nodes.length - 1 && (
                      <ArrowRight className="h-4 w-4 text-[#5A74D1]" />
                    )}
                    {isExpanded ? (
                      <ChevronUp className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>
                </div>

                            {/* Expanded Content */}
                            {isExpanded && (
                              <div className="p-4 border-t bg-gray-50 space-y-4">
                                {node.type === 'trigger' && (
                                  <>
                                    <div>
                                      <label className="text-sm font-medium mb-2 block">Tipo de Gatilho</label>
                                      <Select 
                                        value={node.data.triggerType} 
                                        onValueChange={(v) => updateNode(node.id, { triggerType: v })}
                                      >
                                        <SelectTrigger className="rounded-xl">
                                          <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                          {TRIGGER_TYPES.map(t => (
                                            <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                    </div>
                                    {node.data.triggerType === 'keyword' && (
                                      <div>
                                        <label className="text-sm font-medium mb-2 block">Palavras-chave (separadas por vírgula)</label>
                                        <Input 
                                          value={node.data.triggerValue || ''} 
                                          onChange={(e) => updateNode(node.id, { triggerValue: e.target.value })}
                                          placeholder="Ex: preço, valor, quanto custa"
                                          className="rounded-xl"
                                        />
                                      </div>
                                    )}
                                  </>
                                )}

                                {node.type === 'message' && (
                                  <>
                                    <div>
                                      <label className="text-sm font-medium mb-2 block">Nome do Nó</label>
                                      <Input 
                                        value={node.data.label} 
                                        onChange={(e) => updateNode(node.id, { label: e.target.value })}
                                        className="rounded-xl"
                                      />
                                    </div>
                                    <div>
                                      <label className="text-sm font-medium mb-2 block">Mensagem</label>
                                      <Textarea 
                                        value={node.data.content || ''} 
                                        onChange={(e) => updateNode(node.id, { content: e.target.value })}
                                        placeholder="Digite a mensagem que será enviada..."
                                        rows={3}
                                        className="rounded-xl"
                                      />
                                    </div>
                                    <div>
                                      <label className="text-sm font-medium mb-2 block">Botões de Resposta (opcional)</label>
                                      <div className="space-y-2">
                                        {(node.data.buttons || []).map((btn, btnIdx) => (
                                          <div key={btn.id} className="flex gap-2">
                                            <Input 
                                              value={btn.label} 
                                              onChange={(e) => {
                                                const buttons = [...(node.data.buttons || [])];
                                                buttons[btnIdx] = { ...btn, label: e.target.value };
                                                updateNode(node.id, { buttons });
                                              }}
                                              placeholder="Texto do botão"
                                              className="rounded-xl"
                                            />
                                            <Button 
                                              variant="ghost" 
                                              size="icon"
                                              onClick={() => {
                                                const buttons = (node.data.buttons || []).filter((_, i) => i !== btnIdx);
                                                updateNode(node.id, { buttons });
                                              }}
                                            >
                                              <Trash2 className="h-4 w-4 text-red-500" />
                                            </Button>
                                          </div>
                                        ))}
                                        <Button 
                                          variant="outline" 
                                          size="sm"
                                          onClick={() => {
                                            const buttons = [...(node.data.buttons || []), { id: `btn-${Date.now()}`, label: '' }];
                                            updateNode(node.id, { buttons });
                                          }}
                                          className="rounded-xl"
                                        >
                                          <Plus className="h-4 w-4 mr-1" />
                                          Adicionar Botão
                                        </Button>
                                      </div>
                                    </div>
                                  </>
                                )}

                                {node.type === 'delay' && (
                                  <div>
                                    <label className="text-sm font-medium mb-2 block">Tempo de Espera (segundos)</label>
                                    <Input 
                                      type="number"
                                      value={node.data.delaySeconds || 5} 
                                      onChange={(e) => updateNode(node.id, { delaySeconds: parseInt(e.target.value) })}
                                      className="rounded-xl"
                                    />
                                  </div>
                                )}

                                {node.type !== 'trigger' && (
                                  <div className="flex justify-end pt-2">
                                    <Button 
                                      variant="ghost" 
                                      size="sm"
                                      onClick={() => deleteNode(node.id)}
                                      className="text-red-600 hover:bg-red-50 rounded-xl"
                                    >
                                      <Trash2 className="h-4 w-4 mr-1" />
                                      Excluir Nó
                                    </Button>
                                  </div>
                                )}
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className="bg-white border-0 shadow-lg rounded-2xl h-[500px] flex items-center justify-center">
              <CardContent className="text-center p-8">
                <div className="w-20 h-20 bg-gradient-to-br from-[#DFE4FB] to-indigo-100 rounded-3xl flex items-center justify-center mx-auto mb-6">
                  <GitBranch className="h-10 w-10 text-[#2F428D]" />
                </div>
                <h3 className="text-xl font-semibold text-foreground mb-2">Selecione um Fluxo</h3>
                <p className="text-muted-foreground max-w-sm mx-auto">
                  Escolha um fluxo existente para editar ou crie um novo para começar
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Create Flow Modal */}
      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent className="max-w-lg rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl">Criar Novo Fluxo</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Nome do Fluxo *</label>
              <Input 
                value={newFlow.name} 
                onChange={(e) => setNewFlow(prev => ({ ...prev, name: e.target.value }))} 
                placeholder="Ex: Boas-vindas, FAQ, Agendamento" 
                className="rounded-xl"
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Descrição (opcional)</label>
              <Textarea 
                value={newFlow.description} 
                onChange={(e) => setNewFlow(prev => ({ ...prev, description: e.target.value }))} 
                placeholder="Descreva o objetivo deste fluxo..." 
                rows={2}
                className="rounded-xl"
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Gatilho Inicial</label>
              <Select 
                value={newFlow.triggerType} 
                onValueChange={(v) => setNewFlow(prev => ({ ...prev, triggerType: v }))}
              >
                <SelectTrigger className="rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TRIGGER_TYPES.map(t => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {newFlow.triggerType === 'keyword' && (
              <div>
                <label className="text-sm font-medium mb-2 block">Palavras-chave</label>
                <Input 
                  value={newFlow.triggerValue} 
                  onChange={(e) => setNewFlow(prev => ({ ...prev, triggerValue: e.target.value }))} 
                  placeholder="Ex: oi, olá, bom dia (separadas por vírgula)" 
                  className="rounded-xl"
                />
              </div>
            )}
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowCreateModal(false)} className="rounded-xl">
              Cancelar
            </Button>
            <Button 
              onClick={createFlow} 
              className="rounded-xl bg-gradient-to-r from-[#374DA4] to-indigo-600 hover:from-[#2F428D] hover:to-indigo-700"
            >
              Criar Fluxo
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ChatbotFlowBuilder;
