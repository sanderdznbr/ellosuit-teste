import { useRef, useState } from 'react';
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { Building2, Flame, Plus, Settings2, Snowflake, Thermometer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { PipelineColumn } from './types';

export const TEMP_COLORS: Record<string, string> = {
  quente: '#EF4444',
  negociando: '#8B5CF6',
  morno: '#F59E0B',
  frio: '#60A5FA',
  pagou: '#10B981',
  perdido: '#6B7280',
};

export interface DealCardData {
  id: string;
  stageId: string;
  title: string;
  company?: string;
  value?: number;
  temperature: string | null;
  /** Responsável pela negociação. */
  owner?: string;
  notes?: string;
  preview?: string;
  lastAt?: string | null;
  unread?: number;
  isFrio: boolean;
}

interface FunnelKanbanProps {
  columns: PipelineColumn[];
  cards: DealCardData[];
  showUnmapped?: boolean;
  unmappedCount?: number;
  /** Coluna tracejada de configuração no fim do board (padrão: CRM). */
  showConfigColumn?: boolean;
  configHint?: string;
  /** Ordenação dos cards dentro de cada coluna. */
  sort?: 'atividade' | 'valor' | 'empresa';
  onMove: (cardId: string, toStage: string) => void;
  onOpen: (cardId: string) => void;
  onAdd: (stageId: string) => void;
  onConfigure: () => void;
}

export const formatBRL = (v?: number) =>
  v && v > 0
    ? new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL',
        maximumFractionDigits: 0,
      }).format(v)
    : null;

export function relativeTime(iso?: string | null) {
  if (!iso) return '—';
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'agora';
  if (min < 60) return `${min}min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  return `${d}d`;
}

function TempChip({ temp }: { temp: string | null }) {
  if (!temp) return null;
  const color = TEMP_COLORS[temp] || '#6B7280';
  const Icon = temp === 'quente' || temp === 'pagou' ? Flame : temp === 'frio' ? Snowflake : Thermometer;
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium"
      style={{ backgroundColor: `${color}1f`, color }}
    >
      <Icon className="h-2.5 w-2.5" />
      {temp}
    </span>
  );
}

function DealCard({
  card,
  dragging,
  onClick,
}: {
  card: DealCardData;
  dragging?: boolean;
  onClick?: () => void;
}) {
  const brl = formatBRL(card.value);
  return (
    <div
      onClick={onClick}
      className={`rounded-xl border bg-background p-2.5 shadow-sm cursor-grab active:cursor-grabbing transition-shadow hover:shadow-md ${
        dragging ? 'opacity-40' : ''
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="text-[13px] font-semibold leading-tight line-clamp-2">{card.title}</span>
        {brl && (
          <span className="shrink-0 rounded-md bg-emerald-500/10 px-1.5 py-0.5 text-[11px] font-bold text-emerald-600 tabular-nums">
            {brl}
          </span>
        )}
      </div>

      {card.company && (
        <p className="mt-0.5 flex items-center gap-1 text-[11px] text-muted-foreground truncate">
          <Building2 className="h-3 w-3 shrink-0" />
          {card.company}
        </p>
      )}

      <div className="mt-1.5 flex flex-wrap items-center gap-1">
        <TempChip temp={card.temperature} />
        {card.isFrio && card.temperature !== 'frio' && (
          <span className="rounded-full bg-sky-500/10 px-1.5 py-0.5 text-[10px] text-sky-500">
            7d+ parado
          </span>
        )}
        {(card.unread || 0) > 0 && (
          <span className="rounded-full bg-primary/15 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
            {card.unread} nova(s)
          </span>
        )}
      </div>

      {(card.notes || card.preview) && (
        <p className="mt-1.5 line-clamp-2 text-[11px] leading-snug text-muted-foreground italic">
          {card.notes || card.preview}
        </p>
      )}

      <div className="mt-1.5 flex items-center justify-between gap-2">
        <span className="text-[10px] text-muted-foreground/70">
          atividade {relativeTime(card.lastAt)}
        </span>
        {card.owner && (
          <span
            title={`Responsável: ${card.owner}`}
            className="h-5 w-5 shrink-0 rounded-full bg-primary/15 text-[9px] font-bold text-primary flex items-center justify-center"
          >
            {card.owner.trim().slice(0, 2).toUpperCase()}
          </span>
        )}
      </div>
    </div>
  );
}

