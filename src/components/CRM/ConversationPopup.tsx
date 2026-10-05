import React, { useState, useEffect, useRef } from 'react';
import AIImproveMessageButton from './AIImproveMessageButton';
import { Send, X, Phone, Tag, UserPlus, Bot, MoreVertical, Loader2, Image as ImageIcon, Archive, Trash2, Download, Users, Copy } from 'lucide-react';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import MessageContextMenu from './MessageContextMenu';

interface ConversationLabel {
  id: string;
  name: string;
  color: string;
}

interface WhatsAppConversationData {
  id: string;
  contact_phone: string;
  contact_name?: string;
  last_message_at: string;
  last_message?: string;
  status: string;
  unread_count?: number;
  profile_picture?: string;
  pipeline_stage?: string;
  labels?: string[];
  is_demo?: boolean;
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
  message_type?: string;
  media_url?: string;
  media_caption?: string;
}

interface ConversationPopupProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conversation: WhatsAppConversationData | null;
  messages: WhatsAppMessage[];
  labels: ConversationLabel[];
  onSendMessage: (message: string) => void;
  onManageLabels: () => void;
  onSaveLead: () => void;
  onDeleteMessage?: (messageId: string) => void;
  sendingMessage?: boolean;
}

// Helper function to download image
const downloadImage = async (url: string, filename: string, showToast?: (opts: any) => void) => {
  try {
    if (showToast) showToast({ title: 'Baixando...', description: 'Aguarde o download da imagem' });
    const response = await fetch(url);
    const blob = await response.blob();
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(blobUrl);
    if (showToast) showToast({ title: 'Sucesso!', description: 'Imagem baixada com sucesso' });
  } catch (error) {
    // Fallback: open in new tab
    window.open(url, '_blank');
    if (showToast) showToast({ title: 'Abrindo em nova aba', description: 'O download direto não foi possível' });
  }
};

