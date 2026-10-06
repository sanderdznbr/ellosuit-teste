import { useState } from 'react';
import { MoreVertical, Pencil, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { SalesFunnel } from './types';

interface FunnelSwitcherProps {
  funnels: SalesFunnel[];
  activeFunnelId: string;
  onSelect: (id: string) => void;
  onCreate: (name: string) => void;
  onRename: (id: string, name: string) => void;
  /** Devolve false quando o funil não pode sair (é o último). */
  onDelete: (id: string) => boolean;
}

/**
 * Seletor de funis: chips discretos, criação por diálogo e renomear/excluir no
 * menu do funil ativo. Mesmo padrão visual do seletor de pipelines.
 */
export function FunnelSwitcher({
  funnels,
  activeFunnelId,
  onSelect,
  onCreate,
  onRename,
  onDelete,
}: FunnelSwitcherProps) {
  const [nameDialog, setNameDialog] = useState<'create' | 'rename' | null>(null);
  const [draftName, setDraftName] = useState('');
  const active = funnels.find((f) => f.id === activeFunnelId) || funnels[0];

  const openCreate = () => {
    setDraftName(`Funil ${funnels.length + 1}`);
    setNameDialog('create');
  };

  const openRename = () => {
    setDraftName(active?.name || '');
    setNameDialog('rename');
  };

  const confirm = () => {
    const name = draftName.trim();
    if (!name) return;
    if (nameDialog === 'create') onCreate(name);
    else if (nameDialog === 'rename' && active) onRename(active.id, name);
    setNameDialog(null);
  };

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {funnels.map((f) => {
        const isActive = f.id === activeFunnelId;
        return (
          <button
            key={f.id}
            type="button"
            onClick={() => onSelect(f.id)}
            aria-pressed={isActive}
            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
              isActive
                ? 'border-primary/40 bg-primary/10 text-primary'
                : 'border-transparent bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground'
            }`}
          >
            {f.name}
            <span className={`text-[10px] tabular-nums ${isActive ? 'text-primary/70' : 'text-muted-foreground/70'}`}>
              {f.stages.length}
            </span>
          </button>
        );
      })}

      <Button
        variant="ghost"
        size="sm"
        className="h-7 rounded-full gap-1 px-2.5 text-xs text-muted-foreground hover:text-foreground"
        onClick={openCreate}
      >
        <Plus className="h-3.5 w-3.5" />
        Novo funil
      </Button>

      {active && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 rounded-full text-muted-foreground hover:text-foreground"
              aria-label="Opções do funil"
              title="Opções do funil"
            >
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="rounded-2xl border-gray-100 p-1.5 min-w-[190px] shadow-lg">
            <DropdownMenuItem className="rounded-xl gap-2 cursor-pointer" onClick={openRename}>
              <Pencil className="h-4 w-4" />
              Renomear funil
            </DropdownMenuItem>
            <DropdownMenuItem
              className="rounded-xl gap-2 cursor-pointer text-destructive focus:text-destructive"
              onClick={() => onDelete(active.id)}
            >
              <Trash2 className="h-4 w-4" />
              Excluir funil
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      <Dialog open={nameDialog !== null} onOpenChange={(open) => !open && setNameDialog(null)}>
        <DialogContent className="sm:max-w-md rounded-3xl">
          <DialogHeader>
            <DialogTitle>{nameDialog === 'create' ? 'Novo funil' : 'Renomear funil'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="funnel-name">Nome</Label>
            <Input
              id="funnel-name"
              autoFocus
              value={draftName}
              onChange={(e) => setDraftName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && confirm()}
              placeholder="Ex.: Funil de pós-venda"
            />
            {nameDialog === 'create' && (
              <p className="text-xs text-muted-foreground">
                O funil nasce com as etapas do kanban do CRM — depois você edita as etapas dele
                sem mexer no CRM.
              </p>
            )}
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" className="rounded-full" onClick={() => setNameDialog(null)}>
              Cancelar
            </Button>
            <Button className="rounded-full" onClick={confirm} disabled={!draftName.trim()}>
              {nameDialog === 'create' ? 'Criar funil' : 'Salvar nome'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default FunnelSwitcher;
