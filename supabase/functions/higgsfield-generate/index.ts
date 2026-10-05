import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const HIGGSFIELD_BASE = 'https://platform.higgsfield.ai';

async function logUsage(params: { service_type: string; action: string; model?: string; total_cost: number; company_id?: string; user_id?: string; metadata?: Record<string, any> }) {
  try {
    const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    await sb.from('api_usage_logs').insert({
      service_type: params.service_type,
      action: params.action,
      model: params.model || null,
      input_tokens: 0,
      output_tokens: 0,
      total_cost: params.total_cost,
      unit_cost: params.total_cost,
      company_id: params.company_id || null,
      user_id: params.user_id || null,
      metadata: params.metadata || {},
    });
  } catch (e) { console.error('logUsage error:', e); }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const HIGGSFIELD_API_KEY = Deno.env.get('HIGGSFIELD_API_KEY');
    const HIGGSFIELD_API_SECRET = Deno.env.get('HIGGSFIELD_API_SECRET');

    if (!HIGGSFIELD_API_KEY || !HIGGSFIELD_API_SECRET) {
      return new Response(JSON.stringify({ error: 'Higgsfield API credentials not configured' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const authHeader = `Key ${HIGGSFIELD_API_KEY}:${HIGGSFIELD_API_SECRET}`;
    const body = await req.json();
    const { action } = body;

    // ===== SUBMIT: Start image generation =====
    if (action === 'generate') {
      const { prompt, model_id, aspect_ratio, resolution } = body;
      const modelId = model_id || 'higgsfield-ai/soul/standard';

      console.log(`[Higgsfield] Submitting to ${modelId}: "${(prompt || '').slice(0, 80)}..."`);

      const res = await fetch(`${HIGGSFIELD_BASE}/${modelId}`, {
        method: 'POST',
        headers: {
          'Authorization': authHeader,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          prompt: prompt || 'Beautiful professional photograph',
          aspect_ratio: aspect_ratio || '3:4',
          resolution: resolution || '720p',
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        console.error('[Higgsfield] Submit error:', res.status, JSON.stringify(data));
        return new Response(JSON.stringify({ error: `Higgsfield error: ${res.status}`, details: data }), {
          status: res.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      console.log('[Higgsfield] Queued:', data.request_id);

      // Log estimated cost (~$0.03 per generation)
      logUsage({
        service_type: 'higgsfield',
        action: 'image_generation',
        model: modelId,
        total_cost: 0.03,
        metadata: { request_id: data.request_id, aspect_ratio, resolution },
      });

      return new Response(JSON.stringify({
        success: true,
        request_id: data.request_id,
        status: data.status,
        status_url: data.status_url,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ===== POLL: Check generation status =====
    if (action === 'poll') {
      const { request_id } = body;
      if (!request_id) {
        return new Response(JSON.stringify({ error: 'request_id is required' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const res = await fetch(`${HIGGSFIELD_BASE}/requests/${request_id}/status`, {
        headers: {
          'Authorization': authHeader,
          'Accept': 'application/json',
        },
      });

      const data = await res.json();

      if (!res.ok) {
        console.error('[Higgsfield] Poll error:', res.status, JSON.stringify(data));
        return new Response(JSON.stringify({ error: `Poll error: ${res.status}`, details: data }), {
          status: res.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // If completed, return image URLs
      const result: any = {
        success: true,
        status: data.status,
        request_id: data.request_id,
      };

      if (data.status === 'completed') {
        result.images = data.images || [];
        result.imageUrl = data.images?.[0]?.url || null;
        console.log('[Higgsfield] Completed! Image URL:', result.imageUrl?.slice(0, 80));
      }

      if (data.status === 'failed' || data.status === 'nsfw') {
        result.error = data.status === 'nsfw'
          ? 'Conteúdo bloqueado por moderação'
          : 'Falha na geração da imagem';
        console.error('[Higgsfield] Generation failed:', data.status);
      }

      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ===== GENERATE & WAIT: Submit + poll until done =====
    if (action === 'generate-and-wait') {
      const { prompt, model_id, aspect_ratio, resolution, max_wait_seconds } = body;
      const modelId = model_id || 'higgsfield-ai/soul/standard';
      const maxWait = Math.min(max_wait_seconds || 120, 180); // max 3 min

      console.log(`[Higgsfield] Generate-and-wait: ${modelId}`);

      // Step 1: Submit
      const submitRes = await fetch(`${HIGGSFIELD_BASE}/${modelId}`, {
        method: 'POST',
        headers: {
          'Authorization': authHeader,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          prompt: prompt || 'Beautiful professional photograph',
          aspect_ratio: aspect_ratio || '3:4',
          resolution: resolution || '720p',
        }),
      });

      const submitData = await submitRes.json();
      if (!submitRes.ok) {
        console.error('[Higgsfield] Submit error:', submitRes.status, JSON.stringify(submitData));
        return new Response(JSON.stringify({ error: `Submit failed: ${submitRes.status}`, details: submitData }), {
          status: submitRes.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const requestId = submitData.request_id;
      console.log('[Higgsfield] Queued:', requestId);

      // Step 2: Poll until completed or timeout
      const startTime = Date.now();
      let pollInterval = 2000; // start with 2s
      
      while ((Date.now() - startTime) < maxWait * 1000) {
        await new Promise(resolve => setTimeout(resolve, pollInterval));
        pollInterval = Math.min(pollInterval * 1.3, 5000); // gradually increase, max 5s

        const pollRes = await fetch(`${HIGGSFIELD_BASE}/requests/${requestId}/status`, {
          headers: { 'Authorization': authHeader, 'Accept': 'application/json' },
        });

        if (!pollRes.ok) {
          const errText = await pollRes.text();
          console.error('[Higgsfield] Poll error:', pollRes.status, errText);
          continue;
        }

        const pollData = await pollRes.json();
        console.log(`[Higgsfield] Status: ${pollData.status} (${Math.round((Date.now() - startTime) / 1000)}s)`);

        if (pollData.status === 'completed') {
          const imageUrl = pollData.images?.[0]?.url || null;

          logUsage({
            service_type: 'higgsfield',
            action: 'image_generation',
            model: modelId,
            total_cost: 0.03,
            metadata: { request_id: requestId, aspect_ratio, resolution, wait_seconds: Math.round((Date.now() - startTime) / 1000) },
          });

          return new Response(JSON.stringify({
            success: true,
            status: 'completed',
            request_id: requestId,
            imageUrl,
            images: pollData.images || [],
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        if (pollData.status === 'failed' || pollData.status === 'nsfw') {
          return new Response(JSON.stringify({
            success: false,
            status: pollData.status,
            error: pollData.status === 'nsfw' ? 'Conteúdo bloqueado por moderação' : 'Falha na geração',
          }), {
            status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
      }

      // Timeout - return request_id so frontend can continue polling
      return new Response(JSON.stringify({
        success: false,
        status: 'timeout',
        request_id: requestId,
        error: `Geração demorou mais de ${maxWait}s. Use o request_id para verificar depois.`,
      }), {
        status: 202, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Ação inválida. Use: generate, poll, ou generate-and-wait' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[Higgsfield] Error:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Erro desconhecido' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
