import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Filter, PanelTop, Webhook, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { AddSourceButton } from './DealDrawer';
import { WebhookPanel } from './WebhookPanel';
import { SOURCE_LABELS } from './types';
import { useFunnelData } from './useFunnelData';

/** Página de integrações: webhook de entrada, origens e integrações. */
export function IntegracoesPage() {
  const navigate = useNavigate();
  const { funnel, update, columns, companyId, addSource, refresh } = useFunnelData();

  if (!funnel) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4 px-4">
        <p className="text-sm text-muted-foreground">Crie um funil para configurar integrações.</p>
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
          <Webhook className="h-5 w-5 text-primary" />
          <div>
            <h1 className="text-xl sm:text-2xl font-bold leading-tight">Integrações</h1>
            <p className="text-xs text-muted-foreground">
              Webhook, origem dos contatos e apps conectados
            </p>
          </div>
        </div>

        <div className="rounded-2xl border bg-card p-4 sm:p-6">
          <div className="mb-4 flex items-center gap-2">
            <Webhook className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold">Webhook de entrada</h2>
          </div>
          <WebhookPanel
            funnel={funnel}
            update={update}
            columns={columns}
            companyId={companyId}
            onLeadCreated={refresh}
          />
        </div>

        <div className="rounded-2xl border bg-card p-4 sm:p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-semibold">Origem dos contatos</h2>
            </div>
            <AddSourceButton onAdd={addSource} />
          </div>
          {funnel.sources.map((source) => (
            <div key={source.id} className="rounded-xl border bg-background p-3.5 flex items-center gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{SOURCE_LABELS[source.type]}</Badge>
                  <Input
                    value={source.label}
                    onChange={(e) =>
                      update({
                        sources: funnel.sources.map((s) =>
                          s.id === source.id ? { ...s, label: e.target.value } : s,
                        ),
                      })
                    }
                    className="max-w-xs h-8"
                  />
                </div>
                {source.type !== 'manual' && source.type !== 'crm_whatsapp' && (
                  <Input
                    value={source.config || ''}
                    placeholder="Link / endpoint / observação…"
                    onChange={(e) =>
                      update({
                        sources: funnel.sources.map((s) =>
                          s.id === source.id ? { ...s, config: e.target.value } : s,
                        ),
                      })
                    }
                    className="mt-2 h-8 text-xs"
                  />
                )}
              </div>
              <Switch
                checked={source.enabled}
                onCheckedChange={(v) =>
                  update({
                    sources: funnel.sources.map((s) =>
                      s.id === source.id ? { ...s, enabled: v } : s,
                    ),
                  })
                }
              />
              <Button
                variant="ghost"
                size="icon"
                className="text-destructive"
                title="Remover origem"
                onClick={() =>
                  update({ sources: funnel.sources.filter((s) => s.id !== source.id) })
                }
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>

        <div className="rounded-2xl border bg-card p-4 sm:p-6 space-y-4">
          <div className="flex items-center gap-2">
            <PanelTop className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold">Apps conectados</h2>
          </div>
          {funnel.integrations.map((integration) => (
            <div
              key={integration.id}
              className="rounded-xl border bg-background p-3.5 flex items-center gap-4"
            >
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium flex items-center gap-2">
                  {integration.label}
                  {integration.enabled && (
                    <Badge className="bg-emerald-500/15 text-emerald-600">Ativa</Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">{integration.description}</p>
              </div>
              <Switch
                checked={integration.enabled}
                onCheckedChange={(v) =>
                  update({
                    integrations: funnel.integrations.map((x) =>
                      x.id === integration.id ? { ...x, enabled: v } : x,
                    ),
                  })
                }
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default IntegracoesPage;
