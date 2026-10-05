import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { 
  Mail, 
  Users, 
  FileText, 
  Eye, 
  Send, 
  ChevronRight, 
  ChevronLeft,
  Upload,
  UserPlus,
  X,
  Loader2,
  Check,
  Sparkles,
  Palette,
  CheckCircle2,
  AlertCircle,
  Settings2,
  Inbox,
  Clock,
  ArrowRight,
  PartyPopper,
  MailCheck,
  ExternalLink,
  Plus,
  LayoutTemplate,
  History,
  Settings,
  Save,
  Trash2
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { useGmail } from '@/hooks/useGmail';
import { supabase } from '@/integrations/supabase/client';
import AISubjectHelper from './AISubjectHelper';
import EmailConnectionPopover from './EmailConnectionPopover';
import { useNavigate, useLocation } from 'react-router-dom';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

const STEPS = [
  { id: 1, title: 'Destinatários', description: 'Para quem você quer enviar?', icon: Users },
  { id: 2, title: 'Assunto', description: 'Qual será o assunto?', icon: FileText },
  { id: 3, title: 'Conteúdo', description: 'O que você quer dizer?', icon: Palette },
  { id: 4, title: 'Revisar', description: 'Confira antes de enviar', icon: Eye },
];

interface SentEmail {
  id: string;
  subject: string;
  recipient_email: string;
  sent_at: string;
  status: string;
  tracking_pixel_id: string;
  opened?: boolean;
  opened_at?: string;
}

const CleanEmailMarketing: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [currentStep, setCurrentStep] = useState(1);
  const [recipients, setRecipients] = useState<string[]>([]);
  const [emailInput, setEmailInput] = useState('');
  const [subject, setSubject] = useState('');
  const [content, setContent] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState<any>(null);
  const [previewTemplate, setPreviewTemplate] = useState<any>(null);
  const [templates, setTemplates] = useState<any[]>([]);
  const [contentMode, setContentMode] = useState<'template' | 'scratch' | null>(null);
  const [sending, setSending] = useState(false);
  const [clients, setClients] = useState<any[]>([]);
  const [showClientPicker, setShowClientPicker] = useState(false);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [dailyLimit, setDailyLimit] = useState({ sent: 0, limit: 500 });
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [sentEmailsCount, setSentEmailsCount] = useState(0);
  const [showSentEmails, setShowSentEmails] = useState(false);
  const [sentEmails, setSentEmails] = useState<SentEmail[]>([]);
  const [loadingSentEmails, setLoadingSentEmails] = useState(false);
  const [clientSearch, setClientSearch] = useState('');
  const [view, setView] = useState<'list' | 'wizard'>('list');
  const [campaignDetail, setCampaignDetail] = useState<string | null>(null);
  
  const { toast } = useToast();
  const { user } = useAuth();
  const { isConnected, loading, emailAccount, aliases, selectedAlias, savedAlias, savingAlias, setSelectedAlias, savePreferredAlias, connectGmail, disconnectGmail } = useGmail();

  // Handle return from builder with template
  useEffect(() => {
    const state = location.state as any;
    if (state?.selectedTemplate) {
      setSelectedTemplate(state.selectedTemplate);
      setContent(state.selectedTemplate.html_content);
      setContentMode('template');
      if (state.returnToStep) {
        setCurrentStep(state.returnToStep);
      }
      // Clear the state
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  // Fetch company ID
  useEffect(() => {
    const fetchCompanyId = async () => {
      if (!user) return;
      
      const { data } = await supabase
        .from('company_users')
        .select('company_id')
        .eq('user_id', user.id)
        .single();
      
      if (data) setCompanyId(data.company_id);
    };
    
    fetchCompanyId();
  }, [user]);

  // Fetch daily limits
  useEffect(() => {
    const fetchLimits = async () => {
      if (!user) return;

      const today = new Date().toISOString().split('T')[0];
      const { data } = await supabase
        .from('email_send_limits')
        .select('sent_count, daily_limit')
        .eq('user_id', user.id)
        .eq('date', today)
        .maybeSingle();

      if (data) {
        setDailyLimit({ sent: data.sent_count, limit: data.daily_limit });
      }
    };

    fetchLimits();
  }, [user]);

  // Fetch templates
  useEffect(() => {
    const fetchTemplates = async () => {
      if (!companyId) return;
      
      const { data } = await supabase
        .from('email_templates')
        .select('*')
        .eq('company_id', companyId)
        .eq('is_active', true)
        .order('created_at', { ascending: false });
      
      if (data) setTemplates(data);
    };
    
    fetchTemplates();
  }, [companyId]);

  // Fetch clients
  useEffect(() => {
    const fetchClients = async () => {
      if (!companyId) return;
      
      const { data } = await supabase
        .from('clients')
        .select('id, name, email')
        .eq('company_id', companyId)
        .not('email', 'is', null)
        .limit(100);
      
      if (data) setClients(data);
    };
    
    fetchClients();
  }, [companyId]);

  // Fetch sent emails
  const fetchSentEmails = async () => {
    if (!user) return;
    setLoadingSentEmails(true);
    
    try {
      const { data, error } = await supabase
        .from('emails')
        .select(`
          id,
          subject,
          recipient_email,
          sent_at,
          status,
          tracking_pixel_id,
          email_events (
            event_type,
            timestamp
          )
        `)
        .order('sent_at', { ascending: false })
        .limit(50);

      if (error) throw error;

      const emailsWithTracking = data?.map(email => ({
        ...email,
        opened: (email.email_events as any[])?.some((e: any) => e.event_type === 'opened'),
        opened_at: (email.email_events as any[])?.find((e: any) => e.event_type === 'opened')?.timestamp
      })) || [];

      setSentEmails(emailsWithTracking);
    } catch (error) {
      console.error('Error fetching sent emails:', error);
    } finally {
      setLoadingSentEmails(false);
    }
  };

  useEffect(() => {
    if (showSentEmails || view === 'list') {
      fetchSentEmails();
    }
  }, [showSentEmails, view, user]);

  // Delete a single sent email record
  const deleteEmails = async (ids: string[]) => {
    if (ids.length === 0) return;
    const { error } = await supabase.from('emails').delete().in('id', ids);
    if (error) {
      toast({ title: 'Erro ao apagar', description: error.message, variant: 'destructive' });
      return;
    }
    setSentEmails(prev => prev.filter(e => !ids.includes(e.id)));
    toast({ title: ids.length > 1 ? 'Campanha apagada' : 'Registro apagado' });
  };

  const addEmail = (email: string) => {
    const trimmed = email.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    
    if (!emailRegex.test(trimmed)) {
      toast({
        title: "Email inválido",
        description: `"${trimmed}" não é um email válido`,
        variant: "destructive"
      });
      return false;
    }
    
    if (recipients.includes(trimmed)) {
      return false;
    }
    
    setRecipients(prev => [...prev, trimmed]);
    return true;
  };

  const handleEmailInput = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      if (addEmail(emailInput)) {
        setEmailInput('');
      }
    }
  };

  const handlePasteEmails = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const text = e.clipboardData.getData('text');
    const emails = text.split(/[,;\n\s]+/).filter(Boolean);
    
    let added = 0;
    emails.forEach(email => {
      if (addEmail(email)) added++;
    });
    
    if (added > 0) {
      toast({ title: `${added} email(s) adicionados` });
    }
  };

  const removeRecipient = (email: string) => {
    setRecipients(prev => prev.filter(e => e !== email));
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const text = await file.text();
    const emails = text.split(/[,;\n\r]+/).map(e => e.trim()).filter(Boolean);
    
    let added = 0;
    emails.forEach(email => {
      if (addEmail(email)) added++;
    });
    
    toast({
      title: "Lista importada",
      description: `${added} de ${emails.length} emails foram adicionados`
    });
    
    e.target.value = '';
  };

  const selectTemplate = (template: any) => {
    setSelectedTemplate(template);
    setContent(template.html_content);
  };

  const sendEmails = async () => {
    if (!isConnected || !user || !companyId) {
      toast({
        title: "Erro",
        description: "Conecte seu email primeiro",
        variant: "destructive"
      });
      return;
    }

    // Check daily limit
    if (dailyLimit.sent + recipients.length > dailyLimit.limit) {
      toast({
        title: "Limite atingido",
        description: `Você pode enviar mais ${dailyLimit.limit - dailyLimit.sent} emails hoje`,
        variant: "destructive"
      });
      return;
    }

    setSending(true);
    let successCount = 0;

    try {
      for (const recipient of recipients) {
        try {
          const { error } = await supabase.functions.invoke('send-email', {
            body: {
              recipient_email: recipient,
              subject,
              content_html: content,
              provider: 'gmail',
              from_email: selectedAlias || emailAccount?.email,
              user_id: user.id,
              company_id: companyId
            }
          });

          if (!error) successCount++;
        } catch (err) {
          console.error(`Error sending to ${recipient}:`, err);
        }
      }

      if (successCount > 0) {
        setSentEmailsCount(successCount);
        setShowSuccessModal(true);
        
        // Reset
        setCurrentStep(1);
        setRecipients([]);
        setSubject('');
        setContent('');
        setSelectedTemplate(null);
        setContentMode(null);
        setDailyLimit(prev => ({ ...prev, sent: prev.sent + successCount }));
        setView('list');
      }
    } catch (error: any) {
      toast({
        title: "Erro ao enviar",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setSending(false);
    }
  };

  const canProceed = () => {
    switch (currentStep) {
      case 1: return recipients.length > 0;
      case 2: return subject.trim().length > 0;
      case 3: return content.trim().length > 0;
      case 4: return true;
      default: return false;
    }
  };

  const nextStep = () => {
    if (canProceed() && currentStep < 4) {
      setCurrentStep(prev => prev + 1);
    }
  };

  const prevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(prev => prev - 1);
    }
  };

  // Navigate to builder with state
  const goToBuilder = () => {
    navigate('/dashboard/email/builder', { 
      state: { fromWizard: true } 
    });
  };

  // Sent emails view
  if (showSentEmails) {
    return (
      <div className="min-h-full bg-background">
        <div className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-10">
          <div className="max-w-5xl mx-auto px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Button variant="ghost" size="icon" onClick={() => setShowSentEmails(false)}>
                  <ChevronLeft className="h-5 w-5" />
                </Button>
                <div>
                  <h1 className="text-lg font-bold text-foreground">Emails Enviados</h1>
                  <p className="text-xs text-muted-foreground">Histórico de envios e rastreamento</p>
                </div>
              </div>
              <Button variant="outline" onClick={fetchSentEmails} disabled={loadingSentEmails}>
                {loadingSentEmails ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Atualizar'}
              </Button>
            </div>
          </div>
        </div>

        <div className="max-w-5xl mx-auto px-6 py-8">
          {loadingSentEmails ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : sentEmails.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="py-16 text-center">
                <Inbox className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
                <p className="text-lg font-medium text-muted-foreground">Nenhum email enviado</p>
                <p className="text-sm text-muted-foreground mb-4">Envie seu primeiro email para ver o histórico aqui</p>
                <Button onClick={() => setShowSentEmails(false)}>
                  <Send className="h-4 w-4 mr-2" />
                  Enviar Email
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {sentEmails.map(email => (
                <Card key={email.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="font-semibold text-foreground truncate">{email.subject}</p>
                        {email.opened ? (
                            <Badge className="bg-green-500/20 text-green-600 dark:text-green-400 dark:text-green-400 border-green-500/30">
                              <Eye className="h-3 w-3 mr-1" />
                              Aberto
                            </Badge>
                          ) : (
                            <Badge variant="outline">
                              <Clock className="h-3 w-3 mr-1" />
                              Não aberto
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Para: <span className="font-medium">{email.recipient_email}</span>
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Enviado em {new Date(email.sent_at).toLocaleString('pt-BR')}
                          {email.opened && email.opened_at && (
                            <> • Aberto em {new Date(email.opened_at).toLocaleString('pt-BR')}</>
                          )}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={email.status === 'sent' ? 'default' : 'secondary'}>
                          {email.status === 'sent' ? 'Enviado' : email.status}
                        </Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Step 1: Recipients
  const renderStep1 = () => (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-foreground mb-2">Para quem você quer enviar?</h2>
        <p className="text-muted-foreground">Digite emails, importe uma lista ou selecione da sua agenda</p>
      </div>

      <div className="space-y-4">
        {/* Input with + button */}
        <div className="flex gap-2">
          <Input
            placeholder="Digite um email e clique em + ou pressione Enter..."
            value={emailInput}
            onChange={e => setEmailInput(e.target.value)}
            onKeyDown={handleEmailInput}
            onPaste={handlePasteEmails}
            className="h-12 text-base flex-1"
          />
          <Button
            variant="default"
            size="icon"
            className="h-12 w-12 shrink-0 text-white"
            style={{ backgroundColor: '#374DA4' }}
            onClick={() => {
              if (addEmail(emailInput)) {
                setEmailInput('');
              }
            }}
            disabled={!emailInput.trim()}
          >
            <Plus className="h-5 w-5" />
          </Button>
        </div>
        
        <div className="flex gap-3">
          <Button
            variant="outline"
            className="flex-1 h-12"
            onClick={() => document.getElementById('file-upload')?.click()}
          >
            <Upload className="h-5 w-5 mr-2" />
            Importar Lista (CSV/TXT)
          </Button>
          <input
            id="file-upload"
            type="file"
            accept=".csv,.txt"
            className="hidden"
            onChange={handleFileUpload}
          />
          
          <Button
            variant="outline"
            className="flex-1 h-12"
            onClick={() => setShowClientPicker(!showClientPicker)}
          >
            <Users className="h-5 w-5 mr-2" />
            Selecionar do Banco de Dados
          </Button>
        </div>
      </div>

      {/* Contact Picker Dialog */}
      <Dialog open={showClientPicker} onOpenChange={setShowClientPicker}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Selecionar Contatos</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              placeholder="Buscar contato..."
              value={clientSearch}
              onChange={e => setClientSearch(e.target.value)}
              className="h-10"
            />
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">{clients.length} contatos com email</p>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  const allEmails = clients.map(c => c.email).filter(Boolean);
                  allEmails.forEach(email => addEmail(email));
                  setShowClientPicker(false);
                }}
              >
                Selecionar todos
              </Button>
            </div>
            <div className="max-h-64 overflow-y-auto space-y-1">
              {clients
                .filter(c => 
                  !clientSearch || 
                  c.name?.toLowerCase().includes(clientSearch.toLowerCase()) ||
                  c.email?.toLowerCase().includes(clientSearch.toLowerCase())
                )
                .map(client => {
                  const isSelected = recipients.includes(client.email?.toLowerCase());
                  return (
                    <button
                      key={client.id}
                      className={`w-full flex items-center justify-between p-3 rounded-lg text-left transition-colors ${
                        isSelected ? 'bg-muted' : 'hover:bg-muted/50'
                      }`}
                      onClick={() => client.email && addEmail(client.email)}
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{client.name}</p>
                        <p className="text-xs text-muted-foreground truncate">{client.email}</p>
                      </div>
                      {isSelected && <Check className="h-4 w-4 text-green-500 shrink-0 ml-2" />}
                    </button>
                  );
                })}
              {clients.length === 0 && (
                <div className="text-center py-8">
                  <Users className="h-8 w-8 mx-auto mb-2 text-muted-foreground/50" />
                  <p className="text-sm text-muted-foreground">Nenhum contato com email cadastrado</p>
                </div>
              )}
            </div>
            <Button 
              className="w-full text-white" 
              style={{ backgroundColor: '#374DA4' }}
              onClick={() => setShowClientPicker(false)}
            >
              Confirmar ({recipients.length} selecionados)
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Recipients list */}
      {recipients.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-medium">{recipients.length} destinatário(s)</p>
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive hover:text-destructive"
                onClick={() => setRecipients([])}
              >
                Limpar todos
              </Button>
            </div>
            <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto">
              {recipients.map(email => (
                <Badge
                  key={email}
                  variant="secondary"
                  className="py-1.5 px-3 pr-2 gap-1"
                >
                  {email}
                  <button
                    onClick={() => removeRecipient(email)}
                    className="ml-1 hover:bg-destructive/20 rounded-full p-0.5"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Inline navigation */}
      {recipients.length > 0 && (
        <div className="flex justify-end pt-2">
          <Button
            onClick={nextStep}
            className="gap-2 text-white"
            style={{ backgroundColor: '#374DA4' }}
          >
            Continuar
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );

  // Step 2: Subject
  const renderStep2 = () => (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-foreground mb-2">Qual será o assunto do email?</h2>
        <p className="text-muted-foreground">Um bom assunto aumenta a taxa de abertura</p>
      </div>
      
      <div className="space-y-4">
        <Input
          placeholder="Ex: Oferta especial para você!"
          value={subject}
          onChange={e => setSubject(e.target.value)}
          className="h-14 text-lg"
        />
        
        <AISubjectHelper
          currentSubject={subject}
          onSelectSubject={setSubject}
        />
      </div>

      {/* Preview */}
      {subject && (
        <Card className="bg-muted/30">
          <CardContent className="p-5">
            <p className="text-xs text-muted-foreground mb-2 uppercase tracking-wide">Preview na caixa de entrada</p>
            <div className="bg-background rounded-lg p-4 border shadow-sm">
              <p className="font-semibold text-sm text-muted-foreground">{selectedAlias || emailAccount?.email || 'seu@email.com'}</p>
              <p className="font-bold text-lg mt-1">{subject}</p>
              <p className="text-muted-foreground mt-1 truncate">
                {content ? content.replace(/<[^>]*>/g, '').substring(0, 80) + '...' : 'Prévia do conteúdo do email...'}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Inline navigation */}
      <div className="flex items-center justify-between pt-2">
        <Button variant="outline" onClick={prevStep} className="gap-2">
          <ChevronLeft className="h-4 w-4" />
          Voltar
        </Button>
        {subject.trim() && (
          <Button onClick={nextStep} className="gap-2 text-white" style={{ backgroundColor: '#374DA4' }}>
            Continuar
            <ChevronRight className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );

  // Step 3: Content
  const renderStep3 = () => (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-foreground mb-2">Como você quer criar o email?</h2>
        <p className="text-muted-foreground">Escolha um template ou crie do zero</p>
      </div>

      {!contentMode ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card 
            className="cursor-pointer hover:shadow-lg transition-all group border-2 hover:border-primary/40"
            onClick={() => setContentMode('template')}
          >
            <CardContent className="p-8 text-center">
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 transition-colors" style={{ backgroundColor: '#374DA415' }}>
                <FileText className="h-8 w-8" style={{ color: '#374DA4' }} />
              </div>
              <h4 className="font-bold text-lg mb-2">Usar Template</h4>
              <p className="text-muted-foreground">
                Escolha um dos seus templates salvos
              </p>
              {templates.length > 0 && (
                <Badge variant="outline" className="mt-3">
                  {templates.length} disponíveis
                </Badge>
              )}
            </CardContent>
          </Card>
          
          <Card 
            className="cursor-pointer hover:shadow-lg transition-all group border-2 hover:border-primary/40"
            onClick={goToBuilder}
          >
            <CardContent className="p-8 text-center">
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 transition-colors" style={{ backgroundColor: '#374DA415' }}>
                <Palette className="h-8 w-8" style={{ color: '#374DA4' }} />
              </div>
              <h4 className="font-bold text-lg mb-2">Criar do Zero</h4>
              <p className="text-muted-foreground">
                Use o construtor visual drag-and-drop
              </p>
              <Badge variant="secondary" className="mt-3">
                <Sparkles className="h-3 w-3 mr-1" />
                Visual Builder
              </Badge>
            </CardContent>
          </Card>
        </div>
      ) : contentMode === 'template' ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Button variant="ghost" onClick={() => { setContentMode(null); setSelectedTemplate(null); setContent(''); }}>
              <ChevronLeft className="h-4 w-4 mr-1" />
              Voltar às opções
            </Button>
            <Button 
              variant="outline" 
              onClick={goToBuilder}
              className="gap-2"
            >
              <Palette className="h-4 w-4" />
              Criar novo template
            </Button>
          </div>
          
          {templates.length > 0 ? (
            <div className="space-y-2">
              {templates.map(template => {
                const isSelected = selectedTemplate?.id === template.id;
                return (
                  <div
                    key={template.id}
                    className={`flex items-center justify-between p-4 rounded-xl border cursor-pointer transition-all ${
                      isSelected 
                        ? 'border-primary bg-primary/5 ring-1 ring-[#374DA4]/20' 
                        : 'hover:bg-muted/50 hover:border-muted-foreground/20'
                    }`}
                    onClick={() => selectTemplate(template)}
                  >
                    <div className="flex-1 min-w-0">
                      <h4 className="font-semibold text-sm">{template.name}</h4>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {template.description || 'Sem descrição'}
                      </p>
                      <Badge variant="outline" className="mt-1.5 text-xs">
                        {template.category}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2 ml-3">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-xs"
                        onClick={(e) => {
                          e.stopPropagation();
                          setPreviewTemplate(template);
                        }}
                      >
                        <Eye className="h-3.5 w-3.5 mr-1" />
                        Pré-visualizar
                      </Button>
                      {isSelected && (
                        <div className="w-5 h-5 rounded-full flex items-center justify-center" style={{ backgroundColor: '#374DA4' }}>
                          <Check className="h-3 w-3 text-white" />
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <Card className="border-dashed border-2">
              <CardContent className="p-12 text-center">
                <FileText className="h-16 w-16 mx-auto mb-4 text-muted-foreground/50" />
                <p className="text-lg font-medium text-muted-foreground mb-2">Nenhum template salvo</p>
                <p className="text-sm text-muted-foreground mb-4">Crie seu primeiro template no construtor visual</p>
                <Button onClick={goToBuilder}>
                  <Palette className="h-4 w-4 mr-2" />
                  Criar Template
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      ) : null}

      {/* Inline navigation */}
      <div className="flex items-center justify-between pt-2">
        <Button variant="outline" onClick={prevStep} className="gap-2">
          <ChevronLeft className="h-4 w-4" />
          Voltar
        </Button>
        {content.trim() && (
          <Button onClick={nextStep} className="gap-2 text-white" style={{ backgroundColor: '#374DA4' }}>
            Continuar
            <ChevronRight className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );

  // Step 4: Review
  const renderStep4 = () => (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-foreground mb-2">Revise antes de enviar</h2>
        <p className="text-muted-foreground">Confira todas as informações estão corretas</p>
      </div>

      <div className="grid gap-6">
        {/* Summary Card */}
        <Card>
          <CardContent className="p-6 space-y-4">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div className="p-4 bg-muted/50 rounded-lg">
                <p className="text-3xl font-bold text-primary">{recipients.length}</p>
                <p className="text-sm text-muted-foreground">Destinatários</p>
              </div>
              <div className="p-4 bg-muted/50 rounded-lg">
                <p className="text-3xl font-bold text-primary">{dailyLimit.limit - dailyLimit.sent}</p>
                <p className="text-sm text-muted-foreground">Restantes hoje</p>
              </div>
              <div className="p-4 bg-muted/50 rounded-lg">
                <div className="flex items-center justify-center gap-2">
                  {isConnected ? (
                    <CheckCircle2 className="h-6 w-6 text-green-500" />
                  ) : (
                    <AlertCircle className="h-6 w-6 text-amber-500" />
                  )}
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  {isConnected ? 'Conectado' : 'Desconectado'}
                </p>
              </div>
            </div>
            
            <div className="border-t pt-4 space-y-3">
              <div className="flex justify-between">
                <span className="text-muted-foreground">De:</span>
                <span className="font-medium">{selectedAlias || emailAccount?.email || 'Não conectado'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Assunto:</span>
                <span className="font-medium truncate max-w-xs">{subject}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Email Preview */}
        <Card>
          <CardContent className="p-6">
            <p className="text-sm font-medium text-muted-foreground mb-3">Preview do email:</p>
            <div 
              className="prose prose-sm max-w-none bg-white dark:bg-card dark:bg-muted/20 rounded-lg border p-6 max-h-64 overflow-y-auto"
              dangerouslySetInnerHTML={{ __html: content || '<p class="text-muted-foreground italic">Sem conteúdo</p>' }}
            />
          </CardContent>
        </Card>

        {/* Tracking info */}
        <Card className="bg-muted/30 border-dashed">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Eye className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="font-medium text-sm">Rastreamento de Abertura</p>
                <p className="text-xs text-muted-foreground">Um pixel invisível será incluído para rastrear quando o email for aberto</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Inline navigation */}
      <div className="flex items-center justify-between pt-2">
        <Button variant="outline" onClick={prevStep} className="gap-2">
          <ChevronLeft className="h-4 w-4" />
          Voltar
        </Button>
        <Button
          onClick={sendEmails}
          disabled={sending || !isConnected}
          className="gap-2 text-white"
          style={{ backgroundColor: '#374DA4' }}
        >
          {sending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Enviando...
            </>
          ) : (
            <>
              <Send className="h-4 w-4" />
              Enviar {recipients.length} Email(s)
            </>
          )}
        </Button>
      </div>
    </div>
  );

  // ---------- Lista de campanhas enviadas (padrão Disparos) ----------
  const campaignGroups = (() => {
    const map = new Map<string, { key: string; subject: string; emails: SentEmail[] }>();
    sentEmails.forEach((e) => {
      const day = (e.sent_at || '').slice(0, 10);
      const key = `${e.subject}__${day}`;
      if (!map.has(key)) map.set(key, { key, subject: e.subject || '(sem assunto)', emails: [] });
      map.get(key)!.emails.push(e);
    });
    return Array.from(map.values()).sort(
      (a, b) => new Date(b.emails[0]?.sent_at || 0).getTime() - new Date(a.emails[0]?.sent_at || 0).getTime()
    );
  })();

  if (view === 'list') {
    const detail = campaignGroups.find((g) => g.key === campaignDetail) || null;

    return (
      <div className="min-h-full bg-[#faf9f7] dark:bg-background p-4 sm:p-6 pb-[13rem] md:pb-32 lg:pb-6 overscroll-contain">
        <div className="max-w-7xl mx-auto space-y-6">
          <div className="flex items-center justify-between gap-3">
            <h1 className="text-xl sm:text-2xl font-bold text-primary">Email Marketing</h1>
            <Button
              onClick={() => { setCampaignDetail(null); setCurrentStep(1); setView('wizard'); }}
              className="bg-primary text-white rounded-full shrink-0 hover:bg-[#2f428d] dark:hover:bg-primary/80"
            >
              <Plus className="h-4 w-4 mr-2" /> Nova Campanha
            </Button>
          </div>

          {detail ? (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-5xl mx-auto">
              <div className="flex flex-wrap items-center justify-between gap-3 mb-6 sm:mb-8">
                <Button variant="ghost" onClick={() => setCampaignDetail(null)} className="rounded-full hover:bg-white/50 dark:hover:bg-white/5">
                  <ChevronLeft className="h-4 w-4 mr-2" /> Voltar
                </Button>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                {[
                  { label: 'Destinatários', value: detail.emails.length },
                  { label: 'Aberturas', value: detail.emails.filter((e) => e.opened).length },
                  {
                    label: 'Taxa de abertura',
                    value: `${Math.round((detail.emails.filter((e) => e.opened).length / Math.max(1, detail.emails.length)) * 100)}%`,
                  },
                  { label: 'Enviado em', value: new Date(detail.emails[0]?.sent_at || Date.now()).toLocaleDateString('pt-BR') },
                ].map((stat, i) => (
                  <div key={i} className="bg-white/50 dark:bg-white/5 backdrop-blur-sm p-5 rounded-2xl border border-white dark:border-white/10 shadow-sm">
                    <p className="text-[10px] font-bold text-gray-400 dark:text-foreground/50 uppercase tracking-widest mb-1">{stat.label}</p>
                    <p className="text-xl font-bold text-gray-900 dark:text-foreground">{stat.value}</p>
                  </div>
                ))}
              </div>

              <section>
                <h3 className="text-[10px] font-black text-gray-400 dark:text-foreground/50 uppercase tracking-widest mb-4 px-1">{detail.subject}</h3>
                <div className="space-y-0 relative before:absolute before:left-[17px] before:top-2 before:bottom-2 before:w-[1px] before:bg-gray-100 dark:before:bg-white/10">
                  {detail.emails.map((e) => (
                    <div key={e.id} className="relative pl-12 pb-6 group">
                      <div className={`absolute left-0 top-1 w-[35px] h-[35px] rounded-full border-4 border-[#faf9f7] dark:border-background flex items-center justify-center z-10 ${e.opened ? 'bg-green-500' : 'bg-gray-300'}`}>
                        {e.opened ? <Eye className="h-3.5 w-3.5 text-white" /> : <Clock className="h-3.5 w-3.5 text-white" />}
                      </div>
                      <div className="flex items-center justify-between gap-3 group-hover:bg-white/40 dark:group-hover:bg-white/5 p-2 -m-2 rounded-xl transition-colors">
                        <div className="flex flex-col">
                          <span className="text-sm font-bold text-gray-900 dark:text-foreground">{e.recipient_email}</span>
                          <span className="text-[10px] text-gray-400 dark:text-foreground/50 mt-0.5">
                            {new Date(e.sent_at).toLocaleString('pt-BR')}
                            {e.opened && e.opened_at && ` • aberto em ${new Date(e.opened_at).toLocaleString('pt-BR')}`}
                          </span>
                        </div>
                        <Badge variant="secondary" className={`text-[10px] ${e.opened ? 'bg-green-50 dark:bg-green-500/15 text-green-600 dark:text-green-400' : 'bg-gray-50 dark:bg-white/5 text-gray-500 dark:text-muted-foreground'}`}>
                          {e.opened ? 'Aberto' : 'Não aberto'}
                        </Badge>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 rounded-full text-gray-300 dark:text-white/35 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50"
                          onClick={async (ev) => {
                            ev.stopPropagation();
                            await deleteEmails([e.id]);
                            if (detail && detail.emails.length <= 1) setCampaignDetail(null);
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          ) : (
            <Card className="rounded-2xl border-none shadow-sm overflow-x-auto">
              <Table className="min-w-[720px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>Campanha</TableHead>
                    <TableHead>Destinatários</TableHead>
                    <TableHead>Aberturas</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Taxa</TableHead>
                    <TableHead className="w-12" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loadingSentEmails ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-16">
                        <Loader2 className="h-6 w-6 animate-spin text-gray-300 dark:text-white/35 mx-auto" />
                      </TableCell>
                    </TableRow>
                  ) : campaignGroups.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-16 text-sm text-gray-400 dark:text-foreground/50 italic">
                        Nenhuma campanha enviada ainda
                      </TableCell>
                    </TableRow>
                  ) : campaignGroups.map((g) => {
                    const opened = g.emails.filter((e) => e.opened).length;
                    const rate = Math.round((opened / Math.max(1, g.emails.length)) * 100);
                    return (
                      <TableRow
                        key={g.key}
                        className="cursor-pointer hover:bg-gray-50/50 dark:hover:bg-white/5 transition-colors"
                        onClick={() => setCampaignDetail(g.key)}
                      >
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-medium text-gray-900 dark:text-foreground">{g.subject}</span>
                            <span className="text-[10px] text-gray-400 dark:text-foreground/50">{new Date(g.emails[0]?.sent_at).toLocaleString('pt-BR')}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5">
                            <Users className="h-3.5 w-3.5 text-gray-400 dark:text-foreground/50" />
                            <span className="text-sm font-medium">{g.emails.length}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5">
                            <Eye className="h-3.5 w-3.5 text-gray-400 dark:text-foreground/50" />
                            <span className="text-sm font-medium">{opened}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="text-[10px] bg-green-50 dark:bg-green-500/15 text-green-600 dark:text-green-400">Enviado</Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex flex-col items-end gap-1">
                            <span className="text-sm font-bold text-primary">{rate}%</span>
                            <Progress value={rate} className="h-1 w-20" />
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 rounded-full text-gray-300 dark:text-white/35 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50"
                            onClick={(ev) => {
                              ev.stopPropagation();
                              if (confirm(`Apagar a campanha "${g.subject}" e seus ${g.emails.length} registro(s)?`)) {
                                deleteEmails(g.emails.map((e) => e.id));
                              }
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </Card>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-[#faf9f7] dark:bg-background">
      {/* Success Modal */}
      <Dialog open={showSuccessModal} onOpenChange={setShowSuccessModal}>
        <DialogContent className="sm:max-w-md text-center">
          <div className="py-6">
            <div className="w-20 h-20 bg-green-100 dark:bg-green-500/20 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
              <PartyPopper className="h-10 w-10 text-green-600 dark:text-green-400 dark:text-green-400" />
            </div>
            <DialogHeader>
              <DialogTitle className="text-2xl font-bold text-center">
                Emails Enviados! 🎉
              </DialogTitle>
            </DialogHeader>
            <p className="text-muted-foreground mt-2">
              {sentEmailsCount} email(s) foram enviados com sucesso.
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              Você pode acompanhar as aberturas na página de emails enviados.
            </p>
            <div className="flex gap-3 mt-6 justify-center">
              <Button variant="outline" onClick={() => setShowSuccessModal(false)}>
                Enviar outro
              </Button>
              <Button onClick={() => { setShowSuccessModal(false); setShowSentEmails(true); }}>
                <MailCheck className="h-4 w-4 mr-2" />
                Ver enviados
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Top bar - just settings icon */}
      <div className="sticky top-0 z-10 bg-[#faf9f7] dark:bg-background">
        <div className="max-w-3xl mx-auto px-6 py-3 flex items-center justify-between">
          <Button variant="ghost" size="sm" className="rounded-full hover:bg-white/60 dark:hover:bg-white/5" onClick={() => setView('list')}>
            <ChevronLeft className="h-4 w-4 mr-2" /> Campanhas
          </Button>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="sm" className="h-7 px-2 relative">
                <Settings className="h-4 w-4 mr-1" />
                <span className="hidden sm:inline text-xs">Configurações</span>
                <span className={`absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full ${
                  isConnected ? 'bg-green-500' : 'bg-red-500'
                }`} />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-72 p-4" align="end">
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                    isConnected ? 'bg-green-500/10' : 'bg-red-500/10'
                  }`}>
                    <Mail className={`h-5 w-5 ${isConnected ? 'text-green-600 dark:text-green-400' : 'text-red-500'}`} />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium">
                      {isConnected ? 'Conectado' : 'Desconectado'}
                    </p>
                    {isConnected && emailAccount?.email && (
                      <p className="text-xs text-muted-foreground truncate">
                        {selectedAlias || emailAccount.email}
                      </p>
                    )}
                  </div>
                </div>
                {isConnected && aliases.length > 1 && (
                  <div className="space-y-1">
                    <span className="text-xs text-muted-foreground">Enviar como:</span>
                    <select
                      value={selectedAlias || emailAccount?.email}
                      onChange={(e) => setSelectedAlias(e.target.value)}
                      className="w-full text-sm rounded-md border border-border bg-background px-2 py-1.5"
                    >
                      {aliases.map((alias) => (
                        <option key={alias.email} value={alias.email}>
                          {alias.displayName ? `${alias.displayName} <${alias.email}>` : alias.email}
                        </option>
                      ))}
                    </select>
                    {selectedAlias && selectedAlias !== savedAlias && (
                      <Button
                        size="sm"
                        className="w-full mt-1 gap-2"
                        onClick={() => savePreferredAlias(selectedAlias)}
                        disabled={savingAlias}
                      >
                        {savingAlias ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Save className="h-4 w-4" />
                        )}
                        Salvar como padrão
                      </Button>
                    )}
                  </div>
                )}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Limite diário</span>
                    <Badge variant="outline">{dailyLimit.sent}/{dailyLimit.limit}</Badge>
                  </div>
                  <Progress value={(dailyLimit.sent / dailyLimit.limit) * 100} className="h-1.5" />
                </div>
                {isConnected ? (
                  <Button 
                    variant="outline" 
                    className="w-full" 
                    onClick={disconnectGmail}
                    disabled={loading}
                  >
                    {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                    Desconectar Gmail
                  </Button>
                ) : (
                  <Button 
                    className="w-full text-white" 
                    onClick={connectGmail}
                    disabled={loading}
                    style={{ backgroundColor: '#374DA4' }}
                  >
                    {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                    Conectar Gmail
                  </Button>
                )}
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-3xl mx-auto px-6 py-10">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentStep}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.25 }}
          >
            {currentStep === 1 && renderStep1()}
            {currentStep === 2 && renderStep2()}
            {currentStep === 3 && renderStep3()}
            {currentStep === 4 && renderStep4()}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Template Preview Dialog */}
      <Dialog open={!!previewTemplate} onOpenChange={() => setPreviewTemplate(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>{previewTemplate?.name || 'Preview do Template'}</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto">
            {previewTemplate?.html_content ? (
              <iframe
                srcDoc={previewTemplate.html_content}
                className="w-full min-h-[500px] border rounded-lg"
                title="Template Preview"
                style={{ backgroundColor: '#ffffff' }}
              />
            ) : (
              <p className="text-center text-muted-foreground py-12">Sem conteúdo para exibir</p>
            )}
          </div>
          <div className="flex justify-end gap-2 pt-3 border-t">
            <Button variant="outline" onClick={() => setPreviewTemplate(null)}>
              Fechar
            </Button>
            <Button 
              className="bg-primary hover:bg-[#2500B8] text-white dark:hover:bg-primary/80"
              onClick={() => {
                selectTemplate(previewTemplate);
                setPreviewTemplate(null);
              }}
            >
              <Check className="h-4 w-4 mr-2" />
              Usar este template
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CleanEmailMarketing;
