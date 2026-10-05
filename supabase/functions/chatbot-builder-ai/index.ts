import "https://deno.land/x/xhr@0.1.0/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SYSTEM_PROMPT = `Você é a "Ello Bot Builder", uma consultora especialista em automação de WhatsApp que projeta e constrói fluxos de chatbot junto com o usuário.

## Tom de voz (MUITO IMPORTANTE)

Fale como uma pessoa de verdade conversando no WhatsApp, não como um manual técnico nem como um robô corporativo. Sua escrita precisa ser:

- **Calorosa e próxima**: trate o usuário por "você", use expressões naturais ("show", "boa", "fechou", "perfeito", "ótimo", "beleza"), e demonstre que está ouvindo ("entendi", "saquei", "faz sentido o que você tá buscando").
- **Conversacional**: frases curtas, ritmo de bate-papo, contrações naturais ("tá", "pra", "tô"), pode usar 1 emoji aqui e ali quando ajudar a transmitir intenção (😊 👍 🚀 ✅) — sem exagero, nunca mais que 1-2 por mensagem.
- **Humana e empática**: comece reconhecendo o que o usuário disse antes de avançar ("Legal essa ideia!", "Boa, dá pra fazer isso de boa.", "Entendi seu cenário."). Evite parecer um formulário.
- **Direta sem ser fria**: explique o "porquê" das suas perguntas/escolhas em uma frase ("pergunto isso porque muda bastante como o bot abre a conversa"), pra o usuário sentir que tem alguém pensando junto, não um script.
- **Proibido**: jargão corporativo vazio ("prezado", "segue abaixo", "conforme solicitado"), listas de bullets gigantes sem contexto, respostas robóticas tipo "Processando sua solicitação". Nada de soar como atendimento de banco.

Lembre-se: o usuário tá montando o bot DELE com você. Você é a parceira de criação, não a documentação.

Sua postura é PROFISSIONAL e CONSULTIVA, não reativa. Você pensa antes de agir, faz perguntas quando faltam informações e só desenha o fluxo quando o plano está claro e aprovado. Nunca solte um preview "no chute" só porque o usuário enviou uma mensagem.

## Como decidir o "mode" da resposta

