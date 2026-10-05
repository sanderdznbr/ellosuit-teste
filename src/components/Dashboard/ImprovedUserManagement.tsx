import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { UserPlus, Shield, Trash2, Mail, Copy, Check, X } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';

interface CompanyUser {
  id: string;
  user_id: string;
  role: string;
  email: string;
  full_name: string;
  permissions: string[];
}

const PERMISSIONS = [
  { value: 'view_calendar', label: 'Ver Agenda', category: 'Agenda' },
  { value: 'manage_calendar', label: 'Gerenciar Agenda', category: 'Agenda' },
  { value: 'view_clients', label: 'Ver Clientes', category: 'Clientes' },
  { value: 'manage_clients', label: 'Gerenciar Clientes', category: 'Clientes' },
  { value: 'view_emails', label: 'Ver E-mails', category: 'E-mail' },
  { value: 'send_emails', label: 'Enviar E-mails', category: 'E-mail' },
  { value: 'manage_email_campaigns', label: 'Campanhas E-mail', category: 'E-mail' },
  { value: 'view_documents', label: 'Ver Documentos', category: 'Documentos' },
  { value: 'manage_documents', label: 'Gerenciar Documentos', category: 'Documentos' },
  { value: 'view_meetings', label: 'Ver Reuniões', category: 'Reuniões' },
  { value: 'create_meetings', label: 'Criar Reuniões', category: 'Reuniões' },
  { value: 'view_tasks', label: 'Ver Tarefas', category: 'Tarefas' },
  { value: 'manage_tasks', label: 'Gerenciar Tarefas', category: 'Tarefas' },
  { value: 'view_analytics', label: 'Ver Análises', category: 'Análises' },
  { value: 'view_crm', label: 'Ver CRM', category: 'CRM' },
  { value: 'manage_crm', label: 'Gerenciar CRM', category: 'CRM' },
  { value: 'view_tracking', label: 'Ver Rastreamento', category: 'Rastreamento' },
  { value: 'manage_tracking', label: 'Gerenciar Rastreamento', category: 'Rastreamento' }
];

const PERMISSION_CATEGORIES = Array.from(new Set(PERMISSIONS.map(p => p.category)));

