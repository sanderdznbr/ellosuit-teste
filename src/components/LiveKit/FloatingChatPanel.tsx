import React, { useState, useEffect, useRef } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Send, X, Paperclip, Download, File } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useRoomContext, useLocalParticipant } from '@livekit/components-react';
import { useToast } from '@/hooks/use-toast';

interface FloatingChatPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ChatMessage {
  id: number;
  participant: string;
  message?: string;
  file?: { name: string; size: number; type: string; url: string };
  timestamp: Date;
}

const FloatingChatPanel: React.FC<FloatingChatPanelProps> = ({ isOpen, onClose }) => {
  const [inputMessage, setInputMessage] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const { localParticipant } = useLocalParticipant();
  const room = useRoomContext();
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  // Listen for chat messages and files
  useEffect(() => {
    if (!room) return;

    const handleDataReceived = (payload: Uint8Array, participant: any) => {
      try {
        const decoder = new TextDecoder();
        const data = JSON.parse(decoder.decode(payload));
        
        if (data.type === 'chat') {
          setMessages(prev => [...prev, {
            id: Date.now(),
            participant: participant?.name || participant?.identity || 'Participante',
            message: data.text,
            timestamp: new Date()
          }]);
        } else if (data.type === 'file') {
          setMessages(prev => [...prev, {
            id: Date.now(),
            participant: participant?.name || participant?.identity || 'Participante',
            file: {
              name: data.fileName,
              size: data.fileSize,
              type: data.fileType,
              url: data.fileUrl
            },
            timestamp: new Date()
          }]);
        }
      } catch (error) {
        console.error('Erro ao processar dados recebidos:', error);
      }
    };

    room.on('dataReceived', handleDataReceived);
    
    return () => {
      room.off('dataReceived', handleDataReceived);
    };
  }, [room]);

  // Auto scroll chat to bottom
  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || !room || !localParticipant) return;

    try {
      const messageData = {
        type: 'chat',
        text: inputMessage,
        timestamp: new Date().toISOString()
      };

      const encoder = new TextEncoder();
      const data = encoder.encode(JSON.stringify(messageData));
      
      await room.localParticipant.publishData(data, { reliable: true });
      
      const senderName = localParticipant.name || localParticipant.identity || 'Você';
      setMessages(prev => [...prev, {
        id: Date.now(),
        participant: senderName,
        message: inputMessage,
        timestamp: new Date()
      }]);
      
      setInputMessage('');
    } catch (error) {
      console.error('Erro ao enviar mensagem:', error);
      toast({
        title: "Erro ao enviar mensagem",
        description: "Não foi possível enviar a mensagem",
        variant: "destructive"
      });
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !room || !localParticipant) return;

    // Limit to 50KB to avoid DataChannel 65535 bytes limit (base64 increases size ~33%)
    if (file.size > 50 * 1024) {
      toast({
        title: "Arquivo muito grande",
        description: "O arquivo deve ter no máximo 50KB para compartilhamento via chat",
        variant: "destructive"
      });
      return;
    }

    try {
      console.log('📎 Iniciando compartilhamento de arquivo:', file.name);
      
      const reader = new FileReader();
      reader.onloadend = async () => {
        try {
          const base64Data = reader.result as string;
          
          console.log('📦 Arquivo convertido para base64, tamanho:', base64Data.length);
          
          const fileData = {
            type: 'file',
            fileName: file.name,
            fileSize: file.size,
            fileType: file.type,
            fileUrl: base64Data,
            timestamp: new Date().toISOString()
          };

          const encoder = new TextEncoder();
          const data = encoder.encode(JSON.stringify(fileData));
          
          console.log('📤 Enviando arquivo via DataChannel, bytes:', data.length);
          
          if (!room.localParticipant) {
            throw new Error('LocalParticipant não disponível');
          }
          
          await room.localParticipant.publishData(data, { reliable: true });
          
          console.log('✅ Arquivo enviado com sucesso');
          
          const senderName = localParticipant.name || localParticipant.identity || 'Você';
          setMessages(prev => [...prev, {
            id: Date.now(),
            participant: senderName,
            file: {
              name: file.name,
              size: file.size,
              type: file.type,
              url: base64Data
            },
            timestamp: new Date()
          }]);

          toast({
            title: "Arquivo compartilhado",
            description: `${file.name} foi compartilhado com sucesso`,
          });
        } catch (error) {
          console.error('❌ Erro ao publicar arquivo:', error);
          toast({
            title: "Erro ao compartilhar",
            description: error instanceof Error ? error.message : "Não foi possível compartilhar o arquivo",
            variant: "destructive"
          });
        }
      };
      
      reader.onerror = (error) => {
        console.error('❌ Erro ao ler arquivo:', error);
        toast({
          title: "Erro ao ler arquivo",
          description: "Não foi possível ler o arquivo",
          variant: "destructive"
        });
      };
      
      reader.readAsDataURL(file);
    } catch (error) {
      console.error('❌ Erro geral no compartilhamento:', error);
      toast({
        title: "Erro ao processar arquivo",
        description: "Não foi possível processar o arquivo",
        variant: "destructive"
      });
    }
    
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed bottom-20 right-6 w-96 h-[500px] bg-background border border-border rounded-2xl shadow-2xl flex flex-col z-50 animate-in slide-in-from-bottom-4 duration-300">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border bg-muted/50 rounded-t-2xl">
        <h3 className="font-semibold text-foreground">Bate-papo</h3>
        <Button
          onClick={onClose}
          size="sm"
          variant="ghost"
          className="h-8 w-8 p-0 rounded-full hover:bg-background"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Messages Area */}
      <ScrollArea className="flex-1 p-4" ref={chatScrollRef}>
        <div className="space-y-3">
          {messages.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-sm text-muted-foreground font-medium">Nenhuma mensagem ainda</p>
              <p className="text-xs text-muted-foreground mt-1">Envie uma mensagem para começar</p>
            </div>
          ) : (
            messages.map((msg) => (
              <div key={msg.id} className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-foreground">
                    {msg.participant}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                {msg.message ? (
                  <div className="text-sm text-foreground leading-relaxed bg-primary/10 rounded-2xl px-4 py-2.5 border border-primary/20">
                    {msg.message}
                  </div>
                ) : msg.file ? (
                  <div className="flex items-center gap-3 bg-accent rounded-2xl px-4 py-2.5 border border-border">
                    <File className="h-6 w-6 text-primary flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{msg.file.name}</p>
                      <p className="text-xs text-muted-foreground">{formatFileSize(msg.file.size)}</p>
                    </div>
                    <a
                      href={msg.file.url}
                      download={msg.file.name}
                      className="flex-shrink-0"
                    >
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0 hover:bg-primary/10 rounded-full">
                        <Download className="h-3.5 w-3.5" />
                      </Button>
                    </a>
                  </div>
                ) : null}
              </div>
            ))
          )}
        </div>
      </ScrollArea>

      {/* Input Area */}
      <div className="p-4 border-t border-border bg-muted/50 rounded-b-2xl">
        {!room || !localParticipant ? (
          <div className="text-center py-2">
            <p className="text-xs text-muted-foreground">Conectando...</p>
          </div>
        ) : (
          <div className="flex gap-2">
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              onChange={handleFileSelect}
            />
            <Button
              onClick={() => fileInputRef.current?.click()}
              size="sm"
              variant="ghost"
              className="px-2.5 rounded-full hover:bg-background"
              disabled={!room || !localParticipant}
            >
              <Paperclip className="h-4 w-4" />
            </Button>
            <Input
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Digite sua mensagem..."
              className="flex-1 bg-background rounded-full border-border"
              disabled={!room || !localParticipant}
            />
            <Button 
              onClick={handleSendMessage}
              disabled={!inputMessage.trim() || !room || !localParticipant}
              size="sm"
              className="rounded-full px-4"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default FloatingChatPanel;
