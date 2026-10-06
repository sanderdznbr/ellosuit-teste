// CRM Satisfação AI — dynamic gain/loss analysis with AI-chosen topics
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { chatCompletion } from '../_shared/llm.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Msg {
  from_me: boolean;
  content: string | null;
  timestamp?: string | null;
  media_type?: string | null;
  media_caption?: string | null;
}

function buildTranscript(contactName: string, msgs: Msg[]) {
  const name = (contactName || 'Cliente').toUpperCase();
  return msgs
    .filter((m) => (m.content && m.content.trim()) || m.media_type)
    .slice(-30)
    .map((m) => {
      const who = m.from_me ? 'ATENDENTE' : name;
      const text = m.content || (m.media_caption || `[${(m.media_type || 'mídia').toUpperCase()}]`);
      return `${who}: ${text}`;
    })
    .join('\n');
}

const SYSTEM = `Você é um analista sênior de satisfação de clientes via WhatsApp para PMEs brasileiras.
Sua função é ler amostras REAIS de conversas e produzir uma análise executiva, honesta e acionável.

REGRAS CRÍTICAS:
- Português brasileiro, tom executivo, direto, sem jargão.
- NUNCA cite "IA", "Ellosuit", marcas de plataforma.
- Os TÓPICOS não são fixos. Você DEVE inferir 3 a 6 tópicos que realmente aparecem nas conversas do negócio analisado (ex.: taxa de agendamento, taxa de reembolso, taxa de dúvidas técnicas, taxa de reclamações, taxa de fechamento, taxa de resposta rápida, etc.). Escolha os mais relevantes.
- Baseie percentuais em contagem aproximada de conversas que evidenciam o tópico dividido pelo total analisado. Nunca invente números precisos; use múltiplos de 5 quando incerto.
- Classifique cada tópico como "gain" (positivo para o negócio) ou "loss" (atrito, risco, perda) ou "neutral".
- Responda SOMENTE JSON válido (sem markdown, sem \`\`\`), com este schema exato:
{
  "overall_score": number (0-100),
  "sentiment": "positivo" | "neutro" | "negativo",
  "summary": string (2-3 frases executivas),
  "topics": [
    { "label": string, "rate": number (0-100), "type": "gain"|"loss"|"neutral", "insight": string (1 frase) }
  ],
  "gains": [ string ],
  "losses": [ string ],
  "recommendations": [ string ]
}`;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const { companyId, limit = 50, force = false } = await req.json();
    if (!companyId) {
      return new Response(JSON.stringify({ error: 'companyId required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    if (!OPENAI_API_KEY) throw new Error('OPENAI_API_KEY not configured');

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Return cached analysis if newer than 12h and not forced
    if (!force) {
      const { data: cached } = await supabase
        .from('crm_satisfaction_analyses')
        .select('*')
        .eq('company_id', companyId)
        .order('generated_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (cached && cached.generated_at) {
        const ageMs = Date.now() - new Date(cached.generated_at).getTime();
        if (ageMs < 12 * 60 * 60 * 1000) {
          return new Response(JSON.stringify({
            ...(cached.data || {}),
            analyzed_conversations: cached.analyzed_conversations,
            generated_at: cached.generated_at,
            cached: true,
          }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
      }
    }

    // Pull most recently active conversations
    const { data: convs, error: convErr } = await supabase
      .from('whatsapp_conversations')
      .select('id, contact_name, contact_phone, last_message_at')
      .eq('company_id', companyId)
      .order('last_message_at', { ascending: false })
      .limit(Math.min(Math.max(Number(limit) || 50, 10), 100));
    if (convErr) throw convErr;

    const convList = convs || [];
    if (convList.length === 0) {
      return new Response(JSON.stringify({
        empty: true,
        message: 'Sem conversas suficientes para análise. Comece a atender clientes no WhatsApp e volte aqui.',
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // For each conversation, fetch last messages (capped)
    const transcripts: string[] = [];
    for (const c of convList) {
      const { data: msgs } = await supabase
        .from('whatsapp_messages')
        .select('from_me, content, timestamp, media_type, media_caption')
        .eq('conversation_id', c.id)
        .order('timestamp', { ascending: true })
        .limit(30);
      const t = buildTranscript(c.contact_name || c.contact_phone, (msgs || []) as Msg[]);
      if (t.trim().length > 0) {
        transcripts.push(`=== Conversa com ${c.contact_name || c.contact_phone} ===\n${t}`);
      }
    }

    // Cap total prompt size ~ 60k chars
    let joined = transcripts.join('\n\n');
    if (joined.length > 60000) joined = joined.slice(0, 60000);

    const userPrompt = `Analise ${transcripts.length} conversas reais de WhatsApp deste negócio e produza o JSON conforme instruído.

CONVERSAS:
${joined}`;

    const resp = await chatCompletion({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: SYSTEM },
          { role: 'user', content: userPrompt },
        ],
        response_format: { type: 'json_object' },
      });

    if (!resp.ok) {
      const txt = await resp.text();
      if (resp.status === 429) {
        return new Response(JSON.stringify({ error: 'Limite de requisições. Tente novamente em alguns segundos.' }), { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      if (resp.status === 402) {
        return new Response(JSON.stringify({ error: 'Créditos de IA insuficientes.' }), { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      throw new Error(`AI gateway error ${resp.status}: ${txt}`);
    }

    const data = await resp.json();
    const raw = data.choices?.[0]?.message?.content?.trim() || '{}';
    const cleaned = raw.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '').trim();
    let parsed: any = {};
    try { parsed = JSON.parse(cleaned); } catch (e) { console.error('parse error', e, raw); }

    const generated_at = new Date().toISOString();
    const payload = { ...parsed, analyzed_conversations: transcripts.length, generated_at };

    // Persist
    try {
      await supabase.from('crm_satisfaction_analyses').insert({
        company_id: companyId,
        data: parsed,
        analyzed_conversations: transcripts.length,
        generated_at,
      });
    } catch (persistErr) {
      console.warn('persist failed', persistErr);
    }

    return new Response(JSON.stringify(payload), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('crm-satisfaction-ai error:', e);
    const msg = e instanceof Error ? e.message : 'Erro interno';
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});