const ImprovedUserManagement = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [users, setUsers] = useState<CompanyUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [companyId, setCompanyId] = useState<string>('');
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const [selectedUser, setSelectedUser] = useState<CompanyUser | null>(null);
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);
  const [copiedInvite, setCopiedInvite] = useState(false);
  
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserRole, setNewUserRole] = useState<'employee' | 'manager'>('employee');
  const [inviteLink, setInviteLink] = useState('');
  const [newUserPermissions, setNewUserPermissions] = useState<string[]>([]);

  useEffect(() => {
    loadCompanyUsers();
  }, []);

  const loadCompanyUsers = async () => {
    try {
      const { data: companyData } = await supabase
        .from('company_users')
        .select('company_id')
        .eq('user_id', user?.id)
        .single();

      if (!companyData) return;
      
      setCompanyId(companyData.company_id);

      const { data: companyUsers, error } = await supabase
        .from('company_users')
        .select(`
          id,
          user_id,
          role
        `)
        .eq('company_id', companyData.company_id);

      if (error) throw error;

      // Get user details and permissions
      const usersWithDetails = await Promise.all(
        (companyUsers || []).map(async (cu) => {
          // For now, use mock data since we can't access auth.users from client
          // In production, you'd call an edge function to get user details
          const { data: perms } = await supabase
            .from('user_permissions')
            .select('permission')
            .eq('user_id', cu.user_id)
            .eq('company_id', companyData.company_id);

          return {
            ...cu,
            email: 'user@example.com', // Would come from edge function
            full_name: 'Usuário', // Would come from edge function
            permissions: perms?.map(p => p.permission) || []
          };
        })
      );

      setUsers(usersWithDetails);
    } catch (error) {
      console.error('Erro ao carregar usuários:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível carregar os usuários',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const generateInviteLink = () => {
    if (!newUserEmail.trim()) {
      toast({
        title: 'E-mail Obrigatório',
        description: 'Por favor, insira o e-mail do funcionário',
        variant: 'destructive'
      });
      return;
    }

    // Generate a unique invite link
    const inviteCode = Math.random().toString(36).substring(2, 15);
    const permissionsParam = newUserPermissions.join(',');
    const link = `https://www.ellosuit.online/convite/${inviteCode}?email=${encodeURIComponent(newUserEmail)}&role=${newUserRole}&permissions=${permissionsParam}`;
    setInviteLink(link);
    setShowInviteDialog(true);
  };

  const copyInviteLink = () => {
    navigator.clipboard.writeText(inviteLink);
    setCopiedInvite(true);
    toast({
      title: 'Link Copiado',
      description: 'Link de convite copiado para a área de transferência',
    });
    setTimeout(() => setCopiedInvite(false), 2000);
  };

  const handleUpdatePermissions = async (userId: string) => {
    try {
      // Delete existing permissions
      await supabase
        .from('user_permissions')
        .delete()
        .eq('user_id', userId)
        .eq('company_id', companyId);

      // Insert new permissions
      if (selectedPermissions.length > 0) {
        const permissionsToInsert = selectedPermissions.map(permission => ({
          user_id: userId,
          company_id: companyId,
          permission: permission as any,
          granted_by: user?.id
        }));

        await supabase
          .from('user_permissions')
          .insert(permissionsToInsert);
      }

      toast({
        title: 'Permissões Atualizadas',
        description: 'As permissões foram salvas com sucesso'
      });

      setSelectedUser(null);
      loadCompanyUsers();
    } catch (error) {
      console.error('Erro:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível atualizar as permissões',
        variant: 'destructive'
      });
    }
  };

  const handleRemoveUser = async (userId: string) => {
    if (!confirm('Tem certeza que deseja remover este funcionário?')) return;

    try {
      await supabase
        .from('company_users')
        .delete()
        .eq('user_id', userId)
        .eq('company_id', companyId);

      toast({
        title: 'Funcionário Removido',
        description: 'O usuário foi removido da empresa'
      });

      loadCompanyUsers();
    } catch (error) {
      console.error('Erro:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível remover o usuário',
        variant: 'destructive'
      });
    }
  };

  const toggleAllInCategory = (category: string, checked: boolean) => {
    const categoryPerms = PERMISSIONS.filter(p => p.category === category).map(p => p.value);
    
    if (checked) {
      setSelectedPermissions([...new Set([...selectedPermissions, ...categoryPerms])]);
    } else {
      setSelectedPermissions(selectedPermissions.filter(p => !categoryPerms.includes(p)));
    }
  };

  const getCategoryPermCount = (category: string) => {
    const categoryPerms = PERMISSIONS.filter(p => p.category === category).map(p => p.value);
    return selectedPermissions.filter(p => categoryPerms.includes(p)).length;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4 max-w-7xl">
      {/* Header */}
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold mb-2">Gerenciar Funcionários</h1>
          <p className="text-muted-foreground">
            Adicione funcionários e configure suas permissões de acesso
          </p>
        </div>
        
        <Button onClick={generateInviteLink} size="lg">
          <UserPlus className="mr-2 h-5 w-5" />
          Convidar Funcionário
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{users.length}</div>
            <p className="text-sm text-muted-foreground">Total de Usuários</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">
              {users.filter(u => u.role === 'admin' || u.role === 'manager').length}
            </div>
            <p className="text-sm text-muted-foreground">Administradores</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">
              {users.filter(u => u.role === 'employee').length}
            </div>
            <p className="text-sm text-muted-foreground">Funcionários</p>
          </CardContent>
        </Card>
      </div>

      {/* Users List */}
      <div className="space-y-4">
        {users.map((companyUser) => (
          <Card key={companyUser.id}>
            <CardContent className="p-6">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="font-semibold text-lg">{companyUser.full_name}</h3>
                    <Badge variant={companyUser.role === 'admin' ? 'default' : 'secondary'}>
                      {companyUser.role === 'admin' ? 'Admin' : 
                       companyUser.role === 'manager' ? 'Gerente' : 'Funcionário'}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mb-3">{companyUser.email}</p>
                  
                  <div className="flex flex-wrap gap-2">
                    {companyUser.permissions.length > 0 ? (
                      companyUser.permissions.slice(0, 5).map((perm) => {
                        const permInfo = PERMISSIONS.find(p => p.value === perm);
                        return (
                          <Badge key={perm} variant="outline" className="text-xs">
                            {permInfo?.label || perm}
                          </Badge>
                        );
                      })
                    ) : (
                      <span className="text-sm text-muted-foreground">Sem permissões específicas</span>
                    )}
                    {companyUser.permissions.length > 5 && (
                      <Badge variant="secondary" className="text-xs">
                        +{companyUser.permissions.length - 5} mais
                      </Badge>
                    )}
                  </div>
                </div>
                
                <div className="flex gap-2">
                  {companyUser.role !== 'admin' && (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSelectedUser(companyUser);
                          setSelectedPermissions(companyUser.permissions);
                        }}
                      >
                        <Shield className="h-4 w-4 mr-2" />
                        Permissões
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleRemoveUser(companyUser.user_id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Invite Dialog */}
      <Dialog open={showInviteDialog} onOpenChange={(open) => {
        setShowInviteDialog(open);
        if (!open) {
          setNewUserEmail('');
          setNewUserRole('employee');
          setNewUserPermissions([]);
          setInviteLink('');
        }
      }}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh]">
          <DialogHeader>
            <DialogTitle>Convidar Funcionário</DialogTitle>
            <DialogDescription>
              Configure as permissões e gere o link de convite
            </DialogDescription>
          </DialogHeader>
          
          <ScrollArea className="max-h-[calc(85vh-200px)] pr-4">
            <div className="space-y-6">
              {/* Email e Função */}
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="invite-email">E-mail do Funcionário *</Label>
                  <Input
                    id="invite-email"
                    type="email"
                    placeholder="funcionario@exemplo.com"
                    value={newUserEmail}
                    onChange={(e) => setNewUserEmail(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Função</Label>
                  <Select value={newUserRole} onValueChange={(v: any) => setNewUserRole(v)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="employee">Funcionário</SelectItem>
                      <SelectItem value="manager">Gerente</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Separator />

              {/* Permissões */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label className="text-base font-semibold">Permissões de Acesso</Label>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      if (newUserPermissions.length === PERMISSIONS.length) {
                        setNewUserPermissions([]);
                      } else {
                        setNewUserPermissions(PERMISSIONS.map(p => p.value));
                      }
                    }}
                  >
                    {newUserPermissions.length === PERMISSIONS.length ? 'Desmarcar Todas' : 'Marcar Todas'}
                  </Button>
                </div>

                {PERMISSION_CATEGORIES.map((category) => {
                  const categoryPerms = PERMISSIONS.filter(p => p.category === category);
                  const selectedCount = newUserPermissions.filter(p => 
                    categoryPerms.some(cp => cp.value === p)
                  ).length;
                  
                  return (
                    <div key={category} className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <h4 className="font-medium text-sm">{category}</h4>
                          <Badge variant="secondary" className="text-xs">
                            {selectedCount}/{categoryPerms.length}
                          </Badge>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            const allSelected = selectedCount === categoryPerms.length;
                            if (allSelected) {
                              setNewUserPermissions(newUserPermissions.filter(p => 
                                !categoryPerms.some(cp => cp.value === p)
                              ));
                            } else {
                              setNewUserPermissions([
                                ...newUserPermissions,
                                ...categoryPerms.map(p => p.value).filter(v => !newUserPermissions.includes(v))
                              ]);
                            }
                          }}
                        >
                          {selectedCount === categoryPerms.length ? 'Desmarcar' : 'Marcar'}
                        </Button>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-3 pl-2">
                        {categoryPerms.map((perm) => (
                          <div key={perm.value} className="flex items-center space-x-2">
                            <Checkbox
                              id={`invite-${perm.value}`}
                              checked={newUserPermissions.includes(perm.value)}
                              onCheckedChange={(checked) => {
                                if (checked) {
                                  setNewUserPermissions([...newUserPermissions, perm.value]);
                                } else {
                                  setNewUserPermissions(newUserPermissions.filter(p => p !== perm.value));
                                }
                              }}
                            />
                            <Label htmlFor={`invite-${perm.value}`} className="cursor-pointer text-sm">
                              {perm.label}
                            </Label>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>

              {inviteLink && (
                <>
                  <Separator />
                  <div className="space-y-2">
                    <Label>Link de Convite Gerado</Label>
                    <div className="flex items-center gap-2">
                      <Input value={inviteLink} readOnly className="font-mono text-sm" />
                      <Button
                        size="icon"
                        variant="outline"
                        onClick={copyInviteLink}
                      >
                        {copiedInvite ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                      </Button>
                    </div>
                    <div className="bg-muted p-3 rounded-lg text-sm">
                      <p className="font-medium mb-1">⚠️ Importante:</p>
                      <p className="text-muted-foreground">
                        Este link permite que a pessoa com acesso a ele se junte à sua empresa. 
                        Compartilhe apenas com o funcionário correto.
                      </p>
                    </div>
                  </div>
                </>
              )}
            </div>
          </ScrollArea>

          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="outline" onClick={() => setShowInviteDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={generateInviteLink} disabled={!newUserEmail.trim()}>
              {inviteLink ? (
                <>
                  <Mail className="mr-2 h-4 w-4" />
                  Copiar Link
                </>
              ) : (
                'Gerar Link de Convite'
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Permissions Dialog */}
      <Dialog open={!!selectedUser} onOpenChange={() => setSelectedUser(null)}>
        <DialogContent className="max-w-3xl max-h-[85vh]">
          <DialogHeader>
            <DialogTitle>Gerenciar Permissões</DialogTitle>
            <DialogDescription>
              Configure o que {selectedUser?.full_name} pode visualizar e fazer no sistema
            </DialogDescription>
          </DialogHeader>
          
          {selectedUser && (
            <ScrollArea className="h-[500px] pr-4">
              <div className="space-y-6">
                {PERMISSION_CATEGORIES.map((category) => {
                  const categoryPerms = PERMISSIONS.filter(p => p.category === category);
                  const selectedCount = getCategoryPermCount(category);
                  const allSelected = selectedCount === categoryPerms.length;
                  
                  return (
                    <div key={category} className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <h4 className="font-semibold">{category}</h4>
                          <Badge variant="secondary" className="text-xs">
                            {selectedCount}/{categoryPerms.length}
                          </Badge>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleAllInCategory(category, !allSelected)}
                        >
                          {allSelected ? 'Desmarcar Todos' : 'Marcar Todos'}
                        </Button>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pl-2">
                        {categoryPerms.map((perm) => (
                          <div key={perm.value} className="flex items-center space-x-2">
                            <Checkbox
                              id={perm.value}
                              checked={selectedPermissions.includes(perm.value)}
                              onCheckedChange={(checked) => {
                                if (checked) {
                                  setSelectedPermissions([...selectedPermissions, perm.value]);
                                } else {
                                  setSelectedPermissions(selectedPermissions.filter(p => p !== perm.value));
                                }
                              }}
                            />
                            <Label htmlFor={perm.value} className="cursor-pointer text-sm">
                              {perm.label}
                            </Label>
                          </div>
                        ))}
                      </div>
                      
                      {category !== PERMISSION_CATEGORIES[PERMISSION_CATEGORIES.length - 1] && (
                        <Separator className="mt-4" />
                      )}
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          )}
          
          <div className="flex justify-between items-center pt-4 border-t">
            <div className="text-sm text-muted-foreground">
              {selectedPermissions.length} permissão(ões) selecionada(s)
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setSelectedUser(null)}>
                Cancelar
              </Button>
              <Button onClick={() => selectedUser && handleUpdatePermissions(selectedUser.user_id)}>
                <Check className="mr-2 h-4 w-4" />
                Salvar Permissões
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ImprovedUserManagement;
