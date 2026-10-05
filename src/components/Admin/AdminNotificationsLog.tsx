import React, { useEffect, useState } from 'react';
import { useAdminMaster } from '@/hooks/useAdminMaster';
import { Navigate, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import {
  ArrowLeft, Bell, Search, Filter, RefreshCw, CheckCircle, XCircle,
  Smartphone, Mail, Users, MessageSquare, Bot, Send, AlertTriangle
} from 'lucide-react';

interface LogEntry {
  id: string;
  event_type: string;
  event_title: string;
  event_description: string | null;
  user_email: string | null;
  company_name: string | null;
  metadata: any;
  notification_sent: boolean;
  notification_error: string | null;
  created_at: string;
}

const eventTypeConfig: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  whatsapp_connected: { label: 'WhatsApp Conectado', icon: Smartphone, color: 'bg-green-100 text-green-700' },
  whatsapp_disconnected: { label: 'WhatsApp Desconectado', icon: Smartphone, color: 'bg-red-100 text-red-700' },
  bulk_dispatch_started: { label: 'Disparo Iniciado', icon: Send, color: 'bg-[#DFE4FB] text-[#253573]' },
  bulk_dispatch_completed: { label: 'Disparo Concluído', icon: Send, color: 'bg-green-100 text-green-700' },
  bulk_dispatch_failed: { label: 'Disparo Falhou', icon: AlertTriangle, color: 'bg-red-100 text-red-700' },
  email_sent: { label: 'E-mail Enviado', icon: Mail, color: 'bg-purple-100 text-purple-700' },
  email_campaign_sent: { label: 'Campanha de E-mail', icon: Mail, color: 'bg-purple-100 text-purple-700' },
  user_registered: { label: 'Novo Cadastro', icon: Users, color: 'bg-amber-100 text-amber-700' },
  chatbot_activated: { label: 'Chatbot Ativado', icon: Bot, color: 'bg-orange-100 text-orange-700' },
  ai_agent_assigned: { label: 'Agente IA Atribuído', icon: Bot, color: 'bg-violet-100 text-violet-700' },
};

const AdminNotificationsLog = () => {
  const { isAdminMaster, loading: authLoading } = useAdminMaster();
  const navigate = useNavigate();
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');

  const fetchLogs = async () => {
    setLoading(true);
    let query = supabase
      .from('system_notifications_log')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200);

    if (filterType !== 'all') {
      query = query.eq('event_type', filterType);
    }

    if (filterStatus === 'sent') {
      query = query.eq('notification_sent', true);
    } else if (filterStatus === 'failed') {
      query = query.eq('notification_sent', false);
    }

    const { data, error } = await query;
    if (!error && data) {
      setLogs(data as LogEntry[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (!isAdminMaster || authLoading) return;
    fetchLogs();
  }, [isAdminMaster, authLoading, filterType, filterStatus]);

  if (authLoading) return <div className="p-6"><Skeleton className="h-64 w-full" /></div>;
  if (!isAdminMaster) return <Navigate to="/dashboard" replace />;

  const filtered = logs.filter(log =>
    !search ||
    log.event_title.toLowerCase().includes(search.toLowerCase()) ||
    log.user_email?.toLowerCase().includes(search.toLowerCase()) ||
    log.company_name?.toLowerCase().includes(search.toLowerCase()) ||
    log.event_description?.toLowerCase().includes(search.toLowerCase())
  );

  const stats = {
    total: logs.length,
    sent: logs.filter(l => l.notification_sent).length,
    failed: logs.filter(l => !l.notification_sent).length,
    today: logs.filter(l => new Date(l.created_at).toDateString() === new Date().toDateString()).length,
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('pt-BR', {
      day: '2-digit', month: '2-digit', year: '2-digit',
      hour: '2-digit', minute: '2-digit',
    });
  };

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-7xl mx-auto">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard/admin')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <Bell className="h-6 w-6 text-destructive" />
        <h1 className="text-xl font-bold">Logs & Notificações</h1>
        <Button variant="outline" size="sm" className="ml-auto" onClick={fetchLogs}>
          <RefreshCw className="h-4 w-4 mr-1" />
          Atualizar
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold">{stats.total}</p>
            <p className="text-xs text-muted-foreground">Total de Logs</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-green-600">{stats.sent}</p>
            <p className="text-xs text-muted-foreground">Notificações Enviadas</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-red-600">{stats.failed}</p>
            <p className="text-xs text-muted-foreground">Falhas de Envio</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-[#2F428D]">{stats.today}</p>
            <p className="text-xs text-muted-foreground">Hoje</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por título, email ou empresa..."
            className="pl-9"
          />
        </div>
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-full md:w-[200px]">
            <Filter className="h-4 w-4 mr-2" />
            <SelectValue placeholder="Tipo de evento" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os tipos</SelectItem>
            <SelectItem value="whatsapp_connected">WhatsApp Conectado</SelectItem>
            <SelectItem value="whatsapp_disconnected">WhatsApp Desconectado</SelectItem>
            <SelectItem value="bulk_dispatch_started">Disparo Iniciado</SelectItem>
            <SelectItem value="bulk_dispatch_completed">Disparo Concluído</SelectItem>
            <SelectItem value="email_sent">E-mail Enviado</SelectItem>
            <SelectItem value="email_campaign_sent">Campanha de E-mail</SelectItem>
            <SelectItem value="user_registered">Novo Cadastro</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-full md:w-[180px]">
            <SelectValue placeholder="Status notificação" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="sent">Enviadas ✅</SelectItem>
            <SelectItem value="failed">Falharam ❌</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Log List */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-muted-foreground">
            {filtered.length} registro(s)
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 space-y-3">
              {[1,2,3,4,5].map(i => <Skeleton key={i} className="h-16 w-full" />)}
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground">
              <Bell className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p>Nenhum log encontrado</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {filtered.map((log) => {
                const config = eventTypeConfig[log.event_type] || {
                  label: log.event_type,
                  icon: Bell,
                  color: 'bg-muted text-muted-foreground',
                };
                const Icon = config.icon;

                return (
                  <div key={log.id} className="flex items-start gap-3 p-4 hover:bg-muted/50 transition-colors">
                    <div className={`p-2 rounded-lg shrink-0 ${config.color}`}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm">{log.event_title}</span>
                        <Badge variant="outline" className="text-[10px]">
                          {config.label}
                        </Badge>
                      </div>
                      {log.event_description && (
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                          {log.event_description}
                        </p>
                      )}
                      <div className="flex items-center gap-3 mt-1 text-[11px] text-muted-foreground">
                        {log.user_email && <span>👤 {log.user_email}</span>}
                        {log.company_name && <span>🏢 {log.company_name}</span>}
                        <span>🕐 {formatDate(log.created_at)}</span>
                      </div>
                      {log.notification_error && (
                        <p className="text-xs text-destructive mt-1">
                          ⚠️ {log.notification_error}
                        </p>
                      )}
                    </div>
                    <div className="shrink-0">
                      {log.notification_sent ? (
                        <CheckCircle className="h-5 w-5 text-green-500" />
                      ) : (
                        <XCircle className="h-5 w-5 text-red-400" />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminNotificationsLog;
