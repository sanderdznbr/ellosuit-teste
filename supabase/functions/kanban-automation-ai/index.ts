import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'

interface Message { role: 'user' | 'assistant'; content: string }
interface KanbanColumn { id: string; title: string; color: string }

const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY')!

const SYSTEM = `Você é um assistente que ajuda a criar REGRAS DE AUTOMAÇÃO para um pipeline (Kanban) de WhatsApp.

Cada regra roteia um lead que chega de uma ORIGEM para uma COLUNA do funil.

Origens suportadas (sourceType):
- "meta_ad"    → Anúncio do Meta (Facebook/Instagram). sourceValue = ID do anúncio ou nome da campanha.
- "meta_pixel" → Evento do Meta Pixel. sourceValue = nome do evento (ex: "Lead", "Purchase").
- "webhook"    → Webhook externo. sourceValue = identificador único do webhook.
- "utm"        → Parâmetro UTM. sourceValue = ex: "utm_source=facebook" ou "utm_campaign=black".
- "keyword"    → Palavra-chave na 1ª mensagem. sourceValue = palavra/frase.

Regras de conversa:
- Responda SEMPRE em português, curto, direto e amigável.
- Faça no MÁXIMO 1 pergunta por vez para descobrir: origem, valor da origem, coluna de destino e um nome curto pra regra.
- Quando o usuário confirmar OU você tiver as 4 informações, proponha a(s) regra(s) e SEMPRE inclua no final um bloco:
  \`\`\`json
  { "rules": [ { "name": "...", "sourceType": "meta_ad", "sourceValue": "...", "targetStage": "<column_id>", "enabled": true } ] }
  \`\`\`
- Só use ids de coluna que existirem em "Colunas atuais". Se o usuário mencionar uma coluna que não existe, sugira a mais próxima e pergunte.
- Se ainda estiver perguntando, NÃO retorne JSON.
- Pode retornar múltiplas regras num único bloco se o usuário pedir várias.`

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const body = await req.json() as {
      messages?: Message[];
      currentColumns?: KanbanColumn[];
      currentRules?: any[];
    }

    const messages = body.messages ?? []
    if (!Array.isArray(messages)) {
      return new Response(JSON.stringify({ error: 'messages required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const context = `Colunas atuais:\n${JSON.stringify(body.currentColumns ?? [], null, 2)}\n\nRegras já existentes:\n${JSON.stringify(body.currentRules ?? [], null, 2)}`

    const res = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${LOVABLE_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: SYSTEM },
          { role: 'system', content: context },
          ...messages,
        ],
      }),
    })

    if (!res.ok) {
      const text = await res.text()
      if (res.status === 429) {
        return new Response(JSON.stringify({ error: 'rate_limit', detail: 'Muitas requisições. Tente novamente em instantes.' }), { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }
      if (res.status === 402) {
        return new Response(JSON.stringify({ error: 'no_credits', detail: 'Créditos de IA esgotados.' }), { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }
      return new Response(JSON.stringify({ error: 'ai_error', detail: text }), { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const data = await res.json()
    const content: string = data?.choices?.[0]?.message?.content ?? ''

    let proposedRules: any[] | null = null
    const match = content.match(/```json\s*([\s\S]*?)```/i)
    if (match) {
      try {
        const parsed = JSON.parse(match[1])
        if (Array.isArray(parsed?.rules)) proposedRules = parsed.rules
      } catch (_) { /* ignore */ }
    }

    const clean = content.replace(/```json[\s\S]*?```/gi, '').trim()

    return new Response(JSON.stringify({ reply: clean || 'Certo!', proposedRules }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})