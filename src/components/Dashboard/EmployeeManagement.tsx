import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { UserPlus, Shield, Trash2, Mail, Copy, Check, Users, Crown, Briefcase } from 'lucide-react';
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
];

const PERMISSION_CATEGORIES = Array.from(new Set(PERMISSIONS.map(p => p.category)));

const EmployeeManagement = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [users, setUsers] = useState<CompanyUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [companyId, setCompanyId] = useState<string>('');
  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const [selectedUser, setSelectedUser] = useState<CompanyUser | null>(null);
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);
  
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'employee' | 'manager'>('employee');
  const [invitePermissions, setInvitePermissions] = useState<string[]>([]);
  const [inviteLink, setInviteLink] = useState('');
  const [copied, setCopied] = useState(false);

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
        .select('id, user_id, role')
        .eq('company_id', companyData.company_id);

      if (error) throw error;

      const usersWithDetails = await Promise.all(
        (companyUsers || []).map(async (cu) => {
          const { data: perms } = await supabase
            .from('user_permissions')
            .select('permission')
            .eq('user_id', cu.user_id)
            .eq('company_id', companyData.company_id);

          return {
            ...cu,
            email: `usuario${cu.user_id.slice(0, 4)}@email.com`,
            full_name: `Usuário ${cu.user_id.slice(0, 8)}`,
            permissions: perms?.map(p => p.permission) || []
          };
        })
      );

      setUsers(usersWithDetails);
    } catch (error) {
      console.error('Erro ao carregar usuários:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível carregar os funcionários',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const generateInviteLink = () => {
    if (!inviteEmail.trim()) {
      toast({
        title: 'E-mail Obrigatório',
        description: 'Por favor, insira o e-mail do funcionário',
        variant: 'destructive'
      });
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(inviteEmail)) {
      toast({
        title: 'E-mail Inválido',
        description: 'Por favor, insira um e-mail válido',
        variant: 'destructive'
      });
      return;
    }

    const inviteCode = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    const permissionsParam = invitePermissions.join(',');
    const link = `https://www.ellosuit.online/convite?code=${inviteCode}&email=${encodeURIComponent(inviteEmail)}&role=${inviteRole}&perms=${permissionsParam}&company=${companyId}`;
    setInviteLink(link);
    
    toast({
      title: 'Link Gerado',
      description: 'Link de convite criado com sucesso!',
    });
  };

  const copyInviteLink = () => {
    navigator.clipboard.writeText(inviteLink);
    setCopied(true);
    toast({
      title: 'Link Copiado!',
      description: 'Link de convite copiado para a área de transferência',
    });
    setTimeout(() => setCopied(false), 2000);
  };

  const resetInviteDialog = () => {
    setInviteEmail('');
    setInviteRole('employee');
    setInvitePermissions([]);
    setInviteLink('');
    setCopied(false);
    setShowInviteDialog(false);
  };

  const handleUpdatePermissions = async () => {
    if (!selectedUser) return;

    try {
      await supabase
        .from('user_permissions')
        .delete()
        .eq('user_id', selectedUser.user_id)
        .eq('company_id', companyId);

      if (selectedPermissions.length > 0) {
        const permissionsToInsert = selectedPermissions.map(permission => ({
          user_id: selectedUser.user_id,
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

  const handleRemoveUser = async (userId: string, userName: string) => {
    if (!confirm(`Tem certeza que deseja remover ${userName}?`)) return;

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

  const toggleCategoryPermissions = (category: string, isInvite = false) => {
    const categoryPerms = PERMISSIONS.filter(p => p.category === category).map(p => p.value);
    const currentPerms = isInvite ? invitePermissions : selectedPermissions;
    const setPerms = isInvite ? setInvitePermissions : setSelectedPermissions;
    
    const allSelected = categoryPerms.every(p => currentPerms.includes(p));
    
    if (allSelected) {
      setPerms(currentPerms.filter(p => !categoryPerms.includes(p)));
    } else {
      setPerms([...new Set([...currentPerms, ...categoryPerms])]);
    }
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
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-4xl font-bold mb-2">Gerenciar Funcionários</h1>
            <p className="text-muted-foreground text-lg">
              Convide novos membros e configure permissões de acesso
            </p>
          </div>
          <Button onClick={() => setShowInviteDialog(true)} size="lg" className="gap-2">
            <UserPlus className="h-5 w-5" />
            Convidar Funcionário
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="bg-gradient-to-br from-[#F0F2FE] to-[#DFE4FB] dark:from-blue-950 dark:to-[#0F1631] border-[#B3BFF0] dark:border-[#1A2551]">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Total de Usuários</p>
                  <p className="text-3xl font-bold mt-1">{users.length}</p>
                </div>
                <Users className="h-10 w-10 text-[#2F428D] dark:text-[#5A74D1]" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-950 dark:to-purple-900 border-purple-200 dark:border-purple-800">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Administradores</p>
                  <p className="text-3xl font-bold mt-1">
                    {users.filter(u => u.role === 'admin' || u.role === 'manager').length}
                  </p>
                </div>
                <Crown className="h-10 w-10 text-purple-600 dark:text-purple-400" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950 dark:to-green-900 border-green-200 dark:border-green-800">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Funcionários</p>
                  <p className="text-3xl font-bold mt-1">
                    {users.filter(u => u.role === 'employee').length}
                  </p>
                </div>
                <Briefcase className="h-10 w-10 text-green-600 dark:text-green-400" />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Users List */}
      <div className="space-y-3">
        {users.map((companyUser) => (
          <Card key={companyUser.id} className="hover:shadow-md transition-shadow">
            <CardContent className="p-6">
              <div className="flex items-center justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="font-semibold text-lg">{companyUser.full_name}</h3>
                    <Badge variant={companyUser.role === 'admin' ? 'default' : companyUser.role === 'manager' ? 'secondary' : 'outline'}>
                      {companyUser.role === 'admin' ? 'Admin' : companyUser.role === 'manager' ? 'Gerente' : 'Funcionário'}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mb-3">{companyUser.email}</p>
                  
                  <div className="flex flex-wrap gap-1.5">
                    {companyUser.permissions.length > 0 ? (
                      companyUser.permissions.slice(0, 6).map((perm) => {
                        const permInfo = PERMISSIONS.find(p => p.value === perm);
                        return (
                          <Badge key={perm} variant="secondary" className="text-xs">
                            {permInfo?.label || perm}
                          </Badge>
                        );
                      })
                    ) : (
                      <span className="text-sm text-muted-foreground italic">Sem permissões atribuídas</span>
                    )}
                    {companyUser.permissions.length > 6 && (
                      <Badge variant="outline" className="text-xs">
                        +{companyUser.permissions.length - 6}
                      </Badge>
                    )}
                  </div>
                </div>
                
                {companyUser.role !== 'admin' && (
                  <div className="flex gap-2">
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
                      onClick={() => handleRemoveUser(companyUser.user_id, companyUser.full_name)}
                      className="text-destructive hover:bg-destructive hover:text-destructive-foreground"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Invite Dialog */}
      <Dialog open={showInviteDialog} onOpenChange={(open) => !open && resetInviteDialog()}>
        <DialogContent className="max-w-3xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className="text-2xl">Convidar Novo Funcionário</DialogTitle>
            <DialogDescription>
              Preencha os dados e gere um link de convite para o novo membro da equipe
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="max-h-[calc(90vh-200px)] pr-4">
            <div className="space-y-6 py-4">
              {/* Email e Função */}
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="invite-email" className="text-base font-semibold">
                    E-mail do Funcionário <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="invite-email"
                    type="email"
                    placeholder="funcionario@exemplo.com"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    className="h-11"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-base font-semibold">Função</Label>
                  <Select value={inviteRole} onValueChange={(v: any) => setInviteRole(v)}>
                    <SelectTrigger className="h-11">
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
                      if (invitePermissions.length === PERMISSIONS.length) {
                        setInvitePermissions([]);
                      } else {
                        setInvitePermissions(PERMISSIONS.map(p => p.value));
                      }
                    }}
                  >
                    {invitePermissions.length === PERMISSIONS.length ? 'Desmarcar Todas' : 'Marcar Todas'}
                  </Button>
                </div>

                {PERMISSION_CATEGORIES.map((category) => {
                  const categoryPerms = PERMISSIONS.filter(p => p.category === category);
                  const selectedCount = invitePermissions.filter(p => categoryPerms.some(cp => cp.value === p)).length;
                  
                  return (
                    <div key={category} className="space-y-3 p-4 rounded-lg border bg-muted/30">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <h4 className="font-medium">{category}</h4>
                          <Badge variant="secondary" className="text-xs">
                            {selectedCount}/{categoryPerms.length}
                          </Badge>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleCategoryPermissions(category, true)}
                        >
                          {selectedCount === categoryPerms.length ? 'Desmarcar' : 'Marcar'}
                        </Button>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-3">
                        {categoryPerms.map((perm) => (
                          <div key={perm.value} className="flex items-center space-x-2">
                            <Checkbox
                              id={`invite-${perm.value}`}
                              checked={invitePermissions.includes(perm.value)}
                              onCheckedChange={(checked) => {
                                if (checked) {
                                  setInvitePermissions([...invitePermissions, perm.value]);
                                } else {
                                  setInvitePermissions(invitePermissions.filter(p => p !== perm.value));
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

              {/* Generated Link */}
              {inviteLink && (
                <>
                  <Separator />
                  <div className="space-y-3 p-4 rounded-lg bg-primary/5 border border-primary/20">
                    <Label className="text-base font-semibold flex items-center gap-2">
                      <Mail className="h-4 w-4" />
                      Link de Convite Gerado
                    </Label>
                    <div className="flex gap-2">
                      <Input value={inviteLink} readOnly className="font-mono text-xs" />
                      <Button onClick={copyInviteLink} variant="outline">
                        {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Envie este link para o funcionário via e-mail ou mensagem
                    </p>
                  </div>
                </>
              )}
            </div>
          </ScrollArea>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={resetInviteDialog}>
              Cancelar
            </Button>
            {!inviteLink ? (
              <Button onClick={generateInviteLink} disabled={!inviteEmail.trim()}>
                <Mail className="h-4 w-4 mr-2" />
                Gerar Link de Convite
              </Button>
            ) : (
              <Button onClick={resetInviteDialog} variant="default">
                Concluir
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Permissions Dialog */}
      <Dialog open={!!selectedUser} onOpenChange={() => setSelectedUser(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className="text-2xl">Gerenciar Permissões</DialogTitle>
            {selectedUser && (
              <DialogDescription className="text-base">
                Configurando permissões para <strong>{selectedUser.full_name}</strong> ({selectedUser.email})
              </DialogDescription>
            )}
          </DialogHeader>

          <ScrollArea className="max-h-[calc(90vh-200px)] pr-4">
            <div className="space-y-4 py-4">
              {PERMISSION_CATEGORIES.map((category) => {
                const categoryPerms = PERMISSIONS.filter(p => p.category === category);
                const selectedCount = selectedPermissions.filter(p => categoryPerms.some(cp => cp.value === p)).length;
                
                return (
                  <div key={category} className="space-y-3 p-4 rounded-lg border bg-muted/30">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <h4 className="font-medium">{category}</h4>
                        <Badge variant="secondary" className="text-xs">
                          {selectedCount}/{categoryPerms.length}
                        </Badge>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleCategoryPermissions(category, false)}
                      >
                        {selectedCount === categoryPerms.length ? 'Desmarcar' : 'Marcar'}
                      </Button>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-3">
                      {categoryPerms.map((perm) => (
                        <div key={perm.value} className="flex items-center space-x-2">
                          <Checkbox
                            id={`edit-${perm.value}`}
                            checked={selectedPermissions.includes(perm.value)}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setSelectedPermissions([...selectedPermissions, perm.value]);
                              } else {
                                setSelectedPermissions(selectedPermissions.filter(p => p !== perm.value));
                              }
                            }}
                          />
                          <Label htmlFor={`edit-${perm.value}`} className="cursor-pointer text-sm">
                            {perm.label}
                          </Label>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setSelectedUser(null)}>
              Cancelar
            </Button>
            <Button onClick={handleUpdatePermissions}>
              Salvar Permissões
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default EmployeeManagement;
