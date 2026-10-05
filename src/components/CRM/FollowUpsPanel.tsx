import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import {
  Sparkles, Check, X, Pencil, Clock, Loader2, AlertCircle,
  CalendarClock, Send, RefreshCw,
} from "lucide-react";

export type FollowUpRow = {
  id: string;
  company_id: string;
  conversation_id: string;
  status: 'suggested' | 'approved' | 'sent' | 'canceled' | 'failed';
  kind: string;
  reason: string | null;
  message: string;
  scheduled_for: string | null;
  approved_at: string | null;
  sent_at: string | null;
  canceled_at: string | null;
  canceled_reason: string | null;
  last_error: string | null;
  created_at: string;
};

const KIND_LABEL: Record<string, { label: string; tone: string }> = {
  retomada:      { label: 'Retomada',           tone: 'bg-[#DFE4FB] text-[#253573] dark:bg-[#0F1631]/40 dark:text-[#879CE0]' },
  cobranca:      { label: 'Cobrança suave',     tone: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300' },
  satisfacao:    { label: 'Pesquisa de satisfação', tone: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' },
  lembrete:      { label: 'Lembrete',           tone: 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300' },
  reengajamento: { label: 'Reengajamento',      tone: 'bg-pink-100 text-pink-700 dark:bg-pink-900/40 dark:text-pink-300' },
  outro:         { label: 'Outro',              tone: 'bg-muted text-foreground' },
};

function toLocalInput(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromLocalInput(value: string): string {
  return new Date(value).toISOString();
}

function formatWhen(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
  });
}

export function FollowUpsPanel({
  conversationId,
  companyId,
  onClose,
}: {
  conversationId: string;
  companyId: string | null;
  onClose?: () => void;
}) {
  const { toast } = useToast();
  const [rows, setRows] = useState<FollowUpRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftMessage, setDraftMessage] = useState('');
  const [draftWhen, setDraftWhen] = useState('');

  const load = useCallback(async () => {
    if (!conversationId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('crm_followups' as any)
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: false });
    if (!error && data) setRows(data as unknown as FollowUpRow[]);
    setLoading(false);
  }, [conversationId]);

  useEffect(() => { load(); }, [load]);

  // Realtime: refresh when dispatcher or peers change anything for this conversation.
  useEffect(() => {
    if (!conversationId) return;
    const channel = supabase
      .channel(`crm_followups:${conversationId}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'crm_followups',
        filter: `conversation_id=eq.${conversationId}`,
      }, () => { load(); })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [conversationId, load]);

  const runSuggest = useCallback(async () => {
    setSuggesting(true);
    try {
      const { data, error } = await supabase.functions.invoke('crm-followup-suggest', {
        body: { conversationId },
      });
      if (error) throw error;
      const saved = (data as any)?.saved ?? [];
      if (!saved.length) {
        toast({
          title: 'Sem sugestões agora',
          description: 'A IA não viu motivo para um follow-up nessa conversa.',
        });
      } else {
        toast({ title: `${saved.length} sugestão(ões) criadas` });
      }
      await load();
    } catch (err: any) {
      toast({
        title: 'Não foi possível analisar',
        description: err?.message || 'Tente novamente em instantes.',
        variant: 'destructive',
      });
    } finally {
      setSuggesting(false);
    }
  }, [conversationId, load, toast]);

  const approve = useCallback(async (row: FollowUpRow, overrides?: { message?: string; scheduled_for?: string }) => {
    const { data: user } = await supabase.auth.getUser();
    const payload: any = {
      status: 'approved',
      approved_at: new Date().toISOString(),
      approved_by: user?.user?.id ?? null,
    };
    if (overrides?.message) payload.message = overrides.message;
    if (overrides?.scheduled_for) payload.scheduled_for = overrides.scheduled_for;
    const { error } = await supabase.from('crm_followups' as any).update(payload).eq('id', row.id);
    if (error) {
      toast({ title: 'Erro ao aprovar', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Follow-up agendado', description: `Será enviado em ${formatWhen(overrides?.scheduled_for ?? row.scheduled_for)}.` });
    setEditingId(null);
    load();
  }, [load, toast]);

  const discard = useCallback(async (row: FollowUpRow) => {
    const { error } = await supabase.from('crm_followups' as any).update({
      status: 'canceled',
      canceled_at: new Date().toISOString(),
      canceled_reason: 'Descartado pelo usuario',
    }).eq('id', row.id);
    if (error) toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    else load();
  }, [load, toast]);

  const startEdit = (row: FollowUpRow) => {
    setEditingId(row.id);
    setDraftMessage(row.message);
    setDraftWhen(toLocalInput(row.scheduled_for));
  };

  const saveEditAndApprove = (row: FollowUpRow) => {
    if (!draftMessage.trim()) {
      toast({ title: 'Mensagem vazia', variant: 'destructive' });
      return;
    }
    if (!draftWhen) {
      toast({ title: 'Escolha quando enviar', variant: 'destructive' });
      return;
    }
    approve(row, { message: draftMessage.trim(), scheduled_for: fromLocalInput(draftWhen) });
  };

  const grouped = useMemo(() => {
    return {
      suggested: rows.filter(r => r.status === 'suggested'),
      approved: rows.filter(r => r.status === 'approved'),
      history: rows.filter(r => r.status === 'sent' || r.status === 'canceled' || r.status === 'failed'),
    };
  }, [rows]);

  return (
    <div className="flex flex-col h-full bg-background">
      <div className="px-4 py-3 border-b flex items-center justify-between gap-2">
        <div>
          <div className="text-sm font-semibold flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            Follow-ups inteligentes
          </div>
          <div className="text-xs text-muted-foreground">A IA analisa a conversa e sugere quando reabrir o contato.</div>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={load} disabled={loading}>
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          </Button>
          <Button size="sm" onClick={runSuggest} disabled={suggesting}>
            {suggesting ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <Sparkles className="h-3.5 w-3.5 mr-1.5" />}
            Analisar conversa
          </Button>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-5">
          <Section
            title="Sugestões aguardando aprovação"
            empty="Nenhuma sugestão pendente. Clique em Analisar conversa para gerar."
            items={grouped.suggested}
            renderItem={(row) => (
              <FollowUpCard
                key={row.id}
                row={row}
                editing={editingId === row.id}
                draftMessage={draftMessage}
                draftWhen={draftWhen}
                onDraftMessage={setDraftMessage}
                onDraftWhen={setDraftWhen}
                onApprove={() => approve(row)}
                onDiscard={() => discard(row)}
                onEdit={() => startEdit(row)}
                onSaveEdit={() => saveEditAndApprove(row)}
                onCancelEdit={() => setEditingId(null)}
              />
            )}
          />

          <Separator />

          <Section
            title="Agendados"
            empty="Nada agendado no momento."
            items={grouped.approved}
            renderItem={(row) => (
              <FollowUpCard
                key={row.id}
                row={row}
                editing={editingId === row.id}
                draftMessage={draftMessage}
                draftWhen={draftWhen}
                onDraftMessage={setDraftMessage}
                onDraftWhen={setDraftWhen}
                showCountdown
                onDiscard={() => discard(row)}
                onEdit={() => startEdit(row)}
                onSaveEdit={() => saveEditAndApprove(row)}
                onCancelEdit={() => setEditingId(null)}
              />
            )}
          />

          {grouped.history.length > 0 && (
            <>
              <Separator />
              <Section
                title="Histórico"
                empty=""
                items={grouped.history}
                renderItem={(row) => (
                  <div key={row.id} className="rounded-md border bg-card/50 p-3 text-sm space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <KindBadge kind={row.kind} />
                      <StatusBadge status={row.status} />
                    </div>
                    <p className="text-foreground whitespace-pre-wrap">{row.message}</p>
                    <div className="text-xs text-muted-foreground flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {row.status === 'sent' && `Enviado em ${formatWhen(row.sent_at)}`}
                      {row.status === 'canceled' && `Cancelado: ${row.canceled_reason || '—'}`}
                      {row.status === 'failed' && (
                        <span className="text-destructive flex items-center gap-1">
                          <AlertCircle className="h-3 w-3" /> Falhou: {row.last_error || 'erro'}
                        </span>
                      )}
                    </div>
                  </div>
                )}
              />
            </>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

function Section<T>({
  title, empty, items, renderItem,
}: { title: string; empty: string; items: T[]; renderItem: (item: T) => React.ReactNode }) {
  return (
    <div className="space-y-2">
      <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</div>
      {items.length === 0 ? (
        empty ? <div className="text-xs text-muted-foreground py-2">{empty}</div> : null
      ) : (
        <div className="space-y-2">{items.map(renderItem)}</div>
      )}
    </div>
  );
}

function KindBadge({ kind }: { kind: string }) {
  const meta = KIND_LABEL[kind] ?? KIND_LABEL.outro;
  return <Badge variant="secondary" className={meta.tone}>{meta.label}</Badge>;
}

function StatusBadge({ status }: { status: FollowUpRow['status'] }) {
  const map: Record<string, { label: string; cls: string }> = {
    suggested: { label: 'Sugestão', cls: 'bg-amber-100 text-amber-700' },
    approved:  { label: 'Agendado', cls: 'bg-[#DFE4FB] text-[#253573]' },
    sent:      { label: 'Enviado',  cls: 'bg-emerald-100 text-emerald-700' },
    canceled:  { label: 'Cancelado', cls: 'bg-muted text-foreground' },
    failed:    { label: 'Falhou',   cls: 'bg-destructive/10 text-destructive' },
  };
  const m = map[status];
  return <Badge variant="secondary" className={m.cls}>{m.label}</Badge>;
}

function FollowUpCard(props: {
  row: FollowUpRow;
  editing: boolean;
  draftMessage: string;
  draftWhen: string;
  onDraftMessage: (v: string) => void;
  onDraftWhen: (v: string) => void;
  showCountdown?: boolean;
  onApprove?: () => void;
  onDiscard: () => void;
  onEdit: () => void;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
}) {
  const { row, editing } = props;
  return (
    <div className="rounded-lg border bg-card p-3 space-y-2.5 shadow-sm">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <KindBadge kind={row.kind} />
          <span className="text-xs text-muted-foreground flex items-center gap-1">
            <CalendarClock className="h-3 w-3" /> {formatWhen(row.scheduled_for)}
          </span>
        </div>
        <StatusBadge status={row.status} />
      </div>
      {row.reason && !editing && (
        <p className="text-xs text-muted-foreground italic">Por que: {row.reason}</p>
      )}
      {editing ? (
        <div className="space-y-2">
          <Textarea
            value={props.draftMessage}
            onChange={(e) => props.onDraftMessage(e.target.value)}
            rows={5}
            className="text-sm"
          />
          <div className="flex items-center gap-2">
            <Input
              type="datetime-local"
              value={props.draftWhen}
              onChange={(e) => props.onDraftWhen(e.target.value)}
              className="text-sm"
            />
            <Button size="sm" onClick={props.onSaveEdit}>
              <Send className="h-3.5 w-3.5 mr-1.5" /> Agendar
            </Button>
            <Button size="sm" variant="ghost" onClick={props.onCancelEdit}>Cancelar</Button>
          </div>
        </div>
      ) : (
        <p className="text-sm whitespace-pre-wrap leading-relaxed">{row.message}</p>
      )}
      {!editing && (
        <div className="flex flex-wrap gap-2 pt-1">
          {props.onApprove && (
            <Button size="sm" onClick={props.onApprove}>
              <Check className="h-3.5 w-3.5 mr-1.5" /> Aprovar
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={props.onEdit}>
            <Pencil className="h-3.5 w-3.5 mr-1.5" /> Editar e reagendar
          </Button>
          <Button size="sm" variant="ghost" onClick={props.onDiscard}>
            <X className="h-3.5 w-3.5 mr-1.5" /> Descartar
          </Button>
        </div>
      )}
    </div>
  );
}