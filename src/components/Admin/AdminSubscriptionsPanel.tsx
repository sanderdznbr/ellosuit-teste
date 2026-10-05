import React, { useEffect, useState } from 'react';
import { useAdminMaster } from '@/hooks/useAdminMaster';
import { Navigate, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { ArrowLeft, Search, Settings2 } from 'lucide-react';
import { toast } from 'sonner';

const statusColors: Record<string, string> = {
  active: 'bg-green-100 text-green-700',
  trialing: 'bg-[#DFE4FB] text-[#253573]',
  canceled: 'bg-red-100 text-red-700',
  past_due: 'bg-yellow-100 text-yellow-700',
};

const AdminSubscriptionsPanel = () => {
  const { isAdminMaster, loading: authLoading, callAdminApi } = useAdminMaster();
  const navigate = useNavigate();
  const [companies, setCompanies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [editModal, setEditModal] = useState<any>(null);
  const [editPlan, setEditPlan] = useState('');
  const [editStatus, setEditStatus] = useState('');
  const [editCycle, setEditCycle] = useState('monthly');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isAdminMaster || authLoading) return;
    loadData();
  }, [isAdminMaster, authLoading]);

  const loadData = async () => {
    try {
      const data = await callAdminApi('all-companies');
      setCompanies(data || []);
    } catch (e) {
      console.error('Failed to load companies:', e);
    } finally {
      setLoading(false);
    }
  };

  const openEdit = (company: any) => {
    const sub = company.subscription;
    setEditModal(company);
    // Normalize legacy plans into single "pro" plan
    const legacy = ['base', 'business', 'enterprise', 'custom', 'starter', 'growth'];
    const planFromDb = sub?.plan_type || 'free';
    const normalizedPlan = legacy.includes(planFromDb) ? 'pro' : planFromDb;
    setEditPlan(['free', 'pro', 'partner'].includes(normalizedPlan) ? normalizedPlan : 'pro');
    const validStatuses = ['active', 'trialing', 'canceled', 'past_due', 'free'];
    setEditStatus(validStatuses.includes(sub?.status) ? sub.status : 'trialing');
    setEditCycle(sub?.billing_cycle || 'monthly');
  };

  const handleSave = async () => {
    if (!editModal) return;
    setSaving(true);
    try {
      await callAdminApi('modify-subscription', undefined, {
        companyId: editModal.id,
        planType: editPlan,
        status: editStatus,
        billingCycle: editCycle,
      });
      toast.success('Assinatura atualizada com sucesso');
      setEditModal(null);
      loadData();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  if (authLoading) return <div className="p-6"><Skeleton className="h-64 w-full" /></div>;
  if (!isAdminMaster) return <Navigate to="/dashboard" replace />;

  const filtered = companies.filter(c => {
    const sub = c.subscription;
    if (statusFilter !== 'all' && sub?.status !== statusFilter) return false;
    if (search) {
      const s = search.toLowerCase();
      return c.name?.toLowerCase().includes(s) || c.domain?.toLowerCase().includes(s) || sub?.plan_type?.toLowerCase().includes(s);
    }
    return true;
  });

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-7xl mx-auto">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard/admin')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-xl font-bold text-foreground">Assinaturas & Planos</h1>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar empresa ou plano..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="active">Ativo</SelectItem>
            <SelectItem value="trialing">Trial</SelectItem>
            <SelectItem value="canceled">Cancelado</SelectItem>
            <SelectItem value="past_due">Vencido</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading ? <Skeleton className="h-64 w-full" /> : (
        <Card className="border-0 shadow-sm">
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Empresa</TableHead>
                  <TableHead>Plano</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead>Usuários</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((c: any) => {
                  const sub = c.subscription;
                  return (
                    <TableRow key={c.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium text-foreground">{c.name}</p>
                          <p className="text-xs text-muted-foreground">{c.domain || '—'}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize">{sub?.plan_type || 'base'}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className={statusColors[sub?.status] || ''}>
                          {sub?.status || 'N/A'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-foreground">R$ {Number(sub?.monthly_price || 0).toFixed(2)}</TableCell>
                      <TableCell className="text-foreground">{c.userCount}</TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm" onClick={() => openEdit(c)}>
                          <Settings2 className="h-4 w-4 mr-1" /> Gerenciar
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {filtered.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-8">Nenhuma empresa encontrada</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Edit Subscription Modal */}
      <Dialog open={!!editModal} onOpenChange={() => setEditModal(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Gerenciar: {editModal?.name}</DialogTitle>
            <DialogDescription>Altere o plano, ciclo de cobrança e status desta empresa.</DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-foreground mb-1 block">Plano</label>
              <Select value={editPlan} onValueChange={setEditPlan}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="free">Free (sem acesso)</SelectItem>
                  <SelectItem value="pro">Plano Único — acesso completo</SelectItem>
                  <SelectItem value="partner">Partner (Full Access)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium text-foreground mb-1 block">Ciclo de cobrança</label>
              <Select value={editCycle} onValueChange={setEditCycle}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="monthly">Mensal</SelectItem>
                  <SelectItem value="yearly">Anual</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium text-foreground mb-1 block">Status</label>
              <Select value={editStatus} onValueChange={setEditStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Ativo</SelectItem>
                  <SelectItem value="trialing">Trial</SelectItem>
                  <SelectItem value="free">Free</SelectItem>
                  <SelectItem value="canceled">Cancelado</SelectItem>
                  <SelectItem value="past_due">Vencido</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditModal(null)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Salvando...' : 'Salvar Alterações'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminSubscriptionsPanel;
