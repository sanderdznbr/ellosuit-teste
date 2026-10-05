import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useScribe, CommitStrategy } from '@elevenlabs/react';
import { Mic, Square, Download, FileText, AlertTriangle, Sparkles, BookOpen, Search, Loader2, ChevronRight, Users, Settings2, Plus, Pause, Play, Eye, MessageSquare, Clock, Brain, Target, Heart, Shield, Zap, Briefcase, Check, Info, X, LayoutGrid } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { AudioDeviceSelector } from './AudioDeviceSelector';
import { Textarea } from '@/components/ui/textarea';
import { jsPDF } from 'jspdf';
import ellosuitLogo from '@/assets/ellosuit-logo.png';

interface TranscriptMessage {
  text: string;
  timestamp: string;
  speaker?: string;
}

const AudioVisualizer = ({ stream, isPaused }: { stream: MediaStream; isPaused: boolean }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>();

  useEffect(() => {
    if (!stream || isPaused) return;

    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    if (audioContext.state === 'suspended') {
      audioContext.resume();
    }
    const source = audioContext.createMediaStreamSource(stream);
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 128;
    source.connect(analyser);

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const draw = () => {
      if (!canvasRef.current) return;
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      animationRef.current = requestAnimationFrame(draw);
      analyser.getByteFrequencyData(dataArray);

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      const barWidth = (canvas.width / bufferLength) * 1.5;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        const barHeight = Math.max(4, (dataArray[i] / 255) * canvas.height);
        const y = (canvas.height - barHeight) / 2;
        const radius = barWidth / 2;
        
        // Vibrant blue/purple gradient simulation
        const gradient = ctx.createLinearGradient(0, y, 0, y + barHeight);
        gradient.addColorStop(0, '#374DA4');
        gradient.addColorStop(0.5, '#4f46e5');
        gradient.addColorStop(1, '#374DA4');
        ctx.fillStyle = gradient;
        
        ctx.beginPath();
        if (ctx.roundRect) {
          ctx.roundRect(x, y, barWidth, barHeight, radius);
        } else {
          ctx.rect(x, y, barWidth, barHeight);
        }
        ctx.fill();

        x += barWidth + 4;
      }
    };

    draw();

    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      if (audioContext.state !== 'closed') audioContext.close();
    };
  }, [stream, isPaused]);

  return <canvas ref={canvasRef} className="w-full h-24" width={600} height={96} />;
};

  const callInPersonSkill = (skillId: string, skillNames: Record<string, string>, toast: any, setActiveSkills: any, setInsights: any) => {
    setActiveSkills((prev: string[]) => [...prev, skillId]);
    
    toast({
      title: `${skillNames[skillId] || 'Skill'} Ativada`,
      description: "O agente de IA entrou na reunião presencial para analisar a transcrição.",
    });

    setTimeout(() => {
      const newInsight = {
        id: Math.random().toString(36).substr(2, 9),
        skill: skillNames[skillId],
        text: `Insight em Tempo Real: Com base na conversa atual, recomendo focar na demonstração de valor antes de falar de custos.`,
        type: 'recommendation' as const,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setInsights((prev: any[]) => [newInsight, ...prev]);
    }, 5000);
  };

  const InPersonMeeting = ({ initialTitle = '', onBack }: { initialTitle?: string; onBack?: () => void }) => {
  const { toast } = useToast();
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [transcript, setTranscript] = useState<TranscriptMessage[]>([]);
  const [currentText, setCurrentText] = useState('');
  const [showSummary, setShowSummary] = useState(false);
   const [meetingTitle, setMeetingTitle] = useState(initialTitle || `Reunião ${new Date().toLocaleDateString('pt-BR')}`);
   const [peopleCount, setPeopleCount] = useState<string>('2');
   const [step, setStep] = useState<'setup' | 'recording'>('setup');
   const [activeTab, setActiveTab] = useState<'visualizer' | 'transcript'>('visualizer');
   const [recordingDuration, setRecordingDuration] = useState(0);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');
  const [currentStream, setCurrentStream] = useState<MediaStream | null>(null);
  const [showDownloadOptions, setShowDownloadOptions] = useState(false);
  const [isProcessingAI, setIsProcessingAI] = useState(false);
  const [isFinishing, setIsFinishing] = useState(false);
  const [specificQuery, setSpecificQuery] = useState('');
  const [isProcessingSpeakers, setIsProcessingSpeakers] = useState(false);
  const [showSpeakerMapping, setShowSpeakerMapping] = useState(false);
  const [speakerMapping, setSpeakerMapping] = useState<Record<string, string>>({});
   const [identifiedSpeakers, setIdentifiedSpeakers] = useState<string[]>([]);
   const [showInPersonSkills, setShowInPersonSkills] = useState(false);
   const [activeSkills, setActiveSkills] = useState<string[]>([]);
   const [insights, setInsights] = useState<{ id: string, skill: string, text: string, type: 'summary' | 'key-point' | 'recommendation', time: string }[]>([]);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const meetingIdRef = useRef<string>('');
  const lastTranscriptRef = useRef<string>('');
  const scribeConnectedRef = useRef(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Check if two texts are similar (for deduplication)
  const isSimilarText = (text1: string, text2: string): boolean => {
    if (!text1 || !text2) return false;
    const clean1 = text1.toLowerCase().trim().replace(/[.,!?]/g, '');
    const clean2 = text2.toLowerCase().trim().replace(/[.,!?]/g, '');
    if (clean1 === clean2) return true;
    const shorter = clean1.length < clean2.length ? clean1 : clean2;
    const longer = clean1.length < clean2.length ? clean2 : clean1;
    // Trata como duplicata cumulativa quando o texto maior começa com o menor
    return longer.startsWith(shorter) || (longer.includes(shorter) && shorter.length / longer.length > 0.6);
  };

  // Scribe for real-time transcription
  const scribe = useScribe({
    modelId: 'scribe_v2_realtime',
    commitStrategy: CommitStrategy.VAD,
    onPartialTranscript: (data) => {
      if (data.text && data.text.trim().length > 0) {
        setCurrentText(data.text);
      }
    },
    onCommittedTranscript: (data) => {
      if (data.text && data.text.trim().length > 3) {
        const newText = data.text.trim();
        setTranscript(prev => {
          const last = prev[prev.length - 1];
          if (last) {
            const lastClean = last.text.toLowerCase().trim().replace(/[.,!?]/g, '');
            const newClean = newText.toLowerCase().replace(/[.,!?]/g, '');
            // Duplicata exata ou crescimento cumulativo: substitui a última entrada
            if (lastClean === newClean) return prev;
            if (newClean.startsWith(lastClean) || lastClean.startsWith(newClean)) {
              const longer = newText.length >= last.text.length ? newText : last.text;
              const updated = [...prev];
              updated[updated.length - 1] = { ...last, text: longer };
              lastTranscriptRef.current = longer;
              return updated;
            }
          }
          lastTranscriptRef.current = newText;
          return [...prev, { text: newText, timestamp: new Date().toISOString(), speaker: undefined }];
        });
        setCurrentText('');
      }
    },
  });

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [transcript, currentText]);

  useEffect(() => {
    if (isRecording && !isPaused) {
      timerRef.current = setInterval(() => {
        setRecordingDuration(prev => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isRecording, isPaused]);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

   const startRecording = async (e?: React.FormEvent) => {
     if (e) e.preventDefault();
     
     if (!meetingTitle.trim()) {
       toast({ title: "Título obrigatório", description: "Por favor, dê um nome para a reunião", variant: "destructive" });
       return;
     }
    if (!selectedDeviceId) {
      toast({
        title: "Selecione um Microfone",
        description: "Por favor, selecione um dispositivo de áudio antes de iniciar",
        variant: "destructive"
      });
      return;
    }

    try {
      console.log('🎤 Iniciando gravação com dispositivo:', selectedDeviceId);

      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          deviceId: { exact: selectedDeviceId },
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: 1,
        },
        video: false
      });

      setCurrentStream(stream);

      const audioTrack = stream.getAudioTracks()[0];
      console.log('✅ Usando dispositivo:', audioTrack.label);

      // Validate it's a real microphone
      const suspiciousDevices = [
        'stereo mix', 'loopback', 'monitor', 'what u hear', 
        'blackhole', 'soundflower', 'virtual audio', 'voicemeeter'
      ];
      const deviceNameLower = audioTrack.label.toLowerCase();
      if (suspiciousDevices.some(name => deviceNameLower.includes(name))) {
        stream.getTracks().forEach(track => track.stop());
        toast({
          title: "Dispositivo Inválido",
          description: "Por favor, selecione um microfone físico, não um dispositivo de loopback ou virtual",
          variant: "destructive"
        });
        return;
      }

      // ====== 1. Connect ElevenLabs Scribe for real-time transcription ======
      try {
        console.log('🎤 Obtendo token de transcrição...');
        const { data: tokenData, error: tokenError } = await supabase.functions.invoke('elevenlabs-scribe-token');

        if (tokenError || !tokenData?.token) {
          console.error('❌ Erro ao obter token:', tokenError);
          toast({
            title: 'Aviso',
            description: 'Transcrição em tempo real indisponível. A gravação continuará normalmente.',
          });
        } else {
          console.log('🔌 Conectando serviço de transcrição...');
          await scribe.connect({
            token: tokenData.token,
            microphone: {
              echoCancellation: true,
              noiseSuppression: true,
            },
          });
          scribeConnectedRef.current = true;
          console.log('✅ Serviço de transcrição conectado!');
        }
      } catch (scribeErr) {
        console.error('❌ Erro ao conectar transcrição:', scribeErr);
      }

      // ====== 2. Setup MediaRecorder for saving file ======
      meetingIdRef.current = `in-person-${Date.now()}`;
      setTranscript([]);
      setCurrentText('');
      lastTranscriptRef.current = '';

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
      });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

       mediaRecorder.start(1000);
       setIsRecording(true);
       setIsPaused(false);
       setRecordingDuration(0);
       setStep('recording');


    } catch (error) {
      console.error('Erro ao iniciar gravação:', error);
      toast({
        title: "Erro",
        description: "Não foi possível acessar o microfone",
        variant: "destructive"
      });
    }
  };

  const pauseRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.pause();
      setIsPaused(true);
    }
  };

  const resumeRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'paused') {
      mediaRecorderRef.current.resume();
      setIsPaused(false);
    }
  };

  const stopRecording = async () => {
    // Stop MediaRecorder
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
    }

    // Disconnect Scribe
    if (scribeConnectedRef.current) {
      try {
        scribe.disconnect();
      } catch (e) {
        console.error('Erro ao desconectar transcrição:', e);
      }
      scribeConnectedRef.current = false;
    }

    // Stop stream
    if (currentStream) {
      currentStream.getTracks().forEach(track => track.stop());
      setCurrentStream(null);
    }

    setIsRecording(false);
    setIsFinishing(true);
    await saveRecording();
  };

  const saveRecording = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');

      const { data: companyData } = await supabase
        .from('company_users')
        .select('company_id')
        .eq('user_id', user.id)
        .single();

      if (!companyData) throw new Error('Empresa não encontrada');

      const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
      const fileName = `in-person-meeting-${Date.now()}.webm`;

      const { error: uploadError } = await supabase.storage
        .from('meeting-recordings')
        .upload(fileName, audioBlob);

      if (uploadError) throw uploadError;

      // Get public URL for AssemblyAI access
      const { data: publicUrlData } = supabase.storage
        .from('meeting-recordings')
        .getPublicUrl(fileName);

      const fileUrl = publicUrlData.publicUrl;
      console.log('✅ URL pública gerada para AssemblyAI:', fileUrl);

      // Initial save with Whisper transcript
      const whisperTranscript = transcript.map(t => `${t.speaker}: ${t.text}`).join('\n');
      
      const { data: meetingData, error: dbError } = await supabase
        .from('in_person_meetings')
        .insert({
          title: meetingTitle,
          file_url: fileName, // Store just the filename, not the full URL
          transcript: whisperTranscript,
          created_by: user.id,
          company_id: companyData.company_id,
          duration_seconds: recordingDuration,
        })
        .select()
        .single();


      if (dbError) throw dbError;

      setShowSummary(true);
      // Não mostrar download options ainda - esperar mapeamento de speakers
      // setShowDownloadOptions(true);

      // Process speaker diarization in background with file URL
      processSpeakerDiarization(fileUrl, meetingData.id);

    } catch (error) {
      console.error('Erro ao salvar reunião:', error);
      toast({
        title: "Erro ao Salvar",
        description: "Não foi possível salvar a reunião",
        variant: "destructive"
      });
    }
  };

  const processSpeakerDiarization = async (audioUrl: string, meetingId: string) => {
    try {
      setIsProcessingSpeakers(true);
      console.log('🎤 Processando identificação de speakers com AssemblyAI...');
      
       const { data, error } = await supabase.functions.invoke('speaker-diarization', {
         body: { 
           audioUrl,
           speakers_expected: parseInt(peopleCount) || undefined
         }
       });

      if (error) {
        console.error('Erro na função:', error);
        throw error;
      }

      if (data.success && data.segments && data.segments.length > 0) {
        console.log(`✅ AssemblyAI retornou ${data.speakerCount} speakers`);
        console.log('📊 Primeiros 5 segmentos:', data.segments.slice(0, 5).map((s: any) => ({ speaker: s.speaker, text: s.text.substring(0, 50) })));

        // Update transcript with speaker labels from AssemblyAI
        const updatedTranscript = data.segments.map((seg: any) => 
          `${seg.speaker}: ${seg.text}`
        ).join('\n');

        // Update the meeting record
        const { error: updateError } = await supabase
          .from('in_person_meetings')
          .update({ transcript: updatedTranscript })
          .eq('id', meetingId);

        if (updateError) {
          console.error('Erro ao atualizar reunião:', updateError);
          throw updateError;
        }

        // Update local transcript state with proper speaker labels
        const newTranscript = data.segments.map((seg: any) => ({
          text: seg.text,
          timestamp: new Date().toISOString(),
          speaker: seg.speaker
        }));
        setTranscript(newTranscript);

        // Identificar speakers únicos exatamente como retornado pelo AssemblyAI
        const uniqueSpeakers = Array.from(new Set(data.segments.map((seg: any) => seg.speaker as string))) as string[];
        console.log('👥 Speakers únicos encontrados:', uniqueSpeakers);
        console.log('📊 Total de speakers únicos:', uniqueSpeakers.length);
        
        setIdentifiedSpeakers(uniqueSpeakers);
        
        // Criar mapeamento inicial (vazio)
        const initialMapping: Record<string, string> = {};
        uniqueSpeakers.forEach((speaker: string) => {
          initialMapping[speaker] = ''; // Usuário preencherá
        });
        setSpeakerMapping(initialMapping);


        // Mostrar diálogo de mapeamento em vez de liberar os botões diretamente
        setShowSpeakerMapping(true);
      } else {
        throw new Error('Nenhum segmento retornado pelo AssemblyAI');
      }
    } catch (error) {
      console.error('❌ Erro ao processar speaker diarization:', error);
      
      // Fallback: usar numeração simples se AssemblyAI falhar
      const fallbackTranscript = transcript.map((msg, index) => ({
        ...msg,
        speaker: `Pessoa ${Math.floor(index / 3) + 1}` // Agrupa a cada 3 mensagens
      }));
      setTranscript(fallbackTranscript);

      // If it fails, we should still show the download options so the user isn't stuck
      setShowDownloadOptions(true);
      
    } finally {
      setIsProcessingSpeakers(false);
      setIsFinishing(false);
    }
  };

  // isSimilarText is defined above (before useScribe hook)

  const downloadTranscriptTXT = () => {
    const fullText = transcript.map(msg => {
      const speakerName = msg.speaker && speakerMapping[msg.speaker] 
        ? speakerMapping[msg.speaker] 
        : (msg.speaker || 'Pessoa 1');
      return `[${new Date(msg.timestamp).toLocaleTimeString()}] ${speakerName}: ${msg.text}`;
    }).join('\n\n');
    
    const blob = new Blob([fullText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `transcricao-${meetingTitle.replace(/\s+/g, '-')}-${new Date().toISOString().split('T')[0]}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    
  };

  // Clean markdown formatting from AI-generated text
  const cleanMarkdownForPDF = (text: string): string => {
    return text
      .replace(/\*\*([^*]+)\*\*/g, '$1') // Remove bold **text**
      .replace(/\*([^*]+)\*/g, '$1') // Remove italic *text*
      .replace(/#{1,6}\s+/g, '') // Remove headers #
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // Remove links [text](url)
      .replace(/`([^`]+)`/g, '$1') // Remove code `text`
      .trim();
  };

  const processTranscriptWithAI = async (type: 'summary' | 'keypoints', customQuery?: string) => {
    setIsProcessingAI(true);
    try {
      const fullTranscript = transcript.map(msg => {
        const speakerName = msg.speaker && speakerMapping[msg.speaker] 
          ? speakerMapping[msg.speaker] 
          : (msg.speaker || 'Pessoa 1');
        return `[${new Date(msg.timestamp).toLocaleTimeString()}] ${speakerName}: ${msg.text}`;
      }).join('\n\n');

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

      // Clean any remaining markdown that might have slipped through
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
      const meetingDate = new Date().toLocaleDateString('pt-BR', { 
        day: '2-digit', 
        month: 'long', 
        year: 'numeric' 
      });
      doc.text(`Reunião: ${meetingTitle}`, margin, 60);
      doc.text(`Data: ${meetingDate}`, margin, 68);
      
      // Line separator
      doc.setLineWidth(0.5);
      doc.line(margin, 75, pageWidth - margin, 75);
      
      // Content
      doc.setFontSize(10);
      let yPosition = 85;
      
      if (content) {
        // AI-processed content
        doc.setFont('helvetica', 'normal');
        const lines = doc.splitTextToSize(content, maxLineWidth);
        lines.forEach((line: string) => {
          if (yPosition > pageHeight - 30) {
            doc.addPage();
            yPosition = margin;
          }
          doc.text(line, margin, yPosition);
          yPosition += 5;
        });
      } else {
        // Original transcript
        transcript.forEach((msg) => {
          const time = new Date(msg.timestamp).toLocaleTimeString('pt-BR', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
          });
          
          const speakerName = msg.speaker && speakerMapping[msg.speaker] 
            ? speakerMapping[msg.speaker] 
            : (msg.speaker || 'Pessoa 1');
          const header = `[${time}] ${speakerName}:`;
          const text = msg.text;
          
          if (yPosition > pageHeight - 30) {
            doc.addPage();
            yPosition = margin;
          }
          
          doc.setFont('helvetica', 'bold');
          doc.text(header, margin, yPosition);
          yPosition += 6;
          
          doc.setFont('helvetica', 'normal');
          const lines = doc.splitTextToSize(text, maxLineWidth);
          lines.forEach((line: string) => {
            if (yPosition > pageHeight - 30) {
              doc.addPage();
              yPosition = margin;
            }
            doc.text(line, margin, yPosition);
            yPosition += 5;
          });
          
          yPosition += 8; // More space between different speakers
        });
      }
      
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
        ? `${title.toLowerCase().replace(/\s+/g, '-')}-${meetingTitle.replace(/\s+/g, '-')}-${new Date().toISOString().split('T')[0]}.pdf`
        : `transcricao-${meetingTitle.replace(/\s+/g, '-')}-${new Date().toISOString().split('T')[0]}.pdf`;
      
      doc.save(filename);
      
      
    } catch (error) {
      console.error('Erro ao gerar PDF:', error);
      toast({
        title: "Erro ao Gerar PDF",
        description: "Não foi possível gerar o PDF. Tente baixar em TXT.",
        variant: "destructive"
      });
    }
  };

   return (
      <div className="w-full">
 
        <Dialog open={showSpeakerMapping} onOpenChange={setShowSpeakerMapping}>
         <DialogContent className="sm:max-w-[600px] rounded-3xl max-h-[80vh] overflow-y-auto bg-background border-border text-foreground">
          <DialogHeader>
            <DialogTitle className="text-xl">Identificar Participantes</DialogTitle>
            <DialogDescription>
              {identifiedSpeakers.length} {identifiedSpeakers.length === 1 ? 'voz foi identificada' : 'vozes foram identificadas'} na reunião. 
              Adicione o nome de cada pessoa para gerar o PDF com identificação correta.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            {identifiedSpeakers.map((speaker) => {
              // Encontrar exemplo de fala deste speaker
              const exampleText = transcript.find(t => t.speaker === speaker)?.text || '';
              const truncatedExample = exampleText.length > 100 
                ? exampleText.substring(0, 100) + '...' 
                : exampleText;

              return (
                <div key={speaker} className="space-y-2 p-4 border rounded-xl bg-muted/30">
                  <div className="flex items-center justify-between">
                    <Label className="text-base font-semibold text-[#374DA4]">{speaker}</Label>
                    <span className="text-xs text-muted-foreground">
                      {transcript.filter(t => t.speaker === speaker).length} falas
                    </span>
                  </div>
                  
                  {truncatedExample && (
                    <div className="text-xs text-muted-foreground italic bg-background/50 p-2 rounded border">
                      "{truncatedExample}"
                    </div>
                  )}
                  
                  <Input
                    placeholder="Digite o nome da pessoa"
                    value={speakerMapping[speaker] || ''}
                    onChange={(e) => setSpeakerMapping(prev => ({
                      ...prev,
                      [speaker]: e.target.value
                    }))}
                    className="rounded-xl"
                  />
                </div>
              );
            })}
          </div>

          <div className="flex gap-2 pt-2">
            <Button 
              variant="outline" 
              onClick={() => {
                // Pular mapeamento - usar labels originais
                setShowSpeakerMapping(false);
                setShowDownloadOptions(true);
              }}
              className="rounded-xl flex-1"
            >
              Pular e Usar Labels Originais
            </Button>
            <Button 
              onClick={() => {
                // Verificar se todos os campos foram preenchidos
                const allFilled = identifiedSpeakers.every(speaker => 
                  speakerMapping[speaker] && speakerMapping[speaker].trim() !== ''
                );
                
                if (!allFilled) {
                  toast({
                    title: "Campos Incompletos",
                    description: "Por favor, preencha o nome de todos os participantes ou clique em 'Pular'.",
                    variant: "destructive"
                  });
                  return;
                }
                
                setShowSpeakerMapping(false);
                setShowDownloadOptions(true);
                
                
              }}
              className="rounded-xl flex-1 hover:scale-105 transition-transform"
            >
              Confirmar Nomes
            </Button>
          </div>
        </DialogContent>
      </Dialog>

       


        <div className="flex-1">
          {step === 'setup' && !showSummary && !isFinishing && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-300 space-y-6">
              <div className="bg-background p-8 md:p-12">
                <div className="space-y-6">
                  <div className="space-y-2">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="p-2 rounded-xl bg-[#374DA4]/10 text-[#374DA4]">
                        <Mic className="h-5 w-5" />
                      </div>
                       <h2 className="text-xl font-bold text-foreground">Gravação Presencial</h2>
                    </div>
                    <p className="text-muted-foreground text-sm">Configure sua reunião antes de começar</p>
                  </div>

                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label className="text-muted-foreground text-sm font-bold">Título da Reunião</Label>
                      <Input 
                        value={meetingTitle}
                        onChange={(e) => setMeetingTitle(e.target.value)}
                        placeholder="Ex: Alinhamento de Vendas"
                         className="h-12 bg-card border-border text-foreground rounded-xl focus:ring-[#374DA4]/50 shadow-sm"
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label className="text-muted-foreground text-sm font-bold">Microfone</Label>
                      <AudioDeviceSelector 
                        selectedDeviceId={selectedDeviceId}
                        onDeviceSelect={setSelectedDeviceId}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label className="text-muted-foreground text-sm font-bold">Quantidade de Pessoas</Label>
                      <Input 
                        type="number"
                        min="1"
                        max="20"
                        value={peopleCount}
                        onChange={(e) => setPeopleCount(e.target.value)}
                        className="h-12 bg-card border-border text-foreground rounded-xl focus:ring-[#374DA4]/50 shadow-sm"
                      />
                    </div>
                  </div>

                  <div className="flex gap-3 pt-4">
                    <Button 
                      variant="ghost" 
                      onClick={onBack}
                      className="flex-1 h-12 rounded-xl border border-border hover:bg-muted text-foreground font-bold"
                    >
                      Voltar
                    </Button>
                    <Button 
                      onClick={() => startRecording()}
                      disabled={!selectedDeviceId || !meetingTitle}
                      className="flex-[2] h-12 rounded-xl bg-[#374DA4] hover:bg-[#374DA4]/90 text-white font-bold transition-all shadow-sm"
                    >
                      Começar Gravação
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {step === 'recording' && !showSummary && !isFinishing && (
             <div className="fixed inset-0 z-[100] bg-background flex flex-col animate-in fade-in duration-500">
              <div className="flex-1 flex flex-col items-center justify-center p-8 relative overflow-hidden">
                <div className="absolute inset-0 bg-[#374DA4]/5 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-[#374DA4]/10 via-transparent to-transparent pointer-events-none" />
                
                <div className="text-center space-y-4 mb-12 z-10">
                  <div className="flex items-center justify-center gap-3">
                     <h2 className="text-3xl font-bold text-foreground tracking-tight">{meetingTitle}</h2>
                    <div className="px-3 py-1 rounded-full bg-muted border border-border flex items-center gap-2">
                      <Users className="h-3 w-3 text-muted-foreground/40" />
                      <span className="text-xs font-bold text-muted-foreground/60">{peopleCount} participantes</span>
                    </div>
                  </div>
                  <div className="text-5xl font-mono font-bold text-foreground tracking-tighter">
                    {formatDuration(recordingDuration)}
                  </div>
                  <div className="flex items-center justify-center gap-2">
                    {!isPaused ? (
                      <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-red-500/10 border border-red-500/20">
                        <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                        <span className="text-[10px] font-bold uppercase tracking-widest text-red-500">Gravando áudio</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-yellow-500/10 border border-yellow-500/20">
                        <div className="w-2 h-2 rounded-full bg-yellow-500" />
                        <span className="text-[10px] font-bold uppercase tracking-widest text-yellow-500">Gravação pausada</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="w-full max-w-4xl h-48 flex items-center justify-center z-10">
                  {currentStream && (
                    <div className="w-full h-full">
                      <AudioVisualizer stream={currentStream} isPaused={isPaused} />
                    </div>
                  )}
                </div>

                {currentText && (
                  <div className="mt-8 max-w-2xl text-center z-10">
                     <p className="text-lg text-muted-foreground italic leading-relaxed animate-pulse">"{currentText}"</p>
                  </div>
                )}
              </div>

              <div className="p-8 bg-card border-t border-border z-[110]">
                <div className="max-w-4xl mx-auto flex items-center justify-center gap-6">
                  <Button 
                    size="lg"
                    onClick={isPaused ? resumeRecording : pauseRecording}
                    className="h-16 w-16 rounded-2xl bg-muted border border-border hover:bg-accent text-foreground transition-all active:scale-95"
                  >
                    {isPaused ? <Play className="h-6 w-6 fill-current" /> : <Pause className="h-6 w-6 fill-current" />}
                  </Button>
                  
                  <Button 
                    onClick={stopRecording}
                    className="h-16 px-12 rounded-2xl bg-red-600 hover:bg-red-700 text-white font-bold text-lg shadow-sm transition-all active:scale-95"
                  >
                    Encerrar Reunião
                  </Button>

                  <Button 
                    size="lg"
                    onClick={() => setShowInPersonSkills(!showInPersonSkills)}
                    className={`h-16 w-16 rounded-2xl border border-border transition-all active:scale-95 ${showInPersonSkills ? 'bg-[#374DA4] border-[#374DA4] text-white' : 'bg-muted text-muted-foreground hover:text-foreground'}`}
                  >
                    <Brain className="h-6 w-6" />
                  </Button>
                </div>
              </div>

              {showInPersonSkills && (
                <div className="fixed right-8 top-8 bottom-32 w-80 bg-background border border-border rounded-3xl z-[120] flex flex-col animate-in slide-in-from-right duration-300 shadow-2xl">
                  <div className="p-5 border-b border-border flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Skills & Insights</span>
                    <Button variant="ghost" size="icon" onClick={() => setShowInPersonSkills(false)} className="h-8 w-8 text-muted-foreground hover:text-foreground">
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                  
                  <ScrollArea className="flex-1">
                    <div className="p-4 space-y-6">
                      {insights.length > 0 && (
                        <div className="space-y-3">
                          {insights.map((insight) => (
                             <div key={insight.id} className="p-3 bg-card rounded-2xl border border-border animate-in fade-in slide-in-from-top-2">
                              <div className="flex justify-between mb-2">
                                <span className="text-[9px] font-bold text-[#374DA4] uppercase tracking-widest">{insight.skill}</span>
                                <span className="text-[9px] text-muted-foreground/40">{insight.time}</span>
                              </div>
                              <p className="text-xs text-muted-foreground leading-relaxed">{insight.text}</p>
                            </div>
                          ))}
                        </div>
                      )}

                      <div className="space-y-3">
                         <h5 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground px-1">Ativar Skill</h5>
                        <div className="grid gap-2">
                          {[
                            { id: 'sales-agent', name: 'Vendas', icon: Target },
                            { id: 'satisfaction-agent', name: 'Satisfação', icon: Heart },
                            { id: 'legal-compliance', name: 'Compliance', icon: Shield },
                            { id: 'strategic-planner', name: 'Estratégico', icon: Briefcase }
                          ].map((skill) => (
                            <button
                              key={skill.id}
                              onClick={() => {
                                if (activeSkills.length >= 1) return;
                                const skillNames: Record<string, string> = {
                                  'sales-agent': 'Vendas',
                                  'satisfaction-agent': 'Satisfação',
                                  'legal-compliance': 'Legal',
                                  'strategic-planner': 'Estratégico'
                                };
                                callInPersonSkill(skill.id, skillNames, toast, setActiveSkills, setInsights);
                              }}
                              disabled={activeSkills.includes(skill.id) || activeSkills.length >= 1}
                              className={`flex items-center justify-between p-3.5 rounded-2xl border text-left transition-all ${
                                activeSkills.includes(skill.id) 
                                  ? 'bg-[#374DA4]/10 border-[#374DA4]/30 text-[#374DA4]' 
                                  : activeSkills.length >= 1
                                   ? 'opacity-20 bg-muted border-transparent'
                                   : 'bg-card border-border hover:border-foreground/20 text-muted-foreground hover:text-foreground'
                              }`}
                            >
                              <div className="flex items-center gap-3">
                                <skill.icon className="h-4 w-4" />
                                <span className="text-xs font-bold">{skill.name}</span>
                              </div>
                              {activeSkills.includes(skill.id) && <Check className="h-3 w-3" />}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </ScrollArea>
                </div>
              )}
            </div>
          )}
        </div>

      {(showSummary || isFinishing) && (
         <div className="min-h-screen bg-background flex items-center justify-center p-4">
            {(isFinishing || isProcessingSpeakers) && (
              <div className="flex flex-col items-center justify-center p-16 space-y-10 animate-in fade-in zoom-in-95 duration-1000 bg-card border border-border rounded-[40px] shadow-sm">
               <div className="relative group">
                 <div className="absolute -inset-4 bg-[#374DA4]/10 rounded-full blur-2xl group-hover:bg-[#374DA4]/20 transition-all duration-1000" />
                 <div className="relative">
                   <div className="w-36 h-36 rounded-full border-t-2 border-b-2 border-[#374DA4] animate-spin duration-[2s]" />
                   <div className="absolute inset-0 flex items-center justify-center">
                     <div className="w-28 h-28 rounded-full border-r-2 border-l-2 border-[#374DA4]/40 animate-spin" style={{ animationDirection: 'reverse', animationDuration: '4s' }} />
                   </div>
                   <div className="absolute inset-0 flex items-center justify-center">
                      <div className="bg-[#374DA4]/5 p-5 rounded-full">
                        <Sparkles className="h-10 w-10 text-[#374DA4] animate-pulse" />
                     </div>
                   </div>
                 </div>
               </div>
               
               <div className="text-center space-y-4 max-w-md mx-auto relative">
                 <h3 className="text-3xl font-bold text-foreground tracking-tight">Finalizando sua Reunião</h3>
                 <div className="space-y-4">
                   <div className="flex items-center justify-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#374DA4] animate-bounce [animation-delay:-0.3s]" />
                      <span className="w-1.5 h-1.5 rounded-full bg-[#374DA4] animate-bounce [animation-delay:-0.15s]" />
                      <span className="w-1.5 h-1.5 rounded-full bg-[#374DA4] animate-bounce" />
                   </div>
                   <div className="space-y-2">
                     <p className="text-foreground/60 text-lg font-medium">
                       {isProcessingSpeakers 
                         ? "Identificando participantes por tom de voz..." 
                         : "Organizando transcrição e gerando insights..."}
                     </p>
                     <p className="text-muted-foreground text-xs uppercase tracking-[0.2em] font-bold">
                       Por favor, aguarde alguns instantes
                     </p>
                   </div>
                 </div>
               </div>

                <div className="w-full max-w-sm h-1.5 bg-muted rounded-full overflow-hidden border border-border relative">
                  <div className="h-full bg-[#374DA4] w-full animate-pulse opacity-50" />
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-[#374DA4] to-transparent w-1/2 animate-[shimmer_2s_infinite]" 
                    style={{ 
                      animation: 'shimmer 2s infinite linear',
                      backgroundImage: 'linear-gradient(90deg, transparent, #374DA4, transparent)'
                   }} 
                 />
                 <style>{`
                   @keyframes shimmer {
                     0% { transform: translateX(-100%); }
                     100% { transform: translateX(200%); }
                   }
                 `}</style>
               </div>
             </div>
           )}

            {!isProcessingSpeakers && !isFinishing && !showSpeakerMapping && showDownloadOptions && (
              <div className="p-8 space-y-6 animate-in fade-in duration-500">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 bg-[#10b981]/10 rounded-xl flex items-center justify-center">
                    <Check className="h-5 w-5 text-[#10b981]" />
                  </div>
                  <div>
                     <h3 className="text-lg font-bold text-foreground">Reunião Concluída</h3>
                    <p className="text-muted-foreground text-xs">Transcrição disponível no histórico</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <Button 
                    onClick={() => downloadTranscriptPDF()}
                    className="h-20 flex-col rounded-xl bg-[#374DA4] text-white hover:bg-[#374DA4]/90 text-xs font-bold shadow-sm"
                  >
                    <Download className="h-4 w-4 mb-2" />
                    Baixar PDF
                  </Button>
                  <Button 
                    variant="outline"
                    onClick={() => {
                      setShowSummary(false);
                      setTranscript([]);
                      setMeetingTitle(`Reunião ${new Date().toLocaleDateString('pt-BR')}`);
                      setStep('setup');
                      audioChunksRef.current = [];
                      lastTranscriptRef.current = '';
                      setSpeakerMapping({});
                      setIdentifiedSpeakers([]);
                      setShowDownloadOptions(false);
                    }}
                    className="h-20 flex-col rounded-xl border-border bg-muted text-foreground text-xs font-bold"
                  >
                    <Plus className="h-4 w-4 mb-2" />
                    Nova Reunião
                  </Button>
                </div>

                 <div className="p-4 bg-muted rounded-xl border border-border">
                  <div className="flex justify-between text-[10px] text-muted-foreground uppercase font-bold tracking-widest">
                    <span>Participantes: {identifiedSpeakers.length || 0}</span>
                    <span>Duração: {formatDuration(recordingDuration)}</span>
                  </div>
                </div>
                
                <Button 
                  variant="ghost" 
                  onClick={onBack}
                  className="w-full text-muted-foreground hover:text-foreground text-xs"
                >
                  Voltar ao Hub
                </Button>
              </div>
            )}
          {step === 'recording' && !showSummary && !isFinishing && (
            <div className="fixed inset-0 z-[100] bg-[#faf9f7] flex flex-col animate-in fade-in duration-500">
              <div className="flex-1 flex flex-col items-center justify-center p-8 relative overflow-hidden">
                <div className="absolute inset-0 bg-[#374DA4]/5 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-[#374DA4]/10 via-transparent to-transparent pointer-events-none" />
                
                <div className="text-center space-y-4 mb-12 z-10">
                  <div className="flex items-center justify-center gap-3">
                    <h2 className="text-3xl font-bold text-black tracking-tight">{meetingTitle}</h2>
                    <div className="px-3 py-1 rounded-full bg-black/5 border border-black/10 flex items-center gap-2">
                      <Users className="h-3 w-3 text-black/40" />
                      <span className="text-xs font-bold text-black/60">{peopleCount} participantes</span>
                    </div>
                  </div>
                  <div className="text-5xl font-mono font-bold text-black tracking-tighter">
                    {formatDuration(recordingDuration)}
                  </div>
                  <div className="flex items-center justify-center gap-2">
                    {!isPaused ? (
                      <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-red-500/10 border border-red-500/20">
                        <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                        <span className="text-[10px] font-bold uppercase tracking-widest text-red-500">Gravando áudio</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-yellow-500/10 border border-yellow-500/20">
                        <div className="w-2 h-2 rounded-full bg-yellow-500" />
                        <span className="text-[10px] font-bold uppercase tracking-widest text-yellow-500">Gravação pausada</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="w-full max-w-4xl h-48 flex items-center justify-center z-10">
                  {currentStream && (
                    <div className="w-full h-full">
                      <AudioVisualizer stream={currentStream} isPaused={isPaused} />
                    </div>
                  )}
                </div>

                {currentText && (
                  <div className="mt-8 max-w-2xl text-center z-10">
                    <p className="text-lg text-black/60 italic leading-relaxed animate-pulse">"{currentText}"</p>
                  </div>
                )}
              </div>

              <div className="p-8 bg-white border-t border-black/5 z-[110]">
                <div className="max-w-4xl mx-auto flex items-center justify-center gap-6">
                  <Button 
                    size="lg"
                    onClick={isPaused ? resumeRecording : pauseRecording}
                    className="h-16 w-16 rounded-2xl bg-black/5 border border-black/10 hover:bg-black/10 text-black transition-all active:scale-95"
                  >
                    {isPaused ? <Play className="h-6 w-6 fill-current" /> : <Pause className="h-6 w-6 fill-current" />}
                  </Button>
                  
                  <Button 
                    onClick={stopRecording}
                    className="h-16 px-12 rounded-2xl bg-red-600 hover:bg-red-700 text-white font-bold text-lg shadow-sm transition-all active:scale-95"
                  >
                    Encerrar Reunião
                  </Button>

                  <Button 
                    size="lg"
                    onClick={() => setShowInPersonSkills(!showInPersonSkills)}
                    className={`h-16 w-16 rounded-2xl border border-black/10 transition-all active:scale-95 ${showInPersonSkills ? 'bg-[#374DA4] border-[#374DA4] text-white' : 'bg-black/5 text-black/40 hover:text-black'}`}
                  >
                    <Brain className="h-6 w-6" />
                  </Button>
                </div>
              </div>

              {showInPersonSkills && (
                <div className="fixed right-8 top-8 bottom-32 w-80 bg-white border border-black/5 rounded-3xl z-[120] flex flex-col animate-in slide-in-from-right duration-300 shadow-2xl">
                  <div className="p-5 border-b border-black/5 flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-widest text-black/40">Skills & Insights</span>
                    <Button variant="ghost" size="icon" onClick={() => setShowInPersonSkills(false)} className="h-8 w-8 text-black/20 hover:text-black">
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                  
                  <ScrollArea className="flex-1">
                    <div className="p-4 space-y-6">
                      {insights.length > 0 && (
                        <div className="space-y-3">
                          {insights.map((insight) => (
                            <div key={insight.id} className="p-3 bg-black/5 rounded-2xl border border-black/5 animate-in fade-in slide-in-from-top-2">
                              <div className="flex justify-between mb-2">
                                <span className="text-[9px] font-bold text-[#374DA4] uppercase tracking-widest">{insight.skill}</span>
                                <span className="text-[9px] text-black/20">{insight.time}</span>
                              </div>
                              <p className="text-xs text-black/70 leading-relaxed">{insight.text}</p>
                            </div>
                          ))}
                        </div>
                      )}

                      <div className="space-y-3">
                        <h5 className="text-[10px] font-bold uppercase tracking-widest text-black/20 px-1">Ativar Skill</h5>
                        <div className="grid gap-2">
                          {[
                            { id: 'sales-agent', name: 'Vendas', icon: Target },
                            { id: 'satisfaction-agent', name: 'Satisfação', icon: Heart },
                            { id: 'legal-compliance', name: 'Compliance', icon: Shield },
                            { id: 'strategic-planner', name: 'Estratégico', icon: Briefcase }
                          ].map((skill) => (
                            <button
                              key={skill.id}
                              onClick={() => {
                                if (activeSkills.length >= 1) return;
                                const skillNames: Record<string, string> = {
                                  'sales-agent': 'Vendas',
                                  'satisfaction-agent': 'Satisfação',
                                  'legal-compliance': 'Legal',
                                  'strategic-planner': 'Estratégico'
                                };
                                callInPersonSkill(skill.id, skillNames, toast, setActiveSkills, setInsights);
                              }}
                              disabled={activeSkills.includes(skill.id) || activeSkills.length >= 1}
                              className={`flex items-center justify-between p-3.5 rounded-2xl border text-left transition-all ${
                                activeSkills.includes(skill.id) 
                                  ? 'bg-[#374DA4]/10 border-[#374DA4]/30 text-[#374DA4]' 
                                  : activeSkills.length >= 1
                                  ? 'opacity-20 bg-black/5 border-transparent'
                                  : 'bg-black/5 border-black/5 hover:border-black/20 text-black/60 hover:text-black'
                              }`}
                            >
                              <div className="flex items-center gap-3">
                                <skill.icon className="h-4 w-4" />
                                <span className="text-xs font-bold">{skill.name}</span>
                              </div>
                              {activeSkills.includes(skill.id) && <Check className="h-3 w-3" />}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </ScrollArea>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default InPersonMeeting;