Toda resposta tem um campo \`mode\` que define o estágio da conversa:

- \`"discuss"\` → Faltam informações essenciais OU o usuário está só conversando/explorando ideias. Faça **2 a 4 perguntas objetivas e numeradas** para entender objetivo do bot, público, canais, gatilhos, dados que precisa coletar, regras de horário, integrações etc. NÃO gere nodes/edges.
- \`"plan"\` → Você tem informação suficiente para propor uma arquitetura. Apresente um **plano em etapas numeradas** (em texto, dentro de \`assistant_message\`): qual gatilho, quais perguntas o bot fará, que ramificações, que ações (CRM, transferência, etc.), critérios de sucesso. Termine pedindo confirmação ("Posso construir esse fluxo?" ou "Quer ajustar algum ponto?"). NÃO gere nodes/edges ainda.
- \`"build"\` → O usuário aprovou o plano (ou pediu explicitamente alterações em um fluxo existente). Aí sim, devolva \`nodes\` e \`edges\` completos e atualizados.

Regras de escalada:
1. Primeira mensagem do usuário, ou pedido vago ("quero um bot de vendas") → SEMPRE \`mode: "discuss"\`.
2. Após o usuário responder as perguntas com clareza → \`mode: "plan"\`.
3. Após o usuário aprovar o plano ("pode construir", "vai", "ok", "fechou") → \`mode: "build"\`.
4. Em ajustes pontuais em fluxo já existente (ex.: "adicione um botão de FAQ") → pode ir direto para \`mode: "build"\` se o pedido for específico; senão, volte para \`discuss\`.
5. Quando tiver dúvida, prefira PERGUNTAR (\`discuss\`) a adivinhar.

Pense com profundidade antes de responder: avalie ambiguidade, casos de borda, qual o real objetivo de negócio e o que o usuário NÃO disse mas é necessário saber.

## Formato OBRIGATÓRIO da resposta

Responda **somente** um JSON válido, sem markdown, sem \`\`\`, no formato:

{
  "mode": "discuss" | "plan" | "build",
  "assistant_message": "string em PT-BR. Pode ter várias linhas, listas numeradas e perguntas — não precisa ser curta nos modos discuss/plan.",
  "flow_name": "string opcional — nome sugerido para o fluxo (apenas quando fizer sentido)",
  "nodes": [ ... ],   // OBRIGATÓRIO somente em mode="build"; em discuss/plan envie []
  "edges": [ ... ]    // OBRIGATÓRIO somente em mode="build"; em discuss/plan envie []
}

Em \`mode: "build"\` sempre devolva o fluxo **completo e atualizado** (não apenas o delta).

## Schema dos nodes (cada item de "nodes")

{
  "id": "n1" | "n2" | ...,           // único, curto
  "type": "trigger" | "message" | "condition" | "action" | "delay",
  "subType": string,                  // ver tabela abaixo
  "position": { "x": number, "y": number },
  "data": {
    "label": "string curta",
    "config": { ...config específico, com chave "icon": "NomeIcon" ... }
  }
}

subTypes válidos por type:
- trigger: whatsapp_channel | keyword | conversation_start | inactivity | schedule | webhook
- message: text | buttons | list | image | audio | video | file
- condition: if_else | check_variable | check_time | check_tag | multi
- action: assign_tag | transfer_human | transfer_ai_agent | ai_agent_inline | save_crm | send_email | send_whatsapp | call_api | set_variable
- delay: wait_seconds | wait_response | wait_business_hours

Icons sugeridos (use "icon" dentro de data.config):
- trigger.whatsapp_channel: "Phone"
- trigger.keyword: "Hash"
- message.text: "MessageSquare"
- message.buttons: "List"
- message.image: "Image"
- message.audio: "Mic"
- message.video: "Video"
- message.file: "Paperclip"
- condition.*: "GitBranch"
- action.assign_tag: "Tag"
- action.transfer_human: "UserPlus"
- action.save_crm: "Database"
- action.send_email: "Mail"
- action.send_whatsapp: "Send"
- action.ai_agent_inline: "Brain"
- delay.wait_seconds: "Clock"

Configs comuns:
- message.text:    { "content": "...", "waitForResponse"?: true, "saveAs"?: "var_name" }
- message.buttons: { "content": "...", "buttons": ["Opção 1","Opção 2"] }
- message.image:   { "url": "https://...", "caption"?: "..." }
- message.audio:   { "url": "https://...", "ptt"?: true }
- message.video:   { "url": "https://...", "caption"?: "..." }
- message.file:    { "url": "https://...", "filename": "documento.pdf" }
- condition.multi: { "conditions": [{ "id": "cond_x", "label": "...", "operator": "equals|contains", "value": "..." }] }
- action.assign_tag:    { "tag": "nome-tag" }
- action.save_crm:      { "fields": ["nome","email","telefone"] }
- action.transfer_human:{ "departmentName": "..." }
- action.send_email:      { "to": "destinatario@exemplo.com", "subject": "Assunto", "body": "Conteúdo (pode usar {{variaveis}})", "fromName"?: "Nome remetente" }
- action.send_whatsapp:   { "phone": "5511999999999", "message": "Mensagem para outro número (pode usar {{variaveis}})" }
- action.ai_agent_inline:{ "systemPrompt": "Você é ... Responda em PT-BR, curto.", "model": "google/gemini-2.5-flash", "saveAs": "ai_response", "sendReply": true, "fallbackMessage": "..." }
- action.call_api: {
    "url": "https://api.exemplo.com/clientes/{{telefone}}",
    "method": "GET" | "POST" | "PUT" | "DELETE" | "PATCH",
    "headers": { "Authorization": "Bearer {{token_api}}", "Content-Type": "application/json" },
    "bodyJson": "{ \"nome\": \"{{nome}}\", \"email\": \"{{email}}\" }",
    "timeoutMs": 15000,
    "saveAs": "api_response",           // grava JSON inteiro nessa variável
    "responseMap": { "cliente_id": "data.id", "saldo": "data.balance" } // extrai campos do JSON em variáveis
  }
  → Use sempre que o usuário pedir consultar/enviar dados a um sistema externo (CRM, ERP, planilha via webhook, Zapier/Make, API própria, etc.).
  → Variáveis no formato {{nome}} e {{obj.campo}} são substituídas em url/headers/bodyJson em runtime.
  → Combine com message.text usando {{api_response.algumCampo}} ou variáveis do responseMap pra mostrar o resultado ao cliente.
- trigger.webhook: {
    "description": "Quando outro sistema chama esta URL, o fluxo começa.",
    "expectedFields": ["telefone", "nome", "pedido_id"] // só documental
  }
  → A URL e o secret são gerados automaticamente pelo painel — você NÃO precisa preenchê-los.
- delay.wait_seconds:   { "seconds": 5 }

## Schema dos edges

{ "id": "edge_n1_n2", "source": "n1", "target": "n2", "sourceHandle"?: "cond_id" }

## Layout (posições)

Posicione os nodes em fluxo HORIZONTAL (esquerda → direita): cada nível avança no eixo X (+340px), e filhos do mesmo pai se distribuem verticalmente sem sobrepor (espaçamento mínimo de 180px no eixo Y). Nunca empilhe dois nodes na mesma coordenada.

## Regras

- SEMPRE comece com um node "trigger" (default: whatsapp_channel).
- Use português brasileiro nas mensagens (\`content\`).
- Mantenha o fluxo coerente — toda \`edge.source\`/\`target\` precisa existir em \`nodes\`.
- **NUNCA deixe um node solto.** Todo node (exceto o trigger) precisa ter pelo menos uma \`edge\` de entrada, e todo node não-terminal precisa ter pelo menos uma \`edge\` de saída. Em blocos com múltiplas saídas (buttons, condition if_else, multi, time, weekday) preencha um \`edge\` para CADA branch usando o \`sourceHandle\` correto:
  - buttons → \`btn_0\`, \`btn_1\`, \`btn_2\`... (um por opção, na MESMA ORDEM do array \`buttons\`) e \`invalid\` para resposta inválida/fallback.
  - condition \`if_else\` / \`time\` / \`weekday\` → \`yes\` e \`no\`.
  - condition \`multi\` → o \`id\` exato de cada condição em \`conditions[]\`, e \`else\` para o fallback.
  Se faltar conexão, ligue ao próximo bloco lógico — nunca devolva blocos órfãos. NUNCA use \`btn-0\`, \`true\`/\`false\`, \`in\`/\`out\` — esses handles não existem.
- Se o usuário começar do zero, gere um fluxo mínimo de boas-vindas.
- Se o usuário pedir algo já existente, modifique o fluxo atual mantendo o que faz sentido.
- Nunca retorne texto fora do JSON. Nunca use blocos de código markdown.
- Em \`mode: "discuss"\`, abra com uma frase curta acolhendo o pedido, depois faça 2-4 perguntas numeradas e específicas — escritas como se você tivesse curiosidade genuína, não como checklist.
- Em \`mode: "plan"\`, conte o plano como quem está explicando pra um amigo: "Bora fazer assim ó… 1) … 2) …". Pode usar etapas numeradas, mas com linguagem leve, e termine convidando ("Curtiu? Posso construir já ou quer mexer em algo?").
- Em \`mode: "build"\`, \`assistant_message\` deve celebrar de leve e resumir em 1-2 frases o que ficou pronto (ex.: "Prontinho! Montei o fluxo de qualificação capturando nome e e-mail e jogando pra um humano fora do horário. Dá uma olhada no preview 👀").`;

