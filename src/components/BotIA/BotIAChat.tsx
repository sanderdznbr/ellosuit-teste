import React, { useState, useRef, useEffect } from 'react';
import { Send, User, Bot, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';

const OMNI_COLOR = '#374DA4';
const MESSAGE_SEPARATOR = '|||';

function cleanMarkdown(text: string): string {
  return text
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/#{1,6}\s?/g, '')
    .replace(/`{1,3}(.*?)`{1,3}/gs, '$1')
    .replace(/^[-*+]\s/gm, '• ')
    .trim();
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface AIAgent {
  id: string;
  name: string;
  description?: string;
  personality: string;
  instructions: string;
  model: string;
  is_active: boolean;
  avatar_url?: string;
  settings?: any;
}

interface BotIAChatProps {
  agent: AIAgent;
  onClose?: () => void;
}

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-chat`;

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

async function fetchWithRetry(url: string, options: RequestInit, maxRetries = 5): Promise<Response> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const response = await fetch(url, options);
    if (response.status === 429 && attempt < maxRetries - 1) {
      const waitMs = Math.min(3000 * Math.pow(2, attempt), 30000);
      console.log(`Rate limited, retrying in ${waitMs}ms (attempt ${attempt + 1}/${maxRetries})`);
      await sleep(waitMs);
      continue;
    }
    return response;
  }
  throw new Error('Máximo de tentativas atingido');
}

const BotIAChat: React.FC<BotIAChatProps> = ({ agent, onClose }) => {
  const { toast } = useToast();
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content: `Olá! Eu sou ${agent.name}. ${agent.description || 'Como posso ajudá-lo hoje?'}`,
      timestamp: new Date()
    }
  ]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const scrollElement = scrollAreaRef.current?.querySelector('[data-radix-scroll-area-viewport]');
    if (scrollElement) scrollElement.scrollTop = scrollElement.scrollHeight;
  }, [messages]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const settings = agent.settings || {};
  const agentTemperature = settings.temperature ?? 0.7;
  const agentMaxChars = settings.maxResponseChars ?? 500;
  const agentHumor = settings.humor ?? 'profissional';

  const sendMessage = async () => {
    if (!inputMessage.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: inputMessage.trim(),
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    const currentInput = inputMessage.trim();
    setInputMessage('');
    setIsLoading(true);

    const conversationHistory = messages.map(m => ({ role: m.role, content: m.content }));

    const systemPrompt = [
      `Personalidade: ${agent.personality}`,
      `Tom/Humor: ${agentHumor}`,
      '',
      agent.instructions,
      '',
      'IMPORTANTE: Responda como um ser humano real conversando.',
      'NAO use asteriscos, negrito, italico, markdown ou formatacao especial.',
      'Escreva texto corrido e natural, como uma pessoa digitando no WhatsApp.',
      'NAO use listas com marcadores ou numeradas. Escreva em frases corridas.',
      '',
      `REGRA DE LIMITE: Cada mensagem deve ter NO MAXIMO ${agentMaxChars} caracteres.`,
      `Se sua resposta precisar de mais de ${agentMaxChars} caracteres, divida em multiplas mensagens usando o separador "${MESSAGE_SEPARATOR}" entre cada parte.`,
      `Exemplo: "Primeira parte da resposta${MESSAGE_SEPARATOR}Segunda parte da resposta${MESSAGE_SEPARATOR}Terceira parte"`,
      `Cada parte separada por "${MESSAGE_SEPARATOR}" deve respeitar o limite de ${agentMaxChars} caracteres.`,
      'Isso simula um humano enviando varias mensagens curtas seguidas, como no WhatsApp.',
      'Divida de forma natural, nunca corte uma frase no meio.',
      '',
      'Responda sempre em português brasileiro.'
    ].join('\n');

    const apiMessages = [
      { role: 'system' as const, content: systemPrompt },
      ...conversationHistory,
      { role: 'user' as const, content: currentInput }
    ];

    let assistantContent = '';

    try {
      const response = await fetchWithRetry(CHAT_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          messages: apiMessages,
          model: agent.model || 'google/gemini-3-flash-preview',
          stream: true,
          temperature: agentTemperature
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        if (response.status === 429) throw new Error('Limite de requisições atingido. Aguarde alguns segundos.');
        if (response.status === 402) throw new Error('Créditos insuficientes.');
        throw new Error(errorData.error || 'Erro ao processar mensagem');
      }

      if (!response.body) throw new Error('Resposta sem corpo');

      const assistantMessageId = (Date.now() + 1).toString();
      setMessages(prev => [...prev, { id: assistantMessageId, role: 'assistant', content: '', timestamp: new Date() }]);

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let textBuffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        textBuffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = textBuffer.indexOf('\n')) !== -1) {
          let line = textBuffer.slice(0, newlineIndex);
          textBuffer = textBuffer.slice(newlineIndex + 1);
          if (line.endsWith('\r')) line = line.slice(0, -1);
          if (line.startsWith(':') || line.trim() === '') continue;
          if (!line.startsWith('data: ')) continue;
          const jsonStr = line.slice(6).trim();
          if (jsonStr === '[DONE]') break;
          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (content) {
              assistantContent += content;
              // Show streaming content without separator in the temp message
              const displayContent = cleanMarkdown(assistantContent.replace(/\|\|\|/g, '\n\n'));
              setMessages(prev => prev.map(m =>
                m.id === assistantMessageId ? { ...m, content: displayContent } : m
              ));
            }
          } catch {
            textBuffer = line + '\n' + textBuffer;
            break;
          }
        }
      }

      // Flush remaining buffer
      if (textBuffer.trim()) {
        for (let raw of textBuffer.split('\n')) {
          if (!raw) continue;
          if (raw.endsWith('\r')) raw = raw.slice(0, -1);
          if (raw.startsWith(':') || raw.trim() === '') continue;
          if (!raw.startsWith('data: ')) continue;
          const jsonStr = raw.slice(6).trim();
          if (jsonStr === '[DONE]') continue;
          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (content) {
              assistantContent += content;
            }
          } catch { /* ignore */ }
        }
      }

      if (!assistantContent) {
        setMessages(prev => prev.map(m =>
          m.id === assistantMessageId ? { ...m, content: 'Desculpe, não consegui gerar uma resposta.' } : m
        ));
      } else {
        // Split into multiple messages if separator exists
        const parts = assistantContent.split(MESSAGE_SEPARATOR).map(p => cleanMarkdown(p)).filter(p => p.length > 0);
        
        if (parts.length > 1) {
          setMessages(prev => {
            const withoutTemp = prev.filter(m => m.id !== assistantMessageId);
            const newMsgs: Message[] = parts.map((part, i) => ({
              id: `${assistantMessageId}-${i}`,
              role: 'assistant' as const,
              content: part,
              timestamp: new Date(Date.now() + i * 500)
            }));
            return [...withoutTemp, ...newMsgs];
          });
        } else {
          setMessages(prev => prev.map(m =>
            m.id === assistantMessageId ? { ...m, content: cleanMarkdown(assistantContent) } : m
          ));
        }
      }
    } catch (error) {
      console.error('Chat error:', error);
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: error instanceof Error ? error.message : 'Desculpe, ocorreu um erro.',
        timestamp: new Date()
      };
      setMessages(prev => {
        const filtered = prev.filter(m => m.content !== '');
        return [...filtered, errorMessage];
      });
      toast({ title: 'Erro', description: error instanceof Error ? error.message : 'Erro ao conversar com a IA.', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  const formatTime = (date: Date) => date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

  return (
    <Card className="h-full flex flex-col border-0 shadow-none">
      <CardHeader className="flex-shrink-0 border-b px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: `linear-gradient(135deg, ${OMNI_COLOR}, ${OMNI_COLOR}99)` }}>
              <Bot className="h-5 w-5 text-white" />
            </div>
            <div>
              <CardTitle className="text-lg">{agent.name}</CardTitle>
              <p className="text-sm text-gray-500">
                {agent.is_active ? '🟢 Online' : '⚫ Offline'} • elloiav1.0
              </p>
            </div>
          </div>
          {onClose && (
            <Button variant="ghost" size="sm" onClick={onClose}>✕</Button>
          )}
        </div>
      </CardHeader>

      <CardContent className="flex-1 p-0 overflow-hidden">
        <ScrollArea ref={scrollAreaRef} className="h-full px-6 py-4">
          <div className="space-y-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex items-start gap-3 ${message.role === 'user' ? 'flex-row-reverse' : ''}`}
              >
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                  style={message.role === 'user'
                    ? { backgroundColor: '#f3f4f6' }
                    : { background: `linear-gradient(135deg, ${OMNI_COLOR}, ${OMNI_COLOR}99)` }
                  }
                >
                  {message.role === 'user'
                    ? <User className="h-4 w-4 text-gray-500" />
                    : <Bot className="h-4 w-4 text-white" />
                  }
                </div>

                <div
                  className={`max-w-[75%] rounded-2xl px-4 py-3 ${
                    message.role === 'user' ? 'ml-auto text-white' : 'bg-gray-100'
                  }`}
                  style={message.role === 'user' ? { backgroundColor: OMNI_COLOR } : {}}
                >
                  {message.content ? (
                    <p className={`text-sm whitespace-pre-wrap ${message.role === 'user' ? 'text-white' : 'text-gray-900'}`}>
                      {message.content}
                    </p>
                  ) : (
                    <div className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin text-gray-500" />
                      <span className="text-sm text-gray-500">Pensando...</span>
                    </div>
                  )}
                  <p className={`text-xs mt-1 ${message.role === 'user' ? 'text-white/70' : 'text-gray-400'}`}>
                    {formatTime(message.timestamp)}
                  </p>
                </div>
              </div>
            ))}

            {isLoading && messages[messages.length - 1]?.content !== '' && (
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: `linear-gradient(135deg, ${OMNI_COLOR}, ${OMNI_COLOR}99)` }}>
                  <Bot className="h-4 w-4 text-white" />
                </div>
                <div className="bg-gray-100 rounded-2xl px-4 py-3">
                  <div className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin text-gray-500" />
                    <span className="text-sm text-gray-500">Digitando...</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </ScrollArea>
      </CardContent>

      <div className="border-t p-4 flex-shrink-0">
        <div className="flex gap-2">
          <Input
            ref={inputRef}
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder={`Conversar com ${agent.name}...`}
            disabled={isLoading}
            className="flex-1 rounded-xl"
          />
          <Button
            onClick={sendMessage}
            disabled={!inputMessage.trim() || isLoading}
            size="icon"
            className="rounded-xl text-white"
            style={{ backgroundColor: OMNI_COLOR }}
          >
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
      </div>
    </Card>
  );
};

export default BotIAChat;
