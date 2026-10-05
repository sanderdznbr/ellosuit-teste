import { supabase } from '@/integrations/supabase/client';

export interface LeadScoreReason {
  label: string;
  impact: '+' | '-' | '=';
  weight: number;
  detail: string;
}

export interface LeadScoreData {
  score: number;
  tier: string;
  temperature: number;
  intent: string;
  suggested_stage: string;
  confidence: number;
  reasons: LeadScoreReason[];
  next_action: string;
  stage_reason: string;
  deal_value?: number | null;
  deal_currency?: string | null;
  deal_reason?: string | null;
}

interface CacheEntry {
  at: number;
  data: LeadScoreData;
}

// Persist score in DB and reuse for 12h regardless of new messages (avoids hammering AI on every open).
const TTL_MS = 12 * 60 * 60 * 1000; // 12h
const memCache = new Map<string, CacheEntry>();

export function getCachedLeadScore(conversationId: string, _sig?: string): LeadScoreData | null {
  const c = memCache.get(conversationId);
  if (!c) return null;
  if (Date.now() - c.at > TTL_MS) return null;
  return c.data;
}

function setMemCache(conversationId: string, data: LeadScoreData, at: number) {
  memCache.set(conversationId, { at, data });
}

async function loadFromDb(conversationId: string): Promise<{ data: LeadScoreData; at: number } | null> {
  try {
    const { data, error } = await supabase
      .from('whatsapp_conversations')
      .select('lead_score_data, lead_score_updated_at')
      .eq('id', conversationId)
      .maybeSingle();
    if (error || !data?.lead_score_data || !data?.lead_score_updated_at) return null;
    const at = new Date(data.lead_score_updated_at as string).getTime();
    if (Number.isNaN(at)) return null;
    return { data: data.lead_score_data as unknown as LeadScoreData, at };
  } catch {
    return null;
  }
}

async function persistToDb(conversationId: string, sig: string, data: LeadScoreData) {
  try {
    await supabase
      .from('whatsapp_conversations')
      .update({
        lead_score_data: data as any,
        lead_score_updated_at: new Date().toISOString(),
        lead_score_sig: sig,
      })
      .eq('id', conversationId);
  } catch {}
}

// Global concurrency-limited queue so scoring the visible list doesn't hammer the gateway.
const MAX_CONCURRENT = 2;
let running = 0;
const queue: Array<() => void> = [];
const inflight = new Map<string, Promise<LeadScoreData | null>>();

function schedule<T>(task: () => Promise<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    const run = async () => {
      running++;
      try {
        const res = await task();
        resolve(res);
      } catch (e) {
        reject(e);
      } finally {
        running--;
        const next = queue.shift();
        if (next) next();
      }
    };
    if (running < MAX_CONCURRENT) run();
    else queue.push(run);
  });
}

async function fetchRecentMessages(conversationId: string) {
  const { data, error } = await supabase
    .from('whatsapp_messages')
    .select('from_me, content, timestamp, media_url, media_type, media_caption')
    .eq('conversation_id', conversationId)
    .order('timestamp', { ascending: false })
    .limit(20);
  if (error || !data) return [] as Array<{ from_me: boolean; content: string; timestamp: string }>;
  return data.reverse().map((m: any) => ({
    from_me: !!m.from_me,
    content: m.content || '',
    timestamp: m.timestamp,
    media_url: m.media_url || null,
    media_type: m.media_type || null,
    media_caption: m.media_caption || null,
  }));
}

export async function scoreConversation(params: {
  conversationId: string;
  contactName?: string;
  lastMessage?: string;
  sig: string;
  force?: boolean;
}): Promise<LeadScoreData | null> {
  const { conversationId, contactName, lastMessage, sig, force } = params;
  if (!force) {
    const cached = getCachedLeadScore(conversationId, sig);
    if (cached) return cached;
    // Try DB cache (persisted across sessions/devices).
    const fromDb = await loadFromDb(conversationId);
    if (fromDb && Date.now() - fromDb.at < TTL_MS) {
      setMemCache(conversationId, fromDb.data, fromDb.at);
      return fromDb.data;
    }
  }
  const existing = inflight.get(conversationId);
  if (existing) return existing;

  const p = schedule(async () => {
    let messages = await fetchRecentMessages(conversationId);
    if (messages.length === 0 && lastMessage) {
      messages = [{ from_me: false, content: lastMessage, timestamp: new Date().toISOString() }];
    }
    if (messages.length === 0) return null;
    const { data, error } = await supabase.functions.invoke('crm-sales-ai', {
      body: { action: 'lead_score', messages, contactName },
    });
    if (error) throw error;
    const structured = data?.structured as LeadScoreData | undefined;
    if (!structured || typeof structured.score !== 'number') return null;
    const now = Date.now();
    setMemCache(conversationId, structured, now);
    void persistToDb(conversationId, sig, structured);
    return structured;
  }).finally(() => {
    inflight.delete(conversationId);
  });

  inflight.set(conversationId, p);
  return p;
}

export function tierStyle(tier: string) {
  const t = (tier || '').toLowerCase();
  if (t.includes('muito'))
    return {
      emoji: '🔥',
      label: 'Muito quente',
      bg: 'bg-rose-500/15',
      text: 'text-rose-600 dark:text-rose-400',
      ring: 'ring-rose-500/30',
      dot: 'bg-rose-500',
    };
  if (t.includes('quente'))
    return {
      emoji: '🔥',
      label: 'Quente',
      bg: 'bg-orange-500/15',
      text: 'text-orange-600 dark:text-orange-400',
      ring: 'ring-orange-500/30',
      dot: 'bg-orange-500',
    };
  if (t.includes('morno'))
    return {
      emoji: '🟡',
      label: 'Morno',
      bg: 'bg-amber-400/15',
      text: 'text-amber-600 dark:text-amber-400',
      ring: 'ring-amber-400/30',
      dot: 'bg-amber-400',
    };
  return {
    emoji: '🔵',
    label: 'Frio',
    bg: 'bg-sky-500/15',
    text: 'text-sky-600 dark:text-sky-400',
    ring: 'ring-sky-500/30',
    dot: 'bg-sky-500',
  };
}

export function computeSig(lastMessageAt?: string, lastMessage?: string) {
  const t = (lastMessageAt || '').slice(0, 19);
  const m = (lastMessage || '').slice(0, 40);
  return `${t}:${m}`;
}