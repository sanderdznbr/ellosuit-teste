import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'
import { chatCompletion } from '../_shared/llm.ts';

interface Message { role: 'user' | 'assistant'; content: string }
interface KanbanColumn { id: string; title: string; color: string }
interface ClassifyConv {
  id: string;
  contact_name?: string | null;
  last_message?: string | null;
  current_stage?: string | null;
  bot_active?: boolean;
  human_takeover?: boolean;
}


const SYSTEM = `Você é um assistente que ajuda a organizar pipelines de vendas (Kanban) para times de atendimento no WhatsApp.

Sua função é conversar em português com o usuário para entender como ele quer organizar as colunas do funil e, quando ele confirmar, propor uma nova estrutura de colunas.

Regras:
- Sempre responda em texto natural, curto e amigável.
- Quando o usuário confirmar/pedir para aplicar, ou quando você tiver clareza suficiente, SEMPRE inclua no final da resposta um bloco JSON dentro de \`\`\`json ... \`\`\` com o formato:
  { "columns": [ { "id": "slug_minusculo", "title": "Nome Exibido", "color": "#HEXCODE" } ] }
- IDs devem ser slugs em snake_case (ex: "novos_leads", "qualificado").
- Use no máximo 8 colunas. Cores devem ser HEX vibrantes distintos.
- Se ainda estiver perguntando, NÃO retorne JSON — só quando propor a estrutura final.
- Nunca invente colunas sem perguntar antes se o usuário não deu detalhes.`

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const body = await req.json() as {
      mode?: 'chat' | 'classify';
      messages?: Message[];
      currentColumns?: KanbanColumn[];
      columns?: KanbanColumn[];
      conversations?: ClassifyConv[];
    }

    // --- CLASSIFY MODE: distribute existing conversations across the new columns ---
    if (body.mode === 'classify') {
      const cols = body.columns ?? []
      const convs = body.conversations ?? []
      if (!cols.length || !convs.length) {
        return new Response(JSON.stringify({ assignments: [] }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }

      const CLASSIFY_SYSTEM = `Você classifica conversas de WhatsApp de vendas em colunas de um funil (Kanban).
Receberá:
- As colunas disponíveis (id + título).
- Uma lista de conversas com: nome do contato, última mensagem, coluna atual, e ESTADO DE ATENDIMENTO:
  * bot_active=true  => a conversa está sendo atendida PELO CHATBOT (IA).
  * human_takeover=true => um humano assumiu, o bot está PAUSADO.
- Um "critério" opcional do usuário (histórico do chat) descrevendo como distribuir.

Regras de decisão:
- Se o usuário disser algo como "coloque na coluna X só os que estão com CHATBOT/IA", use bot_active=true e human_takeover=false para escolher.
- Se disser "somente humano/atendente", use human_takeover=true.
- Se o critério não mencionar bot/humano, use o conteúdo da última mensagem + título da coluna para inferir o estágio de vendas.
- Toda conversa deve receber uma coluna. Use SOMENTE os ids fornecidos. Em dúvida, escolha a coluna mais próxima de "novo/lead".

Responda APENAS um bloco JSON no formato:
\`\`\`json
{ "assignments": [ { "id": "<conversation_id>", "stage": "<column_id>" } ] }
\`\`\``

      const criteria = (body.messages ?? [])
        .filter(m => m.role === 'user')
        .map(m => m.content)
        .join('\n')

      const userPayload = JSON.stringify({
        columns: cols.map(c => ({ id: c.id, title: c.title })),
        criteria: criteria || null,
        conversations: convs.slice(0, 200),
      })

      const res = await chatCompletion({
          model: 'google/gemini-2.5-flash',
          messages: [
            { role: 'system', content: CLASSIFY_SYSTEM },
            { role: 'user', content: userPayload },
          ],
        })
      if (!res.ok) {
        const t = await res.text()
        return new Response(JSON.stringify({ error: 'ai_error', detail: t }), { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }
      const data = await res.json()
      const content: string = data?.choices?.[0]?.message?.content ?? ''
      let assignments: { id: string; stage: string }[] = []
      const m = content.match(/```json\s*([\s\S]*?)```/i) ?? content.match(/(\{[\s\S]*\})/)
      if (m) {
        try {
          const parsed = JSON.parse(m[1])
          if (Array.isArray(parsed?.assignments)) {
            const validIds = new Set(cols.map(c => c.id))
            assignments = parsed.assignments.filter((a: any) => a?.id && validIds.has(a?.stage))
          }
        } catch (_) { /* ignore */ }
      }
      // Fallback: everything into first column
      if (!assignments.length) {
        assignments = convs.map(c => ({ id: c.id, stage: cols[0].id }))
      }
      return new Response(JSON.stringify({ assignments }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // --- CHAT MODE (default) ---
    const messages = body.messages ?? []
    const currentColumns = body.currentColumns ?? []
    if (!Array.isArray(messages)) {
      return new Response(JSON.stringify({ error: 'messages required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const context = `Colunas atuais do pipeline:\n${JSON.stringify(currentColumns ?? [], null, 2)}`

    const res = await chatCompletion({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: SYSTEM },
          { role: 'system', content: context },
          ...messages,
        ],
      })

    if (!res.ok) {
      const text = await res.text()
      return new Response(JSON.stringify({ error: 'ai_error', detail: text }), { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const data = await res.json()
    const content: string = data?.choices?.[0]?.message?.content ?? ''

    // Extract JSON block
    let proposedColumns: KanbanColumn[] | null = null
    const match = content.match(/```json\s*([\s\S]*?)```/i)
    if (match) {
      try {
        const parsed = JSON.parse(match[1])
        if (Array.isArray(parsed?.columns)) proposedColumns = parsed.columns
      } catch (_) { /* ignore */ }
    }

    const clean = content.replace(/```json[\s\S]*?```/gi, '').trim()

    return new Response(JSON.stringify({ reply: clean || 'Aqui está a proposta.', proposedColumns }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})