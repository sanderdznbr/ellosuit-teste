import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const MAX_FAILURES_BEFORE_DISCONNECT = 8; // ~40min @ 5min cron: only flip after sustained failure
const AUTO_RECONNECT_WINDOW_MS = 24 * 60 * 60 * 1000;
const PING_TIMEOUT_MS = 20000; // Evolution can be slow when socket is idle
const PROOF_OF_LIFE_WINDOW_MS = 6 * 60 * 60 * 1000; // 6h: idle chats are still "connected"

function normalizeEvolutionBaseUrl(value: string | undefined): string {
  const trimmed = (value || '').trim().replace(/\/+$/, '');
  if (!trimmed) return '';
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

const EVOLUTION_API_URL = normalizeEvolutionBaseUrl(Deno.env.get('EVOLUTION_API_URL'));
const EVOLUTION_API_KEY = Deno.env.get('EVOLUTION_API_KEY');

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;

    // ====== PHASE 1: Check sessions marked as "connected" ======
    const { data: connectedSessions, error } = await supabase
      .from('whatsapp_sessions')
      .select('id, instance_name, phone_number, company_id, updated_at, last_seen_at, session_data, webhook_secret')
      .eq('status', 'connected');

    if (error) throw error;

    const results: { session_id: string; instance: string; action: string; detail?: string }[] = [];

    // Check each connected session
    for (const session of (connectedSessions || [])) {
      if (!EVOLUTION_API_URL || !session.instance_name) {
        results.push({ session_id: session.id, instance: session.instance_name || 'unknown', action: 'skipped', detail: 'missing_env' });
        continue;
      }

      const pingResult = await pingEvolution(EVOLUTION_API_URL, session.instance_name, EVOLUTION_API_KEY || '');
      // pingResult: true = open/connected, false = explicitly closed/logout, null = network error / unknown
      const isAlive = pingResult === true;
      const isDefinitelyClosed = pingResult === false;

      // Proof-of-life override: if a webhook message was received recently,
      // treat the session as alive even if Evolution /status ping fails.
      const lastSeenMs = session.last_seen_at ? new Date(session.last_seen_at).getTime() : 0;
      let recentlyActive = lastSeenMs && (Date.now() - lastSeenMs) < PROOF_OF_LIFE_WINDOW_MS;

      // Fallback: check whatsapp_messages directly for recent activity
      if (!isAlive && !recentlyActive) {
        const since = new Date(Date.now() - PROOF_OF_LIFE_WINDOW_MS).toISOString();
        const { data: convIds } = await supabase
          .from('whatsapp_conversations')
          .select('id')
          .eq('session_id', session.id)
          .limit(500);
        const ids = (convIds || []).map((c: any) => c.id);
        if (ids.length > 0) {
          const { data: recentMsg } = await supabase
            .from('whatsapp_messages')
            .select('id')
            .in('conversation_id', ids)
            .gte('created_at', since)
            .limit(1);
          if (recentMsg && recentMsg.length > 0) recentlyActive = true;
        }
      }

      if (isAlive || recentlyActive || pingResult === null) {
        // Session is healthy - reset failure count and update last_seen
        const sessionData = (session.session_data || {}) as Record<string, unknown>;
        sessionData.consecutive_failures = 0;
        sessionData.last_healthy_at = new Date().toISOString();
        if (!isAlive && recentlyActive) {
          sessionData.kept_alive_by = 'recent_webhook_activity';
        }
        if (pingResult === null && !recentlyActive) {
          sessionData.kept_alive_by = 'ping_inconclusive';
        }

        await supabase
          .from('whatsapp_sessions')
          .update({ 
            ...(isAlive ? { last_seen_at: new Date().toISOString() } : {}),
            session_data: sessionData
          })
          .eq('id', session.id);

        results.push({ session_id: session.id, instance: session.instance_name, action: isAlive ? 'alive' : (recentlyActive ? 'alive_via_webhook' : 'alive_inconclusive') });
      } else {
        // Only reach here when ping was DEFINITIVELY closed AND no recent webhook activity
        const sessionData = (session.session_data || {}) as Record<string, unknown>;
        const failures = ((sessionData.consecutive_failures as number) || 0) + 1;
        sessionData.consecutive_failures = failures;
        sessionData.last_failure_at = new Date().toISOString();
        sessionData.last_failure_reason = isDefinitelyClosed ? 'evolution_state_closed' : 'unknown';

        if (failures >= MAX_FAILURES_BEFORE_DISCONNECT) {
          // Too many failures - mark as disconnected
          console.log(`[HEALTH-CHECK] Session ${session.id} (${session.instance_name}) DEAD after ${failures} consecutive failures. Marking disconnected.`);
          
          sessionData.disconnected_by = 'health_check';
          sessionData.disconnected_at = new Date().toISOString();
          
          await supabase
            .from('whatsapp_sessions')
            .update({ 
              status: 'disconnected', 
              session_data: sessionData
            })
            .eq('id', session.id);

          results.push({ session_id: session.id, instance: session.instance_name, action: 'disconnected', detail: `${failures} failures` });
        } else {
          // Grace period - keep as connected but track failure
          console.log(`[HEALTH-CHECK] Session ${session.id} (${session.instance_name}) failed ping (${failures}/${MAX_FAILURES_BEFORE_DISCONNECT}). Grace period.`);
          
          await supabase
            .from('whatsapp_sessions')
            .update({ session_data: sessionData })
            .eq('id', session.id);

          results.push({ session_id: session.id, instance: session.instance_name, action: 'grace_period', detail: `failure ${failures}/${MAX_FAILURES_BEFORE_DISCONNECT}` });
        }
      }
    }

    // ====== PHASE 2: Auto-reconnect recently disconnected sessions ======
    // IMPORTANT: We do NOT call POST /instance/create here anymore.
    // Recreating an existing Evolution instance wipes its Baileys credentials
    // and forces the phone off, causing an endless disconnect loop.
    // We only ping — if the instance is actually alive on Evolution, we
    // restore the "connected" status. Real reconnection is user-initiated
    // via the "Reconectar canal" button in the CRM UI.
    const cutoffTime = new Date(Date.now() - AUTO_RECONNECT_WINDOW_MS).toISOString();

    const { data: disconnectedSessions } = await supabase
      .from('whatsapp_sessions')
      .select('id, instance_name, phone_number, company_id, session_data')
      .eq('status', 'disconnected')
      .not('phone_number', 'is', null)
      .gte('updated_at', cutoffTime);

    for (const session of (disconnectedSessions || [])) {
      if (!EVOLUTION_API_URL) continue;
      if (!session.instance_name) continue;

      const sessionData = (session.session_data || {}) as Record<string, unknown>;
      const isAlive = await pingEvolution(EVOLUTION_API_URL, session.instance_name, EVOLUTION_API_KEY || '');

      if (isAlive === true) {
        sessionData.consecutive_failures = 0;
        sessionData.reconnected_by = 'health_check_discovery';
        sessionData.reconnected_at = new Date().toISOString();

        await supabase
          .from('whatsapp_sessions')
          .update({
            status: 'connected',
            last_seen_at: new Date().toISOString(),
            session_data: sessionData,
          })
          .eq('id', session.id);

        results.push({ session_id: session.id, instance: session.instance_name, action: 'reconnected_discovered' });
      } else {
        // Do NOT call /instance/create — it would wipe Baileys credentials
        // and force the phone off. User must click "Reconectar canal".
        results.push({ session_id: session.id, instance: session.instance_name, action: 'reconnect_skipped_manual_required' });
      }
    }

    // ====== PHASE 3: Clean up zombie sessions (connecting for > 30 min) ======
    const { data: zombieSessions } = await supabase
      .from('whatsapp_sessions')
      .select('id, instance_name')
      .in('status', ['connecting', 'waiting_qr'])
      .lt('updated_at', new Date(Date.now() - 30 * 60 * 1000).toISOString());

    for (const zombie of (zombieSessions || [])) {
      await supabase
        .from('whatsapp_sessions')
        .update({ status: 'disconnected' })
        .eq('id', zombie.id);
      
      results.push({ session_id: zombie.id, instance: zombie.instance_name, action: 'zombie_cleaned' });
    }

    const summary = {
      checked_connected: connectedSessions?.length || 0,
      checked_disconnected: disconnectedSessions?.length || 0,
      zombies_cleaned: zombieSessions?.length || 0,
      actions: results
    };

    console.log(`[HEALTH-CHECK] Summary:`, JSON.stringify(summary));

    return new Response(JSON.stringify(summary), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('[HEALTH-CHECK] Error:', err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

/**
 * Ping Evolution API to check if instance is alive
 */
async function pingEvolution(apiUrl: string, instanceName: string, apiKey: string): Promise<boolean | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), PING_TIMEOUT_MS);

    const instanceKey = encodeURIComponent(instanceName);
    const res = await fetch(`${apiUrl}/instance/connectionState/${instanceKey}`, {
      method: 'GET',
      headers: { 
        'Content-Type': 'application/json',
        'apikey': apiKey
      },
      signal: controller.signal,
    });
    clearTimeout(timeout);

    // 5xx or timeout-ish HTTP → inconclusive
    if (res.status >= 500) return null;
    if (!res.ok) return false;

    const text = await res.text();
    let data: any = {};
    try { data = JSON.parse(text); } catch { return null; }

    // Evolution v2 returns { instance: { state: "open" } }
    // or direct { state: "open" }
    const state = data?.instance?.state || data?.state || data?.connectionState || data?.status;
    if (state === 'open' || state === 'connected') return true;
    if (state === 'close' || state === 'closed' || state === 'disconnected' || state === 'logout' || state === 'logged_out') return false;
    // 'connecting', 'refused', unknown → inconclusive
    return null;
  } catch {
    // Network error / abort → inconclusive, do NOT count as failure
    return null;
  }
}
