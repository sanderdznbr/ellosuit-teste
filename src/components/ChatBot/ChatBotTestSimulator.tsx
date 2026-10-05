import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Send, RotateCcw, X, Bot, User,
  ArrowRight, AlertTriangle, Sparkles
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { FlowNode, FlowEdge } from './types';
import { supabase } from '@/integrations/supabase/client';

const BRAND_COLOR = '#374DA4';

// Renders text with URLs as clickable links and image URLs as inline images
const RichText: React.FC<{ text: string }> = ({ text }) => {
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const parts = text.split(urlRegex);
  
  return (
    <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
      {parts.map((part, i) => {
        if (urlRegex.test(part)) {
          // Reset regex lastIndex
          urlRegex.lastIndex = 0;
          const isImage = /\.(jpg|jpeg|png|gif|webp|svg|bmp)(\?.*)?$/i.test(part);
          if (isImage) {
            return (
              <span key={i} className="block my-1">
                <img src={part} alt="Imagem" className="rounded-lg max-w-full max-h-48 object-cover" 
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
              </span>
            );
          }
          return (
            <a key={i} href={part} target="_blank" rel="noopener noreferrer" 
              className="underline break-all" style={{ color: BRAND_COLOR }}>{part}</a>
          );
        }
        return <span key={i}>{part}</span>;
      })}
    </p>
  );
};

interface SimMessage {
  id: string;
  role: 'bot' | 'user' | 'system';
  content: string;
  timestamp: Date;
  nodeId?: string;
  nodeLabel?: string;
}

interface ChatBotTestSimulatorProps {
  nodes: FlowNode[];
  edges: FlowEdge[];
  onClose: () => void;
  onHighlightNode?: (nodeId: string | null) => void;
}

