import React, { useState } from 'react';
import { Loader2, Sparkles, Languages, FileText, Smile, Briefcase, Heart, AlignLeft, Maximize2, SpellCheck, ChevronRight, ArrowLeft } from 'lucide-react';
import RadialGlowOrb from '@/components/ChatBot/RadialGlowOrb';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

interface AIImproveMessageButtonProps {
  text: string;
  onImproved: (newText: string) => void;
  disabled?: boolean;
  className?: string;
  size?: 'sm' | 'md';
}

type ActionKey =
  | 'improve'
  | 'professional'
  | 'friendly'
  | 'shorter'
  | 'longer'
  | 'spellcheck'
  | 'emoji'
  | 'summarize';

interface ActionDef {
  key: ActionKey;
  label: string;
  desc: string;
  icon: React.ComponentType<{ className?: string }>;
  instruction: string;
}

const ACTIONS: ActionDef[] = [
  { key: 'improve', label: 'Melhorar escrita', desc: 'Tom profissional + ortografia', icon: Sparkles,
    instruction: 'Reescreva em português brasileiro com tom profissional, cordial e claro. Corrija ortografia, pontuação e gramática.' },
  { key: 'professional', label: 'Mais formal', desc: 'Tom corporativo e sério', icon: Briefcase,
    instruction: 'Reescreva em tom mais formal e corporativo, mantendo cordialidade.' },
  { key: 'friendly', label: 'Mais amigável', desc: 'Tom casual e simpático', icon: Heart,
    instruction: 'Reescreva em tom mais amigável, próximo e simpático, sem ser informal demais.' },
  { key: 'shorter', label: 'Encurtar', desc: 'Versão mais curta e direta', icon: AlignLeft,
    instruction: 'Reescreva de forma mais curta e direta, mantendo a mensagem essencial.' },
  { key: 'longer', label: 'Expandir', desc: 'Adiciona mais detalhes', icon: Maximize2,
    instruction: 'Reescreva expandindo um pouco com mais contexto e detalhes úteis, sem inventar informações.' },
  { key: 'spellcheck', label: 'Corrigir ortografia', desc: 'Apenas corrigir erros', icon: SpellCheck,
    instruction: 'Corrija apenas ortografia, pontuação e gramática. Mantenha o tom e estilo originais.' },
  { key: 'emoji', label: 'Adicionar emojis', desc: 'Tom mais leve com emojis', icon: Smile,
    instruction: 'Adicione emojis apropriados ao contexto, sem exagerar. Preserve o texto original e apenas enriqueça com 2-4 emojis bem colocados.' },
  { key: 'summarize', label: 'Resumir', desc: 'Resumo objetivo', icon: FileText,
    instruction: 'Resuma o conteúdo em poucas linhas mantendo as informações mais importantes.' },
];

const LANGUAGES: { code: string; label: string; flag: string }[] = [
  { code: 'en', label: 'Inglês', flag: '🇺🇸' },
  { code: 'es', label: 'Espanhol', flag: '🇪🇸' },
  { code: 'pt', label: 'Português', flag: '🇧🇷' },
  { code: 'fr', label: 'Francês', flag: '🇫🇷' },
  { code: 'it', label: 'Italiano', flag: '🇮🇹' },
  { code: 'de', label: 'Alemão', flag: '🇩🇪' },
  { code: 'ja', label: 'Japonês', flag: '🇯🇵' },
  { code: 'zh', label: 'Chinês', flag: '🇨🇳' },
];

