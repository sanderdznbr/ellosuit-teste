import React, { useState, useRef, useCallback } from 'react';
import {
  Clock, Calendar, CalendarDays, CheckSquare, Video, MessageCircle,
  User, Zap, Repeat, GitBranch, Bell, GripVertical, X,
} from 'lucide-react';
import { HabitFlowNode, HabitFlowEdge, HabitBlockDefinition } from './types';

const SUITE_COLOR = '#374DA4';

const iconMap: Record<string, React.ComponentType<any>> = {
  Clock, Calendar, CalendarDays, CheckSquare, Video, MessageCircle,
  User, Zap, Repeat, GitBranch, Bell,
};

const typeColors: Record<string, string> = {
  trigger: '#374DA4',
  action: '#007DE3',
  condition: '#F59E0B',
  config: '#6B7280',
};

interface HabitCanvasProps {
  nodes: HabitFlowNode[];
  edges: HabitFlowEdge[];
  onNodesChange: (nodes: HabitFlowNode[]) => void;
  onEdgesChange: (edges: HabitFlowEdge[]) => void;
  onNodeSelect: (node: HabitFlowNode | null) => void;
  selectedNodeId: string | null;
}

interface ConnectingLine {
  sourceId: string;
  sourceHandle?: string;
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
}

const HabitCanvas: React.FC<HabitCanvasProps> = ({
  nodes, edges, onNodesChange, onEdgesChange, onNodeSelect, selectedNodeId,
}) => {
  const canvasRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 80, y: 80 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [draggingNode, setDraggingNode] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [connectingLine, setConnectingLine] = useState<ConnectingLine | null>(null);
  const [hoveredInputNode, setHoveredInputNode] = useState<string | null>(null);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const blockData = e.dataTransfer.getData('habit-block');
    if (!blockData || !canvasRef.current) return;

    const block: HabitBlockDefinition = JSON.parse(blockData);
    const rect = canvasRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left - offset.x) / scale;
    const y = (e.clientY - rect.top - offset.y) / scale;

    const newNode: HabitFlowNode = {
      id: `hnode-${Date.now()}`,
      type: block.type,
      subType: block.subType,
      position: { x, y },
      data: { label: block.label, config: { ...block.defaultConfig, icon: block.icon } },
    };
    onNodesChange([...nodes, newNode]);
  }, [nodes, onNodesChange, scale, offset]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  }, []);

  const handleCanvasMouseDown = (e: React.MouseEvent) => {
    if (e.target === canvasRef.current || (e.target as HTMLElement).classList.contains('canvas-grid')) {
      setIsPanning(true);
      setPanStart({ x: e.clientX - offset.x, y: e.clientY - offset.y });
      onNodeSelect(null);
    }
  };

  const handleCanvasMouseMove = useCallback((e: React.MouseEvent) => {
    if (isPanning) {
      setOffset({ x: e.clientX - panStart.x, y: e.clientY - panStart.y });
      return;
    }
    if (draggingNode && canvasRef.current) {
      const rect = canvasRef.current.getBoundingClientRect();
      const newX = (e.clientX - rect.left - offset.x) / scale - dragOffset.x;
      const newY = (e.clientY - rect.top - offset.y) / scale - dragOffset.y;
      onNodesChange(nodes.map(n => n.id === draggingNode ? { ...n, position: { x: newX, y: newY } } : n));
    }
    if (connectingLine && canvasRef.current) {
      const rect = canvasRef.current.getBoundingClientRect();
      setConnectingLine(prev => prev ? {
        ...prev,
        currentX: (e.clientX - rect.left - offset.x) / scale,
        currentY: (e.clientY - rect.top - offset.y) / scale,
      } : null);
    }
  }, [isPanning, panStart, draggingNode, dragOffset, nodes, onNodesChange, scale, offset, connectingLine]);

  const handleCanvasMouseUp = useCallback(() => {
    setIsPanning(false);
    setDraggingNode(null);
    if (connectingLine && hoveredInputNode && connectingLine.sourceId !== hoveredInputNode) {
      const exists = edges.some(e => e.source === connectingLine.sourceId && e.target === hoveredInputNode);
      if (!exists) {
        onEdgesChange([...edges, {
          id: `hedge-${Date.now()}`,
          source: connectingLine.sourceId,
          target: hoveredInputNode,
          sourceHandle: connectingLine.sourceHandle,
        }]);
      }
    }
    setConnectingLine(null);
    setHoveredInputNode(null);
  }, [connectingLine, hoveredInputNode, edges, onEdgesChange]);

  const handleNodeDragStart = (e: React.MouseEvent, nodeId: string, nodePos: { x: number; y: number }) => {
    e.stopPropagation();
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    setDraggingNode(nodeId);
    setDragOffset({
      x: (e.clientX - rect.left - offset.x) / scale - nodePos.x,
      y: (e.clientY - rect.top - offset.y) / scale - nodePos.y,
    });
  };

  const handleOutputMouseDown = (e: React.MouseEvent, nodeId: string, handle?: string) => {
    e.stopPropagation();
    const node = nodes.find(n => n.id === nodeId);
    if (!node || !canvasRef.current) return;
    const startX = node.position.x + 240;
    const startY = node.position.y + 35;
    setConnectingLine({ sourceId: nodeId, sourceHandle: handle, startX, startY, currentX: startX, currentY: startY });
  };

  const handleDeleteNode = useCallback((nodeId: string) => {
    onNodesChange(nodes.filter(n => n.id !== nodeId));
    onEdgesChange(edges.filter(e => e.source !== nodeId && e.target !== nodeId));
    onNodeSelect(null);
  }, [nodes, edges, onNodesChange, onEdgesChange, onNodeSelect]);

  const handleDeleteEdge = useCallback((edgeId: string) => {
    onEdgesChange(edges.filter(e => e.id !== edgeId));
  }, [edges, onEdgesChange]);

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setScale(prev => Math.min(Math.max(prev * delta, 0.25), 2));
  };

  const getNodeDescription = (node: HabitFlowNode): string => {
    const c = node.data.config || {};
    switch (node.subType) {
      case 'daily': return `Todo dia às ${c.time || '09:00'}`;
      case 'weekly': {
        const dayLabels = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
        const days = (c.days || []).map((d: number) => dayLabels[d]).join(', ');
        return `${days || 'Selecione dias'} às ${c.time || '09:00'}`;
      }
      case 'monthly': return `Dia ${c.dayOfMonth || 1} às ${c.time || '09:00'}`;
      case 'create_task': return c.title || 'Configure a tarefa';
      case 'create_meeting': return c.title || 'Configure a reunião';
      case 'send_whatsapp': return c.phone ? `Para: ${c.phone}` : 'Configure o envio';
      case 'notification': return c.message ? c.message.slice(0, 30) : 'Configure';
      case 'assign_user': return c.userName || 'Selecione colaborador';
      case 'repeat': return `${c.times || 1}x vezes`;
      case 'if_weekday': return 'Dia útil?';
      case 'if_time': return `${c.startHour || 8}h - ${c.endHour || 18}h`;
      default: return 'Clique para configurar';
    }
  };

  const renderEdge = (edge: HabitFlowEdge) => {
    const src = nodes.find(n => n.id === edge.source);
    const tgt = nodes.find(n => n.id === edge.target);
    if (!src || !tgt) return null;

    const sx = src.position.x + 240, sy = src.position.y + 35;
    const tx = tgt.position.x, ty = tgt.position.y + 35;
    const mx = (sx + tx) / 2;
    const path = `M ${sx} ${sy} C ${mx} ${sy}, ${mx} ${ty}, ${tx} ${ty}`;

    return (
      <g key={edge.id}>
        <path d={path} fill="none" stroke="transparent" strokeWidth={20} className="cursor-pointer" onClick={() => handleDeleteEdge(edge.id)} />
        <path d={path} fill="none" stroke="#94A3B8" strokeWidth={2} className="pointer-events-none" markerEnd="url(#habit-arrow)" />
        <g className="opacity-0 hover:opacity-100 transition-opacity cursor-pointer" transform={`translate(${mx - 8}, ${(sy + ty) / 2 - 8})`} onClick={() => handleDeleteEdge(edge.id)}>
          <circle cx={8} cy={8} r={10} fill="white" stroke="#EF4444" strokeWidth={1.5} />
          <path d="M 5 5 L 11 11 M 11 5 L 5 11" stroke="#EF4444" strokeWidth={1.5} strokeLinecap="round" />
        </g>
      </g>
    );
  };

  return (
    <div
      ref={canvasRef}
      className="flex-1 bg-muted/30 relative overflow-hidden"
      style={{ cursor: isPanning ? 'grabbing' : draggingNode ? 'grabbing' : 'default' }}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onMouseDown={handleCanvasMouseDown}
      onMouseMove={handleCanvasMouseMove}
      onMouseUp={handleCanvasMouseUp}
      onMouseLeave={handleCanvasMouseUp}
      onWheel={handleWheel}
    >
      {/* Grid */}
      <div
        className="absolute inset-0 opacity-40 canvas-grid pointer-events-none"
        style={{
          backgroundImage: 'radial-gradient(circle, hsl(var(--muted-foreground) / 0.3) 1px, transparent 1px)',
          backgroundSize: `${20 * scale}px ${20 * scale}px`,
          backgroundPosition: `${offset.x}px ${offset.y}px`,
        }}
      />

      <div className="absolute inset-0 pointer-events-none" style={{ transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`, transformOrigin: '0 0' }}>
        <svg className="absolute inset-0 w-full h-full overflow-visible" style={{ pointerEvents: 'none' }}>
          <defs>
            <marker id="habit-arrow" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
              <polygon points="0 0, 10 3.5, 0 7" fill="#94A3B8" />
            </marker>
          </defs>
          <g style={{ pointerEvents: 'auto' }}>
            {edges.map(renderEdge)}
            {connectingLine && (() => {
              const { startX, startY, currentX, currentY } = connectingLine;
              const mx = (startX + currentX) / 2;
              return <path d={`M ${startX} ${startY} C ${mx} ${startY}, ${mx} ${currentY}, ${currentX} ${currentY}`} fill="none" stroke={SUITE_COLOR} strokeWidth={2} strokeDasharray="5,5" className="pointer-events-none" />;
            })()}
          </g>
        </svg>

        {nodes.map(node => {
          const color = typeColors[node.type] || SUITE_COLOR;
          const Icon = iconMap[node.data.config?.icon] || Zap;
          const isSelected = node.id === selectedNodeId;

          return (
            <div
              key={node.id}
              className="absolute"
              style={{ left: node.position.x, top: node.position.y, pointerEvents: 'auto', width: 240 }}
            >
              <div
                className={`bg-white rounded-xl border-2 shadow-sm transition-all overflow-hidden ${isSelected ? 'shadow-lg ring-2 ring-offset-1' : 'hover:shadow-md'}`}
                style={{ borderColor: isSelected ? color : '#e5e7eb', ...(isSelected ? { ringColor: color + '40' } : {}) }}
                onClick={e => { e.stopPropagation(); onNodeSelect(node); }}
              >
                {/* Header */}
                <div className="flex items-center gap-2 px-3 py-2" style={{ backgroundColor: color + '10' }}>
                  <div
                    className="cursor-grab active:cursor-grabbing p-0.5"
                    onMouseDown={e => handleNodeDragStart(e, node.id, node.position)}
                  >
                    <GripVertical className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="w-6 h-6 rounded-md flex items-center justify-center" style={{ backgroundColor: color + '20', color }}>
                    <Icon className="h-3.5 w-3.5" />
                  </div>
                  <span className="text-xs font-semibold flex-1 truncate" style={{ color }}>{node.data.label}</span>
                  <button onClick={e => { e.stopPropagation(); handleDeleteNode(node.id); }} className="text-muted-foreground hover:text-destructive">
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
                {/* Body */}
                <div className="px-3 py-2">
                  <p className="text-[11px] text-muted-foreground truncate">{getNodeDescription(node)}</p>
                </div>
              </div>

              {/* Input handle (left) */}
              <div
                className="absolute -left-2 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full border-2 bg-white transition-colors"
                style={{ borderColor: hoveredInputNode === node.id ? SUITE_COLOR : '#d1d5db' }}
                onMouseEnter={() => connectingLine && setHoveredInputNode(node.id)}
                onMouseLeave={() => setHoveredInputNode(null)}
              />

              {/* Output handle (right) */}
              <div
                className="absolute -right-2 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full border-2 bg-white cursor-crosshair hover:scale-125 transition-all"
                style={{ borderColor: color, backgroundColor: color + '20' }}
                onMouseDown={e => handleOutputMouseDown(e, node.id)}
              />
            </div>
          );
        })}
      </div>

      {/* Zoom indicator */}
      <div className="absolute bottom-4 right-4 bg-white/80 backdrop-blur rounded-lg px-3 py-1.5 text-xs text-muted-foreground shadow-sm border">
        {Math.round(scale * 100)}%
      </div>
    </div>
  );
};

export default HabitCanvas;
