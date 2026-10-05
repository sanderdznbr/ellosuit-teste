// CRM Sales AI - helpers for sales-focused conversation actions
// Actions: suggest_reply | analyze_lead | summary_next_steps | follow_up | lead_score | copilot

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ChatMsg {
  from_me: boolean;
  content: string;
  timestamp?: string;
  media_url?: string | null;
  media_type?: string | null;
  media_caption?: string | null;
}

const BASE_RULES = `Você é um assistente de vendas especialista em WhatsApp B2C/B2B brasileiro.
REGRAS:
- Português brasileiro, natural, sem jargão corporativo.
- Adapte o TOM ao lead: se o lead é direto, seja direto; se é consultivo/curioso, seja consultivo; se está frio, seja acolhedor; se está quente, vá para o fechamento com leve urgência.
- Mensagens curtas, no máximo 3 parágrafos curtos. Use quebras de linha.
- Nunca invente preços, prazos, links, descontos ou políticas que não estejam claramente no histórico.
- Não use emojis em excesso (máx. 1-2 quando fizer sentido).
- Nunca cite "IA", "assistente", "Lovable", "Ellosuit" ou qualquer marca.`;

function buildTranscript(messages: ChatMsg[], contactName?: string) {
  const name = contactName || 'Cliente';
  return messages
    .filter(m => (m.content && m.content.trim()) || m.media_url)
    .slice(-40)
    .map(m => {
      const who = m.from_me ? 'VENDEDOR' : name.toUpperCase();
      let text = m.content || '';
      if (m.media_url) {
        const fname = (m.media_url.split('?')[0].split('/').pop() || 'arquivo');
        const kind = (m.media_type || '').toLowerCase().includes('pdf') || fname.toLowerCase().endsWith('.pdf')
          ? 'PDF'
          : (m.media_type || 'mídia').toUpperCase();
        const caption = m.media_caption ? ` — ${m.media_caption}` : '';
        text = `[ANEXO ${kind}: ${fname}${caption}]${text ? `\n${text}` : ''}`;
      }
      return `${who}: ${text}`;
    })
    .join('\n');
}

