import React, { useState, useEffect } from 'react';
import { AlertCircle, CheckCircle2, Clock, RefreshCw, Loader2, Search, Filter, ChevronDown, ChevronUp, ShieldAlert, Lightbulb, XCircle, Ban } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';

interface ApiLog {
  id: string;
  api_key_id: string;
  phone: string;
  message_preview: string | null;
  status: string;
  error_message: string | null;
  ip_address: string | null;
  created_at: string;
  api_key_name?: string;
}

interface WhatsAppApiLogsProps {
  companyId: string;
}

const getErrorSolution = (status: string, errorMessage: string | null): { title: string; solution: string } | null => {
  if (status === 'sent') return null;

  const err = (errorMessage || '').toLowerCase();

  if (status === 'rate_limited') {
    return {
      title: 'Limite de taxa excedido',
      solution: 'Você está enviando mensagens muito rápido. Reduza a frequência de envio ou aumente o limite de taxa (rate_limit_per_minute) na configuração da API Key. Aguarde 60 segundos antes de tentar novamente.',
    };
  }

  if (err.includes('session not connected') || err.includes('not connected')) {
    return {
      title: 'Sessão WhatsApp desconectada',
      solution: 'A sessão WhatsApp vinculada a esta API Key está desconectada. Vá até o painel de sessões WhatsApp, escaneie o QR Code novamente para reconectar. Verifique se o celular está com internet estável.',
    };
  }

  if (err.includes('baileys') || err.includes('server not configured')) {
    return {
      title: 'Servidor Baileys não configurado',
      solution: 'O servidor de envio (Baileys) não está configurado ou está offline. Verifique se a variável BAILEYS_SERVER_URL está definida e se o servidor está acessível. Contate o administrador do sistema.',
    };
  }

  if (err.includes('timeout') || err.includes('timed out') || err.includes('econnrefused')) {
    return {
      title: 'Timeout de conexão',
      solution: 'O servidor de envio não respondeu a tempo. Isso pode ser causado por sobrecarga ou problemas de rede. Tente novamente em alguns segundos. Se persistir, verifique o status do servidor Baileys.',
    };
  }

  if (err.includes('invalid') && err.includes('phone')) {
    return {
      title: 'Número de telefone inválido',
      solution: 'O número informado não é válido. Use o formato internacional completo sem caracteres especiais, ex: 5511999999999 (código do país + DDD + número).',
    };
  }

  if (err.includes('not registered') || err.includes('not on whatsapp')) {
    return {
      title: 'Número não registrado no WhatsApp',
      solution: 'O número informado não possui conta no WhatsApp. Verifique se o número está correto e se o destinatário usa WhatsApp.',
    };
  }

  if (err.includes('media') || err.includes('download')) {
    return {
      title: 'Erro ao processar mídia',
      solution: 'Não foi possível baixar ou processar o arquivo de mídia. Verifique se a URL é pública e acessível, se o formato é suportado (jpg, png, mp4, pdf, etc.) e se o arquivo não excede 16MB.',
    };
  }

  if (err.includes('401') || err.includes('unauthorized')) {
    return {
      title: 'Não autorizado',
      solution: 'A API Key é inválida ou foi desativada. Verifique se a chave está correta e ativa no painel de gerenciamento.',
    };
  }

  if (err.includes('500') || err.includes('internal')) {
    return {
      title: 'Erro interno do servidor',
      solution: 'Ocorreu um erro inesperado no servidor. Tente novamente. Se persistir, verifique os logs do servidor Baileys ou contate o suporte técnico.',
    };
  }

  return {
    title: 'Erro desconhecido',
    solution: 'Verifique a mensagem de erro completa abaixo. Se necessário, contate o suporte técnico com os detalhes do log.',
  };
};

