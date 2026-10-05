import { useEffect, useMemo, useState } from 'react';
import { Check, Copy, Link2, Plus, Send, Webhook } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { createLeadManually, fetchCompanyApiKey } from './useFunis';
import { PipelineColumn, SalesFunnel, SOURCE_LABELS, SourceType, uid } from './types';

const SUPABASE_URL =
  import.meta.env.VITE_SUPABASE_URL || 'https://jwddiyuezqrpuakazvgg.supabase.co';
const ENDPOINT = `${SUPABASE_URL}/functions/v1/whatsapp-public-api`;

export function WebhookPanel({
  funnel,
  update,
  columns,
  companyId,
  onLeadCreated,
}: {
  funnel: SalesFunnel;
  update: (patch: Partial<SalesFunnel>) => void;
  columns: PipelineColumn[];
  companyId: string | null;
  onLeadCreated: () => void;
}) {
  const { toast } = useToast();
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [keyLoaded, setKeyLoaded] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; msg: string } | null>(null);

  // lead manual
  const [leadName, setLeadName] = useState('');
  const [leadPhone, setLeadPhone] = useState('');
  const [leadStage, setLeadStage] = useState('');

  const stageId = funnel.webhook.stageId || columns[0]?.id || '';
  const stage = columns.find((c) => c.id === stageId);

  useEffect(() => {
    if (!companyId) return;
    let cancelled = false;
    fetchCompanyApiKey(companyId).then((key) => {
      if (!cancelled) {
        setApiKey(key);
        setKeyLoaded(true);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [companyId]);

  const curl = useMemo(
    () => `curl -X POST "${ENDPOINT}" \\
  -H "Content-Type: application/json" \\
  -H "X-API-Key: ${apiKey || 'SUA_CHAVE'}" \\
  -d '{
    "action": "create_lead",
    "name": "Maria Silva",
    "phone": "5511999999999",
    "source": "landing-page",
    "stage": "${stageId || 'id_da_etapa'}"
  }'`,
    [apiKey, stageId],
  );

  const payload = useMemo(
    () =>
      JSON.stringify(
        {
          action: 'create_lead',
          name: 'Maria Silva',
          phone: '5511999999999',
          source: 'minha-fonte',
          stage: stageId || 'id_da_etapa',
        },
        null,
        2,
      ),
    [stageId],
  );

  const copy = async (text: string, tag: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(tag);
      setTimeout(() => setCopied(null), 1600);
    } catch {
      toast({ title: 'Não foi possível copiar', variant: 'destructive' });
    }
  };

  const runTest = async () => {
    if (!apiKey) {
      setTestResult({ ok: false, msg: 'Crie uma chave de API primeiro (API WhatsApp).' });
      return;
    }
    if (!stageId) {
      setTestResult({ ok: false, msg: 'Escolha a etapa de destino do webhook.' });
      return;
    }
    setTesting(true);
    setTestResult(null);
    try {
      const { data, error } = await supabase.functions.invoke('whatsapp-public-api', {
        headers: { 'X-API-Key': apiKey },
        body: {
          action: 'create_lead',
          name: `Lead de teste ${new Date().toLocaleTimeString('pt-BR')}`,
          phone: '5511999999999',
          source: 'teste-webhook',
          stage: stageId,
        },
      });
      if (error) throw error;
      if ((data as { success?: boolean } | null)?.success === false)
        throw new Error(JSON.stringify(data));
      setTestResult({
        ok: true,
        msg: `Lead criado na etapa “${stage?.title || stageId}”. Atualize o funil para ver.`,
      });
      onLeadCreated();
    } catch (err) {
      const message = err instanceof Error ? err.message : typeof err === 'string' ? err : '';
      setTestResult({
        ok: false,
        msg:
          message ||
          'Falha ao chamar o endpoint (a função pode ainda não ter sido publicada com a ação create_lead).',
      });
    } finally {
      setTesting(false);
    }
  };

  const addManual = async () => {
    if (!companyId) return;
    const res = await createLeadManually({
      companyId,
      sessionId: funnel.channelId === 'ALL' ? null : funnel.channelId,
      stageId: leadStage || stageId || columns[0]?.id || '',
      name: leadName,
      phone: leadPhone,
      source: 'manual',
    });
    if (!res.ok) {
      toast({ title: 'Erro ao criar lead', description: res.error, variant: 'destructive' });
      return;
    }
    setLeadName('');
    setLeadPhone('');
    toast({ title: 'Lead criado', description: 'Ele já aparece no funil e no kanban.' });
    onLeadCreated();
  };

  const ensureSource = () => {
    if (funnel.sources.some((s) => s.type === 'webhook')) return;
    update({
      sources: [
        ...funnel.sources,
        { id: uid(), type: 'webhook' as SourceType, label: SOURCE_LABELS.webhook, enabled: true },
      ],
    });
  };

  return (
    <div className="space-y-5">
      <p className="text-sm text-muted-foreground">
        Conecte formulários, anúncios e sistemas externos: ao receber um POST, o lead entra
        direto na etapa escolhida do funil (e no kanban do CRM).
      </p>

      {/* Etapa de destino */}
      <div className="rounded-2xl border bg-card p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Webhook className="h-4 w-4" />
          <span className="text-sm font-medium">Etapa de destino dos leads</span>
          {stage && (
            <Badge
              variant="outline"
              className="ml-auto"
              style={{ borderColor: stage.color, color: stage.color }}
            >
              {stage.title}
            </Badge>
          )}
        </div>
        <Select
          value={stageId}
          onValueChange={(v) => {
            update({ webhook: { stageId: v } });
            ensureSource();
          }}
        >
          <SelectTrigger>
            <SelectValue placeholder="Selecione a etapa" />
          </SelectTrigger>
          <SelectContent>
            {columns.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                <span
                  className="mr-2 inline-block h-2.5 w-2.5 rounded-full align-middle"
                  style={{ backgroundColor: c.color }}
                />
                {c.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Endpoint + chave */}
      <div className="rounded-2xl border bg-card p-4 space-y-4">
        <div className="space-y-2">
          <Label className="flex items-center gap-2">
            <Link2 className="h-3.5 w-3.5" /> Endpoint
          </Label>
          <div className="flex gap-2">
            <Input readOnly value={ENDPOINT} className="font-mono text-xs" />
            <Button
              variant="outline"
              size="icon"
              onClick={() => copy(ENDPOINT, 'url')}
              title="Copiar URL"
            >
              {copied === 'url' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>
        </div>

        <div className="space-y-2">
          <Label>Chave de API (header X-API-Key)</Label>
          {keyLoaded && !apiKey ? (
            <div className="flex items-center justify-between rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2.5 text-xs">
              <span>Nenhuma chave ativa — crie uma em API WhatsApp para usar o webhook.</span>
              <Button
                variant="link"
                size="sm"
                className="h-auto p-0"
                onClick={() => (window.location.href = '/dashboard/api-whatsapp')}
              >
                Criar chave
              </Button>
            </div>
          ) : (
            <div className="flex gap-2">
              <Input
                readOnly
                type={showKey ? 'text' : 'password'}
                value={apiKey || ''}
                className="font-mono text-xs"
              />
              <Button variant="outline" size="sm" onClick={() => setShowKey((v) => !v)}>
                {showKey ? 'Ocultar' : 'Ver'}
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={() => apiKey && copy(apiKey, 'key')}
                title="Copiar chave"
              >
                {copied === 'key' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
          )}
        </div>

        <div className="space-y-2">
          <Label>Exemplo de payload</Label>
          <pre className="overflow-x-auto rounded-xl bg-muted/60 p-3 text-[11px] leading-relaxed">
            {payload}
          </pre>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => copy(payload, 'json')}>
              {copied === 'json' ? <Check className="h-4 w-4 mr-2" /> : <Copy className="h-4 w-4 mr-2" />}
              Copiar JSON
            </Button>
            <Button variant="outline" size="sm" onClick={() => copy(curl, 'curl')}>
              {copied === 'curl' ? <Check className="h-4 w-4 mr-2" /> : <Copy className="h-4 w-4 mr-2" />}
              Copiar curl
            </Button>
            <Button size="sm" onClick={runTest} disabled={testing}>
              <Send className="h-4 w-4 mr-2" />
              {testing ? 'Enviando…' : 'Testar webhook'}
            </Button>
          </div>
          {testResult && (
            <div
              className={`rounded-lg px-3 py-2 text-xs ${
                testResult.ok
                  ? 'bg-emerald-500/10 text-emerald-600'
                  : 'bg-red-500/10 text-red-500'
              }`}
            >
              {testResult.msg}
            </div>
          )}
        </div>
      </div>

      {/* Lead manual */}
      <div className="rounded-2xl border bg-card p-4 space-y-3">
        <span className="text-sm font-medium">Ou adicione um lead agora</span>
        <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
          <Input
            placeholder="Nome do lead"
            value={leadName}
            onChange={(e) => setLeadName(e.target.value)}
          />
          <Input
            placeholder="WhatsApp com DDI (ex.: 5511999999999)"
            value={leadPhone}
            onChange={(e) => setLeadPhone(e.target.value)}
          />
          <Button onClick={addManual} disabled={!leadPhone || !companyId}>
            <Plus className="h-4 w-4 mr-2" />
            Adicionar
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          O lead entra em “{stage?.title || 'etapa selecionada'}” e já aparece no funil.
        </p>
      </div>
    </div>
  );
}

export default WebhookPanel;
