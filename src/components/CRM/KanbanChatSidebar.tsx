import React, { useState, useEffect, useRef } from 'react';
import AIImproveMessageButton from './AIImproveMessageButton';
import AISuggestReplyButton from './AISuggestReplyButton';
import { X, Send, Bot, Check, CheckCheck, Circle, Loader2, Phone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import WhatsAppMediaMessage from './WhatsAppMediaMessage';
import { AnimatePresence, motion } from 'framer-motion';

interface WhatsAppConversationData {
  id: string;
  contact_phone: string;
  contact_name?: string;
  last_message_at: string;
  last_message?: string;
  status: string;
  unread_count?: number;
  profile_picture?: string;
  session_id?: string;
  assigned_agent_id?: string;
  ai_auto_reply_enabled?: boolean;
  pipeline_stage?: string;
  labels?: string[];
  typing_status?: string | null;
  typing_updated_at?: string;
}

interface WhatsAppMessage {
  id: string;
  conversation_id: string;
  content: string;
  from_me: boolean;
  status: string;
  created_at: string;
  sender_name?: string;
  wa_message_id?: string;
  message_type?: string;
  media_url?: string;
  media_caption?: string;
  is_ai_response?: boolean;
}

interface KanbanChatSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  conversation: WhatsAppConversationData | null;
  companyId: string | null;
}

const OMNI_COLOR = '#374DA4';

