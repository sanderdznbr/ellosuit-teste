
import { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Save, Download, Plus, Trash2, Users, Palette, FileText, ChevronDown, ChevronUp, Upload, UserPlus, ZoomIn, ZoomOut, Maximize, PanelLeft, PanelLeftClose, Send } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import ProposalPreview from './ProposalPreview';
import ProposalEditablePreview from './ProposalEditablePreview';
import ProposalThemePanel from './ProposalThemePanel';
import SendProposalDialog from './SendProposalDialog';

const SUITE_COLOR = '#374DA4';

interface ProposalItem {
  id?: string;
  name: string;
  description: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  position: number;
}

type EditorTab = 'form' | 'theme';

export default function ProposalEditor() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const proposalId = searchParams.get('id');
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Form state
  const [title, setTitle] = useState('');
  const [clientId, setClientId] = useState<string | null>(null);
  const [validUntil, setValidUntil] = useState('');
  const [notes, setNotes] = useState('');
  const [customTerms, setCustomTerms] = useState('');
  const [discountType, setDiscountType] = useState('none');
  const [discountValue, setDiscountValue] = useState(0);
  const [items, setItems] = useState<ProposalItem[]>([]);
  const [status, setStatus] = useState('rascunho');
  const [saving, setSaving] = useState(false);

  // UI state
  const [activeTab, setActiveTab] = useState<EditorTab>('form');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [showClientPicker, setShowClientPicker] = useState(false);
  const [showServicePicker, setShowServicePicker] = useState(false);
  const [showNewClientForm, setShowNewClientForm] = useState(false);
  const [clientSearch, setClientSearch] = useState('');
  const [expandedItemIndex, setExpandedItemIndex] = useState<number | null>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [showSendDialog, setShowSendDialog] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const pdfRenderRef = useRef<HTMLDivElement>(null);

  // New client form
  const [newClient, setNewClient] = useState({ name: '', email: '', phone: '', company_name: '' });

  // Theme state
  const [theme, setTheme] = useState({
    primaryColor: SUITE_COLOR,
    secondaryColor: '#007DE3',
    fontFamily: 'Inter, sans-serif',
    showHeader: true,
    showFooter: true,
    logoUrl: '',
    headerText: '',
    footerText: '',
    templateId: 'ellosuit',
  });

  // Zoom
  const [zoom, setZoom] = useState(0.75);

  // Queries
  const { data: companyId } = useQuery({
    queryKey: ['user-company', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data } = await supabase.from('company_users').select('company_id').eq('user_id', user.id).single();
      return data?.company_id || null;
    },
    enabled: !!user?.id,
  });

  const { data: company } = useQuery({
    queryKey: ['company-info', companyId],
    queryFn: async () => {
      if (!companyId) return null;
      const { data } = await supabase.from('companies').select('*').eq('id', companyId).single();
      return data;
    },
    enabled: !!companyId,
  });

  const { data: clients = [], refetch: refetchClients } = useQuery({
    queryKey: ['all-clients', companyId],
    queryFn: async () => {
      if (!companyId) return [];
      const { data } = await supabase.from('clients').select('id, name, company_name, email, phone').eq('company_id', companyId).order('name');
      return data || [];
    },
    enabled: !!companyId,
  });

  const { data: services = [] } = useQuery({
    queryKey: ['company-services', companyId],
    queryFn: async () => {
      if (!companyId) return [];
      const { data } = await supabase.from('company_services').select('*').eq('company_id', companyId).eq('is_active', true).order('name');
      return data || [];
    },
    enabled: !!companyId,
  });

  // Create new client mutation
  const createClientMutation = useMutation({
    mutationFn: async () => {
      if (!companyId || !user || !newClient.name.trim()) throw new Error('Nome obrigatório');
      const { data, error } = await supabase.from('clients').insert({
        company_id: companyId, created_by: user.id, name: newClient.name.trim(),
        email: newClient.email || null, phone: newClient.phone || null, company_name: newClient.company_name || null,
      }).select('id').single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      setClientId(data.id);
      setShowNewClientForm(false);
      setShowClientPicker(false);
      setNewClient({ name: '', email: '', phone: '', company_name: '' });
      refetchClients();
      toast({ title: 'Cliente cadastrado e selecionado!' });
    },
    onError: () => toast({ title: 'Erro ao cadastrar cliente', variant: 'destructive' }),
  });

  // Apply template from query params
  useEffect(() => {
    if (proposalId) return;
    const pc = searchParams.get('pc');
    const sc = searchParams.get('sc');
    const font = searchParams.get('font');
    if (pc) setTheme(t => ({ ...t, primaryColor: pc, secondaryColor: sc || t.secondaryColor, fontFamily: font || t.fontFamily }));
  }, []);

  // Load existing proposal
  useEffect(() => {
    if (!proposalId) return;
    const load = async () => {
      const { data: p } = await supabase.from('proposals').select('*').eq('id', proposalId).single();
      if (!p) return;
      setTitle(p.title);
      setClientId(p.client_id);
      setValidUntil(p.valid_until || '');
      setNotes(p.notes || '');
      setCustomTerms(p.custom_terms || '');
      setDiscountType(p.discount_type || 'none');
      setDiscountValue(p.discount_value || 0);
      setStatus(p.status);
      const colors = p.custom_colors as any;
      if (colors?.primary) setTheme(t => ({ ...t, primaryColor: colors.primary, secondaryColor: colors.secondary || '#007DE3' }));
      if (colors?.logoUrl) setTheme(t => ({ ...t, logoUrl: colors.logoUrl }));

      const { data: itemsData } = await supabase.from('proposal_items').select('*').eq('proposal_id', proposalId).order('position');
      if (itemsData) setItems(itemsData.map((it: any) => ({
        id: it.id, name: it.name, description: it.description || '', quantity: Number(it.quantity), unit_price: Number(it.unit_price), total_price: Number(it.total_price), position: it.position,
      })));
    };
    load();
  }, [proposalId]);

  const selectedClient = clients.find((c: any) => c.id === clientId);
  const subtotal = items.reduce((s, it) => s + it.total_price, 0);
  const discountAmount = discountType === 'percent' ? subtotal * (discountValue / 100) : discountType === 'fixed' ? discountValue : 0;
  const total = Math.max(0, subtotal - discountAmount);

  const addItem = (name = '', price = 0, desc = '') => {
    setItems(prev => [...prev, { name, description: desc, quantity: 1, unit_price: price, total_price: price, position: prev.length }]);
    setExpandedItemIndex(items.length);
  };

  const addServiceItem = (service: any) => {
    setItems(prev => [...prev, {
      name: service.name, description: service.description || '',
      quantity: 1, unit_price: Number(service.unit_price), total_price: Number(service.unit_price), position: prev.length,
    }]);
    setShowServicePicker(false);
  };

  const updateItem = (index: number, field: string, value: any) => {
    setItems(prev => prev.map((it, i) => {
      if (i !== index) return it;
      const updated = { ...it, [field]: value };
      if (field === 'quantity' || field === 'unit_price') {
        updated.total_price = (updated.quantity || 0) * (updated.unit_price || 0);
      }
      return updated;
    }));
  };

  const removeItem = (index: number) => setItems(prev => prev.filter((_, i) => i !== index));

  // Logo upload
  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !companyId) return;
    setUploadingLogo(true);
    try {
      const ext = file.name.split('.').pop();
      const path = `${companyId}/proposal-logo-${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage.from('logos').upload(path, file, { upsert: true });
      if (uploadError) throw uploadError;
      const { data: urlData } = supabase.storage.from('logos').getPublicUrl(path);
      setTheme(t => ({ ...t, logoUrl: urlData.publicUrl }));
      toast({ title: 'Logo enviado com sucesso!' });
    } catch {
      toast({ title: 'Erro ao enviar logo', variant: 'destructive' });
    } finally {
      setUploadingLogo(false);
      if (logoInputRef.current) logoInputRef.current.value = '';
    }
  };

  const handleSave = async () => {
    if (!companyId || !user || !title.trim()) {
      toast({ title: 'Preencha o título da proposta', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const payload = {
        company_id: companyId, created_by: user.id, title, client_id: clientId,
        valid_until: validUntil || null, notes: notes || null, custom_terms: customTerms || null,
        discount_type: discountType, discount_value: discountValue, subtotal, total, status,
        custom_colors: { primary: theme.primaryColor, secondary: theme.secondaryColor, logoUrl: theme.logoUrl },
      };
      let savedId = proposalId;
      if (proposalId) {
        await supabase.from('proposals').update(payload).eq('id', proposalId);
        await supabase.from('proposal_items').delete().eq('proposal_id', proposalId);
      } else {
        const { data } = await supabase.from('proposals').insert(payload).select('id').single();
        savedId = data?.id;
      }
      if (savedId && items.length > 0) {
        await supabase.from('proposal_items').insert(
          items.map((it, i) => ({ proposal_id: savedId!, name: it.name, description: it.description || null, quantity: it.quantity, unit_price: it.unit_price, total_price: it.total_price, position: i }))
        );
      }
      queryClient.invalidateQueries({ queryKey: ['proposals'] });
      toast({ title: 'Proposta salva com sucesso!' });
      if (!proposalId && savedId) navigate(`/dashboard/propostas/editor?id=${savedId}`, { replace: true });
    } catch {
      toast({ title: 'Erro ao salvar proposta', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const generatePDF = async () => {
    const el = pdfRenderRef.current;
    if (!el) return;
    toast({ title: 'Gerando PDF…' });
    try {
      el.style.position = 'fixed';
      el.style.left = '-9999px';
      el.style.top = '0';
      el.style.width = '595px';
      el.style.display = 'block';
      el.style.zIndex = '-1';
      await new Promise(r => setTimeout(r, 100));
      const canvas = await html2canvas(el, { scale: 2, useCORS: true, backgroundColor: '#ffffff', width: 595, windowWidth: 595 });
      el.style.display = 'none';
      const imgData = canvas.toDataURL('image/png');
      const doc = new jsPDF('p', 'mm', 'a4');
      const pageW = doc.internal.pageSize.getWidth();
      const pageH = doc.internal.pageSize.getHeight();
      const imgW = pageW;
      const imgH = (canvas.height * pageW) / canvas.width;
      let heightLeft = imgH;
      let position = 0;
      doc.addImage(imgData, 'PNG', 0, position, imgW, imgH);
      heightLeft -= pageH;
      while (heightLeft > 2) {
        position -= pageH;
        doc.addPage();
        doc.addImage(imgData, 'PNG', 0, position, imgW, imgH);
        heightLeft -= pageH;
      }
      doc.save(`${title || 'proposta'}.pdf`);
      toast({ title: 'PDF gerado com sucesso!' });
    } catch {
      toast({ title: 'Erro ao gerar PDF', variant: 'destructive' });
    }
  };

  const filteredClients = clients.filter((c: any) =>
    c.name?.toLowerCase().includes(clientSearch.toLowerCase()) ||
    c.company_name?.toLowerCase().includes(clientSearch.toLowerCase())
  );

  const fmtBRL = (v: number) => `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;

  const zoomIn = () => setZoom(z => Math.min(2, z + 0.1));
  const zoomOut = () => setZoom(z => Math.max(0.3, z - 0.1));
  const zoomFit = () => setZoom(0.75);

  return (
    <div className="h-screen flex flex-col bg-gray-100 overflow-hidden">
      {/* Hidden logo input */}
      <input ref={logoInputRef} type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />

      {/* Top Bar */}
      <div className="bg-white border-b border-gray-200 shrink-0 z-30">
        <div className="flex items-center justify-between px-3 h-12">
          <div className="flex items-center gap-2 min-w-0">
            <button onClick={() => navigate('/dashboard/propostas')} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
              <ArrowLeft className="h-4 w-4 text-gray-500" />
            </button>
            <button onClick={() => setSidebarOpen(s => !s)} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors" title={sidebarOpen ? 'Fechar painel' : 'Abrir painel'}>
              {sidebarOpen ? <PanelLeftClose className="h-4 w-4 text-gray-500" /> : <PanelLeft className="h-4 w-4 text-gray-500" />}
            </button>
            <div className="h-5 w-px bg-gray-200" />
            <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Título da proposta..."
              className="text-sm font-semibold text-gray-900 bg-transparent border-none outline-none placeholder:text-gray-300 w-full max-w-xs" />
          </div>

          {/* Zoom controls */}
          <div className="flex items-center gap-1 bg-gray-100 rounded-lg px-1 py-0.5">
            <button onClick={zoomOut} className="p-1 rounded hover:bg-gray-200 transition-colors"><ZoomOut className="h-3.5 w-3.5 text-gray-500" /></button>
            <span className="text-[10px] font-medium text-gray-500 w-10 text-center select-none">{Math.round(zoom * 100)}%</span>
            <button onClick={zoomIn} className="p-1 rounded hover:bg-gray-200 transition-colors"><ZoomIn className="h-3.5 w-3.5 text-gray-500" /></button>
            <button onClick={zoomFit} className="p-1 rounded hover:bg-gray-200 transition-colors" title="Ajustar"><Maximize className="h-3.5 w-3.5 text-gray-500" /></button>
          </div>

          <div className="flex items-center gap-1.5">
            <Button variant="outline" size="sm" className="rounded-lg h-8 text-xs" onClick={generatePDF} disabled={items.length === 0}>
              <Download className="h-3.5 w-3.5" />
            </Button>
            {proposalId && selectedClient && (
              <Button size="sm" className="rounded-lg h-8 text-white gap-1.5 text-xs" style={{ background: '#16A34A' }}
                onClick={() => setShowSendDialog(true)}>
                <Send className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Enviar</span>
              </Button>
            )}
            <Button size="sm" className="rounded-lg h-8 text-white gap-1.5 text-xs" style={{ background: SUITE_COLOR }} onClick={handleSave} disabled={saving}>
              <Save className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{saving ? 'Salvando...' : 'Salvar'}</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Main area */}
      <div className="flex-1 flex min-h-0">

        {/* LEFT SIDEBAR */}
        <div className={`bg-white border-r border-gray-200 flex flex-col transition-all duration-200 ${sidebarOpen ? 'w-80 xl:w-96' : 'w-0'} overflow-hidden shrink-0`}>
          <div className="flex-1 overflow-y-auto">
            <div className="p-3 space-y-3">
              {/* Editor tabs */}
              <div className="flex gap-1 bg-gray-100 rounded-lg p-0.5">
                <button onClick={() => setActiveTab('form')} className={`flex-1 px-2 py-1.5 rounded-md text-[11px] font-medium transition-all ${activeTab === 'form' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'}`}>
                  <FileText className="h-3 w-3 inline mr-1" />Dados
                </button>
                <button onClick={() => setActiveTab('theme')} className={`flex-1 px-2 py-1.5 rounded-md text-[11px] font-medium transition-all ${activeTab === 'theme' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'}`}>
                  <Palette className="h-3 w-3 inline mr-1" />Tema
                </button>
              </div>

              {activeTab === 'theme' ? (
                <div className="bg-gray-50 rounded-xl border border-gray-100 p-3">
                  <ProposalThemePanel theme={theme} onChange={setTheme} onUploadLogo={() => logoInputRef.current?.click()} uploadingLogo={uploadingLogo} />
                </div>
              ) : (
                <>
                  {/* Validade */}
                  <div className="bg-gray-50 rounded-xl border border-gray-100 p-3">
                    <label className="text-[10px] font-semibold text-gray-400 uppercase mb-1.5 block">Validade</label>
                    <Input type="date" value={validUntil} onChange={e => setValidUntil(e.target.value)} className="rounded-lg h-8 text-xs" />
                  </div>

                  {/* Client */}
                  <div className="bg-gray-50 rounded-xl border border-gray-100 p-3">
                    <label className="text-[10px] font-semibold text-gray-400 uppercase mb-1.5 block">Cliente</label>
                    {selectedClient ? (
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-gray-900 text-xs">{selectedClient.name}</p>
                          <p className="text-[10px] text-gray-500">{selectedClient.company_name || selectedClient.email}</p>
                        </div>
                        <Button variant="ghost" size="sm" onClick={() => setShowClientPicker(true)} className="rounded-lg text-[10px] h-7">Alterar</Button>
                      </div>
                    ) : (
                      <div className="flex gap-1.5">
                        <button onClick={() => setShowClientPicker(true)} className="flex-1 flex items-center gap-1.5 p-2 rounded-lg border border-dashed border-gray-200 text-xs text-gray-400 hover:border-gray-300 transition-colors">
                          <Users className="h-3.5 w-3.5" /> Selecionar
                        </button>
                        <button onClick={() => { setShowNewClientForm(true); setShowClientPicker(true); }}
                          className="flex items-center gap-1 px-2.5 rounded-lg border border-dashed text-[10px] font-medium transition-colors hover:bg-gray-50"
                          style={{ borderColor: SUITE_COLOR + '40', color: SUITE_COLOR }}>
                          <UserPlus className="h-3 w-3" /> Novo
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Items */}
                  <div className="bg-gray-50 rounded-xl border border-gray-100 p-3">
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-[10px] font-semibold text-gray-400 uppercase">Itens</label>
                      <div className="flex gap-0.5">
                        {services.length > 0 && (
                          <Button variant="ghost" size="sm" onClick={() => setShowServicePicker(true)} className="rounded-lg text-[10px] h-6 gap-0.5 px-1.5" style={{ color: SUITE_COLOR }}>
                            <FileText className="h-2.5 w-2.5" /> Catálogo
                          </Button>
                        )}
                        <Button variant="ghost" size="sm" onClick={() => addItem()} className="rounded-lg text-[10px] h-6 gap-0.5 px-1.5" style={{ color: SUITE_COLOR }}>
                          <Plus className="h-2.5 w-2.5" /> Manual
                        </Button>
                      </div>
                    </div>

                    {items.length === 0 ? (
                      <div className="text-center py-6">
                        <div className="w-10 h-10 rounded-xl mx-auto mb-1.5 flex items-center justify-center" style={{ background: SUITE_COLOR + '10' }}>
                          <FileText className="h-4 w-4" style={{ color: SUITE_COLOR }} />
                        </div>
                        <p className="text-[10px] text-gray-400">Adicione itens</p>
                      </div>
                    ) : (
                      <div className="space-y-1.5">
                        {items.map((item, i) => {
                          const expanded = expandedItemIndex === i;
                          return (
                            <div key={i} className="rounded-lg border border-gray-100 bg-white overflow-hidden">
                              <div className="flex items-center gap-1.5 p-2 cursor-pointer hover:bg-gray-50/50" onClick={() => setExpandedItemIndex(expanded ? null : i)}>
                                <div className="flex-1 min-w-0">
                                  <p className="text-[11px] font-medium text-gray-800 truncate">{item.name || 'Item sem nome'}</p>
                                  <p className="text-[9px] text-gray-400">{item.quantity}x {fmtBRL(item.unit_price)} = <span className="font-semibold text-gray-600">{fmtBRL(item.total_price)}</span></p>
                                </div>
                                <button onClick={e => { e.stopPropagation(); removeItem(i); }} className="p-0.5 rounded hover:bg-red-50">
                                  <Trash2 className="h-2.5 w-2.5 text-red-400" />
                                </button>
                                {expanded ? <ChevronUp className="h-3 w-3 text-gray-400" /> : <ChevronDown className="h-3 w-3 text-gray-400" />}
                              </div>
                              {expanded && (
                                <div className="p-2 pt-0 space-y-1.5 border-t border-gray-50">
                                  <Input value={item.name} onChange={e => updateItem(i, 'name', e.target.value)} placeholder="Nome" className="rounded-md h-7 text-[11px]" />
                                  <Input value={item.description} onChange={e => updateItem(i, 'description', e.target.value)} placeholder="Descrição" className="rounded-md h-7 text-[11px]" />
                                  <div className="grid grid-cols-3 gap-1.5">
                                    <div>
                                      <label className="text-[8px] text-gray-400 block">Qtd</label>
                                      <Input type="number" min="1" value={item.quantity} onChange={e => updateItem(i, 'quantity', parseFloat(e.target.value) || 0)} className="rounded-md h-7 text-[11px]" />
                                    </div>
                                    <div>
                                      <label className="text-[8px] text-gray-400 block">Preço (R$)</label>
                                      <Input type="number" step="0.01" value={item.unit_price} onChange={e => updateItem(i, 'unit_price', parseFloat(e.target.value) || 0)} className="rounded-md h-7 text-[11px]" />
                                    </div>
                                    <div>
                                      <label className="text-[8px] text-gray-400 block">Total</label>
                                      <div className="h-7 flex items-center text-[11px] font-semibold" style={{ color: SUITE_COLOR }}>{fmtBRL(item.total_price)}</div>
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Discount & Totals */}
                  {items.length > 0 && (
                    <div className="bg-gray-50 rounded-xl border border-gray-100 p-3 space-y-2">
                      <label className="text-[10px] font-semibold text-gray-400 uppercase">Desconto</label>
                      <div className="flex gap-1.5">
                        <Select value={discountType} onValueChange={setDiscountType}>
                          <SelectTrigger className="w-28 rounded-lg h-8 text-[11px]"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">Nenhum</SelectItem>
                            <SelectItem value="percent">% Percentual</SelectItem>
                            <SelectItem value="fixed">R$ Fixo</SelectItem>
                          </SelectContent>
                        </Select>
                        {discountType !== 'none' && (
                          <Input type="number" step="0.01" value={discountValue} onChange={e => setDiscountValue(parseFloat(e.target.value) || 0)} className="w-20 rounded-lg h-8 text-[11px]" />
                        )}
                      </div>
                      <div className="border-t border-gray-100 pt-2 space-y-0.5">
                        <div className="flex justify-between text-[11px] text-gray-500"><span>Subtotal</span><span>{fmtBRL(subtotal)}</span></div>
                        {discountAmount > 0 && <div className="flex justify-between text-[11px] text-red-500"><span>Desconto</span><span>- {fmtBRL(discountAmount)}</span></div>}
                        <div className="flex justify-between text-sm font-bold pt-1"><span className="text-gray-900">Total</span><span style={{ color: theme.primaryColor }}>{fmtBRL(total)}</span></div>
                      </div>
                    </div>
                  )}

                  {/* Notes & Terms */}
                  <div className="bg-gray-50 rounded-xl border border-gray-100 p-3 space-y-2">
                    <div>
                      <label className="text-[10px] font-semibold text-gray-400 uppercase mb-1 block">Observações</label>
                      <Textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Observações..." className="rounded-lg min-h-[40px] text-[11px]" />
                    </div>
                    <div>
                      <label className="text-[10px] font-semibold text-gray-400 uppercase mb-1 block">Termos e Condições</label>
                      <Textarea value={customTerms} onChange={e => setCustomTerms(e.target.value)} placeholder="Termos..." className="rounded-lg min-h-[40px] text-[11px]" />
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* CENTER: Canvas area with zoom */}
        <div className="flex-1 overflow-auto bg-gray-200/60 relative" style={{ backgroundImage: 'radial-gradient(circle, #d1d5db 1px, transparent 1px)', backgroundSize: '20px 20px' }}>
          <div className="flex items-start justify-center p-8 min-h-full">
            <div style={{ transform: `scale(${zoom})`, transformOrigin: 'top center', width: 595, minHeight: 842 }}
              className="bg-white shadow-2xl rounded-sm overflow-hidden">
              <ProposalEditablePreview
                companyName={company?.name || ''}
                title={title}
                client={selectedClient || null}
                items={items}
                subtotal={subtotal}
                discountAmount={discountAmount}
                total={total}
                notes={notes}
                customTerms={customTerms}
                validUntil={validUntil}
                primaryColor={theme.primaryColor}
                secondaryColor={theme.secondaryColor}
                fontFamily={theme.fontFamily}
                showHeader={theme.showHeader}
                showFooter={theme.showFooter}
                logoUrl={theme.logoUrl}
                headerText={theme.headerText}
                footerText={theme.footerText}
                templateId={theme.templateId}
                onTitleChange={setTitle}
                onNotesChange={setNotes}
                onTermsChange={setCustomTerms}
                onItemChange={(i, field, val) => updateItem(i, field, val)}
                onHeaderTextChange={t => setTheme(prev => ({ ...prev, headerText: t }))}
                onFooterTextChange={t => setTheme(prev => ({ ...prev, footerText: t }))}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Client Picker + New Client Form */}
      <Dialog open={showClientPicker} onOpenChange={v => { setShowClientPicker(v); if (!v) setShowNewClientForm(false); }}>
        <DialogContent className="max-w-md rounded-2xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>{showNewClientForm ? 'Cadastrar Novo Cliente' : 'Selecionar Cliente'}</DialogTitle>
          </DialogHeader>
          {showNewClientForm ? (
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Nome *</label>
                <Input value={newClient.name} onChange={e => setNewClient(p => ({ ...p, name: e.target.value }))} placeholder="Nome completo" className="rounded-xl" required />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Email</label>
                <Input type="email" value={newClient.email} onChange={e => setNewClient(p => ({ ...p, email: e.target.value }))} placeholder="email@exemplo.com" className="rounded-xl" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Telefone</label>
                <Input value={newClient.phone} onChange={e => setNewClient(p => ({ ...p, phone: e.target.value }))} placeholder="(00) 00000-0000" className="rounded-xl" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Empresa</label>
                <Input value={newClient.company_name} onChange={e => setNewClient(p => ({ ...p, company_name: e.target.value }))} placeholder="Nome da empresa (opcional)" className="rounded-xl" />
              </div>
              <div className="flex gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => setShowNewClientForm(false)} className="flex-1 rounded-xl">Voltar</Button>
                <Button type="button" className="flex-1 rounded-xl text-white" style={{ background: SUITE_COLOR }}
                  onClick={() => createClientMutation.mutate()} disabled={!newClient.name.trim() || createClientMutation.isPending}>
                  {createClientMutation.isPending ? 'Salvando...' : 'Cadastrar e Selecionar'}
                </Button>
              </div>
            </div>
          ) : (
            <>
              <div className="flex gap-2 mb-3">
                <Input value={clientSearch} onChange={e => setClientSearch(e.target.value)} placeholder="Buscar cliente..." className="rounded-xl flex-1" />
                <Button variant="outline" size="sm" className="rounded-xl h-10 gap-1.5 shrink-0" style={{ color: SUITE_COLOR, borderColor: SUITE_COLOR + '40' }}
                  onClick={() => setShowNewClientForm(true)}>
                  <UserPlus className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline text-xs">Novo</span>
                </Button>
              </div>
              <div className="max-h-60 overflow-y-auto space-y-1">
                {filteredClients.map((c: any) => (
                  <button key={c.id} onClick={() => { setClientId(c.id); setShowClientPicker(false); }}
                    className={`w-full text-left p-3 rounded-xl transition-colors ${clientId === c.id ? 'bg-gray-100' : 'hover:bg-gray-50'}`}>
                    <p className="font-medium text-sm text-gray-900">{c.name}</p>
                    <p className="text-xs text-gray-500">{c.company_name || c.email || c.phone}</p>
                  </button>
                ))}
                {filteredClients.length === 0 && (
                  <div className="text-center py-6">
                    <p className="text-sm text-gray-400 mb-3">Nenhum cliente encontrado</p>
                    <Button variant="outline" size="sm" className="rounded-xl gap-1.5" style={{ color: SUITE_COLOR }}
                      onClick={() => setShowNewClientForm(true)}>
                      <UserPlus className="h-3.5 w-3.5" /> Cadastrar
                    </Button>
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Service Picker */}
      <Dialog open={showServicePicker} onOpenChange={setShowServicePicker}>
        <DialogContent className="max-w-md rounded-2xl max-h-[80vh]">
          <DialogHeader><DialogTitle>Selecionar do Catálogo</DialogTitle></DialogHeader>
          <div className="max-h-60 overflow-y-auto space-y-1">
            {services.map((s: any) => (
              <button key={s.id} onClick={() => addServiceItem(s)} className="w-full text-left p-3 rounded-xl hover:bg-gray-50 transition-colors">
                <div className="flex justify-between">
                  <p className="font-medium text-sm text-gray-900">{s.name}</p>
                  <span className="text-sm font-semibold" style={{ color: SUITE_COLOR }}>{fmtBRL(Number(s.unit_price))}</span>
                </div>
                {s.description && <p className="text-xs text-gray-500 mt-0.5">{s.description}</p>}
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Hidden container for PDF rendering */}
      <div ref={pdfRenderRef} style={{ display: 'none', width: 595 }}>
        <ProposalPreview
          companyName={company?.name || ''}
          title={title}
          client={selectedClient || null}
          items={items}
          subtotal={subtotal}
          discountAmount={discountAmount}
          total={total}
          notes={notes}
          customTerms={customTerms}
          validUntil={validUntil}
          primaryColor={theme.primaryColor}
          secondaryColor={theme.secondaryColor}
          fontFamily={theme.fontFamily}
          showHeader={theme.showHeader}
          showFooter={theme.showFooter}
          logoUrl={theme.logoUrl}
          headerText={theme.headerText}
          footerText={theme.footerText}
          templateId={theme.templateId}
        />
      </div>

      {/* Send Dialog */}
      {proposalId && selectedClient && (
        <SendProposalDialog
          open={showSendDialog}
          onOpenChange={setShowSendDialog}
          proposalId={proposalId}
          proposalTitle={title}
          clientName={selectedClient.name}
          clientEmail={selectedClient.email}
          clientPhone={selectedClient.phone}
          onSent={() => {
            setStatus('enviada');
            queryClient.invalidateQueries({ queryKey: ['proposals'] });
          }}
        />
      )}
    </div>
  );
}
