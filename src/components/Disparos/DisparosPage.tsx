import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Plus, Trash2, ChevronLeft, ChevronRight, Phone, Wifi, Upload, Sparkles, Send, Rocket, Loader2, Info, Check, Image, Video, Mic, FileText, Pause, AlertTriangle, Users, Database, Play, XCircle, MoreVertical, Layout, History, MessageSquare, AlertCircle, Clock, Shield, RefreshCw } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { convertAudioToMp3, needsMp3Conversion } from '@/utils/audioConvert';


const BRAND_BLUE = '#374DA4';

const VOICE_LABELS: Record<string, string> = {
  '21m00Tcm4TlvDq8ikWAM': 'Rachel (Feminina - Suave)',
  'EXAVITQu4vr4xnSDxMaL': 'Sarah (Feminina - Suave)',
  'FGY2WhTYpPnrIDTdsKH5': 'Laura (Feminina - Expressiva)',
  'cgSgspJ2msm6clMCkdW9': 'Jessica (Feminina - Natural)',
  'JBFqnCBsd6RMkjVDRZzb': 'George (Masculina - Narrador)',
};

const getSteps = (isVoiceMode: boolean) => {
  const steps = [
    { id: 'connection', title: 'Conexão' },
    { id: 'recipients', title: 'Destinatários' },
    { id: 'message', title: 'Mensagem' }
  ];
  if (isVoiceMode) {
    steps.push({ id: 'voice-select', title: 'Voz' });
    steps.push({ id: 'voice-review', title: 'Revisão de Voz' });
  }
  steps.push({ id: 'review', title: 'Finalização' });
  return steps;
};

