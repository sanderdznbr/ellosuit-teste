import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Send, Bot, User, Loader2, FileDown } from 'lucide-react';
import SavedMeetingDownloadModal from './SavedMeetingDownloadModal';

interface MeetingReference {
  id: string;
  title: string;
  date: string;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
  meetings?: MeetingReference[];
}

interface MeetingData {
  id: string;
  title: string;
  transcript: string;
  created_at: string;
  duration_seconds: number;
  file_url: string;
  speaker_mapping?: Record<string, string>;
  transcript_with_timestamps?: Array<{
    timestamp_seconds: number;
    speaker: string;
    text: string;
  }>;
}

const MeetingsChatAI = () => {
  const { toast } = useToast();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [meetings, setMeetings] = useState<MeetingData[]>([]);
  const [selectedMeeting, setSelectedMeeting] = useState<MeetingData | null>(null);
  const [showDownloadModal, setShowDownloadModal] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadMeetings();
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const loadMeetings = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('in_person_meetings')
        .select('id, title, transcript, created_at, duration_seconds, file_url, speaker_mapping, transcript_with_timestamps')
        .eq('created_by', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setMeetings((data || []) as MeetingData[]);
    } catch (error) {
      console.error('Erro ao carregar reuniões:', error);
    }
  };

  const buildMeetingsContext = () => {
    return meetings.map(meeting => {
      const date = new Date(meeting.created_at).toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      });
      const speakerInfo = meeting.speaker_mapping 
        ? `\nParticipantes: ${Object.values(meeting.speaker_mapping).join(', ')}`
        : '';
      
      return `
ID: ${meeting.id}
Reunião: ${meeting.title}
Data: ${date}${speakerInfo}
Transcrição: ${meeting.transcript.substring(0, 800)}...
---
`;
    }).join('\n');
  };

  const extractMeetingReferences = (text: string): MeetingReference[] => {
    const references: MeetingReference[] = [];
    const addedIds = new Set<string>(); // Evitar duplicatas
    
    // Procura por menções diretas de ID no texto
    const idMatches = text.match(/ID:\s*([a-f0-9-]+)/gi);
    if (idMatches) {
      idMatches.forEach(match => {
        const id = match.split(':')[1].trim();
        const meeting = meetings.find(m => m.id === id);
        if (meeting && !addedIds.has(meeting.id)) {
          addedIds.add(meeting.id);
          references.push({
            id: meeting.id,
            title: meeting.title,
            date: new Date(meeting.created_at).toLocaleDateString('pt-BR', {
              day: '2-digit',
              month: '2-digit', 
              year: 'numeric'
            })
          });
        }
      });
    }
    
    // Se não encontrou IDs, procura por títulos exatos (mínimo 4 caracteres)
    if (references.length === 0) {
      meetings.forEach(meeting => {
        if (meeting.title.length < 4) return; // Ignora títulos muito curtos
        
        const titleLower = meeting.title.toLowerCase();
        const textLower = text.toLowerCase();
        
        // Procura por correspondência exata do título entre aspas ou isolado
        const exactMatch = textLower.includes(`"${titleLower}"`) || 
                          textLower.includes(`'${titleLower}'`) ||
                          new RegExp(`\\b${titleLower}\\b`, 'i').test(textLower);
        
        if (exactMatch && !addedIds.has(meeting.id)) {
          addedIds.add(meeting.id);
          references.push({
            id: meeting.id,
            title: meeting.title,
            date: new Date(meeting.created_at).toLocaleDateString('pt-BR', {
              day: '2-digit',
              month: '2-digit', 
              year: 'numeric'
            })
          });
        }
      });
    }
    
    // Limitar a 3 reuniões por resposta para evitar poluição visual
    return references.slice(0, 3);
  };

  const handleDownloadMeeting = (meetingId: string) => {
    const meeting = meetings.find(m => m.id === meetingId);
    if (meeting) {
      setSelectedMeeting(meeting);
      setShowDownloadModal(true);
    }
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = { role: 'user', content: input };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const meetingsContext = buildMeetingsContext();
      
      const systemPrompt = `Você é um assistente especializado em analisar reuniões. 
Você tem acesso ao histórico completo de reuniões do usuário.
Responda de forma clara, concisa e em português.

IMPORTANTE: Ao mencionar reuniões específicas:
1. SEMPRE inclua o ID da reunião no formato "ID: [id-completo]" 
2. Cite o título exato entre aspas: "nome da reunião"
3. Mencione a data no formato DD/MM/YYYY
4. Seja específico - cite apenas reuniões que realmente respondem à pergunta

Use as informações das reuniões para responder perguntas sobre:
- Quem participou de reuniões específicas
- O que foi discutido em determinadas datas
- Decisões tomadas
- Ações definidas
- Qualquer informação presente nas transcrições

Histórico de Reuniões:
${meetingsContext}`;

      const { data, error } = await supabase.functions.invoke('ai-chat', {
        body: {
          messages: [
            { role: 'system', content: systemPrompt },
            ...messages,
            userMessage
          ]
        }
      });

      if (error) throw error;

      const responseText = data.response || 'Desculpe, não consegui processar sua solicitação.';
      const meetingRefs = extractMeetingReferences(responseText);

      const assistantMessage: Message = {
        role: 'assistant',
        content: responseText,
        meetings: meetingRefs.length > 0 ? meetingRefs : undefined
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Erro ao enviar mensagem:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível processar sua mensagem',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <>
      <Card className="h-[calc(100vh-12rem)] flex flex-col bg-background border-border shadow-sm">
        <CardHeader className="border-b border-border">
          <CardTitle className="flex items-center gap-3">
            <div className="p-2 bg-[#374DA4]/10 rounded-xl">
              <Bot className="h-5 w-5 text-[#374DA4]" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-foreground">IA - Assistente de Reuniões</h3>
              <p className="text-sm text-muted-foreground font-normal">
                Faça perguntas sobre suas {meetings.length} reuniões anteriores
              </p>
            </div>
          </CardTitle>
        </CardHeader>

        <CardContent className="flex-1 flex flex-col p-0">
          <ScrollArea className="flex-1 p-6" ref={scrollRef}>
            <div className="space-y-6">
              {messages.length === 0 && (
                <div className="text-center py-16">
                  <div className="w-20 h-20 mx-auto mb-6 bg-primary/10 rounded-3xl flex items-center justify-center">
                    <Bot className="h-10 w-10 text-[#374DA4]" />
                  </div>
                  <h3 className="text-lg font-semibold mb-2 text-foreground">
                    Olá! Como posso ajudar?
                  </h3>
                  <p className="text-muted-foreground mb-4">
                    Tenho acesso a {meetings.length} reuniõe(s) salva(s).
                  </p>
                  <div className="flex flex-wrap gap-2 justify-center max-w-md mx-auto">
                    <Badge variant="secondary" className="text-xs bg-muted text-muted-foreground border-none">
                      Quem participou da reunião?
                    </Badge>
                    <Badge variant="secondary" className="text-xs bg-muted text-muted-foreground border-none">
                      O que foi decidido?
                    </Badge>
                    <Badge variant="secondary" className="text-xs bg-muted text-muted-foreground border-none">
                      Resumir reunião
                    </Badge>
                  </div>
                </div>
              )}

              {messages.map((message, index) => (
                <div
                  key={index}
                  className={`flex gap-3 ${
                    message.role === 'user' ? 'justify-end' : 'justify-start'
                  }`}
                >
                  {message.role === 'assistant' && (
                    <div className="w-10 h-10 rounded-2xl bg-[#374DA4]/10 flex items-center justify-center flex-shrink-0 shadow-sm border border-[#374DA4]/10">
                      <Bot className="h-5 w-5 text-[#374DA4]" />
                    </div>
                  )}
                  <div className="flex flex-col gap-2 max-w-[75%]">
                    <div
                      className={`rounded-2xl p-4 shadow-sm ${
                        message.role === 'user'
                          ? 'bg-[#374DA4] text-white shadow-md shadow-[#374DA4]/10'
                          : 'bg-card border border-border shadow-sm text-foreground'
                      }`}
                    >
                      <p className={`text-sm leading-relaxed whitespace-pre-wrap ${
                        message.role === 'user' ? 'text-white' : 'text-foreground'
                      }`}>
                        {message.content}
                      </p>
                    </div>
                    
                    {/* Botões de Ação para Reuniões Mencionadas */}
                    {message.role === 'assistant' && message.meetings && message.meetings.length > 0 && (
                      <div className="space-y-2 mt-3">
                        <p className="text-[10px] text-muted-foreground/30 font-bold uppercase tracking-widest">
                          📎 Reuniões Mencionadas
                        </p>
                        <div className="space-y-2">
                          {message.meetings.map((meeting) => (
                            <div
                              key={meeting.id}
                              className="flex items-center justify-between gap-3 p-3 bg-card rounded-xl border border-border hover:border-[#374DA4]/20 transition-colors shadow-sm"
                            >
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold text-foreground truncate">
                                  {meeting.title}
                                </p>
                                <p className="text-xs text-muted-foreground/40 mt-0.5">
                                  {meeting.date}
                                </p>
                              </div>
                              <Button
                                size="sm"
                                onClick={() => handleDownloadMeeting(meeting.id)}
                                className="h-9 px-4 rounded-lg bg-[#374DA4] hover:bg-[#374DA4]/90 shadow-sm"
                              >
                                <FileDown className="h-4 w-4 mr-2" />
                                Baixar
                              </Button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                  {message.role === 'user' && (
                    <div className="w-10 h-10 rounded-2xl bg-[#374DA4] flex items-center justify-center flex-shrink-0 shadow-sm shadow-[#374DA4]/20">
                      <User className="h-5 w-5 text-white" />
                    </div>
                  )}
                </div>
              ))}

              {isLoading && (
                <div className="flex gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-[#374DA4]/10 flex items-center justify-center shadow-sm border border-[#374DA4]/10">
                    <Bot className="h-5 w-5 text-[#374DA4]" />
                  </div>
                  <div className="bg-card border border-border text-foreground rounded-2xl p-4 shadow-sm">
                    <div className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin text-[#374DA4]" />
                      <span className="text-sm text-muted-foreground/40">Pensando...</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>

          <div className="border-t border-border bg-card p-4">
            <div className="flex gap-3">
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Pergunte sobre suas reuniões..."
                disabled={isLoading}
                className="flex-1 rounded-xl border-border text-foreground h-11 bg-background shadow-inner focus-visible:ring-[#374DA4]/40"
              />
              <Button 
                onClick={handleSend} 
                disabled={isLoading || !input.trim()}
                size="icon"
                className="h-11 w-11 rounded-xl bg-[#374DA4] hover:bg-[#374DA4]/90 shadow-sm"
              >
                {isLoading ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <Send className="h-5 w-5" />
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {selectedMeeting && (
        <SavedMeetingDownloadModal
          isOpen={showDownloadModal}
          onClose={() => {
            setShowDownloadModal(false);
            setSelectedMeeting(null);
          }}
          meeting={selectedMeeting}
        />
      )}
    </>
  );
};

export default MeetingsChatAI;
