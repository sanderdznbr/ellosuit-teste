import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Send, Loader2, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  isLoading?: boolean;
}

function formatContent(text: string): string {
  return text
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/\n/g, '<br/>');
}

interface ElloAIPopupProps {
  open: boolean;
  onClose: () => void;
  initialMessage?: string;
}

const ElloAIPopup: React.FC<ElloAIPopupProps> = ({ open, onClose, initialMessage }) => {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const hasSentInitial = useRef(false);

  useEffect(() => {
    if (user?.id) {
      supabase.from('company_users').select('company_id').eq('user_id', user.id).maybeSingle()
        .then(({ data }) => setCompanyId(data?.company_id || null));
    }
  }, [user?.id]);

  useEffect(() => {
    if (open && initialMessage && !hasSentInitial.current) {
      hasSentInitial.current = true;
      setTimeout(() => sendMessage(initialMessage), 100);
    }
  }, [open, initialMessage]);

  useEffect(() => {
    if (open && !initialMessage) inputRef.current?.focus();
  }, [open]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Reset state when popup closes
  useEffect(() => {
    if (!open) {
      setMessages([]);
      hasSentInitial.current = false;
    }
  }, [open]);

  const sendMessage = async (text: string) => {
    if (!text.trim() || isProcessing) return;

    const userMsg: Message = { id: crypto.randomUUID(), role: 'user', content: text };
    const loadingMsg: Message = { id: crypto.randomUUID(), role: 'assistant', content: '', isLoading: true };

    setMessages(prev => [...prev, userMsg, loadingMsg]);
    setInput('');
    setIsProcessing(true);

    try {
      const history = [...messages.filter(m => !m.isLoading), userMsg].map(m => ({
        role: m.role,
        content: m.content,
      }));

      const { data, error } = await supabase.functions.invoke('ai-assistant', {
        body: {
          message: text,
          userId: user?.id,
          companyId,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          messages: history,
        },
      });

      if (error) throw error;

      setMessages(prev =>
        prev.map(m => m.isLoading ? { ...m, content: data?.response || 'Sem resposta', isLoading: false } : m)
      );
    } catch (err) {
      console.error('Ello AI error:', err);
      setMessages(prev =>
        prev.map(m => m.isLoading ? { ...m, content: 'Erro ao processar. Tente novamente.', isLoading: false } : m)
      );
    } finally {
      setIsProcessing(false);
    }
  };

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-background border border-border rounded-2xl shadow-2xl w-full max-w-lg h-[70vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center gap-3 p-4 border-b border-border bg-gradient-to-r from-[#374DA4] to-[#5B33F0]">
          <div className="h-9 w-9 rounded-full bg-white/20 flex items-center justify-center">
            <Sparkles className="h-5 w-5 text-white" />
          </div>
          <div className="flex-1">
            <h3 className="text-white font-semibold text-sm">Ello • Assistente IA</h3>
            <p className="text-white/70 text-xs">Tire suas dúvidas sobre o Ellosuit</p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} className="text-white hover:bg-white/20">
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Messages */}
        <ScrollArea className="flex-1 p-4">
          <div className="space-y-3">
            {messages.length === 0 && (
              <div className="text-center text-muted-foreground text-sm py-8">
                <Sparkles className="h-8 w-8 mx-auto mb-2 opacity-30" />
                <p>Pergunte qualquer coisa sobre o Ellosuit!</p>
              </div>
            )}
            {messages.map(msg => (
              <div key={msg.id} className={cn("flex", msg.role === 'user' ? "justify-end" : "justify-start")}>
                <div className={cn(
                  "max-w-[80%] rounded-2xl px-4 py-2.5 text-sm",
                  msg.role === 'user'
                    ? "bg-[#374DA4] text-white rounded-br-md"
                    : "bg-muted text-foreground rounded-bl-md"
                )}>
                  {msg.isLoading ? (
                    <div className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span className="text-muted-foreground">Pensando...</span>
                    </div>
                  ) : (
                    <div dangerouslySetInnerHTML={{ __html: formatContent(msg.content) }} className="whitespace-pre-wrap break-words" />
                  )}
                </div>
              </div>
            ))}
            <div ref={chatEndRef} />
          </div>
        </ScrollArea>

        {/* Input */}
        <div className="p-3 border-t border-border">
          <div className="flex gap-2">
            <Input
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage(input)}
              placeholder="Digite sua pergunta..."
              disabled={isProcessing}
              className="flex-1"
            />
            <Button
              onClick={() => sendMessage(input)}
              disabled={isProcessing || !input.trim()}
              className="bg-[#374DA4] hover:bg-[#5B33F0] text-white"
            >
              {isProcessing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default ElloAIPopup;