export default function DisparosPage() {
  const [view, setView] = useState<'list' | 'wizard' | 'details'>('list');
  const [currentStep, setCurrentStep] = useState(0);
  const [campaignTitle, setCampaignTitle] = useState('');
  const [selectedSessionId, setSelectedSessionId] = useState<string>('');
  const [recipients, setRecipients] = useState<{id: string, phone: string, name?: string, status: 'pending' | 'sent' | 'error', voiceUrl?: string, voiceApproved?: boolean, jobId?: string, voiceError?: string, dispatchCount?: number, lastDispatchAt?: string | null, lastDispatchStatus?: string | null}[]>([]);
  const [newPhone, setNewPhone] = useState('');
  const [newName, setNewName] = useState('');
  const [firstNameOnly, setFirstNameOnly] = useState(true);
  const [message, setMessage] = useState('');
  const [mediaType, setMediaType] = useState<'text' | 'image' | 'video' | 'audio' | 'document' | 'voice'>('text');
  const [mediaUrl, setMediaUrl] = useState('');
  const [mediaCaption, setMediaCaption] = useState('');
  const [followUpsEnabled, setFollowUpsEnabled] = useState(false);
  const [followUps, setFollowUps] = useState<{ id: string; media_type: 'text' | 'image' | 'video' | 'audio' | 'document'; media_url: string; message: string }[]>([]);
  const [voiceSettings, setVoiceSettings] = useState({ 
    script: '', 
    mentionNames: true, // Personalização Inteligente padrão ativo
    voiceId: '21m00Tcm4TlvDq8ikWAM' // Rachel (Default ElevenLabs)
  });
  const [isGeneratingVoices, setIsGeneratingVoices] = useState(false);
  // Rascunho persistente (backup dos áudios já gerados)
  const [draftCampaignId, setDraftCampaignId] = useState<string | null>(null);
  const [voiceBatch, setVoiceBatch] = useState<{ current: number; total: number } | null>(null);
  const [voiceEta, setVoiceEta] = useState<{ done: number; total: number; etaSec: number } | null>(null);
  const VOICE_BATCH_SIZE = 200;
  const cancelVoiceRef = useRef(false);

  const [delaySeconds, setDelaySeconds] = useState(5);
  // Intervalo seguro (variável): alterna aleatoriamente entre estes valores (em segundos)
  const SAFE_DELAY_VARIANTS = [120, 180, 240, 300, 480];
  // Faixa aleatória (modo "range"): sorteia um valor quebrado entre min e max
  const RANGE_DELAY = [120, 200];


  // Formata segundos em "2h 15min" / "45min" / "30s"
  const formatEta = (sec: number) => {
    if (!isFinite(sec) || sec <= 0) return '—';
    const s = Math.round(sec);
    const h = Math.floor(s / 3600);
    const m = Math.round((s % 3600) / 60);
    if (h > 0) return `${h}h${m ? ` ${m}min` : ''}`;
    if (s >= 60) return `${Math.max(1, m)}min`;
    return `${s}s`;
  };

  // Intervalo médio (s) entre mensagens conforme o modo escolhido
  const avgDelaySeconds = () =>
    delayMode === 'variable'
      ? SAFE_DELAY_VARIANTS.reduce((a, b) => a + b, 0) / SAFE_DELAY_VARIANTS.length
      : delayMode === 'range'
        ? (RANGE_DELAY[0] + RANGE_DELAY[1]) / 2
        : delaySeconds;

  // Estimativa de conclusão do disparo (n mensagens restantes)
  const dispatchEtaSeconds = (remaining: number) => Math.max(0, remaining - 1) * avgDelaySeconds();

  const etaClock = (sec: number) =>
    new Date(Date.now() + sec * 1000).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

  const [delayMode, setDelayMode] = useState<'fixed' | 'variable' | 'range'>('fixed');
  // Envio em etapas (lotes): 0 = tudo de uma vez
  const [batchSize, setBatchSize] = useState<number>(0);
  const [autoNextBatch, setAutoNextBatch] = useState(false);

  const [replyAiEnabled, setReplyAiEnabled] = useState(false);
  const [replyAiLink, setReplyAiLink] = useState('');
  const [replyAiOffer, setReplyAiOffer] = useState('');
  const [replyAiInterestedMessage, setReplyAiInterestedMessage] = useState('');
  const [replyAiNotInterestedMessage, setReplyAiNotInterestedMessage] = useState('');
  const [aiEnabled, setAiEnabled] = useState(false);
  const [selectedAgentId, setSelectedAgentId] = useState<string>('');
  const [aiAgents, setAiAgents] = useState<any[]>([]);
  const [chatbotEnabled, setChatbotEnabled] = useState(false);
  const [selectedFlowId, setSelectedFlowId] = useState<string>('');
  const [chatbotFlows, setChatbotFlows] = useState<any[]>([]);
  const [isSending, setIsSending] = useState(false);
  const sendingRef = useRef(false);
  // Chave de idempotência: mesma chave => mesma campanha no banco (índice único company_id+client_key)
  const launchKeyRef = useRef<string>(crypto.randomUUID());


  const [progress, setProgress] = useState(0);
  const [campaignHistory, setCampaignHistory] = useState<any[]>([]);
  const [sessions, setSessions] = useState<any[]>([]);
  const [retryingCampaignId, setRetryingCampaignId] = useState<string | null>(null);

  const { toast } = useToast();
  const messageRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isImportingFromSession, setIsImportingFromSession] = useState(false);
  const [contacts, setContacts] = useState<any[]>([]);
  const [selectedCampaign, setSelectedCampaign] = useState<any>(null);
  const [campaignLogs, setCampaignLogs] = useState<any[]>([]);
  const [voicePreviewUrls, setVoicePreviewUrls] = useState<Record<string, string>>({});
  const [customVoices, setCustomVoices] = useState<{ voice_id: string; name: string }[]>([]);
  const [cloneOpen, setCloneOpen] = useState(false);
  const [cloneName, setCloneName] = useState('');
  const [cloneFiles, setCloneFiles] = useState<File[]>([]);
  const [isCloning, setIsCloning] = useState(false);
  const [isConvertingAudio, setIsConvertingAudio] = useState(false);

  const previewAudioRef = useRef<HTMLAudioElement | null>(null);
  const [nowTick, setNowTick] = useState(() => Date.now());

  useEffect(() => {
    if (view !== 'details') return;
    const t = setInterval(() => setNowTick(Date.now()), 1000);
    return () => clearInterval(t);
  }, [view]);

  const [showCloneForm, setShowCloneForm] = useState(false);
  const steps = getSteps(mediaType === 'voice');

  // Mantém a etapa atual válida quando o número de etapas muda (ex.: sair do modo Voz IA)
  useEffect(() => {
    setCurrentStep(prev => Math.min(prev, steps.length - 1));
  }, [steps.length]);

  useEffect(() => {
    fetchSessions();
    fetchHistory();
    fetchAiAgents();
    fetchChatbotFlows();
  }, []);

  const fetchAiAgents = async () => {
    const { data } = await supabase.from('ai_agents' as any).select('*');
    setAiAgents(data || []);
  };

  const fetchChatbotFlows = async () => {
    const { data } = await supabase
      .from('chatbot_flows' as any)
      .select('id, name, is_active')
      .order('updated_at', { ascending: false });
    setChatbotFlows(data || []);
  };

  const fetchSessions = async () => {
    const { data } = await supabase.from('whatsapp_sessions' as any).select('*');
    setSessions(data || []);
  };

  const fetchHistory = async () => {
    const { data } = await supabase.from('dispatch_campaigns' as any).select('*').order('created_at', { ascending: false });
    setCampaignHistory(data || []);
  };

  const addRecipient = (value?: string, nameValue?: string) => {
    const input = value || newPhone;
    if (!input) return;

    // Se for entrada manual única com nome
    if (!value && newName) {
      let normalized = input.replace(/\D/g, '');
      if (normalized.length === 11) normalized = '55' + normalized;
      else if (normalized.length === 10) normalized = '55' + normalized.slice(0, 2) + '9' + normalized.slice(2);
      
      const currentPhones = new Set(recipients.map(r => r.phone));
      if (!currentPhones.has(normalized)) {
        setRecipients([...recipients, { id: crypto.randomUUID(), phone: normalized, name: newName, status: 'pending' }]);
      }
      setNewPhone('');
      setNewName('');
      return;
    }

    // Detecção de colagem de múltiplos números
    const lines = input.split(/[\n,;\t\s]+/).filter(l => l.trim());
    const newRecipients = lines.map(line => {
      let normalized = line.replace(/\D/g, '');
      
      // Normalização inteligente do número (formato BR)
      if (normalized.length === 11 && normalized.startsWith('55')) {
        // Formato BR completo já validado
      } else if (normalized.length === 11) {
        // DDD + 9 dígitos (ex: 41996875461)
        normalized = '55' + normalized;
      } else if (normalized.length === 10) {
        // DDD + 8 dígitos -> adiciona 9 e prefixo BR
        normalized = '55' + normalized.slice(0, 2) + '9' + normalized.slice(2);
      } else if (normalized.length === 9) {
        // 9 dígitos sem DDD (assume 41 local como fallback)
        normalized = '5541' + normalized;
      } else if (normalized.length === 8) {
        // 8 dígitos sem DDD
        normalized = '55419' + normalized;
      } else if (!normalized.startsWith('55') && normalized.length >= 10) {
        normalized = '55' + normalized;
      }

      return { id: crypto.randomUUID(), phone: normalized, status: 'pending' as const };
    }).filter(r => r.phone.length >= 10);

    if (newRecipients.length > 0) {
      const currentPhones = new Set(recipients.map(r => r.phone));
      const uniqueNew = newRecipients.filter(r => !currentPhones.has(r.phone));
      
      setRecipients([...recipients, ...uniqueNew]);
      persistContacts(uniqueNew.map(r => ({ phone: r.phone })), 'manual');

      if (uniqueNew.length > 1) {
        toast({ title: 'Sucesso', description: `${uniqueNew.length} destinatários adicionados.` });
      }
    }
    
    setNewPhone('');
  };

  const removeRecipient = (id: string) => setRecipients(recipients.filter(r => r.id !== id));

  /**
   * Salva os contatos importados na agenda da empresa (dispatch_contacts)
   * e devolve o histórico de disparos de cada número.
   */
  const persistContacts = async (
    list: { phone: string; name?: string }[],
    source: 'import' | 'manual' | 'whatsapp' = 'import'
  ) => {
    if (!list.length) return;
    try {
      const { companyId } = await getCompanyId();
      const byPhone = new Map<string, { phone: string; name?: string }>();
      list.forEach(r => { if (r.phone) byPhone.set(r.phone, r); });
      const unique = Array.from(byPhone.values());

      const CHUNK = 500;
      for (let i = 0; i < unique.length; i += CHUNK) {
        const rows = unique.slice(i, i + CHUNK).map(r => ({
          company_id: companyId,
          phone: r.phone,
          name: r.name || null,
          source,
        }));
        const { error } = await supabase
          .from('dispatch_contacts' as any)
          .upsert(rows, { onConflict: 'company_id,phone', ignoreDuplicates: false });
        if (error) throw error;
      }

      // Busca histórico para marcar quem já recebeu disparo
      const history: Record<string, { total: number; last: string | null; status: string | null }> = {};
      for (let i = 0; i < unique.length; i += CHUNK) {
        const phones = unique.slice(i, i + CHUNK).map(r => r.phone);
        const { data } = await supabase
          .from('dispatch_contacts' as any)
          .select('phone,total_dispatches,last_dispatch_at,last_dispatch_status')
          .eq('company_id', companyId)
          .in('phone', phones);
        (data || []).forEach((c: any) => {
          history[c.phone] = {
            total: c.total_dispatches || 0,
            last: c.last_dispatch_at,
            status: c.last_dispatch_status,
          };
        });
      }

      setRecipients(prev => prev.map(r => {
        const h = history[r.phone];
        return h ? { ...r, dispatchCount: h.total, lastDispatchAt: h.last, lastDispatchStatus: h.status } : r;
      }));

      const jaEnviados = Object.values(history).filter(h => h.total > 0).length;
      toast({
        title: 'Contatos salvos',
        description: `${unique.length} contato(s) salvos na sua base${jaEnviados ? ` — ${jaEnviados} já receberam disparo antes.` : '.'}`,
      });
    } catch (err: any) {
      console.error('Erro ao salvar contatos:', err);
      toast({ title: 'Aviso', description: `Não foi possível salvar os contatos na base: ${err.message}`, variant: 'destructive' });
    }
  };


  const followUpsValid = () =>
    !followUpsEnabled ||
    (followUps.length > 0 &&
      followUps.every(f => (f.media_type === 'text' ? !!f.message.trim() : !!f.media_url.trim())));

  // Valida se a etapa `step` (índice em `steps`) está completa.
  const stepError = (step: number): string | null => {
    const id = steps[step]?.id;
    if (id === 'connection') return selectedSessionId ? null : 'Selecione a conexão de WhatsApp para continuar.';
    if (id === 'recipients') return recipients.length > 0 ? null : 'Adicione pelo menos um destinatário.';
    if (id === 'message') {
      if (mediaType === 'voice') {
        if (!voiceSettings.script.trim()) return 'Escreva o roteiro da narração antes de continuar.';
      } else if (mediaType === 'text') {
        if (!message.trim()) return 'Escreva o texto da mensagem antes de continuar.';
      } else if (!mediaUrl.trim()) {
        return `Informe o link da mídia (${mediaType}) antes de continuar.`;
      }
      if (!followUpsValid()) return 'Complete (ou remova) as mensagens em sequência antes de continuar.';
      return null;
    }
    if (id === 'voice-select') return voiceSettings.voiceId ? null : 'Escolha (ou crie) uma voz para continuar.';
    if (id === 'voice-review') {
      const someDone = recipients.some(r => r.voiceUrl);
      return someDone
        ? null
        : 'Gere pelo menos alguns áudios antes de continuar.';
    }
    return null;
  };

  const canAdvance = (step: number) => stepError(step) === null;

  // Só permite ir para uma etapa se TODAS as anteriores estiverem completas.
  const firstIncompleteStep = () => {
    for (let i = 0; i < steps.length; i++) {
      if (stepError(i)) return i;
    }
    return steps.length - 1;
  };

  const goToStep = (target: number) => {
    if (target <= currentStep) {
      setShowCloneForm(false);
      setCurrentStep(Math.max(0, target));
      return;
    }
    for (let i = 0; i < target; i++) {
      const err = stepError(i);
      if (err) {
        setCurrentStep(i);
        toast({ title: `Etapa ${i + 1}: ${steps[i].title}`, description: err, variant: 'destructive' });
        return;
      }
    }
    setShowCloneForm(false);
    setCurrentStep(target);
    if (steps[target]?.id === 'voice-review' && mediaType === 'voice') {
      generateAllVoices();
    }
  };

  const goNext = () => goToStep(Math.min(currentStep + 1, steps.length - 1));
  const goBack = () => {
    if (currentStep > 0) goToStep(currentStep - 1);
    else setView('list');
  };

  // Busca o áudio direto do endpoint da edge function para preservar o binário MP3
  const fetchTtsBlob = async (text: string): Promise<Blob> => {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

    const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/elevenlabs-tts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ text, voiceId: voiceSettings.voiceId }),
    });

    if (!res.ok) {
      const errText = await res.text();
      let msg = 'Falha ao gerar áudio';
      try { msg = JSON.parse(errText).error || msg; } catch {}
      throw new Error(msg);
    }

    const blob = await res.blob();
    if (!blob.size) throw new Error('Áudio vazio retornado pela ElevenLabs');
    return new Blob([blob], { type: 'audio/mpeg' });
  };

  const fetchTtsUrl = async (text: string): Promise<string> =>
    URL.createObjectURL(await fetchTtsBlob(text));


  useEffect(() => {
    if (mediaType !== 'voice' || Object.keys(voicePreviewUrls).length > 0) return;

    const loadVoicePreviews = async () => {
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData.session?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
        const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/elevenlabs-tts`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            action: 'voice-previews',
            voiceIds: [
              '21m00Tcm4TlvDq8ikWAM',
              'EXAVITQu4vr4xnSDxMaL',
              'FGY2WhTYpPnrIDTdsKH5',
              'cgSgspJ2msm6clMCkdW9',
              'JBFqnCBsd6RMkjVDRZzb',
            ],
          }),
        });
        if (!res.ok) throw new Error('Não foi possível carregar as prévias');
        const data = await res.json();
        setVoicePreviewUrls(data.previews || {});
      } catch (error) {
        console.error('Erro ao carregar prévias de voz:', error);
      }
    };

    loadVoicePreviews();
  }, [mediaType, voicePreviewUrls]);

  const callVoiceCloneFn = async (payload: BodyInit, isJson: boolean) => {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
    return fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/elevenlabs-voice-clone`, {
      method: 'POST',
      headers: {
        apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        Authorization: `Bearer ${token}`,
        ...(isJson ? { 'Content-Type': 'application/json' } : {}),
      },
      body: payload,
    });
  };

  const loadCustomVoices = async () => {
    try {
      const res = await callVoiceCloneFn(JSON.stringify({ action: 'list' }), true);
      if (!res.ok) return;
      const data = await res.json();
      setCustomVoices(data.voices || []);
    } catch (e) {
      console.error('Erro ao listar vozes personalizadas:', e);
    }
  };

  useEffect(() => {
    if (mediaType === 'voice') loadCustomVoices();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mediaType]);

  const cloneFileUrls = useMemo(() => cloneFiles.map(f => URL.createObjectURL(f)), [cloneFiles]);
  useEffect(() => () => { cloneFileUrls.forEach(u => URL.revokeObjectURL(u)); }, [cloneFileUrls]);

  const addCloneFiles = async (incoming: File[]) => {
    let files = incoming;
    const toConvert = incoming.filter(needsMp3Conversion);
    if (toConvert.length > 0) {
      setIsConvertingAudio(true);
      toast({ title: 'Convertendo áudio', description: `Convertendo ${toConvert.length} arquivo(s) para MP3...` });
      try {
        files = await Promise.all(
          incoming.map(async f => {
            try {
              return await convertAudioToMp3(f);
            } catch (err) {
              console.error('Falha ao converter áudio:', f.name, err);
              toast({ title: 'Não foi possível converter', description: `${f.name} não pôde ser convertido para MP3.`, variant: 'destructive' });
              return null;
            }
          })
        ).then(list => list.filter(Boolean) as File[]);
      } finally {
        setIsConvertingAudio(false);
      }
    }
    if (files.length === 0) return;

    setCloneFiles(prev => {
      const seen = new Set(prev.map(f => `${f.name}-${f.size}`));
      const unique: File[] = [];
      let duplicates = 0;
      for (const f of files) {
        const key = `${f.name}-${f.size}`;
        if (seen.has(key)) { duplicates++; continue; }
        seen.add(key);
        unique.push(f);
      }
      if (duplicates > 0) {
        toast({
          title: 'Áudio duplicado ignorado',
          description: 'A ElevenLabs não aceita o mesmo arquivo duas vezes. Envie gravações diferentes.',
          variant: 'destructive',
        });
      }
      const merged = [...prev, ...unique];
      if (merged.length > 5) {
        toast({ title: 'Limite de 5 áudios', description: 'Apenas os 5 primeiros áudios serão usados.' });
      }
      return merged.slice(0, 5);
    });
  };


  const createClonedVoice = async () => {
    if (isCloning) return;
    if (!cloneName.trim()) {
      toast({ title: 'Informe um título', description: 'Dê um nome para identificar sua voz.', variant: 'destructive' });
      return;
    }
    if (cloneFiles.length < 5) {
      toast({ title: 'Atenção', description: 'É obrigatório anexar 5 áudios de mais de 30 segundos para criar uma voz.', variant: 'destructive' });
      return;
    }
    if (cloneFiles.length > 5) {
      toast({ title: 'Máximo de 5 áudios', description: 'Remova alguns arquivos: o limite é de 5 amostras por voz.', variant: 'destructive' });
      return;
    }
    setIsCloning(true);
    try {
      const form = new FormData();
      form.append('name', cloneName.trim());
      // Garante nomes únicos para evitar o erro "You cannot upload the same file twice"
      cloneFiles.forEach((f, i) => {
        const ext = f.name.includes('.') ? f.name.split('.').pop() : 'mp3';
        form.append('files', f, `amostra_${i + 1}_${Date.now()}.${ext}`);
      });
      const res = await callVoiceCloneFn(form, false);
      const data = await res.json();
      if (!res.ok) {
        let friendly = data.message || 'Falha ao clonar a voz';
        try {
          const detail = typeof data.details === 'string' ? JSON.parse(data.details)?.detail : null;
          if (detail?.status === 'duplicated_files') friendly = 'Você enviou o mesmo áudio mais de uma vez. Use gravações diferentes.';
          else if (detail?.message) friendly = detail.message;
        } catch { /* mantém mensagem padrão */ }
        throw new Error(friendly);
      }
      toast({ title: 'Voz criada', description: `"${cloneName}" foi adicionada à sua conta ElevenLabs.` });
      setVoiceSettings(prev => ({ ...prev, voiceId: data.voice_id }));
      setShowCloneForm(false);
      setCloneName('');
      setCloneFiles([]);
      await loadCustomVoices();
    } catch (e: any) {
      toast({ title: 'Erro ao clonar voz', description: e.message, variant: 'destructive' });
    } finally {
      setIsCloning(false);
    }
  };

  const playSelectedVoicePreview = async () => {
    const custom = customVoices.find(v => v.voice_id === voiceSettings.voiceId);
    if (custom && !voicePreviewUrls[voiceSettings.voiceId]) {
      toast({ title: 'Voz personalizada', description: 'A prévia será gerada na etapa de revisão de voz.' });
      return;
    }
    const previewUrl = voicePreviewUrls[voiceSettings.voiceId];
    if (!previewUrl) {
      toast({ title: 'Prévia indisponível', description: 'Selecione outra voz ou tente novamente.', variant: 'destructive' });
      return;
    }

    previewAudioRef.current?.pause();
    const audio = new Audio(previewUrl);
    previewAudioRef.current = audio;
    try {
      await audio.play();
    } catch {
      toast({ title: 'Não foi possível reproduzir', description: 'Tente novamente.', variant: 'destructive' });
    }
  };

  const getCompanyId = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Usuário não autenticado');
    const { data: cuData } = await supabase
      .from('company_users')
      .select('company_id')
      .eq('user_id', user.id)
      .maybeSingle();
    const companyId = (cuData as any)?.company_id || user.user_metadata?.company_id;
    if (!companyId) throw new Error('Empresa não encontrada para o usuário');
    return { companyId, userId: user.id };
  };

  /**
   * Cria (uma única vez) a campanha em modo RASCUNHO com todos os destinatários já
   * salvos no banco. É o backup: cada áudio gerado é gravado no storage e vinculado
   * ao destinatário, então nada se perde se a página cair no meio da geração.
   */
  const ensureDraftCampaign = async (): Promise<string> => {
    if (draftCampaignId) return draftCampaignId;

    const { companyId, userId } = await getCompanyId();
    const clientKey = launchKeyRef.current;

    // Idempotente: se a mesma chave já criou uma campanha (clique repetido / retry de rede),
    // reaproveita em vez de duplicar.
    const { data: existing } = await supabase
      .from('dispatch_campaigns' as any)
      .select('id')
      .eq('company_id', companyId)
      .eq('client_key', clientKey)
      .maybeSingle();

    if (existing) {
      const existingId = (existing as any).id;
      const { data: jobs } = await supabase
        .from('dispatch_jobs')
        .select('id, phone')
        .eq('campaign_id', existingId);
      const map: Record<string, string> = {};
      (jobs || []).forEach((j: any) => { map[j.phone] = j.id; });
      setRecipients(prev => prev.map(r => ({ ...r, jobId: map[r.phone] || r.jobId })));
      setDraftCampaignId(existingId);
      localStorage.setItem('disparos_draft_id', existingId);
      return existingId;
    }

    const { data: campaign, error } = await supabase
      .from('dispatch_campaigns' as any)
      .insert({
        company_id: companyId,
        user_id: userId,
        client_key: clientKey,
        title: campaignTitle.trim() || `Rascunho ${new Date().toLocaleString()}`,
        status: 'draft',
        total_recipients: mediaType === 'voice' ? recipients.filter(r => r.voiceUrl).length : recipients.length,
        sent_count: 0,
        session_id: selectedSessionId || null,
        message_template: message,
        media_type: mediaType,
        voice_ia_script: voiceSettings.script,
        voice_ia_voice_id: voiceSettings.voiceId,
        voice_ia_mention_names: voiceSettings.mentionNames,
      })
      .select()
      .single();
    if (error) throw error;

    const campaignId = (campaign as any).id;



    // Cria os destinatários no banco em lotes de 300
    const rows = recipients.map(r => ({
      campaign_id: campaignId,
      company_id: companyId,
      phone: r.phone,
      contact_name: r.name,
      status: 'pending',
      custom_fields: null,
    }));
    const byPhone: Record<string, string> = {};
    for (let i = 0; i < rows.length; i += 300) {
      const { data: inserted, error: jobsError } = await supabase
        .from('dispatch_jobs')
        .insert(rows.slice(i, i + 300))
        .select('id, phone');
      if (jobsError) throw jobsError;
      (inserted || []).forEach((j: any) => { byPhone[j.phone] = j.id; });
    }

    setRecipients(prev => prev.map(r => ({ ...r, jobId: byPhone[r.phone] || r.jobId })));
    setDraftCampaignId(campaignId);
    localStorage.setItem('disparos_draft_id', campaignId);
    return campaignId;
  };

  // Gera + salva o áudio de UM destinatário (persistente no storage)
  const generateVoiceFor = async (
    recipient: { id: string; phone: string; name?: string; jobId?: string },
    campaignId: string,
    companyId: string,
  ) => {
    const blob = await fetchTtsBlob(voiceSettings.script.replace(/@nome/g, recipient.name || 'amigo'));
    const path = `${companyId}/${campaignId}/${recipient.phone}.mp3`;
    const { error: upErr } = await supabase.storage
      .from('disparos-media')
      .upload(path, blob, { contentType: 'audio/mpeg', upsert: true });
    if (upErr) throw new Error(`Falha ao salvar áudio: ${upErr.message}`);
    const { data: pub } = supabase.storage.from('disparos-media').getPublicUrl(path);
    const voiceUrl = `${pub.publicUrl}?v=${Date.now()}`;

    if (recipient.jobId) {
      await supabase.from('dispatch_jobs').update({
        custom_fields: {
          media_url: voiceUrl,
          media_type: 'voice',
          voice_url: voiceUrl,
          script: voiceSettings.script.replace(/@nome/g, recipient.name || 'amigo'),
        },
      }).eq('id', recipient.jobId);
    }

    setRecipients(prev => prev.map(r =>
      r.id === recipient.id ? { ...r, voiceUrl, voiceApproved: false, voiceError: undefined } : r
    ));
  };

  const generateVoice = async (recipientId: string) => {
    const recipient = recipients.find(r => r.id === recipientId);
    if (!recipient) return;
    try {
      const campaignId = await ensureDraftCampaign();
      const { companyId } = await getCompanyId();
      const jobId = recipient.jobId || recipients.find(r => r.id === recipientId)?.jobId;
      await generateVoiceFor({ ...recipient, jobId }, campaignId, companyId);
      toast({ title: 'Voz gerada', description: 'Áudio salvo e disponível para revisão.' });
    } catch (err: any) {
      console.error('Erro ao gerar voz:', err);
      setRecipients(prev => prev.map(r => r.id === recipientId ? { ...r, voiceError: err.message } : r));
      toast({ title: 'Erro ao gerar voz', description: err.message, variant: 'destructive' });
    }
  };

  /**
   * Gera todos os áudios pendentes em LOTES de 200, com 3 em paralelo.
   * Cada áudio é salvo assim que fica pronto — falhas não perdem o que já foi gerado.
   */
  const generateAllVoices = async (onlyFailed = false) => {
    setIsGeneratingVoices(true);
    cancelVoiceRef.current = false;
    try {
      const campaignId = await ensureDraftCampaign();
      const { companyId } = await getCompanyId();

      // pega a lista mais recente (com jobIds)
      const snapshot = await new Promise<typeof recipients>(resolve => {
        setRecipients(prev => { resolve(prev); return prev; });
      });

      const queue = snapshot.filter(r => !r.voiceUrl && (!onlyFailed || r.voiceError || true));
      const totalBatches = Math.max(1, Math.ceil(queue.length / VOICE_BATCH_SIZE));
      let failures = 0;

      // Medição para estimativa de prazo da geração de áudios
      const CONCURRENCY = 3;
      const startedAt = Date.now();
      let processed = 0;
      const tick = () => {
        processed++;
        const elapsed = (Date.now() - startedAt) / 1000;
        const perItem = elapsed / processed;                 // já considera a concorrência
        const remaining = Math.max(0, queue.length - processed);
        setVoiceEta({ done: processed, total: queue.length, etaSec: remaining * perItem });
      };
      setVoiceEta({ done: 0, total: queue.length, etaSec: 0 });

      for (let b = 0; b < totalBatches; b++) {
        if (cancelVoiceRef.current) break;
        setVoiceBatch({ current: b + 1, total: totalBatches });
        const batch = queue.slice(b * VOICE_BATCH_SIZE, (b + 1) * VOICE_BATCH_SIZE);
        const pending = [...batch];
        const workers = Array.from({ length: CONCURRENCY }, async () => {
          while (pending.length && !cancelVoiceRef.current) {
            const r = pending.shift();
            if (!r) break;
            try {
              await generateVoiceFor(r, campaignId, companyId);
            } catch (err: any) {
              failures++;
              setRecipients(prev => prev.map(x => x.id === r.id ? { ...x, voiceError: err.message } : x));
            } finally {
              tick();
            }
          }
        });
        await Promise.all(workers);
      }

      toast({
        title: cancelVoiceRef.current ? 'Geração pausada' : 'Geração concluída',
        description: failures
          ? `${failures} áudio(s) falharam. Use "Regerar falhas" — os já gerados estão salvos.`
          : 'Todos os áudios foram gerados e salvos.',
        variant: failures ? 'destructive' : undefined,
      });
    } catch (err: any) {
      toast({ title: 'Erro', description: err.message, variant: 'destructive' });
    } finally {
      setVoiceBatch(null);
      setVoiceEta(null);
      setIsGeneratingVoices(false);
    }
  };

  const stopVoiceGeneration = () => { cancelVoiceRef.current = true; };

  // Retoma um rascunho salvo (recupera os áudios já gerados)
  const resumeDraft = async (campaignId: string) => {
    try {
      const { data: campaign } = await supabase
        .from('dispatch_campaigns' as any).select('*').eq('id', campaignId).maybeSingle();
      if (!campaign) { localStorage.removeItem('disparos_draft_id'); return; }
      const { data: jobs } = await supabase
        .from('dispatch_jobs').select('*').eq('campaign_id', campaignId);

      const c = campaign as any;
      setCampaignTitle(c.title || '');
      setSelectedSessionId(c.session_id || '');
      setMediaType(c.media_type || 'voice');
      setMessage(c.message_template || '');
      setVoiceSettings({
        script: c.voice_ia_script || '',
        mentionNames: c.voice_ia_mention_names ?? true,
        voiceId: c.voice_ia_voice_id || '21m00Tcm4TlvDq8ikWAM',
      });
      setRecipients((jobs || []).map((j: any) => ({
        id: j.id,
        jobId: j.id,
        phone: j.phone,
        name: j.contact_name || undefined,
        status: 'pending' as const,
        voiceUrl: j.custom_fields?.voice_url || undefined,
        voiceApproved: false,
      })));
      setDraftCampaignId(campaignId);
      setView('wizard');
      toast({
        title: 'Rascunho retomado',
        description: `${(jobs || []).filter((j: any) => j.custom_fields?.voice_url).length} áudios já gerados foram recuperados.`,
      });
    } catch (err: any) {
      toast({ title: 'Erro ao retomar rascunho', description: err.message, variant: 'destructive' });
    }
  };


  const toggleVoiceApproval = (recipientId: string, approved: boolean) => {
    setRecipients(prev => prev.map(r => 
      r.id === recipientId ? { ...r, voiceApproved: approved } : r
    ));
  };

  const approveAllVoices = () => {
    setRecipients(prev => prev.map(r => 
      r.voiceUrl ? { ...r, voiceApproved: true } : r
    ));
    toast({ title: "Sucesso", description: "Todos os áudios gerados foram aprovados." });
  };

  const resetWizard = () => {
    setCurrentStep(0);
    setDraftCampaignId(null);
    launchKeyRef.current = crypto.randomUUID();
    setVoiceBatch(null);
    setShowCloneForm(false);


    setCloneName('');
    setCloneFiles([]);
    setCampaignTitle('');
    setSelectedSessionId('');
    setRecipients([]);
    setNewPhone('');
    setNewName('');
    setMessage('');
    setMediaType('text');
    setMediaUrl('');
    setMediaCaption('');
    setFollowUpsEnabled(false);
    setFollowUps([]);
    setVoiceSettings({ script: '', mentionNames: true, voiceId: '21m00Tcm4TlvDq8ikWAM' });
    setDelaySeconds(5);
    setBatchSize(0);
    setAutoNextBatch(false);

    setAiEnabled(false);
    setSelectedAgentId('');
    setChatbotEnabled(false);
    setSelectedFlowId('');
    setProgress(0);
  };

  const startNewCampaign = () => {
    resetWizard();
    setView('wizard');
  };

  const startDisparo = async () => {
    // Trava contra cliques repetidos (evita campanhas duplicadas)
    if (sendingRef.current) {
      toast({ title: 'Aguarde', description: 'O disparo já está sendo criado...' });
      return;
    }
    if (!selectedSessionId) {
      setCurrentStep(0);
      toast({ title: 'Atenção', description: 'Selecione a conexão do WhatsApp.', variant: 'destructive' });
      return;
    }
    if (recipients.length === 0) {
      setCurrentStep(1);
      toast({ title: 'Atenção', description: 'Adicione ao menos um destinatário.', variant: 'destructive' });
      return;
    }


    // Todas as etapas são obrigatórias
    for (let i = 0; i < steps.length; i++) {
      const err = stepError(i);
      if (err) {
        setCurrentStep(i);
        toast({ title: `Etapa ${i + 1}: ${steps[i].title}`, description: err, variant: 'destructive' });
        return;
      }
    }

    if (aiEnabled && !selectedAgentId) {
      toast({ title: 'Atenção', description: 'Selecione o agente de IA que vai responder.', variant: 'destructive' });
      return;
    }
    if (chatbotEnabled && !selectedFlowId) {
      toast({ title: 'Atenção', description: 'Selecione o fluxo de chatbot que vai responder.', variant: 'destructive' });
      return;
    }
    
    // Voz IA: se alguns falharam, avisa mas permite continuar (só enviará quem tem áudio)
    if (mediaType === 'voice') {
      const hasAudio = recipients.filter(r => r.voiceUrl);
      if (hasAudio.length === 0) {
        toast({ title: "Atenção", description: "Nenhum áudio foi gerado com sucesso ainda.", variant: "destructive" });
        return;
      }
      
      const missing = recipients.length - hasAudio.length;
      if (missing > 0) {
        // Se o usuário clicar em Iniciar e faltarem áudios, pedimos uma confirmação visual via toast rápida
        // ou apenas prosseguimos se ele já revisou a etapa.
        toast({ 
          title: "Aviso de Envio Parcial", 
          description: `Apenas ${hasAudio.length} contatos com áudio gerado receberão o disparo. ${missing} contatos sem áudio serão ignorados.`,
        });
      }
    }
    
    sendingRef.current = true;
    // Garante que a base de contatos fique atualizada com os nomes finais
    persistContacts(recipients.map(r => ({ phone: r.phone, name: r.name })), 'import');

    setIsSending(true);

    
    try {
      // Get current user and company_id
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');

      const { data: cuData } = await supabase
        .from('company_users')
        .select('company_id')
        .eq('user_id', user.id)
        .maybeSingle();
      
      const companyId = (cuData as any)?.company_id || user.user_metadata?.company_id;
      if (!companyId) throw new Error('Empresa não encontrada para o usuário');

      const clientKey = launchKeyRef.current;
      const campaignPayload = {
        company_id: companyId,
        user_id: user.id,
        client_key: clientKey,

        title: campaignTitle.trim() || `Campanha ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}`,
        status: 'pending', 
        total_recipients: mediaType === 'voice' ? recipients.filter(r => r.voiceUrl).length : recipients.length,
        sent_count: 0,
        delay_seconds: delayMode === 'variable' ? SAFE_DELAY_VARIANTS[0] : delayMode === 'range' ? RANGE_DELAY[0] : delaySeconds,
        delay_mode: delayMode,
        delay_variants: delayMode === 'range' ? RANGE_DELAY : SAFE_DELAY_VARIANTS,
        batch_size: batchSize > 0 ? batchSize : null,
        batch_limit: null,
        auto_next_batch: batchSize > 0 ? autoNextBatch : false,

        reply_ai_enabled: replyAiEnabled,
        reply_ai_link: replyAiEnabled ? replyAiLink.trim() || null : null,
        reply_ai_offer: replyAiEnabled ? replyAiOffer.trim() || null : null,
        reply_ai_interested_message: replyAiEnabled ? replyAiInterestedMessage.trim() || null : null,
        reply_ai_not_interested_message: replyAiEnabled ? replyAiNotInterestedMessage.trim() || null : null,
        session_id: selectedSessionId,
        message_template: message,
        media_type: mediaType,
        media_url: mediaUrl,
        ai_enabled: aiEnabled,
        ai_agent_id: aiEnabled && selectedAgentId ? selectedAgentId : null,
        chatbot_enabled: chatbotEnabled,
        chatbot_flow_id: chatbotEnabled && selectedFlowId ? selectedFlowId : null,
        follow_ups: followUpsEnabled
          ? followUps.map(f => ({
              media_type: f.media_type,
              media_url: f.media_url.trim() || null,
              message: f.message,
            }))
          : [],
        voice_ia_script: mediaType === 'voice' ? voiceSettings.script : null,
        voice_ia_mention_names: mediaType === 'voice' ? voiceSettings.mentionNames : false,
        voice_ia_voice_id: mediaType === 'voice' ? voiceSettings.voiceId : null
      };

      // Voz IA: garante que exista o rascunho (áudios já vinculados aos contatos no banco),
      // assim uma queda de internet nunca obriga a regerar os áudios.
      let activeDraftId = draftCampaignId;
      if (mediaType === 'voice' && !activeDraftId) {
        activeDraftId = await ensureDraftCampaign();
      }

      // Se já existe um rascunho (áudios salvos + destinatários no banco), apenas ativa
      if (activeDraftId) {
        const { error: updErr } = await supabase
          .from('dispatch_campaigns' as any)
          .update(campaignPayload)
          .eq('id', activeDraftId);
        if (updErr) throw updErr;

        const { count } = await supabase
          .from('dispatch_jobs')
          .select('id', { count: 'exact', head: true })
          .eq('campaign_id', activeDraftId);
        if (!count) throw new Error('O rascunho não possui destinatários salvos.');

        supabase.functions.invoke('bulk-dispatch', { body: { campaign_id: activeDraftId, new_batch: true } })
          .catch(err => console.error('Erro ao invocar bulk-dispatch:', err));

        localStorage.removeItem('disparos_draft_id');
        setDraftCampaignId(null);
        toast({ title: 'Sucesso', description: 'Disparo iniciado em segundo plano.' });
        resetWizard();
        setView('list');
        fetchHistory();
        return;
      }

      // 1. Criar a campanha no banco — idempotente pela client_key.
      // Um clique repetido (ou retry após queda de rede) reaproveita a MESMA linha.
      const { data: campaign, error } = await supabase
        .from('dispatch_campaigns' as any)
        .upsert(campaignPayload, { onConflict: 'company_id,client_key' })
        .select()
        .single();

      if (error) throw error;
      const campaignId = (campaign as any).id;

      // Se essa campanha já tem destinatários criados (tentativa anterior concluiu),
      // não recria nada: apenas garante que o processador está rodando.
      const { count: existingJobs } = await supabase
        .from('dispatch_jobs')
        .select('id', { count: 'exact', head: true })
        .eq('campaign_id', campaignId);

      if (existingJobs && existingJobs > 0) {
        supabase.functions.invoke('bulk-dispatch', { body: { campaign_id: campaignId, new_batch: true } })
          .catch(err => console.error('Erro ao invocar bulk-dispatch:', err));
        toast({ title: 'Sucesso', description: 'Disparo iniciado em segundo plano.' });
        resetWizard();
        setView('list');
        fetchHistory();
        return;
      }




      try {
        // 2. Voz IA: os áudios já foram gerados e salvos no storage vinculados
        // ao telefone/contato (companyId/campanha/telefone.mp3). Aqui apenas
        // reaproveitamos a URL — nada é regerado nem re-enviado ao ElevenLabs.
        const audioUrls: Record<string, string> = {};
        let finalRecipients = [...recipients];

        if (mediaType === 'voice') {
          // Filtra apenas quem tem áudio gerado com sucesso
          const hasAudio = recipients.filter(r => r.voiceUrl);
          if (hasAudio.length === 0) {
            throw new Error(`Nenhum áudio gerado com sucesso. Use "Regerar falhas" antes de iniciar.`);
          }
          finalRecipients = hasAudio;
          finalRecipients.forEach(r => { audioUrls[r.id] = r.voiceUrl!; });
        }

        // 3. Criar os jobs individuais (em lotes para listas grandes)
        const jobs = finalRecipients.map(r => ({
          campaign_id: campaignId,
          company_id: companyId,
          phone: r.phone,
          contact_name: r.name,
          status: 'pending',
          custom_fields: mediaType === 'voice'
            ? { 
                media_url: audioUrls[r.id], 
                media_type: 'voice',
                voice_url: audioUrls[r.id],
                script: voiceSettings.script.replace(/@nome/g, r.name || 'amigo')
              }
            : null
        }));

        const CHUNK = 300;
        for (let i = 0; i < jobs.length; i += CHUNK) {
          const { error: jobsError } = await supabase.from('dispatch_jobs').insert(jobs.slice(i, i + CHUNK));
          if (jobsError) throw jobsError;
        }
      } catch (prepError: any) {
        // Não deixa campanha órfã "Pendente" sem destinatários
        await supabase.from('dispatch_jobs').delete().eq('campaign_id', campaignId);
        await supabase.from('dispatch_campaigns').delete().eq('id', campaignId);
        throw new Error(`Falha ao preparar o disparo: ${prepError.message}`);
      }

      // 4. Invocar o processador backend (bulk-dispatch)
      supabase.functions.invoke('bulk-dispatch', {
        body: { campaign_id: campaignId, new_batch: true }
      }).catch(err => console.error('Erro ao invocar bulk-dispatch:', err));


      toast({ title: 'Sucesso', description: 'Disparo iniciado em segundo plano.' });
      
      resetWizard();
      setView('list');
      fetchHistory();
    } catch (error: any) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    } finally {
      sendingRef.current = false;
      setIsSending(false);

    }
  };

  const handleCampaignAction = async (campaignId: string, action: 'start' | 'pause' | 'resume' | 'cancel') => {
    try {
      // Para iniciar/retomar, voltamos para "pending" e re-invocamos o processador
      const status =
        action === 'pause' ? 'paused' :
        action === 'cancel' ? 'cancelled' : 'pending';

      const { error } = await supabase
        .from('dispatch_campaigns' as any)
        .update({ status })
        .eq('id', campaignId);

      if (error) throw error;

      if (action === 'start' || action === 'resume') {
        // Reabilita jobs travados em "sending" e dispara o processamento
        await supabase.from('dispatch_jobs' as any)
          .update({ status: 'pending' })
          .eq('campaign_id', campaignId)
          .eq('status', 'sending');

        // new_batch: libera a próxima etapa (lote) quando o envio é por partes
        supabase.functions.invoke('bulk-dispatch', {
          body: { campaign_id: campaignId, new_batch: true }
        }).catch(err => console.error('Erro ao invocar bulk-dispatch:', err));

      }

      toast({ 
        title: 'Sucesso', 
        description: `Campanha ${action === 'pause' ? 'pausada' : action === 'cancel' ? 'cancelada' : action === 'resume' ? 'retomada' : 'iniciada'} com sucesso.` 
      });
      fetchHistory();
    } catch (error: any) {
      toast({ 
        title: 'Erro ao processar ação', 
        description: error.message || 'Ocorreu um erro inesperado.', 
        variant: 'destructive' 
      });
    }
  };

  /**
   * Reenvia SOMENTE os números que falharam (ex.: sessão do WhatsApp caiu no meio do disparo).
   * Religa a campanha na conexão que estiver ativa agora e recoloca os jobs com erro na fila.
   */
  const retryFailedJobs = async (campaignId: string) => {
    try {
      setRetryingCampaignId(campaignId);

      const { data: failedJobs, error: jobsErr } = await supabase
        .from('dispatch_jobs')
        .select('id')
        .eq('campaign_id', campaignId)
        .in('status', ['error', 'failed']);
      if (jobsErr) throw jobsErr;

      if (!failedJobs || failedJobs.length === 0) {
        toast({ title: 'Nada para reenviar', description: 'Esta campanha não possui envios com erro.' });
        return;
      }

      // Garante que a campanha vai usar uma conexão realmente conectada
      const { data: campaign } = await supabase
        .from('dispatch_campaigns' as any)
        .select('session_id')
        .eq('id', campaignId)
        .maybeSingle();

      const currentSession = sessions.find((s: any) => s.id === (campaign as any)?.session_id);
      const activeSession =
        currentSession && currentSession.status === 'connected'
          ? currentSession
          : sessions.find((s: any) => s.id === selectedSessionId && s.status === 'connected') ||
            sessions.find((s: any) => s.status === 'connected');

      if (!activeSession) {
        toast({
          title: 'Nenhum WhatsApp conectado',
          description: 'Reconecte o WhatsApp em CRM-Ello e tente novamente.',
          variant: 'destructive',
        });
        return;
      }

      await supabase
        .from('dispatch_jobs')
        .update({ status: 'pending', error_message: null })
        .eq('campaign_id', campaignId)
        .in('status', ['error', 'failed', 'sending']);

      await supabase
        .from('dispatch_campaigns' as any)
        .update({ status: 'pending', session_id: activeSession.id })
        .eq('id', campaignId);

      supabase.functions
        .invoke('bulk-dispatch', { body: { campaign_id: campaignId, new_batch: true } })
        .catch(err => console.error('Erro ao invocar bulk-dispatch:', err));

      toast({
        title: 'Reenvio iniciado',
        description: `${failedJobs.length} número(s) que falharam voltaram para a fila usando a conexão "${activeSession.instance_name || activeSession.phone_number || 'ativa'}".`,
      });

      await fetchHistory();
      if (view === 'details') fetchCampaignLogs(campaignId);
    } catch (error: any) {
      toast({ title: 'Erro ao reenviar falhas', description: error.message, variant: 'destructive' });
    } finally {
      setRetryingCampaignId(null);
    }
  };




  const fetchContacts = async () => {
    if (!selectedSessionId) return;
    const { data } = await supabase
      .from('whatsapp_conversations' as any)
      .select('*')
      .eq('session_id', selectedSessionId)
      .eq('status', 'open');
    setContacts(data || []);
  };

  const importFromSession = async () => {
    if (!selectedSessionId) {
      toast({ title: 'Atenção', description: 'Selecione uma conexão primeiro.', variant: 'destructive' });
      setCurrentStep(0);
      return;
    }
    await fetchContacts();
    setIsImportingFromSession(true);
  };

  // Higieniza nomes vindos de listas: remove ruídos e, opcionalmente, mantém só o primeiro nome
  const sanitizeName = (raw?: string | null, firstOnly = firstNameOnly) => {
    if (!raw) return undefined;
    let name = String(raw).replace(/[_\-.]+/g, ' ').replace(/\s+/g, ' ').trim();
    // descarta nomes que são só números (ex.: telefone repetido na coluna)
    if (!name || /^\+?\d[\d\s()]*$/.test(name)) return undefined;
    if (firstOnly) {
      const particles = ['de', 'da', 'do', 'das', 'dos', 'e', 'di', 'del'];
      const parts = name.split(' ').filter(p => p && !particles.includes(p.toLowerCase()));
      name = parts[0] || name;
    }
    return name
      .split(' ')
      .map(w => (w.length > 2 ? w.charAt(0).toUpperCase() + w.slice(1).toLowerCase() : w.toLowerCase()))
      .join(' ')
      .trim();
  };

  const addContactsFromSession = (selectedContacts: any[]) => {
    const newRecipients = selectedContacts.map(c => ({
      id: crypto.randomUUID(),
      phone: c.contact_phone,
      name: sanitizeName(c.contact_name),
      status: 'pending' as const
    }));
    
    const currentPhones = new Set(recipients.map(r => r.phone));
    const uniqueNew = newRecipients.filter(r => !currentPhones.has(r.phone));
    
    setRecipients([...recipients, ...uniqueNew]);
    persistContacts(uniqueNew.map(r => ({ phone: r.phone, name: r.name })), 'whatsapp');

    setIsImportingFromSession(false);
    toast({ title: 'Sucesso', description: `${uniqueNew.length} contatos importados.` });
  };

  const normalizePhoneBR = (raw: string) => {
    let n = (raw || '').replace(/\D/g, '');
    if (!n) return '';
    // remove prefixo internacional "00"
    if (n.startsWith('00')) n = n.slice(2);
    if (n.startsWith('55') && (n.length === 12 || n.length === 13)) return n; // já normalizado
    if (n.length === 11 || n.length === 10) return '55' + n; // DDD + número
    if (n.startsWith('55') && n.length === 10) return n; // fixo antigo com DDI
    if (n.length >= 12) return n; // internacional
    return '';
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    toast({ title: 'Importando', description: 'A IA está processando e higienizando sua lista...' });

    const reader = new FileReader();
    reader.onerror = () => toast({ title: 'Erro', description: 'Não foi possível ler o arquivo.', variant: 'destructive' });
    reader.onload = (event) => {
      try {
        let text = (event.target?.result as string) || '';
        text = text.replace(/^\uFEFF/, '');
        const lines = text.split(/\r?\n/).filter(l => l.trim());
        if (!lines.length) {
          toast({ title: 'Arquivo vazio', description: 'Nenhuma linha encontrada.', variant: 'destructive' });
          return;
        }

        // detecta separador
        const sample = lines[0];
        const delim = [';', ',', '\t', '|'].sort(
          (a, b) => (sample.split(b).length - sample.split(a).length)
        )[0];

        const rows = lines.map(l => l.split(delim).map(c => c.replace(/^"|"$/g, '').trim()));

        // detecta se a primeira linha é cabeçalho (sem telefone válido)
        const firstHasPhone = rows[0].some(c => normalizePhoneBR(c).length >= 12);
        const header = firstHasPhone ? null : rows[0];
        const dataRows = firstHasPhone ? rows : rows.slice(1);

        // detecta coluna de telefone (a que mais gera números válidos)
        const colCount = Math.max(...dataRows.map(r => r.length));
        let phoneCol = 0, bestScore = -1;
        for (let c = 0; c < colCount; c++) {
          const score = dataRows.reduce((acc, r) => acc + (normalizePhoneBR(r[c] || '') ? 1 : 0), 0);
          if (score > bestScore) { bestScore = score; phoneCol = c; }
        }

        if (bestScore <= 0) {
          toast({ title: 'Nenhum telefone encontrado', description: 'Verifique se o arquivo tem uma coluna com números.', variant: 'destructive' });
          return;
        }

        // detecta coluna de nome (mais letras, ignorando a de telefone)
        let nameCol = -1, nameScore = 0;
        for (let c = 0; c < colCount; c++) {
          if (c === phoneCol) continue;
          const headerName = (header?.[c] || '').toLowerCase();
          let score = dataRows.reduce((acc, r) => acc + ((r[c] || '').replace(/[^A-Za-zÀ-ÿ]/g, '').length >= 2 ? 1 : 0), 0);
          if (/nome|name|cliente|contato/.test(headerName)) score += dataRows.length;
          if (score > nameScore) { nameScore = score; nameCol = c; }
        }

        const imported = dataRows.map(parts => {
          const phone = normalizePhoneBR(parts[phoneCol] || '');
          const rawName = nameCol >= 0 ? (parts[nameCol] || '') : '';
          return {
            id: crypto.randomUUID(),
            phone,
            name: sanitizeName(rawName),
            status: 'pending' as const
          };
        }).filter(r => r.phone.length >= 12);

        if (!imported.length) {
          toast({ title: 'Nada importado', description: 'Nenhum número válido foi reconhecido.', variant: 'destructive' });
          return;
        }

        const seen = new Set(recipients.map(r => r.phone));
        const uniqueNew = imported.filter(r => {
          if (seen.has(r.phone)) return false;
          seen.add(r.phone);
          return true;
        });

        setRecipients(prev => [...prev, ...uniqueNew]);
        toast({ title: 'Lista Importada', description: `${uniqueNew.length} contatos adicionados (de ${dataRows.length} linhas).` });
        persistContacts(uniqueNew.map(r => ({ phone: r.phone, name: r.name })), 'import');
      } catch (err: any) {
        toast({ title: 'Erro ao importar', description: err?.message || 'Falha ao processar o arquivo.', variant: 'destructive' });
      } finally {
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    reader.readAsText(file, 'UTF-8');
  };


  const selectedSession = sessions.find(s => s.id === selectedSessionId);

  const fetchCampaignLogs = async (campaignId: string) => {
    const { data, error } = await supabase
      .from('dispatch_jobs')
      .select('*')
      .eq('campaign_id', campaignId)
      .order('created_at', { ascending: false });

    if (!error && data) {
      setCampaignLogs(data.map(job => ({
        id: job.id,
        timestamp: job.updated_at || job.created_at,
        status: job.status === 'sent' ? 'success' : ['error', 'failed'].includes(job.status) ? 'error' : 'pending',
        phone: job.phone,
        details: job.error_message || (job.status === 'sent' ? 'Mensagem enviada' : 'Aguardando envio')
      })));
    }
  };

  // Mantém status da campanha e logs atualizados enquanto o disparo roda
  useEffect(() => {
    const shouldPoll =
      (view === 'details' && selectedCampaign) ||
      (view === 'list' && campaignHistory.some(c => ['pending', 'processing', 'running'].includes(c.status)));
    if (!shouldPoll) return;

    const interval = setInterval(async () => {
      if (view === 'details' && selectedCampaign) {
        const { data } = await supabase
          .from('dispatch_campaigns' as any)
          .select('*')
          .eq('id', selectedCampaign.id)
          .maybeSingle();
        if (data) setSelectedCampaign(data);
        fetchCampaignLogs(selectedCampaign.id);
      }
      fetchHistory();
    }, 4000);

    return () => clearInterval(interval);
  }, [view, selectedCampaign?.id, campaignHistory]);

  const selectedFailedCount = selectedCampaign
    ? Math.max(
        campaignLogs.filter(l => l.status === 'error' || l.status === 'failed').length,
        Number((selectedCampaign as any).error_count || 0),
        Math.max(0, Number(selectedCampaign.total_recipients || 0) - Number(selectedCampaign.sent_count || 0))
      )
    : 0;


  return (
    <>
      <div className="min-h-full bg-[#faf9f7] dark:bg-background p-4 sm:p-6 pb-[13rem] md:pb-32 lg:pb-6 overscroll-contain">
        <div className="max-w-7xl mx-auto space-y-6">
          <div className="flex items-center justify-between gap-3">
            <h1 className="text-xl sm:text-2xl font-bold text-primary">Disparos</h1>
            <Button onClick={startNewCampaign} className="bg-primary text-white rounded-full shrink-0">
              <Plus className="h-4 w-4 mr-2" /> Novo Disparo
            </Button>
          </div>

          {view === 'details' && selectedCampaign ? (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-5xl mx-auto">
              <div className="flex flex-wrap items-center justify-between gap-3 mb-6 sm:mb-8">
                <Button variant="ghost" onClick={() => setView('list')} className="rounded-full hover:bg-white/50 dark:hover:bg-white/5">
                  <ChevronLeft className="h-4 w-4 mr-2" /> Voltar
                </Button>
                
                <div className="flex items-center gap-3">
                  <Badge variant="secondary" className={`text-[10px] font-bold px-3 py-1 rounded-full ${
                    selectedCampaign.status === 'completed' ? 'bg-green-50 dark:bg-green-500/15 text-green-600 dark:text-green-400' : 
                    selectedCampaign.status === 'completed_with_errors' ? 'bg-orange-50 dark:bg-orange-500/15 text-orange-600 dark:text-orange-400' :
                    selectedCampaign.status === 'failed' ? 'bg-red-50 dark:bg-red-500/15 text-red-600 dark:text-red-400' :
                    (selectedCampaign.status === 'running' || selectedCampaign.status === 'processing') ? 'bg-blue-50 dark:bg-blue-500/15 text-blue-600 dark:text-blue-300 animate-pulse' :
                    'bg-gray-50 dark:bg-white/5 text-gray-500 dark:text-muted-foreground'
                  }`}>
                    {selectedCampaign.status === 'completed' ? 'Concluído' : 
                     selectedCampaign.status === 'completed_with_errors' ? 'Concluído com Falhas' :
                     selectedCampaign.status === 'failed' ? 'Falhou' :
                     (selectedCampaign.status === 'running' || selectedCampaign.status === 'processing') ? 'Executando' : 
                     selectedCampaign.status === 'paused' ? 'Pausado' : 'Pendente'}
                  </Badge>
                  
                  {selectedCampaign.status === 'running' && (
                    <Button size="sm" variant="outline" className="rounded-full h-8 px-4 border-gray-200 dark:border-white/15" onClick={() => handleCampaignAction(selectedCampaign.id, 'pause')}>
                      <Pause className="h-3.5 w-3.5 mr-2" /> Pausar
                    </Button>
                  )}
                  {selectedCampaign.status === 'paused' && (
                    <Button size="sm" variant="outline" className="rounded-full h-8 px-4 border-gray-200 dark:border-white/15" onClick={() => handleCampaignAction(selectedCampaign.id, 'resume')}>
                      <Play className="h-3.5 w-3.5 mr-2" /> Retomar
                    </Button>
                  )}
                  {selectedFailedCount > 0 && (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={retryingCampaignId === selectedCampaign.id}
                      className="rounded-full h-8 px-4 border-orange-200 text-orange-600 dark:text-orange-400 hover:bg-orange-50"
                      onClick={() => retryFailedJobs(selectedCampaign.id)}
                    >
                      {retryingCampaignId === selectedCampaign.id
                        ? <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />
                        : <RefreshCw className="h-3.5 w-3.5 mr-2" />}
                      Reenviar falhas ({selectedFailedCount})
                    </Button>
                  )}


                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-8">
                {[
                  { label: 'Total', value: selectedCampaign.total_recipients, icon: Users },
                  { label: 'Enviados', value: selectedCampaign.sent_count, icon: Send },
                  { label: 'Falhas', value: selectedFailedCount, icon: AlertCircle },
                  { label: 'Intervalo', value: `${selectedCampaign.delay_seconds}s`, icon: History },
                  {
                    label: 'Previsão de término',
                    value: ['completed', 'completed_with_errors', 'cancelled', 'failed'].includes(selectedCampaign.status)
                      ? 'Finalizado'
                      : `~${formatEta(
                          Math.max(0, (selectedCampaign.total_recipients || 0) - (selectedCampaign.sent_count || 0)) *
                            ((selectedCampaign.delay_mode === 'variable'
                              ? SAFE_DELAY_VARIANTS.reduce((a, b) => a + b, 0) / SAFE_DELAY_VARIANTS.length
                              : selectedCampaign.delay_mode === 'range'
                                ? ((Number(selectedCampaign.delay_variants?.[0]) || RANGE_DELAY[0]) + (Number(selectedCampaign.delay_variants?.[1]) || RANGE_DELAY[1])) / 2
                                : selectedCampaign.delay_seconds) || 30)
                        )}`,
                    icon: History
                  }
                ].map((stat, i) => (
                  <div key={i} className="bg-white/50 dark:bg-white/5 backdrop-blur-sm p-5 rounded-2xl border border-white dark:border-white/10 shadow-sm">
                    <p className="text-[10px] font-bold text-gray-400 dark:text-foreground/50 uppercase tracking-widest mb-1">{stat.label}</p>
                    <div className="flex items-baseline gap-2">
                      <p className="text-xl font-bold text-gray-900 dark:text-foreground">{stat.value}</p>
                    </div>
                  </div>
                ))}
              </div>

              {selectedFailedCount > 0 && (
                <div className="md:hidden mb-8 rounded-2xl border border-orange-200 bg-orange-50 dark:bg-orange-500/15 p-4 shadow-sm">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white dark:bg-card text-orange-600 dark:text-orange-400">
                      <RefreshCw className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-orange-700 dark:text-orange-400">{selectedFailedCount} envio(s) com erro</p>
                      <p className="mt-1 text-xs font-medium text-orange-700/80">
                        Depois de reconectar o WhatsApp, retome somente os contatos que falharam.
                      </p>
                      <Button
                        variant="outline"
                        disabled={retryingCampaignId === selectedCampaign.id}
                        className="mt-3 h-10 w-full rounded-full border-orange-300 dark:border-orange-500/30 bg-white dark:bg-card text-orange-700 dark:text-orange-400 hover:bg-orange-100 dark:hover:bg-orange-500/15"
                        onClick={() => retryFailedJobs(selectedCampaign.id)}
                      >
                        {retryingCampaignId === selectedCampaign.id
                          ? <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          : <RefreshCw className="h-4 w-4 mr-2" />}
                        Retomar envios com erro
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              <div className="space-y-12">
                <section>
                  <h3 className="text-[10px] font-black text-gray-400 dark:text-foreground/50 uppercase tracking-widest mb-4 px-1">
                    {selectedCampaign.media_type === 'voice' ? 'Roteiro da voz' : 'Mensagem'}
                  </h3>
                  <div className="bg-white dark:bg-card rounded-3xl p-5 sm:p-8 border border-white dark:border-white/10 shadow-sm space-y-4">
                    {selectedCampaign.media_type === 'voice' && (
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="inline-flex items-center gap-1.5 text-[10px] font-bold text-primary bg-primary/10 px-3 py-1 rounded-full">
                          <Mic className="h-3 w-3" /> Voz IA
                        </span>
                        <span className="text-[10px] font-medium text-gray-500 dark:text-muted-foreground bg-gray-50 dark:bg-white/5 px-3 py-1 rounded-full">
                          {VOICE_LABELS[selectedCampaign.voice_ia_voice_id] || selectedCampaign.voice_ia_voice_id || 'Voz padrão'}
                        </span>
                        {selectedCampaign.voice_ia_mention_names && (
                          <span className="text-[10px] font-medium text-amber-600 bg-amber-50 px-3 py-1 rounded-full">
                            Fala o nome do contato
                          </span>
                        )}
                      </div>
                    )}
                    <p className="text-gray-600 dark:text-foreground/70 leading-relaxed whitespace-pre-wrap font-medium">
                      {selectedCampaign.media_type === 'voice'
                        ? (selectedCampaign.voice_ia_script || 'Sem roteiro.')
                        : (selectedCampaign.message_template || selectedCampaign.message || 'Sem conteúdo.')}
                    </p>
                  </div>
                </section>

                <section>
                  <h3 className="text-[10px] font-black text-gray-400 dark:text-foreground/50 uppercase tracking-widest mb-4 px-1">Linha do tempo</h3>
                  <div className="space-y-0 relative before:absolute before:left-[17px] before:top-2 before:bottom-2 before:w-[1px] before:bg-gray-100 dark:before:bg-white/10">
                    {campaignLogs.length > 0 ? (() => {
                      const delay = Number(selectedCampaign.delay_seconds) || 0;
                      const sentTimes = campaignLogs
                        .filter(l => l.status === 'success')
                        .map(l => new Date(l.timestamp).getTime())
                        .filter(t => !Number.isNaN(t));
                      const lastSent = sentTimes.length ? Math.max(...sentTimes) : null;
                      const pendingOrder = campaignLogs
                        .filter(l => l.status === 'pending')
                        .slice()
                        .reverse()
                        .map(l => l.id);

                      return campaignLogs.map((log) => {
                        const isPending = log.status === 'pending';
                        const rank = isPending ? pendingOrder.indexOf(log.id) : -1;
                        const base = lastSent ?? new Date(log.timestamp).getTime();
                        const eta = isPending && delay > 0 ? base + delay * 1000 * (rank + 1) : null;
                        const remaining = eta ? Math.max(0, Math.ceil((eta - nowTick) / 1000)) : null;
                        const progress = eta && delay > 0 && remaining !== null
                          ? Math.min(100, Math.max(0, 100 - (remaining / delay) * 100))
                          : 0;

                        return (
                        <div key={log.id} className="relative pl-12 pb-6 group">
                          <div className={`absolute left-0 top-1 w-[35px] h-[35px] rounded-full border-4 border-[#faf9f7] dark:border-background flex items-center justify-center z-10 ${
                            log.status === 'success' ? 'bg-green-500' : isPending ? 'bg-amber-400' : 'bg-red-500'
                          }`}>
                            {log.status === 'success'
                              ? <Check className="h-3.5 w-3.5 text-white" />
                              : isPending
                                ? <Clock className="h-3.5 w-3.5 text-white animate-pulse" />
                                : <XCircle className="h-3.5 w-3.5 text-white" />}
                          </div>
                          <div className="flex items-center justify-between gap-3 group-hover:bg-white/40 dark:group-hover:bg-white/5 p-2 -m-2 rounded-xl transition-colors">
                            <div className="flex flex-col">
                              <span className="text-sm font-bold text-gray-900 dark:text-foreground">{log.phone}</span>
                              <span className={`text-[10px] italic mt-0.5 ${isPending ? 'text-amber-500' : 'text-gray-400 dark:text-foreground/50'}`}>{log.details}</span>
                            </div>
                            {isPending && remaining !== null ? (
                              <div className="flex items-center gap-2 shrink-0">
                                <svg className="h-6 w-6 -rotate-90" viewBox="0 0 36 36">
                                  <circle cx="18" cy="18" r="15" fill="none" stroke="#fef3c7" strokeWidth="4" />
                                  <circle
                                    cx="18" cy="18" r="15" fill="none" stroke="#f59e0b" strokeWidth="4"
                                    strokeLinecap="round"
                                    strokeDasharray={2 * Math.PI * 15}
                                    strokeDashoffset={(2 * Math.PI * 15) * (1 - progress / 100)}
                                    style={{ transition: 'stroke-dashoffset 1s linear' }}
                                  />
                                </svg>
                                <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-1 rounded-md tabular-nums">
                                  {remaining > 0 ? `em ${remaining}s` : 'enviando...'}
                                </span>
                              </div>
                            ) : (
                              <span className="text-[10px] font-medium text-gray-400 dark:text-foreground/50 bg-gray-50 dark:bg-white/5 px-2 py-1 rounded-md shrink-0">
                                {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                              </span>
                            )}
                          </div>
                        </div>
                        );
                      });
                    })() : (
                      <div className="bg-white/30 dark:bg-white/5 rounded-3xl p-12 text-center border border-dashed border-gray-200 dark:border-white/15">
                        <p className="text-sm text-gray-400 dark:text-foreground/50 italic">Aguardando início dos envios...</p>
                      </div>
                    )}
                  </div>
                </section>
              </div>
            </div>
          ) : view === 'list' ? (
            <>
            {/* Lista mobile (cards) */}
            <div className="md:hidden space-y-3">
              {campaignHistory.length > 0 ? campaignHistory.map((c) => {
                const failed = Math.max(
                  Number((c as any).error_count || 0),
                  Math.max(0, Number(c.total_recipients || 0) - Number(c.sent_count || 0))
                );
                return (
                  <Card
                    key={c.id}
                    className="rounded-2xl border-none shadow-sm p-4"
                    onClick={() => { setSelectedCampaign(c); fetchCampaignLogs(c.id); setView('details'); }}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-medium text-gray-900 dark:text-foreground truncate">{c.title}</p>
                        <p className="text-[10px] text-gray-400 dark:text-foreground/50">{new Date(c.created_at).toLocaleString()}</p>
                      </div>
                      <Badge variant="secondary" className={`text-[10px] shrink-0 ${
                        c.status === 'running' || c.status === 'processing' ? 'bg-blue-50 dark:bg-blue-500/15 text-blue-600 dark:text-blue-300' :
                        c.status === 'paused' ? 'bg-yellow-50 text-yellow-600' :
                        c.status === 'completed' ? 'bg-green-50 dark:bg-green-500/15 text-green-600 dark:text-green-400' :
                        failed > 0 ? 'bg-orange-50 dark:bg-orange-500/15 text-orange-600 dark:text-orange-400' : 'bg-gray-50 dark:bg-white/5 text-gray-500 dark:text-muted-foreground'
                      }`}>
                        {c.status === 'running' || c.status === 'processing' ? 'Executando' :
                         c.status === 'paused' ? 'Pausado' :
                         c.status === 'completed' ? 'Concluído' :
                         c.status === 'draft' ? 'Rascunho' : 'Pendente'}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-3 mt-3 text-xs text-gray-500 dark:text-muted-foreground">
                      <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5" />{c.total_recipients}</span>
                      <span className="flex items-center gap-1 text-green-600 dark:text-green-400"><Send className="h-3.5 w-3.5" />{c.sent_count || 0}</span>
                      {failed > 0 && (
                        <span className="flex items-center gap-1 text-orange-600 dark:text-orange-400"><AlertCircle className="h-3.5 w-3.5" />{failed}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-3" onClick={(e) => e.stopPropagation()}>
                      {failed > 0 && (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={retryingCampaignId === c.id}
                          className="flex-1 rounded-full h-9 border-orange-200 text-orange-600 dark:text-orange-400 hover:bg-orange-50"
                          onClick={() => retryFailedJobs(c.id)}
                        >
                          {retryingCampaignId === c.id
                            ? <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            : <RefreshCw className="h-4 w-4 mr-2" />}
                          Reenviar falhas ({failed})
                        </Button>
                      )}
                      {(c.status === 'pending' || c.status === 'paused' || c.status === 'failed') && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="rounded-full h-9 border-gray-200 dark:border-white/15 text-green-600 dark:text-green-400"
                          onClick={() => handleCampaignAction(c.id, c.status === 'paused' ? 'resume' : 'start')}
                        >
                          <Play className="h-4 w-4 mr-2" /> {c.status === 'paused' ? 'Retomar' : 'Iniciar'}
                        </Button>
                      )}
                      {(c.status === 'running' || c.status === 'processing') && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="rounded-full h-9 border-gray-200 dark:border-white/15 text-yellow-600"
                          onClick={() => handleCampaignAction(c.id, 'pause')}
                        >
                          <Pause className="h-4 w-4 mr-2" /> Pausar
                        </Button>
                      )}
                    </div>
                  </Card>
                );
              }) : (
                <Card className="rounded-2xl border-none shadow-sm p-10 text-center text-sm text-gray-400 dark:text-foreground/50">
                  Nenhuma campanha ainda.
                </Card>
              )}
            </div>
            <Card className="hidden md:block rounded-2xl border-none shadow-sm overflow-x-auto">

              <Table className="min-w-[720px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>Campanha</TableHead>
                    <TableHead>Destinatários</TableHead>
                    <TableHead>Configuração</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Progresso</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {campaignHistory.length > 0 ? campaignHistory.map((c) => (
                    <TableRow key={c.id} className="cursor-pointer hover:bg-gray-50/50 dark:hover:bg-white/5 transition-colors" onClick={() => {
                      setSelectedCampaign(c);
                      fetchCampaignLogs(c.id);
                      setView('details');
                    }}>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium text-gray-900 dark:text-foreground">{c.title}</span>
                          <span className="text-[10px] text-gray-400 dark:text-foreground/50">{new Date(c.created_at).toLocaleString()}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <Users className="h-3.5 w-3.5 text-gray-400 dark:text-foreground/50" />
                          <span className="text-sm font-medium">{c.total_recipients}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-[10px] py-0 h-5 border-gray-100 dark:border-white/10 bg-gray-50/50 dark:bg-white/5">
                            {c.delay_seconds}s
                          </Badge>
                          {c.status === 'running' && (
                            <div className="relative w-4 h-4 flex items-center justify-center">
                              <svg className="w-4 h-4 transform -rotate-90">
                                <circle
                                  cx="8"
                                  cy="8"
                                  r="6"
                                  stroke="currentColor"
                                  strokeWidth="1.5"
                                  fill="transparent"
                                  className="text-gray-100 dark:text-white/10"
                                />
                                <circle
                                  cx="8"
                                  cy="8"
                                  r="6"
                                  stroke="currentColor"
                                  strokeWidth="1.5"
                                  fill="transparent"
                                  strokeDasharray={37.7}
                                  className="text-primary transition-all duration-1000 ease-linear"
                                  style={{
                                    animation: `countdown ${c.delay_seconds}s linear infinite`,
                                    strokeDashoffset: 37.7
                                  }}
                                />
                              </svg>
                              <style>{`
                                @keyframes countdown {
                                  from { stroke-dashoffset: 37.7; }
                                  to { stroke-dashoffset: 0; }
                                }
                              `}</style>
                            </div>
                          )}
                          {c.ai_enabled && (
                            <Badge variant="outline" className="text-[10px] py-0 h-5 border-blue-100 dark:border-blue-500/25 bg-blue-50/50 dark:bg-blue-500/15 text-primary">
                              IA
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className={`text-[10px] ${
                          c.status === 'running' ? 'bg-blue-50 dark:bg-blue-500/15 text-blue-600 dark:text-blue-300 animate-pulse' : 
                          c.status === 'paused' ? 'bg-yellow-50 text-yellow-600' :
                          c.status === 'completed' ? 'bg-green-50 dark:bg-green-500/15 text-green-600 dark:text-green-400' : 
                          c.status === 'completed_with_errors' ? 'bg-orange-50 dark:bg-orange-500/15 text-orange-600 dark:text-orange-400' :
                          c.status === 'failed' ? 'bg-red-50 dark:bg-red-500/15 text-red-600 dark:text-red-400' :
                          c.status === 'cancelled' ? 'bg-red-50 dark:bg-red-500/15 text-red-600 dark:text-red-400' : 
                          c.status === 'processing' ? 'bg-blue-50 dark:bg-blue-500/15 text-blue-600 dark:text-blue-300 animate-pulse' :
                          c.status === 'pending' ? 'bg-gray-50 dark:bg-white/5 text-gray-500 dark:text-muted-foreground' : 'bg-gray-50 dark:bg-white/5 text-gray-600 dark:text-foreground/70'
                        }`}>
                          {c.status === 'running' ? 'Executando' : 
                           c.status === 'processing' ? 'Executando' :
                           c.status === 'paused' ? 'Pausado' :
                           c.status === 'completed' ? 'Concluído' : 
                           c.status === 'completed_with_errors' ? 'Concluído com Falhas' :
                           c.status === 'failed' ? 'Falhou' :
                           c.status === 'cancelled' ? 'Cancelado' : 
                           c.status === 'draft' ? 'Rascunho' :
                           c.status === 'pending' ? 'Pendente' : c.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col items-start gap-1">
                          <span className="text-sm font-bold text-primary">{c.sent_count}/{c.total_recipients}</span>
                          <Progress value={(c.sent_count / c.total_recipients) * 100} className="h-1 w-20" />
                          {['running', 'processing', 'pending', 'paused'].includes(c.status) && c.total_recipients > c.sent_count && (
                            <span className="text-[10px] text-gray-500 dark:text-muted-foreground">
                              ~{formatEta(
                                (c.total_recipients - c.sent_count) *
                                  ((c.delay_mode === 'variable'
                                    ? SAFE_DELAY_VARIANTS.reduce((a, b) => a + b, 0) / SAFE_DELAY_VARIANTS.length
                                    : c.delay_mode === 'range'
                                      ? ((Number(c.delay_variants?.[0]) || RANGE_DELAY[0]) + (Number(c.delay_variants?.[1]) || RANGE_DELAY[1])) / 2
                                      : c.delay_seconds) || 30)
                              )} restantes
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1">
                        {c.status === 'draft' && (
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Retomar rascunho (áudios já gerados)"
                            className="h-8 w-8 rounded-full text-primary hover:bg-blue-50 dark:hover:bg-blue-500/10"
                            onClick={() => resumeDraft(c.id)}
                          >
                            <RefreshCw className="h-4 w-4" />
                          </Button>
                        )}
                        {(c.status === 'pending' || c.status === 'paused' || c.status === 'failed') && (
                          <Button
                            variant="ghost"
                            size="icon"
                            title={c.status === 'paused' ? 'Retomar' : 'Iniciar'}
                            className="h-8 w-8 rounded-full text-green-600 dark:text-green-400 hover:bg-green-50"
                            onClick={() => handleCampaignAction(c.id, c.status === 'paused' ? 'resume' : 'start')}
                          >
                            <Play className="h-4 w-4" />
                          </Button>
                        )}

                        {(c.status === 'running' || c.status === 'processing') && (
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Pausar"
                            className="h-8 w-8 rounded-full text-yellow-600 hover:bg-yellow-50"
                            onClick={() => handleCampaignAction(c.id, 'pause')}
                          >
                            <Pause className="h-4 w-4" />
                          </Button>
                        )}
                        {(c.status === 'running' || c.status === 'processing' || c.status === 'paused' || c.status === 'pending') && (
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Cancelar"
                            className="h-8 w-8 rounded-full text-red-600 dark:text-red-400 hover:bg-red-50"
                            onClick={() => handleCampaignAction(c.id, 'cancel')}
                          >
                            <XCircle className="h-4 w-4" />
                          </Button>
                        )}
                        {Number((c as any).error_count || 0) > 0 && (
                          <Button
                            variant="ghost"
                            size="icon"
                            title={`Reenviar ${(c as any).error_count} falha(s)`}
                            disabled={retryingCampaignId === c.id}
                            className="h-8 w-8 rounded-full text-orange-600 dark:text-orange-400 hover:bg-orange-50"
                            onClick={() => retryFailedJobs(c.id)}
                          >
                            {retryingCampaignId === c.id
                              ? <Loader2 className="h-4 w-4 animate-spin" />
                              : <RefreshCw className="h-4 w-4" />}
                          </Button>
                        )}

                        <DropdownMenu>

                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="rounded-xl border-none shadow-lg">
                            <DropdownMenuItem
                              onClick={(e) => { e.stopPropagation(); retryFailedJobs(c.id); }}
                              className="flex items-center gap-2 text-orange-600 dark:text-orange-400 cursor-pointer"
                            >
                              <RefreshCw className="h-4 w-4" /> Reenviar falhas
                            </DropdownMenuItem>

                            {c.status === 'running' && (
                              <DropdownMenuItem onClick={() => handleCampaignAction(c.id, 'pause')} className="flex items-center gap-2 text-yellow-600 cursor-pointer">
                                <Pause className="h-4 w-4" /> Pausar
                              </DropdownMenuItem>
                            )}
                            {c.status === 'paused' && (
                              <DropdownMenuItem onClick={() => handleCampaignAction(c.id, 'resume')} className="flex items-center gap-2 text-green-600 dark:text-green-400 cursor-pointer">
                                <Play className="h-4 w-4" /> Retomar
                              </DropdownMenuItem>
                            )}
                            {(c.status === 'running' || c.status === 'paused') && (
                              <DropdownMenuItem onClick={() => handleCampaignAction(c.id, 'cancel')} className="flex items-center gap-2 text-red-600 dark:text-red-400 cursor-pointer">
                                <XCircle className="h-4 w-4" /> Cancelar
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem onClick={async (e) => {
                              e.stopPropagation();
                              if (confirm('Tem certeza que deseja excluir esta campanha e todos os seus registros de envio?')) {
                                try {
                                  // Deletar jobs primeiro (dependência)
                                  await supabase.from('dispatch_jobs').delete().eq('campaign_id', c.id);
                                  // Deletar a campanha
                                  const { error } = await supabase.from('dispatch_campaigns').delete().eq('id', c.id);
                                  
                                  if (error) throw error;
                                  
                                  toast({
                                    title: "Campanha excluída",
                                    description: "A campanha foi removida com sucesso.",
                                  });
                                   await fetchHistory();
                                   setView('list');
                                } catch (err: any) {
                                  toast({
                                    title: "Erro ao excluir",
                                    description: err.message,
                                    variant: "destructive",
                                  });
                                }
                              }
                            }} className="flex items-center gap-2 text-red-500 hover:text-red-600 cursor-pointer">
                              <Trash2 className="h-4 w-4" /> Excluir registro
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                        </div>

                      </TableCell>
                    </TableRow>
                  )) : (
                    <TableRow>
                      <TableCell colSpan={6} className="h-40 text-center text-gray-400 dark:text-foreground/50">
                        <div className="flex flex-col items-center justify-center gap-2">
                          <Database className="h-8 w-8 opacity-20" />
                          <p className="text-sm italic">Nenhuma campanha encontrada.</p>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </Card>
            </>
          ) : (
            <div className="space-y-6">
              <Button variant="ghost" onClick={() => setView('list')} className="rounded-full">
                <ChevronLeft className="h-4 w-4 mr-2" /> Voltar para a lista
              </Button>
              
              <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-6 lg:gap-8">
                <div className="space-y-6 lg:space-y-8">
                  <div className="flex items-center gap-2 sm:gap-3 overflow-x-auto no-scrollbar -mx-1 px-1 pb-1 lg:flex-wrap lg:overflow-visible">
                    {steps.map((s, idx) => {
                      const locked = idx > currentStep && idx > firstIncompleteStep();
                      const done = idx < currentStep && !stepError(idx);
                      return (
                        <button key={s.id} onClick={() => goToStep(idx)}
                          className={`flex shrink-0 items-center gap-2 px-3 sm:px-4 py-2 rounded-full text-xs sm:text-sm font-medium transition-all whitespace-nowrap ${idx === currentStep ? 'bg-primary text-white' : locked ? 'bg-white dark:bg-card text-gray-300 dark:text-white/35 border border-gray-100 dark:border-white/10' : 'bg-white dark:bg-card text-gray-500 dark:text-muted-foreground border border-gray-100 dark:border-white/10'}`}>
                          <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${idx === currentStep ? 'bg-white dark:bg-card text-primary' : done ? 'bg-green-100 dark:bg-green-500/20 text-green-600 dark:text-green-400' : 'bg-gray-100 dark:bg-white/10'}`}>
                            {done ? <Check className="h-3 w-3" /> : idx + 1}
                          </span>
                          {s.title}
                        </button>
                      );
                    })}
                  </div>

                  <div className="relative">
                    <AnimatePresence mode="wait">
                      <motion.div key={steps[currentStep].id} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                        <Card className="border-none shadow-[0_2px_8px_rgba(0,0,0,0.04)] rounded-2xl bg-white dark:bg-card p-4 sm:p-6">
                          {currentStep === 0 && (
                             <div className="space-y-4">
                               <div className="space-y-2">
                                 <span className="text-sm font-medium text-gray-700 dark:text-foreground/80">Título da campanha</span>
                                 <Input
                                   value={campaignTitle}
                                   onChange={(e) => setCampaignTitle(e.target.value)}
                                   placeholder="Ex: Promoção de Agosto"
                                   className="rounded-xl"
                                 />
                               </div>
                               <h3 className="text-lg font-semibold">Qual número vai disparar?</h3>
                               <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                                 {sessions.map(s => (
                                   <button key={s.id} onClick={() => setSelectedSessionId(s.id)}
                                     className={`p-4 rounded-xl border flex flex-col items-start gap-1 transition-all ${selectedSessionId === s.id ? 'border-primary bg-[#F0F2FE] dark:bg-primary/20' : 'border-gray-100 dark:border-white/10 bg-white dark:bg-card hover:border-gray-200 dark:hover:border-white/15'}`}>
                                     <span className="font-medium text-sm text-gray-900 dark:text-foreground">{s.phone_number || s.instance_name}</span>
                                     {s.phone_number && <span className="text-xs text-gray-500 dark:text-muted-foreground">{s.instance_name}</span>}
                                   </button>
                                 ))}
                               </div>
                             </div>
                          )}
                          {currentStep === 1 && (
                            <div className="space-y-4">
                              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                                <h3 className="text-lg font-semibold">Destinatários</h3>
                                <div className="flex gap-2 flex-wrap">
                                  <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} className="rounded-full h-8 text-xs">
                                    <Upload className="h-3 w-3 mr-1" /> Importar Lista
                                  </Button>
                                  <Button variant="outline" size="sm" onClick={importFromSession} className="rounded-full h-8 text-xs">
                                    <Users className="h-3 w-3 mr-1" /> Da Conexão
                                  </Button>
                                  <input type="file" ref={fileInputRef} className="hidden" accept=".csv,.txt" onChange={handleFileUpload} />
                                </div>
                              </div>
                              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 rounded-2xl border bg-white dark:bg-card px-4 py-3">
                                <div className="flex items-center gap-3">
                                  <Switch checked={firstNameOnly} onCheckedChange={setFirstNameOnly} />
                                  <div className="flex flex-col">
                                    <span className="text-sm font-medium">Usar apenas o primeiro nome</span>
                                    <span className="text-[10px] text-gray-400 dark:text-foreground/50">Ex.: "MARIA DA SILVA SOUZA" vira "Maria" ao importar a lista.</span>
                                  </div>
                                </div>
                                {recipients.length > 0 && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="rounded-full h-8 text-xs"
                                    onClick={() => {
                                      setRecipients(prev => prev.map(r => ({ ...r, name: sanitizeName(r.name, firstNameOnly) })));
                                      toast({ title: 'Nomes higienizados', description: firstNameOnly ? 'Somente o primeiro nome foi mantido.' : 'Nomes formatados.' });
                                    }}
                                  >
                                    <Sparkles className="h-3 w-3 mr-1" /> Aplicar na lista atual
                                  </Button>
                                )}
                              </div>
                              <div className="flex flex-col gap-2">
                                <div className="flex flex-col sm:flex-row gap-2">
                                  <Input className="sm:flex-[2]" placeholder="Número (ex: 41996875461)" value={newPhone} onChange={e => setNewPhone(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addRecipient()} />
                                  <Input className="sm:flex-1" placeholder="Nome do Cliente (opcional)" value={newName} onChange={e => setNewName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addRecipient()} />
                                  <Button onClick={() => addRecipient()} className="bg-primary text-white w-full sm:w-auto"><Plus className="h-4 w-4" /></Button>
                                </div>
                                <p className="text-[10px] text-gray-400 dark:text-foreground/50 px-1 italic">Dica: Você também pode colar uma lista de números diretamente no campo de telefone.</p>
                              </div>
                              <div className="border rounded-2xl overflow-hidden bg-gray-50/50 dark:bg-white/5">
                                <div className="bg-white dark:bg-card px-4 py-2 border-b flex justify-between items-center">
                                  <span className="text-xs font-medium text-gray-500 dark:text-muted-foreground">{recipients.length} contatos na lista</span>
                                  {recipients.length > 0 && (
                                    <button onClick={() => setRecipients([])} className="text-xs text-red-500 hover:underline">Limpar tudo</button>
                                  )}
                                </div>
                                <ScrollArea className="h-48">
                                  <div className="p-2 space-y-1">
                                    {recipients.map(r => (
                                      <div key={r.id} className="flex items-center justify-between p-2 bg-white dark:bg-card rounded-xl border border-transparent hover:border-gray-100 dark:hover:border-white/10 group transition-all">
                                        <div className="flex flex-col">
                                          <span className="text-sm font-medium">{r.phone}</span>
                                          <div className="flex items-center gap-2">
                                            {r.name && <span className="text-[10px] text-gray-400 dark:text-foreground/50">{r.name}</span>}
                                            {(r.dispatchCount ?? 0) > 0 ? (
                                              <span
                                                className="text-[9px] px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-700"
                                                title={r.lastDispatchAt ? `Último disparo: ${new Date(r.lastDispatchAt).toLocaleString()}` : undefined}
                                              >
                                                Já recebeu ({r.dispatchCount}x)
                                              </span>
                                            ) : r.dispatchCount === 0 ? (
                                              <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-green-50 dark:bg-green-500/15 text-green-700">Novo contato</span>
                                            ) : null}
                                          </div>
                                        </div>

                                        <button onClick={() => removeRecipient(r.id)} className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-50 rounded-lg text-red-500 transition-all">
                                          <Trash2 className="h-3.5 w-3.5" />
                                        </button>
                                      </div>
                                    ))}
                                    {recipients.length === 0 && (
                                      <div className="flex flex-col items-center justify-center py-8 text-gray-400 dark:text-foreground/50">
                                        <Database className="h-8 w-8 mb-2 opacity-20" />
                                        <p className="text-sm italic">Nenhum destinatário adicionado</p>
                                      </div>
                                    )}
                                  </div>
                                </ScrollArea>
                              </div>
                            </div>
                          )}
                          {currentStep === 2 && (
                            <div className="space-y-6">
                              <div className="space-y-4">
                                <h3 className="text-lg font-semibold">Mensagem e Mídia</h3>
                                
                                <div className="flex flex-wrap gap-2 mb-4 p-2 bg-gray-50 dark:bg-white/5 rounded-2xl border border-gray-100 dark:border-white/10">
                                  {[
                                    { id: 'text', label: 'Texto', icon: FileText },
                                    { id: 'image', label: 'Imagem', icon: Image },
                                    { id: 'video', label: 'Vídeo', icon: Video },
                                    { id: 'audio', label: 'Áudio', icon: Mic },
                                    { id: 'document', label: 'Doc', icon: FileText },
                                    { id: 'voice', label: 'Voz IA', icon: Mic },
                                  ].map(type => (
                                    <button
                                      key={type.id}
                                      onClick={() => setMediaType(type.id as any)}
                                      className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-medium transition-all ${mediaType === type.id ? 'bg-primary text-white shadow-sm' : 'bg-white dark:bg-card text-gray-500 dark:text-muted-foreground hover:bg-gray-100 dark:hover:bg-white/10'}`}
                                    >
                                      <type.icon className="h-3.5 w-3.5" />
                                      {type.label}
                                    </button>
                                  ))}
                                </div>

                                {mediaType === 'voice' ? (
                                  <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                                    <div className="p-4 bg-blue-50/50 dark:bg-blue-500/15 rounded-2xl border border-blue-100 dark:border-blue-500/25 space-y-4">
                                      <div className="flex items-center justify-between text-primary">
                                        <div className="flex items-center gap-2">
                                          <Mic className="h-4 w-4" />
                                          <span className="text-sm font-bold">Narração Voz IA</span>
                                        </div>

                                        
                                      </div>

                                       <p className="text-[11px] text-gray-500 dark:text-muted-foreground">
                                         Escreva o roteiro aqui. Na próxima etapa você escolhe (ou cria) a voz que vai narrar.
                                       </p>

                                      <div className="space-y-2">
                                        <div className="flex items-center justify-between">
                                          <span className="text-xs font-bold text-gray-700 dark:text-foreground/80">Roteiro da Narração</span>
                                          <button 
                                            onClick={() => setVoiceSettings({...voiceSettings, script: voiceSettings.script + ' @nome'})}
                                            className="text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full hover:bg-blue-200 transition-colors"
                                          >
                                            + Mencionar @nome
                                          </button>
                                        </div>
                                        <Textarea 
                                          placeholder="Ex: Olá @nome, tudo bem? Temos uma oferta exclusiva para você..." 
                                          className="min-h-[120px] bg-white dark:bg-card border-blue-100 dark:border-blue-500/25 focus:border-primary text-sm"
                                          value={voiceSettings.script}
                                          onChange={e => {
                                            const val = e.target.value;
                                            const lastChar = val[val.length - 1];
                                            if (lastChar === '@') {
                                              setVoiceSettings({...voiceSettings, script: val + 'nome'});
                                            } else {
                                              setVoiceSettings({...voiceSettings, script: val});
                                            }

                                          }}
                                        />
                                      </div>
                                      
                                      <div className="flex items-center justify-between p-3 bg-white dark:bg-card rounded-xl border border-blue-100 dark:border-blue-500/25">
                                        <div className="flex flex-col">
                                          <div className="flex items-center gap-2">
                                            <span className="text-xs font-bold text-gray-700 dark:text-foreground/80">Personalização Inteligente</span>
                                            {voiceSettings.script.includes('@nome') && (
                                              <Badge className="bg-green-100 dark:bg-green-500/20 text-green-700 border-green-200 text-[8px] h-4">@nome detectado</Badge>
                                            )}
                                          </div>
                                          <span className="text-[10px] text-gray-400 dark:text-foreground/50">A IA substituirá '@nome' pelo nome do cliente em cada áudio.</span>
                                        </div>
                                        <Switch 
                                          checked={voiceSettings.mentionNames} 
                                          onCheckedChange={v => setVoiceSettings({...voiceSettings, mentionNames: v})}
                                        />
                                      </div>
                                      
                                    </div>
                                  </div>
                                ) : (
                                  <div className="space-y-4 animate-in fade-in duration-300">
                                    {mediaType !== 'text' && (
                                      <div className="space-y-2">
                                        <span className="text-xs font-bold text-gray-400 dark:text-foreground/50 uppercase tracking-widest">Link da Mídia ({mediaType})</span>
                                        <Input 
                                          placeholder={`URL da ${mediaType}...`} 
                                          value={mediaUrl}
                                          onChange={e => setMediaUrl(e.target.value)}
                                        />
                                      </div>
                                    )}
                                    <div className="space-y-2">
                                      <span className="text-xs font-bold text-gray-400 dark:text-foreground/50 uppercase tracking-widest">Texto da Mensagem</span>
                                      <Textarea 
                                        placeholder="Digite aqui o texto principal da campanha..." 
                                        className="min-h-[120px]"
                                        value={message} 
                                        onChange={e => setMessage(e.target.value)} 
                                      />
                                    </div>
                                  </div>
                                )}

                                {/* Mensagens em sequência */}
                                <div className="space-y-3 pt-4 border-t border-gray-100 dark:border-white/10">
                                  <div className="flex items-start justify-between gap-4">
                                    <div className="flex flex-col">
                                      <span className="text-sm font-semibold text-gray-700 dark:text-foreground/80">Enviar outra mensagem em seguida</span>
                                      <span className="text-[11px] text-gray-400 dark:text-foreground/50">
                                        Encadeie envios: ex. um áudio e logo depois uma imagem. Cada item é enviado na ordem, respeitando o intervalo.
                                      </span>
                                    </div>
                                    <Switch
                                      checked={followUpsEnabled}
                                      onCheckedChange={(v) => {
                                        setFollowUpsEnabled(v);
                                        if (v && followUps.length === 0) {
                                          setFollowUps([{ id: crypto.randomUUID(), media_type: 'text', media_url: '', message: '' }]);
                                        }
                                        if (!v) setFollowUps([]);
                                      }}
                                    />
                                  </div>

                                  {followUpsEnabled && (
                                    <div className="space-y-3">
                                      {followUps.map((f, idx) => (
                                        <div key={f.id} className="p-3 rounded-2xl border border-gray-100 dark:border-white/10 bg-gray-50 dark:bg-white/5 space-y-3">
                                          <div className="flex items-center justify-between">
                                            <span className="text-[11px] font-bold text-gray-500 dark:text-muted-foreground uppercase tracking-wider">
                                              Mensagem {idx + 2}
                                            </span>
                                            <Button
                                              variant="ghost"
                                              size="sm"
                                              className="h-7 px-2 text-red-500 hover:text-red-600"
                                              onClick={() => setFollowUps(prev => prev.filter(x => x.id !== f.id))}
                                            >
                                              <Trash2 className="h-3.5 w-3.5" />
                                            </Button>
                                          </div>

                                          <div className="flex flex-wrap gap-2">
                                            {[
                                              { id: 'text', label: 'Texto', icon: FileText },
                                              { id: 'image', label: 'Imagem', icon: Image },
                                              { id: 'video', label: 'Vídeo', icon: Video },
                                              { id: 'audio', label: 'Áudio', icon: Mic },
                                              { id: 'document', label: 'Doc', icon: FileText },
                                            ].map(t => (
                                              <button
                                                key={t.id}
                                                onClick={() => setFollowUps(prev => prev.map(x => x.id === f.id ? { ...x, media_type: t.id as any, media_url: t.id === 'text' ? '' : x.media_url } : x))}
                                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-medium transition-all ${f.media_type === t.id ? 'bg-primary text-white' : 'bg-white dark:bg-card text-gray-500 dark:text-muted-foreground hover:bg-gray-100 dark:hover:bg-white/10'}`}
                                              >
                                                <t.icon className="h-3 w-3" />
                                                {t.label}
                                              </button>
                                            ))}
                                          </div>

                                          {f.media_type !== 'text' && (
                                            <Input
                                              placeholder={`URL da ${f.media_type}...`}
                                              value={f.media_url}
                                              onChange={e => setFollowUps(prev => prev.map(x => x.id === f.id ? { ...x, media_url: e.target.value } : x))}
                                              className="bg-white dark:bg-card"
                                            />
                                          )}

                                          <Textarea
                                            placeholder={f.media_type === 'text' ? 'Texto desta mensagem...' : 'Legenda (opcional)...'}
                                            value={f.message}
                                            onChange={e => setFollowUps(prev => prev.map(x => x.id === f.id ? { ...x, message: e.target.value } : x))}
                                            className="min-h-[70px] bg-white dark:bg-card text-sm"
                                          />
                                        </div>
                                      ))}

                                      <Button
                                        variant="outline"
                                        className="w-full rounded-xl border-dashed"
                                        onClick={() => setFollowUps(prev => [...prev, { id: crypto.randomUUID(), media_type: 'text', media_url: '', message: '' }])}
                                      >
                                        <Plus className="h-4 w-4 mr-2" /> Adicionar mais uma mensagem
                                      </Button>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          )}
                            {steps[currentStep].id === 'voice-select' && (
                              <div className="space-y-6">
                                <div className="space-y-1">
                                  <h3 className="text-lg font-semibold text-primary">Escolha a voz</h3>
                                  <p className="text-sm text-gray-500 dark:text-muted-foreground">Selecione uma voz pronta ou crie a sua clonando amostras de áudio.</p>
                                </div>

                                <div className="space-y-2">
                                  {[
                                    { id: '21m00Tcm4TlvDq8ikWAM', name: 'Rachel', desc: 'Feminina - Suave' },
                                    { id: 'EXAVITQu4vr4xnSDxMaL', name: 'Sarah', desc: 'Feminina - Suave' },
                                    { id: 'FGY2WhTYpPnrIDTdsKH5', name: 'Laura', desc: 'Feminina - Expressiva' },
                                    { id: 'cgSgspJ2msm6clMCkdW9', name: 'Jessica', desc: 'Feminina - Natural' },
                                    { id: 'JBFqnCBsd6RMkjVDRZzb', name: 'George', desc: 'Masculina - Narrador' },
                                    ...customVoices.map(v => ({ id: v.voice_id, name: v.name, desc: 'Minha voz' })),
                                  ].map(v => (
                                    <div
                                      key={v.id}
                                      onClick={() => setVoiceSettings({ ...voiceSettings, voiceId: v.id })}
                                      className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-colors ${voiceSettings.voiceId === v.id ? 'border-primary bg-blue-50/60' : 'border-gray-100 dark:border-white/10 bg-white dark:bg-card hover:border-gray-200 dark:hover:border-white/15'}`}
                                    >
                                      <div className="min-w-0">
                                        <p className="text-sm font-medium text-gray-800 dark:text-foreground/90 truncate">{v.name}</p>
                                        <p className="text-[11px] text-gray-400 dark:text-foreground/50">{v.desc}</p>
                                      </div>
                                      {voicePreviewUrls[v.id] ? (
                                        <audio src={voicePreviewUrls[v.id]} controls preload="none" className="h-8 max-w-[190px]" onClick={e => e.stopPropagation()} />
                                      ) : (
                                        <span className="text-[10px] text-gray-400 dark:text-foreground/50">sem prévia</span>
                                      )}
                                    </div>
                                  ))}
                                </div>

                                {!showCloneForm ? (
                                  <button
                                    onClick={() => setShowCloneForm(true)}
                                    className="text-sm text-primary font-medium hover:underline flex items-center gap-1"
                                  >
                                    <Plus className="h-4 w-4" /> Criar minha própria voz
                                  </button>
                                ) : (
                                  <div className="space-y-4 bg-gray-50 dark:bg-white/5 p-5 rounded-2xl border border-gray-100 dark:border-white/10">
                                    <div className="flex items-center justify-between">
                                      <h4 className="text-sm font-semibold text-gray-800 dark:text-foreground/90">Clonar minha voz</h4>
                                      <button onClick={() => setShowCloneForm(false)} className="text-xs text-gray-400 dark:text-foreground/50 hover:text-gray-600">Cancelar</button>
                                    </div>

                                    <div className="text-[11px] text-gray-500 dark:text-muted-foreground bg-white dark:bg-card border border-gray-100 dark:border-white/10 rounded-xl p-3 space-y-1">
                                      <p className="font-medium text-gray-700 dark:text-foreground/80">Requisitos obrigatórios:</p>
                                      <p>• <strong>Regra:</strong> Anexe exatamente 5 áudios, todos <strong>diferentes</strong>.</p>
                                      <p>• Mínimo de 30 segundos por áudio — o ideal é 1 minuto.</p>
                                      <p>• Fala clara, sem música de fundo e sem ruído. Formatos .mp3, .wav ou .m4a (até 10 MB cada).</p>
                                    </div>

                                    <div className="space-y-2">
                                      <span className="text-sm font-medium text-gray-700 dark:text-foreground/80">Nome da voz</span>
                                      <Input
                                        placeholder="Ex: Minha Voz, Voz do CEO..."
                                        value={cloneName}
                                        onChange={e => setCloneName(e.target.value)}
                                        className="bg-white dark:bg-card"
                                      />
                                    </div>

                                    <div className="space-y-2">
                                      <span className="text-sm font-medium text-gray-700 dark:text-foreground/80">Amostras de áudio ({cloneFiles.length}/5)</span>
                                      <div
                                        onClick={() => fileInputRef.current?.click()}
                                        className="border-2 border-dashed border-gray-200 dark:border-white/15 rounded-xl p-6 text-center cursor-pointer hover:border-primary transition-colors bg-white dark:bg-card"
                                      >
                                        <Upload className="h-7 w-7 mx-auto text-gray-400 dark:text-foreground/50 mb-2" />
                                        <p className="text-sm text-gray-500 dark:text-muted-foreground">
                                          {isConvertingAudio ? 'Convertendo áudio para MP3...' : 'Clique para selecionar os áudios'}
                                        </p>
                                        <p className="text-[11px] text-gray-400 dark:text-foreground/50 mt-1">MP3, WAV, OPUS ou OGG (.opus é convertido automaticamente)</p>

                                        <input
                                          type="file"
                                          multiple
                                          className="hidden"
                                          ref={fileInputRef}
                                          accept="audio/*,.opus,.ogg,.oga,.m4a,.webm"
                                          onChange={e => {
                                            addCloneFiles(Array.from(e.target.files || []));
                                            e.target.value = '';
                                          }}

                                        />
                                      </div>

                                      {cloneFiles.length > 0 && (
                                        <div className="space-y-2 mt-2">
                                          {cloneFiles.map((f, i) => (
                                            <div key={`${f.name}-${f.size}-${i}`} className="flex items-center gap-2 bg-white dark:bg-card border border-gray-100 dark:border-white/10 rounded-xl p-2">
                                              <div className="min-w-0 flex-1">
                                                <p className="text-xs font-medium text-gray-700 dark:text-foreground/80 truncate">{f.name}</p>
                                                <p className="text-[10px] text-gray-400 dark:text-foreground/50">{(f.size / 1024 / 1024).toFixed(2)} MB</p>
                                              </div>
                                              <audio src={cloneFileUrls[i]} controls preload="metadata" className="h-8 max-w-[190px]" />
                                              <button onClick={() => setCloneFiles(cloneFiles.filter((_, idx) => idx !== i))} className="text-gray-300 dark:text-white/35 hover:text-red-500 dark:hover:text-red-400">
                                                <XCircle className="h-4 w-4" />
                                              </button>
                                            </div>
                                          ))}
                                        </div>
                                      )}
                                    </div>

                                    <Button
                                      className="w-full bg-primary text-white rounded-xl"
                                      onClick={createClonedVoice}
                                      disabled={isCloning || cloneFiles.length < 5 || !cloneName.trim()}
                                    >
                                      {isCloning ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Mic className="h-4 w-4 mr-2" />}
                                      Criar voz agora
                                    </Button>
                                  </div>
                                )}
                              </div>
                            )}

                            {steps[currentStep].id === 'voice-review' && (
                              <div className="space-y-6">
                                <div className="space-y-4">
                                  <div className="flex items-center justify-between">
                                    <div className="space-y-1">
                                      <h3 className="text-lg font-semibold text-primary">Revisão de Vozes</h3>
                                      <p className="text-sm text-gray-500 dark:text-muted-foreground">Ouça e aprove o áudio personalizado para cada destinatário.</p>
                                    </div>
                                    <div className="flex gap-2">
                                      <Button 
                                        size="sm" 
                                        onClick={() => generateAllVoices()} 
                                        disabled={isGeneratingVoices}
                                        className="bg-blue-50 dark:bg-blue-500/15 text-primary hover:bg-blue-100 border-none rounded-full"
                                      >
                                        {isGeneratingVoices ? <Loader2 className="h-3 w-3 animate-spin mr-2" /> : <Sparkles className="h-3 w-3 mr-2" />}
                                        Gerar pendentes
                                      </Button>
                                      {isGeneratingVoices && (
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          onClick={stopVoiceGeneration}
                                          className="rounded-full border-gray-200 dark:border-white/15"
                                        >
                                          <Pause className="h-3 w-3 mr-2" /> Pausar
                                        </Button>
                                      )}
                                      {!isGeneratingVoices && recipients.some(r => !r.voiceUrl) && recipients.some(r => r.voiceUrl) && (
                                        <Button
                                          size="sm"
                                          onClick={() => generateAllVoices(true)}
                                          className="bg-amber-50 text-amber-700 hover:bg-amber-100 border-none rounded-full"
                                        >
                                          <RefreshCw className="h-3 w-3 mr-2" /> Regerar falhas ({recipients.filter(r => !r.voiceUrl).length})
                                        </Button>
                                      )}
                                      <Button 
                                        size="sm" 
                                        onClick={approveAllVoices}
                                        disabled={!recipients.some(r => r.voiceUrl) || isGeneratingVoices}
                                        className="bg-green-50 dark:bg-green-500/15 text-green-700 hover:bg-green-100 border-none rounded-full"
                                      >
                                        <Check className="h-3 w-3 mr-2" />
                                        Aprovar Todos
                                      </Button>
                                    </div>
                                  </div>

                                  {(isGeneratingVoices || recipients.some(r => r.voiceUrl)) && (
                                    <div className="space-y-2 animate-in fade-in slide-in-from-top-2 duration-300">
                                      <div className="flex items-center justify-between text-[10px] text-gray-500 dark:text-muted-foreground font-medium px-1">
                                        <span className="flex items-center gap-2">
                                          {isGeneratingVoices && <Loader2 className="h-3 w-3 animate-spin text-primary" />}
                                          {isGeneratingVoices
                                            ? `IA ElevenLabs processando${voiceBatch ? ` — lote ${voiceBatch.current}/${voiceBatch.total}` : ''}...`
                                            : 'Áudios salvos com segurança (backup automático)'}
                                        </span>
                                        <span>
                                          {recipients.filter(r => r.voiceUrl).length} de {recipients.length} concluídos
                                          {voiceEta && voiceEta.etaSec > 0 && (
                                            <span className="ml-2 text-primary font-semibold">
                                              • restam ~{formatEta(voiceEta.etaSec)} (fim ~{etaClock(voiceEta.etaSec)})
                                            </span>
                                          )}
                                        </span>
                                      </div>
                                      <Progress 
                                        value={(recipients.filter(r => r.voiceUrl).length / Math.max(1, recipients.length)) * 100} 
                                        className="h-1.5 bg-blue-50 dark:bg-blue-500/15"
                                      />
                                    </div>
                                  )}

                                </div>

                                <ScrollArea className="h-[400px] pr-2">
                                  <div className="grid gap-3">
                                    {recipients.map((r) => (
                                      <div key={r.id} className="p-4 bg-gray-50 dark:bg-white/5 rounded-2xl border border-gray-100 dark:border-white/10 flex items-center justify-between gap-4">
                                        <div className="flex items-center gap-3">
                                          <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm ${r.voiceApproved ? 'bg-green-100 dark:bg-green-500/20 text-green-700' : 'bg-blue-100 text-primary'}`}>
                                            {r.voiceApproved ? <Check className="h-5 w-5" /> : (r.name || r.phone).charAt(0).toUpperCase()}
                                          </div>
                                          <div>
                                            <p className="font-semibold text-sm">{r.name || 'Sem nome'}</p>
                                            <p className="text-[10px] text-gray-500 dark:text-muted-foreground">{r.phone}</p>
                                          </div>
                                        </div>

                                        <div className="flex items-center gap-4 flex-1 justify-end">
                                          {r.voiceUrl ? (
                                            <div className="flex items-center gap-2">
                                              <audio key={r.voiceUrl} src={r.voiceUrl} controls className="h-8 w-48 scale-90 origin-right" />
                                              <div className="flex gap-1">
                                                <Button 
                                                  size="icon" 
                                                  variant="outline" 
                                                  className={`h-8 w-8 rounded-full ${r.voiceApproved === true ? 'bg-green-500 text-white border-green-500' : 'text-gray-400 dark:text-foreground/50'}`}
                                                  onClick={() => toggleVoiceApproval(r.id, true)}
                                                >
                                                  <Check className="h-4 w-4" />
                                                </Button>
                                                <Button 
                                                  size="icon" 
                                                  variant="outline" 
                                                  className="h-8 w-8 rounded-full text-red-500 hover:bg-red-50"
                                                  onClick={() => generateVoice(r.id)}
                                                >
                                                  <XCircle className="h-4 w-4" />
                                                </Button>
                                              </div>
                                            </div>
                                          ) : (
                                            <Button 
                                              size="sm" 
                                              variant="ghost" 
                                              onClick={() => generateVoice(r.id)}
                                              className="text-[10px] text-blue-600 dark:text-blue-300"
                                            >
                                              <Play className="h-3 w-3 mr-1" /> Gerar Voz
                                            </Button>
                                          )}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </ScrollArea>
                              </div>
                            )}

                            {steps[currentStep].id === 'review' && (
                              <div className="space-y-6">
                                <div className="space-y-1">
                                  <h3 className="text-lg font-semibold">Finalização</h3>
                                  <p className="text-sm text-gray-500 dark:text-muted-foreground">Tudo pronto! Revise as informações finais e inicie a campanha.</p>
                                </div>
                                
                                <div className="grid grid-cols-2 gap-6 pt-4 border-t">
                                  <div className="space-y-4">
                                    <div className="space-y-1">
                                      <span className="text-xs font-semibold text-gray-400 dark:text-foreground/50 uppercase tracking-wider">Conexão de Saída</span>
                                      <div className="flex items-center gap-2 p-3 bg-gray-50 dark:bg-white/5 rounded-xl border border-gray-100 dark:border-white/10">
                                        <div className="w-8 h-8 rounded-full bg-[#F0F2FE] dark:bg-primary/20 flex items-center justify-center text-primary">
                                          <Phone className="h-4 w-4" />
                                        </div>
                                        <div className="flex flex-col">
                                          <span className="text-sm font-medium">{selectedSession?.phone_number || selectedSession?.instance_name}</span>
                                          <span className="text-[10px] text-gray-400 dark:text-foreground/50">Canal Ativo</span>
                                        </div>
                                      </div>
                                    </div>

                                    <div className="space-y-1">
                                      <span className="text-xs font-semibold text-gray-400 dark:text-foreground/50 uppercase tracking-wider">Configurações</span>
                                      <div className="grid grid-cols-2 gap-2">
                                        <div className="p-3 bg-gray-50 dark:bg-white/5 rounded-xl border border-gray-100 dark:border-white/10">
                                          <span className="block text-[10px] text-gray-400 dark:text-foreground/50 uppercase">Intervalo</span>
                                          <span className="text-sm font-medium">{delaySeconds}s</span>
                                        </div>
                                        <div className="p-3 bg-gray-50 dark:bg-white/5 rounded-xl border border-gray-100 dark:border-white/10">
                                          <span className="block text-[10px] text-gray-400 dark:text-foreground/50 uppercase">IA Ativa</span>
                                          <span className="text-sm font-medium">
                                            {aiEnabled ? (aiAgents.find(a => a.id === selectedAgentId)?.name || 'Sim') : 'Não'}
                                          </span>
                                        </div>
                                      </div>
                                    </div>
                                  </div>

                                  <div className="space-y-4">
                                    <div className="space-y-1">
                                      <span className="text-xs font-semibold text-gray-400 dark:text-foreground/50 uppercase tracking-wider">Destinatários</span>
                                      <div className="p-3 bg-gray-50 dark:bg-white/5 rounded-xl border border-gray-100 dark:border-white/10 flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                          <Users className="h-4 w-4 text-gray-400 dark:text-foreground/50" />
                                          <span className="text-sm font-medium">{mediaType === 'voice' ? recipients.filter(r => r.voiceUrl).length : recipients.length} contatos</span>
                                        </div>
                                        <Badge variant="outline" className={`text-[10px] bg-white dark:bg-card ${mediaType === 'voice' && !recipients.some(r => r.voiceUrl) ? 'text-amber-500 border-amber-200' : 'text-green-500 border-green-200'}`}>
                                          {mediaType === 'voice' ? (recipients.some(r => r.voiceUrl) ? 'Parcialmente Pronto' : 'Aguardando Vozes') : 'Pronto'}
                                        </Badge>
                                      </div>
                                    </div>

                                    <div className="space-y-1">
                                      <span className="text-xs font-semibold text-gray-400 dark:text-foreground/50 uppercase tracking-wider">Conteúdo</span>
                                      <div className="p-3 bg-gray-50 dark:bg-white/5 rounded-xl border border-gray-100 dark:border-white/10 min-h-[80px]">
                                        <span className="block text-[10px] text-gray-400 dark:text-foreground/50 uppercase mb-1">Tipo de Mídia</span>
                                        <div className="flex items-center gap-2 mb-2">
                                          <Badge className="bg-primary text-[10px] uppercase">{mediaType}</Badge>
                                        </div>
                                        <span className="block text-[10px] text-gray-400 dark:text-foreground/50 uppercase mb-1">Prévia</span>
                                        <p className="text-xs text-gray-600 dark:text-foreground/70 line-clamp-3">
                                          {mediaType === 'voice' ? voiceSettings.script : (message || 'Nenhuma mensagem escrita')}
                                        </p>
                                      </div>
                                    </div>
                                  </div>
                                </div>

                                {delaySeconds <= 10 && (
                                  <div className="flex items-start gap-2 p-3 bg-red-50 dark:bg-red-500/15 text-red-700 rounded-xl border border-red-100 text-xs">
                                    <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                                    <p>Atenção: O intervalo de 10s aumenta significativamente o risco de banimento da sua conta WhatsApp pela Meta.</p>
                                  </div>
                                )}
                              </div>
                            )}
                        </Card>
                      </motion.div>
                    </AnimatePresence>
                  </div>
                </div>
                
                <div className="space-y-6">
                  <Card className="border-none shadow-[0_2px_8px_rgba(0,0,0,0.04)] rounded-2xl bg-white dark:bg-card p-4 sm:p-6">
                     <h3 className="font-semibold mb-4">Resumo</h3>
                     <div className="space-y-3">
                        <div className="flex justify-between"><span>Conexão:</span> <span className="text-primary font-medium">{selectedSession?.phone_number || selectedSession?.instance_name || '—'}</span></div>
                        <div className="flex justify-between"><span>Destinatários:</span> <span>{mediaType === 'voice' ? recipients.filter(r => r.voiceUrl).length : recipients.length}</span></div>
                        <div className="flex justify-between">
                          <span>Previsão de término:</span>
                          <span className="text-primary font-medium text-right">
                            ~{formatEta(dispatchEtaSeconds(batchSize > 0 ? Math.min(batchSize, (mediaType === 'voice' ? recipients.filter(r => r.voiceUrl).length : recipients.length)) : (mediaType === 'voice' ? recipients.filter(r => r.voiceUrl).length : recipients.length)))}
                            <span className="block text-[10px] text-gray-500 dark:text-muted-foreground font-normal">
                              {batchSize > 0 ? `por etapa de ${batchSize} • ` : ''}conclusão ~{etaClock(dispatchEtaSeconds(batchSize > 0 ? Math.min(batchSize, (mediaType === 'voice' ? recipients.filter(r => r.voiceUrl).length : recipients.length)) : (mediaType === 'voice' ? recipients.filter(r => r.voiceUrl).length : recipients.length)))}
                            </span>
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span>Intervalo:</span>
                          <Select
                            value={delayMode === 'variable' ? 'safe' : delayMode === 'range' ? 'range' : String(delaySeconds)}
                            onValueChange={(v) => {
                              if (v === 'safe') { setDelayMode('variable'); return; }
                              if (v === 'range') { setDelayMode('range'); return; }
                              setDelayMode('fixed');
                              setDelaySeconds(Number(v));
                            }}
                          >
                            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="safe">
                                <span className="flex items-center gap-1 text-emerald-600 font-medium">
                                  <Shield className="h-3 w-3" /> Seguro (variável)
                                </span>
                              </SelectItem>
                              <SelectItem value="range">
                                <span className="flex items-center gap-1 text-emerald-600 font-medium">
                                  <Shield className="h-3 w-3" /> Aleatório 120–200s
                                </span>
                              </SelectItem>
                              <SelectItem value="5">
                                <span className="flex items-center gap-1 text-red-500">
                                  5s <AlertTriangle className="h-3 w-3" />
                                </span>
                              </SelectItem>
                              <SelectItem value="10">10s</SelectItem>
                              <SelectItem value="30">30s (Padrão)</SelectItem>
                              <SelectItem value="60">60s</SelectItem>
                              <SelectItem value="90">90s</SelectItem>
                              <SelectItem value="120">120s</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        {delayMode === 'variable' && (
                          <div className="text-[10px] text-emerald-600 mt-1 text-right leading-relaxed">
                            Alterna aleatoriamente entre 2, 3, 4, 5 e 8 minutos (+ variação de ±10%) para evitar padrão e banimento.
                          </div>
                        )}
                        {delayMode === 'range' && (
                          <div className="text-[10px] text-emerald-600 mt-1 text-right leading-relaxed">
                            Cada envio espera um tempo quebrado sorteado entre 120s e 200s (ex.: 143s, 187s, 126s) — média ~160s.
                          </div>
                        )}
                        {delayMode === 'fixed' && delaySeconds <= 10 && (
                          <div className="text-[10px] text-red-500 font-medium mt-1 text-right flex items-center justify-end gap-1">
                            <Info className="h-3 w-3" /> Risco de banimento por spam
                          </div>
                        )}

                        <div className="border-t pt-3 mt-1 space-y-2">
                          <div className="flex justify-between items-center">
                            <span>Enviar por etapas:</span>
                            <Select
                              value={batchSize ? String(batchSize) : 'off'}
                              onValueChange={(v) => setBatchSize(v === 'off' ? 0 : Number(v))}
                            >
                              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="off">Tudo de uma vez</SelectItem>
                                <SelectItem value="50">50 por etapa</SelectItem>
                                <SelectItem value="100">100 por etapa</SelectItem>
                                <SelectItem value="200">200 por etapa</SelectItem>
                                <SelectItem value="500">500 por etapa</SelectItem>
                                <SelectItem value="1000">1000 por etapa</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          {batchSize > 0 && (
                            <>
                              <div className="text-[10px] text-gray-500 dark:text-muted-foreground text-right leading-relaxed">
                                Serão {Math.ceil(recipients.length / batchSize)} etapa(s) de até {batchSize} envios.
                                {autoNextBatch
                                  ? ' As etapas seguem automaticamente.'
                                  : ' Ao terminar cada etapa a campanha pausa e você libera a próxima no botão ▶.'}
                              </div>
                              <div className="flex justify-between items-center">
                                <span className="text-xs text-gray-600 dark:text-foreground/70">Continuar automaticamente</span>
                                <Switch checked={autoNextBatch} onCheckedChange={setAutoNextBatch} />
                              </div>
                            </>
                          )}
                        </div>



                        <div className="border-t pt-3 mt-1 space-y-2">
                          <div className="flex justify-between items-center">
                            <span className="flex items-center gap-1">
                              <Sparkles className="h-3.5 w-3.5 text-primary" /> IA qualifica respostas
                            </span>
                            <Switch checked={replyAiEnabled} onCheckedChange={setReplyAiEnabled} />
                          </div>
                          {replyAiEnabled && (
                            <div className="space-y-2">
                              <p className="text-[10px] text-gray-500 dark:text-muted-foreground leading-relaxed">
                                Quando o destinatário responder, a IA analisa se há interesse. Se sim, envia o link abaixo automaticamente.
                              </p>
                              <Input
                                value={replyAiLink}
                                onChange={(e) => setReplyAiLink(e.target.value)}
                                placeholder="https://seu-link.com"
                                className="h-8 text-xs"
                              />
                              <Input
                                value={replyAiOffer}
                                onChange={(e) => setReplyAiOffer(e.target.value)}
                                placeholder="Sobre o que é a oferta (ajuda a IA)"
                                className="h-8 text-xs"
                              />
                              <Textarea
                                value={replyAiInterestedMessage}
                                onChange={(e) => setReplyAiInterestedMessage(e.target.value)}
                                placeholder="Mensagem se houver interesse (use {{link}})"
                                className="text-xs min-h-[56px]"
                              />
                              <Textarea
                                value={replyAiNotInterestedMessage}
                                onChange={(e) => setReplyAiNotInterestedMessage(e.target.value)}
                                placeholder="Mensagem se não houver interesse"
                                className="text-xs min-h-[48px]"
                              />
                            </div>
                          )}
                        </div>
                        <div className="flex flex-col gap-2">
                          <div className="flex justify-between items-center">
                            <span>Vincular Agente IA:</span>
                            <Switch
                              checked={aiEnabled}
                              onCheckedChange={(v) => { setAiEnabled(v); if (v) setChatbotEnabled(false); }}
                            />
                          </div>
                          {aiEnabled && (
                            <div className="space-y-1">
                              <Select value={selectedAgentId} onValueChange={setSelectedAgentId}>
                                <SelectTrigger className="w-full h-8 text-xs">
                                  <SelectValue placeholder="Escolha um agente..." />
                                </SelectTrigger>
                                <SelectContent>
                                  {aiAgents.map(agent => (
                                    <SelectItem key={agent.id} value={agent.id}>{agent.name}</SelectItem>
                                  ))}
                                  {aiAgents.length === 0 && (
                                    <div className="p-2 text-[10px] text-gray-400 dark:text-foreground/50 italic">Nenhum agente configurado</div>
                                  )}
                                </SelectContent>
                              </Select>
                            </div>
                          )}

                          <div className="flex justify-between items-center">
                            <span>Vincular Chatbot:</span>
                            <Switch
                              checked={chatbotEnabled}
                              onCheckedChange={(v) => { setChatbotEnabled(v); if (v) setAiEnabled(false); }}
                            />
                          </div>
                          {chatbotEnabled && (
                            <div className="space-y-1">
                              <Select value={selectedFlowId} onValueChange={setSelectedFlowId}>
                                <SelectTrigger className="w-full h-8 text-xs">
                                  <SelectValue placeholder="Escolha um fluxo..." />
                                </SelectTrigger>
                                <SelectContent>
                                  {chatbotFlows.map(flow => (
                                    <SelectItem key={flow.id} value={flow.id}>
                                      {flow.name}{flow.is_active === false ? ' (inativo)' : ''}
                                    </SelectItem>
                                  ))}
                                  {chatbotFlows.length === 0 && (
                                    <div className="p-2 text-[10px] text-gray-400 dark:text-foreground/50 italic">Nenhum fluxo criado</div>
                                  )}
                                </SelectContent>
                              </Select>
                            </div>
                          )}
                          {(aiEnabled || chatbotEnabled) && (
                            <p className="text-[10px] text-gray-400 dark:text-foreground/50 leading-snug">
                              Quando o destinatário responder, {aiEnabled ? 'o agente de IA assume a conversa' : 'o fluxo do chatbot é executado'} automaticamente.
                            </p>
                          )}
                        </div>
                     </div>
                     <div className="mt-6 hidden lg:block">
                       {currentStep < steps.length - 1 ? (
                         <Button className="w-full" disabled={!canAdvance(currentStep)} onClick={goNext}>Continuar</Button>
                       ) : (
                          <Button className="w-full" disabled={isSending} onClick={startDisparo}>
                            {isSending ? (<><Loader2 className="h-4 w-4 mr-2 animate-spin" />Criando disparo...</>) : 'Iniciar Disparo'}
                          </Button>

                       )}
                       {currentStep < steps.length - 1 && stepError(currentStep) && (
                         <p className="mt-2 text-[10px] text-amber-600 text-center">{stepError(currentStep)}</p>
                       )}
                     </div>
                  </Card>
                </div>
              </div>

              {/* Barra de ação fixa (mobile) */}
              <div
                className="lg:hidden fixed left-0 right-0 z-50 border-t border-gray-100 dark:border-white/10 bg-white/95 backdrop-blur-sm px-4 py-3 bottom-[calc(68px+env(safe-area-inset-bottom))] md:bottom-0 md:pb-[calc(env(safe-area-inset-bottom)+0.75rem)]"
              >
                <div className="flex items-center gap-3">
                  <Button variant="outline" className="rounded-full h-11 px-4 shrink-0" onClick={goBack}>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  {currentStep < steps.length - 1 ? (
                    <Button className="flex-1 h-11 rounded-full" disabled={!canAdvance(currentStep)} onClick={goNext}>Continuar</Button>
                  ) : (
                    <Button className="flex-1 h-11 rounded-full" disabled={isSending} onClick={startDisparo}>
                      {isSending ? (<><Loader2 className="h-4 w-4 mr-2 animate-spin" />Criando...</>) : 'Iniciar Disparo'}
                    </Button>

                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <Dialog open={isImportingFromSession} onOpenChange={setIsImportingFromSession}>
        <DialogContent className="max-w-2xl w-[calc(100vw-2rem)] max-h-[85dvh] overflow-y-auto rounded-3xl p-0 border-none">
          <DialogHeader className="p-6 bg-primary text-white">
            <DialogTitle className="flex items-center gap-2 text-white">
              <Users className="h-5 w-5" /> Importar contatos da conexão
            </DialogTitle>
            <p className="text-blue-100 text-sm">Selecione os contatos das conversas ativas nesta sessão.</p>
          </DialogHeader>
          <div className="p-6">
            <ScrollArea className="h-[400px] pr-4">
              <div className="space-y-2">
                {contacts.length > 0 ? contacts.map(c => (
                  <div key={c.id} className="flex items-center justify-between p-3 rounded-2xl border border-gray-100 dark:border-white/10 hover:bg-gray-50 transition-all cursor-pointer"
                    onClick={() => {
                      addContactsFromSession([c]);
                    }}>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gray-100 dark:bg-white/10 flex items-center justify-center text-primary font-bold">
                        {(c.contact_name || '?').charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-semibold text-sm">{c.contact_name || 'Sem nome'}</p>
                        <p className="text-xs text-gray-500 dark:text-muted-foreground">{c.contact_phone}</p>
                      </div>
                    </div>
                    <Button variant="ghost" size="sm" className="rounded-full h-8 text-primary">Selecionar</Button>
                  </div>
                )) : (
                  <div className="text-center py-20 text-gray-400 dark:text-foreground/50">
                    <Database className="h-10 w-10 mx-auto mb-2 opacity-20" />
                    <p>Nenhuma conversa encontrada nesta sessão.</p>
                  </div>
                )}
              </div>
            </ScrollArea>
            
            {contacts.length > 0 && (
              <div className="mt-6 flex justify-end gap-3">
                <Button variant="ghost" onClick={() => setIsImportingFromSession(false)} className="rounded-full">Cancelar</Button>
                <Button onClick={() => addContactsFromSession(contacts)} className="bg-primary text-white rounded-full">Importar Todos ({contacts.length})</Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

    </>
  );
}
