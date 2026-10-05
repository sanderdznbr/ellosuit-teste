import React, { useState, useRef, useEffect } from 'react';
import { Send, ImagePlus, X, Loader2, CheckCircle2, Sparkles, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';

const OMNI_COLOR = '#374DA4';

interface DebugMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  images?: string[];
  timestamp: Date;
  suggestions?: PromptSuggestion[];
}

interface PromptSuggestion {
  field: 'instructions' | 'personality' | 'doNot';
  action: 'add' | 'replace' | 'remove';
  label: string;
  original?: string;
  suggested: string;
  applied?: boolean;
}

interface AgentDebugChatProps {
  agentName: string;
  currentInstructions: string;
  currentPersonality: string;
  currentDoNot: string;
  onApplySuggestion: (field: 'instructions' | 'personality' | 'doNot', newValue: string) => void;
}

const AgentDebugChat: React.FC<AgentDebugChatProps> = ({
  agentName,
  currentInstructions,
  currentPersonality,
  currentDoNot,
  onApplySuggestion,
}) => {
  const { toast } = useToast();
  const [messages, setMessages] = useState<DebugMessage[]>([
    {
      id: '1',
      role: 'assistant',
      content: `Olá! Sou seu assistente de correção para o agente "${agentName}".\n\nEnvie prints de conversas do agente com clientes ou descreva problemas que você observou. Eu vou analisar e sugerir melhorias diretas no prompt do agente.\n\n💡 Dicas:\n• Envie screenshots das respostas problemáticas\n• Descreva o que o agente deveria ter feito diferente\n• Peça para parar de falar algo específico`,
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    Array.from(files).forEach((file) => {
      if (!file.type.startsWith('image/')) return;
      if (file.size > 5 * 1024 * 1024) {
        toast({ title: 'Imagem muito grande', description: 'Máximo 5MB', variant: 'destructive' });
        return;
      }
      const reader = new FileReader();
      reader.onload = (ev) => {
        if (ev.target?.result) {
          setImages((prev) => [...prev, ev.target!.result as string]);
        }
      };
      reader.readAsDataURL(file);
    });
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeImage = (index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
  };

  const parseSuggestions = (text: string): PromptSuggestion[] => {
    const suggestions: PromptSuggestion[] = [];
    // Parse structured suggestions from AI response
    const suggestionRegex = /\[SUGESTÃO:(instructions|personality|doNot):(add|replace|remove)\](.*?)\[\/SUGESTÃO\]/gs;
    let match;
    while ((match = suggestionRegex.exec(text)) !== null) {
      suggestions.push({
        field: match[1] as 'instructions' | 'personality' | 'doNot',
        action: match[2] as 'add' | 'replace' | 'remove',
        label: match[1] === 'instructions' ? 'Instruções' : match[1] === 'personality' ? 'Personalidade' : 'Restrições',
        suggested: match[3].trim(),
      });
    }
    return suggestions;
  };

  const cleanResponseText = (text: string): string => {
    return text.replace(/\[SUGESTÃO:.*?\].*?\[\/SUGESTÃO\]/gs, '').trim();
  };

  const sendMessage = async () => {
    if ((!input.trim() && images.length === 0) || loading) return;

    const userMsg: DebugMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim(),
      images: [...images],
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setImages([]);
    setLoading(true);

    try {
      const systemPrompt = `Você é um especialista em otimização de agentes de IA/chatbots. O usuário vai enviar screenshots e descrições de problemas do agente "${agentName}".

CONTEXTO DO AGENTE ATUAL:
- Personalidade: ${currentPersonality}
- Instruções/Prompt: ${currentInstructions}
- Restrições (O que NÃO fazer): ${currentDoNot || '(nenhuma)'}

SUA TAREFA:
1. Analise a imagem/descrição do problema
2. Identifique o que o agente fez de errado
3. Sugira correções ESPECÍFICAS no prompt do agente
4. Para cada correção, use o formato especial para que o sistema aplique automaticamente:

Para ADICIONAR texto ao campo instruções:
[SUGESTÃO:instructions:add]Texto a adicionar nas instruções[/SUGESTÃO]

Para ADICIONAR restrição:
[SUGESTÃO:doNot:add]Texto da restrição[/SUGESTÃO]

Para SUBSTITUIR a personalidade:
[SUGESTÃO:personality:replace]Nova personalidade completa[/SUGESTÃO]

REGRAS:
- Sempre explique o problema antes de sugerir
- Seja específico nas sugestões
- Mantenha o contexto existente ao adicionar
- Responda em português brasileiro
- Se o usuário enviar imagem, analise o conteúdo visível na screenshot`;

      const userContent: any[] = [];
      if (userMsg.content) {
        userContent.push({ type: 'text', text: userMsg.content });
      }
      if (userMsg.images && userMsg.images.length > 0) {
        userMsg.images.forEach((img) => {
          userContent.push({ type: 'image_url', image_url: { url: img } });
        });
      }

      const allMessages = messages
        .filter((m) => m.id !== '1')
        .map((m) => ({
          role: m.role,
          content: m.role === 'user' && m.images?.length
            ? [
                { type: 'text', text: m.content || 'Analise esta imagem' },
                ...m.images.map((img) => ({ type: 'image_url', image_url: { url: img } })),
              ]
            : m.content,
        }));

      const chatUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-chat`;
      const resp = await fetch(chatUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          messages: [
            { role: 'system', content: systemPrompt },
            ...allMessages,
            { role: 'user', content: userContent.length === 1 ? userContent[0].text || 'Analise esta imagem' : userContent },
          ],
          model: 'google/gemini-2.5-flash',
          stream: true,
        }),
      });

      if (!resp.ok || !resp.body) throw new Error('Erro na resposta');

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let fullContent = '';
      let textBuffer = '';
      const assistantId = Date.now().toString() + '-debug';

      setMessages((prev) => [...prev, { id: assistantId, role: 'assistant', content: '', timestamp: new Date() }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        textBuffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = textBuffer.indexOf('\n')) !== -1) {
          let line = textBuffer.slice(0, newlineIndex);
          textBuffer = textBuffer.slice(newlineIndex + 1);
          if (line.endsWith('\r')) line = line.slice(0, -1);
          if (!line.startsWith('data: ')) continue;
          const jsonStr = line.slice(6).trim();
          if (jsonStr === '[DONE]') break;
          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              fullContent += content;
              const displayContent = cleanResponseText(fullContent);
              setMessages((prev) =>
                prev.map((m) => (m.id === assistantId ? { ...m, content: displayContent } : m))
              );
            }
          } catch {
            /* partial json */
          }
        }
      }

      // Parse suggestions after streaming is complete
      const suggestions = parseSuggestions(fullContent);
      if (suggestions.length > 0) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId ? { ...m, content: cleanResponseText(fullContent), suggestions } : m
          )
        );
      }
    } catch (e) {
      console.error('Debug chat error:', e);
      toast({ title: 'Erro', description: 'Falha ao enviar mensagem', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const applySuggestion = (msgId: string, suggestionIndex: number) => {
    setMessages((prev) =>
      prev.map((m) => {
        if (m.id !== msgId || !m.suggestions) return m;
        const suggestion = m.suggestions[suggestionIndex];
        if (!suggestion || suggestion.applied) return m;

        let currentValue = '';
        if (suggestion.field === 'instructions') currentValue = currentInstructions;
        else if (suggestion.field === 'personality') currentValue = currentPersonality;
        else if (suggestion.field === 'doNot') currentValue = currentDoNot;

        let newValue = currentValue;
        if (suggestion.action === 'add') {
          newValue = currentValue ? `${currentValue}\n\n${suggestion.suggested}` : suggestion.suggested;
        } else if (suggestion.action === 'replace') {
          newValue = suggestion.suggested;
        } else if (suggestion.action === 'remove') {
          newValue = currentValue.replace(suggestion.suggested, '').trim();
        }

        onApplySuggestion(suggestion.field, newValue);

        const updatedSuggestions = [...m.suggestions!];
        updatedSuggestions[suggestionIndex] = { ...suggestion, applied: true };
        return { ...m, suggestions: updatedSuggestions };
      })
    );

    toast({ title: 'Aplicado!', description: 'A sugestão foi aplicada ao prompt do agente. Não esqueça de salvar!' });
  };

  const fieldLabel = (field: string) => {
    if (field === 'instructions') return 'Instruções';
    if (field === 'personality') return 'Personalidade';
    return 'Restrições';
  };

  const actionLabel = (action: string) => {
    if (action === 'add') return 'Adicionar';
    if (action === 'replace') return 'Substituir';
    return 'Remover';
  };

  return (
    <div className="space-y-4">
      <Card className="rounded-2xl border-gray-200">
        <CardContent className="p-0">
          {/* Header */}
          <div className="p-4 border-b flex items-center gap-3">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: `${OMNI_COLOR}15` }}
            >
              <AlertTriangle className="h-4 w-4" style={{ color: OMNI_COLOR }} />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-900">Corrigir com IA</h3>
              <p className="text-xs text-gray-500">Envie prints e descreva problemas para corrigir o agente</p>
            </div>
          </div>

          {/* Messages */}
          <ScrollArea className="h-[450px]">
            <div className="p-4 space-y-4">
              {messages.map((msg) => (
                <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className={`max-w-[85%] rounded-2xl px-4 py-3 ${
                      msg.role === 'user'
                        ? 'text-white'
                        : 'bg-gray-100 text-gray-800'
                    }`}
                    style={msg.role === 'user' ? { backgroundColor: OMNI_COLOR } : {}}
                  >
                    {/* Images */}
                    {msg.images && msg.images.length > 0 && (
                      <div className="flex flex-wrap gap-2 mb-2">
                        {msg.images.map((img, i) => (
                          <img
                            key={i}
                            src={img}
                            alt="Screenshot"
                            className="rounded-lg max-h-40 max-w-full object-contain border border-white/20"
                          />
                        ))}
                      </div>
                    )}

                    {msg.content && (
                      <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                    )}

                    {/* Suggestions */}
                    {msg.suggestions && msg.suggestions.length > 0 && (
                      <div className="mt-3 space-y-2">
                        <div className="text-xs font-medium text-gray-500 flex items-center gap-1">
                          <Sparkles className="h-3 w-3" />
                          Sugestões de correção:
                        </div>
                        {msg.suggestions.map((s, i) => (
                          <div key={i} className="bg-white rounded-xl p-3 border border-gray-200 space-y-2">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <Badge variant="outline" className="text-[10px]">
                                  {fieldLabel(s.field)}
                                </Badge>
                                <Badge
                                  className={`text-[10px] ${
                                    s.action === 'add'
                                      ? 'bg-green-100 text-green-700'
                                      : s.action === 'replace'
                                      ? 'bg-[#DFE4FB] text-[#253573]'
                                      : 'bg-red-100 text-red-700'
                                  }`}
                                >
                                  {actionLabel(s.action)}
                                </Badge>
                              </div>
                              {s.applied ? (
                                <Badge className="bg-green-100 text-green-700 text-[10px] gap-1">
                                  <CheckCircle2 className="h-3 w-3" />
                                  Aplicado
                                </Badge>
                              ) : (
                                <Button
                                  size="sm"
                                  className="h-7 text-xs rounded-lg text-white gap-1"
                                  style={{ backgroundColor: OMNI_COLOR }}
                                  onClick={() => applySuggestion(msg.id, i)}
                                >
                                  <CheckCircle2 className="h-3 w-3" />
                                  Aplicar
                                </Button>
                              )}
                            </div>
                            <p className="text-xs text-gray-600 bg-gray-50 rounded-lg p-2 font-mono whitespace-pre-wrap">
                              {s.suggested.length > 200 ? s.suggested.slice(0, 200) + '...' : s.suggested}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {loading && (
                <div className="flex justify-start">
                  <div className="bg-gray-100 rounded-2xl px-4 py-3 flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin text-gray-500" />
                    <span className="text-sm text-gray-500">Analisando...</span>
                  </div>
                </div>
              )}

              <div ref={chatEndRef} />
            </div>
          </ScrollArea>

          {/* Image Preview */}
          {images.length > 0 && (
            <div className="px-4 py-2 border-t flex gap-2 flex-wrap">
              {images.map((img, i) => (
                <div key={i} className="relative group">
                  <img src={img} alt="" className="h-16 rounded-lg object-cover border" />
                  <button
                    onClick={() => removeImage(i)}
                    className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Input */}
          <div className="p-3 border-t flex items-end gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={handleImageUpload}
            />
            <Button
              variant="ghost"
              size="icon"
              className="h-10 w-10 rounded-xl shrink-0"
              onClick={() => fileInputRef.current?.click()}
              disabled={loading}
            >
              <ImagePlus className="h-5 w-5 text-gray-500" />
            </Button>
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Descreva o problema ou envie um print..."
              className="rounded-xl min-h-[44px] max-h-32 resize-none text-sm"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage();
                }
              }}
            />
            <Button
              size="icon"
              className="h-10 w-10 rounded-xl shrink-0 text-white"
              style={{ backgroundColor: OMNI_COLOR }}
              onClick={sendMessage}
              disabled={loading || (!input.trim() && images.length === 0)}
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AgentDebugChat;
