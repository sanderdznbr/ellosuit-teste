import { useState, useEffect } from 'react';
import { Download, Search, Plus, Trash2, Loader2 } from 'lucide-react';
import jsPDF from 'jspdf';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface ServiceLine {
  id: string;
  name: string;
  qty: number;
  unit_price: number;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  proposal: any;
  companyId: string | null;
}

export default function ProposalGenerateDialog({ open, onOpenChange, proposal, companyId }: Props) {
  const { toast } = useToast();
  const [clientName, setClientName] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [services, setServices] = useState<ServiceLine[]>([]);
  const [notes, setNotes] = useState('');
  const [serviceSearch, setServiceSearch] = useState('');
  const [generating, setGenerating] = useState(false);

  const { data: companyServices = [] } = useQuery({
    queryKey: ['company-services', companyId],
    queryFn: async () => {
      if (!companyId) return [];
      const { data } = await supabase.from('company_services').select('*').eq('company_id', companyId).eq('is_active', true);
      return data || [];
    },
    enabled: !!companyId && open,
  });

  const { data: company } = useQuery({
    queryKey: ['company-info', companyId],
    queryFn: async () => {
      if (!companyId) return null;
      const { data } = await supabase.from('companies').select('name, settings').eq('id', companyId).single();
      return data;
    },
    enabled: !!companyId && open,
  });

  // Pre-fill from proposal
  useEffect(() => {
    if (proposal && open) {
      setClientName(proposal.clients?.name || '');
      setClientEmail(proposal.clients?.email || '');
      setClientPhone(proposal.clients?.phone || proposal.clients?.whatsapp || '');
      setNotes(proposal.notes || proposal.description || '');
      
      // Try to parse items from proposal
      if (proposal.items && Array.isArray(proposal.items)) {
        setServices(proposal.items.map((item: any, i: number) => ({
          id: `item-${i}`,
          name: item.name || item.description || 'Serviço',
          qty: item.quantity || 1,
          unit_price: item.unit_price || item.price || 0,
        })));
      } else if (proposal.total) {
        setServices([{ id: 'main', name: proposal.title || 'Serviço', qty: 1, unit_price: proposal.total }]);
      } else {
        setServices([]);
      }
    }
  }, [proposal, open]);

  const filteredServices = companyServices.filter((s: any) =>
    s.name.toLowerCase().includes(serviceSearch.toLowerCase())
  );

  const addService = (svc: any) => {
    setServices(prev => [...prev, { id: svc.id, name: svc.name, qty: 1, unit_price: svc.unit_price }]);
    setServiceSearch('');
  };

  const removeService = (index: number) => {
    setServices(prev => prev.filter((_, i) => i !== index));
  };

  const updateService = (index: number, field: keyof ServiceLine, value: any) => {
    setServices(prev => prev.map((s, i) => i === index ? { ...s, [field]: value } : s));
  };

  const total = services.reduce((sum, s) => sum + s.qty * s.unit_price, 0);
  const fmtBRL = (v: number) => `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;

  const generatePDF = async () => {
    setGenerating(true);
    try {
      const doc = new jsPDF('p', 'mm', 'a4');
      const w = doc.internal.pageSize.getWidth();
      const primaryColor = '#374DA4';
      let y = 0;

      // Header bar
      doc.setFillColor(48, 0, 227);
      doc.rect(0, 0, w, 28, 'F');

      // Company name
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(16);
      doc.setTextColor(255, 255, 255);
      doc.text(company?.name || 'Minha Empresa', 14, 18);

      // Proposal number
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.text(proposal?.proposal_number || 'OS', w - 14, 18, { align: 'right' });

      y = 40;

      // Title
      doc.setTextColor(30, 30, 30);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(18);
      doc.text('Ordem de Serviço', 14, y);
      y += 8;

      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(120, 120, 120);
      doc.text(`Data: ${format(new Date(), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}`, 14, y);
      y += 12;

      // Client info box
      doc.setFillColor(248, 248, 252);
      doc.roundedRect(14, y, w - 28, 30, 3, 3, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(48, 0, 227);
      doc.text('CLIENTE', 20, y + 8);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(60, 60, 60);
      doc.setFontSize(10);
      doc.text(clientName || 'Não informado', 20, y + 16);
      doc.setFontSize(8);
      doc.setTextColor(120, 120, 120);
      const contactLine = [clientEmail, clientPhone].filter(Boolean).join(' • ');
      if (contactLine) doc.text(contactLine, 20, y + 22);
      y += 38;

      // Services table header
      doc.setFillColor(48, 0, 227);
      doc.rect(14, y, w - 28, 8, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(255, 255, 255);
      doc.text('SERVIÇO', 18, y + 5.5);
      doc.text('QTD', w - 70, y + 5.5, { align: 'center' });
      doc.text('VALOR UNIT.', w - 46, y + 5.5, { align: 'center' });
      doc.text('SUBTOTAL', w - 20, y + 5.5, { align: 'right' });
      y += 8;

      // Service rows
      services.forEach((svc, i) => {
        const rowY = y + i * 9;
        if (i % 2 === 0) {
          doc.setFillColor(250, 250, 255);
          doc.rect(14, rowY, w - 28, 9, 'F');
        }
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.setTextColor(40, 40, 40);
        doc.text(svc.name, 18, rowY + 6);
        doc.setTextColor(100, 100, 100);
        doc.text(String(svc.qty), w - 70, rowY + 6, { align: 'center' });
        doc.text(fmtBRL(svc.unit_price), w - 46, rowY + 6, { align: 'center' });
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(40, 40, 40);
        doc.text(fmtBRL(svc.qty * svc.unit_price), w - 20, rowY + 6, { align: 'right' });
      });

      y += services.length * 9 + 4;

      // Total box
      doc.setFillColor(48, 0, 227);
      doc.roundedRect(w - 80, y, 66, 14, 2, 2, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(255, 255, 255);
      doc.text('TOTAL', w - 76, y + 9);
      doc.setFontSize(12);
      doc.text(fmtBRL(total), w - 18, y + 9, { align: 'right' });
      y += 22;

      // Notes
      if (notes) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.setTextColor(48, 0, 227);
        doc.text('OBSERVAÇÕES', 14, y);
        y += 5;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(80, 80, 80);
        const splitNotes = doc.splitTextToSize(notes, w - 28);
        doc.text(splitNotes, 14, y);
        y += splitNotes.length * 4 + 6;
      }

      // Footer
      const footerY = 282;
      doc.setDrawColor(48, 0, 227);
      doc.setLineWidth(0.5);
      doc.line(14, footerY, w - 14, footerY);
      doc.setFontSize(7);
      doc.setTextColor(150, 150, 150);
      doc.text(company?.name || '', 14, footerY + 5);
      doc.text('Gerado por Ellosuit', w - 14, footerY + 5, { align: 'right' });

      doc.save(`OS-${proposal?.proposal_number || 'nova'}.pdf`);
      toast({ title: 'PDF gerado com sucesso!' });
    } catch (err) {
      console.error(err);
      toast({ title: 'Erro ao gerar PDF', variant: 'destructive' });
    } finally {
      setGenerating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold text-gray-900">
            Gerar Ordem de Serviço
          </DialogTitle>
          <p className="text-sm text-gray-500">
            {proposal?.title} • {proposal?.proposal_number}
          </p>
        </DialogHeader>

        <div className="space-y-5 mt-2">
          {/* Client */}
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 block">Cliente</label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <Input placeholder="Nome" value={clientName} onChange={e => setClientName(e.target.value)} className="rounded-xl" />
              <Input placeholder="Email" value={clientEmail} onChange={e => setClientEmail(e.target.value)} className="rounded-xl" />
              <Input placeholder="Telefone" value={clientPhone} onChange={e => setClientPhone(e.target.value)} className="rounded-xl" />
            </div>
          </div>

          {/* Services */}
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 block">Serviços</label>
            
            {/* Add service search */}
            <div className="relative mb-3">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Buscar serviço cadastrado..."
                value={serviceSearch}
                onChange={e => setServiceSearch(e.target.value)}
                className="pl-9 rounded-xl"
              />
              {serviceSearch && filteredServices.length > 0 && (
                <div className="absolute z-10 top-full mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-lg max-h-40 overflow-y-auto">
                  {filteredServices.map((s: any) => (
                    <button
                      key={s.id}
                      onClick={() => addService(s)}
                      className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 flex justify-between items-center"
                    >
                      <span>{s.name}</span>
                      <span className="text-xs text-gray-400">{fmtBRL(s.unit_price)}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Service lines */}
            <div className="space-y-2">
              {services.map((svc, i) => (
                <div key={i} className="flex items-center gap-2 bg-gray-50 rounded-xl p-2">
                  <Input
                    value={svc.name}
                    onChange={e => updateService(i, 'name', e.target.value)}
                    className="flex-1 rounded-lg bg-white text-sm h-9"
                    placeholder="Serviço"
                  />
                  <Input
                    type="number"
                    value={svc.qty}
                    onChange={e => updateService(i, 'qty', Number(e.target.value))}
                    className="w-16 rounded-lg bg-white text-sm h-9 text-center"
                    min={1}
                  />
                  <Input
                    type="number"
                    value={svc.unit_price}
                    onChange={e => updateService(i, 'unit_price', Number(e.target.value))}
                    className="w-28 rounded-lg bg-white text-sm h-9"
                    step={0.01}
                  />
                  <button onClick={() => removeService(i)} className="p-1.5 text-gray-400 hover:text-red-500">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
              <button
                onClick={() => setServices(prev => [...prev, { id: `new-${Date.now()}`, name: '', qty: 1, unit_price: 0 }])}
                className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1 px-2 py-1"
              >
                <Plus className="h-3.5 w-3.5" /> Adicionar linha
              </button>
            </div>
          </div>

          {/* Total */}
          <div className="flex items-center justify-between bg-gray-50 rounded-xl px-4 py-3">
            <span className="text-sm font-semibold text-gray-700">Total</span>
            <span className="text-lg font-bold" style={{ color: '#374DA4' }}>{fmtBRL(total)}</span>
          </div>

          {/* Notes */}
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 block">Observações</label>
            <Textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Notas adicionais..."
              className="rounded-xl resize-none"
              rows={3}
            />
          </div>

          {/* Download button */}
          <Button
            onClick={generatePDF}
            disabled={generating || services.length === 0}
            className="w-full h-12 rounded-xl text-white gap-2 text-base font-semibold"
            style={{ background: '#374DA4' }}
          >
            {generating ? <Loader2 className="h-5 w-5 animate-spin" /> : <Download className="h-5 w-5" />}
            Baixar Ordem de Serviço em PDF
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
