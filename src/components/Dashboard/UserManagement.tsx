import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { UserPlus, Shield, Trash2, Edit } from 'lucide-react';

interface CompanyUser {
  id: string;
  user_id: string;
  role: string;
  email: string;
  full_name: string;
  permissions: string[];
}

const PERMISSIONS = [
  { value: 'view_calendar', label: 'Ver Agenda' },
  { value: 'manage_calendar', label: 'Gerenciar Agenda' },
  { value: 'view_clients', label: 'Ver Clientes' },
  { value: 'manage_clients', label: 'Gerenciar Clientes' },
  { value: 'view_emails', label: 'Ver E-mails' },
  { value: 'send_emails', label: 'Enviar E-mails' },
  { value: 'manage_email_campaigns', label: 'Campanhas E-mail' },
  { value: 'view_documents', label: 'Ver Documentos' },
  { value: 'manage_documents', label: 'Gerenciar Documentos' },
  { value: 'view_meetings', label: 'Ver Reuniões' },
  { value: 'create_meetings', label: 'Criar Reuniões' },
  { value: 'view_tasks', label: 'Ver Tarefas' },
  { value: 'manage_tasks', label: 'Gerenciar Tarefas' },
  { value: 'view_analytics', label: 'Ver Análises' },
  { value: 'view_crm', label: 'Ver CRM' },
  { value: 'manage_crm', label: 'Gerenciar CRM' },
  { value: 'view_tracking', label: 'Ver Rastreamento' },
  { value: 'manage_tracking', label: 'Gerenciar Rastreamento' }
];

const UserManagement = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [users, setUsers] = useState<CompanyUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [companyId, setCompanyId] = useState<string>('');
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [selectedUser, setSelectedUser] = useState<CompanyUser | null>(null);
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);
  
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserRole, setNewUserRole] = useState<'employee' | 'manager'>('employee');

  useEffect(() => {
    loadCompanyUsers();
  }, []);

  const loadCompanyUsers = async () => {
    try {
      // Get company ID
      const { data: companyData } = await supabase
        .from('company_users')
        .select('company_id')
        .eq('user_id', user?.id)
        .single();

      if (!companyData) return;
      
      setCompanyId(companyData.company_id);

      // Load all users in company
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
          // Get user email
          const { data: authUser } = await supabase.auth.admin.getUserById(cu.user_id);
          
          // Get permissions
          const { data: perms } = await supabase
            .from('user_permissions')
            .select('permission')
            .eq('user_id', cu.user_id)
            .eq('company_id', companyData.company_id);

          return {
            ...cu,
            email: authUser?.user?.email || '',
            full_name: authUser?.user?.user_metadata?.full_name || 'Sem nome',
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

  const handleAddUser = async () => {
    if (!newUserEmail || !companyId) return;

    try {
      // Aqui você precisaria de um endpoint para convidar usuários
      // Por enquanto, vou assumir que o usuário já existe
      
      toast({
        title: 'Funcionalidade em desenvolvimento',
        description: 'Sistema de convite será implementado em breve',
      });
      
      setShowAddDialog(false);
      setNewUserEmail('');
    } catch (error) {
      console.error('Erro:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível adicionar o usuário',
        variant: 'destructive'
      });
    }
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
          permission: permission as any, // Type assertion para enum
          granted_by: user?.id
        }));

        await supabase
          .from('user_permissions')
          .insert(permissionsToInsert);
      }

      toast({
        title: 'Permissões atualizadas',
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
    try {
      await supabase
        .from('company_users')
        .delete()
        .eq('user_id', userId)
        .eq('company_id', companyId);

      toast({
        title: 'Usuário removido',
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

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4 max-w-7xl">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-2">Gerenciar Funcionários</h1>
          <p className="text-muted-foreground">
            Adicione funcionários e configure suas permissões
          </p>
        </div>
        
        <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
          <DialogTrigger asChild>
            <Button>
              <UserPlus className="mr-2 h-4 w-4" />
              Adicionar Funcionário
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Adicionar Funcionário</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>E-mail</Label>
                <Input
                  type="email"
                  placeholder="funcionario@empresa.com"
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
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowAddDialog(false)}>
                Cancelar
              </Button>
              <Button onClick={handleAddUser} disabled={!newUserEmail}>
                Adicionar
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4">
        {users.map((companyUser) => (
          <Card key={companyUser.id}>
            <CardContent className="flex items-center justify-between p-6">
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
                    companyUser.permissions.map((perm) => {
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
                </div>
              </div>
              
              <div className="flex gap-2">
                {companyUser.role !== 'admin' && (
                  <>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => {
                        setSelectedUser(companyUser);
                        setSelectedPermissions(companyUser.permissions);
                      }}
                    >
                      <Shield className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => handleRemoveUser(companyUser.user_id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Modal de edição de permissões */}
      <Dialog open={!!selectedUser} onOpenChange={() => setSelectedUser(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Gerenciar Permissões</DialogTitle>
          </DialogHeader>
          
          {selectedUser && (
            <div className="space-y-4 py-4">
              <div className="mb-4">
                <p className="font-medium">{selectedUser.full_name}</p>
                <p className="text-sm text-muted-foreground">{selectedUser.email}</p>
              </div>

              <div className="grid gap-3">
                {PERMISSIONS.map((perm) => (
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
                    <Label htmlFor={perm.value} className="cursor-pointer">
                      {perm.label}
                    </Label>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setSelectedUser(null)}>
              Cancelar
            </Button>
            <Button onClick={() => selectedUser && handleUpdatePermissions(selectedUser.user_id)}>
              Salvar Permissões
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default UserManagement;
