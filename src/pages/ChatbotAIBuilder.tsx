import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  ArrowLeft, Send, Sparkles, User as UserIcon, Loader2,
  ExternalLink, RefreshCw, MessageSquarePlus, Trash2,
  CheckCircle2, Rocket, PanelLeftClose, PanelLeftOpen, Check,
  ChevronLeft, ChevronRight, ThumbsUp, Pencil, Paperclip, X, FileText, Eye, Play, LayoutGrid, Crosshair, Plus, StopCircle, Mic, Globe, Square, Save, Settings as SettingsIcon,
  Power, AlertCircle, XCircle, Phone, ArrowDown, Pause,
} from "lucide-react";
import { Plug } from "lucide-react";
import ChatBotConnectionsDialog from "@/components/ChatBot/ChatBotConnectionsDialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import ChatBotCanvas from "@/components/ChatBot/ChatBotCanvas";
import ChatBotPropertiesPanel from "@/components/ChatBot/ChatBotPropertiesPanel";
import ChatBotTestSimulator from "@/components/ChatBot/ChatBotTestSimulator";
import WhatsAppQRInline from "@/components/Dashboard/WhatsAppQRInline";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import RadialGlowOrb from "@/components/ChatBot/RadialGlowOrb";
import type { FlowNode, FlowEdge } from "@/components/ChatBot/types";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import builderLoaderAsset from "@/assets/builder-loader.mp4.asset.json";

const BRAND = "#374DA4";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  attachments?: { name: string; mime: string; size: number }[];
  contextBlocks?: { id: string; label: string; type: string }[];
}

interface PendingAttachment {
  id: string;
  name: string;
  mime: string;
  size: number;
  dataUrl: string; // data:<mime>;base64,...
  textPreview?: string; // for text-like files
  publicUrl?: string; // uploaded to storage so the bot can reuse it in flow nodes
}

interface BuilderSession {
  id: string;
  title: string;
  flow_name: string;
  published_flow_id: string | null;
  is_active: boolean;
  updated_at: string;
}

const INTRO_MESSAGE: ChatMessage = {
  id: "intro",
  role: "assistant",
  content:
    "Oi! 👋 Eu sou a Ello Bot Builder. Me conta o que seu chatbot deve fazer (ex.: \"capturar leads no WhatsApp\" ou \"atendimento com menu\") e eu monto pra você em tempo real — você acompanha aqui do lado e pode pedir ajustes.",
};

// Pool grande de sugestões — sorteamos 4 diferentes a cada montagem da tela
// pra nunca repetir o mesmo conjunto.
const SUGGESTION_POOL = [
  "Crie um chatbot de boas-vindas no WhatsApp com menu de 3 opções",
  "Quero capturar leads pedindo nome, email e telefone e salvar no CRM",
  "Fluxo de agendamento perguntando nome, serviço e horário preferido",
  "Atendimento que transfere para humano quando o cliente digita 'atendente'",
  "Bot de qualificação de leads para imobiliária com 5 perguntas",
  "Recuperação de carrinho abandonado em e-commerce com cupom de 10%",
  "FAQ automático respondendo dúvidas sobre frete, troca e pagamento",
  "Pesquisa de satisfação NPS pós-atendimento com nota de 0 a 10",
  "Confirmação de consulta com lembrete no dia anterior e opção de remarcar",
  "Cardápio interativo de hamburgueria com pedido e endereço de entrega",
  "Captação para infoproduto: pega WhatsApp, envia aula e marca call",
  "Suporte técnico em camadas: triagem por categoria e abertura de chamado",
  "Bot de matrícula em curso online com checagem de pagamento",
  "Reativação de clientes inativos com oferta personalizada",
  "Agendamento de test drive em concessionária com escolha de modelo",
  "Pré-atendimento de clínica com triagem de sintomas e encaminhamento",
  "Captura de leads para advogados qualificando o tipo de caso",
  "Bot de academia: dúvidas de planos, horários e avaliação gratuita",
  "Atendimento para barbearia com agenda em tempo real e confirmação",
  "Onboarding de novo cliente SaaS apresentando recursos passo a passo",
  "Cobrança amigável de boletos vencidos com link de 2ª via",
  "Quiz interativo de recomendação de produto baseado em respostas",
  "Bot de viagens: cotação de pacotes perguntando destino, datas e pessoas",
  "Atendimento bilíngue (PT/EN) que detecta o idioma e responde no mesmo",
  "Notificação de status de pedido com rastreio integrado",
  "Bot consultor financeiro que sugere investimentos por perfil",
  "Agendamento de aulas particulares com seleção de professor e matéria",
  "Pesquisa de mercado: faz 5 perguntas e salva respostas estruturadas",
];

function pickRandomSuggestions(count = 4): string[] {
  const pool = [...SUGGESTION_POOL];
  const out: string[] = [];
  for (let i = 0; i < count && pool.length > 0; i++) {
    const idx = Math.floor(Math.random() * pool.length);
    out.push(pool.splice(idx, 1)[0]);
  }
  return out;
}

