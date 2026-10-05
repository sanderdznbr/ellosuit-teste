import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Settings2, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FunnelChart } from './FunnelChart';
import { formatBRL } from './FunnelKanban';
import { useFunnelData } from './useFunnelData';

/**
 * Página do funil: só o desenho. Clique numa etapa para abrir a lista de
 * contatos daquela coluna. Configuração, KPIs, automações e integrações
 * moram em páginas próprias (/vendas/...).
 */
export function FunilPage() {
  const navigate = useNavigate();
  const data = useFunnelData();
  const { funnel, stages, stageRows, create } = data;
  const [newName, setNewName] = useState('');

  if (!funnel) {
    return (
      <div className="flex-1 overflow-y-auto flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-lg rounded-3xl border bg-card p-7 shadow-sm space-y-5">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-2xl bg-primary/10 flex items-center justify-center">
              <TrendingUp className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-bold">Criar funil de vendas</h1>
              <p className="text-sm text-muted-foreground">
                Um lugar só para ver o funil e os contatos de cada etapa.
              </p>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="novo-funil">Nome do funil</Label>
            <Input
              id="novo-funil"
              autoFocus
              placeholder="Ex.: Funil de conversão 2026"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && create(newName.trim() || 'Meu Funil')}
            />
          </div>
          <div className="rounded-xl bg-muted/50 p-3.5 text-xs text-muted-foreground space-y-1.5">
            <p className="flex items-center gap-2">
              <TrendingUp className="h-3.5 w-3.5" /> O funil em um único lugar, sem ruído
            </p>
            <p className="flex items-center gap-2">
              <Settings2 className="h-3.5 w-3.5" /> Etapas, KPIs e automações em páginas próprias
            </p>
          </div>
          <Button className="w-full" onClick={() => create(newName.trim() || 'Meu Funil')}>
            <Plus className="h-4 w-4 mr-2" />
            Criar funil
          </Button>
        </div>
      </div>
    );
  }

  const goToStage = (stageId: string) => navigate(`/dashboard/vendas/funil/${stageId}`);

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 py-8 space-y-6">
        {/* Título */}
        <div className="text-center space-y-1">
          <h1
            className="text-2xl sm:text-3xl font-bold cursor-text outline-none"
            title="Clique para renomear"
            onDoubleClick={() => {
              const name = window.prompt('Nome do funil', funnel.name);
              if (name && name.trim()) data.update({ name: name.trim() });
            }}
          >
            {funnel.name}
          </h1>
          <p className="text-sm text-muted-foreground">
            {data.stats.total}{' '}
            {data.stats.total === 1 ? 'contato' : 'contatos'} ·{' '}
            <span className="font-semibold text-emerald-600">
              {formatBRL(data.stats.totalValue) || 'R$ 0'}
            </span>{' '}
            em negociação
          </p>
        </div>

        {/* O funil */}
        {stages.length === 0 ? (
          <div className="rounded-2xl border border-dashed py-16 text-center">
            <p className="text-sm text-muted-foreground">Este pipeline ainda não tem etapas.</p>
            <Button
              className="mt-4"
              onClick={() => navigate('/dashboard/vendas/pipelines')}
            >
              <Settings2 className="h-4 w-4 mr-2" />
              Configurar etapas
            </Button>
          </div>
        ) : (
          <div className="rounded-3xl border bg-card p-4 sm:p-8">
            <FunnelChart
              stages={stages.map((s) => ({ id: s.id, title: s.title, color: s.color }))}
              counts={stageRows.map((r) => r.count)}
              frios={stageRows.map((r) => r.frio)}
              weights={stages.map((s) => s.weight)}
              showNumbers
              onSelectStage={goToStage}
            />
            <p className="mt-4 text-center text-xs text-muted-foreground">
              Clique numa etapa para ver os contatos dela
            </p>
            <p className="mt-1 text-center text-[11px] text-muted-foreground/70 sm:hidden">
              Arraste o funil para o lado para ver todas as etapas
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export default FunilPage;
