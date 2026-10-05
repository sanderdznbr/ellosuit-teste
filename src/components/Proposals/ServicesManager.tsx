
import { useState } from 'react';
import { Plus, Pencil, Trash2, Package, ChevronDown, ChevronUp, X, Eye, EyeOff, DollarSign, Clock, Shield, CheckCircle2, Layers } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Switch } from '@/components/ui/switch';

interface CostItem {
  name: string;
  value: number;
}

interface ServiceForm {
  name: string;
  description: string;
  unit_price: string;
  unit_label: string;
  category: string;
  service_type: string;
  cost_price: string;
  cost_items: CostItem[];
  show_cost_to_client: boolean;
  included_items: string[];
  duration_estimate: string;
  warranty_info: string;
}

const emptyForm: ServiceForm = {
  name: '', description: '', unit_price: '', unit_label: 'unidade', category: '',
  service_type: 'service', cost_price: '', cost_items: [], show_cost_to_client: false,
  included_items: [], duration_estimate: '', warranty_info: '',
};

const SERVICE_TYPES = [
  { value: 'service', label: 'Serviço' },
  { value: 'product', label: 'Produto' },
  { value: 'package', label: 'Pacote' },
  { value: 'subscription', label: 'Assinatura' },
];

const UNIT_OPTIONS = [
  'unidade', 'hora', 'dia', 'mês', 'projeto', 'metro', 'm²', 'kg', 'litro', 'ponto', 'visita', 'sessão', 'aula', 'consulta',
];

const CATEGORY_SUGGESTIONS = [
  'Marketing', 'TI', 'Design', 'Consultoria', 'Elétrica', 'Hidráulica', 'Construção',
  'Saúde', 'Educação', 'Jurídico', 'Contabilidade', 'Fotografia', 'Eventos', 'Limpeza',
  'Manutenção', 'Transporte', 'Alimentação', 'Beleza', 'Automotivo', 'Segurança',
];

