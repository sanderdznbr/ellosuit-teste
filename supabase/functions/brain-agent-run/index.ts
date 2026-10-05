import { createClient } from 'npm:@supabase/supabase-js@2';
import { createOpenAICompatible } from 'npm:@ai-sdk/openai-compatible';
import { streamText, tool, stepCountIs } from 'npm:ai';
import { z } from 'npm:zod@3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function gateway(key: string) {
  return createOpenAICompatible({
    name: 'lovable',
    baseURL: 'https://ai.gateway.lovable.dev/v1',
    headers: { 'Lovable-API-Key': key },
  });
}

const MODEL = 'google/gemini-2.5-flash';
const UA = 'Mozilla/5.0 (compatible; EllosuitBrainAgent/1.0)';

/* ---------------- scraping helpers (Scrapling-style: fetch + limpeza) --------------- */

function stripHtml(html: string) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractContacts(text: string) {
  const emails = Array.from(new Set((text.match(/[\w.+-]+@[\w-]+\.[\w.]{2,}/g) || []).map((e) => e.toLowerCase()))).slice(0, 40);
  const phones = Array.from(new Set(
    (text.match(/(?:\+?55\s?)?\(?\d{2}\)?\s?9?\d{4}[-\s.]?\d{4}/g) || [])
      .map((p) => p.replace(/[^\d+]/g, ''))
      .filter((p) => p.replace(/\D/g, '').length >= 10),
  )).slice(0, 40);
  const sites = Array.from(new Set((text.match(/https?:\/\/[^\s"'<>)]+/g) || []))).slice(0, 20);
  const instagram = Array.from(new Set((text.match(/(?:instagram\.com\/)([A-Za-z0-9_.]{2,30})/g) || []))).slice(0, 20);
  return { emails, phones, sites, instagram };
}

async function fetchText(url: string, timeoutMs = 20000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'text/html,*/*' }, signal: ctrl.signal });
    const body = await res.text();
    return { ok: res.ok, status: res.status, body };
  } finally {
    clearTimeout(t);
  }
}

async function scrapeUrl(url: string) {
  // 1ª tentativa: leitor de texto (renderiza e limpa). 2ª: fetch cru + strip.
  try {
    const reader = await fetchText(`https://r.jina.ai/${url.startsWith('http') ? url : `https://${url}`}`);
    if (reader.ok && reader.body.length > 200) {
      const text = reader.body.slice(0, 12000);
      return { url, text, contacts: extractContacts(reader.body) };
    }
  } catch (_) { /* fallback */ }
  const raw = await fetchText(url.startsWith('http') ? url : `https://${url}`);
  const text = stripHtml(raw.body);
  return { url, status: raw.status, text: text.slice(0, 12000), contacts: extractContacts(raw.body) };
}

async function webSearch(query: string, limit = 8) {
  const res = await fetchText(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`);
  const out: { title: string; url: string; snippet: string }[] = [];
  const re = /<a[^>]+class="result__a"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?class="result__snippet"[^>]*>([\s\S]*?)<\/a>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(res.body)) && out.length < limit) {
    let url = m[1];
    const dd = url.match(/uddg=([^&]+)/);
    if (dd) url = decodeURIComponent(dd[1]);
    out.push({ url, title: stripHtml(m[2]), snippet: stripHtml(m[3]) });
  }
  if (!out.length) {
    // fallback simples: lista de links
    const links = Array.from(new Set((res.body.match(/https?:\/\/[^\s"'<>)]+/g) || []))).slice(0, limit);
    return links.map((u) => ({ url: u, title: u, snippet: '' }));
  }
  return out;
}

async function findPlaces(query: string, location: string, limit = 15) {
  const q = `${query} ${location}`.trim();
  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&extratags=1&limit=${limit}&countrycodes=br&q=${encodeURIComponent(q)}`;
  const res = await fetchText(url);
  let data: any[] = [];
  try { data = JSON.parse(res.body); } catch (_) { data = []; }
  return data.map((p) => ({
    name: p.display_name?.split(',')[0] ?? p.name,
    address: p.display_name,
    lat: p.lat,
    lon: p.lon,
    phone: p.extratags?.phone || p.extratags?.['contact:phone'] || null,
    website: p.extratags?.website || p.extratags?.['contact:website'] || null,
    email: p.extratags?.email || p.extratags?.['contact:email'] || null,
    category: p.type,
  }));
}

/* ---------------------------------- prompt ---------------------------------- */

function buildSystemPrompt(agent: any, team: any[], tasks: any[]) {
  const perms = agent.permissions || {};
  const allowed = Object.entries(perms).filter(([, v]) => v).map(([k]) => k);
  const scraping = agent.scraping || {};
  return [
    `Você é "${agent.name}", agente autônomo com o cargo de ${agent.class_name} (nível ${agent.level}) da família/time "${agent.family}".`,
    agent.description ? `Resumo: ${agent.description}` : '',
    agent.instructions ? `Instruções permanentes do dono:\n${agent.instructions}` : '',
    Array.isArray(agent.duties) && agent.duties.length ? `Obrigações: ${agent.duties.join('; ')}` : '',
    allowed.length ? `Permissões concedidas: ${allowed.join(', ')}.` : 'Sem permissões externas.',
    scraping?.enabled
      ? `Captura na web ativa. Fontes preferidas: ${(scraping.sources || []).join(', ') || 'livre'}. Termos: ${(scraping.queries || []).join(', ') || 'definidos na tarefa'}. Região: ${scraping.location || 'não definida'}. Máximo de resultados por rodada: ${scraping.max_results || 20}.`
      : 'Captura na web desativada: não use as ferramentas de busca/scraping.',
    tasks.length
      ? `Tarefas em aberto (respeite os prazos):\n${tasks.map((t) => `- ${t.title} (prazo: ${t.due_at ? new Date(t.due_at).toLocaleString('pt-BR') : `${t.deadline_minutes} min`})`).join('\n')}`
      : '',
    team.length ? `Agentes subordinados: ${team.map((t) => `${t.name} (${t.class_name})`).join(', ')}.` : '',
    agent.can_spawn
      ? `Você pode criar até ${agent.max_helpers || 3} ajudantes com a ferramenta spawn_helper quando o trabalho for grande demais para você sozinho.`
      : 'Você não pode criar ajudantes.',
    'REGRAS DE OURO:',
    '1. NUNCA pergunte de volta ao dono. Decida sozinho com base nas instruções e execute.',
    '2. Se faltar informação, descubra usando as ferramentas (busca, scraping, maps). Nunca invente dados.',
    '3. Sempre entregue o resultado final estruturado: o que foi feito, dados capturados (nome, telefone, e-mail, site), próximos passos e prazo cumprido.',
    '4. Respeite os prazos: entregue dentro do tempo pedido e registre tarefas com create_task quando algo ficar para depois.',
    '5. Responda em português do Brasil, objetivo e executável.',
  ].filter(Boolean).join('\n\n');
}

/* --------------------------------- execução --------------------------------- */

function buildTools(sb: any, agent: any, key: string, userId: string | null) {
  const perms = agent.permissions || {};
  const scraping = agent.scraping || {};
  const tools: Record<string, any> = {};

  if (perms.web_search || scraping.enabled) {
    tools.web_search = tool({
      description: 'Pesquisa na web e retorna títulos, links e trechos.',
      inputSchema: z.object({ query: z.string(), limit: z.number().optional() }),
      execute: async ({ query, limit }) => await webSearch(query, limit ?? 8),
    });
    tools.scrape_url = tool({
      description: 'Abre uma URL, limpa o HTML e devolve o texto e os contatos encontrados (e-mails, telefones, sites, instagram).',
      inputSchema: z.object({ url: z.string() }),
      execute: async ({ url }) => await scrapeUrl(url),
    });
    tools.find_places = tool({
      description: 'Busca estabelecimentos no mapa (OpenStreetMap) por tipo de negócio e cidade/bairro, retornando endereço, telefone e site quando existir.',
      inputSchema: z.object({ query: z.string(), location: z.string(), limit: z.number().optional() }),
      execute: async ({ query, location, limit }) => await findPlaces(query, location, limit ?? 15),
    });
    tools.extract_contacts = tool({
      description: 'Extrai e-mails, telefones, sites e perfis de instagram de um texto já capturado.',
      inputSchema: z.object({ text: z.string() }),
      execute: async ({ text }) => extractContacts(text),
    });
  }

  if (perms.create_tasks) {
    tools.create_task = tool({
      description: 'Registra uma tarefa do agente com prazo em minutos.',
      inputSchema: z.object({
        title: z.string(),
        details: z.string().optional(),
        deadline_minutes: z.number().optional(),
        priority: z.string().optional(),
      }),
      execute: async ({ title, details, deadline_minutes, priority }) => {
        const mins = deadline_minutes ?? agent.default_deadline_minutes ?? 60;
        const { data, error } = await sb.from('brain_agent_tasks').insert({
          company_id: agent.company_id,
          user_id: userId,
          agent_id: agent.id,
          title,
          details: details ?? '',
          deadline_minutes: mins,
          due_at: new Date(Date.now() + mins * 60000).toISOString(),
          priority: priority ?? 'normal',
        }).select('id,title,due_at').single();
        return error ? { error: error.message } : data;
      },
    });
  }

  if (perms.read_data) {
    tools.read_clients = tool({
      description: 'Lê clientes já cadastrados no CRM da empresa (para não duplicar contatos).',
      inputSchema: z.object({ search: z.string().optional(), limit: z.number().optional() }),
      execute: async ({ search, limit }) => {
        let q = sb.from('clients').select('id,name,email,phone').eq('company_id', agent.company_id).limit(limit ?? 25);
        if (search) q = q.ilike('name', `%${search}%`);
        const { data, error } = await q;
        return error ? { error: error.message } : data;
      },
    });
    tools.save_lead = tool({
      description: 'Salva um lead capturado como cliente no CRM.',
      inputSchema: z.object({
        name: z.string(),
        phone: z.string().optional(),
        email: z.string().optional(),
        notes: z.string().optional(),
      }),
      execute: async ({ name, phone, email, notes }) => {
        const { data, error } = await sb.from('clients').insert({
          company_id: agent.company_id,
          user_id: agent.user_id,
          name,
          phone: phone ?? null,
          email: email ?? null,
          notes: notes ?? `Captado pelo agente ${agent.name}`,
        }).select('id,name').single();
        return error ? { error: error.message } : data;
      },
    });
  }

  if (perms.send_messages) {
    tools.send_whatsapp = tool({
      description: 'Envia uma mensagem de WhatsApp para um número usando a sessão conectada da empresa.',
      inputSchema: z.object({ phone: z.string(), message: z.string() }),
      execute: async ({ phone, message }) => {
        const { data: session } = await sb
          .from('whatsapp_sessions')
          .select('id')
          .eq('company_id', agent.company_id)
          .eq('status', 'connected')
          .limit(1)
          .maybeSingle();
        if (!session) return { error: 'Nenhuma sessão de WhatsApp conectada.' };
        const res = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/whatsapp-api`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
          },
          body: JSON.stringify({ action: 'send_message', sessionId: session.id, phone, message, manualTakeover: false }),
        });
        const body = await res.text();
        return { status: res.status, response: body.slice(0, 500) };
      },
    });
  }

  if (agent.can_spawn) {
    tools.spawn_helper = tool({
      description: 'Cria um agente ajudante subordinado, já conectado a você na teia.',
      inputSchema: z.object({
        name: z.string(),
        class_name: z.string().optional(),
        instructions: z.string(),
        description: z.string().optional(),
      }),
      execute: async ({ name, class_name, instructions, description }) => {
        const { count } = await sb
          .from('brain_agents')
          .select('id', { count: 'exact', head: true })
          .eq('company_id', agent.company_id)
          .eq('family', agent.family)
          .gt('level', agent.level);
        if ((count ?? 0) >= (agent.max_helpers || 3)) return { error: 'Limite de ajudantes atingido.' };
        const { data, error } = await sb.from('brain_agents').insert({
          company_id: agent.company_id,
          user_id: agent.user_id,
          name,
          description: description ?? `Ajudante criado por ${agent.name}`,
          color: agent.color,
          icon: agent.icon,
          class_name: class_name ?? 'Executor',
          level: agent.level + 1,
          family: agent.family,
          instructions,
          duties: [],
          permissions: agent.permissions,
          scraping: agent.scraping,
          autonomy: agent.autonomy,
          default_deadline_minutes: agent.default_deadline_minutes,
          link_mode: 'attach_to',
          execution_mode: 'manual',
          position_x: (agent.position_x ?? 400) + 120 + Math.random() * 80,
          position_y: (agent.position_y ?? 300) + 120 + Math.random() * 80,
        }).select('id,name').single();
        if (error) return { error: error.message };
        await sb.from('brain_agent_links').insert({
          company_id: agent.company_id,
          source_id: agent.id,
          target_id: data.id,
          link_type: 'hierarchy',
        });
        return data;
      },
    });
  }

  return tools;
}

async function runOne(sb: any, key: string, agent: any, task: string, team: any[], userId: string | null, deadlineMinutes: number) {
  const started = Date.now();
  const { data: run } = await sb.from('brain_agent_runs').insert({
    company_id: agent.company_id,
    agent_id: agent.id,
    triggered_by: userId,
    input: task,
    status: 'running',
  }).select('id').single();

  try {
    const { data: openTasks } = await sb
      .from('brain_agent_tasks')
      .select('title,due_at,deadline_minutes')
      .eq('agent_id', agent.id)
      .eq('status', 'pending')
      .limit(20);

    const result = streamText({
      model: gateway(key)(MODEL),
      system: buildSystemPrompt(agent, team, openTasks || []),
      prompt: `${task}\n\nPrazo para entregar este trabalho: ${deadlineMinutes} minutos (até ${new Date(Date.now() + deadlineMinutes * 60000).toLocaleString('pt-BR')}). Execute agora, sem perguntar nada.`,
      tools: buildTools(sb, agent, key, userId),
      stopWhen: stepCountIs(50),
    });
    const text = await result.text;

    await sb.from('brain_agent_runs').update({
      output: text, status: 'success', duration_ms: Date.now() - started,
    }).eq('id', run?.id);
    await sb.from('brain_agents').update({
      last_executed_at: new Date().toISOString(), status: 'idle',
    }).eq('id', agent.id);

    return { agent_id: agent.id, agent_name: agent.name, output: text, status: 'success' };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await sb.from('brain_agent_runs').update({
      status: 'error', error: message, duration_ms: Date.now() - started,
    }).eq('id', run?.id);
    await sb.from('brain_agents').update({ status: 'idle' }).eq('id', agent.id);
    return { agent_id: agent.id, agent_name: agent.name, error: message, status: 'error' };
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const key = Deno.env.get('LOVABLE_API_KEY');
    if (!key) {
      return new Response(JSON.stringify({ error: 'LOVABLE_API_KEY não configurada' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json().catch(() => ({}));
    const agentId = typeof body.agent_id === 'string' ? body.agent_id : '';
    const task = typeof body.task === 'string' && body.task.trim() ? body.task.trim() : '';
    const cascade = body.cascade === true;
    const deadlineMinutes = Number(body.deadline_minutes) > 0 ? Number(body.deadline_minutes) : 0;
    if (!agentId || !task) {
      return new Response(JSON.stringify({ error: 'agent_id e task são obrigatórios' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    const authHeader = req.headers.get('Authorization') || '';
    const token = authHeader.replace('Bearer ', '');
    const { data: userData } = await sb.auth.getUser(token);
    const userId = userData?.user?.id ?? null;
    if (!userId) {
      return new Response(JSON.stringify({ error: 'Não autenticado' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: agent } = await sb.from('brain_agents').select('*').eq('id', agentId).maybeSingle();
    if (!agent) {
      return new Response(JSON.stringify({ error: 'Agente não encontrado' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: membership } = await sb
      .from('company_users')
      .select('company_id')
      .eq('user_id', userId)
      .eq('company_id', agent.company_id)
      .maybeSingle();
    if (!membership) {
      return new Response(JSON.stringify({ error: 'Sem permissão para este agente' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: links } = await sb
      .from('brain_agent_links')
      .select('target_id')
      .eq('company_id', agent.company_id)
      .eq('source_id', agent.id);
    const childIds = (links || []).map((l: any) => l.target_id);
    const { data: children } = childIds.length
      ? await sb.from('brain_agents').select('*').in('id', childIds).gt('level', agent.level)
      : { data: [] as any[] };

    const minutes = deadlineMinutes || agent.default_deadline_minutes || 60;

    await sb.from('brain_agents').update({ status: 'executing' }).eq('id', agent.id);
    const lead = await runOne(sb, key, agent, task, children || [], userId, minutes);

    const results = [lead];
    if (cascade && (children || []).length && lead.status === 'success') {
      for (const child of children!) {
        const subTask = `Tarefa original do time: ${task}\n\nOrientação do seu superior (${agent.name}):\n${lead.output}\n\nExecute a sua parte conforme o seu cargo, dentro do prazo.`;
        results.push(await runOne(sb, key, child, subTask, [], userId, minutes));
      }
    }

    return new Response(JSON.stringify({ output: lead.output ?? null, results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ error: message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
