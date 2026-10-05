
import { useState, useRef, useEffect } from 'react';
import { Search, ChevronDown, X, Blocks, Zap, Play, GitBranch, RefreshCw } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { AUTOMATION_BLOCKS, AutomationBlockDefinition } from './types';
import * as Icons from 'lucide-react';

const CATEGORIES = [
  { key: 'trigger', label: 'Gatilhos', Icon: Zap },
  { key: 'action', label: 'Ações', Icon: Play },
  { key: 'condition', label: 'Condições', Icon: GitBranch },
  { key: 'transform', label: 'Transformação', Icon: RefreshCw },
];

interface Props {
  onDragStart: (block: AutomationBlockDefinition) => void;
  isExpanded?: boolean;
  onToggle?: () => void;
}

export default function AutomationSidebar({ onDragStart, isExpanded = false, onToggle }: Props) {
  const [search, setSearch] = useState('');
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const hoverTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const leaveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sidebarRef = useRef<HTMLDivElement>(null);

  const filtered = AUTOMATION_BLOCKS.filter(b =>
    b.label.toLowerCase().includes(search.toLowerCase()) ||
    b.description.toLowerCase().includes(search.toLowerCase())
  );

  const toggleCategory = (key: string) => {
    setCollapsed(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const getIcon = (iconName: string) => {
    const IconComp = (Icons as any)[iconName];
    return IconComp ? <IconComp className="h-4 w-4" /> : null;
  };

  const handleButtonMouseEnter = () => {
    if (leaveTimeout.current) clearTimeout(leaveTimeout.current);
    if (!isExpanded) {
      hoverTimeout.current = setTimeout(() => {
        onToggle?.();
      }, 150);
    }
  };

  const handleButtonMouseLeave = () => {
    if (hoverTimeout.current) clearTimeout(hoverTimeout.current);
  };

  const handleSidebarMouseLeave = () => {
    leaveTimeout.current = setTimeout(() => {
      if (isExpanded) onToggle?.();
    }, 400);
  };

  const handleSidebarMouseEnter = () => {
    if (leaveTimeout.current) clearTimeout(leaveTimeout.current);
  };

  useEffect(() => {
    return () => {
      if (hoverTimeout.current) clearTimeout(hoverTimeout.current);
      if (leaveTimeout.current) clearTimeout(leaveTimeout.current);
    };
  }, []);

  // Collapsed: floating pill button
  if (!isExpanded) {
    return (
      <div
        className="absolute left-4 top-4 z-30"
        onMouseEnter={handleButtonMouseEnter}
        onMouseLeave={handleButtonMouseLeave}
      >
        <button
          onClick={onToggle}
          className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-card border border-border shadow-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:shadow-xl hover:scale-105 active:scale-95 transition-all duration-200"
        >
          <Blocks className="h-4.5 w-4.5" />
          <span>Ver blocos</span>
        </button>
      </div>
    );
  }

  return (
    <div
      ref={sidebarRef}
      className="w-72 border-r border-border/60 bg-card flex flex-col flex-shrink-0 overflow-hidden shadow-xl animate-in slide-in-from-left-2 duration-200"
      onMouseLeave={handleSidebarMouseLeave}
      onMouseEnter={handleSidebarMouseEnter}
    >
      {/* Header */}
      <div className="px-4 pt-4 pb-3 border-b border-border/40">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-foreground tracking-tight">Blocos</h3>
          <button
            onClick={onToggle}
            className="w-7 h-7 rounded-xl flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-all duration-150"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar blocos..."
            className="h-9 pl-9 text-sm rounded-xl bg-muted/40 border-transparent focus:border-primary/30 focus:bg-background transition-colors"
          />
        </div>
      </div>

      {/* Block list */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-1">
        {CATEGORIES.map(cat => {
          const blocks = filtered.filter(b => b.category === cat.key);
          if (blocks.length === 0) return null;
          const isCollapsed = collapsed[cat.key];
          const CatIcon = cat.Icon;

          return (
            <div key={cat.key} className="mb-1">
              <button
                onClick={() => toggleCategory(cat.key)}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold uppercase tracking-wider rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
              >
                <CatIcon className="h-3.5 w-3.5" />
                <span className="flex-1 text-left">{cat.label}</span>
                <span className="text-[10px] font-medium tabular-nums text-muted-foreground/50 bg-muted/60 rounded-md px-1.5 py-0.5">{blocks.length}</span>
                <ChevronDown className={`h-3 w-3 text-muted-foreground/40 transition-transform duration-200 ${isCollapsed ? '-rotate-90' : ''}`} />
              </button>
              {!isCollapsed && (
                <div className="mt-1 space-y-0.5">
                  {blocks.map(block => (
                    <div
                      key={block.type}
                      draggable
                      onDragStart={() => onDragStart(block)}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-grab active:cursor-grabbing border border-transparent transition-all duration-150 group hover:bg-muted/60 hover:border-border/50 hover:shadow-sm active:scale-[0.98]"
                    >
                      <div
                        className="w-9 h-9 rounded-xl flex items-center justify-center text-white flex-shrink-0 shadow-sm group-hover:shadow-md transition-shadow duration-200"
                        style={{ backgroundColor: block.color }}
                      >
                        {getIcon(block.icon)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium truncate text-foreground/90 group-hover:text-foreground">{block.label}</div>
                        <div className="text-xs truncate text-muted-foreground/60">{block.description}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Footer hint */}
      <div className="px-4 py-3 border-t border-border/30">
        <p className="text-[11px] text-muted-foreground/50 text-center">
          Arraste os blocos para o canvas
        </p>
      </div>
    </div>
  );
}
