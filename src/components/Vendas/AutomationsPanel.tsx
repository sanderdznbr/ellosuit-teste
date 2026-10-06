import { useState } from 'react';
import { Plus, Trash2, Workflow } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import {
  ACTION_LABELS,
  AutomationAction,
  AutomationTrigger,
  FunnelAutomation,
  PipelineColumn,
  SalesFunnel,
  TRIGGER_LABELS,
  uid,
} from './types';

const ACTION_CONFIG_PLACEHOLDER: Record<AutomationAction, string> = {
  send_whatsapp: 'Mensagem a ser enviada…',
  start_chatbot: 'Nome ou ID do chatbot…',
  create_task: 'Descrição da tarefa…',
  send_email: 'Assunto do email…',
  advance_stage: '',
  notify_team: 'Aviso para a equipe…',
  webhook: 'URL do webhook…',
};

export function AutomationsPanel({
  funnel,
  columns,
  onChange,
}: {
  funnel: SalesFunnel;
  columns: PipelineColumn[];
  onChange: (automations: FunnelAutomation[]) => void;
}) {
  const { toast } = useToast();
  const [dialog, setDialog] = useState<{ stageId: string; editId?: string } | null>(null);

  const stageOf = (stageId: string) => columns.find((c) => c.id === stageId);

  const remove = (id: string) => {
    onChange(funnel.automations.filter((a) => a.id !== id));
    toast({ title: 'Regra removida' });
  };

  const toggle = (id: string, active: boolean) =>
    onChange(funnel.automations.map((a) => (a.id === id ? { ...a, active } : a)));

  const save = (draft: FunnelAutomation) => {
    const exists = funnel.automations.some((a) => a.id === draft.id);
    onChange(
      exists
        ? funnel.automations.map((a) => (a.id === draft.id ? draft : a))
        : [...funnel.automations, draft],
    );
    setDialog(null);
    toast({ title: exists ? 'Regra atualizada' : 'Regra criada' });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Cada regra é um gatilho + uma ação em uma etapa — de qualquer pipeline do funil.
        </p>
        <Button
          size="sm"
          onClick={() => setDialog({ stageId: columns[0]?.id || '' })}
          disabled={columns.length === 0}
        >
          <Plus className="h-4 w-4 mr-2" />
          Nova regra
        </Button>
      </div>

      {funnel.automations.length === 0 ? (
        <div className="rounded-2xl border border-dashed py-12 text-center text-sm text-muted-foreground">
          Nenhuma regra criada. Combine um gatilho (ex.: “Após X dias na etapa”) com uma ação
          (ex.: “Enviar mensagem no WhatsApp”).
        </div>
      ) : (
        funnel.automations.map((a) => {
          const stage = stageOf(a.stageId);
          return (
            <div key={a.id} className="rounded-2xl border bg-card p-4 flex items-center gap-4">
              <span
                className="h-8 w-2 rounded-full shrink-0"
                style={{ backgroundColor: stage?.color || '#374DA4' }}
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">
                  <span className="text-muted-foreground">{stage?.title || 'Etapa removida'} — </span>
                  {TRIGGER_LABELS[a.trigger]}
                  {a.days ? ` (${a.days}d)` : ''} → {ACTION_LABELS[a.action]}
                </p>
                {a.config && (
                  <p className="text-xs text-muted-foreground truncate">
                    {a.action === 'advance_stage'
                      ? `Destino: ${columns.find((c) => c.id === a.config)?.title ?? a.config}`
                      : a.config}
                  </p>
                )}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setDialog({ stageId: a.stageId, editId: a.id })}
              >
                Editar
              </Button>
              <Switch checked={a.active} onCheckedChange={(v) => toggle(a.id, v)} />
              <Button
                variant="ghost"
                size="icon"
                className="text-destructive"
                onClick={() => remove(a.id)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          );
        })
      )}

      <p className="flex items-center gap-2 text-xs text-muted-foreground">
        <Workflow className="h-3.5 w-3.5" />
        {funnel.automations.filter((a) => a.active).length} regra(s) ativa(s)
      </p>

      {dialog && (
        <AutomationDialog
          columns={columns}
          existing={funnel.automations.find((a) => a.id === dialog.editId)}
          defaultStageId={dialog.stageId}
          onCancel={() => setDialog(null)}
          onSave={save}
        />
      )}
    </div>
  );
}

