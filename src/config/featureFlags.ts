/**
 * Feature flags — centraliza features ocultas da UI sem deletar código.
 * Para reativar, basta remover o caminho desta lista.
 *
 * Estratégia comercial: simplificar a plataforma em torno do núcleo vendável
 * (CRM WhatsApp + IA, Reuniões, Agenda, Dashboard com IA, Ellocontent).
 */

export const HIDDEN_PATHS: ReadonlySet<string> = new Set([
  // 🔴 Email Designer drag-and-drop (mantém apenas envio simples /email)
  "/dashboard/email-templates",

  // 🔴 Builder visual de automações (complexo demais, esconde do menu)
  "/dashboard/automacoes",

  // 🔴 Captura de Leads / Funis
  "/dashboard/leads",

  // 🔴 Rastreamento de PDF / Vídeo / Conteúdo (mantém encurtador)
  "/dashboard/rastreamento",
  "/dashboard/rastreamento-documento",
  "/dashboard/rastreamento-video",

  // 🔴 Rastrear Emails (oculto por enquanto — a página continua existindo,
  // basta remover a linha abaixo para o item voltar ao menu)
  "/dashboard/email-tracker",

  // 🔴 Hábitos / Rotinas
  "/dashboard/habitos",

  // 🔴 Contratos / Ordem de Serviço (mantém Recibos, que é simples e útil)
  "/dashboard/contratos",
  "/dashboard/propostas",

  // 🔴 Recibos (pouco usado, polui o menu)
  "/dashboard/recibos",

  // 🔴 Templates Prontos / Apps (vazio para a maioria dos clientes)
  "/dashboard/apps",

  // 🔴 Ello Vision e Relatórios (sobrepõem o Analytics)
  "/dashboard/ello-vision",
  "/dashboard/relatorios",

  // 🔴 Encurtador de Links e Analytics (descontinuados)
  "/dashboard/encurtador",
  "/dashboard/analytics",
]);

export function isPathHidden(path?: string | null): boolean {
  if (!path) return false;
  return HIDDEN_PATHS.has(path);
}

export function filterHiddenItems<T extends { path?: string }>(items: T[]): T[] {
  return items.filter((it) => !isPathHidden(it.path));
}

// Mantido por compatibilidade com módulos existentes.
export const GOOGLE_OAUTH_ENABLED = false;