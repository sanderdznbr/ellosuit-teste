
import { useCallback, useRef, useState, useEffect } from 'react';
import { AutomationNode, AutomationEdge, AUTOMATION_BLOCKS, AutomationBlockDefinition } from './types';
import * as Icons from 'lucide-react';
import { Trash2, GripVertical, ZoomIn, ZoomOut, Maximize, Plus, Zap, Play, GitBranch, RefreshCw, MousePointer, Clipboard } from 'lucide-react';

interface Props {
  nodes: AutomationNode[];
  edges: AutomationEdge[];
  onNodesChange: (nodes: AutomationNode[]) => void;
  onEdgesChange: (edges: AutomationEdge[]) => void;
  onNodeSelect: (node: AutomationNode | null) => void;
  selectedNodeId: string | null;
  isActive?: boolean;
}

const GRID_SIZE = 20;
const NODE_WIDTH = 280;
const NODE_HEIGHT = 80;

// All client fields from the DB schema
const ALL_CLIENT_FIELDS = [
  { key: 'avatar_url', label: 'Foto de Perfil' },
  { key: 'name', label: 'Nome' },
  { key: 'email', label: 'Email' },
  { key: 'phone', label: 'Telefone' },
  { key: 'whatsapp', label: 'WhatsApp' },
  { key: 'status', label: 'Status' },
  { key: 'cnpj_cpf', label: 'CPF/CNPJ' },
  { key: 'company_name', label: 'Empresa' },
  { key: 'client_type', label: 'Tipo' },
  { key: 'profession', label: 'Profissão' },
  { key: 'birth_date', label: 'Nascimento' },
  { key: 'address_street', label: 'Rua' },
  { key: 'address_number', label: 'Número' },
  { key: 'address_city', label: 'Cidade' },
  { key: 'address_state', label: 'Estado' },
  { key: 'address_zip', label: 'CEP' },
  { key: 'industry', label: 'Indústria' },
  { key: 'company_size', label: 'Porte' },
  { key: 'annual_revenue', label: 'Faturamento' },
  { key: 'website', label: 'Website' },
  { key: 'linkedin', label: 'LinkedIn' },
  { key: 'instagram', label: 'Instagram' },
  { key: 'facebook', label: 'Facebook' },
  { key: 'whatsapp_business', label: 'WhatsApp Business' },
  { key: 'notes', label: 'Anotações' },
  { key: 'tags', label: 'Tags' },
  { key: 'purchased_items', label: 'Item Comprado (lista)' },
  { key: 'purchase_date', label: 'Data da Compra' },
  { key: 'purchase_total', label: 'Valor Total da Compra' },
  { key: 'custom_fields', label: 'Campos Personalizados' },
];

const DEFAULT_CLIENT_FIELDS = [
  'name', 'email', 'phone', 'whatsapp', 'status',
  'cnpj_cpf', 'company_name', 'client_type', 'profession',
  'birth_date', 'address_street', 'address_number', 'address_city',
  'address_state', 'address_zip', 'notes', 'tags',
  'purchased_items', 'purchase_date', 'purchase_total',
];

const DEFAULT_NEW_CLIENT_OUTPUT_FIELDS = ['name', 'email', 'phone', 'whatsapp'];

