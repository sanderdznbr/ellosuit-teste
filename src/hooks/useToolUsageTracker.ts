import { useEffect, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { isPathHidden } from '@/config/featureFlags';

export interface ToolInfo {
  path: string;
  title: string;
  hub: 'omni' | 'flow' | 'track' | 'meet' | 'suite';
}

export const TRACKED_TOOLS: ToolInfo[] = [
  { path: '/dashboard/omni', title: 'Omni', hub: 'omni' },
  { path: '/dashboard/flows', title: 'Flow', hub: 'flow' },
  { path: '/dashboard/track', title: 'Track', hub: 'track' },
  { path: '/dashboard/meet-hub', title: 'Meet', hub: 'meet' },
  { path: '/dashboard/suite', title: 'Suite', hub: 'suite' },
  { path: '/dashboard/crm-ello', title: 'CRM Ello', hub: 'omni' },
  { path: '/dashboard/crm-whatsapp', title: 'CRM WhatsApp', hub: 'omni' },
  { path: '/dashboard/bot-ia', title: 'Agentes IA', hub: 'omni' },
  { path: '/dashboard/chatbot', title: 'Chatbot', hub: 'omni' },
  { path: '/dashboard/email', title: 'E-mail Marketing', hub: 'omni' },
  { path: '/dashboard/email-templates', title: 'Templates de Email', hub: 'omni' },
  { path: '/dashboard/disparos', title: 'Disparos', hub: 'omni' },
  { path: '/dashboard/automacoes', title: 'Automações', hub: 'omni' },
  { path: '/dashboard/api-whatsapp', title: 'API WhatsApp', hub: 'omni' },
  { path: '/dashboard/agenda', title: 'Agenda', hub: 'flow' },
  { path: '/dashboard/agenda-aberta', title: 'Agenda Online', hub: 'flow' },
  { path: '/dashboard/tasks', title: 'Tarefas', hub: 'flow' },
  { path: '/dashboard/reunioes', title: 'Reuniões', hub: 'meet' },
  { path: '/dashboard/fluxos', title: 'Fluxos', hub: 'flow' },
  { path: '/dashboard/rastreamento', title: 'Rastreamento', hub: 'track' },
  { path: '/dashboard/encurtador', title: 'Encurtador', hub: 'track' },
  { path: '/dashboard/email-tracker', title: 'Rastrear Emails', hub: 'track' },
  { path: '/dashboard/leads', title: 'Captura de Leads', hub: 'track' },
  { path: '/dashboard/track/leads', title: 'Leads Tracking', hub: 'track' },
  { path: '/dashboard/cadastros', title: 'Cadastros', hub: 'suite' },
  { path: '/dashboard/drive', title: 'Arquivos', hub: 'suite' },
  { path: '/dashboard/habitos', title: 'Hábitos', hub: 'suite' },
  { path: '/dashboard/contratos', title: 'Contratos', hub: 'suite' },
  { path: '/dashboard/propostas', title: 'Ordem de Serviço', hub: 'suite' },
  { path: '/dashboard/recibos', title: 'Recibos', hub: 'suite' },
  { path: '/dashboard/analytics', title: 'Analytics', hub: 'suite' },
  { path: '/dashboard/apps', title: 'Templates prontos', hub: 'suite' },
  { path: '/dashboard/ello-vision', title: 'Ello Vision', hub: 'suite' },
];

const HUB_COLORS: Record<string, string> = {
  omni: '#FF4500',
  flow: '#4D7CFF',
  track: '#2ECC71',
  meet: '#101010',
  suite: '#374DA4',
};

const HUB_LABELS: Record<string, string> = {
  omni: 'Omni',
  flow: 'Flow',
  track: 'Track',
  meet: 'Meet',
  suite: 'Suite',
};

const STORAGE_KEY = 'ellosuit_tool_usage';

interface UsageData {
  [path: string]: number;
}

function getStorageKey(userId?: string) {
  return `${STORAGE_KEY}:${userId || 'anonymous'}`;
}

function getUsageData(userId?: string): UsageData {
  try {
    return JSON.parse(localStorage.getItem(getStorageKey(userId)) || '{}');
  } catch {
    return {};
  }
}

function incrementUsage(path: string, userId?: string) {
  const data = getUsageData(userId);
  data[path] = (data[path] || 0) + 1;
  localStorage.setItem(getStorageKey(userId), JSON.stringify(data));
}

function findTrackedTool(pathname: string) {
  return TRACKED_TOOLS
    .filter((tool) => pathname === tool.path || pathname.startsWith(`${tool.path}/`))
    .sort((a, b) => b.path.length - a.path.length)[0];
}

export interface TrackedTool extends ToolInfo {
  count: number;
  hubColor: string;
  hubLabel: string;
}

export function useToolUsageTracker() {
  const location = useLocation();
  const { user } = useAuth();
  const userId = user?.id;

  useEffect(() => {
    const tool = findTrackedTool(location.pathname);
    if (tool) {
      incrementUsage(tool.path, userId);
    }
  }, [location.pathname, userId]);

  const mostUsedTools = useMemo((): TrackedTool[] => {
    const data = getUsageData(userId);
    return TRACKED_TOOLS
      .filter(t => (data[t.path] || 0) > 0)
      .map(t => {
        // Try to find matching tool in mega menu groups to get its icon
        const iconKey = t.path.replace('/dashboard/', '');
        return { 
          ...t, 
          count: data[t.path] || 0, 
          hubColor: HUB_COLORS[t.hub], 
          hubLabel: HUB_LABELS[t.hub],
          iconKey
        };
      })
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);
  }, [location.pathname, userId]);

  const allTools = useMemo(() => TRACKED_TOOLS.filter(t => !isPathHidden(t.path)), []);
  return { mostUsedTools, allTools };
}
