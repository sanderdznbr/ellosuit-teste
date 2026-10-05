import { useState, useEffect } from 'react';
import { X, Copy, Check, RefreshCw, Loader2, Globe, Zap, ExternalLink, CheckCircle2, AlertCircle, Plus, Tag, ScrollText, ChevronDown, ChevronUp, Code } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AutomationNode, AUTOMATION_BLOCKS } from './types';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import * as Icons from 'lucide-react';
import { useQuery } from '@tanstack/react-query';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';

interface Props {
  node: AutomationNode;
  automationId?: string | null;
  onClose: () => void;
  onUpdate: (nodeId: string, updates: Partial<AutomationNode>) => void;
}

export default function AutomationPropertiesPanel({ node, automationId, onClose, onUpdate }: Props) {
  const { toast } = useToast();
  const { user } = useAuth();
  const block = AUTOMATION_BLOCKS.find(b => b.type === node.type);
  const color = block?.color || '#64748B';
  const [copied, setCopied] = useState(false);
  const [testingWebhook, setTestingWebhook] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string; fields?: string[] } | null>(null);
  const [externalUrl, setExternalUrl] = useState(node.config?.externalWebhookUrl || '');
  const [fetchingFields, setFetchingFields] = useState(false);
  const [generatingUrl, setGeneratingUrl] = useState(false);
  const [generatedWebhookId, setGeneratedWebhookId] = useState<string | null>(automationId || null);
  const [newTag, setNewTag] = useState('');
  const [creatingGroup, setCreatingGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [showWebhookLogs, setShowWebhookLogs] = useState(false);
  const [webhookLogs, setWebhookLogs] = useState<any[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

  // Fetch email templates for the company
  const { data: emailTemplates } = useQuery({
    queryKey: ['email-templates-automation'],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data: cu } = await supabase.from('company_users').select('company_id').eq('user_id', user.id).single();
      if (!cu?.company_id) return [];
      const { data } = await supabase.from('email_templates').select('id, name, html_content, category').eq('company_id', cu.company_id).eq('is_active', true).order('name');
      return data || [];
    },
    enabled: !!user?.id && node.type === 'send_email',
  });

  // Fetch contact groups for the company
  const { data: contactGroups, refetch: refetchGroups } = useQuery({
    queryKey: ['contact-groups-automation'],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data: cu } = await supabase.from('company_users').select('company_id').eq('user_id', user.id).single();
      if (!cu?.company_id) return [];
      const { data } = await supabase.from('contact_groups').select('id, name').eq('company_id', cu.company_id).order('name');
      return data || [];
    },
    enabled: !!user?.id,
  });

  const handleCreateGroup = async () => {
    if (!newGroupName.trim() || !user?.id) return;
    setCreatingGroup(true);
    try {
      const { data: cu } = await supabase.from('company_users').select('company_id').eq('user_id', user.id).single();
      if (!cu?.company_id) throw new Error('Empresa não encontrada');
      const { data, error } = await supabase.from('contact_groups').insert({
        company_id: cu.company_id,
        created_by: user.id,
        name: newGroupName.trim(),
      }).select('id').single();
      if (error) throw error;
      await refetchGroups();
      updateConfig('addToGroupId', data.id);
      setNewGroupName('');
      toast({ title: 'Grupo criado!', description: `"${newGroupName.trim()}" foi criado e selecionado.` });
    } catch (err: any) {
      toast({ title: 'Erro ao criar grupo', description: err.message, variant: 'destructive' });
    } finally {
      setCreatingGroup(false);
    }
  };

  useEffect(() => {
    setExternalUrl(node.config?.externalWebhookUrl || '');
    setTestResult(null);
  }, [node.id]);

  const getIcon = (iconName: string) => {
    const IconComp = (Icons as any)[iconName];
    return IconComp ? <IconComp className="h-5 w-5" /> : null;
  };

  const updateConfig = (key: string, value: any) => {
    onUpdate(node.id, { config: { ...node.config, [key]: value } });
  };

  const updateConfigBatch = (updates: Record<string, any>) => {
    onUpdate(node.id, { config: { ...node.config, ...updates } });
  };

  const webhookUrl = generatedWebhookId
    ? `${SUPABASE_URL}/functions/v1/automation-webhook/${generatedWebhookId}`
    : '';

  // Generate webhook URL without needing to save the full automation
  const generateWebhookUrl = async () => {
    if (automationId) {
      setGeneratedWebhookId(automationId);
      toast({ title: 'URL gerada!', description: 'URL do webhook pronta para uso' });
      return;
    }

    // Auto-create the automation to get an ID
    setGeneratingUrl(true);
    try {
      if (!user?.id) throw new Error('Não autenticado');
      const { data: companyData } = await supabase.from('company_users').select('company_id').eq('user_id', user.id).single();
      if (!companyData?.company_id) throw new Error('Empresa não encontrada');

      const { data, error } = await supabase
        .from('automations')
        .insert({
          company_id: companyData.company_id,
          created_by: user.id,
          name: 'Automação Webhook',
          trigger_type: 'webhook',
          nodes: [],
          edges: [],
        })
        .select('id')
        .single();

      if (error) throw error;
      setGeneratedWebhookId(data.id);
      toast({ title: 'URL gerada!', description: 'Automação criada automaticamente' });
    } catch (err: any) {
      toast({ title: 'Erro', description: err.message, variant: 'destructive' });
    } finally {
      setGeneratingUrl(false);
    }
  };

  const copyWebhookUrl = () => {
    if (!webhookUrl) return;
    navigator.clipboard.writeText(webhookUrl);
    setCopied(true);
    toast({ title: 'Copiado!' });
    setTimeout(() => setCopied(false), 2000);
  };

  const testWebhook = async () => {
    if (!webhookUrl) return;
    setTestingWebhook(true);
    setTestResult(null);
    try {
      const res = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          _test: true,
          name: 'Teste Automação',
          email: 'teste@exemplo.com',
          phone: '11999999999',
        }),
      });
      const data = await res.json();
      if (data.success) {
        const fields = data.fields_detected || [];
        updateConfigBatch({
          detectedFields: fields,
          lastReceivedAt: new Date().toISOString(),
        });
        setTestResult({ success: true, message: `${fields.length} campos detectados`, fields });
      } else {
        setTestResult({ success: false, message: data.error || 'Falha no teste' });
      }
    } catch (err: any) {
      setTestResult({ success: false, message: err.message });
    } finally {
      setTestingWebhook(false);
    }
  };

  const fetchExternalWebhook = async () => {
    if (!externalUrl.trim()) return;
    setFetchingFields(true);
    try {
      const res = await fetch(externalUrl);
      const data = await res.json();
      const fields = typeof data === 'object' && data !== null ? extractFieldPaths(data) : [];
      updateConfigBatch({
        externalWebhookUrl: externalUrl,
        externalDetectedFields: fields,
        externalSampleData: data,
      });
      toast({ title: 'Campos detectados!', description: `${fields.length} campos encontrados` });
    } catch (err: any) {
      toast({ title: 'Erro ao buscar dados', description: err.message, variant: 'destructive' });
    } finally {
      setFetchingFields(false);
    }
  };

  const extractFieldPaths = (obj: any, prefix = ''): string[] => {
    const paths: string[] = [];
    for (const key in obj) {
      const fullKey = prefix ? `${prefix}.${key}` : key;
      if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
        paths.push(...extractFieldPaths(obj[key], fullKey));
      } else {
        paths.push(fullKey);
      }
    }
    return paths;
  };

  const loadWebhookLogs = async () => {
    if (!automationId) return;
    setLoadingLogs(true);
    try {
      const { data, error } = await supabase
        .from('automation_executions')
        .select('id, started_at, status, trigger_data, execution_log')
        .eq('automation_id', automationId)
        .order('started_at', { ascending: false })
        .limit(20);
      if (error) throw error;
      setWebhookLogs(data || []);
      setShowWebhookLogs(true);
    } catch (err: any) {
      toast({ title: 'Erro ao carregar logs', description: err.message, variant: 'destructive' });
    } finally {
      setLoadingLogs(false);
    }
  };

  const detectedFields: string[] = node.config?.detectedFields || [];
  const externalFields: string[] = node.config?.externalDetectedFields || [];
  const webhookMode = node.config?.webhookMode || 'receive';

  return (
    <div className="w-80 bg-white border-l flex flex-col flex-shrink-0 overflow-hidden shadow-lg">
      {/* Header */}
      <div className="p-4 border-b flex items-center gap-3" style={{ backgroundColor: color + '08' }}>
        <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white shadow-md"
          style={{ backgroundColor: color }}>
          {block && getIcon(block.icon)}
        </div>
        <div className="flex-1 min-w-0">
          <Input
            value={node.label}
            onChange={e => onUpdate(node.id, { label: e.target.value })}
            className="h-7 text-sm font-bold border-0 p-0 focus-visible:ring-0 bg-transparent"
          />
          <p className="text-[10px] text-gray-400">{block?.description}</p>
        </div>
        <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
          <X className="h-4 w-4 text-gray-400" />
        </button>
      </div>

      {/* Config */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">

        {/* ===== WEBHOOK ===== */}
        {node.type === 'webhook' && (
          <>
            <div>
              <label className="text-xs font-semibold text-gray-600 mb-1.5 block">Modo do Webhook</label>
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  onClick={() => updateConfig('webhookMode', 'receive')}
                  className={`flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-medium border-2 transition-all ${
                    webhookMode === 'receive'
                      ? 'border-[#5A74D1] bg-[#F0F2FE] text-[#253573] shadow-sm'
                      : 'border-gray-200 text-gray-500 hover:bg-gray-50'
                  }`}
                >
                  <Zap className="h-3.5 w-3.5" />
                  Receber
                </button>
                <button
                  onClick={() => updateConfig('webhookMode', 'fetch')}
                  className={`flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-medium border-2 transition-all ${
                    webhookMode === 'fetch'
                      ? 'border-[#5A74D1] bg-[#F0F2FE] text-[#253573] shadow-sm'
                      : 'border-gray-200 text-gray-500 hover:bg-gray-50'
                  }`}
                >
                  <Globe className="h-3.5 w-3.5" />
                  Puxar dados
                </button>
              </div>
            </div>

            {webhookMode === 'receive' ? (
              <>
                <div>
                  <label className="text-xs font-semibold text-gray-600 mb-1 block">Método</label>
                  <Select value={node.config?.method || 'POST'} onValueChange={v => updateConfig('method', v)}>
                    <SelectTrigger className="rounded-xl h-9 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="POST">POST</SelectItem>
                      <SelectItem value="GET">GET</SelectItem>
                      <SelectItem value="PUT">PUT</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Generate / Show URL */}
                <div>
                  <label className="text-xs font-semibold text-gray-600 mb-1.5 block">URL do Webhook</label>
                  {webhookUrl ? (
                    <div className="space-y-2">
                      <div className="bg-gray-50 rounded-xl p-2.5 text-[10px] font-mono text-gray-600 break-all border border-gray-200 leading-relaxed">
                        {webhookUrl}
                      </div>
                      <div className="flex gap-1.5">
                        <Button size="sm" variant="outline" onClick={copyWebhookUrl}
                          className="flex-1 rounded-xl h-9 text-xs gap-1.5">
                          {copied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
                          {copied ? 'Copiado!' : 'Copiar'}
                        </Button>
                        <Button size="sm" onClick={testWebhook}
                          disabled={testingWebhook}
                          className="rounded-xl h-9 text-xs gap-1.5 bg-[#2F428D] hover:bg-[#253573] text-white">
                          {testingWebhook ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                          Testar
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <Button
                      onClick={generateWebhookUrl}
                      disabled={generatingUrl}
                      className="w-full rounded-xl h-10 text-xs gap-2 bg-[#2F428D] hover:bg-[#253573] text-white shadow-md"
                    >
                      {generatingUrl ? <Loader2 className="h-4 w-4 animate-spin" /> : <ExternalLink className="h-4 w-4" />}
                      Gerar Link do Webhook
                    </Button>
                  )}
                </div>

                {/* Test result */}
                {testResult && (
                  <div className={`rounded-xl p-3 text-xs border ${
                    testResult.success
                      ? 'bg-green-50 border-green-200 text-green-700'
                      : 'bg-red-50 border-red-200 text-red-700'
                  }`}>
                    <div className="flex items-center gap-2 font-semibold mb-1">
                      {testResult.success ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
                      {testResult.success ? 'Teste bem-sucedido!' : 'Falha no teste'}
                    </div>
                    <p className="text-[10px]">{testResult.message}</p>
                  </div>
                )}

                {/* Detected fields */}
                {detectedFields.length > 0 && (
                  <div>
                    <label className="text-xs font-semibold text-gray-600 mb-1.5 block">Campos detectados</label>
                    <div className="flex flex-wrap gap-1">
                      {detectedFields.map(f => (
                        <Badge key={f} variant="secondary" className="text-[10px] rounded-full px-2 py-0.5 font-mono bg-[#F0F2FE] text-[#253573]">
                          {f}
                        </Badge>
                      ))}
                    </div>
                    {node.config?.lastReceivedAt && (
                      <p className="text-[9px] text-gray-400 mt-1.5">
                        Último: {new Date(node.config.lastReceivedAt).toLocaleString('pt-BR')}
                      </p>
                    )}
                  </div>
                )}

                {/* Webhook Logs */}
                <div className="border-t pt-3">
                  <button
                    onClick={loadWebhookLogs}
                    disabled={loadingLogs || !automationId}
                    className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold border-2 border-gray-200 hover:bg-gray-50 transition-all text-gray-700"
                  >
                    <span className="flex items-center gap-1.5">
                      {loadingLogs ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ScrollText className="h-3.5 w-3.5" />}
                      Logs do Webhook
                    </span>
                    {showWebhookLogs ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                  </button>

                  {showWebhookLogs && (
                    <div className="mt-2 space-y-2 max-h-80 overflow-y-auto">
                      {webhookLogs.length === 0 ? (
                        <p className="text-[10px] text-gray-400 text-center py-3">Nenhum log encontrado</p>
                      ) : (
                        webhookLogs.map((log) => (
                          <div key={log.id} className="border border-gray-200 rounded-xl overflow-hidden">
                            <button
                              onClick={() => setExpandedLogId(expandedLogId === log.id ? null : log.id)}
                              className="w-full flex items-center justify-between p-2.5 hover:bg-gray-50 transition-colors"
                            >
                              <div className="flex items-center gap-2 text-left">
                                <div className={`w-2 h-2 rounded-full flex-shrink-0 ${log.status === 'completed' ? 'bg-green-500' : log.status === 'error' ? 'bg-red-500' : 'bg-yellow-500'}`} />
                                <div>
                                  <p className="text-[10px] font-medium text-gray-700">
                                    {new Date(log.started_at).toLocaleString('pt-BR')}
                                  </p>
                                  <p className="text-[9px] text-gray-400">{log.status}</p>
                                </div>
                              </div>
                              {expandedLogId === log.id ? <ChevronUp className="h-3 w-3 text-gray-400" /> : <ChevronDown className="h-3 w-3 text-gray-400" />}
                            </button>
                            {expandedLogId === log.id && (
                              <div className="border-t border-gray-100 p-2.5 bg-gray-50">
                                <label className="text-[9px] font-semibold text-gray-500 uppercase tracking-wider block mb-1">Dados recebidos</label>
                                <pre className="text-[9px] font-mono text-gray-700 bg-white border border-gray-200 rounded-lg p-2 overflow-x-auto whitespace-pre-wrap break-all max-h-48 overflow-y-auto">
                                  {JSON.stringify(log.trigger_data, null, 2)}
                                </pre>
                                {log.execution_log && (
                                  <>
                                    <label className="text-[9px] font-semibold text-gray-500 uppercase tracking-wider block mb-1 mt-2">Resultado</label>
                                    <pre className="text-[9px] font-mono text-gray-700 bg-white border border-gray-200 rounded-lg p-2 overflow-x-auto whitespace-pre-wrap break-all max-h-32 overflow-y-auto">
                                      {JSON.stringify(log.execution_log, null, 2)}
                                    </pre>
                                  </>
                                )}
                              </div>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              </>
            ) : (
              <>
                <div>
                  <label className="text-xs font-semibold text-gray-600 mb-1 block">URL externa (GET)</label>
                  <Input
                    value={externalUrl}
                    onChange={e => setExternalUrl(e.target.value)}
                    placeholder="https://api.exemplo.com/dados"
                    className="rounded-xl h-9 text-xs"
                  />
                </div>
                <Button size="sm" onClick={fetchExternalWebhook} disabled={fetchingFields || !externalUrl.trim()}
                  className="w-full rounded-xl h-9 text-xs gap-1.5 bg-[#2F428D] hover:bg-[#253573] text-white">
                  {fetchingFields ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Globe className="h-3.5 w-3.5" />}
                  Buscar e detectar campos
                </Button>
                {externalFields.length > 0 && (
                  <div>
                    <label className="text-xs font-semibold text-gray-600 mb-1.5 block">Campos detectados</label>
                    <div className="flex flex-wrap gap-1">
                      {externalFields.map(f => (
                        <Badge key={f} variant="secondary" className="text-[10px] rounded-full px-2 py-0.5 font-mono bg-teal-50 text-teal-700">
                          {f}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </>
        )}

        {/* ===== NEW CLIENT TRIGGER ===== */}
        {node.type === 'new_client' && (
          <div className="space-y-3">
            <div>
              <label className="text-xs font-semibold text-gray-600 mb-1 block">Tipo de Cliente</label>
              <Select value={node.config?.clientType || 'any'} onValueChange={v => updateConfig('clientType', v)}>
                <SelectTrigger className="rounded-xl h-9 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">Qualquer tipo</SelectItem>
                  <SelectItem value="lead">Lead</SelectItem>
                  <SelectItem value="client">Cliente</SelectItem>
                  <SelectItem value="prospect">Prospecto</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Button
                variant="outline"
                size="sm"
                className="w-full rounded-xl text-xs h-8 gap-1.5"
                onClick={() => updateConfig('showDynamicFields', !node.config?.showDynamicFields)}
              >
                <Code className="h-3.5 w-3.5" />
                {node.config?.showDynamicFields ? 'Ocultar campos dinâmicos' : 'Exibir campos dinâmicos'}
              </Button>

              {node.config?.showDynamicFields && (
                <div className="mt-2 rounded-xl border border-border bg-muted/40 p-2.5 space-y-1 max-h-72 overflow-y-auto">
                  <p className="text-[10px] text-muted-foreground mb-1.5">Selecione os campos que deseja como saída (bolinhas de conexão). Clique na tag para copiar:</p>
                  {[
                    { key: 'name', label: 'Nome' },
                    { key: 'email', label: 'Email' },
                    { key: 'phone', label: 'Telefone' },
                    { key: 'whatsapp', label: 'WhatsApp' },
                    { key: 'company_name', label: 'Empresa' },
                    { key: 'cnpj_cpf', label: 'CPF/CNPJ' },
                    { key: 'status', label: 'Status' },
                    { key: 'client_type', label: 'Tipo' },
                    { key: 'profession', label: 'Profissão' },
                    { key: 'birth_date', label: 'Nascimento' },
                    { key: 'address_street', label: 'Rua' },
                    { key: 'address_number', label: 'Número' },
                    { key: 'address_city', label: 'Cidade' },
                    { key: 'address_state', label: 'Estado' },
                    { key: 'address_zip', label: 'CEP' },
                    { key: 'website', label: 'Website' },
                    { key: 'linkedin', label: 'LinkedIn' },
                    { key: 'instagram', label: 'Instagram' },
                    { key: 'facebook', label: 'Facebook' },
                    { key: 'industry', label: 'Setor' },
                    { key: 'company_size', label: 'Porte' },
                    { key: 'annual_revenue', label: 'Receita anual' },
                    { key: 'tags', label: 'Tags' },
                    { key: 'notes', label: 'Observações' },
                    { key: 'custom_fields', label: 'Campos Personalizados' },
                    { key: 'purchased_items', label: 'Item Comprado' },
                    { key: 'purchase_date', label: 'Data da Compra' },
                    { key: 'purchase_total', label: 'Valor Total' },
                  ].map(f => {
                    const activeOutputs: string[] = node.config?.activeOutputFields || ['name', 'email', 'phone', 'whatsapp'];
                    const isActive = activeOutputs.includes(f.key);
                    return (
                      <div key={f.key} className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-primary/5 transition-colors">
                        <button
                          type="button"
                          className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                            isActive ? 'bg-primary border-primary text-primary-foreground' : 'border-muted-foreground/30 hover:border-primary/50'
                          }`}
                          onClick={() => {
                            const updated = isActive
                              ? activeOutputs.filter((k: string) => k !== f.key)
                              : [...activeOutputs, f.key];
                            updateConfig('activeOutputFields', updated);
                          }}
                        >
                          {isActive && <Check className="h-3 w-3" />}
                        </button>
                        <span className="text-[11px] text-foreground flex-1">{f.label}</span>
                        <button
                          type="button"
                          className="text-[10px] font-mono text-muted-foreground hover:text-primary transition-colors"
                          onClick={() => {
                            navigator.clipboard.writeText(`{{client.${f.key}}}`);
                            toast({ title: 'Copiado!', description: `{{client.${f.key}}}` });
                          }}
                        >
                          {'{{client.' + f.key + '}}'}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {node.type === 'client_updated' && (
          <div>
            <label className="text-xs font-semibold text-gray-600 mb-1 block">Campos monitorados</label>
            <Input value={node.config?.watchFields || ''} onChange={e => updateConfig('watchFields', e.target.value)}
              placeholder="email, phone, status" className="rounded-xl h-9 text-xs" />
            <p className="text-[10px] text-gray-400 mt-1">Separe por vírgula. Vazio = qualquer campo</p>
          </div>
        )}

        {node.type === 'proposal_status' && (
          <div>
            <label className="text-xs font-semibold text-gray-600 mb-1 block">Status da Proposta</label>
            <Select value={node.config?.status || 'approved'} onValueChange={v => updateConfig('status', v)}>
              <SelectTrigger className="rounded-xl h-9 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="approved">Aprovada</SelectItem>
                <SelectItem value="rejected">Rejeitada</SelectItem>
                <SelectItem value="sent">Enviada</SelectItem>
                <SelectItem value="viewed">Visualizada</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        {node.type === 'schedule' && (
          <div>
            <label className="text-xs font-semibold text-gray-600 mb-1 block">Expressão Cron</label>
            <Input value={node.config?.cron || '0 9 * * *'} onChange={e => updateConfig('cron', e.target.value)}
              placeholder="0 9 * * *" className="rounded-xl h-9 text-xs font-mono" />
            <p className="text-[10px] text-gray-400 mt-1">Padrão: todo dia às 9h</p>
          </div>
        )}

        {node.type === 'create_client' && (
          <>
            <p className="text-[10px] text-gray-400 bg-[#F0F2FE] p-2.5 rounded-xl border border-[#DFE4FB]">
              Os campos ativos no card do canvas receberão dados via conexão. Configure abaixo opções extras.
            </p>

            {/* Origin / Source */}
            <div>
              <label className="text-xs font-semibold text-gray-600 mb-1 block">Origem do contato</label>
              <Select value={node.config?.clientOrigin || ''} onValueChange={v => updateConfig('clientOrigin', v)}>
                <SelectTrigger className="rounded-xl h-9 text-xs"><SelectValue placeholder="Selecionar origem" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="webhook">Webhook</SelectItem>
                  <SelectItem value="landing_page">Landing Page</SelectItem>
                  <SelectItem value="formulario">Formulário</SelectItem>
                  <SelectItem value="indicacao">Indicação</SelectItem>
                  <SelectItem value="whatsapp">WhatsApp</SelectItem>
                  <SelectItem value="instagram">Instagram</SelectItem>
                  <SelectItem value="facebook">Facebook</SelectItem>
                  <SelectItem value="google_ads">Google Ads</SelectItem>
                  <SelectItem value="email_marketing">Email Marketing</SelectItem>
                  <SelectItem value="outro">Outro</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {node.config?.clientOrigin === 'outro' && (
              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1 block">Origem personalizada</label>
                <Input value={node.config?.clientOriginCustom || ''} onChange={e => updateConfig('clientOriginCustom', e.target.value)}
                  placeholder="Ex: parceiro X" className="rounded-xl h-9 text-xs" />
              </div>
            )}

            {/* Default status */}
            <div>
              <label className="text-xs font-semibold text-gray-600 mb-1 block">Status inicial</label>
              <Select value={node.config?.defaultStatus || 'lead'} onValueChange={v => updateConfig('defaultStatus', v)}>
                <SelectTrigger className="rounded-xl h-9 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="lead">Lead</SelectItem>
                  <SelectItem value="prospect">Prospecto</SelectItem>
                  <SelectItem value="client">Cliente</SelectItem>
                  <SelectItem value="inactive">Inativo</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Tags */}
            <div>
              <label className="text-xs font-semibold text-gray-600 mb-1.5 block flex items-center gap-1.5">
                <Tag className="h-3.5 w-3.5" /> Tags automáticas
              </label>
              <div className="flex flex-wrap gap-1 mb-2">
                {(node.config?.autoTags || []).map((tag: string) => (
                  <Badge key={tag} variant="secondary" className="text-[10px] rounded-full px-2 py-0.5 bg-purple-50 text-purple-700 border border-purple-200 gap-1">
                    {tag}
                    <button onClick={() => updateConfig('autoTags', (node.config?.autoTags || []).filter((t: string) => t !== tag))}
                      className="hover:text-red-500 ml-0.5">×</button>
                  </Badge>
                ))}
              </div>
              <div className="flex gap-1.5">
                <Input value={newTag} onChange={e => setNewTag(e.target.value)} placeholder="Nova tag..."
                  className="rounded-xl h-8 text-xs flex-1"
                  onKeyDown={e => {
                    if (e.key === 'Enter' && newTag.trim()) {
                      const current = node.config?.autoTags || [];
                      if (!current.includes(newTag.trim())) {
                        updateConfig('autoTags', [...current, newTag.trim()]);
                      }
                      setNewTag('');
                    }
                  }}
                />
                <Button size="sm" variant="outline" className="rounded-xl h-8 px-2"
                  onClick={() => {
                    if (newTag.trim()) {
                      const current = node.config?.autoTags || [];
                      if (!current.includes(newTag.trim())) {
                        updateConfig('autoTags', [...current, newTag.trim()]);
                      }
                      setNewTag('');
                    }
                  }}>
                  <Plus className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>

            {/* Add to group */}
            <div>
              <label className="text-xs font-semibold text-gray-600 mb-1 block">Adicionar a grupo/lista</label>
              <Select value={node.config?.addToGroupId || 'none'} onValueChange={v => {
                if (v === '__create__') return;
                updateConfig('addToGroupId', v === 'none' ? '' : v);
              }}>
                <SelectTrigger className="rounded-xl h-9 text-xs"><SelectValue placeholder="Nenhum grupo" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhum grupo</SelectItem>
                  {(contactGroups || []).map((g: any) => (
                    <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {/* Inline create group */}
              <div className="mt-2 flex gap-1.5">
                <Input
                  value={newGroupName}
                  onChange={e => setNewGroupName(e.target.value)}
                  placeholder="Nome do novo grupo..."
                  className="rounded-xl h-8 text-xs flex-1"
                  onKeyDown={e => { if (e.key === 'Enter') handleCreateGroup(); }}
                />
                <Button
                  size="sm"
                  variant="outline"
                  className="rounded-xl h-8 px-2.5 text-xs gap-1"
                  disabled={creatingGroup || !newGroupName.trim()}
                  onClick={handleCreateGroup}
                >
                  {creatingGroup ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
                  Criar
                </Button>
              </div>
              <p className="text-[9px] text-gray-400 mt-1">O contato será adicionado automaticamente ao grupo selecionado</p>
            </div>

            {/* Client type */}
            <div>
              <label className="text-xs font-semibold text-gray-600 mb-1 block">Tipo de contato</label>
              <Select value={node.config?.clientType || 'lead'} onValueChange={v => updateConfig('clientType', v)}>
                <SelectTrigger className="rounded-xl h-9 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="lead">Lead</SelectItem>
                  <SelectItem value="client">Cliente</SelectItem>
                  <SelectItem value="prospect">Prospecto</SelectItem>
                  <SelectItem value="partner">Parceiro</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Notes template */}
            <div>
              <label className="text-xs font-semibold text-gray-600 mb-1 block">Anotação automática</label>
              <Textarea value={node.config?.autoNotes || ''} onChange={e => updateConfig('autoNotes', e.target.value)}
                placeholder="Ex: Lead captado via webhook em {{data.data_pedido}}" className="rounded-xl text-xs min-h-[60px]" />
            </div>
          </>
        )}

        {node.type === 'update_client' && (
          <>
            <div>
              <label className="text-xs font-semibold text-gray-600 mb-1 block">Identificador do Cliente</label>
              <Input value={node.config?.clientIdentifier || ''} onChange={e => updateConfig('clientIdentifier', e.target.value)}
                placeholder="{{data.email}} ou {{data.id}}" className="rounded-xl h-9 text-xs" />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600 mb-1 block">Campos a atualizar (JSON)</label>
              <Textarea value={node.config?.updateFields || ''} onChange={e => updateConfig('updateFields', e.target.value)}
                placeholder='{"status": "client"}' className="rounded-xl text-xs font-mono min-h-[80px]" />
            </div>
          </>
        )}

        {node.type === 'send_email' && (
          <>
            <div>
              <label className="text-xs font-semibold text-gray-600 mb-1 block">Template de Email</label>
              <Select
                value={node.config?.templateId || '_none'}
                onValueChange={(val) => {
                  if (val === '_none') {
                    updateConfig('templateId', '');
                    return;
                  }
                  updateConfig('templateId', val);
                  const tpl = emailTemplates?.find(t => t.id === val);
                  if (tpl) {
                    updateConfig('body', tpl.html_content);
                  }
                }}
              >
                <SelectTrigger className="rounded-xl h-9 text-xs">
                  <SelectValue placeholder="Selecione um template..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">Sem template (HTML manual)</SelectItem>
                  {emailTemplates?.map(t => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name} {t.category ? `(${t.category})` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[9px] text-muted-foreground mt-0.5">Ao selecionar, o conteúdo será preenchido automaticamente</p>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600 mb-1 block">Destinatário</label>
              <Input value={node.config?.to || ''} onChange={e => updateConfig('to', e.target.value)}
                placeholder="{{client.email}}" className="rounded-xl h-9 text-xs" />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600 mb-1 block">Assunto</label>
              <Input value={node.config?.subject || ''} onChange={e => updateConfig('subject', e.target.value)}
                placeholder="Bem-vindo, {{client.name}}!" className="rounded-xl h-9 text-xs" />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600 mb-1 block">Conteúdo HTML</label>
              <Textarea value={node.config?.body || ''} onChange={e => updateConfig('body', e.target.value)}
                placeholder="<h1>Olá</h1>..." className="rounded-xl text-xs min-h-[100px]" />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600 mb-1 block">Campos Dinâmicos</label>
              <p className="text-[9px] text-muted-foreground mb-1.5">Clique para copiar e cole no assunto ou conteúdo</p>
              <div className="flex flex-wrap gap-1">
                {[
                  { label: 'Nome', value: '{{client.name}}' },
                  { label: 'Email', value: '{{client.email}}' },
                  { label: 'Telefone', value: '{{client.phone}}' },
                  { label: 'WhatsApp', value: '{{client.whatsapp}}' },
                  { label: 'Endereço', value: '{{client.address_street}}, {{client.address_number}} - {{client.address_city}}/{{client.address_state}}' },
                  { label: 'CPF/CNPJ', value: '{{client.cnpj_cpf}}' },
                  { label: 'Empresa', value: '{{client.company_name}}' },
                  { label: 'Observações', value: '{{client.notes}}' },
                  { label: 'Itens Comprados', value: '{{client.purchased_items}}' },
                  { label: 'Valor Pago', value: '{{client.purchase_total}}' },
                  { label: 'Data Compra', value: '{{client.purchase_date}}' },
                ].map(f => (
                  <Badge
                    key={f.label}
                    variant="outline"
                    className="text-[10px] cursor-pointer hover:bg-primary/10 transition-colors"
                    onClick={() => {
                      navigator.clipboard.writeText(f.value);
                      toast({ title: "Copiado!", description: f.value });
                    }}
                  >
                    {f.label}
                  </Badge>
                ))}
              </div>
            </div>
          </>
        )}

        {node.type === 'send_whatsapp' && (
          <>
            <div>
              <label className="text-xs font-semibold text-gray-600 mb-1 block">Número</label>
              <Input value={node.config?.to || ''} onChange={e => updateConfig('to', e.target.value)}
                placeholder="{{client.phone}}" className="rounded-xl h-9 text-xs" />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600 mb-1 block">Mensagem</label>
              <Textarea value={node.config?.message || ''} onChange={e => updateConfig('message', e.target.value)}
                placeholder="Olá {{client.name}}, ..." className="rounded-xl text-xs min-h-[80px]" />
            </div>
          </>
        )}

        {node.type === 'create_task' && (
          <>
            <div>
              <label className="text-xs font-semibold text-gray-600 mb-1 block">Título da Tarefa</label>
              <Input value={node.config?.title || ''} onChange={e => updateConfig('title', e.target.value)}
                placeholder="Follow-up com {{client.name}}" className="rounded-xl h-9 text-xs" />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600 mb-1 block">Prazo (dias)</label>
              <Input type="number" value={node.config?.dueDays || 3} onChange={e => updateConfig('dueDays', parseInt(e.target.value) || 0)}
                className="rounded-xl h-9 text-xs" />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600 mb-1 block">Descrição</label>
              <Textarea value={node.config?.description || ''} onChange={e => updateConfig('description', e.target.value)}
                placeholder="Detalhes..." className="rounded-xl text-xs min-h-[60px]" />
            </div>
          </>
        )}

        {node.type === 'create_proposal' && (
          <>
            <div>
              <label className="text-xs font-semibold text-gray-600 mb-1 block">Título da Ordem de Serviço</label>
              <Input value={node.config?.proposalTitle || ''} onChange={e => updateConfig('proposalTitle', e.target.value)}
                placeholder="OS para {{client.name}}" className="rounded-xl h-9 text-xs" />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600 mb-1 block">Template ID</label>
              <Input value={node.config?.templateId || ''} onChange={e => updateConfig('templateId', e.target.value)}
                placeholder="ID do template" className="rounded-xl h-9 text-xs" />
            </div>
          </>
        )}

        {node.type === 'create_receipt' && (
          <>
            <div>
              <label className="text-xs font-semibold text-gray-600 mb-1 block">Título do Recibo</label>
              <Input value={node.config?.title || ''} onChange={e => updateConfig('title', e.target.value)}
                placeholder="Serviço prestado - {{data.service}}" className="rounded-xl h-9 text-xs" />
              <p className="text-[9px] text-gray-400 mt-0.5">Use {'{{data.campo}}'} para dados do webhook</p>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600 mb-1 block">Valor (R$)</label>
              <Input value={node.config?.amount || ''} onChange={e => updateConfig('amount', e.target.value)}
                placeholder="{{data.valor}} ou valor fixo" className="rounded-xl h-9 text-xs" />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600 mb-1 block">Forma de Pagamento</label>
              <Select value={node.config?.payment_method || 'PIX'} onValueChange={v => updateConfig('payment_method', v)}>
                <SelectTrigger className="rounded-xl h-9 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {['PIX', 'Dinheiro', 'Cartão de Crédito', 'Cartão de Débito', 'Transferência Bancária', 'Boleto'].map(m => (
                    <SelectItem key={m} value={m}>{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600 mb-1 block">Descrição</label>
              <Textarea value={node.config?.description || ''} onChange={e => updateConfig('description', e.target.value)}
                placeholder="Descrição do serviço..." className="rounded-xl text-xs min-h-[60px]" />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600 mb-1 block">Enviar Automaticamente</label>
              <Select value={node.config?.send_method || 'none'} onValueChange={v => updateConfig('send_method', v)}>
                <SelectTrigger className="rounded-xl h-9 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Não enviar (apenas salvar)</SelectItem>
                  <SelectItem value="email">Enviar por Email</SelectItem>
                  <SelectItem value="whatsapp">Enviar por WhatsApp</SelectItem>
                  <SelectItem value="both">Enviar por Email e WhatsApp</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-[9px] text-gray-400 mt-0.5">Usa os dados do cliente criado no fluxo</p>
            </div>
          </>
        )}

        {node.type === 'http_request' && (
          <>
            <div>
              <label className="text-xs font-semibold text-gray-600 mb-1 block">URL</label>
              <Input value={node.config?.url || ''} onChange={e => updateConfig('url', e.target.value)}
                placeholder="https://api.exemplo.com" className="rounded-xl h-9 text-xs" />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600 mb-1 block">Método</label>
              <Select value={node.config?.method || 'POST'} onValueChange={v => updateConfig('method', v)}>
                <SelectTrigger className="rounded-xl h-9 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="GET">GET</SelectItem>
                  <SelectItem value="POST">POST</SelectItem>
                  <SelectItem value="PUT">PUT</SelectItem>
                  <SelectItem value="DELETE">DELETE</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600 mb-1 block">Headers (JSON)</label>
              <Textarea value={node.config?.headers || ''} onChange={e => updateConfig('headers', e.target.value)}
                placeholder='{"Authorization": "Bearer ..."}' className="rounded-xl text-xs font-mono min-h-[60px]" />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600 mb-1 block">Body (JSON)</label>
              <Textarea value={node.config?.body || ''} onChange={e => updateConfig('body', e.target.value)}
                placeholder='{"key": "{{data.value}}"}' className="rounded-xl text-xs font-mono min-h-[80px]" />
            </div>
          </>
        )}

        {node.type === 'condition' && (
          <>
            <div>
              <label className="text-xs font-semibold text-gray-600 mb-1 block">Campo</label>
              <Input value={node.config?.field || ''} onChange={e => updateConfig('field', e.target.value)}
                placeholder="{{data.status}}" className="rounded-xl h-9 text-xs" />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600 mb-1 block">Operador</label>
              <Select value={node.config?.operator || 'equals'} onValueChange={v => updateConfig('operator', v)}>
                <SelectTrigger className="rounded-xl h-9 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="equals">Igual a</SelectItem>
                  <SelectItem value="not_equals">Diferente de</SelectItem>
                  <SelectItem value="contains">Contém</SelectItem>
                  <SelectItem value="greater">Maior que</SelectItem>
                  <SelectItem value="less">Menor que</SelectItem>
                  <SelectItem value="exists">Existe</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600 mb-1 block">Valor</label>
              <Input value={node.config?.value || ''} onChange={e => updateConfig('value', e.target.value)}
                placeholder="Valor de comparação" className="rounded-xl h-9 text-xs" />
            </div>
          </>
        )}

        {node.type === 'filter' && (
          <>
            <div>
              <label className="text-xs font-semibold text-gray-600 mb-1 block">Campo para filtrar</label>
              <Input value={node.config?.filterField || ''} onChange={e => updateConfig('filterField', e.target.value)}
                placeholder="{{data.email}}" className="rounded-xl h-9 text-xs" />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600 mb-1 block">Condição</label>
              <Select value={node.config?.filterOperator || 'not_empty'} onValueChange={v => updateConfig('filterOperator', v)}>
                <SelectTrigger className="rounded-xl h-9 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="not_empty">Não está vazio</SelectItem>
                  <SelectItem value="is_empty">Está vazio</SelectItem>
                  <SelectItem value="equals">Igual a</SelectItem>
                  <SelectItem value="contains">Contém</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {(node.config?.filterOperator === 'equals' || node.config?.filterOperator === 'contains') && (
              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1 block">Valor</label>
                <Input value={node.config?.filterValue || ''} onChange={e => updateConfig('filterValue', e.target.value)}
                  placeholder="Valor" className="rounded-xl h-9 text-xs" />
              </div>
            )}
          </>
        )}

        {node.type === 'transform_data' && (
          <>
            <p className="text-[10px] text-gray-400 bg-teal-50 p-2.5 rounded-xl border border-teal-100">
              Use <code className="font-mono text-teal-600">{'{{data.campo}}'}</code> para mapear
            </p>
            {['mapping1', 'mapping2', 'mapping3'].map((key, i) => (
              <div key={key} className="grid grid-cols-2 gap-1.5">
                <Input value={node.config?.[`${key}_from`] || ''} onChange={e => updateConfig(`${key}_from`, e.target.value)}
                  placeholder={`Origem ${i + 1}`} className="rounded-xl h-8 text-[10px]" />
                <Input value={node.config?.[`${key}_to`] || ''} onChange={e => updateConfig(`${key}_to`, e.target.value)}
                  placeholder={`Destino ${i + 1}`} className="rounded-xl h-8 text-[10px]" />
              </div>
            ))}
          </>
        )}

        {node.type === 'delay' && (
          <div className="flex gap-2">
            <div className="flex-1">
              <label className="text-xs font-semibold text-gray-600 mb-1 block">Duração</label>
              <Input type="number" value={node.config?.duration || 5} onChange={e => updateConfig('duration', parseInt(e.target.value) || 0)}
                className="rounded-xl h-9 text-xs" />
            </div>
            <div className="w-28">
              <label className="text-xs font-semibold text-gray-600 mb-1 block">Unidade</label>
              <Select value={node.config?.unit || 'minutes'} onValueChange={v => updateConfig('unit', v)}>
                <SelectTrigger className="rounded-xl h-9 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="seconds">Segundos</SelectItem>
                  <SelectItem value="minutes">Minutos</SelectItem>
                  <SelectItem value="hours">Horas</SelectItem>
                  <SelectItem value="days">Dias</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