// Mini renderer: aplica **negrito**, *itálico*, `code` e quebras de linha.
// Escapa HTML antes pra evitar injeção. Mantém leve (sem dependências).
function renderRichText(text: string): React.ReactNode {
  const escape = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  let html = escape(text);
  html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/(^|[^*])\*(?!\s)([^*\n]+?)\*(?!\*)/g, "$1<em>$2</em>");
  html = html.replace(/`([^`]+?)`/g, '<code class="px-1 py-0.5 rounded bg-background/60 text-[0.85em]">$1</code>');
  return <span dangerouslySetInnerHTML={{ __html: html }} />;
}

// Garante que nenhum bloco fique solto: para cada node sem incoming (exceto
// o trigger/root) e cada node sem outgoing (exceto end), conecta com o
// vizinho topológico mais próximo. Para nodes com múltiplas saídas
// (buttons/condition/multi), garante uma aresta por branch.
function ensureConnectedEdges(nodes: FlowNode[], edges: FlowEdge[]): FlowEdge[] {
  if (nodes.length < 2) return edges;
  const result: FlowEdge[] = [...edges];
  const has = (s: string, t: string, h?: string) =>
    result.some((e) => e.source === s && e.target === t && (h ? e.sourceHandle === h : true));
  const outOf = (id: string) => result.filter((e) => e.source === id);
  const inOf = (id: string) => result.filter((e) => e.target === id);

  // ordem natural (top→bottom, left→right) como fallback de adjacência
  const ordered = [...nodes].sort((a, b) => {
    const dy = (a.position?.y ?? 0) - (b.position?.y ?? 0);
    return dy !== 0 ? dy : (a.position?.x ?? 0) - (b.position?.x ?? 0);
  });
  const indexOf = new Map(ordered.map((n, i) => [n.id, i] as const));

  const isTerminal = (n: FlowNode) =>
    (n as any).subType === "end" || (n.type as string) === "end" || (n.data?.config as any)?.terminal === true;

  // 1) liga branches sem saída em nodes de múltipla saída
  for (const n of ordered) {
    const cfg: any = n.data?.config || {};
    let branches: { handle: string }[] = [];
    if ((n as any).subType === "buttons" && Array.isArray(cfg.buttons)) {
      branches = cfg.buttons.map((_: any, i: number) => ({ handle: `btn-${i}` }));
    } else if (n.type === "condition" && (n as any).subType === "if_else") {
      branches = [{ handle: "true" }, { handle: "false" }];
    } else if ((n as any).subType === "multi" && Array.isArray(cfg.conditions)) {
      branches = cfg.conditions.map((c: any, i: number) => ({ handle: c?.id || `c-${i}` }));
    } else if ((n as any).subType === "time" || (n as any).subType === "weekday") {
      branches = [{ handle: "in" }, { handle: "out" }];
    }
    if (branches.length === 0) continue;
    const idx = indexOf.get(n.id) ?? 0;
    // candidatos: nodes posteriores que não sejam ele mesmo
    const candidates = ordered.slice(idx + 1).filter((c) => c.id !== n.id);
    branches.forEach((br, i) => {
      const already = result.some((e) => e.source === n.id && e.sourceHandle === br.handle);
      if (already) return;
      const target = candidates[i] || candidates[candidates.length - 1];
      if (!target) return;
      if (has(n.id, target.id, br.handle)) return;
      result.push({
        id: `auto-${n.id}-${br.handle}-${target.id}`,
        source: n.id,
        target: target.id,
        sourceHandle: br.handle,
      } as FlowEdge);
    });
  }

  // 2) nodes sem saída (single-output) → liga ao próximo
  for (const n of ordered) {
    if (isTerminal(n)) continue;
    if (outOf(n.id).length > 0) continue;
    const cfg: any = n.data?.config || {};
    const isMulti =
      ((n as any).subType === "buttons" && Array.isArray(cfg.buttons) && cfg.buttons.length > 0) ||
      (n.type === "condition" && (n as any).subType === "if_else") ||
      ((n as any).subType === "multi" && Array.isArray(cfg.conditions) && cfg.conditions.length > 0) ||
      (n as any).subType === "time" || (n as any).subType === "weekday";
    if (isMulti) continue; // já tratado acima
    const idx = indexOf.get(n.id) ?? 0;
    const next = ordered.slice(idx + 1).find((c) => c.id !== n.id);
    if (!next) continue;
    if (has(n.id, next.id)) continue;
    result.push({ id: `auto-${n.id}-${next.id}`, source: n.id, target: next.id } as FlowEdge);
  }

  // 3) nodes sem entrada (exceto trigger/primeiro) → liga do anterior
  const firstId = ordered[0]?.id;
  for (const n of ordered) {
    if (n.id === firstId) continue;
    if (n.type === "trigger") continue;
    if (inOf(n.id).length > 0) continue;
    const idx = indexOf.get(n.id) ?? 0;
    const prev = ordered.slice(0, idx).reverse().find((c) => !isTerminal(c) && c.id !== n.id);
    if (!prev) continue;
    if (has(prev.id, n.id)) continue;
    result.push({ id: `auto-${prev.id}-${n.id}`, source: prev.id, target: n.id } as FlowEdge);
  }

  return result;
}

// Reorganiza os nodes em colunas (esquerda → direita) com altura dinâmica
// estimada por tipo, evitando sobreposição. Mesma lógica usada na edge function.
function autoLayoutNodes(nodes: FlowNode[], edges: FlowEdge[]): FlowNode[] {
  if (nodes.length === 0) return nodes;
  const NODE_W = 280;
  const H_GAP = 80;
  const V_GAP = 60;
  const SAFE_PAD = 12;
  const START_X = 80;
  const START_Y = 60;

  const heightOf = (n: any): number => {
    const base = 110;
    const cfg = n?.data?.config || {};
    if (n?.subType === "buttons") {
      const btns = Array.isArray(cfg.buttons) ? cfg.buttons.length : 0;
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
    if (n?.type === "condition") return base + 40;
    return base;
  };

  const byId = new Map(nodes.map((n) => [n.id, n] as const));
  const children = new Map<string, string[]>();
  const incoming = new Map<string, number>();
  for (const n of nodes) { children.set(n.id, []); incoming.set(n.id, 0); }
  for (const e of edges) {
    if (!children.has(e.source) || !byId.has(e.target)) continue;
    children.get(e.source)!.push(e.target);
    incoming.set(e.target, (incoming.get(e.target) || 0) + 1);
  }

  let roots = nodes.filter((n) => n.type === "trigger").map((n) => n.id);
  if (roots.length === 0) roots = nodes.filter((n) => (incoming.get(n.id) || 0) === 0).map((n) => n.id);
  if (roots.length === 0) roots = [nodes[0].id];

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
  let maxDepth = 0;
  depth.forEach((d) => { if (d > maxDepth) maxDepth = d; });
  for (const n of nodes) {
    if (!depth.has(n.id)) { maxDepth += 1; depth.set(n.id, maxDepth); }
  }

  const levels: string[][] = [];
  depth.forEach((d, id) => {
    if (!levels[d]) levels[d] = [];
    levels[d].push(id);
  });

  const colHeights = levels.map((ids) =>
    (ids || []).reduce((sum, id, i) => sum + heightOf(byId.get(id)) + (i > 0 ? V_GAP : 0), 0)
  );
  const tallestCol = Math.max(...colHeights, 0);
  const centerY = START_Y + tallestCol / 2;

  const positioned: FlowNode[] = [];
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

  // Garante zero sobreposição por coluna
  const byCol = new Map<number, FlowNode[]>();
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

const ChatbotAIBuilder: React.FC = () => {
  const navigate = useNavigate();
  const { sessionId: routeSessionId } = useParams<{ sessionId: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const { toast } = useToast();
  const { user } = useAuth();

  const [companyId, setCompanyId] = useState<string | null>(null);
  const [publishedFlowId, setPublishedFlowId] = useState<string | null>(null);
  const [flowName, setFlowName] = useState("Novo chatbot");
  // Tempo (ms) de espera entre envios consecutivos de cards do chatbot
  const [responseDelayMs, setResponseDelayMs] = useState<number>(3000);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [connectionsOpen, setConnectionsOpen] = useState(false);
  const [nodes, setNodes] = useState<FlowNode[]>([]);
  const [edges, setEdges] = useState<FlowEdge[]>([]);
  // History for undo function
  const [history, setHistory] = useState<{ nodes: FlowNode[]; edges: FlowEdge[] }[]>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null);
  const [isActive, setIsActive] = useState(false);
  // Blocos selecionados como CONTEXTO pra próxima mensagem da IA
  const [contextNodeIds, setContextNodeIds] = useState<string[]>([]);

  const [messages, setMessages] = useState<ChatMessage[]>([INTRO_MESSAGE]);
  const [input, setInput] = useState("");
  const [isThinking, setIsThinking] = useState(false);
  const [attachments, setAttachments] = useState<PendingAttachment[]>([]);
  // Fila de prompts feitos enquanto a IA estava gerando
  type QueueItem = {
    id: string;
    text: string;
    atts: PendingAttachment[];
    ctx: string[];
    opts?: { forceMode?: "build" | "plan" | "discuss" };
  };
  const [queueItems, setQueueItems] = useState<QueueItem[]>([]);
  const queuedCount = queueItems.length;
  const [confirmClearQueue, setConfirmClearQueue] = useState(false);
  // Mensagem que está sendo processada agora pela IA
  const [processingText, setProcessingText] = useState<string>("");
  // Cancelamento da geração em curso
  const canceledRef = useRef(false);
  const reqIdRef = useRef(0);
  // Pesquisa profunda (Perplexity) — enriquece o prompt com fontes reais
  const [deepResearch, setDeepResearch] = useState(false);
  // Gravação de áudio inline
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);

  // Auto-grow do composer conforme o usuário digita
  useEffect(() => {
    const el = composerRef.current;
    if (!el) return;
    el.style.height = "auto";
    const next = Math.min(el.scrollHeight, 320);
    el.style.height = `${next}px`;
  }, [input]);
  const [isPublishing, setIsPublishing] = useState(false);
  const [pendingPlan, setPendingPlan] = useState(false);
  const [focusIndex, setFocusIndex] = useState(0);
  const [focusNodeId, setFocusNodeId] = useState<string | null>(null);

  // Threads / sessions
  const [sessions, setSessions] = useState<BuilderSession[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const [loadingSession, setLoadingSession] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle");
  const { isMobile } = useIsMobile();
  const [mobileView, setMobileView] = useState<"chat" | "preview">("chat");
  const [testOpen, setTestOpen] = useState(false);

  // ATIVAR — checklist de pré-publicação
  const [activateOpen, setActivateOpen] = useState(false);
  type WaSession = { id: string; instance_name: string; status: string | null; phone_number: string | null };
  const [waSessions, setWaSessions] = useState<WaSession[]>([]);
  const [waLoading, setWaLoading] = useState(false);
  const [selectedSessionId, setSelectedSessionId] = useState<string>("");

  // Inline WhatsApp connect (declarado abaixo, após fetchWaSessions)
  const [inlineConnecting, setInlineConnecting] = useState(false);
  const [inlineSessionId, setInlineSessionId] = useState<string>("");
  const [inlineQrCode, setInlineQrCode] = useState<string>("");
  const [inlineCreating, setInlineCreating] = useState(false);

  const fetchWaSessions = useCallback(async () => {
    if (!companyId) return;
    setWaLoading(true);
    try {
      const { data } = await supabase
        .from("whatsapp_sessions")
        .select("id, instance_name, status, phone_number")
        .eq("company_id", companyId);
      setWaSessions((data || []) as WaSession[]);
    } finally {
      setWaLoading(false);
    }
  }, [companyId]);

  // Pré-seleciona a sessão se o trigger já tem uma definida
  useEffect(() => {
    if (selectedSessionId) return;
    const trig = nodes.find((n) => n.type === "trigger") as any;
    const sid = trig?.data?.config?.sessionId;
    if (sid) setSelectedSessionId(String(sid));
  }, [nodes, selectedSessionId]);

  const connectedSessions = waSessions.filter((s) => (s.status || "").toLowerCase() === "connected");

  const startInlineConnect = useCallback(async () => {
    if (!companyId || !user?.id) {
      toast({ title: "Aguarde", description: "Carregando seus dados…" });
      return;
    }
    setInlineCreating(true);
    setInlineQrCode("");
    setInlineSessionId("");
    try {
      const instanceName = `chatbot-${Date.now()}`;
      const { data, error } = await supabase.functions.invoke("whatsapp-api", {
        body: { action: "create_instance", instanceName, companyId, userId: user.id },
      });
      if (error) throw error;
      const sid = data?.session?.id;
      if (!sid) throw new Error("Sessão não criada");
      setInlineSessionId(sid);
      setInlineConnecting(true);
      const tryQr = async () => {
        const r = await supabase.functions.invoke("whatsapp-api", {
          body: { action: "get_qr_code", sessionId: sid },
        });
        const qr = r.data?.qrCode;
        if (qr) {
          const formatted = String(qr).startsWith("data:") ? qr : `data:image/png;base64,${qr}`;
          setInlineQrCode(formatted);
          return true;
        }
        return false;
      };
      if (!(await tryQr())) {
        for (const ms of [2000, 2000, 2000, 3000]) {
          await new Promise((r) => setTimeout(r, ms));
          if (await tryQr()) break;
        }
      }
    } catch (e: any) {
      toast({ title: "Erro ao conectar", description: e?.message || "Tente novamente", variant: "destructive" });
      setInlineConnecting(false);
    } finally {
      setInlineCreating(false);
    }
  }, [companyId, user?.id, toast]);

  const handleInlineConnected = useCallback(async () => {
    await fetchWaSessions();
    setSelectedSessionId(inlineSessionId);
    setInlineConnecting(false);
    setInlineQrCode("");
    toast({ title: "WhatsApp conectado!", description: "Sessão selecionada automaticamente." });
    // O número de telefone pode demorar 1-3s pra ser gravado pelo webhook
    // do pareamento — re-busca pra atualizar o label da etapa 1.
    setTimeout(() => { fetchWaSessions(); }, 2000);
    setTimeout(() => { fetchWaSessions(); }, 5000);
  }, [fetchWaSessions, inlineSessionId, toast]);

  // Sempre que a sessão selecionada mudar (manual ou inline), reflete no
  // node trigger do canvas — assim a primeira etapa mostra o canal conectado.
  useEffect(() => {
    if (!selectedSessionId) return;
    const sess = waSessions.find((s) => s.id === selectedSessionId);
    if (!sess) return;
    setNodes((prev) => {
      let changed = false;
      const next = prev.map((n: any) => {
        if (n.type !== "trigger") return n;
        const cfg = n.data?.config || {};
        if (
          cfg.sessionId === selectedSessionId &&
          cfg.phoneNumber === (sess.phone_number || cfg.phoneNumber) &&
          cfg.sessionName === (sess.instance_name || cfg.sessionName)
        ) {
          return n;
        }
        changed = true;
        return {
          ...n,
          data: {
            ...n.data,
            config: {
              ...cfg,
              sessionId: selectedSessionId,
              phoneNumber: sess.phone_number || cfg.phoneNumber || "",
              sessionName: sess.instance_name || cfg.sessionName || "",
            },
          },
        };
      });
      return changed ? next : prev;
    });
  }, [selectedSessionId, waSessions]);

  // Checklist
  const hasNodes = nodes.length > 0;
  const hasTrigger = nodes.some((n) => n.type === "trigger");
  const orphanCount = (() => {
    if (!nodes.length) return 0;
    const incoming = new Set<string>();
    edges.forEach((e) => incoming.add(e.target));
    return nodes.filter((n) => n.type !== "trigger" && !incoming.has(n.id)).length;
  })();
  const channelOk = !!selectedSessionId && connectedSessions.some((s) => s.id === selectedSessionId);
  const allOk = hasNodes && hasTrigger && orphanCount === 0 && channelOk;

  const openActivate = () => {
    setActivateOpen(true);
    fetchWaSessions();
  };

  // Pausar o chatbot ativo (mantém published_flow_id, só desativa)
  const [isPausing, setIsPausing] = useState(false);
  const handlePause = async () => {
    if (!publishedFlowId) return;
    setIsPausing(true);
    try {
      const { error } = await supabase
        .from("chatbot_flows")
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq("id", publishedFlowId);
      if (error) throw error;
      setIsActive(false);
      if (routeSessionId) {
        await supabase
          .from("chatbot_builder_sessions")
          .update({ is_active: false })
          .eq("id", routeSessionId);
      }
      refreshSessions();
      toast({ title: "Chatbot pausado", description: "Ele parou de responder. Você pode reativar a qualquer momento." });
    } catch (e: any) {
      toast({ title: "Erro ao pausar", description: e?.message, variant: "destructive" });
    } finally {
      setIsPausing(false);
    }
  };

  // Mobile: ao terminar de criar/atualizar fluxo, mostra um CTA "Ver preview"
  // dentro do chat ao invés de trocar de tela automaticamente.
  const prevNodesLenRef = useRef(0);
  const [showPreviewCTA, setShowPreviewCTA] = useState(false);

  // Indicador de etapas durante a criação
  const BUILD_STEPS = [
    "Analisando seu pedido",
    "Planejando arquitetura",
    "Criando blocos do fluxo",
    "Validando conexões",
    "Finalizando",
  ] as const;
  const [buildStep, setBuildStep] = useState(0);
  useEffect(() => {
    if (!isThinking) { setBuildStep(0); return; }
    setBuildStep(0);
    const id = setInterval(() => {
      setBuildStep((s) => Math.min(s + 1, BUILD_STEPS.length - 1));
    }, 1800);
    return () => clearInterval(id);
  }, [isThinking]);
  useEffect(() => {
    if (!isMobile) return;
    const prev = prevNodesLenRef.current;
    prevNodesLenRef.current = nodes.length;
    if (!isThinking && nodes.length > prev && nodes.length > 0 && mobileView === "chat") {
      setShowPreviewCTA(true);
    }
  }, [nodes.length, isThinking, isMobile, mobileView]);
  useEffect(() => {
    if (mobileView === "preview") setShowPreviewCTA(false);
  }, [mobileView]);

  const scrollRef = useRef<HTMLDivElement>(null);
  const [showScrollDown, setShowScrollDown] = useState(false);
  const autoPromptSentRef = useRef(false);
  const lastUserPromptRef = useRef<string>("");
  const bootstrappedRef = useRef(false);
  const skipNextSaveRef = useRef(true);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const nameInputRef = useRef<HTMLInputElement | null>(null);
  // Sugestões aleatórias — sorteadas uma vez na montagem e renováveis pelo botão.
  const [suggestions, setSuggestions] = useState<string[]>(() => pickRandomSuggestions(4));
  const reshuffleSuggestions = () => {
    setSuggestions((prev) => {
      // garante que o novo conjunto não seja exatamente igual ao anterior
      for (let i = 0; i < 5; i++) {
        const next = pickRandomSuggestions(4);
        if (next.some((s, idx) => s !== prev[idx])) return next;
      }
      return pickRandomSuggestions(4);
    });
  };

  // Load company
  useEffect(() => {
    (async () => {
      if (!user?.id) return;
      const { data } = await supabase
        .from("company_users")
        .select("company_id")
        .eq("user_id", user.id)
        .single();
      if (data?.company_id) setCompanyId(data.company_id);
    })();
  }, [user?.id]);

  // Load session list
  const refreshSessions = useCallback(async () => {
    if (!user?.id) return;
    const { data } = await supabase
      .from("chatbot_builder_sessions")
      .select("id,title,flow_name,published_flow_id,is_active,updated_at,nodes,edges")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false })
      .limit(50);
    setSessions((data as BuilderSession[]) || []);
    setSessionsLoading(false);
  }, [user?.id]);

  useEffect(() => { refreshSessions(); }, [refreshSessions]);

  // Bootstrap: no session in URL → check for flowId, reuse latest empty or create new and navigate
  useEffect(() => {
    if (bootstrappedRef.current) return;
    if (!user?.id || !companyId || sessionsLoading) return;
    if (routeSessionId) { bootstrappedRef.current = true; return; }
    bootstrappedRef.current = true;
    (async () => {
      const flowId = searchParams.get("flowId");
      
      // If we have a flowId, first try to find an existing session for it
      if (flowId) {
        const existingSession = sessions.find(s => s.published_flow_id === flowId);
        if (existingSession) {
          navigate(`/dashboard/criar-chatbot/${existingSession.id}${location.search}`, { replace: true });
          return;
        }
      }

      const latestEmpty = sessions.find((s: any) => {
        const noFlow = !s.published_flow_id;
        const noNodes = !Array.isArray(s.nodes) || s.nodes.length === 0;
        const noEdges = !Array.isArray(s.edges) || s.edges.length === 0;
        const untitled = !s.flow_name || s.flow_name === "Novo chatbot";
        return s.title === "Nova conversa" && noFlow && noNodes && noEdges && untitled;
      });
      if (latestEmpty) {
        navigate(`/dashboard/criar-chatbot/${latestEmpty.id}${location.search}`, { replace: true });
        return;
      }
      const { data, error } = await supabase
        .from("chatbot_builder_sessions")
        .insert({ 
          user_id: user.id, 
          company_id: companyId, 
          title: "Nova conversa",
          published_flow_id: flowId || null
        })
        .select()
        .single();
      if (error) {
        toast({ title: "Não consegui iniciar a conversa", description: error.message, variant: "destructive" });
        return;
      }
      navigate(`/dashboard/criar-chatbot/${data.id}${location.search}`, { replace: true });
      refreshSessions();
    })();
  }, [user?.id, companyId, routeSessionId, sessionsLoading, sessions, navigate, toast, refreshSessions, searchParams, location.search]);

  // Load a session whenever the route id changes
  useEffect(() => {
    if (!routeSessionId || !user?.id) return;
    setLoadingSession(true);
    skipNextSaveRef.current = true;
    autoPromptSentRef.current = false;
    (async () => {
      const { data, error } = await supabase
        .from("chatbot_builder_sessions")
        .select("*")
        .eq("id", routeSessionId)
        .maybeSingle();
      if (error || !data) {
        toast({ title: "Conversa não encontrada", variant: "destructive" });
        navigate("/dashboard/criar-chatbot", { replace: true });
        return;
      }
      const msgs = Array.isArray(data.messages) && (data.messages as any[]).length > 0
        ? (data.messages as unknown as ChatMessage[])
        : [INTRO_MESSAGE];
      setMessages(msgs);
      const loadedNodes = Array.isArray(data.nodes) ? (data.nodes as unknown as FlowNode[]) : [];
      const loadedEdges = Array.isArray(data.edges) ? (data.edges as unknown as FlowEdge[]) : [];
      setNodes(loadedNodes);
      setEdges(loadedEdges);
      setHistory([{ nodes: loadedNodes, edges: loadedEdges }]);
      setFlowName(data.flow_name || "Novo chatbot");
      setPublishedFlowId(data.published_flow_id || null);
      setIsActive(!!data.is_active);
      setLoadingSession(false);
    })();
  }, [routeSessionId, user?.id, navigate, toast]);

  // Carrega settings (responseDelayMs) do flow publicado/rascunho
  useEffect(() => {
    if (!publishedFlowId) return;
    (async () => {
      const { data } = await supabase
        .from("chatbot_flows")
        .select("*")
        .eq("id", publishedFlowId)
        .maybeSingle();
      const s = ((data as any)?.settings as Record<string, unknown> | null) || {};
      const v = Number((s as any).responseDelayMs);
      if (Number.isFinite(v) && v >= 0) setResponseDelayMs(Math.min(15000, Math.max(0, v)));
    })();
  }, [publishedFlowId]);

  // Auto-enviar prompt vindo do dashboard (Modo Criador) — só depois da sessão carregar
  useEffect(() => {
    const initial = searchParams.get("prompt");
    if (initial && !autoPromptSentRef.current && routeSessionId && !loadingSession) {
      autoPromptSentRef.current = true;
      sendToAI(initial);
      searchParams.delete("prompt");
      setSearchParams(searchParams, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeSessionId, loadingSession]);

  // AUTOSAVE debounced
  useEffect(() => {
    if (!routeSessionId || loadingSession) return;
    if (skipNextSaveRef.current) { skipNextSaveRef.current = false; return; }
    // Só salva automaticamente após a primeira interação real do usuário.
    // Sem nenhum prompt enviado, não há por que persistir nada.
    const hasUserInteraction = messages.some((m) => m.role === "user" && (m.content?.trim()?.length ?? 0) > 0);
    if (!hasUserInteraction) return;
    setSaveState("saving");
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(async () => {
      const firstUser = messages.find((m) => m.role === "user")?.content?.trim() || "";
      const computedTitle = firstUser
        ? (firstUser.length > 48 ? firstUser.slice(0, 48) + "…" : firstUser)
        : "Nova conversa";
      const { error } = await supabase
        .from("chatbot_builder_sessions")
        .update({
          messages: messages as any,
          nodes: nodes as any,
          edges: edges as any,
          flow_name: flowName,
          title: computedTitle,
          updated_at: new Date().toISOString(),
        })
        .eq("id", routeSessionId);
      if (error) { setSaveState("idle"); return; }

      // Também persiste como rascunho em chatbot_flows, pra aparecer em /dashboard/chatbot.
      // Mantém is_active como está (não publica sozinho).
      if (companyId && user?.id && nodes.length > 0) {
        try {
          if (publishedFlowId) {
            await supabase
              .from("chatbot_flows")
              .update({
                name: flowName || "Novo chatbot",
                nodes: nodes as any,
                edges: edges as any,
                settings: { responseDelayMs } as any,
                updated_at: new Date().toISOString(),
              })
              .eq("id", publishedFlowId);
          } else {
            const { data: created, error: insErr } = await supabase
              .from("chatbot_flows")
              .insert({
                company_id: companyId,
                created_by: user.id,
                name: flowName || "Novo chatbot",
                nodes: nodes as any,
                edges: edges as any,
                settings: { responseDelayMs } as any,
                is_active: false, // rascunho até o usuário publicar
              })
              .select("id")
              .single();
            if (!insErr && created?.id) {
              setPublishedFlowId(created.id);
              await supabase
                .from("chatbot_builder_sessions")
                .update({ published_flow_id: created.id })
                .eq("id", routeSessionId);
            }
          }
        } catch (e) {
          // não bloqueia o autosave da sessão se o rascunho falhar
          console.warn("[autosave] rascunho chatbot_flows falhou:", e);
        }
      }

      setSaveState("saved");
      refreshSessions();
      setTimeout(() => setSaveState((s) => (s === "saved" ? "idle" : s)), 1200);
    }, 700);
    return () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages, nodes, edges, flowName, routeSessionId, loadingSession]);

  // Auto-scroll chat — o elemento que rola é o viewport do ScrollArea (Radix),
  // não o div interno; por isso buscamos o ancestral com data-radix-scroll-area-viewport.
  useEffect(() => {
    const inner = scrollRef.current;
    if (!inner) return;
    const viewport = inner.closest("[data-radix-scroll-area-viewport]") as HTMLElement | null;
    const target = viewport ?? inner;
    // dois rAFs garantem que o DOM já refletiu o conteúdo novo antes de rolar
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        target.scrollTo({ top: target.scrollHeight, behavior: "smooth" });
      });
    });
  }, [messages, isThinking]);

  // Mostrar botão "rolar pra baixo" quando o usuário sobe a conversa
  useEffect(() => {
    const inner = scrollRef.current;
    if (!inner) return;
    const viewport = inner.closest("[data-radix-scroll-area-viewport]") as HTMLElement | null;
    const target = viewport ?? inner;
    const onScroll = () => {
      const distance = target.scrollHeight - target.scrollTop - target.clientHeight;
      setShowScrollDown(distance > 160);
    };
    onScroll();
    target.addEventListener("scroll", onScroll, { passive: true });
    return () => target.removeEventListener("scroll", onScroll);
  }, [messages.length]);

  const scrollChatToBottom = useCallback(() => {
    const inner = scrollRef.current;
    if (!inner) return;
    const viewport = inner.closest("[data-radix-scroll-area-viewport]") as HTMLElement | null;
    const target = viewport ?? inner;
    const start = target.scrollTop;
    const end = target.scrollHeight - target.clientHeight;
    const distance = end - start;
    if (distance <= 0) return;
    const duration = Math.min(700, Math.max(280, distance * 0.6));
    const startTime = performance.now();
    const easeInOutCubic = (t: number) =>
      t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    const step = (now: number) => {
      const elapsed = now - startTime;
      const t = Math.min(1, elapsed / duration);
      target.scrollTop = start + distance * easeInOutCubic(t);
      if (t < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, []);

  const nodeCount = nodes.length;
  const moduleSummary = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const n of nodes) counts[n.type] = (counts[n.type] || 0) + 1;
    return counts;
  }, [nodes]);

  const sendToAI = async (
    text: string,
    opts?: { forceMode?: "build" | "plan" | "discuss"; attachments?: PendingAttachment[]; contextOverride?: string[]; deep?: boolean },
  ) => {
    const atts = opts?.attachments ?? attachments;
    const useDeep = opts?.deep ?? deepResearch;
    // Se há blocos selecionados como contexto, prepara um cabeçalho descritivo
    // para a IA saber exatamente sobre quais blocos o usuário está falando.
    const ctxIds = opts?.contextOverride ?? contextNodeIds;
    const ctxNodes = nodes.filter((n) => ctxIds.includes(n.id));
    let composedText = text;
    if (ctxNodes.length > 0) {
      const summary = ctxNodes
        .map((n, i) => {
          const label =
            typeof n.data?.label === "string"
              ? n.data.label
              : (n.data?.label as any)?.label ?? n.type;
          return `${i + 1}. [${n.id}] ${label} (tipo: ${n.type}${(n as any).subType ? "/" + (n as any).subType : ""})`;
        })
        .join("\n");
      composedText =
        `📌 Contexto: o usuário selecionou ${ctxNodes.length} bloco(s) abaixo e a próxima instrução se refere a eles. Use os ids exatos ao alterar.\n${summary}\n\nInstrução: ${text}`;
    }
    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: text,
      attachments: atts.map((a) => ({ name: a.name, mime: a.mime, size: a.size })),
      contextBlocks: ctxNodes.map((n) => ({
        id: n.id,
        label:
          typeof n.data?.label === "string"
            ? (n.data.label as string)
            : ((n.data?.label as any)?.label ?? n.type),
        type: n.type as string,
      })),
    };
    const history = [...messages, userMsg];
    setMessages(history);
    setInput("");
    setAttachments([]);
    // limpa a seleção de blocos após enviar (eles agora ficam visíveis no balão)
    if (ctxNodes.length > 0 && !opts?.contextOverride) {
      setContextNodeIds([]);
    }
    setIsThinking(true);
    lastUserPromptRef.current = text;
    setProcessingText(text || (atts.length ? `(${atts.length} anexo${atts.length > 1 ? "s" : ""})` : ""));
    canceledRef.current = false;
    const myReqId = ++reqIdRef.current;

    try {
      // Etapa opcional: pesquisa profunda na web pra enriquecer o prompt
      let researchedText = composedText;
      if (useDeep && text.trim()) {
        try {
          const urlMatch = text.match(/https?:\/\/[^\s]+/i);
          const foundUrl = urlMatch ? urlMatch[0] : null;

          setProcessingText(foundUrl 
            ? `🔎 Analisando site: ${foundUrl}...`
            : `🔎 Pesquisando na web: "${text.slice(0, 80)}"`
          );

          const { data: rData, error: rErr } = await supabase.functions.invoke(
            "deep-research-prompt",
            { body: { prompt: text, url: foundUrl } },
          );
          if (canceledRef.current || myReqId !== reqIdRef.current) return;
          if (rErr) throw rErr;
          
          const enriched = (rData as any)?.enrichedPrompt as string | undefined;
          const foundImages: any[] = (rData as any)?.images || [];

          if (enriched) {
            researchedText = ctxNodes.length > 0
              ? `${composedText}\n\n${enriched}`
              : enriched;
            
            // mostra um aviso no chat com as fontes e imagens
            const cits: string[] = (rData as any)?.citations || [];
            let assistantNote = `🔎 **Pesquisa profunda concluída** — ${cits.length} fonte${cits.length === 1 ? "" : "s"} consultada${cits.length === 1 ? "" : "s"}.`;
            
            if (foundImages.length > 0) {
              assistantNote += `\n\n🖼️ **Encontrei ${foundImages.length} imagens** que podem ser úteis para os produtos:\n` + 
                foundImages.slice(0, 5).map(img => `• [Ver Imagem](${img.url}) - ${img.title || "Sem título"}`).join("\n");
              
              assistantNote += "\n\n*Você pode pedir para eu aplicar essas imagens nos blocos correspondentes.*";
            } else {
              if (cits.length > 0) {
                assistantNote += "\n\n" + cits.slice(0, 5).map((c, i) => `[${i + 1}] ${c}`).join("\n");
              }
            }

            setMessages((prev) => [
              ...prev,
              {
                id: crypto.randomUUID(),
                role: "assistant",
                content: assistantNote,
              },
            ]);
          }
          setProcessingText(text);
        } catch (re: any) {
          console.warn("deep research falhou, seguindo sem:", re?.message);
          toast({
            title: "Pesquisa profunda indisponível",
            description: "Continuando sem enriquecimento.",
          });
        }
      }

      const { data, error } = await supabase.functions.invoke("chatbot-builder-ai", {
        body: {
          messages: history
            .filter((m) => m.role === "user" || m.role === "assistant")
            .map((m, idx, arr) => ({
              role: m.role,
              // injeta a versão enriquecida apenas na última mensagem do usuário
              content: idx === arr.length - 1 && m.role === "user" ? researchedText : m.content,
            })),
          currentFlow: { nodes, edges },
          flowId: publishedFlowId,
          flowName,
          forceMode: opts?.forceMode,
          attachments: atts.map((a) => ({
            name: a.name,
            mime: a.mime,
            dataUrl: a.dataUrl,
            textPreview: a.textPreview,
            publicUrl: a.publicUrl,
          })),
        },
      });
      if (canceledRef.current || myReqId !== reqIdRef.current) return;
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);

      const assistantText: string = (data as any)?.assistant_message || "Pronto.";
      const newFlow = (data as any)?.flow || { nodes: [], edges: [] };
      const newName: string = (data as any)?.flow_name || "";
      const mode: "discuss" | "plan" | "build" = (data as any)?.mode || "build";
      console.log("[chatbot-builder-ai] response", { mode, assistantText, nodeCount: newFlow?.nodes?.length });

      setMessages((prev) => [
        ...prev,
        { id: crypto.randomUUID(), role: "assistant", content: assistantText },
      ]);

      // Botões de aprovar/ajustar plano só aparecem quando a IA propõe um plano.
      setPendingPlan(mode === "plan");

      // Só atualiza o preview quando a IA explicitamente passou para o modo build.
      if (mode === "build") {
        if (Array.isArray(newFlow.nodes)) {
          const ns = newFlow.nodes as FlowNode[];
          const es = (Array.isArray(newFlow.edges) ? newFlow.edges : []) as FlowEdge[];
          // Nunca deixa nada solto: conecta órfãos automaticamente
          const connected = ensureConnectedEdges(ns, es);
          
          // Add to history before updating state
          setHistory(prev => {
            const next = [...prev, { nodes: ns, edges: connected }];
            return next.slice(-20); // Keep last 20 states
          });
          
          setNodes(ns);
          setEdges(connected);
        } else if (Array.isArray(newFlow.edges)) {
          const es = newFlow.edges as FlowEdge[];
          setHistory(prev => {
            const next = [...prev, { nodes, edges: es }];
            return next.slice(-20);
          });
          setEdges(es);
        }
        if (newName && !publishedFlowId) setFlowName(newName);
        // limpa contexto após enviar — IA já considerou os blocos
        setContextNodeIds([]);
      }
    } catch (e: any) {
      if (canceledRef.current || myReqId !== reqIdRef.current) return;
      console.error(e);
      toast({
        title: "Não consegui atualizar o chatbot",
        description: e?.message || "Tente novamente em instantes.",
        variant: "destructive",
      });
      setMessages((prev) => [
        ...prev,
        { id: crypto.randomUUID(), role: "assistant", content: "Tive um problema agora. Pode repetir o pedido?" },
      ]);
    } finally {
      if (myReqId === reqIdRef.current) {
        setIsThinking(false);
        setProcessingText("");
      }
    }
  };

  const cancelGeneration = () => {
    if (!isThinking) return;
    canceledRef.current = true;
    reqIdRef.current++; // invalida resposta em andamento
    setIsThinking(false);
    setProcessingText("");
    setMessages((prev) => [
      ...prev,
      { id: crypto.randomUUID(), role: "assistant", content: "_Geração cancelada._" },
    ]);
    toast({ title: "Geração cancelada" });
  };

  // ------- Gravação de áudio + transcrição (elevenlabs-stt) -------
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      const mime =
        MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
          ? "audio/webm;codecs=opus"
          : MediaRecorder.isTypeSupported("audio/webm")
          ? "audio/webm"
          : "audio/mp4";
      const mr = new MediaRecorder(stream, { mimeType: mime });
      audioChunksRef.current = [];
      mr.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) audioChunksRef.current.push(e.data);
      };
      mr.onstop = async () => {
        mediaStreamRef.current?.getTracks().forEach((t) => t.stop());
        mediaStreamRef.current = null;
        const blob = new Blob(audioChunksRef.current, { type: mime });
        if (blob.size < 1500) {
          toast({ title: "Áudio muito curto", description: "Tente gravar novamente." });
          return;
        }
        setIsTranscribing(true);
        try {
          const ext = mime.includes("webm") ? "webm" : "mp4";
          const fd = new FormData();
          fd.append("audio", new File([blob], `recording.${ext}`, { type: mime }));
          const { data, error } = await supabase.functions.invoke("elevenlabs-stt", {
            body: fd,
          });
          if (error) throw error;
          const t = (data as any)?.text?.trim();
          if (t) {
            setInput((prev) => (prev ? `${prev} ${t}` : t));
          } else {
            toast({ title: "Não consegui transcrever", description: "Tente falar mais alto/pausado." });
          }
        } catch (e: any) {
          toast({
            title: "Erro ao transcrever",
            description: e?.message || "Falha no serviço de áudio.",
            variant: "destructive",
          });
        } finally {
          setIsTranscribing(false);
        }
      };
      mr.start();
      mediaRecorderRef.current = mr;
      setIsRecording(true);
    } catch (e: any) {
      toast({
        title: "Microfone bloqueado",
        description: "Permita o acesso ao microfone para gravar.",
        variant: "destructive",
      });
    }
  };

  const stopRecording = () => {
    try { mediaRecorderRef.current?.stop(); } catch {}
    mediaRecorderRef.current = null;
    setIsRecording(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const text = input.trim();
    if (!text && attachments.length === 0) return;
    if (isThinking) {
      // Enfileira: snapshot do prompt + anexos + contexto
      const item: QueueItem = {
        id: crypto.randomUUID(),
        text,
        atts: [...attachments],
        ctx: [...contextNodeIds],
      };
      setQueueItems((q) => [...q, item]);
      setInput("");
      setAttachments([]);
      setContextNodeIds([]);
      toast({
        title: "Adicionado à fila",
        description: `Sua mensagem será enviada assim que a geração atual terminar.`,
      });
      return;
    }
    sendToAI(text);
  };

  // Processa a próxima mensagem da fila quando a IA terminar
  useEffect(() => {
    if (isThinking) return;
    if (queueItems.length === 0) return;
    const [next, ...rest] = queueItems;
    setQueueItems(rest);
    // pequeno delay para a UI assentar antes de disparar de novo
    const t = setTimeout(() => {
      sendToAI(next.text, {
        attachments: next.atts,
        contextOverride: next.ctx,
        forceMode: next.opts?.forceMode,
      });
    }, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isThinking]);

  const readFileAsDataUrl = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result as string);
      r.onerror = () => reject(r.error);
      r.readAsDataURL(file);
    });

  const readFileAsText = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result as string);
      r.onerror = () => reject(r.error);
      r.readAsText(file);
    });

  const MAX_FILE_MB = 15;
  const handleFilesSelected = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const accepted: PendingAttachment[] = [];
    for (const file of Array.from(files)) {
      if (file.size > MAX_FILE_MB * 1024 * 1024) {
        toast({
          title: `${file.name} é muito grande`,
          description: `Limite de ${MAX_FILE_MB}MB por arquivo.`,
          variant: "destructive",
        });
        continue;
      }
      try {
        const dataUrl = await readFileAsDataUrl(file);
        const mime = file.type || "application/octet-stream";
        let textPreview: string | undefined;
        const isTextLike =
          mime.startsWith("text/") ||
          /(json|xml|csv|yaml|yml|javascript|typescript|html|markdown)/i.test(mime) ||
          /\.(txt|md|csv|json|xml|yml|yaml|log|html|js|ts|tsx|jsx|css)$/i.test(file.name);
        if (isTextLike) {
          const t = await readFileAsText(file);
          textPreview = t.slice(0, 20000);
        }

        // Sobe pra storage para que a IA possa referenciar essa mídia no fluxo
        // (ex.: "envie essa imagem de saudação" → message.image com mediaUrl).
        let publicUrl: string | undefined;
        try {
          const safe = file.name.replace(/[^\w.\-]+/g, "_");
          const path = `chatbot-builder/${user?.id ?? "anon"}/${Date.now()}-${safe}`;
          const { error: upErr } = await supabase.storage
            .from("workflow-attachments")
            .upload(path, file, { cacheControl: "3600", upsert: false });
          if (!upErr) {
            const { data: pub } = supabase.storage
              .from("workflow-attachments")
              .getPublicUrl(path);
            publicUrl = pub.publicUrl;
          }
        } catch {
          // segue só com dataUrl — a IA ainda consegue interpretar o conteúdo
        }

        accepted.push({
          id: crypto.randomUUID(),
          name: file.name,
          mime,
          size: file.size,
          dataUrl,
          textPreview,
          publicUrl,
        });
      } catch (err: any) {
        toast({ title: `Falha ao ler ${file.name}`, description: err?.message, variant: "destructive" });
      }
    }
    if (accepted.length) setAttachments((prev) => [...prev, ...accepted]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeAttachment = (id: string) =>
    setAttachments((prev) => prev.filter((a) => a.id !== id));

  const fmtSize = (b: number) => (b < 1024 ? `${b}B` : b < 1024 * 1024 ? `${(b / 1024).toFixed(0)}KB` : `${(b / 1024 / 1024).toFixed(1)}MB`);

  const handleReloadPreview = () => {
    if (isThinking) return;
    const last = lastUserPromptRef.current
      || [...messages].reverse().find((m) => m.role === "user")?.content
      || "Gere um fluxo inicial de chatbot de boas-vindas no WhatsApp com 3 opções de menu.";
    sendToAI(`Regere o preview com base no pedido anterior: "${last}". Devolva o fluxo completo (nodes e edges).`);
  };

  const handleApprovePlan = () => {
    if (isThinking) return;
    setPendingPlan(false);
    sendToAI(
      "Aprovado ✅ Pode construir o fluxo agora seguindo exatamente o plano acima. Reaproveite o que já existe e devolva o flow completo com nodes e edges (mode: build).",
      { forceMode: "build" },
    );
  };

  const handleAdjustPlan = () => {
    setPendingPlan(false);
    const el = document.querySelector<HTMLTextAreaElement>('textarea[placeholder^="Descreva"]');
    if (el) {
      el.focus();
      el.value = "Quero ajustar o plano: ";
      setInput("Quero ajustar o plano: ");
    }
  };

  // Navegação bloco a bloco no preview — só reage quando a QUANTIDADE de blocos muda
  // (build novo / reload), não a cada autosave ou arraste, pra não recentralizar o canvas.
  const prevNodeCountRef = useRef(0);
  useEffect(() => {
    const prev = prevNodeCountRef.current;
    prevNodeCountRef.current = nodes.length;
    if (nodes.length === 0) {
      setFocusNodeId(null);
      setFocusIndex(0);
      return;
    }
    if (prev === nodes.length) return; // mesma quantidade: não recentraliza
    const idx = Math.min(focusIndex, nodes.length - 1);
    setFocusIndex(idx);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes.length]);

  const goPrev = () => {
    if (nodes.length === 0) return;
    const next = (focusIndex - 1 + nodes.length) % nodes.length;
    setFocusIndex(next);
    const node = nodes[next];
    // força mudança de id para o effect de foco disparar
    setFocusNodeId(null);
    setTimeout(() => setFocusNodeId(node.id), 0);
    setSelectedNodeId(node.id);
  };
  const goNext = () => {
    if (nodes.length === 0) return;
    const next = (focusIndex + 1) % nodes.length;
    setFocusIndex(next);
    const node = nodes[next];
    setFocusNodeId(null);
    setTimeout(() => setFocusNodeId(node.id), 0);
    setSelectedNodeId(node.id);
  };

  const handleFocusApplied = useCallback(() => {
    setFocusNodeId(null);
  }, []);

  // PUBLICAR — cria/atualiza chatbot_flows e ativa
  const handlePublish = async (opts?: { sessionId?: string }) => {
    if (!companyId || !user?.id) {
      toast({ title: "Faça login para publicar", variant: "destructive" });
      return;
    }
    if (nodes.length === 0) {
      toast({ title: "Nada para publicar", description: "Peça à IA para gerar o fluxo primeiro." });
      return;
    }
    setIsPublishing(true);
    try {
      const sid = opts?.sessionId || selectedSessionId || undefined;
      // Injeta o sessionId no node de trigger (se houver) para o webhook reconhecer o canal
      const nodesToSave = sid
        ? nodes.map((n: any) =>
            n.type === "trigger"
              ? { ...n, data: { ...n.data, config: { ...(n.data?.config || {}), sessionId: sid } } }
              : n,
          )
        : nodes;
      const payload: any = {
        name: flowName || "Novo chatbot",
        nodes: nodesToSave as any,
        edges: edges as any,
        settings: { responseDelayMs },
        trigger_config: { type: "whatsapp_channel", ...(sid ? { sessionId: sid } : {}) },
        is_active: true,
      };
      let flowIdToUse = publishedFlowId;
      if (flowIdToUse) {
        const { error } = await supabase
          .from("chatbot_flows")
          .update({ ...payload, updated_at: new Date().toISOString() })
          .eq("id", flowIdToUse);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from("chatbot_flows")
          .insert({ company_id: companyId, created_by: user.id, ...payload })
          .select()
          .single();
        if (error) throw error;
        flowIdToUse = data.id;
        setPublishedFlowId(data.id);
      }
      setIsActive(true);
      if (routeSessionId) {
        await supabase
          .from("chatbot_builder_sessions")
          .update({ published_flow_id: flowIdToUse, is_active: true })
          .eq("id", routeSessionId);
      }
      refreshSessions();
      toast({ title: "Chatbot publicado!", description: "Já está ativo e disponível na sua Ellosuit." });
    } catch (e: any) {
      toast({ title: "Erro ao publicar", description: e?.message, variant: "destructive" });
    } finally {
      setIsPublishing(false);
    }
  };

  // SALVAR rascunho manualmente (sem ativar). Reaproveita a lógica do autosave.
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const handleSaveDraft = async () => {
    if (!routeSessionId || !companyId || !user?.id) {
      toast({ title: "Faça login para salvar", variant: "destructive" });
      return;
    }
    setIsSavingDraft(true);
    setSaveState("saving");
    try {
      const firstUser = messages.find((m) => m.role === "user")?.content?.trim() || "";
      const computedTitle = firstUser
        ? (firstUser.length > 48 ? firstUser.slice(0, 48) + "…" : firstUser)
        : (flowName || "Nova conversa");
      const { error } = await supabase
        .from("chatbot_builder_sessions")
        .update({
          messages: messages as any,
          nodes: nodes as any,
          edges: edges as any,
          flow_name: flowName,
          title: computedTitle,
          updated_at: new Date().toISOString(),
        })
        .eq("id", routeSessionId);
      if (error) throw error;

      if (nodes.length > 0) {
        if (publishedFlowId) {
          await supabase
            .from("chatbot_flows")
            .update({
              name: flowName || "Novo chatbot",
              nodes: nodes as any,
              edges: edges as any,
              updated_at: new Date().toISOString(),
            })
            .eq("id", publishedFlowId);
        } else {
          const { data: created } = await supabase
            .from("chatbot_flows")
            .insert({
              company_id: companyId,
              created_by: user.id,
              name: flowName || "Novo chatbot",
              nodes: nodes as any,
              edges: edges as any,
              is_active: false,
            })
            .select("id")
            .single();
          if (created?.id) {
            setPublishedFlowId(created.id);
            await supabase
              .from("chatbot_builder_sessions")
              .update({ published_flow_id: created.id })
              .eq("id", routeSessionId);
          }
        }
      }
      setSaveState("saved");
      refreshSessions();
      toast({ title: "Rascunho salvo" });
      setTimeout(() => setSaveState((s) => (s === "saved" ? "idle" : s)), 1200);
    } catch (e: any) {
      setSaveState("idle");
      toast({ title: "Erro ao salvar", description: e?.message, variant: "destructive" });
    } finally {
      setIsSavingDraft(false);
    }
  };
  
  const handleUndo = () => {
    if (history.length <= 1) {
      toast({ title: "Nada para desfazer", description: "Você já está na versão inicial." });
      return;
    }
    
    const newHistory = [...history];
    newHistory.pop(); // Remove current state
    const lastState = newHistory[newHistory.length - 1];
    
    setNodes(lastState.nodes);
    setEdges(lastState.edges);
    setHistory(newHistory);
    toast({ title: "Desfeito", description: "Voltamos para a versão anterior do fluxo." });
  };

  const handleNewConversation = async () => {
    if (!companyId || !user?.id) return;
    const { data, error } = await supabase
      .from("chatbot_builder_sessions")
      .insert({ user_id: user.id, company_id: companyId, title: "Nova conversa" })
      .select()
      .single();
    if (error) {
      toast({ title: "Erro ao criar conversa", description: error.message, variant: "destructive" });
      return;
    }
    refreshSessions();
    navigate(`/dashboard/criar-chatbot/${data.id}`);
  };

  const handleDeleteSession = async (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!confirm("Apagar esta conversa? Esta ação não pode ser desfeita.")) return;
    await supabase.from("chatbot_builder_sessions").delete().eq("id", id);
    setSessions((prev) => prev.filter((s) => s.id !== id));
    if (id === routeSessionId) navigate("/dashboard/criar-chatbot", { replace: true });
  };

  return (
    <div className="fixed inset-0 z-50 flex h-[100dvh] w-[100dvw] flex-col overflow-hidden bg-[#ecebe4] dark:bg-background">
      {/* Header — Claude style: flat, quiet, single row */}
      <header className="flex-shrink-0 border-b border-border bg-[#f3f2ee] dark:bg-[#161616] backdrop-blur-xl">
        <div className="h-14 px-4 flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard/chatbot")} className="rounded-xl px-2">
          <ArrowLeft className="h-4 w-4" />{!isMobile && <span className="ml-1">Voltar</span>}
        </Button>
          <div className="flex-1 min-w-0">
            <div className="group flex items-center gap-1.5 min-w-0">
              <Input
                ref={nameInputRef}
                value={flowName}
                onChange={(e) => setFlowName(e.target.value)}
                onFocus={(e) => e.currentTarget.select()}
                title="Clique para renomear"
                className="border-0 bg-transparent text-sm md:text-base font-semibold focus-visible:ring-0 px-0 h-7 truncate min-w-0 flex-1"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => {
                  const el = nameInputRef.current;
                  if (el) { el.focus(); el.select(); }
                }}
                title="Renomear chatbot"
                aria-label="Renomear chatbot"
                className="h-6 w-6 rounded-md text-muted-foreground hover:text-foreground opacity-70 hover:opacity-100 shrink-0"
              >
                <Pencil className="h-3.5 w-3.5" />
              </Button>
            </div>
            <div className="flex items-center gap-2 text-[10px] md:text-xs text-muted-foreground">
              <span className="hidden md:inline">Criação de chatbot com IA</span>
              {publishedFlowId && (
                <Badge variant="secondary" className="h-4 px-1.5 text-[10px]">
                  {isActive ? "Publicado" : "Rascunho"}
                </Badge>
              )}
              <span className="flex items-center gap-1 text-[10px] text-muted-foreground/80">
                {saveState === "saving" && (<><Loader2 className="h-3 w-3 animate-spin" /> Salvando…</>)}
                {saveState === "saved" && (<><CheckCircle2 className="h-3 w-3 text-emerald-500" /> Salvo</>)}
              </span>
            </div>
          </div>
          <div className="ml-auto flex items-center gap-1.5">
          <Button
            size="sm"
            variant="outline"
            className="rounded-xl h-9 w-9 p-0"
            disabled={history.length <= 1}
            onClick={handleUndo}
            title="Desfazer última alteração da IA"
            aria-label="Desfazer"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>

          <Button
          size="sm"
          variant="outline"
          className="rounded-xl h-9 w-9 p-0"
          disabled={nodes.length === 0}
          onClick={() => {
            setNodes((prev) => autoLayoutNodes(prev, edges));
            toast({ title: "Blocos reorganizados" });
          }}
          title="Reorganizar blocos"
          aria-label="Reorganizar blocos"
        >
          <LayoutGrid className="h-4 w-4" />
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="rounded-xl h-9 w-9 p-0"
          disabled={nodes.length === 0}
          onClick={() => setTestOpen(true)}
          title="Testar chatbot"
          aria-label="Testar chatbot"
        >
          <Play className="h-4 w-4" />
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="rounded-xl h-9 w-9 p-0"
          disabled={isSavingDraft || !routeSessionId}
          onClick={handleSaveDraft}
          title="Salvar rascunho"
          aria-label="Salvar rascunho"
        >
          {isSavingDraft ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="rounded-xl h-9 w-9 p-0"
          onClick={() => setSettingsOpen(true)}
          title="Configurações"
          aria-label="Configurações"
        >
          <SettingsIcon className="h-4 w-4" />
        </Button>
        {isActive ? (
          <div className="flex items-center gap-1.5 bg-background/50 border border-border rounded-xl p-1">
            <Button
              size="sm"
              variant="ghost"
              className="rounded-lg text-muted-foreground h-8 px-2 hover:bg-muted"
              disabled={isPausing}
              onClick={handlePause}
            >
              {isPausing ? <Loader2 className="h-3 w-3 animate-spin mr-1.5" /> : <Pause className="h-3 w-3 mr-1.5" />}
              Pausar
            </Button>
            <div className="w-[1px] h-4 bg-border mx-0.5" />
            <Button
              size="sm"
              className="rounded-lg text-white h-8 px-3 relative overflow-hidden bg-emerald-500 hover:bg-emerald-600 border border-emerald-400/40"
              disabled={isPublishing || nodes.length === 0}
              onClick={openActivate}
              title="Salvar e aplicar alterações no bot rodando"
            >
              <span
                aria-hidden
                className="absolute left-1.5 inline-flex h-1.5 w-1.5 rounded-full bg-white"
              >
                <span className="absolute inline-flex h-full w-full rounded-full bg-white opacity-75 animate-ping" />
              </span>
              <span className="pl-3.5 inline-flex items-center text-xs">
                {isPublishing ? "Salvando..." : "Salvar Alterações"}
              </span>
            </Button>
          </div>
        ) : (
          <Button
            size="sm"
            className="rounded-xl text-white px-3 h-9"
            style={{ backgroundColor: BRAND }}
            disabled={isPublishing || nodes.length === 0}
            onClick={openActivate}
            title="Ativar chatbot"
          >
            {isPublishing ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Power className="h-4 w-4 mr-1" />}
            <span className="text-xs md:text-sm">Ativar</span>
          </Button>
        )}
      </div>
    </div>
  </header>

      {/* Mobile tab switcher: Chat / Preview */}
      {isMobile && (
        <div className="flex items-center gap-1 px-3 py-2 border-b border-border bg-card/40">
          <button
            onClick={() => setMobileView("chat")}
            className={cn(
              "flex-1 h-9 rounded-xl text-sm font-medium transition",
              mobileView === "chat" ? "text-white shadow-sm" : "text-muted-foreground bg-muted/50"
            )}
            style={mobileView === "chat" ? { backgroundColor: BRAND } : undefined}
          >
            Chat
          </button>
          <button
            onClick={() => setMobileView("preview")}
            className={cn(
              "flex-1 h-9 rounded-xl text-sm font-medium transition inline-flex items-center justify-center gap-1.5",
              mobileView === "preview" ? "text-white shadow-sm" : "text-muted-foreground bg-muted/50"
            )}
            style={mobileView === "preview" ? { backgroundColor: BRAND } : undefined}
          >
            Preview
            {nodes.length > 0 && (
              <span className={cn("text-[10px] rounded-full px-1.5 py-0.5 tabular-nums",
                mobileView === "preview" ? "bg-white/25" : "bg-background"
              )}>{nodes.length}</span>
            )}
          </button>
        </div>
      )}

      <div className="flex-1 flex min-h-0 relative">
        {/* CHAT */}
        <div className={cn(
          "flex flex-col border-r border-border bg-[#f8f7f3] dark:bg-card/30 min-h-0 transition-all duration-300",
          isMobile ? (mobileView === "chat" ? "flex flex-1" : "hidden") : "w-[320px] md:w-[420px] shrink-0"
        )}>
          <div className="flex-1 min-h-0 relative">
          <ScrollArea className="h-full">
            <div ref={scrollRef} className="p-4 space-y-4">
              {messages.map((m) => (
                <div key={m.id} className={`flex gap-2 ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                  {m.role === "assistant" && (
                    <RadialGlowOrb size={28} color={BRAND} className="mt-0.5" />
                  )}
                  <div
                    className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap break-words ${
                      m.role === "user" ? "text-white" : "bg-white dark:bg-muted text-foreground shadow-sm"
                    }`}
                    style={m.role === "user" ? { backgroundColor: BRAND } : undefined}
                  >
                    {m.contextBlocks && m.contextBlocks.length > 0 && (
                      <div className="mb-2 flex flex-wrap gap-1.5">
                        {m.contextBlocks.map((b) => (
                          <span
                            key={b.id}
                            className={`inline-flex items-center gap-1 rounded-lg px-2 py-0.5 text-[11px] font-medium ${
                              m.role === "user"
                                ? "bg-white/20 text-white border border-white/30"
                                : "bg-[#374DA4]/10 text-[#374DA4] border border-[#374DA4]/30"
                            }`}
                            title={`Bloco: ${b.label}`}
                          >
                            <Crosshair className="h-3 w-3" />
                            <span className="truncate max-w-[160px]">{b.label}</span>
                          </span>
                        ))}
                      </div>
                    )}
                    {renderRichText(m.content)}
                    {m.attachments && m.attachments.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {m.attachments.map((a, i) => (
                          <span
                            key={i}
                            className={`inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] ${
                              m.role === "user" ? "bg-white/20" : "bg-background/80 border border-border"
                            }`}
                          >
                            <FileText className="h-3 w-3" />
                            <span className="truncate max-w-[160px]">{a.name}</span>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  {m.role === "user" && (
                    <div className="h-7 w-7 rounded-xl bg-muted flex items-center justify-center shrink-0">
                      <UserIcon className="h-4 w-4 text-muted-foreground" />
                    </div>
                  )}
                </div>
              ))}
              {isThinking && (
                <div className="flex gap-2 justify-start">
                  <RadialGlowOrb size={28} color={BRAND} className="mt-0.5" />
                  <div className="rounded-2xl px-3 py-2 text-sm bg-muted flex items-center gap-2">
                    <Loader2 className="h-3 w-3 animate-spin" /> montando o fluxo...
                  </div>
                </div>
              )}

              {isMobile && showPreviewCTA && !isThinking && nodes.length > 0 && (
                <div className="flex justify-start pl-9">
                  <Button
                    size="sm"
                    className="rounded-xl text-white shadow-md"
                    style={{ backgroundColor: BRAND }}
                    onClick={() => { setMobileView("preview"); setShowPreviewCTA(false); }}
                  >
                    <Eye className="h-4 w-4 mr-1.5" />
                    Ver preview ({nodes.length} {nodes.length === 1 ? "bloco" : "blocos"})
                  </Button>
                </div>
              )}

              {pendingPlan && !isThinking && (
                <div className="flex flex-col gap-2 pl-9">
                  <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
                    Aprovar o plano antes de construir?
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    <Button
                      size="sm"
                      className="rounded-xl text-white"
                      style={{ backgroundColor: BRAND }}
                      onClick={handleApprovePlan}
                    >
                      <ThumbsUp className="h-4 w-4 mr-1" /> Aprovar e construir
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="rounded-xl"
                      onClick={handleAdjustPlan}
                    >
                      <Pencil className="h-4 w-4 mr-1" /> Pedir ajustes
                    </Button>
                  </div>
                </div>
              )}

              {messages.length <= 1 && (
                <div className="space-y-2 pt-2">
                  <div className="flex items-center justify-between px-1">
                    <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Sugestões</div>
                    <button
                      type="button"
                      onClick={reshuffleSuggestions}
                      className="text-[10px] uppercase tracking-wider text-muted-foreground hover:text-foreground transition"
                      title="Sortear novas sugestões"
                    >
                      ↻ trocar
                    </button>
                  </div>
                  {suggestions.map((s) => (
                    <button
                      key={s}
                      onClick={() => sendToAI(s)}
                      className="w-full text-left text-sm rounded-xl border border-border bg-background/60 hover:bg-muted px-3 py-2 transition"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </ScrollArea>
          {showScrollDown && (
            <button
              type="button"
              onClick={scrollChatToBottom}
              aria-label="Rolar para a última mensagem"
              className="absolute bottom-3 right-3 z-10 h-9 w-9 rounded-full bg-background border border-border shadow-lg flex items-center justify-center hover:bg-muted transition"
            >
              <ArrowDown className="h-4 w-4 text-foreground" />
            </button>
          )}
          </div>

          <form onSubmit={handleSubmit} className="p-3 border-t border-border bg-background/80 backdrop-blur">
            {contextNodeIds.length > 0 && (
              <div className="mb-2 flex flex-wrap items-center gap-1.5">
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground mr-1">
                  Falando sobre
                </span>
                {nodes
                  .filter((n) => contextNodeIds.includes(n.id))
                  .map((n) => {
                    const label =
                      typeof n.data?.label === "string"
                        ? n.data.label
                        : (n.data?.label as any)?.label ?? n.type;
                    return (
                      <span
                        key={n.id}
                        className="inline-flex items-center gap-1 rounded-lg border border-[#374DA4]/30 bg-[#374DA4]/10 px-2 py-1 text-[11px] text-[#374DA4] font-medium"
                      >
                        <Crosshair className="h-3 w-3" />
                        <span className="truncate max-w-[140px]">{label}</span>
                        <button
                          type="button"
                          onClick={() =>
                            setContextNodeIds((prev) => prev.filter((id) => id !== n.id))
                          }
                          className="ml-0.5 rounded p-0.5 hover:bg-[#374DA4]/20"
                          aria-label={`Remover ${label}`}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    );
                  })}
                <button
                  type="button"
                  onClick={() => setContextNodeIds([])}
                  className="text-[10px] text-muted-foreground hover:text-foreground underline"
                >
                  limpar
                </button>
              </div>
            )}
            {attachments.length > 0 && (
              <div className="mb-2 flex flex-wrap gap-1.5">
                {attachments.map((a) => (
                  <span
                    key={a.id}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-muted/60 px-2 py-1 text-[11px]"
                  >
                    <FileText className="h-3 w-3 text-muted-foreground" />
                    <span className="truncate max-w-[160px]">{a.name}</span>
                    <span className="text-muted-foreground">{fmtSize(a.size)}</span>
                    <button
                      type="button"
                      onClick={() => removeAttachment(a.id)}
                      className="ml-0.5 rounded p-0.5 hover:bg-background"
                      aria-label={`Remover ${a.name}`}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
            <div className="rounded-2xl border border-input bg-background shadow-sm focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-0 transition-shadow">
              <Textarea
                ref={composerRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSubmit(e as any);
                  }
                }}
                placeholder={
                  isRecording
                    ? "🎙️ Gravando... toque no microfone para parar"
                    : isTranscribing
                    ? "Transcrevendo áudio..."
                    : isThinking
                    ? "IA gerando... sua mensagem entra na fila"
                    : deepResearch
                    ? "Modo pesquisa profunda ativo — descreva sua ideia..."
                    : "Descreva o chatbot ou peça uma alteração..."
                }
                rows={1}
                className="border-0 bg-transparent shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 resize-none px-4 pt-3 pb-1 text-sm min-h-[52px] max-h-[320px] overflow-y-auto leading-relaxed"
              />
              <input
                ref={fileInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={(e) => handleFilesSelected(e.target.files)}
              />
              <div className="flex items-center justify-between gap-1 px-2 pb-2 pt-1">
                <div className="flex items-center gap-1">
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  disabled={isThinking || isRecording || isTranscribing}
                  onClick={() => fileInputRef.current?.click()}
                  className="h-8 w-8 rounded-xl text-muted-foreground hover:text-foreground"
                  title="Anexar arquivos (PDF, imagem, texto, etc.)"
                >
                  <Paperclip className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  disabled={isThinking || isTranscribing}
                  onClick={isRecording ? stopRecording : startRecording}
                  className={cn(
                    "h-8 w-8 rounded-xl",
                    isRecording
                      ? "text-white bg-red-600 hover:bg-red-700 animate-pulse"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                  title={isRecording ? "Parar gravação" : "Gravar áudio"}
                >
                  {isTranscribing ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : isRecording ? (
                    <Square className="h-4 w-4 fill-current" />
                  ) : (
                    <Mic className="h-4 w-4" />
                  )}
                </Button>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  disabled={isThinking || isRecording}
                  onClick={() => {
                    setDeepResearch((v) => !v);
                    toast({
                      title: !deepResearch ? "Pesquisa profunda ativada" : "Pesquisa profunda desativada",
                      description: !deepResearch
                        ? "A IA fará buscas na web antes de gerar (pode demorar mais)."
                        : undefined,
                    });
                  }}
                  className={cn(
                    "h-8 w-8 rounded-xl",
                    deepResearch
                      ? "text-white"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                  style={deepResearch ? { backgroundColor: BRAND } : undefined}
                  title={deepResearch ? "Pesquisa profunda: ativada" : "Pesquisa profunda na web"}
                >
                  <Globe className="h-4 w-4" />
                </Button>
                </div>
                <Button
                type="submit"
                size="icon"
                onClick={(e) => {
                  // Quando está gerando e não há texto, o botão cancela em vez de enviar
                  if (isThinking && !input.trim() && attachments.length === 0) {
                    e.preventDefault();
                    cancelGeneration();
                  }
                }}
                disabled={!isThinking && !input.trim() && attachments.length === 0}
                className="h-8 w-8 rounded-xl text-white shrink-0"
                style={{
                  backgroundColor:
                    isThinking && !input.trim() && attachments.length === 0 ? "#dc2626" : BRAND,
                }}
                title={
                  isThinking
                    ? input.trim() || attachments.length
                      ? "Adicionar à fila"
                      : "Cancelar geração"
                    : "Enviar"
                }
              >
                {isThinking
                  ? input.trim() || attachments.length
                    ? <Plus className="h-4 w-4" />
                    : <StopCircle className="h-4 w-4" />
                  : <Send className="h-4 w-4" />}
                </Button>
              </div>
            </div>
            {queuedCount > 0 && (
              <div className="mt-2 rounded-xl border border-[#374DA4]/30 bg-[#374DA4]/5 px-3 py-2 text-[11px] space-y-1.5">
                <>
                    <div className="flex items-center justify-between">
                      <span className="text-[#374DA4] font-medium">
                        Fila ({queuedCount})
                      </span>
                      <button
                        type="button"
                        onClick={() => setConfirmClearQueue(true)}
                        className="inline-flex items-center gap-1 text-[#374DA4]/80 hover:text-[#374DA4]"
                      >
                        <Trash2 className="h-3 w-3" /> limpar tudo
                      </button>
                    </div>
                    <ul className="space-y-1">
                      {queueItems.map((q, idx) => (
                        <li
                          key={q.id}
                          className="flex items-center gap-2 rounded-md bg-background/60 px-2 py-1"
                        >
                          <span className="shrink-0 inline-flex h-4 min-w-4 px-1 items-center justify-center rounded-full bg-[#374DA4] text-white text-[9px] font-bold">
                            {idx + 1}
                          </span>
                          <span className="flex-1 truncate text-foreground/80" title={q.text}>
                            {q.text || `(${q.atts.length} anexo${q.atts.length > 1 ? "s" : ""})`}
                          </span>
                          <button
                            type="button"
                            onClick={() => setQueueItems((arr) => arr.filter((x) => x.id !== q.id))}
                            className="shrink-0 text-muted-foreground hover:text-red-600"
                            title="Remover desta fila"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </li>
                      ))}
                    </ul>
                </>
              </div>
            )}
          </form>
        </div>

        {/* PREVIEW */}
        <div className={cn(
          "flex-col min-h-0 min-w-0 bg-[#ecebe4] dark:bg-background",
          isMobile ? (mobileView === "preview" ? "flex flex-1" : "hidden") : "flex flex-1"
        )}>
          <div className="px-4 py-2 border-b border-border bg-[#f3f2ee] dark:bg-background/60 backdrop-blur flex items-center gap-2 text-xs">
            <Button
              variant="outline"
              size="sm"
              className="rounded-xl h-8 w-8 p-0"
              onClick={goPrev}
              disabled={nodes.length === 0}
              title="Bloco anterior"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="rounded-xl h-8 w-8 p-0"
              onClick={goNext}
              disabled={nodes.length === 0}
              title="Próximo bloco"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            <div className="flex items-center gap-2 min-w-0">
              {nodes.length > 0 ? (
                <>
                  <span className="font-medium tabular-nums text-foreground/80">
                    Bloco {focusIndex + 1} de {nodes.length}
                  </span>
                  <span className="text-muted-foreground truncate opacity-70">
                    · {(nodes[focusIndex]?.data?.label as string) || nodes[focusIndex]?.type}
                  </span>
                </>
              ) : (
                <span className="text-muted-foreground opacity-60">Sem blocos ainda</span>
              )}
            </div>
          </div>
          <div className="flex-1 min-h-0 relative">
            {isThinking ? (
              <div className="absolute inset-0 flex items-center justify-center bg-background z-10">
                <span className="builder-loader" aria-label="Carregando" />
              </div>
            ) : nodes.length === 0 ? (
              <div className="absolute inset-0 flex items-center justify-center p-8 bg-[#ecebe4] dark:bg-background">
                <p className="text-sm text-muted-foreground/60 text-center max-w-sm">
                  Aguardando sua primeira ideia.
                </p>
              </div>
            ) : (
              <div className="absolute inset-0 flex bg-[#ecebe4]">
                <ChatBotCanvas
                  nodes={nodes}
                  edges={edges}
                  onNodesChange={setNodes}
                  onEdgesChange={setEdges}
                  onNodeSelect={(n) => setSelectedNodeId(n?.id || null)}
                  selectedNodeId={selectedNodeId}
                  focusNodeId={focusNodeId}
                  onFocusApplied={handleFocusApplied}
                  hideHints
                  contextNodeIds={contextNodeIds}
                  onNodeEdit={(n) => setEditingNodeId(n.id)}
                  onPickContext={(n) => {
                    setContextNodeIds((prev) =>
                      prev.includes(n.id) ? prev.filter((id) => id !== n.id) : [...prev, n.id]
                    );
                    if (isMobile) setMobileView("chat");
                  }}
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Test simulator dialog — runs the flow exactly as built */}
      <Dialog open={testOpen} onOpenChange={setTestOpen}>
        <DialogContent
          className={cn(
            "!flex flex-col p-0 overflow-hidden gap-0 border-border bg-background [&>button]:hidden",
            isMobile
              ? "!left-0 !top-0 !translate-x-0 !translate-y-0 !max-w-none !w-[100dvw] !h-[100dvh] !max-h-[100dvh] rounded-none sm:rounded-none"
              : "!max-w-[440px] !w-[min(440px,calc(100vw-24px))] !h-[min(720px,calc(100dvh-32px))] !max-h-[calc(100dvh-32px)] rounded-2xl"
          )}
        >
          <DialogHeader className="sr-only">
            <DialogTitle>Testar chatbot</DialogTitle>
          </DialogHeader>
          <div className="w-full flex-1 min-h-0 overflow-hidden">
            {testOpen && (
              <ChatBotTestSimulator
                nodes={nodes}
                edges={edges}
                onClose={() => setTestOpen(false)}
                onHighlightNode={(id) => setSelectedNodeId(id)}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>

      <ChatBotConnectionsDialog
        open={connectionsOpen}
        onOpenChange={setConnectionsOpen}
        companyId={companyId}
      />

      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle>Configurações do chatbot</DialogTitle>
          </DialogHeader>
          <div className="space-y-5 pt-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">
                Tempo entre mensagens (segundos)
              </label>
              <p className="text-xs text-muted-foreground">
                Quanto o bot espera entre enviar um card e o próximo. Padrão: 3s.
                Vale também para o intervalo até a primeira resposta após uma mensagem do contato.
              </p>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min={0}
                  max={15}
                  step={0.5}
                  value={responseDelayMs / 1000}
                  onChange={(e) => setResponseDelayMs(Math.round(parseFloat(e.target.value) * 1000))}
                  className="flex-1 accent-[color:var(--brand,#374DA4)]"
                  style={{ accentColor: BRAND }}
                />
                <Input
                  type="number"
                  min={0}
                  max={15}
                  step={0.5}
                  value={(responseDelayMs / 1000).toString()}
                  onChange={(e) => {
                    const v = parseFloat(e.target.value);
                    if (Number.isFinite(v)) {
                      setResponseDelayMs(Math.min(15000, Math.max(0, Math.round(v * 1000))));
                    }
                  }}
                  className="w-20 h-9 rounded-xl"
                />
                <span className="text-sm text-muted-foreground">s</span>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 pt-2">
              <Button variant="outline" className="rounded-xl" onClick={() => setSettingsOpen(false)}>
                Cancelar
              </Button>
              <Button
                className="rounded-xl text-white"
                style={{ backgroundColor: BRAND }}
                disabled={savingSettings}
                onClick={async () => {
                  if (!publishedFlowId) {
                    toast({
                      title: "Salve um rascunho primeiro",
                      description: "Envie uma mensagem para a IA gerar o fluxo antes de configurar.",
                    });
                    setSettingsOpen(false);
                    return;
                  }
                  setSavingSettings(true);
                  try {
                    const { error } = await supabase
                      .from("chatbot_flows")
                      .update({ settings: { responseDelayMs } as any, updated_at: new Date().toISOString() })
                      .eq("id", publishedFlowId);
                    if (error) throw error;
                    toast({ title: "Configurações salvas" });
                    setSettingsOpen(false);
                  } catch (e: any) {
                    toast({ title: "Erro ao salvar", description: e?.message, variant: "destructive" });
                  } finally {
                    setSavingSettings(false);
                  }
                }}
              >
                {savingSettings ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : null}
                Salvar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Node config dialog — opens via gear button or double-click on a block */}
      <Dialog open={!!editingNodeId} onOpenChange={(o) => !o && setEditingNodeId(null)}>
        <DialogContent className="max-w-lg p-0 rounded-2xl overflow-hidden max-h-[90vh] flex flex-col">
          <DialogHeader className="sr-only">
            <DialogTitle>Configurar bloco</DialogTitle>
          </DialogHeader>
          {editingNodeId && (
            <ChatBotPropertiesPanel
              node={nodes.find((n) => n.id === editingNodeId) || null}
              flowId={publishedFlowId}
              onClose={() => setEditingNodeId(null)}
              embedded
              onUpdate={(nodeId, updates) =>
                setNodes((prev) =>
                  prev.map((n) =>
                    n.id === nodeId
                      ? { ...n, ...updates, data: { ...n.data, ...(updates.data || {}) } }
                      : n
                  )
                )
              }
            />
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmClearQueue} onOpenChange={setConfirmClearQueue}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Limpar fila de mensagens?</AlertDialogTitle>
            <AlertDialogDescription>
              {queuedCount} mensage{queuedCount > 1 ? "ns serão removidas" : "m será removida"} da fila
              e não {queuedCount > 1 ? "serão" : "será"} enviada{queuedCount > 1 ? "s" : ""} para a IA.
              A geração atual continua normalmente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setQueueItems([]);
                setConfirmClearQueue(false);
                toast({ title: "Fila limpa" });
              }}
              className="bg-red-600 hover:bg-red-700"
            >
              Limpar tudo
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ATIVAR — Checklist de pré-publicação */}
      <Dialog open={activateOpen} onOpenChange={setActivateOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Power className="h-5 w-5" style={{ color: BRAND }} />
              Ativar chatbot
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            {/* 1. Canal */}
            <div className="rounded-xl border border-border bg-card/60 p-3">
              <div className="flex items-start gap-2">
                {channelOk ? (
                  <CheckCircle2 className="h-5 w-5 text-emerald-500 mt-0.5 shrink-0" />
                ) : (
                  <AlertCircle className="h-5 w-5 text-amber-500 mt-0.5 shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium">Etapa 1 — Canal do WhatsApp</div>
                  <div className="text-xs text-muted-foreground mb-2">
                    Selecione qual número responde por esse chatbot.
                  </div>

                  {waLoading ? (
                    <div className="text-xs text-muted-foreground flex items-center gap-2">
                      <Loader2 className="h-3 w-3 animate-spin" /> Carregando sessões…
                    </div>
                  ) : connectedSessions.length === 0 ? (
                    <div className="rounded-lg bg-amber-500/10 border border-amber-500/30 p-2.5 text-xs space-y-2">
                      <div className="font-medium text-amber-700 dark:text-amber-400">
                        Nenhum WhatsApp conectado.
                      </div>
                      {!inlineConnecting ? (
                        <>
                          <div className="text-muted-foreground">
                            Conecte um número agora mesmo — sem sair dessa tela.
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            <Button
                              size="sm"
                              className="h-8 rounded-lg text-white"
                              style={{ backgroundColor: BRAND }}
                              onClick={startInlineConnect}
                              disabled={inlineCreating}
                            >
                              {inlineCreating ? (
                                <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                              ) : (
                                <Phone className="h-3.5 w-3.5 mr-1.5" />
                              )}
                              Conectar WhatsApp aqui
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 rounded-lg"
                              onClick={fetchWaSessions}
                            >
                              <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Recarregar
                            </Button>
                          </div>
                        </>
                      ) : (
                        <WhatsAppQRInline
                          qrCode={inlineQrCode}
                          sessionId={inlineSessionId}
                          onConnected={handleInlineConnected}
                        />
                      )}
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      {connectedSessions.map((s) => {
                        const sel = selectedSessionId === s.id;
                        return (
                          <button
                            key={s.id}
                            type="button"
                            onClick={() => setSelectedSessionId(s.id)}
                            className={cn(
                              "w-full text-left rounded-lg border p-2.5 flex items-center gap-2 transition",
                              sel
                                ? "border-[color:var(--brand)] bg-[color:var(--brand)]/5"
                                : "border-border hover:bg-muted/40",
                            )}
                            style={sel ? ({ ["--brand" as any]: BRAND } as any) : undefined}
                          >
                            <Phone className="h-4 w-4 shrink-0" style={{ color: BRAND }} />
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-medium truncate">
                                {s.phone_number || s.instance_name}
                              </div>
                              <div className="text-[11px] text-muted-foreground truncate">
                                {s.instance_name} · conectado
                              </div>
                            </div>
                            {sel && <Check className="h-4 w-4" style={{ color: BRAND }} />}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* 2. Fluxo */}
            <div className="rounded-xl border border-border bg-card/60 p-3">
              <div className="flex items-start gap-2">
                {hasNodes && hasTrigger ? (
                  <CheckCircle2 className="h-5 w-5 text-emerald-500 mt-0.5 shrink-0" />
                ) : (
                  <XCircle className="h-5 w-5 text-red-500 mt-0.5 shrink-0" />
                )}
                <div className="flex-1">
                  <div className="text-sm font-medium">Etapa 2 — Fluxo criado</div>
                  <div className="text-xs text-muted-foreground">
                    {hasNodes
                      ? `${nodes.length} blocos${hasTrigger ? " · gatilho definido" : " · falta um bloco de gatilho"}`
                      : "Peça à IA para gerar o fluxo no chat antes de ativar."}
                  </div>
                </div>
              </div>
            </div>

            {/* 3. Conexões */}
            <div className="rounded-xl border border-border bg-card/60 p-3">
              <div className="flex items-start gap-2">
                {orphanCount === 0 ? (
                  <CheckCircle2 className="h-5 w-5 text-emerald-500 mt-0.5 shrink-0" />
                ) : (
                  <AlertCircle className="h-5 w-5 text-amber-500 mt-0.5 shrink-0" />
                )}
                <div className="flex-1">
                  <div className="text-sm font-medium">Etapa 3 — Blocos conectados</div>
                  <div className="text-xs text-muted-foreground">
                    {orphanCount === 0
                      ? "Todos os blocos estão ligados."
                      : `${orphanCount} bloco(s) solto(s). Peça à IA para reorganizar/conectar.`}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <Button variant="outline" className="rounded-xl" onClick={() => setActivateOpen(false)}>
              Fechar
            </Button>
            <Button
              className="rounded-xl text-white"
              style={{ backgroundColor: BRAND, opacity: allOk && !isPublishing ? 1 : 0.5 }}
              disabled={!allOk || isPublishing}
              onClick={async () => {
                await handlePublish({ sessionId: selectedSessionId });
                setActivateOpen(false);
              }}
            >
              {isPublishing ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <Power className="h-4 w-4 mr-1" />
              )}
              Ativar agora
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ChatbotAIBuilder;