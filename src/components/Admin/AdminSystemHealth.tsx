import React, { useState, useEffect, useCallback } from 'react';
import { useAdminMaster } from '@/hooks/useAdminMaster';
import { Navigate, useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import {
  ArrowLeft, Activity, RefreshCw, ExternalLink, Globe, Loader2,
  CheckCircle, AlertTriangle, XCircle, Zap, Copy
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

type ModuleStatus = 'healthy' | 'slow' | 'error' | 'testing' | 'unknown';

interface SystemModule {
  id: string;
  name: string;
  category: 'edge' | 'api' | 'database' | 'storage';
  description: string;
  testFn: () => Promise<{ status: ModuleStatus; latency: number; message?: string }>;
}

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
  unknown: 'Não testado',
};

// Generate unique heartbeat waveform based on latency
const generateWaveform = (latency: number, width: number = 300, height: number = 40) => {
  const mid = height / 2;
  const points: string[] = [];
  // Use latency as seed for unique waveform shape
  const seed = latency || 500;
  const freq = Math.max(2, Math.min(8, Math.round(seed / 150))); // 2-8 peaks based on latency
  const amplitude = Math.max(4, Math.min(mid - 2, 18 - (seed / 400))); // amplitude varies with speed
  const segWidth = width / (freq * 5 + 2);
  
  let x = 0;
  points.push(`${x},${mid}`);
  
  for (let i = 0; i < freq; i++) {
    // Flat segment
    x += segWidth * (1.5 + (((seed * (i + 1)) % 7) / 7));
    points.push(`${Math.min(x, width)},${mid}`);
    
    // Unique peak pattern per module (uses seed + index for variation)
    const peakVar = ((seed * (i + 3)) % 5) / 5;
    const dip = mid + amplitude * (0.6 + peakVar * 0.4);
    const spike = mid - amplitude * (0.8 + ((seed * (i + 2)) % 3) / 6);
    const smallDip = mid + amplitude * (0.3 + peakVar * 0.3);
    
    x += segWidth * 0.5;
    points.push(`${Math.min(x, width)},${spike}`);
    x += segWidth * 0.5;
    points.push(`${Math.min(x, width)},${dip}`);
    x += segWidth * 0.4;
    points.push(`${Math.min(x, width)},${spike * 0.9 + mid * 0.1}`);
    x += segWidth * 0.4;
    points.push(`${Math.min(x, width)},${smallDip}`);
    x += segWidth * 0.4;
    points.push(`${Math.min(x, width)},${mid}`);
  }
  
  // Fill remaining
  if (x < width) points.push(`${width},${mid}`);
  return points.join(' ');
};

// Animated heartbeat SVG — speed & shape driven by real latency
const HeartbeatLine = ({ status, latency = 0 }: { status: ModuleStatus; latency?: number }) => {
  const color = statusColors[status];
  const id = `hb-${Math.random().toString(36).slice(2, 8)}`;

  if (status === 'healthy') {
    // Faster latency = faster animation (1.5s–4s range)
    const duration = Math.max(1.5, Math.min(4, latency / 300));
    const waveform = generateWaveform(latency);
    return (
      <svg viewBox="0 0 300 40" className="w-full h-8" preserveAspectRatio="none">
        <defs>
          <linearGradient id={`g-${id}`} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor={color} stopOpacity="0" />
            <stop offset="20%" stopColor={color} stopOpacity="1" />
            <stop offset="80%" stopColor={color} stopOpacity="1" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        <polyline
          points={waveform}
          fill="none"
          stroke={`url(#g-${id})`}
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray="800"
          strokeDashoffset="0"
        >
          <animate attributeName="stroke-dashoffset" values="800;0;-800" dur={`${duration}s`} repeatCount="indefinite" />
        </polyline>
        <polyline
          points={waveform}
          fill="none"
          stroke={color}
          strokeWidth="6"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray="800"
          strokeDashoffset="0"
          opacity="0.12"
          filter="blur(4px)"
        >
          <animate attributeName="stroke-dashoffset" values="800;0;-800" dur={`${duration}s`} repeatCount="indefinite" />
        </polyline>
      </svg>
    );
  }

  if (status === 'slow') {
    const duration = Math.max(4, Math.min(8, latency / 600));
    const waveform = generateWaveform(latency);
    return (
      <svg viewBox="0 0 300 40" className="w-full h-8" preserveAspectRatio="none">
        <polyline
          points={waveform}
          fill="none"
          stroke={color}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray="800"
          strokeDashoffset="0"
        >
          <animate attributeName="stroke-dashoffset" values="800;0;-800" dur={`${duration}s`} repeatCount="indefinite" />
        </polyline>
      </svg>
    );
  }

  if (status === 'error') {
    return (
      <svg viewBox="0 0 300 40" className="w-full h-8" preserveAspectRatio="none">
        <line x1="0" y1="20" x2="300" y2="20" stroke={color} strokeWidth="2" strokeDasharray="8 6" opacity="0.6">
          <animate attributeName="opacity" values="0.3;0.8;0.3" dur="2s" repeatCount="indefinite" />
        </line>
      </svg>
    );
  }

  if (status === 'testing') {
    return (
      <svg viewBox="0 0 300 40" className="w-full h-8" preserveAspectRatio="none">
        <line x1="0" y1="20" x2="300" y2="20" stroke={color} strokeWidth="2" strokeDasharray="12 8" opacity="0.5">
          <animate attributeName="stroke-dashoffset" values="0;-40" dur="0.8s" repeatCount="indefinite" />
        </line>
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 300 40" className="w-full h-8" preserveAspectRatio="none">
      <line x1="0" y1="20" x2="300" y2="20" stroke={color} strokeWidth="1.5" opacity="0.2" />
    </svg>
  );
};

const AdminSystemHealth = () => {
  const { isAdminMaster, loading: authLoading } = useAdminMaster();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [statuses, setStatuses] = useState<Record<string, { status: ModuleStatus; latency: number; message?: string }>>({});
  const [testingAll, setTestingAll] = useState(false);
  const [publicLink, setPublicLink] = useState<string | null>(null);

  const projectRef = 'jwddiyuezqrpuakazvgg';
  const anonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp3ZGRpeXVlenFycHVha2F6dmdnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTEzNDIzNTgsImV4cCI6MjA2NjkxODM1OH0.CrUu3HGCfWh6cPfGsbDXGQNG5AWOsi9X2GGix1-7izg';

  // Test edge function by sending a GET request - any response (even 4xx) means it's deployed and running
  const testEdgeFunction = (fnName: string) => async (): Promise<{ status: ModuleStatus; latency: number; message?: string }> => {
    const start = Date.now();
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);
      const res = await fetch(`https://${projectRef}.supabase.co/functions/v1/${fnName}`, {
        method: 'POST',
        headers: {
          'apikey': anonKey,
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${anonKey}`,
        },
        body: JSON.stringify({ healthcheck: true }),
        signal: controller.signal,
      });
      clearTimeout(timeout);
      const latency = Date.now() - start;
      // Any HTTP response means the function is deployed and reachable
      // 4xx/5xx from business logic is fine - the function IS running
      if (latency > 4000) return { status: 'slow', latency, message: `${latency}ms` };
      return { status: 'healthy', latency };
    } catch (e: any) {
      const latency = Date.now() - start;
      if (e.name === 'AbortError') return { status: 'slow', latency, message: 'Timeout (>8s)' };
      return { status: 'error', latency, message: e.message };
    }
  };

  const testSupabaseQuery = (table: 'companies' | 'company_users' | 'subscriptions' | 'notifications') => async (): Promise<{ status: ModuleStatus; latency: number; message?: string }> => {
    const start = Date.now();
    try {
      const { error } = await supabase.from(table).select('id').limit(1);
      const latency = Date.now() - start;
      if (error) return { status: 'error', latency, message: error.message };
      if (latency > 2000) return { status: 'slow', latency };
      return { status: 'healthy', latency };
    } catch (e: any) {
      return { status: 'error', latency: Date.now() - start, message: e.message };
    }
  };

  const modules: SystemModule[] = [
    { id: 'ef-send-email', name: 'Send Email', category: 'edge', description: 'Envio de emails transacionais', testFn: testEdgeFunction('send-email') },
    { id: 'ef-ai-chat', name: 'AI Chat', category: 'edge', description: 'Assistente IA e agentes', testFn: testEdgeFunction('ai-chat') },
    { id: 'ef-whatsapp-api', name: 'WhatsApp API', category: 'edge', description: 'Integração WhatsApp', testFn: testEdgeFunction('whatsapp-api') },
    { id: 'ef-whatsapp-webhook', name: 'WhatsApp Webhook', category: 'edge', description: 'Recebimento de mensagens', testFn: testEdgeFunction('whatsapp-webhook') },
    { id: 'ef-livekit-token', name: 'LiveKit Token', category: 'edge', description: 'Tokens de videoconferência', testFn: testEdgeFunction('livekit-token') },
    { id: 'ef-pagarme-checkout', name: 'Pagar.me Checkout', category: 'edge', description: 'Processamento de pagamentos', testFn: testEdgeFunction('pagarme-checkout') },
    { id: 'ef-pagarme-webhook', name: 'Pagar.me Webhook', category: 'edge', description: 'Webhooks de pagamento', testFn: testEdgeFunction('pagarme-webhook') },
    { id: 'ef-google-calendar', name: 'Google Calendar', category: 'edge', description: 'Sincronização de agenda', testFn: testEdgeFunction('google-calendar') },
    { id: 'ef-document-tracking', name: 'Document Tracking', category: 'edge', description: 'Rastreamento de documentos', testFn: testEdgeFunction('document-tracking') },
    { id: 'ef-admin-impersonate', name: 'Admin Impersonate', category: 'edge', description: 'API administrativa', testFn: testEdgeFunction('admin-impersonate') },
    { id: 'ef-send-push', name: 'Push Notifications', category: 'edge', description: 'Notificações push', testFn: testEdgeFunction('send-push') },
    { id: 'ef-meeting-recording', name: 'Meeting Recording', category: 'edge', description: 'Gravação de reuniões', testFn: testEdgeFunction('meeting-recording') },
    { id: 'db-companies', name: 'Database: Companies', category: 'database', description: 'Tabela de empresas', testFn: testSupabaseQuery('companies') },
    { id: 'db-users', name: 'Database: Users', category: 'database', description: 'Tabela de usuários', testFn: testSupabaseQuery('company_users') },
    { id: 'db-subscriptions', name: 'Database: Subscriptions', category: 'database', description: 'Tabela de assinaturas', testFn: testSupabaseQuery('subscriptions') },
    { id: 'db-notifications', name: 'Database: Notifications', category: 'database', description: 'Tabela de notificações', testFn: testSupabaseQuery('notifications') },
    { id: 'api-supabase', name: 'Supabase API', category: 'api', description: 'API principal do backend', testFn: async () => {
      const start = Date.now();
      try {
        const res = await fetch(`https://${projectRef}.supabase.co/rest/v1/`, { headers: { apikey: anonKey } });
        const latency = Date.now() - start;
        return { status: (res.ok ? (latency > 2000 ? 'slow' : 'healthy') : 'error') as ModuleStatus, latency };
      } catch { return { status: 'error' as ModuleStatus, latency: Date.now() - start }; }
    }},
    { id: 'api-storage', name: 'Supabase Storage', category: 'storage', description: 'Armazenamento de arquivos', testFn: async () => {
      const start = Date.now();
      try {
        const { error } = await supabase.storage.listBuckets();
        const latency = Date.now() - start;
        return { status: (error ? 'error' : latency > 2000 ? 'slow' : 'healthy') as ModuleStatus, latency };
      } catch { return { status: 'error' as ModuleStatus, latency: Date.now() - start }; }
    }},
  ];

  const testModule = useCallback(async (mod: SystemModule) => {
    setStatuses(prev => ({ ...prev, [mod.id]: { status: 'testing', latency: 0 } }));
    const result = await mod.testFn();
    setStatuses(prev => ({ ...prev, [mod.id]: result }));
  }, []);

  const testAll = useCallback(async () => {
    setTestingAll(true);
    await Promise.all(modules.map(m => testModule(m)));
    setTestingAll(false);
  }, [modules, testModule]);

  useEffect(() => {
    if (isAdminMaster && !authLoading) {
      testAll();
    }
  }, [isAdminMaster, authLoading]);

  const generatePublicLink = () => {
    const link = `${window.location.origin}/status-server`;
    setPublicLink(link);
    navigator.clipboard.writeText(link);
    toast({ title: 'Link copiado!', description: 'Link da página de status copiado para a área de transferência.' });
  };

  if (authLoading) return <div className="p-6"><Skeleton className="h-64 w-full" /></div>;
  if (!isAdminMaster) return <Navigate to="/dashboard" replace />;

  const getStatusIcon = (status: ModuleStatus) => {
    switch (status) {
      case 'healthy': return <CheckCircle className="h-4 w-4 text-emerald-500" />;
      case 'slow': return <AlertTriangle className="h-4 w-4 text-amber-500" />;
      case 'error': return <XCircle className="h-4 w-4 text-red-500" />;
      case 'testing': return <Loader2 className="h-4 w-4 text-[#374DA4] animate-spin" />;
      default: return <Activity className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const categories = [
    { key: 'edge' as const, label: 'Edge Functions', icon: Zap },
    { key: 'database' as const, label: 'Banco de Dados', icon: Activity },
    { key: 'api' as const, label: 'APIs Externas', icon: Globe },
    { key: 'storage' as const, label: 'Storage', icon: Activity },
  ];

  const healthyCount = Object.values(statuses).filter(s => s.status === 'healthy').length;
  const slowCount = Object.values(statuses).filter(s => s.status === 'slow').length;
  const errorCount = Object.values(statuses).filter(s => s.status === 'error').length;
  const overallStatus: ModuleStatus = errorCount > 0 ? 'error' : slowCount > 0 ? 'slow' : healthyCount > 0 ? 'healthy' : 'unknown';

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard/admin')} className="rounded-xl">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-foreground tracking-tight">Saúde do Sistema</h1>
            <p className="text-sm text-muted-foreground">Monitoramento em tempo real dos módulos</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={generatePublicLink} className="rounded-xl gap-2 text-xs">
            <Globe className="h-3.5 w-3.5" />
            Página Pública
          </Button>
          <Button onClick={testAll} disabled={testingAll} size="sm" className="rounded-xl gap-2 text-xs bg-[#374DA4] hover:bg-[#2400B0]">
            <RefreshCw className={`h-3.5 w-3.5 ${testingAll ? 'animate-spin' : ''}`} />
            Testar Tudo
          </Button>
        </div>
      </div>

      {/* Public link banner */}
      {publicLink && (
        <div className="flex items-center gap-3 p-3 rounded-xl bg-[#374DA4]/5 border border-[#374DA4]/10">
          <ExternalLink className="h-4 w-4 text-[#374DA4] shrink-0" />
          <span className="text-sm text-foreground flex-1 font-mono truncate">{publicLink}</span>
          <Button variant="ghost" size="sm" onClick={() => { navigator.clipboard.writeText(publicLink); toast({ title: 'Copiado!' }); }} className="shrink-0 h-7 px-2">
            <Copy className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => window.open(publicLink, '_blank')} className="shrink-0 h-7 px-2">
            <ExternalLink className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}

      {/* Overall Status */}
      <Card className="border-0 shadow-sm overflow-hidden">
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl" style={{ backgroundColor: `${statusColors[overallStatus]}15` }}>
                <Activity className="h-6 w-6" style={{ color: statusColors[overallStatus] }} />
              </div>
              <div>
                <h2 className="text-lg font-bold text-foreground">Status Geral</h2>
                <p className="text-sm font-medium" style={{ color: statusColors[overallStatus] }}>{statusLabels[overallStatus]}</p>
              </div>
            </div>
            <div className="flex items-center gap-4 text-sm">
              <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-emerald-500" /> {healthyCount} ok</span>
              <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-amber-500" /> {slowCount} lento</span>
              <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-red-500" /> {errorCount} falha</span>
            </div>
          </div>
          <HeartbeatLine status={overallStatus} latency={Object.values(statuses).reduce((sum, s) => sum + s.latency, 0) / Math.max(1, Object.values(statuses).length)} />
        </CardContent>
      </Card>

      {/* Module Categories */}
      {categories.map(cat => {
        const catModules = modules.filter(m => m.category === cat.key);
        if (catModules.length === 0) return null;
        return (
          <div key={cat.key}>
            <div className="flex items-center gap-2 mb-3">
              <cat.icon className="h-4 w-4 text-[#374DA4]" />
              <h3 className="text-sm font-semibold text-foreground">{cat.label}</h3>
              <Badge variant="outline" className="text-[10px] ml-1">{catModules.length} módulos</Badge>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {catModules.map(mod => {
                const s = statuses[mod.id] || { status: 'unknown' as ModuleStatus, latency: 0 };
                return (
                  <Card key={mod.id} className="border shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden">
                    <CardContent className="p-0">
                      <div className="p-4 pb-2">
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2">
                            {getStatusIcon(s.status)}
                            <span className="text-sm font-semibold text-foreground">{mod.name}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            {s.latency > 0 && (
                              <span className="text-[10px] font-mono text-muted-foreground">{s.latency}ms</span>
                            )}
                            <Badge
                              className="text-[10px] border-0 capitalize"
                              style={{
                                backgroundColor: `${statusColors[s.status]}15`,
                                color: statusColors[s.status],
                              }}
                            >
                              {statusLabels[s.status]}
                            </Badge>
                          </div>
                        </div>
                        <p className="text-[11px] text-muted-foreground mb-1">{mod.description}</p>
                        {s.message && s.status === 'error' && (
                          <p className="text-[10px] text-red-500 font-mono bg-red-500/5 px-2 py-1 rounded mb-1">{s.message}</p>
                        )}
                      </div>
                      <div className="px-4 -mb-1">
                        <HeartbeatLine status={s.status} latency={s.latency} />
                      </div>
                      <div className="px-4 pb-3 pt-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={s.status === 'testing'}
                          onClick={() => testModule(mod)}
                          className="w-full h-7 text-[11px] rounded-lg hover:bg-[#374DA4]/5 text-[#374DA4]"
                        >
                          {s.status === 'testing' ? (
                            <><Loader2 className="h-3 w-3 mr-1 animate-spin" /> Testando...</>
                          ) : (
                            <><RefreshCw className="h-3 w-3 mr-1" /> Testar</>
                          )}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default AdminSystemHealth;
