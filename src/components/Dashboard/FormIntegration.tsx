import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Code2, Copy, Plus, Trash2, CheckCircle2, Zap, 
  ScanLine, FileCode, Eye 
} from 'lucide-react';

interface FormToken {
  id: string;
  name: string;
  token: string;
  contact_type: string;
  is_active: boolean;
  created_at: string;
}

const SUPABASE_URL = 'https://jwddiyuezqrpuakazvgg.supabase.co';

const FormIntegration: React.FC = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [tokens, setTokens] = useState<FormToken[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showCodeDialog, setShowCodeDialog] = useState<FormToken | null>(null);
  const [showPixelCodeDialog, setShowPixelCodeDialog] = useState<FormToken | null>(null);
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState('prospecto');
  const [copied, setCopied] = useState(false);
  const [activeSection, setActiveSection] = useState('forms');

  const fetchTokens = async () => {
    if (!user) return;
    try {
      const { data: companyUser } = await supabase
        .from('company_users')
        .select('company_id')
        .eq('user_id', user.id)
        .single();
      if (!companyUser) return;

      const { data, error } = await supabase
        .from('form_integration_tokens')
        .select('*')
        .eq('company_id', companyUser.company_id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setTokens(data || []);
    } catch (e) {
      console.error('Error fetching tokens:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchTokens(); }, [user]);

  const handleCreate = async () => {
    if (!user || !newName.trim()) return;
    try {
      const { data: companyUser } = await supabase
        .from('company_users')
        .select('company_id')
        .eq('user_id', user.id)
        .single();
      if (!companyUser) return;

      const { error } = await supabase.from('form_integration_tokens').insert({
        name: newName.trim(),
        contact_type: newType,
        company_id: companyUser.company_id,
        created_by: user.id,
      });
      if (error) throw error;
      toast({ title: 'Formulário criado' });
      setNewName('');
      setShowCreateDialog(false);
      fetchTokens();
    } catch (e: any) {
      toast({ title: 'Erro', description: e.message, variant: 'destructive' });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Excluir este formulário?')) return;
    await supabase.from('form_integration_tokens').delete().eq('id', id);
    toast({ title: 'Formulário excluído' });
    fetchTokens();
  };

  const toggleActive = async (token: FormToken) => {
    await supabase.from('form_integration_tokens').update({ is_active: !token.is_active }).eq('id', token.id);
    fetchTokens();
  };

  const generateEmbedCode = (token: FormToken) => {
    return `<!-- ElloSuit Form Integration -->
<form id="ellosuit-form" onsubmit="return submitEllosuit(event)">
  <div style="max-width:400px;margin:0 auto;font-family:sans-serif;">
    <h3 style="margin-bottom:16px;">Cadastro</h3>
    <div style="margin-bottom:12px;">
      <label style="display:block;margin-bottom:4px;font-size:14px;">Nome *</label>
      <input name="name" required style="width:100%;padding:8px 12px;border:1px solid #ddd;border-radius:8px;font-size:14px;" />
    </div>
    <div style="margin-bottom:12px;">
      <label style="display:block;margin-bottom:4px;font-size:14px;">Email</label>
      <input name="email" type="email" style="width:100%;padding:8px 12px;border:1px solid #ddd;border-radius:8px;font-size:14px;" />
    </div>
    <div style="margin-bottom:12px;">
      <label style="display:block;margin-bottom:4px;font-size:14px;">Telefone</label>
      <input name="phone" style="width:100%;padding:8px 12px;border:1px solid #ddd;border-radius:8px;font-size:14px;" />
    </div>
    <div style="margin-bottom:12px;">
      <label style="display:block;margin-bottom:4px;font-size:14px;">Empresa</label>
      <input name="company_name" style="width:100%;padding:8px 12px;border:1px solid #ddd;border-radius:8px;font-size:14px;" />
    </div>
    <div style="margin-bottom:16px;">
      <label style="display:block;margin-bottom:4px;font-size:14px;">Observações</label>
      <textarea name="notes" rows="3" style="width:100%;padding:8px 12px;border:1px solid #ddd;border-radius:8px;font-size:14px;resize:vertical;"></textarea>
    </div>
    <button type="submit" style="width:100%;padding:10px;background:#374DA4;color:white;border:none;border-radius:8px;font-size:14px;cursor:pointer;">
      Enviar
    </button>
    <p id="ellosuit-msg" style="margin-top:12px;text-align:center;font-size:13px;"></p>
  </div>
</form>
<script>
async function submitEllosuit(e) {
  e.preventDefault();
  var f = e.target;
  var msg = document.getElementById('ellosuit-msg');
  msg.textContent = 'Enviando...';
  msg.style.color = '#666';
  try {
    var res = await fetch('${SUPABASE_URL}/functions/v1/form-capture', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: '${token.token}',
        name: f.name.value,
        email: f.email.value || null,
        phone: f.phone.value || null,
        company_name: f.company_name.value || null,
        notes: f.notes.value || null
      })
    });
    var data = await res.json();
    if (res.ok) {
      msg.textContent = 'Cadastro enviado com sucesso!';
      msg.style.color = 'green';
      f.reset();
    } else {
      msg.textContent = data.error || 'Erro ao enviar';
      msg.style.color = 'red';
    }
  } catch(err) {
    msg.textContent = 'Erro de conexão';
    msg.style.color = 'red';
  }
  return false;
}
</script>`;
  };

  const generatePixelCode = (token: FormToken) => {
    return `<!-- ElloSuit Pixel de Conversão -->
<script>
(function() {
  var ELLOSUIT_TOKEN = '${token.token}';
  var ELLOSUIT_API = '${SUPABASE_URL}/functions/v1/form-capture';

  // Auto-captura formulários na página
  function captureForm(form) {
    form.addEventListener('submit', function(e) {
      var fields = {};
      var inputs = form.querySelectorAll('input, textarea, select');
      
      for (var i = 0; i < inputs.length; i++) {
        var el = inputs[i];
        var name = (el.name || el.id || '').toLowerCase();
        var val = el.value || '';
        if (!val || el.type === 'submit' || el.type === 'button' || el.type === 'hidden') continue;

        // Mapear campos comuns
        if (name.match(/nome|name|full.?name/i)) fields.name = val;
        else if (name.match(/email|e.?mail/i)) fields.email = val;
        else if (name.match(/tel|phone|fone|celular|whatsapp/i)) fields.phone = val;
        else if (name.match(/empresa|company|org/i)) fields.company_name = val;
        else if (name.match(/obs|note|msg|message|mensagem|comentar/i)) fields.notes = val;
        else {
          // Campos extras vão para notes
          if (!fields.notes) fields.notes = '';
          fields.notes += (fields.notes ? ' | ' : '') + name + ': ' + val;
        }
      }

      if (!fields.name && !fields.email && !fields.phone) return;
      if (!fields.name) fields.name = fields.email || fields.phone || 'Visitante';

      // Enviar ao ElloSuit (sem bloquear o form original)
      var xhr = new XMLHttpRequest();
      xhr.open('POST', ELLOSUIT_API, true);
      xhr.setRequestHeader('Content-Type', 'application/json');
      xhr.send(JSON.stringify({
        token: ELLOSUIT_TOKEN,
        name: fields.name,
        email: fields.email || null,
        phone: fields.phone || null,
        company_name: fields.company_name || null,
        notes: fields.notes || null,
        source: 'pixel'
      }));
    });
  }

  // Capturar todos os formulários existentes e futuros
  function init() {
    var forms = document.querySelectorAll('form');
    for (var i = 0; i < forms.length; i++) {
      if (!forms[i]._ellosuit) {
        forms[i]._ellosuit = true;
        captureForm(forms[i]);
      }
    }
  }

  // Executar ao carregar e observar novos formulários
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // MutationObserver para formulários dinâmicos
  var observer = new MutationObserver(function() { init(); });
  observer.observe(document.body, { childList: true, subtree: true });

  console.log('[ElloSuit] Pixel de conversão ativo');
})();
</script>`;
  };

  const handleCopy = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    toast({ title: 'Código copiado!' });
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-2xl bg-emerald-50">
            <Code2 className="h-6 w-6 text-emerald-600" />
          </div>
          <div>
            <h2 className="text-xl font-bold">Captação & Pixel</h2>
            <p className="text-sm text-muted-foreground">Formulários embed e pixel de conversão para captar contatos</p>
          </div>
        </div>
        <Button className="rounded-xl" onClick={() => { setNewName(''); setNewType('prospecto'); setShowCreateDialog(true); }}>
          <Plus className="h-4 w-4 mr-2" /> Novo Token
        </Button>
      </div>

      {/* Section Tabs */}
      <Tabs value={activeSection} onValueChange={setActiveSection}>
        <TabsList className="grid w-full grid-cols-2 lg:w-auto lg:inline-flex">
          <TabsTrigger value="forms" className="flex items-center gap-2">
            <FileCode className="h-4 w-4" />
            Formulário Embed
          </TabsTrigger>
          <TabsTrigger value="pixel" className="flex items-center gap-2">
            <ScanLine className="h-4 w-4" />
            Pixel de Conversão
          </TabsTrigger>
        </TabsList>

        {/* ===== FORMS TAB ===== */}
        <TabsContent value="forms" className="mt-4 space-y-4">
          <Card className="border-none shadow-sm rounded-2xl bg-primary/5">
            <CardContent className="p-4 flex items-start gap-3">
              <FileCode className="h-5 w-5 text-primary mt-0.5 shrink-0" />
              <div className="text-sm">
                <p className="font-medium">Formulário Completo</p>
                <p className="text-muted-foreground text-xs mt-0.5">
                  Gera um formulário HTML pronto para inserir em qualquer página. O visitante preenche e os dados são salvos direto na sua conta ElloSuit.
                </p>
              </div>
            </CardContent>
          </Card>

          {tokens.length === 0 ? (
            <Card className="border-none shadow-lg rounded-2xl">
              <CardContent className="py-12 text-center">
                <Code2 className="h-16 w-16 text-muted-foreground/30 mx-auto mb-4" />
                <h3 className="text-lg font-medium mb-2">Nenhum token criado</h3>
                <p className="text-muted-foreground mb-4">Crie um token para gerar formulários ou pixels</p>
                <Button onClick={() => setShowCreateDialog(true)}>
                  <Plus className="h-4 w-4 mr-2" /> Criar Token
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {tokens.map(t => (
                <Card key={t.id} className="border-none shadow-lg rounded-2xl">
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="font-semibold">{t.name}</h3>
                        <p className="text-xs text-muted-foreground mt-1">
                          Tipo: <Badge variant="secondary" className="rounded-full text-xs">{t.contact_type}</Badge>
                        </p>
                      </div>
                      <Badge variant={t.is_active ? 'default' : 'secondary'} className="rounded-full cursor-pointer" onClick={() => toggleActive(t)}>
                        {t.is_active ? 'Ativo' : 'Inativo'}
                      </Badge>
                    </div>
                    <div className="mt-4 flex items-center gap-2 flex-wrap">
                      <Button size="sm" variant="outline" className="rounded-xl" onClick={() => setShowCodeDialog(t)}>
                        <Eye className="h-3.5 w-3.5 mr-1.5" /> Ver Código
                      </Button>
                      <Button size="sm" variant="outline" className="rounded-xl" onClick={() => handleCopy(generateEmbedCode(t))}>
                        <Copy className="h-3.5 w-3.5 mr-1.5" /> Copiar
                      </Button>
                      <Button size="sm" variant="ghost" className="rounded-xl text-destructive" onClick={() => handleDelete(t.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground mt-3">Criado em {new Date(t.created_at).toLocaleDateString('pt-BR')}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ===== PIXEL TAB ===== */}
        <TabsContent value="pixel" className="mt-4 space-y-4">
          <Card className="border-none shadow-sm rounded-2xl bg-[#F0F2FE]">
            <CardContent className="p-4 flex items-start gap-3">
              <Zap className="h-5 w-5 text-[#253573] mt-0.5 shrink-0" />
              <div className="text-sm">
                <p className="font-medium text-blue-950">Pixel de Conversão</p>
                <p className="text-[#1A2551]/70 text-xs mt-0.5">
                  Cole este script em qualquer página que já tenha um formulário. O pixel detecta automaticamente os campos 
                  (nome, email, telefone, empresa) e envia os dados para sua conta ElloSuit quando o formulário for submetido. 
                  <strong> Não interfere no funcionamento original do formulário.</strong>
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-none shadow-sm rounded-2xl bg-muted/30">
            <CardContent className="p-4">
              <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <ScanLine className="h-4 w-4" /> Como funciona
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                <div className="flex gap-2">
                  <span className="h-6 w-6 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold shrink-0">1</span>
                  <p className="text-muted-foreground">Copie o código do pixel e cole no <code className="bg-muted px-1 rounded">&lt;head&gt;</code> ou antes do <code className="bg-muted px-1 rounded">&lt;/body&gt;</code> da sua página</p>
                </div>
                <div className="flex gap-2">
                  <span className="h-6 w-6 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold shrink-0">2</span>
                  <p className="text-muted-foreground">O script detecta automaticamente todos os formulários da página e mapeia os campos (nome, email, telefone, etc.)</p>
                </div>
                <div className="flex gap-2">
                  <span className="h-6 w-6 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold shrink-0">3</span>
                  <p className="text-muted-foreground">Quando alguém enviar o formulário, os dados são salvos na sua conta ElloSuit como um novo contato</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {tokens.length === 0 ? (
            <Card className="border-none shadow-lg rounded-2xl">
              <CardContent className="py-12 text-center">
                <ScanLine className="h-16 w-16 text-muted-foreground/30 mx-auto mb-4" />
                <h3 className="text-lg font-medium mb-2">Nenhum token criado</h3>
                <p className="text-muted-foreground mb-4">Crie um token para gerar seu pixel de conversão</p>
                <Button onClick={() => setShowCreateDialog(true)}>
                  <Plus className="h-4 w-4 mr-2" /> Criar Token
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {tokens.map(t => (
                <Card key={t.id} className="border-none shadow-lg rounded-2xl">
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-xl bg-[#F0F2FE]">
                          <ScanLine className="h-5 w-5 text-[#253573]" />
                        </div>
                        <div>
                          <h3 className="font-semibold">{t.name}</h3>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            Salva como: <Badge variant="secondary" className="rounded-full text-xs">{t.contact_type}</Badge>
                          </p>
                        </div>
                      </div>
                      <Badge variant={t.is_active ? 'default' : 'secondary'} className="rounded-full cursor-pointer" onClick={() => toggleActive(t)}>
                        {t.is_active ? 'Ativo' : 'Inativo'}
                      </Badge>
                    </div>
                    <div className="mt-4 flex items-center gap-2 flex-wrap">
                      <Button size="sm" variant="outline" className="rounded-xl" onClick={() => setShowPixelCodeDialog(t)}>
                        <Eye className="h-3.5 w-3.5 mr-1.5" /> Ver Pixel
                      </Button>
                      <Button size="sm" className="rounded-xl gap-1.5" onClick={() => handleCopy(generatePixelCode(t))}>
                        <Copy className="h-3.5 w-3.5" /> Copiar Pixel
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Create Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Novo Token de Captação</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <Input placeholder="Nome (ex: Site Principal, Landing Page)" value={newName} onChange={e => setNewName(e.target.value)} />
            <Select value={newType} onValueChange={setNewType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="prospecto">Prospecto</SelectItem>
                <SelectItem value="cliente">Cliente</SelectItem>
                <SelectItem value="fornecedor">Fornecedor</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">O token pode ser usado tanto para formulários embed quanto para pixel de conversão.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>Cancelar</Button>
            <Button onClick={handleCreate} disabled={!newName.trim()}>Criar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Form Code Preview Dialog */}
      <Dialog open={!!showCodeDialog} onOpenChange={() => setShowCodeDialog(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>Formulário Embed — {showCodeDialog?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Copie e cole este código HTML em qualquer página web. Os dados enviados serão salvos automaticamente na sua conta ElloSuit.
            </p>
            <div className="relative">
              <pre className="bg-muted rounded-xl p-4 text-xs overflow-auto max-h-96 font-mono">
                {showCodeDialog && generateEmbedCode(showCodeDialog)}
              </pre>
              <Button
                size="sm"
                className="absolute top-2 right-2 rounded-lg"
                onClick={() => showCodeDialog && handleCopy(generateEmbedCode(showCodeDialog))}
              >
                {copied ? <CheckCircle2 className="h-4 w-4 mr-1" /> : <Copy className="h-4 w-4 mr-1" />}
                {copied ? 'Copiado!' : 'Copiar'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Pixel Code Preview Dialog */}
      <Dialog open={!!showPixelCodeDialog} onOpenChange={() => setShowPixelCodeDialog(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ScanLine className="h-5 w-5 text-[#253573]" />
              Pixel de Conversão — {showPixelCodeDialog?.name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="bg-[#F0F2FE] rounded-xl p-3 text-sm text-[#0F1631]">
              <p className="font-medium">Instruções:</p>
              <ol className="list-decimal list-inside mt-1 space-y-1 text-xs text-[#1A2551]">
                <li>Copie o código abaixo</li>
                <li>Cole antes do <code className="bg-[#DFE4FB] px-1 rounded">&lt;/body&gt;</code> da página que contém o formulário</li>
                <li>O pixel irá detectar automaticamente os campos do formulário</li>
                <li>Os dados serão enviados ao ElloSuit quando o formulário for submetido</li>
              </ol>
            </div>
            <div className="relative">
              <pre className="bg-muted rounded-xl p-4 text-xs overflow-auto max-h-96 font-mono">
                {showPixelCodeDialog && generatePixelCode(showPixelCodeDialog)}
              </pre>
              <Button
                size="sm"
                className="absolute top-2 right-2 rounded-lg"
                onClick={() => showPixelCodeDialog && handleCopy(generatePixelCode(showPixelCodeDialog))}
              >
                {copied ? <CheckCircle2 className="h-4 w-4 mr-1" /> : <Copy className="h-4 w-4 mr-1" />}
                {copied ? 'Copiado!' : 'Copiar'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default FormIntegration;
