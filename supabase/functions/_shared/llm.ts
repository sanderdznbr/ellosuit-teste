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
      return res;
    }

    // Modelos de raciocínio (gpt-5*, o1/o3/o4...) só aceitam a temperatura padrão e
    // usam max_completion_tokens em vez de max_tokens. Sem isso a chamada morre com
    // 400 "Unsupported value: 'temperature' does not support 0.7 with this model"
    // e o agente de IA simplesmente não responde. Repete uma vez sem esses campos.
    if (/unsupported value|unsupported parameter|does not support|max_tokens/i.test(detail)) {
      const relaxed: Record<string, unknown> = { ...payload };
      delete relaxed.temperature;
      delete relaxed.top_p;
      if (relaxed.max_tokens != null) {
        relaxed.max_completion_tokens = relaxed.max_tokens;
        delete relaxed.max_tokens;
      }
      console.warn(`[llm] ${payload.model} rejeitou parâmetros de amostragem — repetindo com os padrões do modelo`);
      res = await post(relaxed);
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

/* ------------------------------------------------------------------ imagens */

export const OPENAI_IMAGE_URL = 'https://api.openai.com/v1/images/generations';
export const OPENAI_IMAGE_EDIT_URL = 'https://api.openai.com/v1/images/edits';

/**
 * As functions de carrossel pediam 4:5 (1080x1350). A API de imagem da OpenAI
 * so trabalha com 1024x1024, 1536x1024 e 1024x1536, entao o retrato 2:3 e o
 * mais proximo do 4:5 e o front continua recortando.
 */
export const OPENAI_IMAGE_MODEL = 'gpt-image-1';
export const OPENAI_IMAGE_SIZE = '1024x1536';

export interface GenerateImageOptions {
  prompt: string;
  /** URLs http(s) ou data: URLs. Vazio usa /v1/images/generations. */
  references?: string[];
  size?: '1024x1024' | '1536x1024' | '1024x1536';
  /** Esforco para casar com rostos/estilo das referencias (so no /images/edits). */
  inputFidelity?: 'high' | 'low';
  quality?: 'low' | 'medium' | 'high' | 'auto';
}

/** Baixa uma imagem de referencia e devolve os bytes, para o upload multipart. */
async function referenceToBlob(url: string): Promise<Blob | null> {
  try {
    if (url.startsWith('data:')) {
      const m = /^data:([^;,]+)?(;base64)?,([\s\S]*)$/.exec(url);
      if (!m) return null;
      const mime = m[1] || 'image/png';
      if (m[2]) {
        const bin = atob(m[3]);
        const bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        return new Blob([bytes], { type: mime });
      }
      return new Blob([decodeURIComponent(m[3])], { type: mime });
    }
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    if (!res.ok) return null;
    return await res.blob();
  } catch {
    return null;
  }
}

/**
 * Gera uma imagem pela API da OpenAI e devolve como data URL
 * (`data:image/png;base64,...`), que e o formato que os chamadores de antes
 * ja esperavam do gateway. Devolve null em caso de erro.
 *
 * Com referencias vai em /v1/images/edits (ate 16 imagens); sem elas,
 * /v1/images/generations.
 */
export async function generateImage(opts: GenerateImageOptions): Promise<string | null> {
  const { Authorization } = openAiHeaders();
  const size = opts.size || OPENAI_IMAGE_SIZE;

  const refs: Blob[] = [];
  for (const ref of (opts.references || []).filter(Boolean).slice(0, 8)) {
    const blob = await referenceToBlob(ref);
    if (blob) refs.push(blob);
  }

  let res: Response;
  if (refs.length === 0) {
    res = await fetch(OPENAI_IMAGE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization },
      body: JSON.stringify({
        model: OPENAI_IMAGE_MODEL,
        prompt: opts.prompt,
        size,
        n: 1,
        ...(opts.quality ? { quality: opts.quality } : {}),
      }),
    });
  } else {
    const form = new FormData();
    form.append('model', OPENAI_IMAGE_MODEL);
    form.append('prompt', opts.prompt);
    form.append('size', size);
    form.append('n', '1');
    if (opts.inputFidelity) form.append('input_fidelity', opts.inputFidelity);
    if (opts.quality) form.append('quality', opts.quality);
    refs.forEach((blob, i) => form.append('image[]', blob, `ref-${i}.png`));
    // sem Content-Type: o runtime monta o boundary do multipart
    res = await fetch(OPENAI_IMAGE_EDIT_URL, { method: 'POST', headers: { Authorization }, body: form });
  }

  if (!res.ok) {
    console.error('[llm] generateImage falhou', res.status, (await res.text()).slice(0, 300));
    return null;
  }

  const data = await res.json();
  const b64 = data?.data?.[0]?.b64_json;
  if (!b64) {
    console.error('[llm] generateImage devolveu resposta sem imagem');
    return null;
  }
  return `data:image/png;base64,${b64}`;
}

/* ------------------------------------------------------------------- arquivos */

/**
 * O Chat Completions da OpenAI aceita PDF como parte do tipo `file` (base64),
 * que e o equivalente ao `image_url` com data:application/pdf que o gateway
 * usava para a análise visual de PDF.
 */
export function pdfFilePart(pdfBase64: string, filename: string) {
  return {
    type: 'file',
    file: {
      filename,
      file_data: `data:application/pdf;base64,${pdfBase64}`,
    },
  };
}
