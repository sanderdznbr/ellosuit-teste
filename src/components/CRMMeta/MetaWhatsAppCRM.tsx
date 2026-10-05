import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import AIImproveMessageButton from '@/components/CRM/AIImproveMessageButton';
import { 
  Plus, MessageSquare, Settings, Search, Send, Check, CheckCheck, 
  ArrowLeft, Sparkles, List, Loader2, RefreshCw, Wifi, WifiOff,
  Phone, Copy, ExternalLink, Trash2, MoreVertical, Image as ImageIcon,
  FileText, Mic, Video
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';

// ─── Types ───
interface MetaSession {
  id: string;
  instance_name: string;
  status: string;
  phone_number?: string;
  phone_name?: string;
  phone_number_id?: string;
  waba_id?: string;
  access_token?: string;
  webhook_verify_token?: string;
  profile_picture?: string;
  connected_at?: string;
}

interface MetaConversation {
  id: string;
  contact_phone: string;
  contact_name?: string;
  last_message?: string;
  last_message_at: string;
  unread_count?: number;
  profile_picture?: string;
  pipeline_stage?: string;
}

interface MetaMessage {
  id: string;
  conversation_id: string;
  content: string;
  from_me: boolean;
  status: string;
  created_at: string;
  sender_name?: string;
  message_type?: string;
  media_url?: string;
}

const META_BLUE = '#0084FF';

export default function MetaWhatsAppCRM() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { isMobile } = useIsMobile();
  const navigate = useNavigate();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // State
  const [sessions, setSessions] = useState<MetaSession[]>([]);
  const [activeSession, setActiveSession] = useState<MetaSession | null>(null);
  const [conversations, setConversations] = useState<MetaConversation[]>([]);
  const [selectedConvo, setSelectedConvo] = useState<MetaConversation | null>(null);
  const [messages, setMessages] = useState<MetaMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [sendingMessage, setSendingMessage] = useState(false);
  const [showSetupModal, setShowSetupModal] = useState(false);
  const [showNewChatModal, setShowNewChatModal] = useState(false);
  const [companyId, setCompanyId] = useState<string | null>(null);

  // Setup form
  const [setupForm, setSetupForm] = useState({
    instance_name: 'Meta Business',
    phone_number_id: '',
    waba_id: '',
    access_token: '',
  });
  const [newChatPhone, setNewChatPhone] = useState('');

  // Load company
  useEffect(() => {
    if (!user) return;
    const loadCompany = async () => {
      const { data } = await supabase
        .from('company_users')
        .select('company_id')
        .eq('user_id', user.id)
        .single();
      if (data) setCompanyId(data.company_id);
    };
    loadCompany();
  }, [user]);

  // Load sessions
  useEffect(() => {
    if (!companyId) return;
    const loadSessions = async () => {
      const { data } = await supabase
        .from('meta_whatsapp_sessions')
        .select('*')
        .eq('company_id', companyId)
        .order('created_at', { ascending: false });
      
      if (data && data.length > 0) {
        setSessions(data as MetaSession[]);
        setActiveSession(data[0] as MetaSession);
      }
      setLoading(false);
    };
    loadSessions();
  }, [companyId]);

  // Load conversations
  useEffect(() => {
    if (!activeSession) return;
    const loadConversations = async () => {
      const { data } = await supabase
        .from('meta_whatsapp_conversations')
        .select('*')
        .eq('session_id', activeSession.id)
        .order('last_message_at', { ascending: false });
      if (data) setConversations(data as MetaConversation[]);
    };
    loadConversations();

    // Subscribe to realtime
    const channel = supabase
      .channel('meta-convos-' + activeSession.id)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'meta_whatsapp_conversations',
        filter: `session_id=eq.${activeSession.id}`,
      }, () => loadConversations())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [activeSession]);

  // Load messages for selected conversation
  useEffect(() => {
    if (!selectedConvo) return;
    const loadMessages = async () => {
      const { data } = await supabase
        .from('meta_whatsapp_messages')
        .select('*')
        .eq('conversation_id', selectedConvo.id)
        .order('created_at', { ascending: true });
      if (data) setMessages(data as MetaMessage[]);

      // Mark as read
      await supabase
        .from('meta_whatsapp_conversations')
        .update({ unread_count: 0 })
        .eq('id', selectedConvo.id);
    };
    loadMessages();

    // Realtime messages
    const channel = supabase
      .channel('meta-msgs-' + selectedConvo.id)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'meta_whatsapp_messages',
        filter: `conversation_id=eq.${selectedConvo.id}`,
      }, (payload) => {
        setMessages(prev => [...prev, payload.new as MetaMessage]);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [selectedConvo]);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // ─── Handlers ───
  const handleCreateSession = async () => {
    if (!companyId || !user || !setupForm.phone_number_id || !setupForm.access_token) {
      toast({ title: 'Preencha todos os campos obrigatórios', variant: 'destructive' });
      return;
    }

    const { data, error } = await supabase
      .from('meta_whatsapp_sessions')
      .insert({
        company_id: companyId,
        user_id: user.id,
        instance_name: setupForm.instance_name,
        phone_number_id: setupForm.phone_number_id,
        waba_id: setupForm.waba_id,
        access_token: setupForm.access_token,
        status: 'connecting',
      })
      .select()
      .single();

    if (error) {
      toast({ title: 'Erro ao criar sessão', description: error.message, variant: 'destructive' });
      return;
    }

    // Check connection
    const { data: checkResult } = await supabase.functions.invoke('meta-whatsapp-api', {
      body: { action: 'check_connection', session_id: data.id },
    });

    if (checkResult?.connected) {
      toast({ title: 'Conectado!', description: `Número: ${checkResult.phone_number}` });
    } else {
      toast({ title: 'Token salvo', description: 'Verifique se o token está correto' });
    }

    setSessions(prev => [data as MetaSession, ...prev]);
    setActiveSession(data as MetaSession);
    setShowSetupModal(false);
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !selectedConvo || !activeSession) return;
    
    setSendingMessage(true);
    const msgContent = newMessage;
    setNewMessage('');

    try {
      const { data, error } = await supabase.functions.invoke('meta-whatsapp-api', {
        body: {
          action: 'send_message',
          session_id: activeSession.id,
          to: selectedConvo.contact_phone,
          message: msgContent,
          message_type: 'text',
        },
      });

      if (error || !data?.success) {
        throw new Error(data?.error || error?.message || 'Falha ao enviar');
      }
    } catch (err: any) {
      toast({ title: 'Erro ao enviar', description: err.message, variant: 'destructive' });
      setNewMessage(msgContent); // Restore message
    } finally {
      setSendingMessage(false);
    }
  };

  const handleStartNewChat = async () => {
    if (!newChatPhone.trim() || !activeSession) return;
    
    const cleanPhone = newChatPhone.replace(/\D/g, '');
    
    // Check if conversation already exists
    const existing = conversations.find(c => c.contact_phone === cleanPhone);
    if (existing) {
      setSelectedConvo(existing);
      setShowNewChatModal(false);
      setNewChatPhone('');
      return;
    }

    // Create new conversation
    const { data } = await supabase
      .from('meta_whatsapp_conversations')
      .insert({
        session_id: activeSession.id,
        company_id: companyId!,
        contact_phone: cleanPhone,
        contact_name: cleanPhone,
      })
      .select()
      .single();

    if (data) {
      setConversations(prev => [data as MetaConversation, ...prev]);
      setSelectedConvo(data as MetaConversation);
    }
    setShowNewChatModal(false);
    setNewChatPhone('');
  };

  const handleCheckConnection = async () => {
    if (!activeSession) return;
    const { data } = await supabase.functions.invoke('meta-whatsapp-api', {
      body: { action: 'check_connection', session_id: activeSession.id },
    });
    if (data?.connected) {
      toast({ title: 'Conectado', description: `${data.verified_name} • ${data.phone_number}` });
    } else {
      toast({ title: 'Desconectado', description: 'Verifique seu token de acesso', variant: 'destructive' });
    }
  };

  const filteredConvos = conversations.filter(c =>
    !searchQuery || 
    c.contact_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.contact_phone.includes(searchQuery)
  );

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    if (diffDays === 1) return 'Ontem';
    return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'sent': return <Check className="h-3 w-3 text-muted-foreground" />;
      case 'delivered': return <CheckCheck className="h-3 w-3 text-muted-foreground" />;
      case 'read': return <CheckCheck className="h-3 w-3" style={{ color: META_BLUE }} />;
      default: return null;
    }
  };

  const webhookUrl = activeSession 
    ? `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/meta-whatsapp-webhook`
    : '';

  // ─── Loading state ───
  if (loading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin" style={{ color: META_BLUE }} />
      </div>
    );
  }

  // ─── No sessions: Setup screen ───
  if (sessions.length === 0) {
    return (
      <>
        <div className="flex flex-col items-center justify-center h-full min-h-[60vh] p-6 text-center">
          <div className="w-20 h-20 rounded-2xl flex items-center justify-center mb-6" style={{ backgroundColor: `${META_BLUE}15` }}>
            <MessageSquare className="h-10 w-10" style={{ color: META_BLUE }} />
          </div>
          <h1 className="text-2xl font-bold text-foreground mb-2">CRM Meta</h1>
          <p className="text-muted-foreground mb-6 max-w-md">
            Conecte sua conta do WhatsApp Business via API Oficial da Meta para gerenciar conversas com segurança e escalabilidade.
          </p>
          <Button 
            onClick={() => setShowSetupModal(true)}
            className="text-white rounded-xl px-6"
            style={{ backgroundColor: META_BLUE }}
          >
            <Plus className="h-4 w-4 mr-2" />
            Configurar API Meta
          </Button>
        </div>
        <SetupModal 
          open={showSetupModal} 
          onClose={() => setShowSetupModal(false)} 
          form={setupForm}
          setForm={setSetupForm}
          onSubmit={handleCreateSession}
          webhookUrl=""
        />
      </>
    );
  }

  // ─── Chat view (mobile: show either list or chat) ───
  const showChat = isMobile ? !!selectedConvo : true;
  const showList = isMobile ? !selectedConvo : true;

  return (
    <div className="flex h-full overflow-hidden bg-background">
      {/* ─── Conversation List ─── */}
      {showList && (
        <div className={cn("flex flex-col border-r border-border bg-card", isMobile ? "w-full" : "w-[380px] shrink-0")}>
          {/* Header */}
          <div className="p-4 border-b border-border space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: META_BLUE }}>
                  <MessageSquare className="h-4 w-4 text-white" />
                </div>
                <div>
                  <h2 className="font-bold text-foreground text-sm">CRM Meta</h2>
                  <p className="text-[10px] text-muted-foreground">
                    {activeSession?.phone_name || activeSession?.phone_number || 'API Oficial'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setShowNewChatModal(true)}>
                  <Plus className="h-4 w-4" />
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={handleCheckConnection}>
                      <RefreshCw className="h-4 w-4 mr-2" /> Verificar Conexão
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setShowSetupModal(true)}>
                      <Settings className="h-4 w-4 mr-2" /> Configurações
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => {
                      navigator.clipboard.writeText(webhookUrl);
                      toast({ title: 'URL do webhook copiada!' });
                    }}>
                      <Copy className="h-4 w-4 mr-2" /> Copiar Webhook URL
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>

            {/* Connection status */}
            <div className="flex items-center gap-2 text-xs">
              {activeSession?.status === 'connected' ? (
                <Badge variant="outline" className="text-green-600 border-green-300 bg-green-50 dark:bg-green-950 dark:border-green-800">
                  <Wifi className="h-3 w-3 mr-1" /> Conectado
                </Badge>
              ) : (
                <Badge variant="outline" className="text-amber-600 border-amber-300 bg-amber-50 dark:bg-amber-950 dark:border-amber-800">
                  <WifiOff className="h-3 w-3 mr-1" /> {activeSession?.status || 'Desconectado'}
                </Badge>
              )}
            </div>

            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar conversa..."
                className="pl-9 h-9 rounded-xl bg-muted/50 border-0"
              />
            </div>
          </div>

          {/* Conversations */}
          <ScrollArea className="flex-1">
            {filteredConvos.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground text-sm">
                Nenhuma conversa ainda
              </div>
            ) : (
              filteredConvos.map((convo) => (
                <div
                  key={convo.id}
                  onClick={() => setSelectedConvo(convo)}
                  className={cn(
                    "flex items-center gap-3 px-4 py-3 cursor-pointer border-b border-border/50 hover:bg-muted/50 transition-colors",
                    selectedConvo?.id === convo.id && "bg-muted"
                  )}
                >
                  <Avatar className="h-11 w-11 shrink-0">
                    <AvatarImage src={convo.profile_picture || ''} />
                    <AvatarFallback className="text-white text-sm font-bold" style={{ backgroundColor: META_BLUE }}>
                      {(convo.contact_name || convo.contact_phone)?.[0]?.toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-center">
                      <p className="font-medium text-sm text-foreground truncate">
                        {convo.contact_name || convo.contact_phone}
                      </p>
                      <span className="text-[10px] text-muted-foreground shrink-0 ml-2">
                        {formatTime(convo.last_message_at)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <p className="text-xs text-muted-foreground truncate">
                        {convo.last_message || 'Sem mensagens'}
                      </p>
                      {(convo.unread_count || 0) > 0 && (
                        <span 
                          className="ml-2 shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white"
                          style={{ backgroundColor: META_BLUE }}
                        >
                          {convo.unread_count}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </ScrollArea>
        </div>
      )}

      {/* ─── Chat Area ─── */}
      {showChat && selectedConvo ? (
        <div className="flex-1 flex flex-col min-w-0">
          {/* Chat header */}
          <div className="px-4 py-3 border-b border-border flex items-center gap-3 bg-card shrink-0">
            {isMobile && (
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setSelectedConvo(null)}>
                <ArrowLeft className="h-4 w-4" />
              </Button>
            )}
            <Avatar className="h-10 w-10">
              <AvatarImage src={selectedConvo.profile_picture || ''} />
              <AvatarFallback className="text-white font-bold" style={{ backgroundColor: META_BLUE }}>
                {(selectedConvo.contact_name || selectedConvo.contact_phone)?.[0]?.toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm text-foreground truncate">
                {selectedConvo.contact_name || selectedConvo.contact_phone}
              </p>
              <p className="text-[11px] text-muted-foreground">
                {selectedConvo.contact_phone}
              </p>
            </div>
            <Badge variant="outline" className="text-xs shrink-0" style={{ borderColor: META_BLUE, color: META_BLUE }}>
              API Oficial
            </Badge>
          </div>

          {/* Messages */}
          <ScrollArea className="flex-1 px-4 py-4">
            <div className="space-y-2 max-w-3xl mx-auto">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={cn("flex", msg.from_me ? "justify-end" : "justify-start")}
                >
                  <div
                    className={cn(
                      "max-w-[75%] rounded-2xl px-4 py-2.5 text-sm",
                      msg.from_me
                        ? "text-white rounded-br-md"
                        : "bg-muted text-foreground rounded-bl-md"
                    )}
                    style={msg.from_me ? { backgroundColor: META_BLUE } : undefined}
                  >
                    {msg.message_type === 'image' && (
                      <div className="mb-1 text-xs opacity-75 flex items-center gap-1">
                        <ImageIcon className="h-3 w-3" /> Imagem
                      </div>
                    )}
                    {msg.message_type === 'document' && (
                      <div className="mb-1 text-xs opacity-75 flex items-center gap-1">
                        <FileText className="h-3 w-3" /> Documento
                      </div>
                    )}
                    {msg.message_type === 'audio' && (
                      <div className="mb-1 text-xs opacity-75 flex items-center gap-1">
                        <Mic className="h-3 w-3" /> Áudio
                      </div>
                    )}
                    <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                    <div className={cn("flex items-center gap-1 mt-1", msg.from_me ? "justify-end" : "justify-start")}>
                      <span className={cn("text-[10px]", msg.from_me ? "text-white/70" : "text-muted-foreground")}>
                        {formatTime(msg.created_at)}
                      </span>
                      {msg.from_me && getStatusIcon(msg.status)}
                    </div>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
          </ScrollArea>

          {/* Message input */}
          <div className="p-3 border-t border-border bg-card shrink-0">
            <div className="flex items-center gap-2 max-w-3xl mx-auto">
              <div className="relative flex-1">
                <Input
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Digite uma mensagem..."
                  className="pr-11 rounded-xl border-muted"
                  onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSendMessage()}
                />
                <div className="absolute right-1.5 top-1/2 -translate-y-1/2">
                  <AIImproveMessageButton size="sm" text={newMessage} onImproved={(t) => setNewMessage(t)} disabled={sendingMessage} />
                </div>
              </div>
              <Button
                onClick={handleSendMessage}
                disabled={!newMessage.trim() || sendingMessage}
                size="icon"
                className="rounded-xl text-white shrink-0"
                style={{ backgroundColor: META_BLUE }}
              >
                {sendingMessage ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        </div>
      ) : !isMobile ? (
        <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4" style={{ backgroundColor: `${META_BLUE}10` }}>
            <MessageSquare className="h-8 w-8" style={{ color: META_BLUE }} />
          </div>
          <p className="font-medium">CRM Meta • API Oficial</p>
          <p className="text-sm">Selecione uma conversa para começar</p>
        </div>
      ) : null}

      {/* ─── Setup Modal ─── */}
      <SetupModal
        open={showSetupModal}
        onClose={() => setShowSetupModal(false)}
        form={setupForm}
        setForm={setSetupForm}
        onSubmit={handleCreateSession}
        webhookUrl={webhookUrl}
        verifyToken={activeSession?.webhook_verify_token}
      />

      {/* ─── New Chat Modal ─── */}
      <Dialog open={showNewChatModal} onOpenChange={setShowNewChatModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Nova Conversa</DialogTitle>
            <DialogDescription>Digite o número com código do país (ex: 5511999999999)</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              value={newChatPhone}
              onChange={(e) => setNewChatPhone(e.target.value)}
              placeholder="5511999999999"
              className="rounded-xl"
            />
            <Button onClick={handleStartNewChat} className="w-full text-white rounded-xl" style={{ backgroundColor: META_BLUE }}>
              Iniciar Conversa
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Setup Modal Component ───
function SetupModal({ open, onClose, form, setForm, onSubmit, webhookUrl, verifyToken }: {
  open: boolean;
  onClose: () => void;
  form: any;
  setForm: (f: any) => void;
  onSubmit: () => void;
  webhookUrl: string;
  verifyToken?: string;
}) {
  const { toast } = useToast();

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: META_BLUE }}>
              <MessageSquare className="h-4 w-4 text-white" />
            </div>
            Configurar API Meta WhatsApp
          </DialogTitle>
          <DialogDescription>
            Configure sua conta do WhatsApp Business via API Oficial da Meta
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Step 1 */}
          <div className="space-y-2">
            <Label className="font-semibold">1. Nome da Instância</Label>
            <Input
              value={form.instance_name}
              onChange={(e) => setForm({ ...form, instance_name: e.target.value })}
              placeholder="Meta Business"
              className="rounded-xl"
            />
          </div>

          {/* Step 2 */}
          <div className="space-y-2">
            <Label className="font-semibold">2. Phone Number ID *</Label>
            <p className="text-xs text-muted-foreground">
              Encontre em developers.facebook.com → Seu App → WhatsApp → Configuração da API
            </p>
            <Input
              value={form.phone_number_id}
              onChange={(e) => setForm({ ...form, phone_number_id: e.target.value })}
              placeholder="1059838380536790"
              className="rounded-xl"
            />
          </div>

          {/* Step 3 */}
          <div className="space-y-2">
            <Label className="font-semibold">3. WABA ID (WhatsApp Business Account ID)</Label>
            <Input
              value={form.waba_id}
              onChange={(e) => setForm({ ...form, waba_id: e.target.value })}
              placeholder="1591632752050793"
              className="rounded-xl"
            />
          </div>

          {/* Step 4 */}
          <div className="space-y-2">
            <Label className="font-semibold">4. Token de Acesso Permanente *</Label>
            <p className="text-xs text-muted-foreground">
              Use um token permanente (System User Token) do Business Manager para produção
            </p>
            <Input
              value={form.access_token}
              onChange={(e) => setForm({ ...form, access_token: e.target.value })}
              placeholder="EAALd6i..."
              type="password"
              className="rounded-xl"
            />
          </div>

          {/* Webhook config */}
          {webhookUrl && (
            <div className="p-4 bg-muted/50 rounded-xl space-y-2">
              <Label className="font-semibold text-sm">5. Configure o Webhook na Meta</Label>
              <p className="text-xs text-muted-foreground">
                No painel Meta Developer, vá em WhatsApp → Configuração → Webhook e cole:
              </p>
              <div className="space-y-2">
                <div>
                  <p className="text-[10px] font-medium text-muted-foreground uppercase">URL do Callback</p>
                  <div className="flex items-center gap-2">
                    <code className="text-xs bg-background px-2 py-1 rounded border flex-1 break-all">
                      {webhookUrl}
                    </code>
                    <Button size="icon" variant="outline" className="h-7 w-7 shrink-0" onClick={() => {
                      navigator.clipboard.writeText(webhookUrl);
                      toast({ title: 'URL copiada!' });
                    }}>
                      <Copy className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
                {verifyToken && (
                  <div>
                    <p className="text-[10px] font-medium text-muted-foreground uppercase">Token de Verificação</p>
                    <div className="flex items-center gap-2">
                      <code className="text-xs bg-background px-2 py-1 rounded border flex-1 break-all">
                        {verifyToken}
                      </code>
                      <Button size="icon" variant="outline" className="h-7 w-7 shrink-0" onClick={() => {
                        navigator.clipboard.writeText(verifyToken);
                        toast({ title: 'Token copiado!' });
                      }}>
                        <Copy className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                )}
                <p className="text-[10px] text-muted-foreground">
                  Campos para assinar: <strong>messages</strong>
                </p>
              </div>
            </div>
          )}

          <Button 
            onClick={onSubmit} 
            className="w-full text-white rounded-xl" 
            style={{ backgroundColor: META_BLUE }}
          >
            <Sparkles className="h-4 w-4 mr-2" />
            Salvar e Conectar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
