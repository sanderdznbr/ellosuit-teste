/**
 * Chamadas de texto (chat completions) pela API da OpenAI.
 *
 * Motivo: as functions vinham chamando o gateway da Lovable
 * (ai.gateway.lovable.dev + LOVABLE_API_KEY) e ele está respondendo 402
 * "Créditos insuficientes", o que estoura como "Edge Function returned a
 * non-2xx status code" no front. A chave OPENAI_API_KEY já existe no secret
 * do projeto (já usada por tts-openai, elevenlabs-stt e search-news).
 *
 * Os clientes enviam nomes de modelo do gateway (google/gemini-*,
 * openai/gpt-*), então os nomos são traduzidos aqui — assim nenhum front e
 * nenhuma outra function precisa mudar.
 */

export const OPENAI_CHAT_URL = 'https://api.openai.com/v1/chat/completions';

/** Usado quando o modelo pedido não é OpenAI ou não existe na conta. */
export const OPENAI_FALLBACK_MODEL = 'gpt-4o-mini';

/** Modelo "forte" para pedidos de raciocínio longo (pro/ultra/max...). */
export const OPENAI_STRONG_MODEL = 'gpt-4o';

const isOpenAiModel = (name: string) => /^(gpt|o[1-9]|chatgpt|codex|computer-use)/i.test(name);

/**
 * Traduz o nome de modelo do gateway para um id aceito pela API da OpenAI.
 * `openai/gpt-5` → `gpt-5`; `google/gemini-3-flash-preview` → `gpt-4o-mini`;
 * `google/gemini-3.1-pro-preview` → `gpt-4o`; sem nome → fallback.
 */
export function mapModel(model?: string | null): string {
  const raw = (model || '').trim();
  if (!raw) return OPENAI_FALLBACK_MODEL;
  const bare = raw.includes('/') ? raw.slice(raw.indexOf('/') + 1) : raw;
  if (isOpenAiModel(bare)) return bare;
  // modelos "grandes" do gateway viram um modelo forte da OpenAI
  if (/(^|[-.])(pro|ultra|max|opus|large|thinking)([-.]|$)/i.test(bare)) return OPENAI_STRONG_MODEL;
  return OPENAI_FALLBACK_MODEL;
}

function openAiKey(): string {
  const key = Deno.env.get('OPENAI_API_KEY');
  if (!key) throw new Error('OPENAI_API_KEY não configurada no Supabase');
  return key;
}

/** Headers prontos para a API da OpenAI. */
export function openAiHeaders(): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${openAiKey()}`,
  };
}

/**
 * POST em /v1/chat/completions. Devolve a `Response` bruta para o chamador
 * manter o próprio tratamento de `!res.ok`.
 *
 * Se a conta não tiver o modelo pedido (400/404 model_not_found), repete uma
 * vez com OPENAI_FALLBACK_MODEL em vez de quebrar a feature.
 */
export async function chatCompletion(body: Record<string, unknown>): Promise<Response> {
  const headers = openAiHeaders();
  const payload: Record<string, unknown> = { ...body, model: mapModel(body.model as string) };

  const post = (p: Record<string, unknown>) =>
    fetch(OPENAI_CHAT_URL, { method: 'POST', headers, body: JSON.stringify(p) });

  let res = await post(payload);

  if (!res.ok && (res.status === 400 || res.status === 404)) {
    const detail = await res.clone().text();
    if (/model[_ ]?not[_ ]?found|does not exist|invalid_model|unknown model/i.test(detail)) {
      console.warn(`[llm] modelo "${payload.model}" indisponível — repetindo com ${OPENAI_FALLBACK_MODEL}`);
      res = await post({ ...payload, model: OPENAI_FALLBACK_MODEL });
    }
  }

  return res;
}

/**
 * Lê a resposta e devolve o texto do assistente (compatível com
 * `{ choices: [{ message: { content } }] }`).
 */
export async function assistantText(res: Response): Promise<string> {
  const data = await res.json();
  return data?.choices?.[0]?.message?.content ?? '';
}