const ConversationPopup: React.FC<ConversationPopupProps> = ({
  open,
  onOpenChange,
  conversation,
  messages,
  labels,
  onSendMessage,
  onManageLabels,
  onSaveLead,
  onDeleteMessage,
  sendingMessage = false,
}) => {
  const [inputMessage, setInputMessage] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  
  // Message context menu state
  const [messageContextMenu, setMessageContextMenu] = useState<{
    isOpen: boolean;
    position: { x: number; y: number };
    messageId: string;
    messageContent: string;
    isFromMe: boolean;
  }>({ isOpen: false, position: { x: 0, y: 0 }, messageId: '', messageContent: '', isFromMe: false });

  useEffect(() => {
    if (scrollRef.current) {
      const scrollElement = scrollRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollElement) {
        scrollElement.scrollTop = scrollElement.scrollHeight;
      }
    }
  }, [messages]);

  if (!conversation) return null;

  const handleSend = () => {
    if (!inputMessage.trim() || sendingMessage) return;
    onSendMessage(inputMessage.trim());
    setInputMessage('');
  };

  const handleMessageContextMenu = (e: React.MouseEvent, message: WhatsAppMessage) => {
    e.preventDefault();
    e.stopPropagation();
    setMessageContextMenu({
      isOpen: true,
      position: { x: e.clientX, y: e.clientY },
      messageId: message.id,
      messageContent: message.content,
      isFromMe: message.from_me,
    });
  };

  const handleCopyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({ title: 'Copiado!', description: 'Texto copiado para a área de transferência' });
    } catch {
      toast({ title: 'Erro', description: 'Não foi possível copiar', variant: 'destructive' });
    }
  };

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const isTypingStatusValid = (conv: WhatsAppConversationData): boolean => {
    if (!conv.typing_status || !conv.typing_updated_at) return false;
    const updatedAt = new Date(conv.typing_updated_at).getTime();
    const now = new Date().getTime();
    return (now - updatedAt) < 15000;
  };

  const conversationLabels = labels.filter(l => conversation.labels?.includes(l.id));


  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-xl md:max-w-2xl p-0 gap-0 flex flex-col h-full">
        {/* Header */}
        <div className="flex items-center gap-3 p-4 border-b bg-card">
          <Avatar className="h-10 w-10">
            <AvatarImage src={conversation.profile_picture} />
            <AvatarFallback className="bg-primary/10 text-primary">
              {(conversation.contact_name || conversation.contact_phone).substring(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold truncate">
              {conversation.contact_name || conversation.contact_phone}
            </h3>
            <p className="text-xs text-muted-foreground truncate">
              {isTypingStatusValid(conversation) ? (
                <span className="text-[#25D366] font-medium animate-pulse">
                  {conversation.typing_status === 'recording' ? 'gravando áudio...' : 'digitando...'}
                </span>
              ) : (
                conversation.contact_phone
              )}
            </p>
          </div>

          {/* Labels */}
          {conversationLabels.length > 0 && (
            <div className="hidden sm:flex items-center gap-1">
              {conversationLabels.slice(0, 2).map(label => (
                <Badge 
                  key={label.id}
                  variant="outline"
                  className="text-xs"
                  style={{ 
                    borderColor: label.color,
                    color: label.color,
                    backgroundColor: `${label.color}15`
                  }}
                >
                  {label.name}
                </Badge>
              ))}
              {conversationLabels.length > 2 && (
                <Badge variant="secondary" className="text-xs">
                  +{conversationLabels.length - 2}
                </Badge>
              )}
            </div>
          )}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => window.open(`tel:${conversation.contact_phone}`)}>
                <Phone className="h-4 w-4 mr-2" />
                Ligar
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={onManageLabels}>
                <Tag className="h-4 w-4 mr-2" />
                Gerenciar Etiquetas
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onSaveLead}>
                <UserPlus className="h-4 w-4 mr-2" />
                Adicionar à Base de Clientes
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button variant="ghost" size="icon" onClick={() => onOpenChange(false)}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Messages */}
        <ScrollArea ref={scrollRef} className="flex-1 p-4 bg-[#e5ddd5] dark:bg-muted/30">
          {messages.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <p className="text-muted-foreground text-sm">Nenhuma mensagem ainda</p>
            </div>
          ) : (
            <div className="space-y-2">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${message.from_me ? 'justify-end' : 'justify-start'}`}
                  onContextMenu={(e) => handleMessageContextMenu(e, message)}
                >
                  <div
                    className={cn(
                      "max-w-[70%] rounded-lg px-3 py-2 shadow-sm",
                      message.from_me
                        ? message.status === 'sending'
                          ? 'bg-primary/60 text-primary-foreground'
                          : message.status === 'failed'
                            ? 'bg-destructive text-destructive-foreground'
                            : 'bg-primary/80 text-primary-foreground'
                        : 'bg-card text-foreground'
                    )}
                  >
                    {/* Render image if message is an image */}
                    {message.message_type === 'image' && message.media_url ? (
                      <div className="mb-2 relative">
                        <img 
                          src={message.media_url} 
                          alt="Imagem" 
                          className="rounded-lg max-w-full max-h-48 object-contain cursor-pointer hover:opacity-90 transition-opacity"
                          onClick={() => window.open(message.media_url, '_blank')}
                        />
                        {/* Download button - always visible */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            downloadImage(message.media_url!, `whatsapp-image-${message.id}.jpg`, toast);
                          }}
                          className={cn(
                            "absolute top-2 right-2 p-2 rounded-full shadow-lg transition-all hover:scale-110",
                            message.from_me 
                              ? "bg-white/80 hover:bg-white text-green-600" 
                              : "bg-primary hover:bg-primary/90 text-primary-foreground"
                          )}
                          title="Baixar imagem"
                        >
                          <Download className="h-4 w-4" />
                        </button>
                        {(message.media_caption || message.content) && (
                          <p className="text-sm whitespace-pre-wrap mt-2">{message.media_caption || message.content}</p>
                        )}
                      </div>
                    ) : message.message_type === 'image' ? (
                      <div className="flex items-center gap-2">
                        <ImageIcon className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm italic text-muted-foreground">
                          {message.content || '[Imagem]'}
                        </span>
                      </div>
                    ) : message.message_type === 'video' ? (
                      <p className="text-sm">🎥 {message.content || '[Vídeo]'}</p>
                    ) : message.message_type === 'audio' || message.message_type === 'ptt' ? (
                      <p className="text-sm">🎵 {message.content || '[Áudio]'}</p>
                    ) : message.message_type === 'document' ? (
                      <p className="text-sm">📄 {message.content || '[Documento]'}</p>
                    ) : message.message_type === 'sticker' ? (
                      <p className="text-sm">🎨 [Sticker]</p>
                    ) : (
                    <p className="text-sm whitespace-pre-wrap break-words">{message.content && message.content.split(/(\s+)/).map((part, i) => {
                      if (part.match(/^(https?:\/\/[^\s]+)$|^www\.[^\s]+$/i)) {
                        const url = part.startsWith('http') ? part : `https://${part}`;
                        return (
                          <a 
                            key={i} 
                            href={url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="underline hover:no-underline font-medium break-all"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {part}
                          </a>
                        );
                      }
                      return part;
                    })}</p>
                    )}
                    <div className="flex items-center gap-1 justify-end mt-1">
                      <span className="text-[10px] text-muted-foreground">
                        {formatTime(message.created_at)}
                      </span>
                      {message.from_me && (
                        <span className="text-[10px] text-[#374DA4]">
                          {message.status === 'read' ? '✓✓' : message.status === 'delivered' ? '✓✓' : '✓'}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>

        {/* Input */}
        <div className="p-4 border-t bg-card">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Input
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
                placeholder="Digite uma mensagem..."
                disabled={sendingMessage || conversation.is_demo}
                className="pr-11"
              />
              <div className="absolute right-1.5 top-1/2 -translate-y-1/2">
                <AIImproveMessageButton size="sm" text={inputMessage} onImproved={(t) => setInputMessage(t)} disabled={sendingMessage || conversation.is_demo} />
              </div>
            </div>
            <Button
              onClick={handleSend}
              disabled={!inputMessage.trim() || sendingMessage || conversation.is_demo}
              size="icon"
              className="bg-green-600 hover:bg-green-700"
            >
              {sendingMessage ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
          {conversation.is_demo && (
            <p className="text-xs text-muted-foreground mt-2 text-center">
              Esta é uma conversa de demonstração
            </p>
          )}
        </div>
      </SheetContent>
      
      {/* Message Context Menu */}
      <MessageContextMenu
        isOpen={messageContextMenu.isOpen}
        position={messageContextMenu.position}
        messageId={messageContextMenu.messageId}
        messageContent={messageContextMenu.messageContent}
        isFromMe={messageContextMenu.isFromMe}
        onClose={() => setMessageContextMenu(prev => ({ ...prev, isOpen: false }))}
        onCopy={(content) => handleCopyToClipboard(content)}
        onDelete={(messageId) => {
          if (onDeleteMessage) {
            onDeleteMessage(messageId);
          }
          setMessageContextMenu(prev => ({ ...prev, isOpen: false }));
        }}
      />
    </Sheet>
  );
};

export default ConversationPopup;
