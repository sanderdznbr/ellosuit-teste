
import { useState, useEffect } from 'react';
import { X, RefreshCw, CheckCircle2, XCircle, Clock, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';

interface ExecutionLog {
  id: string;
  status: string;
  started_at: string;
  completed_at: string | null;
  trigger_data: any;
  execution_log: any;
  error_message: string | null;
}

interface Props {
  automationId: string;
  isActive?: boolean;
  onClose: () => void;
}

export default function AutomationLogsPanel({ automationId, isActive, onClose }: Props) {
  const [logs, setLogs] = useState<ExecutionLog[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchLogs = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('automation_executions')
      .select('*')
      .eq('automation_id', automationId)
      .order('started_at', { ascending: false })
      .limit(50);
    setLogs((data || []) as ExecutionLog[]);
    setLoading(false);
  };

  useEffect(() => {
    fetchLogs();
    // Auto-refresh every 10s when active
    if (isActive) {
      const interval = setInterval(fetchLogs, 10000);
      return () => clearInterval(interval);
    }
  }, [automationId, isActive]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle2 className="h-4 w-4 text-green-400" />;
      case 'failed': return <XCircle className="h-4 w-4 text-red-400" />;
      case 'running': return <Clock className="h-4 w-4 text-[#5A74D1] animate-spin" />;
      default: return <AlertTriangle className="h-4 w-4 text-yellow-400" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-500/10 text-green-400 border-green-500/20';
      case 'failed': return 'bg-red-500/10 text-red-400 border-red-500/20';
      case 'running': return 'bg-[#374DA4]/10 text-[#5A74D1] border-[#374DA4]/20';
      default: return 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20';
    }
  };

  return (
    <div className={`w-80 border-l flex flex-col flex-shrink-0 overflow-hidden transition-colors duration-500 ${
      isActive ? 'bg-[#161822] border-gray-800' : 'bg-white'
    }`}>
      {/* Header */}
      <div className={`p-4 border-b flex items-center justify-between ${isActive ? 'border-gray-800' : ''}`}>
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${isActive ? 'bg-green-400 animate-pulse' : 'bg-gray-400'}`} />
          <span className={`text-sm font-semibold ${isActive ? 'text-gray-200' : 'text-gray-800'}`}>Logs de Execução</span>
        </div>
        <div className="flex items-center gap-1">
          <Button size="icon" variant="ghost" onClick={fetchLogs} className={`h-7 w-7 rounded-lg ${isActive ? 'hover:bg-gray-800 text-gray-400' : ''}`}>
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          </Button>
          <Button size="icon" variant="ghost" onClick={onClose} className={`h-7 w-7 rounded-lg ${isActive ? 'hover:bg-gray-800 text-gray-400' : ''}`}>
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Stats bar */}
      <div className={`px-4 py-2.5 border-b flex items-center gap-3 ${isActive ? 'border-gray-800 bg-gray-900/50' : 'bg-gray-50'}`}>
        <div className="text-center flex-1">
          <div className={`text-lg font-bold ${isActive ? 'text-green-400' : 'text-green-600'}`}>
            {logs.filter(l => l.status === 'completed').length}
          </div>
          <div className={`text-[9px] uppercase tracking-wider ${isActive ? 'text-gray-600' : 'text-gray-400'}`}>Sucesso</div>
        </div>
        <div className={`w-px h-8 ${isActive ? 'bg-gray-800' : 'bg-gray-200'}`} />
        <div className="text-center flex-1">
          <div className={`text-lg font-bold ${isActive ? 'text-red-400' : 'text-red-600'}`}>
            {logs.filter(l => l.status === 'failed').length}
          </div>
          <div className={`text-[9px] uppercase tracking-wider ${isActive ? 'text-gray-600' : 'text-gray-400'}`}>Erros</div>
        </div>
        <div className={`w-px h-8 ${isActive ? 'bg-gray-800' : 'bg-gray-200'}`} />
        <div className="text-center flex-1">
          <div className={`text-lg font-bold ${isActive ? 'text-gray-300' : 'text-gray-800'}`}>
            {logs.length}
          </div>
          <div className={`text-[9px] uppercase tracking-wider ${isActive ? 'text-gray-600' : 'text-gray-400'}`}>Total</div>
        </div>
      </div>

      {/* Log entries */}
      <div className="flex-1 overflow-y-auto">
        {logs.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full p-4">
            <Clock className={`h-10 w-10 mb-3 ${isActive ? 'text-gray-700' : 'text-gray-300'}`} />
            <p className={`text-sm font-medium ${isActive ? 'text-gray-500' : 'text-gray-400'}`}>Nenhuma execução ainda</p>
            <p className={`text-[10px] mt-1 ${isActive ? 'text-gray-700' : 'text-gray-300'}`}>
              Os logs aparecerão aqui quando o webhook receber dados
            </p>
          </div>
        ) : (
          <div className="p-2 space-y-1.5">
            {logs.map(log => {
              const execLog = log.execution_log as any;
              const actions = execLog?.actions || [];
              const fieldsDetected = execLog?.fields_detected || [];

              return (
                <div key={log.id} className={`rounded-xl p-3 border transition-colors ${
                  isActive ? 'bg-gray-900/60 border-gray-800 hover:border-gray-700' : 'bg-gray-50 border-gray-100 hover:border-gray-200'
                }`}>
                  <div className="flex items-center gap-2 mb-1.5">
                    {getStatusIcon(log.status)}
                    <Badge className={`text-[9px] px-1.5 py-0 rounded-full border ${getStatusColor(log.status)}`}>
                      {log.status === 'completed' ? 'Sucesso' : log.status === 'failed' ? 'Erro' : log.status}
                    </Badge>
                    <span className={`text-[9px] ml-auto ${isActive ? 'text-gray-600' : 'text-gray-400'}`}>
                      {new Date(log.started_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </span>
                  </div>

                  {fieldsDetected.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-1.5">
                      {fieldsDetected.slice(0, 5).map((f: string) => (
                        <span key={f} className={`text-[8px] px-1.5 py-0.5 rounded-full font-mono ${
                          isActive ? 'bg-[#374DA4]/10 text-[#5A74D1]' : 'bg-[#F0F2FE] text-[#2F428D]'
                        }`}>{f}</span>
                      ))}
                      {fieldsDetected.length > 5 && (
                        <span className={`text-[8px] ${isActive ? 'text-gray-600' : 'text-gray-400'}`}>+{fieldsDetected.length - 5}</span>
                      )}
                    </div>
                  )}

                  {actions.length > 0 && (
                    <div className="space-y-0.5">
                      {actions.map((a: any, i: number) => (
                        <div key={i} className={`text-[10px] flex items-center gap-1.5 ${isActive ? 'text-gray-500' : 'text-gray-500'}`}>
                          <div className={`w-1.5 h-1.5 rounded-full ${a.status === 'success' ? 'bg-green-400' : a.status === 'error' ? 'bg-red-400' : 'bg-yellow-400'}`} />
                          <span>{a.type === 'create_client' ? 'Criar Cliente' : a.type}</span>
                          <span className="text-[9px]">→ {a.status === 'success' ? '✓' : a.status === 'error' ? '✗' : '⏳'}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {log.error_message && (
                    <div className="mt-1.5 text-[10px] text-red-400 bg-red-500/10 px-2 py-1 rounded-lg">
                      {log.error_message}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