/** Quadro kanban comercial do funil (não é o kanban de conversas do CRM). */
export function FunnelKanban({
  columns,
  cards,
  showUnmapped = false,
  unmappedCount = 0,
  showConfigColumn = true,
  configHint = 'Etapas compartilhadas com o CRM',
  sort = 'atividade',
  onMove,
  onOpen,
  onAdd,
  onConfigure,
}: FunnelKanbanProps) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const clickGuard = useRef(false);

  const handleOpen = (id: string) => {
    if (clickGuard.current) return; // ignora clique logo após um drag
    onOpen(id);
  };

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 6 } }),
  );

  const allColumns: PipelineColumn[] = showUnmapped
    ? [...columns, { id: '__none__', title: 'Sem etapa', color: '#94A3B8' }]
    : columns;

  const byStage = (stageId: string) => {
    const list = cards.filter((c) => c.stageId === stageId);
    if (sort === 'valor') {
      return [...list].sort((a, b) => (b.value || 0) - (a.value || 0));
    }
    if (sort === 'empresa') {
      return [...list].sort((a, b) => (a.company || '').localeCompare(b.company || ''));
    }
    return [...list].sort((a, b) => (b.lastAt || '').localeCompare(a.lastAt || ''));
  };

  const sumValues = (stageId: string) =>
    byStage(stageId).reduce((sum, c) => sum + (c.value || 0), 0);

  const activeCard = activeId ? cards.find((c) => c.id === activeId) : null;

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveId(null);
    clickGuard.current = true;
    setTimeout(() => {
      clickGuard.current = false;
    }, 250);
    const { active, over } = event;
    if (!over) return;
    const toStage = String(over.id);
    const card = cards.find((c) => c.id === active.id);
    if (!card || card.stageId === toStage) return;
    onMove(card.id, toStage);
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={(e: DragStartEvent) => setActiveId(String(e.active.id))}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setActiveId(null)}
    >
      <div className="flex gap-3 overflow-x-auto overflow-y-hidden px-4 sm:px-6 py-4">
        {allColumns.map((col) => (
          <KanbanColumn
            key={col.id}
            column={col}
            items={byStage(col.id)}
            sum={sumValues(col.id)}
            onAdd={onAdd}
            activeId={activeId}
            onOpen={handleOpen}
          />
        ))}

        {/* coluna de configuração */}
        {showConfigColumn && (
          <div className="flex w-[190px] shrink-0 flex-col items-center justify-center rounded-2xl border border-dashed p-4 text-center">
            <Settings2 className="mb-2 h-5 w-5 text-muted-foreground" />
            <p className="text-xs text-muted-foreground">
              {configHint}
              {showUnmapped && unmappedCount > 0 && (
                <>
                  <br />
                  <b>{unmappedCount}</b> lead(s) sem etapa
                </>
              )}
            </p>
            <Button variant="outline" size="sm" className="mt-3" onClick={onConfigure}>
              Configurar etapas
            </Button>
          </div>
        )}
      </div>

      <DragOverlay>{activeCard ? <DealCard card={activeCard} dragging /> : null}</DragOverlay>
    </DndContext>
  );
}

function DraggableCard({ card, onOpen }: { card: DealCardData; onOpen: (id: string) => void }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: card.id,
  });
  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
    : undefined;
  return (
    <div
      ref={setNodeRef}
      style={style}
      className={isDragging ? 'opacity-30' : undefined}
      {...listeners}
      {...attributes}
    >
      <DealCard card={card} onClick={() => onOpen(card.id)} />
    </div>
  );
}

function KanbanColumn({
  column,
  items,
  sum,
  onAdd,
  activeId,
  onOpen,
}: {
  column: PipelineColumn;
  items: DealCardData[];
  sum: number;
  onAdd: (stageId: string) => void;
  activeId: string | null;
  onOpen: (id: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id });
  return (
    <div className="flex max-h-[72vh] w-[270px] shrink-0 flex-col rounded-2xl border bg-muted/30">
      <div className="flex items-center gap-2 px-3 py-2.5 border-b">
        <span
          className="h-2.5 w-2.5 rounded-full shrink-0"
          style={{ backgroundColor: column.color }}
        />
        <span className="flex-1 truncate text-[13px] font-semibold">{column.title}</span>
        <Badge variant="secondary" className="text-[11px] tabular-nums">
          {items.length}
        </Badge>
        {sum > 0 && (
          <span className="text-[11px] font-semibold tabular-nums text-emerald-600">
            {formatBRL(sum)}
          </span>
        )}
        {column.id !== '__none__' && (
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            title={`Adicionar lead em ${column.title}`}
            onClick={() => onAdd(column.id)}
          >
            <Plus className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
      <div
        ref={setNodeRef}
        className={`flex-1 space-y-2 p-2 min-h-[110px] max-h-[540px] overflow-y-auto rounded-b-2xl transition-colors ${
          isOver ? 'bg-primary/10 ring-2 ring-primary/40' : ''
        }`}
      >
        {items.length === 0 && (
          <div className="rounded-xl border border-dashed p-4 text-center text-[11px] text-muted-foreground">
            Nenhum lead nesta etapa
          </div>
        )}
        {items.map((card) => (
          <div key={card.id} className={activeId === card.id ? 'opacity-30' : undefined}>
            <DraggableCard card={card} onOpen={onOpen} />
          </div>
        ))}
      </div>

      {column.id !== '__none__' && (
        <button
          onClick={() => onAdd(column.id)}
          className="mt-auto m-2 flex items-center gap-1.5 rounded-lg px-2 py-2 text-[11px] font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
        >
          <Plus className="h-3.5 w-3.5" />
          Adicionar contato
        </button>
      )}
    </div>
  );
}

export default FunnelKanban;
