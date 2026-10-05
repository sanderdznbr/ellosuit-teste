import React, { useState, useRef, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Sparkles, Send, Loader2, Check } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { KanbanColumn } from './WhatsAppKanbanView';

interface Msg { role: 'user' | 'assistant'; content: string; proposed?: KanbanColumn[] | null }

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  currentColumns: KanbanColumn[];
  onApply: (cols: KanbanColumn[]) => void;
  conversations?: Array<{
    id: string;
    contact_name?: string;
    last_message?: string;
    pipeline_stage?: string;
    ai_auto_reply_enabled?: boolean;
    human_takeover?: boolean;
  }>;
}

export const KanbanAIOrganizer: React.FC<Props> = ({ open, onOpenChange, currentColumns, onApply, conversations = [] }) => {
  const [messages, setMessages] = useState<Msg[]>([
    { role: 'assistant', content: 'Olá! Me diga como você quer organizar seu pipeline. Ex: "Sou de imobiliária, quero colunas para captação, visita agendada, proposta e fechado".' },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [classifying, setClassifying] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, loading]);

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;
    const next = [...messages, { role: 'user' as const, content: text }];
    setMessages(next);
    setInput('');
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('kanban-organize-ai', {
        body: {
          messages: next.map(m => ({ role: m.role, content: m.content })),
          currentColumns,
        },
      });
      if (error) throw error;
      setMessages(prev => [...prev, { role: 'assistant', content: data.reply, proposed: data.proposedColumns }]);
    } catch (e: any) {
      toast.error('Erro ao consultar IA', { description: e.message });
    } finally { setLoading(false); }
  };

  const apply = async (cols: KanbanColumn[]) => {
    onApply(cols);
    toast.success('Pipeline atualizado! Distribuindo conversas...');

    // Classifica e move as conversas existentes para as novas colunas
    if (conversations.length > 0) {
      setClassifying(true);
      try {
        const payload = conversations.slice(0, 200).map(c => ({
          id: c.id,
          contact_name: c.contact_name || '',
          last_message: (c.last_message || '').slice(0, 200),
          current_stage: c.pipeline_stage || '',
          bot_active: !!c.ai_auto_reply_enabled && !c.human_takeover,
          human_takeover: !!c.human_takeover,
        }));
        const { data, error } = await supabase.functions.invoke('kanban-organize-ai', {
          body: {
            mode: 'classify',
            columns: cols,
            conversations: payload,
            messages: messages.map(m => ({ role: m.role, content: m.content })),
          },
        });
        if (error) throw error;
        const assignments: Array<{ id: string; stage: string }> = data?.assignments ?? [];

        // Agrupa por stage para batch update
        const byStage = new Map<string, string[]>();
        for (const a of assignments) {
          if (!byStage.has(a.stage)) byStage.set(a.stage, []);
          byStage.get(a.stage)!.push(a.id);
        }
        await Promise.all(
          Array.from(byStage.entries()).map(([stage, ids]) =>
            supabase.from('whatsapp_conversations').update({ pipeline_stage: stage }).in('id', ids)
          )
        );
        toast.success(`${assignments.length} conversas distribuídas`);
      } catch (e: any) {
        toast.error('Erro ao classificar', { description: e.message });
      } finally {
        setClassifying(false);
      }
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl h-[80vh] flex flex-col p-0 gap-0 overflow-hidden">
        <DialogHeader className="p-5 border-b bg-gradient-to-br from-[#374DA4]/10 via-background to-background">
          <DialogTitle className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[#374DA4] flex items-center justify-center">
              <Sparkles className="h-4 w-4 text-white" />
            </div>
            Organize com IA
          </DialogTitle>
          <p className="text-xs text-muted-foreground mt-1">Converse e a IA propõe colunas do funil para seu negócio.</p>
        </DialogHeader>

        <ScrollArea className="flex-1 p-5">
          <div className="space-y-4">
            {messages.map((m, i) => (
              <div key={i} className={m.role === 'user' ? 'flex justify-end' : 'flex justify-start'}>
                <div className={
                  m.role === 'user'
                    ? 'bg-[#374DA4] text-white rounded-2xl rounded-br-sm px-4 py-2.5 max-w-[80%] text-sm'
                    : 'bg-muted rounded-2xl rounded-bl-sm px-4 py-2.5 max-w-[85%] text-sm space-y-3'
                }>
                  <div className="whitespace-pre-wrap leading-relaxed">{m.content}</div>
                  {m.proposed && m.proposed.length > 0 && (
                    <div className="border border-border/60 bg-background rounded-xl p-3 space-y-2">
                      <p className="text-xs font-semibold text-foreground/80">Proposta de colunas:</p>
                      <div className="flex flex-wrap gap-2">
                        {m.proposed.map(c => (
                          <span key={c.id} className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-medium" style={{ backgroundColor: `${c.color}20`, color: c.color }}>
                            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: c.color }} />
                            {c.title}
                          </span>
                        ))}
                      </div>
                      <Button size="sm" className="w-full bg-[#374DA4] hover:bg-[#374DA4]/90 mt-2" onClick={() => apply(m.proposed!)}>
                        <Check className="h-3.5 w-3.5 mr-1.5" /> Aplicar essas colunas
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-muted rounded-2xl px-4 py-2.5 flex items-center gap-2 text-sm">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> pensando...
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>
        </ScrollArea>

        <div className="p-4 border-t bg-background/80 backdrop-blur">
          <div className="flex gap-2 items-end">
            <Textarea
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
              placeholder="Descreva seu negócio ou peça ajustes..."
              className="min-h-[44px] max-h-32 resize-none rounded-xl"
              disabled={loading}
            />
            <Button onClick={send} disabled={loading || !input.trim()} className="bg-[#374DA4] hover:bg-[#374DA4]/90 h-11 w-11 p-0 rounded-xl">
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default KanbanAIOrganizer;