function sanitizeFlow(raw: any): { nodes: any[]; edges: any[] } {
  // Accept both root-level and nested `flow: { nodes, edges }` shapes
  const src = raw?.flow && (Array.isArray(raw.flow.nodes) || Array.isArray(raw.flow.edges))
    ? raw.flow
    : raw;
  const nodes = Array.isArray(src?.nodes) ? src.nodes : [];
  const edges = Array.isArray(src?.edges) ? src.edges : [];
  const validIds = new Set(nodes.map((n: any) => n?.id).filter(Boolean));
  const nodeById = new Map<string, any>(nodes.map((n: any) => [n?.id, n]));
  const normalizeHandle = (sourceId: string, h: any): string | undefined => {
    if (h === undefined || h === null || h === "") return undefined;
    const handle = String(h);
    const src = nodeById.get(sourceId);
    if (!src) return handle;
    // buttons: btn-N / option-N / 0 → btn_N
    if (src.subType === "buttons") {
      const m = handle.match(/^(?:btn[-_]?|option[-_]?|opt[-_]?|b[-_]?)?(\d+)$/i);
      if (m) return `btn_${m[1]}`;
      if (/^(invalid|fallback|default|else|other|outro)$/i.test(handle)) return "invalid";
      return handle;
    }
    // if_else / time / weekday: true/false, sim/nao, in/out → yes/no
    if (
      (src.type === "condition" && src.subType === "if_else") ||
      src.subType === "time" ||
      src.subType === "weekday"
    ) {
      if (/^(yes|true|sim|in|dentro|valid|ok|1)$/i.test(handle)) return "yes";
      if (/^(no|false|nao|não|out|fora|invalid|0)$/i.test(handle)) return "no";
      return handle;
    }
    // multi: keep id or map "default/fallback" → else
    if (src.type === "condition" && src.subType === "multi") {
      if (/^(else|default|fallback|senao|senão|other|outro)$/i.test(handle)) return "else";
      return handle;
    }
    return handle;
  };
  const cleanEdges = edges
    .filter((e: any) => e?.source && e?.target && validIds.has(e.source) && validIds.has(e.target))
    .map((e: any) => ({
      ...e,
      sourceHandle: normalizeHandle(e.source, e.sourceHandle),
    }));
  const cleanNodes = nodes.map((n: any, idx: number) => ({
    id: String(n?.id || `n${idx + 1}`),
    type: n?.type || "message",
    subType: n?.subType || "text",
    position: {
      x: typeof n?.position?.x === "number" ? n.position.x : 300,
      y: typeof n?.position?.y === "number" ? n.position.y : 50 + idx * 160,
    },
    data: {
      label: String(n?.data?.label || "Bloco"),
      config: (n?.data?.config && typeof n.data.config === "object") ? n.data.config : {},
    },
  }));
  // NUNCA permita blocos soltos. Liga órfãos antes de re-layout.
  const connectedEdges = ensureConnected(cleanNodes, cleanEdges);
  // Always re-layout as a top-down mind map so the preview looks clean and connected.
  return { nodes: autoLayout(cleanNodes, connectedEdges), edges: connectedEdges };
}