const AIImproveMessageButton: React.FC<AIImproveMessageButtonProps> = ({
  text,
  onImproved,
  disabled,
  className,
  size = 'md',
}) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<'menu' | 'translate'>('menu');

  const dim = size === 'sm' ? 'h-7 w-7' : 'h-8 w-8';
  const icon = size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4';
  const orbSize = size === 'sm' ? 20 : 24;

  const runAI = async (systemInstruction: string, successLabel: string) => {
    const original = (text || '').trim();
    if (!original) {
      toast({ title: 'Digite uma mensagem primeiro', description: 'Escreva algo para a IA melhorar.' });
      return;
    }
    if (loading || disabled) return;
    setOpen(false);
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('ai-chat', {
        body: {
          model: 'google/gemini-3-flash-preview',
          messages: [
            {
              role: 'system',
              content:
                `Você é um assistente que reescreve mensagens de WhatsApp/CRM. ${systemInstruction} Preserve 100% da intenção e dados (nomes, valores, datas, links). NÃO adicione saudações, despedidas, explicações ou comentários extras. NÃO use markdown, aspas ou prefixos. Retorne APENAS o texto final, pronto para envio.`,
            },
            { role: 'user', content: original },
          ],
        },
      });
      if (error) throw error;
      const improved: string = (data?.response || data?.message || '').toString().trim();
      if (!improved) throw new Error('Resposta vazia da IA');
      const clean = improved.replace(/^["'`]+|["'`]+$/g, '').trim();
      onImproved(clean);
      toast({ title: `${successLabel} ✨` });
    } catch (e: any) {
      toast({
        title: 'Não foi possível processar agora',
        description: e?.message || 'Tente novamente em instantes.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAction = (a: ActionDef) => runAI(a.instruction, a.label);
  const handleTranslate = (lang: { code: string; label: string }) =>
    runAI(
      `Traduza o texto para ${lang.label}. Use linguagem natural e adequada ao contexto de conversa profissional/CRM.`,
      `Traduzido para ${lang.label}`,
    );

  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) setView('menu');
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled || loading}
          title="Melhorar com IA"
          aria-label="Melhorar mensagem com IA"
          className={cn(
            'relative inline-flex items-center justify-center rounded-md',
            dim,
            'transition-transform hover:scale-110 disabled:opacity-50 disabled:cursor-not-allowed',
            className,
          )}
        >
          {loading ? (
            <Loader2 className={cn(icon, 'animate-spin text-primary')} />
          ) : (
            <RadialGlowOrb size={orbSize} />
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        side="top"
        className="w-80 p-2 rounded-2xl shadow-2xl border border-border/50 bg-background/98 backdrop-blur-xl"
      >
        {view === 'menu' ? (
          <div className="space-y-0.5">
            <div className="px-3 pt-2 pb-2.5 flex items-center gap-2 border-b border-border/50 mb-1">
              <RadialGlowOrb size={18} />
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-semibold text-foreground leading-tight">Melhorar com IA</div>
                <div className="text-[10.5px] text-muted-foreground leading-tight">Reescreve o texto que você digitou</div>
              </div>
            </div>
            {ACTIONS.map((a) => (
              <button
                key={a.key}
                onClick={() => handleAction(a)}
                className="w-full flex items-center gap-3 px-2.5 py-2 rounded-xl hover:bg-primary/8 transition-colors text-left group"
              >
                <span className="h-8 w-8 rounded-lg bg-primary/10 group-hover:bg-primary/15 inline-flex items-center justify-center shrink-0 transition-colors">
                  <a.icon className="h-4 w-4 text-primary" />
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-medium text-foreground leading-tight">{a.label}</div>
                  <div className="text-[11px] text-muted-foreground truncate leading-tight mt-0.5">{a.desc}</div>
                </div>
              </button>
            ))}
            <div className="h-px bg-border/50 my-1" />
            <button
              onClick={() => setView('translate')}
              className="w-full flex items-center gap-3 px-2.5 py-2 rounded-xl hover:bg-primary/8 transition-colors text-left group"
            >
              <span className="h-8 w-8 rounded-lg bg-primary/10 group-hover:bg-primary/15 inline-flex items-center justify-center shrink-0 transition-colors">
                <Languages className="h-4 w-4 text-primary" />
              </span>
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-medium text-foreground leading-tight">Traduzir</div>
                <div className="text-[11px] text-muted-foreground leading-tight mt-0.5">Para outro idioma</div>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </button>
          </div>
        ) : (
          <div className="space-y-0.5">
            <button
              onClick={() => setView('menu')}
              className="w-full flex items-center gap-2 px-2.5 py-2 rounded-xl hover:bg-muted/70 transition-colors text-left border-b border-border/50 mb-1"
            >
              <ArrowLeft className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-[13px] font-semibold text-foreground">Traduzir para</span>
            </button>
            <div className="grid grid-cols-2 gap-0.5">
              {LANGUAGES.map((l) => (
                <button
                  key={l.code}
                  onClick={() => handleTranslate(l)}
                  className="flex items-center gap-2 px-2.5 py-2 rounded-xl hover:bg-primary/8 transition-colors text-left"
                >
                  <span className="text-base leading-none">{l.flag}</span>
                  <span className="text-[13px] text-foreground">{l.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
};

export default AIImproveMessageButton;