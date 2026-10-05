// Shared pipeline-stage classifier used by both the WhatsApp webhook and the
// async AI auto-reply worker. Kept dependency-free so it can be unit-tested
// with Deno's built-in test runner without spinning up Supabase clients.

export type PipelineStage =
  | "novo"
  | "em_atendimento"
  | "aguardando"
  | "qualificado"
  | "finalizado";

const norm = (s: string) =>
  (s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    // collapse repeated punctuation/whitespace so "obrigado!!!" still matches
    .replace(/[\s!?.,;:]+/g, " ")
    .trim();

// Word-boundary aware match: ensures "valor" doesn't match inside "avaliar".
const hasWord = (haystack: string, needle: string) => {
  const n = norm(needle);
  if (!n) return false;
  const escaped = n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|\\s)${escaped}(\\s|$)`).test(haystack);
};

const FINALIZADO_KEYWORDS = [
  "obrigado", "obrigada", "obg", "obgd", "vlw", "valeu",
  "agradeco", "agradecido", "agradecida", "muito obrigado", "muito obrigada",
  "tchau", "ate logo", "ate mais", "ate amanha", "ate breve", "ate a proxima",
  "encerrar", "pode encerrar", "pode finalizar", "finalizar",
  "resolvido", "ja resolvi", "consegui resolver", "tudo resolvido",
  "nao preciso mais", "nao precisa mais", "era so isso", "so isso mesmo",
  "sem mais duvidas", "ficou claro", "perfeito obrigado", "perfeito obrigada",
  "bom dia obrigado", "boa noite obrigado", "show obrigado",
];

const QUALIFICADO_KEYWORDS = [
  // pricing
  "qual o preco", "qual preco", "quanto custa", "quanto fica", "quanto e",
  "quanto sai", "qual o valor", "qual valor", "valor", "valores", "preco",
  "tabela de precos", "orcamento", "cotacao",
  // payment / closing
  "me passa o pix", "manda o pix", "forma de pagamento", "formas de pagamento",
  "cartao de credito", "cartao", "parcel", "parcelado", "parcelamento",
  "boleto", "pix",
  "quero comprar", "quero contratar", "quero fechar", "quero adquirir",
  "vou comprar", "vou fechar", "vou contratar",
  "fechar negocio", "bora fechar", "podemos fechar", "vamos fechar",
  "pode mandar a proposta", "manda a proposta", "envia a proposta",
  "me manda o link", "manda o link de pagamento", "link de pagamento",
  "desconto", "tem desconto", "plano", "qual plano",
  "tenho interesse", "estou interessado", "estou interessada",
  "gostei", "amei", "topo", "fechado", "fechou",
  "pode prosseguir", "pode seguir", "como faco para comprar",
  "como contrato", "como compro", "onde compro",
];

const AGUARDANDO_USER_KEYWORDS = [
  "vou pensar", "vou avaliar", "deixa eu pensar", "preciso pensar",
  "depois te falo", "depois te respondo", "te falo depois", "te respondo depois",
  "amanha te respondo", "amanha te falo", "te aviso", "te retorno",
  "preciso ver", "vou ver", "vou conferir", "vou verificar",
  "falo com", "vou ver com", "preciso falar com",
  "agora nao posso", "estou ocupado", "estou ocupada",
];

const AI_AWAITING_PHRASES = [
  "aguardo", "no aguardo", "fico no aguardo",
  "me confirma", "poderia confirmar", "pode confirmar",
  "me informa", "poderia me informar", "pode me informar",
  "poderia me", "pode me enviar", "pode me mandar", "poderia mandar",
  "qual seu", "qual e seu", "qual e o seu", "me diz",
];

/**
 * Decide which pipeline_stage the conversation should sit in after an AI
 * reply. Order matters: the most specific customer signals win first, then
 * AI-side cues, finally a sane default for brand-new conversations.
 */
export function classifyPipelineStage(
  userText: string,
  aiReply: string,
  currentStage: string | null | undefined,
): PipelineStage {
  const u = ` ${norm(userText)} `;
  const a = ` ${norm(aiReply)} `;

  // 1) Customer explicitly wraps things up → finalizado
  if (FINALIZADO_KEYWORDS.some((k) => hasWord(u, k))) return "finalizado";

  // 2) Customer shows real buying intent → qualificado
  if (QUALIFICADO_KEYWORDS.some((k) => hasWord(u, k))) return "qualificado";

  // 3) Customer postpones decision → aguardando
  if (AGUARDANDO_USER_KEYWORDS.some((k) => hasWord(u, k))) return "aguardando";

  // 4) AI side asks something or explicitly waits for the customer
  if (a.includes("?") || AI_AWAITING_PHRASES.some((p) => a.includes(` ${norm(p)} `) || a.includes(norm(p)))) {
    return "aguardando";
  }

  // 5) Brand new conversation: pull it into the active pipeline
  if (!currentStage || currentStage === "novo" || currentStage === "") {
    return "em_atendimento";
  }

  return currentStage as PipelineStage;
}