import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { useGmail } from '@/hooks/useGmail';
import { Send, X, Plus, Mail, CheckCircle2, AlertCircle, Loader2, Upload } from 'lucide-react';
import { useEmailTemplates } from '@/hooks/useEmailTemplates';

const OMNI_COLOR = '#374DA4';

const EmailComposer = () => {
  const [fromEmail, setFromEmail] = useState('');
  const [fromName, setFromName] = useState('');
  const [recipients, setRecipients] = useState<string[]>([]);
  const [currentRecipient, setCurrentRecipient] = useState('');
  const [subject, setSubject] = useState('');
  const [htmlContent, setHtmlContent] = useState('');
  const [textContent, setTextContent] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [sendType, setSendType] = useState<'single' | 'bulk'>('single');
  
  const { toast } = useToast();
  const { templates } = useEmailTemplates();
  const { user } = useAuth();
  const { isConnected, emailAccount, aliases, selectedAlias, setSelectedAlias } = useGmail();

  useEffect(() => {
    if (isConnected && selectedAlias) {
      setFromEmail(selectedAlias);
    } else if (isConnected && emailAccount) {
      setFromEmail(emailAccount.email);
    }
  }, [isConnected, emailAccount, selectedAlias]);

  const addRecipient = () => {
    if (currentRecipient && !recipients.includes(currentRecipient)) {
      setRecipients([...recipients, currentRecipient]);
      setCurrentRecipient('');
    }
  };

  const removeRecipient = (email: string) => {
    setRecipients(recipients.filter(r => r !== email));
  };

  const handleTemplateSelect = (templateId: string) => {
    const template = templates.find(t => t.id === templateId);
    if (template) {
      setHtmlContent(template.html_content);
      setSubject(template.name);
      setSelectedTemplate(templateId);
    }
  };

  const handleSendEmail = async () => {
    if (!subject || recipients.length === 0) {
      toast({
        title: "Campos obrigatórios",
        description: "Preencha assunto e adicione pelo menos um destinatário",
        variant: "destructive"
      });
      return;
    }

    if (!isConnected) {
      toast({
        title: "Gmail não conectado",
        description: "Conecte seu Gmail nas Configurações para enviar emails",
        variant: "destructive"
      });
      return;
    }

    setIsSending(true);

    try {
      let successCount = 0;
      let errorCount = 0;

      for (const recipient of recipients) {
        const { error } = await supabase.functions.invoke('send-email', {
          body: {
            recipient_email: recipient,
            subject,
            content_html: htmlContent || `<p>${textContent}</p>`,
            content_text: textContent,
            from_email: fromEmail,
            from_name: fromName,
            provider: 'gmail',
            user_id: user?.id
          }
        });

        if (error) {
          console.error('Erro ao enviar email:', error);
          errorCount++;
        } else {
          successCount++;
        }
      }

      if (successCount > 0) {
        toast({
          title: "Emails enviados!",
          description: `${successCount} email(s) enviado(s) com sucesso${errorCount > 0 ? `, ${errorCount} falhou` : ''}`
        });

        setRecipients([]);
        setSubject('');
        setHtmlContent('');
        setTextContent('');
        setSelectedTemplate('');
      } else {
        throw new Error('Nenhum email foi enviado');
      }

    } catch (error: any) {
      toast({
        title: "Erro ao enviar",
        description: error.message || "Erro ao enviar emails",
        variant: "destructive"
      });
    } finally {
      setIsSending(false);
    }
  };

  const handleBulkUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target?.result as string;
        const emails = text.split('\n')
          .map(line => line.trim())
          .filter(line => line.includes('@'));
        
        setRecipients(prev => [...new Set([...prev, ...emails])]);
      };
      reader.readAsText(file);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">Novo Email</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Crie e envie mensagens personalizadas para seus contatos.
          </p>
        </div>
        <div className="flex bg-gray-100 dark:bg-white/5 p-1 rounded-xl">
          <Button 
            variant={sendType === 'single' ? 'secondary' : 'ghost'} 
            size="sm"
            onClick={() => setSendType('single')}
            className={`rounded-lg text-xs ${sendType === 'single' ? 'bg-white shadow-sm' : ''}`}
          >
            Individual
          </Button>
          <Button 
            variant={sendType === 'bulk' ? 'secondary' : 'ghost'} 
            size="sm"
            onClick={() => setSendType('bulk')}
            className={`rounded-lg text-xs ${sendType === 'bulk' ? 'bg-white shadow-sm' : ''}`}
          >
            Em Massa
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="fromName" className="text-[13px] font-semibold text-foreground">Remetente (Nome)</Label>
            <Input
              id="fromName"
              placeholder="Seu Nome ou Empresa"
              value={fromName}
              onChange={(e) => setFromName(e.target.value)}
              className="rounded-2xl bg-gray-50/50 dark:bg-white/5 border-border/40 focus:bg-white transition-all h-11"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-[13px] font-semibold text-foreground">Email de Origem</Label>
            <Select value={fromEmail} onValueChange={setFromEmail}>
              <SelectTrigger className="rounded-2xl bg-gray-50/50 dark:bg-white/5 border-border/40 focus:bg-white transition-all h-11 text-sm">
                <SelectValue placeholder="Selecione o email" />
              </SelectTrigger>
              <SelectContent className="rounded-2xl border-border/40">
                {emailAccount && <SelectItem value={emailAccount.email}>{emailAccount.email}</SelectItem>}
                {aliases.map((alias) => (
                  <SelectItem key={typeof alias === 'string' ? alias : alias.email} value={typeof alias === 'string' ? alias : alias.email}>
                    {typeof alias === 'string' ? alias : (alias.displayName ? `${alias.displayName} <${alias.email}>` : alias.email)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="recipients" className="text-[13px] font-semibold text-foreground">Destinatários</Label>
            <div className="space-y-3">
              <div className="flex gap-2">
                <Input
                  id="recipients"
                  type="email"
                  placeholder="email@exemplo.com"
                  value={currentRecipient}
                  onChange={(e) => setCurrentRecipient(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addRecipient()}
                  className="rounded-2xl bg-gray-50/50 dark:bg-white/5 border-border/40 focus:bg-white transition-all h-11"
                />
                <Button 
                  onClick={addRecipient} 
                  variant="outline" 
                  className="rounded-2xl h-11 px-6 border-border/40"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              
              {sendType === 'bulk' && (
                <div className="relative">
                  <Input
                    type="file"
                    accept=".txt,.csv"
                    onChange={handleBulkUpload}
                    className="cursor-pointer rounded-2xl bg-[#374DA4]/5 border-dashed border-[#374DA4]/20 hover:bg-[#374DA4]/10 transition-colors h-24 pt-8"
                  />
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <Upload className="h-5 w-5 text-[#374DA4] mb-1" />
                    <span className="text-xs font-medium text-[#374DA4]">Upload de lista (.txt / .csv)</span>
                  </div>
                </div>
              )}

              {recipients.length > 0 && (
                <div className="flex flex-wrap gap-2 p-3 bg-gray-50 dark:bg-white/5 rounded-2xl border border-border/40 min-h-[60px]">
                  {recipients.map((email) => (
                    <Badge key={email} variant="secondary" className="pl-3 pr-1 py-1 rounded-xl bg-white dark:bg-white/10 border-border/40 gap-1 text-[11px] font-medium">
                      {email}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-5 w-5 rounded-full hover:bg-red-50 hover:text-red-500"
                        onClick={() => removeRecipient(email)}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="template" className="text-[13px] font-semibold text-foreground">Template</Label>
            <Select value={selectedTemplate} onValueChange={handleTemplateSelect}>
              <SelectTrigger className="rounded-2xl bg-gray-50/50 dark:bg-white/5 border-border/40 focus:bg-white transition-all h-11 text-sm">
                <SelectValue placeholder="Selecione um template (opcional)" />
              </SelectTrigger>
              <SelectContent className="rounded-2xl border-border/40">
                {templates.map((t) => (
                  <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="subject" className="text-[13px] font-semibold text-foreground">Assunto</Label>
            <Input
              id="subject"
              placeholder="O assunto do seu email"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="rounded-2xl bg-gray-50/50 dark:bg-white/5 border-border/40 focus:bg-white transition-all h-11"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="htmlContent" className="text-[13px] font-semibold text-foreground">Conteúdo HTML</Label>
            <Textarea
              id="htmlContent"
              placeholder="<h1>Seu email aqui...</h1>"
              value={htmlContent}
              onChange={(e) => setHtmlContent(e.target.value)}
              className="rounded-2xl bg-gray-50/50 dark:bg-white/5 border-border/40 focus:bg-white transition-all min-h-[160px] font-mono text-sm"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="textContent" className="text-[13px] font-semibold text-foreground">Texto (Fallback)</Label>
            <Textarea
              id="textContent"
              placeholder="Versão simples em texto"
              value={textContent}
              onChange={(e) => setTextContent(e.target.value)}
              className="rounded-2xl bg-gray-50/50 dark:bg-white/5 border-border/40 focus:bg-white transition-all min-h-[80px]"
            />
          </div>
        </div>
      </div>

      <div className="pt-6 border-t border-border/40">
        <Button 
          onClick={handleSendEmail} 
          disabled={isSending || !isConnected}
          className="w-full rounded-2xl text-white h-14 text-base font-bold shadow-lg shadow-[#374DA4]/20 hover:shadow-[#374DA4]/30 transition-all active:scale-[0.98]"
          style={{ backgroundColor: OMNI_COLOR }}
        >
          {isSending ? (
            <>
              <Loader2 className="h-5 w-5 mr-3 animate-spin" />
              Processando envios...
            </>
          ) : (
            <>
              <Send className="h-5 w-5 mr-3" />
              Enviar para {recipients.length || 0} destinatário{recipients.length !== 1 ? 's' : ''}
            </>
          )}
        </Button>
        {!isConnected && (
          <p className="text-[11px] text-amber-600 font-medium text-center mt-3 flex items-center justify-center gap-1">
            <AlertCircle className="h-3 w-3" />
            Conecte seu Gmail nas configurações para habilitar o envio.
          </p>
        )}
      </div>
    </div>
  );
};

export default EmailComposer;