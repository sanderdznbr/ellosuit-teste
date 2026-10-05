import React, { useEffect, useRef, useState } from 'react';
import { X, Send, Loader2, Eye, ChevronRight, Maximize2, SquarePen, GripVertical, ChevronDown, Check } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import ReactMarkdown from 'react-markdown';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

interface Msg { role: 'user' | 'assistant'; content: string }

const BrandMark: React.FC<{ className?: string }> = ({ className }) => (
  <div
    className={cn(
      'rounded-xl bg-gradient-to-br from-[#3B9BFF] to-[#007DE3] flex items-center justify-center text-white font-bold',
      className,
    )}
  >
    <svg viewBox="0 0 24 24" fill="none" className="h-1/2 w-1/2" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M6 4h11a1 1 0 011 1v2a1 1 0 01-1 1H9v3h7a1 1 0 011 1v2a1 1 0 01-1 1H9v3h9a1 1 0 011 1v2a1 1 0 01-1 1H6a1 1 0 01-1-1V5a1 1 0 011-1z"
        fill="currentColor"
      />
    </svg>
  </div>
);

const BASE_PROMPT = `Você é o Ello Copilot, um assistente inteligente dentro do CRM Ello.
Você recebe em cada pergunta o CONTEXTO DA TELA que o usuário está vendo (URL, texto visível, conversa selecionada, mensagens do cliente).
Use esse contexto para responder de forma direta, prática e útil.
Sempre responda em português brasileiro. Se algo não estiver no contexto, diga que não encontrou na tela e peça o dado.`;

type ModeId = 'assistente' | 'tecnico' | 'vendas' | 'suporte' | 'copywriter';

const MODES: Array<{ id: ModeId; label: string; description: string; system: string }> = [
  {
    id: 'assistente',
    label: 'Modo Assistente',
    description: 'Ajuda geral sobre a tela',
    system: 'Aja como assistente geral. Se o usuário pedir ajuda para responder um cliente, escreva a resposta pronta em tom natural, focado em atender bem.',
  },
  {
    id: 'tecnico',
    label: 'Modo Técnico',
    description: 'Configurações, integrações e API',
    system: 'Aja como especialista técnico da plataforma Ello. Foque em configurações, integrações, automações, API e resolução de problemas. Seja objetivo e passo a passo.',
  },
  {
    id: 'vendas',
    label: 'Modo Vendas',
    description: 'Fechamento e follow-up',
    system: 'Aja como consultor de vendas. Sugira scripts persuasivos, quebras de objeção, follow-ups e próximos passos para converter o lead.',
  },
  {
    id: 'suporte',
    label: 'Modo Suporte',
    description: 'Atendimento e pós-venda',
    system: 'Aja como agente de suporte ao cliente. Seja empático, resolutivo e claro. Ofereça soluções e próximos passos.',
  },
  {
    id: 'copywriter',
    label: 'Modo Copywriter',
    description: 'Textos, campanhas e mensagens',
    system: 'Aja como copywriter. Escreva mensagens curtas, criativas e persuasivas adequadas ao canal (WhatsApp, e-mail, social).',
  },
];

