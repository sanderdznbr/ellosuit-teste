import React, { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { X, Settings, Loader2, Phone, AlertCircle, CheckCircle2, Bot, Brain, Upload, FileText, Trash2, Volume2 } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { FlowNode } from './types';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface WhatsAppSession {
  id: string;
  instance_name: string;
  phone_number: string | null;
  status: string;
  profile_picture: string | null;
}

interface ChatBotPropertiesPanelProps {
  node: FlowNode | null;
  flowId?: string | null;
  onClose: () => void;
  onUpdate: (nodeId: string, updates: Partial<FlowNode>) => void;
  embedded?: boolean;
}

// ------- Botão reutilizável para subir mídia direto pro storage e devolver a publicUrl -------
const MediaUploadButton: React.FC<{
  accept: string;
  userId?: string;
  onUploaded: (url: string, name?: string) => void;
  toast: (opts: { title: string; description?: string; variant?: 'default' | 'destructive' }) => void;
  label?: string;
}> = ({ accept, userId, onUploaded, toast, label = 'Enviar arquivo' }) => {
  const [uploading, setUploading] = useState(false);
  const onPick = async (file: File | null) => {
    if (!file) return;
    setUploading(true);
    try {
      const safe = file.name.replace(/[^\w.\-]+/g, '_');
      const path = `chatbot-builder/${userId ?? 'anon'}/${Date.now()}-${safe}`;
      const { error } = await supabase.storage
        .from('workflow-attachments')
        .upload(path, file, { cacheControl: '3600', upsert: false });
      if (error) throw error;
      const { data: pub } = supabase.storage
        .from('workflow-attachments')
        .getPublicUrl(path);
      onUploaded(pub.publicUrl, file.name);
      toast({ title: 'Arquivo enviado' });
    } catch (e: any) {
      toast({ title: 'Falha ao enviar', description: e?.message, variant: 'destructive' });
    } finally {
      setUploading(false);
    }
  };
  return (
    <label className="inline-flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs bg-primary text-primary-foreground hover:opacity-90 cursor-pointer w-fit">
      <input
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => onPick(e.target.files?.[0] ?? null)}
      />
      {uploading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}
      {label}
    </label>
  );
};

