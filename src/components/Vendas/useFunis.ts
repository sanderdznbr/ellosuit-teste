import { useCallback, useEffect, useState, type Dispatch, type SetStateAction } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import {
  loadCrmColumns,
  loadFunnel,
  newFunnel,
  PipelineColumn,
  saveCrmColumns,
  saveFunnel,
  SalesFunnel,
} from './types';

/* ─── Funil (registro único, v2) ─────────────────────────────── */

export function useFunnel() {
  const [funnel, setFunnel] = useState<SalesFunnel | null>(() => loadFunnel());

  const update = useCallback((patch: Partial<SalesFunnel>) => {
    setFunnel((prev) => {
      if (!prev) return prev;
      const next = { ...prev, ...patch, updatedAt: new Date().toISOString() };
      saveFunnel(next);
      return next;
    });
  }, []);

  const create = useCallback((name: string) => {
    const created = newFunnel(name);
    saveFunnel(created);
    setFunnel(created);
    return created;
  }, []);

  return { funnel, update, create };
}

/* ─── Etapas = colunas do kanban do CRM (compartilhadas) ─────── */

export function usePipelineColumns() {
  const [columns, setColumns] = useState<PipelineColumn[]>(() => loadCrmColumns());

  const save = useCallback((next: PipelineColumn[]) => {
    if (!next.length) return;
    setColumns(next);
    saveCrmColumns(next);
  }, []);

  useEffect(() => {
    const reload = () => setColumns(loadCrmColumns());
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'whatsapp_kanban_columns') reload();
    };
    window.addEventListener('storage', onStorage);
    window.addEventListener('ello-pipeline-changed', reload);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('ello-pipeline-changed', reload);
    };
  }, []);

  return { columns, save };
}

/* ─── Empresa + canais WhatsApp ──────────────────────────────── */

export function useCompany() {
  const { user } = useAuth();
  const [companyId, setCompanyId] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.id) return;
    const metaCompany: string | null =
      (user.user_metadata as { company_id?: string } | undefined)?.company_id ?? null;
    if (metaCompany) {
      setCompanyId(metaCompany);
      return;
    }
    let cancelled = false;
    supabase
      .from('company_users')
      .select('company_id')
      .eq('user_id', user.id)
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled) setCompanyId(data?.company_id ?? null);
      });
    return () => {
      cancelled = true;
    };
  }, [user?.id, user?.user_metadata]);

  return companyId;
}

export interface CrmSession {
  id: string;
  phone_number: string | null;
  status: string | null;
}

export function useCrmSessions(companyId: string | null) {
  const [sessions, setSessions] = useState<CrmSession[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(() => {
    if (!companyId) return;
    setLoading(true);
    supabase
      .from('whatsapp_sessions')
      .select('id, phone_number, status')
      .eq('company_id', companyId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setLoading(false);
        setSessions((data as CrmSession[]) || []);
      });
  }, [companyId]);

  useEffect(refresh, [refresh]);

  const connected = sessions.filter((s) => s.status === 'connected');
  return { sessions, connected, loading, refresh };
}

/* ─── Membros da empresa (atribuição de responsável) ──────────── */

export interface TeamMember {
  userId: string;
  name: string;
  email: string | null;
  avatarUrl: string | null;
  role: string | null;
}

export function useTeamMembers(companyId: string | null) {
  const [members, setMembers] = useState<TeamMember[]>([]);

  const refresh = useCallback(() => {
    if (!companyId) return;
    supabase
      .from('company_users')
      .select('user_id, role, profiles:user_id (full_name, avatar_url, email)')
      .eq('company_id', companyId)
      .order('created_at', { ascending: true })
      .then(({ data }) => {
        const rows = (data || []) as unknown as {
          user_id: string;
          role: string | null;
          profiles: { full_name?: string | null; avatar_url?: string | null; email?: string | null } | null;
        }[];
        setMembers(
          rows.map((r) => ({
            userId: r.user_id,
            name:
              r.profiles?.full_name ||
              r.profiles?.email ||
              r.user_id.slice(0, 8),
            email: r.profiles?.email ?? null,
            avatarUrl: r.profiles?.avatar_url ?? null,
            role: r.role,
          })),
        );
      });
  }, [companyId]);

  useEffect(refresh, [refresh]);

  return { members, refresh };
}

/* ─── Leads / conversas do CRM ───────────────────────────────── */

export interface CrmLead {
  id: string;
  contact_name: string | null;
  contact_phone: string;
  pipeline_stage: string | null;
  last_message: string | null;
  last_message_at: string | null;
  status: string;
  unread_count?: number | null;
  session_id?: string | null;
  assigned_user_id?: string | null;
  human_takeover?: boolean | null;
  ai_auto_reply_enabled?: boolean | null;
  temperature_stage?: string | null;
}

