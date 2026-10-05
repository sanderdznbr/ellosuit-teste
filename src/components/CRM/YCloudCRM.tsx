import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import characterSvg from '@/assets/character_1.svg';
import ElloAIPopup from './ElloAIPopup';
import AIImproveMessageButton from './AIImproveMessageButton';
import AISuggestReplyButton from './AISuggestReplyButton';
 import { useNavigate, Navigate } from 'react-router-dom';

 import { useAuth } from '@/hooks/useAuth';
 import { useApprovalStatus } from '@/hooks/useApprovalStatus';
 import { useAdminMaster } from '@/hooks/useAdminMaster';
import { supabase } from '@/integrations/supabase/client';
import { jsPDF } from 'jspdf';
import ellosuitLogo from '@/assets/ellosuit-logo.png';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { useToast } from '@/hooks/use-toast';
 import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';
import CRMSidebar from './CRMSidebar';
import { ElloLogo } from '@/components/shared/ElloLogo';
import ContactProfilePanel from './ContactProfilePanel';
import StartChatbotModal from './StartChatbotModal';
import AudioPlayerBubble from './AudioPlayerBubble';
import WhatsAppCallOverlay from './WhatsAppCallOverlay';
import InteractiveMessageComposer, { FollowUpMapping } from './InteractiveMessageComposer';
import TemplateMessageModal from './TemplateMessageModal';
import ScheduleMeetingModal from './ScheduleMeetingModal';
import {
  MessageSquare, Send, Plus, Trash2, Phone, Search, Bot, Sparkles,
  CheckCircle, XCircle, Loader2, ArrowLeft, CloudCog, Settings, RefreshCw,
  MoreVertical, Check, CheckCheck, ChevronDown, Archive, UserPlus, Tag,
  Copy, Filter, Square, GitBranch, Image, Paperclip, Mic, MicOff, FileText,
  Volume2, Video, Star, Ban, Bell, BellOff, MessageCircle, Users, ToggleLeft, List,
  Reply, X, CalendarDays, ListChecks, MapPin, Home
} from 'lucide-react';

interface Session {
  id: string;
  company_id: string;
  phone_number: string | null;
  status: string;
  created_at: string;
  waba_id: string | null;
}

interface Conversation {
  id: string;
  contact_phone: string;
  contact_name: string | null;
  last_message: string | null;
  last_message_at: string;
  unread_count: number;
  session_id?: string;
  company_id?: string;
  assigned_agent_id?: string;
  status?: string;
  profile_picture?: string | null;
  ai_auto_reply_enabled?: boolean;
  ai_thinking?: boolean;
  lead_temperature?: string | null;
}

const TEMPERATURE_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  'QUENTE': { label: '🔥 Quente', color: 'text-red-600', bg: 'bg-red-100 dark:bg-red-900/30' },
  'MORNO': { label: '🌤 Morno', color: 'text-amber-600', bg: 'bg-amber-100 dark:bg-amber-900/30' },
  'FRIO': { label: '❄️ Frio', color: 'text-[#2F428D]', bg: 'bg-[#DFE4FB] dark:bg-[#0F1631]/30' },
  'MORTO': { label: '💀 Morto', color: 'text-gray-500', bg: 'bg-gray-100 dark:bg-gray-800/50' },
  'FECHADO': { label: '✅ Fechado', color: 'text-green-600', bg: 'bg-green-100 dark:bg-green-900/30' },
};

interface Message {
  id: string;
  from_me: boolean;
  content: string | null;
  message_type: string;
  media_url: string | null;
  status: string;
  created_at: string;
  conversation_id?: string;
  is_ai_response?: boolean;
  raw_payload?: any;
  wamid?: string;
  ycloud_message_id?: string;
  transcription?: string | null;
  reaction?: string;
  reactions?: Record<string, string>;
}

interface AIAgent {
  id: string;
  name: string;
  description?: string;
  personality: string;
  instructions: string;
  avatar_url?: string;
  is_active: boolean;
}

