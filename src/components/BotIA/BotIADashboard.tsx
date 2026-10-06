import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Bot, MessageCircle, Pencil, BarChart3, Search, MoreVertical, Play, Pause, Download, Upload, Trash2, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import IntegrationTab from './IntegrationTab';
import AgentAvatar from './AgentAvatar/AgentAvatar';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Checkbox } from '@/components/ui/checkbox';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import BotIAChat from './BotIAChat';
import AgentConversions from './AgentConversions/AgentConversions';

const OMNI_COLOR = '#374DA4';

interface AIAgent {
  id: string;
  name: string;
  description?: string;
  personality: string;
  instructions: string;
  model: string;
  is_active: boolean;
  avatar_url?: string;
  settings: any;
  created_at: string;
  whatsapp_enabled?: boolean;
  whatsapp_session_id?: string;
}

const BotIADashboard: React.FC = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  
  const [agents, setAgents] = useState<AIAgent[]>([]);
  const [loading, setLoading] = useState(true);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAgents, setSelectedAgents] = useState<string[]>([]);
  const [activeView, setActiveView] = useState<'agents' | 'conversions'>('agents');
  
  const [showChatModal, setShowChatModal] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState<AIAgent | null>(null);

  const ensureCompany = async (): Promise<string | null> => {
    if (!user?.id) return null;
    const metadataCompanyId = user.user_metadata?.company_id;
    if (metadataCompanyId) return metadataCompanyId;
    const { data: existingCompanyUser } = await supabase
      .from('company_users').select('company_id').eq('user_id', user.id).single();
    if (existingCompanyUser?.company_id) {
      await supabase.auth.updateUser({ data: { company_id: existingCompanyUser.company_id } });
      return existingCompanyUser.company_id;
    }
    const companyName = user.user_metadata?.company_name || user.email?.split('@')[0] || 'Minha Empresa';
    const { data: newCompany } = await supabase.from('companies').insert({ name: companyName }).select().single();
    if (!newCompany) return null;
    await supabase.from('company_users').insert({ company_id: newCompany.id, user_id: user.id, role: 'admin' });
    await supabase.auth.updateUser({ data: { company_id: newCompany.id } });
    return newCompany.id;
  };

  const loadAgents = async (cId: string) => {
    const { data, error } = await supabase
      .from('ai_agents').select('*').eq('company_id', cId).order('created_at', { ascending: false });
    if (!error) setAgents(data || []);
  };

  useEffect(() => {
    const init = async () => {
      const cId = await ensureCompany();
      setCompanyId(cId);
      if (cId) await loadAgents(cId);
      setLoading(false);
    };
    if (user?.id) init();
  }, [user?.id]);

  const toggleAgent = async (id: string, isActive: boolean) => {
    await supabase.from('ai_agents').update({ is_active: !isActive }).eq('id', id);
    if (companyId) loadAgents(companyId);
  };

  const deleteAgent = async (id: string) => {
    if (!confirm('Excluir este agente?')) return;
    await supabase.from('ai_agents').delete().eq('id', id);
    if (companyId) loadAgents(companyId);
    toast({ title: 'Excluído', description: 'Agente removido' });
  };

  const exportAgent = async (agent: AIAgent) => {
    const exportData = {
      _exportVersion: 1,
      _exportedAt: new Date().toISOString(),
      name: agent.name,
      description: agent.description,
      personality: agent.personality,
      instructions: agent.instructions,
      model: agent.model,
      settings: agent.settings,
      avatar_url: agent.avatar_url,
    };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `agente-ia-${agent.name.toLowerCase().replace(/\s+/g, '-')}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: 'Exportado!', description: `Agente "${agent.name}" exportado com sucesso` });
  };

  const importAgent = async () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file || !companyId || !user?.id) return;
      try {
        const text = await file.text();
        const data = JSON.parse(text);
        if (!data._exportVersion || !data.name || !data.instructions || !data.personality) {
          toast({ title: 'Erro', description: 'Arquivo inválido. Use um arquivo exportado por esta plataforma.', variant: 'destructive' });
          return;
        }
        const { error } = await supabase.from('ai_agents').insert({
          company_id: companyId,
          created_by: user.id,
          name: data.name + ' (importado)',
          description: data.description || null,
          personality: data.personality,
          instructions: data.instructions,
          model: data.model || 'google/gemini-3-flash-preview',
          settings: data.settings || {},
          avatar_url: data.avatar_url || null,
          is_active: false,
        });
        if (error) throw error;
        await loadAgents(companyId);
        toast({ title: 'Importado!', description: `Agente "${data.name}" importado com sucesso` });
      } catch (err: any) {
        toast({ title: 'Erro na importação', description: err.message || 'Erro ao importar agente', variant: 'destructive' });
      }
    };
    input.click();
  };

  const filteredAgents = agents.filter(a => 
    a.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    a.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const toggleSelectAgent = (id: string) => {
    setSelectedAgents(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const toggleSelectAll = () => {
    setSelectedAgents(prev => prev.length === filteredAgents.length ? [] : filteredAgents.map(a => a.id));
  };

  if (loading) {
    return (
      <div className="min-h-full bg-[#faf9f7] flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2" style={{ borderColor: OMNI_COLOR }}></div>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-[#faf9f7] p-4 sm:p-6 pb-[13rem] md:pb-32 lg:pb-6 overscroll-contain">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-xl sm:text-2xl font-bold text-[#374DA4]">Bot IA</h1>
          <div className="flex items-center gap-2 shrink-0">
            <Button variant="outline" onClick={importAgent} className="rounded-full border-gray-200 bg-white text-gray-600">
              <Upload className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Importar</span>
            </Button>
            <Button onClick={() => navigate('/dashboard/bot-ia/novo')} className="bg-[#374DA4] text-white rounded-full shrink-0">
              <Plus className="h-4 w-4 mr-2" /> Novo Agente
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex bg-gray-100 p-1 rounded-full">
            <button
              onClick={() => setActiveView('agents')}
              className={`px-4 py-1.5 text-xs font-semibold rounded-full transition-all ${
                activeView === 'agents' ? 'bg-white text-[#374DA4] shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Meus Agentes
            </button>
            <button
              onClick={() => setActiveView('conversions')}
              className={`px-4 py-1.5 text-xs font-semibold rounded-full transition-all ${
                activeView === 'conversions' ? 'bg-white text-[#374DA4] shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Conversões
            </button>
          </div>

          {activeView === 'agents' && (
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Buscar agentes..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 h-9 rounded-full border-gray-200 bg-white text-sm"
              />
            </div>
          )}
        </div>

        {activeView === 'conversions' ? (
          <AgentConversions companyId={companyId} />
        ) : (
          <Card className="rounded-2xl border-none shadow-sm overflow-x-auto">
            <Table className="min-w-[720px]">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox
                      checked={selectedAgents.length === filteredAgents.length && filteredAgents.length > 0}
                      onCheckedChange={toggleSelectAll}
                    />
                  </TableHead>
                  <TableHead>Agente</TableHead>
                  <TableHead>Versão</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAgents.length > 0 ? filteredAgents.map(agent => (
                  <TableRow key={agent.id} className="hover:bg-gray-50/50 transition-colors">
                    <TableCell>
                      <Checkbox
                        checked={selectedAgents.includes(agent.id)}
                        onCheckedChange={() => toggleSelectAgent(agent.id)}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <AgentAvatar styleId={agent.settings?.agentStyle} size={36} className="shrink-0" />
                        <div className="flex flex-col min-w-0">
                          <span className="font-medium text-gray-900 truncate">{agent.name}</span>
                          <span className="text-[10px] text-gray-400 truncate max-w-[280px]">{agent.description || 'Sem descrição'}</span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-[10px] py-0 h-5 border-blue-100 bg-blue-50/50 text-[#374DA4]">
                        ELLO V1.0
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className={`text-[10px] ${
                        agent.is_active ? 'bg-green-50 text-green-600' : 'bg-gray-50 text-gray-500'
                      }`}>
                        {agent.is_active ? 'Online' : 'Offline'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost" size="icon"
                          className="h-8 w-8 rounded-full text-gray-400 hover:text-[#374DA4]"
                          onClick={() => navigate(`/dashboard/bot-ia/editar/${agent.id}`)}
                          title="Editar"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost" size="icon"
                          className="h-8 w-8 rounded-full text-gray-400 hover:text-[#374DA4]"
                          onClick={() => { setSelectedAgent(agent); setShowPreviewModal(true); }}
                          title="Automação"
                        >
                          <Zap className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost" size="icon"
                          className="h-8 w-8 rounded-full text-gray-400 hover:text-green-600"
                          onClick={() => { setSelectedAgent(agent); setShowChatModal(true); }}
                          title="Testar"
                        >
                          <MessageCircle className="h-4 w-4" />
                        </Button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full text-gray-400 hover:text-gray-700">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="rounded-2xl border-gray-100 p-1.5 min-w-[180px] shadow-lg">
                            <DropdownMenuItem className="rounded-xl gap-2 px-3 py-2 text-sm cursor-pointer" onClick={() => toggleAgent(agent.id, agent.is_active)}>
                              {agent.is_active ? <Pause className="h-4 w-4 text-amber-500" /> : <Play className="h-4 w-4 text-green-500" />}
                              {agent.is_active ? 'Pausar' : 'Retomar'}
                            </DropdownMenuItem>
                            <DropdownMenuItem className="rounded-xl gap-2 px-3 py-2 text-sm cursor-pointer" onClick={() => exportAgent(agent)}>
                              <Download className="h-4 w-4" />
                              Exportar
                            </DropdownMenuItem>
                            <DropdownMenuItem className="rounded-xl gap-2 px-3 py-2 text-sm cursor-pointer text-red-600 focus:text-red-600" onClick={() => deleteAgent(agent.id)}>
                              <Trash2 className="h-4 w-4" />
                              Remover
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </TableCell>
                  </TableRow>
                )) : (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-16 text-sm text-gray-400">
                      Nenhum agente encontrado
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </Card>
        )}

        {/* Chat Modal */}
        <Dialog open={showChatModal} onOpenChange={setShowChatModal}>
          <DialogContent className="sm:max-w-[500px] h-[600px] p-0 overflow-hidden rounded-2xl border-none shadow-2xl">
            {selectedAgent && (
              <BotIAChat 
                agent={selectedAgent} 
                onClose={() => setShowChatModal(false)} 
              />
            )}
          </DialogContent>
        </Dialog>

        {/* Automation Preview Modal */}
        <Dialog open={showPreviewModal} onOpenChange={setShowPreviewModal}>
          <DialogContent className="sm:max-w-[700px] max-h-[85vh] p-0 overflow-hidden rounded-2xl border-none shadow-2xl flex flex-col">
            <DialogHeader className="p-6 border-b bg-gray-50/50 dark:bg-zinc-900/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#F0F2FE] dark:bg-[#374DA4]/10 flex items-center justify-center">
                  <Zap className="h-5 w-5 text-[#2F428D] dark:text-[#5A74D1]" />
                </div>
                <div>
                  <DialogTitle className="text-xl font-bold">Prévia de Automação</DialogTitle>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Veja como {selectedAgent?.name} se integra aos fluxos</p>
                </div>
              </div>
            </DialogHeader>
            <ScrollArea className="flex-1">
              <div className="p-6 space-y-6">
                {selectedAgent && (
                  <IntegrationTab 
                    agentId={selectedAgent.id} 
                    agentName={selectedAgent.name} 
                  />
                )}
              </div>
            </ScrollArea>
            <DialogFooter className="p-4 border-t bg-gray-50/30 dark:bg-zinc-900/30 flex justify-end gap-3">
              <Button variant="outline" onClick={() => setShowPreviewModal(false)} className="rounded-xl">
                Fechar
              </Button>
              <Button 
                onClick={() => {
                  setShowPreviewModal(false);
                  navigate(`/dashboard/automacoes/builder?agentId=${selectedAgent?.id}`);
                }}
                className="rounded-xl gap-2 text-white shadow-lg shadow-[#2F428D]/10 hover:shadow-[#2F428D]/20"
                style={{ backgroundColor: OMNI_COLOR }}
              >
                <Plus className="h-4 w-4" />
                Nova Automação
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default BotIADashboard;
