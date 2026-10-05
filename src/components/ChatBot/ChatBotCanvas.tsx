import React, { useState, useRef, useCallback, useEffect } from 'react';
import { 
  MessageSquare, Phone, Mail, Hash, Clock, Globe, GitBranch, 
  Tag, UserPlus, Database, Send, Image, FileText, List, ToggleLeft,
  X, GripVertical, Check, XCircle, Copy, Trash2, Settings, Brain, Bot, Crosshair,
  Minus, Plus as PlusIcon
} from 'lucide-react';
import { FlowNode, FlowEdge, BlockDefinition } from './types';
import { cn } from '@/lib/utils';

const iconMap: Record<string, React.ComponentType<any>> = {
  Phone, Mail, Hash, MessageSquare, Clock, Globe, ToggleLeft, 
  List, Image, FileText, GitBranch, Database, Tag, UserPlus, Send, Brain, Bot
};

const nodeColors: Record<string, string> = {
  trigger: '#374DA4',
  message: '#374DA4',
  condition: '#374DA4',
  action: '#374DA4',
  delay: '#374DA4',
};

interface ChatBotCanvasProps {
  nodes: FlowNode[];
  edges: FlowEdge[];
  onNodesChange: (nodes: FlowNode[]) => void;
  onEdgesChange: (edges: FlowEdge[]) => void;
  onNodeSelect: (node: FlowNode | null) => void;
  selectedNodeId: string | null;
  focusNodeId?: string | null;
  onFocusApplied?: () => void;
  hideHints?: boolean;
  onPickContext?: (node: FlowNode) => void;
  contextNodeIds?: string[];
  onNodeEdit?: (node: FlowNode) => void;
}

interface ConnectingLine {
  sourceId: string;
  sourceHandle?: string;
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
}

