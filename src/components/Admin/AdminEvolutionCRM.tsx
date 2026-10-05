import React, { useState, useEffect } from 'react';
import { useAdminMaster } from '@/hooks/useAdminMaster';
import { Navigate, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import {
  MessageSquare, Search, RefreshCcw, Power, 
  Trash2, ExternalLink, ArrowLeft, CheckCircle2, 
  XCircle, Clock, ShieldCheck, User
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface WhatsAppSession {
  id: string;
  instance_name: string;
  status: string;
  phone_number?: string;
  phone_name?: string;
  company_id: string;
  created_at: string;
  companies?: {
    name: string;
  };
}

const AdminEvolutionCRM = () => {
  const { isAdminMaster, loading: authLoading } = useAdminMaster();
  const navigate = useNavigate();
  const [sessions, setSessions] = useState<WhatsAppSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const fetchAllSessions = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('whatsapp_sessions')
        .select('*, companies(name)')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setSessions(data as any || []);
    } catch (error: any) {
      console.error('Error fetching sessions:', error);
      toast.error('Erro ao carregar instâncias: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAdminMaster) {
      fetchAllSessions();
    }
  }, [isAdminMaster]);

  if (authLoading) return <div className="p-6"><Skeleton className="h-64 w-full" /></div>;
  if (!isAdminMaster) return <Navigate to="/dashboard" replace />;

  const filteredSessions = sessions.filter(s => 
    s.instance_name.toLowerCase().includes(search.toLowerCase()) ||
    (s.phone_number && s.phone_number.includes(search)) ||
    (s.companies?.name && s.companies.name.toLowerCase().includes(search.toLowerCase()))
  );

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'connected':
        return <Badge className="bg-green-500/10 text-green-500 border-green-500/20">Conectado</Badge>;
      case 'disconnected':
        return <Badge className="bg-red-500/10 text-red-500 border-red-500/20">Desconectado</Badge>;
      default:
        return <Badge className="bg-amber-500/10 text-amber-500 border-amber-500/20">{status}</Badge>;
    }
  };

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard/admin')} className="rounded-full">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <MessageSquare className="h-6 w-6 text-primary" />
              Evolution API - Sessões
            </h1>
            <p className="text-sm text-muted-foreground">Monitoramento global de todas as instâncias WhatsApp do sistema</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative w-full md:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Buscar por nome, fone ou empresa..." 
              value={search} 
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Button variant="outline" size="icon" onClick={fetchAllSessions} disabled={loading}>
            <RefreshCcw className={cn("h-4 w-4", loading && "animate-spin")} />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading && sessions.length === 0 ? (
          [1, 2, 3, 4, 5, 6].map(i => <Skeleton key={i} className="h-48 w-full rounded-xl" />)
        ) : filteredSessions.length === 0 ? (
          <div className="col-span-full py-20 text-center">
            <MessageSquare className="h-12 w-12 text-muted-foreground/20 mx-auto mb-4" />
            <h3 className="text-lg font-medium">Nenhuma instância encontrada</h3>
            <p className="text-muted-foreground text-sm">Tente ajustar sua busca ou atualizar a lista.</p>
          </div>
        ) : (
          filteredSessions.map((session) => (
            <Card key={session.id} className="overflow-hidden border-[#FF4500]/10 hover:border-[#FF4500]/30 transition-all group">
              <CardHeader className="pb-3 border-b border-gray-100 dark:border-white/5 bg-gray-50/50 dark:bg-white/[0.02]">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Power className={cn("h-4 w-4", session.status === 'connected' ? "text-green-500" : "text-red-500")} />
                    </div>
                    <CardTitle className="text-sm font-bold truncate max-w-[150px]">
                      {session.instance_name}
                    </CardTitle>
                  </div>
                  {getStatusBadge(session.status)}
                </div>
              </CardHeader>
              <CardContent className="pt-4 space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground flex items-center gap-1">
                      <User className="h-3 w-3" /> Empresa
                    </span>
                    <span className="font-medium text-foreground">{session.companies?.name || 'Sistema'}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground flex items-center gap-1">
                      <ShieldCheck className="h-3 w-3" /> WhatsApp
                    </span>
                    <span className="font-medium text-foreground">{session.phone_number || 'Não vinculado'}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground flex items-center gap-1">
                      <Clock className="h-3 w-3" /> Criado em
                    </span>
                    <span className="font-medium text-foreground">
                      {new Date(session.created_at).toLocaleDateString('pt-BR')}
                    </span>
                  </div>
                </div>

                <div className="pt-2 flex gap-2">
                  <Button variant="outline" size="sm" className="flex-1 text-[11px] gap-1" onClick={() => toast.info('Ação restrita ao painel da empresa')}>
                    <ExternalLink className="h-3 w-3" /> Painel
                  </Button>
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-red-500 hover:text-red-600 hover:bg-red-50" onClick={() => toast.error('Apenas o dono da empresa pode excluir instâncias')}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
};

export default AdminEvolutionCRM;
