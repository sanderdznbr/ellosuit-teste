import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  ArrowLeft, Save, Plus, Trash2, ChevronDown,
  Settings, Play, Pause, MessageSquare, GitBranch, Clock,
  Zap, Phone, Mail, Hash, Globe, Tag, UserPlus, Database,
  Send, Image, FileText, List, ToggleLeft, Bot, GripVertical,
  X, Sparkles, MessageCircle, Search, Check, XCircle, Copy,
  Maximize2, Move
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator
} from '@/components/ui/dropdown-menu';
import { useToast } from '@/hooks/use-toast';
import { FlowNode, FlowEdge, BlockDefinition, BlockCategory } from './types';
import ChatBotPropertiesPanel from './ChatBotPropertiesPanel';
import { cn } from '@/lib/utils';

const BRAND_COLOR = '#374DA4';
const NODE_WIDTH = 220;

const iconMap: Record<string, React.ComponentType<any>> = {
  Phone, Mail, Hash, MessageSquare, Clock, Globe, ToggleLeft, Bot,
  List, Image, FileText, GitBranch, Database, Tag, UserPlus, Send, Zap
};

const nodeColors: Record<string, string> = {
  trigger: '#374DA4',
  message: '#22C55E',
  condition: '#F59E0B',
  action: '#8B5CF6',
  delay: '#6B7280',
};

const BLOCK_CATEGORIES: BlockCategory[] = [
  {
    id: 'start', label: 'INÍCIO', color: BRAND_COLOR,
    blocks: [
      { type: 'trigger', subType: 'whatsapp_channel', label: 'Iniciar por canal', description: 'Inicia pelo WhatsApp', icon: 'Phone', defaultConfig: { sessionId: '', triggerWhen: 'any_message' } },
      { type: 'trigger', subType: 'manual', label: 'Iniciar manualmente', description: 'Atendente ativa', icon: 'Zap', defaultConfig: {} },
    ]
  },
  {
    id: 'messages', label: 'MENSAGENS', color: BRAND_COLOR,
    blocks: [
      { type: 'message', subType: 'text', label: 'Enviar mensagem', description: 'Texto simples', icon: 'MessageSquare', defaultConfig: { content: '' } },
      { type: 'message', subType: 'buttons', label: 'Botões de Resposta', description: 'Até 3 botões interativos', icon: 'ToggleLeft', defaultConfig: { content: '', buttons: [], interactive_type: 'reply_buttons' } },
      { type: 'message', subType: 'list', label: 'Lista de Opções', description: 'Menu dropdown (até 10)', icon: 'List', defaultConfig: { content: '', button_text: 'Ver opções', sections: [{ title: 'Opções', rows: [{ id: '1', title: 'Opção 1' }] }] } },
      { type: 'message', subType: 'image', label: 'Enviar mídia', description: 'Imagem/vídeo/arquivo', icon: 'Image', defaultConfig: { url: '', caption: '' } },
    ]
  },
  {
    id: 'conditions', label: 'CONDIÇÃO', color: BRAND_COLOR,
    blocks: [
      { type: 'condition', subType: 'if_else', label: 'Definir condição', description: 'Regra if/else', icon: 'GitBranch', defaultConfig: { conditionType: 'user_response', operator: 'contains', value: '' } },
      { type: 'condition', subType: 'time', label: 'Horários', description: 'Verificar horário', icon: 'Clock', defaultConfig: { startHour: 9, endHour: 18 } },
      { type: 'condition', subType: 'multi', label: 'Multi-condicional', description: 'Múltiplas regras', icon: 'GitBranch', defaultConfig: { conditions: [{ id: 'cond_1', label: 'Condição 1', operator: 'contains', value: '' }] } },
    ]
  },
  {
    id: 'actions', label: 'AÇÕES', color: BRAND_COLOR,
    blocks: [
      { type: 'action', subType: 'assign_tag', label: 'Atribuir Tag', description: 'Adicionar etiqueta', icon: 'Tag', defaultConfig: { tag: '' } },
      { type: 'action', subType: 'transfer_human', label: 'Transferir Humano', description: 'Atendimento humano', icon: 'UserPlus', defaultConfig: { departmentName: '' } },
      { type: 'action', subType: 'transfer_ai_agent', label: 'Transferir IA', description: 'Ativar agente IA', icon: 'Bot', defaultConfig: { agentId: '' } },
      { type: 'action', subType: 'save_crm', label: 'Salvar no CRM', description: 'Salvar como lead', icon: 'Database', defaultConfig: { nameField: '{{nome}}' } },
      { type: 'action', subType: 'call_api', label: 'Chamar API', description: 'Requisição externa', icon: 'Globe', defaultConfig: { url: '', method: 'POST' } },
    ]
  },
  {
    id: 'delays', label: 'DELAYS', color: BRAND_COLOR,
    blocks: [
      { type: 'delay', subType: 'wait_interval', label: 'Aguardar intervalo', description: 'Pausar por tempo', icon: 'Clock', defaultConfig: { seconds: 5 } },
      { type: 'delay', subType: 'wait_until', label: 'Aguardar até', description: 'Pausar até data', icon: 'Clock', defaultConfig: { datetime: '' } },
    ]
  },
];

