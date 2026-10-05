import React, { useState, useEffect, useRef, useCallback, lazy, Suspense } from 'react'; // sidebar v2
import { useIsMobile } from '@/hooks/use-mobile';

import { useNavigate, Link } from 'react-router-dom';
import { Send, Sparkles, Paperclip, X, Loader2, FileText, Image, Video, Music, File, MessageSquare, FolderPlus, CalendarDays, Mail, UploadCloud, TableProperties, Mic, MicOff, Clock, ArrowRight, Volume2, LayoutGrid, History, Plus, ChevronLeft, ChevronDown, Trash2, Zap, Link2, FolderOpen, Target, FileSignature, BarChart3, Video as VideoIcon, Bot, Megaphone, Key, CheckCircle2, Users, Settings, HardDrive, GitBranch, Workflow, CheckSquare, Eye } from 'lucide-react';
import WhatsAppIcon from '@/components/icons/WhatsAppIcon';
import DriveFilePicker from './DriveFilePicker';
import { useAuth } from '@/hooks/useAuth';
import { useSubscription } from '@/hooks/useSubscription';
import { useHubColor, DEFAULT_COLOR } from '@/hooks/useHubColor';
import { useTheme } from '@/hooks/useTheme';

import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useToolUsageTracker } from '@/hooks/useToolUsageTracker';
import { useTTSAccessibility } from '@/hooks/useTTSAccessibility';
import { ElloLogo } from '@/components/shared/ElloLogo';
import { EllosuitMark } from '@/components/shared/EllosuitMark';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import WhatsAppQRInline from './WhatsAppQRInline';
import AIAssistantCards, { type RichCard } from './AIAssistantCards';
import AgentActivity from './AgentActivity';
import AgentJobsPanel from './AgentJobsPanel';
import AIAssistantChart, { type ChartConfig } from './AIAssistantChart';
 import AccessibilityMenu from '@/components/shared/AccessibilityMenu';
import ChatSettingsMenu from './ChatSettingsMenu';
import QuickActionsModal from '@/components/Mobile/QuickActionsModal';


 import { Badge } from '@/components/ui/badge';
 import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import InPersonMeeting from './InPersonMeeting';
 
const AIAssistantPdfAnalysis = lazy(() => import('./AIAssistantPdfAnalysis'));


interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  fileUrl?: string;
  fileName?: string;
  fileType?: string;
  action?: any;
  isLoading?: boolean;
  qrCode?: string;
  sessionId?: string;
  suggestedConversationId?: string;
  suggestedConversationTitle?: string;
}

interface ConversationSummary {
  id: string;
  title: string;
  last_message_preview: string | null;
  message_count: number;
  updated_at: string;
}

const FILE_ICONS: Record<string, React.ElementType> = {
  image: Image, video: Video, audio: Music, spreadsheet: FileText, pdf: FileText, doc: FileText,
};

const SUGGESTIONS: { label: string; prompt: string; icon: React.ElementType }[] = [
  { label: 'Resumir minha agenda', prompt: 'Resuma minha agenda de hoje', icon: CalendarDays },
  { label: 'Criar tarefa', prompt: 'Crie uma tarefa para ', icon: CheckSquare },
  { label: 'Enviar e-mail', prompt: 'Escreva e envie um e-mail para ', icon: Mail },
  { label: 'Ver meus leads', prompt: 'Mostre meus leads mais recentes', icon: Users },
];

// Pool de sugestões que ficam alternando na tela inicial
const SUGGESTION_POOL: { label: string; prompt: string; icon: React.ElementType }[] = [
  ...SUGGESTIONS,
  { label: 'Criar disparo em massa', prompt: 'Crie um disparo em massa no WhatsApp para ', icon: Megaphone },
  { label: 'Disparo com voz IA', prompt: 'Crie um disparo com áudio de voz IA falando: ', icon: Music },
  { label: 'Agendar reunião', prompt: 'Agende uma reunião amanhã com ', icon: CalendarDays },
  { label: 'Cadastrar contato', prompt: 'Cadastre um novo contato chamado ', icon: Users },
  { label: 'Mensagem no WhatsApp', prompt: 'Envie uma mensagem no WhatsApp para ', icon: MessageSquare },
  { label: 'Criar chatbot', prompt: 'Crie um chatbot de atendimento para ', icon: GitBranch },
  { label: 'Criar agente de IA', prompt: 'Crie um agente de IA especialista em ', icon: Bot },
  { label: 'Resumo do meu dia', prompt: 'Me dê um resumo geral do meu dia', icon: CheckSquare },
  { label: 'Gerar uma imagem', prompt: 'Gere uma imagem de ', icon: Image },
  { label: 'Buscar no Drive', prompt: 'Procure no meu Drive o arquivo ', icon: FolderOpen },
  { label: 'Ver campanhas de disparo', prompt: 'Mostre minhas campanhas de disparo recentes', icon: Megaphone },
  { label: 'Escrever proposta', prompt: 'Escreva uma proposta comercial para ', icon: FileText },
];

const HUB_TOOL_ICONS: Record<string, any> = {
  'omni': Zap,
  'flow': Zap,
  'track': Link2,
  'suite': FolderOpen,
  'crm-ello': WhatsAppIcon,
  'crm-whatsapp': MessageSquare,
  'bot-ia': Bot,
  'chatbot': GitBranch,
  'email': Mail,
  'email-templates': FileText,
  'disparos': Megaphone,
  'automacoes': Workflow,
  'api-whatsapp': Key,
  'agenda': CalendarDays,
  'agenda-aberta': CalendarDays,
  'tasks': CheckSquare,
  'reunioes': VideoIcon,
  'fluxos': Zap,
  'rastreamento': FileText,
  'encurtador': Link2,
  'email-tracker': Eye,
  'leads': Users,
  'track/leads': Users,
  'cadastros': Users,
  'drive': FolderOpen,
  'equipe': Users,
  'habitos': Target,
  'contratos': FileSignature,
  'propostas': FileText,
  'recibos': FileText,
  'analytics': BarChart3,
  'ello-vision': BarChart3,
  'apps': LayoutGrid,
};

function getFileCategory(name: string): string {
  const ext = name.split('.').pop()?.toLowerCase() || '';
  if (['png','jpg','jpeg','gif','webp','svg'].includes(ext)) return 'image';
  if (['mp4','mov','avi','webm'].includes(ext)) return 'video';
  if (['mp3','wav','ogg','m4a'].includes(ext)) return 'audio';
  if (['csv','xls','xlsx'].includes(ext)) return 'spreadsheet';
  if (['pdf'].includes(ext)) return 'pdf';
  if (['doc','docx'].includes(ext)) return 'doc';
  return 'other';
}

