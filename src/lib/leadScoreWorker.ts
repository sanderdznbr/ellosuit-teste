import { supabase } from '@/integrations/supabase/client';
import { computeSig, scoreConversation } from './leadScore';

// Background async worker: re-scores conversations whose lead_score_updated_at
// is missing or older than 12h. Runs completely off the CRM open path so it
// never blocks the UI. Small batches, spaced out, low concurrency (uses the
// scheduler in leadScore.ts).

const TTL_MS = 12 * 60 * 60 * 1000; // 12h
const SWEEP_INTERVAL_MS = 10 * 60 * 1000; // sweep every 10 min
const BATCH_SIZE = 15;
const PER_ITEM_DELAY_MS = 1500;

const activeWorkers = new Map<string, { stop: () => void }>();

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchStaleConversations(companyId: string) {
  const cutoff = new Date(Date.now() - TTL_MS).toISOString();
  const { data, error } = await supabase
    .from('whatsapp_conversations')
    .select('id, contact_name, last_message, last_message_at, lead_score_updated_at')
    .eq('company_id', companyId)
    .not('last_message_at', 'is', null)
    .or(`lead_score_updated_at.is.null,lead_score_updated_at.lt.${cutoff}`)
    .order('last_message_at', { ascending: false })
    .limit(BATCH_SIZE);
  if (error) return [];
  return data || [];
}

async function sweep(companyId: string, stopped: () => boolean) {
  try {
    const rows = await fetchStaleConversations(companyId);
    for (const row of rows) {
      if (stopped()) return;
      try {
        await scoreConversation({
          conversationId: row.id as string,
          contactName: (row.contact_name as string) || undefined,
          lastMessage: (row.last_message as string) || undefined,
          sig: computeSig(
            (row.last_message_at as string) || undefined,
            (row.last_message as string) || undefined,
          ),
        });
      } catch {
        // ignore individual failures; keep sweeping
      }
      await sleep(PER_ITEM_DELAY_MS);
    }
  } catch {
    // ignore
  }
}

export function startLeadScoreWorker(companyId: string) {
  if (!companyId) return () => {};
  const existing = activeWorkers.get(companyId);
  if (existing) return existing.stop;

  let stopped = false;
  const isStopped = () => stopped;

  // Initial sweep is delayed so it never competes with CRM initial load.
  const initialTimer = setTimeout(() => {
    if (!stopped) void sweep(companyId, isStopped);
  }, 20_000);

  const interval = setInterval(() => {
    if (stopped) return;
    if (document.visibilityState === 'hidden') return;
    void sweep(companyId, isStopped);
  }, SWEEP_INTERVAL_MS);

  const stop = () => {
    stopped = true;
    clearTimeout(initialTimer);
    clearInterval(interval);
    activeWorkers.delete(companyId);
  };
  activeWorkers.set(companyId, { stop });
  return stop;
}