const ChatBotPropertiesPanel: React.FC<ChatBotPropertiesPanelProps> = ({
  node,
  flowId,
  onClose,
  onUpdate,
  embedded = false,
}) => {
  const OMNI_COLOR = '#374DA4';
  const { user } = useAuth();
  const { toast } = useToast();
  const [uploadingKnowledge, setUploadingKnowledge] = useState(false);
  const [whatsappSessions, setWhatsappSessions] = useState<WhatsAppSession[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [aiAgents, setAiAgents] = useState<{ id: string; name: string; personality: string; is_active: boolean | null }[]>([]);
  const [loadingAgents, setLoadingAgents] = useState(false);

  // Fetch company ID
  useEffect(() => {
    const fetchCompanyId = async () => {
      if (!user?.id) return;
      
      const { data } = await supabase
        .from('company_users')
        .select('company_id')
        .eq('user_id', user.id)
        .single();
      
      if (data) {
        setCompanyId(data.company_id);
      }
    };
    
    fetchCompanyId();
  }, [user?.id]);

  // Load WhatsApp sessions when needed
  useEffect(() => {
    if (node?.subType === 'whatsapp_channel' && companyId) {
      loadWhatsAppSessions();
    }
    if (node?.subType === 'transfer_ai_agent' && companyId) {
      loadAiAgents();
    }
  }, [node?.subType, companyId]);

  const loadWhatsAppSessions = async () => {
    if (!companyId) return;
    
    setLoadingSessions(true);
    try {
      // Load Baileys sessions
      const { data: baileysSessions } = await supabase
        .from('whatsapp_sessions')
        .select('id, instance_name, phone_number, status, profile_picture')
        .eq('company_id', companyId)
        .eq('status', 'connected');
      
      // Load YCloud sessions (CRM Ello)
      const { data: ycloudSessions } = await supabase
        .from('ycloud_sessions')
        .select('id, phone_number, status, waba_id')
        .eq('company_id', companyId)
        .eq('status', 'active');
      
      const allSessions = [
        ...(baileysSessions || []),
        ...(ycloudSessions || []).map(s => ({
          id: s.id,
          instance_name: 'CRM Ello',
          phone_number: s.phone_number,
          status: 'connected',
          profile_picture: null,
        }))
      ];
      
      setWhatsappSessions(allSessions);
    } catch (error) {
      console.error('Erro ao carregar sessões WhatsApp:', error);
    } finally {
      setLoadingSessions(false);
    }
  };

  const loadAiAgents = async () => {
    if (!companyId) return;
    setLoadingAgents(true);
    try {
      const { data, error } = await supabase
        .from('ai_agents')
        .select('id, name, personality, is_active')
        .eq('company_id', companyId)
        .order('name');
      if (!error) setAiAgents(data || []);
    } catch (error) {
      console.error('Erro ao carregar agentes:', error);
    } finally {
      setLoadingAgents(false);
    }
  };

  if (!node) return null;

  const updateConfig = (key: string, value: any) => {
    onUpdate(node.id, {
      data: {
        ...node.data,
        config: {
          ...node.data.config,
          [key]: value
        }
      }
    });
  };

  const updateMultipleConfig = (updates: Record<string, any>) => {
    onUpdate(node.id, {
      data: {
        ...node.data,
        config: {
          ...node.data.config,
          ...updates
        }
      }
    });
  };

  const updateLabel = (label: string) => {
    onUpdate(node.id, {
      data: {
        ...node.data,
        label
      }
    });
  };

  const handleKnowledgeUpload = async (files: FileList | null) => {
    if (!files || files.length === 0 || !user?.id || !node) return;
    setUploadingKnowledge(true);
    try {
      const current = Array.isArray(node.data.config?.knowledgeFiles)
        ? node.data.config.knowledgeFiles
        : [];
      const uploaded: any[] = [];
      for (const file of Array.from(files)) {
        const safe = file.name.replace(/[^\w.\-]+/g, '_');
        const path = `chatbot-ai-knowledge/${user.id}/${Date.now()}-${safe}`;
        const { error: upErr } = await supabase.storage
          .from('workflow-attachments')
          .upload(path, file, { cacheControl: '3600', upsert: false });
        if (upErr) throw upErr;
        const { data: pub } = supabase.storage
          .from('workflow-attachments')
          .getPublicUrl(path);
        uploaded.push({
          name: file.name,
          url: pub.publicUrl,
          path,
          size: file.size,
          type: file.type,
        });
      }
      updateConfig('knowledgeFiles', [...current, ...uploaded]);
      toast({ title: `${uploaded.length} arquivo(s) anexado(s) à IA` });
    } catch (e: any) {
      toast({ title: 'Erro ao enviar arquivo', description: e?.message, variant: 'destructive' });
    } finally {
      setUploadingKnowledge(false);
    }
  };

  const removeKnowledgeFile = (idx: number) => {
    if (!node) return;
    const current = Array.isArray(node.data.config?.knowledgeFiles)
      ? [...node.data.config.knowledgeFiles]
      : [];
    current.splice(idx, 1);
    updateConfig('knowledgeFiles', current);
  };

  const renderTriggerFields = () => {
    switch (node.subType) {
      case 'whatsapp_channel':
        {
          const cfg = node.data.config || {};
          const missing: string[] = [];
          if (!cfg.sessionId) missing.push('Canal WhatsApp');
          if (cfg.triggerWhen === 'reopened' && !cfg.inactivityHours) missing.push('Tempo de inatividade');
          const selectedSession = whatsappSessions.find((s) => s.id === cfg.sessionId);
          return (
          <div className="space-y-4">
            {missing.length > 0 ? (
              <div className="flex items-start gap-2 p-3 rounded-lg border border-amber-200 bg-amber-50 text-amber-800 text-xs">
                <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                <div>
                  <p className="font-medium">Configuração incompleta</p>
                  <p className="opacity-80">Pendente: {missing.join(', ')}. O fluxo só inicia conversas após preencher esses campos.</p>
                </div>
              </div>
            ) : (
              <div className="flex items-start gap-2 p-3 rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-800 text-xs">
                <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" />
                <div>
                  <p className="font-medium">Gatilho pronto</p>
                  <p className="opacity-80">
                    Iniciará no canal <b>{selectedSession?.phone_number || 'selecionado'}</b>
                    {cfg.triggerWhen === 'new_conversation' ? ' apenas em novas conversas' :
                      cfg.triggerWhen === 'reopened' ? ` em conversas reabertas após ${cfg.inactivityHours || 24}h` :
                      ' em qualquer mensagem recebida'}.
                  </p>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Phone className="h-4 w-4" />
                Canal WhatsApp Conectado
                <span className="text-destructive">*</span>
              </Label>
              {loadingSessions ? (
                <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-sm text-muted-foreground">Carregando sessões...</span>
                </div>
              ) : whatsappSessions.length === 0 ? (
                <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                  <AlertCircle className="h-4 w-4 text-amber-600" />
                  <span className="text-sm text-amber-700">Nenhum WhatsApp conectado. Conecte no CRM primeiro.</span>
                </div>
              ) : (
                <Select 
                  value={node.data.config?.sessionId || ''} 
                  onValueChange={(v) => {
                    const session = whatsappSessions.find(s => s.id === v);
                    updateMultipleConfig({
                      sessionId: v,
                      phoneNumber: session?.phone_number || '',
                      sessionName: session?.instance_name || ''
                    });
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o número" />
                  </SelectTrigger>
                  <SelectContent>
                    {whatsappSessions.map((session) => (
                      <SelectItem key={session.id} value={session.id}>
                        <div className="flex items-center gap-2 py-1">
                          <Avatar className="h-6 w-6">
                            <AvatarImage src={session.profile_picture || undefined} />
                            <AvatarFallback className="text-xs">
                              {session.phone_number?.slice(-2) || 'WA'}
                            </AvatarFallback>
                          </Avatar>
                          <div className="text-left">
                            <span className="font-medium">{session.phone_number || 'Sem número'}</span>
                            <span className="text-muted-foreground ml-2 text-xs">({session.instance_name})</span>
                          </div>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            <div className="space-y-2">
              <Label>Quando Iniciar o Fluxo?</Label>
              <Select 
                value={node.data.config?.triggerWhen || 'any_message'} 
                onValueChange={(v) => updateConfig('triggerWhen', v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="any_message">Qualquer mensagem recebida</SelectItem>
                  <SelectItem value="new_conversation">Nova conversa (primeiro contato)</SelectItem>
                  <SelectItem value="reopened">Conversa reaberta (após inatividade)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Define em quais situações o bot será acionado
              </p>
            </div>

            {node.data.config?.triggerWhen === 'reopened' && (
              <div className="space-y-2">
                <Label>Tempo de Inatividade (horas)</Label>
                <Input
                  type="number"
                  value={node.data.config?.inactivityHours || 24}
                  onChange={(e) => updateConfig('inactivityHours', parseInt(e.target.value))}
                  min={1}
                />
                <p className="text-xs text-muted-foreground">
                  Após quantas horas sem mensagem considera como "reaberta"
                </p>
              </div>
            )}

            <div className="border-t pt-4 space-y-4">
              <p className="text-xs uppercase tracking-wide font-semibold text-muted-foreground">Roteamento &amp; Integrações</p>

              <div className="space-y-2">
                <Label>Etiqueta interna (opcional)</Label>
                <Input
                  value={cfg.internalLabel || ''}
                  onChange={(e) => updateConfig('internalLabel', e.target.value.slice(0, 60))}
                  placeholder="Ex: Atendimento Comercial"
                  maxLength={60}
                />
                <p className="text-xs text-muted-foreground">Usado para identificar este gatilho nos relatórios.</p>
              </div>

              <div className="space-y-2">
                <Label>Origem esperada</Label>
                <Select
                  value={cfg.expectedOrigin || 'any'}
                  onValueChange={(v) => updateConfig('expectedOrigin', v)}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="any">Qualquer origem</SelectItem>
                    <SelectItem value="direct">Conversa direta (1:1)</SelectItem>
                    <SelectItem value="campaign">Vindo de campanha/disparo</SelectItem>
                    <SelectItem value="api">Vindo de integração externa</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Departamento / fila de destino</Label>
                <Input
                  value={cfg.destinationQueue || ''}
                  onChange={(e) => updateConfig('destinationQueue', e.target.value.slice(0, 60))}
                  placeholder="Ex: vendas, suporte, financeiro"
                />
                <p className="text-xs text-muted-foreground">
                  Quando o fluxo encaminhar para humano, a conversa é marcada com essa fila.
                </p>
              </div>

              <div className="space-y-2">
                <Label>Variáveis iniciais (JSON)</Label>
                <Textarea
                  value={typeof cfg.initialVariables === 'string'
                    ? cfg.initialVariables
                    : JSON.stringify(cfg.initialVariables || {}, null, 2)}
                  onChange={(e) => {
                    try { updateConfig('initialVariables', JSON.parse(e.target.value || '{}')); }
                    catch { updateConfig('initialVariables', e.target.value); }
                  }}
                  placeholder='{"origem":"site","prioridade":"alta"}'
                  rows={3}
                  className="font-mono text-xs"
                />
                <p className="text-xs text-muted-foreground">
                  Esses valores entram em <code>{'{{variavel}}'}</code> assim que a conversa inicia.
                </p>
              </div>

              <div className="flex items-center justify-between rounded-md border p-3">
                <div className="space-y-0.5 pr-3">
                  <Label className="text-sm">Ignorar grupos</Label>
                  <p className="text-xs text-muted-foreground">Não disparar este fluxo em grupos de WhatsApp.</p>
                </div>
                <Switch
                  checked={cfg.ignoreGroups !== false}
                  onCheckedChange={(v) => updateConfig('ignoreGroups', v)}
                />
              </div>

              <div className="flex items-center justify-between rounded-md border p-3">
                <div className="space-y-0.5 pr-3">
                  <Label className="text-sm">Pausar quando humano responder</Label>
                  <p className="text-xs text-muted-foreground">Encerra o bot automaticamente se um atendente enviar mensagem.</p>
                </div>
                <Switch
                  checked={cfg.pauseOnHumanReply !== false}
                  onCheckedChange={(v) => updateConfig('pauseOnHumanReply', v)}
                />
              </div>
            </div>
          </div>
          );
        }

      case 'email_channel':
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Conta de Email</Label>
              <Input
                value={node.data.config?.email || ''}
                onChange={(e) => updateConfig('email', e.target.value)}
                placeholder="seu@email.com"
              />
              <p className="text-xs text-muted-foreground">
                Email que receberá as mensagens para acionar o bot
              </p>
            </div>
            <div className="space-y-2">
              <Label>Filtro de Assunto (opcional)</Label>
              <Input
                value={node.data.config?.subjectFilter || ''}
                onChange={(e) => updateConfig('subjectFilter', e.target.value)}
                placeholder="Ex: [Suporte]"
              />
            </div>
            <div className="space-y-2">
              <Label>Filtro de Remetente (opcional)</Label>
              <Input
                value={node.data.config?.senderFilter || ''}
                onChange={(e) => updateConfig('senderFilter', e.target.value)}
                placeholder="Ex: @empresa.com"
              />
            </div>
          </div>
        );

      case 'keyword':
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Palavras-chave (uma por linha)</Label>
              <Textarea
                value={(node.data.config?.keywords || []).join('\n')}
                onChange={(e) => updateConfig('keywords', e.target.value.split('\n').filter(Boolean))}
                placeholder="oi&#10;olá&#10;bom dia&#10;preço&#10;orçamento"
                rows={5}
              />
              <p className="text-xs text-muted-foreground">
                O fluxo será iniciado quando o usuário enviar uma mensagem contendo qualquer dessas palavras
              </p>
            </div>
            <div className="space-y-2">
              <Label>Modo de Correspondência</Label>
              <Select 
                value={node.data.config?.matchMode || 'contains'} 
                onValueChange={(v) => updateConfig('matchMode', v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="contains">Contém a palavra</SelectItem>
                  <SelectItem value="exact">Palavra exata</SelectItem>
                  <SelectItem value="starts_with">Começa com</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        );

      case 'conversation_start':
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Tipo de Início</Label>
              <Select 
                value={node.data.config?.startType || 'first_contact'} 
                onValueChange={(v) => updateConfig('startType', v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="first_contact">Primeiro contato (lead novo)</SelectItem>
                  <SelectItem value="any_start">Qualquer início de conversa</SelectItem>
                  <SelectItem value="reopened_after">Reaberta após X dias</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {node.data.config?.startType === 'reopened_after' && (
              <div className="space-y-2">
                <Label>Dias sem contato</Label>
                <Input
                  type="number"
                  value={node.data.config?.daysInactive || 7}
                  onChange={(e) => updateConfig('daysInactive', parseInt(e.target.value))}
                  min={1}
                />
              </div>
            )}
            <div className="space-y-2">
              <Label>Canal</Label>
              <Select 
                value={node.data.config?.channel || 'all'} 
                onValueChange={(v) => updateConfig('channel', v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os canais</SelectItem>
                  <SelectItem value="whatsapp">Apenas WhatsApp</SelectItem>
                  <SelectItem value="email">Apenas Email</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        );

      case 'inactivity':
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Tempo de inatividade (minutos)</Label>
              <Input
                type="number"
                value={node.data.config?.minutes || 5}
                onChange={(e) => updateConfig('minutes', parseInt(e.target.value))}
                min={1}
              />
              <p className="text-xs text-muted-foreground">
                Após quanto tempo sem resposta do usuário o fluxo será acionado
              </p>
            </div>
            <div className="space-y-2">
              <Label>Máximo de tentativas</Label>
              <Input
                type="number"
                value={node.data.config?.maxAttempts || 3}
                onChange={(e) => updateConfig('maxAttempts', parseInt(e.target.value))}
                min={1}
                max={10}
              />
            </div>
          </div>
        );

      case 'webhook':
        {
          const supaUrl = (import.meta as any).env?.VITE_SUPABASE_URL || '';
          const incomingUrl = flowId && supaUrl
            ? `${supaUrl}/functions/v1/chatbot-incoming?flow_id=${flowId}`
            : '';
          const secret = node.data.config?.secret || '';
          const sample = JSON.stringify({
            phone: '5511999999999',
            name: 'João',
            variables: { pedido_id: '12345' },
          }, null, 2);
          const copy = async (v: string) => {
            try { await navigator.clipboard.writeText(v); toast({ title: 'Copiado' }); } catch {}
          };
          return (
            <div className="space-y-4">
              <div className="rounded-lg border bg-muted/30 p-3 space-y-2 text-xs">
                <p className="font-medium text-sm">Como integrar</p>
                <p className="text-muted-foreground">
                  Qualquer sistema (CRM, ERP, Zapier, Make, sua API) pode iniciar este fluxo enviando um <b>POST</b> para a URL abaixo. Os campos do JSON viram variáveis do fluxo (use <code>{'{{phone}}'}</code>, <code>{'{{name}}'}</code> etc.).
                </p>
              </div>

              <div className="space-y-2">
                <Label>URL para receber chamadas (gerada automaticamente)</Label>
                <div className="flex gap-2">
                  <Input readOnly value={incomingUrl || 'Salve o fluxo primeiro para gerar a URL'} className="font-mono text-xs" />
                  <Button type="button" size="sm" variant="outline" disabled={!incomingUrl} onClick={() => copy(incomingUrl)}>Copiar</Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Segredo (header <code>x-webhook-secret</code>)</Label>
                <div className="flex gap-2">
                  <Input
                    value={secret}
                    onChange={(e) => updateConfig('secret', e.target.value)}
                    placeholder="opcional — qualquer string"
                  />
                  <Button type="button" size="sm" variant="outline" onClick={() => updateConfig('secret', crypto.randomUUID())}>Gerar</Button>
                </div>
                <p className="text-xs text-muted-foreground">Se preenchido, requisições sem esse header serão recusadas.</p>
              </div>

              <div className="space-y-2">
                <Label>Campos esperados (documentação)</Label>
                <Input
                  value={(node.data.config?.expectedFields || []).join(', ')}
                  onChange={(e) => updateConfig('expectedFields', e.target.value.split(',').map((s) => s.trim()).filter(Boolean))}
                  placeholder="phone, name, pedido_id"
                />
              </div>

              <div className="space-y-2">
                <Label>Payload de exemplo</Label>
                <Textarea readOnly value={sample} rows={6} className="font-mono text-xs" />
                <Button type="button" size="sm" variant="outline" onClick={() => copy(sample)}>Copiar exemplo</Button>
              </div>
            </div>
          );
        }

      case 'webhook_legacy':
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>URL do Webhook</Label>
              <Input
                value={node.data.config?.url || ''}
                onChange={(e) => updateConfig('url', e.target.value)}
                placeholder="https://sua-api.com/webhook"
              />
              <p className="text-xs text-muted-foreground">
                URL que receberá requisições POST para iniciar o fluxo
              </p>
            </div>
            <div className="space-y-2">
              <Label>Token de Autenticação (opcional)</Label>
              <Input
                value={node.data.config?.authToken || ''}
                onChange={(e) => updateConfig('authToken', e.target.value)}
                placeholder="Bearer token..."
                type="password"
              />
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  const renderConditionFields = () => {
    switch (node.subType) {
      case 'if_else':
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Tipo de Condição</Label>
              <Select 
                value={node.data.config?.conditionType || 'user_response'} 
                onValueChange={(v) => updateConfig('conditionType', v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="user_response">Resposta do Usuário</SelectItem>
                  <SelectItem value="variable">Valor de Variável</SelectItem>
                  <SelectItem value="time">Horário Atual</SelectItem>
                  <SelectItem value="tag">Tag do Contato</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {node.data.config?.conditionType === 'user_response' && (
              <>
                <div className="space-y-2">
                  <Label>A resposta do usuário</Label>
                  <Select 
                    value={node.data.config?.operator || 'contains'} 
                    onValueChange={(v) => updateConfig('operator', v)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="contains">Contém</SelectItem>
                      <SelectItem value="equals">É igual a</SelectItem>
                      <SelectItem value="starts_with">Começa com</SelectItem>
                      <SelectItem value="ends_with">Termina com</SelectItem>
                      <SelectItem value="is_number">É um número</SelectItem>
                      <SelectItem value="is_email">É um email</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {!['is_number', 'is_email'].includes(node.data.config?.operator || '') && (
                  <div className="space-y-2">
                    <Label>Valor</Label>
                    <Input
                      value={node.data.config?.value || ''}
                      onChange={(e) => updateConfig('value', e.target.value)}
                      placeholder="Ex: sim, confirmar, 1..."
                    />
                  </div>
                )}
              </>
            )}

            {node.data.config?.conditionType === 'variable' && (
              <>
                <div className="space-y-2">
                  <Label>Nome da Variável</Label>
                  <Input
                    value={node.data.config?.variable || ''}
                    onChange={(e) => updateConfig('variable', e.target.value)}
                    placeholder="nome_variavel"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Operador</Label>
                  <Select 
                    value={node.data.config?.operator || '=='} 
                    onValueChange={(v) => updateConfig('operator', v)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="==">Igual a</SelectItem>
                      <SelectItem value="!=">Diferente de</SelectItem>
                      <SelectItem value=">">Maior que</SelectItem>
                      <SelectItem value="<">Menor que</SelectItem>
                      <SelectItem value="contains">Contém</SelectItem>
                      <SelectItem value="empty">Está vazio</SelectItem>
                      <SelectItem value="not_empty">Não está vazio</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {!['empty', 'not_empty'].includes(node.data.config?.operator || '') && (
                  <div className="space-y-2">
                    <Label>Valor</Label>
                    <Input
                      value={node.data.config?.value || ''}
                      onChange={(e) => updateConfig('value', e.target.value)}
                      placeholder="valor"
                    />
                  </div>
                )}
              </>
            )}

            {node.data.config?.conditionType === 'time' && (
              <>
                <div className="space-y-2">
                  <Label>Verificar se está entre</Label>
                  <div className="flex gap-2 items-center">
                    <Input
                      type="number"
                      value={node.data.config?.startHour || 9}
                      onChange={(e) => updateConfig('startHour', parseInt(e.target.value))}
                      min={0}
                      max={23}
                      className="w-20"
                    />
                    <span className="text-muted-foreground">h e</span>
                    <Input
                      type="number"
                      value={node.data.config?.endHour || 18}
                      onChange={(e) => updateConfig('endHour', parseInt(e.target.value))}
                      min={0}
                      max={23}
                      className="w-20"
                    />
                    <span className="text-muted-foreground">h</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    "Sim" se dentro do horário, "Não" se fora
                  </p>
                </div>
              </>
            )}

            {node.data.config?.conditionType === 'tag' && (
              <div className="space-y-2">
                <Label>Tag do Contato</Label>
                <Input
                  value={node.data.config?.tag || ''}
                  onChange={(e) => updateConfig('tag', e.target.value)}
                  placeholder="nome_da_tag"
                />
                <p className="text-xs text-muted-foreground">
                  "Sim" se o contato tiver a tag, "Não" se não tiver
                </p>
              </div>
            )}

            <div className="mt-4 p-3 bg-muted rounded-lg">
              <p className="text-xs text-muted-foreground">
                <strong>Saídas:</strong><br />
                • <span className="text-green-600">Sim (✓)</span>: Condição verdadeira<br />
                • <span className="text-red-600">Não (✗)</span>: Condição falsa
              </p>
            </div>
          </div>
        );

      case 'check_variable':
        return (
          <>
            <div className="space-y-2">
              <Label>Nome da Variável</Label>
              <Input
                value={node.data.config?.variable || ''}
                onChange={(e) => updateConfig('variable', e.target.value)}
                placeholder="nome_variavel"
              />
            </div>
            <div className="space-y-2">
              <Label>Operador</Label>
              <Select 
                value={node.data.config?.operator || '=='} 
                onValueChange={(v) => updateConfig('operator', v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="==">Igual a</SelectItem>
                  <SelectItem value="!=">Diferente de</SelectItem>
                  <SelectItem value=">">Maior que</SelectItem>
                  <SelectItem value="<">Menor que</SelectItem>
                  <SelectItem value="contains">Contém</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Valor</Label>
              <Input
                value={node.data.config?.value || ''}
                onChange={(e) => updateConfig('value', e.target.value)}
                placeholder="valor"
              />
            </div>
          </>
        );

      case 'check_time':
        return (
          <>
            <div className="space-y-2">
              <Label>Horário Inicial</Label>
              <Input
                type="number"
                value={node.data.config?.startHour || 9}
                onChange={(e) => updateConfig('startHour', parseInt(e.target.value))}
                min={0}
                max={23}
              />
            </div>
            <div className="space-y-2">
              <Label>Horário Final</Label>
              <Input
                type="number"
                value={node.data.config?.endHour || 18}
                onChange={(e) => updateConfig('endHour', parseInt(e.target.value))}
                min={0}
                max={23}
              />
            </div>
          </>
        );

      case 'check_tag':
        return (
          <div className="space-y-2">
            <Label>Tag do Contato</Label>
            <Input
              value={node.data.config?.tag || ''}
              onChange={(e) => updateConfig('tag', e.target.value)}
              placeholder="nome_da_tag"
            />
          </div>
        );

      case 'multi':
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Condições Múltiplas</Label>
              <p className="text-xs text-muted-foreground">
                Cada condição gera uma saída separada. Se nenhuma for verdadeira, segue pela saída "Senão".
              </p>
            </div>
            
            {(node.data.config?.conditions || []).map((cond: any, index: number) => (
              <div key={cond.id} className="p-3 border rounded-lg space-y-2 bg-muted/30">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold">Condição {index + 1}</Label>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0"
                    onClick={() => {
                      const conditions = [...(node.data.config?.conditions || [])];
                      conditions.splice(index, 1);
                      updateConfig('conditions', conditions);
                    }}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
                <Input
                  value={cond.label || ''}
                  onChange={(e) => {
                    const conditions = [...(node.data.config?.conditions || [])];
                    conditions[index] = { ...conditions[index], label: e.target.value };
                    updateConfig('conditions', conditions);
                  }}
                  placeholder="Nome da condição"
                  className="h-8 text-sm"
                />
                <Select
                  value={cond.operator || 'contains'}
                  onValueChange={(v) => {
                    const conditions = [...(node.data.config?.conditions || [])];
                    conditions[index] = { ...conditions[index], operator: v };
                    updateConfig('conditions', conditions);
                  }}
                >
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="contains">Contém</SelectItem>
                    <SelectItem value="equals">É igual a</SelectItem>
                    <SelectItem value="starts_with">Começa com</SelectItem>
                    <SelectItem value="is_number">É um número</SelectItem>
                  </SelectContent>
                </Select>
                {!['is_number', 'is_email'].includes(cond.operator || '') && (
                  <Input
                    value={cond.value || ''}
                    onChange={(e) => {
                      const conditions = [...(node.data.config?.conditions || [])];
                      conditions[index] = { ...conditions[index], value: e.target.value };
                      updateConfig('conditions', conditions);
                    }}
                    placeholder="Valor"
                    className="h-8 text-sm"
                  />
                )}
              </div>
            ))}

            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={() => {
                const conditions = [...(node.data.config?.conditions || [])];
                conditions.push({
                  id: `cond_${Date.now()}`,
                  label: `Condição ${conditions.length + 1}`,
                  operator: 'contains',
                  value: ''
                });
                updateConfig('conditions', conditions);
              }}
            >
              + Adicionar Condição
            </Button>

            <div className="mt-2 p-3 bg-muted rounded-lg">
              <p className="text-xs text-muted-foreground">
                <strong>Saídas:</strong><br />
                {(node.data.config?.conditions || []).map((c: any, i: number) => (
                  <span key={c.id}>• <span className="font-medium">{c.label || `Condição ${i + 1}`}</span><br /></span>
                ))}
                • <span className="text-gray-500">Senão (nenhuma condição)</span>
              </p>
            </div>
          </div>
        );

      case 'weekday':
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Dias da Semana</Label>
              <p className="text-xs text-muted-foreground">
                Selecione os dias em que o fluxo seguirá pela saída "Sim"
              </p>
              <div className="grid grid-cols-2 gap-2">
                {['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'].map((day, i) => (
                  <label key={day} className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={(node.data.config?.days || []).includes(i)}
                      onChange={(e) => {
                        const days = [...(node.data.config?.days || [])];
                        if (e.target.checked) {
                          days.push(i);
                        } else {
                          const idx = days.indexOf(i);
                          if (idx >= 0) days.splice(idx, 1);
                        }
                        updateConfig('days', days);
                      }}
                      className="rounded"
                    />
                    {day}
                  </label>
                ))}
              </div>
            </div>
          </div>
        );

      case 'time':
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Intervalo de Horário</Label>
              <div className="flex gap-2 items-center">
                <Input
                  type="number"
                  value={node.data.config?.startHour || 9}
                  onChange={(e) => updateConfig('startHour', parseInt(e.target.value))}
                  min={0} max={23} className="w-20"
                />
                <span className="text-muted-foreground">h até</span>
                <Input
                  type="number"
                  value={node.data.config?.endHour || 18}
                  onChange={(e) => updateConfig('endHour', parseInt(e.target.value))}
                  min={0} max={23} className="w-20"
                />
                <span className="text-muted-foreground">h</span>
              </div>
              <p className="text-xs text-muted-foreground">
                "Sim" se dentro do horário, "Não" se fora
              </p>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  const renderMessageFields = () => {
    return (
      <>
        <div className="space-y-2">
          <Label>Conteúdo da Mensagem</Label>
          <Textarea
            value={node.data.config?.content || ''}
            onChange={(e) => updateConfig('content', e.target.value)}
            placeholder="Digite a mensagem que será enviada..."
            rows={4}
          />
          <p className="text-xs text-muted-foreground">
            Use {"{{nome}}"}, {"{{telefone}}"}, {"{{email}}"} para variáveis dinâmicas
          </p>
        </div>
        
        {node.subType === 'buttons' && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Botões de Resposta (API Oficial)</Label>
              <span className="text-xs text-muted-foreground">{(node.data.config?.buttons || []).length}/3</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {(node.data.config?.buttons || []).map((btn: any, idx: number) => (
                <span
                  key={idx}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-medium"
                >
                  {typeof btn === 'string' ? btn : (btn?.label ?? btn?.title ?? '')}
                  <button
                    type="button"
                    onClick={() => {
                      const updated = [...(node.data.config?.buttons || [])];
                      updated.splice(idx, 1);
                      updateConfig('buttons', updated);
                    }}
                    className="ml-0.5 hover:text-destructive"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
            {(node.data.config?.buttons || []).length < 3 && (
              <div className="flex gap-2">
                <Input
                  placeholder="Nome da opção (máx 20 chars)"
                  maxLength={20}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      const val = (e.target as HTMLInputElement).value.trim();
                      if (val) {
                        updateConfig('buttons', [...(node.data.config?.buttons || []), val]);
                        (e.target as HTMLInputElement).value = '';
                      }
                    }
                  }}
                />
                <Button
                  type="button"
                  size="icon"
                  variant="outline"
                  onClick={() => {
                    const input = document.querySelector<HTMLInputElement>('[placeholder="Nome da opção (máx 20 chars)"]');
                    const val = input?.value.trim();
                    if (val && input) {
                      updateConfig('buttons', [...(node.data.config?.buttons || []), val]);
                      input.value = '';
                    }
                  }}
                >
                  +
                </Button>
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              Botões interativos WhatsApp (API Oficial). O contato clica no botão para responder. Máx 3 botões, 20 chars cada.
            </p>
          </div>
        )}
        
        {node.subType === 'list' && (
          <div className="space-y-3">
            <Label>Texto do Botão do Menu</Label>
            <Input
              value={node.data.config?.button_text || 'Ver opções'}
              onChange={(e) => updateConfig('button_text', e.target.value)}
              placeholder="Ver opções"
              maxLength={20}
            />
            <Label>Opções da Lista (um por linha)</Label>
            <Textarea
              value={(() => {
                const sections = node.data.config?.sections;
                if (sections && Array.isArray(sections)) {
                  return sections.flatMap((s: any) => s.rows?.map((r: any) => r.title) || []).join('\n');
                }
                return (node.data.config?.items || []).join('\n');
              })()}
              onChange={(e) => {
                const items = e.target.value.split('\n').filter(Boolean);
                updateConfig('sections', [{ title: 'Opções', rows: items.map((t: string, i: number) => ({ id: `opt_${i}`, title: t.substring(0, 24) })) }]);
                updateConfig('items', items);
              }}
              placeholder="Opção 1&#10;Opção 2&#10;Opção 3"
              rows={4}
            />
            <p className="text-xs text-muted-foreground">
              Lista interativa WhatsApp (API Oficial). Menu dropdown com até 10 opções. Máx 24 chars por opção.
            </p>
          </div>
        )}
        
        {node.subType === 'image' && (
          <div className="space-y-2">
            <Label>URL da Imagem</Label>
            <Input
              value={node.data.config?.url || ''}
              onChange={(e) => updateConfig('url', e.target.value)}
              placeholder="https://exemplo.com/imagem.jpg"
            />
            <MediaUploadButton
              accept="image/*"
              userId={user?.id}
              onUploaded={(url) => updateConfig('url', url)}
              toast={toast}
              label="Enviar imagem"
            />
            {node.data.config?.url && (
              <div className="mt-2 relative group">
                <img
                  src={node.data.config.url}
                  alt="preview"
                  className="max-h-40 w-full rounded-md border object-contain bg-muted/30"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.src = 'https://placehold.co/400x300?text=Erro+ao+carregar+imagem';
                    console.error('Erro ao carregar preview da imagem:', node.data.config.url);
                  }}
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute top-1 right-1 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity bg-background/80 hover:bg-background"
                  onClick={() => updateConfig('url', '')}
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            )}
            <Label>Legenda (opcional)</Label>
            <Input
              value={node.data.config?.caption || ''}
              onChange={(e) => updateConfig('caption', e.target.value)}
              placeholder="Descrição da imagem"
            />
          </div>
        )}

        {node.subType === 'audio' && (
          <div className="space-y-2">
            <Label>URL do Áudio</Label>
            <Input
              value={node.data.config?.url || ''}
              onChange={(e) => updateConfig('url', e.target.value)}
              placeholder="https://exemplo.com/audio.mp3"
            />
            <MediaUploadButton
              accept="audio/*"
              userId={user?.id}
              onUploaded={(url) => updateConfig('url', url)}
              toast={toast}
              label="Enviar áudio"
            />
            {node.data.config?.url && (
              <div className="mt-2 relative group">
                <audio src={node.data.config.url} controls className="w-full" />
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute -top-1 -right-1 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity bg-background/80 hover:bg-background z-10"
                  onClick={() => updateConfig('url', '')}
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            )}
            <div className="flex items-center justify-between p-2 rounded-md border">
              <Label className="text-xs">Enviar como mensagem de voz (PTT)</Label>
              <input
                type="checkbox"
                className="h-4 w-4"
                checked={node.data.config?.ptt !== false}
                onChange={(e) => updateConfig('ptt', e.target.checked)}
              />
            </div>
          </div>
        )}

        {node.subType === 'video' && (
          <div className="space-y-2">
            <Label>URL do Vídeo</Label>
            <Input
              value={node.data.config?.url || ''}
              onChange={(e) => updateConfig('url', e.target.value)}
              placeholder="https://exemplo.com/video.mp4"
            />
            <MediaUploadButton
              accept="video/*"
              userId={user?.id}
              onUploaded={(url) => updateConfig('url', url)}
              toast={toast}
              label="Enviar vídeo"
            />
            {node.data.config?.url && (
              <div className="mt-2 relative group">
                <video src={node.data.config.url} controls className="w-full max-h-48 rounded-md border bg-muted/30" />
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute top-1 right-1 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity bg-background/80 hover:bg-background z-10"
                  onClick={() => updateConfig('url', '')}
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            )}
            <Label>Legenda (opcional)</Label>
            <Input
              value={node.data.config?.caption || ''}
              onChange={(e) => updateConfig('caption', e.target.value)}
              placeholder="Descrição do vídeo"
            />
          </div>
        )}

        {node.subType === 'file' && (
          <div className="space-y-2">
            <Label>URL do Arquivo</Label>
            <Input
              value={node.data.config?.url || ''}
              onChange={(e) => updateConfig('url', e.target.value)}
              placeholder="https://exemplo.com/documento.pdf"
            />
            <MediaUploadButton
              accept="*"
              userId={user?.id}
              onUploaded={(url, name) => {
                updateConfig('url', url);
                if (name && !node.data.config?.filename) updateConfig('filename', name);
              }}
              toast={toast}
              label="Enviar arquivo"
            />
            <Label>Nome do Arquivo</Label>
            <Input
              value={node.data.config?.filename || ''}
              onChange={(e) => updateConfig('filename', e.target.value)}
              placeholder="documento.pdf"
            />
          </div>
        )}
      </>
    );
  };

  const renderActionFields = () => {
    switch (node.subType) {
      case 'assign_tag':
        return (
          <div className="space-y-2">
            <Label>Tag a Atribuir</Label>
            <Input
              value={node.data.config?.tag || ''}
              onChange={(e) => updateConfig('tag', e.target.value)}
              placeholder="lead_quente"
            />
            <p className="text-xs text-muted-foreground">
              Esta tag será adicionada ao contato
            </p>
          </div>
        );

      case 'transfer_human':
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Departamento/Atendente</Label>
              <Input
                value={node.data.config?.departmentName || ''}
                onChange={(e) => updateConfig('departmentName', e.target.value)}
                placeholder="Suporte, Vendas..."
              />
            </div>
            <div className="space-y-2">
              <Label>Mensagem ao Transferir (opcional)</Label>
              <Textarea
                value={node.data.config?.transferMessage || ''}
                onChange={(e) => updateConfig('transferMessage', e.target.value)}
                placeholder="Aguarde, você será atendido por um humano..."
                rows={2}
              />
            </div>
          </div>
        );

      case 'save_crm':
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nome do Lead (variável)</Label>
              <Input
                value={node.data.config?.nameField || '{{nome}}'}
                onChange={(e) => updateConfig('nameField', e.target.value)}
                placeholder="{{nome}}"
              />
            </div>
            <div className="space-y-2">
              <Label>Email (variável)</Label>
              <Input
                value={node.data.config?.emailField || '{{email}}'}
                onChange={(e) => updateConfig('emailField', e.target.value)}
                placeholder="{{email}}"
              />
            </div>
            <div className="space-y-2">
              <Label>Tags Iniciais</Label>
              <Input
                value={node.data.config?.initialTags || ''}
                onChange={(e) => updateConfig('initialTags', e.target.value)}
                placeholder="lead, chatbot..."
              />
            </div>
          </div>
        );

      case 'send_email':
        return (
          <>
            <div className="space-y-2">
              <Label>Destinatário</Label>
              <Input
                value={node.data.config?.to || ''}
                onChange={(e) => updateConfig('to', e.target.value)}
                placeholder="email@exemplo.com ou {{email}}"
              />
            </div>
            <div className="space-y-2">
              <Label>Assunto</Label>
              <Input
                value={node.data.config?.subject || ''}
                onChange={(e) => updateConfig('subject', e.target.value)}
                placeholder="Assunto do email"
              />
            </div>
            <div className="space-y-2">
              <Label>Corpo do Email</Label>
              <Textarea
                value={node.data.config?.body || ''}
                onChange={(e) => updateConfig('body', e.target.value)}
                placeholder="Conteúdo do email..."
                rows={4}
              />
            </div>
          </>
        );

      case 'call_api':
        return (
          <>
            <div className="rounded-lg border bg-muted/30 p-3 text-xs text-muted-foreground">
              Faça consultas/ações em qualquer sistema externo (CRM, ERP, Zapier, Make, API própria). A resposta JSON é salva em uma variável e pode ser usada nos blocos seguintes com <code>{'{{nome_da_variavel.campo}}'}</code>.
            </div>
            <div className="space-y-2">
              <Label>URL da API</Label>
              <Input
                value={node.data.config?.url || ''}
                onChange={(e) => updateConfig('url', e.target.value)}
                placeholder="https://api.exemplo.com/endpoint"
              />
              <p className="text-xs text-muted-foreground">Pode usar variáveis: <code>https://api.x.com/clientes/{'{{telefone}}'}</code></p>
            </div>
            <div className="space-y-2">
              <Label>Método HTTP</Label>
              <Select 
                value={node.data.config?.method || 'POST'} 
                onValueChange={(v) => updateConfig('method', v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="GET">GET</SelectItem>
                  <SelectItem value="POST">POST</SelectItem>
                  <SelectItem value="PUT">PUT</SelectItem>
                  <SelectItem value="PATCH">PATCH</SelectItem>
                  <SelectItem value="DELETE">DELETE</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Headers (JSON)</Label>
              <Textarea
                value={typeof node.data.config?.headers === 'string' ? node.data.config.headers : JSON.stringify(node.data.config?.headers || {}, null, 2)}
                onChange={(e) => updateConfig('headers', e.target.value)}
                placeholder='{"Authorization": "Bearer token"}'
                rows={3}
                className="font-mono text-xs"
              />
            </div>
            <div className="space-y-2">
              <Label>Body (JSON)</Label>
              <Textarea
                value={typeof node.data.config?.bodyJson === 'string' ? node.data.config.bodyJson : JSON.stringify(node.data.config?.bodyJson || {}, null, 2)}
                onChange={(e) => updateConfig('bodyJson', e.target.value)}
                placeholder='{"campo": "{{valor}}"}'
                rows={4}
                className="font-mono text-xs"
              />
            </div>
            <div className="space-y-2">
              <Label>Salvar resposta como variável</Label>
              <Input
                value={node.data.config?.saveAs || 'api_response'}
                onChange={(e) => updateConfig('saveAs', e.target.value.replace(/[^\w]/g, '_'))}
                placeholder="api_response"
              />
              <p className="text-xs text-muted-foreground">Acesse com <code>{'{{api_response.algumCampo}}'}</code>.</p>
            </div>
            <div className="space-y-2">
              <Label>Mapear campos da resposta (opcional)</Label>
              <Textarea
                value={typeof node.data.config?.responseMap === 'string' ? node.data.config.responseMap : JSON.stringify(node.data.config?.responseMap || {}, null, 2)}
                onChange={(e) => {
                  try { updateConfig('responseMap', JSON.parse(e.target.value || '{}')); }
                  catch { updateConfig('responseMap', e.target.value); }
                }}
                placeholder='{"cliente_id": "data.id", "saldo": "data.balance"}'
                rows={3}
                className="font-mono text-xs"
              />
              <p className="text-xs text-muted-foreground">Cria variáveis avulsas para usar fácil nos próximos blocos.</p>
            </div>
            <div className="space-y-2">
              <Label>Timeout (ms)</Label>
              <Input
                type="number"
                min={1000}
                max={30000}
                step={500}
                value={node.data.config?.timeoutMs || 15000}
                onChange={(e) => updateConfig('timeoutMs', Math.max(1000, Math.min(30000, parseInt(e.target.value, 10) || 15000)))}
              />
            </div>
          </>
        );

      case 'set_variable':
        return (
          <>
            <div className="space-y-2">
              <Label>Nome da Variável</Label>
              <Input
                value={node.data.config?.name || ''}
                onChange={(e) => updateConfig('name', e.target.value)}
                placeholder="nome_variavel"
              />
            </div>
            <div className="space-y-2">
              <Label>Valor</Label>
              <Input
                value={node.data.config?.value || ''}
                onChange={(e) => updateConfig('value', e.target.value)}
                placeholder="valor ou {{outra_variavel}}"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Variáveis podem ser usadas em outras mensagens e condições
            </p>
          </>
        );

      case 'transfer_ai_agent':
      case 'ai_agent_inline':
        if (node.subType === 'ai_agent_inline') {
          return (
            <div className="space-y-4">
              <div className="flex items-start gap-2 p-3 rounded-lg bg-primary/5 border border-primary/20">
                <Brain className="h-4 w-4 text-primary mt-0.5" />
                <p className="text-xs text-muted-foreground">
                  Esse bloco usa IA para gerar uma resposta a partir das instruções abaixo. A mensagem do cliente vira o contexto e a resposta é enviada automaticamente.
                </p>
              </div>

              <div className="space-y-2">
                <Label>Instruções para a IA (System Prompt)</Label>
                <Textarea
                  value={node.data.config?.systemPrompt || ''}
                  onChange={(e) => updateConfig('systemPrompt', e.target.value)}
                  rows={6}
                  placeholder={`Ex: Você é o atendente da Pizzaria do João.\n- Responda sempre em português\n- Seja simpático e curto\n- Se perguntarem sobre cardápio, peça para escolher entre Calabresa, Mussarela ou Portuguesa`}
                />
                <p className="text-xs text-muted-foreground">
                  Descreva quem é a IA, como deve responder, tom de voz, limites etc.
                </p>
              </div>

              <div className="space-y-2">
                <Label>Modelo</Label>
                <Select
                  value={node.data.config?.model || 'google/gemini-2.5-flash'}
                  onValueChange={(v) => updateConfig('model', v)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="google/gemini-2.5-flash">Gemini 2.5 Flash (rápido)</SelectItem>
                    <SelectItem value="google/gemini-2.5-pro">Gemini 2.5 Pro (mais inteligente)</SelectItem>
                    <SelectItem value="openai/gpt-5-mini">GPT-5 Mini</SelectItem>
                    <SelectItem value="openai/gpt-5">GPT-5</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Salvar resposta na variável</Label>
                <Input
                  value={node.data.config?.saveAs || 'ai_response'}
                  onChange={(e) => updateConfig('saveAs', e.target.value)}
                  placeholder="ai_response"
                />
                <p className="text-xs text-muted-foreground">
                  Você pode reutilizar essa resposta depois com <code>{'{{' + (node.data.config?.saveAs || 'ai_response') + '}}'}</code>
                </p>
              </div>

              <div className="space-y-2">
                <Label>Mensagem de fallback</Label>
                <Input
                  value={node.data.config?.fallbackMessage || ''}
                  onChange={(e) => updateConfig('fallbackMessage', e.target.value)}
                  placeholder="Desculpe, não consegui processar agora."
                />
                <p className="text-xs text-muted-foreground">Enviada se a IA falhar.</p>
              </div>

              <div className="flex items-center justify-between p-3 rounded-lg border">
                <div>
                  <Label className="text-sm">Enviar resposta no chat</Label>
                  <p className="text-xs text-muted-foreground">Se desligado, apenas salva na variável.</p>
                </div>
                <input
                  type="checkbox"
                  checked={node.data.config?.sendReply !== false}
                  onChange={(e) => updateConfig('sendReply', e.target.checked)}
                  className="h-4 w-4"
                />
              </div>

              {/* Comportamento / Tom */}
              <div className="space-y-2">
                <Label>Tom da resposta</Label>
                <Select
                  value={node.data.config?.tone || 'amigavel'}
                  onValueChange={(v) => updateConfig('tone', v)}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="amigavel">Amigável e próximo</SelectItem>
                    <SelectItem value="formal">Formal e profissional</SelectItem>
                    <SelectItem value="vendedor">Consultor de vendas</SelectItem>
                    <SelectItem value="suporte">Suporte técnico</SelectItem>
                    <SelectItem value="divertido">Descontraído / divertido</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Tamanho da resposta</Label>
                <Select
                  value={node.data.config?.responseLength || 'medio'}
                  onValueChange={(v) => updateConfig('responseLength', v)}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="curto">Curto (1-2 frases)</SelectItem>
                    <SelectItem value="medio">Médio (até um parágrafo)</SelectItem>
                    <SelectItem value="longo">Detalhado</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Criatividade</Label>
                  <span className="text-xs text-muted-foreground">
                    {((node.data.config?.temperature ?? 0.7) as number).toFixed(1)}
                  </span>
                </div>
                <Slider
                  value={[Number(node.data.config?.temperature ?? 0.7)]}
                  min={0}
                  max={1}
                  step={0.1}
                  onValueChange={(v) => updateConfig('temperature', v[0])}
                />
                <p className="text-xs text-muted-foreground">
                  0 = sempre igual e previsível · 1 = mais criativo
                </p>
              </div>

              {/* Áudio */}
              <div className="space-y-2 rounded-lg border p-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Volume2 className="h-4 w-4 text-primary" />
                    <Label className="text-sm">Responder em áudio</Label>
                  </div>
                  <Select
                    value={node.data.config?.audioMode || 'never'}
                    onValueChange={(v) => updateConfig('audioMode', v)}
                  >
                    <SelectTrigger className="w-[160px] h-8"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="never">Nunca (só texto)</SelectItem>
                      <SelectItem value="auto">Automático (decide)</SelectItem>
                      <SelectItem value="always">Sempre áudio</SelectItem>
                      <SelectItem value="mirror">Espelhar o cliente</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {(node.data.config?.audioMode === 'always' ||
                  node.data.config?.audioMode === 'auto' ||
                  node.data.config?.audioMode === 'mirror') && (
                  <div className="space-y-2">
                    <Label className="text-xs">Voz</Label>
                    <Select
                      value={node.data.config?.voiceId || 'pNInz6obpgDQGcFmaJgB'}
                      onValueChange={(v) => updateConfig('voiceId', v)}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pNInz6obpgDQGcFmaJgB">Adam (masc, neutro)</SelectItem>
                        <SelectItem value="EXAVITQu4vr4xnSDxMaL">Sarah (fem, suave)</SelectItem>
                        <SelectItem value="XB0fDUnXU5powFXDhCwa">Charlotte (fem, calorosa)</SelectItem>
                        <SelectItem value="onwK4e9ZLuTAKqWW03F9">Daniel (masc, firme)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label className="text-xs">Atraso humanizado antes de responder (segundos)</Label>
                <Input
                  type="number"
                  min={0}
                  max={30}
                  value={node.data.config?.humanDelaySec ?? 0}
                  onChange={(e) => updateConfig('humanDelaySec', parseInt(e.target.value) || 0)}
                />
                <p className="text-xs text-muted-foreground">
                  Simula tempo de digitação. 0 = responde imediato.
                </p>
              </div>

              {/* Base de conhecimento */}
              <div className="space-y-2 rounded-lg border p-3">
                <div className="flex items-center justify-between">
                  <Label className="text-sm flex items-center gap-2">
                    <Brain className="h-4 w-4 text-primary" /> Base de conhecimento
                  </Label>
                  <label className="cursor-pointer">
                    <input
                      type="file"
                      multiple
                      accept=".pdf,.txt,.md,.csv,.docx,.json,image/*"
                      className="hidden"
                      onChange={(e) => handleKnowledgeUpload(e.target.files)}
                    />
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs bg-primary text-primary-foreground hover:opacity-90">
                      {uploadingKnowledge ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <Upload className="h-3 w-3" />
                      )}
                      Anexar
                    </span>
                  </label>
                </div>
                <p className="text-xs text-muted-foreground">
                  PDFs, planilhas, FAQs, catálogos. A IA consulta esses arquivos para responder com precisão.
                </p>
                <div className="space-y-1.5">
                  {(node.data.config?.knowledgeFiles || []).map((f: any, idx: number) => (
                    <div key={idx} className="flex items-center gap-2 p-2 rounded-md bg-muted/50 border">
                      <FileText className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                      <a
                        href={f.url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs flex-1 truncate hover:underline"
                        title={f.name}
                      >
                        {f.name}
                      </a>
                      <button
                        type="button"
                        onClick={() => removeKnowledgeFile(idx)}
                        className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                  {(!node.data.config?.knowledgeFiles || node.data.config.knowledgeFiles.length === 0) && (
                    <p className="text-[11px] text-muted-foreground italic">Nenhum arquivo anexado ainda.</p>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-xs">Conhecimento adicional (texto livre)</Label>
                <Textarea
                  value={node.data.config?.knowledgeText || ''}
                  onChange={(e) => updateConfig('knowledgeText', e.target.value)}
                  rows={4}
                  placeholder={`Ex: Horário de atendimento: seg-sex 9h-18h.\nFormas de pagamento: Pix, cartão.\nFrete grátis acima de R$ 200.`}
                />
              </div>

              <div className="flex items-center justify-between p-3 rounded-lg border">
                <div>
                  <Label className="text-sm">Pode escalar para humano</Label>
                  <p className="text-xs text-muted-foreground">Se cliente pedir "atendente" ou IA não souber.</p>
                </div>
                <input
                  type="checkbox"
                  checked={node.data.config?.canEscalate !== false}
                  onChange={(e) => updateConfig('canEscalate', e.target.checked)}
                  className="h-4 w-4"
                />
              </div>
            </div>
          );
        }
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Bot className="h-4 w-4" />
                Selecionar Agente de IA
              </Label>
              {loadingAgents ? (
                <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-sm text-muted-foreground">Carregando agentes...</span>
                </div>
              ) : aiAgents.length === 0 ? (
                <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                  <AlertCircle className="h-4 w-4 text-amber-600" />
                  <span className="text-sm text-amber-700">Nenhum agente de IA cadastrado. Crie um em Bot IA.</span>
                </div>
              ) : (
                <Select
                  value={node.data.config?.agentId || ''}
                  onValueChange={(v) => {
                    const agent = aiAgents.find(a => a.id === v);
                    updateMultipleConfig({
                      agentId: v,
                      agentName: agent?.name || ''
                    });
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um agente" />
                  </SelectTrigger>
                  <SelectContent>
                    {aiAgents.map((agent) => (
                      <SelectItem key={agent.id} value={agent.id}>
                        <div className="flex items-center gap-2">
                          <Bot className="h-4 w-4" />
                          <span className="font-medium">{agent.name}</span>
                          {!agent.is_active && (
                            <span className="text-xs text-muted-foreground">(inativo)</span>
                          )}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
            <div className="space-y-2">
              <Label>Mensagem ao Transferir (opcional)</Label>
              <Textarea
                value={node.data.config?.transferMessage || ''}
                onChange={(e) => updateConfig('transferMessage', e.target.value)}
                placeholder="Vou transferir você para nosso assistente de IA..."
                rows={2}
              />
            </div>
            <div className="space-y-2">
              <Label>Comportamento ao entrar na conversa</Label>
              <Select
                value={node.data.config?.aiEntryBehavior || 'send_welcome'}
                onValueChange={(v) => updateConfig('aiEntryBehavior', v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="send_welcome">
                    <div className="flex flex-col">
                      <span className="font-medium">Enviar mensagem imediata</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="wait_client">
                    <div className="flex flex-col">
                      <span className="font-medium">Aguardar o cliente falar</span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {node.data.config?.aiEntryBehavior === 'wait_client'
                  ? 'O agente de IA aguardará o cliente enviar uma mensagem antes de responder.'
                  : 'O agente de IA enviará uma saudação assim que assumir a conversa.'}
              </p>
            </div>
            <div className="p-3 bg-muted rounded-lg">
              <p className="text-xs text-muted-foreground">
                O chatbot será encerrado e o agente de IA assumirá a conversa automaticamente.
              </p>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  const renderDelayFields = () => {
    switch (node.subType) {
      case 'wait_seconds':
        return (
          <div className="space-y-2">
            <Label>Segundos para aguardar</Label>
            <Input
              type="number"
              value={node.data.config?.seconds || 5}
              onChange={(e) => updateConfig('seconds', parseInt(e.target.value))}
              min={1}
              max={300}
            />
            <p className="text-xs text-muted-foreground">
              O fluxo pausará por este tempo antes de continuar
            </p>
          </div>
        );

      case 'wait_response':
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Tempo máximo de espera (segundos)</Label>
              <Input
                type="number"
                value={node.data.config?.timeout || 60}
                onChange={(e) => updateConfig('timeout', parseInt(e.target.value))}
                min={10}
                max={3600}
              />
            </div>
            <div className="space-y-2">
              <Label>Salvar resposta em variável</Label>
              <Input
                value={node.data.config?.saveAs || ''}
                onChange={(e) => updateConfig('saveAs', e.target.value)}
                placeholder="resposta_usuario"
              />
              <p className="text-xs text-muted-foreground">
                A resposta do usuário será salva nesta variável
              </p>
            </div>
          </div>
        );

      case 'wait_business_hours':
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Horário de Início</Label>
              <Input
                type="number"
                value={node.data.config?.startHour || 9}
                onChange={(e) => updateConfig('startHour', parseInt(e.target.value))}
                min={0}
                max={23}
              />
            </div>
            <div className="space-y-2">
              <Label>Horário de Fim</Label>
              <Input
                type="number"
                value={node.data.config?.endHour || 18}
                onChange={(e) => updateConfig('endHour', parseInt(e.target.value))}
                min={0}
                max={23}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Se fora do horário, o fluxo aguardará o próximo período
            </p>
          </div>
        );

      case 'wait_interval':
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Valor do intervalo</Label>
              <Input
                type="number"
                value={node.data.config?.intervalValue || 1}
                onChange={(e) => updateConfig('intervalValue', parseInt(e.target.value))}
                min={1}
              />
            </div>
            <div className="space-y-2">
              <Label>Unidade</Label>
              <select
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={node.data.config?.intervalUnit || 'minutes'}
                onChange={(e) => updateConfig('intervalUnit', e.target.value)}
              >
                <option value="seconds">Segundos</option>
                <option value="minutes">Minutos</option>
                <option value="hours">Horas</option>
                <option value="days">Dias</option>
              </select>
            </div>
            <p className="text-xs text-muted-foreground">
              O fluxo pausará pelo intervalo configurado antes de continuar
            </p>
          </div>
        );

      case 'wait_until':
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Data</Label>
              <Input
                type="date"
                value={node.data.config?.waitDate || ''}
                onChange={(e) => updateConfig('waitDate', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Hora</Label>
              <Input
                type="time"
                value={node.data.config?.waitTime || '09:00'}
                onChange={(e) => updateConfig('waitTime', e.target.value)}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              O fluxo pausará até a data e hora especificadas
            </p>
          </div>
        );

      default:
        return null;
    }
  };

  const renderFields = () => {
    switch (node.type) {
      case 'trigger':
        return renderTriggerFields();
      case 'message':
        return renderMessageFields();
      case 'condition':
        return renderConditionFields();
      case 'action':
        return renderActionFields();
      case 'delay':
        return renderDelayFields();
      default:
        return null;
    }
  };

  return (
    <div className={cn(
      "w-96 bg-[#faf9f7] border-l flex flex-col h-full shadow-xl transition-all duration-300 animate-in slide-in-from-right",
      embedded && "w-full border-l-0 shadow-none"
    )}>
      {/* Header */}
      <div className="p-6 border-b flex items-center justify-between bg-white">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#F0F2FE] flex items-center justify-center">
            <Settings className="h-5 w-5" style={{ color: OMNI_COLOR }} />
          </div>
          <div>
            <h3 className="font-bold text-gray-900">Configurações</h3>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">
              {node.type} • {node.subType}
            </p>
          </div>
        </div>
        {!embedded && (
          <Button variant="ghost" size="icon" onClick={onClose} className="rounded-xl hover:bg-gray-100">
            <X className="h-5 w-5 text-gray-400" />
          </Button>
        )}
      </div>

      {/* Content */}
      <ScrollArea className={embedded ? "flex-1" : "flex-1 max-md:max-h-[60vh]"}>
        <div className="p-6 space-y-8">
          {/* Label */}
          <div className="space-y-3">
            <Label className="text-gray-700 font-medium">Nome identificador</Label>
            <Input
              value={node.data.label}
              onChange={(e) => updateLabel(e.target.value)}
              placeholder="Ex: Saudação Inicial"
              className="rounded-xl border-gray-200 bg-white"
            />
          </div>

          <div className="h-px bg-gray-200 w-full my-2" />

          {/* Type-specific fields */}
          {renderFields()}
        </div>
      </ScrollArea>
    </div>
  );
};

export default ChatBotPropertiesPanel;
