import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Workflow } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AutomationsPanel } from './AutomationsPanel';
import { useFunnelData } from './useFunnelData';

/** Página de automações: gatilhos → ações por etapa do funil. */
export function AutomacoesPage() {
  const navigate = useNavigate();
  const { funnel, update, stagesForSelectors } = useFunnelData();

  if (!funnel) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4 px-4">
        <p className="text-sm text-muted-foreground">Crie um funil para automatizar as etapas.</p>
        <Button onClick={() => navigate('/dashboard/vendas/funil')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Ir para o funil
        </Button>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 py-6 space-y-5">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            title="Voltar ao funil"
            onClick={() => navigate('/dashboard/vendas/funil')}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <Workflow className="h-5 w-5 text-primary" />
          <div>
            <h1 className="text-xl sm:text-2xl font-bold leading-tight">Automações</h1>
            <p className="text-xs text-muted-foreground">
              Regras disparadas quando o contato avança no funil
            </p>
          </div>
        </div>

        <div className="rounded-2xl border bg-card p-4 sm:p-6">
          <AutomationsPanel
            funnel={funnel}
            columns={stagesForSelectors}
            onChange={(automations) => update({ automations })}
          />
        </div>
      </div>
    </div>
  );
}

export default AutomacoesPage;
