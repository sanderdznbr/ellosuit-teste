import React, { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
  UserPlus, MoreVertical, Shield, Mail, Search, Users, Crown, UserCheck,
  Trash2, Copy, Check, Clock, RefreshCw, XCircle, Link2, Briefcase, AlertTriangle, X, Sparkles,
} from 'lucide-react';
import { toast } from 'sonner';
import { useSubscription } from '@/hooks/useSubscription';
import { UpgradeModal } from '@/components/shared/UpgradeModal';

interface TeamMember {
  id: string;
  user_id: string;
  role: string;
  created_at: string;
  email?: string;
  name?: string;
  avatar_url?: string;
  permissions: string[];
}

interface Invitation {
  id: string;
  email: string;
  role: string;
  permissions: string[];
  status: string;
  token: string;
  created_at: string;
  expires_at: string;
}

const PERMISSIONS_CONFIG = [
  { category: 'Agenda', permissions: [
    { value: 'view_calendar', label: 'Ver agenda' },
    { value: 'manage_calendar', label: 'Gerenciar eventos' },
  ]},
  { category: 'Cadastros / CRM', permissions: [
    { value: 'view_clients', label: 'Ver contatos' },
    { value: 'manage_clients', label: 'Criar/editar contatos' },
    { value: 'view_crm', label: 'Ver CRM' },
    { value: 'manage_crm', label: 'Gerenciar CRM' },
  ]},
  { category: 'E-mail Marketing', permissions: [
    { value: 'view_emails', label: 'Ver e-mails' },
    { value: 'send_emails', label: 'Enviar e-mails' },
    { value: 'manage_email_campaigns', label: 'Gerenciar campanhas' },
  ]},
  { category: 'Documentos / Drive', permissions: [
    { value: 'view_documents', label: 'Ver documentos' },
    { value: 'manage_documents', label: 'Gerenciar documentos' },
  ]},
  { category: 'Reuniões', permissions: [
    { value: 'view_meetings', label: 'Ver reuniões' },
    { value: 'create_meetings', label: 'Criar reuniões' },
  ]},
  { category: 'Tarefas', permissions: [
    { value: 'view_tasks', label: 'Ver tarefas' },
    { value: 'manage_tasks', label: 'Gerenciar tarefas' },
  ]},
  { category: 'Rastreamento', permissions: [
    { value: 'view_tracking', label: 'Ver rastreamento' },
    { value: 'manage_tracking', label: 'Gerenciar rastreamento' },
  ]},
  { category: 'Analytics', permissions: [
    { value: 'view_analytics', label: 'Ver análises' },
  ]},
  { category: 'Administração', permissions: [
    { value: 'manage_settings', label: 'Configurações' },
    { value: 'manage_users', label: 'Gerenciar usuários' },
  ]},
];

const ALL_PERMS = PERMISSIONS_CONFIG.flatMap(c => c.permissions.map(p => p.value));

const ROLE_CONFIG: Record<string, { label: string; dotColor: string; icon: React.ElementType }> = {
  admin: { label: 'Admin', dotColor: 'bg-red-500', icon: Crown },
  adminmaster: { label: 'Admin Master', dotColor: 'bg-purple-500', icon: Crown },
  manager: { label: 'Gerente', dotColor: 'bg-amber-500', icon: Shield },
  employee: { label: 'Colaborador', dotColor: 'bg-slate-400', icon: UserCheck },
};