/**
 * Garante que nenhum node fique solto:
 * - cada branch de blocos multi-saída (buttons/condition/multi/time/weekday)
 *   ganha um edge se estiver vazio;
 * - todo node sem outgoing (exceto terminais) é ligado ao próximo na ordem;
 * - todo node sem incoming (exceto trigger/primeiro) é ligado ao anterior.
 */
function ensureConnected(nodes: any[], edges: any[]): any[] {
  if (!Array.isArray(nodes) || nodes.length < 2) return edges;
  const out = [...edges];
  const has = (s: string, t: string, h?: string) =>
    out.some((e) => e.source === s && e.target === t && (h ? e.sourceHandle === h : true));
  const outOf = (id: string) => out.filter((e) => e.source === id);
  const inOf = (id: string) => out.filter((e) => e.target === id);
  const ordered = [...nodes].sort((a, b) => {
    const dy = (a.position?.y ?? 0) - (b.position?.y ?? 0);
    return dy !== 0 ? dy : (a.position?.x ?? 0) - (b.position?.x ?? 0);
  });
  const idx = new Map(ordered.map((n, i) => [n.id, i] as const));
  const isTerminal = (n: any) =>
    n?.subType === "end" || n?.type === "end" || n?.data?.config?.terminal === true;

  // 1) branches de múltipla saída
  for (const n of ordered) {
    const cfg = n?.data?.config || {};
    let branches: string[] = [];
    if (n.subType === "buttons" && Array.isArray(cfg.buttons)) {
      branches = cfg.buttons.map((_: any, i: number) => `btn_${i}`);
    } else if (n.type === "condition" && n.subType === "if_else") {
      branches = ["yes", "no"];
    } else if (n.subType === "multi" && Array.isArray(cfg.conditions)) {
      branches = cfg.conditions.map((c: any, i: number) => c?.id || `c-${i}`);
    } else if (n.subType === "time" || n.subType === "weekday") {
      branches = ["yes", "no"];
    }
    if (!branches.length) continue;
    const i = idx.get(n.id) ?? 0;
    const cands = ordered.slice(i + 1).filter((c) => c.id !== n.id);
    branches.forEach((h, k) => {
      if (out.some((e) => e.source === n.id && e.sourceHandle === h)) return;
      const target = cands[k] || cands[cands.length - 1];
      if (!target || has(n.id, target.id, h)) return;
      out.push({ id: `auto-${n.id}-${h}-${target.id}`, source: n.id, target: target.id, sourceHandle: h });
    });
  }

  // 2) sem saída → próximo
  for (const n of ordered) {
    if (isTerminal(n)) continue;
    if (outOf(n.id).length > 0) continue;
    const cfg = n?.data?.config || {};
    const isMulti =
      (n.subType === "buttons" && Array.isArray(cfg.buttons) && cfg.buttons.length) ||
      (n.type === "condition" && n.subType === "if_else") ||
      (n.subType === "multi" && Array.isArray(cfg.conditions) && cfg.conditions.length) ||
      n.subType === "time" || n.subType === "weekday";
    if (isMulti) continue;
    const i = idx.get(n.id) ?? 0;
    const next = ordered.slice(i + 1).find((c) => c.id !== n.id);
    if (!next || has(n.id, next.id)) continue;
    out.push({ id: `auto-${n.id}-${next.id}`, source: n.id, target: next.id });
  }

  // 3) sem entrada → anterior
  const firstId = ordered[0]?.id;
  for (const n of ordered) {
    if (n.id === firstId || n.type === "trigger") continue;
    if (inOf(n.id).length > 0) continue;
    const i = idx.get(n.id) ?? 0;
    const prev = ordered.slice(0, i).reverse().find((c) => !isTerminal(c) && c.id !== n.id);
    if (!prev || has(prev.id, n.id)) continue;
    out.push({ id: `auto-${prev.id}-${n.id}`, source: prev.id, target: n.id });
  }

  return out;
}

