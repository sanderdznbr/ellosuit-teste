import React, { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useIsMobile } from '@/hooks/use-mobile';
import MobileLayout from '@/components/Mobile/MobileLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { 
  Users, 
  UserPlus, 
  Mail, 
  MoreHorizontal,
  Shield,
  Crown,
  User,
  Trash2,
  Edit,
  Check,
  X,
  Send
} from 'lucide-react';
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'manager' | 'employee';
  status: 'active' | 'pending' | 'inactive';
  joinedAt: string;
  avatar?: string;
}

const Team = () => {
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const { toast } = useToast();
  
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'admin' | 'manager' | 'employee'>('employee');
  const [isInviting, setIsInviting] = useState(false);

  // Mock data - Em produção, isso viria do banco de dados
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([
    {
      id: '1',
      name: 'João Silva',
      email: 'joao@empresa.com',
      role: 'admin',
      status: 'active',
      joinedAt: '2024-01-15',
    },
    {
      id: '2',
      name: 'Maria Santos',
      email: 'maria@empresa.com',
      role: 'manager',
      status: 'active',
      joinedAt: '2024-02-20',
    },
    {
      id: '3',
      name: 'Pedro Oliveira',
      email: 'pedro@empresa.com',
      role: 'employee',
      status: 'pending',
      joinedAt: '2024-03-10',
    },
  ]);

  if (!user) {
    return null;
  }

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'admin':
        return 'Administrador';
      case 'manager':
        return 'Gerente';
      case 'employee':
        return 'Funcionário';
      default:
        return role;
    }
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'admin':
        return <Crown className="h-4 w-4" />;
      case 'manager':
        return <Shield className="h-4 w-4" />;
      case 'employee':
        return <User className="h-4 w-4" />;
      default:
        return <User className="h-4 w-4" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge variant="default">Ativo</Badge>;
      case 'pending':
        return <Badge variant="secondary">Pendente</Badge>;
      case 'inactive':
        return <Badge variant="destructive">Inativo</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const handleInviteUser = async () => {
    if (!inviteEmail) {
      toast({
        title: "Erro",
        description: "Por favor, digite um email válido",
        variant: "destructive"
      });
      return;
    }

    setIsInviting(true);
    
    try {
      // Simular envio de convite
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Adicionar novo membro com status pendente
      const newMember: TeamMember = {
        id: Date.now().toString(),
        name: inviteEmail.split('@')[0],
        email: inviteEmail,
        role: inviteRole,
        status: 'pending',
        joinedAt: new Date().toISOString().split('T')[0],
      };
      
      setTeamMembers(prev => [...prev, newMember]);
      setIsInviteModalOpen(false);
      setInviteEmail('');
      setInviteRole('employee');
      
      toast({
        title: "Convite enviado",
        description: `Convite enviado para ${inviteEmail} com sucesso!`
      });
      
    } catch (error) {
      toast({
        title: "Erro",
        description: "Erro ao enviar convite. Tente novamente.",
        variant: "destructive"
      });
    } finally {
      setIsInviting(false);
    }
  };

  const handleRemoveMember = (memberId: string) => {
    setTeamMembers(prev => prev.filter(member => member.id !== memberId));
    toast({
      title: "Membro removido",
      description: "O membro foi removido da equipe com sucesso"
    });
  };

  const handleUpdateRole = (memberId: string, newRole: 'admin' | 'manager' | 'employee') => {
    setTeamMembers(prev => 
      prev.map(member => 
        member.id === memberId 
          ? { ...member, role: newRole }
          : member
      )
    );
    toast({
      title: "Função atualizada",
      description: "A função do membro foi atualizada com sucesso"
    });
  };

  const content = (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Equipe</h1>
          <p className="text-gray-600 mt-2">Gerencie os membros da sua equipe</p>
        </div>
        
        <Dialog open={isInviteModalOpen} onOpenChange={setIsInviteModalOpen}>
          <DialogTrigger asChild>
            <Button>
              <UserPlus className="h-4 w-4 mr-2" />
              Convidar Membro
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Convidar Novo Membro</DialogTitle>
              <DialogDescription>
                Envie um convite por email para adicionar um novo membro à equipe
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="invite-email">Email do Convite</Label>
                <Input
                  id="invite-email"
                  type="email"
                  placeholder="usuario@empresa.com"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                />
              </div>
              
              <div>
                <Label htmlFor="invite-role">Função</Label>
                <Select value={inviteRole} onValueChange={(value: 'admin' | 'manager' | 'employee') => setInviteRole(value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a função" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="employee">Funcionário</SelectItem>
                    <SelectItem value="manager">Gerente</SelectItem>
                    <SelectItem value="admin">Administrador</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="flex justify-end space-x-2">
                <Button 
                  variant="outline" 
                  onClick={() => setIsInviteModalOpen(false)}
                  disabled={isInviting}
                >
                  Cancelar
                </Button>
                <Button 
                  onClick={handleInviteUser}
                  disabled={isInviting}
                >
                  {isInviting ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Enviando...
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4 mr-2" />
                      Enviar Convite
                    </>
                  )}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Estatísticas */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total de Membros</p>
                <p className="text-2xl font-bold">{teamMembers.length}</p>
              </div>
              <Users className="h-8 w-8 text-[#2F428D]" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Membros Ativos</p>
                <p className="text-2xl font-bold">{teamMembers.filter(m => m.status === 'active').length}</p>
              </div>
              <Check className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Convites Pendentes</p>
                <p className="text-2xl font-bold">{teamMembers.filter(m => m.status === 'pending').length}</p>
              </div>
              <Mail className="h-8 w-8 text-[#253573]" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Administradores</p>
                <p className="text-2xl font-bold">{teamMembers.filter(m => m.role === 'admin').length}</p>
              </div>
              <Crown className="h-8 w-8 text-purple-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Lista de Membros */}
      <Card>
        <CardHeader>
          <CardTitle>Membros da Equipe</CardTitle>
          <CardDescription>
            Gerencie as funções e permissões dos membros da sua equipe
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {teamMembers.map((member) => (
              <div key={member.id} className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center">
                    <span className="text-sm font-medium">
                      {member.name.split(' ').map(n => n[0]).join('').toUpperCase()}
                    </span>
                  </div>
                  
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-medium">{member.name}</p>
                      {member.status === 'pending' && (
                        <Badge variant="secondary" className="text-xs">
                          Convite pendente
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-gray-600">{member.email}</p>
                    <p className="text-xs text-gray-500">
                      Entrou em {new Date(member.joinedAt).toLocaleDateString('pt-BR')}
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1">
                    {getRoleIcon(member.role)}
                    <span className="text-sm">{getRoleLabel(member.role)}</span>
                  </div>
                  
                  {getStatusBadge(member.status)}
                  
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => handleUpdateRole(member.id, 'admin')}>
                        <Crown className="h-4 w-4 mr-2" />
                        Tornar Administrador
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleUpdateRole(member.id, 'manager')}>
                        <Shield className="h-4 w-4 mr-2" />
                        Tornar Gerente
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleUpdateRole(member.id, 'employee')}>
                        <User className="h-4 w-4 mr-2" />
                        Tornar Funcionário
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        onClick={() => handleRemoveMember(member.id)}
                        className="text-red-600"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Remover da Equipe
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            ))}
            
            {teamMembers.length === 0 && (
              <div className="text-center py-8">
                <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600">Nenhum membro na equipe ainda</p>
                <p className="text-sm text-gray-500">Clique em "Convidar Membro" para adicionar pessoas à sua equipe</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );

  if (isMobile) {
    return (
      <MobileLayout>
        {content}
      </MobileLayout>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto p-6">
        {content}
      </div>
    </div>
  );
};

export default Team;