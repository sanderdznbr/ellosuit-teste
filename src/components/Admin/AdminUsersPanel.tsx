import React, { useEffect, useState } from 'react';
import { useAdminMaster } from '@/hooks/useAdminMaster';
import { Navigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
 import { ArrowLeft, Building2, Search, LogIn, Eye, UserCog, Mail, Trash2, AlertTriangle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
const statusColors: Record<string, string> = {
  active: 'bg-green-100 text-green-700',
  trialing: 'bg-[#DFE4FB] text-[#253573]',
  canceled: 'bg-red-100 text-red-700',
  past_due: 'bg-yellow-100 text-yellow-700',
};

const roleColors: Record<string, string> = {
  adminmaster: 'bg-red-100 text-red-700',
  admin: 'bg-purple-100 text-purple-700',
  manager: 'bg-[#DFE4FB] text-[#253573]',
  employee: 'bg-gray-100 text-gray-600',
};

const AdminUsersPanel = () => {
  const { isAdminMaster, loading: authLoading, callAdminApi } = useAdminMaster();
  const navigate = useNavigate();
  const [companies, setCompanies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedCompany, setSelectedCompany] = useState<any>(null);
  const [companyDetails, setCompanyDetails] = useState<any>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [impersonateModal, setImpersonateModal] = useState<{ userId: string; email: string } | null>(null);
  const [reason, setReason] = useState('');
  const [impersonating, setImpersonating] = useState(false);
  const [roleChangeUser, setRoleChangeUser] = useState<any>(null);
   const [newRole, setNewRole] = useState('');
   const [deleteCompanyId, setDeleteCompanyId] = useState<string | null>(null);
   const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!isAdminMaster || authLoading) return;
    callAdminApi('all-companies')
      .then((data: any[]) => setCompanies(data || []))
      .catch(() => setCompanies([]))
      .finally(() => setLoading(false));
  }, [isAdminMaster, authLoading]);

  const viewCompany = async (company: any) => {
    setSelectedCompany(company);
    setLoadingDetails(true);
    try {
      const details = await callAdminApi('company-details', { companyId: company.id });
      setCompanyDetails(details);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoadingDetails(false);
    }
  };

  const handleImpersonate = async () => {
    if (!impersonateModal) return;
    setImpersonating(true);
    try {
      const result = await callAdminApi('impersonate', undefined, {
        targetUserId: impersonateModal.userId,
        reason,
      });
      if (result.link) {
        window.open(result.link, '_blank');
        toast.success('Link de impersonação gerado');
      }
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setImpersonating(false);
      setImpersonateModal(null);
      setReason('');
    }
  };

   const handleDeleteCompany = async () => {
     if (!deleteCompanyId) return;
     setDeleting(true);
     try {
       await callAdminApi('delete-company', undefined, { companyId: deleteCompanyId });
       toast.success('Empresa e todos os dados relacionados foram excluídos');
       setDeleteCompanyId(null);
       setSelectedCompany(null);
       setCompanyDetails(null);
       // Refresh list
       const updated = await callAdminApi('all-companies');
       setCompanies(updated);
     } catch (e: any) {
       toast.error(e.message);
     } finally {
       setDeleting(false);
     }
   };
 
   const handleChangeRole = async () => {
    if (!roleChangeUser || !newRole || !selectedCompany) return;
    try {
      await callAdminApi('change-role', undefined, {
        userId: roleChangeUser.user_id,
        companyId: selectedCompany.id,
        newRole,
      });
      toast.success('Role alterada com sucesso');
      setRoleChangeUser(null);
      // Refresh
      viewCompany(selectedCompany);
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  if (authLoading) return <div className="p-6"><Skeleton className="h-64 w-full" /></div>;
  if (!isAdminMaster) return <Navigate to="/dashboard" replace />;

  const filtered = companies.filter(c =>
    c.name?.toLowerCase().includes(search.toLowerCase()) ||
    c.domain?.toLowerCase().includes(search.toLowerCase()) ||
    c.email?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-7xl mx-auto">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={() => selectedCompany ? (setSelectedCompany(null), setCompanyDetails(null)) : navigate('/dashboard/admin')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
         <div className="flex-1 flex justify-between items-center">
           <h1 className="text-xl font-bold text-foreground">{selectedCompany ? selectedCompany.name : 'Empresas & Usuários'}</h1>
           {selectedCompany && (
             <Button variant="destructive" size="sm" onClick={() => setDeleteCompanyId(selectedCompany.id)}>
               <Trash2 className="h-4 w-4 mr-2" /> Excluir Tudo
             </Button>
           )}
         </div>
      </div>

      {!selectedCompany ? (
        <>
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar empresa..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
          </div>
          <p className="text-xs text-muted-foreground">{filtered.length} empresas cadastradas</p>

          {loading ? <Skeleton className="h-64 w-full" /> : (
            <Card className="border-0 shadow-sm">
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Empresa</TableHead>
                      <TableHead>Domínio</TableHead>
                      <TableHead>Plano</TableHead>
                      <TableHead>Usuários</TableHead>
                      <TableHead>Criada em</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map(c => (
                      <TableRow key={c.id}>
                        <TableCell className="font-medium text-foreground">{c.name}</TableCell>
                        <TableCell className="text-muted-foreground">{c.domain || '—'}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="capitalize">{c.subscription?.plan_type || 'base'}</Badge>
                        </TableCell>
                        <TableCell className="text-foreground">{c.userCount}</TableCell>
                        <TableCell className="text-muted-foreground text-xs">{new Date(c.created_at).toLocaleDateString('pt-BR')}</TableCell>
                        <TableCell>
                          <Button variant="ghost" size="sm" onClick={() => viewCompany(c)}>
                            <Eye className="h-4 w-4 mr-1" /> Ver
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </>
      ) : (
        loadingDetails ? <Skeleton className="h-64 w-full" /> : companyDetails && (
          <div className="space-y-4">
            {/* Company Stats */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              {[
                { label: 'Usuários', value: companyDetails.users?.length || 0 },
                { label: 'Clientes', value: companyDetails.clientsCount || 0 },
                { label: 'Eventos', value: companyDetails.eventsCount || 0 },
                { label: 'Agentes IA', value: companyDetails.agents?.length || 0 },
                { label: 'Plano', value: companyDetails.subscription?.plan_type || 'base' },
              ].map(s => (
                <Card key={s.label} className="border-0 shadow-sm">
                  <CardContent className="p-4 text-center">
                    <p className="text-2xl font-bold text-foreground capitalize">{s.value}</p>
                    <p className="text-xs text-muted-foreground">{s.label}</p>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Subscription info */}
            {companyDetails.subscription && (
              <Card className="border-0 shadow-sm">
                <CardHeader><CardTitle className="text-sm font-semibold">Assinatura</CardTitle></CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">Status</p>
                      <Badge className={statusColors[companyDetails.subscription.status] || ''}>
                        {companyDetails.subscription.status}
                      </Badge>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Valor</p>
                      <p className="font-semibold text-foreground">R$ {Number(companyDetails.subscription.monthly_price || 0).toFixed(2)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Trial até</p>
                      <p className="text-foreground">{companyDetails.subscription.trial_ends_at ? new Date(companyDetails.subscription.trial_ends_at).toLocaleDateString('pt-BR') : '—'}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Módulos</p>
                      <div className="flex gap-1 mt-1 flex-wrap">
                        {(companyDetails.modules || []).filter((m: any) => m.is_active).map((m: any) => (
                          <Badge key={m.module_type} variant="outline" className="capitalize text-xs">{m.module_type}</Badge>
                        ))}
                        {(companyDetails.modules || []).filter((m: any) => m.is_active).length === 0 && (
                          <span className="text-xs text-muted-foreground">Nenhum</span>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Users with emails */}
            <Card className="border-0 shadow-sm">
              <CardHeader><CardTitle className="text-sm font-semibold">Usuários</CardTitle></CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Email</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Último acesso</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(companyDetails.users || []).map((u: any) => (
                      <TableRow key={u.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                            <span className="text-sm text-foreground">{u.email}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className={roleColors[u.role] || ''}>
                            {u.role}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {u.last_sign_in ? new Date(u.last_sign_in).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : 'Nunca'}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button variant="ghost" size="sm" onClick={() => { setRoleChangeUser(u); setNewRole(u.role); }}>
                              <UserCog className="h-4 w-4 mr-1" /> Role
                            </Button>
                            <Button variant="outline" size="sm" onClick={() => setImpersonateModal({ userId: u.user_id, email: u.email })}>
                              <LogIn className="h-4 w-4 mr-1" /> Logar como
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            {/* Agents */}
            {companyDetails.agents?.length > 0 && (
              <Card className="border-0 shadow-sm">
                <CardHeader><CardTitle className="text-sm font-semibold">Agentes IA</CardTitle></CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {companyDetails.agents.map((a: any) => (
                      <div key={a.id} className="flex justify-between items-center py-1 border-b last:border-0">
                        <span className="text-sm text-foreground">{a.name}</span>
                        <Badge variant="secondary" className={a.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}>
                          {a.is_active ? 'Ativo' : 'Inativo'}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Chatbot Flows */}
            {companyDetails.flows?.length > 0 && (
              <Card className="border-0 shadow-sm">
                <CardHeader><CardTitle className="text-sm font-semibold">Fluxos de Chatbot</CardTitle></CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {companyDetails.flows.map((f: any) => (
                      <div key={f.id} className="flex justify-between items-center py-1 border-b last:border-0">
                        <span className="text-sm text-foreground">{f.name}</span>
                        <Badge variant="secondary" className={f.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}>
                          {f.is_active ? 'Ativo' : 'Inativo'}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )
      )}

      {/* Impersonate Modal */}
      <Dialog open={!!impersonateModal} onOpenChange={() => setImpersonateModal(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Logar como: {impersonateModal?.email}</DialogTitle>
            <DialogDescription>Um link será gerado para acessar a conta. Esta ação será registrada em log de auditoria.</DialogDescription>
          </DialogHeader>
          <Textarea placeholder="Motivo da impersonação..." value={reason} onChange={e => setReason(e.target.value)} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setImpersonateModal(null)}>Cancelar</Button>
            <Button onClick={handleImpersonate} disabled={impersonating}>
              {impersonating ? 'Gerando...' : 'Gerar Link'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Change Role Modal */}
      <Dialog open={!!roleChangeUser} onOpenChange={() => setRoleChangeUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Alterar Role: {roleChangeUser?.email}</DialogTitle>
            <DialogDescription>Altere o papel deste usuário na empresa.</DialogDescription>
          </DialogHeader>
          <Select value={newRole} onValueChange={setNewRole}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="adminmaster">Admin Master</SelectItem>
              <SelectItem value="admin">Admin</SelectItem>
              <SelectItem value="manager">Manager</SelectItem>
              <SelectItem value="employee">Employee</SelectItem>
            </SelectContent>
          </Select>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRoleChangeUser(null)}>Cancelar</Button>
            <Button onClick={handleChangeRole}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
       </Dialog>
 
       {/* Delete Confirmation Modal */}
       <Dialog open={!!deleteCompanyId} onOpenChange={() => setDeleteCompanyId(null)}>
         <DialogContent className="border-red-500/50">
           <DialogHeader>
             <div className="flex items-center gap-2 text-red-600 mb-2">
               <AlertTriangle className="h-5 w-5" />
               <DialogTitle>EXCLUSÃO TOTAL E IRREVERSÍVEL</DialogTitle>
             </div>
             <DialogDescription className="text-red-600 font-medium">
               Isso excluirá permanentemente a empresa, todos os seus usuários, clientes, agentes, fluxos, pagamentos e registros. Esta ação NÃO PODE ser desfeita.
             </DialogDescription>
           </DialogHeader>
           <div className="py-4 text-sm space-y-2">
             <p>Você tem certeza que deseja excluir <strong>{selectedCompany?.name || 'esta empresa'}</strong>?</p>
             <p className="text-xs text-muted-foreground italic">Nota: Usuários que pertencem a outras empresas não serão excluídos do sistema, apenas removidos desta empresa.</p>
           </div>
           <DialogFooter>
             <Button variant="outline" onClick={() => setDeleteCompanyId(null)}>Cancelar</Button>
             <Button variant="destructive" onClick={handleDeleteCompany} disabled={deleting}>
               {deleting ? 'Excluindo...' : 'Sim, excluir permanentemente'}
             </Button>
           </DialogFooter>
         </DialogContent>
       </Dialog>
     </div>
   );
 };
 
 export default AdminUsersPanel;
