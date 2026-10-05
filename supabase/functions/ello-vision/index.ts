import { createClient } from "npm:@supabase/supabase-js@2";

async function logUsage(params: { service_type: string; action: string; model?: string; input_tokens?: number; output_tokens?: number; total_cost: number; metadata?: Record<string, any> }) {
  try {
    const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    await sb.from('api_usage_logs').insert({
      service_type: params.service_type, action: params.action, model: params.model || null,
      input_tokens: params.input_tokens || 0, output_tokens: params.output_tokens || 0,
      total_cost: params.total_cost, unit_cost: params.total_cost, metadata: params.metadata || {},
    });
  } catch (e) { console.error('logUsage error:', e); }
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('Missing authorization');

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) throw new Error('Unauthorized');

    const { data: companyUser } = await supabase
      .from('company_users')
      .select('company_id')
      .eq('user_id', user.id)
      .limit(1)
      .single();

    if (!companyUser) throw new Error('No company found');
    const companyId = companyUser.company_id;

    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
    const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const weekAgoISO = weekAgo.toISOString();
    const twoWeeksAgoISO = twoWeeksAgo.toISOString();
    const monthAgoISO = monthAgo.toISOString();

    // Gather ALL data in parallel
    const [
      docsRes, clientsRes, eventsRes, emailsRes,
      linkClicksRes, docTrackingRes, trackedLinksRes,
      tasksRes, whatsappRes, emailEventsRes,
      docsPrevRes, emailsPrevRes,
      meetingRecordingsRes, inPersonMeetingsRes,
      whatsappMsgsRes, pipelineRes, agentsRes,
      bookingsRes, flowsRes
    ] = await Promise.all([
      supabase.from('documents').select('id, name, file_type, created_at').eq('company_id', companyId),
      supabase.from('clients').select('id, name, status, created_at, tags, email, phone').eq('company_id', companyId),
      supabase.from('calendar_events').select('id, title, event_type, start_date, status, created_at').eq('company_id', companyId).gte('start_date', weekAgoISO),
      supabase.from('emails').select('id, status, open_count, sent_at, recipient_email').eq('company_id', companyId).gte('sent_at', weekAgoISO),
      supabase.from('link_clicks').select('id, clicked_at, link_id, device_type').gte('clicked_at', weekAgoISO),
      supabase.from('document_tracking_events').select('id, event_type, timestamp, duration_seconds, page_number, device_type').gte('timestamp', weekAgoISO),
      supabase.from('tracked_links').select('id, click_count, company_id').eq('company_id', companyId),
      supabase.from('task_routines').select('id, title, is_active, created_at').eq('company_id', companyId),
      supabase.from('whatsapp_conversations').select('id, contact_name, contact_phone, last_message_at, unread_count, pipeline_stage, ai_auto_reply_enabled, assigned_agent_id').eq('company_id', companyId).gte('last_message_at', monthAgoISO),
      supabase.from('email_events').select('id, event_type, timestamp').gte('timestamp', weekAgoISO),
      supabase.from('documents').select('id').eq('company_id', companyId).gte('created_at', twoWeeksAgoISO).lt('created_at', weekAgoISO),
      supabase.from('emails').select('id').eq('company_id', companyId).gte('sent_at', twoWeeksAgoISO).lt('sent_at', weekAgoISO),
      // Meeting recordings with transcripts
      supabase.from('meeting_recordings').select('id, title, transcript, duration_seconds, created_at').eq('company_id', companyId).gte('created_at', monthAgoISO).order('created_at', { ascending: false }).limit(10),
      // In-person meetings with transcripts
      supabase.from('in_person_meetings').select('id, title, transcript, duration_seconds, created_at').eq('company_id', companyId).gte('created_at', monthAgoISO).order('created_at', { ascending: false }).limit(10),
      // Recent WhatsApp messages for sentiment analysis
      supabase.from('whatsapp_messages').select('id, content, sender, is_from_me, created_at, conversation_id').eq('company_id', companyId).gte('created_at', weekAgoISO).order('created_at', { ascending: false }).limit(200),
      // Pipeline stage distribution
      supabase.from('whatsapp_conversations').select('pipeline_stage').eq('company_id', companyId).not('pipeline_stage', 'is', null),
      // AI Agents performance
      supabase.from('ai_agents').select('id, name, is_active').eq('company_id', companyId),
      // Bookings
      supabase.from('scheduled_bookings').select('id, status, booking_date, created_at').eq('company_id', companyId).gte('created_at', monthAgoISO),
      // Chatbot flows
      supabase.from('chatbot_flows').select('id, name, is_active, execution_count').eq('company_id', companyId),
    ]);

    const docs = docsRes.data || [];
    const clients = clientsRes.data || [];
    const events = eventsRes.data || [];
    const emails = emailsRes.data || [];
    const linkClicks = linkClicksRes.data || [];
    const docTracking = docTrackingRes.data || [];
    const trackedLinks = trackedLinksRes.data || [];
    const tasks = tasksRes.data || [];
    const whatsapp = whatsappRes.data || [];
    const emailEvents = emailEventsRes.data || [];
    const docsPrev = docsPrevRes.data || [];
    const emailsPrev = emailsPrevRes.data || [];
    const meetingRecordings = meetingRecordingsRes.data || [];
    const inPersonMeetings = inPersonMeetingsRes.data || [];
    const whatsappMsgs = whatsappMsgsRes.data || [];
    const pipelineData = pipelineRes.data || [];
    const agents = agentsRes.data || [];
    const bookings = bookingsRes.data || [];
    const flows = flowsRes.data || [];

    // Calculate metrics
    const totalDocs = docs.length;
    const totalClients = clients.length;
    const activeClients = clients.filter(c => c.status === 'active').length;
    const totalEmails = emails.length;
    const emailsOpened = emails.filter(e => (e.open_count || 0) > 0).length;
    const emailOpenRate = totalEmails > 0 ? Math.round((emailsOpened / totalEmails) * 100) : 0;
    const totalLinkClicks = linkClicks.length;
    const totalDocViews = docTracking.filter(e => e.event_type === 'view' || e.event_type === 'page_view').length;
    const activeTasks = tasks.filter(t => t.is_active).length;
    const whatsappConversations = whatsapp.length;
    const unreadMessages = whatsapp.reduce((sum, w) => sum + (w.unread_count || 0), 0);
    const eventsThisWeek = events.length;

    // Trends
    const docsThisWeek = docs.filter(d => new Date(d.created_at) >= weekAgo).length;
    const docsChange = docsPrev.length > 0 ? Math.round(((docsThisWeek - docsPrev.length) / docsPrev.length) * 100) : 0;
    const emailsChange = emailsPrev.length > 0 ? Math.round(((totalEmails - emailsPrev.length) / emailsPrev.length) * 100) : 0;

    // Pipeline distribution
    const pipelineStages: Record<string, number> = {};
    pipelineData.forEach(p => {
      const stage = p.pipeline_stage || 'sem_estagio';
      pipelineStages[stage] = (pipelineStages[stage] || 0) + 1;
    });

    // Meeting transcripts summary
    const allTranscripts: string[] = [];
    meetingRecordings.forEach(r => { if (r.transcript) allTranscripts.push(`[Reunião Online: ${r.title}] ${r.transcript.substring(0, 800)}`); });
    inPersonMeetings.forEach(r => { if (r.transcript) allTranscripts.push(`[Reunião Presencial: ${r.title}] ${r.transcript.substring(0, 800)}`); });
    const transcriptsSummary = allTranscripts.length > 0 ? allTranscripts.join('\n\n').substring(0, 4000) : 'Nenhuma transcrição de reunião encontrada no último mês.';

    // WhatsApp messages sample for sentiment
    const incomingMsgs = whatsappMsgs.filter(m => !m.is_from_me && m.content);
    const msgsSample = incomingMsgs.slice(0, 50).map(m => m.content).join(' | ').substring(0, 2000);

    // Conversations with AI enabled
    const aiEnabledConvs = whatsapp.filter(w => w.ai_auto_reply_enabled).length;

    // New clients this week/month
    const newClientsWeek = clients.filter(c => new Date(c.created_at) >= weekAgo).length;
    const newClientsMonth = clients.filter(c => new Date(c.created_at) >= monthAgo).length;

    // Bookings stats
    const confirmedBookings = bookings.filter(b => b.status === 'confirmed' || b.status === 'scheduled').length;
    const cancelledBookings = bookings.filter(b => b.status === 'cancelled').length;

    // Chatbot stats
    const activeFlows = flows.filter(f => f.is_active).length;
    const totalExecutions = flows.reduce((sum, f) => sum + (f.execution_count || 0), 0);

    // Total meeting time
    const totalMeetingMinutes = [...meetingRecordings, ...inPersonMeetings]
      .reduce((sum, r) => sum + Math.round((r.duration_seconds || 0) / 60), 0);

    // Device breakdown
    const deviceTypes = docTracking.reduce((acc: Record<string, number>, e) => {
      const d = e.device_type || 'desktop';
      acc[d] = (acc[d] || 0) + 1;
      return acc;
    }, {});

    // Build comprehensive data summary for AI
    const dataSummary = `
DADOS COMPLETOS DA EMPRESA (últimos 7-30 dias):

=== CLIENTES ===
- Total: ${totalClients} (${activeClients} ativos, ${totalClients - activeClients} inativos)
- Novos esta semana: ${newClientsWeek}
- Novos este mês: ${newClientsMonth}
- Clientes sem email: ${clients.filter(c => !c.email).length}
- Clientes sem telefone: ${clients.filter(c => !c.phone).length}

=== COMUNICAÇÃO EMAIL ===
- Emails esta semana: ${totalEmails}
- Taxa abertura: ${emailOpenRate}%
- Emails semana anterior: ${emailsPrev.length}
- Variação: ${emailsChange}%
- Eventos de tracking: ${emailEvents.length}

=== WHATSAPP ===
- Conversas ativas (mês): ${whatsappConversations}
- Mensagens não lidas: ${unreadMessages}
- Conversas com IA ativa: ${aiEnabledConvs}
- Mensagens recebidas esta semana: ${incomingMsgs.length}
- Pipeline: ${JSON.stringify(pipelineStages)}

=== AMOSTRA DE MENSAGENS RECEBIDAS (para análise de sentimento) ===
${msgsSample || 'Nenhuma mensagem recente'}

=== REUNIÕES ===
- Gravações online: ${meetingRecordings.length}
- Reuniões presenciais: ${inPersonMeetings.length}
- Tempo total em reuniões: ${totalMeetingMinutes} minutos
- Transcrições disponíveis: ${allTranscripts.length}

=== TRANSCRIÇÕES DE REUNIÕES ===
${transcriptsSummary}

=== AGENDAMENTOS ===
- Confirmados/Agendados: ${confirmedBookings}
- Cancelados: ${cancelledBookings}

=== DOCUMENTOS & RASTREAMENTO ===
- Total docs: ${totalDocs}
- Criados esta semana: ${docsThisWeek}
- Visualizações de docs rastreados: ${totalDocViews}
- Links rastreados: ${trackedLinks.length}
- Cliques em links: ${totalLinkClicks}
- Dispositivos: ${JSON.stringify(deviceTypes)}

=== AUTOMAÇÃO ===
- Agentes IA: ${agents.length} (${agents.filter(a => a.is_active).length} ativos)
- Fluxos chatbot: ${flows.length} (${activeFlows} ativos)
- Execuções de chatbot: ${totalExecutions}
- Rotinas/Hábitos: ${tasks.length} (${activeTasks} ativos)

=== AGENDA ===
- Eventos esta semana: ${eventsThisWeek}
`.trim();

    console.log('📊 Ello Vision data summary length:', dataSummary.length);

    // Call AI for comprehensive analysis
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) throw new Error('LOVABLE_API_KEY not configured');

    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-3-flash-preview',
        messages: [
          {
            role: 'system',
            content: `Você é um analista de negócios e consultor estratégico de alto nível. Analise TODOS os dados fornecidos — métricas, conversas do WhatsApp, transcrições de reunião — e gere uma análise profunda e acionável.

Retorne EXATAMENTE este formato JSON (sem markdown, sem \`\`\`):
{
  "insights": [
    {
      "type": "positive" | "warning" | "critical" | "info" | "opportunity",
      "title": "Título curto e impactante",
      "description": "Descrição detalhada com números e contexto",
      "metric": "+45%" ou "32%" ou "3 clientes" etc,
      "action": "Ação específica recomendada"
    }
  ],
  "churn_alerts": [
    {
      "risk_level": "high" | "medium" | "low",
      "signal": "Descrição do sinal de churn detectado",
      "recommendation": "O que fazer para reter"
    }
  ],
  "meeting_analysis": {
    "key_topics": ["Tópico 1", "Tópico 2"],
    "action_items": ["Item 1", "Item 2"],
    "sentiment": "positivo" | "neutro" | "negativo" | "misto",
    "summary": "Resumo das reuniões"
  },
  "conversation_analysis": {
    "overall_sentiment": "positivo" | "neutro" | "negativo" | "misto",
    "hot_leads": número estimado,
    "needs_attention": número estimado,
    "common_topics": ["Tópico 1", "Tópico 2"],
    "summary": "Resumo das conversas"
  },
  "strategic_tips": [
    {
      "category": "vendas" | "marketing" | "atendimento" | "produtividade" | "automação",
      "tip": "Dica estratégica específica baseada nos dados",
      "impact": "alto" | "médio" | "baixo",
      "effort": "fácil" | "médio" | "complexo"
    }
  ],
  "summary": "Parágrafo executivo completo com visão geral, pontos fortes, fracos e recomendações prioritárias",
  "performance": {
    "email_engagement": número 0-100,
    "client_growth": número 0-100,
    "content_activity": número 0-100,
    "communication": número 0-100,
    "automation_usage": número 0-100,
    "meeting_productivity": número 0-100
  },
  "pipeline_health": {
    "score": número 0-100,
    "bottleneck": "Onde está o gargalo do pipeline",
    "recommendation": "Como melhorar"
  }
}

REGRAS:
- Gere 5-8 insights (misture positivos, warnings, critical e oportunidades)
- Analise as transcrições de reunião para encontrar: promessas feitas, clientes insatisfeitos, oportunidades de venda
- Analise as mensagens WhatsApp para sentimento e intenções (querer sair, querer fechar, reclamações)
- Identifique sinais de churn: clientes inativos, reclamações, cancelamentos
- Dê 4-6 dicas estratégicas com impacto e esforço estimados
- Se dados forem zero/vazios, dê dicas de como começar
- Sempre em português brasileiro`
          },
          { role: 'user', content: dataSummary }
        ],
        temperature: 0.7,
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error('❌ AI error:', aiResponse.status, errText);
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: 'Rate limit exceeded' }), { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ error: 'Credits exhausted' }), { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      throw new Error(`AI error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const aiContent = aiData.choices[0].message.content;

    // Log cost for ello-vision AI call
    const usage = aiData.usage || {};
    const inputTokens = usage.prompt_tokens || 0;
    const outputTokens = usage.completion_tokens || 0;
    const cost = (inputTokens / 1000) * 0.00015 + (outputTokens / 1000) * 0.0006;
    logUsage({
      service_type: 'lovable_ai', action: 'ello_vision_analysis', model: 'google/gemini-3-flash-preview',
      input_tokens: inputTokens, output_tokens: outputTokens, total_cost: cost,
      metadata: { data_summary_length: dataSummary.length },
    });

    let parsed;
    try {
      const cleaned = aiContent.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      parsed = JSON.parse(cleaned);
    } catch {
      console.error('Failed to parse AI response:', aiContent);
      parsed = {
        insights: [{ type: 'info', title: 'Análise disponível', description: 'Os dados do seu workspace foram coletados.', metric: '-', action: 'Aguarde' }],
        churn_alerts: [],
        meeting_analysis: { key_topics: [], action_items: [], sentiment: 'neutro', summary: 'Sem dados de reunião.' },
        conversation_analysis: { overall_sentiment: 'neutro', hot_leads: 0, needs_attention: 0, common_topics: [], summary: 'Sem dados.' },
        strategic_tips: [],
        summary: 'Análise em processamento.',
        performance: { email_engagement: 50, client_growth: 50, content_activity: 50, communication: 50, automation_usage: 50, meeting_productivity: 50 },
        pipeline_health: { score: 50, bottleneck: 'Sem dados suficientes', recommendation: 'Continue usando a plataforma' },
      };
    }

    const result = {
      metrics: {
        total_docs: totalDocs,
        total_clients: totalClients,
        active_clients: activeClients,
        inactive_clients: totalClients - activeClients,
        new_clients_week: newClientsWeek,
        new_clients_month: newClientsMonth,
        emails_sent: totalEmails,
        email_open_rate: emailOpenRate,
        link_clicks: totalLinkClicks,
        doc_views: totalDocViews,
        events_this_week: eventsThisWeek,
        whatsapp_conversations: whatsappConversations,
        unread_messages: unreadMessages,
        active_habits: activeTasks,
        docs_change: docsChange,
        emails_change: emailsChange,
        ai_enabled_conversations: aiEnabledConvs,
        total_meetings: meetingRecordings.length + inPersonMeetings.length,
        meeting_minutes: totalMeetingMinutes,
        confirmed_bookings: confirmedBookings,
        cancelled_bookings: cancelledBookings,
        active_agents: agents.filter(a => a.is_active).length,
        total_agents: agents.length,
        active_flows: activeFlows,
        total_flow_executions: totalExecutions,
        pipeline_stages: pipelineStages,
      },
      ai: parsed,
    };

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('❌ Ello Vision error:', error);
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : 'Internal error',
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
