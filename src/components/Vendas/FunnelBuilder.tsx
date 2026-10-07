import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ChevronDown, ChevronUp, GripVertical, Link2, Plus, Trash2, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { STAGE_PALETTE, defaultWeight, uid, type PipelineColumn } from './types';

const MIN_STAGES = 2;
const MAX_STAGES = 12;
/** Largura mínima da linha da etapa na saída do funil (%). */
const MIN_WIDTH = 58;

export interface FunnelBuilderProps {
  /** Etapas na ordem do funil: índice 0 = boca (topo), último = saída. */
  stages: PipelineColumn[];
  onChange: (next: PipelineColumn[]) => void;
  /** Leads por id de etapa (opcional, só exibição). */
  counts?: Record<string, number>;
  minStages?: number;
  maxStages?: number;
  /** Quantidade de automações por id de etapa (exibida como selo no card). */
  automationCounts?: Record<string, number>;
  /** Etapa compartilhada → texto da origem (ex.: "Comercial › Orçamento"). */
  links?: Record<string, string>;
  /** Abre o chat de automação da etapa. Sem isto, o botão não aparece. */
  onAutomate?: (stageId: string) => void;
}

interface RowProps {
  stage: PipelineColumn;
  index: number;
  total: number;
  count?: number;
  canRemove: boolean;
  canInsert: boolean;
  automations: number;
  /** Origem da etapa compartilhada, quando houver. */
  link?: string;
  onRename: (id: string, title: string) => void;
  onColor: (id: string, color: string) => void;
  onRemove: (id: string) => void;
  onInsertAfter: (id: string) => void;
  onAutomate?: (id: string) => void;
}

function SortableStageRow({
  stage,
  index,
  total,
  count,
  canRemove,
  canInsert,
  automations,
  link,
  onRename,
  onColor,
  onRemove,
  onInsertAfter,
  onAutomate,
}: RowProps) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } =
    useSortable({ id: stage.id });

  // Silhueta de funil: reamostra a curva natural (100 → ~45) na faixa
  // 100% → MIN_WIDTH%, para a cunha afinar de forma uniforme até a saída e os
  // controles continuarem utilizáveis (inclusive no celular).
  const natural = defaultWeight(index, total);
  const narrowest = defaultWeight(Math.max(total - 1, 0), Math.max(total, 1));
  const width =
    total <= 1
      ? 100
      : MIN_WIDTH + ((natural - narrowest) / Math.max(1, 100 - narrowest)) * (100 - MIN_WIDTH);

  return (
    <li
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
        zIndex: isDragging ? 20 : undefined,
      }}
      className="flex flex-col justify-center"
    >
      {link && (
        <div className="mb-1 flex items-center justify-center gap-1 text-[10px] text-muted-foreground">
          <Link2 className="h-3 w-3" />
          puxa leads de {link}
        </div>
      )}
      <div
        className="flex w-full items-center gap-1.5 rounded-2xl border bg-card px-2 py-1.5 shadow-sm transition-[box-shadow,border-color] focus-within:border-primary/60"
        style={{ width: `${width}%`, minWidth: '236px' }}
      >
        <button
          type="button"
          ref={setActivatorNodeRef}
          {...listeners}
          {...attributes}
          className="shrink-0 cursor-grab touch-none text-muted-foreground/70 hover:text-foreground active:cursor-grabbing"
          aria-label={`Reordenar etapa ${index + 1}`}
          title="Arraste para posicionar no funil"
        >
          <GripVertical className="h-4 w-4" />
        </button>

        <label
          className="relative h-6 w-6 shrink-0 cursor-pointer overflow-hidden rounded-full border-2 border-background shadow-sm"
          style={{ backgroundColor: stage.color }}
          title="Cor da etapa"
        >
          <input
            type="color"
            value={stage.color}
            onChange={(e) => onColor(stage.id, e.target.value)}
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
            aria-label={`Cor da etapa ${index + 1}`}
          />
        </label>

        <span className="shrink-0 text-[11px] font-bold tabular-nums text-muted-foreground">
          {index + 1}
        </span>

        <Input
          value={stage.title}
          onChange={(e) => onRename(stage.id, e.target.value)}
          className="h-7 min-w-0 flex-1 border-0 bg-transparent px-1 text-sm focus-visible:ring-1 focus-visible:ring-primary/50"
          placeholder="Nome da etapa"
          aria-label={`Nome da etapa ${index + 1}`}
        />

        {count !== undefined && (
          <span className="shrink-0 rounded-full bg-muted px-1.5 py-0.5 text-[11px] font-semibold tabular-nums text-muted-foreground">
            {count}
          </span>
        )}

        <button
          type="button"
          onClick={() => onInsertAfter(stage.id)}
          disabled={!canInsert}
          className="shrink-0 rounded-md p-1 text-muted-foreground/60 transition-opacity hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-30"
          title="Inserir etapa abaixo desta"
          aria-label={`Inserir etapa depois de ${stage.title || index + 1}`}
        >
          <Plus className="h-3.5 w-3.5" />
        </button>

        {onAutomate && (
          <button
            type="button"
            onClick={() => onAutomate(stage.id)}
            className="relative shrink-0 rounded-md p-1 text-muted-foreground/60 transition-colors hover:bg-primary/10 hover:text-primary"
            title="Automatizar esta etapa com IA"
            aria-label={`Automatizar a etapa ${stage.title || index + 1}`}
          >
            <Zap className="h-3.5 w-3.5" />
            {automations > 0 && (
              <span className="absolute -right-1 -top-1 inline-flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-primary px-1 text-[9px] font-bold leading-none text-primary-foreground">
                {automations}
              </span>
            )}
          </button>
        )}

        <button
          type="button"
          onClick={() => onRemove(stage.id)}
          disabled={!canRemove}
          className="shrink-0 rounded-md p-1 text-muted-foreground/60 transition-colors hover:bg-destructive/10 hover:text-destructive disabled:cursor-not-allowed disabled:opacity-30"
          title="Excluir etapa"
          aria-label={`Excluir etapa ${stage.title || index + 1}`}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </li>
  );
}