interface ChatBotMobileBuilderProps {
  nodes: FlowNode[];
  edges: FlowEdge[];
  flowName: string;
  isActive: boolean;
  isSaving: boolean;
  flowId?: string | null;
  onNodesChange: (nodes: FlowNode[]) => void;
  onEdgesChange: (edges: FlowEdge[]) => void;
  onFlowNameChange: (name: string) => void;
  onSave: () => void;
  onToggleActive: () => void;
  onBack: () => void;
  onNodeUpdate: (nodeId: string, updates: Partial<FlowNode>) => void;
}

const ChatBotMobileBuilder: React.FC<ChatBotMobileBuilderProps> = ({
  nodes, edges, flowName, isActive, isSaving, flowId,
  onNodesChange, onEdgesChange, onFlowNameChange,
  onSave, onToggleActive, onBack, onNodeUpdate,
}) => {
  const { toast } = useToast();
  const canvasRef = useRef<HTMLDivElement>(null);

  // Canvas state
  const [scale, setScale] = useState(0.8);
  const [offset, setOffset] = useState({ x: 40, y: 20 });
  // Mutable refs mirror the latest state so native (non-React) listeners
  // always read fresh values without re-binding.
  const scaleRef = useRef(scale);
  const offsetRef = useRef(offset);
  useEffect(() => { scaleRef.current = scale; }, [scale]);
  useEffect(() => { offsetRef.current = offset; }, [offset]);

  // Node drag (driven by React handlers on the card)
  const [draggingNode, setDraggingNode] = useState<string | null>(null);
  const draggingNodeRef = useRef<string | null>(null);
  useEffect(() => { draggingNodeRef.current = draggingNode; }, [draggingNode]);
  const dragOffsetRef = useRef({ x: 0, y: 0 });
  const longPressTimer = useRef<number | null>(null);
  const touchStartPos = useRef<{ x: number; y: number; t: number } | null>(null);
  const nodesRef = useRef(nodes);
  useEffect(() => { nodesRef.current = nodes; }, [nodes]);

  // Connection state
  const [connectingFrom, setConnectingFrom] = useState<{ nodeId: string; handle?: string } | null>(null);

  // UI state
  const [showSidebar, setShowSidebar] = useState(false);
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const editingNode = nodes.find(n => n.id === editingNodeId) || null;

  // --- Native touch handlers (passive:false so we can prevent default browser
  // scroll/zoom inside the canvas while still allowing scroll outside). ---
  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;

    type Gesture =
      | { mode: 'idle' }
      | { mode: 'pan'; startX: number; startY: number; startOffX: number; startOffY: number }
      | { mode: 'pinch'; startDist: number; startScale: number; startOffX: number; startOffY: number; focalX: number; focalY: number };
    let gesture: Gesture = { mode: 'idle' };

    const isOnNode = (target: EventTarget | null) => {
      if (!(target instanceof HTMLElement)) return false;
      return !!target.closest('[data-node-card="true"], [data-node-handle="true"]');
    };

    const onTouchStart = (e: TouchEvent) => {
      // Always prevent the browser from hijacking the gesture inside the canvas.
      if (e.touches.length >= 1) e.preventDefault();

      if (draggingNodeRef.current) return;

      const rect = el.getBoundingClientRect();

      if (e.touches.length === 2) {
        const [a, b] = [e.touches[0], e.touches[1]];
        const dx = a.clientX - b.clientX;
        const dy = a.clientY - b.clientY;
        const dist = Math.hypot(dx, dy) || 1;
        gesture = {
          mode: 'pinch',
          startDist: dist,
          startScale: scaleRef.current,
          startOffX: offsetRef.current.x,
          startOffY: offsetRef.current.y,
          focalX: (a.clientX + b.clientX) / 2 - rect.left,
          focalY: (a.clientY + b.clientY) / 2 - rect.top,
        };
        return;
      }

      if (e.touches.length === 1 && !isOnNode(e.target)) {
        const t = e.touches[0];
        gesture = {
          mode: 'pan',
          startX: t.clientX,
          startY: t.clientY,
          startOffX: offsetRef.current.x,
          startOffY: offsetRef.current.y,
        };
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      if (gesture.mode === 'idle' && !draggingNodeRef.current) return;
      e.preventDefault();

      // Node dragging is driven separately, but we keep the canvas from panning.
      if (draggingNodeRef.current) return;

      if (gesture.mode === 'pinch' && e.touches.length === 2) {
        const [a, b] = [e.touches[0], e.touches[1]];
        const dx = a.clientX - b.clientX;
        const dy = a.clientY - b.clientY;
        const dist = Math.hypot(dx, dy) || 1;
        const rawScale = (gesture.startScale * dist) / gesture.startDist;
        const next = Math.min(Math.max(rawScale, 0.3), 2.5);
        // keep the focal point anchored under the fingers
        const k = next / gesture.startScale;
        const newOffX = gesture.focalX - k * (gesture.focalX - gesture.startOffX);
        const newOffY = gesture.focalY - k * (gesture.focalY - gesture.startOffY);
        setScale(next);
        setOffset({ x: newOffX, y: newOffY });
        return;
      }

      if (gesture.mode === 'pan' && e.touches.length === 1) {
        const t = e.touches[0];
        setOffset({
          x: gesture.startOffX + (t.clientX - gesture.startX),
          y: gesture.startOffY + (t.clientY - gesture.startY),
        });
      }
    };

    const onTouchEnd = (e: TouchEvent) => {
      if (e.touches.length === 0) {
        gesture = { mode: 'idle' };
        return;
      }
      // dropped from 2 → 1 finger: switch to pan from current position
      if (gesture.mode === 'pinch' && e.touches.length === 1) {
        const t = e.touches[0];
        gesture = {
          mode: 'pan',
          startX: t.clientX,
          startY: t.clientY,
          startOffX: offsetRef.current.x,
          startOffY: offsetRef.current.y,
        };
      }
    };

    el.addEventListener('touchstart', onTouchStart, { passive: false });
    el.addEventListener('touchmove', onTouchMove, { passive: false });
    el.addEventListener('touchend', onTouchEnd, { passive: false });
    el.addEventListener('touchcancel', onTouchEnd, { passive: false });

    return () => {
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove', onTouchMove);
      el.removeEventListener('touchend', onTouchEnd);
      el.removeEventListener('touchcancel', onTouchEnd);
    };
  }, []);

  // Native node-drag move listener (also non-passive)
  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    const onMove = (e: TouchEvent) => {
      if (!draggingNodeRef.current || e.touches.length !== 1) return;
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const t = e.touches[0];
      const newX = (t.clientX - rect.left - offsetRef.current.x) / scaleRef.current - dragOffsetRef.current.x;
      const newY = (t.clientY - rect.top - offsetRef.current.y) / scaleRef.current - dragOffsetRef.current.y;
      const id = draggingNodeRef.current;
      onNodesChange(nodesRef.current.map(n => n.id === id ? { ...n, position: { x: newX, y: newY } } : n));
    };
    const onEnd = () => { setDraggingNode(null); };
    el.addEventListener('touchmove', onMove, { passive: false });
    el.addEventListener('touchend', onEnd);
    el.addEventListener('touchcancel', onEnd);
    return () => {
      el.removeEventListener('touchmove', onMove);
      el.removeEventListener('touchend', onEnd);
      el.removeEventListener('touchcancel', onEnd);
    };
  }, [onNodesChange]);

  // Node drag start (from grip)
  const handleNodeGripTouch = (e: React.TouchEvent, nodeId: string, nodePos: { x: number; y: number }) => {
    e.stopPropagation();
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const mouseX = (e.touches[0].clientX - rect.left - offsetRef.current.x) / scaleRef.current;
    const mouseY = (e.touches[0].clientY - rect.top - offsetRef.current.y) / scaleRef.current;
    setDraggingNode(nodeId);
    dragOffsetRef.current = { x: mouseX - nodePos.x, y: mouseY - nodePos.y };
  };

  // Long-press on the whole card → start dragging; short tap → open properties
  const handleNodeCardTouchStart = (e: React.TouchEvent, nodeId: string, nodePos: { x: number; y: number }) => {
    const t = e.touches[0];
    touchStartPos.current = { x: t.clientX, y: t.clientY, t: Date.now() };
    if (longPressTimer.current) window.clearTimeout(longPressTimer.current);
    longPressTimer.current = window.setTimeout(() => {
      if (!canvasRef.current) return;
      const rect = canvasRef.current.getBoundingClientRect();
      const mouseX = (t.clientX - rect.left - offsetRef.current.x) / scaleRef.current;
      const mouseY = (t.clientY - rect.top - offsetRef.current.y) / scaleRef.current;
      setDraggingNode(nodeId);
      dragOffsetRef.current = { x: mouseX - nodePos.x, y: mouseY - nodePos.y };
    }, 350);
  };
  const handleNodeCardTouchMove = (e: React.TouchEvent) => {
    if (!touchStartPos.current || !longPressTimer.current) return;
    const t = e.touches[0];
    const dx = t.clientX - touchStartPos.current.x;
    const dy = t.clientY - touchStartPos.current.y;
    if (Math.hypot(dx, dy) > 10) {
      window.clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };
  const handleNodeCardTouchEnd = (nodeId: string) => {
    if (longPressTimer.current) {
      window.clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
    const start = touchStartPos.current;
    touchStartPos.current = null;
    if (!start) return;
    const elapsed = Date.now() - start.t;
    if (elapsed < 300 && !draggingNodeRef.current) {
      setEditingNodeId(nodeId);
    }
  };

  // Connection: tap output → tap input
  const handleOutputTap = (nodeId: string, handle?: string) => {
    if (connectingFrom) {
      // Already connecting, cancel
      setConnectingFrom(null);
      return;
    }
    setConnectingFrom({ nodeId, handle });
    toast({ title: 'Conectando...', description: 'Toque no ponto de entrada do bloco de destino' });
  };

  const handleInputTap = (nodeId: string) => {
    if (!connectingFrom || connectingFrom.nodeId === nodeId) {
      setConnectingFrom(null);
      return;
    }
    const exists = edges.some(e => e.source === connectingFrom.nodeId && e.target === nodeId && e.sourceHandle === connectingFrom.handle);
    if (!exists) {
      onEdgesChange([...edges, {
        id: `edge-${Date.now()}`,
        source: connectingFrom.nodeId,
        target: nodeId,
        sourceHandle: connectingFrom.handle,
      }]);
      toast({ title: 'Conectado!' });
    }
    setConnectingFrom(null);
  };

  // Add block from sidebar
  const handleAddBlock = (block: BlockDefinition) => {
    const centerX = (-offset.x + 160) / scale;
    const centerY = (-offset.y + 300) / scale;
    const newNode: FlowNode = {
      id: `node-${Date.now()}`,
      type: block.type,
      subType: block.subType,
      position: { x: centerX, y: centerY + nodes.length * 120 },
      data: { label: block.label, config: { ...block.defaultConfig, icon: block.icon } }
    };
    onNodesChange([...nodes, newNode]);
    setShowSidebar(false);
    setEditingNodeId(newNode.id);
    toast({ title: 'Bloco adicionado', description: block.label });
  };

  const handleDeleteNode = (nodeId: string) => {
    onNodesChange(nodes.filter(n => n.id !== nodeId));
    onEdgesChange(edges.filter(e => e.source !== nodeId && e.target !== nodeId));
    if (editingNodeId === nodeId) setEditingNodeId(null);
  };

  const handleDeleteEdge = (edgeId: string) => {
    onEdgesChange(edges.filter(e => e.id !== edgeId));
  };

  // --- Node description ---
  const getNodeDescription = (node: FlowNode): string => {
    const config = node.data.config || {};
    switch (node.type) {
      case 'trigger':
        if (node.subType === 'whatsapp_channel') return config.sessionName || 'Selecione o canal';
        return 'Configure o gatilho';
      case 'message':
        if (config.content) return config.content.length > 25 ? config.content.substring(0, 25) + '...' : config.content;
        return 'Configure a mensagem';
      case 'condition':
        if (node.subType === 'time') return `${config.startHour || 9}h - ${config.endHour || 18}h`;
        return 'Configure a condição';
      case 'action':
        if (node.subType === 'assign_tag') return config.tag ? `🏷️ ${config.tag}` : 'Configure a tag';
        if (node.subType === 'transfer_human') return config.departmentName || 'Transferir atendimento';
        return 'Configure a ação';
      case 'delay':
        if (node.subType === 'wait_interval') return `⏱️ ${config.seconds || 5}s`;
        return 'Configure o delay';
      default: return 'Configurar';
    }
  };

  // --- Render edge ---
  const renderEdge = (edge: FlowEdge) => {
    const src = nodes.find(n => n.id === edge.source);
    const tgt = nodes.find(n => n.id === edge.target);
    if (!src || !tgt) return null;

    const srcX = src.position.x + NODE_WIDTH;
    let srcY = src.position.y + 35;
    if (edge.sourceHandle === 'yes') srcY = src.position.y + 50;
    if (edge.sourceHandle === 'no') srcY = src.position.y + 75;

    const tgtX = tgt.position.x;
    const tgtY = tgt.position.y + 35;
    const midX = (srcX + tgtX) / 2;
    const path = `M ${srcX} ${srcY} C ${midX} ${srcY}, ${midX} ${tgtY}, ${tgtX} ${tgtY}`;

    const handleColors: Record<string, string> = { yes: '#22C55E', no: '#EF4444', else: '#94A3B8' };
    const edgeColor = handleColors[edge.sourceHandle || ''] || '#94A3B8';

    return (
      <g key={edge.id}>
        <path d={path} fill="none" stroke="transparent" strokeWidth={20}
          onClick={() => handleDeleteEdge(edge.id)} style={{ cursor: 'pointer' }} />
        <path d={path} fill="none" stroke={edgeColor} strokeWidth={2} markerEnd="url(#arrowhead-mobile)" className="pointer-events-none" />
      </g>
    );
  };

  // Filtered sidebar blocks
  const filteredCategories = BLOCK_CATEGORIES.map(cat => ({
    ...cat,
    blocks: cat.blocks.filter(b =>
      b.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.description.toLowerCase().includes(searchQuery.toLowerCase())
    )
  })).filter(cat => cat.blocks.length > 0);

  return (
    <div className="h-[calc(100vh-64px)] flex flex-col bg-background">
      {/* Header */}
       <div className="bg-card border-b border-border px-3 py-2 flex items-center gap-2 flex-shrink-0 z-10">
         <Button 
           variant="ghost" 
           size="icon" 
           onClick={onBack} 
           className="h-8 w-8 shrink-0 transition-colors duration-300"
           style={{ color: BRAND_COLOR }}
         >
           <ArrowLeft className="h-5 w-5" />
         </Button>

        <div className="flex-1 min-w-0">
          <Input
            value={flowName}
            onChange={(e) => onFlowNameChange(e.target.value)}
            className="h-6 text-xs font-semibold border-0 p-0 focus-visible:ring-0 bg-transparent text-foreground"
          />
          <Badge className={`text-[9px] px-1 py-0 rounded-full ${isActive ? 'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-300' : 'bg-muted text-muted-foreground'}`}>
            {isActive ? 'Ativo' : 'Inativo'}
          </Badge>
        </div>

        <Button variant="outline" size="sm" onClick={onToggleActive} className="h-7 text-[10px] px-2 shrink-0">
          {isActive ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
        </Button>

        <Button onClick={onSave} disabled={isSaving} size="sm"
          className="h-7 text-white text-[10px] px-2 shrink-0" style={{ backgroundColor: BRAND_COLOR }}>
          <Save className="h-3 w-3" />
        </Button>
      </div>

      {/* Canvas */}
      <div
        ref={canvasRef}
        className="flex-1 relative overflow-hidden touch-none bg-muted/40 dark:bg-[hsl(0,0%,6%)]"
      >
        {/* Grid */}
        <div
          className="absolute inset-0 pointer-events-none opacity-30 dark:opacity-15"
          style={{
            backgroundImage: `radial-gradient(circle, hsl(var(--muted-foreground)) 1px, transparent 1px)`,
            backgroundSize: `${20 * scale}px ${20 * scale}px`,
            backgroundPosition: `${offset.x}px ${offset.y}px`
          }}
        />

        {/* Transformed content */}
        <div
          className="absolute inset-0"
          style={{ transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`, transformOrigin: '0 0' }}
        >
          {/* SVG Edges */}
          <svg className="absolute inset-0 w-full h-full overflow-visible" style={{ pointerEvents: 'none' }}>
            <defs>
              <marker id="arrowhead-mobile" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
                <polygon points="0 0, 10 3.5, 0 7" fill="#94A3B8" />
              </marker>
            </defs>
            <g style={{ pointerEvents: 'auto' }}>
              {edges.map(renderEdge)}
            </g>
          </svg>

          {/* Nodes */}
          {nodes.map((node) => {
            const color = nodeColors[node.type] || '#6B7280';
            const Icon = iconMap[node.data.config?.icon] || MessageSquare;
            const isCondition = node.type === 'condition' && (node.subType === 'if_else' || node.subType === 'time' || node.subType === 'weekday');
            const isMulti = node.type === 'condition' && node.subType === 'multi';
            const multiConds = isMulti ? (node.data.config?.conditions || []) : [];
            const isButtons = node.subType === 'buttons';
            const btnOpts = isButtons ? (node.data.config?.buttons || []) : [];

            return (
              <div
                key={node.id}
                data-node-card="true"
                style={{
                  position: 'absolute',
                  left: node.position.x,
                  top: node.position.y,
                  width: NODE_WIDTH,
                  pointerEvents: 'auto',
                  touchAction: 'none',
                }}
                className={cn(
                  'bg-card text-foreground rounded-xl shadow-md border-2 transition-all select-none',
                  editingNodeId === node.id ? 'border-primary shadow-lg' : 'border-border',
                  connectingFrom ? 'border-dashed' : '',
                  draggingNode === node.id ? 'opacity-70' : ''
                )}
                onTouchStart={(e) => handleNodeCardTouchStart(e, node.id, node.position)}
                onTouchMove={handleNodeCardTouchMove}
                onTouchEnd={() => handleNodeCardTouchEnd(node.id)}
              >
                {/* Header */}
                <div
                  className="flex items-center gap-1.5 px-3 py-2 rounded-t-xl"
                  style={{ backgroundColor: `${color}12` }}
                >
                  <div
                    data-node-handle="true"
                    className="cursor-grab p-2 -m-1 rounded touch-none active:bg-muted"
                    onTouchStart={(e) => handleNodeGripTouch(e, node.id, node.position)}
                  >
                    <GripVertical className="h-3.5 w-3.5 text-gray-400" />
                  </div>
                  <div className="w-6 h-6 rounded-md flex items-center justify-center shrink-0" style={{ backgroundColor: color }}>
                    <Icon className="h-3 w-3 text-white" />
                  </div>
                  <span className="text-xs font-semibold flex-1 truncate" style={{ color }}>{node.data.label}</span>
                  <button
                    data-node-handle="true"
                    onClick={(e) => { e.stopPropagation(); handleDeleteNode(node.id); }}
                    className="p-1 rounded hover:bg-red-100 dark:hover:bg-red-500/20"
                  >
                    <X className="h-3 w-3 text-muted-foreground" />
                  </button>
                </div>

                {/* Content - tap to edit */}
                <div className="px-3 py-2">
                  <p className="text-[10px] text-muted-foreground leading-relaxed">{getNodeDescription(node)}</p>
                  {isButtons && btnOpts.length > 0 && (
                    <div className="mt-1.5 space-y-1 border-t border-border pt-1.5">
                      {btnOpts.map((btn: any, i: number) => (
                        <div key={i} className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary truncate">{typeof btn === 'string' ? btn : (btn?.label ?? btn?.title ?? '')}</div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Input point (left) */}
                <div
                  data-node-handle="true"
                  className={cn(
                    'absolute -left-2.5 top-1/2 w-5 h-5 rounded-full bg-background border-2 flex items-center justify-center',
                    connectingFrom ? 'border-primary bg-primary/10 animate-pulse' : 'border-border'
                  )}
                  style={{ transform: 'translateY(-50%)' }}
                  onClick={() => handleInputTap(node.id)}
                >
                  <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground" />
                </div>

                {/* Output points (right) */}
                {isCondition ? (
                  <>
                    <div
                      data-node-handle="true"
                      className="absolute -right-2.5 w-5 h-5 rounded-full bg-background border-2 border-green-500 flex items-center justify-center"
                      style={{ top: 40 }}
                      onClick={() => handleOutputTap(node.id, 'yes')}
                    >
                      <Check className="h-2.5 w-2.5 text-green-500" />
                    </div>
                    <div
                      data-node-handle="true"
                      className="absolute -right-2.5 w-5 h-5 rounded-full bg-background border-2 border-red-500 flex items-center justify-center"
                      style={{ top: 65 }}
                      onClick={() => handleOutputTap(node.id, 'no')}
                    >
                      <XCircle className="h-2.5 w-2.5 text-red-500" />
                    </div>
                  </>
                ) : isMulti && multiConds.length > 0 ? (
                  <>
                    {multiConds.map((c: any, i: number) => {
                      const colors = ['#374DA4', '#22C55E', '#F59E0B', '#EF4444', '#8B5CF6'];
                      return (
                        <div key={c.id}
                          data-node-handle="true"
                          className="absolute -right-2.5 w-5 h-5 rounded-full bg-background border-2 flex items-center justify-center"
                          style={{ top: 40 + i * 22, borderColor: colors[i % colors.length] }}
                          onClick={() => handleOutputTap(node.id, c.id)}
                        >
                          <span className="text-[8px] font-bold" style={{ color: colors[i % colors.length] }}>{i + 1}</span>
                        </div>
                      );
                    })}
                    <div
                      data-node-handle="true"
                      className="absolute -right-2.5 w-5 h-5 rounded-full bg-background border-2 border-muted-foreground flex items-center justify-center"
                      style={{ top: 40 + multiConds.length * 22 }}
                      onClick={() => handleOutputTap(node.id, 'else')}
                    >
                      <span className="text-[8px] font-bold text-muted-foreground">✕</span>
                    </div>
                  </>
                ) : isButtons && btnOpts.length > 0 ? (
                  <>
                    {btnOpts.map((_: string, i: number) => {
                      const colors = ['#374DA4', '#22C55E', '#F59E0B', '#EF4444', '#8B5CF6'];
                      return (
                        <div key={i}
                          data-node-handle="true"
                          className="absolute -right-2.5 w-5 h-5 rounded-full bg-background border-2 flex items-center justify-center"
                          style={{ top: 70 + i * 24, borderColor: colors[i % colors.length] }}
                          onClick={() => handleOutputTap(node.id, `btn_${i}`)}
                        >
                          <span className="text-[8px] font-bold" style={{ color: colors[i % colors.length] }}>{i + 1}</span>
                        </div>
                      );
                    })}
                  </>
                ) : (
                  <div
                    data-node-handle="true"
                    className={cn(
                      'absolute -right-2.5 top-1/2 w-5 h-5 rounded-full bg-background border-2 flex items-center justify-center',
                      connectingFrom?.nodeId === node.id ? 'border-primary bg-primary/10' : 'border-border'
                    )}
                    style={{ transform: 'translateY(-50%)' }}
                    onClick={() => handleOutputTap(node.id)}
                  >
                    <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground" />
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Empty state */}
        {nodes.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="text-center">
              <GitBranch className="h-10 w-10 text-muted-foreground/50 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground mb-3">Canvas vazio</p>
              <Button
                onClick={() => setShowSidebar(true)}
                className="rounded-xl text-white gap-1.5 pointer-events-auto"
                size="sm"
                style={{ backgroundColor: BRAND_COLOR }}
              >
                <Plus className="h-4 w-4" /> Adicionar bloco
              </Button>
            </div>
          </div>
        )}

        {/* Connecting mode indicator */}
        {connectingFrom && (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 bg-[#2F428D] text-white text-xs px-3 py-1.5 rounded-full shadow-lg z-20 flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
            Toque no destino
            <button onClick={() => setConnectingFrom(null)} className="ml-1"><X className="h-3 w-3" /></button>
          </div>
        )}

        {/* Floating control dock */}
        <div className="absolute bottom-4 right-3 flex flex-col items-center gap-2 z-10">
          <button
            onClick={() => {
              setScale(s => Math.min(s * 1.25, 2.5));
            }}
            className="w-11 h-11 rounded-full bg-card border border-border shadow-md flex items-center justify-center text-foreground text-xl font-semibold active:scale-95 transition"
            aria-label="Aumentar zoom"
          >+</button>
          <div className="px-2 py-1 rounded-full bg-card border border-border shadow-sm text-[10px] font-medium text-muted-foreground min-w-[44px] text-center">
            {Math.round(scale * 100)}%
          </div>
          <button
            onClick={() => setScale(s => Math.max(s * 0.8, 0.3))}
            className="w-11 h-11 rounded-full bg-card border border-border shadow-md flex items-center justify-center text-foreground text-xl font-semibold active:scale-95 transition"
            aria-label="Diminuir zoom"
          >−</button>
          <button
            onClick={() => {
              const el = canvasRef.current;
              if (!el) return;
              if (nodes.length === 0) {
                setScale(0.9);
                setOffset({ x: 40, y: 40 });
                return;
              }
              const xs = nodes.map(n => n.position.x);
              const ys = nodes.map(n => n.position.y);
              const minX = Math.min(...xs);
              const minY = Math.min(...ys);
              const maxX = Math.max(...xs) + NODE_WIDTH;
              const maxY = Math.max(...ys) + 140;
              const rect = el.getBoundingClientRect();
              const pad = 24;
              const sx = (rect.width - pad * 2) / Math.max(maxX - minX, 1);
              const sy = (rect.height - pad * 2) / Math.max(maxY - minY, 1);
              const next = Math.min(Math.max(Math.min(sx, sy), 0.3), 1.5);
              setScale(next);
              setOffset({
                x: pad - minX * next,
                y: pad - minY * next,
              });
            }}
            className="w-11 h-11 rounded-full bg-card border border-border shadow-md flex items-center justify-center text-foreground active:scale-95 transition"
            aria-label="Ajustar à tela"
          >
            <Maximize2 className="h-4 w-4" />
          </button>
        </div>

        {/* FAB: Add block */}
        <button
          onClick={() => setShowSidebar(true)}
          className="absolute bottom-4 left-3 w-14 h-14 rounded-full shadow-xl flex items-center justify-center text-white z-10 active:scale-95 transition"
          style={{ backgroundColor: BRAND_COLOR, boxShadow: '0 8px 24px rgba(48,0,227,0.35)' }}
          aria-label="Adicionar bloco"
        >
          <Plus className="h-6 w-6" />
        </button>

        {/* Help hint */}
        {nodes.length > 0 && (
          <div className="absolute top-2 left-1/2 -translate-x-1/2 flex items-center gap-1.5 bg-card/90 backdrop-blur border border-border text-[10px] text-muted-foreground px-2.5 py-1 rounded-full shadow-sm pointer-events-none z-10">
            <Move className="h-3 w-3" />
            Arraste para mover • Pinça para zoom
          </div>
        )}
      </div>

      {/* Sidebar Sheet */}
      <Sheet open={showSidebar} onOpenChange={setShowSidebar}>
        <SheetContent side="left" className="w-[85vw] max-w-[320px] p-0 bg-card">
          <div className="p-4 border-b border-border">
            <SheetTitle className="text-left mb-3">Blocos</SheetTitle>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Pesquisar..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 bg-muted rounded-xl"
              />
            </div>
          </div>
          <ScrollArea className="h-[calc(100vh-130px)]">
            <div className="p-4 space-y-5">
              {filteredCategories.map(cat => (
                <div key={cat.id}>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">{cat.label}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {cat.blocks.map(block => {
                      const BIcon = iconMap[block.icon] || MessageSquare;
                      return (
                        <button
                          key={`${block.type}-${block.subType}`}
                          onClick={() => handleAddBlock(block)}
                          className="p-2.5 rounded-xl border border-border bg-background text-left hover:border-muted-foreground/40 hover:shadow-sm active:scale-[0.97] transition-all"
                        >
                          <div className="flex items-start gap-2">
                            <div className="w-6 h-6 rounded-md flex items-center justify-center shrink-0"
                              style={{ backgroundColor: `${BRAND_COLOR}15`, color: BRAND_COLOR }}>
                              <BIcon className="h-3 w-3" />
                            </div>
                            <div className="min-w-0">
                              <span className="text-xs font-medium text-foreground block leading-tight">{block.label}</span>
                              <span className="text-[9px] text-muted-foreground block mt-0.5">{block.description}</span>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </SheetContent>
      </Sheet>

      {/* Properties Sheet */}
      <Sheet open={!!editingNodeId} onOpenChange={(open) => { if (!open) setEditingNodeId(null); }}>
        <SheetContent side="bottom" className="rounded-t-2xl max-h-[80vh] p-0 bg-card">
          {editingNode && (
            <ChatBotPropertiesPanel
              node={editingNode}
              flowId={flowId || null}
              onClose={() => setEditingNodeId(null)}
              onUpdate={onNodeUpdate}
            />
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
};

export default ChatBotMobileBuilder;
