import React from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { AVAILABLE_FIELDS, type ContractField } from './ContractEditor';

const SUITE_COLOR = '#374DA4';

interface Props {
  showFieldDialog: boolean;
  setShowFieldDialog: (v: boolean) => void;
  showCustomFieldDialog: boolean;
  setShowCustomFieldDialog: (v: boolean) => void;
  customFieldLabel: string;
  setCustomFieldLabel: (v: string) => void;
  customFieldType: string;
  setCustomFieldType: (v: string) => void;
  insertField: (f: ContractField) => void;
  addCustomField: () => void;
}

const ContractFieldDialogs: React.FC<Props> = ({
  showFieldDialog, setShowFieldDialog,
  showCustomFieldDialog, setShowCustomFieldDialog,
  customFieldLabel, setCustomFieldLabel,
  customFieldType, setCustomFieldType,
  insertField, addCustomField,
}) => (
  <>
    <Dialog open={showFieldDialog} onOpenChange={setShowFieldDialog}>
      <DialogContent className="rounded-2xl max-w-md">
        <DialogHeader>
          <DialogTitle>Inserir Campo Editável</DialogTitle>
        </DialogHeader>
        <ScrollArea className="max-h-80">
          <div className="grid grid-cols-2 gap-2 p-1">
            {AVAILABLE_FIELDS.map(f => (
              <button
                key={f.id}
                onClick={() => insertField(f)}
                className="text-left p-3 rounded-xl border hover:border-primary/40 hover:bg-muted/50 transition-all"
              >
                <span className="text-sm font-medium block">{f.label}</span>
                <span className="text-[10px] text-muted-foreground font-mono">{`{{${f.id}}}`}</span>
              </button>
            ))}
          </div>
        </ScrollArea>
        <Separator />
        <Button variant="outline" onClick={() => { setShowFieldDialog(false); setShowCustomFieldDialog(true); }} className="rounded-xl gap-2 w-full">
          <Plus className="h-4 w-4" /> Campo Personalizado
        </Button>
      </DialogContent>
    </Dialog>

    <Dialog open={showCustomFieldDialog} onOpenChange={setShowCustomFieldDialog}>
      <DialogContent className="rounded-2xl max-w-sm">
        <DialogHeader>
          <DialogTitle>Campo Personalizado</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div>
            <Label className="text-xs">Nome do campo</Label>
            <Input value={customFieldLabel} onChange={e => setCustomFieldLabel(e.target.value)} className="mt-1 rounded-xl" placeholder="Ex: Número do Contrato" />
          </div>
          <div>
            <Label className="text-xs">Tipo</Label>
            <Select value={customFieldType} onValueChange={setCustomFieldType}>
              <SelectTrigger className="mt-1 rounded-xl"><SelectValue /></SelectTrigger>
              <SelectContent className="rounded-xl">
                <SelectItem value="text">Texto</SelectItem>
                <SelectItem value="date">Data</SelectItem>
                <SelectItem value="number">Número</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setShowCustomFieldDialog(false)} className="rounded-xl">Cancelar</Button>
          <Button onClick={addCustomField} disabled={!customFieldLabel.trim()} className="rounded-xl text-white" style={{ backgroundColor: SUITE_COLOR }}>Adicionar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </>
);

export default ContractFieldDialogs;
