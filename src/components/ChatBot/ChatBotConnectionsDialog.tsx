import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Loader2, Plus, Trash2, Globe, Pencil } from 'lucide-react';

const OMNI_COLOR = '#374DA4';

export interface ConnectionProvider {
  id: string;
  name: string;
  description: string;
  logoUrl?: string; // real brand logo via simpleicons CDN
  color?: string;
  fields: Array<{
    key: string;
    label: string;
    type: 'text' | 'password' | 'textarea' | 'url';
    placeholder?: string;
    required?: boolean;
    secret?: boolean; // stored in credentials
  }>;
}

export const CONNECTION_PROVIDERS: ConnectionProvider[] = [
  {
    id: 'google_sheets',
    name: 'Google Sheets',
    description: 'Salvar/ler linhas de uma planilha via Apps Script webhook.',
    logoUrl: 'https://cdn.simpleicons.org/googlesheets/34A853',
    color: '#34A853',
    fields: [
      { key: 'webhookUrl', label: 'URL do Apps Script (Web App)', type: 'url', placeholder: 'https://script.google.com/macros/s/.../exec', required: true },
      { key: 'sheetName', label: 'Nome da aba (opcional)', type: 'text', placeholder: 'Página1' },
    ],
  },
  {
    id: 'notion',
    name: 'Notion',
    description: 'Criar páginas ou linhas em bases do Notion.',
    logoUrl: 'https://cdn.simpleicons.org/notion/000000',
    color: '#000000',
    fields: [
      { key: 'apiKey', label: 'Integration Token', type: 'password', placeholder: 'secret_...', required: true, secret: true },
      { key: 'databaseId', label: 'Database ID', type: 'text', required: true },
    ],
  },
  {
    id: 'airtable',
    name: 'Airtable',
    description: 'Inserir registros em uma base do Airtable.',
    logoUrl: 'https://cdn.simpleicons.org/airtable/18BFFF',
    color: '#18BFFF',
    fields: [
      { key: 'apiKey', label: 'API Key / PAT', type: 'password', required: true, secret: true },
      { key: 'baseId', label: 'Base ID', type: 'text', placeholder: 'app...', required: true },
      { key: 'tableName', label: 'Tabela', type: 'text', required: true },
    ],
  },
  {
    id: 'slack',
    name: 'Slack',
    description: 'Enviar mensagens para um canal via Incoming Webhook.',
    logoUrl: 'https://cdn.simpleicons.org/slack/4A154B',
    color: '#4A154B',
    fields: [
      { key: 'webhookUrl', label: 'Incoming Webhook URL', type: 'url', placeholder: 'https://hooks.slack.com/...', required: true, secret: true },
    ],
  },
  {
    id: 'discord',
    name: 'Discord',
    description: 'Enviar mensagens para um canal via Webhook.',
    logoUrl: 'https://cdn.simpleicons.org/discord/5865F2',
    color: '#5865F2',
    fields: [
      { key: 'webhookUrl', label: 'Webhook URL', type: 'url', required: true, secret: true },
    ],
  },
  {
    id: 'zapier',
    name: 'Zapier',
    description: 'Disparar um Zap via Catch Hook.',
    logoUrl: 'https://cdn.simpleicons.org/zapier/FF4A00',
    color: '#FF4A00',
    fields: [
      { key: 'webhookUrl', label: 'Zap Catch Hook URL', type: 'url', required: true, secret: true },
    ],
  },
  {
    id: 'make',
    name: 'Make (Integromat)',
    description: 'Disparar um cenário no Make via Webhook.',
    logoUrl: 'https://cdn.simpleicons.org/make/6D00CC',
    color: '#6D00CC',
    fields: [
      { key: 'webhookUrl', label: 'Webhook URL', type: 'url', required: true, secret: true },
    ],
  },
  {
    id: 'hubspot',
    name: 'HubSpot',
    description: 'Criar/atualizar contatos no HubSpot CRM.',
    logoUrl: 'https://cdn.simpleicons.org/hubspot/FF7A59',
    color: '#FF7A59',
    fields: [
      { key: 'apiKey', label: 'Private App Token', type: 'password', required: true, secret: true },
    ],
  },
  {
    id: 'google_calendar',
    name: 'Google Calendar',
    description: 'Criar eventos via Apps Script webhook.',
    logoUrl: 'https://cdn.simpleicons.org/googlecalendar/4285F4',
    color: '#4285F4',
    fields: [
      { key: 'webhookUrl', label: 'Apps Script Web App URL', type: 'url', required: true },
      { key: 'calendarId', label: 'Calendar ID (opcional)', type: 'text', placeholder: 'primary' },
    ],
  },
  {
    id: 'webhook',
    name: 'Webhook / HTTP',
    description: 'Envie dados para qualquer URL HTTP.',
    color: '#64748B',
    fields: [
      { key: 'url', label: 'URL', type: 'url', required: true },
      { key: 'method', label: 'Método (GET/POST/PUT)', type: 'text', placeholder: 'POST' },
      { key: 'headers', label: 'Headers (JSON)', type: 'textarea', placeholder: '{"Authorization":"Bearer ..."}' },
    ],
  },
];

