import React, { useState } from 'react';
import { Loader2, MessageSquarePlus } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

export interface SuggestReplyMessage {
  from_me: boolean;
  content: string;
}

interface AISuggestReplyButtonProps {
  messages: SuggestReplyMessage[];
  contactName?: string;
  onSuggested: (text: string) => void;
  disabled?: boolean;
  className?: string;
  size?: 'sm' | 'md';
}

const AISuggestReplyButton: React.FC<AISuggestReplyButtonProps> = ({
  messages,
  contactName,
  onSuggested,
  disabled,
  className,
  size = 'md',
}) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  const dim = size === 'sm' ? 'h-7 w-7' : 'h-8 w-8';
  const icon = size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4';

  const handleClick = async () => {
    if (loading || disabled) return;
    const recent = (messages || []).slice(-12);
    if (recent.length === 0) {
      toast({ title: 'Sem mensagens para basear a sugestão' });
      return;
    }
    setLoading(true);
    try {
      const transcript = recent
        .map((m) => `${m.from_me ? 'Atendente' : (contactName || 'Cliente')}: ${(m.content || '').trim()}`)
        .filter(Boolean)
        .join('\n');

      const { data, error } = await supabase.functions.invoke('ai-chat', {
        body: {
          model: 'google/gemini-3-flash-preview',
          messages: [
            {
              role: 'system',
              content:
                'Você é um assistente que sugere a PRÓXIMA resposta do ATENDENTE em uma conversa de WhatsApp/CRM em português brasileiro. ' +
                'Leia o histórico e escreva UMA resposta cordial, objetiva e natural para o atendente enviar em seguida. ' +
                'Regras: retorne APENAS o texto da mensagem pronto para envio, sem prefixos, sem aspas, sem markdown, sem explicações. ' +
                'Não invente dados (nomes, preços, datas, links). Se faltar contexto, faça uma pergunta curta e útil.',
            },
            {
              role: 'user',
              content: `Histórico da conversa (mais recente por último):\n\n${transcript}\n\nEscreva agora a próxima mensagem do Atendente.`,
            },
          ],
        },
      });
      if (error) throw error;
      const suggestion: string = (data?.response || data?.message || '').toString().trim();
      if (!suggestion) throw new Error('Resposta vazia da IA');
      const clean = suggestion.replace(/^["'`]+|["'`]+$/g, '').trim();
      onSuggested(clean);
      toast({ title: 'Sugestão pronta ✨', description: 'Revise antes de enviar.' });
    } catch (e: any) {
      toast({
        title: 'Não foi possível sugerir agora',
        description: e?.message || 'Tente novamente em instantes.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled || loading}
      title="Sugerir resposta com IA"
      aria-label="Sugerir resposta com IA"
      className={cn(
        'relative inline-flex items-center justify-center rounded-md text-primary',
        dim,
        'transition-transform hover:scale-110 disabled:opacity-50 disabled:cursor-not-allowed',
        className,
      )}
    >
      {loading ? (
        <Loader2 className={cn(icon, 'animate-spin')} />
      ) : (
        <MessageSquarePlus className={icon} />
      )}
    </button>
  );
};

export default AISuggestReplyButton;