function AutomationDialog({
  columns,
  existing,
  defaultStageId,
  onCancel,
  onSave,
}: {
  columns: PipelineColumn[];
  existing?: FunnelAutomation;
  defaultStageId: string;
  onCancel: () => void;
  onSave: (a: FunnelAutomation) => void;
}) {
  const [stageId, setStageId] = useState(existing?.stageId || defaultStageId);
  const [trigger, setTrigger] = useState<AutomationTrigger>(existing?.trigger || 'on_enter');
  const [days, setDays] = useState(existing?.days ?? 2);
  const [action, setAction] = useState<AutomationAction>(existing?.action || 'send_whatsapp');
  const [config, setConfig] = useState(existing?.config || '');
  const [active, setActive] = useState(existing?.active ?? true);

  const needsDays = trigger === 'after_days' || trigger === 'no_response_days';
  // advance_stage usa o config para a etapa de destino (vazio = próxima etapa).
  const needsConfig = ACTION_CONFIG_PLACEHOLDER[action] !== '';
  const picksTargetStage = action === 'advance_stage';

  const submit = () =>
    onSave({
      id: existing?.id || uid(),
      stageId,
      trigger,
      days: needsDays ? days : undefined,
      action,
      config: needsConfig || picksTargetStage ? config || undefined : undefined,
      active,
    });

  return (
    <Dialog open onOpenChange={(o) => !o && onCancel()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{existing ? 'Editar regra' : 'Nova regra'}</DialogTitle>
          <DialogDescription>
            Combine um gatilho com uma ação para automatizar esta etapa do funil.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Etapa</Label>
            <Select value={stageId} onValueChange={setStageId}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {columns.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Quando (gatilho)</Label>
            <Select value={trigger} onValueChange={(v) => setTrigger(v as AutomationTrigger)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(TRIGGER_LABELS) as AutomationTrigger[]).map((t) => (
                  <SelectItem key={t} value={t}>
                    {TRIGGER_LABELS[t]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {needsDays && (
            <div className="space-y-2">
              <Label>Dias</Label>
              <Input
                type="number"
                min={1}
                value={days}
                onChange={(e) => setDays(Math.max(1, Number(e.target.value) || 1))}
              />
            </div>
          )}

          <div className="space-y-2">
            <Label>Então (ação)</Label>
            <Select value={action} onValueChange={(v) => setAction(v as AutomationAction)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(ACTION_LABELS) as AutomationAction[]).map((a) => (
                  <SelectItem key={a} value={a}>
                    {ACTION_LABELS[a]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {picksTargetStage && (
            <div className="space-y-2">
              <Label>Etapa de destino</Label>
              <Select
                value={config || '__next__'}
                onValueChange={(v) => setConfig(v === '__next__' ? '' : v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__next__">Próxima etapa do funil</SelectItem>
                  {columns
                    .filter((c) => c.id !== stageId)
                    .map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.title}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {needsConfig && (
            <div className="space-y-2">
              <Label>Configuração</Label>
              <Input
                value={config}
                placeholder={ACTION_CONFIG_PLACEHOLDER[action]}
                onChange={(e) => setConfig(e.target.value)}
              />
            </div>
          )}

          <div className="flex items-center justify-between rounded-lg border px-3 py-2.5">
            <span className="text-sm">Regra ativa</span>
            <Switch checked={active} onCheckedChange={setActive} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={!stageId}>
            Salvar regra
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default AutomationsPanel;
