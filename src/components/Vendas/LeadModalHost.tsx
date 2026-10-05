import { useState } from 'react';
import { Plus, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { LeadModal, LeadTarget } from './LeadModal';
import { FunnelData } from './useFunnelData';

export type LeadHostState =
  | { kind: 'closed' }
  | { kind: 'lead'; id: string; source: 'crm' | 'local'; list: string[]; index: number }
  | { kind: 'add'; stageId: string };

/**
 * Hospeda o modal de lead com navegação pela lista de origem e o formulário de
 * novo contato — usado no board e na lista de contatos da etapa.
 */
export function LeadModalHost({
  data,
  state,
  onState,
  onOpenCRM,
}: {
  data: FunnelData;
  state: LeadHostState;
  onState: (s: LeadHostState) => void;
  onOpenCRM: () => void;
}) {
  if (state.kind === 'closed') return null;

  if (state.kind === 'add') {
    return <AddContactDialog data={data} stageId={state.stageId} onClose={() => onState({ kind: 'closed' })} />;
  }

  const { id, source, list, index } = state;
  const step = (dir: -1 | 1) => {
    const next = index + dir;
    if (next < 0 || next >= list.length) return;
    onState({ kind: 'lead', id: list[next], source, list, index: next });
  };

  return (
    <LeadModal
      data={data}
      target={{ id, kind: source }}
      onClose={() => onState({ kind: 'closed' })}
      onNavigate={step}
      onOpenCRM={onOpenCRM}
    />
  );
}

function AddContactDialog({
  data,
  stageId,
  onClose,
}: {
  data: FunnelData;
  stageId: string;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [saving, setSaving] = useState(false);
  const stage = data.stages.find((s) => s.id === stageId);
  const isCrm = data.isCrmPipeline;

  const submit = async () => {
    if (isCrm && phone.replace(/\D/g, '').length < 8) {
      toast({
        title: 'Telefone inválido',
        description: 'No pipeline do CRM o contato precisa de um WhatsApp válido.',
        variant: 'destructive',
      });
      return;
    }
    setSaving(true);
    const res = await data.addLead(stageId, name, phone);
    setSaving(false);
    if (!res.ok) {
      toast({ title: 'Erro ao criar contato', description: res.error, variant: 'destructive' });
      return;
    }
    data.refresh();
    toast({ title: 'Contato criado', description: `Entra em ${stage?.title || 'a etapa'}.` });
    onClose();
  };

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Novo contato em {stage?.title || 'etapa'}</DialogTitle>
          <DialogDescription>
            {isCrm
              ? 'O contato entra no CRM WhatsApp e aparece na etapa.'
              : 'Contato manual deste pipeline.'}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Nome</Label>
            <Input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nome do contato"
            />
          </div>
          <div className="space-y-1.5">
            <Label>WhatsApp {isCrm && <span className="text-destructive">*</span>}</Label>
            <Input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="5511999999999"
              onKeyDown={(e) => e.key === 'Enter' && submit()}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={saving || !name.trim()}>
            {saving ? <Plus className="h-4 w-4 mr-2 animate-pulse" /> : <UserPlus className="h-4 w-4 mr-2" />}
            Criar contato
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Helper para abrir um lead a partir de uma lista de cards. */
export function leadState(
  id: string,
  source: 'crm' | 'local',
  list: string[],
): LeadHostState {
  const index = Math.max(0, list.indexOf(id));
  return { kind: 'lead', id, source, list, index };
}