function formatMessageContent(text: string): string {
  let html = text
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener" class="underline font-medium hover:opacity-80">$1</a>')
    .replace(/(^|[^"'>])(https?:\/\/[^\s<]+)/g, '$1<a href="$2" target="_blank" rel="noopener" class="underline font-medium hover:opacity-80">$2</a>');
  return html;
}

const AIAssistantHome: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isFree, isLoading: isSubscriptionLoading } = useSubscription();
  const { color: hubColor } = useHubColor();
  const { isMobile: isMobileView } = useIsMobile();
  const { theme } = useTheme();

  const fullName = (user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email || '') as string;
  const firstName = fullName.split(/[\s@.]/)[0].replace(/^./, (c) => c.toUpperCase());
  const hour = new Date().getHours();
  const greetingPrefix = hour < 12 ? 'Bom dia' : hour < 18 ? 'Boa tarde' : 'Boa noite';

  const { toast } = useToast();
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [attachedFiles, setAttachedFiles] = useState<File[]>([]);
  const [showAllToolsModal, setShowAllToolsModal] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [companyId, setCompanyId] = useState<string | null>(null);
  // Modo Criador ON/OFF removido. Agora é detectado automaticamente.
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const [showScrollDown, setShowScrollDown] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
   const [isRecording, setIsRecording] = useState(false);
  const [audioLevels, setAudioLevels] = useState<number[]>(new Array(24).fill(0));
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [showDrivePicker, setShowDrivePicker] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);
  const pendingSpeakRef = useRef<string | null>(null);
   const handleSubmitRef = useRef<(text?: string) => Promise<void>>();
 
   // Conversation history state
   const [conversations, setConversations] = useState<ConversationSummary[]>([]);
   const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
   const [showHistory, setShowHistory] = useState(false);
  const [suggestionSeed, setSuggestionSeed] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setSuggestionSeed((s) => s + 3), 6000);
    return () => clearInterval(id);
  }, []);
  const visibleSuggestions = Array.from({ length: 3 }, (_, i) => SUGGESTION_POOL[(suggestionSeed + i) % SUGGESTION_POOL.length]);
   const [loadingHistory, setLoadingHistory] = useState(false);
   const [historySearch, setHistorySearch] = useState('');
  const [showInPersonMeeting, setShowInPersonMeeting] = useState(false);
  const [pendingInPersonTitle, setPendingInPersonTitle] = useState('');
 
  const isDark = theme === 'dark';
   const isMeetHub = location.pathname.includes('/meet-hub');
  const bgColor = isMeetHub || isDark ? '#141414' : 'white';

   // Fetch initial data
   useEffect(() => {
     const fetchData = async () => {
       if (!user?.id) return;
       
       // Fetch company id
       const { data: companyUser } = await supabase
         .from('company_users')
         .select('company_id')
         .eq('user_id', user.id)
         .single();
       if (companyUser?.company_id) setCompanyId(companyUser.company_id);
     };
     fetchData();
   }, [user?.id]);

  // Fetch conversation list
  const fetchConversations = useCallback(async () => {
    if (!user?.id) return;
    const { data } = await supabase
      .from('ai_assistant_conversations')
      .select('id, title, last_message_preview, message_count, updated_at')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false })
      .limit(50);
    if (data) setConversations(data);
  }, [user?.id]);

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  // Listen for external open-history event (from mobile header)
  useEffect(() => {
    const handler = () => {
      fetchConversations();
      setShowHistory(true);
    };
    window.addEventListener('open-ai-history', handler);
    return () => window.removeEventListener('open-ai-history', handler);
  }, [fetchConversations]);

  // Load conversation messages
  const loadConversation = useCallback(async (conversationId: string, keepSidebar = false) => {
    setLoadingHistory(true);
    const { data } = await supabase
      .from('ai_assistant_messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });

    if (data) {
      const loaded: ChatMessage[] = data.map((m: any) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        fileUrl: m.file_url || undefined,
        fileName: m.file_name || undefined,
        fileType: m.file_type || undefined,
        action: m.action || undefined,
      }));
      setMessages(loaded);
      setActiveConversationId(conversationId);
      if (!keepSidebar) {
        setShowHistory(false);
      }
    }
    setLoadingHistory(false);
  }, []);

  // Start new conversation
  const startNewConversation = useCallback(() => {
    setMessages([]);
    setActiveConversationId(null);
    setShowHistory(false);
  }, []);

  // Delete conversation
  const deleteConversation = useCallback(async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await supabase.from('ai_assistant_conversations').delete().eq('id', id);
    if (activeConversationId === id) {
      startNewConversation();
    }
    fetchConversations();
  }, [activeConversationId, startNewConversation, fetchConversations]);

  // Save message to DB
  const saveMessage = useCallback(async (msg: ChatMessage, conversationId: string) => {
    await supabase.from('ai_assistant_messages').insert({
      conversation_id: conversationId,
      role: msg.role,
      content: msg.content,
      file_url: msg.fileUrl || null,
      file_name: msg.fileName || null,
      file_type: msg.fileType || null,
      action: msg.action || null,
    });
  }, []);

  // Create or update conversation
  const ensureConversation = useCallback(async (firstMessage: string): Promise<string> => {
    if (activeConversationId) {
      // Update existing
      await supabase.from('ai_assistant_conversations').update({
        last_message_preview: firstMessage.substring(0, 100),
        message_count: messages.length + 1,
      }).eq('id', activeConversationId);
      return activeConversationId;
    }

    // Create new
    const title = firstMessage.substring(0, 60) || 'Nova conversa';
    const { data } = await supabase.from('ai_assistant_conversations').insert({
      user_id: user?.id,
      company_id: companyId,
      title,
      last_message_preview: firstMessage.substring(0, 100),
      message_count: 1,
    }).select('id').single();

    if (data) {
      setActiveConversationId(data.id);
      fetchConversations();
      return data.id;
    }
    throw new Error('Failed to create conversation');
  }, [activeConversationId, messages.length, user?.id, companyId, fetchConversations]);

  // Scroll to bottom on new messages
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const uploadFileToStorage = async (file: File): Promise<string | null> => {
    try {
      setUploadingFile(true);
      const ext = file.name.split('.').pop() || 'bin';
      const filePath = `assistant/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
      const { error } = await supabase.storage.from('documents').upload(filePath, file, { contentType: file.type });
      if (error) throw error;
      const { data: publicData } = supabase.storage.from('documents').getPublicUrl(filePath);
      return publicData.publicUrl;
    } catch (err: any) {
      toast({ title: 'Erro no upload', description: err.message, variant: 'destructive' });
      return null;
    } finally {
      setUploadingFile(false);
    }
  };

  const handleSubmit = useCallback(async (text?: string) => {
    const messageText = text || input.trim();
    if (!messageText && attachedFiles.length === 0) return;
    if (isProcessing) return;

    // Detecção automática: se o usuário falar de chatbot, abrir o Criador com IA
    if (messageText) {
      const lower = messageText.toLowerCase();
      const chatbotIntent = /\b(chat ?bot|chatbots?|bot ?de ?atendimento|fluxo ?de ?atendimento|fluxo ?do ?bot|criar ?(um )?bot|criar ?(um )?chatbot|editar ?(o )?bot|editar ?(o )?chatbot|criar ?fluxo|montar ?(um )?bot|construir ?(um )?bot)\b/.test(lower);
      if (chatbotIntent) {
        setInput('');
        setAttachedFiles([]);
        navigate(`/dashboard/criar-chatbot?prompt=${encodeURIComponent(messageText)}`);
        return;
      }
    }

    if (isFree && !isSubscriptionLoading) {
      const blockedMsg: ChatMessage = {
        id: `blocked-${Date.now()}`,
        role: 'assistant',
        content: '🔒 **Você está no plano gratuito.** Para usar o assistente de IA e todas as funcionalidades do Ellosuit, ative seu plano Business com **7 dias de teste grátis**.',
        action: { type: 'upgrade' },
      };
      setMessages(prev => [...prev, {
        id: `user-${Date.now()}`,
        role: 'user',
        content: messageText,
      }, blockedMsg]);
      setInput('');
      setAttachedFiles([]);
      return;
    }

    const uploadedFiles: { url: string; name: string; type: string }[] = [];
    
    for (const file of attachedFiles) {
      if ((file as any).isFromDrive) {
        uploadedFiles.push({
          url: (file as any).url,
          name: file.name,
          type: getFileCategory(file.name)
        });
      } else {
        const url = await uploadFileToStorage(file);
        if (url) {
          uploadedFiles.push({
            url,
            name: file.name,
            type: getFileCategory(file.name)
          });
        }
      }
    }

    let lastConvId: string = '';
    let finalUserMsg: ChatMessage | null = null;

    if (uploadedFiles.length > 0) {
      const firstFile = uploadedFiles[0];
      const firstMsg: ChatMessage = {
        id: `user-${Date.now()}`,
        role: 'user',
        content: messageText,
        fileUrl: firstFile.url,
        fileName: firstFile.name,
        fileType: firstFile.type,
      };
      finalUserMsg = firstMsg;
      setMessages(prev => [...prev, firstMsg]);
      
      try {
        lastConvId = await ensureConversation(messageText || firstFile.name);
        await saveMessage(firstMsg, lastConvId);
      } catch (err) { console.error(err); }

      for (let i = 1; i < uploadedFiles.length; i++) {
        const file = uploadedFiles[i];
        const extraMsg: ChatMessage = {
          id: `user-${Date.now()}-${i}`,
          role: 'user',
          content: '',
          fileUrl: file.url,
          fileName: file.name,
          fileType: file.type,
        };
        setMessages(prev => [...prev, extraMsg]);
        if (lastConvId) {
          try { await saveMessage(extraMsg, lastConvId); } catch (e) { console.error(e); }
        }
      }
    } else {
      const userMsg: ChatMessage = {
        id: `user-${Date.now()}`,
        role: 'user',
        content: messageText,
      };
      finalUserMsg = userMsg;
      setMessages(prev => [...prev, userMsg]);
      try {
        lastConvId = await ensureConversation(messageText);
        await saveMessage(userMsg, lastConvId);
      } catch (err) { console.error(err); }
    }

    const convId = lastConvId || activeConversationId || '';
    setInput('');
    setAttachedFiles([]);
    setIsProcessing(true);

    const loadingId = `loading-${Date.now()}`;
    setMessages(prev => [...prev, { id: loadingId, role: 'assistant', content: '', isLoading: true }]);

    try {
      const conversationSummaries = conversations
        .filter(c => c.id !== activeConversationId)
        .slice(0, 15)
        .map(c => ({
          id: c.id,
          title: c.title,
          preview: c.last_message_preview || '',
          messageCount: c.message_count,
        }));

    const { data, error } = await supabase.functions.invoke('ai-assistant', {
      body: {
        message: messageText,
        fileUrl: uploadedFiles[0]?.url,
        fileName: uploadedFiles[0]?.name,
        userId: user?.id,
        companyId,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        messages: messages.filter(m => !m.isLoading).map(m => ({
          role: m.role,
          content: m.content + (m.fileUrl ? `\n[Arquivo: ${m.fileName}]` : ''),
        })),
        conversationSummaries,
        activeConversationId,
      },
    });

      if (error) {
        console.error('Edge function invocation error:', error);
        throw new Error(error.message || 'Edge Function returned a non-2xx status code');
      }
      
      if (!data || data.error) {
        throw new Error(data?.error || 'A IA não retornou uma resposta válida');
      }

      let responseText = data.response || 'Desculpe, ocorreu um erro.';
      const qrCode = data.action?.qrCode || undefined;
      const sessionId = data.action?.sessionId || undefined;

      // Parse cross-conversation suggestion
      let suggestedConversationId: string | undefined;
      let suggestedConversationTitle: string | undefined;
      const chatMatch = responseText.match(/\[IR_PARA_CHAT:([^\]]+)\]/);
      if (chatMatch) {
        suggestedConversationId = chatMatch[1];
        const conv = conversations.find(c => c.id === suggestedConversationId);
        suggestedConversationTitle = conv?.title || 'Conversa anterior';
        responseText = responseText.replace(/\[IR_PARA_CHAT:[^\]]+\]/g, '').trim();
      }

      // Parse quick replies
      let quickReplies: string[] | undefined;
      const qrMatch = responseText.match(/\[QUICK_REPLIES:([^\]]+)\]/);
      if (qrMatch) {
        quickReplies = qrMatch[1].split('|').map(s => s.trim()).filter(Boolean);
        responseText = responseText.replace(/\[QUICK_REPLIES:[^\]]+\]/g, '').trim();
      }

      const assistantMsg: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: responseText,
        action: { ...data.action, quickReplies },
        qrCode,
        sessionId,
        suggestedConversationId,
        suggestedConversationTitle,
      };

      setMessages(prev => {
        const filtered = prev.filter(m => m.id !== loadingId);
        return [...filtered, assistantMsg];
      });

      // Persist assistant message
      if (convId) {
        await saveMessage(assistantMsg, convId);
        
        // Handle automatic triggers
        if (data.action?.action === 'start_in_person_meeting') {
          setPendingInPersonTitle(data.action.title || '');
          setShowInPersonMeeting(true);
        }

        // Update conversation preview
        await supabase.from('ai_assistant_conversations').update({
          last_message_preview: responseText.substring(0, 100),
          message_count: messages.length + 2,
          title: messages.length === 0 ? messageText.substring(0, 60) : undefined,
        }).eq('id', convId);
        fetchConversations();
      }

      pendingSpeakRef.current = responseText;
    } catch (err: any) {
      console.error('AIAssistantHome error:', err);
      setMessages(prev => {
        const filtered = prev.filter(m => m.id !== loadingId);
        return [...filtered, {
          id: `error-${Date.now()}`,
          role: 'assistant',
          content: `Desculpe, ocorreu um erro ao tentar conversar com IA DASHBOARD: ${err.message || 'tente novamente em alguns segundos'}.`,
        }];
      });
    } finally {
      setIsProcessing(false);
    }
  }, [input, attachedFiles, isProcessing, isFree, user?.id, companyId, messages, navigate, toast, ensureConversation, saveMessage, activeConversationId, fetchConversations]);

  // Keep ref in sync so transcribeAudio always calls the latest handleSubmit
  useEffect(() => {
    handleSubmitRef.current = handleSubmit;
  }, [handleSubmit]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    
    const validFiles = files.filter(file => {
      if (file.size > 20 * 1024 * 1024) {
        toast({ title: 'Arquivo muito grande', description: `${file.name} excede o limite de 20MB`, variant: 'destructive' });
        return false;
      }
      return true;
    });
    
    if (validFiles.length > 0) {
      setAttachedFiles(prev => [...prev, ...validFiles]);
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const startVisualization = (stream: MediaStream) => {
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 64;
      source.connect(analyser);
      audioContextRef.current = audioContext;
      analyserRef.current = analyser;
      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      const update = () => {
        analyser.getByteFrequencyData(dataArray);
        const levels = Array.from(dataArray.slice(0, 24)).map(v => v / 255);
        setAudioLevels(levels);
        animationFrameRef.current = requestAnimationFrame(update);
      };
      update();
    } catch (e) { console.error(e); }
  };

  const stopVisualization = () => {
    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    if (audioContextRef.current) audioContextRef.current.close();
    audioContextRef.current = null;
    analyserRef.current = null;
    setAudioLevels(new Array(24).fill(0));
  };

  // === VOICE: Start recording ===
  const startRecording = useCallback(async () => {
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error('NOT_SUPPORTED');
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (stream.getAudioTracks().length === 0) throw new Error('NO_DEVICE');

      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };
      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        if (audioBlob.size < 1000) return;
        await transcribeAudio(audioBlob);
      };
      mediaRecorder.start();
      setIsRecording(true);
      startVisualization(stream);
    } catch (err: any) {
      console.error(err);
      toast({ 
        title: 'Microfone não detectado', 
        description: 'Verifique as permissões do seu navegador ou conecte um dispositivo de áudio.', 
        variant: 'destructive',
        action: (<Button variant="outline" size="sm" onClick={() => window.open('chrome://settings/content/microphone', '_blank')} className="bg-white/10 border-white/20 text-white">Configurar</Button>) as any
      });
    }
  }, [toast]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
    stopVisualization();
  }, []);

  const transcribeAudio = async (audioBlob: Blob) => {
    setIsTranscribing(true);
    try {
      const formData = new FormData();
      formData.append('audio', audioBlob, 'recording.webm');
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/elevenlabs-stt`,
        {
          method: 'POST',
          headers: {
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: formData,
        }
      );
      if (!response.ok) throw new Error('Transcription failed');
      const data = await response.json();
      if (data.text && data.text.trim()) {
        setInput(prev => prev ? `${prev} ${data.text.trim()}` : data.text.trim());
      } else {
        toast({ title: 'Voz', description: 'Não consegui entender. Tente novamente.', variant: 'destructive' });
      }
    } catch (err) {
      console.error('Transcription error:', err);
      toast({ title: 'Erro', description: 'Falha na transcrição do áudio.', variant: 'destructive' });
    } finally {
      setIsTranscribing(false);
    }
  };

  const speakText = useCallback(async (text: string) => {
    if (!text.trim()) return;
    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current = null;
    }
    try {
      const cleanText = text
        .replace(/[→←↑↓]/g, '')
        .replace(/[*_~`#]/g, '')
        .replace(/\[.*?\]/g, '')
        .replace(/https?:\/\/\S+/g, '')
        .trim();
      if (!cleanText) return;

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/elevenlabs-tts`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({ text: cleanText, voiceId: 'ORgG8rwdAiMYRug8RJwR' }),
        }
      );
      if (!response.ok) throw new Error('TTS failed');
      const contentType = response.headers.get('content-type') || '';
      if (!contentType.includes('audio')) throw new Error('TTS returned non-audio response');
      const audioBlob = await response.blob();
      if (audioBlob.size < 500) throw new Error('TTS returned empty audio');

      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioUrl);
      try {
        const v = Number(localStorage.getItem('ellosuit_tts_volume'));
        audio.volume = Number.isFinite(v) && v >= 0 && v <= 100 ? v / 100 : 1;
      } catch { audio.volume = 1; }
      currentAudioRef.current = audio;
      setIsSpeaking(true);
      audio.onended = () => { setIsSpeaking(false); currentAudioRef.current = null; URL.revokeObjectURL(audioUrl); };
      audio.onerror = () => { setIsSpeaking(false); currentAudioRef.current = null; URL.revokeObjectURL(audioUrl); };
      try {
        await audio.play();
      } catch (playErr: any) {
        setIsSpeaking(false);
        currentAudioRef.current = null;
        const savedUrl = audioUrl;
        toast({
          title: '🔊 Resposta em áudio disponível',
          description: 'Toque para ouvir a resposta',
          variant: 'default',
          action: (
            <button
              onClick={() => {
                const manualAudio = new Audio(savedUrl);
                try {
                  const v = Number(localStorage.getItem('ellosuit_tts_volume'));
                  manualAudio.volume = Number.isFinite(v) && v >= 0 && v <= 100 ? v / 100 : 1;
                } catch { manualAudio.volume = 1; }
                manualAudio.onended = () => URL.revokeObjectURL(savedUrl);
                manualAudio.play().catch(() => {});
              }}
              className="px-3 py-1 rounded-md text-xs font-medium bg-primary text-primary-foreground"
            >
              Ouvir
            </button>
          ) as any,
        });
      }
    } catch (err) {
      setIsSpeaking(false);
    }
  }, [toast]);

  const stopSpeaking = useCallback(() => {
    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current = null;
    }
    setIsSpeaking(false);
  }, []);

  const { ttsEnabled } = useTTSAccessibility();

  useEffect(() => {
    if (pendingSpeakRef.current && ttsEnabled) {
      speakText(pendingSpeakRef.current);
      pendingSpeakRef.current = null;
    }
  }, [messages, speakText, ttsEnabled]);

  const { mostUsedTools } = useToolUsageTracker();
  const hasChat = messages.length > 0;

  const renderInput = () => (
    <div className="w-full max-w-3xl mx-auto flex flex-col gap-2 md:gap-3">
      <DriveFilePicker 
        open={showDrivePicker} 
        onOpenChange={setShowDrivePicker}
        onFilesSelect={(selectedFiles) => {
          const mappedFiles = selectedFiles.map(file => ({
            name: file.name,
            size: file.size || 0,
            type: file.type,
            isFromDrive: true,
            url: file.url
          } as any));
          setAttachedFiles(prev => [...prev, ...mappedFiles]);
          setShowDrivePicker(false);
        }}
      />
      <AnimatePresence>
        {attachedFiles.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-1">
            {attachedFiles.map((file, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className={`p-2 rounded-xl flex items-center gap-2 max-w-[200px] ${isDark ? 'bg-white/10 border border-white/10' : 'bg-gray-50 border border-gray-200'}`}
              >
                <div className={`p-1.5 rounded-lg shrink-0 ${isDark ? 'bg-white/10' : 'bg-white shadow-sm'}`}>
                  {React.createElement(FILE_ICONS[getFileCategory(file.name)] || File, { 
                    className: `h-3.5 w-3.5 ${isDark ? 'text-white/70' : 'text-gray-500'}` 
                  })}
                </div>
                <p className={`text-xs font-medium truncate flex-1 ${isDark ? 'text-white' : 'text-gray-900'}`}>{file.name}</p>
                <button
                  onClick={() => setAttachedFiles(prev => prev.filter((_, i) => i !== idx))}
                  className={`p-1 rounded-md transition-colors ${isDark ? 'hover:bg-white/10 text-white/40' : 'hover:bg-gray-200 text-gray-400'}`}
                >
                  <X className="h-3 w-3" />
                </button>
              </motion.div>
            ))}
          </div>
        )}
      </AnimatePresence>

      <motion.div
        className="relative"
        initial={!hasChat ? { opacity: 0, y: 20, scale: 0.95 } : false}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.6, delay: hasChat ? 0 : 0.5, ease: [0.16, 1, 0.3, 1] }}
      >
        <div {...(!isDark ? { 'data-keep-light': true } : {})} className={`relative flex items-end backdrop-blur-xl rounded-[28px] overflow-hidden transition-all duration-300 group/input-container ${isDark ? 'border border-white/10 shadow-[0_2px_16px_-4px_rgba(0,0,0,0.5)] focus-within:border-white/20' : 'border border-black/10 shadow-[0_2px_12px_-4px_rgba(0,0,0,0.08)] focus-within:border-black/20 focus-within:shadow-[0_6px_24px_-8px_rgba(0,0,0,0.12)]'}`} style={{ backgroundColor: isDark ? 'hsl(0, 0%, 12%)' : '#ffffff' }}>
          {/* Animated border effect */}
          <div className="absolute inset-0 opacity-0 group-focus-within/input-container:opacity-100 transition-opacity duration-500 pointer-events-none z-0">
            <div className="absolute inset-[-1.5px] rounded-[inherit] bg-gradient-to-r from-primary via-purple-500 to-primary bg-[length:200%_auto] animate-gradient-x p-[1.5px]">
              <div className="w-full h-full rounded-[inherit] bg-white dark:bg-[#141414]" />
            </div>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            onChange={handleFileSelect}
            accept="*/*"
          />


          {isRecording ? (
            <div className="flex-1 flex items-center gap-0.5 px-4 h-14 overflow-hidden">
              {audioLevels.map((level, i) => (
                <motion.div
                  key={i}
                  className="w-1 bg-primary rounded-full"
                  animate={{ 
                    height: Math.max(4, level * 32),
                    opacity: 0.3 + level * 0.7
                  }}
                  transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                />
              ))}
            </div>
          ) : (
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                const el = e.target as HTMLTextAreaElement;
                el.style.height = 'auto';
                el.style.height = `${Math.min(el.scrollHeight, 140)}px`;
              }}
              onKeyDown={handleKeyDown}
              rows={1}
              placeholder={attachedFiles.length > 0 ? "Descreva o que fazer com o arquivo..." : "Pergunte qualquer coisa..."}
              className={`flex-1 bg-transparent text-base md:text-[16px] px-5 py-4 md:py-[16px] outline-none font-normal tracking-[-0.005em] resize-none leading-relaxed max-h-[160px] overflow-y-auto scrollbar-thin relative z-10 ${isDark ? 'text-white placeholder:text-white/35' : 'text-gray-800 placeholder:text-gray-400'}`}
              autoFocus
              disabled={isProcessing}
            />
          )}

          <div className="flex items-center gap-1 mr-2 mb-2 shrink-0 relative z-10">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  disabled={uploadingFile || isProcessing}
                  className={`p-2 rounded-xl transition-all duration-200 active:scale-90 disabled:opacity-40 group ${isDark ? 'hover:bg-white/5' : 'hover:bg-gray-100/80'}`}
                  title="Anexar"
                >
                  {uploadingFile ? (
                    <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
                  ) : (
                    <Paperclip className={`h-5 w-5 transition-colors ${isDark ? 'text-white/40 group-hover:text-white/70' : 'text-gray-400 group-hover:text-gray-600'}`} />
                  )}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="rounded-2xl">
                <DropdownMenuItem onClick={() => fileInputRef.current?.click()} className="gap-2">
                  <Paperclip className="h-4 w-4" /> Anexar
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setShowDrivePicker(true)} className="gap-2">
                  <HardDrive className="h-4 w-4" /> Biblioteca
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            {!input.trim() && (
              <button
                onClick={isRecording ? stopRecording : startRecording}
                disabled={isProcessing || isTranscribing}

                className={`p-2 rounded-xl transition-all duration-200 active:scale-90 disabled:opacity-40 ${
                  isRecording ? 'bg-red-500 animate-pulse shadow-lg shadow-red-500/30' : `${isDark ? 'hover:bg-white/5' : 'hover:bg-gray-100/80'} group`
                }`}
              >
                {isTranscribing ? (
                  <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
                ) : isRecording ? (
                  <MicOff className="h-5 w-5 text-white" />
                ) : (
                  <Mic className={`h-5 w-5 transition-colors ${isDark ? 'text-white/40 group-hover:text-white/70' : 'text-gray-400 group-hover:text-gray-600'}`} />
                )}
              </button>
            )}

            {(input.trim() || attachedFiles.length > 0) && (
              <button
                onClick={() => handleSubmit()}
                disabled={isProcessing}
                className="p-2.5 rounded-xl transition-all duration-200 active:scale-90 disabled:opacity-30"
                style={{
                  backgroundColor: isProcessing ? 'transparent' : (hubColor || DEFAULT_COLOR),
                }}
              >
                <Send
                  className="h-5 w-5 transition-colors"
                  style={{ color: isProcessing ? '#d1d5db' : '#ffffff' }}
                />
              </button>
            )}
          </div>
        </div>

        {isSpeaking && (
          <div className="flex items-center justify-center mt-2">
            <button
              onClick={stopSpeaking}
              className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-white/20 text-white border border-white/20 animate-pulse"
            >
              Parar áudio
            </button>
          </div>
        )}
      </motion.div>

    </div>
  );

  // History modal
  const filteredConversations = conversations.filter(conv =>
    !historySearch || conv.title.toLowerCase().includes(historySearch.toLowerCase()) ||
    (conv.last_message_preview && conv.last_message_preview.toLowerCase().includes(historySearch.toLowerCase()))
  );

  const renderConversationList = (isDarkBg: boolean, keepSidebar = false) => (
    <>
      {filteredConversations.length === 0 ? (
        <p className={`text-center text-xs mt-8 ${isDarkBg ? 'text-white/40' : 'text-muted-foreground'}`}>
          {historySearch ? 'Nenhuma conversa encontrada' : 'Nenhuma conversa ainda'}
        </p>
      ) : (
        filteredConversations.map((conv) => (
          <button
            key={conv.id}
            onClick={() => loadConversation(conv.id, keepSidebar)}
            className={`w-full text-left px-3 py-2.5 rounded-xl transition-all duration-200 group ${
              activeConversationId === conv.id
                ? isDarkBg ? 'bg-white/15' : 'bg-primary/10 border border-primary/20'
                : isDarkBg ? 'hover:bg-white/5' : 'hover:bg-muted'
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-medium truncate ${isDarkBg ? 'text-white/90' : 'text-foreground'}`}>
                  {conv.title}
                </p>
                {conv.last_message_preview && (
                  <p className={`text-xs truncate mt-0.5 ${isDarkBg ? 'text-white/40' : 'text-muted-foreground'}`}>
                    {conv.last_message_preview}
                  </p>
                )}
                <p className={`text-[10px] mt-1 ${isDarkBg ? 'text-white/30' : 'text-muted-foreground/70'}`}>
                  {new Date(conv.updated_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
                  {' · '}
                  {conv.message_count} msg{conv.message_count !== 1 ? 's' : ''}
                </p>
              </div>
              <button
                onClick={(e) => deleteConversation(conv.id, e)}
                className={`opacity-0 group-hover:opacity-100 p-1 rounded-lg transition-all ${isDarkBg ? 'hover:bg-white/10' : 'hover:bg-destructive/10'}`}
                title="Excluir conversa"
              >
                <Trash2 className={`h-3.5 w-3.5 ${isDarkBg ? 'text-red-400' : 'text-destructive'}`} />
              </button>
            </div>
          </button>
        ))
      )}
    </>
  );

  // Sidebar version (inside chat) - pushes content via flex
  const renderHistorySidebar = () => (
    <AnimatePresence>
      {showHistory && (
        <>
          {isMobileView && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => { setShowHistory(false); setHistorySearch(''); }}
              className="fixed inset-0 z-10 bg-black/30"
            />
          )}
          <motion.div
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: isMobileView ? 280 : 300, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ type: 'spring', damping: 28, stiffness: 300 }}
            className={`shrink-0 flex flex-col border-r ${isDark || isMeetHub ? 'border-white/10' : 'border-gray-100'} overflow-hidden ${isMobileView ? 'fixed left-0 top-0 bottom-0 z-20' : ''}`}
            style={{ backgroundColor: bgColor }}
          >
            <div className={`flex items-center justify-between p-4 border-b ${isDark || isMeetHub ? 'border-white/10' : 'border-gray-100'} shrink-0`}>
              <h2 className={`text-sm font-bold flex items-center gap-2 whitespace-nowrap ${isDark || isMeetHub ? 'text-white/90' : 'text-gray-900'}`}>
                <History className="h-4 w-4" />
                Conversas
              </h2>
              <button onClick={() => { setShowHistory(false); setHistorySearch(''); }} className={`p-1.5 rounded-lg transition-colors ${isDark || isMeetHub ? 'hover:bg-white/10' : 'hover:bg-gray-100'}`}>
                <X className={`h-4 w-4 ${isDark || isMeetHub ? 'text-white/60' : 'text-gray-400'}`} />
              </button>
            </div>
            <div className="px-3 py-3 shrink-0">
              <button
                onClick={startNewConversation}
                className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium border transition-all whitespace-nowrap ${
                  isDark || isMeetHub 
                    ? 'border-white/10 text-white/90 hover:bg-white/10' 
                    : 'border-gray-200 text-gray-700 hover:bg-gray-50'
                }`}
              >
                <Plus className="h-4 w-4" />
                Nova conversa
              </button>
            </div>
            <div className="px-3 pb-2 shrink-0">
              <input
                type="text"
                value={historySearch}
                onChange={(e) => setHistorySearch(e.target.value)}
                placeholder="Buscar..."
                className={`w-full px-3 py-2 rounded-xl text-sm outline-none transition-all ${
                  isDark || isMeetHub 
                    ? 'bg-white/5 border border-white/10 text-white/90 placeholder:text-white/30 focus:border-white/20' 
                    : 'bg-gray-50 border border-gray-200 text-gray-900 placeholder:text-gray-400 focus:border-primary/30'
                }`}
              />
            </div>
            <div className="flex-1 overflow-y-auto px-2 pb-4 space-y-0.5">
              {renderConversationList(isDark || isMeetHub, true)}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );

  // Modal/popup version (empty dashboard state)
  const renderHistoryModal = () => (
    <AnimatePresence>
      {showHistory && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => { setShowHistory(false); setHistorySearch(''); }}
            className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm"
          />
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 pointer-events-none">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ type: 'spring', damping: 25, stiffness: 350 }}
              className="pointer-events-auto w-full max-w-[440px] max-h-[70vh] bg-card border border-border rounded-2xl shadow-2xl flex flex-col overflow-hidden"
            >
              <div className="flex items-center justify-between p-4 border-b border-border shrink-0">
                <h2 className="text-base font-bold text-foreground flex items-center gap-2">
                  <History className="h-5 w-5" />
                  Conversas
                </h2>
                <button onClick={() => { setShowHistory(false); setHistorySearch(''); }} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
                  <X className="h-5 w-5 text-muted-foreground" />
                </button>
              </div>
              <div className="px-4 py-3 border-b border-border shrink-0">
                <div className="relative">
                  <MessageSquare className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <input
                    type="text"
                    value={historySearch}
                    onChange={(e) => setHistorySearch(e.target.value)}
                    placeholder="Buscar conversas..."
                    className="w-full pl-9 pr-3 py-2 rounded-xl bg-muted text-foreground placeholder:text-muted-foreground text-sm outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </div>
              </div>
              <div className="px-4 py-3 shrink-0">
                <button
                  onClick={startNewConversation}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all hover:shadow-md"
                  style={{ backgroundColor: hubColor || DEFAULT_COLOR, color: '#fff' }}
                >
                  <Plus className="h-4 w-4" />
                  Nova conversa
                </button>
              </div>
              <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-1">
                {renderConversationList(false)}
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );

   return (
      <>
      <div data-dashboard-home {...(hasChat ? { 'data-has-chat': '' } : {})} className={`${hasChat ? 'flex flex-row' : 'flex flex-col'} h-full transition-colors duration-500 md:mt-0 md:pt-0 md:mb-0 md:pb-0 overflow-y-auto overflow-x-hidden relative min-h-full md:min-h-[calc(100vh-64px)]`} style={{ backgroundColor: isMeetHub || isDark ? '#141414' : '#faf9f7' }}>
        {/* Mobile Surface - Neutral Claude Style */}
        {isMobileView && !isDark && (
          <div className="absolute inset-0 pointer-events-none overflow-hidden z-0 select-none bg-[#faf9f7]">
            {/* Minimal soft glow at bottom */}
            <div 
              className="absolute inset-x-0 bottom-0 opacity-20 h-[50vh] w-full pointer-events-none"
              style={{
                background: `radial-gradient(circle at 50% 100%, ${hubColor || DEFAULT_COLOR} 0%, transparent 70%)`,
                filter: 'blur(80px)',
              }}
            />
          </div>
        )}
      {hasChat && !isMobileView ? renderHistorySidebar() : renderHistoryModal()}
      <div className="flex-1 flex flex-col min-w-0">

      {!hasChat ? (
        /* Empty state */
        <div className={`flex-1 flex flex-col ${isMeetHub ? 'md:flex-row' : 'items-center'} px-4 md:px-6 py-6 md:py-12 w-full min-h-[400px] md:min-h-[500px]`}>
          <div className={`flex flex-col items-center justify-center w-full ${isMeetHub ? 'md:w-1/2 md:my-0' : 'max-w-2xl'} relative z-10 my-auto`}>
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 40 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
              className="w-full flex flex-col items-center"
            >
              <div className="flex flex-col items-center gap-3 mb-1 w-full">
                <div className="flex items-center justify-center gap-3 w-full">
                  <EllosuitMark className="h-8 w-8 md:h-9 md:w-9 shrink-0" />
                  <h1 className={`text-[24px] md:text-[32px] font-normal tracking-[-0.02em] text-center ${isMeetHub || isDark ? 'text-white' : 'text-[#2b2b28]'}`}>
                    {greetingPrefix}{firstName ? `, ${firstName}` : ''}
                  </h1>
                </div>
                <p className={`text-sm md:text-base text-center px-4 md:px-0 max-w-lg w-full ${isMeetHub || isDark ? 'text-white/45' : 'text-[#8a877f]'}`}>
                  O que iremos fazer hoje?
                </p>
              </div>
            </motion.div>

            <div className="mb-5 md:mb-7" />

             <motion.div
               initial={{ opacity: 0, y: 20 }}
               animate={{ opacity: 1, y: 0 }}
               transition={{ duration: 0.6, delay: 0.5 }}
               className="w-full px-0 md:px-4"
             >
               {renderInput()}
             </motion.div>

             {/* Suggestion chips (ChatGPT/Claude style) */}
             <motion.div
               initial={{ opacity: 0, y: 12 }}
               animate={{ opacity: 1, y: 0 }}
               transition={{ duration: 0.6, delay: 0.65 }}
               className="w-full px-0 md:px-4 mt-3 flex flex-wrap items-center justify-center gap-2"
             >
                <AnimatePresence mode="popLayout" initial={false}>
                {visibleSuggestions.map((s, idx) => (
                 <motion.button
                   key={s.label}
                   layout
                    initial={{ opacity: 0, y: 10, scale: 0.95, filter: 'blur(4px)' }}
                    animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
                    exit={{ opacity: 0, y: -10, scale: 0.95, filter: 'blur(4px)' }}
                    transition={{
                      duration: 0.45,
                      ease: [0.16, 1, 0.3, 1],
                      delay: idx * 0.07,
                      layout: { duration: 0.4, ease: [0.16, 1, 0.3, 1] },
                    }}
                   onClick={() => {
                     setInput(s.prompt);
                     inputRef.current?.focus();
                   }}
                   className={`flex items-center gap-2 px-3.5 py-2 rounded-full text-[13px] transition-all duration-200 active:scale-95 ${
                     isMeetHub || isDark
                       ? 'border border-white/10 text-white/70 hover:bg-white/5 hover:text-white'
                       : 'border border-black/10 bg-white/60 text-[#5c594f] hover:bg-white hover:text-[#2b2b28]'
                   }`}
                 >
                   <s.icon className="h-3.5 w-3.5 shrink-0" style={{ color: hubColor || DEFAULT_COLOR }} />
                   {s.label}
                 </motion.button>
               ))}
               </AnimatePresence>
             </motion.div>
 
             {/* History button + recent conversations */}
             <AgentJobsPanel userId={user?.id} />

             {conversations.length > 0 && (
               <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.7 }}
                className="w-full max-w-3xl mt-6"
              >
                <button
                  onClick={() => setShowHistory(true)}
                  className={`flex items-center justify-center gap-1.5 mx-auto py-2 px-4 rounded-lg transition-colors text-xs font-medium ${isMeetHub || isDark ? 'text-white/40 hover:text-white/70' : 'text-gray-400 hover:text-gray-600'}`}
                >
                  <History className="h-3.5 w-3.5" />
                  <span>Ver conversas recentes</span>
                </button>
              </motion.div>
            )}
          </div>

          {/* Removed Most used tools section as per user request */}
          <div className="hidden" />

          {isMeetHub && !isMobileView && (
            <div className="hidden md:flex flex-1 items-center justify-center p-8">
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.8, delay: 0.5 }}
                className="relative w-full h-full max-h-[600px] rounded-3xl overflow-hidden shadow-2xl border border-white/10"
              >
                <img 
                  src="/lovable-uploads/meet-hub-placeholder.png" 
                  alt="Meet Hub Preview" 
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
              </motion.div>
            </div>
          )}
        </div>
      ) : (
        /* Chat mode */
        <>
          {/* Top bar with history button + new conversation - hidden when sidebar is open */}
          {!showHistory && (
            <div className="shrink-0 flex items-center justify-between px-4 py-2">
              <button
                onClick={() => setShowHistory(true)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${isMeetHub || isDark ? 'text-white/70 hover:text-white hover:bg-white/10' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'}`}
              >
                <History className="h-4 w-4" />
                <span className="hidden sm:inline">Conversas</span>
              </button>
              <button
                onClick={startNewConversation}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${isMeetHub || isDark ? 'text-white/70 hover:text-white hover:bg-white/10' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'}`}
              >
                <Plus className="h-4 w-4" />
                <span className="hidden sm:inline">Nova conversa</span>
              </button>
            </div>
          )}

          <div className="flex-1 relative flex flex-col min-h-0">
            <div
              ref={chatScrollRef}
              className="absolute inset-0 overflow-y-auto"
              onScroll={(e) => {
                const el = e.currentTarget;
                const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 100;
                setShowScrollDown(!atBottom);
              }}
            >
              <div className="max-w-3xl mx-auto px-4 py-6 space-y-4">
                {messages.map((msg) => (
                  <motion.div
                    key={msg.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3 }}
                    className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                  <div className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                    msg.role === 'user'
                      ? 'bg-[#374DA4] text-white font-medium shadow-lg border border-white/20'
                      : (isDark || isMeetHub)
                        ? 'bg-white/10 backdrop-blur-md text-white shadow-xl border border-white/10'
                        : 'bg-white text-gray-900 shadow-xl border border-gray-100'
                  }`}>
                    {msg.fileUrl && msg.fileName && (
                      <div className={`flex items-center gap-2 mb-2 p-2 rounded-lg ${
                        msg.role === 'user' ? 'bg-white/10' : isDark ? 'bg-white/10' : 'bg-gray-100'
                      }`}>
                        {msg.fileType === 'image' ? (
                          <img src={msg.fileUrl} alt={msg.fileName} className="h-16 w-16 rounded-lg object-cover" />
                        ) : (
                          <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${
                            msg.role === 'user' ? 'bg-white/20' : (isDark || isMeetHub) ? 'bg-white/20' : 'bg-gray-200'
                          }`}>
                            {React.createElement(FILE_ICONS[msg.fileType || 'other'] || File, { className: 'h-5 w-5' })}
                          </div>
                        )}
                        <span className="text-sm truncate flex-1">{msg.fileName}</span>
                      </div>
                    )}

                    {msg.isLoading ? (
                      <AgentActivity active userId={user?.id} />
                    ) : (
                      <>
                        <div className="flex items-start gap-2">
                          <p className={`text-sm whitespace-pre-wrap flex-1 ${msg.role === 'user' || isDark || isMeetHub ? 'text-white' : 'text-[#2b2b28]'}`}
                             dangerouslySetInnerHTML={{ __html: formatMessageContent(msg.content) }}
                          />
                          {msg.role === 'assistant' && !msg.action?.type && msg.content && (
                            <button
                              onClick={() => speakText(msg.content)}
                              className={`shrink-0 mt-0.5 p-1 rounded-full transition-colors ${isDark || isMeetHub ? 'hover:bg-white/10' : 'hover:bg-gray-100'}`}
                              title="Ouvir resposta"
                            >
                              <Volume2 className={`h-3.5 w-3.5 ${isDark || isMeetHub ? 'text-white/60 hover:text-white/90' : 'text-gray-400 hover:text-gray-600'}`} />
                            </button>
                          )}
                        </div>
                        {msg.action?.cards && msg.action.cards.length > 0 && (
                          <AIAssistantCards cards={msg.action.cards as RichCard[]} />
                        )}
                        {msg.action?.chart && (
                          <AIAssistantChart chart={msg.action.chart as ChartConfig} />
                        )}
                        {msg.action?.type === 'upgrade' && (
                          <button
                            onClick={() => navigate('/checkout/ativar')}
                            className="mt-3 inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity"
                          >
                            <Sparkles className="h-4 w-4" />
                            Fazer Upgrade
                            <ArrowRight className="h-4 w-4" />
                          </button>
                        )}
                        {msg.suggestedConversationId && (
                          <button
                            onClick={() => loadConversation(msg.suggestedConversationId!)}
                            className={`mt-3 inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all border ${isMeetHub ? 'bg-white/10 hover:bg-white/20 text-white border-white/10' : 'bg-muted hover:bg-muted/80 text-foreground border-border'}`}
                          >
                            <History className="h-4 w-4" />
                            Ir para: {msg.suggestedConversationTitle}
                            <ArrowRight className="h-4 w-4" />
                          </button>
                        )}
                        {msg.action?.quickReplies && msg.action.quickReplies.length > 0 && (
                          <div className="mt-3 flex flex-wrap gap-2">
                            {msg.action.quickReplies.map((reply: string, idx: number) => (
                              <button
                                key={idx}
                                onClick={() => {
                                  setInput(reply);
                                  setTimeout(() => handleSubmit(reply), 100);
                                }}
                                disabled={isProcessing}
                                className="px-3 py-2 rounded-xl text-xs font-medium bg-primary/10 text-primary hover:bg-primary/20 border border-primary/20 hover:border-primary/40 transition-all duration-200 disabled:opacity-50"
                              >
                                {reply}
                              </button>
                            ))}
                          </div>
                        )}
                      </>
                    )}

                    {msg.action?.action === 'whatsapp_qr_code' && msg.action?.qrCode && (
                      <WhatsAppQRInline 
                        qrCode={msg.action.qrCode} 
                        sessionId={msg.action.sessionId}
                        onConnected={() => {
                          setMessages(prev => prev.map(m => 
                            m.id === msg.id 
                              ? { ...m, content: '✅ WhatsApp vinculado com sucesso! Agora posso enviar mensagens pelo seu número.', action: { action: 'whatsapp_connected' }, qrCode: undefined }
                              : m
                          ));
                        }}
                      />
                    )}

                    {msg.action?.action === 'whatsapp_session_selection' && msg.action?.sessions?.length > 0 && (
                      <div className="mt-3 space-y-2">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {msg.action.sessions.map((session: any) => (
                            <button
                              key={session.id}
                              onClick={() => {
                                const cmd = `Enviar mensagem via sessão ${session.id}`;
                                setInput(`Enviar usando ${session.number || session.name}`);
                                setTimeout(() => handleSubmit(cmd), 100);
                              }}

                              className={`flex items-center gap-3 p-3 rounded-xl border transition-all hover:scale-[1.02] active:scale-[0.98] text-left ${
                                session.status === 'connected' 
                                  ? 'bg-green-500/5 border-green-500/20 hover:border-green-500/40' 
                                  : 'bg-muted/50 border-border hover:border-primary/40'
                              }`}
                            >
                              <div className="relative">
                                <img 
                                  src={session.photo} 
                                  alt="Profile" 
                                  className="w-10 h-10 rounded-full object-cover border border-border bg-white"
                                  onError={(e) => {
                                    (e.target as HTMLImageElement).src = 'https://jwddiyuezqrpuakazvgg.supabase.co/storage/v1/object/public/brand-assets/whatsapp-default.png';
                                  }}
                                />
                                <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white ${session.status === 'connected' ? 'bg-green-500' : 'bg-gray-400'}`} />
                              </div>

                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-bold truncate">{session.number || 'Desconhecido'}</p>
                                <p className="text-[10px] opacity-60 truncate uppercase tracking-wider">{session.name}</p>
                              </div>
                            </button>
                          ))}
                        </div>
                        <button
                          onClick={() => {
                            setInput("Criar uma nova conexão de WhatsApp");
                            setTimeout(() => handleSubmit("Criar uma nova conexão de WhatsApp"), 100);
                          }}
                          className={`w-full py-2.5 rounded-xl border-2 border-dashed border-primary/30 text-primary text-xs font-bold hover:bg-primary/5 transition-all flex items-center justify-center gap-2`}
                        >
                          <Plus className="h-3.5 w-3.5" />
                          CONECTAR NOVO NÚMERO
                        </button>
                      </div>
                    )}

                    {msg.action?.action === 'list_styles' && msg.action?.styles?.length > 0 && (
                      <div className="mt-2 flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
                        {msg.action.styles.map((style: any) => (
                          <button
                            key={style.id}
                            onClick={() => {
                              setInput(`Quero o estilo "${style.name}"`);
                              setTimeout(() => handleSubmit(`Quero o estilo "${style.name}"`), 100);
                            }}
                            disabled={isProcessing}
                            className="group flex-shrink-0 w-24 rounded-lg border border-border overflow-hidden hover:border-primary/50 hover:shadow-sm transition-all duration-200 text-left bg-card"
                          >
                            {style.preview_images?.[0] && (
                              <div className="h-16 overflow-hidden bg-muted">
                                <img 
                                  src={style.preview_images[0]} 
                                  alt={style.name}
                                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                />
                              </div>
                            )}
                            <div className="px-1.5 py-1">
                              <p className="text-[10px] font-semibold text-foreground truncate leading-tight">{style.name}</p>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}

                    {msg.action?.action === 'brand_assets_found' && msg.action?.assets?.length > 0 && (
                      <div className="mt-3 flex gap-2 flex-wrap">
                        {msg.action.assets.map((asset: any) => (
                          <div key={asset.id} className="w-16 h-16 rounded-lg border border-border overflow-hidden bg-muted">
                            <img src={asset.file_url} alt={asset.name} className="w-full h-full object-contain p-1" />
                          </div>
                        ))}
                      </div>
                    )}

                    {msg.action?.action === 'image_generated' && msg.action?.imageUrl && (
                      <div className="mt-3 space-y-2">
                        <img 
                          src={msg.action.imageUrl} 
                          alt="Imagem gerada pela IA" 
                          className="rounded-xl max-w-full max-h-80 object-contain border border-border shadow-sm"
                        />
                        <div className="flex gap-2">
                          <a
                            href={msg.action.imageUrl}
                            download={`post-${Date.now()}.png`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs font-medium px-3 py-1.5 rounded-full transition-colors bg-primary text-primary-foreground hover:opacity-90"
                          >
                            ⬇️ Baixar Imagem
                          </a>
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(msg.action.imageUrl);
                              toast({ title: 'Link copiado!' });
                            }}
                            className={`text-xs font-medium px-3 py-1.5 rounded-full transition-colors border ${isDark || isMeetHub ? 'bg-white/10 text-white hover:bg-white/20 border-white/10' : 'bg-muted text-foreground hover:bg-muted/80 border-border'}`}
                          >
                            📋 Copiar Link
                          </button>
                        </div>
                      </div>
                    )}

                    {msg.action?.action === 'pdf_generated' && msg.action?.pdfUrl && (
                      <div className="mt-3 space-y-2">
                        <div className={`flex items-center gap-3 p-3 rounded-xl border ${isDark || isMeetHub ? 'bg-white/5 border-white/10' : 'bg-muted/50 border-border'}`}>
                          <div className="w-10 h-10 rounded-lg bg-red-100 flex items-center justify-center shrink-0">
                            <FileText className="h-5 w-5 text-red-600" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-foreground truncate">{msg.action.title || 'Documento'}</p>
                            <p className="text-xs text-muted-foreground">{msg.action.documentType === 'contrato' ? 'Contrato' : msg.action.documentType === 'proposta' ? 'Proposta' : msg.action.documentType === 'resumo' ? 'Resumo' : 'Documento'} • PDF</p>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <a
                            href={msg.action.pdfUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs font-medium px-3 py-1.5 rounded-full transition-colors bg-primary text-primary-foreground hover:opacity-90"
                          >
                            Visualizar
                          </a>
                          <button
                            onClick={() => {
                              const w = window.open(msg.action.pdfUrl, '_blank');
                              if (w) setTimeout(() => w.print(), 1000);
                            }}
                            className={`text-xs font-medium px-3 py-1.5 rounded-full transition-colors border ${isDark || isMeetHub ? 'bg-white/10 text-white hover:bg-white/20 border-white/10' : 'bg-muted text-foreground hover:bg-muted/80 border-border'}`}
                          >
                            Imprimir / Salvar PDF
                          </button>
                        </div>
                      </div>
                    )}

                    {msg.action?.action === 'pdf_visual_analysis' && msg.action?.fileUrl && (
                      <Suspense fallback={
                        <div className="mt-3 flex items-center gap-2 p-3 rounded-xl bg-muted/50 border border-border">
                          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                          <span className="text-sm text-muted-foreground">Carregando análise...</span>
                        </div>
                      }>
                        <AIAssistantPdfAnalysis
                          fileUrl={msg.action.fileUrl}
                          fileName={msg.action.fileName}
                          pages={msg.action.pages}
                          overallScore={msg.action.overallScore}
                          overallSummary={msg.action.overallSummary}
                        />
                      </Suspense>
                    )}

                    {msg.action?.navigate && msg.action?.action !== 'whatsapp_qr_code' && (
                      <button
                        onClick={() => navigate(msg.action.navigate)}
                        className="mt-2 text-xs font-medium px-3 py-1.5 rounded-full transition-colors"
                        style={{ backgroundColor: hubColor || DEFAULT_COLOR, color: 'white' }}
                      >
                        {msg.action.action === 'event_created' ? 'Ver na Agenda →' :
                         msg.action.action === 'contact_created' ? 'Ver Cadastros →' :
                         msg.action.action === 'saved_to_drive' ? 'Abrir Drive →' :
                         msg.action.action === 'folder_created' ? 'Abrir Drive →' :
                         msg.action.action === 'automation_created' ? 'Ver Automações →' :
                         msg.action.action === 'chatbot_created' ? 'Ver Chatbot Builder →' :
                         msg.action.label ? `Ir para ${msg.action.label} →` : 'Abrir →'}
                      </button>
                    )}
                    {msg.action?.action === 'navigate' && !msg.action?.navigate && (
                      <button
                        onClick={() => navigate(msg.action.path)}
                        className="mt-2 text-xs font-medium px-3 py-1.5 rounded-full transition-colors"
                        style={{ backgroundColor: hubColor || DEFAULT_COLOR, color: 'white' }}
                      >
                        Ir para {msg.action.label} →
                      </button>
                    )}
                    {msg.action?.action === 'import_contacts' && msg.action?.path && (
                      <button
                        onClick={() => navigate(msg.action.path)}
                        className="mt-2 text-xs font-medium px-3 py-1.5 rounded-full transition-colors"
                        style={{ backgroundColor: hubColor || DEFAULT_COLOR, color: 'white' }}
                      >
                        Importar Contatos →
                      </button>
                    )}
                    {msg.action?.action === 'request_file' && (
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        className="mt-2 flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full transition-colors"
                        style={{ backgroundColor: hubColor || DEFAULT_COLOR, color: 'white' }}
                      >
                        <UploadCloud className="h-3.5 w-3.5" />
                        Anexar arquivo
                      </button>
                    )}
                  </div>
                </motion.div>
              ))}
              <div ref={chatEndRef} />
            </div>
            </div>

            <Dialog open={showInPersonMeeting} onOpenChange={setShowInPersonMeeting}>
              <DialogContent className="max-w-4xl max-h-[90dvh] overflow-y-auto bg-background rounded-2xl p-4 md:p-6">
                <InPersonMeeting initialTitle={pendingInPersonTitle} />
              </DialogContent>
            </Dialog>

            {/* Floating scroll-to-bottom button */}
            <AnimatePresence>
              {showScrollDown && (
                <motion.button
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  onClick={() => chatScrollRef.current?.scrollTo({ top: chatScrollRef.current.scrollHeight, behavior: 'smooth' })}
                  className="absolute bottom-4 left-1/2 -translate-x-1/2 p-2.5 rounded-full bg-white/20 backdrop-blur-md border border-white/20 text-white/80 hover:bg-white/30 hover:text-white transition-all shadow-lg z-10"
                >
                  <ChevronDown className="h-5 w-5" />
                </motion.button>
              )}
            </AnimatePresence>
          </div>

          <div
            className="shrink-0 px-4 pb-4 md:pb-6 pt-2"
            style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}
          >
            {renderInput()}
          </div>
        </>
      )}
       </div>
     </div>
     <QuickActionsModal isOpen={showAllToolsModal} onClose={() => setShowAllToolsModal(false)} />
     </>
   );
 };

export default AIAssistantHome;
