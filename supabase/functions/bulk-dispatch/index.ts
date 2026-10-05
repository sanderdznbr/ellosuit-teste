import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Stop processing this invocation when we get close to the edge-function time limit
// and self-reinvoke to continue with remaining jobs.
const MAX_RUN_MS = 90_000; // ~90s per invocation, well under the platform limit

function phoneVariants(raw: string): string[] {
  const digits = String(raw || '').replace(/\D/g, '');
  const set = new Set<string>([digits]);
  if (digits.startsWith('55') && digits.length >= 12) {
    const rest = digits.slice(2);
    const ddd = rest.slice(0, 2);
    const num = rest.slice(2);
    if (num.length === 9 && num.startsWith('9')) set.add(`55${ddd}${num.slice(1)}`);
    if (num.length === 8) set.add(`55${ddd}9${num}`);
  }
  return [...set].filter(Boolean);
}

// Intervalo entre mensagens. No modo "variable" sorteamos um valor da lista
// configurada (ex.: 2, 3, 4, 5, 8 min) para não criar um padrão detectável.
function resolveDelayMs(campaign: any): number {
  // Modo "range": sorteia um valor quebrado dentro de [min, max] (ex.: 143s, 187s)
  if (campaign?.delay_mode === 'range') {
    const nums: number[] = Array.isArray(campaign.delay_variants)
      ? campaign.delay_variants.map((v: any) => Number(v)).filter((v: number) => Number.isFinite(v) && v > 0)
      : [];
    const min = Math.max(5, Math.round(nums[0] ?? 120));
    const max = Math.max(min, Math.round(nums[1] ?? 200));
    const picked = min + Math.floor(Math.random() * (max - min + 1));
    return picked * 1000;
  }
  if (campaign?.delay_mode === 'variable') {
    const variants: number[] = Array.isArray(campaign.delay_variants)
      ? campaign.delay_variants.map((v: any) => Number(v)).filter((v: number) => Number.isFinite(v) && v > 0)
      : [];
    if (variants.length > 0) {
      const base = variants[Math.floor(Math.random() * variants.length)];
      // jitter de +-10% para variar ainda mais
      const jitter = base * (Math.random() * 0.2 - 0.1);
      return Math.max(5, Math.round(base + jitter)) * 1000;
    }
  }
  return (campaign?.delay_seconds || 3) * 1000;
}