const KanbanChatSidebar: React.FC<KanbanChatSidebarProps> = ({
  isOpen,
  onClose,
  conversation,
  companyId
}) => {
  const { toast } = useToast();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [messages, setMessages] = useState<WhatsAppMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);
  const [loading, setLoading] = useState(false);
  const lastMessageTsRef = useRef<string | null>(null);
  const initialLoadDoneRef = useRef(false);

  // Load messages
  useEffect(() => {
    if (!conversation || !companyId || !isOpen) return;

    initialLoadDoneRef.current = false;
    lastMessageTsRef.current = null;
    setMessages([]);

    const loadMessages = async (isInitial: boolean) => {
      if (isInitial) setLoading(true);

      const { data: convs } = await supabase
        .from('whatsapp_conversations')
        .select('id')
        .eq('company_id', companyId)
        .eq('contact_phone', conversation.contact_phone);

      if (!convs || convs.length === 0) {
        if (isInitial) setLoading(false);
        return;
      }

      const conversationIds = convs.map(c => c.id);

      if (isInitial) {
        const { data, error } = await supabase
          .from('whatsapp_messages')
          .select('*')
          .in('conversation_id', conversationIds)
          .order('timestamp', { ascending: true })
          .limit(200);

        if (!error && data) {
          const deduped = deduplicateMessages(data);
          setMessages(deduped);
          if (deduped.length > 0) {
            lastMessageTsRef.current = deduped[deduped.length - 1].created_at;
          }
        }
        setLoading(false);
        initialLoadDoneRef.current = true;
      } else {
        const since = lastMessageTsRef.current || new Date(0).toISOString();
        const { data, error } = await supabase
          .from('whatsapp_messages')
          .select('*')
          .in('conversation_id', conversationIds)
          .gt('timestamp', since)
          .order('timestamp', { ascending: true })
          .limit(50);

        if (!error && data && data.length > 0) {
          setMessages(prev => {
            const existingIds = new Set(prev.map(m => m.wa_message_id || m.id));
            const newMsgs = data
              .filter(m => !existingIds.has(m.wa_message_id || m.id))
              .map(m => ({ ...m, created_at: m.timestamp || m.created_at } as WhatsAppMessage));

            if (newMsgs.length === 0) return prev;

            // Reconcile optimistic temp messages with the real ones now coming from the server.
            // The temp message has id "temp-*" and no wa_message_id; the real message has a UUID
            // + wa_message_id. Match by from_me + content and drop the temp to avoid duplicates.
            const merged = [...prev];
            for (const nm of newMsgs) {
              if (nm.from_me) {
                const tempIdx = merged.findIndex(m =>
                  typeof m.id === 'string' &&
                  m.id.startsWith('temp-') &&
                  m.from_me &&
                  (m.content || '') === (nm.content || '')
                );
                if (tempIdx >= 0) merged.splice(tempIdx, 1);
              }
              merged.push(nm);
            }
            lastMessageTsRef.current = merged[merged.length - 1].created_at;
            return merged;
          });
        }
      }
    };

    loadMessages(true);
    const interval = setInterval(() => loadMessages(false), 2000);
    return () => clearInterval(interval);
  }, [conversation?.contact_phone, companyId, isOpen]);

  const deduplicateMessages = (data: any[]): WhatsAppMessage[] => {
    const uniqueMessages = new Map<string, WhatsAppMessage>();
    data.forEach(m => {
      const timestamp = new Date(m.timestamp || m.created_at).getTime();
      const fallbackKey = `${m.content?.substring(0, 50)}_${m.from_me}_${Math.floor(timestamp / 1000)}`;
      const key = m.wa_message_id || fallbackKey;
      if (!uniqueMessages.has(key)) {
        uniqueMessages.set(key, { ...m, created_at: m.timestamp || m.created_at });
      }
    });
    return Array.from(uniqueMessages.values())
      .sort((a, b) => {
        const timeA = new Date(a.created_at).getTime();
        const timeB = new Date(b.created_at).getTime();
        return timeA === timeB ? a.id.localeCompare(b.id) : timeA - timeB;
      });
  };

  // Scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Mark as read
  useEffect(() => {
    if (conversation && isOpen && (conversation.unread_count || 0) > 0) {
      supabase
        .from('whatsapp_conversations')
        .update({ unread_count: 0 })
        .eq('id', conversation.id);
    }
  }, [conversation, isOpen]);

  const sendMessage = async () => {
    if (!newMessage.trim() || !conversation || sendingMessage) return;

    setSendingMessage(true);
    const messageContent = newMessage.trim();
    setNewMessage('');

    const tempId = `temp-${Date.now()}`;
    const tempMessage: WhatsAppMessage = {
      id: tempId,
      conversation_id: conversation.id,
      content: messageContent,
      from_me: true,
      status: 'sending',
      created_at: new Date().toISOString()
    };
    setMessages(prev => [...prev, tempMessage]);

    try {
      const { data: conv } = await supabase
        .from('whatsapp_conversations')
        .select('session_id')
        .eq('id', conversation.id)
        .single();

      if (!conv?.session_id) throw new Error('Sessão não encontrada');

      const { data: session } = await supabase
        .from('whatsapp_sessions')
        .select('baileys_server_url')
        .eq('id', conv.session_id)
        .single();

      const { error: sendError } = await supabase.functions.invoke('whatsapp-api', {
        body: {
          action: 'send_message',
          sessionId: conv.session_id,
          conversationId: conversation.id,
          manualTakeover: true,
          phone: conversation.contact_phone,
          message: messageContent
        }
      });

      if (sendError) throw sendError;

      setMessages(prev => prev.map(m =>
        m.id === tempId ? { ...m, status: 'sent' } : m
      ));

      await supabase
        .from('whatsapp_conversations')
        .update({
          last_message: messageContent,
          last_message_at: new Date().toISOString()
        })
        .eq('id', conversation.id);

    } catch (error: any) {
      toast({ title: 'Erro ao enviar', description: error.message, variant: 'destructive' });
      setMessages(prev => prev.map(m =>
        m.id === tempId ? { ...m, status: 'failed' } : m
      ));
    } finally {
      setSendingMessage(false);
    }
  };

  const formatTime = (date: string) => {
    return new Date(date).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'sent': return <Check className="h-3 w-3" />;
      case 'delivered': return <CheckCheck className="h-3 w-3" />;
      case 'read': return <CheckCheck className="h-3 w-3 text-[#374DA4]" />;
      case 'sending': return <Circle className="h-3 w-3 animate-pulse" />;
      case 'failed': return <Circle className="h-3 w-3 text-red-500" />;
      default: return <Circle className="h-3 w-3" />;
    }
  };

  if (!conversation) return null;

  const isTypingStatusValid = (conv: WhatsAppConversationData): boolean => {
    if (!conv.typing_status || !conv.typing_updated_at) return false;
    const updatedAt = new Date(conv.typing_updated_at).getTime();
    const now = new Date().getTime();
    return (now - updatedAt) < 15000;
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Popup */}
          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 20 }}
            transition={{ type: 'spring', duration: 0.4, bounce: 0.15 }}
            className="relative w-full max-w-2xl h-[85vh] max-h-[800px] bg-white rounded-3xl shadow-2xl flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div
              className="px-5 py-4 flex items-center gap-3"
              style={{ background: `linear-gradient(135deg, ${OMNI_COLOR}, #5B33F0)` }}
            >
              <Avatar className="h-11 w-11 ring-2 ring-white/30">
                <AvatarImage src={conversation.profile_picture} />
                <AvatarFallback className="bg-white/20 text-white font-bold text-sm">
                  {(conversation.contact_name || conversation.contact_phone).substring(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <h3 className="text-white font-semibold text-base truncate">
                  {conversation.contact_name || conversation.contact_phone}
                </h3>
                <p className="text-white/70 text-xs flex items-center gap-1">
                  {isTypingStatusValid(conversation) ? (
                    <span className="text-white font-medium animate-pulse">
                      {conversation.typing_status === 'recording' ? 'gravando áudio...' : 'digitando...'}
                    </span>
                  ) : (
                    <>
                      <Phone className="h-3 w-3" />
                      {conversation.contact_phone}
                    </>
                  )}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {conversation.ai_auto_reply_enabled && (
                  <Badge className="bg-white/20 text-white border-white/30 text-[10px]">
                    <Bot className="h-3 w-3 mr-1" />
                    IA
                  </Badge>
                )}
                <button
                  onClick={onClose}
                  className="p-1.5 rounded-full hover:bg-white/20 transition-colors"
                >
                  <X className="h-5 w-5 text-white" />
                </button>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 bg-gradient-to-b from-[#F0F2FE]/50 to-white">
              {loading ? (
                <div className="flex items-center justify-center h-full">
                  <Loader2 className="h-7 w-7 animate-spin" style={{ color: OMNI_COLOR }} />
                </div>
              ) : messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                  <p className="text-sm">Nenhuma mensagem ainda</p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {messages.map((message) => (
                    <div
                      key={message.id}
                      className={cn("flex", message.from_me ? "justify-end" : "justify-start")}
                    >
                      <div
                        className={cn(
                          "max-w-[80%] rounded-2xl px-3.5 py-2 shadow-sm",
                          message.from_me
                            ? message.is_ai_response
                              ? "bg-gradient-to-r from-purple-500 to-violet-500 text-white"
                              : "text-white"
                            : "bg-white border border-gray-100 text-gray-800"
                        )}
                        style={
                          message.from_me && !message.is_ai_response
                            ? { background: `linear-gradient(135deg, ${OMNI_COLOR}, #5B33F0)` }
                            : undefined
                        }
                      >
                        {message.is_ai_response && (
                          <div className="flex items-center gap-1 text-[10px] opacity-80 mb-1">
                            <Bot className="h-3 w-3" />
                            <span>{message.sender_name || 'IA'}</span>
                          </div>
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
                          <p className={cn("text-sm whitespace-pre-wrap break-words", message.from_me ? "text-white" : "text-gray-800")}>
                            {message.content}
                          </p>
                        )}
                        <div className={cn(
                          "flex items-center justify-end gap-1 mt-1 text-[10px]",
                          message.from_me ? "opacity-70" : "text-muted-foreground"
                        )}>
                          <span>{formatTime(message.created_at)}</span>
                          {message.from_me && getStatusIcon(message.status)}
                        </div>
                      </div>
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </div>
              )}
            </div>

            {/* Input */}
            <div className="px-4 py-3 border-t border-gray-100 bg-white">
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Input
                    placeholder="Digite uma mensagem..."
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()}
                    className="w-full pr-[74px] rounded-xl border-gray-200 focus-visible:ring-1 focus-visible:ring-offset-0 h-11"
                    style={{ '--tw-ring-color': OMNI_COLOR } as React.CSSProperties}
                    disabled={sendingMessage}
                  />
                  <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-0.5">
                    <AISuggestReplyButton
                      size="sm"
                      messages={messages.map(m => ({ from_me: m.from_me, content: m.content || '' }))}
                      contactName={conversation?.contact_name || conversation?.contact_phone}
                      onSuggested={(t) => setNewMessage(t)}
                      disabled={sendingMessage}
                    />
                    <AIImproveMessageButton size="sm" text={newMessage} onImproved={(t) => setNewMessage(t)} disabled={sendingMessage} />
                  </div>
                </div>
                <Button
                  size="icon"
                  onClick={sendMessage}
                  disabled={sendingMessage || !newMessage.trim()}
                  className="h-11 w-11 rounded-xl shrink-0 text-white border-0"
                  style={{ backgroundColor: OMNI_COLOR }}
                >
                  {sendingMessage ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default KanbanChatSidebar;
