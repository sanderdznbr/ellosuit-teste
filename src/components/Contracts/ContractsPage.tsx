import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, FileText, Loader2, Trash2, Copy, MoreVertical, Eye, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import ContractFillDialog from './ContractFillDialog';

const SUITE_COLOR = '#374DA4';

const ContractsPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [templates, setTemplates] = useState<any[]>([]);
  const [generated, setGenerated] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [tab, setTab] = useState('templates');
  const [fillTemplateId, setFillTemplateId] = useState<string | null>(null);

  useEffect(() => {
    const init = async () => {
      if (!user?.id) return;
      const { data } = await supabase.from('company_users').select('company_id').eq('user_id', user.id).single();
      if (data) setCompanyId(data.company_id);
    };
    init();
  }, [user?.id]);

  useEffect(() => {
    if (!companyId) return;
    const load = async () => {
      const [t, g] = await Promise.all([
        supabase.from('contract_templates').select('*').eq('company_id', companyId).order('created_at', { ascending: false }),
        supabase.from('generated_contracts').select('*, contract_templates(title)').eq('company_id', companyId).order('created_at', { ascending: false }),
      ]);
      if (t.data) setTemplates(t.data);
      if (g.data) setGenerated(g.data);
      setLoading(false);
    };
    load();
  }, [companyId]);

  const deleteTemplate = async (id: string) => {
    if (!confirm('Excluir este modelo de contrato?')) return;
    await supabase.from('contract_templates').delete().eq('id', id);
    setTemplates(prev => prev.filter(t => t.id !== id));
    toast.success('Modelo excluído');
  };

  const deleteGenerated = async (id: string) => {
    if (!confirm('Excluir este contrato gerado?')) return;
    await supabase.from('generated_contracts').delete().eq('id', id);
    setGenerated(prev => prev.filter(g => g.id !== id));
    toast.success('Contrato excluído');
  };

  const duplicateTemplate = async (template: any) => {
    if (!companyId || !user?.id) return;
    const { data, error } = await supabase.from('contract_templates').insert({
      company_id: companyId,
      created_by: user.id,
      title: `${template.title} (Cópia)`,
      description: template.description,
      content: template.content,
      fields: template.fields,
      logo_url: template.logo_url,
      letterhead_url: template.letterhead_url,
    }).select().single();
    if (data) {
      setTemplates(prev => [data, ...prev]);
      toast.success('Modelo duplicado!');
    }
  };

  const filteredTemplates = templates.filter(t =>
    t.title.toLowerCase().includes(searchQuery.toLowerCase())
  );
  const filteredGenerated = generated.filter(g =>
    g.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const formatDate = (d: string) => new Date(d).toLocaleDateString('pt-BR');

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" style={{ color: SUITE_COLOR }} />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ background: `linear-gradient(135deg, ${SUITE_COLOR}, ${SUITE_COLOR}cc)` }}>
            <FileText className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Criação de Contratos</h1>
            <p className="text-muted-foreground text-sm">Crie modelos reutilizáveis e gere contratos preenchidos</p>
          </div>
        </div>
        <Button
          onClick={() => navigate('/dashboard/contratos/editor')}
          className="gap-2 rounded-xl text-white"
          style={{ backgroundColor: SUITE_COLOR }}
        >
          <Plus className="h-4 w-4" /> Criar Modelo
        </Button>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Pesquisar contratos..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          className="pl-10 rounded-xl"
        />
      </div>

      {/* Tabs */}
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="rounded-xl">
          <TabsTrigger value="templates" className="rounded-lg gap-2">
            <FileText className="h-4 w-4" /> Modelos ({templates.length})
          </TabsTrigger>
          <TabsTrigger value="generated" className="rounded-lg gap-2">
            <Copy className="h-4 w-4" /> Gerados ({generated.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="templates" className="mt-4">
          {filteredTemplates.length === 0 ? (
            <Card className="rounded-2xl">
              <CardContent className="flex flex-col items-center justify-center py-16">
                <FileText className="h-12 w-12 text-muted-foreground/30 mb-4" />
                <h3 className="font-semibold text-lg mb-1">Nenhum modelo de contrato</h3>
                <p className="text-sm text-muted-foreground mb-4">Crie seu primeiro modelo para começar a gerar contratos.</p>
                <Button onClick={() => navigate('/dashboard/contratos/editor')} className="rounded-xl text-white" style={{ backgroundColor: SUITE_COLOR }}>
                  <Plus className="h-4 w-4 mr-2" /> Criar Modelo
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {filteredTemplates.map(t => (
                <Card key={t.id} className="rounded-2xl hover:shadow-md transition-shadow">
                  <CardContent className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-4 flex-1 min-w-0">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${SUITE_COLOR}12` }}>
                        <FileText className="h-5 w-5" style={{ color: SUITE_COLOR }} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className="font-semibold truncate">{t.title}</h3>
                        <div className="flex items-center gap-3 mt-0.5">
                          {t.description && <span className="text-xs text-muted-foreground truncate max-w-xs">{t.description}</span>}
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Calendar className="h-3 w-3" /> {formatDate(t.created_at)}
                          </span>
                          <Badge variant="secondary" className="text-[10px]">
                            {(t.fields as any[])?.length || 0} campos
                          </Badge>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="rounded-xl gap-1.5"
                        style={{ borderColor: SUITE_COLOR, color: SUITE_COLOR }}
                        onClick={() => setFillTemplateId(t.id)}
                      >
                        <Copy className="h-3.5 w-3.5" /> Gerar Contrato
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="rounded-xl"
                        onClick={() => navigate(`/dashboard/contratos/editor?id=${t.id}`)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-xl">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="rounded-xl">
                          <DropdownMenuItem onClick={() => navigate(`/dashboard/contratos/editor?id=${t.id}`)} className="rounded-lg">
                            <Eye className="h-4 w-4 mr-2" /> Editar
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => duplicateTemplate(t)} className="rounded-lg">
                            <Copy className="h-4 w-4 mr-2" /> Duplicar
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => deleteTemplate(t.id)} className="text-destructive rounded-lg">
                            <Trash2 className="h-4 w-4 mr-2" /> Excluir
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="generated" className="mt-4">
          {filteredGenerated.length === 0 ? (
            <Card className="rounded-2xl">
              <CardContent className="flex flex-col items-center justify-center py-16">
                <Copy className="h-12 w-12 text-muted-foreground/30 mb-4" />
                <h3 className="font-semibold text-lg mb-1">Nenhum contrato gerado</h3>
                <p className="text-sm text-muted-foreground">Gere contratos a partir dos seus modelos.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {filteredGenerated.map(g => (
                <Card key={g.id} className="rounded-2xl hover:shadow-md transition-shadow">
                  <CardContent className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-4 flex-1 min-w-0">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 bg-emerald-50">
                        <FileText className="h-5 w-5 text-emerald-600" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className="font-semibold truncate">{g.title}</h3>
                        <div className="flex items-center gap-3 mt-0.5">
                          <span className="text-xs text-muted-foreground">
                            Modelo: {g.contract_templates?.title || 'Desconhecido'}
                          </span>
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Calendar className="h-3 w-3" /> {formatDate(g.created_at)}
                          </span>
                          <Badge variant={g.status === 'final' ? 'default' : 'secondary'} className="text-[10px]">
                            {g.status === 'final' ? 'Finalizado' : 'Rascunho'}
                          </Badge>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="rounded-xl"
                        onClick={() => navigate(`/dashboard/contratos/visualizar?id=${g.id}`)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 rounded-xl" onClick={() => deleteGenerated(g.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Fill Dialog */}
      {fillTemplateId && (
        <ContractFillDialog
          templateId={fillTemplateId}
          companyId={companyId!}
          onClose={() => setFillTemplateId(null)}
          onGenerated={(contract) => {
            setGenerated(prev => [contract, ...prev]);
            setFillTemplateId(null);
            setTab('generated');
          }}
        />
      )}
    </div>
  );
};

export default ContractsPage;
