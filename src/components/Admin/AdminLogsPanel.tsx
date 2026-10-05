import React, { useState, useEffect } from 'react';
import { useAdminMaster } from '@/hooks/useAdminMaster';
import { Navigate, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  ArrowLeft, Search, Filter, History, CheckCircle2, 
  Clock, CreditCard, User, AlertCircle, RefreshCcw, 
  ArrowUpRight, ArrowDownLeft, Ban, FileText
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface LogEntry {
  id: string;
  timestamp: string;
  type: 'payment' | 'action' | 'system' | 'status';
  status: 'success' | 'pending' | 'error' | 'refund_requested';
  title: string;
  description: string;
  user: string;
  value?: string;
  metadata?: Record<string, string>;
}

const AdminLogsPanel = () => {
  const { isAdminMaster, loading: authLoading } = useAdminMaster();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedLog, setSelectedLog] = useState<LogEntry | null>(null);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      // 1. Fetch payments
      const { data: paymentsData, error: paymentsError } = await supabase
        .from('subscription_payments')
        .select('*, companies(name)')
        .order('created_at', { ascending: false });

      if (paymentsError) throw paymentsError;

      // 2. Fetch system notifications
      const { data: systemData } = await supabase
        .from('system_notifications_log')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      // 3. Fetch recent profiles (registrations)
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      // Transform and combine
      const transformedPayments: LogEntry[] = (paymentsData || []).map(p => ({
        id: p.id,
        timestamp: p.paid_at || p.created_at,
        type: 'payment',
        status: p.status === 'paid' ? 'success' : (p.status === 'refunded' ? 'refund_requested' : 'pending'),
        title: p.description || 'Pagamento de Assinatura',
        description: `Transação via ${p.payment_method || 'N/A'}`,
        user: (p.companies as any)?.name || 'Cliente Geral',
        value: p.amount ? `R$ ${Number(p.amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : undefined,
        metadata: p.metadata as any
      }));

      const transformedSystem: LogEntry[] = (systemData || []).map(s => ({
        id: s.id,
        timestamp: s.created_at,
        type: s.event_type?.includes('whatsapp') ? 'status' : 'system',
        status: 'success',
        title: s.event_title,
        description: s.event_description || '',
        user: s.company_name || 'Sistema',
        metadata: s.metadata as any
      }));

      const transformedProfiles: LogEntry[] = (profilesData || []).map(pr => ({
        id: pr.id,
        timestamp: pr.created_at,
        type: 'action',
        status: 'success',
        title: 'Novo Cadastro',
        description: `Usuário ${pr.display_name || pr.username || 'Novo'} registrou-se no sistema`,
        user: pr.display_name || pr.username || 'Usuário Novo'
      }));

      const allLogs = [...transformedPayments, ...transformedSystem, ...transformedProfiles]
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

      setLogs(allLogs);
      if (allLogs.length > 0) setSelectedLog(allLogs[0]);
    } catch (error: any) {
      console.error('Error fetching logs:', error);
      toast.error('Erro ao carregar logs: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAdminMaster) {
      fetchLogs();
    }
  }, [isAdminMaster]);

  if (authLoading || (loading && logs.length === 0)) return <div className="p-6"><Skeleton className="h-64 w-full" /></div>;
  if (!isAdminMaster) return <Navigate to="/dashboard" replace />;

  const filteredLogs = logs.filter(log => 
    log.user.toLowerCase().includes(search.toLowerCase()) ||
    log.title.toLowerCase().includes(search.toLowerCase())
  );

  const getStatusBadge = (status: LogEntry['status']) => {
    switch (status) {
      case 'success': return <Badge className="bg-green-500/10 text-green-500 border-green-500/20">Sucesso</Badge>;
      case 'pending': return <Badge className="bg-amber-500/10 text-amber-500 border-amber-500/20">Pendente</Badge>;
      case 'error': return <Badge className="bg-red-500/10 text-red-500 border-red-500/20">Erro</Badge>;
      case 'refund_requested': return <Badge className="bg-[#374DA4]/10 text-[#374DA4] border-[#374DA4]/20">Estorno</Badge>;
      default: return null;
    }
  };

  const getTypeIcon = (type: LogEntry['type']) => {
    switch (type) {
      case 'payment': return <CreditCard className="h-4 w-4 text-emerald-500" />;
      case 'action': return <ArrowUpRight className="h-4 w-4 text-[#374DA4]" />;
      case 'status': return <RefreshCcw className="h-4 w-4 text-amber-500" />;
      default: return <Clock className="h-4 w-4 text-gray-500" />;
    }
  };

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-7xl mx-auto bg-[#F8F9FC] dark:bg-[#0D1117] min-h-screen">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard/admin')} className="rounded-full hover:bg-white dark:hover:bg-white/5">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-[#1A1D1F] dark:text-white flex items-center gap-2">
            <History className="h-6 w-6 text-primary" />
            Logs de Auditoria Financeira
          </h1>
          <p className="text-sm text-muted-foreground">Rastreamento detalhado de transações e ações de usuários</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <Card className="border-none shadow-sm bg-white dark:bg-[#1A1D1F]">
            <CardHeader className="pb-3 border-b border-gray-100 dark:border-white/5">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <CardTitle className="text-lg font-semibold">Linha do Tempo de Atividades</CardTitle>
                <div className="relative w-full md:w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input 
                    placeholder="Buscar cliente..." 
                    value={search} 
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-9 bg-[#F8F9FC] border-none focus-visible:ring-1"
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-gray-100 dark:divide-white/5">
                {filteredLogs.map((log) => (
                  <div key={log.id} className="p-4 hover:bg-[#F8F9FC] dark:hover:bg-white/[0.02] transition-colors group">
                    <div className="flex gap-4">
                      <div className="mt-1 flex flex-col items-center shrink-0">
                        <div className="h-8 w-8 rounded-full bg-white dark:bg-[#0D1117] shadow-sm flex items-center justify-center border border-gray-100 dark:border-white/10 group-hover:scale-110 transition-transform">
                          {getTypeIcon(log.type)}
                        </div>
                        <div className="w-px h-full bg-gray-100 dark:bg-white/5 mt-2 min-h-[20px]" />
                      </div>
                      <div className="flex-1 space-y-1">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <h3 className="text-sm font-semibold text-[#1A1D1F] dark:text-white">{log.title}</h3>
                          <span className="text-[11px] text-muted-foreground font-medium flex items-center gap-1.5 bg-gray-100 dark:bg-white/5 px-2 py-0.5 rounded-full">
                            <Clock className="h-3 w-3" />
                            {new Date(log.timestamp).toLocaleString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground">{log.description}</p>
                        <div className="flex items-center gap-4 pt-2">
                          <div className="flex items-center gap-1.5 text-xs font-medium text-[#1A1D1F] dark:text-white/80">
                            <User className="h-3 w-3 opacity-50" />
                            {log.user}
                          </div>
                          {log.value && (
                            <div className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                              {log.value}
                            </div>
                          )}
                          {getStatusBadge(log.status)}
                        </div>
                        
                        {log.metadata && typeof log.metadata === 'object' && (
                          <div className="mt-3 p-3 rounded-lg bg-[#F8F9FC] dark:bg-[#0D1117] grid grid-cols-2 md:grid-cols-3 gap-4 border border-gray-100 dark:border-white/5">
                            {Object.entries(log.metadata).map(([key, value]) => (
                              <div key={key}>
                                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">{key}</p>
                                <p className="text-xs font-mono font-medium text-primary mt-0.5">{String(value)}</p>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

         <div className="space-y-6">
           {selectedLog && selectedLog.type === 'payment' && (
             <Card className="border-none shadow-sm bg-white dark:bg-[#1A1D1F] overflow-hidden">
               <div className="h-2 bg-emerald-500" />
               <CardHeader>
                 <CardTitle className="text-lg font-semibold flex items-center gap-2">
                   <CreditCard className="h-5 w-5 text-emerald-500" />
                   Detalhes do Pagamento
                 </CardTitle>
               </CardHeader>
               <CardContent className="space-y-4">
                 <div className="flex items-center gap-4 p-3 rounded-xl bg-[#F8F9FC] dark:bg-[#0D1117] border border-gray-100 dark:border-white/5">
                   <div className="h-12 w-12 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-500 font-bold text-lg">
                     {selectedLog.user.charAt(0).toUpperCase()}
                   </div>
                   <div>
                     <h4 className="font-bold text-[#1A1D1F] dark:text-white">{selectedLog.user}</h4>
                     <p className="text-xs text-muted-foreground">{selectedLog.title}</p>
                   </div>
                 </div>
                 
                 <div className="space-y-3 pt-2">
                   <div className="flex justify-between text-xs py-2 border-b border-gray-100 dark:border-white/5">
                     <span className="text-muted-foreground">Valor</span>
                     <span className="font-bold text-emerald-600">{selectedLog.value || 'N/A'}</span>
                   </div>
                   <div className="flex justify-between text-xs py-2 border-b border-gray-100 dark:border-white/5">
                     <span className="text-muted-foreground">Data/Hora</span>
                     <span className="font-medium">
                       {new Date(selectedLog.timestamp).toLocaleString('pt-BR')}
                     </span>
                   </div>
                   <div className="flex justify-between text-xs py-2 border-b border-gray-100 dark:border-white/5">
                     <span className="text-muted-foreground">Status</span>
                     {getStatusBadge(selectedLog.status)}
                   </div>
                   {selectedLog.id && (
                     <div className="flex justify-between text-xs py-2">
                       <span className="text-muted-foreground">ID da Transação</span>
                       <span className="font-mono text-[10px]">{selectedLog.id}</span>
                     </div>
                   )}
                 </div>
                 
                 <Button className="w-full gap-2 mt-4 shadow-lg shadow-primary/20" variant="default">
                   <FileText className="h-4 w-4" />
                   Gerar Recibo PDF
                 </Button>
               </CardContent>
             </Card>
           )}

           <Card className="border-none shadow-sm bg-white dark:bg-[#1A1D1F]">
             <CardHeader>
               <CardTitle className="text-lg font-semibold flex items-center gap-2">
                 <AlertCircle className="h-5 w-5 text-primary" />
                 Informações do Sistema
               </CardTitle>
             </CardHeader>
             <CardContent>
               <div className="p-4 rounded-xl bg-primary/5 border border-primary/10">
                 <p className="text-xs text-muted-foreground leading-relaxed">
                   Acompanhe aqui todas as movimentações financeiras e registros de novos usuários em tempo real. O sistema captura automaticamente todos os pagamentos processados via Pagar.me e Beehive.
                 </p>
               </div>
             </CardContent>
           </Card>
         </div>
      </div>
    </div>
  );
};

export default AdminLogsPanel;