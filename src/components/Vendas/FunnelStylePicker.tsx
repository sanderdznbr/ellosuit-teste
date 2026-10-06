import { BarChart3, ChevronsDown, LayoutGrid, Rows3, TrendingUp, type LucideIcon } from 'lucide-react';
import { FUNNEL_VARIANTS, type ChartStyle } from './types';

const ICONS: Record<ChartStyle, LucideIcon> = {
  cone: TrendingUp,
  steps: Rows3,
  chevrons: ChevronsDown,
  bars: BarChart3,
  cards: LayoutGrid,
};

/** Seletor da forma do funil. Cada opção muda o desenho inteiro. */
export function FunnelStylePicker({
  value,
  onChange,
  label = 'Forma',
}: {
  value: ChartStyle;
  onChange: (next: ChartStyle) => void;
  label?: string;
}) {
  return (
    <div className="flex flex-wrap items-center justify-center gap-2">
      {label && (
        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          {label}
        </span>
      )}
      <div
        role="radiogroup"
        aria-label="Forma do desenho do funil"
        className="flex flex-wrap justify-center gap-1 rounded-2xl border bg-muted/30 p-1"
      >
        {FUNNEL_VARIANTS.map((variant) => {
          const Icon = ICONS[variant.id];
          const active = variant.id === value;
          return (
            <button
              key={variant.id}
              type="button"
              role="radio"
              aria-checked={active}
              title={variant.hint}
              onClick={() => onChange(variant.id)}
              className={`flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-xs font-medium transition-all ${
                active
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {variant.name}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default FunnelStylePicker;
