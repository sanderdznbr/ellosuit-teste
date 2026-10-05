
import React, { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Search, MoreHorizontal, Settings, FileText, Eye, Mail } from 'lucide-react';

interface EmailTracking {
  id: string;
  recipient_email: string;
  recipient_name: string;
  subject: string;
  sent_at: string;
  campaign_id: string | null;
  email_events: Array<{
    event_type: string;
    timestamp: string;
  }>;
}

const MailTracking = () => {
  const [emails, setEmails] = useState<EmailTracking[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [selectedEmail, setSelectedEmail] = useState<EmailTracking | null>(null);
  const { toast } = useToast();

  const fetchEmails = async () => {
    try {
      const { data, error } = await supabase
        .from('emails')
        .select(`
          id,
          recipient_email,
          recipient_name,
          subject,
          sent_at,
          campaign_id,
          email_events (
            event_type,
            timestamp
          )
        `)
        .order('sent_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      setEmails(data || []);
    } catch (error) {
      console.error('Error fetching emails:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchEmails();

    const channel = supabase
      .channel('email-tracking')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'emails'
      }, () => {
        fetchEmails();
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'email_events'
      }, () => {
        fetchEmails();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const getOpenCount = (events: Array<{event_type: string}>) => {
    return events?.filter(event => event.event_type === 'opened').length || 0;
  };

  const getListBadge = (campaignId: string | null) => {
    if (!campaignId) return { label: 'Individual', color: 'bg-gray-100 dark:bg-white/10 text-gray-600 dark:text-gray-400' };
    
    return { label: 'Campanha', color: 'bg-[#374DA4]/10 text-[#374DA4]' };
  };

  const filteredEmails = emails.filter(email => 
    email.recipient_email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    email.subject.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleExportReport = () => {
    toast({ title: "Exportar", description: "O relatório está sendo gerado..." });
  };

  const handleViewDetails = (email: EmailTracking) => {
    setSelectedEmail(email);
  };

  const handleDeleteEmail = async (id: string) => {
    try {
      const { error } = await supabase
        .from('emails')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      
      toast({ title: "Excluído", description: "Registro removido com sucesso" });
      fetchEmails();
    } catch (error) {
      toast({ title: "Erro", description: "Não foi possível excluir o registro", variant: "destructive" });
    }
  };

  return (
    <div className="bg-white dark:bg-black/20 min-h-[600px] animate-in fade-in duration-500">
      <div className="p-8 border-b border-border/40 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">Histórico de Envios</h2>
          <p className="text-sm text-muted-foreground mt-1">Acompanhe o status e a atividade dos seus emails em tempo real.</p>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input
              placeholder="Buscar por email ou assunto..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 w-full md:w-72 rounded-2xl bg-gray-50/50 dark:bg-white/5 border-border/40 focus:bg-white transition-all h-10"
            />
          </div>
          <Button 
            variant="outline" 
            size="icon"
            onClick={() => toast({ title: "Filtros", description: "Filtros avançados em breve" })}
            className="rounded-xl border-border/40 h-10 w-10"
          >
            <Settings className="h-4 w-4 text-muted-foreground" />
          </Button>
          <Button 
            variant="outline" 
            size="icon"
            onClick={handleExportReport}
            className="rounded-xl border-border/40 h-10 w-10"
            title="Exportar Relatório"
          >
            <FileText className="h-4 w-4 text-muted-foreground" />
          </Button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <Table>
          <TableHeader className="bg-gray-50/50 dark:bg-white/5 border-b border-border/40">
            <TableRow className="hover:bg-transparent">
              <TableHead className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest px-8 py-4">Destinatário</TableHead>
              <TableHead className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest px-8 py-4">Assunto</TableHead>
              <TableHead className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest px-8 py-4">Atividade</TableHead>
              <TableHead className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest px-8 py-4">Status</TableHead>
              <TableHead className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest px-8 py-4 text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i} className="border-b border-border/40">
                  <TableCell colSpan={5} className="p-8">
                    <div className="animate-pulse h-12 bg-gray-100 dark:bg-white/5 rounded-2xl w-full"></div>
                  </TableCell>
                </TableRow>
              ))
            ) : filteredEmails.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-20">
                  <div className="flex flex-col items-center justify-center space-y-3">
                    <Mail className="h-10 w-10 text-muted-foreground/30" />
                    <p className="text-sm font-medium text-muted-foreground">Nenhum registro encontrado</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              filteredEmails.map((email) => {
                const openCount = getOpenCount(email.email_events);
                const listBadge = getListBadge(email.campaign_id);
                
                return (
                  <TableRow key={email.id} className="group hover:bg-gray-50/50 dark:hover:bg-white/5 border-b border-border/40 transition-colors">
                    <TableCell className="px-8 py-4">
                      <div className="flex flex-col">
                        <span className="text-sm font-semibold text-foreground">{email.recipient_email}</span>
                        <span className="text-xs text-muted-foreground">{email.recipient_name || 'Sem nome'}</span>
                      </div>
                    </TableCell>
                    <TableCell className="px-8 py-4">
                      <div className="flex flex-col">
                        <span className="text-sm font-medium text-foreground max-w-[200px] truncate">{email.subject}</span>
                        <span className="text-[11px] text-muted-foreground">
                          {new Date(email.sent_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="px-8 py-4">
                      <div className="flex items-center gap-2">
                        <div className="flex items-center justify-center h-6 w-12 bg-green-500/10 text-green-600 text-[10px] font-bold rounded-md">
                          {openCount}
                        </div>
                        <span className="text-xs text-muted-foreground">Aberturas</span>
                      </div>
                    </TableCell>
                    <TableCell className="px-8 py-4">
                      <Badge className={`${listBadge.color} border-0 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md`}>
                        {listBadge.label}
                      </Badge>
                    </TableCell>
                    <TableCell className="px-8 py-4 text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-8 w-8 rounded-lg p-0">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="rounded-2xl border-border/40 shadow-xl">
                          <DropdownMenuItem onClick={() => handleViewDetails(email)} className="rounded-xl">
                            <Eye className="h-4 w-4 mr-2" />
                            Ver detalhes
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => toast({ title: "Reenviar", description: "Funcionalidade em desenvolvimento" })} className="rounded-xl">
                            <Mail className="h-4 w-4 mr-2" />
                            Reenviar
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            className="text-red-600 rounded-xl" 
                            onClick={() => handleDeleteEmail(email.id)}
                          >
                            Excluir
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={!!selectedEmail} onOpenChange={(open) => !open && setSelectedEmail(null)}>
        <DialogContent className="max-w-2xl rounded-3xl border-border/40">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold tracking-tight">Detalhes do Email</DialogTitle>
          </DialogHeader>
          {selectedEmail && (
            <div className="space-y-6 pt-4">
              <div className="grid grid-cols-2 gap-6 p-6 bg-gray-50 dark:bg-white/5 rounded-3xl border border-border/40">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest">Destinatário</label>
                  <p className="text-sm font-semibold">{selectedEmail.recipient_email}</p>
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest">Nome</label>
                  <p className="text-sm font-semibold">{selectedEmail.recipient_name || 'N/A'}</p>
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest">Assunto</label>
                  <p className="text-sm font-semibold">{selectedEmail.subject}</p>
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest">Enviado em</label>
                  <p className="text-sm font-semibold">
                    {new Date(selectedEmail.sent_at).toLocaleString('pt-BR')}
                  </p>
                </div>
              </div>
              
              <div className="space-y-4">
                <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Linha do Tempo de Atividade</h4>
                <div className="space-y-2">
                  {selectedEmail.email_events && selectedEmail.email_events.length > 0 ? (
                    selectedEmail.email_events.map((event, index) => (
                      <div key={index} className="flex justify-between items-center p-4 bg-white dark:bg-white/5 rounded-2xl border border-border/40">
                        <div className="flex items-center gap-3">
                          <div className={`h-2 w-2 rounded-full ${event.event_type === 'opened' ? 'bg-green-500' : 'bg-[#374DA4]'}`} />
                          <span className="text-sm font-semibold capitalize">
                            {event.event_type === 'opened' ? 'Aberto' : 
                             event.event_type === 'clicked' ? 'Clicado' : 
                             event.event_type}
                          </span>
                        </div>
                        <span className="text-xs text-muted-foreground font-medium">
                          {new Date(event.timestamp).toLocaleString('pt-BR')}
                        </span>
                      </div>
                    ))
                  ) : (
                    <div className="flex flex-col items-center justify-center p-8 bg-gray-50 dark:bg-white/5 rounded-2xl border border-dashed border-border/40">
                      <p className="text-xs font-medium text-muted-foreground">Nenhuma atividade registrada ainda</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default MailTracking;
