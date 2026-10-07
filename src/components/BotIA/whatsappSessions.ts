import { supabase } from '@/integrations/supabase/client';

export interface WhatsAppSessionOption {
  id: string;
  /** Texto do seletor: número (ou instância) + situação da conexão. */
  label: string;
  status: string | null;
  connected: boolean;
}

/**
 * Números de WhatsApp da empresa, com os conectados primeiro.
 *
 * É esse vínculo que liga o agente ao número: o webhook só entrega as mensagens
 * ao agente quando `whatsapp_enabled` está ligado E `whatsapp_session_id` aponta
 * para o número certo. Sem o número escolhido o agente fica mudo.
 */
export async function fetchCompanyWhatsAppSessions(
  companyId: string | null | undefined,
): Promise<WhatsAppSessionOption[]> {
  if (!companyId) return [];

  const { data } = await supabase
    .from('whatsapp_sessions')
    .select('id, instance_name, status, phone_number')
    .eq('company_id', companyId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  const rows = (data || []) as {
    id: string;
    instance_name: string | null;
    status: string | null;
    phone_number: string | null;
  }[];

  return rows
    .map((s) => {
      const connected = s.status === 'connected';
      const who = s.phone_number || s.instance_name || s.id.slice(0, 8);
      return {
        id: s.id,
        label: `${who}${connected ? ' · conectado' : s.status ? ` · ${s.status}` : ''}`,
        status: s.status,
        connected,
      };
    })
    .sort((a, b) => Number(b.connected) - Number(a.connected));
}

/**
 * Pré-seleção do número: mantém o que já estava escolhido e, quando existe um
 * único número conectado, é ele — não faz sentido obrigar a escolher.
 */
export function pickDefaultSessionId(
  list: WhatsAppSessionOption[],
  current?: string,
): string {
  if (current && list.some((s) => s.id === current)) return current;
  const connected = list.filter((s) => s.connected);
  return connected.length === 1 ? connected[0].id : '';
}
