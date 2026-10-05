import { useState } from 'react';

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
  compact?: boolean;
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const pct = (v: number) => `${(v * 100).toFixed(1).replace('.', ',')}%`;

const truncate = (text: string, maxChars: number) =>
  maxChars <= 1 ? '' : text.length > maxChars ? `${text.slice(0, maxChars - 1)}…` : text;

interface HoverInfo {
  index: number;
  x: number;
  y: number;
}

/**
 * Funil estilo RD Station: cunha de segmentos coloridos com o nome da etapa
 * acima (na cor da etapa), a contagem dentro, marcadores de frios abaixo,
 * tooltip com % do total e conversão, e clique para abrir os leads da etapa.
 * O formato é controlado pelo peso de cada etapa (desenhável).
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
}: FunnelChartProps) {
  const [hover, setHover] = useState<HoverInfo | null>(null);

  if (stages.length === 0) {
    return (
      <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
        Adicione etapas no kanban para desenhar o funil.
      </div>
    );
  }

  const n = stages.length;
  const total = counts.reduce((a, b) => a + b, 0);
  const weightOf = (i: number) => Math.max(6, weights?.[i] ?? 100);

  const conversion = (i: number) => {
    if (i === 0) return null;
    const prev = counts[i - 1] ?? 0;
    if (!prev) return null;
    return (counts[i] ?? 0) / prev;
  };

  /* ─── geometria ──────────────────────────────────────────── */
  const W = 1000;
  const PAD_X = 14;
  const LABEL_AREA = compact ? 0 : 54;
  const DOT_AREA = compact ? 8 : 46;
  const maxFull = compact ? 150 : 300;
  const minFull = Math.round(maxFull * 0.36);
  const cy = LABEL_AREA + maxFull / 2;
  const H = LABEL_AREA + maxFull + DOT_AREA;
  const segW = (W - PAD_X * 2) / n;
  const gap = Math.min(10, segW * 0.07);

  // Altura total da cunha na borda i (i de 0..n)
  const wedgeFull = (i: number) => lerp(maxFull, minFull, i / n);
  const bounds: number[] = [];
  for (let i = 0; i < n; i++) bounds.push(wedgeFull(i) * (weightOf(i) / 100));
  bounds.push(wedgeFull(n) * (weightOf(n - 1) / 100) * 0.62);

  const halfAt = (x: number) => {
    const raw = (x - PAD_X) / segW;
    const i = Math.min(Math.max(Math.floor(raw), 0), n - 1);
    const t = Math.min(Math.max(raw - i, 0), 1);
    return lerp(bounds[i], bounds[i + 1], t) / 2;
  };

  const visible = (i: number) =>
    selectedStageId && selectedStageId !== stages[i].id ? 0.45 : 1;

  const hoverData = hover
    ? (() => {
        const i = hover.index;
        const conv = conversion(i);
        return {
          title: stages[i].title,
          color: stages[i].color,
          count: counts[i] ?? 0,
          share: total ? (counts[i] ?? 0) / total : 0,
          conv,
        };
      })()
    : null;

  const chart = (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full h-auto"
      role="img"
      aria-label="Funil de vendas"
      style={{ minWidth: n * 68 }}
    >
      {stages.map((stage, i) => {
        const xl = PAD_X + i * segW + (i > 0 ? gap / 2 : 0);
        const xr = PAD_X + (i + 1) * segW - (i < n - 1 ? gap / 2 : 0);
        const hl = halfAt(xl);
        const hr = halfAt(xr);
        const cx = (xl + xr) / 2;
        const segWidth = xr - xl;
        const count = counts[i] ?? 0;
        const frio = frios[i] ?? 0;
        const selected = selectedStageId === stage.id;
        const nameY = Math.max(cy - hl - 12, 14);
        const labelChars = Math.floor(segWidth / 8.5);

        return (
          <g
            key={stage.id}
            opacity={visible(i)}
            onClick={() => onSelectStage?.(stage.id)}
            onMouseEnter={() => setHover({ index: i, x: cx, y: cy - hl })}
            onMouseLeave={() => setHover(null)}
            className={onSelectStage ? 'cursor-pointer transition-opacity' : 'transition-opacity'}
          >
            {/* nome da etapa acima, na cor da etapa (estilo RD Station) */}
            {!compact && (
              <text
                x={cx}
                y={nameY}
                textAnchor="middle"
                className="font-semibold"
                style={{ fontSize: 15, fill: stage.color }}
              >
                {truncate(stage.title, labelChars)}
              </text>
            )}

            {/* segmento */}
            <polygon
              points={`${xl},${cy - hl} ${xr},${cy - hr} ${xr},${cy + hr} ${xl},${cy + hl}`}
              fill={stage.color}
              stroke={selected ? 'rgba(15,23,42,0.9)' : 'rgba(255,255,255,0.9)'}
              strokeWidth={selected ? 3 : 2}
              strokeLinejoin="round"
              style={{ filter: hover?.index === i ? 'brightness(1.07)' : undefined }}
            />

            {/* contagem dentro */}
            {showNumbers && (
              <>
                <text
                  x={cx}
                  y={compact ? cy + 6 : cy + 4}
                  textAnchor="middle"
                  className="fill-white font-bold tabular-nums"
                  style={{ fontSize: compact ? 20 : 34 }}
                >
                  {count}
                </text>
                {!compact && (
                  <text
                    x={cx}
                    y={cy + 26}
                    textAnchor="middle"
                    className="fill-white/80"
                    style={{ fontSize: 13 }}
                  >
                    leads
                  </text>
                )}
              </>
            )}

            {/* frios abaixo */}
            {!compact && frio > 0 && (
              <>
                <circle cx={cx} cy={cy + hr + 18} r={6} fill={stage.color} />
                <text
                  x={cx + 11}
                  y={cy + hr + 22}
                  className="fill-current opacity-70 tabular-nums"
                  style={{ fontSize: 12 }}
                >
                  {frio} frios
                </text>
              </>
            )}
          </g>
        );
      })}
    </svg>
  );

  const tooltip = hoverData && (
    <div
      className="pointer-events-none absolute z-20 -translate-x-1/2 -translate-y-full rounded-lg border bg-popover px-3 py-2 shadow-lg"
      style={{
        left: `${(hover!.x / W) * 100}%`,
        top: `${((hover!.y - 8) / H) * 100}%`,
      }}
    >
      <div className="flex items-center gap-2 text-sm font-semibold">
        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: hoverData.color }} />
        {hoverData.title}
      </div>
      <div className="mt-0.5 text-xs text-muted-foreground">
        {hoverData.count} leads · {pct(hoverData.share)} do funil
        {hoverData.conv !== null && <> · conversão {pct(hoverData.conv)}</>}
      </div>
    </div>
  );

  return (
    <div className="relative w-full overflow-x-auto">
      <div className="relative min-w-full" style={{ minWidth: n * 68 }}>
        {chart}
        {tooltip}
      </div>
    </div>
  );
}

export default FunnelChart;
