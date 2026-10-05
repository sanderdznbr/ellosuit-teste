import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  try {
    const { data: sessions, error } = await supabase
      .from('whatsapp_sessions')
      .select('company_id')
      .eq('status', 'connected')
      .is('deleted_at', null);

    if (error) throw error;

    const companyIds = Array.from(new Set((sessions || []).map(s => s.company_id).filter(Boolean)));
    console.log(`[CRON-SYNC] Found ${companyIds.length} companies with connected sessions`);

    const results: any[] = [];

    for (const companyId of companyIds) {
      try {
        const { data, error: e } = await supabase.functions.invoke('whatsapp-sync-profile-pictures', {
          body: { company_id: companyId, limit: 150, force: false }
        });
        if (e) {
          console.warn(`[CRON-SYNC] ${companyId} failed:`, e.message);
          results.push({ company_id: companyId, ok: false, error: e.message });
        } else {
          results.push({ company_id: companyId, ok: true, ...(data || {}) });
        }
      } catch (err) {
        console.warn(`[CRON-SYNC] ${companyId} exception:`, (err as Error).message);
        results.push({ company_id: companyId, ok: false, error: (err as Error).message });
      }
    }

    return new Response(JSON.stringify({
      success: true,
      processed_companies: companyIds.length,
      results,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (err) {
    console.error('[CRON-SYNC] Error:', err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