export interface ChatBotConnection {
  id: string;
  provider: string;
  name: string;
  config: Record<string, any>;
  is_active: boolean;
  created_at: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyId: string | null;
  onConnectionsChange?: (list: ChatBotConnection[]) => void;
}

export function ProviderLogo({ provider, size = 24 }: { provider: ConnectionProvider | { logoUrl?: string; color?: string; name: string }; size?: number }) {
  if (provider.logoUrl) {
    return (
      <img
        src={provider.logoUrl}
        alt={provider.name}
        width={size}
        height={size}
        style={{ width: size, height: size, objectFit: 'contain' }}
        loading="lazy"
      />
    );
  }
  return (
    <div
      className="rounded-md flex items-center justify-center"
      style={{ width: size, height: size, backgroundColor: `${provider.color || OMNI_COLOR}20`, color: provider.color || OMNI_COLOR }}
    >
      <Globe style={{ width: size * 0.6, height: size * 0.6 }} />
    </div>
  );
}

const ChatBotConnectionsDialog: React.FC<Props> = ({ open, onOpenChange, companyId, onConnectionsChange }) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [connections, setConnections] = useState<ChatBotConnection[]>([]);
  const [loading, setLoading] = useState(false);
  const [view, setView] = useState<'list' | 'providers' | 'form'>('list');
  const [selectedProvider, setSelectedProvider] = useState<ConnectionProvider | null>(null);
  const [editing, setEditing] = useState<ChatBotConnection | null>(null);
  const [formName, setFormName] = useState('');
  const [formValues, setFormValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const fetchConnections = async () => {
    if (!companyId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('chatbot_connections')
      .select('id, provider, name, config, is_active, created_at')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false });
    setLoading(false);
    if (error) {
      toast({ title: 'Erro ao carregar conexões', description: error.message, variant: 'destructive' });
      return;
    }
    const list = (data || []) as ChatBotConnection[];
    setConnections(list);
    onConnectionsChange?.(list);
  };

  useEffect(() => {
    if (open) {
      setView('list');
      setEditing(null);
      setSelectedProvider(null);
      fetchConnections();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, companyId]);

  const openNewForm = (provider: ConnectionProvider) => {
    setSelectedProvider(provider);
    setEditing(null);
    setFormName(provider.name);
    setFormValues({});
    setView('form');
  };

  const openEditForm = (conn: ChatBotConnection) => {
    const provider = CONNECTION_PROVIDERS.find(p => p.id === conn.provider);
    if (!provider) return;
    setSelectedProvider(provider);
    setEditing(conn);
    setFormName(conn.name);
    // credentials are not returned by RLS-safe select; keep blank on edit
    setFormValues(Object.fromEntries(Object.entries(conn.config || {}).map(([k, v]) => [k, String(v ?? '')])));
    setView('form');
  };

  const saveConnection = async () => {
    if (!selectedProvider || !companyId || !user?.id) return;
    // simple required validation
    for (const f of selectedProvider.fields) {
      if (f.required && !formValues[f.key]?.trim()) {
        toast({ title: 'Campo obrigatório', description: f.label, variant: 'destructive' });
        return;
      }
    }
    const config: Record<string, any> = {};
    const credentials: Record<string, any> = {};
    for (const f of selectedProvider.fields) {
      const val = formValues[f.key];
      if (val === undefined) continue;
      if (f.secret) credentials[f.key] = val;
      else config[f.key] = val;
    }
    setSaving(true);
    if (editing) {
      const payload: any = { name: formName.trim() || selectedProvider.name, config };
      // only update credentials if user provided any (leaves existing untouched otherwise)
      if (Object.keys(credentials).length > 0) payload.credentials = credentials;
      const { error } = await supabase.from('chatbot_connections').update(payload).eq('id', editing.id);
      setSaving(false);
      if (error) {
        toast({ title: 'Erro ao salvar', description: error.message, variant: 'destructive' });
        return;
      }
    } else {
      const { error } = await supabase.from('chatbot_connections').insert({
        company_id: companyId,
        created_by: user.id,
        provider: selectedProvider.id,
        name: formName.trim() || selectedProvider.name,
        config,
        credentials,
      });
      setSaving(false);
      if (error) {
        toast({ title: 'Erro ao criar', description: error.message, variant: 'destructive' });
        return;
      }
    }
    toast({ title: editing ? 'Conexão atualizada' : 'Conexão criada' });
    await fetchConnections();
    setView('list');
  };

  const deleteConnection = async (id: string) => {
    if (!confirm('Excluir esta conexão?')) return;
    const { error } = await supabase.from('chatbot_connections').delete().eq('id', id);
    if (error) {
      toast({ title: 'Erro ao excluir', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Conexão excluída' });
    fetchConnections();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col p-0">
        <DialogHeader className="p-6 pb-3 border-b">
          <div className="flex items-center gap-3">
            {view !== 'list' && (
              <Button variant="ghost" size="icon" onClick={() => setView(view === 'form' ? 'providers' : 'list')} className="h-8 w-8">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            )}
            <div className="flex-1">
              <DialogTitle>
                {view === 'list' && 'Conexões'}
                {view === 'providers' && 'Escolha um sistema'}
                {view === 'form' && (editing ? 'Editar conexão' : `Nova conexão · ${selectedProvider?.name}`)}
              </DialogTitle>
              <DialogDescription className="mt-1">
                {view === 'list' && 'Vincule chatbots a sistemas externos como Sheets, Notion, Airtable e mais.'}
                {view === 'providers' && 'Escolha o sistema que deseja conectar.'}
                {view === 'form' && 'Preencha as credenciais. Ficam salvas em segurança na sua empresa.'}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <ScrollArea className="flex-1">
          <div className="p-6">
            {view === 'list' && (
              <>
                <Button
                  onClick={() => setView('providers')}
                  className="w-full mb-4 gap-2 text-white"
                  style={{ backgroundColor: OMNI_COLOR }}
                >
                  <Plus className="h-4 w-4" /> Nova conexão
                </Button>
                {loading ? (
                  <div className="py-8 flex justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
                ) : connections.length === 0 ? (
                  <div className="text-center py-10 text-muted-foreground text-sm">
                    Nenhuma conexão ainda. Clique em <b>Nova conexão</b> para começar.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {connections.map(conn => {
                      const provider = CONNECTION_PROVIDERS.find(p => p.id === conn.provider);
                      return (
                        <div key={conn.id} className="flex items-center gap-3 p-3 rounded-xl border hover:bg-muted/40 transition">
                          <ProviderLogo provider={provider || { name: conn.provider, color: '#64748B' }} size={32} />
                          <div className="flex-1 min-w-0">
                            <div className="font-medium truncate">{conn.name}</div>
                            <div className="text-xs text-muted-foreground truncate">{provider?.name || conn.provider}</div>
                          </div>
                          {conn.is_active && <Badge variant="secondary" className="text-[10px]">Ativa</Badge>}
                          <Button variant="ghost" size="icon" onClick={() => openEditForm(conn)} className="h-8 w-8">
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => deleteConnection(conn.id)} className="h-8 w-8 text-destructive">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            )}

            {view === 'providers' && (
              <div className="grid grid-cols-2 gap-3">
                {CONNECTION_PROVIDERS.map(p => (
                  <button
                    key={p.id}
                    onClick={() => openNewForm(p)}
                    className="flex items-start gap-3 p-3 rounded-xl border text-left hover:border-primary hover:shadow-sm transition bg-background"
                  >
                    <ProviderLogo provider={p} size={32} />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm">{p.name}</div>
                      <div className="text-[11px] text-muted-foreground line-clamp-2">{p.description}</div>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {view === 'form' && selectedProvider && (
              <div className="space-y-4">
                <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/40">
                  <ProviderLogo provider={selectedProvider} size={36} />
                  <div>
                    <div className="font-medium">{selectedProvider.name}</div>
                    <div className="text-xs text-muted-foreground">{selectedProvider.description}</div>
                  </div>
                </div>
                <div>
                  <Label>Nome da conexão</Label>
                  <Input value={formName} onChange={e => setFormName(e.target.value)} placeholder="Ex.: Planilha de leads" className="mt-1" />
                </div>
                {selectedProvider.fields.map(f => (
                  <div key={f.key}>
                    <Label>
                      {f.label} {f.required && <span className="text-destructive">*</span>}
                      {f.secret && editing && <span className="ml-2 text-[10px] text-muted-foreground">(deixe vazio para manter)</span>}
                    </Label>
                    {f.type === 'textarea' ? (
                      <Textarea
                        className="mt-1 font-mono text-xs"
                        rows={3}
                        placeholder={f.placeholder}
                        value={formValues[f.key] || ''}
                        onChange={e => setFormValues({ ...formValues, [f.key]: e.target.value })}
                      />
                    ) : (
                      <Input
                        className="mt-1"
                        type={f.type === 'password' ? 'password' : 'text'}
                        placeholder={f.placeholder}
                        value={formValues[f.key] || ''}
                        onChange={e => setFormValues({ ...formValues, [f.key]: e.target.value })}
                      />
                    )}
                  </div>
                ))}
                <div className="flex gap-2 pt-2">
                  <Button variant="outline" onClick={() => setView('list')} className="flex-1">Cancelar</Button>
                  <Button onClick={saveConnection} disabled={saving} className="flex-1 text-white" style={{ backgroundColor: OMNI_COLOR }}>
                    {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                    {editing ? 'Salvar alterações' : 'Criar conexão'}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};

export default ChatBotConnectionsDialog;