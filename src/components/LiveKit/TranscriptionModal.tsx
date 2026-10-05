import React, { useEffect, useRef, useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Download, Loader2, Search, FileText, Clock, User, ArrowDown } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';

interface TranscriptionMessage {
  text: string;
  is_final: boolean;
  timestamp: string;
  speaker?: string;
}

interface TranscriptionModalProps {
  isOpen: boolean;
  onClose: () => void;
  messages: TranscriptionMessage[];
  isActive: boolean;
}

const TranscriptionModal: React.FC<TranscriptionModalProps> = ({
  isOpen,
  onClose,
  messages,
  isActive
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [autoScroll, setAutoScroll] = useState(true);

  const finalMessages = useMemo(() => messages.filter(msg => msg.is_final), [messages]);
  
  const filteredMessages = useMemo(() => {
    if (!searchTerm.trim()) return finalMessages;
    const q = searchTerm.toLowerCase();
    return finalMessages.filter(m => 
      m.text.toLowerCase().includes(q) || 
      m.speaker?.toLowerCase().includes(q)
    );
  }, [finalMessages, searchTerm]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollRef.current && isOpen && autoScroll) {
      const scrollContainer = scrollRef.current;
      scrollContainer.scrollTo({
        top: scrollContainer.scrollHeight,
        behavior: 'smooth'
      });
    }
  }, [messages, isOpen, autoScroll]);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    const isAtBottom = target.scrollHeight - target.scrollTop <= target.clientHeight + 50;
    setAutoScroll(isAtBottom);
  };

  const downloadTranscript = () => {
    const transcript = messages
      .filter(msg => msg.is_final)
      .map(msg => {
        const time = new Date(msg.timestamp).toLocaleTimeString('pt-BR');
        const speaker = msg.speaker ? `${msg.speaker}: ` : '';
        return `[${time}] ${speaker}${msg.text}`;
      })
      .join('\n\n');

    const blob = new Blob([transcript], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `transcricao-${new Date().toISOString()}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl h-[85vh] flex flex-col p-0 bg-[#0A0A0A] border-white/10 rounded-[28px] overflow-hidden text-white">
        <DialogHeader className="px-6 py-5 border-b border-white/5 flex-row items-center justify-between space-y-0">
          <div className="flex flex-col gap-1">
            <DialogTitle className="text-xl font-bold flex items-center gap-2">
              <FileText className="w-5 h-5 text-[#374DA4]" />
              Transcrição da Reunião
            </DialogTitle>
            <DialogDescription className="text-xs text-white/40">
              Registro em tempo real de todas as falas capturadas
            </DialogDescription>
          </div>

          <div className="flex items-center gap-2">
            {isActive && (
              <Badge variant="outline" className="bg-red-500/10 text-red-500 border-red-500/20 px-2 py-0.5 gap-1.5 animate-pulse">
                <div className="w-1.5 h-1.5 bg-red-500 rounded-full" />
                AO VIVO
              </Badge>
            )}
            <Button onClick={downloadTranscript} disabled={finalMessages.length === 0} size="sm" variant="outline" className="bg-white/5 border-white/10 hover:bg-white/10 text-xs h-9">
              <Download className="h-3.5 w-3.5 mr-2" />
              Exportar TXT
            </Button>
          </div>
        </DialogHeader>

        <div className="px-6 py-3 border-b border-white/5 bg-white/[0.02]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
            <Input 
              value={searchTerm} 
              onChange={(e) => setSearchTerm(e.target.value)} 
              placeholder="Buscar por palavra-chave ou participante..."
              className="pl-10 h-10 bg-white/5 border-white/10 text-sm text-white placeholder:text-white/20 rounded-xl focus-visible:ring-[#374DA4]/40" 
            />
          </div>
        </div>

        <div 
          className="flex-1 overflow-y-auto px-6 py-4 scrollbar-thin scrollbar-thumb-white/10" 
          ref={scrollRef}
          onScroll={handleScroll}
        >
          <div className="space-y-6">
            {filteredMessages.length === 0 ? (
              <div className="text-center py-12">
                <Loader2 className="h-10 w-10 mx-auto text-white/10 animate-spin mb-4" />
                <p className="text-sm text-white/40">{searchTerm ? 'Nenhum resultado encontrado' : 'Iniciando transcrição...'}</p>
              </div>
            ) : (
              filteredMessages.map((msg, index) => (
                <div key={index} className="flex gap-4 group animate-in fade-in slide-in-from-bottom-2 duration-300">
                  <div className="shrink-0 flex flex-col items-center gap-2 pt-1">
                    <div className="w-8 h-8 rounded-full bg-[#374DA4]/10 flex items-center justify-center border border-[#374DA4]/20 group-hover:bg-[#374DA4]/20 transition-colors">
                      <User className="w-4 h-4 text-[#374DA4]" />
                    </div>
                    <div className="h-full w-px bg-white/5 group-last:hidden" />
                  </div>
                  
                  <div className="flex-1 pb-6 group-last:pb-0">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-sm font-bold text-white group-hover:text-[#374DA4] transition-colors uppercase tracking-tight">
                        {msg.speaker || 'Participante'}
                      </span>
                      <div className="flex items-center gap-1.5 text-[10px] font-mono text-white/30">
                        <Clock className="w-3 h-3" />
                        {new Date(msg.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </div>
                    </div>
                    <p className="text-sm text-white/80 leading-relaxed font-medium bg-white/[0.03] p-4 rounded-2xl rounded-tl-none border border-white/5 group-hover:bg-white/[0.05] transition-all">
                      {msg.text}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {!autoScroll && filteredMessages.length > 0 && (
          <button 
            onClick={() => setAutoScroll(true)}
            className="absolute bottom-10 left-1/2 -translate-x-1/2 bg-[#374DA4] text-white px-4 py-2 rounded-full shadow-lg text-xs font-bold flex items-center gap-2 animate-bounce"
          >
            <ArrowDown className="w-3 h-3" />
            Novas mensagens abaixo
          </button>
        )}

        <div className="px-6 py-4 border-t border-white/5 bg-white/[0.02]">
          <div className="flex items-center justify-between text-[10px] uppercase tracking-widest font-bold text-white/30">
            <span>{filteredMessages.length} Segmentos capturados</span>
            <p>
              Apenas transcrições finais confirmadas
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default TranscriptionModal;
