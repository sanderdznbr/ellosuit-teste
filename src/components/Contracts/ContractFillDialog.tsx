import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, FileText } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

const SUITE_COLOR = '#374DA4';

interface ContractField {
  id: string;
  label: string;
  type: string;
  placeholder?: string;
}

interface Props {
  templateId: string;
  companyId: string;
  onClose: () => void;
  onGenerated: (contract: any) => void;
}

const ContractFillDialog: React.FC<Props> = ({ templateId, companyId, onClose, onGenerated }) => {
  const { user } = useAuth();
  const [template, setTemplate] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [values, setValues] = useState<Record<string, string>>({});
  const [contractTitle, setContractTitle] = useState('');

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase.from('contract_templates').select('*').eq('id', templateId).single();
      if (data) {
        setTemplate(data);
        setContractTitle(`${data.title} - ${new Date().toLocaleDateString('pt-BR')}`);
        const fields = (data.fields as unknown as ContractField[]) || [];
        const initial: Record<string, string> = {};
        fields.forEach(f => { initial[f.id] = ''; });
        setValues(initial);
      }
      setLoading(false);
    };
    load();
  }, [templateId]);

  const generateContract = async () => {
    if (!template || !user?.id) return;
    setSaving(true);

    // Replace placeholders in content
    let finalContent = template.content || '';
    const fields = (template.fields as ContractField[]) || [];
    fields.forEach(f => {
      const regex = new RegExp(`\\{\\{${f.id}\\}\\}`, 'g');
      finalContent = finalContent.replace(regex, values[f.id] || `[${f.label}]`);
    });

    try {
      const { data, error } = await supabase.from('generated_contracts').insert({
        company_id: companyId,
        template_id: templateId,
        created_by: user.id,
        title: contractTitle,
        filled_fields: values,
        final_content: finalContent,
        status: 'final',
      }).select('*, contract_templates(title)').single();

      if (error) throw error;
      toast.success('Contrato gerado com sucesso!');
      onGenerated(data);
    } catch (err: any) {
      toast.error(err.message || 'Erro ao gerar contrato');
    } finally {
      setSaving(false);
    }
  };

  const fields = (template?.fields as ContractField[]) || [];

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="rounded-2xl max-w-lg max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" style={{ color: SUITE_COLOR }} />
            Gerar Contrato
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin" style={{ color: SUITE_COLOR }} />
          </div>
        ) : (
          <>
            <ScrollArea className="flex-1 pr-2">
              <div className="space-y-4 py-2">
                <div>
                  <Label className="text-xs font-medium">Título do contrato</Label>
                  <Input
                    value={contractTitle}
                    onChange={e => setContractTitle(e.target.value)}
                    className="mt-1 rounded-xl"
                    placeholder="Ex: Contrato de Prestação - João"
                  />
                </div>

                {fields.length > 0 && (
                  <div className="border-t pt-4">
                    <p className="text-xs text-muted-foreground mb-3 font-medium uppercase tracking-wider">Campos do contrato</p>
                    <div className="space-y-3">
                      {fields.map(f => (
                        <div key={f.id}>
                          <Label className="text-xs">{f.label}</Label>
                          <Input
                            type={f.type === 'date' ? 'date' : 'text'}
                            value={values[f.id] || ''}
                            onChange={e => setValues(prev => ({ ...prev, [f.id]: e.target.value }))}
                            className="mt-1 rounded-xl"
                            placeholder={f.placeholder || f.label}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </ScrollArea>

            <DialogFooter>
              <Button variant="outline" onClick={onClose} className="rounded-xl">Cancelar</Button>
              <Button
                onClick={generateContract}
                disabled={saving || !contractTitle.trim()}
                className="rounded-xl text-white gap-2"
                style={{ backgroundColor: SUITE_COLOR }}
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
                Gerar Contrato
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default ContractFillDialog;
