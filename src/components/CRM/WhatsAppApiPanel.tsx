import React, { useState, useEffect } from 'react';
import { Key, Copy, Trash2, Plus, Eye, EyeOff, Power, Code, BarChart3, Clock, Loader2, RefreshCw, Webhook } from 'lucide-react';
import WhatsAppApiLogs from './WhatsAppApiLogs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

interface ApiKey {
  id: string;
  api_key: string;
  name: string;
  is_active: boolean;
  rate_limit_per_minute: number;
  total_messages_sent: number;
  last_used_at: string | null;
  created_at: string;
  session_id: string;
  webhook_url?: string | null;
  webhook_secret?: string | null;
}

interface WhatsAppApiPanelProps {
  sessions: { id: string; instance_name: string; status: string; phone_number?: string }[];
  companyId: string;
}

const WhatsAppApiPanel: React.FC<WhatsAppApiPanelProps> = ({ sessions, companyId }) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [selectedSessionId, setSelectedSessionId] = useState('');
  const [visibleKeys, setVisibleKeys] = useState<Set<string>>(new Set());
  const [codeTab, setCodeTab] = useState('curl');
  const [webhookKey, setWebhookKey] = useState<ApiKey | null>(null);
  const [webhookUrl, setWebhookUrl] = useState('');
  const [webhookBusy, setWebhookBusy] = useState(false);

  const openWebhook = (key: ApiKey) => { setWebhookKey(key); setWebhookUrl(key.webhook_url || ''); };
  const saveWebhook = async () => {
    if (!webhookKey) return;
    if (webhookUrl && !/^https?:\/\//.test(webhookUrl)) { toast({ title: 'URL inválida', variant: 'destructive' }); return; }
    setWebhookBusy(true);
    const { error } = await supabase.from('whatsapp_api_keys').update({ webhook_url: webhookUrl || null } as never).eq('id', webhookKey.id);
    setWebhookBusy(false);
    if (error) { toast({ title: 'Erro ao salvar', description: error.message, variant: 'destructive' }); return; }
    toast({ title: 'Webhook salvo' });
    setWebhookKey(null);
    fetchApiKeys();
  };
  const testWebhook = async () => {
    if (!webhookKey || !webhookUrl) return;
    setWebhookBusy(true);
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/whatsapp-public-api`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-API-Key': webhookKey.api_key },
        body: JSON.stringify({ action: 'test_webhook', webhook_url: webhookUrl }),
      });
      const data = await res.json();
      toast(data.delivered ? { title: 'Webhook respondeu OK', description: `Status ${data.status}` } : { title: 'Webhook não respondeu 2xx', description: data.error || `Status ${data.status ?? '-'}`, variant: 'destructive' });
    } catch (e) {
      toast({ title: 'Falha no teste', description: String(e), variant: 'destructive' });
    }
    setWebhookBusy(false);
  };

  const connectedSessions = sessions.filter(s => s.status === 'connected');
  const SUPABASE_URL = 'https://jwddiyuezqrpuakazvgg.supabase.co';

  useEffect(() => {
    fetchApiKeys();
  }, [companyId]);

  const fetchApiKeys = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('whatsapp_api_keys')
      .select('*')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false });

    if (!error && data) {
      setApiKeys(data as unknown as ApiKey[]);
    }
    setLoading(false);
  };

  const generateApiKey = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let key = 'ek_';
    for (let i = 0; i < 48; i++) {
      key += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return key;
  };

  const handleCreateKey = async () => {
    if (!selectedSessionId || !newKeyName.trim()) {
      toast({ title: 'Preencha todos os campos', variant: 'destructive' });
      return;
    }
    setCreating(true);
    const apiKey = generateApiKey();

    const { error } = await supabase.from('whatsapp_api_keys').insert({
      company_id: companyId,
      session_id: selectedSessionId,
      api_key: apiKey,
      name: newKeyName.trim(),
    });

    if (error) {
      toast({ title: 'Erro ao criar API Key', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'API Key criada com sucesso!' });
      setShowCreateDialog(false);
      setNewKeyName('');
      setSelectedSessionId('');
      fetchApiKeys();
    }
    setCreating(false);
  };

  const toggleKeyStatus = async (key: ApiKey) => {
    await supabase.from('whatsapp_api_keys').update({ is_active: !key.is_active }).eq('id', key.id);
    fetchApiKeys();
  };

  const deleteKey = async (id: string) => {
    await supabase.from('whatsapp_api_keys').delete().eq('id', id);
    toast({ title: 'API Key removida' });
    fetchApiKeys();
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: 'Copiado!' });
  };

  const toggleKeyVisibility = (id: string) => {
    setVisibleKeys(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const maskKey = (key: string) => key.substring(0, 6) + '••••••••••••••••••••••' + key.substring(key.length - 4);

  const getCodeExamples = (apiKey: string) => ({
    curl: `curl -X POST "${SUPABASE_URL}/functions/v1/whatsapp-public-api" \\
  -H "Content-Type: application/json" \\
  -H "X-API-Key: ${apiKey}" \\
  -d '{
    "action": "send_text",
    "phone": "5511999999999",
    "message": "Olá! Sua compra foi confirmada."
  }'`,
    javascript: `const response = await fetch(
  "${SUPABASE_URL}/functions/v1/whatsapp-public-api",
  {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": "${apiKey}",
    },
    body: JSON.stringify({
      action: "send_text",
      phone: "5511999999999",
      message: "Olá! Sua compra foi confirmada.",
    }),
  }
);

const data = await response.json();
console.log(data);`,
    python: `import requests

response = requests.post(
    "${SUPABASE_URL}/functions/v1/whatsapp-public-api",
    headers={
        "Content-Type": "application/json",
        "X-API-Key": "${apiKey}",
    },
    json={
        "action": "send_text",
        "phone": "5511999999999",
        "message": "Olá! Sua compra foi confirmada.",
    },
)

print(response.json())`,
  });

  const firstKey = apiKeys[0]?.api_key || 'SUA_API_KEY';
  const examples = getCodeExamples(firstKey);

  return (
    <div className="space-y-6 p-4">
      {/* Header */}
      <div className="flex items-center justify-between p-4 rounded-2xl" style={{ background: 'linear-gradient(135deg, #374DA4, #5B33F0)' }}>
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2 text-white">
            <Key className="h-5 w-5" /> API Pública WhatsApp
          </h2>
          <p className="text-sm text-white/80 mt-1">
            Gere API Keys para enviar mensagens WhatsApp de sites e sistemas externos
          </p>
        </div>
        <Button onClick={() => setShowCreateDialog(true)} disabled={connectedSessions.length === 0} className="bg-white text-[#374DA4] hover:bg-white/90">
          <Plus className="h-4 w-4 mr-2" /> Nova API Key
        </Button>
      </div>

      {connectedSessions.length === 0 && (
        <Card className="border-dashed border-yellow-300 bg-yellow-50/50">
          <CardContent className="p-4 text-center text-sm text-yellow-800">
            ⚠️ Conecte uma sessão WhatsApp via QR Code antes de gerar API Keys.
          </CardContent>
        </Card>
      )}

      {/* API Keys Table */}
      <Card>
        <CardHeader className="pb-3 border-b border-[#374DA4]/10">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base text-[#374DA4]">Suas API Keys</CardTitle>
            <Button variant="ghost" size="sm" onClick={fetchApiKeys}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center p-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
          ) : apiKeys.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">Nenhuma API Key criada ainda</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>API Key</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-center">Mensagens</TableHead>
                  <TableHead>Último uso</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {apiKeys.map(key => (
                  <TableRow key={key.id}>
                    <TableCell className="font-medium">{key.name}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <code className="text-xs bg-muted px-2 py-1 rounded max-w-[200px] truncate">
                          {visibleKeys.has(key.id) ? key.api_key : maskKey(key.api_key)}
                        </code>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => toggleKeyVisibility(key.id)}>
                          {visibleKeys.has(key.id) ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => copyToClipboard(key.api_key)}>
                          <Copy className="h-3 w-3" />
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={key.is_active ? 'default' : 'secondary'}>
                        {key.is_active ? 'Ativa' : 'Inativa'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">{key.total_messages_sent}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {key.last_used_at ? new Date(key.last_used_at).toLocaleString('pt-BR') : 'Nunca'}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openWebhook(key)} title="Webhook">
                          <Webhook className={`h-3 w-3 ${key.webhook_url ? 'text-foreground' : 'text-muted-foreground'}`} />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => toggleKeyStatus(key)}
                          title={key.is_active ? 'Desativar' : 'Ativar'}>
                          <Power className={`h-3 w-3 ${key.is_active ? 'text-green-500' : 'text-muted-foreground'}`} />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteKey(key.id)}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Code Examples */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2 text-[#374DA4]">
            <Code className="h-4 w-4" /> Exemplos de Integração
          </CardTitle>
          <CardDescription>Copie e cole no seu site ou sistema para enviar mensagens</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={codeTab} onValueChange={setCodeTab}>
            <TabsList>
              <TabsTrigger value="curl">cURL</TabsTrigger>
              <TabsTrigger value="javascript">JavaScript</TabsTrigger>
              <TabsTrigger value="python">Python</TabsTrigger>
            </TabsList>
            <TabsContent value="curl">
              <div className="relative">
                <pre className="bg-muted p-4 rounded-lg text-xs overflow-x-auto whitespace-pre-wrap">{examples.curl}</pre>
                <Button variant="ghost" size="icon" className="absolute top-2 right-2 h-7 w-7" onClick={() => copyToClipboard(examples.curl)}>
                  <Copy className="h-3 w-3" />
                </Button>
              </div>
            </TabsContent>
            <TabsContent value="javascript">
              <div className="relative">
                <pre className="bg-muted p-4 rounded-lg text-xs overflow-x-auto whitespace-pre-wrap">{examples.javascript}</pre>
                <Button variant="ghost" size="icon" className="absolute top-2 right-2 h-7 w-7" onClick={() => copyToClipboard(examples.javascript)}>
                  <Copy className="h-3 w-3" />
                </Button>
              </div>
            </TabsContent>
            <TabsContent value="python">
              <div className="relative">
                <pre className="bg-muted p-4 rounded-lg text-xs overflow-x-auto whitespace-pre-wrap">{examples.python}</pre>
                <Button variant="ghost" size="icon" className="absolute top-2 right-2 h-7 w-7" onClick={() => copyToClipboard(examples.python)}>
                  <Copy className="h-3 w-3" />
                </Button>
              </div>
            </TabsContent>
          </Tabs>

          <div className="mt-4 p-3 bg-muted/50 rounded-lg">
            <h4 className="text-sm font-semibold mb-2">Ações disponíveis:</h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-xs">
              <div className="p-2 bg-background rounded border">
                <code className="font-bold text-primary">send_text</code>
                <p className="text-muted-foreground mt-1">Envia mensagem de texto</p>
                <p className="text-muted-foreground">Campos: phone, message</p>
              </div>
              <div className="p-2 bg-background rounded border">
                <code className="font-bold text-primary">send_media</code>
                <p className="text-muted-foreground mt-1">Envia imagem/vídeo/doc</p>
                <p className="text-muted-foreground">Campos: phone, media_url, caption, media_type</p>
              </div>
              <div className="p-2 bg-background rounded border">
                <code className="font-bold text-primary">check_status</code>
                <p className="text-muted-foreground mt-1">Verifica se sessão está conectada</p>
                <p className="text-muted-foreground">Sem campos adicionais</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* API Logs */}
      <WhatsAppApiLogs companyId={companyId} />

      {/* Create Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova API Key</DialogTitle>
            <DialogDescription>Gere uma chave para integrar com sistemas externos</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Nome da chave</label>
              <Input value={newKeyName} onChange={e => setNewKeyName(e.target.value)} placeholder="Ex: Meu E-commerce" />
            </div>
            <div>
              <label className="text-sm font-medium">Sessão WhatsApp</label>
              <select
                className="w-full mt-1 rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={selectedSessionId}
                onChange={e => setSelectedSessionId(e.target.value)}
              >
                <option value="">Selecione uma sessão conectada</option>
                {connectedSessions.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.instance_name} {s.phone_number ? `(${s.phone_number})` : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>Cancelar</Button>
            <Button onClick={handleCreateKey} disabled={creating}>
              {creating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Key className="h-4 w-4 mr-2" />}
              Gerar API Key
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={!!webhookKey} onOpenChange={(o) => !o && setWebhookKey(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Webhook da chave</DialogTitle>
            <DialogDescription>Recebe os avisos de aprovação de posts (aprovado, recusado, nova versão, publicado, cancelado).</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <label className="text-sm font-medium">URL do webhook</label>
              <Input value={webhookUrl} onChange={(e) => setWebhookUrl(e.target.value)} placeholder="https://seusistema.com/webhooks/ellosuit" />
            </div>
            {webhookKey?.webhook_secret && (
              <div className="space-y-1">
                <label className="text-sm font-medium">Segredo do webhook (assinatura X-Ellosuit-Signature)</label>
                <div className="flex gap-2">
                  <code className="flex-1 text-xs bg-muted px-2 py-2 rounded truncate">{webhookKey.webhook_secret}</code>
                  <Button variant="outline" size="icon" onClick={() => copyToClipboard(webhookKey.webhook_secret || '')}><Copy className="h-3 w-3" /></Button>
                </div>
              </div>
            )}
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={testWebhook} disabled={!webhookUrl || webhookBusy}>Testar webhook</Button>
            <Button onClick={saveWebhook} disabled={webhookBusy}>{webhookBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Salvar'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default WhatsAppApiPanel;
