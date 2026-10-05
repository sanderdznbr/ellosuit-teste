import React, { useState, useEffect, useCallback } from 'react';
import { Activity, CheckCircle, AlertTriangle, XCircle, RefreshCw, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import ellosuitLogo from '@/assets/logoellosuit.png';
import { supabase } from '@/integrations/supabase/client';

type ModuleStatus = 'healthy' | 'slow' | 'error' | 'testing' | 'unknown';

const statusColors: Record<ModuleStatus, string> = {
  healthy: '#10B981',
  slow: '#F59E0B',
  error: '#EF4444',
  testing: '#374DA4',
  unknown: '#6B7280',
};

const statusLabels: Record<ModuleStatus, string> = {
  healthy: 'Operacional',
  slow: 'Lento',
  error: 'Falha',
  testing: 'Testando...',
  unknown: 'Verificando...',
};

const generateWaveform = (latency: number, width: number = 200, height: number = 40) => {
  const mid = height / 2;
  const points: string[] = [];
  const seed = latency || 500;
  const freq = Math.max(2, Math.min(6, Math.round(seed / 200)));
  const amplitude = Math.max(4, Math.min(mid - 2, 16 - (seed / 500)));
  const segWidth = width / (freq * 5 + 2);
  let x = 0;
  points.push(`${x},${mid}`);
  for (let i = 0; i < freq; i++) {
    x += segWidth * (1.5 + (((seed * (i + 1)) % 7) / 7));
    points.push(`${Math.min(x, width)},${mid}`);
    const peakVar = ((seed * (i + 3)) % 5) / 5;
    const dip = mid + amplitude * (0.6 + peakVar * 0.4);
    const spike = mid - amplitude * (0.8 + ((seed * (i + 2)) % 3) / 6);
    const smallDip = mid + amplitude * (0.3 + peakVar * 0.3);
    x += segWidth * 0.5; points.push(`${Math.min(x, width)},${spike}`);
    x += segWidth * 0.5; points.push(`${Math.min(x, width)},${dip}`);
    x += segWidth * 0.4; points.push(`${Math.min(x, width)},${spike * 0.9 + mid * 0.1}`);
    x += segWidth * 0.4; points.push(`${Math.min(x, width)},${smallDip}`);
    x += segWidth * 0.4; points.push(`${Math.min(x, width)},${mid}`);
  }
  if (x < width) points.push(`${width},${mid}`);
  return points.join(' ');
};

const HeartbeatLine = ({ status, latency = 0 }: { status: ModuleStatus; latency?: number }) => {
  const color = statusColors[status];
  const id = `hb-${Math.random().toString(36).slice(2, 8)}`;
  if (status === 'healthy') {
    const duration = Math.max(1.5, Math.min(4, latency / 300));
    const waveform = generateWaveform(latency);
    return (
      <svg viewBox="0 0 200 40" className="w-full h-6" preserveAspectRatio="none">
        <polyline points={waveform} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="600" strokeDashoffset="0">
          <animate attributeName="stroke-dashoffset" values="600;0;-600" dur={`${duration}s`} repeatCount="indefinite" />
        </polyline>
      </svg>
    );
  }
  if (status === 'slow') {
    const duration = Math.max(4, Math.min(8, latency / 600));
    const waveform = generateWaveform(latency);
    return (
      <svg viewBox="0 0 200 40" className="w-full h-6" preserveAspectRatio="none">
        <polyline points={waveform} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="600" strokeDashoffset="0">
          <animate attributeName="stroke-dashoffset" values="600;0;-600" dur={`${duration}s`} repeatCount="indefinite" />
        </polyline>
      </svg>
    );
  }
  if (status === 'error') {
    return (
      <svg viewBox="0 0 200 40" className="w-full h-6" preserveAspectRatio="none">
        <line x1="0" y1="20" x2="200" y2="20" stroke={color} strokeWidth="2" strokeDasharray="8 4" opacity="0.6">
          <animate attributeName="opacity" values="0.3;0.8;0.3" dur="2s" repeatCount="indefinite" />
        </line>
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 200 40" className="w-full h-6" preserveAspectRatio="none">
      <line x1="0" y1="20" x2="200" y2="20" stroke={color} strokeWidth="1.5" strokeOpacity="0.3" />
    </svg>
  );
};

interface ModuleDef {
  id: string;
  name: string;
  category: string;
  testFn: () => Promise<{ status: ModuleStatus; latency: number; message?: string }>;
}

const projectRef = 'jwddiyuezqrpuakazvgg';
const anonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp3ZGRpeXVlenFycHVha2F6dmdnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTEzNDIzNTgsImV4cCI6MjA2NjkxODM1OH0.CrUu3HGCfWh6cPfGsbDXGQNG5AWOsi9X2GGix1-7izg';

const testEF = (name: string) => async () => {
  const start = Date.now();
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(`https://${projectRef}.supabase.co/functions/v1/${name}`, {
      method: 'POST',
      headers: { apikey: anonKey, 'Content-Type': 'application/json', 'Authorization': `Bearer ${anonKey}` },
      body: JSON.stringify({ healthcheck: true }),
      signal: controller.signal,
    });
    clearTimeout(timeout);
    const latency = Date.now() - start;
    if (latency > 4000) return { status: 'slow' as ModuleStatus, latency };
    return { status: 'healthy' as ModuleStatus, latency };
  } catch (e: any) {
    const latency = Date.now() - start;
    if (e.name === 'AbortError') return { status: 'slow' as ModuleStatus, latency, message: 'Timeout' };
    return { status: 'error' as ModuleStatus, latency: Date.now() - start };
  }
};

const testDB = () => async () => {
  const start = Date.now();
  try {
    const { error } = await supabase.from('companies').select('id').limit(1);
    const latency = Date.now() - start;
    return { status: (error ? 'error' : latency > 2000 ? 'slow' : 'healthy') as ModuleStatus, latency };
  } catch { return { status: 'error' as ModuleStatus, latency: Date.now() - start }; }
};

const modules: ModuleDef[] = [
  { id: 'email', name: 'Email Service', category: 'Edge Functions', testFn: testEF('send-email') },
  { id: 'ai', name: 'AI Chat', category: 'Edge Functions', testFn: testEF('ai-chat') },
  { id: 'whatsapp', name: 'WhatsApp API', category: 'Edge Functions', testFn: testEF('whatsapp-api') },
  { id: 'livekit', name: 'LiveKit (Video)', category: 'Edge Functions', testFn: testEF('livekit-token') },
  { id: 'payments', name: 'Pagamentos', category: 'Edge Functions', testFn: testEF('pagarme-checkout') },
  { id: 'calendar', name: 'Google Calendar', category: 'Edge Functions', testFn: testEF('google-calendar') },
  { id: 'tracking', name: 'Document Tracking', category: 'Edge Functions', testFn: testEF('document-tracking') },
  { id: 'push', name: 'Push Notifications', category: 'Edge Functions', testFn: testEF('send-push') },
  { id: 'db', name: 'Banco de Dados', category: 'Infraestrutura', testFn: testDB() },
  { id: 'api', name: 'Supabase API', category: 'Infraestrutura', testFn: async () => {
    const start = Date.now();
    try {
      const res = await fetch(`https://${projectRef}.supabase.co/rest/v1/`, { headers: { apikey: anonKey } });
      const latency = Date.now() - start;
      return { status: (res.ok ? (latency > 2000 ? 'slow' : 'healthy') : 'error') as ModuleStatus, latency };
    } catch { return { status: 'error' as ModuleStatus, latency: Date.now() - start }; }
  }},
  { id: 'storage', name: 'Storage', category: 'Infraestrutura', testFn: async () => {
    const start = Date.now();
    try {
      const { error } = await supabase.storage.listBuckets();
      const latency = Date.now() - start;
      return { status: (error ? 'error' : latency > 2000 ? 'slow' : 'healthy') as ModuleStatus, latency };
    } catch { return { status: 'error' as ModuleStatus, latency: Date.now() - start }; }
  }},
];

const StatusServer = () => {
  const [statuses, setStatuses] = useState<Record<string, { status: ModuleStatus; latency: number }>>({});
  const [testing, setTesting] = useState(true);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);

  const runAll = useCallback(async () => {
    setTesting(true);
    modules.forEach(m => setStatuses(prev => ({ ...prev, [m.id]: { status: 'testing', latency: 0 } })));
    await Promise.all(modules.map(async (m) => {
      const result = await m.testFn();
      setStatuses(prev => ({ ...prev, [m.id]: result }));
    }));
    setLastChecked(new Date());
    setTesting(false);
  }, []);

  useEffect(() => { runAll(); }, []);

  const healthyCount = Object.values(statuses).filter(s => s.status === 'healthy').length;
  const slowCount = Object.values(statuses).filter(s => s.status === 'slow').length;
  const errorCount = Object.values(statuses).filter(s => s.status === 'error').length;
  const overallStatus: ModuleStatus = errorCount > 0 ? 'error' : slowCount > 0 ? 'slow' : healthyCount > 0 ? 'healthy' : 'unknown';

  const getIcon = (s: ModuleStatus) => {
    if (s === 'healthy') return <CheckCircle className="h-4 w-4 text-emerald-500" />;
    if (s === 'slow') return <AlertTriangle className="h-4 w-4 text-amber-500" />;
    if (s === 'error') return <XCircle className="h-4 w-4 text-red-500" />;
    if (s === 'testing') return <Loader2 className="h-4 w-4 text-[#374DA4] animate-spin" />;
    return <Activity className="h-4 w-4 text-gray-400" />;
  };

  const cats = [...new Set(modules.map(m => m.category))];

  return (
    <div className="min-h-screen bg-[#0A0E27] text-white">
      {/* Header */}
      <div className="border-b border-white/5">
        <div className="max-w-4xl mx-auto px-4 py-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={ellosuitLogo} alt="Ellosuit" className="h-7 w-auto brightness-0 invert" />
            <span className="text-white/30 text-lg font-light">|</span>
            <span className="text-sm font-medium text-white/70">Status do Sistema</span>
          </div>
          <button
            onClick={runAll}
            disabled={testing}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-xs font-medium transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${testing ? 'animate-spin' : ''}`} />
            Atualizar
          </button>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8 space-y-8">
        {/* Overall Status */}
        <div className="text-center space-y-4">
          <div className="inline-flex items-center gap-3 px-6 py-3 rounded-2xl" style={{ backgroundColor: `${statusColors[overallStatus]}15` }}>
            <div className="h-3 w-3 rounded-full animate-pulse" style={{ backgroundColor: statusColors[overallStatus] }} />
            <span className="text-xl font-bold" style={{ color: statusColors[overallStatus] }}>
              {overallStatus === 'healthy' ? 'Todos os sistemas operacionais' :
               overallStatus === 'slow' ? 'Alguns módulos com lentidão' :
               overallStatus === 'error' ? 'Falha detectada em módulos' : 'Verificando...'}
            </span>
          </div>
          <div className="flex items-center justify-center gap-6 text-sm text-white/50">
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-emerald-500" /> {healthyCount} operacional</span>
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-amber-500" /> {slowCount} lento</span>
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-red-500" /> {errorCount} falha</span>
          </div>
          {lastChecked && (
            <p className="text-xs text-white/30">Última verificação: {lastChecked.toLocaleString('pt-BR')}</p>
          )}
        </div>

        {/* Modules by Category */}
        {cats.map(cat => (
          <div key={cat}>
            <h3 className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-3">{cat}</h3>
            <div className="space-y-2">
              {modules.filter(m => m.category === cat).map(mod => {
                const s = statuses[mod.id] || { status: 'unknown' as ModuleStatus, latency: 0 };
                return (
                  <div key={mod.id} className="flex items-center justify-between p-4 rounded-xl bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.05] transition-colors">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      {getIcon(s.status)}
                      <span className="text-sm font-medium text-white/90">{mod.name}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-24 hidden sm:block">
                        <HeartbeatLine status={s.status} latency={s.latency} />
                      </div>
                      {s.latency > 0 && (
                        <span className="text-[10px] font-mono text-white/30 w-12 text-right">{s.latency}ms</span>
                      )}
                      <span
                        className="text-[10px] font-semibold px-2 py-0.5 rounded-full w-20 text-center"
                        style={{ backgroundColor: `${statusColors[s.status]}20`, color: statusColors[s.status] }}
                      >
                        {statusLabels[s.status]}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}

        {/* Footer */}
        <div className="text-center pt-8 border-t border-white/5">
          <p className="text-xs text-white/20">Ellosuit © {new Date().getFullYear()} — Status monitorado automaticamente</p>
        </div>
      </div>
    </div>
  );
};

export default StatusServer;