function buildPrompt(action: string, transcript: string, contactName?: string) {
  const name = contactName || 'o cliente';
  switch (action) {
    case 'suggest_reply':
      return `${BASE_RULES}

Abaixo está o histórico da conversa com ${name}. Sua tarefa: escrever a PRÓXIMA mensagem que o vendedor deve enviar para avançar a venda. Detecte o estágio (descoberta, consideração, objeção, fechamento, pós-venda) e responda de forma que faça o lead avançar. Se houver uma pergunta aberta do cliente sem resposta, responda primeiro. Se for momento de pedir o sim, peça.

RESPONDA APENAS COM O TEXTO DA MENSAGEM, sem aspas, sem comentários, sem "Vendedor:" no começo.

HISTÓRICO:
${transcript}`;

    case 'analyze_lead':
      return `${BASE_RULES}

Analise o lead com base no histórico abaixo. Responda em Markdown, em português, com EXATAMENTE estas seções:

**🌡️ Temperatura:** Frio / Morno / Quente / Muito quente (uma palavra) — explique em 1 frase.
**🎯 Intenção de compra:** Baixa / Média / Alta — 1 frase.
**🧱 Objeções detectadas:** lista curta (- preço, - prazo, etc.). Se nenhuma, escreva "Nenhuma aparente".
**💡 Dor principal:** 1 frase.
**🪜 Estágio do funil:** Descoberta / Consideração / Decisão / Pós-venda.
**✅ Próximo passo recomendado:** ação concreta em 1 frase.
**📊 Score de fechamento:** X/10.

HISTÓRICO:
${transcript}`;

    case 'summary_next_steps':
      return `${BASE_RULES}

Resuma a conversa abaixo e gere um checklist de follow-up acionável para o vendedor. Formato Markdown:

**📝 Resumo da conversa**
(2-4 frases objetivas: quem é, o que quer, em que ponto parou)

**📌 Pontos-chave**
- ...

**✅ Checklist de follow-up**
- [ ] (ação 1, com prazo sugerido)
- [ ] (ação 2)
- [ ] (ação 3)

**📅 Quando retomar:** sugestão de prazo (ex: amanhã às 10h, em 3 dias).

HISTÓRICO:
${transcript}`;

    case 'follow_up':
      return `${BASE_RULES}

O lead abaixo está parado/sem resposta. Escreva UMA mensagem curta de retomada (follow-up) que:
- Não soe como cobrança.
- Reacenda o interesse referenciando algo específico que ele/ela disse.
- Termine com uma pergunta fácil de responder (sim/não ou escolha entre 2).
- Máximo 4 linhas.

RESPONDA APENAS COM O TEXTO DA MENSAGEM, sem aspas, sem prefixos.

HISTÓRICO:
${transcript}`;

    case 'lead_score':
      return `${BASE_RULES}

Avalie o lead abaixo e devolva um JSON ESTRITO (sem markdown, sem comentários) com este shape exato:

{
  "score": <inteiro 0-100>,
  "tier": "Frio" | "Morno" | "Quente" | "Muito quente",
  "temperature": <inteiro 0-100>,
  "intent": "Baixa" | "Média" | "Alta",
  "suggested_stage": "Novo lead" | "Qualificação" | "Proposta enviada" | "Negociação" | "Fechamento" | "Ganhou" | "Perdeu" | "Pós-venda",
  "confidence": <inteiro 0-100>,
  "reasons": [
    { "label": "Engajamento", "impact": "+" | "-" | "=", "weight": <inteiro 0-30>, "detail": "frase curta explicando" },
    { "label": "Intenção de compra", "impact": "+" | "-" | "=", "weight": <inteiro 0-30>, "detail": "..." },
    { "label": "Orçamento / fit", "impact": "+" | "-" | "=", "weight": <inteiro 0-20>, "detail": "..." },
    { "label": "Objeções", "impact": "+" | "-" | "=", "weight": <inteiro 0-20>, "detail": "..." },
    { "label": "Urgência / prazo", "impact": "+" | "-" | "=", "weight": <inteiro 0-20>, "detail": "..." }
  ],
  "next_action": "1 frase com a próxima ação concreta",
  "stage_reason": "1 frase justificando o estágio sugerido",
  "deal_value": <número em reais SEM símbolo, ou null>,
  "deal_currency": "BRL",
  "deal_reason": "1 frase curta citando de onde veio o valor (ex.: 'proposta PDF anexada', 'cliente citou R$ 2.500 no chat'). null se não houver valor."
}

Regras:
- Some os pesos com sinal para calibrar o score final (0-100).
- Se não houver evidência para um critério, use impact "=" e weight baixo.
- NÃO invente dados que não estão no histórico.
- deal_value: extraia o valor da NEGOCIAÇÃO em reais (BRL) quando aparecer no histórico OU em ANEXOS PDF de proposta/orçamento. Interprete "R$ 2.500,00", "2500 reais", "2,5k", "R$ 2,5 mil" corretamente. Se houver várias faixas, use o valor mais recente/proposto ao cliente. Se não houver evidência clara, use null.
- Responda APENAS com o JSON, sem \`\`\`json.

HISTÓRICO:
${transcript}`;

    case 'copilot':
      return `${BASE_RULES}

Você é o COPILOTO de vendas. Analise a conversa e devolva um JSON ESTRITO (sem markdown, sem comentários) neste shape exato:

{
  "tier": "Frio" | "Morno" | "Quente" | "Muito quente",
  "temperature": <inteiro 0-100>,
  "score": <inteiro 0-100>,
  "intent": "Baixa" | "Média" | "Alta",
  "urgency": "baixa" | "media" | "alta",
  "hot": <true|false>,
  "stage": "Descoberta" | "Consideração" | "Objeção" | "Decisão" | "Fechamento" | "Pós-venda",
  "headline": "1 frase curta (máx 90 chars) resumindo o que o lead quer AGORA",
  "signals": ["até 3 sinais curtos, ex: 'perguntou preço', 'pediu prazo', 'sem resposta há 2 dias'"],
  "objection": "objeção principal em 1 frase, ou null se não houver",
  "next_action": "1 frase com a próxima ação que o VENDEDOR deve tomar",
  "suggested_reply": "mensagem PRONTA para enviar ao cliente agora (2-4 linhas, tom adequado)",
  "confidence": <inteiro 0-100>
}

Regras:
- "hot" = true apenas se tier for "Quente" ou "Muito quente" E urgency não for "baixa".
- "suggested_reply" deve seguir todas as REGRAS acima (sem citar marcas, sem inventar preços/prazos).
- Se a conversa está vazia ou sem sinal, use tier "Frio", score baixo e sugira uma abordagem inicial neutra.
- Responda APENAS com o JSON, sem \`\`\`json.

HISTÓRICO:
${transcript}`;

    default:
      return `${BASE_RULES}\n\nHISTÓRICO:\n${transcript}`;
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const { action, messages, contactName } = await req.json();
    if (!action || !Array.isArray(messages)) {
      return new Response(JSON.stringify({ error: 'action and messages[] are required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) throw new Error('LOVABLE_API_KEY not configured');

    const transcript = buildTranscript(messages, contactName);
    const prompt = buildPrompt(action, transcript, contactName);

    // For lead_score/copilot, also send any PDF attachments to Gemini so it can read proposals/orçamentos
    const userContent: any[] = [{ type: 'text', text: prompt }];
    if (action === 'lead_score' || action === 'copilot') {
      const pdfMsgs = (messages as ChatMsg[])
        .filter(m => {
          if (!m.media_url) return false;
          const mt = (m.media_type || '').toLowerCase();
          const fname = (m.media_url.split('?')[0].split('/').pop() || '').toLowerCase();
          return mt.includes('pdf') || mt.includes('document') || fname.endsWith('.pdf');
        })
        .slice(-3); // cap
      for (const m of pdfMsgs) {
        try {
          const r = await fetch(m.media_url as string);
          if (!r.ok) continue;
          const buf = new Uint8Array(await r.arrayBuffer());
          if (buf.byteLength > 8 * 1024 * 1024) continue; // 8MB cap
          let bin = '';
          const chunk = 0x8000;
          for (let i = 0; i < buf.length; i += chunk) {
            bin += String.fromCharCode(...buf.subarray(i, i + chunk));
          }
          const b64 = btoa(bin);
          const fname = (m.media_url as string).split('?')[0].split('/').pop() || 'proposta.pdf';
          userContent.push({
            type: 'file',
            file: { filename: fname, file_data: `data:application/pdf;base64,${b64}` },
          });
        } catch (err) {
          console.warn('pdf fetch failed', err);
        }
      }
    }

    const resp = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: 'Você é um copiloto de vendas via WhatsApp. Siga as regras à risca.' },
          { role: 'user', content: userContent.length > 1 ? userContent : prompt },
        ],
      }),
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
    const text = data.choices?.[0]?.message?.content?.trim() || '';

    let structured: unknown = null;
    if (action === 'lead_score' || action === 'copilot') {
      try {
        const cleaned = text.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '').trim();
        structured = JSON.parse(cleaned);
      } catch (err) {
        console.error(`${action} parse error:`, err, text);
      }
    }

    return new Response(JSON.stringify({ action, result: text, structured }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('crm-sales-ai error:', e);
    const msg = e instanceof Error ? e.message : 'Erro interno';
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});