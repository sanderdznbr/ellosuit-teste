
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, FileText, Search, MoreVertical, Trash2, Eye, ArrowLeft, Package, LayoutTemplate, Download, Mail, MessageCircle, Loader2 } from 'lucide-react';
import ProposalGenerateDialog from './ProposalGenerateDialog';
import { useAuth } from '@/hooks/useAuth';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
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
import ServicesManager from './ServicesManager';

const PROPOSAL_COLOR = '#374DA4';

const STATUS_MAP: Record<string, { label: string; color: string; bg: string }> = {
  rascunho: { label: 'Rascunho', color: '#6B7280', bg: '#F3F4F6' },
  enviada: { label: 'Enviada', color: '#2F428D', bg: '#DBEAFE' },
  aprovada: { label: 'Fechado', color: '#16A34A', bg: '#DCFCE7' },
  pensando: { label: 'Pensando', color: '#D97706', bg: '#FEF3C7' },
  recusada: { label: 'Negado', color: '#DC2626', bg: '#FEE2E2' },
  expirada: { label: 'Expirada', color: '#9CA3AF', bg: '#F3F4F6' },
};

const DEFAULT_TEMPLATES = [
  { id: 'default', name: 'Ellosuit Padrão', description: 'Template limpo e profissional', colors: { primary: '#374DA4', secondary: '#007DE3' }, font: 'Inter, sans-serif' },
  { id: 'corporate', name: 'Corporativo', description: 'Sóbrio e elegante', colors: { primary: '#1F2937', secondary: '#6B7280' }, font: 'Georgia, serif' },
  { id: 'modern', name: 'Moderno', description: 'Vibrante e ousado', colors: { primary: '#7C3AED', secondary: '#EC4899' }, font: 'Inter, sans-serif' },
  { id: 'nature', name: 'Natural', description: 'Verde e sustentável', colors: { primary: '#059669', secondary: '#16A34A' }, font: 'Georgia, serif' },
  { id: 'energy', name: 'Energia', description: 'Quente e dinâmico', colors: { primary: '#374DA4', secondary: '#D97706' }, font: 'Helvetica, Arial, sans-serif' },
  { id: 'ocean', name: 'Oceano', description: 'Calmo e confiável', colors: { primary: '#0891B2', secondary: '#007DE3' }, font: 'system-ui, sans-serif' },
];

