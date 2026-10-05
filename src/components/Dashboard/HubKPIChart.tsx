import { useState, useMemo, useCallback } from 'react';
import { AreaChart, Area, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { format, subDays, startOfDay, eachDayOfInterval, eachHourOfInterval, startOfHour } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { MessageSquare, Mail, Calendar, FileText, Users, BarChart3, Eye } from 'lucide-react';
import type { ActivityItem } from '@/hooks/useHubActivity';

type Period = 'today' | '7d' | '15d' | '30d';

interface DailyData {
  date: string;
  count: number;
  items?: ActivityItem[];
}

interface HubKPIChartProps {
  color: string;
  label?: string;
  activityData?: DailyData[];
}

const PERIODS: { key: Period; label: string }[] = [
  { key: 'today', label: 'Hoje' },
  { key: '7d', label: '7 dias' },
  { key: '15d', label: '15 dias' },
  { key: '30d', label: '30 dias' },
];

function getDaysForPeriod(period: Period): number {
  switch (period) {
    case 'today': return 1;
    case '7d': return 7;
    case '15d': return 15;
    case '30d': return 30;
  }
}

interface ChartPoint {
  label: string;
  value: number;
  fullDate: string;
  items: ActivityItem[];
}

const TYPE_ICONS: Record<string, typeof MessageSquare> = {
  whatsapp: MessageSquare,
  email: Mail,
  event: Calendar,
  document: FileText,
  client: Users,
  tracking: Eye,
};

const TYPE_LABELS: Record<string, string> = {
  whatsapp: 'Conversas WhatsApp',
  email: 'E-mails enviados',
  event: 'Eventos na Agenda',
  document: 'Documentos criados',
  client: 'Contatos cadastrados',
  tracking: 'Rastreamentos',
};

const ActiveDot = ({ cx, cy, payload, color, onDotClick }: any) => {
  if (!payload || payload.value === 0) return null;
  return (
    <g>
      <circle cx={cx} cy={cy} r={6} fill={color} fillOpacity={0.2} stroke={color} strokeWidth={2} style={{ cursor: 'pointer' }} onClick={() => onDotClick?.(payload)} />
      <circle cx={cx} cy={cy} r={3} fill={color} style={{ cursor: 'pointer' }} onClick={() => onDotClick?.(payload)} />
    </g>
  );
};

export default function HubKPIChart({ color, label = 'Atividade recente', activityData }: HubKPIChartProps) {
  const [period, setPeriod] = useState<Period>('7d');
  const [selectedPoint, setSelectedPoint] = useState<ChartPoint | null>(null);

  const chartData: ChartPoint[] = useMemo(() => {
    const now = new Date();
    const days = getDaysForPeriod(period);

    if (period === 'today') {
      const start = startOfDay(now);
      const hours = eachHourOfInterval({ start, end: now });
      return hours.map(h => {
        const hourStr = format(h, 'HH:mm');
        const matching = activityData?.filter(d => startOfHour(new Date(d.date)).getTime() === h.getTime()) || [];
        const count = matching.reduce((s, d) => s + d.count, 0);
        const items = matching.flatMap(d => d.items || []);
        return { label: hourStr, value: count, fullDate: format(h, 'yyyy-MM-dd HH:mm'), items };
      });
    }

    const startDate = startOfDay(subDays(now, days - 1));
    const daysList = eachDayOfInterval({ start: startDate, end: now });

    return daysList.map(day => {
      const dayStr = format(day, 'yyyy-MM-dd');
      const shortLabel = format(day, 'dd/MM', { locale: ptBR });
      const matching = activityData?.filter(d => d.date.substring(0, 10) === dayStr) || [];
      const count = matching.reduce((s, d) => s + d.count, 0);
      const items = matching.flatMap(d => d.items || []);
      return { label: shortLabel, value: count, fullDate: dayStr, items };
    });
  }, [period, activityData]);

  const totalPeriod = chartData.reduce((s, d) => s + d.value, 0);
  const hasData = totalPeriod > 0;

  const handleDotClick = useCallback((point: ChartPoint) => {
    // Look up from chartData to ensure items array is preserved (recharts may strip it)
    const found = chartData.find(d => d.fullDate === point.fullDate);
    if (found) {
      setSelectedPoint(prev => prev?.fullDate === found.fullDate ? null : found);
    } else {
      setSelectedPoint(prev => prev?.fullDate === point.fullDate ? null : point);
    }
  }, [chartData]);

  const gradientId = `grad-${label?.replace(/\s/g, '')}`;

  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload?.[0]) return null;
    const data = payload[0].payload as ChartPoint;
    return (
      <div className="rounded-xl border border-border/60 bg-card shadow-lg px-3 py-2 text-xs">
        <p className="font-semibold text-foreground">{data.label}</p>
        <p className="mt-0.5" style={{ color }}>Atividade : <span className="font-bold">{data.value}</span></p>
      </div>
    );
  };

  // Group selected items by type
  const groupedItems = useMemo(() => {
    if (!selectedPoint?.items?.length) return [];
    const map: Record<string, number> = {};
    for (const item of selectedPoint.items) {
      map[item.type] = (map[item.type] || 0) + 1;
    }
    return Object.entries(map).map(([type, count]) => ({ type, count })).sort((a, b) => b.count - a.count);
  }, [selectedPoint]);

  return (
    <div className="rounded-2xl border border-border/60 bg-card p-4 mb-6 relative">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-muted-foreground">{label}</span>
          {hasData && (
            <span className="text-xs font-bold px-1.5 py-0.5 rounded-md" style={{ color, backgroundColor: `${color}14` }}>
              {totalPeriod}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1 bg-muted/50 rounded-lg p-0.5">
          {PERIODS.map(p => (
            <button
              key={p.key}
              onClick={() => { setPeriod(p.key); setSelectedPoint(null); }}
              className="text-[10px] font-medium px-2 py-1 rounded-md transition-all"
              style={{
                backgroundColor: period === p.key ? color : 'transparent',
                color: period === p.key ? 'white' : 'hsl(var(--muted-foreground))',
              }}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div className="h-[120px] w-full">
        {!hasData ? (
          <div className="flex items-center justify-center h-full">
            <span className="text-xs text-muted-foreground">Nenhuma atividade neste período</span>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 8, right: 4, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={color} stopOpacity={0.35} />
                  <stop offset="50%" stopColor={color} stopOpacity={0.12} />
                  <stop offset="100%" stopColor={color} stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <XAxis dataKey="label" tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
              <YAxis hide allowDecimals={false} />
              <Tooltip content={<CustomTooltip />} cursor={{ stroke: color, strokeOpacity: 0.15, strokeWidth: 1 }} />
              <Area
                type="monotone"
                dataKey="value"
                stroke={color}
                strokeWidth={2.5}
                fill={`url(#${gradientId})`}
                dot={(props: any) => {
                  if (!props.payload || props.payload.value === 0) return <g key={`dot-${props.index}`} />;
                  return <circle key={`dot-${props.index}`} cx={props.cx} cy={props.cy} r={2.5} fill={color} fillOpacity={0.5} stroke="none" />;
                }}
                activeDot={(props: any) => <ActiveDot key={`adot-${props.index}`} {...props} color={color} onDotClick={handleDotClick} />}
                animationDuration={800}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Detailed breakdown panel */}
      {selectedPoint && selectedPoint.value > 0 && (
        <div className="mt-3 rounded-xl border p-3 animate-in slide-in-from-top-2 duration-200" style={{ borderColor: `${color}30`, backgroundColor: `${color}06` }}>
          <div className="flex items-center justify-between mb-2.5">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
              <span className="text-xs font-semibold text-foreground">{selectedPoint.label}</span>
              <span className="text-[10px] text-muted-foreground">— {selectedPoint.value} atividade{selectedPoint.value !== 1 ? 's' : ''}</span>
            </div>
            <button onClick={() => setSelectedPoint(null)} className="text-[10px] text-muted-foreground hover:text-foreground transition-colors px-1">✕</button>
          </div>

          {/* Type breakdown */}
          {groupedItems.length > 0 ? (
            <div className="space-y-1.5">
              {groupedItems.map(({ type, count }) => {
                const Icon = TYPE_ICONS[type] || BarChart3;
                return (
                  <div key={type} className="flex items-center gap-2.5 py-1.5 px-2 rounded-lg" style={{ backgroundColor: `${color}08` }}>
                    <div className="w-6 h-6 rounded-md flex items-center justify-center" style={{ backgroundColor: `${color}15` }}>
                      <Icon className="h-3 w-3" style={{ color }} />
                    </div>
                    <span className="text-[11px] font-medium text-foreground flex-1">{TYPE_LABELS[type] || type}</span>
                    <span className="text-xs font-bold" style={{ color }}>{count}</span>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-[10px] text-muted-foreground">Sem detalhes disponíveis</p>
          )}

          {/* Individual items (max 5) */}
          {selectedPoint.items.length > 0 && (
            <div className="mt-2.5 pt-2 border-t" style={{ borderColor: `${color}15` }}>
              <p className="text-[9px] text-muted-foreground uppercase tracking-wider mb-1.5">Últimas atividades</p>
              <div className="space-y-1">
                {selectedPoint.items.slice(0, 6).map((item, i) => {
                  const Icon = TYPE_ICONS[item.type] || BarChart3;
                  return (
                    <div key={i} className="flex items-center gap-2 py-1">
                      <Icon className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                      <span className="text-[10px] text-foreground truncate">{item.label}</span>
                    </div>
                  );
                })}
                {selectedPoint.items.length > 6 && (
                  <p className="text-[9px] text-muted-foreground pl-5">+{selectedPoint.items.length - 6} mais</p>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