export default function AutomationCanvas({ nodes, edges, onNodesChange, onEdgesChange, onNodeSelect, selectedNodeId, isActive }: Props) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState<{ id: string; offsetX: number; offsetY: number } | null>(null);
  const [connecting, setConnecting] = useState<{ sourceId: string; sourceField?: string; mouseX: number; mouseY: number } | null>(null);
  const [panning, setPanning] = useState<{ startX: number; startY: number; startScrollLeft: number; startScrollTop: number } | null>(null);

  // Zoom state
  const [zoom, setZoom] = useState(1);
  const MIN_ZOOM = 0.3;
  const MAX_ZOOM = 2;

  // Context menu state
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; canvasX: number; canvasY: number } | null>(null);

  // Close context menu on click anywhere
  useEffect(() => {
    const close = () => setContextMenu(null);
    if (contextMenu) {
      window.addEventListener('click', close);
      return () => window.removeEventListener('click', close);
    }
  }, [contextMenu]);

  const getBlockDef = (type: string) => AUTOMATION_BLOCKS.find(b => b.type === type);

  const getIcon = (iconName: string) => {
    const IconComp = (Icons as any)[iconName];
    return IconComp ? <IconComp className="h-4 w-4" /> : null;
  };

  // Get active client fields for a node
  const getClientFields = (node: AutomationNode) => {
    const activeKeys: string[] = node.config?.activeClientFields || DEFAULT_CLIENT_FIELDS;
    return ALL_CLIENT_FIELDS.filter(f => activeKeys.includes(f.key));
  };

  // Get active output fields for new_client trigger
  const getNewClientOutputFields = (node: AutomationNode) => {
    const activeKeys: string[] = node.config?.activeOutputFields || DEFAULT_NEW_CLIENT_OUTPUT_FIELDS;
    return ALL_CLIENT_FIELDS.filter(f => activeKeys.includes(f.key));
  };

  // Email input fields - always show "Email" as a connectable input
  const EMAIL_INPUT_FIELDS = [
    { key: 'email', label: 'Email' },
  ];
  const getEmailInputFields = (_node: AutomationNode) => EMAIL_INPUT_FIELDS;

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const scrollLeft = canvasRef.current?.scrollLeft || 0;
    const scrollTop = canvasRef.current?.scrollTop || 0;
    const x = Math.round(((e.clientX - rect.left + scrollLeft) / zoom) / GRID_SIZE) * GRID_SIZE;
    const y = Math.round(((e.clientY - rect.top + scrollTop) / zoom) / GRID_SIZE) * GRID_SIZE;
    const newNode: AutomationNode = {
      id: `node-${Date.now()}`,
      type: 'unknown',
      label: 'Novo Bloco',
      position: { x, y },
      data: {},
      config: {},
    };
    onNodesChange([...nodes, newNode]);
    onNodeSelect(newNode);
  }, [nodes, onNodesChange, onNodeSelect, zoom]);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  };

  const handleGripMouseDown = (e: React.MouseEvent, node: AutomationNode) => {
    e.stopPropagation();
    e.preventDefault();
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const scrollLeft = canvasRef.current?.scrollLeft || 0;
    const scrollTop = canvasRef.current?.scrollTop || 0;
    setDragging({
      id: node.id,
      offsetX: (e.clientX - rect.left + scrollLeft) / zoom - node.position.x,
      offsetY: (e.clientY - rect.top + scrollTop) / zoom - node.position.y,
    });
  };

  const handleNodeClick = (e: React.MouseEvent, node: AutomationNode) => {
    e.stopPropagation();
    onNodeSelect(node);
  };

  // Canvas panning (middle click or space+drag on background)
  const handleCanvasMouseDown = (e: React.MouseEvent) => {
    // Middle mouse button or left click on empty canvas
    if (e.button === 1 || (e.button === 0 && !dragging && !connecting)) {
      const el = canvasRef.current;
      if (!el) return;
      setPanning({
        startX: e.clientX,
        startY: e.clientY,
        startScrollLeft: el.scrollLeft,
        startScrollTop: el.scrollTop,
      });
    }
  };

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    if (panning) {
      const el = canvasRef.current;
      if (!el) return;
      el.scrollLeft = panning.startScrollLeft - (e.clientX - panning.startX);
      el.scrollTop = panning.startScrollTop - (e.clientY - panning.startY);
      return;
    }

    if (dragging) {
      const scrollLeft = canvasRef.current?.scrollLeft || 0;
      const scrollTop = canvasRef.current?.scrollTop || 0;
      const x = Math.round(((e.clientX - rect.left + scrollLeft) / zoom - dragging.offsetX) / GRID_SIZE) * GRID_SIZE;
      const y = Math.round(((e.clientY - rect.top + scrollTop) / zoom - dragging.offsetY) / GRID_SIZE) * GRID_SIZE;
      onNodesChange(nodes.map(n => n.id === dragging.id ? { ...n, position: { x, y } } : n));
    }

    if (connecting) {
      const scrollLeft = canvasRef.current?.scrollLeft || 0;
      const scrollTop = canvasRef.current?.scrollTop || 0;
      setConnecting(prev => prev ? {
        ...prev,
        mouseX: (e.clientX - rect.left + scrollLeft) / zoom,
        mouseY: (e.clientY - rect.top + scrollTop) / zoom,
      } : null);
    }
  }, [dragging, connecting, panning, nodes, onNodesChange, zoom]);

  const handleMouseUp = () => {
    setDragging(null);
    setConnecting(null);
    setPanning(null);
  };

  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.1 : 0.1;
      setZoom(z => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z + delta)));
    }
  }, []);

  const handleConnect = (sourceId: string, targetId: string, sourceField?: string, targetField?: string) => {
    if (sourceId === targetId) return;
    if (edges.some(e => e.source === sourceId && e.target === targetId && e.sourceField === sourceField && e.targetField === targetField)) return;
    onEdgesChange([...edges, { id: `edge-${Date.now()}`, source: sourceId, target: targetId, sourceField, targetField }]);
  };

  const deleteNode = (e: React.MouseEvent, nodeId: string) => {
    e.stopPropagation();
    onNodesChange(nodes.filter(n => n.id !== nodeId));
    onEdgesChange(edges.filter(e => e.source !== nodeId && e.target !== nodeId));
    if (selectedNodeId === nodeId) onNodeSelect(null);
  };

  const deleteEdge = (edgeId: string) => {
    onEdgesChange(edges.filter(e => e.id !== edgeId));
  };

  const handlePortMouseDown = (e: React.MouseEvent, nodeId: string, fieldName?: string) => {
    e.stopPropagation();
    e.preventDefault();
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const scrollLeft = canvasRef.current?.scrollLeft || 0;
    const scrollTop = canvasRef.current?.scrollTop || 0;
    setConnecting({
      sourceId: nodeId,
      sourceField: fieldName,
      mouseX: (e.clientX - rect.left + scrollLeft) / zoom,
      mouseY: (e.clientY - rect.top + scrollTop) / zoom,
    });
  };

  const handlePortMouseUp = (e: React.MouseEvent, nodeId: string, fieldName?: string) => {
    e.stopPropagation();
    if (connecting && connecting.sourceId !== nodeId) {
      handleConnect(connecting.sourceId, nodeId, connecting.sourceField, fieldName);
    }
    setConnecting(null);
  };

  // Field section layout constants
  const CONFIG_PREVIEW_HEIGHT = 32;
  const FIELD_SECTION_PADDING = 12; // py-3 top
  const FIELD_SECTION_HEADER_HEIGHT = 28; // label + mb-3
  const FIELD_ROW_HEIGHT = 36; // each row with space-y-2
  const FIELD_ROW_FIRST_OFFSET = 0;

  const getWebhookFields = (node: AutomationNode): string[] => {
    return node.config?.detectedFields || node.config?.externalDetectedFields || [];
  };

  const getNodeFieldCount = (node: AutomationNode): number => {
    if (node.type === 'webhook') return getWebhookFields(node).length;
    if (node.type === 'create_client') return getClientFields(node).length;
    if (node.type === 'new_client') return getNewClientOutputFields(node).length;
    if (node.type === 'send_email') return getEmailInputFields(node).length;
    return 0;
  };

  const getNodeHeight = (node: AutomationNode) => {
    const fieldCount = getNodeFieldCount(node);
    if (fieldCount === 0) return NODE_HEIGHT;
    // header(~52) + config_preview(32) + border(2) + section_padding(12) + section_header(28) + rows
    return 52 + CONFIG_PREVIEW_HEIGHT + 2 + FIELD_SECTION_PADDING + FIELD_SECTION_HEADER_HEIGHT + fieldCount * FIELD_ROW_HEIGHT + 12;
  };

  const getFieldPortY = (node: AutomationNode, fieldName: string, fieldList: string[]) => {
    const fieldIndex = fieldList.indexOf(fieldName);
    if (fieldIndex === -1) return node.position.y + getNodeHeight(node) / 2;
    const baseY = node.position.y + 52 + CONFIG_PREVIEW_HEIGHT + 2 + FIELD_SECTION_PADDING + FIELD_SECTION_HEADER_HEIGHT;
    return baseY + fieldIndex * FIELD_ROW_HEIGHT + FIELD_ROW_HEIGHT / 2;
  };

  const getEdgeSourceY = (edge: AutomationEdge, source: AutomationNode) => {
    if (edge.sourceField && source.type === 'webhook') {
      return getFieldPortY(source, edge.sourceField, getWebhookFields(source));
    }
    if (edge.sourceField && source.type === 'new_client') {
      const fieldLabels = getNewClientOutputFields(source).map(f => f.label);
      return getFieldPortY(source, edge.sourceField, fieldLabels);
    }
    return source.position.y + getNodeHeight(source) / 2;
  };

  const getEdgeTargetY = (edge: AutomationEdge, target: AutomationNode) => {
    if (edge.targetField && target.type === 'create_client') {
      const fieldLabels = getClientFields(target).map(f => f.label);
      return getFieldPortY(target, edge.targetField, fieldLabels);
    }
    if (edge.targetField && target.type === 'send_email') {
      const fieldLabels = getEmailInputFields(target).map(f => f.label);
      return getFieldPortY(target, edge.targetField, fieldLabels);
    }
    return target.position.y + getNodeHeight(target) / 2;
  };

  const renderEdge = (edge: AutomationEdge) => {
    const source = nodes.find(n => n.id === edge.source);
    const target = nodes.find(n => n.id === edge.target);
    if (!source || !target) return null;

    const sx = source.position.x + NODE_WIDTH;
    const sy = getEdgeSourceY(edge, source);
    const tx = target.position.x;
    const ty = getEdgeTargetY(edge, target);
    const mx = (sx + tx) / 2;
    const pathD = `M ${sx} ${sy} C ${mx} ${sy}, ${mx} ${ty}, ${tx} ${ty}`;

    return (
      <g key={edge.id} className="cursor-pointer group" onClick={() => deleteEdge(edge.id)}>
        {/* Base path */}
        <path
          d={pathD}
          fill="none"
          stroke={isActive ? '#22C55E' : '#94A3B8'}
          strokeWidth={isActive ? 3 : 2.5}
          className={`group-hover:stroke-red-400 transition-colors ${isActive ? 'drop-shadow-[0_0_4px_rgba(34,197,94,0.4)]' : ''}`}
        />
        {/* Energy flow particles when active */}
        {isActive && (
          <>
            <circle r={4} fill="#4ADE80" filter="url(#energyGlow)">
              <animateMotion dur="1.5s" repeatCount="indefinite" path={pathD} />
            </circle>
            <circle r={3} fill="#86EFAC" filter="url(#energyGlow)">
              <animateMotion dur="1.5s" repeatCount="indefinite" path={pathD} begin="0.5s" />
            </circle>
            <circle r={2.5} fill="#BBF7D0" filter="url(#energyGlow)">
              <animateMotion dur="1.5s" repeatCount="indefinite" path={pathD} begin="1s" />
            </circle>
          </>
        )}
        {/* Delete indicator */}
        <circle cx={mx} cy={(sy + ty) / 2} r={8} fill="white" stroke={isActive ? '#86EFAC' : '#CBD5E1'} strokeWidth={1.5}
          className="group-hover:stroke-red-400 group-hover:fill-red-50 transition-colors" />
        <text x={mx} y={(sy + ty) / 2 + 4} textAnchor="middle" fontSize={11} fill={isActive ? '#22C55E' : '#94A3B8'}
          className="group-hover:fill-red-400 select-none pointer-events-none">×</text>
      </g>
    );
  };

  const renderConnectingLine = () => {
    if (!connecting) return null;
    const source = nodes.find(n => n.id === connecting.sourceId);
    if (!source) return null;
    const sx = source.position.x + NODE_WIDTH;
    let sy: number;
    if (connecting.sourceField && source.type === 'webhook') {
      sy = getFieldPortY(source, connecting.sourceField, getWebhookFields(source));
    } else if (connecting.sourceField && source.type === 'new_client') {
      const fieldLabels = getNewClientOutputFields(source).map(f => f.label);
      sy = getFieldPortY(source, connecting.sourceField, fieldLabels);
    } else {
      sy = source.position.y + getNodeHeight(source) / 2;
    }
    const mx = (sx + connecting.mouseX) / 2;
    return (
      <path
        d={`M ${sx} ${sy} C ${mx} ${sy}, ${mx} ${connecting.mouseY}, ${connecting.mouseX} ${connecting.mouseY}`}
        fill="none"
        stroke="#374DA4"
        strokeWidth={2}
        strokeDasharray="6 3"
        className="pointer-events-none"
      />
    );
  };

  // Toggle a client field on/off
  const toggleClientField = (node: AutomationNode, fieldKey: string) => {
    const current: string[] = node.config?.activeClientFields || DEFAULT_CLIENT_FIELDS;
    const updated = current.includes(fieldKey)
      ? current.filter(k => k !== fieldKey)
      : [...current, fieldKey];
    onNodesChange(nodes.map(n => n.id === node.id ? { ...n, config: { ...n.config, activeClientFields: updated } } : n));
  };

  // Toggle new_client output field on/off
  const toggleNewClientOutputField = (node: AutomationNode, fieldKey: string) => {
    const current: string[] = node.config?.activeOutputFields || DEFAULT_NEW_CLIENT_OUTPUT_FIELDS;
    const updated = current.includes(fieldKey)
      ? current.filter(k => k !== fieldKey)
      : [...current, fieldKey];
    onNodesChange(nodes.map(n => n.id === node.id ? { ...n, config: { ...n.config, activeOutputFields: updated } } : n));
  };

  const [showFieldSelector, setShowFieldSelector] = useState<string | null>(null);
  const [showNewClientFieldSelector, setShowNewClientFieldSelector] = useState<string | null>(null);

  // Canvas size for infinite scroll
  const canvasW = 5000;
  const canvasH = 5000;

  return (
    <div className="flex-1 relative flex flex-col overflow-hidden">
      {/* Zoom controls */}
      <div className="absolute top-3 right-3 z-50 flex items-center gap-1 backdrop-blur rounded-xl shadow-lg border px-1.5 py-1 bg-white/90 border-gray-200">
        <button onClick={() => setZoom(z => Math.max(MIN_ZOOM, z - 0.1))} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors" title="Diminuir zoom">
          <ZoomOut className="h-4 w-4 text-gray-600" />
        </button>
        <span className="text-xs font-medium min-w-[40px] text-center text-gray-500">{Math.round(zoom * 100)}%</span>
        <button onClick={() => setZoom(z => Math.min(MAX_ZOOM, z + 0.1))} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors" title="Aumentar zoom">
          <ZoomIn className="h-4 w-4 text-gray-600" />
        </button>
        <div className="w-px h-5 mx-0.5 bg-gray-200" />
        <button onClick={() => setZoom(1)} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors" title="Resetar zoom">
          <Maximize className="h-4 w-4 text-gray-600" />
        </button>
      </div>

      {/* Canvas */}
      <div
        ref={canvasRef}
        className="flex-1 overflow-auto"
        style={{
          cursor: panning ? 'grabbing' : connecting ? 'crosshair' : dragging ? 'grabbing' : 'grab',
        }}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onMouseDown={handleCanvasMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onWheel={handleWheel}
        onClick={() => { if (!panning) { onNodeSelect(null); setContextMenu(null); } }}
        onContextMenu={(e) => {
          e.preventDefault();
          const rect = canvasRef.current?.getBoundingClientRect();
          if (!rect) return;
          const scrollLeft = canvasRef.current?.scrollLeft || 0;
          const scrollTop = canvasRef.current?.scrollTop || 0;
          setContextMenu({
            x: e.clientX - rect.left,
            y: e.clientY - rect.top,
            canvasX: Math.round(((e.clientX - rect.left + scrollLeft) / zoom) / GRID_SIZE) * GRID_SIZE,
            canvasY: Math.round(((e.clientY - rect.top + scrollTop) / zoom) / GRID_SIZE) * GRID_SIZE,
          });
        }}
      >
        <div
          style={{
            width: canvasW,
            height: canvasH,
            transform: `scale(${zoom})`,
            transformOrigin: '0 0',
            position: 'relative',
            backgroundImage: 'radial-gradient(circle, hsl(var(--border)) 1px, transparent 1px)',
            backgroundSize: `${GRID_SIZE}px ${GRID_SIZE}px`,
            backgroundColor: 'hsl(var(--muted) / 0.3)',
          }}
        >
          {/* Edges SVG */}
          <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ zIndex: 1 }}>
            <defs>
              <filter id="energyGlow" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="3" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>
            <g className="pointer-events-auto">
              {edges.map(renderEdge)}
            </g>
            {renderConnectingLine()}
          </svg>

          {/* Nodes */}
          {nodes.map(node => {
            const block = getBlockDef(node.type);
            const isSelected = selectedNodeId === node.id;
            const color = block?.color || '#64748B';

            return (
              <div
                key={node.id}
                className={`absolute select-none group ${isSelected ? 'z-20' : 'z-10'}`}
                style={{ left: node.position.x, top: node.position.y, width: NODE_WIDTH }}
                onClick={e => handleNodeClick(e, node)}
              >
                <div
                  className={`rounded-2xl border-2 transition-all duration-300 overflow-visible bg-white ${
                    isSelected ? 'shadow-xl ring-2 ring-offset-1' : 'shadow-md hover:shadow-lg'
                  }`}
                  style={{
                    borderColor: isSelected ? color : 'hsl(var(--border))',
                    ...(isSelected ? { boxShadow: `0 0 0 3px ${color}40` } : {}),
                  }}
                >
                  {/* Header */}
                  <div className="flex items-center gap-2 px-3 py-2.5 rounded-t-2xl" style={{ backgroundColor: color + '12' }}>
                    <div
                      className="cursor-grab active:cursor-grabbing p-0.5 rounded transition-colors flex-shrink-0 hover:bg-black/5"
                      onMouseDown={e => handleGripMouseDown(e, node)}
                      title="Arrastar bloco"
                    >
                      <GripVertical className="h-4 w-4 text-gray-400" />
                    </div>
                    <div className="w-8 h-8 rounded-xl flex items-center justify-center text-white flex-shrink-0 shadow-sm"
                      style={{ backgroundColor: color }}>
                      {block && getIcon(block.icon)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-semibold truncate text-gray-800">{node.label}</div>
                      <div className="text-[10px] truncate text-gray-400">{block?.description || node.type}</div>
                    </div>
                    <button
                      onClick={e => deleteNode(e, node.id)}
                      className="p-1.5 rounded-lg hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-all"
                      title="Excluir bloco"
                    >
                      <Trash2 className="h-3.5 w-3.5 text-red-400" />
                    </button>
                  </div>

                  {/* Config preview */}
                  <div className="px-3 py-2 text-[10px] border-t text-gray-500 border-gray-50">
                    {node.type === 'webhook' && <span>{node.config?.webhookMode === 'fetch' ? '🌐 Puxar dados externos' : '⚡ Receber POST'}</span>}
                    {node.type === 'new_client' && <span>Gatilho: novo {node.config?.clientType === 'any' ? 'contato' : node.config?.clientType}</span>}
                    {node.type === 'client_updated' && <span>Gatilho: cliente atualizado</span>}
                    {node.type === 'proposal_status' && <span>Status: {node.config?.status || 'aprovada'}</span>}
                    {node.type === 'schedule' && <span>⏰ Cron: {node.config?.cron || '0 9 * * *'}</span>}
                    {node.type === 'send_email' && <span>📧 Para: {node.config?.to || 'configurar'}</span>}
                    {node.type === 'send_whatsapp' && <span>💬 Para: {node.config?.to || 'configurar'}</span>}
                    {node.type === 'create_client' && <span>👤 Mapear campos do gatilho</span>}
                    {node.type === 'update_client' && <span>✏️ Atualizar: {node.config?.clientIdentifier || 'configurar'}</span>}
                    {node.type === 'create_task' && <span>📋 Tarefa: {node.config?.title || 'configurar'}</span>}
                    {node.type === 'create_proposal' && <span>📄 Ordem de serviço automática</span>}
                    {node.type === 'create_receipt' && <span>🧾 Recibo: {node.config?.title || 'configurar'}</span>}
                    {node.type === 'http_request' && <span>🔗 {node.config?.method || 'POST'} {node.config?.url ? '✓' : '...'}</span>}
                    {node.type === 'condition' && <span>🔀 {node.config?.field || 'Configurar condição'}</span>}
                    {node.type === 'filter' && <span>🔍 Filtro: {node.config?.filterField || 'configurar'}</span>}
                    {node.type === 'transform_data' && <span>🔄 Mapear campos</span>}
                    {node.type === 'delay' && <span>⏳ {node.config?.duration || 5} {node.config?.unit || 'min'}</span>}
                  </div>

                  {/* Webhook output fields */}
                  {(() => {
                    const fields = getWebhookFields(node);
                    if (node.type !== 'webhook' || fields.length === 0) return null;
                    return (
                      <div className="border-t-2 px-3 py-3 border-[#DFE4FB] bg-[#F0F2FE]/30">
                        <div className="text-[10px] font-bold text-[#374DA4] uppercase tracking-widest mb-3 flex items-center gap-1.5">
                          <div className="w-1.5 h-1.5 rounded-full bg-[#374DA4]" />
                          Saídas ({fields.length})
                        </div>
                        <div className="space-y-1">
                          {fields.map((field) => (
                            <div key={field} className="flex items-center relative group/field" style={{ height: FIELD_ROW_HEIGHT }}>
                              <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg border flex-1 min-w-0 shadow-sm transition-all bg-white border-[#DFE4FB] hover:border-[#879CE0] hover:shadow">
                                <div className="w-2.5 h-2.5 rounded-full flex-shrink-0 bg-[#5A74D1]" />
                                <span className="text-[11px] font-mono font-medium truncate text-gray-700">{field}</span>
                              </div>
                              <div
                                className="absolute -right-[26px] w-7 h-7 rounded-full border-[2.5px] border-[#5A74D1] cursor-crosshair hover:scale-[1.3] hover:border-[#2F428D] hover:shadow-lg transition-all z-30 flex items-center justify-center shadow-md bg-white"
                                onMouseDown={e => handlePortMouseDown(e, node.id, field)}
                                title={`Conectar: ${field}`}
                              >
                                <div className="w-3 h-3 rounded-full bg-[#5A74D1] group-hover/field:bg-[#2F428D] transition-colors" />
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })()}

                  {/* New client output fields */}
                  {node.type === 'new_client' && getNewClientOutputFields(node).length > 0 && (
                    <div className="border-t-2 px-3 py-3 border-emerald-100 bg-emerald-50/30">
                      <div className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest mb-3 flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                          Saídas ({getNewClientOutputFields(node).length})
                        </div>
                        <button
                          className="text-[9px] font-semibold text-emerald-600 bg-emerald-100 hover:bg-emerald-200 px-2 py-0.5 rounded-full transition-colors"
                          onClick={(e) => { e.stopPropagation(); setShowNewClientFieldSelector(showNewClientFieldSelector === node.id ? null : node.id); }}
                        >
                          {showNewClientFieldSelector === node.id ? '✓ Fechar' : '+ Campos'}
                        </button>
                      </div>

                      {showNewClientFieldSelector === node.id && (
                        <div className="mb-3 p-2 bg-white rounded-lg border border-emerald-200 shadow-lg max-h-48 overflow-y-auto">
                          <div className="text-[9px] text-gray-400 uppercase font-bold mb-1.5">Selecione os campos de saída</div>
                          <div className="grid grid-cols-2 gap-1">
                            {ALL_CLIENT_FIELDS.map(f => {
                              const isActive = (node.config?.activeOutputFields || DEFAULT_NEW_CLIENT_OUTPUT_FIELDS).includes(f.key);
                              return (
                                <button
                                  key={f.key}
                                  onClick={(e) => { e.stopPropagation(); toggleNewClientOutputField(node, f.key); }}
                                  className={`text-[10px] px-2 py-1 rounded-md text-left truncate transition-all ${
                                    isActive
                                      ? 'bg-emerald-100 text-emerald-700 font-medium border border-emerald-300'
                                      : 'bg-gray-50 text-gray-500 hover:bg-gray-100 border border-transparent'
                                  }`}
                                >
                                  {isActive ? '✓ ' : ''}{f.label}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      <div className="space-y-1">
                        {getNewClientOutputFields(node).map(({ key, label }) => (
                          <div key={key} className="flex items-center relative group/field" style={{ height: FIELD_ROW_HEIGHT }}>
                            <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg border flex-1 min-w-0 shadow-sm transition-all bg-white border-emerald-100 hover:border-emerald-300 hover:shadow">
                              <div className="w-2.5 h-2.5 rounded-full flex-shrink-0 bg-emerald-400" />
                              <span className="text-[11px] font-mono font-medium truncate text-gray-700">{label}</span>
                              <span className="text-[9px] text-gray-400 ml-auto">{key}</span>
                            </div>
                            <div
                              className="absolute -right-[26px] w-7 h-7 rounded-full border-[2.5px] border-emerald-400 cursor-crosshair hover:scale-[1.3] hover:border-emerald-600 hover:shadow-lg transition-all z-30 flex items-center justify-center shadow-md bg-white"
                              onMouseDown={e => handlePortMouseDown(e, node.id, label)}
                              title={`Conectar: ${label}`}
                            >
                              <div className="w-3 h-3 rounded-full bg-emerald-400 group-hover/field:bg-emerald-600 transition-colors" />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Create client input fields */}
                  {node.type === 'create_client' && (
                    <div className="border-t-2 border-emerald-100 px-3 py-3 bg-emerald-50/30">
                      <div className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest mb-3 flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                          Entradas ({getClientFields(node).length})
                        </div>
                        <button
                          className="text-[9px] font-semibold text-emerald-600 bg-emerald-100 hover:bg-emerald-200 px-2 py-0.5 rounded-full transition-colors"
                          onClick={(e) => { e.stopPropagation(); setShowFieldSelector(showFieldSelector === node.id ? null : node.id); }}
                        >
                          {showFieldSelector === node.id ? '✓ Fechar' : '+ Campos'}
                        </button>
                      </div>

                      {/* Field selector dropdown */}
                      {showFieldSelector === node.id && (
                        <div className="mb-3 p-2 bg-white rounded-lg border border-emerald-200 shadow-lg max-h-48 overflow-y-auto">
                          <div className="text-[9px] text-gray-400 uppercase font-bold mb-1.5">Selecione os campos</div>
                          <div className="grid grid-cols-2 gap-1">
                            {ALL_CLIENT_FIELDS.map(f => {
                              const isActive = (node.config?.activeClientFields || DEFAULT_CLIENT_FIELDS).includes(f.key);
                              return (
                                <button
                                  key={f.key}
                                  onClick={(e) => { e.stopPropagation(); toggleClientField(node, f.key); }}
                                  className={`text-[10px] px-2 py-1 rounded-md text-left truncate transition-all ${
                                    isActive
                                      ? 'bg-emerald-100 text-emerald-700 font-medium border border-emerald-300'
                                      : 'bg-gray-50 text-gray-500 hover:bg-gray-100 border border-transparent'
                                  }`}
                                >
                                  {isActive ? '✓ ' : ''}{f.label}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      <div className="space-y-1">
                        {getClientFields(node).map(({ key, label }) => (
                          <div key={key} className="flex items-center relative group/field" style={{ height: FIELD_ROW_HEIGHT }}>
                            <div
                              className="absolute -left-[26px] w-7 h-7 rounded-full bg-white border-[2.5px] border-emerald-400 cursor-pointer hover:scale-[1.3] hover:border-emerald-600 hover:shadow-lg transition-all z-30 flex items-center justify-center shadow-md"
                              onMouseUp={e => handlePortMouseUp(e, node.id, label)}
                              title={`Receber: ${label}`}
                            >
                              <div className="w-3 h-3 rounded-full bg-emerald-400 group-hover/field:bg-emerald-600 transition-colors" />
                            </div>
                            <div className="flex items-center gap-2 px-2.5 py-1.5 bg-white rounded-lg border border-emerald-100 flex-1 min-w-0 shadow-sm hover:border-emerald-300 hover:shadow transition-all">
                              <div className="w-2.5 h-2.5 rounded-full flex-shrink-0 bg-emerald-400" />
                              <span className="text-[11px] font-mono font-medium text-gray-700">{label}</span>
                              <span className="text-[9px] text-gray-400 ml-auto">{key}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Send email input fields */}
                  {node.type === 'send_email' && (
                    <div className="border-t-2 border-red-100 px-3 py-3 bg-red-50/30">
                      <div className="text-[10px] font-bold text-red-500 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                        <div className="w-1.5 h-1.5 rounded-full bg-red-500" />
                        Entradas ({getEmailInputFields(node).length})
                      </div>
                      <div className="space-y-1">
                        {getEmailInputFields(node).map(({ key, label }) => (
                          <div key={key} className="flex items-center relative group/field" style={{ height: FIELD_ROW_HEIGHT }}>
                            <div
                              className="absolute -left-[26px] w-7 h-7 rounded-full bg-white border-[2.5px] border-red-400 cursor-pointer hover:scale-[1.3] hover:border-red-600 hover:shadow-lg transition-all z-30 flex items-center justify-center shadow-md"
                              onMouseUp={e => handlePortMouseUp(e, node.id, label)}
                              title={`Receber: ${label}`}
                            >
                              <div className="w-3 h-3 rounded-full bg-red-400 group-hover/field:bg-red-600 transition-colors" />
                            </div>
                            <div className="flex items-center gap-2 px-2.5 py-1.5 bg-white rounded-lg border border-red-100 flex-1 min-w-0 shadow-sm hover:border-red-300 hover:shadow transition-all">
                              <div className="w-2.5 h-2.5 rounded-full flex-shrink-0 bg-red-400" />
                              <span className="text-[11px] font-mono font-medium text-gray-700">{label}</span>
                              <span className="text-[9px] text-gray-400 ml-auto">{key}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* RIGHT port (output) - main, only when no field ports */}
                  {!(node.type === 'webhook' && getWebhookFields(node).length > 0) && !(node.type === 'new_client' && getNewClientOutputFields(node).length > 0) && node.type !== 'create_client' && node.type !== 'send_email' && (
                    <div
                      className="absolute -right-3 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-white border-[2.5px] cursor-crosshair hover:scale-125 transition-transform z-30 flex items-center justify-center shadow-md"
                      style={{ borderColor: color }}
                      onMouseDown={e => handlePortMouseDown(e, node.id)}
                      title="Arraste para conectar"
                    >
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
                    </div>
                  )}

                  {/* Also show main output for create_client and send_email */}
                  {(node.type === 'create_client' || node.type === 'send_email') && (
                    <div
                      className="absolute -right-3 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-white border-[2.5px] cursor-crosshair hover:scale-125 transition-transform z-30 flex items-center justify-center shadow-md"
                      style={{ borderColor: color }}
                      onMouseDown={e => handlePortMouseDown(e, node.id)}
                      title="Arraste para conectar"
                    >
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
                    </div>
                  )}

                  {/* LEFT port (input) - only for non-create_client and non-send_email (they have field inputs) */}
                  {node.type !== 'create_client' && node.type !== 'send_email' && (
                    <div
                      className="absolute -left-3 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-white border-[2.5px] cursor-pointer hover:scale-125 transition-transform z-30 flex items-center justify-center shadow-md"
                      style={{ borderColor: color }}
                      onMouseUp={e => handlePortMouseUp(e, node.id)}
                      title="Solte aqui para conectar"
                    >
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {/* Empty state */}
          {nodes.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="text-center">
                <div className="w-20 h-20 rounded-3xl bg-gray-100 flex items-center justify-center mx-auto mb-4">
                  <Icons.Workflow className="h-10 w-10 text-gray-300" />
                </div>
                <p className="text-sm font-semibold text-gray-400">Arraste blocos para criar sua automação</p>
                <p className="text-xs text-gray-300 mt-1">Use Ctrl+Scroll para zoom • Clique e arraste para mover</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <div
          className="absolute z-[100] bg-card border border-border rounded-xl shadow-2xl py-1.5 min-w-[200px] animate-in fade-in zoom-in-95 duration-100"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onClick={e => e.stopPropagation()}
        >
          <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/50">
            Adicionar bloco
          </div>
          {[
            { key: 'trigger', label: 'Gatilhos', Icon: Zap },
            { key: 'action', label: 'Ações', Icon: Play },
            { key: 'condition', label: 'Condições', Icon: GitBranch },
            { key: 'transform', label: 'Transformação', Icon: RefreshCw },
          ].map(cat => {
            const catBlocks = AUTOMATION_BLOCKS.filter(b => b.category === cat.key);
            return (
              <div key={cat.key}>
                <div className="px-3 py-1 flex items-center gap-1.5 text-[10px] font-medium text-muted-foreground/70 mt-1">
                  <cat.Icon className="h-3 w-3" />
                  {cat.label}
                </div>
                {catBlocks.map(block => {
                  const BlockIcon = (Icons as any)[block.icon];
                  return (
                    <button
                      key={block.type}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-foreground/80 hover:bg-muted/60 hover:text-foreground transition-colors"
                      onClick={() => {
                        const newNode: AutomationNode = {
                          id: `node-${Date.now()}`,
                          type: block.type,
                          label: block.label,
                          position: { x: contextMenu.canvasX, y: contextMenu.canvasY },
                          data: {},
                          config: { ...block.defaultConfig },
                        };
                        onNodesChange([...nodes, newNode]);
                        onNodeSelect(newNode);
                        setContextMenu(null);
                      }}
                    >
                      <div
                        className="w-5 h-5 rounded-md flex items-center justify-center text-white flex-shrink-0"
                        style={{ backgroundColor: block.color }}
                      >
                        {BlockIcon && <BlockIcon className="h-3 w-3" />}
                      </div>
                      {block.label}
                    </button>
                  );
                })}
              </div>
            );
          })}
          <div className="border-t border-border/40 mt-1.5 pt-1">
            <button
              className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-muted-foreground hover:bg-muted/60 hover:text-foreground transition-colors"
              onClick={() => { setZoom(1); setContextMenu(null); }}
            >
              <Maximize className="h-4 w-4" />
              Resetar zoom
            </button>
            <button
              className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-muted-foreground hover:bg-muted/60 hover:text-foreground transition-colors"
              onClick={() => { onNodeSelect(null); setContextMenu(null); }}
            >
              <MousePointer className="h-4 w-4" />
              Deselecionar tudo
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
