import React, { useState } from 'react';
import {
  BarChart, Bar, LineChart, Line, AreaChart, Area, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import { BarChart3, TrendingUp, PieChart as PieIcon, AreaChart as AreaIcon, Maximize2, Minimize2 } from 'lucide-react';

export interface ChartConfig {
  type: 'bar' | 'line' | 'area' | 'pie';
  title: string;
  description?: string;
  data: Array<{ name: string; value: number; value2?: number; label?: string }>;
  colors?: string[];
  seriesNames?: string[];
}

const DEFAULT_COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#374DA4', '#ef4444', '#14b8a6'];

const CHART_ICONS = {
  bar: BarChart3,
  line: TrendingUp,
  area: AreaIcon,
  pie: PieIcon,
};

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-border rounded-lg shadow-lg p-3 text-xs">
      <p className="font-semibold text-foreground mb-1">{label}</p>
      {payload.map((entry: any, i: number) => (
        <p key={i} className="text-muted-foreground">
          <span className="inline-block w-2 h-2 rounded-full mr-1.5" style={{ backgroundColor: entry.color }} />
          {entry.name}: <span className="font-bold text-foreground">{entry.value}</span>
        </p>
      ))}
    </div>
  );
};

const AIAssistantChart: React.FC<{ chart: ChartConfig }> = ({ chart }) => {
  const [expanded, setExpanded] = useState(false);
  const colors = chart.colors?.length ? chart.colors : DEFAULT_COLORS;
  const Icon = CHART_ICONS[chart.type] || BarChart3;

  const total = chart.data.reduce((s, d) => s + (d.value || 0), 0);
  const hasValue2 = chart.data.some(d => d.value2 !== undefined);
  const s1 = chart.seriesNames?.[0] || 'Valor';
  const s2 = chart.seriesNames?.[1] || 'Valor 2';
  const chartHeight = expanded ? 360 : 220;

  const renderChart = () => {
    switch (chart.type) {
      case 'pie':
        return (
          <PieChart>
            <Pie
              data={chart.data}
              cx="50%"
              cy="50%"
              innerRadius={expanded ? 60 : 40}
              outerRadius={expanded ? 100 : 70}
              dataKey="value"
              nameKey="name"
              label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
              labelLine={false}
            >
              {chart.data.map((_, i) => (
                <Cell key={i} fill={colors[i % colors.length]} />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
            <Legend wrapperStyle={{ fontSize: '11px' }} />
          </PieChart>
        );
      case 'line':
        return (
          <LineChart data={chart.data}>
            <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
            <XAxis dataKey="name" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
            <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
            <Tooltip content={<CustomTooltip />} />
            {hasValue2 && <Legend wrapperStyle={{ fontSize: '11px' }} />}
            <Line type="monotone" dataKey="value" name={s1} stroke={colors[0]} strokeWidth={2.5} dot={{ r: 3, fill: colors[0] }} activeDot={{ r: 5 }} />
            {hasValue2 && <Line type="monotone" dataKey="value2" name={s2} stroke={colors[1]} strokeWidth={2} dot={{ r: 3 }} />}
          </LineChart>
        );
      case 'area':
        return (
          <AreaChart data={chart.data}>
            <defs>
              <linearGradient id="chartGrad1" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={colors[0]} stopOpacity={0.3} />
                <stop offset="95%" stopColor={colors[0]} stopOpacity={0.02} />
              </linearGradient>
              {hasValue2 && (
                <linearGradient id="chartGrad2" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={colors[1]} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={colors[1]} stopOpacity={0.02} />
                </linearGradient>
              )}
            </defs>
            <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
            <XAxis dataKey="name" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
            <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
            <Tooltip content={<CustomTooltip />} />
            {hasValue2 && <Legend wrapperStyle={{ fontSize: '11px' }} />}
            <Area type="monotone" dataKey="value" name={s1} stroke={colors[0]} fill="url(#chartGrad1)" strokeWidth={2} />
            {hasValue2 && <Area type="monotone" dataKey="value2" name={s2} stroke={colors[1]} fill="url(#chartGrad2)" strokeWidth={2} />}
          </AreaChart>
        );
      default: // bar
        return (
          <BarChart data={chart.data}>
            <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
            <XAxis dataKey="name" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
            <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
            <Tooltip content={<CustomTooltip />} />
            {hasValue2 && <Legend wrapperStyle={{ fontSize: '11px' }} />}
            <Bar dataKey="value" name={s1} fill={colors[0]} radius={[4, 4, 0, 0]} />
            {hasValue2 && <Bar dataKey="value2" name={s2} fill={colors[1]} radius={[4, 4, 0, 0]} />}
          </BarChart>
        );
    }
  };

  return (
    <div className={`mt-3 bg-card border border-border rounded-2xl overflow-hidden shadow-sm transition-all ${expanded ? 'w-full' : 'w-full max-w-lg'}`}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2 min-w-0">
          <div className="p-1.5 rounded-lg bg-primary/10">
            <Icon className="h-4 w-4 text-primary" />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-foreground truncate">{chart.title}</h3>
            {chart.description && (
              <p className="text-[10px] text-muted-foreground truncate">{chart.description}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs font-bold text-foreground bg-muted px-2 py-0.5 rounded-full">{total}</span>
          <button onClick={() => setExpanded(!expanded)} className="p-1 rounded-md hover:bg-muted transition-colors">
            {expanded ? <Minimize2 className="h-3.5 w-3.5 text-muted-foreground" /> : <Maximize2 className="h-3.5 w-3.5 text-muted-foreground" />}
          </button>
        </div>
      </div>

      {/* Chart */}
      <div className="px-2 py-3">
        <ResponsiveContainer width="100%" height={chartHeight}>
          {renderChart()}
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default AIAssistantChart;