const YCloudCRM: React.FC = () => {
   const { user } = useAuth();
   const { status, loading: statusLoading } = useApprovalStatus();
   const { isAdminMaster, loading: adminLoading } = useAdminMaster();
  const { toast } = useToast();
  const navigate = useNavigate();
  const { isMobile } = useIsMobile();
  
  const [sessions, setSessions] = useState<Session[]>([]);
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConv, setSelectedConv] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSetup, setShowSetup] = useState(false);
  const [setupApiKey, setSetupApiKey] = useState('');
  const [setupCompanyId, setSetupCompanyId] = useState('');
  const [companies, setCompanies] = useState<{ id: string; name: string }[]>([]);
  const [creatingSession, setCreatingSession] = useState(false);
  const [showNewChat, setShowNewChat] = useState(false);
  const [activeTab, setActiveTab] = useState<'all' | 'unread'>('all');
  const [aiAgents, setAiAgents] = useState<AIAgent[]>([]);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [showContactProfile, setShowContactProfile] = useState(false);
  const [showContactsList, setShowContactsList] = useState(false);
  const [contactsList, setContactsList] = useState<Conversation[]>([]);
  const [contactsLoading, setContactsLoading] = useState(false);
  const [contactsSearch, setContactsSearch] = useState('');
  const [showInteractiveComposer, setShowInteractiveComposer] = useState(false);
  const [showScheduleMeeting, setShowScheduleMeeting] = useState(false);
  const [showPlusMenu, setShowPlusMenu] = useState(false);
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [windowClosedNotice, setWindowClosedNotice] = useState<string | null>(null);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState<{ loading: boolean; result: string | null; type: 'conversation' | 'message'; messageContent?: string; detectedTemperature?: string | null }>({ loading: false, result: null, type: 'conversation' });
  const [showAiAnalysis, setShowAiAnalysis] = useState(false);
  const [msgMenu, setMsgMenu] = useState<{ msg: Message; x: number; y: number } | null>(null);
  const [showStartChatbot, setShowStartChatbot] = useState(false);
  const [chatbotConv, setChatbotConv] = useState<Conversation | null>(null);
  const [activeChatbotFlow, setActiveChatbotFlow] = useState<{ id: string; name: string } | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [activeCall, setActiveCall] = useState<{ contactName: string; contactPhone: string; profilePicture?: string | null } | null>(null);
  const [transcribingMsgId, setTranscribingMsgId] = useState<string | null>(null);
  const [expandedTranscription, setExpandedTranscription] = useState<string | null>(null);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesScrollAreaRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const followUpMappingsRef = useRef<Record<string, FollowUpMapping>>({}); // convId -> mapping
  const processedFollowUpsRef = useRef<Set<string>>(new Set());
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const [mobileView, setMobileView] = useState<'list' | 'chat'>('list');
  const [contextMenu, setContextMenu] = useState<{ conv: Conversation; x: number; y: number } | null>(null);
   const [elloQuestion, setElloQuestion] = useState('');
   const [waActivationPhone, setWaActivationPhone] = useState('');
  const [showElloPopup, setShowElloPopup] = useState(false);
  const [elloInitialMsg, setElloInitialMsg] = useState('');

  // Cache session token to avoid repeated getSession calls
  const sessionTokenRef = useRef<{ token: string; expires: number } | null>(null);

  const getAuthToken = useCallback(async () => {
    const now = Date.now();
    if (sessionTokenRef.current && sessionTokenRef.current.expires > now) {
      return sessionTokenRef.current.token;
    }
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      toast({ title: 'Sessão expirada', description: 'Faça login novamente.', variant: 'destructive' });
      throw new Error('No session');
    }
    // Cache for 4 minutes (tokens last longer but refresh early)
    sessionTokenRef.current = { token: session.access_token, expires: now + 4 * 60 * 1000 };
    return session.access_token;
  }, [toast]);

  const callApi = useCallback(async (action: string, data: Record<string, unknown> = {}) => {
    const token = await getAuthToken();
    const res = await fetch(
      `https://jwddiyuezqrpuakazvgg.supabase.co/functions/v1/ycloud-api`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp3ZGRpeXVlenFycHVha2F6dmdnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTEzNDIzNTgsImV4cCI6MjA2NjkxODM1OH0.CrUu3HGCfWh6cPfGsbDXGQNG5AWOsi9X2GGix1-7izg',
        },
        body: JSON.stringify({ action, ...data }),
      }
    );

    const json = await res.json();
    if (!res.ok) {
      console.error(`[YCloud API] ${action} failed:`, json);

      if (action === 'connect_call' || action === 'sync_profile_pictures') {
        return {
          success: false,
          ...json,
          status: res.status,
        };
      }

      toast({ title: 'Erro', description: json.error || 'Erro na API', variant: 'destructive' });

      const apiError = new Error(json.error || 'API Error') as Error & {
        details?: Record<string, unknown>;
        status?: number;
        action?: string;
      };
      apiError.details = json;
      apiError.status = res.status;
      apiError.action = action;
      throw apiError;
    }

    return json;
  }, [getAuthToken, toast]);

  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr);
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    if (isToday) return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    if (d.toDateString() === yesterday.toDateString()) return 'Ontem';
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  };

  const formatPhoneDisplay = (phone: string): string => {
    const digits = phone.replace(/\D/g, '');
    if (digits.startsWith('55') && (digits.length === 12 || digits.length === 13)) {
      const ddd = digits.slice(2, 4);
      const number = digits.slice(4);
      if (number.length === 9) return `+55 (${ddd}) ${number.slice(0, 5)}-${number.slice(5)}`;
      if (number.length === 8) return `+55 (${ddd}) ${number.slice(0, 4)}-${number.slice(4)}`;
    }
    return phone.startsWith('+') ? phone : `+${digits}`;
  };

  const normalizeMimeType = (mime: string | null | undefined) => (mime || '').split(';')[0].trim().toLowerCase();

  const YCLOUD_SUPPORTED_AUDIO_MIME_TYPES = new Set([
    'audio/mpeg',
    'audio/mp3',
    'audio/ogg',
    'audio/mp4',
    'audio/aac',
    'audio/amr',
  ]);

  const isYCloudSupportedAudioMime = (mime: string | null | undefined) => {
    const normalized = normalizeMimeType(mime);
    return YCLOUD_SUPPORTED_AUDIO_MIME_TYPES.has(normalized);
  };

  const hasMp3Signature = (bytes: Uint8Array) => {
    if (bytes.length >= 3 && bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33) return true;
    return bytes.length >= 2 && bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0;
  };

  const ensureLameCompatGlobals = async () => {
    const globalScope = globalThis as Record<string, unknown>;
    if (globalScope.MPEGMode && globalScope.Lame && globalScope.BitStream) return;

    const [mpegModeModule, lameModule, bitStreamModule] = await Promise.all([
      import('lamejs/src/js/MPEGMode.js'),
      import('lamejs/src/js/Lame.js'),
      import('lamejs/src/js/BitStream.js'),
    ]);

    globalScope.MPEGMode = (mpegModeModule as { default?: unknown }).default ?? mpegModeModule;
    globalScope.Lame = (lameModule as { default?: unknown }).default ?? lameModule;
    globalScope.BitStream = (bitStreamModule as { default?: unknown }).default ?? bitStreamModule;
  };

  const maybeConvertAudioToMp3 = async (file: File): Promise<File> => {
    const normalizedInputMime = normalizeMimeType(file.type);
    const canKeepOriginal = new Set(['audio/mpeg', 'audio/mp3', 'audio/amr']);

    if (canKeepOriginal.has(normalizedInputMime)) {
      return file;
    }

    const AudioContextCtor = window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextCtor) return file;

    let audioContext: AudioContext | null = null;

    try {
      audioContext = new AudioContextCtor();
      const arrayBuffer = await file.arrayBuffer();
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer.slice(0));

      const channelCount = audioBuffer.numberOfChannels;
      const length = audioBuffer.length;
      const mono = new Float32Array(length);

      for (let ch = 0; ch < channelCount; ch++) {
        const data = audioBuffer.getChannelData(ch);
        for (let i = 0; i < length; i++) {
          mono[i] += data[i] / channelCount;
        }
      }

      const pcm = new Int16Array(length);
      for (let i = 0; i < length; i++) {
        const sample = Math.max(-1, Math.min(1, mono[i]));
        pcm[i] = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
      }

      await ensureLameCompatGlobals();
      const lamejsModule = await import('lamejs');
      const Mp3EncoderCtor = (lamejsModule as any).Mp3Encoder ?? (lamejsModule as any).default?.Mp3Encoder;
      if (!Mp3EncoderCtor) {
        throw new Error('Mp3Encoder não encontrado no lamejs');
      }

      const encoder = new Mp3EncoderCtor(1, audioBuffer.sampleRate, 128);
      const blockSize = 1152;
      const mp3Bytes: number[] = [];

      for (let i = 0; i < pcm.length; i += blockSize) {
        const chunk = pcm.subarray(i, i + blockSize);
        const encoded = encoder.encodeBuffer(chunk);
        if (encoded?.length) mp3Bytes.push(...Array.from(encoded as ArrayLike<number>));
      }

      const flush = encoder.flush();
      if (flush?.length) mp3Bytes.push(...Array.from(flush as ArrayLike<number>));

      if (!mp3Bytes.length) {
        throw new Error('Conversão MP3 retornou vazio');
      }

      const baseName = file.name.replace(/\.[^/.]+$/, '') || `audio-${Date.now()}`;
      const mp3Blob = new Blob([new Uint8Array(mp3Bytes)], { type: 'audio/mpeg' });
      const mp3File = new File([mp3Blob], `${baseName}.mp3`, { type: 'audio/mpeg' });
      const mp3Header = new Uint8Array(await mp3File.arrayBuffer()).subarray(0, 4);
      if (!hasMp3Signature(mp3Header)) {
        throw new Error('Conversão gerou arquivo sem assinatura MP3 válida');
      }
      return mp3File;
    } catch (error) {
      console.error('[YCloud] Falha ao converter áudio para MP3:', error);
      throw new Error('Não foi possível converter o áudio para MP3 compatível com o WhatsApp.');
    } finally {
      if (audioContext && audioContext.state !== 'closed') {
        await audioContext.close().catch(() => undefined);
      }
    }
  };

  // Get company ID
  useEffect(() => {
    const getCompanyId = async () => {
      if (!user?.id) return;
      const { data } = await supabase.from('company_users').select('company_id').eq('user_id', user.id).single();
      if (data?.company_id) setCompanyId(data.company_id);
    };
    getCompanyId();
  }, [user?.id]);

  const loadSessions = async () => {
    try {
      setLoading(true);
      const result = await callApi('list_sessions');
      const sessionsList = result.sessions || [];
      
      // Auto-refresh sessions with missing/test phone numbers
      for (const s of sessionsList) {
        if (!s.phone_number || s.phone_number.includes('15559076450')) {
          try {
            const refreshResult = await callApi('refresh_session', { session_id: s.id });
            if (refreshResult.phone_number) s.phone_number = refreshResult.phone_number;
          } catch {}
        }
      }
      
      setSessions(sessionsList);
      if (sessionsList.length > 0 && !selectedSession) {
        setSelectedSession(sessionsList[0]);
      }
    } catch {} finally {
      setLoading(false);
    }
  };

  const loadCompanies = async () => {
    const { data } = await supabase.from('companies').select('id, name').order('name');
    setCompanies(data || []);
  };

  const loadConversations = async () => {
    if (!selectedSession) return;
    try {
      const result = await callApi('get_conversations', { session_id: selectedSession.id });
      setConversations(prev => {
        const newData = result.conversations || [];
        const prevSig = prev
          .map(c => `${c.id}-${c.last_message_at}-${c.unread_count}-${c.ai_thinking}-${c.assigned_agent_id}-${c.profile_picture || ''}-${c.contact_name || ''}`)
          .join(',');
        const newSig = newData
          .map((c: Conversation) => `${c.id}-${c.last_message_at}-${c.unread_count}-${c.ai_thinking}-${c.assigned_agent_id}-${c.profile_picture || ''}-${c.contact_name || ''}`)
          .join(',');
        if (prevSig === newSig) return prev;
        return newData;
      });
    } catch {}
  };

  const loadMessages = async () => {
    if (!selectedConv || selectedConv.id === 'new') return;
    try {
      const result = await callApi('get_messages', { conversation_id: selectedConv.id });
      const rawMsgs: Message[] = result.messages || [];

      // Group reactions by their target message
      const messageReactions = new Map<string, Record<string, string>>();
      rawMsgs.filter(m => m.message_type === 'reaction').forEach(m => {
        const targetId = m.content; 
        if (targetId && m.reaction) {
          if (!messageReactions.has(targetId)) {
            messageReactions.set(targetId, {});
          }
          const reactions = messageReactions.get(targetId)!;
          // Note: YCloud API might not have sender_name in message type, but let's try to get it from raw_payload or fallback
          const sender = (m.raw_payload as any)?.sender_name || (m.from_me ? 'Me' : 'Contact');
          reactions[sender] = m.reaction;
        }
      });

      // Filter out reaction messages and attach them to target messages
      const serverMsgs = rawMsgs
        .filter(m => m.message_type !== 'reaction')
        .map(m => ({
          ...m,
          reactions: m.id ? messageReactions.get(m.id) : (m.reaction ? { [(m.raw_payload as any)?.sender_name || (m.from_me ? 'Me' : 'Contact')]: m.reaction } : undefined)
        }));

      const last24hWindowFailure = [...serverMsgs].reverse().find((m) => {
        const errorCode = Number((m.raw_payload as Record<string, unknown> | undefined)?.errorCode ?? 0);
        return m.from_me && m.status === 'failed' && errorCode === 131047;
      });

      if (last24hWindowFailure) {
        setWindowClosedNotice('Fora da janela de 24h da Meta para este contato. Só mensagem template aprovada pode ser enviada agora.');
      } else {
        const hasRecentIncoming = serverMsgs.some((m) =>
          !m.from_me && (Date.now() - new Date(m.created_at).getTime()) <= (24 * 60 * 60 * 1000)
        );
        if (hasRecentIncoming) setWindowClosedNotice(null);
      }

      setMessages(prev => {
        // Only keep temp messages that are still "sending" (not yet on server)
        const tempMsgs = prev.filter(m => m.id.startsWith('temp-') && m.status === 'sending');
        // Build a signature set from server messages to detect if temp content already arrived
        const serverContents = new Set(serverMsgs.filter(m => m.from_me).map(m => m.content));
        const pendingTemps = tempMsgs.filter(m => !serverContents.has(m.content));
        
        const prevServerOnly = prev.filter(m => !m.id.startsWith('temp-'));
        const prevSig = prevServerOnly.map(m => `${m.id}-${m.status}`).join(',');
        const newSig = serverMsgs.map((m: Message) => `${m.id}-${m.status}`).join(',');
        if (prevSig === newSig && pendingTemps.length === 0) return prev;

        // Check for new button_reply/list_reply messages to auto-respond
        const convId = selectedConv.id;
        const mapping = followUpMappingsRef.current[convId];
        if (mapping) {
          const prevIds = new Set(prev.map(m => m.id));
          const newIncoming = serverMsgs.filter(m => !m.from_me && !prevIds.has(m.id));
          for (const msg of newIncoming) {
            if (processedFollowUpsRef.current.has(msg.id)) continue;
            try {
              const raw = typeof msg.raw_payload === 'object' ? msg.raw_payload : JSON.parse(msg.content || '{}');
              const interactive = raw?.interactive || raw;
              const btnReply = interactive?.button?.payload || interactive?.button?.text;
              const listReplyId = interactive?.list_reply?.id;
              
              // Match by button ID or title
              let followUpText: string | undefined;
              if (btnReply) {
                // Try matching by ID first, then by title text
                followUpText = Object.entries(mapping).find(([id, _]) => 
                  id === btnReply || btnReply === id
                )?.[1];
                if (!followUpText) {
                  // Match by button title text
                  followUpText = Object.values(mapping).find((_, idx) => {
                    const key = Object.keys(mapping)[idx];
                    return key === btnReply;
                  });
                }
              }
              if (listReplyId && mapping[listReplyId]) {
                followUpText = mapping[listReplyId];
              }

              if (followUpText && selectedSession) {
                processedFollowUpsRef.current.add(msg.id);
                // Auto-send follow-up (fire and forget)
                callApi('send_message', {
                  session_id: selectedSession.id,
                  to: selectedConv.contact_phone,
                  message: followUpText,
                  message_type: 'text',
                }).catch(err => console.error('Auto follow-up error:', err));
              }
            } catch {}
          }
        }

        return [...serverMsgs, ...pendingTemps];
      });
    } catch {}
  };

  const loadAiAgents = async () => {
    if (!companyId) return;
    const { data } = await supabase.from('ai_agents').select('*').eq('company_id', companyId).eq('is_active', true);
    setAiAgents(data || []);
  };

  const loadContacts = async (forceSync = false) => {
    if (!selectedSession) return;
    setContactsLoading(true);
    try {
      // 1. Load from Supabase cache first (instant)
      if (!forceSync) {
        // Fetch all contacts from cache (paginated to bypass 1000 row limit)
        let allCached: any[] = [];
        let from = 0;
        const pageSize = 1000;
        while (true) {
          const { data: page } = await supabase
            .from('ycloud_contacts')
            .select('*')
            .eq('session_id', selectedSession.id)
            .order('contact_name', { ascending: true, nullsFirst: false })
            .range(from, from + pageSize - 1);
          if (!page || page.length === 0) break;
          allCached = allCached.concat(page);
          if (page.length < pageSize) break;
          from += pageSize;
        }
        const cached = allCached;
        
        if (cached && cached.length > 0) {
          const mapped: Conversation[] = cached.map(c => ({
            id: c.conversation_id || c.id,
            contact_phone: c.contact_phone,
            contact_name: c.contact_name,
            last_message: null,
            last_message_at: c.last_message_at || c.updated_at,
            unread_count: 0,
            profile_picture: c.profile_picture,
            status: c.status || 'active',
            source: c.source,
            has_conversation: c.has_conversation,
          }));
          setContactsList(mapped);
          setContactsLoading(false);
          // Sync from API in background
          callApi('get_contacts', { session_id: selectedSession.id }).then(result => {
            if (result?.contacts?.length) {
              setContactsList(result.contacts);
            }
          }).catch(() => {});
          return;
        }
      }

      // 2. No cache or force sync: fetch from API
      const result = await callApi('get_contacts', { session_id: selectedSession.id });
      setContactsList(result.contacts || []);
    } catch (error) {
      console.error('[YCloud Contacts] Failed loading contacts:', error);
      setContactsList([]);
      toast({ title: 'Erro ao carregar contatos', description: 'Não foi possível buscar os contatos no YCloud.', variant: 'destructive' });
    } finally {
      setContactsLoading(false);
    }
  };

  const handleOpenContacts = () => {
    setShowContactsList(true);
    loadContacts();
  };

  useEffect(() => { loadSessions(); loadCompanies(); }, []);
  useEffect(() => { if (companyId) loadAiAgents(); }, [companyId]);
  
  // Merge duplicates and sync profile pictures on first session load
  useEffect(() => {
    if (selectedSession) {
      callApi('merge_duplicates', { session_id: selectedSession.id }).catch(() => {});
      // Auto-sync profile pictures from Baileys sessions
      callApi('sync_profile_pictures', { session_id: selectedSession.id })
        .then(res => {
          if (res?.updated > 0) {
            console.log(`[YCloud] Synced ${res.updated} profile pictures from Baileys`);
          }
        })
        .catch(() => {});
      loadConversations();
      const interval = setInterval(loadConversations, 3000);
      return () => clearInterval(interval);
    }
  }, [selectedSession]);

  // Avatar generation removed - using initials instead
  
  // Keep selected conversation always synced (including avatar updates)
  useEffect(() => {
    if (selectedConv && selectedConv.id !== 'new') {
      const updated = conversations.find(c => c.id === selectedConv.id);
      if (updated && updated !== selectedConv) {
        setSelectedConv(updated);
      }
    }
  }, [conversations, selectedConv]);

  useEffect(() => {
    if (selectedConv && selectedConv.id !== 'new') {
      loadMessages();
      pollRef.current = setInterval(loadMessages, 2000);
      return () => { if (pollRef.current) clearInterval(pollRef.current); };
    }
  }, [selectedConv]);

  // Reset scroll state and window notice when conversation changes
  useEffect(() => {
    setShowScrollToBottom(false);
    setWindowClosedNotice(null);
  }, [selectedConv?.id]);

  useEffect(() => {
    if (!showScrollToBottom && messagesEndRef.current) {
      // Use instant scroll on first load, smooth on updates
      const isInitialLoad = messages.length > 0 && !pollRef.current;
      messagesEndRef.current.scrollIntoView({ behavior: isInitialLoad ? 'instant' : 'smooth' });
      // Also force with a small delay for layout settling
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'instant' });
      }, 100);
    }
  }, [messages]);

  // Detect scroll position
  useEffect(() => {
    const viewport = messagesScrollAreaRef.current?.querySelector('[data-radix-scroll-area-viewport]') as HTMLElement | null;
    if (!viewport) return;
    const onScroll = () => {
      const dist = viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight;
      setShowScrollToBottom(dist > 150);
    };
    viewport.addEventListener('scroll', onScroll);
    return () => viewport.removeEventListener('scroll', onScroll);
  }, [selectedConv]);

  // Mobile back button
  useEffect(() => {
    if (!isMobile || mobileView !== 'chat') return;
    window.history.pushState({ ycloudChat: true }, '');
    const handlePopState = () => {
      setMobileView('list');
      setSelectedConv(null);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [isMobile, mobileView]);

   if (!user || statusLoading || adminLoading) return <div className="flex h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-[#374DA4]" /></div>;
 
   if (status !== 'approved') {
     return <Navigate to="/pending-approval" replace />;
   }

  const handleCreateSession = async () => {
    if (!setupApiKey || !setupCompanyId) {
      toast({ title: 'Preencha todos os campos', variant: 'destructive' });
      return;
    }
    try {
      setCreatingSession(true);
      await callApi('create_session', { company_id: setupCompanyId, api_key: setupApiKey });
      setShowSetup(false);
      setSetupApiKey('');
      loadSessions();
    } catch {} finally {
      setCreatingSession(false);
    }
  };

  const handleDeleteSession = async (id: string) => {
    if (!confirm('Remover esta sessão?')) return;
    try {
      await callApi('delete_session', { session_id: id });
      
      if (selectedSession?.id === id) {
        setSelectedSession(null);
        setConversations([]);
        setSelectedConv(null);
        setMessages([]);
      }
      loadSessions();
    } catch {}
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !selectedSession || sending) return;

    if (windowClosedNotice) {
      toast({
        title: 'Janela de 24h encerrada',
        description: 'Para este contato, envie uma mensagem template aprovada pela Meta.',
        variant: 'destructive',
      });
      return;
    }

    const targetPhone = selectedConv?.contact_phone || newPhone;
    if (!targetPhone) {
      toast({ title: 'Informe o número do destinatário', variant: 'destructive' });
      return;
    }
    
    
    // Optimistic UI
    const tempId = `temp-${Date.now()}`;
    const optimisticMsg: Message = {
      id: tempId,
      from_me: true,
      content: newMessage,
      message_type: 'text',
      media_url: null,
      status: 'sending',
      created_at: new Date().toISOString(),
    };
    setMessages(prev => [...prev, optimisticMsg]);
    const msgText = newMessage;
    // Use wamid first, fallback to ycloud_message_id
    const replyMsgId = replyTo?.wamid || (replyTo as any)?.ycloud_message_id || null;
    const replyToRef = replyTo;
    setNewMessage('');
    setReplyTo(null);
    
    try {
      setSending(true);
      const sendPayload: any = {
        session_id: selectedSession.id,
        to: targetPhone,
        message: msgText,
      };
      if (replyMsgId) {
        sendPayload.context_message_id = replyMsgId;
        console.log('[YCloud Reply] Sending with context:', replyMsgId, 'from msg:', replyToRef?.id);
      }
      await callApi('send_message', sendPayload);
      // Update optimistic msg
      setMessages(prev => prev.map(m => m.id === tempId ? { ...m, status: 'sent' } : m));
      
      if (selectedConv?.id === 'new') {
        setShowNewChat(false);
        setNewPhone('');
        // Reload conversations and auto-select the new one
        const result = await callApi('get_conversations', { session_id: selectedSession.id });
        const convs = result.conversations || [];
        setConversations(convs);
        const newConv = convs.find((c: Conversation) => c.contact_phone === targetPhone);
        if (newConv) {
          setSelectedConv(newConv);
        } else {
          setSelectedConv(null);
        }
      }
    } catch (err) {
      setMessages(prev => prev.map(m => m.id === tempId ? { ...m, status: 'failed' } : m));

      const errorWithDetails = err as Error & { details?: Record<string, unknown> };
      const errorCode = Number(errorWithDetails?.details?.ycloud_error_code ?? 0);
      if (errorCode === 131047) {
        setWindowClosedNotice('Fora da janela de 24h da Meta para este contato. Só mensagem template aprovada pode ser enviada agora.');
        toast({
          title: 'Janela de 24h encerrada',
          description: 'Esse contato precisa receber template aprovado para reabrir a conversa.',
          variant: 'destructive',
        });
      }
    } finally {
      setSending(false);
    }
  };

  const handleAssignAgent = async (conv: Conversation, agentId: string | null) => {
    if (!conv.id || conv.id === 'new') return;
    
    // Update in database via API
    try {
      await callApi('assign_agent', { conversation_id: conv.id, agent_id: agentId });
    } catch { /* continue with local update */ }

    setConversations(prev => prev.map(c =>
      c.id === conv.id ? { ...c, assigned_agent_id: agentId || undefined } : c
    ));
    if (selectedConv?.id === conv.id) {
      setSelectedConv({ ...conv, assigned_agent_id: agentId || undefined });
    }
    
  };

  const handleCopyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      toast({ title: 'Erro ao copiar', variant: 'destructive' });
    }
  };

  const handleMediaUpload = async (file: File, type: 'image' | 'audio' | 'video' | 'document') => {
    if (!selectedSession || !selectedConv) return;
    const targetPhone = selectedConv.contact_phone;
    if (!targetPhone) return;

    let tempId: string | null = null;

    try {
      setUploadingMedia(true);

      const uploadFile = type === 'audio' ? await maybeConvertAudioToMp3(file) : file;

      if (type === 'audio' && !isYCloudSupportedAudioMime(uploadFile.type)) {
        throw new Error('Seu navegador gerou um formato de áudio não suportado (webm). Tente outro navegador/dispositivo ou envie um .mp3/.m4a.');
      }

      // Upload to supabase storage first
      const fileExt = uploadFile.name.split('.').pop() || 'bin';
      const fileName = `ycloud/${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
      
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('whatsapp-media')
        .upload(fileName, uploadFile, { 
          cacheControl: '3600', 
          upsert: false,
          contentType: uploadFile.type || 'application/octet-stream',
        });

      if (uploadError) {
        console.error('[YCloud] Upload error:', uploadError);
        toast({ title: 'Erro no upload', description: uploadError.message, variant: 'destructive' });
        return;
      }

      const { data: publicUrlData } = supabase.storage.from('whatsapp-media').getPublicUrl(uploadData.path);
      const mediaUrl = publicUrlData.publicUrl;
      console.log('[YCloud] Media uploaded to storage:', mediaUrl, 'type:', type, 'contentType:', uploadFile.type);

      // Optimistic UI
      tempId = `temp-${Date.now()}`;
      const optimisticMsg: Message = {
        id: tempId,
        from_me: true,
        content: type === 'image' ? '📷 Foto' : type === 'audio' ? '🎵 Áudio' : type === 'video' ? '🎬 Vídeo' : '📄 Documento',
        message_type: type,
        media_url: mediaUrl,
        status: 'sending',
        created_at: new Date().toISOString(),
      };
      setMessages(prev => [...prev, optimisticMsg]);

      let mediaId: string | null = null;
      let uploadedMediaMime: string | null = normalizeMimeType(uploadFile.type) || null;

      if (type !== 'audio') {
        try {
          console.log('[YCloud] Uploading media to YCloud media API...');
          const uploadResult = await callApi('upload_media', {
            session_id: selectedSession.id,
            media_url: mediaUrl,
            content_type: uploadFile.type || 'application/octet-stream',
            file_name: uploadFile.name,
          });
          mediaId = uploadResult.media_id;
          uploadedMediaMime = uploadResult.media_mime_type || uploadedMediaMime;
          console.log('[YCloud] Got media_id:', mediaId, 'mime:', uploadedMediaMime);
        } catch (err) {
          console.error('[YCloud] YCloud media upload failed, falling back to link:', err);
        }
      }

      const sendResult = await callApi('send_message', {
        session_id: selectedSession.id,
        to: targetPhone,
        message: uploadFile.name,
        message_type: type,
        media_url: mediaUrl,
        media_mime_type: uploadedMediaMime,
        ...(mediaId ? { media_id: mediaId } : {}),
      });

      setMessages(prev => prev.map(m => m.id === tempId ? { ...m, status: 'sent' } : m));
      
    } catch (err) {
      if (tempId) {
        setMessages(prev => prev.map(m => m.id === tempId ? { ...m, status: 'failed' } : m));
      }
      console.error('[YCloud] Media send error:', err);
      toast({
        title: 'Erro ao enviar mídia',
        description: err instanceof Error ? err.message : 'Falha inesperada no envio',
        variant: 'destructive',
      });
    } finally {
      setUploadingMedia(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>, type: 'image' | 'document') => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    if (type === 'image' && !file.type.startsWith('image/')) {
      toast({ title: 'Selecione uma imagem', variant: 'destructive' });
      return;
    }
    
    const fileType = file.type.startsWith('image/') ? 'image' 
      : file.type.startsWith('audio/') ? 'audio'
      : file.type.startsWith('video/') ? 'video' 
      : 'document';
    
    handleMediaUpload(file, type === 'image' ? 'image' : fileType);
    e.target.value = '';
  };

  // Audio Recording
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      // Prioritize WhatsApp-compatible formats per YCloud docs.
      const preferredMimeTypes = [
        'audio/ogg;codecs=opus',
        'audio/mp4;codecs=mp4a.40.2',
        'audio/aac',
        'audio/mp4',
        'audio/webm;codecs=opus',
        'audio/webm',
      ];

      let mimeType = '';
      for (const candidate of preferredMimeTypes) {
        if (MediaRecorder.isTypeSupported(candidate)) {
          mimeType = candidate;
          break;
        }
      }

      const options: MediaRecorderOptions = mimeType ? { mimeType } : {};
      const mediaRecorder = new MediaRecorder(stream, options);
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach(track => track.stop());

        const actualMime = mediaRecorder.mimeType || 'audio/webm';
        const normalizedMime = actualMime.split(';')[0].trim().toLowerCase() || 'audio/webm';
        const fallbackExt = normalizedMime.includes('ogg')
          ? 'ogg'
          : normalizedMime.includes('mp4')
            ? 'm4a'
            : normalizedMime.includes('mpeg') || normalizedMime.includes('mp3')
              ? 'mp3'
              : 'webm';
        const audioBlob = new Blob(audioChunksRef.current, { type: normalizedMime });

        const audioFile = new File([audioBlob], `audio-${Date.now()}.${fallbackExt}`, { type: normalizedMime });

        await handleMediaUpload(audioFile, 'audio');
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);
      recordingIntervalRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    } catch {
      toast({ title: 'Permissão de microfone negada', description: 'Permita o acesso ao microfone para gravar áudio.', variant: 'destructive' });
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
        recordingIntervalRef.current = null;
      }
      setRecordingTime(0);
    }
  };

  const cancelRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.ondataavailable = null;
      mediaRecorderRef.current.onstop = null;
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
        recordingIntervalRef.current = null;
      }
      setRecordingTime(0);
      audioChunksRef.current = [];
    }
  };

  const formatRecordingTime = (seconds: number) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  // Chatbot
  const handleStartChatbot = (conv: Conversation) => {
    setChatbotConv(conv);
    setShowStartChatbot(true);
  };

  const handleArchiveConversation = async (conv: Conversation) => {
    if (!conv.id || conv.id === 'new') return;
    try {
      await supabase.from('ycloud_conversations').update({ status: 'archived' } as any).eq('id', conv.id);
      if (selectedConv?.id === conv.id) {
        setSelectedConv(null);
        setMessages([]);
      }
      setConversations(prev => prev.filter(c => c.id !== conv.id));
      toast({ title: 'Conversa arquivada' });
    } catch {
      toast({ title: 'Erro ao arquivar', variant: 'destructive' });
    }
  };

  const handleAiAnalyzeConversation = async () => {
    if (!selectedConv || messages.length === 0) return;
    setAiAnalysis({ loading: true, result: null, type: 'conversation' });
    setShowAiAnalysis(true);
    try {
      const transcript = messages.slice(-50).map(m => {
        const sender = m.from_me ? 'Atendente' : (selectedConv.contact_name || selectedConv.contact_phone);
        const time = new Date(m.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
        if (m.message_type === 'audio' && m.transcription) {
          return `[${time}] ${sender}: [Áudio transcrito] ${m.transcription}`;
        }
        return `[${time}] ${sender}: ${m.content || `[${m.message_type}]`}`;
      }).join('\n');
      const { data, error } = await supabase.functions.invoke('ai-chat', {
        body: {
          messages: [
            { role: 'system', content: 'Você é um analista especialista em vendas e atendimento via WhatsApp. Analise a conversa e forneça um feedback completo e estratégico incluindo:\n\n1) RESUMO DA CONVERSA - O que foi discutido de forma objetiva.\n\n2) TEMPERAMENTO DO LEAD - Classifique o lead em uma das categorias abaixo e justifique:\n- QUENTE: Demonstra alto interesse, faz perguntas sobre preço/condições, quer fechar.\n- MORNO: Tem interesse mas ainda está avaliando, faz perguntas genéricas.\n- FRIO: Pouco engajamento, respostas curtas, sem demonstração de interesse.\n- MORTO: Não responde, pediu para parar de enviar mensagens, ou rejeitou claramente.\n- FECHADO: Já fechou negócio ou confirmou compra/contratação.\n\n3) SENTIMENTO GERAL - Como o cliente se sente na conversa (satisfeito, frustrado, ansioso, neutro, etc).\n\n4) PONTOS POSITIVOS - O que o atendente fez bem.\n\n5) PONTOS DE MELHORIA - O que poderia ser melhor no atendimento.\n\n6) SUGESTAO DE ETIQUETA - Sugira uma etiqueta para categorizar esta conversa (ex: "Lead Quente", "Suporte Técnico", "Pós-venda", "Orçamento Pendente", etc).\n\n7) DICAS PARA FECHAMENTO - Se o lead demonstra potencial de compra, forneça dicas práticas e específicas de como conduzir o fechamento. Se não for caso de venda, sugira próximos passos adequados.\n\nIMPORTANTE: Na PRIMEIRA LINHA da resposta, escreva EXATAMENTE: TEMPERATURA: [VALOR] (onde VALOR é QUENTE, MORNO, FRIO, MORTO ou FECHADO). Depois pule uma linha e continue com a análise.\n\nResponda em português brasileiro de forma estruturada e limpa. NÃO use markdown, asteriscos, hashtags ou formatação especial. Escreva em texto corrido com parágrafos limpos. Use números para listar itens. Não use ** nem ### nem > nem nenhum símbolo de formatação.' },
            { role: 'user', content: `Analise esta conversa:\n\n${transcript}` }
          ]
        }
      });
      if (error) throw error;
      const responseText = data?.response || 'Sem resposta';
      // Parse temperature from first line
      const tempMatch = responseText.match(/^TEMPERATURA:\s*(QUENTE|MORNO|FRIO|MORTO|FECHADO)/i);
      const detectedTemp = tempMatch ? tempMatch[1].toUpperCase() : null;
      const cleanResult = tempMatch ? responseText.replace(/^TEMPERATURA:\s*\w+\n*/, '').trim() : responseText;
      setAiAnalysis({ loading: false, result: cleanResult, type: 'conversation', detectedTemperature: detectedTemp });
    } catch (e) {
      console.error('AI analysis error:', e);
      setAiAnalysis({ loading: false, result: 'Erro ao analisar conversa. Tente novamente.', type: 'conversation' });
    }
  };

  const handleAiAnalyzeMessage = async (msg: Message) => {
    setMsgMenu(null);
    const msgContent = msg.message_type === 'audio' && msg.transcription ? `[Áudio transcrito] ${msg.transcription}` : (msg.content || `[${msg.message_type}]`);
    setAiAnalysis({ loading: true, result: null, type: 'message', messageContent: msgContent });
    setShowAiAnalysis(true);
    try {
      const context = messages.slice(-20).map(m => {
        if (m.message_type === 'audio' && m.transcription) return `[${m.from_me ? 'Atendente' : 'Cliente'}]: [Áudio transcrito] ${m.transcription}`;
        return `[${m.from_me ? 'Atendente' : 'Cliente'}]: ${m.content || `[${m.message_type}]`}`;
      }).join('\n');
      const { data, error } = await supabase.functions.invoke('ai-chat', {
        body: {
          messages: [
            { role: 'system', content: 'Você é um assistente de atendimento via WhatsApp. Analise a mensagem destacada no contexto da conversa e prepare uma sugestão de resposta profissional e empática. Forneça: 1) Interpretação da mensagem, 2) Sugestão de resposta (pronta para copiar e enviar ao cliente). Responda em português brasileiro de forma limpa. IMPORTANTE: NÃO use markdown, asteriscos, hashtags ou formatação especial. Escreva em texto corrido natural. Use números para listar itens. Não use ** nem ### nem > nem nenhum símbolo de formatação.' },
            { role: 'user', content: `Contexto da conversa:\n${context}\n\nMensagem para analisar:\n"${msgContent}"` }
          ]
        }
      });
      if (error) throw error;
      setAiAnalysis({ loading: false, result: data?.response || 'Sem resposta', type: 'message', messageContent: msg.content || `[${msg.message_type}]` });
    } catch (e) {
      console.error('AI analysis error:', e);
      setAiAnalysis({ loading: false, result: 'Erro ao analisar mensagem. Tente novamente.', type: 'message' });
    }
  };

  const handleTranscribeAudio = async (msg: Message) => {
    if (!msg.media_url || transcribingMsgId) return;
    setTranscribingMsgId(msg.id);
    try {
      const { data, error } = await supabase.functions.invoke('elevenlabs-stt', {
        body: { audio_url: msg.media_url, message_id: msg.id }
      });
      if (error) throw error;
      const text = data?.text || 'Não foi possível transcrever';
      setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, transcription: text } : m));
      setExpandedTranscription(msg.id);
      toast({ title: 'Áudio transcrito', description: 'Transcrição salva com sucesso.' });
    } catch (e) {
      console.error('Transcription error:', e);
      toast({ title: 'Erro ao transcrever', description: 'Tente novamente.', variant: 'destructive' });
    } finally {
      setTranscribingMsgId(null);
    }
  };

  const handleDeleteConversation = async (conv: Conversation) => {
    if (!conv.id || conv.id === 'new') return;
    if (!window.confirm(`Excluir conversa com ${conv.contact_name || conv.contact_phone}? As mensagens serão perdidas.`)) return;
    try {
      // Delete messages first, then conversation
      await supabase.from('ycloud_messages').delete().eq('conversation_id', conv.id);
      await supabase.from('ycloud_conversations').delete().eq('id', conv.id);
      if (selectedConv?.id === conv.id) {
        setSelectedConv(null);
        setMessages([]);
      }
      setConversations(prev => prev.filter(c => c.id !== conv.id));
      toast({ title: 'Conversa excluída' });
    } catch {
      toast({ title: 'Erro ao excluir', variant: 'destructive' });
    }
  };

  

  const filteredConversations = conversations.filter(conv => {
    if (conv.status === 'archived') return false;
    const matchesSearch = !searchQuery || 
      (conv.contact_name?.toLowerCase().includes(searchQuery.toLowerCase())) ||
      conv.contact_phone.includes(searchQuery);
    const matchesTab = activeTab === 'all' || (activeTab === 'unread' && (conv.unread_count || 0) > 0);
    return matchesSearch && matchesTab;
  });

  const totalUnread = conversations.reduce((acc, c) => acc + (c.unread_count || 0), 0);

  const formatPhoneMask = (value: string) => {
    const digits = value.replace(/\D/g, '');
    if (digits.length === 0) return '';
    if (digits.length <= 2) return `+${digits}`;
    if (digits.length <= 4) return `+${digits.slice(0, 2)} (${digits.slice(2)}`;
    if (digits.length <= 9) return `+${digits.slice(0, 2)} (${digits.slice(2, 4)}) ${digits.slice(4)}`;
    if (digits.length <= 13) return `+${digits.slice(0, 2)} (${digits.slice(2, 4)}) ${digits.slice(4, 9)}-${digits.slice(9, 13)}`;
    return `+${digits.slice(0, 2)} (${digits.slice(2, 4)}) ${digits.slice(4, 9)}-${digits.slice(9, 13)}`;
  };

  const handlePhoneInput = (value: string) => {
    const digits = value.replace(/\D/g, '');
    if (digits.length <= 13) {
      setNewPhone(formatPhoneMask(value));
    }
  };

  const getRawPhone = (formatted: string) => {
    const digits = formatted.replace(/\D/g, '');
    return digits.startsWith('55') ? `+${digits}` : `+55${digits}`;
  };

  const startNewChat = () => {
    if (!newPhone.trim()) return;
    const raw = getRawPhone(newPhone);
    setSelectedConv({
      id: 'new',
      contact_phone: raw,
      contact_name: null,
      last_message: null,
      last_message_at: new Date().toISOString(),
      unread_count: 0,
    });
    setMessages([]);
    setShowNewChat(false);
    if (isMobile) setMobileView('chat');
  };

  const getAgentForConv = (conv: Conversation) => {
    if (!conv.assigned_agent_id) return null;
    return aiAgents.find(a => a.id === conv.assigned_agent_id) || null;
  };

   // No sessions yet - show activation form
   if (!loading && sessions.length === 0) {
     const handleActivateWhatsApp = () => {
       if (!waActivationPhone.trim()) {
         toast({ title: "Atenção", description: "Informe o número que deseja conectar.", variant: "destructive" });
         return;
       }
       const email = user?.email || 'N/A';
       const phone = waActivationPhone;
       const text = `Olá, gostaria de ativar o CRM Ello com WhatsApp API na minha conta.\n\nE-mail da conta: ${email}\nNúmero a conectar: ${phone}`;
       const encodedText = encodeURIComponent(text);
       window.open(`https://wa.me/5541989015612?text=${encodedText}`, '_blank');
     };
 
     return (
       <div className="flex h-screen bg-background">
         {!isMobile && <CRMSidebar />}
          <div className="flex-1 flex items-center justify-center p-6 md:p-12 bg-background">
            <div className="w-full max-w-md animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="mb-10">
                <div className="inline-flex items-center gap-2 mb-6">
                  <div className="h-10 w-10 rounded-xl bg-[#374DA4]/10 flex items-center justify-center">
                    <MessageSquare className="h-5 w-5 text-[#374DA4]" />
                  </div>
                  <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">CRM Ello</span>
                </div>
                <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-foreground leading-tight">
                  Ative seu CRM
                </h1>
                <p className="mt-4 text-base text-muted-foreground leading-relaxed">
                  Conecte-se à API Oficial do WhatsApp (Meta). Nossa equipe ativa o módulo em poucos minutos — informe o número que deseja utilizar.
                </p>
              </div>

              <form
                onSubmit={(e) => { e.preventDefault(); handleActivateWhatsApp(); }}
                className="space-y-6"
              >
                <div className="space-y-2">
                  <label htmlFor="wa-activation-phone" className="text-sm font-medium text-foreground">
                    Número de WhatsApp
                  </label>
                  <div className="relative group">
                    <Phone className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-[#374DA4] transition-colors" />
                    <Input
                      id="wa-activation-phone"
                      placeholder="(00) 00000-0000"
                      value={waActivationPhone}
                      onChange={e => setWaActivationPhone(formatPhoneMask(e.target.value))}
                      className="pl-11 h-12 rounded-xl border-border bg-background focus-visible:ring-2 focus-visible:ring-[#374DA4]/30 focus-visible:border-[#374DA4] transition-all"
                    />
                  </div>
                </div>

                <Button
                  type="submit"
                  className="w-full h-12 bg-foreground hover:bg-foreground/90 text-background rounded-xl text-sm font-semibold transition-all gap-2"
                >
                  Falar com a Equipe
                  <MessageCircle className="h-4 w-4" />
                </Button>

                <p className="text-xs text-muted-foreground text-center leading-relaxed">
                  Ao continuar, você será redirecionado para o nosso WhatsApp oficial com os dados pré-preenchidos.
                </p>
              </form>
            </div>
          </div>
       </div>
     );
   }

  function renderSetupDialog() {
    const isConnected = sessions.length > 0;
    return (
      <Dialog open={showSetup} onOpenChange={setShowSetup}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CloudCog className="h-5 w-5 text-[#374DA4]" /> Configurações YCloud
            </DialogTitle>
          </DialogHeader>
          {isConnected ? (
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-4 rounded-xl bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800">
                <div className="h-10 w-10 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <p className="font-semibold text-green-800 dark:text-green-300">Conectado</p>
                  <p className="text-xs text-green-600 dark:text-green-400">API YCloud ativa • {sessions.length} sessão(ões)</p>
                </div>
              </div>
              {sessions.map(s => (
                <div key={s.id} className="flex items-center justify-between p-3 rounded-xl bg-muted/50">
                  <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">{s.phone_number || 'Sem número'}</p>
                      <p className="text-xs text-muted-foreground">WABA: {s.waba_id || 'N/A'}</p>
                    </div>
                  </div>
                  <Badge className={s.status === 'active' ? 'bg-green-600 text-white' : 'bg-muted'}>
                    {s.status}
                  </Badge>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">Empresa</label>
                <select className="w-full mt-1 rounded-xl border border-border bg-background px-3 py-2.5 text-sm"
                  value={setupCompanyId} onChange={e => setSetupCompanyId(e.target.value)}>
                  <option value="">Selecione...</option>
                  {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium">YCloud API Key</label>
                <Input type="password" value={setupApiKey} onChange={e => setSetupApiKey(e.target.value)}
                  placeholder="Cole sua API Key" className="mt-1 rounded-xl" />
                <p className="text-xs text-muted-foreground mt-1">YCloud Dashboard → Settings → API Keys</p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSetup(false)} className="rounded-xl">Fechar</Button>
            {!isConnected && (
              <Button onClick={handleCreateSession} disabled={creatingSession} className="bg-[#374DA4] hover:bg-[#374DA4]/90 rounded-xl">
                {creatingSession && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Conectar
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  // Main CRM layout
  return (
    <div className="flex flex-col h-[100dvh] overflow-hidden bg-background">
      {/* Top header — Ello Omni branding + back to Dashboard */}
      <header
        className="shrink-0 flex items-center justify-between gap-2 border-b border-border bg-background px-3"
        style={{
          paddingTop: isMobile ? 'calc(0.5rem + env(safe-area-inset-top))' : undefined,
          height: isMobile ? undefined : '3rem',
          minHeight: isMobile ? 'calc(3rem + env(safe-area-inset-top))' : undefined,
        }}
      >
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('/dashboard')}
          className="h-9 px-2 gap-1 text-foreground hover:bg-muted"
          title="Voltar para o Dashboard"
        >
          <ArrowLeft className="h-4 w-4" />
          <span className="text-xs font-medium hidden sm:inline">Dashboard</span>
        </Button>
        <div className="flex items-center gap-2">
          <ElloLogo className="h-6 w-auto" color="#374DA4" />
          <span className="text-sm font-bold tracking-tight" style={{ color: '#374DA4' }}>Ello</span>
        </div>
        <div className="w-9 h-9" aria-hidden />
      </header>

      <div className="flex flex-1 min-h-0 overflow-hidden">
      {!isMobile && <CRMSidebar />}

      {/* Conversation List */}
      <div className={cn(
        "w-full md:w-96 lg:w-[400px] border-r flex flex-col bg-card",
        isMobile ? (mobileView === 'list' ? 'w-full' : 'hidden') : '',
        isMobile && mobileView !== 'list' && 'hidden md:flex'
      )}>
        {/* Header */}
        <div className={cn(
          "px-3 flex items-center gap-2 border-b border-border bg-background",
          isMobile ? "py-2 min-h-[3rem]" : "h-14"
        )}>
          <div className="flex-1 min-w-0">
            <Button
              variant="ghost"
              className="px-2 py-1 h-auto text-left hover:bg-muted/50 rounded-lg"
              onClick={() => setShowSetup(true)}
            >
              <p className="text-sm font-bold text-foreground truncate flex items-center gap-1.5">
                {selectedSession?.phone_number ? formatPhoneDisplay(selectedSession.phone_number) : 'Ellosuit CRM'}
                {selectedSession?.status === 'active' && <CheckCircle className="h-3.5 w-3.5 text-green-500 shrink-0" />}
              </p>
            </Button>
          </div>
          <Button size="icon" variant="ghost" className="text-foreground hover:bg-muted h-8 w-8" onClick={() => { setSelectedConv(null); setMessages([]); }} title="Início">
            <Home className="h-4 w-4" />
          </Button>
          <Button size="icon" variant="ghost" className="text-foreground hover:bg-muted h-8 w-8" onClick={handleOpenContacts} title="Contatos">
            <Users className="h-4 w-4" />
          </Button>
          <Button size="icon" variant="ghost" className="text-foreground hover:bg-muted h-8 w-8" onClick={() => navigate('/dashboard/cadastros')} title="Cadastros">
            <UserPlus className="h-4 w-4" />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="icon" variant="ghost" className="text-foreground hover:bg-muted h-8 w-8">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onClick={() => setShowSetup(true)}>
                <Settings className="h-4 w-4 mr-2" /> Configurações
              </DropdownMenuItem>
              <DropdownMenuItem onClick={loadConversations}>
                <RefreshCw className="h-4 w-4 mr-2" /> Atualizar
              </DropdownMenuItem>
              {selectedSession && companyId && (
                <DropdownMenuItem
                  onClick={async () => {
                    toast({ title: 'Sincronizando fotos e nomes...', description: 'Isso pode levar alguns segundos.' });
                    try {
                      const { data, error } = await supabase.functions.invoke('whatsapp-sync-profile-pictures', {
                        body: { company_id: companyId, limit: 300, force: true }
                      });
                      if (error) throw error;
                      toast({ title: 'Sincronização concluída', description: `Atualizados: ${data?.updated ?? 0}` });
                      loadConversations();
                    } catch (e: any) {
                      toast({ title: 'Erro ao sincronizar', description: e?.message || 'Tente novamente.', variant: 'destructive' });
                    }
                  }}
                >
                  <CloudCog className="h-4 w-4 mr-2" /> Sincronizar fotos e nomes
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              {selectedSession && (
                <DropdownMenuItem onClick={() => handleDeleteSession(selectedSession.id)} className="text-destructive">
                  <Trash2 className="h-4 w-4 mr-2" /> Remover sessão
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Search */}
        <div className="p-2 border-b border-border">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar conversas..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
              className="pl-9 rounded-xl bg-muted/50 border-0 h-9 text-sm" />
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 px-2 py-1.5 border-b border-border">
          <button onClick={() => setActiveTab('all')} className={cn(
            "px-3 py-1 rounded-full text-xs font-medium transition-colors",
            activeTab === 'all' ? "bg-[#374DA4] text-white" : "text-muted-foreground hover:bg-muted"
          )}>Todas</button>
          <button onClick={() => setActiveTab('unread')} className={cn(
            "px-3 py-1 rounded-full text-xs font-medium transition-colors flex items-center gap-1",
            activeTab === 'unread' ? "bg-[#374DA4] text-white" : "text-muted-foreground hover:bg-muted"
          )}>
            Não lidas
            {totalUnread > 0 && <span className="bg-white/20 text-white px-1.5 rounded-full text-[10px]">{totalUnread}</span>}
          </button>
        </div>

        {/* New Chat */}
        <div className="p-2 border-b border-border">
          {showNewChat ? (
            <div className="flex gap-2">
              <Input placeholder="+55 (11) 99999-9999" value={newPhone} onChange={e => handlePhoneInput(e.target.value)}
                className="text-sm rounded-xl h-9" onKeyDown={e => e.key === 'Enter' && startNewChat()} />
              <Button size="sm" className="bg-[#374DA4] hover:bg-[#374DA4]/90 rounded-xl h-9 px-3" onClick={startNewChat}>
                <Send className="h-3.5 w-3.5" />
              </Button>
              <Button size="sm" variant="ghost" className="h-9 px-2" onClick={() => { setShowNewChat(false); setNewPhone(''); }}>✕</Button>
            </div>
          ) : (
            <Button variant="ghost" className="w-full justify-start text-sm text-[#374DA4] hover:bg-[#374DA4]/5 rounded-xl h-9"
              onClick={() => setShowNewChat(true)}>
              <Plus className="h-4 w-4 mr-2" /> Nova conversa
            </Button>
          )}
        </div>

        {/* Conversations */}
        <ScrollArea className="flex-1">
          {loading ? (
            <div className="p-3 space-y-3">
              {[1,2,3].map(i => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}
            </div>
          ) : filteredConversations.length === 0 ? (
            <div className="p-6 text-center text-muted-foreground text-sm">
              <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-30" />
              {searchQuery ? 'Nenhuma conversa encontrada' : 'Nenhuma conversa'}
            </div>
          ) : (
            <div className="divide-y">
              {filteredConversations.map(conv => {
                const agent = getAgentForConv(conv);
                return (
                  <div key={conv.id}
                    onClick={() => { setContextMenu(null); setSelectedConv(conv); if (isMobile) setMobileView('chat'); }}
                    onContextMenu={(e) => { e.preventDefault(); setContextMenu({ conv, x: e.clientX, y: e.clientY }); }}
                    className={cn(
                      "flex items-center gap-3 p-4 hover:bg-muted/50 transition-colors cursor-pointer relative",
                      selectedConv?.id === conv.id && "bg-muted"
                    )}
                  >
                    <div className="relative">
                      <Avatar className="h-12 w-12">
                        
                        <AvatarFallback className="bg-[#374DA4]/10 text-[#374DA4]">
                          {(conv.contact_name || conv.contact_phone).substring(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      {agent && (
                        <div className="absolute -bottom-1 -right-1 p-1 bg-gradient-to-br from-violet-500 to-purple-600 rounded-full shadow-lg">
                          <Bot className="h-3 w-3 text-white" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <div className="flex items-center gap-2 min-w-0 overflow-hidden">
                          <span className="font-medium truncate">{conv.contact_name || formatPhoneDisplay(conv.contact_phone)}</span>
                          {agent && (
                            <Badge className="bg-[#DFE4FB] text-[#374DA4] dark:bg-[#0F1631]/30 dark:text-[#879CE0] text-[10px] px-1.5 py-0 gap-1 flex-shrink-0">
                              <Sparkles className="h-2.5 w-2.5" /> IA
                            </Badge>
                          )}
                          {conv.lead_temperature && TEMPERATURE_CONFIG[conv.lead_temperature] && (
                            <span className={cn("text-[10px] px-1.5 py-0 rounded-full font-medium flex-shrink-0", TEMPERATURE_CONFIG[conv.lead_temperature].bg, TEMPERATURE_CONFIG[conv.lead_temperature].color)}>
                              {TEMPERATURE_CONFIG[conv.lead_temperature].label}
                            </span>
                          )}
                        </div>
                        <span className="text-[11px] text-muted-foreground flex-shrink-0 whitespace-nowrap">{formatTime(conv.last_message_at)}</span>
                      </div>
                      <div className="flex items-center justify-between min-w-0">
                        <p className="text-sm text-muted-foreground truncate pr-2 min-w-0 flex-1 flex items-center gap-1.5">
                          {conv.last_message === '[Áudio]' || conv.last_message === '[audio]' ? (
                            <><Mic className="h-3.5 w-3.5 flex-shrink-0 text-primary" /> <span>Áudio</span></>
                          ) : conv.last_message === '[Sticker]' ? (
                            <><Star className="h-3.5 w-3.5 flex-shrink-0" /> <span>Sticker</span></>
                          ) : conv.last_message === '[Imagem]' || conv.last_message === '[image]' ? (
                            <><Image className="h-3.5 w-3.5 flex-shrink-0" /> <span>Foto</span></>
                          ) : conv.last_message === '[Vídeo]' || conv.last_message === '[video]' ? (
                            <><Video className="h-3.5 w-3.5 flex-shrink-0" /> <span>Vídeo</span></>
                          ) : conv.last_message === '[Documento]' || conv.last_message === '[document]' ? (
                            <><FileText className="h-3.5 w-3.5 flex-shrink-0" /> <span>Documento</span></>
                          ) : conv.last_message === '[Contato]' ? (
                            <><Users className="h-3.5 w-3.5 flex-shrink-0" /> <span>Contato</span></>
                          ) : conv.last_message?.startsWith('[Localização') || conv.last_message === '[location]' ? (
                            <><MapPin className="h-3.5 w-3.5 flex-shrink-0" /> <span>Localização</span></>
                          ) : conv.last_message === '[interactive]' || conv.last_message?.startsWith('[Interactive') ? (
                            <><ListChecks className="h-3.5 w-3.5 flex-shrink-0" /> <span>Mensagem interativa</span></>
                          ) : (
                            <span className="truncate">{conv.last_message || ''}</span>
                          )}
                        </p>
                        {(conv.unread_count || 0) > 0 && (
                          <Badge className="bg-[#374DA4] text-white text-xs px-2 py-0.5 min-w-[20px] justify-center">
                            {conv.unread_count}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>

        {/* Context menu for conversations */}
        {contextMenu && (
          <>
            <div className="fixed inset-0 z-50" onClick={() => setContextMenu(null)} onContextMenu={(e) => { e.preventDefault(); setContextMenu(null); }} />
            <div
              className="fixed z-50 bg-popover border rounded-xl shadow-xl py-1 min-w-[180px] animate-in fade-in-0 zoom-in-95"
              style={{ top: contextMenu.y, left: contextMenu.x }}
            >
              <button
                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-muted transition-colors text-left"
                onClick={() => { handleArchiveConversation(contextMenu.conv); setContextMenu(null); }}
              >
                <Archive className="h-4 w-4 text-muted-foreground" />
                Arquivar conversa
              </button>
              <button
                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-destructive/10 transition-colors text-left text-destructive"
                onClick={() => { handleDeleteConversation(contextMenu.conv); setContextMenu(null); }}
              >
                <Trash2 className="h-4 w-4" />
                Excluir conversa
              </button>
            </div>
          </>
        )}
      </div>

      {/* Chat Area */}
      <div className={cn(
        "flex-1 flex flex-col bg-background relative",
        isMobile ? (mobileView === 'chat' ? 'w-full' : 'hidden') : ''
      )}>
        {selectedConv ? (
          <>
            {/* Chat Header */}
            <div className={cn(
              "border-b flex items-center justify-between px-4 bg-card flex-shrink-0",
              isMobile ? "h-[calc(3.5rem+env(safe-area-inset-top))] pt-[env(safe-area-inset-top)]" : "h-16"
            )}>
              <div className="flex items-center gap-3">
                {isMobile && (
                  <Button variant="ghost" size="icon" className="md:hidden h-8 w-8 shrink-0"
                    onClick={() => { setMobileView('list'); setSelectedConv(null); if (window.history.state?.ycloudChat) window.history.back(); }}>
                    <ArrowLeft className="h-5 w-5" />
                  </Button>
                )}
                <button onClick={() => setShowContactProfile(!showContactProfile)}
                  className="flex items-center gap-3 hover:opacity-80 transition-opacity">
                  <Avatar className="h-10 w-10">
                    
                    <AvatarFallback className="bg-[#DFE4FB] text-[#374DA4]">
                      {(selectedConv.contact_name || selectedConv.contact_phone).substring(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="text-left">
                    <h2 className="font-medium">{selectedConv.contact_name || formatPhoneDisplay(selectedConv.contact_phone)}</h2>
                    <p className="text-xs text-muted-foreground">{formatPhoneDisplay(selectedConv.contact_phone)}</p>
                  </div>
                </button>
              </div>

              <div className="flex items-center gap-1">
                {/* Call button - hidden until YCloud Calls permission is granted */}
                {getAgentForConv(selectedConv) && (
                  <div className="flex items-center gap-1.5">
                    <Badge className="bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700 text-white text-xs gap-1 px-2">
                      <Bot className="h-3 w-3" /> {getAgentForConv(selectedConv)?.name} atendendo
                    </Badge>
                    <Button variant="ghost" size="sm"
                      className="h-6 px-2 text-xs text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950"
                      onClick={() => handleAssignAgent(selectedConv!, null)}>
                      <Square className="h-3 w-3 mr-1" /> Parar
                    </Button>
                  </div>
                )}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon"><MoreVertical className="h-5 w-5" /></Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuItem onClick={() => setShowContactProfile(true)}>
                      <UserPlus className="h-4 w-4 mr-2" /> Ver perfil
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleCopyToClipboard(selectedConv!.contact_phone)}>
                      <Copy className="h-4 w-4 mr-2" /> Copiar número
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    
                    {/* Chatbot */}
                    {companyId && selectedConv && selectedConv.id !== 'new' && (
                      <DropdownMenuItem onClick={() => handleStartChatbot(selectedConv!)}>
                        <GitBranch className="h-4 w-4 mr-2 text-[#374DA4]" /> Ativar Chatbot
                      </DropdownMenuItem>
                    )}

                    {/* AI Agents */}
                    {aiAgents.length > 0 && (
                      <>
                        <DropdownMenuSeparator />
                        <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">Atribuir Agente IA</div>
                        {aiAgents.map(agent => (
                          <DropdownMenuItem key={agent.id}
                            onClick={() => handleAssignAgent(selectedConv!, agent.id)}
                            className={selectedConv?.assigned_agent_id === agent.id ? "bg-[#F0F2FE] dark:bg-blue-950" : ""}>
                            <Bot className="h-4 w-4 mr-2 text-[#374DA4]" />
                            {agent.name}
                            {selectedConv?.assigned_agent_id === agent.id && <Check className="h-4 w-4 ml-auto text-[#374DA4]" />}
                          </DropdownMenuItem>
                        ))}
                        {selectedConv?.assigned_agent_id && (
                          <DropdownMenuItem onClick={() => handleAssignAgent(selectedConv!, null)} className="text-destructive">
                            <Square className="h-4 w-4 mr-2" /> Parar Agente IA
                          </DropdownMenuItem>
                        )}
                      </>
                    )}

                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => handleArchiveConversation(selectedConv!)}>
                      <Archive className="h-4 w-4 mr-2" /> Arquivar conversa
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 relative overflow-hidden">
              <ScrollArea ref={messagesScrollAreaRef} className="h-full p-4 bg-gradient-to-b from-[#F0F2FE]/50 to-red-50/50 dark:from-blue-950/10 dark:to-red-950/10">
                <div className="space-y-2 max-w-3xl mx-auto">
                  {messages.length === 0 && selectedConv.id !== 'new' && (
                    <div className="flex items-center justify-center py-20">
                      <div className="text-center">
                        <MessageSquare className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                        <p className="text-muted-foreground">Nenhuma mensagem ainda. Inicie a conversa!</p>
                      </div>
                    </div>
                  )}
                  {selectedConv.id === 'new' && (
                    <div className="flex items-center justify-center py-20">
                      <div className="text-center">
                        <Phone className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                        <p className="text-muted-foreground">Nova conversa com {formatPhoneDisplay(selectedConv.contact_phone)}</p>
                      </div>
                    </div>
                  )}
                  {messages.filter(m => m.message_type !== 'reaction').map(msg => {
                    const isAiMsg = msg.from_me && msg.is_ai_response;
                    // Find quoted/replied message
                    const contextId = msg.raw_payload?.context?.message_id || msg.raw_payload?.context?.id || msg.raw_payload?.contextMessageId;
                    const quotedMsg = contextId ? messages.find(m => m.wamid === contextId || m.ycloud_message_id === contextId) : null;
                    return (
                    <div key={msg.id} className={cn("flex group items-end gap-1", msg.from_me ? "justify-end" : "justify-start")}>
                      {/* AI badge on left of AI messages */}
                      {isAiMsg && (
                        <div className="flex items-end mr-1.5 mb-1">
                          <div className="h-6 w-6 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-sm">
                            <Bot className="h-3.5 w-3.5 text-white" />
                          </div>
                        </div>
                      )}
                      <div className={cn(
                        "max-w-[70%] rounded-3xl px-4 py-2.5 shadow-sm relative",
                        msg.from_me
                          ? isAiMsg
                            ? "bg-gradient-to-br from-violet-500 to-purple-600 rounded-br-md"
                            : msg.status === 'sending'
                              ? "bg-[#374DA4]/70 rounded-br-md"
                              : msg.status === 'failed'
                                ? "bg-destructive rounded-br-md"
                                : "bg-[#374DA4] rounded-br-md"
                          : "bg-card text-foreground rounded-bl-md border"
                      )}>
                        {/* Quoted message preview */}
                        {quotedMsg && (
                          <div className={cn(
                            "mb-2 -mx-1 px-3 py-2 rounded-xl border-l-4 cursor-pointer",
                            msg.from_me
                              ? "bg-white/15 border-white/40"
                              : "bg-muted/60 border-[#374DA4]/60"
                          )}>
                            <p className={cn("text-[11px] font-semibold mb-0.5", msg.from_me ? "text-white/80" : "text-[#374DA4]")}>
                              {quotedMsg.from_me ? 'Você' : (selectedConv?.contact_name || formatPhoneDisplay(selectedConv?.contact_phone || ''))}
                            </p>
                            <p className={cn("text-xs truncate", msg.from_me ? "text-white/60" : "text-muted-foreground")}>
                              {quotedMsg.message_type === 'image' ? '📷 Imagem' :
                               quotedMsg.message_type === 'audio' ? '🎤 Áudio' :
                               quotedMsg.message_type === 'video' ? '📹 Vídeo' :
                               quotedMsg.message_type === 'document' ? '📄 Documento' :
                               quotedMsg.message_type === 'sticker' ? '🎭 Sticker' :
                               quotedMsg.message_type === 'location' ? '📍 Localização' :
                               (quotedMsg.content || '').substring(0, 100)}
                            </p>
                          </div>
                        )}
                        {/* Media rendering */}
                        {msg.media_url && (
                          <div className="mb-2">
                            {msg.message_type === 'image' ? (
                              <img src={msg.media_url} alt="" className="rounded-lg max-w-full max-h-64 object-contain cursor-pointer hover:opacity-90 transition-opacity"
                                onClick={() => window.open(msg.media_url!, '_blank')} />
                            ) : msg.message_type === 'sticker' ? (
                              <img src={msg.media_url} alt="Sticker" className="max-w-[180px] max-h-[180px] object-contain" />
                            ) : msg.message_type === 'audio' ? (
                              <div className="space-y-1">
                                <AudioPlayerBubble url={msg.media_url!} fromMe={msg.from_me} />
                                {msg.transcription ? (
                                  <div>
                                    <button
                                      className={cn("flex items-center gap-1 text-[10px] font-medium mt-1 hover:underline", msg.from_me ? "text-white/70" : "text-[#374DA4]")}
                                      onClick={() => setExpandedTranscription(expandedTranscription === msg.id ? null : msg.id)}
                                    >
                                      <FileText className="h-3 w-3" />
                                      {expandedTranscription === msg.id ? 'Ocultar transcrição' : 'Ler áudio transcrito'}
                                    </button>
                                    {expandedTranscription === msg.id && (
                                      <div className={cn("mt-1 text-xs italic rounded-lg px-3 py-2", msg.from_me ? "bg-white/10 text-white/90" : "bg-muted text-foreground")}>
                                        {msg.transcription}
                                      </div>
                                    )}
                                  </div>
                                ) : (
                                  <button
                                    className={cn("flex items-center gap-1 text-[10px] font-medium mt-1 hover:underline", msg.from_me ? "text-white/70" : "text-[#374DA4]")}
                                    onClick={() => handleTranscribeAudio(msg)}
                                    disabled={transcribingMsgId === msg.id}
                                  >
                                    {transcribingMsgId === msg.id ? (
                                      <><Loader2 className="h-3 w-3 animate-spin" /> Transcrevendo...</>
                                    ) : (
                                      <><FileText className="h-3 w-3" /> Transcrever áudio</>
                                    )}
                                  </button>
                                )}
                              </div>
                            ) : msg.message_type === 'video' ? (
                              <video controls src={msg.media_url} className="rounded-lg max-w-full max-h-64" />
                            ) : (
                              <a href={msg.media_url} target="_blank" rel="noopener noreferrer"
                                className={cn("flex items-center gap-2 text-xs underline", msg.from_me ? "text-white/90" : "text-foreground")}>
                                <FileText className="h-4 w-4" /> {msg.content || 'Documento'}
                              </a>
                            )}
                          </div>
                        )}

                        {/* Location - WhatsApp style map preview */}
                        {msg.message_type === 'location' && (() => {
                          try {
                            const loc = JSON.parse(msg.content || '{}');
                            if (loc.type === 'location') {
                              const lat = loc.latitude;
                              const lng = loc.longitude;
                              // OpenStreetMap static tile preview (free)
                              const zoom = 15;
                              const tileX = Math.floor(((lng + 180) / 360) * Math.pow(2, zoom));
                              const tileY = Math.floor((1 - Math.log(Math.tan((lat * Math.PI) / 180) + 1 / Math.cos((lat * Math.PI) / 180)) / Math.PI) / 2 * Math.pow(2, zoom));
                              const tileUrl = `https://cartodb-basemaps-a.global.ssl.fastly.net/light_all/${zoom}/${tileX}/${tileY}.png`;

                              return (
                                <a href={`https://www.google.com/maps?q=${lat},${lng}`} target="_blank" rel="noopener noreferrer"
                                  className="block -mx-4 -mt-2.5 mb-1">
                                  {/* Map preview */}
                                  <div className="relative w-full h-[160px] overflow-hidden rounded-t-3xl bg-muted">
                                    <img src={tileUrl} alt="Mapa"
                                      className="w-full h-full object-cover scale-[2] opacity-90"
                                      onError={(e) => { (e.target as HTMLImageElement).parentElement!.classList.add('bg-gradient-to-br', 'from-emerald-100', 'to-teal-200'); (e.target as HTMLImageElement).style.display = 'none'; }} />
                                    {/* Pin overlay */}
                                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                      <div className="flex flex-col items-center -mt-4">
                                        <div className="h-10 w-10 rounded-full bg-red-500 shadow-lg flex items-center justify-center border-3 border-white">
                                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
                                            <circle cx="12" cy="10" r="3"/>
                                          </svg>
                                        </div>
                                        <div className="w-1 h-2 bg-red-500/60 rounded-b-full" />
                                      </div>
                                    </div>
                                    {/* Gradient overlay at bottom */}
                                    <div className={cn("absolute bottom-0 left-0 right-0 h-12", msg.from_me ? "bg-gradient-to-t from-[#374DA4]/80 to-transparent" : "bg-gradient-to-t from-card/80 to-transparent")} />
                                  </div>
                                  {/* Location info */}
                                  <div className="px-4 pt-2 pb-0.5">
                                    <div className={cn("flex items-center gap-2 text-sm font-medium", msg.from_me ? "text-white" : "text-foreground")}>
                                      <span className="text-base">📍</span>
                                      <span>{loc.name || 'Localização compartilhada'}</span>
                                    </div>
                                    {loc.address && (
                                      <p className={cn("text-xs mt-0.5 ml-7", msg.from_me ? "text-white/70" : "text-muted-foreground")}>{loc.address}</p>
                                    )}
                                    {!loc.name && !loc.address && (
                                      <p className={cn("text-xs mt-0.5 ml-7", msg.from_me ? "text-white/70" : "text-muted-foreground")}>
                                        {lat.toFixed(6)}, {lng.toFixed(6)}
                                      </p>
                                    )}
                                  </div>
                                </a>
                              );
                            }
                          } catch { /* fallback below */ }
                          return <p className={cn("text-sm", msg.from_me ? "text-white" : "text-foreground")}>📍 Localização</p>;
                        })()}

                        {/* Contacts */}
                        {msg.message_type === 'contacts' && (() => {
                          try {
                            const data = JSON.parse(msg.content || '{}');
                            if (data.type === 'contacts' && data.contacts) {
                              return (
                                <div className="space-y-2">
                                  {data.contacts.map((c: any, i: number) => (
                                    <div key={i} className={cn("flex items-center gap-2 p-2 rounded-xl", msg.from_me ? "bg-white/15" : "bg-muted")}>
                                      <div className="h-9 w-9 rounded-full bg-[#374DA4]/20 flex items-center justify-center flex-shrink-0">
                                        <Users className="h-4 w-4 text-[#374DA4]" />
                                      </div>
                                      <div className="min-w-0">
                                        <p className={cn("text-sm font-medium truncate", msg.from_me ? "text-white" : "text-foreground")}>{c.name}</p>
                                        {c.phones?.[0] && (
                                          <p className={cn("text-xs", msg.from_me ? "text-white/70" : "text-muted-foreground")}>{c.phones[0]}</p>
                                        )}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              );
                            }
                          } catch { /* fallback below */ }
                          return <p className={cn("text-sm", msg.from_me ? "text-white" : "text-foreground")}>👤 Contato compartilhado</p>;
                        })()}

                        {/* Reaction */}
                        {msg.message_type === 'reaction' && (() => {
                          try {
                            const data = JSON.parse(msg.content || '{}');
                            if (data.type === 'reaction') {
                              return <span className="text-3xl">{data.emoji || '❤️'}</span>;
                            }
                          } catch { /* fallback */ }
                          return <span className="text-3xl">❤️</span>;
                        })()}

                        {/* Interactive messages (buttons/list) */}
                        {msg.message_type === 'interactive' && (() => {
                          try {
                            const rawStr = typeof msg.raw_payload === 'object' ? JSON.stringify(msg.raw_payload) : (msg.content || '{}');
                            const data = JSON.parse(rawStr);
                            const interactive = data?.interactive || data;
                            const interType = interactive?.type;
                            const bodyTxt = interactive?.body?.text || msg.content;
                            const headerTxt = interactive?.header?.text;
                            const footerTxt = interactive?.footer?.text;

                            return (
                              <div className="space-y-2">
                                {headerTxt && <p className={cn("text-sm font-bold", msg.from_me ? "text-white" : "text-foreground")}>{headerTxt}</p>}
                                {bodyTxt && <p className={cn("text-sm whitespace-pre-wrap", msg.from_me ? "text-white" : "text-foreground")}>{bodyTxt}</p>}
                                {footerTxt && <p className={cn("text-[11px]", msg.from_me ? "text-white/60" : "text-muted-foreground")}>{footerTxt}</p>}
                                
                                {interType === 'button' && interactive?.action?.buttons && (
                                  <div className="border-t pt-2 mt-2 space-y-1.5" style={{ borderColor: msg.from_me ? 'rgba(255,255,255,0.2)' : undefined }}>
                                    {interactive.action.buttons.map((btn: any, i: number) => (
                                      <div key={i} className={cn(
                                        "text-center py-2 rounded-lg text-sm font-medium cursor-default",
                                        msg.from_me ? "bg-white/15 text-white" : "bg-muted text-[#374DA4]"
                                      )}>
                                        {btn.reply?.title || btn.title || `Opção ${i+1}`}
                                      </div>
                                    ))}
                                  </div>
                                )}
                                
                                {interType === 'list' && interactive?.action && (
                                  <div className="border-t pt-2 mt-2" style={{ borderColor: msg.from_me ? 'rgba(255,255,255,0.2)' : undefined }}>
                                    <div className={cn(
                                      "text-center py-2 rounded-lg text-sm font-medium flex items-center justify-center gap-1.5",
                                      msg.from_me ? "bg-white/15 text-white" : "bg-muted text-[#374DA4]"
                                    )}>
                                      <List className="h-4 w-4" />
                                      {interactive.action.button || 'Ver opções'}
                                    </div>
                                  </div>
                                )}

                                {interType === 'button_reply' && interactive?.button && (
                                  <div className={cn("flex items-center gap-1.5 text-sm", msg.from_me ? "text-white" : "text-foreground")}>
                                    <ToggleLeft className="h-4 w-4" />
                                    <span className="font-medium">{interactive.button.text || interactive.button.payload}</span>
                                  </div>
                                )}

                                {interType === 'list_reply' && interactive?.list_reply && (
                                  <div className={cn("flex items-center gap-1.5 text-sm", msg.from_me ? "text-white" : "text-foreground")}>
                                    <List className="h-4 w-4" />
                                    <span className="font-medium">{interactive.list_reply.title}</span>
                                  </div>
                                )}
                              </div>
                            );
                          } catch { /* fallback */ }
                          return null;
                        })()}

                        {/* Regular text content (not for structured types) */}
                        {!['location', 'contacts', 'reaction', 'interactive'].includes(msg.message_type) && 
                         (!msg.media_url || msg.message_type === 'image' || msg.message_type === 'video') && msg.content && (
                          <p className={cn("text-sm whitespace-pre-wrap break-words", msg.from_me ? "text-white" : "text-foreground")}>
                              {msg.content === '[unsupported]' || msg.content === '[Mensagem não suportada]' || msg.content === '[Mensagem indisponível no WhatsApp]'
                                ? '⚠️ Mensagem indisponível (limitação da API oficial)'
                              : msg.content === '[Sticker ou mídia não suportada pela API]'
                                ? '🎭 Sticker/mídia não suportada pela API oficial do WhatsApp'
                              : msg.content}
                          </p>
                        )}
                        <div className={cn("flex items-center justify-end gap-1 mt-1", msg.from_me ? "text-white/70" : "text-muted-foreground")}>
                          {isAiMsg && <Sparkles className="h-2.5 w-2.5 text-violet-200" />}
                          <span className="text-[10px]">
                            {new Date(msg.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                          {msg.from_me ? (
                            isAiMsg
                              ? <CheckCheck className="h-3 w-3 text-violet-200" />
                              : msg.status === 'read' ? <CheckCheck className="h-3 w-3 text-cyan-300" /> :
                                msg.status === 'delivered' ? <CheckCheck className="h-3 w-3 text-white/70" /> :
                                msg.status === 'sending' ? <Loader2 className="h-3 w-3 animate-spin" /> :
                                msg.status === 'failed' ? <XCircle className="h-3 w-3 text-red-300" /> :
                                <Check className="h-3 w-3 text-white/70" />
                          ) : (
                            /* Show purple check on received msgs when AI agent is assigned (AI "read" it) */
                            selectedConv?.assigned_agent_id && (
                              <CheckCheck className="h-3 w-3 text-violet-500" />
                            )
                          )}
                        </div>

                        {/* Reactions badge */}
                        {(msg.reaction || msg.reactions) && (
                          <div className={cn(
                            "absolute -bottom-3 right-0 flex items-center gap-0.5 z-10 animate-in zoom-in duration-200",
                            msg.from_me ? "justify-end" : "justify-start"
                          )}>
                            {msg.reactions ? (
                              <div className="flex -space-x-1 hover:space-x-0.5 transition-all">
                                {Object.entries(msg.reactions).map(([sender, emoji], idx) => (
                                  <div 
                                    key={`${sender}-${idx}`}
                                    title={sender}
                                    className={cn(
                                      "bg-background border rounded-full px-1.5 py-0.5 text-[10px] shadow-sm flex items-center justify-center cursor-default hover:z-20",
                                      msg.from_me ? "border-[#B3BFF0] dark:border-[#0F1631]" : "border-border"
                                    )}
                                  >
                                    {emoji}
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div className={cn(
                                "bg-background border rounded-full px-1.5 py-0.5 text-[10px] shadow-sm",
                                msg.from_me ? "border-[#B3BFF0] dark:border-[#0F1631] shadow-[#DFE4FB]/20" : "border-border"
                              )}>
                                {msg.reaction}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                      {/* Reply & More buttons - shown on hover */}
                      <div className={cn(
                        "flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0",
                        msg.from_me ? "order-first" : "order-last"
                      )}>
                        <Button variant="ghost" size="icon" className="h-7 w-7"
                          onClick={() => setReplyTo(msg)} title="Responder">
                          <Reply className="h-3.5 w-3.5 text-muted-foreground" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7"
                          onClick={(e) => setMsgMenu({ msg, x: e.clientX, y: e.clientY })} title="Mais opções">
                          <MoreVertical className="h-3.5 w-3.5 text-muted-foreground" />
                        </Button>
                      </div>
                    </div>
                    );
                  })}
                  
                  {/* AI Thinking indicator */}
                  {selectedConv && (selectedConv.ai_thinking || false) && (
                    <div className="flex justify-end items-center gap-2">
                      <div className="flex items-end mr-1.5 mb-1">
                        <div className="h-6 w-6 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-sm animate-pulse">
                          <Bot className="h-3.5 w-3.5 text-white" />
                        </div>
                      </div>
                      <div className="bg-gradient-to-br from-violet-500/80 to-purple-600/80 rounded-2xl rounded-br-sm px-4 py-2.5 shadow-sm">
                        <div className="flex items-center gap-2">
                          <Loader2 className="h-3.5 w-3.5 animate-spin text-white" />
                          <span className="text-sm text-white/90">IA está pensando...</span>
                        </div>
                      </div>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>
              </ScrollArea>

              {showScrollToBottom && (
                <Button onClick={() => {
                  const viewport = messagesScrollAreaRef.current?.querySelector('[data-radix-scroll-area-viewport]') as HTMLElement | null;
                  if (viewport) viewport.scrollTop = viewport.scrollHeight;
                }} size="icon" className="absolute bottom-4 right-6 z-10 rounded-full bg-card shadow-lg hover:bg-accent h-10 w-10 border">
                  <ChevronDown className="h-5 w-5 text-muted-foreground" />
                </Button>
              )}
            </div>

            {/* Message Input */}
            <div className={cn(
              "p-3 border-t bg-card",
              isMobile && "pb-[calc(0.75rem+env(safe-area-inset-bottom))]"
            )}>
              {/* Chatbot active indicator */}
              {activeChatbotFlow && (
                <div className="flex items-center gap-2 px-3 py-1.5 mb-2 bg-[#374DA4]/10 rounded-xl text-xs">
                  <GitBranch className="h-3.5 w-3.5 text-[#374DA4]" />
                  <span className="text-[#374DA4] font-medium">Chatbot ativo: {activeChatbotFlow.name}</span>
                  <Button variant="ghost" size="sm" className="h-5 px-1.5 text-[10px] ml-auto text-destructive"
                    onClick={() => setActiveChatbotFlow(null)}>Parar</Button>
                </div>
              )}

              {/* Reply preview bar */}
              {replyTo && (
                <div className="flex items-center gap-2 px-3 py-2 mb-2 bg-muted/60 rounded-xl border-l-4 border-[#374DA4] max-w-3xl mx-auto">
                  <Reply className="h-4 w-4 text-[#374DA4] shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-semibold text-[#374DA4]">
                      {replyTo.from_me ? 'Você' : (selectedConv?.contact_name || formatPhoneDisplay(selectedConv?.contact_phone || ''))}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {replyTo.message_type === 'image' ? '📷 Imagem' :
                       replyTo.message_type === 'audio' ? '🎤 Áudio' :
                       replyTo.message_type === 'video' ? '📹 Vídeo' :
                       replyTo.message_type === 'document' ? '📄 Documento' :
                       replyTo.message_type === 'sticker' ? '🎭 Sticker' :
                       replyTo.message_type === 'location' ? '📍 Localização' :
                       (replyTo.content || '').substring(0, 80)}
                    </p>
                  </div>
                  <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => setReplyTo(null)}>
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              )}

              {windowClosedNotice && (
                <div className="mb-2 max-w-3xl mx-auto rounded-xl border border-destructive/40 bg-destructive/10 px-3 py-2 flex items-center justify-between gap-2">
                  <p className="text-xs text-destructive font-medium">{windowClosedNotice}</p>
                  <Button size="sm" variant="outline" className="shrink-0 text-xs border-[#374DA4] text-[#374DA4] hover:bg-[#374DA4]/10"
                    onClick={() => setShowTemplateModal(true)}>
                    <FileText className="h-3.5 w-3.5 mr-1" /> Enviar Template
                  </Button>
                </div>
              )}

              <div className="flex items-center gap-2 max-w-3xl mx-auto">
                {/* Hidden file inputs */}
                <input ref={imageInputRef} type="file" accept="image/*" className="hidden"
                  onChange={e => handleFileSelect(e, 'image')} />
                <input ref={fileInputRef} type="file" accept="*/*" className="hidden"
                  onChange={e => handleFileSelect(e, 'document')} />
                
                {isRecording ? (
                  /* Recording UI */
                  <>
                    <Button variant="ghost" size="icon" className="h-9 w-9 text-destructive hover:text-destructive/80"
                      onClick={cancelRecording} title="Cancelar">
                      <Trash2 className="h-5 w-5" />
                    </Button>
                    <div className="flex-1 flex items-center justify-center gap-3 bg-destructive/10 rounded-xl px-4 py-2">
                      <div className="h-2.5 w-2.5 rounded-full bg-destructive animate-pulse" />
                      <span className="text-sm font-mono text-destructive font-medium">{formatRecordingTime(recordingTime)}</span>
                      <span className="text-xs text-muted-foreground">Gravando...</span>
                    </div>
                    <Button onClick={stopRecording} className="bg-[#374DA4] hover:bg-[#374DA4]/90 rounded-xl">
                      <Send className="h-4 w-4" />
                    </Button>
                  </>
                ) : (
                  /* Normal input */
                  <>
                    <div className="relative">
                      <Button variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground hover:text-[#374DA4]"
                        onClick={() => setShowPlusMenu(prev => !prev)}
                        disabled={!selectedConv}>
                        <Plus className="h-5 w-5" />
                      </Button>
                      {showPlusMenu && (
                        <>
                          <div className="fixed inset-0 z-40" onClick={() => setShowPlusMenu(false)} />
                          <div className="absolute bottom-12 left-0 z-50 bg-popover border rounded-xl shadow-xl py-2 min-w-[220px] animate-in fade-in-0 slide-in-from-bottom-2">
                            <button className="w-full flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-muted transition-colors text-left"
                              onClick={() => { imageInputRef.current?.click(); setShowPlusMenu(false); }}>
                              <Image className="h-4 w-4 text-[#374DA4]" /> Enviar imagem
                            </button>
                            <button className="w-full flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-muted transition-colors text-left"
                              onClick={() => { fileInputRef.current?.click(); setShowPlusMenu(false); }}>
                              <Paperclip className="h-4 w-4 text-[#374DA4]" /> Enviar arquivo
                            </button>
                            <div className="h-px bg-border mx-3 my-1" />
                            <button className="w-full flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-muted transition-colors text-left"
                              onClick={() => { setShowScheduleMeeting(true); setShowPlusMenu(false); }}
                              disabled={!selectedConv || selectedConv.id === 'new'}>
                              <CalendarDays className="h-4 w-4 text-[#374DA4]" /> Agendar reunião
                            </button>
                            <div className="h-px bg-border mx-3 my-1" />
                            <button className="w-full flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-[#374DA4]/5 transition-colors text-left text-[#374DA4]"
                              onClick={() => { handleAiAnalyzeConversation(); setShowPlusMenu(false); }}
                              disabled={!selectedConv || messages.length === 0 || aiAnalysis.loading}>
                              <Sparkles className="h-4 w-4" /> Analisar com IA
                            </button>
                          </div>
                        </>
                      )}
                    </div>

                    <div className="relative flex-1">
                      <Input value={newMessage} onChange={e => setNewMessage(e.target.value)}
                        placeholder="Digite uma mensagem..."
                        onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSendMessage()}
                        className="pr-[74px] focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:border-input" />
                      <div className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center gap-0.5">
                        <AISuggestReplyButton
                          size="sm"
                          messages={messages.map(m => ({ from_me: m.from_me, content: m.content || '' }))}
                          contactName={selectedConv?.contact_name || selectedConv?.contact_phone}
                          onSuggested={(t) => setNewMessage(t)}
                          disabled={sending || uploadingMedia}
                        />
                        <AIImproveMessageButton
                          size="sm"
                          text={newMessage}
                          onImproved={(t) => setNewMessage(t)}
                          disabled={sending || uploadingMedia}
                        />
                      </div>
                    </div>
                    
                    {newMessage.trim() ? (
                      <Button onClick={handleSendMessage} disabled={sending || uploadingMedia || !!windowClosedNotice}
                        className="bg-[#374DA4] hover:bg-[#374DA4]/90">
                        {(sending || uploadingMedia) ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                      </Button>
                    ) : (
                      <Button onClick={startRecording} variant="ghost" size="icon"
                        className="h-9 w-9 text-muted-foreground hover:text-[#374DA4]"
                        disabled={uploadingMedia || !selectedConv} title="Gravar áudio">
                        <Mic className="h-5 w-5" />
                      </Button>
                    )}
                  </>
                )}
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center bg-gradient-to-br from-[#374DA4]/10 via-[#5B33F0]/5 to-[#374DA4]/10 rounded-3xl">
            <div className="w-full max-w-lg px-8 text-center">
              <div className="h-16 w-16 rounded-2xl bg-[#374DA4]/10 flex items-center justify-center mx-auto mb-5">
                <Sparkles className="h-8 w-8 text-[#374DA4]" />
              </div>
              <h2 className="text-xl font-bold text-foreground mb-2">Pergunte algo pra Ello</h2>
              <p className="text-sm text-muted-foreground mb-6">Sua assistente IA para tirar dúvidas sobre o Ellosuit</p>
              <div className="flex gap-3 bg-background/80 backdrop-blur-sm p-2 rounded-2xl shadow-xl border border-[#374DA4]/10">
                <Input
                  value={elloQuestion}
                  onChange={e => setElloQuestion(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && elloQuestion.trim()) {
                      setElloInitialMsg(elloQuestion.trim());
                      setShowElloPopup(true);
                      setElloQuestion('');
                    }
                  }}
                  placeholder="Ex: Como funciona o CRM?"
                  className="flex-1 border-0 shadow-none text-base h-12 bg-transparent focus-visible:ring-0"
                />
                <Button
                  onClick={() => {
                    if (elloQuestion.trim()) {
                      setElloInitialMsg(elloQuestion.trim());
                      setShowElloPopup(true);
                      setElloQuestion('');
                    }
                  }}
                  disabled={!elloQuestion.trim()}
                  size="lg"
                  className="bg-[#374DA4] hover:bg-[#5B33F0] text-white rounded-xl h-12 w-12 p-0"
                >
                  <Send className="h-5 w-5" />
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Contact Profile Panel - Desktop */}
      {showContactProfile && selectedConv && !isMobile && companyId && (
        <ContactProfilePanel
          contactPhone={selectedConv.contact_phone}
          contactName={selectedConv.contact_name}
          companyId={companyId}
          onClose={() => setShowContactProfile(false)}
        />
      )}

      {renderSetupDialog()}

      {/* Chatbot Modal */}
      {showStartChatbot && chatbotConv && companyId && selectedSession && (
        <StartChatbotModal
          isOpen={showStartChatbot}
          onClose={() => { setShowStartChatbot(false); setChatbotConv(null); }}
          companyId={companyId}
          conversationId={chatbotConv.id}
          contactPhone={chatbotConv.contact_phone}
          contactName={chatbotConv.contact_name || undefined}
          sessionId={selectedSession.id}
          onStarted={(execId, flowName) => {
            setActiveChatbotFlow({ id: execId, name: flowName });
            setShowStartChatbot(false);
            setChatbotConv(null);
          }}
        />
      )}

      {/* WhatsApp Call Overlay */}
      {activeCall && selectedSession && (
        <WhatsAppCallOverlay
          contactName={activeCall.contactName}
          contactPhone={activeCall.contactPhone}
          profilePicture={activeCall.profilePicture}
          sessionId={selectedSession.id}
          callApi={callApi}
          onClose={() => setActiveCall(null)}
        />
      )}

      {/* Contacts Dialog */}
      <Dialog open={showContactsList} onOpenChange={setShowContactsList}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] flex flex-col rounded-2xl p-0 overflow-hidden">
          <DialogHeader className="px-5 pt-5 pb-3 flex flex-row items-center justify-between">
            <DialogTitle className="flex items-center gap-2 text-lg">
              <Users className="h-5 w-5 text-[#374DA4]" /> Contatos
              <Badge variant="secondary" className="text-xs">{contactsList.length}</Badge>
            </DialogTitle>
          </DialogHeader>
          <div className="px-5 pb-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar contatos..."
                value={contactsSearch}
                onChange={e => setContactsSearch(e.target.value)}
                className="pl-9 rounded-xl bg-muted/50 border-0 h-9 text-sm"
              />
            </div>
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto px-2 pb-4">
            {contactsLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-[#374DA4]" />
              </div>
            ) : (
              (() => {
                const filtered = contactsList.filter(c => {
                  if (!contactsSearch) return true;
                  const q = contactsSearch.toLowerCase();
                  return (c.contact_name?.toLowerCase().includes(q) || c.contact_phone.includes(q));
                });
                if (filtered.length === 0) return (
                  <div className="text-center py-12 text-muted-foreground">
                    <Users className="h-10 w-10 mx-auto mb-3 opacity-30" />
                    <p className="text-sm">{contactsSearch ? 'Nenhum contato encontrado' : 'Nenhum contato'}</p>
                  </div>
                );
                return (
                  <div className="space-y-0.5">
                    {filtered.map(contact => {
                      const initials = (contact.contact_name || contact.contact_phone).substring(0, 2).toUpperCase();
                      const colors = ['#F59E0B', '#EF4444', '#10B981', '#374DA4', '#8B5CF6', '#EC4899', '#14B8A6', '#374DA4'];
                      const colorIdx = (contact.contact_name || contact.contact_phone).charCodeAt(0) % colors.length;
                      return (
                        <div
                          key={contact.id}
                          className="flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-muted/50 cursor-pointer transition-colors"
                          onClick={() => {
                            setSelectedConv(contact);
                            setShowContactsList(false);
                            if (isMobile) setMobileView('chat');
                          }}
                        >
                          <Avatar className="h-11 w-11">
                            <AvatarFallback style={{ backgroundColor: colors[colorIdx] }} className="text-white font-medium text-sm">
                              {initials}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm truncate">{contact.contact_name || formatPhoneDisplay(contact.contact_phone)}</p>
                            <p className="text-xs text-muted-foreground">{formatPhoneDisplay(contact.contact_phone)}</p>
                          </div>
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-muted-foreground hover:text-[#374DA4]"
                            onClick={(e) => { e.stopPropagation(); setSelectedConv(contact); setShowContactsList(false); if (isMobile) setMobileView('chat'); }}>
                            <MessageSquare className="h-4 w-4" />
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                );
              })()
            )}
          </div>
        </DialogContent>
      </Dialog>
      {/* Interactive Message Composer */}
      <InteractiveMessageComposer
        open={showInteractiveComposer}
        onClose={() => setShowInteractiveComposer(false)}
        sending={sending}
        onSend={async (data) => {
          if (!selectedSession || !selectedConv) return;
          setSending(true);
          try {
            await callApi('send_message', {
              session_id: selectedSession.id,
              to: selectedConv.contact_phone,
              message: data.message,
              message_type: data.message_type,
              interactive: data.interactive,
            });
            // Store follow-up mappings if configured
            if (data.followUps && Object.keys(data.followUps).length > 0) {
              followUpMappingsRef.current[selectedConv.id] = data.followUps;
              toast({ title: 'Respostas automáticas configuradas', description: `${Object.keys(data.followUps).length} resposta(s) automática(s) prontas para esta conversa.` });
            }
            setShowInteractiveComposer(false);
            loadMessages();
            loadConversations();
          } catch (err) {
            console.error('Interactive send error:', err);
          } finally {
            setSending(false);
          }
        }}
      />

      {selectedSession && selectedConv && (
        <TemplateMessageModal
          open={showTemplateModal}
          onOpenChange={setShowTemplateModal}
          sessionId={selectedSession.id}
          contactPhone={selectedConv.contact_phone}
          contactName={selectedConv.contact_name}
          onSent={() => {
            setWindowClosedNotice(null);
            loadMessages();
            loadConversations();
          }}
        />
      )}

      {/* Schedule Meeting Modal */}
      {selectedSession && selectedConv && (
        <ScheduleMeetingModal
          isOpen={showScheduleMeeting}
          onClose={() => setShowScheduleMeeting(false)}
          contactName={selectedConv.contact_name || undefined}
          contactPhone={selectedConv.contact_phone}
          sessionId={selectedSession.id}
          callApi={async (action, data) => {
            const result = await callApi(action, data);
            loadMessages();
            loadConversations();
            return result;
          }}
        />
      )}

      <ElloAIPopup
        open={showElloPopup}
        onClose={() => { setShowElloPopup(false); setElloInitialMsg(''); }}
        initialMessage={elloInitialMsg}
      />

      {/* Message context menu */}
      {msgMenu && (
        <>
          <div className="fixed inset-0 z-50" onClick={() => setMsgMenu(null)} />
          <div
            className="fixed z-50 bg-popover border rounded-xl shadow-xl py-1 min-w-[180px] animate-in fade-in-0 zoom-in-95"
            style={{ top: Math.min(msgMenu.y, window.innerHeight - 120), left: Math.min(msgMenu.x, window.innerWidth - 200) }}
          >
            <button
              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-muted transition-colors text-left"
              onClick={() => { navigator.clipboard.writeText(msgMenu.msg.content || ''); setMsgMenu(null); toast({ title: 'Copiado!' }); }}
            >
              <Copy className="h-4 w-4 text-muted-foreground" />
              <span>Copiar</span>
            </button>
            <button
              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-violet-50 dark:hover:bg-violet-500/10 transition-colors text-left text-violet-600 dark:text-violet-400"
              onClick={() => handleAiAnalyzeMessage(msgMenu.msg)}
            >
              <Sparkles className="h-4 w-4" />
              <span>Analisar com IA</span>
            </button>
            <button
              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-muted transition-colors text-left"
              onClick={() => { setReplyTo(msgMenu.msg); setMsgMenu(null); }}
            >
              <Reply className="h-4 w-4 text-muted-foreground" />
              <span>Responder</span>
            </button>
          </div>
        </>
      )}

      {/* AI Analysis Dialog */}
      <Dialog open={showAiAnalysis} onOpenChange={setShowAiAnalysis}>
        <DialogContent className="max-w-2xl w-[95vw] max-h-[85vh] overflow-hidden flex flex-col border-t-4 border-t-[#374DA4] p-0">
          <DialogHeader className="px-6 pt-6 pb-4 border-b bg-gradient-to-r from-[#374DA4]/5 to-transparent">
            <DialogTitle className="flex items-center gap-2.5 text-lg">
              <div className="p-1.5 rounded-lg bg-[#374DA4]/10">
                <Sparkles className="h-5 w-5 text-[#374DA4]" />
              </div>
              {aiAnalysis.type === 'conversation' ? 'Análise da Conversa' : 'Análise da Mensagem'}
            </DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
            {aiAnalysis.messageContent && (
              <div className="bg-[#374DA4]/5 rounded-xl px-4 py-3 text-sm border-l-4 border-[#374DA4]">
                <p className="text-xs text-muted-foreground mb-1 font-medium">Mensagem analisada:</p>
                <p className="text-foreground">{aiAnalysis.messageContent}</p>
              </div>
            )}
            {aiAnalysis.loading ? (
              <div className="flex flex-col items-center justify-center py-16 gap-4">
                <div className="relative w-full max-w-md">
                  <div className="space-y-3">
                    {[...Array(5)].map((_, i) => (
                      <div key={i} className="h-3 rounded-full bg-muted overflow-hidden" style={{ width: `${85 - i * 12}%` }}>
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-transparent via-[#374DA4]/20 to-transparent"
                          style={{ animation: `shimmer 1.5s ease-in-out infinite`, animationDelay: `${i * 0.15}s`, width: '200%', transform: 'translateX(-100%)' }}
                        />
                      </div>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-2 mt-2">
                  <Loader2 className="h-4 w-4 animate-spin text-[#374DA4]" />
                  <p className="text-sm text-muted-foreground">A Ello está analisando...</p>
                </div>
                <style>{`@keyframes shimmer { 0% { transform: translateX(-100%); } 100% { transform: translateX(100%); } }`}</style>
              </div>
            ) : aiAnalysis.result ? (
              <div className="space-y-4">
                {/* Temperature badge */}
                {aiAnalysis.detectedTemperature && TEMPERATURE_CONFIG[aiAnalysis.detectedTemperature] && (
                  <div className={cn("flex items-center justify-between p-3 rounded-xl border-2 border-[#374DA4]/20", TEMPERATURE_CONFIG[aiAnalysis.detectedTemperature].bg)}>
                    <div className="flex items-center gap-2">
                      <span className={cn("text-lg font-bold", TEMPERATURE_CONFIG[aiAnalysis.detectedTemperature].color)}>
                        {TEMPERATURE_CONFIG[aiAnalysis.detectedTemperature].label}
                      </span>
                      <span className="text-xs text-muted-foreground">Temperamento do Lead</span>
                    </div>
                    <Button
                      size="sm"
                      className="bg-[#374DA4] hover:bg-[#374DA4]/90 text-white gap-1.5"
                      onClick={async () => {
                        if (!selectedConv || !aiAnalysis.detectedTemperature) return;
                        try {
                          await supabase.from('ycloud_conversations').update({ lead_temperature: aiAnalysis.detectedTemperature } as any).eq('id', selectedConv.id);
                          setConversations(prev => prev.map(c => c.id === selectedConv.id ? { ...c, lead_temperature: aiAnalysis.detectedTemperature } : c));
                          setSelectedConv(prev => prev ? { ...prev, lead_temperature: aiAnalysis.detectedTemperature } : prev);
                          toast({ title: 'Etiqueta de temperatura aplicada!' });
                        } catch {
                          toast({ title: 'Erro ao aplicar etiqueta', variant: 'destructive' });
                        }
                      }}
                    >
                      <Tag className="h-3.5 w-3.5" /> Confirmar Etiqueta
                    </Button>
                  </div>
                )}
                <div className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
                  {aiAnalysis.result}
                </div>
              </div>
            ) : null}
          </div>

          <div className="px-6 py-4 border-t bg-muted/30 flex justify-end gap-2">
            {aiAnalysis.result && (
              <>
                <Button size="sm" variant="outline" onClick={async () => {
                  try {
                    const pdf = new jsPDF('p', 'mm', 'a4');
                    const img = new window.Image();
                    img.src = ellosuitLogo;
                    await new Promise((resolve) => { img.onload = resolve; setTimeout(resolve, 1000); });
                    pdf.addImage(img, 'PNG', 15, 10, 40, 12);
                    pdf.setFontSize(8);
                    pdf.setTextColor(150);
                    pdf.text(`Gerado em ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`, 195, 16, { align: 'right' });
                    pdf.setDrawColor(255, 69, 0);
                    pdf.setLineWidth(0.8);
                    pdf.line(15, 26, 195, 26);
                    pdf.setFontSize(14);
                    pdf.setTextColor(40);
                    const title = aiAnalysis.type === 'conversation' ? 'Análise da Conversa' : 'Análise da Mensagem';
                    pdf.text(title, 15, 36);
                    if (selectedConv) {
                      pdf.setFontSize(10);
                      pdf.setTextColor(100);
                      pdf.text(`Contato: ${selectedConv.contact_name || selectedConv.contact_phone}`, 15, 44);
                    }
                    if (aiAnalysis.messageContent) {
                      pdf.setFontSize(9);
                      pdf.setTextColor(120);
                      const msgLines = pdf.splitTextToSize(`Mensagem: "${aiAnalysis.messageContent}"`, 170);
                      pdf.text(msgLines, 15, 52);
                    }
                    const startY = aiAnalysis.messageContent ? 60 + (pdf.splitTextToSize(`"${aiAnalysis.messageContent}"`, 170).length * 4) : 52;
                    pdf.setFontSize(10);
                    pdf.setTextColor(50);
                    const lines = pdf.splitTextToSize(aiAnalysis.result || '', 175);
                    let y = startY;
                    for (const line of lines) {
                      if (y > 280) { pdf.addPage(); y = 15; }
                      pdf.text(line, 15, y);
                      y += 5;
                    }
                    pdf.setFontSize(7);
                    pdf.setTextColor(180);
                    const pageCount = pdf.getNumberOfPages();
                    for (let i = 1; i <= pageCount; i++) {
                      pdf.setPage(i);
                      pdf.text('Ellosuit CRM - Análise por IA', 15, 290);
                      pdf.text(`Página ${i} de ${pageCount}`, 195, 290, { align: 'right' });
                    }
                    pdf.save(`analise-${selectedConv?.contact_name || 'conversa'}-${new Date().toISOString().split('T')[0]}.pdf`);
                    toast({ title: 'PDF exportado!' });
                  } catch (e) {
                    console.error(e);
                    toast({ title: 'Erro ao gerar PDF', variant: 'destructive' });
                  }
                }}>
                  <FileText className="h-4 w-4 mr-2" /> Exportar PDF
                </Button>
                <Button size="sm" className="bg-[#374DA4] hover:bg-[#374DA4]/90 text-white" onClick={() => {
                  navigator.clipboard.writeText(aiAnalysis.result || '');
                  toast({ title: 'Copiado!' });
                }}>
                  <Copy className="h-4 w-4 mr-2" /> Copiar resposta
                </Button>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
      </div>
    </div>
  );
};

export default YCloudCRM;