const ChatBotTestSimulator: React.FC<ChatBotTestSimulatorProps> = ({
  nodes,
  edges,
  onClose,
  onHighlightNode,
}) => {
  const [messages, setMessages] = useState<SimMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [currentNodeId, setCurrentNodeId] = useState<string | null>(null);
  const [waitingForInput, setWaitingForInput] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [variables, setVariables] = useState<Record<string, string>>({});
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const messagesRef = useRef<SimMessage[]>([]);
  useEffect(() => { messagesRef.current = messages; }, [messages]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  const addMessage = useCallback((role: SimMessage['role'], content: string, nodeId?: string, nodeLabel?: string) => {
    setMessages(prev => [...prev, {
      id: `msg-${Date.now()}-${Math.random()}`,
      role,
      content,
      timestamp: new Date(),
      nodeId,
      nodeLabel,
    }]);
  }, []);

  const getNextNodes = useCallback((nodeId: string, handleId?: string): FlowNode[] => {
    const outEdges = edges.filter(e => {
      if (e.source !== nodeId) return false;
      if (handleId && e.sourceHandle) return e.sourceHandle === handleId;
      if (!handleId) return !e.sourceHandle || e.sourceHandle === 'default';
      return false;
    });
    return outEdges
      .map(e => nodes.find(n => n.id === e.target))
      .filter(Boolean) as FlowNode[];
  }, [nodes, edges]);

  const processNode = useCallback(async (node: FlowNode) => {
    onHighlightNode?.(node.id);
    setCurrentNodeId(node.id);

    const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

    switch (node.type) {
      case 'trigger': {
        addMessage('system', `▶ Fluxo iniciado: ${node.data.label}`, node.id, node.data.label);
        await delay(500);
        const next = getNextNodes(node.id);
        if (next.length > 0) processNode(next[0]);
        break;
      }

      case 'message': {
        if (node.subType === 'text') {
          const text = node.data.config?.content || node.data.config?.message || node.data.label;
          const resolved = text.replace(/\{\{(\w+)\}\}/g, (_: string, key: string) => variables[key] || `{{${key}}}`);
          addMessage('bot', resolved, node.id, node.data.label);
          await delay(800);
          const next = getNextNodes(node.id);
          if (next.length > 0) processNode(next[0]);
        } else if (node.subType === 'buttons') {
          const text = node.data.config?.content || node.data.config?.message || '';
          const resolved = text.replace(/\{\{(\w+)\}\}/g, (_: string, key: string) => variables[key] || `{{${key}}}`);
          const buttons: string[] = node.data.config?.buttons || [];
          const optionsText = buttons.map((b, i) => `  ${i + 1}. ${b}`).join('\n');
          const fullText = resolved ? `${resolved}\n\n${optionsText}` : optionsText;
          addMessage('bot', fullText, node.id, node.data.label);
          setWaitingForInput(true);
        } else if (node.subType === 'image') {
          const imageUrl = node.data.config?.url || node.data.config?.imageUrl || '';
          const caption = node.data.config?.caption || '';
          const textContent = node.data.config?.content || '';
          const resolvedText = textContent.replace(/\{\{(\w+)\}\}/g, (_: string, key: string) => variables[key] || `{{${key}}}`);
          const content = `__IMG__${imageUrl}__CAPTION__${caption}__TEXT__${resolvedText}`;
          addMessage('bot', content, node.id, node.data.label);
          await delay(600);
          const next = getNextNodes(node.id);
          if (next.length > 0) processNode(next[0]);
        } else {
          addMessage('bot', node.data.config?.content || node.data.config?.message || node.data.label, node.id, node.data.label);
          await delay(600);
          const next = getNextNodes(node.id);
          if (next.length > 0) processNode(next[0]);
        }
        break;
      }

      case 'condition': {
        addMessage('system', `🔀 Condição: ${node.data.label}`, node.id, node.data.label);
        await delay(400);
        // Default: follow "true" path, fallback to first next
        const trueNext = getNextNodes(node.id, 'true');
        const falseNext = getNextNodes(node.id, 'false');
        const defaultNext = getNextNodes(node.id);
        const next = trueNext.length > 0 ? trueNext : (defaultNext.length > 0 ? defaultNext : falseNext);
        if (next.length > 0) processNode(next[0]);
        else addMessage('system', '⚠️ Condição sem saída conectada');
        break;
      }

      case 'action': {
        const actionLabels: Record<string, string> = {
          'assign_tag': '🏷️ Tag atribuída',
          'transfer_human': '👤 Transferido para humano',
          'save_crm': '💾 Salvo no CRM',
          'send_email': '📧 Email enviado',
          'call_api': '🔗 API chamada',
          'set_variable': '📝 Variável definida',
          'ai_agent_inline': '🧠 Agente de IA',
          'transfer_ai_agent': '🤖 Transferido para agente de IA',
        };
        addMessage('system', `${actionLabels[node.subType] || '⚙️ Ação executada'}: ${node.data.label}`, node.id, node.data.label);
        
        if (node.subType === 'set_variable' && node.data.config?.variableName) {
          setVariables(prev => ({
            ...prev,
            [node.data.config.variableName]: node.data.config.variableValue || '',
          }));
        }

        if (node.subType === 'ai_agent_inline') {
          try {
            const cfg = node.data.config || {};
            const userInstr: string = cfg.systemPrompt || cfg.instructions || '';
            const HUMANIZED_BASE = [
              'Você é um atendente humano e simpático conversando pelo WhatsApp em português brasileiro.',
              'Regras IMPORTANTES (siga sempre):',
              '- Responda curto, natural e caloroso, em no máximo 2-3 frases.',
              '- Se for o início da conversa, cumprimente o cliente antes de continuar.',
              '- NUNCA encerre, transfira ou diga que vai sair da conversa por conta própria.',
              '- NUNCA pergunte "Consegui te ajudar?" ou similar logo no começo — só depois de várias trocas.',
              '- Não use as tags [HANDOFF], [STAGE:...], colchetes ou markdown. Texto puro.',
              '- Se faltar informação, peça mais detalhes — nunca abandone a conversa.',
              '- Use o histórico abaixo para manter contexto e não repetir perguntas.',
            ].join('\n');
            const systemPrompt = userInstr
              ? `${HUMANIZED_BASE}\n\n--- Instruções específicas deste atendimento ---\n${userInstr}`
              : HUMANIZED_BASE;
            const history = messagesRef.current
              .filter(m => m.role === 'user' || m.role === 'bot')
              .slice(-20)
              .map(m => ({ role: m.role === 'user' ? 'user' as const : 'assistant' as const, content: m.content }));
            const lastIsUser = history.length > 0 && history[history.length - 1].role === 'user';
            const seedMessages = lastIsUser
              ? history
              : [...history, { role: 'user' as const, content: 'Cumprimente o cliente de forma calorosa e pergunte como pode ajudar hoje.' }];
            const { data, error } = await supabase.functions.invoke('ai-chat', {
              body: {
                model: cfg.model || 'google/gemini-2.5-flash',
                messages: [
                  { role: 'system', content: systemPrompt },
                  ...seedMessages,
                ],
              },
            });
            let aiText: string = (data as any)?.message || (data as any)?.content || (data as any)?.choices?.[0]?.message?.content || '';
            aiText = String(aiText || '')
              .replace(/\[HANDOFF\]/gi, '')
              .replace(/\[STAGE:[^\]]*\]/gi, '')
              .replace(/```[\s\S]*?```/g, '')
              .trim();
            if (!aiText) aiText = cfg.fallbackMessage || 'Pode me contar um pouquinho mais?';
            if (cfg.sendReply !== false) addMessage('bot', aiText, node.id, node.data.label);
            const saveAs = cfg.saveAs || 'ai_response';
            setVariables(prev => ({ ...prev, [saveAs]: aiText }));
            if (error) console.warn('ai_agent_inline error', error);
          } catch (e) {
            console.error('ai_agent_inline error', e);
            addMessage('system', '⚠️ Falha ao chamar IA na simulação.');
          }
          // Agente de IA é conversacional: fica aguardando a próxima mensagem do usuário
          // em vez de avançar automaticamente para o próximo bloco (que normalmente é
          // "transferir para humano" ou encerramento). Isso evita o comportamento de
          // "ignorar e transferir" e mantém o atendimento humanizado.
          setWaitingForInput(true);
          break;
        }

        await delay(400);
        const next = getNextNodes(node.id);
        if (next.length > 0) processNode(next[0]);
        break;
      }

      case 'delay': {
        const seconds = node.data.config?.seconds || 3;
        if (node.subType === 'wait_response') {
          addMessage('system', `⏳ Aguardando resposta do usuário...`, node.id, node.data.label);
          setWaitingForInput(true);
        } else {
          addMessage('system', `⏱️ Aguardando ${seconds}s...`, node.id, node.data.label);
          await delay(Math.min(seconds * 1000, 3000)); // Cap at 3s for testing
          const next = getNextNodes(node.id);
          if (next.length > 0) processNode(next[0]);
        }
        break;
      }

      default: {
        addMessage('system', `⚠️ Bloco não reconhecido: ${node.type}`, node.id, node.data.label);
        const next = getNextNodes(node.id);
        if (next.length > 0) processNode(next[0]);
      }
    }
  }, [addMessage, getNextNodes, variables, onHighlightNode]);

  const startSimulation = useCallback(() => {
    setMessages([]);
    setVariables({});
    setWaitingForInput(false);
    setIsRunning(true);
    onHighlightNode?.(null);

    // Find the root node: prefer trigger, otherwise find nodes with no incoming edges
    const triggerNode = nodes.find(n => n.type === 'trigger');
    if (triggerNode) {
      processNode(triggerNode);
    } else {
      // Find nodes that are not targeted by any edge (root nodes)
      // Pick the one with the smallest x position (leftmost = start of flow)
      const targetIds = new Set(edges.map(e => e.target));
      const rootNodes = nodes.filter(n => !targetIds.has(n.id));
      const sorted = (rootNodes.length > 0 ? rootNodes : nodes).sort((a, b) => a.position.x - b.position.x);
      const startNode = sorted.length > 0 ? sorted[0] : null;
      
      if (startNode) {
        addMessage('system', `▶ Fluxo iniciado`, startNode.id, startNode.data.label);
        setTimeout(() => processNode(startNode), 300);
      } else {
        addMessage('system', '⚠️ Nenhum bloco encontrado no fluxo.');
      }
    }
  }, [nodes, edges, processNode, addMessage, onHighlightNode]);

  const handleUserInput = useCallback(() => {
    if (!inputValue.trim() || !waitingForInput) return;

    const userText = inputValue.trim();
    addMessage('user', userText);
    setInputValue('');
    setWaitingForInput(false);

    const currentNode = nodes.find(n => n.id === currentNodeId);
    if (!currentNode) return;

    if (currentNode.subType === 'buttons') {
      const buttons: string[] = currentNode.data.config?.buttons || [];
      // Match by number or exact text (case insensitive)
      const numChoice = parseInt(userText, 10);
      let matchedIndex = -1;

      if (!isNaN(numChoice) && numChoice >= 1 && numChoice <= buttons.length) {
        matchedIndex = numChoice - 1;
      } else {
        matchedIndex = buttons.findIndex(b => b.toLowerCase() === userText.toLowerCase());
      }

      if (matchedIndex >= 0) {
        const handleId = `btn_${matchedIndex}`;
        const next = getNextNodes(currentNode.id, handleId);
        if (next.length > 0) {
          addMessage('system', `✅ Opção selecionada: ${buttons[matchedIndex]}`);
          setTimeout(() => processNode(next[0]), 400);
        } else {
          // Fallback to default output
          const defaultNext = getNextNodes(currentNode.id);
          if (defaultNext.length > 0) {
            addMessage('system', `✅ Opção: ${buttons[matchedIndex]}`);
            setTimeout(() => processNode(defaultNext[0]), 400);
          } else {
            addMessage('system', '⚠️ Opção sem caminho conectado.');
          }
        }
      } else {
        // Invalid response - follow 'invalid' handle
        const invalidNext = getNextNodes(currentNode.id, 'invalid');
        if (invalidNext.length > 0) {
          addMessage('system', `❌ Resposta inválida. Seguindo caminho alternativo...`);
          setTimeout(() => processNode(invalidNext[0]), 400);
        } else {
          addMessage('system', `❌ Resposta inválida: "${userText}". Nenhum caminho de resposta inválida conectado.`);
          // Re-ask
          setWaitingForInput(true);
        }
      }
    } else if (currentNode.subType === 'wait_response') {
      // Save response as variable if configured
      if (currentNode.data.config?.saveAs) {
        setVariables(prev => ({ ...prev, [currentNode.data.config.saveAs]: userText }));
      }
      const next = getNextNodes(currentNode.id);
      if (next.length > 0) setTimeout(() => processNode(next[0]), 400);
    } else if (currentNode.subType === 'ai_agent_inline') {
      // Continua conversando com o agente de IA no mesmo bloco
      setTimeout(() => processNode(currentNode), 300);
    } else {
      const next = getNextNodes(currentNode.id);
      if (next.length > 0) setTimeout(() => processNode(next[0]), 400);
    }
  }, [inputValue, waitingForInput, currentNodeId, nodes, getNextNodes, addMessage, processNode]);

  const resetSimulation = () => {
    setMessages([]);
    setVariables({});
    setCurrentNodeId(null);
    setWaitingForInput(false);
    setIsRunning(false);
    onHighlightNode?.(null);
  };

  return (
    <div className="relative w-full h-full max-h-full min-h-0 overflow-hidden bg-background flex flex-col">
      {/* Header — clean & minimal */}
      <div className="drag-handle px-4 py-3 border-b border-border bg-background/95 backdrop-blur-xl flex items-center justify-between flex-shrink-0 cursor-move">
        <div className="flex items-center gap-2.5">
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center"
            style={{ background: BRAND_COLOR }}
          >
            <Sparkles className="h-4 w-4 text-white" />
          </div>
          <div className="leading-tight">
            <h3 className="text-sm font-semibold text-foreground">Testar chatbot</h3>
              <p className="text-[11px] text-muted-foreground">Pré-visualização do fluxo</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {isRunning && (
            <Button
              variant="ghost"
              size="icon"
              onClick={resetSimulation}
              className="h-8 w-8 rounded-full hover:bg-accent"
              title="Reiniciar"
            >
              <RotateCcw className="h-4 w-4 text-foreground" />
            </Button>
          )}
          <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8 rounded-full hover:bg-accent">
            <X className="h-4 w-4 text-foreground" />
          </Button>
        </div>
      </div>

      {/* Messages — scrollable */}
      <div
        ref={scrollRef}
        className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 py-4 space-y-3"
        style={{ WebkitOverflowScrolling: 'touch' }}
      >
        {!isRunning && messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center gap-5 px-6 py-10">
            <div
              className="w-14 h-14 rounded-full flex items-center justify-center"
              style={{ background: `${BRAND_COLOR}10` }}
            >
              <Bot className="h-7 w-7" style={{ color: BRAND_COLOR }} />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium text-foreground">Pronto para testar</p>
              <p className="text-xs text-muted-foreground max-w-[260px]">
                Inicie a simulação para conversar com o chatbot exatamente como ele foi montado.
              </p>
            </div>
            <Button
              onClick={startSimulation}
              className="gap-2 rounded-full text-white h-10 px-5 shadow-sm hover:shadow transition-shadow"
              style={{ background: BRAND_COLOR }}
              disabled={nodes.length === 0}
            >
              <ArrowRight className="h-4 w-4" />
              Iniciar simulação
            </Button>
            {nodes.length === 0 && (
              <p className="text-[11px] text-destructive flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" />
                Adicione blocos ao fluxo primeiro
              </p>
            )}
          </div>
        )}

        {messages.map((msg) => (
          <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            {msg.role === 'system' ? (
              <div className="w-full flex justify-center">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-muted/50 border border-border">
                  <span className="text-[11px] text-muted-foreground whitespace-pre-wrap">{msg.content}</span>
                  {msg.nodeLabel && (
                    <button
                      onClick={() => onHighlightNode?.(msg.nodeId || null)}
                      className="text-[10px] hover:underline ml-1"
                      style={{ color: BRAND_COLOR }}
                    >
                      · {msg.nodeLabel}
                    </button>
                  )}
                </div>
              </div>
            ) : msg.role === 'bot' ? (
              <div className="max-w-[85%]">
                <div className="flex items-start gap-2">
                  <div
                    className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
                    style={{ background: BRAND_COLOR }}
                  >
                    <Bot className="h-4 w-4 text-white" />
                  </div>
                  <div className="bg-card border border-border rounded-2xl rounded-tl-sm px-3.5 py-2.5 shadow-sm">
                    {msg.content.startsWith('__IMG__') ? (() => {
                      const imgMatch = msg.content.match(/^__IMG__(.*)__CAPTION__(.*)__TEXT__(.*)$/s);
                      const imgUrl = imgMatch?.[1] || '';
                      const caption = imgMatch?.[2] || '';
                      const textContent = imgMatch?.[3] || '';
                      // Fallback for old format without __TEXT__
                      const fallbackMatch = !imgMatch ? msg.content.match(/^__IMG__(.*)__CAPTION__(.*)$/s) : null;
                      const fImgUrl = fallbackMatch?.[1] || imgUrl;
                      const fCaption = fallbackMatch?.[2] || caption;
                      return (
                        <div className="space-y-2">
                          {textContent && <RichText text={textContent} />}
                          {fImgUrl && (
                            <img 
                              src={fImgUrl} 
                              alt={fCaption || 'Imagem'} 
                              className="rounded-lg max-w-full max-h-48 object-cover"
                              onError={(e) => {
                                (e.target as HTMLImageElement).style.display = 'none';
                                const fallback = (e.target as HTMLImageElement).nextElementSibling;
                                if (fallback) (fallback as HTMLElement).style.display = 'block';
                              }}
                            />
                          )}
                          <p className="text-xs text-muted-foreground hidden">📷 Imagem não disponível</p>
                          {fCaption && <p className="text-xs text-muted-foreground italic">{fCaption}</p>}
                          {!fImgUrl && !fCaption && !textContent && <p className="text-sm text-muted-foreground">📷 Imagem sem URL configurada</p>}
                        </div>
                      );
                    })() : (
                      <RichText text={msg.content} />
                    )}
                  </div>
                </div>
                {msg.nodeLabel && (
                  <button
                    onClick={() => onHighlightNode?.(msg.nodeId || null)}
                    className="text-[10px] mt-1 ml-9 hover:underline opacity-60 hover:opacity-100 transition-opacity"
                    style={{ color: BRAND_COLOR }}
                  >
                    → {msg.nodeLabel}
                  </button>
                )}
              </div>
            ) : (
              <div className="max-w-[85%]">
                <div className="flex items-start gap-2 flex-row-reverse">
                  <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 bg-muted">
                    <User className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="rounded-2xl rounded-tr-sm px-3.5 py-2.5" style={{ background: BRAND_COLOR }}>
                    <p className="text-sm text-white whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}

        {waitingForInput && (
          <div className="flex items-center gap-2 px-2">
            <div className="flex gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: '150ms' }} />
              <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
            <span className="text-[11px] text-muted-foreground">Aguardando sua resposta</span>
          </div>
        )}
      </div>

      {/* Variables */}
      {Object.keys(variables).length > 0 && (
        <div className="max-h-20 overflow-y-auto px-4 py-2 border-t border-border bg-background flex-shrink-0">
          <p className="text-[10px] font-medium text-muted-foreground mb-1">Variáveis</p>
          <div className="flex flex-wrap gap-1">
            {Object.entries(variables).map(([k, v]) => (
              <Badge key={k} variant="secondary" className="text-[10px] rounded-full font-normal">
                {k}={v}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Input */}
      <div className="px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] border-t border-border bg-background/95 backdrop-blur-xl flex-shrink-0">
        {isRunning ? (
          <div className="flex gap-2">
            <Input
              ref={inputRef}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleUserInput()}
              placeholder={waitingForInput ? 'Digite sua resposta...' : 'Aguardando o bot...'}
              disabled={!waitingForInput}
              className="h-11 rounded-full text-sm bg-background border-border focus-visible:ring-1 focus-visible:ring-offset-0"
              style={{ ['--tw-ring-color' as any]: BRAND_COLOR }}
              autoFocus
            />
            <Button
              size="icon"
              onClick={handleUserInput}
              disabled={!waitingForInput || !inputValue.trim()}
              className="h-11 w-11 rounded-full flex-shrink-0 text-white transition-opacity"
              style={{ background: BRAND_COLOR, opacity: waitingForInput && inputValue.trim() ? 1 : 0.4 }}
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <Button
            onClick={startSimulation}
            className="w-full gap-2 rounded-full text-white h-10"
            style={{ background: BRAND_COLOR }}
            disabled={nodes.length === 0}
          >
            <ArrowRight className="h-4 w-4" />
            Iniciar simulação
          </Button>
        )}
      </div>
    </div>
  );
};

export default ChatBotTestSimulator;