const ChatBotCanvas: React.FC<ChatBotCanvasProps> = ({
  nodes,
  edges,
  onNodesChange,
  onEdgesChange,
  onNodeSelect,
  selectedNodeId,
  focusNodeId,
  onFocusApplied,
  hideHints,
  onPickContext,
  contextNodeIds,
  onNodeEdit,
}) => {
  const canvasRef = useRef<HTMLDivElement>(null);
  const onFocusAppliedRef = useRef(onFocusApplied);
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 50, y: 50 });
  const autoFitDoneRef = useRef(false);

  const fitToView = useCallback(() => {
    if (!canvasRef.current || nodes.length === 0) {
      setScale(1);
      setOffset({ x: 50, y: 50 });
      return;
    }
    const rect = canvasRef.current.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    const NODE_W = 280;
    const NODE_H = 140;
    const minX = Math.min(...nodes.map(n => n.position.x));
    const minY = Math.min(...nodes.map(n => n.position.y));
    const maxX = Math.max(...nodes.map(n => n.position.x + NODE_W));
    const maxY = Math.max(...nodes.map(n => n.position.y + NODE_H));
    const w = maxX - minX;
    const h = maxY - minY;
    const padding = 80;
    const newScale = Math.min(1, Math.min((rect.width - padding * 2) / w, (rect.height - padding * 2) / h));
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    setScale(newScale);
    setOffset({ x: rect.width / 2 - cx * newScale, y: rect.height / 2 - cy * newScale });
  }, [nodes]);

  // Recentraliza automaticamente uma única vez, assim que o fluxo é carregado
  // (útil ao abrir um chatbot já existente).
  useEffect(() => {
    if (autoFitDoneRef.current) return;
    if (nodes.length === 0) return;
    const id = requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        fitToView();
        autoFitDoneRef.current = true;
      });
    });
    return () => cancelAnimationFrame(id);
  }, [nodes.length, fitToView]);

  useEffect(() => {
    onFocusAppliedRef.current = onFocusApplied;
  }, [onFocusApplied]);

  // Center viewport only for explicit navigation requests, then clear the request.
  // This prevents unrelated parent renders (autosave/"Salvo") from reusing a stale focus id.
  useEffect(() => {
    if (!focusNodeId || !canvasRef.current) return;
    const node = nodes.find((n) => n.id === focusNodeId);
    if (!node) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const NODE_W = 280;
    const NODE_H = 140;
    const cx = node.position.x + NODE_W / 2;
    const cy = node.position.y + NODE_H / 2;
    setOffset({
      x: rect.width / 2 - cx * scale,
      y: rect.height / 2 - cy * scale,
    });
    const frame = requestAnimationFrame(() => onFocusAppliedRef.current?.());
    return () => cancelAnimationFrame(frame);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusNodeId]);
  
  // Canvas panning state
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });

  // Build-sequence animation: ordena os blocos por coluna (x) e depois por linha (y).
  // Quando o conjunto de ids muda (novo build), re-dispara a animação stagger.
  const sigRef = useRef<string>("");
  const [animTick, setAnimTick] = useState(0);
  const sig = nodes.map((n) => n.id).sort().join("|");
  useEffect(() => {
    if (sig !== sigRef.current) {
      sigRef.current = sig;
      setAnimTick((t) => t + 1);
    }
  }, [sig]);

  // Ordem de aparição = topologia do fluxo. Fazemos BFS a partir das raízes
  // (triggers ou nodes sem incoming) seguindo as edges; empate é desempatado
  // por posição (topo → base, esquerda → direita) para ramificações.
  const nodeOrder = React.useMemo(() => {
    const map = new Map<string, number>();
    if (nodes.length === 0) return map;
    const incoming = new Map<string, number>();
    const children = new Map<string, string[]>();
    nodes.forEach((n) => { incoming.set(n.id, 0); children.set(n.id, []); });
    edges.forEach((e) => {
      if (!children.has(e.source) || !incoming.has(e.target)) return;
      children.get(e.source)!.push(e.target);
      incoming.set(e.target, (incoming.get(e.target) || 0) + 1);
    });
    const byPos = (a: string, b: string) => {
      const na = nodes.find((n) => n.id === a)!;
      const nb = nodes.find((n) => n.id === b)!;
      if (na.position.y !== nb.position.y) return na.position.y - nb.position.y;
      return na.position.x - nb.position.x;
    };
    let roots = nodes.filter((n) => n.type === 'trigger').map((n) => n.id);
    if (roots.length === 0) roots = nodes.filter((n) => (incoming.get(n.id) || 0) === 0).map((n) => n.id);
    if (roots.length === 0) roots = [nodes[0].id];
    roots.sort(byPos);
    const visited = new Set<string>();
    const queue: string[] = [...roots];
    roots.forEach((r) => visited.add(r));
    let i = 0;
    while (queue.length) {
      const id = queue.shift()!;
      map.set(id, i++);
      const kids = (children.get(id) || []).filter((c) => !visited.has(c)).sort(byPos);
      kids.forEach((c) => { visited.add(c); queue.push(c); });
    }
    // Nodes desconectados entram no final, ordenados por posição
    nodes
      .filter((n) => !map.has(n.id))
      .sort((a, b) => byPos(a.id, b.id))
      .forEach((n) => map.set(n.id, i++));
    return map;
  }, [nodes, edges]);

  const STAGGER_MS = 140;
  const orderFor = (id: string) => nodeOrder.get(id) ?? 0;
  
  // Node dragging state
  const [draggingNode, setDraggingNode] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  
  // Connection state
  const [connectingLine, setConnectingLine] = useState<ConnectingLine | null>(null);
  const [hoveredInputNode, setHoveredInputNode] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; nodeId: string } | null>(null);

  // Handle drop from sidebar
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const blockData = e.dataTransfer.getData('block');
    if (!blockData || !canvasRef.current) return;

    const block: BlockDefinition = JSON.parse(blockData);
    const rect = canvasRef.current.getBoundingClientRect();
    
    const x = (e.clientX - rect.left - offset.x) / scale;
    const y = (e.clientY - rect.top - offset.y) / scale;

    const newNode: FlowNode = {
      id: `node-${Date.now()}`,
      type: block.type,
      subType: block.subType,
      position: { x, y },
      data: {
        label: block.label,
        config: { ...block.defaultConfig, icon: block.icon }
      }
    };

    onNodesChange([...nodes, newNode]);
  }, [nodes, onNodesChange, scale, offset]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  }, []);

  // Canvas panning handlers
  const handleCanvasMouseDown = (e: React.MouseEvent) => {
    // Only start panning if clicking directly on canvas (not on a node)
    if (e.target === canvasRef.current || (e.target as HTMLElement).classList.contains('canvas-grid')) {
      setIsPanning(true);
      setPanStart({ x: e.clientX - offset.x, y: e.clientY - offset.y });
      onNodeSelect(null);
    }
  };

  const handleCanvasMouseMove = useCallback((e: React.MouseEvent) => {
    // Handle canvas panning
    if (isPanning) {
      setOffset({ x: e.clientX - panStart.x, y: e.clientY - panStart.y });
      return;
    }

    // Handle node dragging
    if (draggingNode && canvasRef.current) {
      const rect = canvasRef.current.getBoundingClientRect();
      const newX = (e.clientX - rect.left - offset.x) / scale - dragOffset.x;
      const newY = (e.clientY - rect.top - offset.y) / scale - dragOffset.y;
      
      onNodesChange(nodes.map(node => 
        node.id === draggingNode 
          ? { ...node, position: { x: newX, y: newY } }
          : node
      ));
    }

    // Handle connection line following cursor
    if (connectingLine && canvasRef.current) {
      const rect = canvasRef.current.getBoundingClientRect();
      setConnectingLine(prev => prev ? {
        ...prev,
        currentX: (e.clientX - rect.left - offset.x) / scale,
        currentY: (e.clientY - rect.top - offset.y) / scale
      } : null);
    }
  }, [isPanning, panStart, draggingNode, dragOffset, nodes, onNodesChange, scale, offset, connectingLine]);

  const handleCanvasMouseUp = useCallback(() => {
    setIsPanning(false);
    setDraggingNode(null);
    
    // Complete connection if hovering over a valid input
    if (connectingLine && hoveredInputNode && connectingLine.sourceId !== hoveredInputNode) {
      const edgeExists = edges.some(e => 
        e.source === connectingLine.sourceId && 
        e.target === hoveredInputNode &&
        e.sourceHandle === connectingLine.sourceHandle
      );
      
      if (!edgeExists) {
        const newEdge: FlowEdge = {
          id: `edge-${Date.now()}`,
          source: connectingLine.sourceId,
          target: hoveredInputNode,
          sourceHandle: connectingLine.sourceHandle
        };
        onEdgesChange([...edges, newEdge]);
      }
    }
    
    setConnectingLine(null);
    setHoveredInputNode(null);
  }, [connectingLine, hoveredInputNode, edges, onEdgesChange]);

  // Node drag handlers (only from grip handle)
  const handleNodeDragStart = (e: React.MouseEvent, nodeId: string, nodePos: { x: number, y: number }) => {
    e.stopPropagation();
    if (!canvasRef.current) return;
    
    const rect = canvasRef.current.getBoundingClientRect();
    const mouseX = (e.clientX - rect.left - offset.x) / scale;
    const mouseY = (e.clientY - rect.top - offset.y) / scale;
    
    setDraggingNode(nodeId);
    setDragOffset({ x: mouseX - nodePos.x, y: mouseY - nodePos.y });
  };

  // Connection handlers
  const handleOutputMouseDown = (e: React.MouseEvent, nodeId: string, handle?: string) => {
    e.stopPropagation();
    if (!canvasRef.current) return;
    
    const node = nodes.find(n => n.id === nodeId);
    if (!node) return;
    
    const rect = canvasRef.current.getBoundingClientRect();
    const startX = node.position.x + 260; // Right side of node
    let startY = node.position.y + 40; // Center vertically
    
    // Adjust Y for condition handles
    if (handle === 'yes') startY = node.position.y + 60;
    if (handle === 'no') startY = node.position.y + 90;
    
    // Multi-conditional handles
    if (node.subType === 'multi' && handle) {
      const conditions = node.data.config?.conditions || [];
      const condIndex = conditions.findIndex((c: any) => c.id === handle);
      if (condIndex >= 0) {
        startY = node.position.y + 55 + condIndex * 28;
      } else if (handle === 'else') {
        startY = node.position.y + 55 + conditions.length * 28;
      }
    }
    
    // Button option handles
    if (node.subType === 'buttons' && handle?.startsWith('btn_')) {
      const btnIndex = parseInt(handle.replace('btn_', ''), 10);
      startY = node.position.y + 96 + btnIndex * 32 + 16;
    }
    if (node.subType === 'buttons' && handle === 'invalid') {
      const btns = node.data.config?.buttons || [];
      startY = node.position.y + 96 + btns.length * 32 + 16;
    }
    
    setConnectingLine({
      sourceId: nodeId,
      sourceHandle: handle,
      startX,
      startY,
      currentX: (e.clientX - rect.left - offset.x) / scale,
      currentY: (e.clientY - rect.top - offset.y) / scale
    });
  };

  const handleInputMouseEnter = (nodeId: string) => {
    if (connectingLine) {
      setHoveredInputNode(nodeId);
    }
  };

  const handleInputMouseLeave = () => {
    setHoveredInputNode(null);
  };

  const handleDeleteNode = useCallback((nodeId: string) => {
    onNodesChange(nodes.filter(n => n.id !== nodeId));
    onEdgesChange(edges.filter(e => e.source !== nodeId && e.target !== nodeId));
    onNodeSelect(null);
  }, [nodes, edges, onNodesChange, onEdgesChange, onNodeSelect]);

  const handleDeleteEdge = useCallback((edgeId: string) => {
    onEdgesChange(edges.filter(e => e.id !== edgeId));
  }, [edges, onEdgesChange]);

  const handleDuplicateNode = useCallback((nodeId: string) => {
    const node = nodes.find(n => n.id === nodeId);
    if (!node) return;
    const newNode: FlowNode = {
      ...JSON.parse(JSON.stringify(node)),
      id: `node-${Date.now()}`,
      position: { x: node.position.x + 40, y: node.position.y + 60 },
    };
    onNodesChange([...nodes, newNode]);
    setContextMenu(null);
  }, [nodes, onNodesChange]);

  const handleContextMenu = useCallback((e: React.MouseEvent, nodeId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY, nodeId });
  }, []);

  useEffect(() => {
    if (!contextMenu) return;
    const close = () => setContextMenu(null);
    window.addEventListener('click', close);
    return () => window.removeEventListener('click', close);
  }, [contextMenu]);

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setScale(prev => Math.min(Math.max(prev * delta, 0.25), 2));
  };

  // Get node content description
  const getNodeDescription = (node: FlowNode): string => {
    const config = node.data.config || {};

    // Coerce any value (string | object | array | number) to a readable label.
    const toText = (v: any): string => {
      if (v == null) return '';
      if (typeof v === 'string') return v;
      if (typeof v === 'number' || typeof v === 'boolean') return String(v);
      if (Array.isArray(v)) return v.map(toText).filter(Boolean).join(', ');
      if (typeof v === 'object') {
        return String(v.label ?? v.title ?? v.name ?? v.value ?? v.text ?? v.id ?? '');
      }
      return '';
    };

    switch (node.type) {
      case 'trigger':
        if (node.subType === 'whatsapp_channel') {
          return toText(config.phoneNumber) || toText(config.sessionName) || 'Selecione o canal';
        }
        if (node.subType === 'email_channel') {
          return toText(config.email) || 'Selecione o email';
        }
        if (node.subType === 'keyword') {
          const keywords = Array.isArray(config.keywords) ? config.keywords : [];
          const shown = keywords.slice(0, 2).map(toText).filter(Boolean).join(', ');
          if (!shown) return 'Configure palavras-chave';
          return shown + (keywords.length > 2 ? '...' : '');
        }
        if (node.subType === 'conversation_start') {
          const when = toText(config.triggerWhen) || 'any';
          return when === 'new_conversation' ? 'Nova conversa' : when === 'reopened' ? 'Conversa reaberta' : 'Qualquer início';
        }
        if (node.subType === 'inactivity') {
          return `Após ${toText(config.minutes) || 5} min sem resposta`;
        }
        if (node.subType === 'webhook') {
          return config.url ? 'Webhook configurado' : 'Configure URL';
        }
        return 'Configure o gatilho';
        
      case 'message':
        if (node.subType === 'image') {
          const cap = toText(config.caption);
          return config.url ? `🖼️ Imagem${cap ? ` — ${cap}` : ''}` : '🖼️ Configure a imagem';
        }
        if (node.subType === 'audio') {
          return config.url ? `🔊 Áudio${config.ptt !== false ? ' (voz)' : ''}` : '🔊 Configure o áudio';
        }
        if (node.subType === 'video') {
          const cap = toText(config.caption);
          return config.url ? `🎬 Vídeo${cap ? ` — ${cap}` : ''}` : '🎬 Configure o vídeo';
        }
        if (node.subType === 'file') {
          return config.url ? `📎 ${toText(config.filename) || 'Arquivo'}` : '📎 Configure o arquivo';
        }
        if (config.content) {
          return config.content;
        }
        return 'Configure a mensagem';
        
      case 'condition':
        if (node.subType === 'if_else') {
          if (config.conditionType === 'user_response') {
            return `Resposta ${config.operator || 'contém'} "${config.value || '...'}"`;
          }
          if (config.conditionType === 'variable') {
            return `${config.variable || 'var'} ${config.operator || '=='} ${config.value || '?'}`;
          }
          return 'Configure a condição';
        }
        if (node.subType === 'check_variable') {
          return `${config.variable || 'var'} ${config.operator || '=='} ${config.value || '?'}`;
        }
        if (node.subType === 'check_time') {
          return `${config.startHour || 9}h - ${config.endHour || 18}h`;
        }
        if (node.subType === 'check_tag') {
          return config.tag ? `Tag: ${config.tag}` : 'Configure a tag';
        }
        return 'Configure a condição';
        
      case 'action':
        if (node.subType === 'assign_tag') {
          return config.tag ? `🏷️ ${config.tag}` : 'Configure a tag';
        }
        if (node.subType === 'transfer_human') {
          return config.departmentName || 'Transferir atendimento';
        }
        if (node.subType === 'save_crm') {
          return 'Salvar como lead';
        }
        if (node.subType === 'send_email') {
          if (!config.to) return '✉️ Configure o email';
          return `✉️ ${config.to}${config.subject ? ` — ${config.subject}` : ''}`;
        }
        if (node.subType === 'send_whatsapp') {
          if (!config.phone) return '📲 Configure número e mensagem';
          const msg = (config.message || '').toString();
          return `📲 ${config.phone}${msg ? ` — ${msg}` : ''}`;
        }
        if (node.subType === 'call_api') {
          return config.url ? `${config.method || 'POST'} API` : 'Configure a API';
        }
        if (node.subType === 'set_variable') {
          return config.name ? `${config.name} = ${config.value || '?'}` : 'Configure a variável';
        }
        if (node.subType === 'ai_agent_inline') {
          const prompt = (config.systemPrompt || '').toString();
          if (!prompt) return '🧠 Configure as instruções da IA';
          return `🧠 ${prompt}`;
        }
        if (node.subType === 'transfer_ai_agent') {
          return config.agentName ? `🤖 ${config.agentName}` : '🤖 Selecione um agente';
        }
        return 'Configure a ação';
        
      case 'delay':
        if (node.subType === 'wait_seconds') {
          return `⏱️ ${config.seconds || 5} segundos`;
        }
        if (node.subType === 'wait_response') {
          return `⏱️ Aguardar resposta (${config.timeout || 60}s)`;
        }
        if (node.subType === 'wait_business_hours') {
          return '⏱️ Próximo horário comercial';
        }
        return 'Configure o delay';
        
      default:
        return 'Clique para configurar';
    }
  };

  // Render edge path between two nodes
  const renderEdge = (edge: FlowEdge) => {
    const sourceNode = nodes.find(n => n.id === edge.source);
    const targetNode = nodes.find(n => n.id === edge.target);
    if (!sourceNode || !targetNode) return null;

    const sourceX = sourceNode.position.x + 260;
    let sourceY = sourceNode.position.y + 40;
    
    // Adjust source Y for condition handles
    if (edge.sourceHandle === 'yes') sourceY = sourceNode.position.y + 60;
    if (edge.sourceHandle === 'no') sourceY = sourceNode.position.y + 90;
    
    // Multi-conditional handles
    if (sourceNode.subType === 'multi' && edge.sourceHandle) {
      const conditions = sourceNode.data.config?.conditions || [];
      const condIndex = conditions.findIndex((c: any) => c.id === edge.sourceHandle);
      if (condIndex >= 0) {
        sourceY = sourceNode.position.y + 55 + condIndex * 28;
      } else if (edge.sourceHandle === 'else') {
        sourceY = sourceNode.position.y + 55 + conditions.length * 28;
      }
    }
    
    // Button option handles
    if (sourceNode.subType === 'buttons' && edge.sourceHandle?.startsWith('btn_')) {
      const btnIndex = parseInt(edge.sourceHandle.replace('btn_', ''), 10);
      sourceY = sourceNode.position.y + 96 + btnIndex * 32 + 16;
    }
    if (sourceNode.subType === 'buttons' && edge.sourceHandle === 'invalid') {
      const btns = sourceNode.data.config?.buttons || [];
      sourceY = sourceNode.position.y + 96 + btns.length * 32 + 16;
    }
    
    const targetX = targetNode.position.x;
    const targetY = targetNode.position.y + 40;

    const midX = (sourceX + targetX) / 2;
    const path = `M ${sourceX} ${sourceY} C ${midX} ${sourceY}, ${midX} ${targetY}, ${targetX} ${targetY}`;

    const handleColors: Record<string, string> = { 'yes': '#22C55E', 'no': '#EF4444', 'else': '#94A3B8' };
    let edgeColor = handleColors[edge.sourceHandle || ''] || '#94A3B8';
    
    // Color for multi-condition handles
    if (sourceNode.subType === 'multi' && edge.sourceHandle && !handleColors[edge.sourceHandle]) {
      const colors = ['#374DA4', '#22C55E', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'];
      const conditions = sourceNode.data.config?.conditions || [];
      const idx = conditions.findIndex((c: any) => c.id === edge.sourceHandle);
      if (idx >= 0) edgeColor = colors[idx % colors.length];
    }
    
    // Color for button option handles
    if (sourceNode.subType === 'buttons' && edge.sourceHandle?.startsWith('btn_')) {
      const colors = ['#374DA4', '#22C55E', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#14B8A6', '#374DA4'];
      const btnIdx = parseInt(edge.sourceHandle.replace('btn_', ''), 10);
      edgeColor = colors[btnIdx % colors.length];
    }
    if (sourceNode.subType === 'buttons' && edge.sourceHandle === 'invalid') {
      edgeColor = '#94A3B8';
    }

    const edgeDelay = (Math.max(orderFor(edge.source), orderFor(edge.target)) + 1) * STAGGER_MS;
    // Comprimento aproximado pra animar o "fio se ligando"
    const dx = targetX - sourceX;
    const dy = targetY - sourceY;
    const edgeLen = Math.round(Math.hypot(dx, dy) * 1.4) + 80;
    return (
      <g key={edge.id} className="edge-group">
        {/* Invisible wider path for easier clicking */}
        <path
          d={path}
          fill="none"
          stroke="transparent"
          strokeWidth={20}
          className="cursor-pointer"
          onClick={() => handleDeleteEdge(edge.id)}
        />
        <path
          d={path}
          fill="none"
          stroke={edgeColor}
          strokeWidth={2}
          className="transition-colors pointer-events-none flow-edge-animate"
          style={{
            // CSS var consumida pelo keyframe flow-edge-draw
            ["--edge-len" as any]: `${edgeLen}px`,
            animationDelay: `${edgeDelay}ms`,
          }}
          markerEnd="url(#arrowhead)"
        />
        {/* Delete button on hover - shown in the middle of the edge */}
        <g 
          className="edge-delete opacity-0 hover:opacity-100 transition-opacity cursor-pointer"
          transform={`translate(${midX - 8}, ${(sourceY + targetY) / 2 - 8})`}
          onClick={() => handleDeleteEdge(edge.id)}
        >
          <circle cx={8} cy={8} r={10} fill="white" stroke="#EF4444" strokeWidth={1.5} />
          <path d="M 5 5 L 11 11 M 11 5 L 5 11" stroke="#EF4444" strokeWidth={1.5} strokeLinecap="round" />
        </g>
      </g>
    );
  };

  // Render connecting line while dragging
  const renderConnectingLine = () => {
    if (!connectingLine) return null;
    
    const { startX, startY, currentX, currentY } = connectingLine;
    const midX = (startX + currentX) / 2;
    const path = `M ${startX} ${startY} C ${midX} ${startY}, ${midX} ${currentY}, ${currentX} ${currentY}`;
    
    return (
      <path
        d={path}
        fill="none"
        stroke="#374DA4"
        strokeWidth={2}
        strokeDasharray="5,5"
        className="pointer-events-none"
      />
    );
  };

  return (
    <div 
      ref={canvasRef}
      className="flex-1 bg-[#ecebe4] dark:bg-background relative overflow-hidden"
      style={{ cursor: isPanning ? 'grabbing' : draggingNode ? 'grabbing' : 'default' }}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onMouseDown={handleCanvasMouseDown}
      onMouseMove={handleCanvasMouseMove}
      onMouseUp={handleCanvasMouseUp}
      onMouseLeave={handleCanvasMouseUp}
      onWheel={handleWheel}
    >
      {/* Build-sequence keyframes (nodes fade/scale-in, edges draw stroke) */}
      <style>{`
        @keyframes flow-node-in {
          0% { opacity: 0; transform: translateY(8px) scale(0.94); filter: blur(4px); }
          60% { opacity: 1; filter: blur(0); }
          100% { opacity: 1; transform: translateY(0) scale(1); filter: blur(0); }
        }
        @keyframes flow-edge-draw {
          from { stroke-dashoffset: var(--edge-len, 600); opacity: 0; }
          30% { opacity: 1; }
          to { stroke-dashoffset: 0; opacity: 1; }
        }
        .flow-node-animate { animation: flow-node-in 520ms cubic-bezier(.2,.7,.2,1) both; }
        .flow-edge-animate {
          stroke-dasharray: var(--edge-len, 600);
          stroke-dashoffset: var(--edge-len, 600);
          animation: flow-edge-draw 600ms cubic-bezier(.4,.0,.2,1) both;
        }
      `}</style>
      {/* Grid Pattern */}
      <div 
        className="absolute inset-0 opacity-40 canvas-grid pointer-events-none"
        style={{
          backgroundImage: `radial-gradient(circle, ${scale > 0.6 ? 'rgba(0,0,0,0.12)' : 'rgba(0,0,0,0.06)'} 1px, transparent 1px)`,
          backgroundSize: `${20 * scale}px ${20 * scale}px`,
          backgroundPosition: `${offset.x}px ${offset.y}px`
        }}
      />

      {/* Canvas Content */}
      <div 
        className="absolute inset-0 pointer-events-none"
        style={{
          transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
          transformOrigin: '0 0'
        }}
      >
        {/* SVG for edges */}
        <svg className="absolute inset-0 w-full h-full overflow-visible" style={{ pointerEvents: 'none' }}>
          <defs>
            <marker
              id="arrowhead"
              markerWidth="10"
              markerHeight="7"
              refX="9"
              refY="3.5"
              orient="auto"
            >
              <polygon points="0 0, 10 3.5, 0 7" fill="#94A3B8" />
            </marker>
          </defs>
          <g style={{ pointerEvents: 'auto' }}>
            {edges.map(renderEdge)}
            {renderConnectingLine()}
          </g>
        </svg>

        {/* Nodes */}
        {nodes.map((node) => {
          const color = nodeColors[node.type];
          const Icon = iconMap[node.data.config?.icon] || MessageSquare;
          const isCondition = node.type === 'condition' && node.subType === 'if_else';
          const isMultiCondition = node.type === 'condition' && node.subType === 'multi';
          const multiConditions = isMultiCondition ? (node.data.config?.conditions || []) : [];
          const isTimeOrWeekday = node.type === 'condition' && (node.subType === 'time' || node.subType === 'weekday');
          const isButtonsNode = node.subType === 'buttons';
          const buttonOptions = isButtonsNode ? (node.data.config?.buttons || []) : [];
          const hasMultipleOutputs = isCondition || isMultiCondition || isTimeOrWeekday || (isButtonsNode && buttonOptions.length > 0);
          
          return (
            <div
              key={node.id}
              style={{
                position: 'absolute',
                left: node.position.x,
                top: node.position.y,
                width: 260,
                pointerEvents: 'auto',
                animationDelay: `${orderFor(node.id) * STAGGER_MS}ms`,
              }}
              onClick={(e) => {
                e.stopPropagation();
                onNodeSelect(node);
              }}
              onDoubleClick={(e) => {
                e.stopPropagation();
                if (onNodeEdit) onNodeEdit(node);
              }}
              onContextMenu={(e) => handleContextMenu(e, node.id)}
              className={cn(
                "bg-background rounded-2xl shadow-md border transition-all select-none",
                selectedNodeId === node.id ? "ring-2 ring-primary ring-offset-2 shadow-lg" : "hover:shadow-lg border-border",
                draggingNode === node.id ? "opacity-80" : "",
                contextNodeIds?.includes(node.id) ? "ring-2 ring-[#374DA4]/70 ring-offset-2" : "",
                "flow-node-animate"
              )}
            >
              {/* Node Header */}
              <div 
                className="flex items-center gap-2.5 px-4 py-3 rounded-t-2xl"
                style={{ backgroundColor: `${color}10` }}
              >
                <div
                  className="cursor-grab active:cursor-grabbing drag-handle p-1 -ml-1.5 rounded-lg hover:bg-black/5"
                  onMouseDown={(e) => handleNodeDragStart(e, node.id, node.position)}
                >
                  <GripVertical className="h-4 w-4 text-muted-foreground/60" />
                </div>
                <div 
                  className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: color }}
                >
                  <Icon className="h-3.5 w-3.5 text-white" />
                </div>
                <span className="text-sm font-semibold flex-1 truncate" style={{ color }}>
                  {typeof node.data.label === 'string'
                    ? node.data.label
                    : ((node.data.label as any)?.label ?? (node.data.label as any)?.title ?? 'Bloco')}
                </span>
                {onPickContext && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onPickContext(node);
                    }}
                    className={cn(
                      "p-1.5 rounded-lg transition-colors",
                      contextNodeIds?.includes(node.id)
                        ? "bg-[#374DA4] text-white hover:bg-[#374DA4]/90"
                        : "hover:bg-[#374DA4]/10 text-muted-foreground hover:text-[#374DA4]"
                    )}
                    title={contextNodeIds?.includes(node.id) ? "Remover do contexto" : "Selecionar para falar com a IA sobre este bloco"}
                  >
                    <Crosshair className="h-3.5 w-3.5" />
                  </button>
                )}
                {onNodeEdit && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onNodeEdit(node);
                    }}
                    className="p-1.5 rounded-lg transition-colors hover:bg-muted text-muted-foreground hover:text-foreground"
                    title="Configurar bloco"
                  >
                    <Settings className="h-3.5 w-3.5" />
                  </button>
                )}
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteNode(node.id);
                  }}
                  className="p-1.5 hover:bg-destructive/10 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                  style={{ opacity: selectedNodeId === node.id ? 1 : undefined }}
                >
                  <X className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
                </button>
              </div>

              {/* Node Content */}
              <div className="px-4 py-3 text-xs text-muted-foreground">
                {node.subType === 'image' && node.data.config?.url && (
                  <div className="mb-2 rounded-md border overflow-hidden bg-muted/30">
                    <img
                      src={node.data.config.url}
                      alt="preview"
                      className="w-full h-24 object-contain"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.src = 'https://placehold.co/400x300?text=Erro+no+preview';
                      }}
                    />
                  </div>
                )}
                <p className="whitespace-pre-wrap break-words leading-relaxed">{getNodeDescription(node)}</p>
                {isMultiCondition && multiConditions.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {multiConditions.map((c: any, i: number) => (
                      <div key={c.id} className="text-[11px] text-muted-foreground/70">
                        {i + 1}. {c.label || `Condição ${i + 1}`}
                      </div>
                    ))}
                  </div>
                )}
                {isButtonsNode && buttonOptions.length > 0 && (
                  <div className="mt-3 space-y-1.5 border-t pt-3">
                    {buttonOptions.map((btn: any, i: number) => {
                      const handleColors = ['#374DA4', '#22C55E', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#14B8A6', '#374DA4'];
                      const handleColor = handleColors[i % handleColors.length];
                      return (
                        <div key={i} className="flex items-center gap-2.5 py-1 px-2 rounded-lg" style={{ backgroundColor: `${handleColor}08` }}>
                          <span className="w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 text-[9px] font-bold" style={{ borderColor: handleColor, color: handleColor }}>
                            {i + 1}
                          </span>
                          <span className="text-[12px] font-medium break-words" style={{ color: handleColor }}>{typeof btn === 'string' ? btn : (btn?.label ?? btn?.title ?? '')}</span>
                        </div>
                      );
                    })}
                    <div className="flex items-center gap-2.5 py-1 px-2 rounded-lg opacity-50">
                      <span className="w-5 h-5 rounded-full border-2 border-muted-foreground/40 flex items-center justify-center flex-shrink-0 text-[9px] font-bold text-muted-foreground/40">✕</span>
                      <span className="text-[12px] text-muted-foreground/60">Resposta inválida</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Connection Points */}
              {/* Input (left side) */}
              <div 
                className={cn(
                  "absolute -left-3 top-1/2 w-6 h-6 rounded-full bg-background border-2 flex items-center justify-center transition-all cursor-pointer",
                  hoveredInputNode === node.id && connectingLine ? "border-primary bg-primary/10 scale-125" : "border-muted-foreground/30 hover:border-primary hover:bg-primary/5"
                )}
                style={{ transform: 'translateY(-50%)' }}
                onMouseEnter={() => handleInputMouseEnter(node.id)}
                onMouseLeave={handleInputMouseLeave}
                onMouseUp={() => {
                  if (connectingLine && connectingLine.sourceId !== node.id) {
                    // Connection will be handled in handleCanvasMouseUp
                  }
                }}
              >
                <div className="w-2 h-2 rounded-full bg-muted-foreground/50" />
              </div>

              {/* Output (right side) */}
              {isButtonsNode && buttonOptions.length > 0 ? (
                <>
                  {buttonOptions.map((_btn: string, i: number) => {
                    const handleColors = ['#374DA4', '#22C55E', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#14B8A6', '#374DA4'];
                    const handleColor = handleColors[i % handleColors.length];
                    const handleId = `btn_${i}`;
                    const handleTop = 96 + i * 32 + 10;
                    return (
                      <div 
                        key={handleId}
                        className="absolute -right-3 w-6 h-6 rounded-full bg-background border-2 flex items-center justify-center cursor-crosshair hover:scale-110 transition-all"
                        style={{ top: handleTop, borderColor: handleColor }}
                        onMouseDown={(e) => handleOutputMouseDown(e, node.id, handleId)}
                      >
                        <span className="text-[9px] font-bold" style={{ color: handleColor }}>{i + 1}</span>
                      </div>
                    );
                  })}
                  <div 
                    className="absolute -right-3 w-6 h-6 rounded-full bg-background border-2 border-muted-foreground/40 flex items-center justify-center cursor-crosshair hover:scale-110 transition-all"
                    style={{ top: 96 + buttonOptions.length * 32 + 10 }}
                    onMouseDown={(e) => handleOutputMouseDown(e, node.id, 'invalid')}
                  >
                    <span className="text-[9px] font-bold text-muted-foreground/40">✕</span>
                  </div>
                </>
              ) : isMultiCondition && multiConditions.length > 0 ? (
                <>
                  {multiConditions.map((c: any, i: number) => {
                    const handleColors = ['#374DA4', '#22C55E', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'];
                    const handleColor = handleColors[i % handleColors.length];
                    return (
                      <React.Fragment key={c.id}>
                        <div 
                          className="absolute -right-3 w-6 h-6 rounded-full bg-background border-2 flex items-center justify-center cursor-crosshair hover:scale-110 transition-all"
                          style={{ top: 45 + i * 28, borderColor: handleColor }}
                          onMouseDown={(e) => handleOutputMouseDown(e, node.id, c.id)}
                        >
                          <span className="text-[8px] font-bold" style={{ color: handleColor }}>{i + 1}</span>
                        </div>
                        <span className="absolute right-5 text-[9px] font-medium truncate max-w-[60px]" style={{ top: 48 + i * 28, color: handleColor }}>
                          {c.label || `C${i + 1}`}
                        </span>
                      </React.Fragment>
                    );
                  })}
                  {/* Default/Else output */}
                  <div 
                    className="absolute -right-3 w-6 h-6 rounded-full bg-background border-2 border-gray-400 flex items-center justify-center cursor-crosshair hover:scale-110 transition-all"
                    style={{ top: 45 + multiConditions.length * 28 }}
                    onMouseDown={(e) => handleOutputMouseDown(e, node.id, 'else')}
                  >
                    <span className="text-[8px] font-bold text-gray-400">✕</span>
                  </div>
                  <span className="absolute right-5 text-[9px] text-gray-400 font-medium" style={{ top: 48 + multiConditions.length * 28 }}>Senão</span>
                </>
              ) : isCondition || isTimeOrWeekday ? (
                <>
                  {/* Yes output */}
                  <div 
                    className="absolute -right-3 w-6 h-6 rounded-full bg-background border-2 border-green-500 flex items-center justify-center cursor-crosshair hover:bg-green-50 hover:scale-110 transition-all"
                    style={{ top: 50 }}
                    onMouseDown={(e) => handleOutputMouseDown(e, node.id, 'yes')}
                  >
                    <Check className="h-3 w-3 text-green-500" />
                  </div>
                  <span className="absolute right-5 text-[10px] text-green-600 font-medium" style={{ top: 54 }}>Sim</span>
                  
                  {/* No output */}
                  <div 
                    className="absolute -right-3 w-6 h-6 rounded-full bg-background border-2 border-red-500 flex items-center justify-center cursor-crosshair hover:bg-red-50 hover:scale-110 transition-all"
                    style={{ top: 80 }}
                    onMouseDown={(e) => handleOutputMouseDown(e, node.id, 'no')}
                  >
                    <XCircle className="h-3 w-3 text-red-500" />
                  </div>
                  <span className="absolute right-5 text-[10px] text-red-600 font-medium" style={{ top: 84 }}>Não</span>
                </>
              ) : (
                <div 
                  className="absolute -right-3 top-1/2 w-6 h-6 rounded-full bg-background border-2 border-muted-foreground/30 flex items-center justify-center cursor-crosshair hover:border-primary hover:bg-primary/5 hover:scale-110 transition-all"
                  style={{ transform: 'translateY(-50%)' }}
                  onMouseDown={(e) => handleOutputMouseDown(e, node.id)}
                >
                  <div className="w-2 h-2 rounded-full bg-muted-foreground/50" />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Empty State */}
      {nodes.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="text-center">
            <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-4">
              <GitBranch className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-medium text-foreground mb-2">Canvas vazio</h3>
            <p className="text-sm text-muted-foreground max-w-xs">
              Arraste blocos da barra lateral para começar a construir seu fluxo de automação
            </p>
          </div>
        </div>
      )}

      {/* Context Menu */}
      {contextMenu && (
        <div 
          className="fixed z-50 bg-background rounded-xl shadow-xl border py-1.5 min-w-[180px] animate-in fade-in zoom-in-95"
          style={{ left: contextMenu.x, top: contextMenu.y, pointerEvents: 'auto' }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-foreground hover:bg-muted transition-colors"
            onClick={() => handleDuplicateNode(contextMenu.nodeId)}
          >
            <Copy className="h-4 w-4 text-muted-foreground" />
            Duplicar
          </button>
          <button
            className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-foreground hover:bg-muted transition-colors"
            onClick={() => {
              const n = nodes.find(n => n.id === contextMenu.nodeId);
              if (n) {
                if (onNodeEdit) onNodeEdit(n);
                else onNodeSelect(n);
              }
              setContextMenu(null);
            }}
          >
            <Settings className="h-4 w-4 text-muted-foreground" />
            Configurar
          </button>
          <div className="h-px bg-border my-1" />
          <button
            className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-destructive hover:bg-destructive/10 transition-colors"
            onClick={() => {
              handleDeleteNode(contextMenu.nodeId);
              setContextMenu(null);
            }}
          >
            <Trash2 className="h-4 w-4" />
            Excluir
          </button>
        </div>
      )}

      {/* Zoom Controls */}
      <div className="absolute bottom-4 right-4 flex items-center gap-0.5 rounded-xl border border-border/60 bg-background/90 backdrop-blur p-1 shadow-sm">
        <button
          onClick={fitToView}
          className="h-8 px-2.5 inline-flex items-center gap-1.5 rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          title="Recentralizar visualização"
        >
          <Crosshair className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Recentralizar</span>
        </button>
        <div className="w-px h-5 bg-border/70 mx-0.5" />
        <button
          onClick={() => setScale(prev => Math.max(prev * 0.8, 0.25))}
          title="Reduzir zoom"
          className="h-8 w-8 inline-flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        >
          <Minus className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={() => setScale(1)}
          title="Zoom 100%"
          className="h-8 min-w-[46px] px-1 rounded-lg text-[11px] font-medium tabular-nums text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        >
          {Math.round(scale * 100)}%
        </button>
        <button
          onClick={() => setScale(prev => Math.min(prev * 1.2, 2))}
          title="Aumentar zoom"
          className="h-8 w-8 inline-flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        >
          <PlusIcon className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Help text */}
      {!hideHints && (
        <div className="absolute bottom-4 left-4 flex items-center gap-3 text-[11px] text-muted-foreground bg-background/80 backdrop-blur px-3 py-1.5 rounded-xl border border-border/60">
          <span>Arraste pelo ícone ⋮⋮</span>
          <span className="w-px h-3 bg-border" />
          <span>Clique no canvas para mover</span>
        </div>
      )}
    </div>
  );
};

export default ChatBotCanvas;
