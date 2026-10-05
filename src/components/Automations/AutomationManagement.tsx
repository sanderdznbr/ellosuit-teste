import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Workflow, Search, Pencil, BarChart3, Copy, Trash2, Power, Loader2, Zap, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

const BRAND_COLOR = '#374DA4';

interface AutomationRow {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  trigger_type: string;
  execution_count: number | null;
  created_at: string;
  updated_at: string;
}

const AutomationManagement: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();

  const [items, setItems] = useState<AutomationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [filter, setFilter] = useState('all');
  const [editItem, setEditItem] = useState<AutomationRow | null>(null);
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');

  useEffect(() => {
    const getCompanyId = async () => {
      if (!user?.id) return;
      const cid = user.user_metadata?.company_id;
      if (cid) { setCompanyId(cid); return; }
      const { data } = await supabase.from('company_users').select('company_id').eq('user_id', user.id).single();
      if (data?.company_id) setCompanyId(data.company_id);
    };
    getCompanyId();
  }, [user?.id]);

  useEffect(() => {
    const load = async () => {
      if (!companyId) return;
      setLoading(true);
      const { data } = await supabase
        .from('automations')
        .select('id, name, description, is_active, trigger_type, execution_count, created_at, updated_at')
        .eq('company_id', companyId)
        .order('created_at', { ascending: false });
      if (data) setItems(data as AutomationRow[]);
      setLoading(false);
    };
    load();
  }, [companyId]);

  const openEdit = (item: AutomationRow) => {
    setEditItem(item);
    setEditName(item.name);
    setEditDesc(item.description || '');
  };

  const handleSaveEdit = async () => {
    if (!editItem) return;
    const { error } = await supabase.from('automations').update({ name: editName, description: editDesc || null }).eq('id', editItem.id);
    if (!error) {
      setItems(prev => prev.map(a => a.id === editItem.id ? { ...a, name: editName, description: editDesc || null } : a));
      toast({ title: 'Salvo', description: 'Automação atualizada' });
      setEditItem(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir esta automação?')) return;
    await supabase.from('automations').delete().eq('id', id);
    setItems(prev => prev.filter(a => a.id !== id));
    toast({ title: 'Excluída', description: 'Automação removida' });
  };

  const handleToggle = async (item: AutomationRow) => {
    const next = !item.is_active;
    const { error } = await supabase.from('automations').update({ is_active: next }).eq('id', item.id);
    if (!error) {
      setItems(prev => prev.map(a => a.id === item.id ? { ...a, is_active: next } : a));
      toast({ title: next ? 'Ativada' : 'Desativada' });
    }
  };

  const handleDuplicate = async (item: AutomationRow) => {
    if (!companyId || !user?.id) return;
    // fetch full record for nodes/edges
    const { data: full } = await supabase.from('automations').select('*').eq('id', item.id).single();
    if (!full) return;
    const { data, error } = await supabase
      .from('automations')
      .insert({
        company_id: companyId,
        created_by: user.id,
        name: `${item.name} (cópia)`,
        description: item.description,
        is_active: false,
        nodes: full.nodes as any,
        edges: full.edges as any,
        trigger_type: full.trigger_type,
        trigger_config: full.trigger_config,
      })
      .select('id, name, description, is_active, trigger_type, execution_count, created_at, updated_at')
      .single();
    if (!error && data) {
      setItems(prev => [data as AutomationRow, ...prev]);
      toast({ title: 'Duplicada!' });
    }
  };

  const formatDate = (d: string) => {
    const diff = Math.floor((Date.now() - new Date(d).getTime()) / 86400000);
    if (diff === 0) return 'Hoje';
    if (diff === 1) return 'Ontem';
    if (diff < 7) return `${diff} dias atrás`;
    if (diff < 30) return `${Math.floor(diff / 7)} sem. atrás`;
    return `${Math.floor(diff / 30)} meses atrás`;
  };

  const triggerLabel = (t: string) => {
    const map: Record<string, string> = {
      webhook: 'Webhook',
      new_client: 'Novo Cliente',
      updated_client: 'Cliente Atualizado',
      schedule: 'Agendado',
      manual: 'Manual',
    };
    return map[t] || t;
  };

  const filtered = items
    .filter(a => filter === 'all' || (filter === 'active' ? a.is_active : !a.is_active))
    .filter(a => a.name.toLowerCase().includes(searchQuery.toLowerCase()) || a.description?.toLowerCase().includes(searchQuery.toLowerCase()));

  const toggleSelect = (id: string) => setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  const toggleAll = () => setSelectedIds(selectedIds.length === filtered.length ? [] : filtered.map(a => a.id));

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" style={{ color: BRAND_COLOR }} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      {/* Ambient glow */}
      <div className="pointer-events-none absolute -top-32 -left-32 w-96 h-96 rounded-full bg-[#374DA4]/20 blur-3xl" />
      <div className="pointer-events-none absolute top-1/3 -right-32 w-96 h-96 rounded-full bg-[#4D7CFF]/15 blur-3xl" />

      <div className="relative max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {/* Header */}
        <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div
              className="w-11 h-11 rounded-2xl flex items-center justify-center shadow-lg shadow-[#374DA4]/30"
              style={{ background: `linear-gradient(135deg, ${BRAND_COLOR}, #4D7CFF)` }}
            >
              <Zap className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight">Automações</h1>
              <p className="text-sm text-muted-foreground mt-0.5">Crie e gerencie fluxos automatizados.</p>
            </div>
          </div>

          <Button
            onClick={() => navigate('/dashboard/automacoes/builder')}
            className="rounded-full gap-2 text-white h-10 px-5 shadow-lg shadow-[#374DA4]/30 hover:scale-[1.02] transition-transform"
            style={{ backgroundColor: BRAND_COLOR }}
          >
            <Plus className="h-4 w-4" />
            Nova automação
          </Button>
        </div>

        {/* Toolbar (glass pill) */}
        <div className="glass-toolbar p-2 mb-5 flex items-center gap-2 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Pesquisar automação"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="pl-9 h-10 rounded-full border-transparent bg-background/50 focus:bg-background focus-visible:ring-1 focus-visible:ring-[#374DA4]/40"
            />
          </div>
          <div className="flex items-center gap-1 p-1 rounded-full bg-background/40 border border-border/40">
            {[
              { v: 'all', label: 'Todos' },
              { v: 'active', label: 'Ativos' },
              { v: 'inactive', label: 'Inativos' },
            ].map(opt => (
              <button
                key={opt.v}
                onClick={() => setFilter(opt.v)}
                className={`px-3 h-8 rounded-full text-xs font-medium transition-all ${
                  filter === opt.v
                    ? 'bg-[#374DA4] text-white shadow-sm shadow-[#374DA4]/30'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Main Card */}
        <div className="glass-toolbar overflow-hidden">
          {/* Table Header */}
          <div className="hidden md:grid grid-cols-[40px_1fr_120px_100px_100px_80px_180px] gap-3 px-4 py-3 border-b border-border/40 text-xs font-medium text-muted-foreground uppercase tracking-wider">
            <div className="flex items-center justify-center">
              <Checkbox
                checked={selectedIds.length === filtered.length && filtered.length > 0}
                onCheckedChange={toggleAll}
              />
            </div>
            <div>Nome</div>
            <div>Gatilho</div>
            <div>Criado em</div>
            <div>Atualizado</div>
            <div>Execuções</div>
            <div className="text-right">Ações</div>
          </div>

          {/* List */}
          {filtered.length === 0 ? (
            <div className="text-center py-16">
              <div className="w-16 h-16 rounded-2xl bg-[#374DA4]/10 flex items-center justify-center mx-auto mb-4">
                <Workflow className="h-7 w-7 text-[#374DA4]" />
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-2">Nenhuma automação encontrada</h3>
              <p className="text-sm text-muted-foreground mb-6">
                {searchQuery ? 'Tente uma busca diferente' : 'Crie sua primeira automação para começar'}
              </p>
              {!searchQuery && (
                <Button
                  onClick={() => navigate('/dashboard/automacoes/builder')}
                  style={{ backgroundColor: BRAND_COLOR }}
                  className="text-white rounded-full h-10 px-5 shadow-lg shadow-[#374DA4]/30"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Criar Automação
                </Button>
              )}
            </div>
          ) : (
            <div className="divide-y divide-border/40">
              {filtered.map(item => (
                <div
                  key={item.id}
                  className="grid md:grid-cols-[40px_1fr_120px_100px_100px_80px_180px] grid-cols-1 gap-3 px-4 py-4 items-center hover:bg-[#374DA4]/5 transition-colors"
                >
                  <div className="hidden md:flex items-center justify-center">
                    <Checkbox
                      checked={selectedIds.includes(item.id)}
                      onCheckedChange={() => toggleSelect(item.id)}
                    />
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <div className={`w-1.5 h-1.5 rounded-full ${item.is_active ? 'bg-emerald-500 animate-pulse' : 'bg-muted-foreground/40'}`} />
                      <div className="font-medium text-foreground truncate">{item.name}</div>
                    </div>
                    {item.description && (
                      <div className="text-xs text-muted-foreground truncate mt-0.5 md:hidden">{item.description}</div>
                    )}
                  </div>

                  <div>
                    <Badge variant="secondary" className="text-xs rounded-full bg-[#374DA4]/10 text-[#374DA4] border-0 hover:bg-[#374DA4]/15">
                      {triggerLabel(item.trigger_type)}
                    </Badge>
                  </div>

                  <div className="text-sm text-muted-foreground hidden md:block">{formatDate(item.created_at)}</div>
                  <div className="text-sm text-muted-foreground hidden md:block">{formatDate(item.updated_at)}</div>
                  <div className="text-sm text-foreground font-medium hidden md:block">{item.execution_count || 0}</div>

                  <div className="flex items-center justify-end gap-1">
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0 rounded-full text-muted-foreground hover:text-[#374DA4] hover:bg-[#374DA4]/10"
                      title="Editar nome/descrição"
                      onClick={() => openEdit(item)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0 rounded-full text-muted-foreground hover:text-[#374DA4] hover:bg-[#374DA4]/10"
                      title="Abrir no builder"
                      onClick={() => navigate(`/dashboard/automacoes/builder?id=${item.id}`)}>
                      <Workflow className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="sm"
                      className={`h-8 w-8 p-0 rounded-full ${item.is_active ? 'text-emerald-500 hover:text-rose-500 hover:bg-rose-500/10' : 'text-muted-foreground hover:text-emerald-500 hover:bg-emerald-500/10'}`}
                      title={item.is_active ? 'Desativar' : 'Ativar'}
                      onClick={() => handleToggle(item)}>
                      <Power className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0 rounded-full text-muted-foreground hover:text-[#374DA4] hover:bg-[#374DA4]/10"
                      title="Duplicar"
                      onClick={() => handleDuplicate(item)}>
                      <Copy className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0 rounded-full text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10"
                      title="Excluir"
                      onClick={() => handleDelete(item.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Edit Dialog */}
        <Dialog open={!!editItem} onOpenChange={open => !open && setEditItem(null)}>
          <DialogContent className="sm:max-w-md rounded-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: `linear-gradient(135deg, ${BRAND_COLOR}, #4D7CFF)` }}>
                  <Pencil className="h-4 w-4 text-white" />
                </div>
                Editar Automação
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label>Nome</Label>
                <Input value={editName} onChange={e => setEditName(e.target.value)} placeholder="Nome da automação" className="h-11 rounded-xl" />
              </div>
              <div className="space-y-2">
                <Label>Descrição</Label>
                <Textarea value={editDesc} onChange={e => setEditDesc(e.target.value)} placeholder="Descrição (opcional)" rows={3} className="rounded-xl" />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditItem(null)} className="rounded-full">Cancelar</Button>
              <Button onClick={handleSaveEdit} disabled={!editName.trim()} style={{ backgroundColor: BRAND_COLOR }} className="text-white rounded-full shadow-lg shadow-[#374DA4]/30">
                Salvar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default AutomationManagement;