function captureScreenContext(): string {
  try {
    const url = window.location.pathname + window.location.search;
    const title = document.title;
    const selection = window.getSelection()?.toString()?.trim() || '';

    // Prefer main content if present
    const main = document.querySelector('main') as HTMLElement | null;
    const root = main || document.body;
    let text = (root.innerText || '').replace(/\s+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
    if (text.length > 6000) text = text.slice(0, 6000) + '\n…[truncado]';

    return [
      `URL: ${url}`,
      `Título: ${title}`,
      selection ? `Seleção do usuário:\n"""${selection.slice(0, 800)}"""` : '',
      `Conteúdo visível na tela:\n"""${text}"""`,
    ].filter(Boolean).join('\n\n');
  } catch {
    return 'Não foi possível capturar contexto da tela.';
  }
}

const EllloCopilot: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Msg[]>([]);
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<ModeId>('assistente');
  const scrollRef = useRef<HTMLDivElement>(null);

  const currentMode = MODES.find((m) => m.id === mode) || MODES[0];

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, loading]);

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;
    setInput('');
    const context = captureScreenContext();
    const userMsg: Msg = { role: 'user', content: text };
    const next = [...messages, userMsg];
    setMessages(next);
    setLoading(true);
    try {
      const apiMessages = [
        { role: 'system', content: `${BASE_PROMPT}\n\n${currentMode.system}` },
        { role: 'system', content: `CONTEXTO DA TELA (agora):\n${context}` },
        ...next.map((m) => ({ role: m.role, content: m.content })),
      ];
      const { data, error } = await supabase.functions.invoke('ai-chat', {
        body: { messages: apiMessages, model: 'google/gemini-3-flash-preview' },
      });
      if (error) throw error;
      const reply = (data?.response || data?.message || 'Sem resposta.') as string;
      setMessages((prev) => [...prev, { role: 'assistant', content: reply }]);
    } catch (e: any) {
      setMessages((prev) => [...prev, { role: 'assistant', content: `Erro: ${e?.message || 'falha ao consultar IA'}` }]);
    } finally {
      setLoading(false);
    }
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void send(); }
  };

  return (
    <>
      {/* Backdrop blur gradient (30% → 0%) behind the panel */}
      <div
        aria-hidden
        className={cn(
          'fixed inset-0 z-40 pointer-events-none transition-opacity duration-500',
          open ? 'opacity-100' : 'opacity-0',
        )}
        style={{
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          WebkitMaskImage: 'linear-gradient(to left, rgba(0,0,0,0.30) 0%, rgba(0,0,0,0) 60%)',
          maskImage: 'linear-gradient(to left, rgba(0,0,0,0.30) 0%, rgba(0,0,0,0) 60%)',
        }}
      />

      {/* Side tab trigger (Kommo-style vertical pill) */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          aria-label="Abrir Ello Copilot"
          className="group fixed right-0 bottom-24 z-40 h-[130px] w-[36px] rounded-l-2xl flex flex-col items-center justify-between py-3 text-white shadow-[0_10px_28px_-8px_rgba(0,125,227,0.55)] bg-[#007DE3] hover:bg-[#0A8AEF] transition-all"
        >
          <GripVertical className="h-3.5 w-3.5 opacity-80" />
          <span
            className="text-[13px] font-semibold tracking-wide"
            style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}
          >
            Copilot
          </span>
          <span className="h-1.5 w-1.5 rounded-full bg-white/80" />
        </button>
      )}

      {/* Side panel */}
      <div
        className={cn(
          'fixed top-0 right-0 h-[100dvh] bg-white border-l border-[#E5EEF7] shadow-[-16px_0_48px_-20px_rgba(0,125,227,0.20)] z-50 flex flex-col transition-all duration-300',
          expanded ? 'w-full sm:w-[720px]' : 'w-full sm:w-[400px]',
          open ? 'translate-x-0' : 'translate-x-full',
        )}
      >
        {/* Reopen tab when open (small handle on left edge of panel) */}
        {open && (
          <button
            onClick={() => setOpen(false)}
            aria-label="Recolher Copilot"
            className="absolute -left-6 top-1/2 -translate-y-1/2 h-9 w-6 rounded-l-lg bg-white border border-r-0 border-[#E5EEF7] flex items-center justify-center text-[#007DE3] hover:bg-[#EFF7FF] shadow-sm"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        )}

        {/* Header */}
        <div className="h-14 px-4 flex items-center justify-between border-b border-[#E5EEF7] bg-white shrink-0">
          <div className="flex items-center gap-2.5 text-[#0F172A]">
            <BrandMark className="h-7 w-7" />
            <div className="font-semibold text-[15px] tracking-tight">Ello Copilot</div>
          </div>
          <div className="flex items-center gap-1 text-[#6B7280]">
            <button
              onClick={() => { setMessages([]); setInput(''); }}
              className="p-1.5 rounded-lg hover:bg-[#EFF7FF] hover:text-[#007DE3] transition-colors"
              aria-label="Novo chat"
              title="Novo chat"
            >
              <SquarePen className="h-4 w-4" />
            </button>
            <button
              onClick={() => setExpanded((v) => !v)}
              className="p-1.5 rounded-lg hover:bg-[#EFF7FF] hover:text-[#007DE3] transition-colors"
              aria-label="Expandir"
              title="Expandir"
            >
              <Maximize2 className="h-4 w-4" />
            </button>
            <button onClick={() => setOpen(false)} className="p-1.5 rounded-lg hover:bg-[#EFF7FF] hover:text-[#007DE3] transition-colors" aria-label="Fechar">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Sub row */}
        <button className="h-11 px-4 flex items-center justify-between border-b border-[#E5EEF7] text-[13px] text-[#334155] hover:bg-[#F5FAFF] transition-colors shrink-0">
          <span>Novo chat</span>
          <ChevronRight className="h-4 w-4 text-[#94A3B8]" />
        </button>

        {/* Messages */}
        <ScrollArea className="flex-1 bg-[#FAFBFD]">
          <div ref={scrollRef} className="p-5 space-y-3">
            {messages.length === 0 && (
              <div className="flex flex-col items-center text-center pt-8 px-4">
                <div className="text-[15px] font-semibold text-[#0F172A] tracking-tight">{currentMode.label}</div>
                <p className="text-[13px] text-[#64748B] mt-1.5 leading-relaxed max-w-[280px]">
                  {currentMode.description}. É só pedir — leio o que está na sua tela para te ajudar.
                </p>
              </div>
            )}
            {messages.map((m, i) => (
              <div key={i} className={cn('flex', m.role === 'user' ? 'justify-end' : 'justify-start')}>
                <div
                  className={cn(
                    'max-w-[85%] rounded-2xl px-3.5 py-2 text-[13px] leading-relaxed',
                    m.role === 'user'
                      ? 'bg-gradient-to-br from-[#3B9BFF] to-[#007DE3] text-white rounded-br-md shadow-[0_4px_14px_-6px_rgba(0,125,227,0.5)]'
                      : 'bg-white border border-[#E5EEF7] text-[#0F172A] rounded-bl-md shadow-sm',
                  )}
                >
                  {m.role === 'assistant' ? (
                    <div className="prose prose-sm max-w-none [&_p]:my-1">
                      <ReactMarkdown>{m.content}</ReactMarkdown>
                    </div>
                  ) : (
                    <div className="whitespace-pre-wrap">{m.content}</div>
                  )}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-white border border-[#E5EEF7] text-[#64748B] rounded-2xl rounded-bl-md px-3.5 py-2 text-[13px] flex items-center gap-2 shadow-sm">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Pensando…
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Composer */}
        <div className="p-4 shrink-0 bg-white border-t border-[#E5EEF7] space-y-2.5">
          {/* Mode selector */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="w-full h-10 px-3 flex items-center justify-between rounded-xl border border-[#E5EEF7] bg-white text-[13px] text-[#0F172A] hover:border-[#3B9BFF] hover:bg-[#F5FAFF] transition-colors">
                <span className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#007DE3]" />
                  {currentMode.label}
                </span>
                <ChevronDown className="h-4 w-4 text-[#94A3B8]" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-[--radix-dropdown-menu-trigger-width] p-1 rounded-xl border-[#E5EEF7]">
              {MODES.map((m) => (
                <DropdownMenuItem
                  key={m.id}
                  onClick={() => setMode(m.id)}
                  className="rounded-lg px-2.5 py-2 cursor-pointer focus:bg-[#F5FAFF] focus:text-[#0F172A]"
                >
                  <div className="flex-1">
                    <div className="text-[13px] font-medium text-[#0F172A]">{m.label}</div>
                    <div className="text-[11px] text-[#64748B]">{m.description}</div>
                  </div>
                  {m.id === mode && <Check className="h-4 w-4 text-[#007DE3]" />}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          {/* Prompt */}
          <div className="relative rounded-2xl border border-[#E5EEF7] focus-within:border-[#3B9BFF] focus-within:ring-4 focus-within:ring-[#3B9BFF]/15 transition-all bg-white">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKey}
              placeholder={`Pergunte ao Ello Copilot — ${currentMode.label.replace('Modo ', '')}`}
              rows={2}
              className="resize-none min-h-[68px] max-h-40 text-[13px] border-0 focus-visible:ring-0 shadow-none pr-12 pb-10 bg-transparent placeholder:text-[#94A3B8]"
            />
            <button
              onClick={send}
              disabled={!input.trim() || loading}
              aria-label="Enviar"
              className={cn(
                'absolute right-2 bottom-2 h-8 w-8 rounded-xl flex items-center justify-center transition-all',
                input.trim() && !loading
                  ? 'bg-gradient-to-br from-[#3B9BFF] to-[#007DE3] text-white shadow-[0_4px_12px_-4px_rgba(0,125,227,0.55)] hover:brightness-105'
                  : 'bg-[#F1F5F9] text-[#CBD5E1] cursor-not-allowed',
              )}
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </button>
          </div>
          <div className="text-center text-[11px] text-[#94A3B8] flex items-center justify-center gap-1">
            <Eye className="h-3 w-3" /> O conteúdo gerado por IA pode ser impreciso
          </div>
        </div>
      </div>
    </>
  );
};

export default EllloCopilot;