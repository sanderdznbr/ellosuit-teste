import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format, subDays } from 'date-fns';

export interface ActivityItem {
  date: string;
  type: string; // e.g. 'whatsapp', 'email', 'event', 'document', 'client', 'tracking'
  label: string;
}

export interface DailyData {
  date: string;
  count: number;
  items: ActivityItem[];
}

type HubType = 'omni' | 'flow' | 'track' | 'suite';

async function fetchHubActivity(hub: HubType, companyId: string): Promise<DailyData[]> {
  const since = subDays(new Date(), 30).toISOString();
  const items: ActivityItem[] = [];

  try {
    if (hub === 'omni') {
      const [convos, emails] = await Promise.all([
        supabase.from('whatsapp_conversations').select('created_at, contact_name, contact_phone').eq('company_id', companyId).gte('created_at', since),
        supabase.from('emails').select('sent_at, subject, recipient_email').gte('sent_at', since),
      ]);
      for (const r of convos.data || []) {
        items.push({ date: r.created_at, type: 'whatsapp', label: `WhatsApp: ${r.contact_name || r.contact_phone || 'Conversa'}` });
      }
      for (const r of emails.data || []) {
        items.push({ date: r.sent_at, type: 'email', label: `Email: ${r.subject || r.recipient_email || 'Enviado'}` });
      }
    }

    if (hub === 'flow') {
      const { data } = await supabase
        .from('calendar_events')
        .select('created_at, title, event_type')
        .eq('company_id', companyId)
        .gte('created_at', since);
      for (const r of data || []) {
        const typeLabel = r.event_type === 'meeting' ? 'Reunião' : r.event_type === 'appointment' ? 'Compromisso' : 'Evento';
        items.push({ date: r.created_at, type: 'event', label: `${typeLabel}: ${r.title || 'Sem título'}` });
      }
    }

    if (hub === 'track') {
      const { data } = await supabase
        .from('document_tracking_events')
        .select('timestamp, event_type, document_id')
        .gte('timestamp', since)
        .limit(500);
      for (const r of data || []) {
        const evLabel = r.event_type === 'open' ? 'Abertura' : r.event_type === 'view' ? 'Visualização' : r.event_type;
        items.push({ date: r.timestamp, type: 'tracking', label: `Rastreamento: ${evLabel}` });
      }
    }

    if (hub === 'suite') {
      const [clients, docs] = await Promise.all([
        supabase.from('clients').select('created_at, name').eq('company_id', companyId).gte('created_at', since),
        supabase.from('documents').select('created_at, name').eq('company_id', companyId).gte('created_at', since),
      ]);
      for (const r of clients.data || []) {
        items.push({ date: r.created_at, type: 'client', label: `Contato: ${r.name || 'Novo'}` });
      }
      for (const r of docs.data || []) {
        items.push({ date: r.created_at, type: 'document', label: `Documento: ${r.name || 'Novo'}` });
      }
    }
  } catch (e) {
    console.error(`[useHubActivity] Error fetching ${hub}:`, e);
  }

  return groupByDate(items);
}

function groupByDate(items: ActivityItem[]): DailyData[] {
  const map: Record<string, ActivityItem[]> = {};
  for (const item of items) {
    const key = format(new Date(item.date), 'yyyy-MM-dd');
    if (!map[key]) map[key] = [];
    map[key].push(item);
  }
  return Object.entries(map).map(([date, dayItems]) => ({
    date,
    count: dayItems.length,
    items: dayItems,
  }));
}

export function useHubActivity(hub: HubType, companyId: string | null) {
  return useQuery({
    queryKey: ['hub-activity', hub, companyId],
    queryFn: () => fetchHubActivity(hub, companyId!),
    enabled: !!companyId,
    staleTime: 5 * 60 * 1000,
  });
}
