import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, X, ArrowRight } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

type Item = {
  key: string;
  label: string;
  shortLabel: string;
  doneCaption: string;
  pendingCaption: string;
  path: string;
  done: boolean;
};

const DISMISS_KEY = 'activation-checklist-dismissed';

const ActivationChecklist: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [items, setItems] = useState<Item[] | null>(null);
  const [dismissed, setDismissed] = useState<boolean>(() => localStorage.getItem(DISMISS_KEY) === '1');

  useEffect(() => {
    if (!user || dismissed) return;
    let cancelled = false;
    (async () => {
      try {
        const { data: cu } = await supabase
          .from('company_users')
          .select('company_id')
          .eq('user_id', user.id)
          .limit(1)
          .maybeSingle();
        const companyId = cu?.company_id;
        if (!companyId) return;

        const [waRes, botRes, meetRes, contactRes] = await Promise.all([
          supabase.from('whatsapp_sessions').select('id', { count: 'exact', head: true }).eq('company_id', companyId),
          supabase.from('chatbot_flows').select('id', { count: 'exact', head: true }).eq('company_id', companyId),
          supabase.from('calendar_events').select('id', { count: 'exact', head: true }).eq('company_id', companyId),
          supabase.from('whatsapp_contacts').select('id', { count: 'exact', head: true }).eq('company_id', companyId),
        ]);

        const list: Item[] = [
          { key: 'wa', label: 'Conecte seu WhatsApp', shortLabel: 'WhatsApp', doneCaption: 'Conectado', pendingCaption: 'Conecte para atender', path: '/dashboard/crm-whatsapp', done: (waRes.count ?? 0) > 0 },
          { key: 'bot', label: 'Crie seu 1º Chatbot IA', shortLabel: 'Chatbot IA', doneCaption: 'Treinado', pendingCaption: 'Automatize com IA', path: '/dashboard/criar-chatbot', done: (botRes.count ?? 0) > 0 },
          { key: 'contacts', label: 'Adicione seus contatos', shortLabel: 'Contatos', doneCaption: 'Sincronizados', pendingCaption: 'Importe ou crie contatos', path: '/dashboard/crm-ello', done: (contactRes.count ?? 0) > 0 },
          { key: 'meet', label: 'Agende sua 1ª reunião', shortLabel: 'Reunião', doneCaption: 'Agendada', pendingCaption: 'Use a agenda integrada', path: '/dashboard/agenda', done: (meetRes.count ?? 0) > 0 },
        ];
        if (!cancelled) setItems(list);
      } catch (e) {
        // fail silently — checklist is optional
      }
    })();
    return () => { cancelled = true; };
  }, [user, dismissed]);

  if (!items || dismissed) return null;
  const completed = items.filter((i) => i.done).length;
  if (completed === items.length) return null;
  const nextItem = items.find((i) => !i.done) ?? items[items.length - 1];
  const progressPct = Math.round((completed / items.length) * 100);

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, '1');
    setDismissed(true);
  };

  return (
    <div className="mx-auto w-full max-w-4xl px-4 pt-4">
      <div className="relative rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-border">
          <div className="flex items-center gap-3 min-w-0">
            <span className="h-2 w-2 rounded-full bg-[#374DA4] animate-pulse flex-shrink-0" />
            <h2 className="text-sm font-semibold text-foreground truncate">Comece por aqui</h2>
            <span className="hidden sm:inline text-xs font-medium px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
              {progressPct}% concluído
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider whitespace-nowrap">
              {completed} de {items.length} passos
            </span>
            <button
              onClick={dismiss}
              className="text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Dispensar checklist"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Progress bar */}
        <div className="h-1 w-full bg-muted">
          <div
            className="h-full bg-[#374DA4] transition-all duration-500"
            style={{ width: `${progressPct}%` }}
          />
        </div>

        {/* Steps */}
        <div className="flex flex-col md:flex-row">
          {items.map((it) => {
            const isNext = it.key === nextItem.key && !it.done;
            return (
              <button
                key={it.key}
                onClick={() => navigate(it.path)}
                className={`group flex items-center gap-3 p-4 transition-colors border-b md:border-b-0 md:border-r border-border last:border-0 text-left ${
                  isNext
                    ? 'flex-[1.5] justify-between bg-[#374DA4]/5 dark:bg-[#374DA4]/10 hover:bg-[#374DA4]/10 dark:hover:bg-[#374DA4]/20'
                    : 'flex-1 items-start hover:bg-muted/50'
                }`}
              >
                <div className="flex items-start gap-3 min-w-0">
                  {it.done ? (
                    <div className="mt-0.5 flex-shrink-0 w-5 h-5 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-500">
                      <Check className="w-3 h-3" strokeWidth={3} />
                    </div>
                  ) : (
                    <div className="mt-0.5 flex-shrink-0 w-5 h-5 rounded-full border-2 border-[#374DA4] flex items-center justify-center">
                      <div className="w-1.5 h-1.5 rounded-full bg-[#374DA4]" />
                    </div>
                  )}
                  <div className="min-w-0">
                    <p
                      className={`text-xs font-semibold truncate ${
                        it.done
                          ? 'text-muted-foreground line-through'
                          : isNext
                            ? 'text-[#374DA4]'
                            : 'text-foreground'
                      }`}
                    >
                      {isNext ? it.label : it.shortLabel}
                    </p>
                    <p className="text-[10px] text-muted-foreground truncate">
                      {it.done ? it.doneCaption : it.pendingCaption}
                    </p>
                  </div>
                </div>
                {isNext && (
                  <ArrowRight className="w-4 h-4 text-[#374DA4] flex-shrink-0 transition-transform group-hover:translate-x-1" />
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default ActivationChecklist;