import React, { useState } from 'react';
import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { jsPDF } from 'jspdf';
import { supabase } from '@/integrations/supabase/client';
import ellosuitLogo from '@/assets/ellosuit-logo.png';

interface SavedMeetingDownloadModalProps {
  isOpen: boolean;
  onClose: () => void;
  meeting: {
    id: string;
    title: string;
    transcript: string;
    created_at: string;
    duration_seconds: number;
    speaker_mapping?: Record<string, string>;
    transcript_with_timestamps?: Array<{
      timestamp_seconds: number;
      speaker: string;
      text: string;
    }>;
  };
}

type DownloadType = 'complete' | 'summary' | 'highlights' | 'specific';

const SavedMeetingDownloadModal: React.FC<SavedMeetingDownloadModalProps> = ({
  isOpen,
  onClose,
  meeting,
}) => {
  const { toast } = useToast();
  const [downloadType, setDownloadType] = useState<DownloadType>('complete');
  const [specificQuery, setSpecificQuery] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const formatTranscriptWithSpeakers = () => {
    if (!meeting.transcript_with_timestamps || meeting.transcript_with_timestamps.length === 0) {
      return meeting.transcript;
    }

    const speakerMapping = meeting.speaker_mapping || {};
    
    return meeting.transcript_with_timestamps.map(segment => {
      const minutes = Math.floor(segment.timestamp_seconds / 60);
      const seconds = segment.timestamp_seconds % 60;
      const timeStr = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
      
      const speakerName = speakerMapping[segment.speaker] || segment.speaker;
      
      return `[${timeStr}] ${speakerName}: ${segment.text}`;
    }).join('\n\n');
  };

  const generatePDF = async (title: string, content: string) => {
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
    doc.text(title, pageWidth / 2, 45, { align: 'center' });
    
    // Meeting info
    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    const meetingDate = new Date(meeting.created_at).toLocaleDateString('pt-BR', { 
      day: '2-digit', 
      month: 'long', 
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
    doc.text(`Reunião: ${meeting.title}`, margin, 60);
    doc.text(`Data: ${meetingDate}`, margin, 68);
    
    if (meeting.duration_seconds) {
      const minutes = Math.floor(meeting.duration_seconds / 60);
      doc.text(`Duração: ${minutes} minutos`, margin, 76);
    }
    
    // Line separator
    doc.setLineWidth(0.5);
    doc.line(margin, 83, pageWidth - margin, 83);
    
    // Content
    doc.setFontSize(10);
    let yPosition = 91;
    
    const lines = doc.splitTextToSize(content, maxLineWidth);
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
    
    return doc;
  };

  const processWithAI = async (prompt: string): Promise<string> => {
    try {
      const { data, error } = await supabase.functions.invoke('ai-chat', {
        body: {
          messages: [
            {
              role: 'system',
              content: 'Você é um assistente especializado em análise de reuniões. Responda em português de forma clara e profissional.'
            },
            {
              role: 'user',
              content: `${prompt}\n\nTranscrição:\n${meeting.transcript}`
            }
          ]
        }
      });

      if (error) throw error;
      return data.response || 'Não foi possível processar a solicitação.';
    } catch (error) {
      console.error('Erro ao processar com IA:', error);
      throw new Error('Falha ao processar com IA');
    }
  };

  const handleDownload = async () => {
    setIsProcessing(true);
    try {
      let pdfContent = downloadType === 'complete' ? formatTranscriptWithSpeakers() : meeting.transcript;
      let pdfTitle = 'Transcrição Completa';
      let filename = `${meeting.title.replace(/\s+/g, '-')}-completa`;

      if (downloadType === 'summary') {
        pdfTitle = 'Resumo da Reunião';
        filename = `${meeting.title.replace(/\s+/g, '-')}-resumo`;
        pdfContent = await processWithAI(
          'Crie um resumo executivo conciso desta reunião, destacando os principais pontos discutidos e decisões tomadas.'
        );
      } else if (downloadType === 'highlights') {
        pdfTitle = 'Pontos Importantes';
        filename = `${meeting.title.replace(/\s+/g, '-')}-pontos-importantes`;
        pdfContent = await processWithAI(
          'Liste os pontos mais importantes desta reunião em tópicos. Inclua decisões, ações definidas e informações críticas.'
        );
      } else if (downloadType === 'specific') {
        if (!specificQuery.trim()) {
          toast({
            title: "Campo Obrigatório",
            description: "Por favor, descreva o que você procura",
            variant: "destructive"
          });
          return;
        }
        pdfTitle = 'Busca Específica';
        filename = `${meeting.title.replace(/\s+/g, '-')}-busca`;
        pdfContent = await processWithAI(specificQuery);
      }

      const doc = await generatePDF(pdfTitle, pdfContent);
      doc.save(`${filename}-${new Date(meeting.created_at).toISOString().split('T')[0]}.pdf`);

      toast({
        title: "Download Concluído",
        description: "O PDF foi gerado com sucesso",
      });

      onClose();
    } catch (error) {
      console.error('Erro ao gerar PDF:', error);
      toast({
        title: "Erro ao Gerar PDF",
        description: "Não foi possível gerar o PDF",
        variant: "destructive"
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px] bg-background border-border text-foreground">
        <DialogHeader>
          <DialogTitle>Baixar Transcrição</DialogTitle>
          <DialogDescription>
            Escolha o formato de download da transcrição de "{meeting.title}"
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <RadioGroup value={downloadType} onValueChange={(value) => setDownloadType(value as DownloadType)}>
            <div className="flex items-center space-x-2 p-3 rounded-lg border border-border hover:bg-muted cursor-pointer">
              <RadioGroupItem value="complete" id="complete" />
              <Label htmlFor="complete" className="flex-1 cursor-pointer">
                <div className="font-medium">Transcrição Completa</div>
                <div className="text-sm text-muted-foreground">
                  Baixar toda a transcrição sem modificações
                </div>
              </Label>
            </div>

            <div className="flex items-center space-x-2 p-3 rounded-lg border border-border hover:bg-muted cursor-pointer">
              <RadioGroupItem value="summary" id="summary" />
              <Label htmlFor="summary" className="flex-1 cursor-pointer">
                <div className="font-medium">Resumo</div>
                <div className="text-sm text-muted-foreground">
                  Resumo executivo dos principais pontos
                </div>
              </Label>
            </div>

            <div className="flex items-center space-x-2 p-3 rounded-lg border border-border hover:bg-muted cursor-pointer">
              <RadioGroupItem value="highlights" id="highlights" />
              <Label htmlFor="highlights" className="flex-1 cursor-pointer">
                <div className="font-medium">Pontos Importantes</div>
                <div className="text-sm text-muted-foreground">
                  Decisões, ações e informações críticas
                </div>
              </Label>
            </div>

            <div className="flex items-center space-x-2 p-3 rounded-lg border border-border hover:bg-muted cursor-pointer">
              <RadioGroupItem value="specific" id="specific" />
              <Label htmlFor="specific" className="flex-1 cursor-pointer">
                <div className="font-medium">Parte Específica</div>
                <div className="text-sm text-muted-foreground">
                  Buscar informações específicas na reunião
                </div>
              </Label>
            </div>
          </RadioGroup>

          {downloadType === 'specific' && (
            <div className="space-y-2">
              <Label htmlFor="query">O que você procura?</Label>
              <Textarea
                id="query"
                placeholder="Ex: Quais foram as decisões sobre o orçamento?"
                value={specificQuery}
                onChange={(e) => setSpecificQuery(e.target.value)}
                rows={3}
              />
            </div>
          )}
        </div>

        <div className="flex gap-3 justify-end">
          <Button variant="outline" onClick={onClose} disabled={isProcessing} className="border-border">
            Cancelar
          </Button>
          <Button onClick={handleDownload} disabled={isProcessing} className="gap-2 bg-[#374DA4]">
            <Download className="h-4 w-4" />
            {isProcessing ? 'Processando...' : 'Baixar PDF'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default SavedMeetingDownloadModal;