// Após o envio, prepara a conversa para que a resposta do destinatário
// caia no Agente de IA e/ou no fluxo de Chatbot vinculado à campanha.
async function linkFollowUp(supabase: any, campaign: any, job: any) {
  const wantsAgent = campaign.ai_enabled === true && !!campaign.ai_agent_id;
  const wantsChatbot = campaign.chatbot_enabled === true && !!campaign.chatbot_flow_id;
  const wantsReplyAi = campaign.reply_ai_enabled === true;

  if (wantsReplyAi) {
    const variants = phoneVariants(job.phone);
    const { data: replyConv } = await supabase
      .from('whatsapp_conversations')
      .select('id')
      .eq('company_id', campaign.company_id)
      .in('contact_phone', variants)
      .order('last_message_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (replyConv?.id) {
      await supabase.from('dispatch_reply_watch').upsert({
        company_id: campaign.company_id,
        campaign_id: campaign.id,
        conversation_id: replyConv.id,
        phone: job.phone,
        contact_name: job.contact_name || null,
        status: 'waiting',
      }, { onConflict: 'campaign_id,conversation_id' });
    }
  }

  if (!wantsAgent && !wantsChatbot) return;

  const variants = phoneVariants(job.phone);
  const { data: conv } = await supabase
    .from('whatsapp_conversations')
    .select('id, contact_phone')
    .eq('company_id', campaign.company_id)
    .in('contact_phone', variants)
    .order('last_message_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!conv?.id) {
    console.warn('[BULK-DISPATCH] Conversa não encontrada para vincular follow-up:', job.phone);
    return;
  }

  await supabase
    .from('whatsapp_conversations')
    .update({
      human_takeover: false,
      human_takeover_at: null,
      human_takeover_reason: null,
      ai_auto_reply_enabled: wantsAgent && !wantsChatbot,
      ai_agent_id: wantsAgent ? campaign.ai_agent_id : null,
      assigned_agent_id: wantsAgent ? campaign.ai_agent_id : null,
    })
    .eq('id', conv.id);

  if (!wantsChatbot) return;

  const { data: flow } = await supabase
    .from('chatbot_flows')
    .select('id, nodes, edges, execution_count')
    .eq('id', campaign.chatbot_flow_id)
    .maybeSingle();
  if (!flow) return;

  const nodes: any[] = Array.isArray(flow.nodes) ? flow.nodes : [];
  const edges: any[] = Array.isArray(flow.edges) ? flow.edges : [];
  const targets = new Set(edges.map((e: any) => e.target));
  const trigger = nodes.find((n: any) => n.type === 'trigger')
    || nodes.filter((n: any) => !targets.has(n.id))[0];

  const { data: running } = await supabase
    .from('chatbot_executions')
    .select('id')
    .eq('conversation_id', conv.id)
    .eq('status', 'running')
    .limit(1);
  if (running && running.length > 0) return;

  await supabase.from('chatbot_executions').insert({
    flow_id: flow.id,
    company_id: campaign.company_id,
    conversation_id: conv.id,
    contact_phone: job.phone,
    status: 'running',
    current_node_id: trigger?.id || null,
    variables: {
      nome: job.contact_name || job.phone,
      telefone: job.phone,
      origem: 'disparo',
      campanha: campaign.title || '',
    },
    execution_path: trigger?.id ? [trigger.id] : [],
    last_activity_at: new Date().toISOString(),
  });

  await supabase
    .from('chatbot_flows')
    .update({ execution_count: (flow.execution_count || 0) + 1 })
    .eq('id', flow.id);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const startedAt = Date.now();
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { campaign_id, resume_at, new_batch } = await req.json();
    if (!campaign_id) throw new Error('campaign_id is required');


    // Retomada agendada (intervalo variável longo): aguarda em fatias e reinvoca se faltar tempo
    if (resume_at) {
      const target = new Date(resume_at).getTime();
      while (Date.now() < target) {
        if (Date.now() - startedAt > MAX_RUN_MS) {
          supabase.functions.invoke('bulk-dispatch', { body: { campaign_id, resume_at } })
            .catch((e) => console.error('[BULK-DISPATCH] Re-invoke failed:', e));
          return new Response(JSON.stringify({ status: 'waiting', resume_at }), { headers: corsHeaders });
        }
        await new Promise(r => setTimeout(r, Math.min(5000, target - Date.now())));
      }
    }

    // 1. Get campaign details
    const { data: campaign, error: campaignError } = await supabase
      .from('dispatch_campaigns')
      .select('*')
      .eq('id', campaign_id)
      .single();

    if (campaignError || !campaign) throw new Error('Campaign not found');
    if (campaign.status !== 'pending' && campaign.status !== 'processing') {
       return new Response(JSON.stringify({ status: campaign.status }), { headers: corsHeaders });
    }

    // 2. Update status to processing
    await supabase.from('dispatch_campaigns').update({ status: 'processing' }).eq('id', campaign_id);

    // 2a. Envio em etapas: define o alvo deste lote (concluídos + tamanho do lote)
    const batchSize = Number(campaign.batch_size) || 0;
    let batchLimit = Number(campaign.batch_limit) || 0;
    const countDone = async () => {
      const { count } = await supabase
        .from('dispatch_jobs')
        .select('id', { count: 'exact', head: true })
        .eq('campaign_id', campaign_id)
        .in('status', ['sent', 'error']);
      return count || 0;
    };
    if (batchSize > 0 && (new_batch || !batchLimit)) {
      batchLimit = (await countDone()) + batchSize;
      await supabase.from('dispatch_campaigns').update({ batch_limit: batchLimit }).eq('id', campaign_id);
    }
    let doneCount = batchSize > 0 ? await countDone() : 0;

    // 2b. Recover any jobs stuck in 'sending' from a previous timed-out invocation
    await supabase
      .from('dispatch_jobs')
      .update({ status: 'pending' })
      .eq('campaign_id', campaign_id)
      .eq('status', 'sending');


    // 3. Get pending jobs
    const { data: jobs } = await supabase
      .from('dispatch_jobs')
      .select('*')
      .eq('campaign_id', campaign_id)
      .eq('status', 'pending');

    if (!jobs || jobs.length === 0) {
      await supabase.from('dispatch_campaigns').update({ status: 'completed' }).eq('id', campaign_id);
      return new Response(JSON.stringify({ status: 'completed' }), { headers: corsHeaders });
    }

    // 4. Process each job
    for (const job of jobs) {
      // Limite do lote atingido: pausa e aguarda o usuário liberar a próxima etapa
      if (batchSize > 0 && doneCount >= batchLimit) {
        if (campaign.auto_next_batch) {
          batchLimit = doneCount + batchSize;
          await supabase.from('dispatch_campaigns').update({ batch_limit: batchLimit }).eq('id', campaign_id);
        } else {
          await supabase.from('dispatch_campaigns').update({ status: 'paused' }).eq('id', campaign_id);
          console.log(`[BULK-DISPATCH] Lote de ${batchSize} concluído — campanha pausada aguardando próxima etapa`);
          return new Response(JSON.stringify({ status: 'batch_paused', done: doneCount }), { headers: corsHeaders });
        }
      }

      // Bail out before edge function timeout and re-invoke ourselves to continue.

      if (Date.now() - startedAt > MAX_RUN_MS) {
        console.log('[BULK-DISPATCH] Approaching time limit, re-invoking to continue');
        // Fire-and-forget re-invoke (do not await, so the response can return immediately)
        supabase.functions.invoke('bulk-dispatch', { body: { campaign_id } })
          .catch((e) => console.error('[BULK-DISPATCH] Re-invoke failed:', e));
        return new Response(JSON.stringify({ status: 'continuing', processed_partial: true }), { headers: corsHeaders });
      }

      // Re-check status in case it was paused
      const { data: currentCampaign } = await supabase.from('dispatch_campaigns').select('status').eq('id', campaign_id).single();
      if (currentCampaign?.status === 'paused' || currentCampaign?.status === 'cancelled') break;

      await supabase.from('dispatch_jobs').update({ status: 'sending' }).eq('id', job.id);

      try {
        const jobFields = (job.custom_fields || {}) as Record<string, any>;
        const jobMediaUrl = jobFields.voice_url || jobFields.media_url || campaign.media_url;
        const rawType = jobFields.voice_url ? 'voice' : (jobFields.media_type || campaign.media_type || 'text');
        // "voice" (Voz IA) é enviado como áudio no WhatsApp
        const effectiveType = rawType === 'voice' ? 'audio' : rawType;

        if (effectiveType !== 'text' && !jobMediaUrl) {
          throw new Error('Mídia não encontrada para este destinatário');
        }

        const { data: sendData, error: sendError } = await supabase.functions.invoke('whatsapp-api', {
          body: {
            action: effectiveType === 'text' ? 'send_message' : 'send_media',
            manualTakeover: false,
            sessionId: campaign.session_id,
            companyId: campaign.company_id,
            phone: job.phone,
            message: jobFields.script || campaign.message_template || '', // Prefer custom script (Voice IA) or template
            mediaUrl: jobMediaUrl,
            mediaType: effectiveType,
            caption: campaign.media_caption,
            aiEnabled: campaign.ai_enabled === true,
            aiAgentId: campaign.ai_enabled ? campaign.ai_agent_id : null
          }
        });

        if (sendError) {
          let detail = sendError.message;
          try { detail = await (sendError as any).context?.text?.() || detail; } catch { /* ignore */ }
          throw new Error(detail);
        }
        if (sendData?.error) throw new Error(sendData.error);

        // Mensagens em sequência (follow-ups) configuradas na campanha
        const followUps: any[] = Array.isArray(campaign.follow_ups) ? campaign.follow_ups : [];
        const stepDelay = Math.max(1, Math.min(campaign.delay_seconds || 5, 120)) * 1000;
        for (const fu of followUps) {
          const fuRawType = fu?.media_type || 'text';
          const fuType = fuRawType === 'voice' ? 'audio' : fuRawType;
          if (fuType !== 'text' && !fu?.media_url) {
            throw new Error('Mídia ausente em uma das mensagens em sequência');
          }
          if (fuType === 'text' && !fu?.message) continue;

          await new Promise(r => setTimeout(r, stepDelay));

          const { data: fuData, error: fuError } = await supabase.functions.invoke('whatsapp-api', {
            body: {
              action: fuType === 'text' ? 'send_message' : 'send_media',
              manualTakeover: false,
              sessionId: campaign.session_id,
              companyId: campaign.company_id,
              phone: job.phone,
              message: fu.message || '',
              mediaUrl: fu.media_url,
              mediaType: fuType,
              caption: fu.message || '',
              aiEnabled: false,
              aiAgentId: null,
            }
          });

          if (fuError) {
            let detail = fuError.message;
            try { detail = await (fuError as any).context?.text?.() || detail; } catch { /* ignore */ }
            throw new Error(detail);
          }
          if (fuData?.error) throw new Error(fuData.error);
        }

        await supabase.from('dispatch_jobs').update({ status: 'sent' }).eq('id', job.id);
        doneCount++;

        await supabase.rpc('increment_campaign_sent', { campaign_id_input: campaign_id });
        try {
          await linkFollowUp(supabase, campaign, job);
        } catch (linkErr) {
          console.error('[BULK-DISPATCH] Falha ao vincular agente/chatbot:', linkErr);
        }
      } catch (err) {
        await supabase.from('dispatch_jobs').update({ status: 'error', error_message: err.message }).eq('id', job.id);
        await supabase.rpc('increment_campaign_error', { campaign_id_input: campaign_id });
        doneCount++;

      }

      // User-defined delay to avoid rate limiting (fixo ou variável/anti-ban)
      const delay = resolveDelayMs(campaign);
      console.log(`[BULK-DISPATCH] Próximo envio em ${Math.round(delay / 1000)}s (modo ${campaign.delay_mode || 'fixed'})`);

      const resumeAt = Date.now() + delay;
      const budgetLeft = MAX_RUN_MS - (Date.now() - startedAt);
      if (delay > budgetLeft) {
        // Espera maior que o tempo restante da invocação: reinvoca passando o horário de retomada
        supabase.functions.invoke('bulk-dispatch', { body: { campaign_id, resume_at: new Date(resumeAt).toISOString() } })
          .catch((e) => console.error('[BULK-DISPATCH] Re-invoke failed:', e));
        return new Response(JSON.stringify({ status: 'waiting', resume_at: new Date(resumeAt).toISOString() }), { headers: corsHeaders });
      }
      await new Promise(r => setTimeout(r, delay));
    }

    // 5. Check if finished and update final status
    const { data: allJobs } = await supabase.from('dispatch_jobs').select('status').eq('campaign_id', campaign_id);
    const remaining = allJobs?.filter(j => j.status === 'pending' || j.status === 'sending');
    
    if (!remaining || remaining.length === 0) {
      const errors = allJobs?.filter(j => j.status === 'error').length || 0;
      const successes = allJobs?.filter(j => j.status === 'sent').length || 0;
      
      let finalStatus = 'completed';
      if (successes > 0 && errors > 0) {
        finalStatus = 'completed_with_errors';
      } else if (successes === 0 && errors > 0) {
        finalStatus = 'failed';
      }
      
      await supabase.from('dispatch_campaigns').update({ status: finalStatus }).eq('id', campaign_id);
    }

    return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders });
  }
});