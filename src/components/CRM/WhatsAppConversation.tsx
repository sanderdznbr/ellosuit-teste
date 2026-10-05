import React, { useState, useRef, useEffect } from 'react';
import { Send, User, Bot, Loader2, Phone, MoreVertical, ArrowLeft, ChevronDown, Wand2, Check, CheckCheck, Clock, AlertCircle } from 'lucide-react';
import AIImproveMessageButton from './AIImproveMessageButton';
import AISuggestReplyButton from './AISuggestReplyButton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import WhatsAppMediaMessage from './WhatsAppMediaMessage';
import { cn } from '@/lib/utils';

interface Message {
  id: string;
  from_me: boolean;
  content: string;
  timestamp: string;
  status: string;
  message_type?: string;
  media_url?: string;
  media_caption?: string;
  sender_name?: string;
  sender_phone?: string;
}

interface Conversation {
  id: string;
  contact_phone: string;
  contact_name?: string;
  profile_picture?: string;
  session_id?: string;
  assigned_agent_id?: string;
}

interface WhatsAppConversationProps {
  conversation: Conversation;
  sessionId: string;
  onBack?: () => void;
  onAssignAgent?: () => void;
}

const WhatsAppConversation: React.FC<WhatsAppConversationProps> = ({
  conversation,
  sessionId,
  onBack,
  onAssignAgent
}) => {
  const { toast } = useToast();
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [helping, setHelping] = useState(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const [showScrollButton, setShowScrollButton] = useState(false);

  const getScrollViewport = () =>
    scrollAreaRef.current?.querySelector('[data-radix-scroll-area-viewport]') as HTMLElement | null;

  const scrollToBottom = () => {
    const el = getScrollViewport();
    if (el) el.scrollTop = el.scrollHeight;
  };

  // Track scroll position to show/hide button
  useEffect(() => {
    const el = getScrollViewport();
    if (!el) return;
    const onScroll = () => {
      const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
      setShowScrollButton(distanceFromBottom > 150);
    };
    el.addEventListener('scroll', onScroll);
    return () => el.removeEventListener('scroll', onScroll);
  }, [loading]);

  // Load messages
  useEffect(() => {
    const loadMessages = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('whatsapp_messages')
        .select('*')
        .eq('conversation_id', conversation.id)
        .order('timestamp', { ascending: true });

      if (!error) {
        setMessages(data?.map(m => ({
          id: m.id,
          from_me: m.from_me,
          content: m.content || '',
          timestamp: m.timestamp,
          status: m.status,
          message_type: m.message_type || 'text',
          media_url: m.media_url || '',
          media_caption: m.media_caption || '',
          sender_name: m.sender_name || '',
          sender_phone: m.sender_phone || ''
        })) || []);
      }
      setLoading(false);
    };

    loadMessages();

    // Helper to refetch messages from DB (used as a safety-net resync
    // whenever the conversation row updates but the INSERT event is
    // missed/delayed by realtime).
    const refetchMessages = async () => {
      const { data } = await supabase
        .from('whatsapp_messages')
        .select('*')
        .eq('conversation_id', conversation.id)
        .order('timestamp', { ascending: true });
      if (!data) return;
      setMessages(prev => {
        const realIds = new Set(prev.filter(m => !m.id.startsWith('temp-')).map(m => m.id));
        const fresh = data.map(m => ({
          id: m.id,
          from_me: m.from_me,
          content: m.content || '',
          timestamp: m.timestamp,
          status: m.status,
          message_type: m.message_type || 'text',
          media_url: m.media_url || '',
          media_caption: m.media_caption || '',
          sender_name: m.sender_name || '',
          sender_phone: m.sender_phone || ''
        }));
        // If nothing new, keep existing state to avoid extra renders
        if (fresh.length === realIds.size && fresh.every(m => realIds.has(m.id))) {
          return prev;
        }
        // Preserve any pending temp messages (not yet in DB)
        const temps = prev.filter(m => m.id.startsWith('temp-') &&
          !fresh.some(f => f.from_me === m.from_me && f.content === m.content));
        return [...fresh, ...temps];
      });
    };

    // Subscribe to new messages with proper deduplication
    const channel = supabase
      .channel(`messages-${conversation.id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'whatsapp_messages',
        filter: `conversation_id=eq.${conversation.id}`
      }, (payload) => {
        const newMsg = payload.new as any;
        setMessages(prev => {
          // Check if this exact message ID already exists
          if (prev.some(m => m.id === newMsg.id)) {
            return prev;
          }
          
          // For sent messages (from_me), replace temp message with same content
          if (newMsg.from_me) {
            const tempIndex = prev.findIndex(m => 
              m.id.startsWith('temp-') && 
              m.content === (newMsg.content || '') &&
              m.from_me === true
            );
            
              if (tempIndex !== -1) {
              // Replace temp message with real one
              const updated = [...prev];
              updated[tempIndex] = {
                id: newMsg.id,
                from_me: newMsg.from_me,
                content: newMsg.content || '',
                timestamp: newMsg.timestamp,
                status: newMsg.status,
                message_type: newMsg.message_type || 'text',
                media_url: newMsg.media_url || '',
                media_caption: newMsg.media_caption || '',
                sender_name: newMsg.sender_name || '',
                sender_phone: newMsg.sender_phone || ''
              };
              return updated;
            }
          }
          
          // Check for duplicate content from same direction within recent messages
          const recentDuplicate = prev.slice(-10).some(m => 
            m.content === (newMsg.content || '') && 
            m.from_me === newMsg.from_me
          );
          if (recentDuplicate) {
            return prev;
          }
          
          // Add new message
          return [...prev, {
            id: newMsg.id,
            from_me: newMsg.from_me,
            content: newMsg.content || '',
            timestamp: newMsg.timestamp,
            status: newMsg.status,
            message_type: newMsg.message_type || 'text',
            media_url: newMsg.media_url || '',
            media_caption: newMsg.media_caption || '',
            sender_name: newMsg.sender_name || '',
            sender_phone: newMsg.sender_phone || ''
          }];
        });
      })
      // Safety-net: when the conversation row is updated (last_message,
      // last_message_at, etc.), refetch messages so the right panel
      // stays in sync even if the INSERT event was missed or the message
      // was inserted by a different code path.
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'whatsapp_conversations',
        filter: `id=eq.${conversation.id}`
      }, () => {
        refetchMessages();
      })
      .subscribe();

    // Polling fallback every 8s while the conversation is open, in case
    // realtime drops or the webhook updates the conversation through a
    // path that doesn't fire postgres_changes for this client.
    const pollInterval = setInterval(refetchMessages, 8000);

    return () => {
      clearInterval(pollInterval);
      supabase.removeChannel(channel);
    };
  }, [conversation.id]);

  // Auto-scroll to bottom
  useEffect(() => {
    if (!showScrollButton) scrollToBottom();
  }, [messages]);

  const refetchMessages = async () => {
    const { data, error } = await supabase
      .from('whatsapp_messages')
      .select('*')
      .eq('conversation_id', conversation.id)
      .order('timestamp', { ascending: true });

    if (!error && data) {
      setMessages(data.map(m => ({
        id: m.id,
        from_me: m.from_me,
        content: m.content || '',
        timestamp: m.timestamp,
        status: m.status,
        message_type: m.message_type || 'text',
        media_url: m.media_url || '',
        media_caption: m.media_caption || '',
        sender_name: m.sender_name || '',
        sender_phone: m.sender_phone || ''
      })));
    }
  };

  const sendMessage = async () => {
    if (!inputMessage.trim() || sending) return;

    setSending(true);
    const messageContent = inputMessage.trim();
    setInputMessage('');

    // Add message locally immediately with temp ID
    const tempId = `temp-${Date.now()}`;
    const tempTimestamp = new Date().toISOString();
    setMessages(prev => [...prev, {
      id: tempId,
      from_me: true,
      content: messageContent,
      timestamp: tempTimestamp,
      status: 'sent'
    }]);

    try {
      const { data, error } = await supabase.functions.invoke('whatsapp-api', {
        body: {
          action: 'send_message',
          sessionId,
          conversationId: conversation.id,
          manualTakeover: true,
          phone: conversation.contact_phone,
          message: messageContent
        }
      });

      if (error) throw error;

      // Refetch messages from DB after a short delay to ensure persistence
      setTimeout(() => refetchMessages(), 1500);

    } catch (e: any) {
      console.error('Error sending message:', e);
      // Remove temp message on failure
      setMessages(prev => prev.filter(m => m.id !== tempId));
      toast({
        title: 'Erro',
        description: 'Erro ao enviar mensagem. Tente novamente.',
        variant: 'destructive'
      });
      setInputMessage(messageContent); // Restore message
    } finally {
      setSending(false);
    }
  };

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const helpWithReply = async () => {
    if (helping || messages.length === 0) return;
    setHelping(true);
    try {
      const { data, error } = await supabase.functions.invoke('crm-sales-ai', {
        body: {
          action: 'copilot',
          messages: messages.map(m => ({ from_me: m.from_me, content: m.content, timestamp: m.timestamp })),
          contactName: conversation.contact_name || conversation.contact_phone,
        },
      });
      if (error) throw error;
      const suggestion = (data?.structured?.suggested_reply as string) || '';
      if (!suggestion) throw new Error('Sem sugestão disponível');
      setInputMessage(suggestion);
      toast({ title: 'Sugestão pronta', description: 'Revise e envie quando quiser.' });
    } catch (e: any) {
      toast({
        title: 'Não consegui gerar a resposta',
        description: e?.message || 'Tente novamente em instantes.',
        variant: 'destructive',
      });
    } finally {
      setHelping(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#faf9f7] dark:bg-[#141414]">
      {/* Header */}
      <div className="flex items-center gap-3 p-4 border-b border-border/10 bg-[#faf9f7]/60 dark:bg-[#141414]/60 backdrop-blur-xl">
        {onBack && (
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
        )}
        
        <Avatar className="h-10 w-10">
          <AvatarImage src={conversation.profile_picture} />
          <AvatarFallback className="bg-green-100 text-green-700">
            {conversation.contact_name?.[0] || conversation.contact_phone[0]}
          </AvatarFallback>
        </Avatar>
        
        <div className="flex-1">
          <h3 className="font-medium">
            {conversation.contact_name || conversation.contact_phone}
          </h3>
          <p className="text-xs text-muted-foreground">
            {conversation.contact_phone}
          </p>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon">
              <MoreVertical className="h-5 w-5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => window.open(`tel:${conversation.contact_phone}`)}>
              <Phone className="h-4 w-4 mr-2" />
              Ligar
            </DropdownMenuItem>
            {onAssignAgent && (
              <DropdownMenuItem onClick={onAssignAgent}>
                <Bot className="h-4 w-4 mr-2" />
                Atribuir Agente IA
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Messages area wrapper */}
      <div className="relative flex-1">
        <ScrollArea ref={scrollAreaRef} className="h-full p-4 bg-[#faf9f7] dark:bg-[#141414]">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-muted-foreground text-sm">Nenhuma mensagem ainda</p>
          </div>
        ) : (
          <div className="space-y-2">
            {messages.map((message, index) => {
              // Check if this is a group conversation (contact_phone ends with digits typical of groups - 18+ digits)
              const isGroupConversation = conversation.contact_phone?.replace(/\D/g, '').length >= 18;
              // Show sender name for incoming messages in groups
              const showSenderName = isGroupConversation && !message.from_me && message.sender_name;
              // Check if previous message is from same sender (to avoid repetition)
              const prevMsg = messages[index - 1];
              const sameSenderAsPrev = prevMsg && 
                prevMsg.sender_name === message.sender_name && 
                !message.from_me && 
                !prevMsg.from_me;
              
              return (
                <div
                  key={message.id}
                  className={`flex ${message.from_me ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={cn(
                      "max-w-[85%] sm:max-w-[70%] rounded-2xl px-4 py-2.5 shadow-none relative border border-border/10",
                      message.from_me
                        ? "bg-black/[0.05] dark:bg-white/[0.05] text-foreground rounded-br-sm"
                        : "bg-background text-foreground rounded-bl-sm"
                    )}
                  >
                    {/* Show sender name in groups */}
                    {showSenderName && !sameSenderAsPrev && (
                      <p className="text-xs font-semibold text-primary mb-1">
                        {message.sender_name}
                      </p>
                    )}
                    {message.message_type && message.message_type !== 'text' ? (
                      <WhatsAppMediaMessage
                        messageType={message.message_type}
                        content={message.content}
                        mediaUrl={message.media_url}
                        mediaCaption={message.media_caption}
                        fromMe={message.from_me}
                      />
                    ) : (
                      <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                    )}
                    <div className={cn("flex items-center gap-1 justify-end mt-1 text-muted-foreground")}>
                      <span className="text-[10px]">
                        {formatTime(message.timestamp)}
                      </span>
                      {message.from_me && (
                        <span className="inline-flex items-center" aria-label={`Status: ${message.status}`}>
                          {message.status === 'read' ? (
                            <CheckCheck className="h-3 w-3 text-primary" />
                          ) : message.status === 'delivered' ? (
                            <CheckCheck className="h-3 w-3 text-muted-foreground/50" />
                          ) : message.status === 'sent' ? (
                            <Check className="h-3 w-3 text-muted-foreground/50" />
                          ) : message.status === 'failed' ? (
                            <AlertCircle className="h-3 w-3 text-red-500" />
                          ) : (
                            <Clock className="h-3 w-3 text-muted-foreground/70" />
                          )}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        </ScrollArea>

        {/* Scroll to bottom button */}
        {showScrollButton && (
          <Button
            onClick={scrollToBottom}
            size="icon"
            className="absolute bottom-4 right-4 z-10 rounded-full bg-card shadow-lg hover:bg-accent h-9 w-9"
          >
            <ChevronDown className="h-5 w-5 text-foreground" />
          </Button>
        )}
      </div>
      <div className="p-4 border-t border-border/10 bg-[#faf9f7] dark:bg-[#141414]">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Input
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()}
              placeholder="Digite uma mensagem..."
              disabled={sending}
              className="pr-[76px] h-11 rounded-2xl bg-black/[0.02] dark:bg-white/[0.02] border-border/10 focus-visible:ring-1 focus-visible:ring-primary/20 focus-visible:ring-offset-0 focus-visible:border-primary/40 transition-all"
            />
            <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-0.5">
              <AISuggestReplyButton
                size="sm"
                messages={messages.map(m => ({ from_me: m.from_me, content: m.content || '' }))}
                contactName={conversation.contact_name || conversation.contact_phone}
                onSuggested={(t) => setInputMessage(t)}
                disabled={sending}
              />
              <AIImproveMessageButton
                size="sm"
                text={inputMessage}
                onImproved={(t) => setInputMessage(t)}
                disabled={sending}
              />
            </div>
          </div>
          <Button
            onClick={sendMessage}
            disabled={!inputMessage.trim() || sending}
            size="icon"
            className="bg-green-600 hover:bg-green-700"
          >
            {sending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default WhatsAppConversation;
