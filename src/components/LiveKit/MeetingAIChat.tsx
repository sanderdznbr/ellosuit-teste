import React, { useState, useRef, useEffect } from 'react';
import { Bot, Send, X, Loader2, Minimize2, Maximize2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface MeetingAIChatProps {
  transcriptionMessages: Array<{ text: string; timestamp: string; speaker?: string }>;
  roomName: string;
}

export const MeetingAIChat: React.FC<MeetingAIChatProps> = ({
  transcriptionMessages,
  roomName
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setIsLoading(true);

    try {
      // Build context from transcription
      const transcriptContext = transcriptionMessages
        .map(m => `[${new Date(m.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}] ${m.speaker || 'Participante'}: ${m.text}`)
        .join('\n');

      const systemPrompt = `Você é um assistente AI dentro de uma reunião virtual. Você tem acesso à transcrição da reunião em tempo real e pode responder perguntas sobre o que foi discutido.

Transcrição da reunião até agora:
${transcriptContext || '[Nenhuma transcrição disponível ainda]'}

Responda de forma concisa e útil. Se perguntarem sobre algo específico da reunião, cite quando foi mencionado. Se não houver informação na transcrição, diga que ainda não foi discutido.`;

      const { data, error } = await supabase.functions.invoke('ai-chat', {
        body: {
          messages: [
            { role: 'system', content: systemPrompt },
            ...messages.map(m => ({ role: m.role, content: m.content })),
            { role: 'user', content: userMessage }
          ]
        }
      });

      if (error) throw error;

      if (data?.response) {
        setMessages(prev => [...prev, { role: 'assistant', content: data.response }]);
      } else {
        throw new Error('Resposta inválida da IA');
      }
    } catch (error) {
      console.error('Error sending message:', error);
      console.error("Erro ao enviar mensagem para IA");
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) {
    return (
      <Button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-24 right-6 h-14 w-14 rounded-full shadow-lg bg-primary hover:bg-primary/90"
        size="icon"
      >
        <Bot className="h-6 w-6" />
      </Button>
    );
  }

  return (
    <Card className={`fixed ${isMinimized ? 'bottom-24 right-6 w-80' : 'bottom-24 right-6 w-96 h-[500px]'} shadow-2xl flex flex-col bg-background border-2 border-primary/20 transition-all duration-200`}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border bg-primary/5">
        <div className="flex items-center gap-2">
          <Bot className="h-5 w-5 text-primary" />
          <h3 className="font-semibold text-foreground">Assistente IA da Reunião</h3>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsMinimized(!isMinimized)}
            className="h-7 w-7 p-0"
          >
            {isMinimized ? <Maximize2 className="h-3.5 w-3.5" /> : <Minimize2 className="h-3.5 w-3.5" />}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsOpen(false)}
            className="h-7 w-7 p-0"
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {!isMinimized && (
        <>
          {/* Messages */}
          <ScrollArea className="flex-1 p-4" ref={scrollRef}>
            <div className="space-y-4">
              {messages.length === 0 && (
                <div className="text-center text-muted-foreground text-sm py-8">
                  <Bot className="h-12 w-12 mx-auto mb-3 text-primary/50" />
                  <p className="font-medium">Olá! Sou seu assistente IA.</p>
                  <p className="text-xs mt-1">Pergunte-me sobre o que foi discutido na reunião!</p>
                </div>
              )}
              {messages.map((message, index) => (
                <div
                  key={index}
                  className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[80%] rounded-lg px-4 py-2 ${
                      message.role === 'user'
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-foreground'
                    }`}
                  >
                    <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                  </div>
                </div>
              ))}
              {isLoading && (
                <div className="flex justify-start">
                  <div className="bg-muted rounded-lg px-4 py-2">
                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>

          {/* Input */}
          <div className="p-4 border-t border-border">
            <div className="flex items-center gap-2">
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                placeholder="Pergunte sobre a reunião..."
                disabled={isLoading}
                className="flex-1"
              />
              <Button
                onClick={handleSend}
                disabled={!input.trim() || isLoading}
                size="sm"
                className="h-9"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              {transcriptionMessages.length === 0 
                ? 'Aguardando transcrições...' 
                : `${transcriptionMessages.length} mensagens transcritas`}
            </p>
          </div>
        </>
      )}

      {isMinimized && (
        <div className="p-4 text-center">
          <Bot className="h-8 w-8 mx-auto text-primary" />
          <p className="text-xs text-muted-foreground mt-2">
            {messages.length} mensagens
          </p>
        </div>
      )}
    </Card>
  );
};
