import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Plus, Search, Target, BarChart3, Users, Eye, 
  Trash2, Play, Pause, Loader2, Copy, ExternalLink,
  TrendingUp
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

const FLOW_COLOR = "#2ECC71";

interface LeadFunnel {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  is_active: boolean;
  settings: any;
  created_at: string;
  updated_at: string;
}

interface FunnelStats {
  [key: string]: { views: number; completions: number };
}

const LeadFunnelsManager: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [funnels, setFunnels] = useState<LeadFunnel[]>([]);
  const [funnelStats, setFunnelStats] = useState<FunnelStats>({});
  const [loading, setLoading] = useState(true);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newFunnel, setNewFunnel] = useState({ 
    name: '', description: '',
    thankYouTitle: 'Obrigado!', thankYouMessage: 'Sua resposta foi enviada com sucesso.',
    buttonColor: '#374DA4', backgroundColor: '#FFFFFF'
  });
  const [stats, setStats] = useState({ total: 0, active: 0, submissions: 0, conversions: 0 });

  useEffect(() => {
    const getCompanyId = async () => {
      if (!user?.id) return;
      const metadataCompanyId = user.user_metadata?.company_id;
      if (metadataCompanyId) { setCompanyId(metadataCompanyId); return; }
      const { data } = await supabase.from('company_users').select('company_id').eq('user_id', user.id).single();
      if (data?.company_id) setCompanyId(data.company_id);
    };
    getCompanyId();
  }, [user?.id]);

  useEffect(() => {
    const loadFunnels = async () => {
      if (!companyId) return;
      setLoading(true);
      const { data, error } = await supabase.from('lead_funnels').select('*').eq('company_id', companyId).order('created_at', { ascending: false });
      if (!error && data) {
        setFunnels(data);
        const statsMap: FunnelStats = {};
        for (const funnel of data) {
          const { count: viewCount } = await supabase.from('lead_submissions').select('*', { count: 'exact', head: true }).eq('funnel_id', funnel.id);
          const { count: completionCount } = await supabase.from('lead_submissions').select('*', { count: 'exact', head: true }).eq('funnel_id', funnel.id).eq('status', 'completed');
          statsMap[funnel.id] = { views: viewCount || 0, completions: completionCount || 0 };
        }
        setFunnelStats(statsMap);
        const active = data.filter(f => f.is_active).length;
        const totalViews = Object.values(statsMap).reduce((sum, s) => sum + s.views, 0);
        const totalConversions = Object.values(statsMap).reduce((sum, s) => sum + s.completions, 0);
        setStats({ total: data.length, active, submissions: totalViews, conversions: totalConversions });
      }
      setLoading(false);
    };
    loadFunnels();
  }, [companyId]);

  const generateSlug = (name: string) => {
    return name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') + '-' + Math.random().toString(36).substr(2, 6);
  };

  const handleCreateFunnel = async () => {
    if (!newFunnel.name.trim() || !companyId || !user?.id) {
      toast({ title: 'Erro', description: 'Preencha o nome do funil', variant: 'destructive' });
      return;
    }
    const slug = generateSlug(newFunnel.name);
    const { data, error } = await supabase.from('lead_funnels').insert({
      name: newFunnel.name, description: newFunnel.description || null, slug, company_id: companyId, created_by: user.id, is_active: false,
      settings: { buttonColor: newFunnel.buttonColor, backgroundColor: newFunnel.backgroundColor, thankYouTitle: newFunnel.thankYouTitle, thankYouMessage: newFunnel.thankYouMessage }
    }).select().single();
    if (error) { toast({ title: 'Erro', description: error.message, variant: 'destructive' }); return; }
    setFunnels(prev => [data, ...prev]);
    setShowCreateModal(false);
    setNewFunnel({ name: '', description: '', thankYouTitle: 'Obrigado!', thankYouMessage: 'Sua resposta foi enviada com sucesso.', buttonColor: '#374DA4', backgroundColor: '#FFFFFF' });
    navigate(`/dashboard/leads/builder?id=${data.id}`);
  };

  const handleToggleFunnel = async (funnelId: string, currentActive: boolean) => {
    const { error } = await supabase.from('lead_funnels').update({ is_active: !currentActive }).eq('id', funnelId);
    if (!error) { setFunnels(prev => prev.map(f => f.id === funnelId ? { ...f, is_active: !currentActive } : f)); toast({ title: !currentActive ? 'Ativado' : 'Pausado' }); }
  };

  const handleDeleteFunnel = async (funnelId: string) => {
    if (!confirm('Tem certeza que deseja excluir este funil?')) return;
    const { error } = await supabase.from('lead_funnels').delete().eq('id', funnelId);
    if (!error) { setFunnels(prev => prev.filter(f => f.id !== funnelId)); toast({ title: 'Excluído' }); }
  };

  const copyFunnelLink = (slug: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(`${window.location.origin}/f/${slug}`);
    toast({ title: 'Link copiado!' });
  };

  const filteredFunnels = funnels.filter(f =>
    f.name.toLowerCase().includes(searchQuery.toLowerCase()) || f.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center bg-background min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" style={{ color: FLOW_COLOR }} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-6xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground">Captura de Leads</h1>
          <p className="text-muted-foreground mt-1">
            Crie funis interativos para capturar e qualificar leads
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          {[
            { icon: Target, label: 'Funis', value: stats.total, color: FLOW_COLOR },
            { icon: Play, label: 'Ativos', value: stats.active, color: '#10B981' },
            { icon: Users, label: 'Acessos', value: stats.submissions, color: '#374DA4' },
            { icon: TrendingUp, label: 'Conversão', value: stats.submissions > 0 ? `${Math.round((stats.conversions / stats.submissions) * 100)}%` : '0%', color: '#8B5CF6' },
          ].map((stat, i) => (
            <div key={i} className="bg-card rounded-2xl border border-border/60 p-4 flex items-center gap-3">
              <div className="p-2.5 rounded-xl" style={{ backgroundColor: `${stat.color}12` }}>
                <stat.icon className="h-5 w-5" style={{ color: stat.color }} />
              </div>
              <div>
                <p className="text-lg font-bold text-foreground">{stat.value}</p>
                <p className="text-xs text-muted-foreground">{stat.label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Main Card */}
        <div className="bg-card rounded-2xl border border-border/60 overflow-hidden">
          {/* Search + Actions */}
          <div className="p-4 flex items-center gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Pesquisar funis..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 border-border bg-muted/50 rounded-xl focus:bg-background"
              />
            </div>
            <div className="flex-1" />
            <Button variant="outline" onClick={() => navigate('/dashboard/track/leads')} className="gap-2 rounded-xl">
              <BarChart3 className="h-4 w-4" />Gerenciar
            </Button>
            <Button
              onClick={() => setShowCreateModal(true)}
              className="rounded-xl gap-2 text-white"
              style={{ backgroundColor: FLOW_COLOR }}
            >
              <Plus className="h-4 w-4" />
              Novo Funil
            </Button>
          </div>

          {/* Table Header */}
          <div className="grid grid-cols-[40px_1fr_100px_120px_100px_100px_100px_140px] gap-4 px-4 py-3 border-t border-b border-border/40 bg-muted/30 text-xs font-medium text-muted-foreground uppercase tracking-wider">
            <div />
            <div>Nome</div>
            <div>Status</div>
            <div>Link</div>
            <div>Acessos</div>
            <div>Conversões</div>
            <div>Taxa</div>
            <div className="text-right">Ações</div>
          </div>

          {/* List */}
          {filteredFunnels.length === 0 ? (
            <div className="text-center py-16">
              <Target className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-foreground mb-2">Nenhum funil encontrado</h3>
              <p className="text-muted-foreground mb-6">
                {searchQuery ? 'Tente uma busca diferente' : 'Crie seu primeiro funil para capturar leads'}
              </p>
              {!searchQuery && (
                <Button
                  onClick={() => setShowCreateModal(true)}
                  style={{ backgroundColor: FLOW_COLOR }}
                  className="text-white rounded-xl"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Criar Funil
                </Button>
              )}
            </div>
          ) : (
            <div className="divide-y divide-border/40">
              {filteredFunnels.map(funnel => {
                const fStats = funnelStats[funnel.id] || { views: 0, completions: 0 };
                const convRate = fStats.views > 0 ? Math.round((fStats.completions / fStats.views) * 100) : 0;
                return (
                  <div
                    key={funnel.id}
                    className="grid grid-cols-[40px_1fr_100px_120px_100px_100px_100px_140px] gap-4 px-4 py-4 items-center hover:bg-muted/30 transition-colors cursor-pointer"
                    onClick={() => navigate(`/dashboard/leads/builder?id=${funnel.id}`)}
                  >
                    <div className="flex items-center justify-center">
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center"
                        style={{ backgroundColor: funnel.is_active ? `${FLOW_COLOR}12` : 'hsl(var(--muted))' }}
                      >
                        <Target className="h-4 w-4" style={{ color: funnel.is_active ? FLOW_COLOR : 'hsl(var(--muted-foreground))' }} />
                      </div>
                    </div>

                    <div className="min-w-0">
                      <span className="font-medium text-foreground truncate block">{funnel.name}</span>
                      {funnel.description && (
                        <span className="text-xs text-muted-foreground truncate block">{funnel.description}</span>
                      )}
                    </div>

                    <div>
                      {funnel.is_active ? (
                        <Badge className="bg-green-500/10 text-green-500 border-0 text-[10px] px-2 py-0.5">
                          Ativo
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="text-[10px] px-2 py-0.5">
                          Pausado
                        </Badge>
                      )}
                    </div>

                    <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                      <span className="text-xs text-muted-foreground font-mono truncate">/f/{funnel.slug.slice(0, 8)}...</span>
                      <Button variant="ghost" size="icon" className="h-5 w-5 shrink-0" onClick={(e) => copyFunnelLink(funnel.slug, e)}>
                        <Copy className="h-3 w-3" />
                      </Button>
                    </div>

                    <div className="text-sm text-muted-foreground flex items-center gap-1">
                      <Eye className="h-3 w-3" />
                      {fStats.views}
                    </div>

                    <div className="text-sm text-green-500 flex items-center gap-1">
                      <Users className="h-3 w-3" />
                      {fStats.completions}
                    </div>

                    <div className="text-sm font-medium" style={{ color: FLOW_COLOR }}>
                      {convRate}%
                    </div>

                    <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                        onClick={() => handleToggleFunnel(funnel.id, funnel.is_active)}
                        title={funnel.is_active ? 'Pausar' : 'Ativar'}
                      >
                        {funnel.is_active ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                        onClick={() => navigate(`/dashboard/leads/analytics/${funnel.id}`)}
                        title="Analytics"
                      >
                        <BarChart3 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                        onClick={() => handleDeleteFunnel(funnel.id)}
                        title="Excluir"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Create Modal */}
      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent className="sm:max-w-lg rounded-2xl">
          <DialogHeader>
            <DialogTitle>Criar Novo Funil</DialogTitle>
            <DialogDescription>Configure as informações básicas do seu funil</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto">
            <div className="space-y-2">
              <Label>Nome do Funil *</Label>
              <Input placeholder="Ex: Captação de Leads 2024" value={newFunnel.name} onChange={(e) => setNewFunnel(prev => ({ ...prev, name: e.target.value }))} className="rounded-xl" />
            </div>
            <div className="space-y-2">
              <Label>Descrição (opcional)</Label>
              <Textarea placeholder="Descreva o objetivo..." value={newFunnel.description} onChange={(e) => setNewFunnel(prev => ({ ...prev, description: e.target.value }))} rows={2} className="rounded-xl" />
            </div>
            <div className="pt-4 border-t border-border">
              <h4 className="text-sm font-medium mb-3">Personalização</h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Cor dos Botões</Label>
                  <div className="flex items-center gap-2">
                    <input type="color" value={newFunnel.buttonColor} onChange={(e) => setNewFunnel(prev => ({ ...prev, buttonColor: e.target.value }))} className="w-10 h-10 rounded-lg border border-border cursor-pointer" />
                    <Input value={newFunnel.buttonColor} onChange={(e) => setNewFunnel(prev => ({ ...prev, buttonColor: e.target.value }))} className="flex-1 rounded-xl" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Cor de Fundo</Label>
                  <div className="flex items-center gap-2">
                    <input type="color" value={newFunnel.backgroundColor} onChange={(e) => setNewFunnel(prev => ({ ...prev, backgroundColor: e.target.value }))} className="w-10 h-10 rounded-lg border border-border cursor-pointer" />
                    <Input value={newFunnel.backgroundColor} onChange={(e) => setNewFunnel(prev => ({ ...prev, backgroundColor: e.target.value }))} className="flex-1 rounded-xl" />
                  </div>
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateModal(false)} className="rounded-xl">Cancelar</Button>
            <Button onClick={handleCreateFunnel} className="rounded-xl" style={{ backgroundColor: FLOW_COLOR }}>Criar Funil</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default LeadFunnelsManager;
