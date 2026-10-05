import React, { useState, useEffect, useRef } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Mic, MicOff, Download } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TranscriptionMessage {
  text: string;
  is_final: boolean;
  timestamp: string;
  speaker?: string;
}

interface TranscriptionPanelProps {
  roomId: string;
  isActive: boolean;
  messages: TranscriptionMessage[];
  onMessagesUpdate: (messages: TranscriptionMessage[]) => void;
}

const TranscriptionPanel: React.FC<TranscriptionPanelProps> = ({ roomId, isActive, messages, onMessagesUpdate }) => {
  const [currentTranscript, setCurrentTranscript] = useState('');
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const visibleMessages = messages.filter(message => message.is_final);

  // Auto-scroll quando novas mensagens chegam - melhorado
  useEffect(() => {
    if (messages.length > 0 && isActive) {
      // Múltiplas tentativas para garantir o scroll
      const scrollToBottom = () => {
        if (scrollAreaRef.current) {
          const scrollElement = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
          if (scrollElement) {
            scrollElement.scrollTop = scrollElement.scrollHeight;
          }
        }
      };
      
      // Scroll imediato
      scrollToBottom();
      
      // Scroll após renderização
      requestAnimationFrame(() => {
        scrollToBottom();
      });
      
      // Scroll com delay para garantir
      setTimeout(scrollToBottom, 100);
    }
  }, [messages, isActive]);


  const downloadTranscript = () => {
    const finalMessages = messages.filter(message => message.is_final);
    const ordered = [...finalMessages].sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
    const header = `Transcrição da reunião ${roomId}\nGerado em: ${new Date().toLocaleString('pt-BR')}\nTotal de segmentos: ${ordered.length}\n\n`;
    const body = ordered.map(msg => {
      const time = new Date(msg.timestamp).toLocaleTimeString('pt-BR', {
        hour: '2-digit', minute: '2-digit', second: '2-digit'
      });
      const speaker = msg.speaker || 'Participante';
      return `[${time}] ${speaker}: ${msg.text}`;
    }).join('\n');
    const fullText = header + body;

    const blob = new Blob([fullText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `transcript-${roomId}-${new Date().toISOString().split('T')[0]}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (!isActive) return null;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-border">
        <div className="flex items-center gap-2">
          <h3 className="font-medium text-sm">Transcrição em Tempo Real</h3>
          {isActive && (
            <div className="flex items-center gap-1 text-xs text-green-600">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              Ativa
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          {visibleMessages.length > 0 && (
            <Button
              onClick={downloadTranscript}
              size="sm"
              variant="outline"
              className="h-8 gap-2"
            >
              <Download className="h-3 w-3" />
              <span className="text-xs">Baixar</span>
            </Button>
          )}
        </div>
      </div>

      {/* Transcription Area */}
      <ScrollArea className="flex-1 p-4" ref={scrollAreaRef}>
        <div className="space-y-4">
          {visibleMessages.length === 0 ? (
            <div className="text-center text-sm text-muted-foreground py-12">
              <div className="relative inline-block mb-4">
                <Mic className="h-12 w-12 text-primary animate-pulse" />
                <div className="absolute inset-0 bg-primary/20 rounded-full animate-ping" />
              </div>
              <p className="font-semibold text-base mb-2">Transcrição em Tempo Real</p>
              <p className="text-xs text-muted-foreground max-w-xs mx-auto">
                Os áudios dos participantes serão transcritos automaticamente e aparecerão aqui instantaneamente
              </p>
            </div>
          ) : (
            <>
              {[...visibleMessages]
                .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
                .map((message, index) => (
                <div 
                  key={index} 
                  className="bg-muted/50 rounded-lg p-3 border border-border hover:bg-muted/70 transition-colors animate-in fade-in slide-in-from-bottom-2 duration-300"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      {message.speaker && (
                        <span className="text-xs font-semibold text-primary">
                          {message.speaker}
                        </span>
                      )}
                      <span className="text-xs text-muted-foreground">
                        {new Date(message.timestamp).toLocaleTimeString('pt-BR', {
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit'
                        })}
                      </span>
                    </div>
                    {message.is_final && (
                      <div className="w-1.5 h-1.5 bg-green-500 rounded-full" />
                    )}
                  </div>
                  <div className={cn(
                    "text-sm leading-relaxed",
                    message.is_final ? "text-foreground" : "text-muted-foreground italic"
                  )}>
                    {message.text}
                  </div>
                </div>
              ))}
              
              {/* Current transcript being typed */}
              {currentTranscript && (
                <div className="bg-primary/5 rounded-lg p-3 border border-primary/20 animate-pulse">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-2 h-2 bg-primary rounded-full animate-pulse" />
                    <span className="text-xs text-primary font-medium">
                      Transcrevendo...
                    </span>
                  </div>
                  <div className="text-sm text-muted-foreground leading-relaxed italic">
                    {currentTranscript}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </ScrollArea>
      
      {/* Active indicator */}
      {isActive && (
        <div className="p-2 border-t border-border bg-green-50 dark:bg-green-950/20">
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2 text-green-700 dark:text-green-400">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              <span className="font-medium">Transcrição ativa</span>
            </div>
            <span className="text-muted-foreground">
              {visibleMessages.length} trecho{visibleMessages.length !== 1 ? 's' : ''} final{visibleMessages.length !== 1 ? 'is' : ''}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

export default TranscriptionPanel;