export function useCrmLeads(opts: {
  companyId: string | null;
  sessionId: string; // 'ALL' ou id do canal
  periodDays: number; // 0 = tudo
}) {
  const { companyId, sessionId, periodDays } = opts;
  const [rows, setRows] = useState<CrmLead[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const refresh = useCallback(() => setRefreshKey((k) => k + 1), []);

  useEffect(() => {
    if (!companyId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);

    let query = supabase
      .from('whatsapp_conversations')
      .select(
        'id, contact_name, contact_phone, pipeline_stage, last_message, last_message_at, status, unread_count, session_id, assigned_user_id, human_takeover, ai_auto_reply_enabled, temperature_stage',
      )
      .eq('company_id', companyId);
    if (sessionId !== 'ALL') query = query.eq('session_id', sessionId);
    if (periodDays > 0) {
      query = query.gte('last_message_at', new Date(Date.now() - periodDays * 86400000).toISOString());
    }

    query
      .order('last_message_at', { ascending: false })
      .limit(800)
      .then(({ data, error: err }) => {
        if (cancelled) return;
        setLoading(false);
        if (err) {
          setError(err.message);
          setRows([]);
          return;
        }
        setRows((data as CrmLead[]) || []);
      });

    return () => {
      cancelled = true;
    };
  }, [companyId, sessionId, periodDays, refreshKey]);

  return { rows, setRows, loading, error, refresh };
}

/* ─── Derivados por etapa ────────────────────────────────────── */

export function groupByStage(rows: CrmLead[]): Record<string, CrmLead[]> {
  const map: Record<string, CrmLead[]> = {};
  rows.forEach((r) => {
    const key = r.pipeline_stage || '__none__';
    (map[key] ||= []).push(r);
  });
  return map;
}

/** Leads sem atividade há mais de 7 dias ("frios"). */
export function friosByStage(rows: CrmLead[]): Record<string, number> {
  const map: Record<string, number> = {};
  const limit = Date.now() - 7 * 86400000;
  rows.forEach((r) => {
    if (!r.last_message_at || new Date(r.last_message_at).getTime() >= limit) return;
    const key = r.pipeline_stage || '__none__';
    map[key] = (map[key] || 0) + 1;
  });
  return map;
}

/* ─── Ações ──────────────────────────────────────────────────── */

/** Move lead de etapa (otimista + persiste no Supabase + log de evento). */
export function useStageUpdater(companyId: string | null) {
  const { user } = useAuth();
  const [saving, setSaving] = useState(false);

  const updateStage = useCallback(
    async (
      rows: CrmLead[],
      setRows: Dispatch<SetStateAction<CrmLead[]>>,
      conversationId: string,
      newStage: string,
      reason?: string,
    ): Promise<void> => {
      const prev = rows.find((c) => c.id === conversationId)?.pipeline_stage;
      setRows((prevRows) =>
        prevRows.map((c) => (c.id === conversationId ? { ...c, pipeline_stage: newStage } : c)),
      );
      setSaving(true);
      try {
        const { error } = await supabase
          .from('whatsapp_conversations')
          .update({ pipeline_stage: newStage })
          .eq('id', conversationId);
        if (error) throw error;
        if (companyId) {
          const actorName =
            (user?.user_metadata as { full_name?: string } | undefined)?.full_name ||
            user?.email ||
            'Operador';
          supabase.from('conversation_events').insert([
            {
              conversation_id: conversationId,
              company_id: companyId,
              event_type: 'stage_change',
              actor_type: 'user',
              actor_id: user?.id ?? null,
              actor_name: actorName,
              reason: reason ?? null,
              metadata: { from: prev ?? null, to: newStage, source: 'funil' },
            },
          ]);
        }
      } catch (err) {
        setRows((prevRows) =>
          prevRows.map((c) =>
            c.id === conversationId ? { ...c, pipeline_stage: prev } : c,
          ),
        );
        console.error(
          '[funil] updateStage failed',
          err instanceof Error ? err.message : String(err),
        );
      } finally {
        setSaving(false);
      }
    },
    [companyId, user],
  );

  return { updateStage, saving };
}

/** Cria um lead manualmente na etapa (rota do cliente, funciona sem deploy). */
export async function createLeadManually(opts: {
  companyId: string;
  sessionId: string | null;
  stageId: string;
  name: string;
  phone: string;
  source?: string;
}): Promise<{ ok: boolean; error?: string; id?: string }> {
  const digits = opts.phone.replace(/\D/g, '');
  if (digits.length < 8) return { ok: false, error: 'Telefone inválido' };
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from('whatsapp_conversations')
    .insert({
      company_id: opts.companyId,
      session_id: opts.sessionId,
      contact_phone: digits,
      contact_name: opts.name.trim().slice(0, 200) || null,
      pipeline_stage: opts.stageId,
      last_message: `Lead capturado via ${opts.source || 'manual'}`,
      last_message_at: now,
      status: 'open',
      unread_count: 0,
    })
    .select('id')
    .single();
  if (error) return { ok: false, error: error.message };
  return { ok: true, id: data?.id };
}

/** Primeira chave de API ativa da empresa (para exibir no webhook). */
export async function fetchCompanyApiKey(companyId: string): Promise<string | null> {
  const { data } = await supabase
    .from('whatsapp_api_keys')
    .select('api_key')
    .eq('company_id', companyId)
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  return data?.api_key ?? null;
}


