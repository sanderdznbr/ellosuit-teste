import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Send, Loader2, Search, FileText, MessageSquare } from 'lucide-react';

interface Template {
  name: string;
  language: string;
  category: string;
  components: any[];
  status: string;
}

interface TemplateMessageModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sessionId: string;
  contactPhone: string;
  contactName?: string | null;
  onSent: () => void;
}

const TemplateMessageModal: React.FC<TemplateMessageModalProps> = ({
  open, onOpenChange, sessionId, contactPhone, contactName, onSent,
}) => {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Template | null>(null);
  const [paramValues, setParamValues] = useState<Record<string, string>>({});

  const callApi = async (action: string, data: Record<string, unknown> = {}) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) throw new Error('No session');
    const res = await fetch(
      `https://jwddiyuezqrpuakazvgg.supabase.co/functions/v1/ycloud-api`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ action, ...data }),
      }
    );
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || 'API Error');
    return json;
  };

  useEffect(() => {
    if (!open || !sessionId) return;
    setLoading(true);
    setSelected(null);
    setParamValues({});
    callApi('list_templates', { session_id: sessionId })
      .then(r => setTemplates(r.templates || []))
      .catch(e => toast.error('Erro ao carregar templates: ' + e.message))
      .finally(() => setLoading(false));
  }, [open, sessionId]);

  const getTemplateParams = (tmpl: Template): string[] => {
    const params: string[] = [];
    for (const comp of tmpl.components || []) {
      if (comp.type === 'BODY' && comp.text) {
        const matches = comp.text.match(/\{\{(\d+)\}\}/g);
        if (matches) {
          matches.forEach((m: string) => {
            if (!params.includes(m)) params.push(m);
          });
        }
      }
    }
    return params;
  };

  const getTemplatePreview = (tmpl: Template): string => {
    const body = tmpl.components?.find((c: any) => c.type === 'BODY');
    return body?.text || tmpl.name;
  };

  const handleSend = async () => {
    if (!selected) return;
    setSending(true);

    const params = getTemplateParams(selected);
    const components: any[] = [];

    if (params.length > 0) {
      const bodyParams = params.map(p => {
        const idx = p.replace(/[{}]/g, '');
        return { type: 'text', text: paramValues[idx] || '' };
      });
      components.push({ type: 'body', parameters: bodyParams });
    }

    try {
      await callApi('send_template', {
        session_id: sessionId,
        to: contactPhone,
        template_name: selected.name,
        template_language: selected.language,
        components: components.length > 0 ? components : undefined,
      });
      toast.success('Template enviado!');
      onSent();
      onOpenChange(false);
    } catch (e: any) {
      toast.error('Erro ao enviar template: ' + e.message);
    } finally {
      setSending(false);
    }
  };

  const filtered = templates.filter(t =>
    t.name.toLowerCase().includes(search.toLowerCase()) ||
    (t.category || '').toLowerCase().includes(search.toLowerCase())
  );

  const categoryColor = (cat: string) => {
    switch (cat?.toUpperCase()) {
      case 'MARKETING': return 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300';
      case 'UTILITY': return 'bg-[#DFE4FB] text-[#253573] dark:bg-[#0F1631]/30 dark:text-[#879CE0]';
      case 'AUTHENTICATION': return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-[#374DA4]" />
            Enviar Template
            {contactName && <span className="text-sm font-normal text-muted-foreground">para {contactName}</span>}
          </DialogTitle>
        </DialogHeader>

        {!selected ? (
          <>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Buscar template..." value={search} onChange={e => setSearch(e.target.value)}
                className="pl-9" />
            </div>

            <ScrollArea className="flex-1 min-h-0 max-h-[50vh]">
              {loading ? (
                <div className="space-y-2 p-1">
                  {[1,2,3].map(i => <Skeleton key={i} className="h-16 w-full rounded-lg" />)}
                </div>
              ) : filtered.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <MessageSquare className="h-10 w-10 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">{templates.length === 0 ? 'Nenhum template aprovado encontrado' : 'Nenhum resultado'}</p>
                </div>
              ) : (
                <div className="space-y-1.5 p-1">
                  {filtered.map(tmpl => (
                    <div key={`${tmpl.name}-${tmpl.language}`}
                      onClick={() => { setSelected(tmpl); setParamValues({}); }}
                      className="p-3 rounded-lg border border-border hover:border-[#374DA4]/40 hover:bg-muted/50 cursor-pointer transition-all">
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-sm font-medium truncate">{tmpl.name}</p>
                        <Badge variant="outline" className={`text-[10px] ${categoryColor(tmpl.category)}`}>
                          {tmpl.category}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-2">{getTemplatePreview(tmpl)}</p>
                      <p className="text-[10px] text-muted-foreground mt-1">Idioma: {tmpl.language}</p>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </>
        ) : (
          <div className="space-y-4">
            <Button variant="ghost" size="sm" onClick={() => setSelected(null)} className="text-xs">
              ← Voltar à lista
            </Button>

            <div className="p-3 rounded-lg bg-muted/50 border border-border">
              <div className="flex items-center justify-between mb-2">
                <p className="font-medium text-sm">{selected.name}</p>
                <Badge variant="outline" className={`text-[10px] ${categoryColor(selected.category)}`}>
                  {selected.category}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground whitespace-pre-wrap">{getTemplatePreview(selected)}</p>
            </div>

            {getTemplateParams(selected).length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium">Preencha os parâmetros:</p>
                {getTemplateParams(selected).map(param => {
                  const idx = param.replace(/[{}]/g, '');
                  return (
                    <div key={idx}>
                      <label className="text-xs text-muted-foreground mb-1 block">Parâmetro {idx}</label>
                      <Input
                        placeholder={`Valor para {{${idx}}}`}
                        value={paramValues[idx] || ''}
                        onChange={e => setParamValues(prev => ({ ...prev, [idx]: e.target.value }))}
                      />
                    </div>
                  );
                })}
              </div>
            )}

            <Button onClick={handleSend} disabled={sending} className="w-full bg-[#374DA4] hover:bg-[#374DA4]/90">
              {sending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
              Enviar Template
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default TemplateMessageModal;
