import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const EVOLUTION_API_URL_RAW = (Deno.env.get('EVOLUTION_API_URL') || '').trim();
// Ensure protocol + no trailing slash. The stored secret occasionally omits the
// scheme (e.g. "evolution-api.host"), which makes `fetch` throw "Invalid URL".
const EVOLUTION_API_URL = EVOLUTION_API_URL_RAW
  ? (/^https?:\/\//i.test(EVOLUTION_API_URL_RAW)
      ? EVOLUTION_API_URL_RAW.replace(/\/+$/, '')
      : `https://${EVOLUTION_API_URL_RAW.replace(/\/+$/, '')}`)
  : '';
const EVOLUTION_API_KEY = Deno.env.get('EVOLUTION_API_KEY') || '';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const body = await req.json().catch(() => ({}));
    const companyId: string | undefined = body.company_id;
    const limit: number = Math.min(Number(body.limit) || 200, 500);
    const force: boolean = !!body.force;

    if (!companyId) {
      return new Response(JSON.stringify({ error: 'company_id required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    if (!EVOLUTION_API_URL) {
      return new Response(JSON.stringify({ error: 'EVOLUTION_API_URL not configured' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Get a connected session for this company
    const { data: sessions } = await supabase
      .from('whatsapp_sessions')
      .select('id, instance_name, status')
      .eq('company_id', companyId)
      .is('deleted_at', null)
      .eq('status', 'connected')
      .limit(1);

    const session = sessions?.[0];
    if (!session) {
      return new Response(JSON.stringify({ error: 'No connected session found' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    let convs: any[] = [];
    if (force) {
      const { data } = await supabase
        .from('whatsapp_conversations')
        .select('id, contact_phone, contact_name, profile_picture, remote_jid')
        .eq('company_id', companyId)
        .not('contact_phone', 'is', null)
        .order('last_message_at', { ascending: false })
        .limit(limit);
      convs = data || [];
    } else {
      // AUTOMATED SYNC LOGIC:
      // 1. Prioritize explicitly 'queued' items (newly arrived conversations)
      const { data: queuedItems } = await supabase
        .from('whatsapp_conversations')
        .select('id, contact_phone, contact_name, profile_picture, remote_jid, sync_status')
        .eq('company_id', companyId)
        .eq('sync_status', 'queued')
        .limit(limit);

      if (queuedItems && queuedItems.length > 0) {
        convs = queuedItems;
        console.log(`[SYNC] Processing ${convs.length} explicitly queued conversations`);
      } else {
        // 2. Fallback: items with missing profile pics that aren't already marked 'no_picture'
        // OR items that haven't been updated in 24h
        const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        
        const { data: candidates } = await supabase
          .from('whatsapp_conversations')
          .select('id, contact_phone, contact_name, profile_picture, remote_jid, sync_status, updated_at')
          .eq('company_id', companyId)
          .not('contact_phone', 'is', null)
          .or(`profile_picture.is.null,updated_at.lt.${yesterday}`)
          .order('last_message_at', { ascending: false })
          .limit(limit * 2);

        // Filter in-memory to handle the "no_picture" retry logic
        convs = (candidates || []).filter(c => {
          // If it's old, always retry
          if (c.updated_at && c.updated_at < yesterday) return true;
          // If it's missing and NOT already marked as "no_picture" in this 24h window
          if (!c.profile_picture && c.sync_status !== 'no_picture') return true;
          // If it's a group with a bad name
          const name = (c.contact_name || '') as string;
          if (c.remote_jid?.endsWith('@g.us') && (!name || /^\d{10,}$/.test(name) || name.endsWith('@g.us'))) return true;
          
          return false;
        }).slice(0, limit);
        
        console.log(`[SYNC] Found ${convs.length} automated candidates (after filtering)`);
      }
    }

    let updated = 0, failed = 0, skipped = 0;

    // For groups, pre-fetch all groups info in one call
    const groupInfoCache = new Map<string, { subject?: string; pictureUrl?: string }>();
    if ((convs || []).some(c => (c as any).remote_jid?.endsWith('@g.us'))) {
      try {
        const instance = encodeURIComponent(session.instance_name);
        const r = await fetch(`${EVOLUTION_API_URL}/group/fetchAllGroups/${instance}?getParticipants=false`, {
          method: 'GET',
          headers: { 'apikey': EVOLUTION_API_KEY },
        });
        const txt = await r.text();
        const json = JSON.parse(txt);
        const list = Array.isArray(json) ? json : (json?.groups || json?.data || []);
        for (const g of list) {
          const jid = g?.id || g?.groupJid || g?.jid;
          if (jid) {
            groupInfoCache.set(jid, {
              subject: g?.subject || g?.name || g?.groupName,
              pictureUrl: g?.pictureUrl || g?.picture || g?.profilePictureUrl,
            });
          }
        }
        console.log(`[SYNC] fetchAllGroups cached ${groupInfoCache.size} groups`);
      } catch (e) {
        console.warn('[SYNC] fetchAllGroups failed:', (e as Error).message);
      }
    }

    for (const conv of (convs || [])) {
      const phone = (conv.contact_phone || '').replace(/\D/g, '');
      const isGroup = conv.remote_jid?.endsWith('@g.us') || phone.length > 15;
      const number = isGroup
        ? (conv.remote_jid || (phone ? `${phone}@g.us` : ''))
        : phone;
      if (!number) { skipped++; continue; }

      try {
        let url: string | null = null;
        const instance = encodeURIComponent(session.instance_name);

        console.log(`[SYNC] Fetching picture for ${number} (${isGroup ? 'Group' : 'Contact'})`);

        // Primary endpoint
        const r1 = await fetch(`${EVOLUTION_API_URL}/chat/fetchProfilePictureUrl/${instance}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'apikey': EVOLUTION_API_KEY },
          body: JSON.stringify({ number }),
        });
        
        if (r1.ok) {
          const d1 = await r1.json();
          url = d1?.profilePictureUrl || d1?.profilePicUrl || d1?.url || null;
          console.log(`[SYNC] fetchProfilePictureUrl for ${number}: ${url ? 'Found' : 'Not found'}`);
        }

        // Fallback for groups
        if (isGroup) {
          const groupJid = number;
          let subject: string | null = null;

          const cached = groupInfoCache.get(groupJid);
          if (cached) {
            if (!url) url = cached.pictureUrl || null;
            subject = cached.subject || null;
            console.log(`[SYNC] Using cached info for group ${groupJid}: ${subject}, pic: ${url ? 'Yes' : 'No'}`);
          }

          if (!subject || !url) {
            try {
              const r2 = await fetch(`${EVOLUTION_API_URL}/group/findGroupInfos/${instance}?groupJid=${encodeURIComponent(groupJid)}`, {
                method: 'GET',
                headers: { 'apikey': EVOLUTION_API_KEY },
              });
              if (r2.ok) {
                const d2 = await r2.json();
                if (!url) url = d2?.pictureUrl || d2?.picture || d2?.profilePictureUrl || null;
                if (!subject) subject = d2?.subject || d2?.name || null;
              }
            } catch (_) { /* ignore */ }
          }
          
          if (subject) {
            const currentName = (conv as any).contact_name as string | undefined;
            const looksLikeJid = !currentName
              || /^\d{10,}$/.test(currentName)
              || currentName.endsWith('@g.us')
              || currentName === groupJid.replace('@g.us', '');
            if (looksLikeJid) {
              await supabase
                .from('whatsapp_conversations')
                .update({ contact_name: subject })
                .eq('id', conv.id);
            }
          }
        }

        if (url && typeof url === 'string') {
          const { error: updateError } = await supabase
            .from('whatsapp_conversations')
            .update({ 
              profile_picture: url,
              sync_status: 'synced',
              updated_at: new Date().toISOString()
            })
            .eq('id', conv.id);
          
          if (!updateError) {
            updated++;
            console.log(`[SYNC] Successfully updated picture for ${number}`);
          } else {
            failed++;
          }
        } else {
          await supabase
            .from('whatsapp_conversations')
            .update({ 
              sync_status: 'no_picture',
              updated_at: new Date().toISOString()
            })
            .eq('id', conv.id);
          skipped++;
          console.log(`[SYNC] No picture found for ${number}, marked as no_picture`);
        }

      } catch (err) {
        failed++;
        console.error(`[SYNC] Global loop error for ${number}:`, err);
      }

      await new Promise(r => setTimeout(r, 100));
    }

    return new Response(JSON.stringify({
      success: true,
      session_id: session.id,
      processed: (convs || []).length,
      updated, failed, skipped,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (err) {
    console.error('[SYNC-PROFILE-PICS] Error:', err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});