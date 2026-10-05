import React, { useState } from 'react';
import { Copy, Loader2, Webhook, Send, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

const SUPABASE_URL = 'https://jwddiyuezqrpuakazvgg.supabase.co';

interface Props {
  keyId: string;
  apiKey: string;
  webhookUrl?: string | null;
  webhookSecret?: string | null;
  onSaved?: () => void;
}

const ApiKeyWebhookInline: React.FC<Props> = ({ keyId, apiKey, webhookUrl, webhookSecret, onSaved }) => {
  const { toast } = useToast();
  const [url, setUrl] = useState(webhookUrl || '');
  const [busy, setBusy] = useState(false);
  const dirty = (url || '') !== (webhookUrl || '');

  const copy = (t: string) => { navigator.clipboard.writeText(t); toast({ title: 'Copiado!' }); };

  const save = async () => {
    if (url && !/^https?:\/\//.test(url)) { toast({ title: 'URL inválida', description: 'Use https://...', variant: 'destructive' }); return; }
    setBusy(true);
    const { error } = await supabase.from('whatsapp_api_keys').update({ webhook_url: url || null } as never).eq('id', keyId);
    setBusy(false);
    if (error) { toast({ title: 'Erro ao salvar', description: error.message, variant: 'destructive' }); return; }
    toast({ title: 'Webhook salvo' });
    onSaved?.();
  };

  const test = async () => {
    if (!url) return;
    setBusy(true);
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/whatsapp-public-api`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-API-Key': apiKey },
        body: JSON.stringify({ action: 'test_webhook', webhook_url: url }),
      });
      const data = await res.json();
      toast(data.delivered
        ? { title: 'Webhook respondeu OK', description: `Status ${data.status}` }
        : { title: 'Webhook não respondeu 2xx', description: data.error || `Status ${data.status ?? '-'}`, variant: 'destructive' });
    } catch (e) {
      toast({ title: 'Falha no teste', description: String(e), variant: 'destructive' });
    }
    setBusy(false);
  };

  return (
    <div className="mt-2 space-y-1.5">
      <div className="flex items-center gap-1">
        <Webhook className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        <Input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="URL do webhook (ex: https://sistema.com/webhooks/ellosuit)"
          className="h-8 text-xs rounded-full min-w-[220px]"
        />
        {url && (
          <Button variant="ghost" size="icon" className="h-7 w-7 rounded-full shrink-0" title="Copiar URL" onClick={() => copy(url)}>
            <Copy className="h-3.5 w-3.5" />
          </Button>
        )}
        <Button variant="ghost" size="icon" className="h-7 w-7 rounded-full shrink-0" title="Salvar" disabled={!dirty || busy} onClick={save}>
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
        </Button>
        <Button variant="ghost" size="icon" className="h-7 w-7 rounded-full shrink-0" title="Testar webhook" disabled={!url || busy} onClick={test}>
          <Send className="h-3.5 w-3.5" />
        </Button>
      </div>
      {webhookSecret && (
        <div className="flex items-center gap-1 pl-5">
          <span className="text-[10px] text-muted-foreground shrink-0">Segredo:</span>
          <code className="text-[10px] bg-muted/60 border border-border px-2 py-0.5 rounded-full font-mono truncate max-w-[200px]">{webhookSecret}</code>
          <Button variant="ghost" size="icon" className="h-6 w-6 rounded-full shrink-0" title="Copiar segredo" onClick={() => copy(webhookSecret)}>
            <Copy className="h-3 w-3" />
          </Button>
        </div>
      )}
    </div>
  );
};

export default ApiKeyWebhookInline;
