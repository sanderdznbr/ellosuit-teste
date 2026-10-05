import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Worker que retoma execuções longas do agente (podem durar horas, em ciclos).
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, serviceKey);

  try {
    const { runId, maxCycles = 6 } = await req.json();
    if (!runId) {
      return new Response(JSON.stringify({ error: 'runId obrigatório' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: run } = await supabase.from('ai_agent_runs').select('*').eq('id', runId).single();
    if (!run) {
      return new Response(JSON.stringify({ error: 'run não encontrado' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (['completed', 'failed', 'cancelled', 'awaiting_approval'].includes(run.status)) {
      return new Response(JSON.stringify({ skipped: true, status: run.status }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const work = async () => {
      let history: any[] = Array.isArray(run.messages) ? run.messages.filter((m: any) => m?.role !== 'system') : [];
      let finalAnswer = '';

      for (let cycle = 0; cycle < maxCycles; cycle++) {
        const { data: fresh } = await supabase.from('ai_agent_runs').select('status').eq('id', runId).single();
        if (!fresh || ['cancelled', 'paused', 'completed', 'failed'].includes(fresh.status)) break;

        const res = await fetch(`${supabaseUrl}/functions/v1/ai-assistant`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${serviceKey}` },
          body: JSON.stringify({
            message: cycle === 0
              ? `Continue a tarefa em andamento até concluí-la: "${run.goal}". Retome exatamente de onde parou.`
              : 'Continue de onde parou. Se já concluiu tudo, responda com o resumo final.',
            messages: history.slice(-30),
            userId: run.user_id,
            companyId: run.company_id,
            activeConversationId: run.conversation_id,
          }),
        });

        if (!res.ok) {
          await supabase.from('ai_agent_runs').update({
            status: 'failed', error: `worker: ${res.status}`, finished_at: new Date().toISOString(),
          }).eq('id', runId);
          return;
        }

        const data = await res.json();
        finalAnswer = data.response || finalAnswer;
        history = [
          ...history.slice(-20),
          { role: 'assistant', content: finalAnswer },
        ];

        await supabase.from('ai_agent_runs').update({
          final_answer: finalAnswer,
          messages: history,
          steps_used: (run.steps_used || 0) + (data.steps_used || 0),
        }).eq('id', runId);

        if (data.needs_approval) {
          await supabase.from('ai_agent_runs').update({ status: 'awaiting_approval' }).eq('id', runId);
          break;
        }
        if (!data.background) break; // terminou dentro do ciclo
      }

      await supabase.from('ai_agent_runs').update({
        status: 'completed', finished_at: new Date().toISOString(), final_answer: finalAnswer,
      }).eq('id', runId).neq('status', 'awaiting_approval');

      // Entrega o resultado dentro da conversa do usuário
      if (run.conversation_id && finalAnswer) {
        await supabase.from('ai_assistant_messages').insert({
          conversation_id: run.conversation_id,
          role: 'assistant',
          content: finalAnswer,
        });
      }
    };

    // @ts-ignore EdgeRuntime existe no runtime do Supabase
    if (typeof EdgeRuntime !== 'undefined' && EdgeRuntime.waitUntil) {
      // @ts-ignore
      EdgeRuntime.waitUntil(work());
    } else {
      work();
    }

    return new Response(JSON.stringify({ started: true, runId }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('[ai-agent-worker]', e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : 'erro' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