const statusConfig: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  sent: { label: 'Enviado', color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400', icon: <CheckCircle2 className="h-3.5 w-3.5" /> },
  failed: { label: 'Falhou', color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400', icon: <XCircle className="h-3.5 w-3.5" /> },
  rate_limited: { label: 'Rate Limited', color: 'bg-[#DFE4FB] text-[#1A2551] dark:bg-[#0F1631]/30 dark:text-[#5A74D1]', icon: <Ban className="h-3.5 w-3.5" /> },
};

const WhatsAppApiLogs: React.FC<WhatsAppApiLogsProps> = ({ companyId }) => {
  const [logs, setLogs] = useState<ApiLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [expandedLog, setExpandedLog] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const PAGE_SIZE = 50;

  useEffect(() => {
    fetchLogs(true);
  }, [companyId, statusFilter]);

  const fetchLogs = async (reset = false) => {
    setLoading(true);
    const offset = reset ? 0 : page * PAGE_SIZE;

    let query = supabase
      .from('whatsapp_api_logs')
      .select('*, whatsapp_api_keys!inner(name, company_id)')
      .eq('whatsapp_api_keys.company_id', companyId)
      .order('created_at', { ascending: false })
      .range(offset, offset + PAGE_SIZE - 1);

    if (statusFilter !== 'all') {
      query = query.eq('status', statusFilter);
    }

    const { data, error } = await query;

    if (!error && data) {
      const mapped = data.map((log: any) => ({
        id: log.id,
        api_key_id: log.api_key_id,
        phone: log.phone,
        message_preview: log.message_preview,
        status: log.status,
        error_message: log.error_message,
        ip_address: log.ip_address,
        created_at: log.created_at,
        api_key_name: log.whatsapp_api_keys?.name,
      }));
      setLogs(reset ? mapped : [...logs, ...mapped]);
      setHasMore(data.length === PAGE_SIZE);
      if (reset) setPage(0);
    }
    setLoading(false);
  };

  const filteredLogs = search
    ? logs.filter(l =>
        l.phone?.toLowerCase().includes(search.toLowerCase()) ||
        l.message_preview?.toLowerCase().includes(search.toLowerCase()) ||
        l.error_message?.toLowerCase().includes(search.toLowerCase()) ||
        l.api_key_name?.toLowerCase().includes(search.toLowerCase())
      )
    : logs;

  const errorCount = logs.filter(l => l.status === 'failed').length;
  const successCount = logs.filter(l => l.status === 'sent').length;
  const rateLimitCount = logs.filter(l => l.status === 'rate_limited').length;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="h-4 w-4" /> Logs de Requisições
            </CardTitle>
            <div className="flex gap-3 mt-2 text-xs">
              <span className="flex items-center gap-1 text-green-600"><CheckCircle2 className="h-3 w-3" /> {successCount} enviados</span>
              <span className="flex items-center gap-1 text-red-600"><XCircle className="h-3 w-3" /> {errorCount} erros</span>
              <span className="flex items-center gap-1 text-[#253573]"><Ban className="h-3 w-3" /> {rateLimitCount} bloqueados</span>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={() => fetchLogs(true)}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex gap-2 mt-3">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Buscar por telefone, mensagem, erro..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-8 h-9 text-sm"
            />
          </div>
          <div className="flex gap-1">
            {['all', 'sent', 'failed', 'rate_limited'].map(s => (
              <Button
                key={s}
                variant={statusFilter === s ? 'default' : 'outline'}
                size="sm"
                className="h-9 text-xs"
                onClick={() => setStatusFilter(s)}
              >
                {s === 'all' ? 'Todos' : s === 'sent' ? 'Enviados' : s === 'failed' ? 'Erros' : 'Bloqueados'}
              </Button>
            ))}
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {loading && logs.length === 0 ? (
          <div className="flex justify-center p-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
        ) : filteredLogs.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">Nenhum log encontrado</p>
        ) : (
          <ScrollArea className="max-h-[600px]">
            <div className="space-y-2">
              {filteredLogs.map(log => {
                const isExpanded = expandedLog === log.id;
                const cfg = statusConfig[log.status] || statusConfig.failed;
                const solution = getErrorSolution(log.status, log.error_message);

                return (
                  <div
                    key={log.id}
                    className={`border rounded-lg transition-all ${
                      log.status === 'failed' ? 'border-red-200 dark:border-red-900/50' :
                      log.status === 'rate_limited' ? 'border-[#B3BFF0] dark:border-[#0F1631]/50' :
                      'border-border'
                    }`}
                  >
                    <button
                      className="w-full flex items-center justify-between p-3 text-left hover:bg-muted/50 rounded-lg transition-colors"
                      onClick={() => setExpandedLog(isExpanded ? null : log.id)}
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <Badge className={`${cfg.color} flex items-center gap-1 shrink-0 text-xs`}>
                          {cfg.icon} {cfg.label}
                        </Badge>
                        <span className="text-sm font-mono truncate">{log.phone}</span>
                        {log.message_preview && (
                          <span className="text-xs text-muted-foreground truncate hidden md:inline">
                            {log.message_preview}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0 ml-2">
                        <span className="text-xs text-muted-foreground whitespace-nowrap">
                          {new Date(log.created_at).toLocaleString('pt-BR')}
                        </span>
                        {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      </div>
                    </button>

                    {isExpanded && (
                      <div className="px-3 pb-3 space-y-3 border-t">
                        {/* Details grid */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-3 text-xs">
                          <div>
                            <span className="text-muted-foreground block">API Key</span>
                            <span className="font-medium">{log.api_key_name || '—'}</span>
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
                            <span className="text-muted-foreground block mb-1">Mensagem</span>
                            <div className="bg-muted p-2 rounded font-mono break-all">{log.message_preview}</div>
                          </div>
                        )}

                        {/* Error details */}
                        {log.error_message && (
                          <div className="rounded-lg border border-red-200 dark:border-red-900/50 bg-red-50/50 dark:bg-red-950/20 p-3 space-y-2">
                            <div className="flex items-start gap-2">
                              <AlertCircle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
                              <div className="min-w-0">
                                <span className="text-xs font-semibold text-red-700 dark:text-red-400 block">Erro Completo</span>
                                <pre className="text-xs text-red-600 dark:text-red-300 mt-1 whitespace-pre-wrap break-all font-mono bg-red-100/50 dark:bg-red-950/30 p-2 rounded">
                                  {log.error_message}
                                </pre>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Solution */}
                        {solution && (
                          <div className="rounded-lg border border-[#B3BFF0] dark:border-[#0F1631]/50 bg-[#F0F2FE]/50 dark:bg-blue-950/20 p-3">
                            <div className="flex items-start gap-2">
                              <Lightbulb className="h-4 w-4 text-[#374DA4] shrink-0 mt-0.5" />
                              <div>
                                <span className="text-xs font-semibold text-[#253573] dark:text-[#5A74D1] block">{solution.title}</span>
                                <p className="text-xs text-[#2F428D] dark:text-[#879CE0] mt-1">{solution.solution}</p>
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

            {hasMore && (
              <div className="flex justify-center pt-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => { setPage(p => p + 1); fetchLogs(); }}
                  disabled={loading}
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Carregar mais
                </Button>
              </div>
            )}
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
};

export default WhatsAppApiLogs;
