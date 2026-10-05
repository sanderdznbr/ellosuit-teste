import React, { useEffect, useState } from 'react';
import { useAdminMaster } from '@/hooks/useAdminMaster';
import { Navigate, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, MessageSquare, Bug } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';

const AdminSupportPanel = () => {
  const { isAdminMaster, loading: authLoading } = useAdminMaster();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [tickets, setTickets] = useState<any[]>([]);
  const [bugs, setBugs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [respondModal, setRespondModal] = useState<any>(null);
  const [response, setResponse] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isAdminMaster || authLoading) return;
    loadData();
  }, [isAdminMaster, authLoading]);

  const loadData = async () => {
    const [t, b] = await Promise.all([
      supabase.from('support_tickets').select('*').order('created_at', { ascending: false }),
      supabase.from('bug_reports').select('*').order('created_at', { ascending: false }),
    ]);
    setTickets(t.data || []);
    setBugs(b.data || []);
    setLoading(false);
  };

  const respondTicket = async () => {
    if (!respondModal || !response.trim()) return;
    setSaving(true);
    try {
      await supabase.from('support_tickets').update({
        response,
        responded_by: user?.id,
        responded_at: new Date().toISOString(),
        status: 'answered',
      }).eq('id', respondModal.id);
      toast.success('Resposta enviada');
      setRespondModal(null);
      setResponse('');
      loadData();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  const updateBugStatus = async (id: string, status: string) => {
    await supabase.from('bug_reports').update({ status }).eq('id', id);
    toast.success('Status atualizado');
    loadData();
  };

  if (authLoading) return <div className="p-6"><Skeleton className="h-64 w-full" /></div>;
  if (!isAdminMaster) return <Navigate to="/dashboard" replace />;

  const statusColor: Record<string, string> = {
    open: 'bg-yellow-100 text-yellow-700',
    answered: 'bg-green-100 text-green-700',
    closed: 'bg-gray-100 text-gray-500',
    in_progress: 'bg-[#DFE4FB] text-[#253573]',
    resolved: 'bg-green-100 text-green-700',
  };

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-7xl mx-auto">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard/admin')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-xl font-bold">Suporte & Bugs</h1>
      </div>

      {loading ? <Skeleton className="h-64 w-full" /> : (
        <Tabs defaultValue="tickets">
          <TabsList>
            <TabsTrigger value="tickets" className="gap-1">
              <MessageSquare className="h-4 w-4" /> Tickets ({tickets.length})
            </TabsTrigger>
            <TabsTrigger value="bugs" className="gap-1">
              <Bug className="h-4 w-4" /> Bugs ({bugs.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="tickets">
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Assunto</TableHead>
                      <TableHead>Prioridade</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Data</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {tickets.map(t => (
                      <TableRow key={t.id}>
                        <TableCell className="font-medium">{t.subject}</TableCell>
                        <TableCell><Badge variant="outline">{t.priority}</Badge></TableCell>
                        <TableCell><Badge className={statusColor[t.status] || ''}>{t.status}</Badge></TableCell>
                        <TableCell className="text-xs">{new Date(t.created_at).toLocaleDateString('pt-BR')}</TableCell>
                        <TableCell>
                          <Button variant="ghost" size="sm" onClick={() => setRespondModal(t)}>Responder</Button>
                        </TableCell>
                      </TableRow>
                    ))}
                    {tickets.length === 0 && (
                      <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Nenhum ticket</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="bugs">
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Título</TableHead>
                      <TableHead>Severidade</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Data</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {bugs.map(b => (
                      <TableRow key={b.id}>
                        <TableCell className="font-medium">{b.title}</TableCell>
                        <TableCell><Badge variant="outline">{b.severity}</Badge></TableCell>
                        <TableCell><Badge className={statusColor[b.status] || ''}>{b.status}</Badge></TableCell>
                        <TableCell className="text-xs">{new Date(b.created_at).toLocaleDateString('pt-BR')}</TableCell>
                        <TableCell>
                          <Select value={b.status} onValueChange={v => updateBugStatus(b.id, v)}>
                            <SelectTrigger className="w-28 h-8">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="open">Aberto</SelectItem>
                              <SelectItem value="in_progress">Em progresso</SelectItem>
                              <SelectItem value="resolved">Resolvido</SelectItem>
                              <SelectItem value="closed">Fechado</SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                      </TableRow>
                    ))}
                    {bugs.length === 0 && (
                      <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Nenhum bug reportado</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}

      {/* Respond Modal */}
      <Dialog open={!!respondModal} onOpenChange={() => setRespondModal(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Responder: {respondModal?.subject}</DialogTitle>
          </DialogHeader>
          <div className="bg-muted p-3 rounded text-sm">{respondModal?.description}</div>
          <Textarea placeholder="Sua resposta..." value={response} onChange={e => setResponse(e.target.value)} rows={4} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRespondModal(null)}>Cancelar</Button>
            <Button onClick={respondTicket} disabled={saving}>{saving ? 'Enviando...' : 'Enviar'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminSupportPanel;
