import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Phone, Mail, Building2, User, Calendar, MessageSquare, Copy, ExternalLink, Tag } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface ContactProfilePanelProps {
  contactPhone: string;
  contactName?: string;
  profilePicture?: string;
  companyId: string;
  labels?: string[];
  conversationStatus?: string;
  createdAt?: string;
  onClose: () => void;
  onCopyPhone?: (phone: string) => void;
}

interface ClientInfo {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  company_name?: string;
  tags?: string[];
  notes?: string;
  created_at: string;
  status: string;
}

const ContactProfilePanel: React.FC<ContactProfilePanelProps> = ({
  contactPhone,
  contactName,
  profilePicture,
  companyId,
  labels,
  conversationStatus,
  createdAt,
  onClose,
  onCopyPhone,
}) => {
  const { toast } = useToast();
  const [clientInfo, setClientInfo] = useState<ClientInfo | null>(null);
  const [messageCount, setMessageCount] = useState(0);
  const [conversationCount, setConversationCount] = useState(0);

  useEffect(() => {
    loadContactData();
  }, [contactPhone, companyId]);

  const loadContactData = async () => {
    // Try to find in clients table
    const normalizedPhone = contactPhone.replace(/\D/g, '');
    const { data: client } = await supabase
      .from('clients')
      .select('*')
      .eq('company_id', companyId)
      .or(`phone.ilike.%${normalizedPhone.slice(-8)}%,whatsapp.ilike.%${normalizedPhone.slice(-8)}%`)
      .limit(1)
      .maybeSingle();

    if (client) setClientInfo(client as ClientInfo);

    // Count messages
    const { count: msgCount } = await supabase
      .from('whatsapp_messages')
      .select('*', { count: 'exact', head: true })
      .eq('company_id', companyId)
      .eq('conversation_id', (await supabase
        .from('whatsapp_conversations')
        .select('id')
        .eq('company_id', companyId)
        .eq('contact_phone', contactPhone)
        .limit(1)
        .single()
      ).data?.id || '');

    setMessageCount(msgCount || 0);

    // Count conversations
    const { count: convCount } = await supabase
      .from('whatsapp_conversations')
      .select('*', { count: 'exact', head: true })
      .eq('company_id', companyId)
      .eq('contact_phone', contactPhone);

    setConversationCount(convCount || 0);
  };

  const formatPhoneNumber = (phone: string) => {
    const clean = phone.replace(/\D/g, '');
    if (clean.length === 13 && clean.startsWith('55')) {
      return `+${clean.slice(0, 2)} (${clean.slice(2, 4)}) ${clean.slice(4, 9)}-${clean.slice(9)}`;
    }
    if (clean.length === 12 && clean.startsWith('55')) {
      return `+${clean.slice(0, 2)} (${clean.slice(2, 4)}) ${clean.slice(4, 8)}-${clean.slice(8)}`;
    }
    return `+${clean}`;
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: 'Copiado!' });
  };

  const displayName = contactName || clientInfo?.name || 'Contato';
  const initials = displayName.substring(0, 2).toUpperCase();

  const content = (
    <div
      className="fixed inset-0 z-[120] flex items-end sm:items-center justify-center p-0 sm:p-6 animate-in fade-in duration-200"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-md" />

      {/* Modal */}
      <div
        onClick={(e) => e.stopPropagation()}
        className={cn(
          "relative z-10 w-full sm:max-w-md bg-card/95 backdrop-blur-2xl border border-white/10 shadow-2xl flex flex-col",
          "h-[92vh] sm:h-auto sm:max-h-[88vh] rounded-t-3xl sm:rounded-3xl overflow-hidden",
          "animate-in slide-in-from-bottom-6 sm:slide-in-from-bottom-0 sm:zoom-in-95 duration-300"
        )}
      >
        {/* Drag handle (mobile) */}
        <div className="sm:hidden flex justify-center pt-2.5 pb-1">
          <div className="w-10 h-1.5 rounded-full bg-muted-foreground/30" />
        </div>

        {/* Header */}
        <div className="h-14 flex items-center justify-between px-5 flex-shrink-0">
          <h3 className="font-semibold text-sm">Info. do contato</h3>
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 rounded-full bg-muted/60 hover:bg-muted backdrop-blur-md border border-border/40"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <ScrollArea className="flex-1">
        <div className="flex flex-col items-center pt-8 pb-4 px-4">
          {/* Profile Picture */}
          <Avatar className="h-28 w-28 mb-4">
            <AvatarImage src={profilePicture} />
            <AvatarFallback className="bg-gradient-to-br from-[#374DA4] to-[#253573] text-white text-3xl font-medium">
              {initials}
            </AvatarFallback>
          </Avatar>

          {/* Name */}
          <h2 className="text-xl font-semibold text-center">{displayName}</h2>
          <p className="text-sm text-muted-foreground mt-1">{formatPhoneNumber(contactPhone)}</p>

          {/* Status */}
          {conversationStatus && (
            <Badge 
              className={cn(
                "mt-3",
                conversationStatus === 'open' ? 'bg-[#374DA4] text-white' : ''
              )}
              variant={conversationStatus === 'open' ? 'default' : 'secondary'}
            >
              {conversationStatus === 'open' ? 'Conversa aberta' : conversationStatus === 'closed' ? 'Resolvida' : 'Arquivada'}
            </Badge>
          )}
        </div>

        <Separator />

        {/* Quick Actions */}
        <div className="flex justify-center gap-6 py-4">
          <button
            onClick={() => handleCopy(contactPhone)}
            className="flex flex-col items-center gap-1.5 text-muted-foreground hover:text-[#374DA4] transition-colors"
          >
            <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
              <Copy className="h-4 w-4" />
            </div>
            <span className="text-[11px]">Copiar</span>
          </button>
          <a
            href={`https://wa.me/${contactPhone.replace(/\D/g, '')}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex flex-col items-center gap-1.5 text-muted-foreground hover:text-[#374DA4] transition-colors"
          >
            <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
              <ExternalLink className="h-4 w-4" />
            </div>
            <span className="text-[11px]">Abrir WA</span>
          </a>
          <a
            href={`tel:+${contactPhone.replace(/\D/g, '')}`}
            className="flex flex-col items-center gap-1.5 text-muted-foreground hover:text-[#374DA4] transition-colors"
          >
            <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
              <Phone className="h-4 w-4" />
            </div>
            <span className="text-[11px]">Ligar</span>
          </a>
        </div>

        <Separator />

        {/* Details */}
        <div className="px-4 py-4 space-y-4">
          <h4 className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">Detalhes</h4>

          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <Phone className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground">Telefone</p>
                <p className="text-sm font-medium">{formatPhoneNumber(contactPhone)}</p>
              </div>
            </div>

            {clientInfo?.email && (
              <div className="flex items-start gap-3">
                <Mail className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground">Email</p>
                  <p className="text-sm font-medium">{clientInfo.email}</p>
                </div>
              </div>
            )}

            {clientInfo?.company_name && (
              <div className="flex items-start gap-3">
                <Building2 className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground">Empresa</p>
                  <p className="text-sm font-medium">{clientInfo.company_name}</p>
                </div>
              </div>
            )}

            {createdAt && (
              <div className="flex items-start gap-3">
                <Calendar className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground">Primeira conversa</p>
                  <p className="text-sm font-medium">
                    {format(new Date(createdAt), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                  </p>
                </div>
              </div>
            )}

            <div className="flex items-start gap-3">
              <MessageSquare className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground">Mensagens trocadas</p>
                <p className="text-sm font-medium">{messageCount}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Labels */}
        {labels && labels.length > 0 && (
          <>
            <Separator />
            <div className="px-4 py-4">
              <h4 className="text-xs font-semibold uppercase text-muted-foreground tracking-wider mb-3">Etiquetas</h4>
              <div className="flex flex-wrap gap-1.5">
                {labels.map((label, i) => (
                  <Badge key={i} variant="outline" className="text-xs">
                    <Tag className="h-3 w-3 mr-1" />
                    {label}
                  </Badge>
                ))}
              </div>
            </div>
          </>
        )}

        {/* Notes from CRM */}
        {clientInfo?.notes && (
          <>
            <Separator />
            <div className="px-4 py-4">
              <h4 className="text-xs font-semibold uppercase text-muted-foreground tracking-wider mb-2">Observações</h4>
              <p className="text-sm text-muted-foreground">{clientInfo.notes}</p>
            </div>
          </>
        )}

        {/* CRM Tags */}
        {clientInfo?.tags && clientInfo.tags.length > 0 && (
          <>
            <Separator />
            <div className="px-4 py-4">
              <h4 className="text-xs font-semibold uppercase text-muted-foreground tracking-wider mb-3">Tags CRM</h4>
              <div className="flex flex-wrap gap-1.5">
                {clientInfo.tags.map((tag, i) => (
                  <Badge key={i} variant="secondary" className="text-xs">{tag}</Badge>
                ))}
              </div>
            </div>
          </>
        )}

        <div className="h-6" />
      </ScrollArea>
      </div>
    </div>
  );

  if (typeof document === 'undefined') return null;
  return createPortal(content, document.body);
};

export default ContactProfilePanel;
