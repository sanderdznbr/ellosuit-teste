import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { classifyPipelineStage } from "./pipelineClassifier.ts";

// Cases are intentionally written in the exact tone a Brazilian WhatsApp lead
// would type: lowercase, missing accents, punctuation noise, emojis stripped.
const cases: Array<{
  name: string;
  user: string;
  ai: string;
  current: string | null;
  expected: string;
}> = [
  // ---------- finalizado ----------
  { name: "obrigado simples", user: "obrigado!", ai: "Disponha!", current: "em_atendimento", expected: "finalizado" },
  { name: "muito obrigada com acento", user: "Muito obrigada 😊", ai: "Eu que agradeço", current: "qualificado", expected: "finalizado" },
  { name: "valeu informal", user: "vlw mesmo", ai: "ok", current: "em_atendimento", expected: "finalizado" },
  { name: "ate amanha", user: "ate amanha entao", ai: "ok", current: "aguardando", expected: "finalizado" },
  { name: "resolvido", user: "ja resolvi aqui, brigado", ai: "que bom", current: "em_atendimento", expected: "finalizado" },
  { name: "era so isso mesmo", user: "era so isso mesmo", ai: "ok", current: "em_atendimento", expected: "finalizado" },

  // ---------- qualificado ----------
  { name: "quanto custa", user: "quanto custa o plano?", ai: "Custa R$ 99", current: "em_atendimento", expected: "qualificado" },
  { name: "qual o valor", user: "qual o valor disso?", ai: "Segue", current: "novo", expected: "qualificado" },
  { name: "quero comprar", user: "quero comprar agora", ai: "Perfeito", current: "em_atendimento", expected: "qualificado" },
  { name: "manda o pix", user: "me passa o pix por favor", ai: "claro", current: "em_atendimento", expected: "qualificado" },
  { name: "parcelado", user: "da pra fazer parcelado?", ai: "sim", current: "em_atendimento", expected: "qualificado" },
  { name: "tenho interesse", user: "tenho interesse no servico", ai: "otimo", current: "novo", expected: "qualificado" },
  { name: "fechado", user: "fechado, bora", ai: "show", current: "em_atendimento", expected: "qualificado" },
  { name: "tem desconto", user: "tem desconto pra pagamento a vista?", ai: "tem sim", current: "em_atendimento", expected: "qualificado" },

  // ---------- aguardando (cliente posterga) ----------
  { name: "vou pensar", user: "vou pensar e te falo", ai: "ok", current: "qualificado", expected: "aguardando" },
  { name: "preciso ver", user: "preciso ver com meu socio", ai: "ok", current: "qualificado", expected: "aguardando" },
  { name: "te retorno", user: "te retorno mais tarde", ai: "ok", current: "em_atendimento", expected: "aguardando" },
  { name: "estou ocupada", user: "estou ocupada agora", ai: "ok", current: "em_atendimento", expected: "aguardando" },

  // ---------- aguardando (IA fez pergunta) ----------
  { name: "ia pergunta", user: "oi", ai: "Tudo bem? Qual seu nome?", current: "em_atendimento", expected: "aguardando" },
  { name: "ia pede confirmar", user: "oi", ai: "Me confirma seu email por favor", current: "em_atendimento", expected: "aguardando" },

  // ---------- novo → em_atendimento ----------
  { name: "primeira msg neutra", user: "ola, bom dia", ai: "Ola! Como posso ajudar.", current: null, expected: "em_atendimento" },
  { name: "stage vazio", user: "oi", ai: "Oi, tudo bem.", current: "", expected: "em_atendimento" },
  { name: "stage novo vira em_atendimento", user: "oi", ai: "Oi.", current: "novo", expected: "em_atendimento" },

  // ---------- preserva stage atual quando nada bate ----------
  { name: "mantem qualificado", user: "ok", ai: "Combinado.", current: "qualificado", expected: "qualificado" },
  { name: "mantem em_atendimento", user: "entendi", ai: "Combinado.", current: "em_atendimento", expected: "em_atendimento" },

  // ---------- regressões ----------
  // "valor" como substring de "avaliar" NÃO deve disparar qualificado:
  // o stage atual deve permanecer porque nenhuma regra explícita bateu.
  { name: "nao confunde avaliar com valor", user: "preciso avaliar com calma", ai: "tudo bem", current: "em_atendimento", expected: "em_atendimento" },
];

Deno.test("classifyPipelineStage move o card para a coluna correta", () => {
  for (const c of cases) {
    const got = classifyPipelineStage(c.user, c.ai, c.current);
    assertEquals(got, c.expected, `[${c.name}] esperado=${c.expected} recebido=${got}`);
  }
});

Deno.test("classifyPipelineStage prioriza finalizado sobre qualificado", () => {
  // Cliente cita preco mas tambem agradece e encerra: encerramento vence.
  const got = classifyPipelineStage(
    "obrigado pelo valor, ja decidi e era so isso",
    "Disponha!",
    "qualificado",
  );
  assertEquals(got, "finalizado");
});

Deno.test("classifyPipelineStage prioriza intencao de compra sobre pergunta da IA", () => {
  const got = classifyPipelineStage(
    "quero comprar agora",
    "Otimo! Posso confirmar seus dados?",
    "em_atendimento",
  );
  assertEquals(got, "qualificado");
});