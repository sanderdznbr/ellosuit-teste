import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, MoreVertical, Trash2, ArrowLeft, Receipt, Download, Palette, Mail, MessageCircle, Loader2 } from 'lucide-react';
import jsPDF from 'jspdf';
import { useAuth } from '@/hooks/useAuth';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useToast } from '@/hooks/use-toast';
import { useReceiptSettings } from '@/hooks/useReceiptSettings';

const STATUS_MAP: Record<string, { label: string; color: string; bg: string }> = {
  rascunho: { label: 'Rascunho', color: '#6B7280', bg: '#F3F4F6' },
  enviado: { label: 'Enviado', color: '#2F428D', bg: '#DBEAFE' },
  pago: { label: 'Pago', color: '#16A34A', bg: '#DCFCE7' },
  cancelado: { label: 'Cancelado', color: '#DC2626', bg: '#FEE2E2' },
};

const PAYMENT_METHODS = [
  'Dinheiro', 'PIX', 'Cartão de Crédito', 'Cartão de Débito',
  'Transferência Bancária', 'Boleto', 'Cheque', 'Outro',
];

const RECEIPT_COLOR = 'hsl(230, 100%, 50%)';

export default function ReceiptsPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [sendDialog, setSendDialog] = useState<{ receipt: any; method: 'email' | 'whatsapp' } | null>(null);
  const [sendTo, setSendTo] = useState('');
  const [sending, setSending] = useState(false);

  // Create form state
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('PIX');
  const [clientId, setClientId] = useState<string | null>(null);
  const [clientSearch, setClientSearch] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const { data: companyId } = useQuery({
    queryKey: ['user-company', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data } = await supabase.from('company_users').select('company_id').eq('user_id', user.id).single();
      return data?.company_id || null;
    },
    enabled: !!user?.id,
  });

  const { settings: themeSettings } = useReceiptSettings(companyId);

  const { data: receipts = [], isLoading } = useQuery({
    queryKey: ['receipts', companyId],
    queryFn: async () => {
      if (!companyId) return [];
      const { data, error } = await supabase
        .from('receipts')
        .select('*, clients(name, email, phone, company_name, whatsapp)')
        .eq('company_id', companyId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!companyId,
  });

  const { data: clients = [] } = useQuery({
    queryKey: ['all-clients', companyId],
    queryFn: async () => {
      if (!companyId) return [];
      const { data } = await supabase.from('clients').select('id, name, company_name, email, phone, cnpj_cpf, whatsapp').eq('company_id', companyId).order('name');
      return data || [];
    },
    enabled: !!companyId,
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('receipts').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['receipts'] });
      toast({ title: 'Recibo excluído' });
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from('receipts').update({ status }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['receipts'] });
      toast({ title: 'Status atualizado!' });
    },
  });

  const handleCreate = async () => {
    if (!companyId || !user || !title.trim() || !amount) {
      toast({ title: 'Preencha título e valor', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const selectedClient = clients.find((c: any) => c.id === clientId);
      const { error } = await supabase.from('receipts').insert({
        company_id: companyId,
        created_by: user.id,
        title: title.trim(),
        amount: parseFloat(amount),
        description: description || null,
        payment_method: paymentMethod,
        client_id: clientId,
        client_name: selectedClient?.name || null,
        client_document: selectedClient?.cnpj_cpf || null,
        notes: notes || null,
      });
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ['receipts'] });
      toast({ title: 'Recibo criado com sucesso!' });
      resetForm();
      setShowCreateDialog(false);
    } catch {
      toast({ title: 'Erro ao criar recibo', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const resetForm = () => {
    setTitle(''); setAmount(''); setDescription(''); setPaymentMethod('PIX'); setClientId(null); setNotes('');
  };

  const filtered = receipts.filter((r: any) => {
    const matchesSearch = r.title?.toLowerCase().includes(search.toLowerCase()) ||
      r.receipt_number?.toLowerCase().includes(search.toLowerCase()) ||
      r.client_name?.toLowerCase().includes(search.toLowerCase()) ||
      (r.clients as any)?.name?.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'all' || r.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const filteredClients = clients.filter((c: any) =>
    c.name?.toLowerCase().includes(clientSearch.toLowerCase()) ||
    c.company_name?.toLowerCase().includes(clientSearch.toLowerCase())
  );

  const stats = {
    total: receipts.length,
    pagos: receipts.filter((r: any) => r.status === 'pago').length,
    enviados: receipts.filter((r: any) => r.status === 'enviado').length,
    valorTotal: receipts.filter((r: any) => r.status === 'pago').reduce((s: number, r: any) => s + (Number(r.amount) || 0), 0),
  };

  const fmtBRL = (v: number) => `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
  const selectedClient = clients.find((c: any) => c.id === clientId);

  const formatRelativeDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return 'Hoje';
    if (diffDays === 1) return 'Ontem';
    if (diffDays < 7) return `${diffDays} dias atrás`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} sem. atrás`;
    return `${Math.floor(diffDays / 30)} meses atrás`;
  };

  const openSendDialog = (receipt: any, method: 'email' | 'whatsapp') => {
    const client = receipt.clients;
    const defaultTo = method === 'email'
      ? (client?.email || '')
      : (client?.whatsapp || client?.phone || '');
    setSendTo(defaultTo);
    setSendDialog({ receipt, method });
  };

  const handleSend = async () => {
    if (!sendDialog || !sendTo.trim()) {
      toast({ title: 'Preencha o destinatário', variant: 'destructive' });
      return;
    }
    setSending(true);
    try {
      const { receipt, method } = sendDialog;
      const { data, error } = await supabase.functions.invoke('send-receipt', {
        body: {
          receipt_id: receipt.id,
          send_method: method,
          recipient: sendTo.trim(),
        },
      });
      if (error) throw error;
      toast({ title: method === 'email' ? '✅ Recibo enviado por email!' : '✅ Recibo enviado por WhatsApp!' });
      updateStatusMutation.mutate({ id: receipt.id, status: 'enviado' });
      setSendDialog(null);
      setSendTo('');
    } catch (e: any) {
      toast({ title: 'Erro ao enviar', description: e.message, variant: 'destructive' });
    } finally {
      setSending(false);
    }
  };

  // ── PDF generation (kept as-is) ──
  const downloadPDF = async (r: any) => {
    const doc = new jsPDF();
    const pw = doc.internal.pageSize.getWidth();
    const clientName = r.client_name || (r.clients as any)?.name || 'N/A';
    const ts = themeSettings;
    let y = 20;

    const hexToRgb = (hex: string) => {
      const h = hex.replace('#', '');
      return { r: parseInt(h.substring(0, 2), 16), g: parseInt(h.substring(2, 4), 16), b: parseInt(h.substring(4, 6), 16) };
    };
    const pc = hexToRgb(ts.primary_color);
    const sc = hexToRgb(ts.secondary_color);
    const tc = hexToRgb(ts.text_color);
    const ac = hexToRgb(ts.accent_color);

    let logoImg: HTMLImageElement | null = null;
    if (ts.logo_url) {
      try {
        logoImg = await new Promise<HTMLImageElement>((resolve, reject) => {
          const img = new Image();
          img.crossOrigin = 'anonymous';
          img.onload = () => resolve(img);
          img.onerror = reject;
          img.src = ts.logo_url!;
        });
      } catch { logoImg = null; }
    }

    const addLogo = (x: number, yPos: number, maxH: number) => {
      if (!logoImg) return;
      const ratio = logoImg.width / logoImg.height;
      const h = maxH;
      const w = h * ratio;
      doc.addImage(logoImg, 'PNG', x, yPos, Math.min(w, 50), h);
    };

    if (ts.show_border) {
      doc.setDrawColor(pc.r, pc.g, pc.b);
      doc.setLineWidth(0.5);
      doc.rect(10, 10, pw - 20, doc.internal.pageSize.getHeight() - 20);
    }

    if (ts.layout_style === 'modern') {
      doc.setFillColor(pc.r, pc.g, pc.b);
      doc.rect(0, 0, pw, 42, 'F');
      if (logoImg) {
        const lx = ts.logo_position === 'right' ? pw - 50 : ts.logo_position === 'center' ? pw / 2 - 8 : 14;
        addLogo(lx, 6, 12);
      }
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(22);
      doc.setFont('helvetica', 'bold');
      const titleX = logoImg && ts.logo_position === 'left' ? 50 : 14;
      doc.text('RECIBO', titleX, y + 4);
      doc.setFontSize(11);
      doc.setFont('helvetica', 'normal');
      doc.text(r.receipt_number || '', pw - 14, y + 4, { align: 'right' });
      if (ts.company_name) { doc.setFontSize(9); doc.text(ts.company_name, titleX, y + 12); }
      if (ts.company_cnpj) { doc.setFontSize(8); doc.text(`CNPJ: ${ts.company_cnpj}`, titleX, y + 17); }
      y = 52;
    } else if (ts.layout_style === 'corporate') {
      const logoH = 18;
      if (logoImg) addLogo(14, 14, logoH);
      const textStartX = logoImg ? 14 + (logoH * (logoImg.width / logoImg.height)) + 8 : 14;
      doc.setTextColor(pc.r, pc.g, pc.b);
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('RECIBO', pw - 14, y, { align: 'right' });
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(ac.r, ac.g, ac.b);
      doc.text(r.receipt_number || '', pw - 14, y + 6, { align: 'right' });
      if (ts.company_name) { doc.setTextColor(tc.r, tc.g, tc.b); doc.setFont('helvetica', 'bold'); doc.setFontSize(12); doc.text(ts.company_name, textStartX, y); }
      let infoY = y + 6;
      doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(ac.r, ac.g, ac.b);
      if (ts.company_cnpj) { doc.text(`CNPJ: ${ts.company_cnpj}`, textStartX, infoY); infoY += 5; }
      if (ts.company_address) { doc.text(ts.company_address, textStartX, infoY); infoY += 5; }
      if (ts.company_phone) { doc.text(`Tel: ${ts.company_phone}`, textStartX, infoY); infoY += 5; }
      if (ts.company_email) { doc.text(ts.company_email, textStartX, infoY); infoY += 5; }
      y = Math.max(infoY + 6, logoImg ? 14 + logoH + 8 : 40);
      doc.setDrawColor(pc.r, pc.g, pc.b); doc.setLineWidth(0.5); doc.line(14, y, pw - 14, y); y += 8;
    } else {
      if (logoImg) {
        const lx = ts.layout_style === 'classic' ? pw / 2 - 8 : 14;
        addLogo(lx, 14, 12);
        y = 34;
      }
      doc.setTextColor(pc.r, pc.g, pc.b); doc.setFontSize(18); doc.setFont('helvetica', 'bold');
      doc.text('RECIBO', ts.layout_style === 'classic' ? pw / 2 : 14, y, ts.layout_style === 'classic' ? { align: 'center' } : undefined);
      y += 8;
      if (ts.company_name) { doc.setFontSize(10); doc.setTextColor(tc.r, tc.g, tc.b); doc.text(ts.company_name, ts.layout_style === 'classic' ? pw / 2 : 14, y, ts.layout_style === 'classic' ? { align: 'center' } : undefined); y += 5; }
      if (ts.company_cnpj) { doc.setFontSize(8); doc.setTextColor(ac.r, ac.g, ac.b); doc.text(`CNPJ: ${ts.company_cnpj}`, ts.layout_style === 'classic' ? pw / 2 : 14, y, ts.layout_style === 'classic' ? { align: 'center' } : undefined); y += 5; }
      doc.setDrawColor(200, 200, 200); doc.line(14, y, pw - 14, y); y += 8;
    }

    doc.setTextColor(ac.r, ac.g, ac.b); doc.setFontSize(9);
    doc.text(`Nº ${r.receipt_number || ''}`, 14, y);
    doc.text(`Data: ${format(new Date(r.created_at), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}`, pw - 14, y, { align: 'right' });
    y += 12;

    doc.setFillColor(sc.r, sc.g, sc.b);
    doc.roundedRect(14, y - 6, pw - 28, 24, 4, 4, 'F');
    doc.setTextColor(pc.r, pc.g, pc.b); doc.setFontSize(10); doc.setFont('helvetica', 'bold');
    doc.text('VALOR', 20, y + 2);
    doc.setFontSize(18);
    doc.text(fmtBRL(Number(r.amount) || 0), 20, y + 14);
    y += 32;

    const addField = (label: string, value: string) => {
      if (!value || value === 'N/A') return;
      doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(ac.r, ac.g, ac.b);
      doc.text(label, 14, y);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(tc.r, tc.g, tc.b);
      const lines = doc.splitTextToSize(value, pw - 28);
      doc.text(lines, 14, y + 5);
      y += 5 + lines.length * 5 + 6;
    };

    addField('TÍTULO', r.title);
    addField('CLIENTE', clientName);
    if (r.client_document) addField('DOCUMENTO', r.client_document);
    addField('FORMA DE PAGAMENTO', r.payment_method || 'N/A');
    if (r.description) addField('DESCRIÇÃO', r.description);
    if (r.notes) addField('OBSERVAÇÕES', r.notes);

    if (ts.show_watermark && ts.watermark_text) {
      doc.setTextColor(pc.r, pc.g, pc.b); doc.setFontSize(50); doc.setFont('helvetica', 'bold');
      doc.setGState(doc.GState({ opacity: 0.06 }));
      doc.text(ts.watermark_text, pw / 2, 160, { align: 'center', angle: 30 });
      doc.setGState(doc.GState({ opacity: 1 }));
    }

    y = Math.max(y + 5, 220);
    doc.setDrawColor(200, 200, 200); doc.line(14, y, pw - 14, y); y += 8;
    doc.setFontSize(8); doc.setTextColor(ac.r, ac.g, ac.b);
    doc.text(ts.footer_text || 'Documento gerado eletronicamente', pw / 2, y, { align: 'center' });
    if (ts.company_email) { y += 4; doc.text(ts.company_email, pw / 2, y, { align: 'center' }); }
    if (ts.company_website) { y += 4; doc.text(ts.company_website, pw / 2, y, { align: 'center' }); }

    doc.save(`${r.receipt_number || 'recibo'}.pdf`);
  };

  return (
    <div className="min-h-screen bg-gray-50/50">
      <div className="max-w-6xl mx-auto px-4 md:px-6 py-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate('/dashboard/suite')} className="p-2 rounded-xl hover:bg-gray-100 transition-colors">
              <ArrowLeft className="h-5 w-5 text-gray-500" />
            </button>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Recibos</h1>
              <p className="text-sm text-gray-500">Gere, gerencie e envie recibos de pagamento</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => navigate('/dashboard/recibos/design')} className="rounded-xl h-11 gap-2">
              <Palette className="h-4 w-4" />
              <span className="hidden sm:inline">Design</span>
            </Button>
            <Button onClick={() => setShowCreateDialog(true)} className="rounded-xl h-11 gap-2 text-white shadow-lg" style={{ background: RECEIPT_COLOR }}>
              <Plus className="h-4 w-4" /> Novo Recibo
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          {[
            { label: 'Total', value: stats.total, color: RECEIPT_COLOR },
            { label: 'Pagos', value: stats.pagos, color: '#16A34A' },
            { label: 'Enviados', value: stats.enviados, color: '#2F428D' },
            { label: 'Valor Recebido', value: fmtBRL(stats.valorTotal), color: '#D97706' },
          ].map((s, i) => (
            <div key={i} className="bg-white rounded-2xl border border-gray-100 p-4">
              <p className="text-xs text-gray-500 mb-1">{s.label}</p>
              <p className="text-lg font-bold" style={{ color: s.color }}>{s.value}</p>
            </div>
          ))}
        </div>

        {/* Main Card */}
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          {/* Search + Filter */}
          <div className="p-4 flex flex-col sm:flex-row items-start sm:items-center gap-3">
            <div className="relative flex-1 max-w-sm w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input placeholder="Pesquisar recibo..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 border-gray-200 bg-gray-50 rounded-xl focus:bg-white" />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[140px] rounded-xl border-gray-200">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="rascunho">Rascunho</SelectItem>
                <SelectItem value="enviado">Enviados</SelectItem>
                <SelectItem value="pago">Pagos</SelectItem>
                <SelectItem value="cancelado">Cancelados</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Table Header (desktop) */}
          <div className="hidden md:grid grid-cols-[1fr_120px_100px_120px_260px] gap-4 px-4 py-3 border-t border-b border-gray-100 bg-gray-50/50 text-xs font-medium text-gray-500 uppercase tracking-wider">
            <div>Recibo</div>
            <div>Valor</div>
            <div>Status</div>
            <div>Data</div>
            <div className="text-right">Ações</div>
          </div>

          {/* List */}
          {isLoading ? (
            <div className="p-8 flex items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin" style={{ color: RECEIPT_COLOR }} />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16">
              <div className="w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center" style={{ background: RECEIPT_COLOR + '12' }}>
                <Receipt className="h-7 w-7" style={{ color: RECEIPT_COLOR }} />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-1">Nenhum recibo encontrado</h3>
              <p className="text-sm text-gray-500 mb-4">{search ? 'Tente uma busca diferente' : 'Crie seu primeiro recibo para começar'}</p>
              {!search && (
                <Button onClick={() => setShowCreateDialog(true)} className="rounded-xl text-white" style={{ background: RECEIPT_COLOR }}>
                  <Plus className="h-4 w-4 mr-1.5" /> Criar Recibo
                </Button>
              )}
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {filtered.map((r: any) => {
                const status = STATUS_MAP[r.status] || STATUS_MAP.rascunho;
                const clientName = r.client_name || (r.clients as any)?.name || 'Sem cliente';
                return (
                  <div key={r.id} className="grid grid-cols-1 md:grid-cols-[1fr_120px_100px_120px_260px] gap-2 md:gap-4 px-4 py-4 items-center hover:bg-gray-50/50 transition-colors">
                    {/* Info */}
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-xl flex-shrink-0 flex items-center justify-center" style={{ background: RECEIPT_COLOR + '12' }}>
                        <Receipt className="h-4 w-4" style={{ color: RECEIPT_COLOR }} />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-gray-900 truncate">{r.title}</span>
                          <span className="text-[10px] font-mono text-gray-400">{r.receipt_number}</span>
                        </div>
                        <p className="text-xs text-gray-500 truncate">{clientName}{r.payment_method ? ` · ${r.payment_method}` : ''}</p>
                      </div>
                    </div>

                    {/* Value */}
                    <div className="hidden md:block">
                      <span className="text-sm font-bold" style={{ color: RECEIPT_COLOR }}>{fmtBRL(Number(r.amount) || 0)}</span>
                    </div>

                    {/* Status */}
                    <div>
                      <Badge className="text-[10px] px-2 py-0.5 border-0" style={{ color: status.color, backgroundColor: status.bg }}>
                        {status.label}
                      </Badge>
                    </div>

                    {/* Date */}
                    <div className="hidden md:block text-sm text-gray-500">
                      {formatRelativeDate(r.created_at)}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 rounded-lg gap-1.5 text-xs font-medium"
                        onClick={() => downloadPDF(r)}
                      >
                        <Download className="h-3.5 w-3.5" />
                        PDF
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 text-gray-500 hover:text-[#2F428D]"
                        onClick={() => openSendDialog(r, 'email')}
                        title="Enviar por Email"
                      >
                        <Mail className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 text-gray-500 hover:text-green-600"
                        onClick={() => openSendDialog(r, 'whatsapp')}
                        title="Enviar por WhatsApp"
                      >
                        <MessageCircle className="h-4 w-4" />
                      </Button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button className="p-1.5 rounded-lg hover:bg-gray-100">
                            <MoreVertical className="h-4 w-4 text-gray-400" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <div className="px-2 py-1.5">
                            <p className="text-[10px] font-semibold text-gray-400 uppercase mb-1">Alterar Status</p>
                            <div className="flex flex-col gap-0.5">
                              {Object.entries(STATUS_MAP).map(([key, val]) => (
                                <button
                                  key={key}
                                  onClick={() => updateStatusMutation.mutate({ id: r.id, status: key })}
                                  className={`flex items-center gap-2 px-2 py-1.5 rounded-md text-xs text-left transition-colors ${r.status === key ? 'bg-gray-100 font-semibold' : 'hover:bg-gray-50'}`}
                                >
                                  <span className="w-2 h-2 rounded-full" style={{ background: val.color }} />
                                  {val.label}
                                </button>
                              ))}
                            </div>
                          </div>
                          <DropdownMenuItem onClick={() => deleteMutation.mutate(r.id)} className="text-red-600">
                            <Trash2 className="h-4 w-4 mr-2" /> Excluir
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Send Receipt Dialog */}
      <Dialog open={!!sendDialog} onOpenChange={(open) => { if (!open) { setSendDialog(null); setSendTo(''); } }}>
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {sendDialog?.method === 'email' ? <Mail className="h-5 w-5 text-[#2F428D]" /> : <MessageCircle className="h-5 w-5 text-green-600" />}
              Enviar Recibo por {sendDialog?.method === 'email' ? 'Email' : 'WhatsApp'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="bg-gray-50 rounded-xl p-3">
              <p className="text-xs text-gray-500">Recibo</p>
              <p className="font-semibold text-sm text-gray-900">{sendDialog?.receipt?.receipt_number} — {sendDialog?.receipt?.title}</p>
              <p className="text-xs text-gray-500 mt-1">Valor: {fmtBRL(Number(sendDialog?.receipt?.amount) || 0)}</p>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 mb-1 block">
                {sendDialog?.method === 'email' ? 'Email do destinatário' : 'WhatsApp do destinatário'}
              </label>
              <Input
                value={sendTo}
                onChange={e => setSendTo(e.target.value)}
                placeholder={sendDialog?.method === 'email' ? 'email@exemplo.com' : '5511999999999'}
                className="rounded-xl"
              />
            </div>
            <div className="flex gap-2 pt-2">
              <Button variant="outline" onClick={() => { setSendDialog(null); setSendTo(''); }} className="flex-1 rounded-xl">
                Cancelar
              </Button>
              <Button
                onClick={handleSend}
                disabled={sending || !sendTo.trim()}
                className="flex-1 rounded-xl text-white gap-2"
                style={{ background: sendDialog?.method === 'email' ? '#2F428D' : '#16A34A' }}
              >
                {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : sendDialog?.method === 'email' ? <Mail className="h-4 w-4" /> : <MessageCircle className="h-4 w-4" />}
                {sending ? 'Enviando...' : 'Enviar'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Create Receipt Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={v => { setShowCreateDialog(v); if (!v) resetForm(); }}>
        <DialogContent className="max-w-lg rounded-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Receipt className="h-5 w-5" style={{ color: RECEIPT_COLOR }} />
              Novo Recibo
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-gray-500 mb-1 block">Título / Referência *</label>
              <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Ex: Serviço de manutenção" className="rounded-xl" />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 mb-1 block">Valor (R$) *</label>
              <Input type="number" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" className="rounded-xl text-lg font-bold" />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 mb-1 block">Forma de Pagamento</label>
              <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PAYMENT_METHODS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 mb-1 block">Cliente</label>
              {selectedClient ? (
                <div className="flex items-center justify-between bg-gray-50 rounded-xl p-3">
                  <div>
                    <p className="font-medium text-sm text-gray-900">{selectedClient.name}</p>
                    <p className="text-xs text-gray-500">{(selectedClient as any).cnpj_cpf || (selectedClient as any).email}</p>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => setClientId(null)} className="rounded-lg text-xs h-7">Alterar</Button>
                </div>
              ) : (
                <div>
                  <Input value={clientSearch} onChange={e => setClientSearch(e.target.value)} placeholder="Buscar cliente..." className="rounded-xl mb-2" />
                  <div className="max-h-32 overflow-y-auto space-y-1">
                    {filteredClients.slice(0, 5).map((c: any) => (
                      <button key={c.id} onClick={() => { setClientId(c.id); setClientSearch(''); }} className="w-full text-left p-2 rounded-lg hover:bg-gray-50 transition-colors">
                        <p className="text-xs font-medium text-gray-900">{c.name}</p>
                        <p className="text-[10px] text-gray-500">{c.cnpj_cpf || c.email}</p>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 mb-1 block">Descrição do Serviço</label>
              <Textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Descreva o serviço prestado..." className="rounded-xl min-h-[80px]" />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 mb-1 block">Observações</label>
              <Textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Observações adicionais..." className="rounded-xl min-h-[60px]" />
            </div>
            <div className="flex gap-2 pt-2">
              <Button variant="outline" onClick={() => { setShowCreateDialog(false); resetForm(); }} className="flex-1 rounded-xl">Cancelar</Button>
              <Button onClick={handleCreate} disabled={saving || !title.trim() || !amount} className="flex-1 rounded-xl text-white gap-2" style={{ background: RECEIPT_COLOR }}>
                {saving ? 'Salvando...' : 'Criar Recibo'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
