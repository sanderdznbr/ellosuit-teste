import type { ChartStyle } from './types';

export interface FunnelStageView {
  id: string;
  title: string;
  color: string;
}

interface FunnelChartProps {
  stages: FunnelStageView[];
  /** Leads por etapa (mesma ordem de stages). */
  counts: number[];
  /** Leads frios (7d+ sem atividade) por etapa. */
  frios?: number[];
  /** Largura relativa por etapa (0–100), padrão 100. */
  weights?: number[];
  showNumbers?: boolean;
  selectedStageId?: string | null;
  onSelectStage?: (id: string) => void;
  /** Desenho reduzido, sem legenda (usado na prévia de criação). */
  compact?: boolean;
  /** Forma do desenho. Padrão: cone. */
  variant?: ChartStyle;
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const pct = (v: number) => `${(v * 100).toFixed(1).replace('.', ',')}%`;
const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

/** Largura mínima de uma etapa — garante que a contagem sempre caiba. */
const MIN_REL = 0.18;

interface Derived {
  n: number;
  total: number;
  weightOf: (i: number) => number;
  relOf: (i: number) => number;
  shareOf: (i: number) => number;
  conversionOf: (i: number) => number | null;
  dimmed: (id: string, index: number) => boolean;
}

function derive(
  stages: FunnelStageView[],
  counts: number[],
  weights: number[] | undefined,
  selectedStageId: string | null | undefined,
): Derived {
  const n = stages.length;
  const total = counts.reduce((a, b) => a + b, 0);
  const weightOf = (i: number) => Math.max(6, weights?.[i] ?? 100);
  return {
    n,
    total,
    weightOf,
    relOf: (i: number) => clamp(weightOf(i) / 100, MIN_REL, 1),
    shareOf: (i: number) => (total ? (counts[i] ?? 0) / total : 0),
    conversionOf: (i: number) => {
      if (i === 0) return null;
      const prev = counts[i - 1] ?? 0;
      return prev > 0 ? (counts[i] ?? 0) / prev : null;
    },
    dimmed: (id, index) =>
      !!selectedStageId && selectedStageId !== stages[index].id && selectedStageId !== id,
  };
}

/* ─── Legenda: nomes SEMPRE completos, nunca truncados ─────────── */

function FunnelLegend({
  stages,
  counts,
  frios = [],
  derived,
  showNumbers,
  selectedStageId,
  onSelectStage,
}: {
  stages: FunnelStageView[];
  counts: number[];
  frios?: number[];
  derived: Derived;
  showNumbers: boolean;
  selectedStageId?: string | null;
  onSelectStage?: (id: string) => void;
}) {
  return (
    <ul className="mt-5 flex flex-wrap justify-center gap-2">
      {stages.map((stage, i) => {
        const conv = derived.conversionOf(i);
        const selected = selectedStageId === stage.id;
        const dimmed = derived.dimmed(stage.id, i);
        return (
          <li key={stage.id}>
            <button
              type="button"
              onClick={() => onSelectStage?.(stage.id)}
              className={`flex max-w-full items-center gap-2 rounded-full border px-3 py-1.5 text-left text-xs transition-all ${
                selected
                  ? 'border-primary/60 bg-primary/5'
                  : 'border-border/70 bg-card hover:border-primary/40'
              } ${dimmed ? 'opacity-45' : ''}`}
            >
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: stage.color }}
              />
              <span className="font-semibold text-foreground">{stage.title}</span>
              {showNumbers && (
                <span className="font-bold tabular-nums text-foreground">{counts[i] ?? 0}</span>
              )}
              {showNumbers && derived.total > 0 && (
                <span className="tabular-nums text-muted-foreground">
                  {pct(derived.shareOf(i))}
                </span>
              )}
              {showNumbers && conv !== null && (
                <span className="tabular-nums text-muted-foreground">↓ {pct(conv)}</span>
              )}
              {(frios[i] ?? 0) > 0 && (
                <span className="tabular-nums text-amber-600">{frios[i]} frios</span>
              )}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

/* ─── Formas desenhadas em SVG (contagem dentro, nomes na legenda) ── */

function useConeGeometry(derived: Derived, compact: boolean) {
  const n = derived.n;
  const W = 1000;
  const PAD_X = 16;
  const maxFull = compact ? 150 : 300;
  const minFull = Math.round(maxFull * 0.42);
  const H = maxFull;
  const cy = maxFull / 2;
  const segW = (W - PAD_X * 2) / n;
  const gap = Math.min(10, segW * 0.07);

  const bounds: number[] = [];
  for (let i = 0; i < n; i++) bounds.push(lerp(maxFull, minFull, i / n) * derived.relOf(i));
  bounds.push(lerp(maxFull, minFull, 1) * derived.relOf(n - 1) * 0.6);

  const halfAt = (x: number) => {
    const raw = (x - PAD_X) / segW;
    const i = clamp(Math.floor(raw), 0, n - 1);
    const t = clamp(raw - i, 0, 1);
    return lerp(bounds[i], bounds[i + 1], t) / 2;
  };

  return { W, H, cy, segW, gap, halfAt, PAD_X };
}

function ConeShape({
  stages,
  counts,
  derived,
  showNumbers,
  selectedStageId,
  onSelectStage,
  compact,
}: {
  stages: FunnelStageView[];
  counts: number[];
  derived: Derived;
  showNumbers: boolean;
  selectedStageId?: string | null;
  onSelectStage?: (id: string) => void;
  compact: boolean;
}) {
  const { W, H, cy, segW, gap, halfAt, PAD_X } = useConeGeometry(derived, compact);

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="h-auto w-full"
      role="img"
      aria-label="Desenho do funil de vendas"
    >
      {stages.map((stage, i) => {
        const xl = PAD_X + i * segW + (i > 0 ? gap / 2 : 0);
        const xr = PAD_X + (i + 1) * segW - (i < derived.n - 1 ? gap / 2 : 0);
        const hl = halfAt(xl);
        const hr = halfAt(xr);
        const cx = (xl + xr) / 2;
        const count = counts[i] ?? 0;
        const selected = selectedStageId === stage.id;
        const fontSize = compact ? 20 : clamp(Math.min(hl, hr) * 1.05, 13, 34);

        return (
          <g
            key={stage.id}
            opacity={derived.dimmed(stage.id, i) ? 0.45 : 1}
            onClick={() => onSelectStage?.(stage.id)}
            className={onSelectStage ? 'cursor-pointer transition-opacity' : 'transition-opacity'}
          >
            <polygon
              points={`${xl},${cy - hl} ${xr},${cy - hr} ${xr},${cy + hr} ${xl},${cy + hl}`}
              fill={stage.color}
              stroke={selected ? 'rgba(15,23,42,0.9)' : 'rgba(255,255,255,0.9)'}
              strokeWidth={selected ? 3 : 2}
              strokeLinejoin="round"
            />
            {showNumbers && (
              <text
                x={cx}
                y={cy + fontSize * 0.35}
                textAnchor="middle"
                className="fill-white font-bold tabular-nums"
                style={{ fontSize }}
              >
                {count}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

function SteppedShape({
  stages,
  counts,
  derived,
  showNumbers,
  selectedStageId,
  onSelectStage,
}: {
  stages: FunnelStageView[];
  counts: number[];
  derived: Derived;
  showNumbers: boolean;
  selectedStageId?: string | null;
  onSelectStage?: (id: string) => void;
}) {
  const W = 1000;
  const H = 320;
  const cx = W / 2;
  const stepH = H / derived.n;
  const maxHalf = W * 0.44;

  const halfAtEdge = (edge: number) => {
    const i = clamp(edge, 0, derived.n - 1);
    const rel = edge >= derived.n ? derived.relOf(derived.n - 1) * 0.6 : derived.relOf(i);
    return (maxHalf * 2 * rel) / 2;
  };

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="h-auto w-full"
      role="img"
      aria-label="Desenho do funil de vendas em degraus"
    >
      {stages.map((stage, i) => {
        const y0 = i * stepH;
        const y1 = (i + 1) * stepH;
        const hTop = halfAtEdge(i);
        const hBot = halfAtEdge(i + 1);
        const gapY = 4;
        const count = counts[i] ?? 0;
        const selected = selectedStageId === stage.id;

        return (
          <g
            key={stage.id}
            opacity={derived.dimmed(stage.id, i) ? 0.45 : 1}
            onClick={() => onSelectStage?.(stage.id)}
            className={onSelectStage ? 'cursor-pointer transition-opacity' : 'transition-opacity'}
          >
            <polygon
              points={`${cx - hTop},${y0 + gapY / 2} ${cx + hTop},${y0 + gapY / 2} ${cx + hBot},${y1 - gapY / 2} ${cx - hBot},${y1 - gapY / 2}`}
              fill={stage.color}
              stroke={selected ? 'rgba(15,23,42,0.9)' : 'rgba(255,255,255,0.9)'}
              strokeWidth={selected ? 3 : 1.5}
              strokeLinejoin="round"
            />
            {showNumbers && (
              <text
                x={cx}
                y={(y0 + y1) / 2 + 8}
                textAnchor="middle"
                className="fill-white font-bold tabular-nums"
                style={{ fontSize: clamp(Math.min(hTop, hBot) * 0.5, 12, 26) }}
              >
                {count}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

function ChevronShape({
  stages,
  counts,
  derived,
  showNumbers,
  selectedStageId,
  onSelectStage,
}: {
  stages: FunnelStageView[];
  counts: number[];
  derived: Derived;
  showNumbers: boolean;
  selectedStageId?: string | null;
  onSelectStage?: (id: string) => void;
}) {
  const W = 1000;
  const H = 320;
  const cx = W / 2;
  const bandH = H / derived.n;
  const maxHalf = W * 0.44;

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="h-auto w-full"
      role="img"
      aria-label="Desenho do funil de vendas em setas"
    >
      {stages.map((stage, i) => {
        const y0 = i * bandH;
        const y1 = (i + 1) * bandH;
        const hw = maxHalf * derived.relOf(i);
        const point = Math.min(bandH * 0.4, hw * 0.55);
        const gapY = bandH * 0.12;
        const count = counts[i] ?? 0;
        const selected = selectedStageId === stage.id;

        return (
          <g
            key={stage.id}
            opacity={derived.dimmed(stage.id, i) ? 0.45 : 1}
            onClick={() => onSelectStage?.(stage.id)}
            className={onSelectStage ? 'cursor-pointer transition-opacity' : 'transition-opacity'}
          >
            <polygon
              points={`${cx - hw},${y0 + gapY / 2} ${cx + hw},${y0 + gapY / 2} ${cx + hw},${y1 - point} ${cx},${y1 - gapY / 2} ${cx - hw},${y1 - point}`}
              fill={stage.color}
              stroke={selected ? 'rgba(15,23,42,0.9)' : 'rgba(255,255,255,0.9)'}
              strokeWidth={selected ? 3 : 1.5}
              strokeLinejoin="round"
            />
            {showNumbers && (
              <text
                x={cx}
                y={y0 + (bandH - point) / 2 + 10}
                textAnchor="middle"
                className="fill-white font-bold tabular-nums"
                style={{ fontSize: clamp(hw * 0.26, 13, 28) }}
              >
                {count}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

/* ─── Formas textuais (nome completo sempre visível, sem legenda) ── */

function BarsShape({
  stages,
  counts,
  frios = [],
  derived,
  showNumbers,
  selectedStageId,
  onSelectStage,
}: {
  stages: FunnelStageView[];
  counts: number[];
  frios?: number[];
  derived: Derived;
  showNumbers: boolean;
  selectedStageId?: string | null;
  onSelectStage?: (id: string) => void;
}) {
  return (
    <ul className="space-y-2">
      {stages.map((stage, i) => {
        const selected = selectedStageId === stage.id;
        const conv = derived.conversionOf(i);
        return (
          <li key={stage.id}>
            <button
              type="button"
              onClick={() => onSelectStage?.(stage.id)}
              className={`w-full rounded-xl border bg-card p-3 text-left transition-all hover:border-primary/40 ${
                selected ? 'border-primary/60 ring-1 ring-primary/30' : 'border-border/70'
              } ${derived.dimmed(stage.id, i) ? 'opacity-45' : ''}`}
            >
              <div className="flex items-baseline justify-between gap-3">
                <span className="flex min-w-0 items-center gap-2">
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: stage.color }}
                  />
                  <span className="text-sm font-semibold text-foreground">{stage.title}</span>
                </span>
                {showNumbers && (
                  <span className="shrink-0 text-sm font-bold tabular-nums text-foreground">
                    {counts[i] ?? 0}
                  </span>
                )}
              </div>
              <div className="mt-2 flex items-center gap-2">
                <span className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                  <span
                    className="block h-full rounded-full"
                    style={{
                      width: `${derived.relOf(i) * 100}%`,
                      backgroundColor: stage.color,
                    }}
                  />
                </span>
                {showNumbers && derived.total > 0 && (
                  <span className="w-12 shrink-0 text-right text-[11px] tabular-nums text-muted-foreground">
                    {pct(derived.shareOf(i))}
                  </span>
                )}
                {showNumbers && conv !== null && (
                  <span className="w-16 shrink-0 text-right text-[11px] tabular-nums text-muted-foreground">
                    ↓ {pct(conv)}
                  </span>
                )}
                {(frios[i] ?? 0) > 0 && (
                  <span className="shrink-0 text-[11px] tabular-nums text-amber-600">
                    {frios[i]} frios
                  </span>
                )}
              </div>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function CardsShape({
  stages,
  counts,
  frios = [],
  derived,
  showNumbers,
  selectedStageId,
  onSelectStage,
}: {
  stages: FunnelStageView[];
  counts: number[];
  frios?: number[];
  derived: Derived;
  showNumbers: boolean;
  selectedStageId?: string | null;
  onSelectStage?: (id: string) => void;
}) {
  return (
    <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {stages.map((stage, i) => {
        const selected = selectedStageId === stage.id;
        const conv = derived.conversionOf(i);
        return (
          <li key={stage.id}>
            <button
              type="button"
              onClick={() => onSelectStage?.(stage.id)}
              className={`h-full w-full rounded-2xl border bg-card p-4 text-left transition-all hover:border-primary/40 ${
                selected ? 'border-primary/60 ring-1 ring-primary/30' : 'border-border/70'
              } ${derived.dimmed(stage.id, i) ? 'opacity-45' : ''}`}
            >
              <div className="flex items-center gap-2">
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: stage.color }}
                />
                <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                  Etapa {i + 1}
                </span>
              </div>
              <p className="mt-1.5 text-sm font-semibold text-foreground">{stage.title}</p>
              {showNumbers && (
                <>
                  <div className="mt-3 flex items-baseline gap-1.5">
                    <span className="text-2xl font-bold tabular-nums text-foreground">
                      {counts[i] ?? 0}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {(counts[i] ?? 0) === 1 ? 'lead' : 'leads'}
                    </span>
                  </div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                    <span
                      className="block h-full rounded-full"
                      style={{
                        width: `${derived.total ? derived.shareOf(i) * 100 : 0}%`,
                        backgroundColor: stage.color,
                      }}
                    />
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] tabular-nums text-muted-foreground">
                    <span>{pct(derived.shareOf(i))} do funil</span>
                    {conv !== null && <span>conv {pct(conv)}</span>}
                    {(frios[i] ?? 0) > 0 && (
                      <span className="text-amber-600">{frios[i]} frios</span>
                    )}
                  </div>
                </>
              )}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

/**
 * Desenho do funil. Cinco formas escolhíveis pelo usuário:
 *
 * - `cone` / `steps` / `chevrons`: desenhos SVG com a contagem dentro de cada
 *   etapa e o nome COMPLETO na legenda logo abaixo (nunca truncado).
 * - `bars` / `cards`: layouts textuais onde o nome já aparece por extenso.
 *
 * O formato de cada etapa é controlado pelo peso (stageConfig.weight).
 */
export function FunnelChart({
  stages,
  counts = [],
  frios = [],
  weights,
  showNumbers = true,
  selectedStageId,
  onSelectStage,
  compact = false,
  variant = 'cone',
}: FunnelChartProps) {
  if (stages.length === 0) {
    return (
      <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
        Adicione etapas no kanban para desenhar o funil.
      </div>
    );
  }

  const derived = derive(stages, counts, weights, selectedStageId);

  // A prévia de criação é sempre um desenho enxuto, sem legenda.
  if (compact) {
    return (
      <div className="w-full overflow-x-auto">
        <div className="min-w-full" style={{ minWidth: derived.n * 68 }}>
          <ConeShape
            stages={stages}
            counts={counts}
            derived={derived}
            showNumbers={showNumbers}
            selectedStageId={selectedStageId}
            onSelectStage={onSelectStage}
            compact
          />
        </div>
      </div>
    );
  }

  const textual = variant === 'bars' || variant === 'cards';

  return (
    <div className="w-full">
      {variant === 'bars' ? (
        <BarsShape
          stages={stages}
          counts={counts}
          frios={frios}
          derived={derived}
          showNumbers={showNumbers}
          selectedStageId={selectedStageId}
          onSelectStage={onSelectStage}
        />
      ) : variant === 'cards' ? (
        <CardsShape
          stages={stages}
          counts={counts}
          frios={frios}
          derived={derived}
          showNumbers={showNumbers}
          selectedStageId={selectedStageId}
          onSelectStage={onSelectStage}
        />
      ) : (
        <div className="w-full overflow-x-auto">
          <div className="min-w-full" style={{ minWidth: derived.n * 68 }}>
            {variant === 'steps' ? (
              <SteppedShape
                stages={stages}
                counts={counts}
                derived={derived}
                showNumbers={showNumbers}
                selectedStageId={selectedStageId}
                onSelectStage={onSelectStage}
              />
            ) : variant === 'chevrons' ? (
              <ChevronShape
                stages={stages}
                counts={counts}
                derived={derived}
                showNumbers={showNumbers}
                selectedStageId={selectedStageId}
                onSelectStage={onSelectStage}
              />
            ) : (
              <ConeShape
                stages={stages}
                counts={counts}
                derived={derived}
                showNumbers={showNumbers}
                selectedStageId={selectedStageId}
                onSelectStage={onSelectStage}
                compact={false}
              />
            )}
          </div>
        </div>
      )}

      {!textual && (
        <FunnelLegend
          stages={stages}
          counts={counts}
          frios={frios}
          derived={derived}
          showNumbers={showNumbers}
          selectedStageId={selectedStageId}
          onSelectStage={onSelectStage}
        />
      )}
    </div>
  );
}

export default FunnelChart;