/**
 * Simple top-down tree layout (BFS from roots). Spaces children evenly.
 * Falls back to a vertical column when there are no edges.
 */
function autoLayout(nodes: any[], edges: any[]): any[] {
  if (nodes.length === 0) return nodes;
  const NODE_W = 280;
  const H_GAP = 80;   // gap entre colunas (níveis)
  const V_GAP = 60;   // gap mínimo entre nodes empilhados verticalmente
  const SAFE_PAD = 12; // folga extra contra overflow visual (sombras, borders)
  const START_X = 80;
  const START_Y = 60;

  // Estima a ALTURA de cada node a partir do conteúdo (botões, condições, etc.)
  // pra evitar que cards altos se sobreponham aos vizinhos da mesma coluna.
  const heightOf = (n: any): number => {
    const base = 110; // header + linha de descrição
    const cfg = n?.data?.config || {};
    if (n?.subType === "buttons") {
      const btns = Array.isArray(cfg.buttons) ? cfg.buttons.length : 0;
      // ~32px por botão + 32px da linha "Resposta inválida" + 16px de padding
      return base + btns * 32 + 48;
    }
    if (n?.subType === "list") {
      const items = Array.isArray(cfg.items) ? cfg.items.length : (Array.isArray(cfg.options) ? cfg.options.length : 0);
      return base + Math.max(items, 1) * 28 + 24;
    }
    if (n?.subType === "multi") {
      const conds = Array.isArray(cfg.conditions) ? cfg.conditions.length : 0;
      return base + conds * 28 + 16;
    }
    if (n?.type === "condition") return base + 40; // yes/no handles
    return base;
  };

  const byId = new Map(nodes.map((n) => [n.id, n]));
  const children = new Map<string, string[]>();
  const incoming = new Map<string, number>();
  for (const n of nodes) {
    children.set(n.id, []);
    incoming.set(n.id, 0);
  }
  for (const e of edges) {
    if (!children.has(e.source) || !byId.has(e.target)) continue;
    children.get(e.source)!.push(e.target);
    incoming.set(e.target, (incoming.get(e.target) || 0) + 1);
  }

  // Roots: triggers first, then nodes with no incoming edges, fallback to first node
  let roots = nodes.filter((n) => n.type === "trigger").map((n) => n.id);
  if (roots.length === 0) roots = nodes.filter((n) => (incoming.get(n.id) || 0) === 0).map((n) => n.id);
  if (roots.length === 0) roots = [nodes[0].id];

  // Assign depth via BFS
  const depth = new Map<string, number>();
  const queue: string[] = [];
  for (const r of roots) { depth.set(r, 0); queue.push(r); }
  while (queue.length) {
    const id = queue.shift()!;
    const d = depth.get(id)!;
    for (const c of children.get(id) || []) {
      if (!depth.has(c)) { depth.set(c, d + 1); queue.push(c); }
    }
  }
  // Any disconnected node: place at next depth level
  let maxDepth = 0;
  depth.forEach((d) => { if (d > maxDepth) maxDepth = d; });
  for (const n of nodes) {
    if (!depth.has(n.id)) { maxDepth += 1; depth.set(n.id, maxDepth); }
  }

  // Group by depth (column index), preserving BFS order
  const levels: string[][] = [];
  depth.forEach((d, id) => {
    if (!levels[d]) levels[d] = [];
    levels[d].push(id);
  });

  // Layout HORIZONTAL com altura DINÂMICA por node — empilha somando alturas reais
  // (com gap) pra cards com botões/condições nunca cobrirem o vizinho de baixo.
  const colHeights = levels.map((ids) =>
    (ids || []).reduce((sum, id, i) => sum + heightOf(byId.get(id)) + (i > 0 ? V_GAP : 0), 0)
  );
  const tallestCol = Math.max(...colHeights, 0);
  const centerY = START_Y + tallestCol / 2;

  const positioned: any[] = [];
  levels.forEach((ids, d) => {
    if (!ids) return;
    let cursorY = centerY - colHeights[d] / 2;
    ids.forEach((id) => {
      const node = byId.get(id);
      if (!node) return;
      positioned.push({
        ...node,
        position: { x: START_X + d * (NODE_W + H_GAP), y: cursorY },
      });
      cursorY += heightOf(node) + V_GAP;
    });
  });

  // ---- PASSO FINAL: garante ZERO sobreposição ----
  // Mesmo com alturas dinâmicas, edges custom ou ordens fora do padrão podem
  // produzir overlap. Aqui agrupamos por coluna (mesmo x) e empurramos cada
  // node para baixo se o bounding box ainda intersectar o anterior.
  const byCol = new Map<number, any[]>();
  positioned.forEach((n) => {
    const key = Math.round(n.position.x);
    if (!byCol.has(key)) byCol.set(key, []);
    byCol.get(key)!.push(n);
  });
  byCol.forEach((arr) => {
    arr.sort((a, b) => a.position.y - b.position.y);
    for (let i = 1; i < arr.length; i++) {
      const prev = arr[i - 1];
      const prevBottom = prev.position.y + heightOf(prev) + SAFE_PAD;
      const minY = prevBottom + V_GAP;
      if (arr[i].position.y < minY) arr[i].position.y = minY;
    }
  });
  return positioned;
}

