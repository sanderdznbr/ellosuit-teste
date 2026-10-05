import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { useClients } from '@/hooks/useClients';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  FolderOpen, Plus, Search, Trash2, Users, ArrowLeft, 
  MoreHorizontal, Edit2, UserPlus 
} from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

interface ContactGroup {
  id: string;
  name: string;
  description: string | null;
  company_id: string;
  created_at: string;
  member_count?: number;
}

interface GroupMember {
  id: string;
  group_id: string;
  client_id: string | null;
  name: string | null;
  phone: string;
  created_at: string;
  client?: { name: string; email?: string; phone?: string; company_name?: string };
}

const ContactGroupsManager: React.FC = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const { clients } = useClients('all');
  const [groups, setGroups] = useState<ContactGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedGroup, setSelectedGroup] = useState<ContactGroup | null>(null);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showAddMembersDialog, setShowAddMembersDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupDesc, setNewGroupDesc] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [clientSearch, setClientSearch] = useState('');
  const [selectedClientIds, setSelectedClientIds] = useState<string[]>([]);

  const fetchGroups = async () => {
    if (!user) return;
    try {
      const { data: companyUser } = await supabase
        .from('company_users')
        .select('company_id')
        .eq('user_id', user.id)
        .single();
      if (!companyUser) return;

      const { data, error } = await supabase
        .from('contact_groups')
        .select('*')
        .eq('company_id', companyUser.company_id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Get member counts
      const groupsWithCounts = await Promise.all(
        (data || []).map(async (g) => {
          const { count } = await supabase
            .from('contact_group_members')
            .select('*', { count: 'exact', head: true })
            .eq('group_id', g.id);
          return { ...g, member_count: count || 0 };
        })
      );
      setGroups(groupsWithCounts);
    } catch (e) {
      console.error('Error fetching groups:', e);
    } finally {
      setLoading(false);
    }
  };

  const fetchMembers = async (groupId: string) => {
    const { data, error } = await supabase
      .from('contact_group_members')
      .select('*')
      .eq('group_id', groupId)
      .order('created_at', { ascending: false });
    if (error) {
      console.error('Error fetching members:', error);
      return;
    }

    // Enrich with client data
    const enriched = (data || []).map((m) => {
      const client = clients.find(c => c.id === m.client_id);
      return {
        ...m,
        client: client ? { name: client.name, email: client.email || undefined, phone: client.phone || undefined, company_name: client.company_name || undefined } : undefined
      };
    });
    setMembers(enriched);
  };

  useEffect(() => {
    fetchGroups();
  }, [user]);

  useEffect(() => {
    if (selectedGroup) {
      fetchMembers(selectedGroup.id);
    }
  }, [selectedGroup, clients]);

  const handleCreateGroup = async () => {
    if (!user || !newGroupName.trim()) return;
    try {
      const { data: companyUser } = await supabase
        .from('company_users')
        .select('company_id')
        .eq('user_id', user.id)
        .single();
      if (!companyUser) return;

      const { error } = await supabase.from('contact_groups').insert({
        name: newGroupName.trim(),
        description: newGroupDesc.trim() || null,
        company_id: companyUser.company_id,
        created_by: user.id,
      });
      if (error) throw error;
      toast({ title: 'Grupo criado com sucesso' });
      setNewGroupName('');
      setNewGroupDesc('');
      setShowCreateDialog(false);
      fetchGroups();
    } catch (e: any) {
      toast({ title: 'Erro ao criar grupo', description: e.message, variant: 'destructive' });
    }
  };

  const handleDeleteGroup = async (id: string) => {
    if (!confirm('Excluir este grupo? Os contatos não serão apagados.')) return;
    const { error } = await supabase.from('contact_groups').delete().eq('id', id);
    if (error) {
      toast({ title: 'Erro ao excluir', variant: 'destructive' });
      return;
    }
    toast({ title: 'Grupo excluído' });
    if (selectedGroup?.id === id) setSelectedGroup(null);
    fetchGroups();
  };

  const handleUpdateGroup = async () => {
    if (!selectedGroup || !newGroupName.trim()) return;
    const { error } = await supabase
      .from('contact_groups')
      .update({ name: newGroupName.trim(), description: newGroupDesc.trim() || null })
      .eq('id', selectedGroup.id);
    if (error) {
      toast({ title: 'Erro ao atualizar', variant: 'destructive' });
      return;
    }
    toast({ title: 'Grupo atualizado' });
    setShowEditDialog(false);
    setSelectedGroup({ ...selectedGroup, name: newGroupName.trim(), description: newGroupDesc.trim() || null });
    fetchGroups();
  };

  const handleAddMembers = async () => {
    if (!selectedGroup || selectedClientIds.length === 0) return;
    try {
      const inserts = selectedClientIds.map(clientId => {
        const client = clients.find(c => c.id === clientId);
        return {
          group_id: selectedGroup.id,
          client_id: clientId,
          name: client?.name || '',
          phone: client?.phone || client?.whatsapp || 'N/A',
        };
      });
      const { error } = await supabase.from('contact_group_members').insert(inserts);
      if (error) throw error;
      toast({ title: `${selectedClientIds.length} contato(s) adicionado(s)` });
      setSelectedClientIds([]);
      setShowAddMembersDialog(false);
      fetchMembers(selectedGroup.id);
      fetchGroups();
    } catch (e: any) {
      toast({ title: 'Erro', description: e.message, variant: 'destructive' });
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    const { error } = await supabase.from('contact_group_members').delete().eq('id', memberId);
    if (error) {
      toast({ title: 'Erro ao remover', variant: 'destructive' });
      return;
    }
    toast({ title: 'Membro removido' });
    if (selectedGroup) {
      fetchMembers(selectedGroup.id);
      fetchGroups();
    }
  };

  const existingClientIds = members.map(m => m.client_id);
  const availableClients = clients.filter(c =>
    !existingClientIds.includes(c.id) &&
    (c.name.toLowerCase().includes(clientSearch.toLowerCase()) ||
      (c.email || '').toLowerCase().includes(clientSearch.toLowerCase()))
  );

  const filteredGroups = groups.filter(g =>
    g.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  // Detail view of a group
  if (selectedGroup) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => setSelectedGroup(null)} className="rounded-xl">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h2 className="text-xl font-bold">{selectedGroup.name}</h2>
            {selectedGroup.description && <p className="text-sm text-muted-foreground">{selectedGroup.description}</p>}
          </div>
          <Button variant="outline" size="sm" className="rounded-xl" onClick={() => {
            setNewGroupName(selectedGroup.name);
            setNewGroupDesc(selectedGroup.description || '');
            setShowEditDialog(true);
          }}>
            <Edit2 className="h-4 w-4 mr-2" /> Editar
          </Button>
          <Button size="sm" className="rounded-xl" onClick={() => { setClientSearch(''); setSelectedClientIds([]); setShowAddMembersDialog(true); }}>
            <UserPlus className="h-4 w-4 mr-2" /> Adicionar Contatos
          </Button>
        </div>

        <Card className="border-none shadow-lg rounded-2xl">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Membros ({members.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {members.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Users className="h-12 w-12 mx-auto mb-3 opacity-40" />
                <p>Nenhum contato neste grupo</p>
                <Button variant="outline" className="mt-4 rounded-xl" onClick={() => setShowAddMembersDialog(true)}>
                  <UserPlus className="h-4 w-4 mr-2" /> Adicionar
                </Button>
              </div>
            ) : (
              <div className="divide-y">
                {members.map(m => (
                  <div key={m.id} className="flex items-center justify-between py-3">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-sm font-medium text-primary">
                        {(m.client?.name || m.name || '?').charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-medium text-sm">{m.client?.name || m.name}</p>
                        <p className="text-xs text-muted-foreground">{m.client?.email || m.phone}</p>
                      </div>
                    </div>
                    <Button variant="ghost" size="icon" className="text-destructive h-8 w-8" onClick={() => handleRemoveMember(m.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Add Members Dialog */}
        <Dialog open={showAddMembersDialog} onOpenChange={setShowAddMembersDialog}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Adicionar Contatos ao Grupo</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Buscar contatos..." value={clientSearch} onChange={e => setClientSearch(e.target.value)} className="pl-9" />
              </div>
              <div className="max-h-64 overflow-y-auto space-y-1">
                {availableClients.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">Nenhum contato disponível</p>
                ) : availableClients.map(c => (
                  <label key={c.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 cursor-pointer">
                    <Checkbox
                      checked={selectedClientIds.includes(c.id)}
                      onCheckedChange={(checked) => {
                        setSelectedClientIds(prev =>
                          checked ? [...prev, c.id] : prev.filter(id => id !== c.id)
                        );
                      }}
                    />
                    <div>
                      <p className="text-sm font-medium">{c.name}</p>
                      <p className="text-xs text-muted-foreground">{c.email || c.phone}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowAddMembersDialog(false)}>Cancelar</Button>
              <Button onClick={handleAddMembers} disabled={selectedClientIds.length === 0}>
                Adicionar ({selectedClientIds.length})
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Edit Group Dialog */}
        <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
          <DialogContent className="max-w-sm">
            <DialogHeader><DialogTitle>Editar Grupo</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <Input placeholder="Nome do grupo" value={newGroupName} onChange={e => setNewGroupName(e.target.value)} />
              <Input placeholder="Descrição (opcional)" value={newGroupDesc} onChange={e => setNewGroupDesc(e.target.value)} />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowEditDialog(false)}>Cancelar</Button>
              <Button onClick={handleUpdateGroup}>Salvar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // Groups list view
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-2xl bg-indigo-50">
            <FolderOpen className="h-6 w-6 text-indigo-600" />
          </div>
          <div>
            <h2 className="text-xl font-bold">Grupos & Listas</h2>
            <p className="text-sm text-muted-foreground">Organize seus contatos em grupos</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar grupos..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-9 w-48 rounded-xl" />
          </div>
          <Button className="rounded-xl" onClick={() => { setNewGroupName(''); setNewGroupDesc(''); setShowCreateDialog(true); }}>
            <Plus className="h-4 w-4 mr-2" /> Novo Grupo
          </Button>
        </div>
      </div>

      {filteredGroups.length === 0 ? (
        <Card className="border-none shadow-lg rounded-2xl">
          <CardContent className="py-12 text-center">
            <FolderOpen className="h-16 w-16 text-muted-foreground/30 mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">Nenhum grupo criado</h3>
            <p className="text-muted-foreground mb-4">Crie grupos para organizar seus contatos</p>
            <Button onClick={() => setShowCreateDialog(true)}>
              <Plus className="h-4 w-4 mr-2" /> Criar Primeiro Grupo
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredGroups.map(g => (
            <Card
              key={g.id}
              className="border-none shadow-lg rounded-2xl cursor-pointer hover:shadow-xl transition-shadow"
              onClick={() => setSelectedGroup(g)}
            >
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-indigo-50">
                      <FolderOpen className="h-5 w-5 text-indigo-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold">{g.name}</h3>
                      {g.description && <p className="text-xs text-muted-foreground mt-0.5">{g.description}</p>}
                    </div>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild onClick={e => e.stopPropagation()}>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" onClick={e => e.stopPropagation()}>
                      <DropdownMenuItem onClick={() => handleDeleteGroup(g.id)} className="text-destructive">
                        <Trash2 className="h-4 w-4 mr-2" /> Excluir
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                <div className="mt-4 flex items-center gap-2">
                  <Badge variant="secondary" className="rounded-full">
                    <Users className="h-3 w-3 mr-1" /> {g.member_count} contatos
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {new Date(g.created_at).toLocaleDateString('pt-BR')}
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create Group Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Criar Novo Grupo</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <Input placeholder="Nome do grupo" value={newGroupName} onChange={e => setNewGroupName(e.target.value)} />
            <Input placeholder="Descrição (opcional)" value={newGroupDesc} onChange={e => setNewGroupDesc(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>Cancelar</Button>
            <Button onClick={handleCreateGroup} disabled={!newGroupName.trim()}>Criar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ContactGroupsManager;
