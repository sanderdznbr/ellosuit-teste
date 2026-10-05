import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'

const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY')!
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const STAGES = ['frio', 'morno', 'quente', 'negociando', 'pagou', 'perdido'] as const

const SYSTEM = `Você classifica conversas de WhatsApp de vendas por TEMPERATURA do lead.

Estágios disponíveis (use SOMENTE estes ids):
- "frio": contato inicial, sem interesse demonstrado, curioso, ou apenas recebeu mensagem e não engajou.
- "morno": demonstrou algum interesse, fez perguntas genéricas, pediu informações, mas sem sinal de compra.
- "quente": forte interesse, perguntou preço/condições/formas de pagamento, pediu link, disse que quer comprar.
- "negociando": em negociação ativa — discutindo valores, cupom, frete, prazo, fechamento.
- "pagou": confirmou pagamento, enviou comprovante, disse que pagou/comprou/finalizou pedido.
- "perdido": disse explicitamente que não tem interesse, pediu para parar, xingou, ou é assunto totalmente desconexo/spam.

Regras:
- Baseie-se no CONTEÚDO das mensagens recentes (do cliente e do atendente).
- Use também o campo "lead_score" (0-100) quando existir: >= 80 => no mínimo "quente"; 55-79 => no mínimo "morno"; abaixo de 40 pode ser "frio".
- Se houver QUALQUER resposta do CLIENTE, a conversa NÃO pode ser "frio" — no mínimo "morno".
- Só use "frio" quando o cliente nunca respondeu nada.
- Toda conversa deve receber exatamente um estágio.

Responda APENAS um bloco JSON:
\`\`\`json
{ "assignments": [ { "id": "<conversation_id>", "stage": "<frio|morno|quente|negociando|pagou|perdido>" } ] }
\`\`\``

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const body = await req.json() as { companyId?: string; conversationIds?: string[] }
    const supabase = createClient(SUPABASE_URL, SERVICE_KEY)

    // Fetch target conversations
    let q = supabase
      .from('whatsapp_conversations')
      .select('id, contact_name, contact_phone, last_message, temperature_stage, lead_score_data')
      .limit(200)
    if (body.conversationIds?.length) {
      q = q.in('id', body.conversationIds.slice(0, 200))
    } else if (body.companyId) {
      q = q.eq('company_id', body.companyId).order('last_message_at', { ascending: false })
    } else {
      return new Response(JSON.stringify({ error: 'companyId or conversationIds required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    const { data: convs, error: convErr } = await q
    if (convErr) throw convErr
    if (!convs?.length) {
      return new Response(JSON.stringify({ assignments: [], updated: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Fetch last messages per conversation (batched)
    const ids = convs.map(c => c.id)
    const byConv = new Map<string, Array<{ content: string; from_me: boolean }>>()
    const CHUNK = 25
    for (let i = 0; i < ids.length; i += CHUNK) {
      const chunk = ids.slice(i, i + CHUNK)
      const { data: msgs, error: msgErr } = await supabase
        .from('whatsapp_messages')
        .select('conversation_id, content, media_caption, from_me, created_at')
        .in('conversation_id', chunk)
        .order('created_at', { ascending: false })
        .limit(600)
      if (msgErr) console.error('messages fetch error', msgErr.message)
      for (const m of msgs || []) {
        const arr = byConv.get(m.conversation_id) || []
        const text = (m.content || m.media_caption || '').trim()
        if (text && arr.length < 12) arr.push({ content: text.slice(0, 300), from_me: !!m.from_me })
        byConv.set(m.conversation_id, arr)
      }
    }

    const scoreOf = (c: any): number | null => {
      const d = c.lead_score_data
      if (!d) return null
      const v = typeof d === 'object' ? (d.score ?? d.total ?? d.value) : null
      return typeof v === 'number' ? v : null
    }

    const payload = convs.map(c => ({
      id: c.id,
      contact_name: c.contact_name || c.contact_phone || '',
      lead_score: scoreOf(c),
      last_message: (c.last_message || '').slice(0, 300),
      messages: (byConv.get(c.id) || [])
        .reverse()
        .map(m => `${m.from_me ? 'ATENDENTE' : 'CLIENTE'}: ${m.content}`),
    }))

    console.log('classifier payload', JSON.stringify({
      conversations: payload.length,
      withMessages: payload.filter(p => p.messages.length > 0).length,
    }))

    const classifyBatch = async (batch: typeof payload): Promise<Array<{ id: string; stage: string }>> => {
      const aiRes = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${LOVABLE_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'google/gemini-2.5-flash',
          messages: [
            { role: 'system', content: SYSTEM },
            { role: 'user', content: JSON.stringify({ conversations: batch }) },
          ],
          temperature: 0,
        }),
      })
      if (!aiRes.ok) {
        const txt = await aiRes.text()
        console.error(`AI gateway error ${aiRes.status}: ${txt.slice(0, 200)}`)
        return []
      }
      const aiData = await aiRes.json()
      const raw: string = aiData.choices?.[0]?.message?.content || ''
      const match = raw.match(/```json\s*([\s\S]*?)```/) || raw.match(/(\{[\s\S]*\})/)
      if (!match) return []
      try {
        const parsed = JSON.parse(match[1])
        return (parsed.assignments || []) as Array<{ id: string; stage: string }>
      } catch {
        return []
      }
    }

    // Batch in small groups so the model never truncates its output
    const BATCH = 20
    const batches: Array<typeof payload> = []
    for (let i = 0; i < payload.length; i += BATCH) batches.push(payload.slice(i, i + BATCH))

    const assignments: Array<{ id: string; stage: string }> = []
    const CONCURRENCY = 4
    for (let i = 0; i < batches.length; i += CONCURRENCY) {
      const results = await Promise.all(batches.slice(i, i + CONCURRENCY).map(classifyBatch))
      for (const r of results) assignments.push(...r)
    }

    // Deterministic fallback for anything the model skipped
    const assigned = new Set(assignments.filter(a => STAGES.includes(a.stage as any)).map(a => a.id))
    for (const p of payload) {
      if (assigned.has(p.id)) continue
      const clientReplies = p.messages.filter(m => m.startsWith('CLIENTE:')).length
      const score = p.lead_score ?? 0
      let stage: string = 'frio'
      if (score >= 80 || clientReplies >= 4) stage = 'quente'
      else if (score >= 55 || clientReplies >= 2) stage = 'morno'
      else if (clientReplies >= 1) stage = 'morno'
      assignments.push({ id: p.id, stage })
    }

    // Group by stage and update
    const byStage = new Map<string, string[]>()
    for (const a of assignments) {
      if (!STAGES.includes(a.stage as any)) continue
      if (!byStage.has(a.stage)) byStage.set(a.stage, [])
      byStage.get(a.stage)!.push(a.id)
    }
    let updated = 0
    for (const [stage, stageIds] of byStage.entries()) {
      for (let i = 0; i < stageIds.length; i += 100) {
        const slice = stageIds.slice(i, i + 100)
        const { error } = await supabase
          .from('whatsapp_conversations')
          .update({ temperature_stage: stage })
          .in('id', slice)
        if (!error) updated += slice.length
      }
    }


    return new Response(JSON.stringify({ assignments, updated }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message || 'Erro interno' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