/**
 * Construtor de funil em drag-and-drop: as etapas são empilhadas da boca
 * (topo, larga) até a saída (base, estreita). Reordenar, inserir, renomear e
 * colorir aqui reordena o funil inteiro — o desenho (FunnelChart) acompanha.
 */
export function FunnelBuilder({
  stages,
  onChange,
  counts = {},
  minStages = MIN_STAGES,
  maxStages = MAX_STAGES,
  automationCounts = {},
  links = {},
  onAutomate,
}: FunnelBuilderProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const canInsert = stages.length < maxStages;
  const canRemove = stages.length > minStages;

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const from = stages.findIndex((s) => s.id === active.id);
    const to = stages.findIndex((s) => s.id === over.id);
    if (from < 0 || to < 0) return;
    onChange(arrayMove(stages, from, to));
  };

  const makeStage = (): PipelineColumn => ({
    id: uid(),
    title: 'Nova etapa',
    color: STAGE_PALETTE[stages.length % STAGE_PALETTE.length],
  });

  const insertAfter = (id: string) => {
    if (!canInsert) return;
    const i = stages.findIndex((s) => s.id === id);
    const at = i < 0 ? stages.length : i + 1;
    const next = [...stages];
    next.splice(at, 0, makeStage());
    onChange(next);
  };

  const rename = (id: string, title: string) =>
    onChange(stages.map((s) => (s.id === id ? { ...s, title } : s)));

  const setColor = (id: string, color: string) =>
    onChange(stages.map((s) => (s.id === id ? { ...s, color } : s)));

  const remove = (id: string) => {
    if (!canRemove) return;
    onChange(stages.filter((s) => s.id !== id));
  };

  return (
    <div className="space-y-3">
      <p className="flex items-center justify-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        <ChevronUp className="h-3.5 w-3.5" />
        Boca do funil
      </p>

      {stages.length === 0 ? (
        <div className="rounded-2xl border border-dashed py-8 text-center text-sm text-muted-foreground">
          Comece pela boca do funil: adicione a primeira etapa.
        </div>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={stages.map((s) => s.id)} strategy={verticalListSortingStrategy}>
            <ul className="space-y-2">
              {stages.map((stage, i) => (
                <SortableStageRow
                  key={stage.id}
                  stage={stage}
                  index={i}
                  total={stages.length}
                  count={counts[stage.id]}
                  canRemove={canRemove}
                  canInsert={canInsert}
                  automations={automationCounts[stage.id] ?? 0}
                  link={links[stage.id]}
                  onRename={rename}
                  onColor={setColor}
                  onRemove={remove}
                  onInsertAfter={insertAfter}
                  onAutomate={onAutomate}
                />
              ))}
            </ul>
          </SortableContext>
        </DndContext>
      )}

      <p className="flex items-center justify-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        <ChevronDown className="h-3.5 w-3.5" />
        Saída do funil
      </p>

      <Button
        variant="outline"
        size="sm"
        className="w-full"
        onClick={() => insertAfter(stages[stages.length - 1]?.id ?? '')}
        disabled={!canInsert}
      >
        <Plus className="h-4 w-4 mr-1.5" />
        {canInsert ? 'Adicionar etapa' : `Máximo de ${maxStages} etapas`}
      </Button>

      {canRemove && (
        <p className="text-center text-[11px] text-muted-foreground/80">
          Arraste pela alça para posicionar · mínimo de {minStages} etapas
        </p>
      )}
    </div>
  );
}

export default FunnelBuilder;