function formatBRL(value: string): string {
  const num = value.replace(/\D/g, '');
  if (!num) return '';
  const cents = parseInt(num, 10);
  return (cents / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function parseBRL(formatted: string): number {
  if (!formatted) return 0;
  return parseFloat(formatted.replace(/\./g, '').replace(',', '.')) || 0;
}

interface Props {
  companyId: string | null;
}

export default function ServicesManager({ companyId }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [form, setForm] = useState<ServiceForm>({ ...emptyForm });
  const [newIncluded, setNewIncluded] = useState('');
  const [newCostName, setNewCostName] = useState('');
  const [newCostValue, setNewCostValue] = useState('');
  const [expandedSection, setExpandedSection] = useState<string | null>('basic');
  const [showCategorySuggestions, setShowCategorySuggestions] = useState(false);

  const { data: services = [], isLoading } = useQuery({
    queryKey: ['company-services', companyId],
    queryFn: async () => {
      if (!companyId) return [];
      const { data, error } = await supabase
        .from('company_services')
        .select('*')
        .eq('company_id', companyId)
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return data || [];
    },
    enabled: !!companyId,
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!companyId || !user) return;
      const payload: any = {
        company_id: companyId,
        created_by: user.id,
        name: form.name,
        description: form.description || null,
        unit_price: parseBRL(form.unit_price),
        unit_label: form.unit_label || 'unidade',
        category: form.category || null,
        service_type: form.service_type,
        cost_price: parseBRL(form.cost_price),
        cost_items: form.cost_items,
        show_cost_to_client: form.show_cost_to_client,
        included_items: form.included_items,
        duration_estimate: form.duration_estimate || null,
        warranty_info: form.warranty_info || null,
      };
      if (editing) {
        const { error } = await supabase.from('company_services').update(payload).eq('id', editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('company_services').insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company-services'] });
      toast({ title: editing ? 'Serviço atualizado' : 'Serviço cadastrado' });
      closeForm();
    },
    onError: () => toast({ title: 'Erro ao salvar', variant: 'destructive' }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('company_services').update({ is_active: false }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company-services'] });
      toast({ title: 'Serviço removido' });
    },
  });

  const openEdit = (s: any) => {
    setEditing(s);
    setForm({
      name: s.name,
      description: s.description || '',
      unit_price: s.unit_price ? (s.unit_price).toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : '',
      unit_label: s.unit_label || 'unidade',
      category: s.category || '',
      service_type: s.service_type || 'service',
      cost_price: s.cost_price ? (s.cost_price).toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : '',
      cost_items: Array.isArray(s.cost_items) ? s.cost_items : [],
      show_cost_to_client: s.show_cost_to_client || false,
      included_items: Array.isArray(s.included_items) ? s.included_items : [],
      duration_estimate: s.duration_estimate || '',
      warranty_info: s.warranty_info || '',
    });
    setShowForm(true);
    setExpandedSection('basic');
  };

  const closeForm = () => {
    setShowForm(false);
    setEditing(null);
    setForm({ ...emptyForm });
    setNewIncluded('');
    setNewCostName('');
    setNewCostValue('');
    setExpandedSection('basic');
  };

  const handlePriceChange = (field: 'unit_price' | 'cost_price', raw: string) => {
    setForm(p => ({ ...p, [field]: formatBRL(raw) }));
  };

  const addIncludedItem = () => {
    if (!newIncluded.trim()) return;
    setForm(p => ({ ...p, included_items: [...p.included_items, newIncluded.trim()] }));
    setNewIncluded('');
  };

  const removeIncludedItem = (idx: number) => {
    setForm(p => ({ ...p, included_items: p.included_items.filter((_, i) => i !== idx) }));
  };

  const addCostItem = () => {
    if (!newCostName.trim()) return;
    const val = parseBRL(newCostValue);
    setForm(p => ({ ...p, cost_items: [...p.cost_items, { name: newCostName.trim(), value: val }] }));
    setNewCostName('');
    setNewCostValue('');
  };

  const removeCostItem = (idx: number) => {
    setForm(p => ({ ...p, cost_items: p.cost_items.filter((_, i) => i !== idx) }));
  };

  const totalCost = form.cost_items.reduce((s, c) => s + c.value, 0);
  const profit = parseBRL(form.unit_price) - (parseBRL(form.cost_price) || totalCost);

  const Section = ({ id, icon: Icon, title, children }: { id: string; icon: any; title: string; children: React.ReactNode }) => {
    const open = expandedSection === id;
    return (
      <div className="border border-gray-100 rounded-xl overflow-hidden">
        <button type="button" onClick={() => setExpandedSection(open ? null : id)} className="w-full flex items-center justify-between p-3.5 bg-gray-50/60 hover:bg-gray-50 transition-colors">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg" style={{ backgroundColor: '#374DA412' }}>
              <Icon className="h-3.5 w-3.5" style={{ color: '#374DA4' }} />
            </div>
            <span className="text-sm font-semibold text-gray-800">{title}</span>
          </div>
          {open ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
        </button>
        {open && <div className="p-4 space-y-3.5 bg-white">{children}</div>}
      </div>
    );
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Catálogo de Serviços & Produtos</h2>
          <p className="text-sm text-gray-500">Cadastre itens para usar nas propostas</p>
        </div>
        <Button onClick={() => { setShowForm(true); setExpandedSection('basic'); }} className="rounded-xl h-10 gap-2 text-white" style={{ background: '#374DA4' }}>
          <Plus className="h-4 w-4" />
          <span className="hidden md:inline">Novo Item</span>
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map(i => <div key={i} className="bg-white rounded-2xl border border-gray-100 p-4 animate-pulse h-16" />)}
        </div>
      ) : services.length === 0 ? (
        <div className="text-center py-12">
          <div className="w-14 h-14 rounded-2xl mx-auto mb-3 flex items-center justify-center" style={{ background: '#374DA412' }}>
            <Package className="h-6 w-6" style={{ color: '#374DA4' }} />
          </div>
          <h3 className="font-semibold text-gray-900 mb-1">Nenhum serviço cadastrado</h3>
          <p className="text-sm text-gray-500 mb-4">Cadastre seus serviços ou produtos</p>
          <Button onClick={() => setShowForm(true)} className="rounded-xl text-white" style={{ background: '#374DA4' }}>
            <Plus className="h-4 w-4 mr-1.5" /> Cadastrar
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          {services.map((s: any) => (
            <div key={s.id} className="bg-white rounded-2xl border border-gray-100 p-4 flex items-center justify-between hover:border-gray-200 transition-all">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-medium text-gray-900 truncate">{s.name}</h3>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">
                    {SERVICE_TYPES.find(t => t.value === (s.service_type || 'service'))?.label || 'Serviço'}
                  </span>
                  {s.category && <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">{s.category}</span>}
                </div>
                {s.description && <p className="text-xs text-gray-500 mt-0.5 truncate">{s.description}</p>}
              </div>
              <div className="flex items-center gap-3 ml-3">
                <span className="text-sm font-bold text-gray-900 whitespace-nowrap">
                  R$ {Number(s.unit_price).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  <span className="text-xs text-gray-400 font-normal ml-1">/{s.unit_label}</span>
                </span>
                <button onClick={() => openEdit(s)} className="p-1.5 rounded-lg hover:bg-gray-100"><Pencil className="h-3.5 w-3.5 text-gray-400" /></button>
                <button onClick={() => deleteMutation.mutate(s.id)} className="p-1.5 rounded-lg hover:bg-red-50"><Trash2 className="h-3.5 w-3.5 text-red-400" /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={showForm} onOpenChange={v => !v && closeForm()}>
        <DialogContent className="max-w-lg rounded-2xl max-h-[90vh] overflow-y-auto p-0">
          <DialogHeader className="p-5 pb-3 border-b border-gray-100 sticky top-0 bg-white z-10 rounded-t-2xl">
            <DialogTitle className="text-lg">{editing ? 'Editar Item' : 'Novo Serviço / Produto'}</DialogTitle>
            <p className="text-xs text-gray-500 mt-0.5">Preencha as informações do seu item. Expanda as seções para mais detalhes.</p>
          </DialogHeader>

          <form onSubmit={e => { e.preventDefault(); saveMutation.mutate(); }} className="p-5 pt-3 space-y-3">

            {/* BASIC INFO */}
            <Section id="basic" icon={Package} title="Informações Básicas">
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Tipo *</label>
                <div className="grid grid-cols-4 gap-1.5">
                  {SERVICE_TYPES.map(t => (
                    <button key={t.value} type="button" onClick={() => setForm(p => ({ ...p, service_type: t.value }))}
                      className={`text-xs py-2 rounded-lg border transition-all font-medium ${form.service_type === t.value ? 'border-[#374DA4] bg-[#374DA4]/5 text-[#374DA4]' : 'border-gray-200 text-gray-500 hover:border-gray-300'}`}>
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Nome *</label>
                <Input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="Ex: Instalação Elétrica Residencial" className="rounded-xl" required />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Descrição</label>
                <Textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} placeholder="Descreva detalhadamente o serviço ou produto oferecido..." className="rounded-xl min-h-[70px]" />
              </div>
              <div className="relative">
                <label className="text-xs font-medium text-gray-600 mb-1 block">Categoria</label>
                <Input value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))} onFocus={() => setShowCategorySuggestions(true)} onBlur={() => setTimeout(() => setShowCategorySuggestions(false), 200)} placeholder="Digite ou selecione" className="rounded-xl" />
                {showCategorySuggestions && (
                  <div className="absolute z-20 top-full mt-1 left-0 right-0 bg-white border border-gray-200 rounded-xl shadow-lg max-h-32 overflow-y-auto">
                    {CATEGORY_SUGGESTIONS.filter(c => !form.category || c.toLowerCase().includes(form.category.toLowerCase())).map(c => (
                      <button key={c} type="button" onMouseDown={() => setForm(p => ({ ...p, category: c }))} className="w-full text-left text-xs px-3 py-2 hover:bg-gray-50 text-gray-700">{c}</button>
                    ))}
                  </div>
                )}
              </div>
            </Section>

            {/* PRICING */}
            <Section id="pricing" icon={DollarSign} title="Preço e Unidade">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">Preço de Venda (R$) *</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">R$</span>
                    <Input value={form.unit_price} onChange={e => handlePriceChange('unit_price', e.target.value)} placeholder="0,00" className="rounded-xl pl-9" required />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">Unidade</label>
                  <select value={form.unit_label} onChange={e => setForm(p => ({ ...p, unit_label: e.target.value }))} className="w-full h-10 rounded-xl border border-input bg-background px-3 text-sm">
                    {UNIT_OPTIONS.map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Tempo Estimado de Execução</label>
                <Input value={form.duration_estimate} onChange={e => setForm(p => ({ ...p, duration_estimate: e.target.value }))} placeholder="Ex: 2 horas, 3 dias, 1 semana" className="rounded-xl" />
              </div>
            </Section>

            {/* COSTS */}
            <Section id="costs" icon={Layers} title="Custos e Margem">
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Custo Total (R$)</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">R$</span>
                  <Input value={form.cost_price} onChange={e => handlePriceChange('cost_price', e.target.value)} placeholder="0,00" className="rounded-xl pl-9" />
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-gray-600 mb-1.5 block">Detalhamento de Custos</label>
                {form.cost_items.length > 0 && (
                  <div className="space-y-1.5 mb-2">
                    {form.cost_items.map((c, i) => (
                      <div key={i} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2">
                        <span className="text-xs text-gray-700">{c.name}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium text-gray-600">R$ {c.value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                          <button type="button" onClick={() => removeCostItem(i)}><X className="h-3 w-3 text-gray-400 hover:text-red-500" /></button>
                        </div>
                      </div>
                    ))}
                    <div className="text-xs text-right text-gray-500 pr-1">Total itens: R$ {totalCost.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
                  </div>
                )}
                <div className="flex gap-2">
                  <Input value={newCostName} onChange={e => setNewCostName(e.target.value)} placeholder="Ex: Material" className="rounded-xl text-xs flex-1" />
                  <div className="relative w-28">
                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-gray-400">R$</span>
                    <Input value={newCostValue} onChange={e => setNewCostValue(formatBRL(e.target.value))} placeholder="0,00" className="rounded-xl text-xs pl-7" />
                  </div>
                  <Button type="button" variant="outline" size="sm" onClick={addCostItem} className="rounded-xl px-2.5 h-10"><Plus className="h-3.5 w-3.5" /></Button>
                </div>
              </div>

              {parseBRL(form.unit_price) > 0 && (parseBRL(form.cost_price) > 0 || totalCost > 0) && (
                <div className={`rounded-xl p-3 text-xs ${profit >= 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
                  <span className="font-semibold">Margem: </span>
                  R$ {profit.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  {parseBRL(form.unit_price) > 0 && ` (${((profit / parseBRL(form.unit_price)) * 100).toFixed(1)}%)`}
                </div>
              )}

              <div className="flex items-center justify-between bg-gray-50 rounded-xl px-3 py-2.5">
                <div className="flex items-center gap-2">
                  {form.show_cost_to_client ? <Eye className="h-3.5 w-3.5 text-gray-500" /> : <EyeOff className="h-3.5 w-3.5 text-gray-500" />}
                  <span className="text-xs text-gray-700">Mostrar custo para o cliente na proposta</span>
                </div>
                <Switch checked={form.show_cost_to_client} onCheckedChange={v => setForm(p => ({ ...p, show_cost_to_client: v }))} />
              </div>
            </Section>

            {/* INCLUDED */}
            <Section id="included" icon={CheckCircle2} title="O que está Incluso">
              {form.included_items.length > 0 && (
                <div className="space-y-1.5 mb-2">
                  {form.included_items.map((item, i) => (
                    <div key={i} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="h-3 w-3 text-emerald-500 shrink-0" />
                        <span className="text-xs text-gray-700">{item}</span>
                      </div>
                      <button type="button" onClick={() => removeIncludedItem(i)}><X className="h-3 w-3 text-gray-400 hover:text-red-500" /></button>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex gap-2">
                <Input value={newIncluded} onChange={e => setNewIncluded(e.target.value)} onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addIncludedItem())} placeholder="Ex: Mão de obra, Material incluso, Suporte 30 dias..." className="rounded-xl text-xs flex-1" />
                <Button type="button" variant="outline" size="sm" onClick={addIncludedItem} className="rounded-xl px-2.5 h-10"><Plus className="h-3.5 w-3.5" /></Button>
              </div>
            </Section>

            {/* WARRANTY */}
            <Section id="warranty" icon={Shield} title="Garantia e Observações">
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Informações de Garantia</label>
                <Textarea value={form.warranty_info} onChange={e => setForm(p => ({ ...p, warranty_info: e.target.value }))} placeholder="Ex: Garantia de 90 dias para mão de obra e 1 ano para materiais..." className="rounded-xl min-h-[60px]" />
              </div>
            </Section>

            {/* ACTIONS */}
            <div className="flex gap-2 pt-3 border-t border-gray-100">
              <Button type="button" variant="outline" onClick={closeForm} className="flex-1 rounded-xl">Cancelar</Button>
              <Button type="submit" className="flex-1 rounded-xl text-white" style={{ background: '#374DA4' }} disabled={saveMutation.isPending}>
                {saveMutation.isPending ? 'Salvando...' : editing ? 'Salvar Alterações' : 'Cadastrar Item'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
