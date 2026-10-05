import React, { useState, useEffect } from 'react';
 import { Key, Copy, Trash2, Plus, Eye, EyeOff, Power, Code, Loader2, RefreshCw, ExternalLink, CheckCircle, XCircle, Clock, AlertTriangle, ArrowLeft, BarChart3, ChevronDown, ChevronUp, Lightbulb, AlertCircle, Ban, CreditCard, MessageSquare as WhatsAppIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';
import ApiKeyWebhookInline from '@/components/CRM/ApiKeyWebhookInline';

interface ApiKey {
  id: string;
  api_key: string;
  name: string;
  is_active: boolean;
  rate_limit_per_minute: number;
  total_messages_sent: number;
  last_used_at: string | null;
  created_at: string;
  session_id: string;
  webhook_url?: string | null;
  webhook_secret?: string | null;
}

interface ApiLog {
  id: string;
  api_key_id: string;
  phone: string;
  message_preview: string | null;
  status: string;
  error_message: string | null;
  ip_address: string | null;
  created_at: string;
}

interface WhatsAppSession {
  id: string;
  instance_name: string;
  status: string;
  phone_number?: string;
}

const getErrorSolution = (status: string, errorMessage: string | null): { title: string; solution: string } | null => {
  if (status === 'sent') return null;
  const err = (errorMessage || '').toLowerCase();
  if (status === 'rate_limited') return { title: 'Limite de taxa excedido', solution: 'Você está enviando mensagens muito rápido. Reduza a frequência ou aumente o rate_limit_per_minute da API Key. Aguarde 60s.' };
  if (err.includes('not connected') || err.includes('session not connected')) return { title: 'Sessão desconectada', solution: 'A sessão WhatsApp está desconectada. Vá ao painel de sessões e escaneie o QR Code novamente.' };
  if (err.includes('baileys') || err.includes('evolution') || err.includes('server not configured')) return { title: 'Servidor não configurado', solution: 'O servidor de WhatsApp não está configurado ou offline. Verifique a variável EVOLUTION_API_URL.' };
  if (err.includes('timeout') || err.includes('econnrefused')) return { title: 'Timeout de conexão', solution: 'O servidor não respondeu a tempo. Verifique se o servidor Evolution API está acessível e tente novamente.' };
  if (err.includes('not on whatsapp') || err.includes('not registered')) return { title: 'Número sem WhatsApp', solution: 'O número informado não possui conta no WhatsApp. Verifique se está correto.' };
  if (err.includes('media') || err.includes('download')) return { title: 'Erro de mídia', solution: 'Não foi possível processar o arquivo. Verifique se a URL é pública, o formato é suportado e o arquivo não excede 16MB.' };
  if (err.includes('<!doctype') || err.includes('<html')) return { title: 'Resposta HTML inesperada', solution: 'O servidor retornou uma página HTML em vez de JSON. Isso geralmente indica que a URL do servidor de WhatsApp está incorreta ou o endpoint não existe. Verifique a configuração da URL do servidor.' };
  if (err.includes('401') || err.includes('unauthorized')) return { title: 'Não autorizado', solution: 'API Key inválida ou desativada. Verifique se a chave está correta e ativa.' };
  if (err.includes('500') || err.includes('internal')) return { title: 'Erro interno', solution: 'Erro inesperado no servidor. Tente novamente ou contate o suporte.' };
  return { title: 'Erro', solution: 'Verifique a mensagem de erro completa abaixo. Se necessário, contate o suporte técnico.' };
};

const WhatsAppApiPage: React.FC = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [sessions, setSessions] = useState<WhatsAppSession[]>([]);
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [logs, setLogs] = useState<ApiLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [logsLoading, setLogsLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [selectedSessionId, setSelectedSessionId] = useState('');
  const [visibleKeys, setVisibleKeys] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState('keys');
  const [logFilter, setLogFilter] = useState<'all' | 'sent' | 'failed' | 'rate_limited'>('all');
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

  const SUPABASE_URL = 'https://jwddiyuezqrpuakazvgg.supabase.co';
  const connectedSessions = sessions.filter(s => s.status === 'connected');

  useEffect(() => {
    loadCompanyData();
  }, [user]);

  const loadCompanyData = async () => {
    if (!user) return;
    const { data: companyUser } = await supabase
      .from('company_users')
      .select('company_id')
      .eq('user_id', user.id)
      .single();

    if (companyUser) {
      setCompanyId(companyUser.company_id);
      await Promise.all([
        fetchSessions(companyUser.company_id),
        fetchApiKeys(companyUser.company_id),
        fetchLogs(companyUser.company_id),
      ]);
    }
    setLoading(false);
  };

  const fetchSessions = async (cId: string) => {
    const { data } = await supabase
      .from('whatsapp_sessions')
      .select('id, instance_name, status, phone_number')
      .eq('company_id', cId);
    if (data) setSessions(data);
  };

  const fetchApiKeys = async (cId: string) => {
    const { data } = await supabase
      .from('whatsapp_api_keys')
      .select('*')
      .eq('company_id', cId)
      .order('created_at', { ascending: false });
    if (data) setApiKeys(data as unknown as ApiKey[]);
  };

  const fetchLogs = async (cId: string) => {
    setLogsLoading(true);
    // Get api key ids for this company first
    const { data: keys } = await supabase
      .from('whatsapp_api_keys')
      .select('id')
      .eq('company_id', cId);

    if (keys && keys.length > 0) {
      const keyIds = keys.map(k => k.id);
      const { data } = await supabase
        .from('whatsapp_api_logs')
        .select('*')
        .in('api_key_id', keyIds)
        .order('created_at', { ascending: false })
        .limit(200);
      if (data) setLogs(data as unknown as ApiLog[]);
    }
    setLogsLoading(false);
  };

  const generateApiKey = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let key = 'ek_';
    for (let i = 0; i < 48; i++) key += chars.charAt(Math.floor(Math.random() * chars.length));
    return key;
  };

  const handleCreateKey = async () => {
    if (!selectedSessionId || !newKeyName.trim() || !companyId) {
      toast({ title: 'Preencha todos os campos', variant: 'destructive' });
      return;
    }
    setCreating(true);
    const apiKey = generateApiKey();
    const { error } = await supabase.from('whatsapp_api_keys').insert({
      company_id: companyId,
      session_id: selectedSessionId,
      api_key: apiKey,
      name: newKeyName.trim(),
    });
    if (error) {
      toast({ title: 'Erro ao criar API Key', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'API Key criada com sucesso!' });
      setShowCreateDialog(false);
      setNewKeyName('');
      setSelectedSessionId('');
      fetchApiKeys(companyId);
    }
    setCreating(false);
  };

  const toggleKeyStatus = async (key: ApiKey) => {
    await supabase.from('whatsapp_api_keys').update({ is_active: !key.is_active }).eq('id', key.id);
    if (companyId) fetchApiKeys(companyId);
  };

  const deleteKey = async (id: string) => {
    await supabase.from('whatsapp_api_keys').delete().eq('id', id);
    toast({ title: 'API Key removida' });
    if (companyId) fetchApiKeys(companyId);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: 'Copiado!' });
  };

  const toggleKeyVisibility = (id: string) => {
    setVisibleKeys(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const maskKey = (key: string) => key.substring(0, 6) + '••••••••••••' + key.substring(key.length - 4);

  const filteredLogs = logFilter === 'all' ? logs : logs.filter(l => l.status === logFilter);

  const logStats = {
    total: logs.length,
    sent: logs.filter(l => l.status === 'sent').length,
    failed: logs.filter(l => l.status === 'failed').length,
    rateLimited: logs.filter(l => l.status === 'rate_limited').length,
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'sent': return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'failed': return <XCircle className="h-4 w-4 text-destructive" />;
      case 'rate_limited': return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      default: return <Clock className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'sent': return 'Enviado';
      case 'failed': return 'Falhou';
      case 'rate_limited': return 'Rate Limited';
      default: return status;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-64px)] bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-[#374DA4]" />
      </div>
    );
  }

  return (
    <div className="min-h-full bg-background relative overflow-hidden">
      {/* Ambient glow blobs */}
      <div aria-hidden className="pointer-events-none absolute -top-32 -right-32 h-[420px] w-[420px] rounded-full bg-[#374DA4]/20 blur-3xl opacity-50 dark:opacity-30" />
      <div aria-hidden className="pointer-events-none absolute top-[40%] -left-40 h-[360px] w-[360px] rounded-full bg-[#4D7CFF]/15 blur-3xl opacity-40 dark:opacity-20" />

      <div className="relative max-w-6xl mx-auto px-3 sm:px-6 py-4 sm:py-8">
        {/* Header */}
        <div className="mb-5 sm:mb-6 flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div className="flex items-center gap-3 sm:gap-4 min-w-0">
            <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard/crm-ello')} className="rounded-full shrink-0 h-9 w-9 sm:h-10 sm:w-10 hover:bg-[#374DA4]/10">
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="h-11 w-11 sm:h-12 sm:w-12 rounded-2xl flex items-center justify-center shadow-lg shadow-[#374DA4]/20 shrink-0" style={{ background: `linear-gradient(135deg, #374DA4, #4D7CFF)` }}>
              <Key className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
            </div>
            <div className="min-w-0">
              <h1 className="text-xl sm:text-2xl md:text-3xl font-extrabold text-foreground tracking-tight truncate">API WhatsApp</h1>
              <p className="text-xs sm:text-sm text-muted-foreground mt-0.5 truncate">
                Integre o CRM ao seu sistema via endpoints REST.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <Button variant="outline" size="sm" onClick={() => navigate('/dashboard/api-whatsapp/checkout')} className="rounded-full h-9 px-3 sm:px-4 gap-1.5 border-border bg-card/60 backdrop-blur-md hover:bg-[#374DA4]/5 hover:border-[#374DA4]/30 hover:text-[#374DA4] transition-all">
              <CreditCard className="h-4 w-4" />
              <span className="text-xs sm:text-sm font-semibold">Planos</span>
            </Button>
            <Button variant="outline" size="sm" onClick={() => window.open('/docs-apicrm', '_blank')} className="rounded-full h-9 px-3 sm:px-4 gap-1.5 border-border bg-card/60 backdrop-blur-md hover:bg-[#374DA4]/5 hover:border-[#374DA4]/30 hover:text-[#374DA4] transition-all">
              <ExternalLink className="h-4 w-4" />
              <span className="text-xs sm:text-sm font-semibold">Docs</span>
            </Button>
            <Button size="sm" onClick={() => setShowCreateDialog(true)} disabled={connectedSessions.length === 0} className="rounded-full h-9 px-4 sm:px-5 gap-1.5 text-white shadow-lg shadow-[#374DA4]/25 hover:shadow-[#374DA4]/40 hover:scale-[1.02] active:scale-95 transition-all font-semibold disabled:opacity-50 disabled:shadow-none" style={{ backgroundColor: '#374DA4' }}>
              <Plus className="h-4 w-4" />
              <span className="text-xs sm:text-sm">Nova Key</span>
            </Button>
          </div>
        </div>

        {/* Stat pills */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-3 mb-5 sm:mb-6">
          {[
            { icon: Key, label: 'API Keys', value: apiKeys.length, color: '#374DA4', iconBg: 'bg-[#374DA4]/10', iconColor: 'text-[#374DA4]' },
            { icon: CheckCircle, label: 'Enviados', value: logStats.sent, color: '#10b981', iconBg: 'bg-emerald-500/10', iconColor: 'text-emerald-500' },
            { icon: XCircle, label: 'Falhas', value: logStats.failed, color: '#ef4444', iconBg: 'bg-rose-500/10', iconColor: 'text-rose-500' },
            { icon: AlertTriangle, label: 'Rate Limit', value: logStats.rateLimited, color: '#f59e0b', iconBg: 'bg-amber-500/10', iconColor: 'text-amber-500' },
          ].map((stat, i) => {
            const Icon = stat.icon;
            return (
              <div key={i} className="group flex items-center gap-3 bg-card/60 backdrop-blur-md border border-border rounded-2xl p-3 sm:p-4 hover:border-[#374DA4]/30 hover:bg-card transition-all hover:-translate-y-0.5 hover:shadow-lg hover:shadow-[#374DA4]/5">
                <div className={`h-9 w-9 sm:h-10 sm:w-10 rounded-xl ${stat.iconBg} flex items-center justify-center shrink-0`}>
                  <Icon className={`h-4 w-4 sm:h-5 sm:w-5 ${stat.iconColor}`} />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] sm:text-xs text-muted-foreground uppercase tracking-wider font-bold">{stat.label}</p>
                  <p className="text-lg sm:text-2xl font-extrabold text-foreground leading-tight">{stat.value}</p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col">
          <TabsList className="w-full md:w-fit rounded-full bg-[#374DA4]/5 dark:bg-white/5 backdrop-blur-md border border-[#374DA4]/10 dark:border-white/10 p-1 h-auto overflow-x-auto scrollbar-none gap-0.5">
            <TabsTrigger value="keys" className="rounded-full px-3 sm:px-5 py-1.5 text-xs sm:text-sm font-semibold data-[state=active]:bg-[#374DA4] data-[state=active]:text-white data-[state=active]:shadow-md data-[state=active]:shadow-[#374DA4]/20 transition-all whitespace-nowrap">API Keys</TabsTrigger>
            <TabsTrigger value="sessions" className="rounded-full px-3 sm:px-5 py-1.5 text-xs sm:text-sm font-semibold data-[state=active]:bg-[#374DA4] data-[state=active]:text-white data-[state=active]:shadow-md data-[state=active]:shadow-[#374DA4]/20 transition-all whitespace-nowrap">Sessões</TabsTrigger>
            <TabsTrigger value="logs" className="rounded-full px-3 sm:px-5 py-1.5 text-xs sm:text-sm font-semibold data-[state=active]:bg-[#374DA4] data-[state=active]:text-white data-[state=active]:shadow-md data-[state=active]:shadow-[#374DA4]/20 transition-all whitespace-nowrap">
              Logs
              {logs.length > 0 && (
                <span className="ml-1.5 px-1.5 py-0.5 rounded-full bg-foreground/10 text-[10px] font-bold">{logs.length}</span>
              )}
            </TabsTrigger>
            <TabsTrigger value="examples" className="rounded-full px-3 sm:px-5 py-1.5 text-xs sm:text-sm font-semibold data-[state=active]:bg-[#374DA4] data-[state=active]:text-white data-[state=active]:shadow-md data-[state=active]:shadow-[#374DA4]/20 transition-all whitespace-nowrap">Código</TabsTrigger>
          </TabsList>

          {/* Sessões Tab */}
          <TabsContent value="sessions" className="mt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
              {sessions.length === 0 ? (
                <div className="col-span-full py-16 text-center bg-card/60 backdrop-blur-md rounded-2xl border border-dashed border-border">
                  <WhatsAppIcon className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">Nenhuma sessão. Conecte seu WhatsApp no CRM.</p>
                  <Button variant="link" onClick={() => navigate('/dashboard/crm-ello')} className="mt-2 text-[#374DA4]">
                    Ir para o CRM →
                  </Button>
                </div>
              ) : (
                sessions.map(s => (
                  <div key={s.id} className="group bg-card/60 backdrop-blur-md border border-border rounded-2xl p-4 hover:border-[#374DA4]/30 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-[#374DA4]/5 transition-all">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="h-9 w-9 rounded-xl bg-[#374DA4]/10 flex items-center justify-center shrink-0">
                          <WhatsAppIcon className="h-4 w-4 text-[#374DA4]" />
                        </div>
                        <span className="text-sm font-bold text-foreground truncate">{s.instance_name}</span>
                      </div>
                      <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider backdrop-blur-md ${
                        s.status === 'connected'
                          ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                          : 'bg-muted text-muted-foreground border border-border'
                      }`}>
                        <div className={`h-1.5 w-1.5 rounded-full ${s.status === 'connected' ? 'bg-emerald-500 animate-pulse' : 'bg-muted-foreground'}`} />
                        {s.status === 'connected' ? 'Online' : 'Offline'}
                      </div>
                    </div>
                    <div className="space-y-1.5 mb-3">
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">Número</span>
                        <span className="font-medium text-foreground">{s.phone_number || '—'}</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">ID</span>
                        <span className="font-mono text-[10px] text-muted-foreground">{s.id.slice(0, 8)}…</span>
                      </div>
                    </div>
                    <Button variant="outline" size="sm" className="w-full text-xs h-9 rounded-full border-border hover:bg-[#374DA4]/5 hover:text-[#374DA4] hover:border-[#374DA4]/30 transition-all" onClick={() => navigate('/dashboard/crm-ello')}>
                      Gerenciar
                    </Button>
                  </div>
                ))
              )}
            </div>
          </TabsContent>

          {/* API Keys Tab */}
          <TabsContent value="keys" className="mt-4 space-y-4">
            {connectedSessions.length === 0 && (
              <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 backdrop-blur-md p-4 flex items-start gap-3">
                <div className="h-9 w-9 rounded-xl bg-amber-500/10 flex items-center justify-center shrink-0">
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                </div>
                <div className="text-sm text-amber-700 dark:text-amber-300">
                  <p className="font-bold">Nenhuma sessão conectada</p>
                  <p className="text-xs opacity-80 mt-0.5">Conecte um WhatsApp via QR Code antes de gerar API Keys.</p>
                </div>
              </div>
            )}

            <div className="bg-card/60 backdrop-blur-md rounded-2xl border border-border overflow-hidden">
              <div className="flex items-center justify-between p-4 border-b border-border">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-foreground">Suas API Keys</h3>
                  <span className="px-2 py-0.5 rounded-full bg-[#374DA4]/10 text-[10px] font-black text-[#374DA4] tracking-wider">{apiKeys.length}</span>
                </div>
                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full hover:bg-[#374DA4]/10 hover:text-[#374DA4]" onClick={() => companyId && fetchApiKeys(companyId)}>
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </div>

              {apiKeys.length === 0 ? (
                <div className="px-5 py-16 text-center">
                  <div className="h-14 w-14 mx-auto bg-[#374DA4]/5 rounded-full flex items-center justify-center mb-3">
                    <Key className="h-7 w-7 text-[#374DA4]/40" />
                  </div>
                  <h3 className="text-base font-bold text-foreground">Nenhuma API Key</h3>
                  <p className="text-xs text-muted-foreground mt-1">Clique em "Nova Key" para criar a primeira.</p>
                </div>
              ) : (
                <>
                  {/* Desktop table */}
                  <div className="overflow-x-auto hidden lg:block">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-border text-[11px] font-bold text-muted-foreground uppercase tracking-widest">
                          <th className="px-4 py-3 text-left">Nome</th>
                          <th className="px-4 py-3 text-left">API Key</th>
                          <th className="px-4 py-3 text-left">Status</th>
                          <th className="px-4 py-3 text-center">Msgs</th>
                          <th className="px-4 py-3 text-center">Lim/min</th>
                          <th className="px-4 py-3 text-left">Último uso</th>
                          <th className="px-4 py-3 text-right">Ações</th>
                        </tr>
                      </thead>
                      <tbody>
                        {apiKeys.map(key => (
                          <tr key={key.id} className="border-b border-border last:border-0 hover:bg-[#374DA4]/[0.03] dark:hover:bg-[#374DA4]/[0.08] transition-colors">
                            <td className="px-4 py-4 font-bold text-foreground text-sm">{key.name}</td>
                            <td className="px-4 py-4">
                              <div className="flex items-center gap-1">
                                <code className="text-xs bg-muted/60 backdrop-blur-md border border-border px-2.5 py-1 rounded-full max-w-[200px] truncate font-mono">
                                  {visibleKeys.has(key.id) ? key.api_key : maskKey(key.api_key)}
                                </code>
                                <Button variant="ghost" size="icon" className="h-7 w-7 rounded-full hover:bg-[#374DA4]/10 hover:text-[#374DA4]" onClick={() => toggleKeyVisibility(key.id)}>
                                  {visibleKeys.has(key.id) ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                                </Button>
                                <Button variant="ghost" size="icon" className="h-7 w-7 rounded-full hover:bg-[#374DA4]/10 hover:text-[#374DA4]" onClick={() => copyToClipboard(key.api_key)}>
                                  <Copy className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                              <ApiKeyWebhookInline keyId={key.id} apiKey={key.api_key} webhookUrl={key.webhook_url} webhookSecret={key.webhook_secret} onSaved={() => companyId && fetchApiKeys(companyId)} />
                            </td>
                            <td className="px-4 py-4">
                              <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider backdrop-blur-md ${
                                key.is_active
                                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                                  : 'bg-muted text-muted-foreground border border-border'
                              }`}>
                                <div className={`h-1.5 w-1.5 rounded-full ${key.is_active ? 'bg-emerald-500 animate-pulse' : 'bg-muted-foreground'}`} />
                                {key.is_active ? 'Ativa' : 'Inativa'}
                              </div>
                            </td>
                            <td className="px-4 py-4 text-center font-bold text-foreground">{key.total_messages_sent}</td>
                            <td className="px-4 py-4 text-center text-muted-foreground">{key.rate_limit_per_minute}</td>
                            <td className="px-4 py-4 text-xs text-muted-foreground">
                              {key.last_used_at ? new Date(key.last_used_at).toLocaleString('pt-BR') : 'Nunca'}
                            </td>
                            <td className="px-4 py-4 text-right">
                              <div className="flex items-center justify-end gap-1">
                                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full hover:bg-[#374DA4]/10 hover:text-[#374DA4]" onClick={() => toggleKeyStatus(key)} title={key.is_active ? 'Desativar' : 'Ativar'}>
                                  <Power className={`h-3.5 w-3.5 ${key.is_active ? 'text-emerald-500' : 'text-muted-foreground'}`} />
                                </Button>
                                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full hover:bg-rose-500/10 hover:text-rose-500 text-muted-foreground" onClick={() => deleteKey(key.id)}>
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Mobile cards */}
                  <div className="lg:hidden divide-y divide-border">
                    {apiKeys.map(key => (
                      <div key={key.id} className="p-3 sm:p-4 hover:bg-[#374DA4]/[0.03] transition-colors">
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div className="min-w-0">
                            <p className="font-bold text-foreground text-sm truncate">{key.name}</p>
                            <p className="text-[10px] text-muted-foreground mt-0.5">
                              {key.last_used_at ? `Usada ${new Date(key.last_used_at).toLocaleString('pt-BR')}` : 'Nunca usada'}
                            </p>
                          </div>
                          <div className={`shrink-0 inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider backdrop-blur-md ${
                            key.is_active
                              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                              : 'bg-muted text-muted-foreground border border-border'
                          }`}>
                            <div className={`h-1.5 w-1.5 rounded-full ${key.is_active ? 'bg-emerald-500 animate-pulse' : 'bg-muted-foreground'}`} />
                            {key.is_active ? 'Ativa' : 'Inativa'}
                          </div>
                        </div>

                        <div className="flex items-center gap-1 mb-2">
                          <code className="flex-1 text-[11px] bg-muted/60 border border-border px-2.5 py-1.5 rounded-full font-mono truncate">
                            {visibleKeys.has(key.id) ? key.api_key : maskKey(key.api_key)}
                          </code>
                          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full shrink-0 hover:bg-[#374DA4]/10 hover:text-[#374DA4]" onClick={() => toggleKeyVisibility(key.id)}>
                            {visibleKeys.has(key.id) ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full shrink-0 hover:bg-[#374DA4]/10 hover:text-[#374DA4]" onClick={() => copyToClipboard(key.api_key)}>
                            <Copy className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                        <div className="mb-3">
                          <ApiKeyWebhookInline keyId={key.id} apiKey={key.api_key} webhookUrl={key.webhook_url} webhookSecret={key.webhook_secret} onSaved={() => companyId && fetchApiKeys(companyId)} />
                        </div>

                        <div className="flex items-center gap-3 text-[11px] text-muted-foreground mb-3">
                          <span><span className="font-bold text-foreground">{key.total_messages_sent}</span> msgs</span>
                          <span className="opacity-50">•</span>
                          <span><span className="font-bold text-foreground">{key.rate_limit_per_minute}</span>/min</span>
                        </div>

                        <div className="flex items-center gap-2">
                          <Button size="sm" variant="outline" className="flex-1 rounded-full h-9 text-xs gap-1.5 border-border" onClick={() => toggleKeyStatus(key)}>
                            <Power className={`h-3.5 w-3.5 ${key.is_active ? 'text-emerald-500' : ''}`} />
                            {key.is_active ? 'Desativar' : 'Ativar'}
                          </Button>
                          <Button size="sm" variant="outline" className="rounded-full h-9 px-3 text-rose-500 border-border hover:bg-rose-500/10 hover:border-rose-500/30" onClick={() => deleteKey(key.id)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </TabsContent>

          <TabsContent value="logs" className="mt-4">
            <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
              <div className="flex items-center gap-1.5 p-1 rounded-full bg-[#374DA4]/5 dark:bg-white/5 backdrop-blur-md border border-[#374DA4]/10 dark:border-white/10 overflow-x-auto scrollbar-none">
                {[
                  { id: 'all' as const, label: 'Todos', count: logStats.total, icon: null },
                  { id: 'sent' as const, label: 'Enviados', count: logStats.sent, icon: CheckCircle, color: 'text-emerald-500' },
                  { id: 'failed' as const, label: 'Falhas', count: logStats.failed, icon: XCircle, color: 'text-rose-500' },
                  { id: 'rate_limited' as const, label: 'Limite', count: logStats.rateLimited, icon: AlertTriangle, color: 'text-amber-500' },
                ].map(f => {
                  const Icon = f.icon;
                  const active = logFilter === f.id;
                  return (
                    <button
                      key={f.id}
                      onClick={() => setLogFilter(f.id)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all whitespace-nowrap ${
                        active ? 'bg-[#374DA4] text-white shadow-md shadow-[#374DA4]/20' : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      {Icon && <Icon className={`h-3.5 w-3.5 ${active ? 'text-white' : f.color}`} />}
                      {f.label}
                      <span className={`px-1.5 py-0 rounded-full text-[10px] font-black ${active ? 'bg-white/20' : 'bg-muted-foreground/10'}`}>{f.count}</span>
                    </button>
                  );
                })}
              </div>
              <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full hover:bg-[#374DA4]/10 hover:text-[#374DA4]" onClick={() => companyId && fetchLogs(companyId)}>
                <RefreshCw className={`h-4 w-4 ${logsLoading ? 'animate-spin' : ''}`} />
              </Button>
            </div>

            <div className="bg-card/60 backdrop-blur-md rounded-2xl border border-border overflow-hidden">
              <ScrollArea className="max-h-[60vh]">
                {filteredLogs.length === 0 ? (
                  <div className="px-5 py-16 text-center">
                    <BarChart3 className="h-10 w-10 mx-auto text-muted-foreground/40 mb-2" />
                    <p className="text-sm text-muted-foreground">Nenhum log encontrado</p>
                  </div>
                ) : (
                  <div className="divide-y divide-border">
                    {filteredLogs.map(log => {
                      const isExpanded = expandedLogId === log.id;
                      const solution = getErrorSolution(log.status, log.error_message);

                      return (
                        <div key={log.id}>
                          <button
                            className="w-full flex items-center gap-3 p-3 sm:p-4 text-left hover:bg-[#374DA4]/[0.04] dark:hover:bg-[#374DA4]/[0.08] transition-colors"
                            onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
                          >
                            <div className="shrink-0" title={getStatusLabel(log.status)}>
                              {getStatusIcon(log.status)}
                            </div>
                            <span className="font-mono text-xs w-28 sm:w-32 shrink-0 text-foreground">{log.phone}</span>
                            <span className="text-xs text-muted-foreground truncate flex-1 hidden sm:inline">
                              {log.message_preview || '-'}
                            </span>
                            {log.error_message && (
                              <span className="text-xs text-rose-500 truncate max-w-[250px] hidden md:inline">
                                {log.error_message.substring(0, 60)}...
                              </span>
                            )}
                            <span className="font-mono text-xs text-muted-foreground shrink-0 hidden md:inline">{log.ip_address || '-'}</span>
                            <span className="text-xs text-muted-foreground whitespace-nowrap shrink-0">
                              {new Date(log.created_at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
                            </span>
                            {isExpanded ? <ChevronUp className="h-4 w-4 shrink-0" /> : <ChevronDown className="h-4 w-4 shrink-0" />}
                          </button>

                          {isExpanded && (
                            <div className="px-4 pb-4 space-y-3 bg-muted/20 dark:bg-white/[0.02]">
                              {/* Details grid */}
                              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-3 text-xs">
                                <div>
                                  <span className="text-muted-foreground block">Status</span>
                                  <span className="font-medium">{getStatusLabel(log.status)}</span>
                                </div>
                                <div>
                                  <span className="text-muted-foreground block">Telefone</span>
                                  <span className="font-mono">{log.phone}</span>
                                </div>
                                <div>
                                  <span className="text-muted-foreground block">IP de Origem</span>
                                  <span className="font-mono">{log.ip_address || '—'}</span>
                                </div>
                                <div>
                                  <span className="text-muted-foreground block">Data/Hora</span>
                                  <span>{new Date(log.created_at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'medium' })}</span>
                                </div>
                              </div>

                              {/* Message preview */}
                              {log.message_preview && (
                                <div className="text-xs">
                                  <span className="text-muted-foreground block mb-1">Mensagem Enviada</span>
                                  <div className="bg-muted p-2 rounded font-mono break-all">{log.message_preview}</div>
                                </div>
                              )}

                              {/* Full error */}
                              {log.error_message && (
                                <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 space-y-2">
                                  <div className="flex items-start gap-2">
                                    <AlertCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                                    <div className="min-w-0 flex-1">
                                      <span className="text-xs font-semibold text-destructive block">Erro Completo</span>
                                      <pre className="text-xs text-destructive/80 mt-1 whitespace-pre-wrap break-all font-mono bg-destructive/5 p-2 rounded max-h-[300px] overflow-auto">
                                        {log.error_message}
                                      </pre>
                                    </div>
                                  </div>
                                </div>
                              )}

                              {/* Solution */}
                              {solution && (
                                <div className="rounded-2xl border border-[#374DA4]/30 bg-[#374DA4]/5 backdrop-blur-md p-3">
                                  <div className="flex items-start gap-2">
                                    <Lightbulb className="h-4 w-4 text-[#374DA4] shrink-0 mt-0.5" />
                                    <div>
                                      <span className="text-xs font-bold text-[#374DA4] block">{solution.title}</span>
                                      <p className="text-xs text-foreground/70 mt-1">{solution.solution}</p>
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </ScrollArea>
            </div>
          </TabsContent>

          {/* Code Examples Tab */}
          <TabsContent value="examples" className="mt-4">
            <CodeExamples apiKey={apiKeys[0]?.api_key || 'SUA_API_KEY'} supabaseUrl={SUPABASE_URL} onCopy={copyToClipboard} />
          </TabsContent>
        </Tabs>
      </div>

      {/* Create Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="rounded-2xl border-border">
          <DialogHeader>
            <div className="flex items-center gap-3 mb-1">
              <div className="h-10 w-10 rounded-xl flex items-center justify-center shadow-lg shadow-[#374DA4]/20" style={{ background: `linear-gradient(135deg, #374DA4, #4D7CFF)` }}>
                <Key className="h-5 w-5 text-white" />
              </div>
              <div>
                <DialogTitle className="text-lg font-bold">Nova API Key</DialogTitle>
                <DialogDescription className="text-xs">Gere uma chave para integrar com sistemas externos.</DialogDescription>
              </div>
            </div>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Nome da chave</label>
              <Input value={newKeyName} onChange={e => setNewKeyName(e.target.value)} placeholder="Ex: Meu E-commerce" className="mt-1.5 rounded-xl h-11" />
            </div>
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Sessão WhatsApp</label>
              <select className="w-full mt-1.5 rounded-xl border border-input bg-background px-3 h-11 text-sm" value={selectedSessionId} onChange={e => setSelectedSessionId(e.target.value)}>
                <option value="">Selecione uma sessão conectada</option>
                {connectedSessions.map(s => (
                  <option key={s.id} value={s.id}>{s.instance_name} {s.phone_number ? `(${s.phone_number})` : ''}</option>
                ))}
              </select>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" className="rounded-full" onClick={() => setShowCreateDialog(false)}>Cancelar</Button>
            <Button onClick={handleCreateKey} disabled={creating} className="rounded-full text-white shadow-lg shadow-[#374DA4]/20 hover:shadow-[#374DA4]/30" style={{ backgroundColor: '#374DA4' }}>
              {creating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Key className="h-4 w-4 mr-2" />}
              Gerar API Key
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

// Separate code examples component
const CodeExamples: React.FC<{ apiKey: string; supabaseUrl: string; onCopy: (t: string) => void }> = ({ apiKey, supabaseUrl, onCopy }) => {
  const [tab, setTab] = useState('curl');

  const examples: Record<string, string> = {
    curl: `curl -X POST "${supabaseUrl}/functions/v1/whatsapp-public-api" \\
  -H "Content-Type: application/json" \\
  -H "X-API-Key: ${apiKey}" \\
  -d '{
    "action": "send_text",
    "phone": "5511999999999",
    "message": "Olá! Sua compra foi confirmada."
  }'`,
    javascript: `const response = await fetch(
  "${supabaseUrl}/functions/v1/whatsapp-public-api",
  {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": "${apiKey}",
    },
    body: JSON.stringify({
      action: "send_text",
      phone: "5511999999999",
      message: "Olá! Sua compra foi confirmada.",
    }),
  }
);
const data = await response.json();
console.log(data);`,
    python: `import requests

response = requests.post(
    "${supabaseUrl}/functions/v1/whatsapp-public-api",
    headers={
        "Content-Type": "application/json",
        "X-API-Key": "${apiKey}",
    },
    json={
        "action": "send_text",
        "phone": "5511999999999",
        "message": "Olá! Sua compra foi confirmada.",
    },
)
print(response.json())`,
    php: `<?php
$ch = curl_init("${supabaseUrl}/functions/v1/whatsapp-public-api");
curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_POST => true,
    CURLOPT_HTTPHEADER => [
        "Content-Type: application/json",
        "X-API-Key: ${apiKey}",
    ],
    CURLOPT_POSTFIELDS => json_encode([
        "action" => "send_text",
        "phone" => "5511999999999",
        "message" => "Olá! Sua compra foi confirmada.",
    ]),
]);
$response = curl_exec($ch);
echo $response;`,
  };

  return (
    <div className="space-y-4">
      <div className="bg-card/60 backdrop-blur-md rounded-2xl border border-border overflow-hidden">
        <div className="p-4 border-b border-border flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-[#374DA4]/10 flex items-center justify-center">
            <Code className="h-4 w-4 text-[#374DA4]" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground">Exemplos de Integração</h3>
            <p className="text-xs text-muted-foreground">Cole no seu sistema para enviar mensagens</p>
          </div>
        </div>
        <div className="p-4">
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList className="rounded-full bg-[#374DA4]/5 dark:bg-white/5 backdrop-blur-md border border-[#374DA4]/10 dark:border-white/10 p-1 h-auto">
              {['curl', 'javascript', 'python', 'php'].map(t => (
                <TabsTrigger key={t} value={t} className="rounded-full px-3 sm:px-4 py-1 text-xs font-semibold data-[state=active]:bg-[#374DA4] data-[state=active]:text-white data-[state=active]:shadow-md data-[state=active]:shadow-[#374DA4]/20 transition-all capitalize">
                  {t === 'curl' ? 'cURL' : t === 'javascript' ? 'JavaScript' : t.charAt(0).toUpperCase() + t.slice(1)}
                </TabsTrigger>
              ))}
            </TabsList>
            {Object.entries(examples).map(([key, code]) => (
              <TabsContent key={key} value={key} className="mt-3">
                <div className="relative group">
                  <pre className="bg-zinc-950 dark:bg-black text-zinc-100 p-4 pr-12 rounded-2xl text-xs overflow-x-auto whitespace-pre-wrap border border-zinc-800 font-mono leading-relaxed">{code}</pre>
                  <Button variant="ghost" size="icon" className="absolute top-2 right-2 h-8 w-8 rounded-full bg-white/5 hover:bg-[#374DA4]/30 text-zinc-300 hover:text-white backdrop-blur-md transition-all" onClick={() => onCopy(code)}>
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </TabsContent>
            ))}
          </Tabs>
        </div>
      </div>

      <div className="bg-card/60 backdrop-blur-md rounded-2xl border border-border p-4">
        <h3 className="text-sm font-bold text-foreground mb-3">Ações Disponíveis</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2 sm:gap-3">
          {[
            { action: 'send_text', desc: 'Envia mensagem de texto', params: 'phone, message' },
            { action: 'send_media', desc: 'Envia imagem/vídeo/documento', params: 'phone, media_url, caption, media_type' },
            { action: 'check_status', desc: 'Verifica se sessão está conectada', params: 'Sem campos adicionais' },
          ].map(a => (
            <div key={a.action} className="p-3 rounded-2xl border border-border bg-card/40 hover:border-[#374DA4]/30 hover:bg-[#374DA4]/[0.03] transition-all">
              <code className="font-mono font-bold text-[#374DA4] text-sm">{a.action}</code>
              <p className="text-xs text-foreground mt-1.5">{a.desc}</p>
              <p className="text-[11px] text-muted-foreground font-mono mt-2 truncate">{a.params}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default WhatsAppApiPage;