export default function ProposalsPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<'propostas' | 'servicos' | 'templates'>('propostas');
  const [generateDialog, setGenerateDialog] = useState<any>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const { data: companyId } = useQuery({
    queryKey: ['user-company', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data } = await supabase.from('company_users').select('company_id').eq('user_id', user.id).single();
      return data?.company_id || null;
    },
    enabled: !!user?.id,
  });

  const { data: proposals = [], isLoading } = useQuery({
    queryKey: ['proposals', companyId],
    queryFn: async () => {
      if (!companyId) return [];
      const { data, error } = await supabase
        .from('proposals')
        .select('*, clients(name, company_name, email, phone, whatsapp)')
        .eq('company_id', companyId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!companyId,
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('proposals').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['proposals'] });
      toast({ title: 'Proposta excluída' });
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from('proposals').update({ status }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['proposals'] });
      toast({ title: 'Status atualizado!' });
    },
  });

  const filtered = proposals.filter((p: any) => {
    const matchesSearch = p.title?.toLowerCase().includes(search.toLowerCase()) ||
      p.proposal_number?.toLowerCase().includes(search.toLowerCase()) ||
      (p.clients as any)?.name?.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'all' || p.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const stats = {
    total: proposals.length,
    aprovadas: proposals.filter((p: any) => p.status === 'aprovada').length,
    pendentes: proposals.filter((p: any) => p.status === 'enviada').length,
    valorTotal: proposals.filter((p: any) => p.status === 'aprovada').reduce((s: number, p: any) => s + (p.total || 0), 0),
  };

  const fmtBRL = (v: number) => `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;

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
              <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Ordens de Serviço</h1>
              <p className="text-sm text-gray-500">Crie ordens de serviço profissionais para seus clientes</p>
            </div>
          </div>
          <Button
            onClick={() => navigate('/dashboard/propostas/editor')}
            className="rounded-xl h-11 gap-2 text-white shadow-lg"
            style={{ background: PROPOSAL_COLOR }}
          >
            <Plus className="h-4 w-4" />
            Nova Ordem de Serviço
          </Button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 bg-gray-100 rounded-xl p-1 w-fit overflow-x-auto">
          <button
            onClick={() => setActiveTab('propostas')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
              activeTab === 'propostas' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <FileText className="h-4 w-4 inline mr-1.5" />
            Ordens de Serviço
          </button>
          <button
            onClick={() => setActiveTab('servicos')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
              activeTab === 'servicos' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <Package className="h-4 w-4 inline mr-1.5" />
            Serviços & Produtos
          </button>
          <button
            onClick={() => setActiveTab('templates')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
              activeTab === 'templates' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <LayoutTemplate className="h-4 w-4 inline mr-1.5" />
            Templates
          </button>
        </div>

        {activeTab === 'servicos' ? (
          <ServicesManager companyId={companyId} />
        ) : activeTab === 'templates' ? (
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Templates de Propostas</h2>
                <p className="text-sm text-gray-500">Selecione um template para criar sua proposta</p>
              </div>
              <Button onClick={() => navigate('/dashboard/propostas/editor')} variant="outline" className="rounded-xl gap-2">
                <Plus className="h-4 w-4" /> Criar do Zero
              </Button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {DEFAULT_TEMPLATES.map(t => (
                <button key={t.id}
                  onClick={() => {
                    const params = new URLSearchParams({ template: t.id, pc: t.colors.primary, sc: t.colors.secondary, font: t.font });
                    navigate(`/dashboard/propostas/editor?${params.toString()}`);
                  }}
                  className="bg-white rounded-2xl border border-gray-100 p-4 text-left hover:border-gray-200 hover:shadow-md transition-all group"
                >
                  <div className="rounded-xl overflow-hidden border border-gray-100 mb-3 aspect-[210/297]">
                    <div className="h-8" style={{ background: t.colors.primary }} />
                    <div className="p-3 space-y-2">
                      <div className="h-2 rounded-full w-2/3" style={{ background: t.colors.primary + '30' }} />
                      <div className="h-1.5 rounded-full bg-gray-100 w-full" />
                      <div className="h-1.5 rounded-full bg-gray-100 w-4/5" />
                      <div className="h-1.5 rounded-full bg-gray-100 w-3/5" />
                      <div className="mt-3 pt-2 border-t border-gray-100">
                        <div className="h-2 rounded-full w-1/3 ml-auto" style={{ background: t.colors.primary + '40' }} />
                      </div>
                    </div>
                    <div className="h-3 mt-auto" style={{ background: t.colors.primary }} />
                  </div>
                  <h3 className="font-semibold text-gray-900 text-sm group-hover:text-gray-700">{t.name}</h3>
                  <p className="text-xs text-gray-500 mt-0.5">{t.description}</p>
                  <div className="flex gap-1 mt-2">
                    <div className="w-4 h-4 rounded-full" style={{ background: t.colors.primary }} />
                    <div className="w-4 h-4 rounded-full" style={{ background: t.colors.secondary }} />
                  </div>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <>
            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
              {[
                { label: 'Total', value: stats.total, color: PROPOSAL_COLOR },
                { label: 'Aprovadas', value: stats.aprovadas, color: '#16A34A' },
                { label: 'Pendentes', value: stats.pendentes, color: '#2F428D' },
                { label: 'Valor Aprovado', value: fmtBRL(stats.valorTotal), color: '#D97706' },
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
                  <Input placeholder="Pesquisar ordem..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 border-gray-200 bg-gray-50 rounded-xl focus:bg-white" />
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[140px] rounded-xl border-gray-200">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="rascunho">Rascunho</SelectItem>
                    <SelectItem value="enviada">Enviadas</SelectItem>
                    <SelectItem value="aprovada">Fechado</SelectItem>
                    <SelectItem value="pensando">Pensando</SelectItem>
                    <SelectItem value="recusada">Negado</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Table Header (desktop) */}
              <div className="hidden md:grid grid-cols-[1fr_120px_100px_120px_280px] gap-4 px-4 py-3 border-t border-b border-gray-100 bg-gray-50/50 text-xs font-medium text-gray-500 uppercase tracking-wider">
                <div>Ordem de Serviço</div>
                <div>Valor</div>
                <div>Status</div>
                <div>Data</div>
                <div className="text-right">Ações</div>
              </div>

              {/* List */}
              {isLoading ? (
                <div className="p-8 flex items-center justify-center">
                  <Loader2 className="h-8 w-8 animate-spin" style={{ color: PROPOSAL_COLOR }} />
                </div>
              ) : filtered.length === 0 ? (
                <div className="text-center py-16">
                  <div className="w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center" style={{ background: PROPOSAL_COLOR + '12' }}>
                    <FileText className="h-7 w-7" style={{ color: PROPOSAL_COLOR }} />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-1">Nenhuma ordem de serviço encontrada</h3>
                  <p className="text-sm text-gray-500 mb-4">{search ? 'Tente uma busca diferente' : 'Crie sua primeira ordem de serviço'}</p>
                  {!search && (
                    <Button onClick={() => navigate('/dashboard/propostas/editor')} className="rounded-xl text-white" style={{ background: PROPOSAL_COLOR }}>
                      <Plus className="h-4 w-4 mr-1.5" /> Criar Ordem de Serviço
                    </Button>
                  )}
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {filtered.map((p: any) => {
                    const status = STATUS_MAP[p.status] || STATUS_MAP.rascunho;
                    const clientName = (p.clients as any)?.name || 'Sem cliente';
                    return (
                      <div key={p.id} className="grid grid-cols-1 md:grid-cols-[1fr_120px_100px_120px_280px] gap-2 md:gap-4 px-4 py-4 items-center hover:bg-gray-50/50 transition-colors">
                        {/* Info */}
                        <div className="flex items-center gap-3 min-w-0 cursor-pointer" onClick={() => navigate(`/dashboard/propostas/editor?id=${p.id}`)}>
                          <div className="w-10 h-10 rounded-xl flex-shrink-0 flex items-center justify-center" style={{ background: PROPOSAL_COLOR + '12' }}>
                            <FileText className="h-4 w-4" style={{ color: PROPOSAL_COLOR }} />
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-gray-900 truncate">{p.title}</span>
                              <span className="text-[10px] font-mono text-gray-400">{p.proposal_number}</span>
                            </div>
                            <p className="text-xs text-gray-500 truncate">{clientName}</p>
                          </div>
                        </div>

                        {/* Value */}
                        <div className="hidden md:block">
                          <span className="text-sm font-bold" style={{ color: PROPOSAL_COLOR }}>{fmtBRL(p.total || 0)}</span>
                        </div>

                        {/* Status */}
                        <div>
                          <Badge className="text-[10px] px-2 py-0.5 border-0" style={{ color: status.color, backgroundColor: status.bg }}>
                            {status.label}
                          </Badge>
                        </div>

                        {/* Date */}
                        <div className="hidden md:block text-sm text-gray-500">
                          {formatRelativeDate(p.created_at)}
                        </div>

                        {/* Actions */}
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 rounded-lg gap-1.5 text-xs font-medium"
                            onClick={() => navigate(`/dashboard/propostas/editor?id=${p.id}`)}
                          >
                            <Eye className="h-3.5 w-3.5" />
                            Editar
                          </Button>
                          <Button
                            size="sm"
                            className="h-8 rounded-lg gap-1.5 text-xs font-medium text-white"
                            style={{ background: PROPOSAL_COLOR }}
                            onClick={() => setGenerateDialog(p)}
                          >
                            <Download className="h-3.5 w-3.5" />
                            Gerar PDF
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
                                  {Object.entries(STATUS_MAP).filter(([k]) => k !== 'expirada').map(([key, val]) => (
                                    <button
                                      key={key}
                                      onClick={() => updateStatusMutation.mutate({ id: p.id, status: key })}
                                      className={`flex items-center gap-2 px-2 py-1.5 rounded-md text-xs text-left transition-colors ${p.status === key ? 'bg-gray-100 font-semibold' : 'hover:bg-gray-50'}`}
                                    >
                                      <span className="w-2 h-2 rounded-full" style={{ background: val.color }} />
                                      {val.label}
                                    </button>
                                  ))}
                                </div>
                              </div>
                              <DropdownMenuItem onClick={() => deleteMutation.mutate(p.id)} className="text-red-600">
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
          </>
        )}
      </div>

      <ProposalGenerateDialog
        open={!!generateDialog}
        onOpenChange={(open) => !open && setGenerateDialog(null)}
        proposal={generateDialog}
        companyId={companyId}
      />
    </div>
  );
}
