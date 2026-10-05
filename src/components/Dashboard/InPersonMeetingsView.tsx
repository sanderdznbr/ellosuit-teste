import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Download, Calendar, Clock, FileText, Trash2, Loader2, Sparkles, BookOpen, Search } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { ScrollArea } from '@/components/ui/scroll-area';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { jsPDF } from 'jspdf';
import ellosuitLogo from '@/assets/ellosuit-logo.png';

interface InPersonMeeting {
  id: string;
  title: string;
  transcript: string | null;
  file_url: string | null;
  duration_seconds: number | null;
  created_at: string;
  created_by: string;
}

const InPersonMeetingsView = () => {
  const [meetings, setMeetings] = useState<InPersonMeeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [meetingToDelete, setMeetingToDelete] = useState<InPersonMeeting | null>(null);
  const [showDownloadOptions, setShowDownloadOptions] = useState(false);
  const [selectedMeeting, setSelectedMeeting] = useState<InPersonMeeting | null>(null);
  const [isProcessingAI, setIsProcessingAI] = useState(false);
  const [specificQuery, setSpecificQuery] = useState('');
  const { toast } = useToast();

  useEffect(() => {
    fetchMeetings();
  }, []);

  const fetchMeetings = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: companyData } = await supabase
        .from('company_users')
        .select('company_id')
        .eq('user_id', user.id)
        .single();

      if (!companyData) return;

      const { data, error } = await supabase
        .from('in_person_meetings')
        .select('*')
        .eq('company_id', companyData.company_id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      setMeetings(data || []);
    } catch (error) {
      console.error('Erro ao buscar reuniões:', error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar as reuniões presenciais",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const downloadTranscript = (meeting: InPersonMeeting) => {
    setSelectedMeeting(meeting);
    setShowDownloadOptions(true);
  };

  const cleanMarkdownForPDF = (text: string): string => {
    return text
      .replace(/\*\*([^*]+)\*\*/g, '$1')
      .replace(/\*([^*]+)\*/g, '$1')
      .replace(/#{1,6}\s+/g, '')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .replace(/`([^`]+)`/g, '$1')
      .trim();
  };

  const processTranscriptWithAI = async (type: 'summary' | 'keypoints', customQuery?: string) => {
    if (!selectedMeeting?.transcript) return null;
    
    setIsProcessingAI(true);
    try {
      const fullTranscript = selectedMeeting.transcript;

      let prompt = '';
      if (type === 'summary') {
        prompt = `Você é um assistente que cria resumos executivos de reuniões. Analise esta transcrição e crie um resumo profissional e conciso em português, SEM usar formatação markdown (sem asteriscos, sem hashtags). Use texto simples e organize em parágrafos claros. Destaque os principais tópicos discutidos, decisões tomadas e próximos passos:\n\n${fullTranscript}`;
      } else if (type === 'keypoints') {
        prompt = `Você é um assistente que identifica pontos-chave em reuniões. Analise esta transcrição e liste os pontos mais importantes em português, SEM usar formatação markdown (sem asteriscos, sem hashtags). Use texto simples com hífens (-) para listas. Liste: decisões tomadas, ações necessárias e tópicos relevantes:\n\n${fullTranscript}`;
      } else if (customQuery) {
        prompt = `Você é um assistente que ajuda a extrair informações específicas de transcrições de reuniões. O usuário quer saber: "${customQuery}"\n\nAnalise esta transcrição e forneça uma resposta precisa e detalhada em português, SEM usar formatação markdown:\n\n${fullTranscript}`;
      }

      const { data, error } = await supabase.functions.invoke('ai-chat', {
        body: { 
          messages: [
            { role: 'user', content: prompt }
          ]
        }
      });

      if (error) throw error;

      const cleanedText = cleanMarkdownForPDF(data.message);
      return cleanedText;
    } catch (error) {
      console.error('Erro ao processar com IA:', error);
      toast({
        title: "Erro ao Processar",
        description: "Não foi possível processar a transcrição com IA",
        variant: "destructive"
      });
      return null;
    } finally {
      setIsProcessingAI(false);
    }
  };

  const downloadTranscriptPDF = async (content?: string, title?: string) => {
    if (!selectedMeeting) return;
    
    try {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 20;
      const maxLineWidth = pageWidth - 2 * margin;
      
      // Add logo
      const img = new Image();
      img.src = ellosuitLogo;
      await new Promise((resolve) => {
        img.onload = resolve;
      });
      
      doc.addImage(img, 'PNG', margin, 15, 50, 15);
      
      // Title
      doc.setFontSize(18);
      doc.setFont('helvetica', 'bold');
      const docTitle = title || 'Transcrição de Reunião';
      doc.text(docTitle, pageWidth / 2, 45, { align: 'center' });
      
      // Meeting info
      doc.setFontSize(12);
      doc.setFont('helvetica', 'normal');
      const meetingDate = new Date(selectedMeeting.created_at).toLocaleDateString('pt-BR', { 
        day: '2-digit', 
        month: 'long', 
        year: 'numeric' 
      });
      doc.text(`Reunião: ${selectedMeeting.title}`, margin, 60);
      doc.text(`Data: ${meetingDate}`, margin, 68);
      
      // Line separator
      doc.setLineWidth(0.5);
      doc.line(margin, 75, pageWidth - margin, 75);
      
      // Content
      doc.setFontSize(10);
      let yPosition = 85;
      
      const textContent = content || selectedMeeting.transcript || '';
      doc.setFont('helvetica', 'normal');
      const lines = doc.splitTextToSize(textContent, maxLineWidth);
      lines.forEach((line: string) => {
        if (yPosition > pageHeight - 30) {
          doc.addPage();
          yPosition = margin;
        }
        doc.text(line, margin, yPosition);
        yPosition += 5;
      });
      
      // Footer
      const totalPages = doc.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(150);
        doc.text(
          `Página ${i} de ${totalPages}`,
          pageWidth / 2,
          pageHeight - 10,
          { align: 'center' }
        );
      }
      
      const filename = title 
        ? `${title.toLowerCase().replace(/\s+/g, '-')}-${selectedMeeting.title.replace(/\s+/g, '-')}-${new Date().toISOString().split('T')[0]}.pdf`
        : `transcricao-${selectedMeeting.title.replace(/\s+/g, '-')}-${new Date().toISOString().split('T')[0]}.pdf`;
      
      doc.save(filename);
      
      toast({
        title: "Download PDF Iniciado",
        description: "A transcrição em PDF está sendo baixada",
      });
    } catch (error) {
      console.error('Erro ao gerar PDF:', error);
      toast({
        title: "Erro ao Gerar PDF",
        description: "Não foi possível gerar o PDF",
        variant: "destructive"
      });
    }
  };

  const handleDeleteClick = (meeting: InPersonMeeting) => {
    setMeetingToDelete(meeting);
    setShowDeleteDialog(true);
  };

  const handleDeleteConfirm = async () => {
    if (!meetingToDelete) return;
    
    setDeletingId(meetingToDelete.id);
    
    try {
      // Delete from storage if exists
      if (meetingToDelete.file_url) {
        const fileName = meetingToDelete.file_url.split('/').pop();
        if (fileName) {
          await supabase.storage
            .from('meeting-recordings')
            .remove([fileName]);
        }
      }

      // Delete from database
      const { error } = await supabase
        .from('in_person_meetings')
        .delete()
        .eq('id', meetingToDelete.id);

      if (error) throw error;

      // Update local state
      setMeetings(prev => prev.filter(m => m.id !== meetingToDelete.id));

      toast({
        title: "Reunião Excluída",
        description: "A reunião foi excluída com sucesso",
      });
    } catch (error) {
      console.error('Erro ao excluir reunião:', error);
      toast({
        title: "Erro",
        description: "Não foi possível excluir a reunião",
        variant: "destructive"
      });
    } finally {
      setDeletingId(null);
      setShowDeleteDialog(false);
      setMeetingToDelete(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 bg-[#faf9f7]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#374DA4] mx-auto mb-2" />
          <p className="text-sm text-black/50">Carregando...</p>
        </div>
      </div>
    );
  }

  if (meetings.length === 0) {
    return (
      <div className="text-center py-12 bg-[#faf9f7]">
        <FileText className="h-12 w-12 mx-auto mb-4 text-black/20" />
        <h3 className="text-lg font-semibold mb-2 text-black">Nenhuma reunião presencial</h3>
        <p className="text-sm text-black/40">
          As reuniões presenciais gravadas aparecerão aqui
        </p>
      </div>
    );
  }

  return (
    <div className="bg-[#faf9f7] min-h-full">
      {/* Download Options Dialog */}
      <Dialog open={showDownloadOptions} onOpenChange={setShowDownloadOptions}>
        <DialogContent className="sm:max-w-[500px] rounded-2xl bg-[#faf9f7] border-black/5 text-black">
          <DialogHeader>
            <DialogTitle className="text-xl">Opções de Download</DialogTitle>
            <DialogDescription>
              Escolha como deseja baixar a transcrição da reunião
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-3 py-4">
            <Button 
              onClick={() => {
                downloadTranscriptPDF();
                setShowDownloadOptions(false);
              }}
              className="w-full gap-2 h-auto py-4 justify-start rounded-xl hover:bg-black/5 transition-all bg-white border-black/5 shadow-sm text-black"
              variant="outline"
            >
              <FileText className="h-5 w-5" />
              <div className="text-left">
                <div className="font-semibold">PDF Completo</div>
                <div className="text-xs text-black/40">Transcrição original sem alterações</div>
              </div>
            </Button>

            <Button 
              onClick={async () => {
                const summary = await processTranscriptWithAI('summary');
                if (summary) {
                  await downloadTranscriptPDF(summary, 'Resumo Executivo');
                  setShowDownloadOptions(false);
                }
              }}
              className="w-full gap-2 h-auto py-4 justify-start rounded-xl hover:bg-black/5 transition-all bg-white border-black/5 shadow-sm text-black"
              variant="outline"
              disabled={isProcessingAI}
            >
              {isProcessingAI ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Sparkles className="h-5 w-5" />
              )}
              <div className="text-left">
                <div className="font-semibold">PDF Resumido com IA</div>
                <div className="text-xs text-black/40">Resumo executivo gerado por IA</div>
              </div>
            </Button>

            <Button 
              onClick={async () => {
                const keypoints = await processTranscriptWithAI('keypoints');
                if (keypoints) {
                  await downloadTranscriptPDF(keypoints, 'Pontos-Chave');
                  setShowDownloadOptions(false);
                }
              }}
              className="w-full gap-2 h-auto py-4 justify-start rounded-xl hover:bg-black/5 transition-all bg-white border-black/5 shadow-sm text-black"
              variant="outline"
              disabled={isProcessingAI}
            >
              {isProcessingAI ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <BookOpen className="h-5 w-5" />
              )}
              <div className="text-left">
                <div className="font-semibold">Pontos Importantes</div>
                <div className="text-xs text-black/40">Decisões e ações extraídas por IA</div>
              </div>
            </Button>

            <div className="border-t border-black/5 pt-3 mt-3">
              <Label htmlFor="specific-query" className="text-sm font-medium mb-2 block">
                Consulta Específica
              </Label>
              <Textarea
                id="specific-query"
                placeholder="Ex: Quais foram as decisões tomadas sobre o projeto X?"
                value={specificQuery}
                onChange={(e) => setSpecificQuery(e.target.value)}
                className="min-h-[80px] rounded-xl border-black/10 text-black bg-white focus-visible:ring-[#374DA4]/40"
              />
              <Button
                onClick={async () => {
                  if (!specificQuery.trim()) return;
                  const result = await processTranscriptWithAI('keypoints', specificQuery);
                  if (result) {
                    await downloadTranscriptPDF(result, 'Consulta Específica');
                    setShowDownloadOptions(false);
                    setSpecificQuery('');
                  }
                }}
                className="w-full mt-3 gap-2 rounded-xl bg-[#374DA4] text-white hover:bg-[#374DA4]/90 shadow-sm"
                disabled={isProcessingAI || !specificQuery.trim()}
              >
                {isProcessingAI ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Processando...
                  </>
                ) : (
                  <>
                    <Search className="h-4 w-4 mr-2" />
                    Buscar e Baixar
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <ScrollArea className="h-full scrollbar-hide">
        <div className="p-6 space-y-4">
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-black mb-2">Reuniões Presenciais</h2>
            <p className="text-sm text-black/50">
              Histórico de reuniões presenciais gravadas e transcritas
            </p>
          </div>

          <div className="grid gap-4">
            {meetings.map((meeting) => (
              <Card key={meeting.id} className="hover:shadow-md transition-shadow bg-white border-black/5 shadow-sm rounded-2xl">
                <CardHeader>
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1 flex-1">
                      <CardTitle className="text-lg text-black font-bold">{meeting.title}</CardTitle>
                      <div className="flex items-center gap-4 text-xs text-black/40">
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {format(new Date(meeting.created_at), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                        </div>
                        <div className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {format(new Date(meeting.created_at), 'HH:mm', { locale: ptBR })}
                        </div>
                        {meeting.duration_seconds && (
                          <div className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {Math.floor(meeting.duration_seconds / 60)}min
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      {meeting.transcript && (
                        <Button
                          onClick={() => downloadTranscript(meeting)}
                          size="sm"
                          variant="outline"
                          className="gap-2 rounded-lg border-black/5 bg-black/5 text-black hover:bg-black/10"
                        >
                          <Download className="h-3 w-3" />
                          Baixar
                        </Button>
                      )}
                      <Button
                        onClick={() => handleDeleteClick(meeting)}
                        size="sm"
                        variant="destructive"
                        disabled={deletingId === meeting.id}
                        className="gap-2 rounded-lg bg-red-600 hover:bg-red-700 text-white shadow-sm"
                      >
                        <Trash2 className="h-3 w-3" />
                        Excluir
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                {meeting.transcript && (
                  <CardContent>
                    <div className="bg-black/5 rounded-lg p-4">
                      <p className="text-sm text-black/50 font-semibold mb-2">
                        Prévia da Transcrição:
                      </p>
                      <p className="text-sm line-clamp-3 text-black/70">
                        {meeting.transcript}
                      </p>
                    </div>
                  </CardContent>
                )}
              </Card>
            ))}
          </div>
        </div>
      </ScrollArea>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent className="bg-[#faf9f7] border-black/5 text-black">
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
            <AlertDialogDescription className="text-black/60">
              Tem certeza que deseja excluir a reunião "{meetingToDelete?.title}"? 
              Esta ação não pode ser desfeita e a gravação será permanentemente removida.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default InPersonMeetingsView;