const TeamManagement = () => {
  const { user } = useAuth();
  const subscription = useSubscription();
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [currentUserRole, setCurrentUserRole] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('employee');
  const [invitePerms, setInvitePerms] = useState<string[]>([]);
  const [inviteSending, setInviteSending] = useState(false);
  const [generatedLink, setGeneratedLink] = useState('');
  const [copied, setCopied] = useState(false);

  const [permDialogOpen, setPermDialogOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<TeamMember | null>(null);
  const [editPerms, setEditPerms] = useState<string[]>([]);
  const [editRole, setEditRole] = useState('employee');

  const [activeTab, setActiveTab] = useState<'membros' | 'convites'>('membros');

  useEffect(() => {
    if (user) loadAll();
  }, [user]);

  const loadAll = async () => {
    setLoading(true);
    try {
      const { data: cu } = await supabase
        .from('company_users')
        .select('company_id, role')
        .eq('user_id', user!.id)
        .single();
      if (!cu) return;
      setCompanyId(cu.company_id);
      setCurrentUserRole(cu.role);

      const { data: teamMembers } = await supabase
        .from('company_users')
        .select(`
          id, user_id, role, created_at,
          profiles:user_id (
            id, full_name, avatar_url, email
          )
        `)
        .eq('company_id', cu.company_id)
        .order('created_at');

      const membersWithPerms: TeamMember[] = await Promise.all(
        (teamMembers || []).map(async (m: any) => {
          const { data: perms } = await supabase
            .from('user_permissions')
            .select('permission')
            .eq('user_id', m.user_id)
            .eq('company_id', cu.company_id);
          const profile = m.profiles;
          return {
            id: m.id,
            user_id: m.user_id,
            role: m.role,
            created_at: m.created_at,
            email: profile?.email || (m.user_id === user!.id ? user!.email : `user-${m.user_id.slice(0, 8)}`),
            name: profile?.full_name || undefined,
            avatar_url: profile?.avatar_url || undefined,
            permissions: perms?.map(p => p.permission) || [],
          };
        })
      );
      setMembers(membersWithPerms);

      const { data: invs } = await supabase
        .from('team_invitations')
        .select('*')
        .eq('company_id', cu.company_id)
        .in('status', ['pending'])
        .order('created_at', { ascending: false });
      setInvitations((invs as any) || []);
    } catch (err) {
      console.error(err);
      toast.error('Erro ao carregar equipe');
    } finally {
      setLoading(false);
    }
  };

  const remainingSlots = subscription.limits.maxUsers - members.length;
  const canInvite = remainingSlots > 0;

  const handleOpenInvite = () => {
    if (!canInvite) { setUpgradeOpen(true); return; }
    setInviteOpen(v => !v);
  };

  const handleSendInvite = async () => {
    if (!inviteEmail.trim() || !companyId) return;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(inviteEmail)) { toast.error('Email inválido'); return; }
    if (!canInvite) { setUpgradeOpen(true); return; }

    setInviteSending(true);
    try {
      const { data, error } = await supabase.functions.invoke('team-invite', {
        body: {
          action: 'send-invite',
          email: inviteEmail,
          role: inviteRole,
          permissions: invitePerms,
          companyId,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setGeneratedLink(data.inviteUrl || '');
      toast.success(`Convite enviado para ${inviteEmail}!`);
      loadAll();
      subscription.refetch();
    } catch (err: any) {
      toast.error(err.message || 'Erro ao enviar convite');
    } finally {
      setInviteSending(false);
    }
  };

  const handleCancelInvite = async (invId: string) => {
    try {
      await supabase.functions.invoke('team-invite', {
        body: { action: 'cancel-invite', invitationId: invId, companyId },
      });
      toast.success('Convite cancelado');
      loadAll();
    } catch { toast.error('Erro ao cancelar'); }
  };

  const handleResendInvite = async (invId: string) => {
    try {
      await supabase.functions.invoke('team-invite', {
        body: { action: 'resend-invite', invitationId: invId },
      });
      toast.success('Convite reenviado!');
      loadAll();
    } catch { toast.error('Erro ao reenviar'); }
  };

  const handleUpdateMember = async () => {
    if (!editingMember || !companyId) return;
    try {
      await supabase.from('company_users').update({ role: editRole as any }).eq('id', editingMember.id);
      await supabase.from('user_permissions').delete()
        .eq('user_id', editingMember.user_id).eq('company_id', companyId);

      if (editRole !== 'admin' && editPerms.length > 0) {
        await supabase.from('user_permissions').insert(
          editPerms.map(p => ({
            user_id: editingMember.user_id,
            company_id: companyId,
            permission: p as any,
            granted_by: user?.id,
          }))
        );
      }

      toast.success('Membro atualizado!');
      setPermDialogOpen(false);
      setEditingMember(null);
      loadAll();
    } catch { toast.error('Erro ao atualizar'); }
  };

  const handleRemoveMember = async (memberId: string, userId: string) => {
    if (userId === user?.id) { toast.error('Você não pode se remover'); return; }
    if (!confirm('Tem certeza que deseja remover este membro?')) return;
    try {
      await supabase.from('user_permissions').delete().eq('user_id', userId).eq('company_id', companyId!);
      await supabase.from('company_users').delete().eq('id', memberId);
      toast.success('Membro removido');
      loadAll();
    } catch { toast.error('Erro ao remover'); }
  };

  const openPermDialog = (member: TeamMember) => {
    setEditingMember(member);
    setEditPerms(member.permissions);
    setEditRole(member.role);
    setPermDialogOpen(true);
  };

  const resetInviteDialog = () => {
    setInviteEmail(''); setInviteRole('employee'); setInvitePerms([]);
    setGeneratedLink(''); setCopied(false); setInviteOpen(false);
  };

  const togglePerm = (perm: string, perms: string[], setPerms: (p: string[]) => void) => {
    setPerms(perms.includes(perm) ? perms.filter(p => p !== perm) : [...perms, perm]);
  };

  const toggleCategory = (cat: typeof PERMISSIONS_CONFIG[0], perms: string[], setPerms: (p: string[]) => void) => {
    const catPerms = cat.permissions.map(p => p.value);
    const allSelected = catPerms.every(p => perms.includes(p));
    setPerms(allSelected ? perms.filter(p => !catPerms.includes(p)) : [...new Set([...perms, ...catPerms])]);
  };

  const isAdmin = currentUserRole === 'admin' || currentUserRole === 'adminmaster';

  const filteredMembers = members.filter(m =>
    (m.email || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (m.name || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  const copyLink = (link?: string) => {
    navigator.clipboard.writeText(link || generatedLink);
    setCopied(true);
    toast.success('Link copiado!');
    setTimeout(() => setCopied(false), 2000);
  };

  const getInitials = (member: TeamMember) => {
    if (member.name) return member.name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();
    return (member.email || '??').slice(0, 2).toUpperCase();
  };

  const PermissionsEditor = ({ perms, setPerms, disabled }: { perms: string[]; setPerms: (p: string[]) => void; disabled?: boolean }) => (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-foreground">Permissões de Acesso</p>
        <button onClick={() => setPerms(perms.length === ALL_PERMS.length ? [] : [...ALL_PERMS])} disabled={disabled}
          className="text-[10px] text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40">
          {perms.length === ALL_PERMS.length ? 'Desmarcar tudo' : 'Marcar tudo'}
        </button>
      </div>
      {PERMISSIONS_CONFIG.map(cat => {
        const catPerms = cat.permissions.map(p => p.value);
        const selectedCount = catPerms.filter(p => perms.includes(p)).length;
        return (
          <div key={cat.category} className="rounded-xl border border-border/40 p-3 space-y-2 bg-muted/20">
            <button
              onClick={() => !disabled && toggleCategory(cat, perms, setPerms)}
              className="text-[11px] font-medium flex items-center gap-2 hover:text-foreground transition-colors text-muted-foreground"
              disabled={disabled}
            >
              {cat.category}
              <span className="text-[9px] px-1.5 py-px rounded-full bg-muted text-muted-foreground">{selectedCount}/{catPerms.length}</span>
            </button>
            <div className="grid grid-cols-2 gap-1">
              {cat.permissions.map(p => (
                <label key={p.value} className="flex items-center gap-2 text-[11px] cursor-pointer py-1 px-2 rounded-lg hover:bg-muted/50 transition-colors text-foreground">
                  <Checkbox
                    checked={perms.includes(p.value)}
                    onCheckedChange={() => togglePerm(p.value, perms, setPerms)}
                    disabled={disabled}
                    className="h-3.5 w-3.5"
                  />
                  {p.label}
                </label>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-muted-foreground" />
      </div>
    );
  }

  const stats = [
    { label: 'Membros', count: members.length, icon: Users },
    { label: 'Admins', count: members.filter(m => ['admin', 'adminmaster'].includes(m.role)).length, icon: Crown },
    { label: 'Colaboradores', count: members.filter(m => m.role === 'employee').length, icon: Briefcase },
    { label: 'Pendentes', count: invitations.length, icon: Clock },
  ];

  return (
    <div className="min-h-full bg-[#faf9f7] overscroll-contain">
      <div className="max-w-7xl mx-auto w-full p-4 sm:p-6 pb-[13rem] md:pb-32 lg:pb-6">
        {/* Header */}
        <div className="mb-5 flex items-center justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-[#374DA4] leading-tight">Equipe</h1>
            <p className="text-xs text-gray-400 mt-0.5">Gerencie membros, convites e permissões</p>
          </div>
          {isAdmin && (
            <Button onClick={handleOpenInvite} size="sm" className="gap-1.5 h-9 px-4 text-xs rounded-full bg-[#374DA4] hover:bg-[#2b3d85] text-white">
              <UserPlus className="h-3.5 w-3.5" /> Convidar
            </Button>
          )}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-2 mb-4">
          {stats.map(s => {
            const Icon = s.icon;
            return (
              <div key={s.label} className="rounded-2xl border border-gray-100 bg-white p-3 text-center">
                <Icon className="h-4 w-4 mx-auto text-gray-400 mb-1" />
                <p className="text-lg font-bold text-gray-900">{s.count}</p>
                <p className="text-[10px] text-gray-400">{s.label}</p>
              </div>
            );
          })}
        </div>

        {/* Slots info */}
        {isAdmin && (
          <div className={`flex items-center gap-2 p-2.5 rounded-xl mb-4 text-xs ${
            remainingSlots > 0
              ? 'bg-muted/40 text-muted-foreground'
              : 'bg-destructive/8 border border-destructive/15 text-destructive'
          }`}>
            {remainingSlots > 0 ? (
              <><Users className="h-3.5 w-3.5" /> {remainingSlots} vaga{remainingSlots !== 1 ? 's' : ''} disponíve{remainingSlots !== 1 ? 'is' : 'l'}</>
            ) : (
              <><AlertTriangle className="h-3.5 w-3.5" /> Limite de membros atingido</>
            )}
          </div>
        )}

        {/* Inline Invite Panel */}
        {inviteOpen && isAdmin && (
          <div className="relative rounded-2xl border border-[#374DA4]/30 bg-card overflow-hidden mb-4 shadow-lg shadow-[#374DA4]/10">
            <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[#374DA4] to-[#5B3BFF]" />
            <div className="flex items-center justify-between px-4 md:px-5 pt-4 pb-2">
              <div className="flex items-center gap-2.5">
                <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-[#374DA4] to-[#5B3BFF] flex items-center justify-center shadow-md shadow-[#374DA4]/30">
                  <UserPlus className="h-4 w-4 text-white" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-foreground leading-tight">Convidar Colaborador</h3>
                  <p className="text-[10px] text-muted-foreground">Envie por email e defina permissões</p>
                </div>
              </div>
              <Button variant="ghost" size="icon" onClick={resetInviteDialog} className="h-8 w-8 rounded-full">
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="px-4 md:px-5 pb-4 space-y-3">
              {/* Email + Role in single responsive row */}
              <div className="grid grid-cols-1 md:grid-cols-[1fr,180px] gap-2">
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    type="email"
                    placeholder="colaborador@empresa.com"
                    value={inviteEmail}
                    onChange={e => setInviteEmail(e.target.value)}
                    className="pl-9 h-10 text-sm rounded-xl"
                  />
                </div>
                <Select value={inviteRole} onValueChange={v => {
                  setInviteRole(v);
                  if (v === 'admin') setInvitePerms([...ALL_PERMS]);
                  else if (inviteRole === 'admin') setInvitePerms([]);
                }}>
                  <SelectTrigger className="h-10 text-xs rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="employee">
                      <span className="flex items-center gap-2 text-xs"><UserCheck className="h-3.5 w-3.5 text-slate-500" /> Colaborador</span>
                    </SelectItem>
                    <SelectItem value="manager">
                      <span className="flex items-center gap-2 text-xs"><Shield className="h-3.5 w-3.5 text-amber-500" /> Gerente</span>
                    </SelectItem>
                    <SelectItem value="admin">
                      <span className="flex items-center gap-2 text-xs"><Crown className="h-3.5 w-3.5 text-red-500" /> Admin (acesso total)</span>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Permissions (hidden for admin) */}
              {inviteRole !== 'admin' && (
                <details className="rounded-xl border border-border/40 bg-muted/20 overflow-hidden group" open>
                  <summary className="flex items-center justify-between cursor-pointer px-3 py-2 text-[11px] font-medium text-foreground list-none">
                    <span className="flex items-center gap-2">
                      <Shield className="h-3.5 w-3.5 text-[#374DA4]" />
                      Permissões
                      <span className="text-[9px] px-1.5 py-px rounded-full bg-[#374DA4]/10 text-[#374DA4]">{invitePerms.length}/{ALL_PERMS.length}</span>
                    </span>
                    <span className="text-[10px] text-muted-foreground group-open:hidden">Ajustar</span>
                    <span className="text-[10px] text-muted-foreground hidden group-open:inline">Recolher</span>
                  </summary>
                  <div className="px-3 pb-3 max-h-[40vh] md:max-h-[300px] overflow-y-auto">
                    <PermissionsEditor perms={invitePerms} setPerms={setInvitePerms} />
                  </div>
                </details>
              )}

              {inviteRole === 'admin' && (
                <div className="flex items-center gap-2 text-[11px] text-muted-foreground px-3 py-2 rounded-xl bg-[#374DA4]/5 border border-[#374DA4]/15">
                  <Sparkles className="h-3.5 w-3.5 text-[#374DA4]" />
                  Administradores recebem acesso total automaticamente.
                </div>
              )}

              {!generatedLink ? (
                <div className="flex gap-2">
                  <Button variant="outline" onClick={resetInviteDialog} className="h-10 text-xs rounded-xl flex-1 md:flex-none md:px-5">
                    Cancelar
                  </Button>
                  <Button
                    onClick={handleSendInvite}
                    disabled={inviteSending || !inviteEmail.trim()}
                    className="flex-1 h-10 text-xs rounded-xl bg-[#374DA4] hover:bg-[#2400b3] text-white shadow-md shadow-[#374DA4]/30"
                  >
                    {inviteSending ? 'Enviando...' : (<><UserPlus className="h-3.5 w-3.5 mr-1.5" /> Enviar Convite</>)}
                  </Button>
                </div>
              ) : (
                <div className="rounded-xl border border-emerald-500/20 p-3 space-y-2 bg-emerald-500/5">
                  <div className="flex items-center gap-2 text-xs font-medium text-emerald-700 dark:text-emerald-400">
                    <Check className="h-3.5 w-3.5" /> Convite enviado!
                  </div>
                  <p className="text-[10px] text-muted-foreground">Compartilhe também este link diretamente:</p>
                  <div className="flex gap-1.5">
                    <Input value={generatedLink} readOnly className="text-[10px] h-9 rounded-lg" />
                    <Button variant="outline" size="icon" onClick={() => copyLink()} className="h-9 w-9 shrink-0 rounded-lg">
                      {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                    </Button>
                  </div>
                  <Button onClick={resetInviteDialog} className="w-full h-9 text-xs rounded-xl bg-[#374DA4] hover:bg-[#2400b3] text-white">
                    Concluir
                  </Button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 p-1 rounded-full mb-4 bg-white border border-gray-100">
          {[
            { id: 'membros' as const, label: 'Membros', icon: Users, count: members.length },
            { id: 'convites' as const, label: 'Convites', icon: Mail, count: invitations.length },
          ].map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-full text-xs font-medium transition-all ${
                  activeTab === tab.id
                    ? 'bg-[#374DA4] text-white'
                    : 'text-gray-500 hover:text-gray-900'
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {tab.label}
                {tab.count > 0 && (
                  <span className={`text-[9px] px-1.5 py-px rounded-full ${activeTab === tab.id ? 'bg-white/20 text-white' : 'bg-muted'}`}>{tab.count}</span>
                )}
              </button>
            );
          })}
        </div>

        {/* Members Tab */}
        {activeTab === 'membros' && (
          <div className="space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome ou email..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="pl-9 h-9 text-xs rounded-xl"
              />
            </div>

            {filteredMembers.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground">
                <Users className="h-8 w-8 mx-auto mb-2 opacity-30" />
                <p className="text-xs">Nenhum membro encontrado</p>
              </div>
            ) : (
              <div className="rounded-2xl border border-border/60 bg-card overflow-hidden divide-y divide-border/30">
                {filteredMembers.map(member => {
                  const rc = ROLE_CONFIG[member.role] || ROLE_CONFIG.employee;
                  const isMe = member.user_id === user?.id;
                  return (
                    <div key={member.id} className="flex items-center justify-between px-4 py-3 hover:bg-muted/20 transition-colors">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <Avatar className="h-9 w-9">
                          {member.avatar_url && <AvatarImage src={member.avatar_url} />}
                          <AvatarFallback className="text-[10px] font-semibold bg-muted text-muted-foreground">
                            {getInitials(member)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <p className="text-xs font-medium text-foreground truncate">
                              {member.name || member.email}
                            </p>
                            {isMe && (
                              <span className="text-[8px] font-medium px-1.5 py-px rounded-full bg-[#64748b]/10 text-[#64748b]">Você</span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            {member.name && (
                              <p className="text-[10px] text-muted-foreground truncate">{member.email}</p>
                            )}
                            <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                              <span className={`h-1.5 w-1.5 rounded-full ${rc.dotColor}`} />
                              {rc.label}
                            </span>
                            {member.permissions.length > 0 && (
                              <span className="text-[9px] text-muted-foreground">{member.permissions.length} perm.</span>
                            )}
                          </div>
                        </div>
                      </div>

                      {isAdmin && !isMe && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0">
                              <MoreVertical className="h-3.5 w-3.5" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="text-xs">
                            <DropdownMenuItem onClick={() => openPermDialog(member)} className="text-xs">
                              <Shield className="h-3.5 w-3.5 mr-2" /> Editar Permissões
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => handleRemoveMember(member.id, member.user_id)}
                              className="text-destructive text-xs"
                            >
                              <Trash2 className="h-3.5 w-3.5 mr-2" /> Remover
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Invitations Tab */}
        {activeTab === 'convites' && (
          <div className="space-y-3">
            {invitations.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground">
                <Mail className="h-8 w-8 mx-auto mb-2 opacity-30" />
                <p className="text-xs">Nenhum convite pendente</p>
              </div>
            ) : (
              <div className="rounded-2xl border border-border/60 bg-card overflow-hidden divide-y divide-border/30">
                {invitations.map(inv => {
                  const rc = ROLE_CONFIG[inv.role] || ROLE_CONFIG.employee;
                  const isExpired = new Date(inv.expires_at) < new Date();
                  return (
                    <div key={inv.id} className="flex items-center justify-between px-4 py-3">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className="h-9 w-9 rounded-full bg-muted/60 flex items-center justify-center">
                          <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-foreground truncate">{inv.email}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                              <span className={`h-1.5 w-1.5 rounded-full ${rc.dotColor}`} />
                              {rc.label}
                            </span>
                            <span className={`flex items-center gap-1 text-[10px] ${isExpired ? 'text-destructive' : 'text-muted-foreground'}`}>
                              <Clock className="h-2.5 w-2.5" />
                              {isExpired ? 'Expirado' : `Até ${new Date(inv.expires_at).toLocaleDateString('pt-BR')}`}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-0.5">
                        <Button variant="ghost" size="icon" className="h-7 w-7" title="Reenviar" onClick={() => handleResendInvite(inv.id)}>
                          <RefreshCw className="h-3 w-3" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7" title="Copiar link"
                          onClick={() => copyLink(`https://www.ellosuit.online/convite/${inv.token}`)}>
                          <Link2 className="h-3 w-3" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" title="Cancelar" onClick={() => handleCancelInvite(inv.id)}>
                          <XCircle className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Edit Permissions Dialog */}
      <Dialog open={permDialogOpen} onOpenChange={setPermDialogOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <div className="h-8 w-8 rounded-xl bg-muted flex items-center justify-center">
                <Shield className="h-4 w-4 text-muted-foreground" />
              </div>
              Editar Permissões
            </DialogTitle>
            <DialogDescription className="text-xs">{editingMember?.name || editingMember?.email}</DialogDescription>
          </DialogHeader>

          <ScrollArea className="max-h-[calc(90vh-200px)] pr-3">
            <div className="space-y-4 py-2">
              <div className="space-y-1.5">
                <Label className="text-[11px] text-muted-foreground">Função</Label>
                <Select value={editRole} onValueChange={v => {
                  setEditRole(v);
                  if (v === 'admin') setEditPerms([...ALL_PERMS]);
                }}>
                  <SelectTrigger className="h-9 text-xs rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="employee">Colaborador</SelectItem>
                    <SelectItem value="manager">Gerente</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="border-t border-border/30 pt-3">
                <PermissionsEditor perms={editPerms} setPerms={setEditPerms} disabled={editRole === 'admin'} />
              </div>

              <Button onClick={handleUpdateMember} className="w-full h-9 text-xs rounded-xl bg-[#64748b] hover:bg-[#475569] text-white">
                Salvar Alterações
              </Button>
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      <UpgradeModal
        isOpen={upgradeOpen}
        onClose={() => setUpgradeOpen(false)}
        resource="users"
        currentUsage={members.length}
        maxLimit={subscription.limits.maxUsers}
      />
    </div>
  );
};

export default TeamManagement;