function tryParseJson(text: string): any | null {
  if (!text) return null;
  // strip markdown fences if model leaks them
  const stripped = text.trim().replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
  try { return JSON.parse(stripped); } catch (_) {}
  // try to extract first {...} block
  const match = stripped.match(/\{[\s\S]*\}$/);
  if (match) {
    try { return JSON.parse(match[0]); } catch (_) {}
  }
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "LOVABLE_API_KEY não configurada" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const messages = Array.isArray(body?.messages) ? body.messages : [];
    const currentFlow = body?.currentFlow ?? { nodes: [], edges: [] };
    const flowId = body?.flowId || "";
    const flowName = body?.flowName || "";
    const attachments: Array<{ name: string; mime: string; dataUrl?: string; textPreview?: string }> =
      Array.isArray(body?.attachments) ? body.attachments : [];
    const forceMode: "discuss" | "plan" | "build" | null =
      body?.forceMode === "build" || body?.forceMode === "plan" || body?.forceMode === "discuss"
        ? body.forceMode
        : null;

    if (messages.length === 0) {
      return new Response(JSON.stringify({ error: "messages é obrigatório" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const contextMessage = {
      role: "system",
      content: `Estado atual do fluxo (use como base):\n\nID: ${flowId || "(novo)"}\nNome: ${flowName || "(sem nome)"}\n\n${JSON.stringify(currentFlow, null, 2)}${flowId ? "\n\n## AVISO: MODO EDIÇÃO\nO usuário está EDITANDO um fluxo já existente. Aplique as modificações sobre a estrutura atual fornecida acima." : ""}`,
    };

    // Se houver anexos, transforma a ÚLTIMA mensagem do usuário em content-parts
    // (text + image_url/file) para o gateway multimodal. Arquivos de texto entram
    // como bloco de texto resumido. Imagens vão como image_url. PDFs vão como file.
    // Demais binários viram menção textual (filename + mime + tamanho).
    let chatMessages = messages;
    if (attachments.length > 0) {
      const idx = (() => {
        for (let i = messages.length - 1; i >= 0; i--) {
          if (messages[i]?.role === "user") return i;
        }
        return -1;
      })();
      if (idx >= 0) {
        const original = messages[idx];
        const parts: any[] = [];
        const baseText = typeof original.content === "string" ? original.content : "";
        // Lista pra IA com publicUrl de cada anexo (quando temos), para que ela possa
        // referenciá-los em blocos message.image / message.audio / message.video / message.file
        // se o usuário pedir "envie essa imagem", "envie esse áudio" etc.
        const mediaCatalog = attachments
          .filter((a) => !!a.publicUrl)
          .map((a, i) => {
            const kind = (a.mime || "").toLowerCase().startsWith("image/")
              ? "image"
              : (a.mime || "").toLowerCase().startsWith("audio/")
              ? "audio"
              : (a.mime || "").toLowerCase().startsWith("video/")
              ? "video"
              : "file";
            return `  ${i + 1}. ${a.name} (${a.mime}) → kind=${kind} → url=${a.publicUrl}`;
          })
          .join("\n");
        parts.push({
          type: "text",
          text:
            (baseText || "(sem texto)") +
            `\n\nO usuário anexou ${attachments.length} arquivo(s). Analise o conteúdo e use as informações relevantes para montar/ajustar o chatbot.\n` +
            (mediaCatalog
              ? `\nMÍDIAS DISPONÍVEIS (use estas URLs quando o usuário pedir para o BOT enviar um arquivo, ex.: "envie essa imagem de saudação", "responda com esse áudio"):\n${mediaCatalog}\n` +
                `→ Crie um node message.image / message.audio / message.video / message.file (conforme o kind) com config.url = a URL listada acima. Adicione caption quando fizer sentido.\n`
              : ""),
        });
        for (const a of attachments) {
          const mime = (a.mime || "").toLowerCase();
          if (mime.startsWith("image/") && a.dataUrl) {
            parts.push({ type: "image_url", image_url: { url: a.dataUrl } });
          } else if (mime === "application/pdf" && a.dataUrl) {
            parts.push({ type: "file", file: { filename: a.name, file_data: a.dataUrl } });
          } else if (a.textPreview) {
            parts.push({
              type: "text",
              text: `\n--- Conteúdo de ${a.name} (${mime || "texto"}) ---\n${a.textPreview}\n--- fim ---`,
            });
          } else {
            parts.push({
              type: "text",
              text: `\n[Arquivo anexado não interpretável diretamente: ${a.name} (${mime || "desconhecido"})]`,
            });
          }
        }
        chatMessages = [...messages.slice(0, idx), { role: "user", content: parts }, ...messages.slice(idx + 1)];
      }
    }

    const forceMessages: any[] = [];
    if (forceMode === "build") {
      forceMessages.push({
        role: "system",
        content:
          "INSTRUÇÃO DECISIVA: o usuário APROVOU o plano. Sua próxima resposta DEVE ter mode='build' e devolver o flow COMPLETO (nodes + edges) implementando o plano discutido. " +
          "Reaproveite o fluxo atual (currentFlow) quando ele já existir e adicione/ajuste blocos para refletir o plano. " +
          "É proibido responder mode='plan' ou mode='discuss' agora — não faça mais perguntas, não peça nova confirmação. " +
          "Se faltar algum detalhe, escolha um padrão sensato e construa mesmo assim.",
      });
    }

    const callGateway = (extraMessages: any[] = [], modelOverride?: string) => fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        // Default to FLASH for low latency. Pro takes 40-130s for build mode
        // which makes the UI feel broken. Flash returns valid flow JSON in
        // ~2-10s. Pro is only used as a fallback when flash output is unparseable.
        model: modelOverride ?? "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          contextMessage,
          ...chatMessages,
          ...forceMessages,
          ...extraMessages,
        ],
        response_format: { type: "json_object" },
        temperature: 0.3,
      }),
    });

    let aiRes = await callGateway();

    if (!aiRes.ok) {
      const text = await aiRes.text();
      console.error("[chatbot-builder-ai] gateway error", aiRes.status, text);
      if (aiRes.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições atingido. Tente novamente em alguns segundos." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiRes.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos de IA esgotados. Adicione créditos no painel." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ error: "Erro ao chamar a IA", details: text.slice(0, 500) }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let data = await aiRes.json();
    let content: string = data?.choices?.[0]?.message?.content ?? "";
    let parsed = tryParseJson(content);

    // Fallback to gemini-2.5-pro only if flash returned unparseable JSON
    if (!parsed) {
      console.warn("[chatbot-builder-ai] flash returned unparseable JSON, retrying with gemini-2.5-pro");
      const proRes = await callGateway([], "google/gemini-2.5-pro");
      if (proRes.ok) {
        const proData = await proRes.json();
        const proContent: string = proData?.choices?.[0]?.message?.content ?? "";
        const proParsed = tryParseJson(proContent);
        if (proParsed) {
          data = proData;
          content = proContent;
          parsed = proParsed;
        }
      }
    }

    if (!parsed) {
      return new Response(JSON.stringify({
        assistant_message: content || "Não consegui interpretar a resposta. Pode reformular?",
        flow: currentFlow,
        flow_name: flowName,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    let mode: "discuss" | "plan" | "build" =
      parsed.mode === "build" || parsed.mode === "plan" || parsed.mode === "discuss"
        ? parsed.mode
        : (Array.isArray(parsed.nodes) && parsed.nodes.length > 0 ? "build" : "discuss");

    // Se o usuário aprovou o plano mas a IA insistir em discuss/plan ou vier sem nodes,
    // forçamos um retry pedindo o flow imediatamente.
    if (forceMode === "build" && (mode !== "build" || !Array.isArray(parsed.nodes) || parsed.nodes.length === 0)) {
      console.warn("[chatbot-builder-ai] forceMode=build but AI returned mode=", mode, "nodes=", parsed?.nodes?.length);
      const retry = await callGateway([
        { role: "assistant", content },
        {
          role: "user",
          content:
            "Você ignorou a instrução. Devolva AGORA um JSON com mode='build' e os campos nodes e edges preenchidos implementando o plano que você propôs. Sem perguntas, sem novo plano.",
        },
      ]);
      if (retry.ok) {
        data = await retry.json();
        content = data?.choices?.[0]?.message?.content ?? content;
        const retryParsed = tryParseJson(content);
        if (retryParsed && Array.isArray(retryParsed.nodes) && retryParsed.nodes.length > 0) {
          parsed = retryParsed;
          mode = "build";
        }
      }
    }

    // Em discuss/plan NÃO atualizamos o preview — mantemos o fluxo atual.
    const flow = mode === "build" ? sanitizeFlow(parsed) : currentFlow;

    return new Response(JSON.stringify({
      mode,
      assistant_message: String(parsed.assistant_message || "Pronto."),
      flow_name: parsed.flow_name || flowName || "",
      flow,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (e: any) {
    console.error("[chatbot-builder-ai] error", e);
    return new Response(JSON.stringify({ error: e?.message || "Erro inesperado" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});