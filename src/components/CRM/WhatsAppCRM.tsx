import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import AIImproveMessageButton from './AIImproveMessageButton';
import { Plus, Phone, MessageSquare, Settings, QrCode, Trash2, Users, Bot, BotOff, Search, Filter, MoreVertical, Send, Check, CheckCheck, Circle, ArrowLeft, Sparkles, LayoutGrid, List, Tag, UserPlus, Contact, Archive, Image as ImageIcon, Loader2, Copy, Play, Pause, Mic, Paperclip, FileText, Calendar, RefreshCw, Square, GitBranch, ChevronDown, Eraser, User, UserCheck, History as HistoryIcon, ShieldOff, ShieldCheck, PauseCircle, CalendarClock, X, Heart, Power } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { FollowUpsPanel } from './FollowUpsPanel';
 import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator, DropdownMenuLabel } from '@/components/ui/dropdown-menu';
 import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useAdminMaster } from '@/hooks/useAdminMaster';
import { useToast } from '@/hooks/use-toast';
import WhatsAppQRModal from './WhatsAppQRModal';
import WhatsAppKanbanView, { DEFAULT_COLUMNS, KanbanColumn } from './WhatsAppKanbanView';
import ConversationLabelsManager from './ConversationLabelsManager';
import SaveLeadModal from './SaveLeadModal';
import ConversationPopup from './ConversationPopup';
import KanbanColumnConfig from './KanbanColumnConfig';
import { startLeadScoreWorker } from '@/lib/leadScoreWorker';

import WhatsAppContacts from './WhatsAppContacts';
import WhatsAppSatisfaction from './WhatsAppSatisfaction';
import WhatsAppAutopilot from './WhatsAppAutopilot';
import SwipeableConversationItem from './SwipeableConversationItem';
import ConversationContextMenu from './ConversationContextMenu';
import MessageContextMenu from './MessageContextMenu';
import AudioRecorderButton from './AudioRecorderButton';
import AudioComposerButton from './AudioComposerButton';
import ScheduleMeetingModal from './ScheduleMeetingModal';
import { ChannelSelector } from './ChannelSelector';
import StartChatbotModal from './StartChatbotModal';
import LeadScoreBadge from './LeadScoreBadge';
import ContactProfilePanel from './ContactProfilePanel';
import WhatsAppMediaMessage from './WhatsAppMediaMessage';
import LastMessagePreview from './LastMessagePreview';
import InviteAttendantDialog from './InviteAttendantDialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';
import { EllosuitWordmark } from '@/components/shared/EllosuitWordmark';
import MessagesLoadingState from '@/components/CRM/MessagesLoadingState';

interface WhatsAppSession {
  id: string;
  instance_name: string;
  status: string;
  phone_number?: string;
  phone_name?: string;
  profile_picture?: string;
  connected_at?: string;
  created_at: string;
  baileys_server_url?: string;
  deleted_at?: string | null;
}

interface ConversationLabel {
  id: string;
  name: string;
  color: string;
}

interface WhatsAppConversationData {
  id: string;
  contact_phone: string;
  contact_name?: string;
  last_message_at: string;
  last_message?: string;
  status: string;
  unread_count?: number;
  profile_picture?: string;
  session_id?: string;
  assigned_agent_id?: string;
  assigned_user_id?: string | null;
  ai_auto_reply_enabled?: boolean;
  human_takeover?: boolean;
  human_takeover_at?: string | null;
  human_takeover_reason?: string | null;
  autopilot_paused?: boolean;
  autopilot_paused_at?: string | null;
  autopilot_paused_scope?: string | null;
  last_human_interaction_message_id?: string | null;
  last_human_interaction_at?: string | null;
  is_demo?: boolean;
  is_ai_agent?: boolean;
  pipeline_stage?: string;
  labels?: string[];
  typing_status?: string | null;
  typing_updated_at?: string;
  group_description?: string;
}

interface WhatsAppMessage {
  id: string;
  conversation_id: string;
  content: string;
  from_me: boolean;
  status: string;
  created_at: string;
  sender_name?: string;
  wa_message_id?: string;
  message_type?: string;
  media_url?: string;
  media_caption?: string;
  is_ai_response?: boolean;
  reaction?: string;
  reactions?: Record<string, string>; // Map of sender_name -> emoji
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

const invokeFunctionWithTimeout = async <T = any>(
  functionName: string,
  options: Parameters<typeof supabase.functions.invoke>[1],
  timeoutMs = 25000,
): Promise<{ data?: T | null; error?: any; timedOut?: boolean }> => {
  return Promise.race([
    supabase.functions.invoke<T>(functionName, options),
    new Promise<{ data: null; error: null; timedOut: true }>((resolve) => {
      setTimeout(() => resolve({ data: null, error: null, timedOut: true }), timeoutMs);
    }),
  ]);
};

// Audio Player Component for WhatsApp-style audio messages
const AudioPlayer: React.FC<{ mediaUrl: string; fromMe: boolean; isPTT?: boolean }> = ({ mediaUrl, fromMe, isPTT }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const updateProgress = () => {
      if (audio.duration) {
        setProgress((audio.currentTime / audio.duration) * 100);
      }
    };

    const handleLoadedMetadata = () => setDuration(audio.duration);
    const handleEnded = () => {
      setIsPlaying(false);
      setProgress(0);
    };

    audio.addEventListener('timeupdate', updateProgress);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.removeEventListener('timeupdate', updateProgress);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('ended', handleEnded);
    };
  }, [mediaUrl]);

  const togglePlay = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!audioRef.current || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const percentage = clickX / rect.width;
    audioRef.current.currentTime = percentage * duration;
    setProgress(percentage * 100);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className={cn(
      "flex items-center gap-3 w-full max-w-[280px] p-2 rounded-xl overflow-hidden",
      fromMe ? "bg-primary/10" : "bg-muted/50"
    )}>
      <button
        onClick={togglePlay}
        className={cn(
          "flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center transition-all",
          isPTT 
            ? "bg-[#FF8C00] hover:bg-primary" 
            : "bg-[#FF8C00] hover:bg-primary"
        )}
      >
        {isPlaying ? (
          <Pause className="h-5 w-5 text-white" fill="white" />
        ) : (
          <Play className="h-5 w-5 text-white ml-0.5" fill="white" />
        )}
      </button>

      <div className="flex-1 flex flex-col gap-1">
        <div 
          className="h-[20px] flex items-center gap-[2px] cursor-pointer"
          onClick={handleProgressClick}
        >
          {Array.from({ length: 25 }).map((_, i) => {
            const heights = [10, 6, 14, 8, 16, 12, 6, 14, 10, 4, 12, 16, 8, 14, 6, 10, 14, 4, 12, 8, 16, 6, 14, 10, 4];
            const isActive = (i / 25) * 100 <= progress;
            return (
              <div
                key={i}
                className={cn(
                  "w-[2px] rounded-full transition-colors",
                  isActive ? "bg-primary" : (fromMe ? "bg-white/40" : "bg-gray-400/40")
                )}
                style={{ height: `${heights[i % heights.length]}px` }}
              />
            );
          })}
        </div>
        
        <div className="flex justify-between items-center">
          <span className={cn("text-[10px]", fromMe ? "text-white/70" : "text-gray-500")}>
            {duration > 0 ? formatTime(isPlaying ? (progress / 100) * duration : duration) : '0:00'}
          </span>
          {isPTT && <Mic className="h-3 w-3 text-primary" />}
        </div>
      </div>

      <audio ref={audioRef} src={mediaUrl} preload="metadata" className="hidden" />
    </div>
  );
};

// No demo data - real conversations only

const WhatsAppCRM: React.FC = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const { isMobile } = useIsMobile();
  const { isAdminMaster } = useAdminMaster();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesScrollAreaRef = useRef<HTMLDivElement>(null);
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);
  
  // State
  const [sessions, setSessions] = useState<WhatsAppSession[]>([]);
  const [conversations, setConversations] = useState<WhatsAppConversationData[]>([]);
  const [messages, setMessages] = useState<WhatsAppMessage[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [aiAgents, setAiAgents] = useState<AIAgent[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncingConversations, setSyncingConversations] = useState(false);
  const [companyId, setCompanyId] = useState<string | null>(null);
  
  // UI State
  const [showQRModal, setShowQRModal] = useState(false);
  const [reconnectingSessionId, setReconnectingSessionId] = useState<string | null>(null);

  // Force-reconnect a WhatsApp session: logout+delete+recreate on Evolution, then open QR modal
  const forceReconnectSession = async (sessionId: string) => {
    if (!sessionId || reconnectingSessionId === sessionId) return;
    setReconnectingSessionId(sessionId);
    try {
      toast({ title: 'Reconectando canal…', description: 'Recriando sessão no servidor' });
      const { error } = await supabase.functions.invoke('whatsapp-api', {
        body: { action: 'force_reconnect', sessionId },
      });
      if (error) throw error;
      // Mark as connecting locally and open QR modal for the user to scan
      setSessions(prev => prev.map(s => s.id === sessionId ? { ...s, status: 'connecting' } : s));
      setSelectedSessionId(sessionId);
      setShowQRModal(true);
      toast({ title: 'Escaneie o QR', description: 'A conexão foi reiniciada. Leia o QR Code no WhatsApp.' });
    } catch (e: any) {
      console.error('[forceReconnectSession] error:', e);
      toast({ title: 'Erro', description: e?.message || 'Falha ao reconectar', variant: 'destructive' });
    } finally {
      setReconnectingSessionId(null);
    }
  };
  const [selectedConversation, setSelectedConversation] = useState<WhatsAppConversationData | null>(null);
  const [selectedAgent, setSelectedAgent] = useState<AIAgent | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [newMessage, setNewMessage] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);
  const [activeTab, setActiveTab] = useState<'all' | 'unread' | 'open' | 'closed'>('all');
  const [showMobileChat, setShowMobileChat] = useState(false);
  const [agentChatMessages, setAgentChatMessages] = useState<WhatsAppMessage[]>([]);
  const [isAiTyping, setIsAiTyping] = useState(false);
  const [agentChatHistory, setAgentChatHistory] = useState<Record<string, WhatsAppMessage[]>>({});

  // Mini-history of conversation events (IA paused, takeover, returned, etc.)
  type ConversationEvent = {
    id: string;
    event_type: string;
    actor_type: string;
    actor_name: string | null;
    reason: string | null;
    metadata: any;
    created_at: string;
  };
  const [conversationEvents, setConversationEvents] = useState<ConversationEvent[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [followUpsOpen, setFollowUpsOpen] = useState(false);

  // Teammates / transfer
  interface Teammate { user_id: string; name: string; email: string | null; role: string; avatar_url?: string | null }
  const [teammates, setTeammates] = useState<Teammate[]>([]);
  const [isCompanyAdmin, setIsCompanyAdmin] = useState(false);
  const [showInviteDialog, setShowInviteDialog] = useState(false);

  const logConversationEvent = useCallback(async (
    conversationId: string,
    eventType: string,
    reason?: string,
    metadata: Record<string, unknown> = {},
  ) => {
    if (!companyId) return;
    try {
      const actorName =
        (user?.user_metadata as any)?.full_name ||
        (user?.user_metadata as any)?.username ||
        user?.email ||
        'Operador';
      await supabase.from('conversation_events').insert([{
        conversation_id: conversationId,
        company_id: companyId,
        event_type: eventType,
        actor_type: 'user',
        actor_id: user?.id ?? null,
        actor_name: actorName,
        reason: reason ?? null,
        metadata: metadata as any,
      }]);
    } catch (err) {
      console.warn('[conversation_events] insert failed', err);
    }
  }, [companyId, user]);

  // Load events whenever the selected conversation changes or popover opens
  useEffect(() => {
    if (!selectedConversation?.id) {
      setConversationEvents([]);
      return;
    }
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from('conversation_events')
        .select('id,event_type,actor_type,actor_name,reason,metadata,created_at')
        .eq('conversation_id', selectedConversation.id)
        .order('created_at', { ascending: false })
        .limit(50);
      if (!cancelled) setConversationEvents((data as ConversationEvent[]) || []);
    })();
    return () => { cancelled = true; };
  }, [selectedConversation?.id, historyOpen]);

  // Load teammates of the company (for the transfer menu) + caller role
  useEffect(() => {
    if (!companyId || !user?.id) return;
    // Also load company-level autopilot state for badges + parent phone
    (async () => {
      const { data } = await supabase
        .from('crm_autopilot_configs')
        .select('is_active, parent_phone')
        .eq('company_id', companyId)
        .maybeSingle();
      setAutopilotActive(!!data?.is_active);
      setAutopilotParentPhone(data?.parent_phone || null);
    })();
    const ch = supabase
      .channel(`autopilot-cfg-${companyId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'crm_autopilot_configs', filter: `company_id=eq.${companyId}` }, (payload: any) => {
        setAutopilotActive(!!payload.new?.is_active);
        setAutopilotParentPhone(payload.new?.parent_phone || null);
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [companyId]);

  useEffect(() => {
    if (!companyId || !user?.id) return;
    let cancelled = false;
    (async () => {
      const { data: members } = await supabase
        .from('company_users')
        .select('user_id, role')
        .eq('company_id', companyId);
      if (!members || cancelled) return;
      const me = members.find(m => m.user_id === user.id);
      setIsCompanyAdmin(!!me && ['admin', 'adminmaster', 'manager'].includes(me.role as string));
      const ids = members.map(m => m.user_id);
      if (ids.length === 0) { setTeammates([]); return; }
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, display_name, username, avatar_url')
        .in('id', ids);
      const profMap = new Map((profiles || []).map((p: any) => [p.id, p]));
      const list: Teammate[] = members.map((m: any) => {
        const p: any = profMap.get(m.user_id) || {};
        return {
          user_id: m.user_id,
          name: p.display_name || p.username || 'Atendente',
          email: null,
          role: m.role,
          avatar_url: p.avatar_url || null,
        };
      });
      if (!cancelled) setTeammates(list);
    })();
    return () => { cancelled = true; };
  }, [companyId, user?.id]);

  const handleTransferConversation = useCallback(async (targetUserId: string | null) => {
    if (!selectedConversation) return;
    const target = targetUserId ? teammates.find(t => t.user_id === targetUserId) : null;
    const { error } = await supabase
      .from('whatsapp_conversations')
      .update({ assigned_user_id: targetUserId })
      .eq('id', selectedConversation.id);
    if (error) {
      toast({ title: 'Erro ao transferir', description: error.message, variant: 'destructive' });
      return;
    }
    setConversations(prev => prev.map(c => c.id === selectedConversation.id ? { ...c, assigned_user_id: targetUserId as any } : c));
    setSelectedConversation(prev => prev ? { ...prev, assigned_user_id: targetUserId as any } : prev);
    await logConversationEvent(
      selectedConversation.id,
      targetUserId ? 'transferred' : 'unassigned',
      targetUserId ? `Conversa transferida para ${target?.name || 'atendente'}` : 'Atribuição removida',
      { target_user_id: targetUserId, target_name: target?.name || null },
    );
    toast({
      title: targetUserId ? 'Conversa transferida' : 'Atribuição removida',
      description: targetUserId ? `Agora ${target?.name || 'o atendente'} verá essa conversa.` : 'A conversa ficou disponível para administradores.',
    });
  }, [selectedConversation, teammates, toast, logConversationEvent]);
  
  // New CRM Features State
  const [viewMode, setViewMode] = useState<'list' | 'kanban' | 'contacts' | 'satisfaction' | 'autopilot'>('list');
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [labels, setLabels] = useState<ConversationLabel[]>([]);
  const [showLabelsManager, setShowLabelsManager] = useState(false);
  const [showSaveLeadModal, setShowSaveLeadModal] = useState(false);
  const [selectedConversationForLabels, setSelectedConversationForLabels] = useState<WhatsAppConversationData | null>(null);
  const [selectedConversationForLead, setSelectedConversationForLead] = useState<WhatsAppConversationData | null>(null);
  const [contactsCount, setContactsCount] = useState(0);
  
   // Kanban specific state
   const [kanbanColumns, setKanbanColumns] = useState<KanbanColumn[]>(() => {
     const saved = localStorage.getItem('whatsapp_kanban_columns');
     return saved ? JSON.parse(saved) : DEFAULT_COLUMNS;
   });
   const [showColumnConfig, setShowColumnConfig] = useState(false);
   const [showConversationPopup, setShowConversationPopup] = useState(false);
   const [popupConversation, setPopupConversation] = useState<WhatsAppConversationData | null>(null);
   const [showStartChatbot, setShowStartChatbot] = useState(false);
  const [activateAutomationOpen, setActivateAutomationOpen] = useState(false);
  const [activateStep, setActivateStep] = useState<'choice' | 'agents'>('choice');
   const [activeChatbotFlow, setActiveChatbotFlow] = useState<{ id: string; name: string } | null>(null);
   const [chatbotActiveConvIds, setChatbotActiveConvIds] = useState<Set<string>>(new Set());
    const [autopilotActive, setAutopilotActive] = useState(false);
    const [autopilotParentPhone, setAutopilotParentPhone] = useState<string | null>(null);
   const [popupMessages, setPopupMessages] = useState<WhatsAppMessage[]>([]);
   const [stoppingAllBots, setStoppingAllBots] = useState(false);
   const [crmIsActive, setCrmIsActive] = useState(true); // Always active now
  const [confirmCleanup, setConfirmCleanup] = useState(false);
  const [cleaningUp, setCleaningUp] = useState(false);
  
  // Media upload state
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const dragCounterRef = useRef(0);
  const [pendingDropFiles, setPendingDropFiles] = useState<File[]>([]);
  const [dropCaption, setDropCaption] = useState('');
  const [sendingDropped, setSendingDropped] = useState(false);
  const [recordingAudio, setRecordingAudio] = useState(false);
  
  // Schedule meeting modal state
  const [showScheduleMeetingModal, setShowScheduleMeetingModal] = useState(false);
  
  // Contact profile panel state
  const [showContactProfile, setShowContactProfile] = useState(false);
  
  // Sync data state
  const [syncingData, setSyncingData] = useState(false);
  
  // Selected session for channel selector
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>('ALL');

  // Context menu states
  const [conversationContextMenu, setConversationContextMenu] = useState<{
    isOpen: boolean;
    position: { x: number; y: number };
    conversation: WhatsAppConversationData | null;
  }>({ isOpen: false, position: { x: 0, y: 0 }, conversation: null });
  
  const [messageContextMenu, setMessageContextMenu] = useState<{
    isOpen: boolean;
    position: { x: number; y: number };
    messageId: string;
    messageContent: string;
    isFromMe: boolean;
  }>({ isOpen: false, position: { x: 0, y: 0 }, messageId: '', messageContent: '', isFromMe: false });

  // Load persisted agent chat history from localStorage
  useEffect(() => {
    const savedAgentHistory = localStorage.getItem('whatsapp_agent_history');
    
    if (savedAgentHistory) {
      try {
        setAgentChatHistory(JSON.parse(savedAgentHistory));
      } catch (e) {
        console.error('Error loading agent history:', e);
      }
    }
  }, []);

  // Save agent chat history to localStorage
  useEffect(() => {
    if (Object.keys(agentChatHistory).length > 0) {
      localStorage.setItem('whatsapp_agent_history', JSON.stringify(agentChatHistory));
    }
  }, [agentChatHistory]);

  // Mobile: Handle browser back button to go back to conversation list instead of dashboard
  useEffect(() => {
    if (!isMobile || !showMobileChat) return;
    
    // Push a state so back button goes to conversation list
    window.history.pushState({ whatsappChat: true }, '');
    
    const handlePopState = (e: PopStateEvent) => {
      if (showMobileChat) {
        e.preventDefault();
        setShowMobileChat(false);
        setSelectedConversation(null);
        setSelectedAgent(null);
      }
    };
    
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [isMobile, showMobileChat]);

  useEffect(() => {
    if (selectedConversation || selectedAgent) {
      // Small delay to ensure the DOM has rendered the messages
      const timer = setTimeout(() => {
        handleScrollToBottom();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [selectedConversation?.id, selectedAgent?.id]);

  useEffect(() => {
    if (!showScrollToBottom) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, agentChatMessages]);

  // Detect scroll position to show/hide scroll-to-bottom button
  useEffect(() => {
    const viewport = messagesScrollAreaRef.current?.querySelector('[data-radix-scroll-area-viewport]') as HTMLElement | null;
    if (!viewport) return;
    const onScroll = () => {
      const distanceFromBottom = viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight;
      setShowScrollToBottom(distanceFromBottom > 150);
    };
    viewport.addEventListener('scroll', onScroll);
    return () => viewport.removeEventListener('scroll', onScroll);
  }, [selectedConversation, selectedAgent]);

  const handleScrollToBottom = () => {
    const viewport = messagesScrollAreaRef.current?.querySelector('[data-radix-scroll-area-viewport]') as HTMLElement | null;
    if (viewport) viewport.scrollTop = viewport.scrollHeight;
  };

  // Polling for popup messages when popup is open
  useEffect(() => {
    if (!showConversationPopup || !popupConversation || !companyId) return;
    
    const refreshPopupMessages = async () => {
      const { data: convs } = await supabase
        .from('whatsapp_conversations')
        .select('id')
        .eq('company_id', companyId)
        .eq('contact_phone', popupConversation.contact_phone);
      
      if (convs && convs.length > 0) {
        const conversationIds = convs.map(c => c.id);
        const { data } = await supabase
          .from('whatsapp_messages')
          .select('*')
          .in('conversation_id', conversationIds)
          .order('timestamp', { ascending: true })
          .limit(200);
        
        const uniqueMessages = new Map<string, WhatsAppMessage>();
        (data || []).forEach(m => {
          const key = m.wa_message_id || m.id;
          if (!uniqueMessages.has(key)) {
            uniqueMessages.set(key, { 
              ...m, 
              created_at: m.timestamp || m.created_at,
              message_type: m.message_type,
              media_url: m.media_url,
              media_caption: m.media_caption
            });
          }
        });
        
        // Only update if changed
        const newMsgs = Array.from(uniqueMessages.values());
        setPopupMessages(prev => {
          const prevIds = prev.map(m => m.id).join(',');
          const newIds = newMsgs.map(m => m.id).join(',');
          if (prevIds === newIds) return prev;
          return newMsgs;
        });
      }
    };
    
    // Initial load
    refreshPopupMessages();
    
    // Poll every 500ms for instant sync
    const interval = setInterval(refreshPopupMessages, 500);
    return () => clearInterval(interval);
  }, [showConversationPopup, popupConversation?.contact_phone, companyId]);

  // Get company ID
  useEffect(() => {
    const getCompanyId = async () => {
      if (!user?.id) return;
      
      const metadataCompanyId = user.user_metadata?.company_id;
      if (metadataCompanyId) {
        setCompanyId(metadataCompanyId);
        return;
      }

      const { data } = await supabase
        .from('company_users')
        .select('company_id')
        .eq('user_id', user.id)
        .single();
      
      if (data?.company_id) {
        setCompanyId(data.company_id);
      }
    };

    getCompanyId();
  }, [user?.id]);

  // Background async worker: re-scores stale leads every 12h without blocking the CRM.
  useEffect(() => {
    if (!companyId) return;
    const stop = startLeadScoreWorker(companyId);
    return () => stop();
  }, [companyId]);

  // Initial background sync for profile pictures
  useEffect(() => {
    if (companyId) {
      const runInitialSync = async () => {
        try {
          console.log('[SYNC] Starting initial profile picture check...');
          await supabase.functions.invoke('whatsapp-sync-profile-pictures', {
            body: { company_id: companyId, limit: 100, force: false }
          });
        } catch (e) {
          console.error('[SYNC] Initial sync error:', e);
        }
      };
      
      // Delay slightly to not compete with initial data load
      const timer = setTimeout(runInitialSync, 5000);
      return () => clearTimeout(timer);
    }
  }, [companyId]);

  // Unify sessions with the same phone number - migrate conversations to the newest session
  const unifyDuplicateSessions = async (sessionsData: WhatsAppSession[]) => {
    if (!companyId || sessionsData.length < 2) return sessionsData;
    
    // Group sessions by phone number
    const byPhone = new Map<string, WhatsAppSession[]>();
    sessionsData.forEach(s => {
      const phone = s.phone_number?.replace(/\D/g, '');
      if (phone) {
        if (!byPhone.has(phone)) byPhone.set(phone, []);
        byPhone.get(phone)!.push(s);
      }
    });
    
    const sessionsToDelete: string[] = [];
    
    for (const [phone, group] of byPhone.entries()) {
      if (group.length < 2) continue;
      
      // Keep the newest connected session, or newest overall
      const sorted = [...group].sort((a, b) => {
        // Prefer connected
        if (a.status === 'connected' && b.status !== 'connected') return -1;
        if (b.status === 'connected' && a.status !== 'connected') return 1;
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
      
      const keepSession = sorted[0];
      const oldSessions = sorted.slice(1);
      const oldIds = oldSessions.map(s => s.id);
      
      console.log(`[Unify] Phone ${phone}: keeping ${keepSession.id}, merging ${oldIds.length} old session(s)`);
      
      // Migrate conversations from old sessions to the keep session
      const { data: migrated } = await supabase
        .from('whatsapp_conversations')
        .update({ session_id: keepSession.id })
        .in('session_id', oldIds)
        .select('id');
      
      if (migrated && migrated.length > 0) {
        console.log(`[Unify] ✅ Migrated ${migrated.length} conversations for phone ${phone}`);
      }
      
      // Also migrate messages from old sessions
      await supabase
        .from('whatsapp_messages')
        .update({ session_id: keepSession.id })
        .in('session_id', oldIds);
      
      // Delete old sessions
      await supabase
        .from('whatsapp_sessions')
        .delete()
        .in('id', oldIds);
      
      sessionsToDelete.push(...oldIds);
    }
    
    if (sessionsToDelete.length > 0) {
      return sessionsData.filter(s => !sessionsToDelete.includes(s.id));
    }
    return sessionsData;
  };

    const handleDeleteSession = async (sessionId: string) => {
      if (!confirm('Deseja realmente excluir esta conexão?')) return;
      
      try {
        // Primeiro, tentar desconectar via API (Evolution)
        try {
          await supabase.functions.invoke('whatsapp-api', {
            body: { action: 'delete_session', sessionId }
          });
        } catch (apiErr) {
          console.warn('Erro ao desconectar remotamente, prosseguindo com exclusão local:', apiErr);
        }

        const { error } = await (supabase as any).rpc('soft_delete_whatsapp_session', {
          _session_id: sessionId
        });
        
        if (error) throw error;
        
        toast({ title: 'Conexão excluída', description: 'A sessão foi removida com sucesso.' });
        loadSessions();
        if (selectedSessionId === sessionId) {
          setSelectedSessionId(null);
          setSelectedConversation(null);
          setMessages([]);
        }
      } catch (err: any) {
        console.error('Error deleting session:', err);
        toast({ title: 'Erro ao excluir', description: err.message, variant: 'destructive' });
      }
    };

   const handleCleanupInactiveSessions = async () => {
     if (!companyId) return;

     setCleaningUp(true);
     try {
       const { data, error } = await (supabase as any).rpc('cleanup_all_inactive_whatsapp_sessions', {
         _company_id: companyId
       });

       if (error) throw error;

       const deletedCount = Number(data || 0);
       toast({
         title: 'Sessões inativas removidas',
         description: `${deletedCount} sessão(ões) inativa(s) excluída(s).`
       });

       await loadSessions();
       setSessions(prev => prev.filter(s => s.status === 'connected'));
       setSelectedSessionId(sessions.find(s => s.status === 'connected')?.id || null);
       setSelectedConversation(null);
       setMessages([]);
     } catch (error: any) {
       toast({
         title: 'Erro ao limpar sessões',
         description: error.message || 'Não foi possível excluir as sessões inativas.',
         variant: 'destructive'
       });
     } finally {
       setCleaningUp(false);
       setConfirmCleanup(false);
     }
   };

  // Load data
  const loadSessions = async () => {
    if (!companyId) return;
    
    const { data, error } = await supabase
      .from('whatsapp_sessions')
      .select('*')
      .eq('company_id', companyId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false });
    
    if (!error && data) {
      // Auto-unify duplicate sessions with same phone number
      const unified = await unifyDuplicateSessions(data);
      setSessions(unified);
    }
  };

  // Helper: Check if conversation is valid
  // v3.5.0: Show ALL conversations including groups without names (display formatted ID)
  const isValidConversation = (conv: WhatsAppConversationData): boolean => {
    if (!conv.contact_phone) return false;
    const digits = conv.contact_phone.replace(/\D/g, '');
    
    // Too short is invalid
    if (digits.length < 8) return false;
    
    // v3.5.0: Show ALL conversations - groups will be displayed with formatted ID if no name
    return true;
  };
  
  // Format phone number for display: +55 (17) 98183-2566
  const formatPhoneDisplay = (phone: string): string => {
    const digits = phone.replace(/\D/g, '');
    if (digits.startsWith('55') && (digits.length === 12 || digits.length === 13)) {
      const ddd = digits.slice(2, 4);
      const number = digits.slice(4);
      if (number.length === 9) {
        return `+55 (${ddd}) ${number.slice(0, 5)}-${number.slice(5)}`;
      }
      if (number.length === 8) {
        return `+55 (${ddd}) ${number.slice(0, 4)}-${number.slice(4)}`;
      }
    }
    if (digits.length > 6) {
      return `+${digits}`;
    }
    return phone;
  };

  // Helper: Get display name for conversation (handles groups without names)
  // Also checks messages for sender_name as fallback
  const isTypingStatusValid = (conv: WhatsAppConversationData): boolean => {
    if (!conv.typing_status || !conv.typing_updated_at) return false;
    const updatedAt = new Date(conv.typing_updated_at).getTime();
    const now = new Date().getTime();
    // Typing status usually expires after 10-15 seconds in WhatsApp
    return (now - updatedAt) < 15000;
  };

  const getDisplayName = (conv: WhatsAppConversationData, messagesForLookup?: WhatsAppMessage[]): string => {
    if (conv.contact_name && conv.contact_name !== conv.contact_phone) {
      return conv.contact_name;
    }
    
    // Fallback: look for sender_name in incoming messages
    if (messagesForLookup && messagesForLookup.length > 0) {
      const incomingWithName = messagesForLookup.find(m => !m.from_me && m.sender_name);
      if (incomingWithName?.sender_name) {
        return incomingWithName.sender_name;
      }
    }
    
    // For groups without name, show formatted ID
    const digits = conv.contact_phone.replace(/\D/g, '');
    if (digits.length > 15) {
      return `Grupo ${digits.substring(0, 8)}...`;
    }
    return formatPhoneDisplay(conv.contact_phone);
  };
  
  // Helper: Check if conversation is a group
  const isGroupConversation = (conv: WhatsAppConversationData): boolean => {
    const digits = conv.contact_phone.replace(/\D/g, '');
    return digits.length > 15;
  };

  // Helper: Check if conversation is with the configured parent (Pai do Piloto) number
  const isParentConversation = (conv: WhatsAppConversationData): boolean => {
    if (!autopilotParentPhone || !conv.contact_phone) return false;
    const parentDigits = autopilotParentPhone.replace(/\D/g, '');
    const contactDigits = conv.contact_phone.replace(/\D/g, '');
    if (!parentDigits || !contactDigits) return false;
    // Match by suffix if one side lacks country code (e.g. 41985350504 vs 5541985350504)
    if (parentDigits === contactDigits) return true;
    if (parentDigits.length > contactDigits.length && parentDigits.endsWith(contactDigits)) return true;
    if (contactDigits.length > parentDigits.length && contactDigits.endsWith(parentDigits)) return true;
    return false;
  };

  // Legacy helper for backwards compatibility
  const isValidPhoneNumber = (phone: string): boolean => {
    if (!phone) return false;
    const digits = phone.replace(/\D/g, '');
    return digits.length >= 8;
  };

  const loadConversations = async () => {
    if (!companyId) return;
    
    let query = supabase
      .from('whatsapp_conversations')
      .select('*')
      .eq('company_id', companyId);
    
    // Só mostra conversas de canais ativos (não excluídos). Sem canal = sem conversas.
    const { data: activeSessions } = await supabase
      .from('whatsapp_sessions')
      .select('id')
      .eq('company_id', companyId)
      .is('deleted_at', null);
    const activeIds = (activeSessions || []).map((s: any) => s.id);
    if (activeIds.length === 0) {
      setConversations([]);
      return;
    }

    // FILTRAR POR SESSÃO SELECIONADA se houver (ALL = todos os canais)
    if (selectedSessionId && selectedSessionId !== 'ALL' && activeIds.includes(selectedSessionId)) {
      query = query.eq('session_id', selectedSessionId);
    } else {
      query = query.in('session_id', activeIds);
    }
    
    const { data, error } = await query
      .order('last_message_at', { ascending: false })
      .limit(200);
    
    if (error) {
      console.error('❌ Error loading conversations:', error);
      return;
    }
    
    // Filter out invalid conversations and deduplicate by normalized identity
    const normalizeBrPhone = (p: string) => {
      const d = p.replace(/\D/g, '');
      if (d.startsWith('55') && d.length === 12) {
        return d.slice(0, 4) + '9' + d.slice(4);
      }
      return d;
    };

    const getAvatarKey = (url?: string | null) => (url || '').split('?')[0].trim().toLowerCase();
    const isRealBrPhone = (digits: string) => digits.startsWith('55') && (digits.length === 12 || digits.length === 13);

    const uniqueByIdentity = new Map<string, typeof data[0]>();
    (data || []).forEach(conv => {
      if (!isValidConversation(conv)) return;

      const phoneDigits = normalizeBrPhone(conv.contact_phone);
      const isGroup = conv.remote_jid?.includes('@g.us') || phoneDigits.length > 15;
      const isLidLike = conv.remote_jid?.includes('@lid') || (!isGroup && !isRealBrPhone(phoneDigits) && phoneDigits.length >= 14);

      // HIDE all WhatsApp groups — they pollute the inbox with "Grupo 1203..." entries
      if (isGroup) return;

      // HIDE LID conversations entirely
      if (isLidLike && !isGroup) return;

      const identityKey = isGroup ? `group:${phoneDigits}` : `phone:${phoneDigits}`;

      const existing = uniqueByIdentity.get(identityKey);
      if (!existing) {
        uniqueByIdentity.set(identityKey, conv);
        return;
      }

      const existingDigits = normalizeBrPhone(existing.contact_phone);
      const existingIsReal = isRealBrPhone(existingDigits);
      const currentIsReal = isRealBrPhone(phoneDigits);

      // Prefer canonical BR phone conversation over LID-like rows, then newest message.
      // CRITICAL: Also prefer conversations that actually have a last_message text
      // to avoid the "empty preview" bug where a newer ghost row replaces a valid one.
      const existingHasContent = !!(existing.last_message && existing.last_message.trim());
      const currentHasContent = !!(conv.last_message && conv.last_message.trim());

      if (currentIsReal && !existingIsReal) {
        uniqueByIdentity.set(identityKey, conv);
      } else if (currentIsReal === existingIsReal) {
        const currentIsNewer = new Date(conv.last_message_at) > new Date(existing.last_message_at);
        
        if (currentHasContent && !existingHasContent) {
          // If current has content but existing doesn't, take current (even if slightly older)
          uniqueByIdentity.set(identityKey, conv);
        } else if (currentHasContent === existingHasContent && currentIsNewer) {
          // If both have or both lack content, take the newer one
          uniqueByIdentity.set(identityKey, conv);
        } else if (!currentHasContent && existingHasContent && !currentIsNewer) {
          // Keep existing (it has content and is newer or same age)
        }
      }
    });

    let deduplicated = Array.from(uniqueByIdentity.values())
      .sort((a, b) => new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime());

    // REPAIR/SYNC: The WhatsApp message row is the source of truth. If a send/webhook
    // saved whatsapp_messages but did not update whatsapp_conversations.last_message,
    // recover the sidebar preview from the latest message row immediately.
    const deduplicatedIds = deduplicated.map(c => c.id).filter(Boolean);
    if (deduplicatedIds.length > 0) {
      const { data: latestRows, error: latestRowsError } = await supabase
        .from('whatsapp_messages')
        .select('conversation_id, content, created_at, timestamp, message_type, media_caption')
        .in('conversation_id', deduplicatedIds)
        .order('timestamp', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(Math.min(deduplicatedIds.length * 8, 1000));

      if (!latestRowsError && latestRows && latestRows.length > 0) {
        const latestByConversation = new Map<string, typeof latestRows[0]>();
        latestRows.forEach(m => {
          if (m.conversation_id && !latestByConversation.has(m.conversation_id)) {
            latestByConversation.set(m.conversation_id, m);
          }
        });

        deduplicated = deduplicated
          .map(c => {
            const latest = latestByConversation.get(c.id);
            if (!latest) return c;

            const latestAt = new Date(latest.timestamp || latest.created_at || 0).getTime();
            const currentAt = new Date(c.last_message_at || 0).getTime();
            const preview = latest.message_type && latest.message_type !== 'text'
              ? (latest.media_caption || latest.content || `[${latest.message_type}]`)
              : (latest.content || '');

            if (!preview.trim()) return c;

            const shouldRepair =
              !c.last_message?.trim() ||
              latestAt >= currentAt && c.last_message !== preview;

            return shouldRepair
              ? { ...c, last_message: preview, last_message_at: new Date(latestAt || Date.now()).toISOString() }
              : c;
          })
          .sort((a, b) => new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime());
      }
    }

    // FORCED AUTO-REFRESH: Se a conversa "GOPHARMA" estiver na lista e a última mensagem for antiga,
    // tentamos puxar mais mensagens recentes dela para garantir que não pareça travada.
    const gopharma = deduplicated.find(c => c.contact_name?.toUpperCase().includes('GOPHARMA'));
    if (gopharma && gopharma.last_message_at) {
      const lastMsgDate = new Date(gopharma.last_message_at);
      const now = new Date();
      const diffMinutes = (now.getTime() - lastMsgDate.getTime()) / (1000 * 60);
      
      // Se a última mensagem tem mais de 2 horas e não estamos carregando, 
      // forçamos uma verificação mais profunda buscando mensagens ignoradas por tempo ou canal.
      if (diffMinutes > 120 && !syncingData) {
        console.log(`[GOPHARMA-WATCH] Last activity ${Math.floor(diffMinutes)}m ago. Deep syncing...`);
        // Dispara uma sincronização forçada de mensagens para este canal especificamente
        if (gopharma.session_id) {
          supabase.functions.invoke('whatsapp-api', {
            body: { action: 'sync_messages', sessionId: gopharma.session_id, jid: gopharma.remote_jid || gopharma.contact_phone + '@g.us' }
          }).catch(console.error);
        }
      }
    }

    // Force selected conversation to always show 0 unread (it's being read RIGHT NOW)
    const currentlyOpenId = selectedConversationIdRef.current;

    if (currentlyOpenId) {
      for (let i = 0; i < deduplicated.length; i++) {
        if (deduplicated[i].id === currentlyOpenId && (deduplicated[i].unread_count || 0) > 0) {
          deduplicated[i] = { ...deduplicated[i], unread_count: 0 };
        }
      }
    }

    // Only update state if data actually changed (prevent flicker)
    // Include last_message in the fingerprint to ensure UI updates when preview text is repaired
    setConversations(prev => {
      const prevIds = prev.map(c => `${c.id}-${c.last_message_at}-${c.unread_count}-${c.last_message || ''}-${c.profile_picture || ''}`).join(',');
      const newIds = deduplicated.map(c => `${c.id}-${c.last_message_at}-${c.unread_count}-${c.last_message || ''}-${c.profile_picture || ''}`).join(',');
      if (prevIds === newIds) return prev;
      return deduplicated;
    });
  };

  // Load messages from ALL conversations with the same contact_phone
  // IMPORTANT: Robust deduplication to prevent jumbled messages after reconnection
  const loadMessagesByPhone = async (contactPhone: string) => {
    if (!contactPhone) return;
    
    // Safety: ensure we only update messages if this conversation is still the selected one
    const currentConvId = selectedConversation?.id;
    // First get all conversation IDs for this phone (including 12/13-digit BR variants)
    const normalizeBrPhone = (p: string) => {
      const d = p.replace(/\D/g, '');
      if (d.startsWith('55') && d.length === 12) {
        return d.slice(0, 4) + '9' + d.slice(4);
      }
      return d;
    };

    const normalizedPhone = normalizeBrPhone(contactPhone);
    const phoneVariants = [normalizedPhone];
    if (normalizedPhone.startsWith('55') && normalizedPhone.length === 13) {
      phoneVariants.push(normalizedPhone.slice(0, 4) + normalizedPhone.slice(5));
    }

    const { data: convs } = await supabase
      .from('whatsapp_conversations')
      .select('id, last_message, last_message_at')
      .eq('company_id', companyId)
      .in('contact_phone', phoneVariants);
    
    if (!convs || convs.length === 0) return;
    
    const conversationIds = convs.map(c => c.id);
    
    // Get all messages from all these conversations
    // IMPORTANT: order timestamp ASC to ensure stable sorting.
    // If we have many messages, we might need a limit, but we MUST ensure we get the latest ones.
    const { data: rawData, error } = await supabase
      .from('whatsapp_messages')
      .select('*')
      .in('conversation_id', conversationIds)
      .order('timestamp', { ascending: true })
      .order('created_at', { ascending: true }); // Secondary sort for stable ordering within the same second
    
    if (!error && rawData) {
      // Safety check: if user switched conversations while we were fetching, ignore results
      if (selectedConversation?.id !== currentConvId && currentConvId !== undefined) {
        console.log('🛑 Ignoring stale message fetch results');
        return;
      }

      selectedConversationIdsRef.current = new Set(conversationIds);
      
      const data = rawData; // Already ASC

      // ROBUST DEDUPLICATION: Use wa_message_id as primary key, with content+timestamp as fallback
      const uniqueMessages = new Map<string, WhatsAppMessage>();
      const messageReactions = new Map<string, Record<string, string>>();
      
      // First pass: identify reactions and group them by target message
      data.filter(m => m.message_type === 'reaction').forEach(m => {
        const targetId = m.content; // In Baileys/Evolution, reaction content is often the target wa_message_id or emoji
        // This part depends on how your backend stores reactions. 
        // If message_type is 'reaction', usually 'reaction' field has the emoji.
        if (targetId && m.reaction) {
          if (!messageReactions.has(targetId)) {
            messageReactions.set(targetId, {});
          }
          const reactions = messageReactions.get(targetId)!;
          reactions[m.sender_name || 'unknown'] = m.reaction;
        }
      });
      
      data.forEach(m => {
        if (m.message_type === 'reaction') return; // Skip reaction messages as they are now grouped

        // Primary key: wa_message_id (unique from WhatsApp)
        // Secondary key: content + from_me + timestamp (for messages without wa_message_id)
        const primaryKey = m.wa_message_id;
        const timestamp = new Date(m.timestamp || m.created_at).getTime();
        const fallbackKey = `${m.content?.substring(0, 50)}_${m.from_me}_${Math.floor(timestamp / 1000)}`;
        const key = primaryKey || fallbackKey;
        
        // Only add if not already exists - first occurrence wins (earliest insert)
        if (!uniqueMessages.has(key)) {
          // Check for reactions for this message
          const reactions = m.wa_message_id ? messageReactions.get(m.wa_message_id) : undefined;

          uniqueMessages.set(key, {
            ...m,
            created_at: m.timestamp || m.created_at,
            wa_message_id: m.wa_message_id,
            message_type: m.message_type,
            media_url: m.media_url,
            media_caption: m.media_caption,
            is_ai_response: m.is_ai_response,
            sender_name: m.sender_name,
            reactions: reactions || (m.reaction ? { [m.sender_name || (m.from_me ? 'Me' : 'Contact')]: m.reaction } : undefined)
          });
        }
      });
      
      // Sort by timestamp ascending for correct chronological order
      let serverMessages = Array.from(uniqueMessages.values())
        .sort((a, b) => {
          const timeA = new Date(a.created_at).getTime();
          const timeB = new Date(b.created_at).getTime();
          // If timestamps are equal, use id as tiebreaker for stable sorting
          if (timeA === timeB) {
            return a.id.localeCompare(b.id);
          }
          return timeA - timeB;
        });

      // Fallback for Evolution API chats.upsert-only updates: if the conversation
      // preview exists but no whatsapp_messages row was persisted yet, render that
      // preview immediately in the right panel instead of showing an empty chat.
      if (serverMessages.length === 0) {
        const preview = [...convs]
          .filter(c => c.last_message && c.last_message.trim())
          .sort((a, b) => new Date(b.last_message_at || 0).getTime() - new Date(a.last_message_at || 0).getTime())[0];

        if (preview) {
          serverMessages = [{
            id: `preview-${preview.id}-${preview.last_message_at || 'now'}`,
            conversation_id: preview.id,
            content: preview.last_message || '',
            from_me: false,
            status: 'received',
            created_at: preview.last_message_at || new Date().toISOString(),
            message_type: preview.last_message?.startsWith('[Imagem]') ? 'image' : 'text',
          } as WhatsAppMessage];
        }
      }
      
      // OPTIMISTIC UI: Preserve temp messages and merge with server data
      setMessages(prev => {
        // Separate temp messages (optimistic) from real messages
        const tempMessages = prev.filter(m => m.id.startsWith('temp-') && conversationIds.includes(m.conversation_id));
        
        // Find which temp messages have been synced to server.
        // Matching strategy (most robust → most permissive):
        //   1) exact content + from_me within 5 minutes
        //   2) exact content + from_me (any time)
        // Also: drop any temp older than 2 minutes (stale, server save likely failed).
        const NOW = Date.now();
        const matchedTempIds = new Set<string>();
        const normalize = (s: string | null | undefined) => (s || '').trim();
        serverMessages.forEach(serverMsg => {
          if (!serverMsg.from_me) return;
          const candidates = tempMessages.filter(t =>
            !matchedTempIds.has(t.id) &&
            t.from_me === serverMsg.from_me &&
            normalize(t.content) === normalize(serverMsg.content)
          );
          if (candidates.length === 0) return;
          // Prefer the temp whose timestamp is closest to the server message.
          candidates.sort((a, b) =>
            Math.abs(new Date(a.created_at).getTime() - new Date(serverMsg.created_at).getTime()) -
            Math.abs(new Date(b.created_at).getTime() - new Date(serverMsg.created_at).getTime())
          );
          matchedTempIds.add(candidates[0].id);
        });
        
        // Keep temp messages that haven't been matched AND are recent (< 2 min).
        // Stale temps without a server match are dropped to avoid permanent ghosts.
        const unmatchedTemp = tempMessages.filter(t => {
          if (matchedTempIds.has(t.id)) return false;
          const age = NOW - new Date(t.created_at).getTime();
          if (age > 120000) return false; // drop stale optimistic message
          // Also drop if a server message with same content+from_me already exists
          // (covers the case where contents match but our matcher missed due to timing).
          const dupOnServer = serverMessages.some(s =>
            s.from_me === t.from_me && normalize(s.content) === normalize(t.content)
          );
          return !dupOnServer;
        });
        
        // Combine: server messages + unmatched temp messages, then sort
        const combined = [...serverMessages, ...unmatchedTemp]
          .sort((a, b) => {
            const timeA = new Date(a.created_at).getTime();
            const timeB = new Date(b.created_at).getTime();
            if (timeA === timeB) {
              return a.id.localeCompare(b.id);
            }
            return timeA - timeB;
          });
        
        // Only update if something changed (prevent flicker)
        const prevSignature = prev.map(m => `${m.id}-${m.status}`).join(',');
        const newSignature = combined.map(m => `${m.id}-${m.status}`).join(',');
        if (prevSignature === newSignature) return prev;
        
        return combined;
      });
    }
  };

  const loadAiAgents = async () => {
    if (!companyId) return;
    
    const { data } = await supabase
      .from('ai_agents')
      .select('*')
      .eq('company_id', companyId)
      .eq('is_active', true);
    
    setAiAgents(data || []);
  };

  // Load labels
  const loadLabels = async () => {
    if (!companyId) return;
    
    const { data } = await supabase
      .from('conversation_labels')
      .select('*')
      .eq('company_id', companyId);
    
    setLabels(data || []);
  };

  // Load contacts count
  const loadContactsCount = async () => {
    if (!companyId) return;
    
    const { count } = await supabase
      .from('whatsapp_contacts')
      .select('*', { count: 'exact', head: true })
      .eq('company_id', companyId);
    
    setContactsCount(count || 0);
  };

  // Mark conversation as read - reset unread_count and send read receipts to Baileys
  const markConversationAsRead = async (conv: WhatsAppConversationData) => {
    if (!conv || (conv.unread_count || 0) === 0) return;
    
    // Update local state immediately
    setConversations(prev => prev.map(c => 
      c.id === conv.id ? { ...c, unread_count: 0 } : c
    ));
    
    // Get connected session for this conversation
    const connectedSession = sessions.find(s => 
      s.id === conv.session_id && s.status === 'connected'
    ) || sessions.find(s => s.status === 'connected');
    
    // Call API to mark as read (updates DB + sends read receipts to Baileys)
    try {
      if (connectedSession) {
        await supabase.functions.invoke('whatsapp-api', {
          body: {
            action: 'mark_as_read',
            sessionId: connectedSession.id,
            phone: conv.contact_phone,
            conversationId: conv.id
          }
        });
      } else {
        // Just update database if no connected session
        await supabase
          .from('whatsapp_conversations')
          .update({ unread_count: 0 })
          .eq('id', conv.id);
      }
    } catch (e) {
      console.error('Error marking conversation as read:', e);
    }
  };

  // Create label
  const handleCreateLabel = async (name: string, color: string) => {
    if (!companyId || !user?.id) return;
    
    const { data, error } = await supabase
      .from('conversation_labels')
      .insert({ name, color, company_id: companyId, created_by: user.id })
      .select()
      .single();
    
    if (!error && data) {
      setLabels(prev => [...prev, data]);
      toast({ title: 'Sucesso', description: 'Etiqueta criada!' });
    }
  };

  // Delete label
  const handleDeleteLabel = async (labelId: string) => {
    const { error } = await supabase
      .from('conversation_labels')
      .delete()
      .eq('id', labelId);
    
    if (!error) {
      setLabels(prev => prev.filter(l => l.id !== labelId));
      toast({ title: 'Sucesso', description: 'Etiqueta removida!' });
    }
  };

  // Toggle label on conversation - persists to database
  const handleToggleLabel = async (labelId: string) => {
    if (!selectedConversationForLabels) return;
    
    const currentLabels = selectedConversationForLabels.labels || [];
    const newLabels = currentLabels.includes(labelId)
      ? currentLabels.filter(l => l !== labelId)
      : [...currentLabels, labelId];
    
    // Optimistic update
    setConversations(prev => prev.map(c => {
      if (c.id === selectedConversationForLabels.id) {
        return { ...c, labels: newLabels };
      }
      return c;
    }));
    setSelectedConversationForLabels(prev => prev ? { ...prev, labels: newLabels } : null);
    
    // Persist to database
    const { error } = await supabase
      .from('whatsapp_conversations')
      .update({ labels: newLabels })
      .eq('id', selectedConversationForLabels.id);
    
    if (error) {
      console.error('Error updating labels:', error);
      // Rollback on error
      setConversations(prev => prev.map(c => {
        if (c.id === selectedConversationForLabels.id) {
          return { ...c, labels: currentLabels };
        }
        return c;
      }));
      setSelectedConversationForLabels(prev => prev ? { ...prev, labels: currentLabels } : null);
      toast({ title: 'Erro', description: 'Erro ao salvar etiqueta', variant: 'destructive' });
    }
  };

  // Update pipeline stage (for Kanban) - persists to DB
  const handleUpdateStage = async (conversationId: string, newStage: string, reason?: string) => {
    const prevStage = conversations.find(c => c.id === conversationId)?.pipeline_stage;
    // Optimistic update
    setConversations(prev => prev.map(c =>
      c.id === conversationId ? { ...c, pipeline_stage: newStage } : c
    ));
    try {
      const { error } = await supabase
        .from('whatsapp_conversations')
        .update({ pipeline_stage: newStage })
        .eq('id', conversationId);
      if (error) throw error;
      // Log stage change to conversation_events (dated, with author + reason)
      await logConversationEvent(
        conversationId,
        'stage_change',
        reason,
        { from: prevStage ?? null, to: newStage },
      );
      toast({ title: 'Movido', description: `Conversa movida para ${newStage}` });
    } catch (err: any) {
      // Revert on failure
      setConversations(prev => prev.map(c =>
        c.id === conversationId ? { ...c, pipeline_stage: prevStage } : c
      ));
      toast({ title: 'Erro', description: err?.message || 'Falha ao salvar coluna', variant: 'destructive' });
    }
  };

  // Open labels manager for a conversation
  const openLabelsManager = (conv: WhatsAppConversationData) => {
    setSelectedConversationForLabels(conv);
    setShowLabelsManager(true);
  };

  // Open save lead modal
  const openSaveLeadModal = (conv: WhatsAppConversationData) => {
    setSelectedConversationForLead(conv);
    setShowSaveLeadModal(true);
  };

  // Refresh/Sync all data from Baileys server
  const handleRefreshData = async () => {
    if (syncingData) return;
    
    const session = sessions.find(s => s.status === 'connected');
    if (!session) {
      toast({ 
        title: 'Sem conexão', 
        description: 'Nenhuma sessão conectada para sincronizar',
        variant: 'destructive'
      });
      return;
    }
    
    setSyncingData(true);
    
    try {
      // 1. Backfill profile pictures via Evolution API for this company
      // Trigger a force sync for all conversations with the session's company
      if (companyId) {
        console.log(`[SYNC] Triggering profile picture sync for company ${companyId}`);
        await supabase.functions.invoke('whatsapp-sync-profile-pictures', {
          body: { company_id: companyId, limit: 300, force: true }
        });
      }


      // 2. Reload all local data
      await Promise.all([
        loadSessions(),
        loadConversations(),
        loadLabels(),
        loadContactsCount()
      ]);
      
      // 3. If conversation selected, reload messages
      if (selectedConversation) {
        await loadMessagesByPhone(selectedConversation.contact_phone);
      } else {
        // Se nenhuma conversa selecionada, forçar um reload das conversas gerais para atualizar previews
        await loadConversations();
      }

      
      toast({ 
        title: 'Dados atualizados!', 
        description: 'Fotos, mensagens e contatos sincronizados' 
      });
    } catch (error) {
      console.error('Error refreshing data:', error);
      toast({ 
        title: 'Erro ao atualizar', 
        description: 'Tente novamente em alguns segundos',
        variant: 'destructive'
      });
    } finally {
      setSyncingData(false);
    }
  };

  // Archive/Unarchive conversation
  const handleArchiveConversation = async (conv: WhatsAppConversationData) => {
    const newStatus = conv.status === 'archived' ? 'open' : 'archived';
    
    const { error } = await supabase
      .from('whatsapp_conversations')
      .update({ status: newStatus })
      .eq('id', conv.id);
    
    if (!error) {
      setConversations(prev => prev.map(c => 
        c.id === conv.id ? { ...c, status: newStatus } : c
      ));
      if (selectedConversation?.id === conv.id) {
        setSelectedConversation({ ...conv, status: newStatus });
      }
      toast({ 
        title: newStatus === 'archived' ? 'Arquivada' : 'Desarquivada', 
        description: `Conversa ${newStatus === 'archived' ? 'arquivada' : 'desarquivada'} com sucesso!` 
      });
    } else {
      toast({ title: 'Erro', description: 'Erro ao arquivar conversa', variant: 'destructive' });
    }
  };

  // Delete conversation
  const handleDeleteConversation = async (conv: WhatsAppConversationData) => {
    if (!confirm('Tem certeza que deseja excluir esta conversa? Todas as mensagens serão perdidas.')) {
      return;
    }
    
    // Delete messages first
    await supabase
      .from('whatsapp_messages')
      .delete()
      .eq('conversation_id', conv.id);
    
    // Then delete conversation
    const { error } = await supabase
      .from('whatsapp_conversations')
      .delete()
      .eq('id', conv.id);
    
    if (!error) {
      setConversations(prev => prev.filter(c => c.id !== conv.id));
      if (selectedConversation?.id === conv.id) {
        setSelectedConversation(null);
        setShowMobileChat(false);
      }
      toast({ title: 'Excluída', description: 'Conversa excluída com sucesso!' });
    } else {
      toast({ title: 'Erro', description: 'Erro ao excluir conversa', variant: 'destructive' });
    }
  };

  // Delete a single message
  const handleDeleteMessage = async (messageId: string) => {
    // If it's a temp/optimistic message, just remove from state
    if (messageId.startsWith('temp-')) {
      setMessages(prev => prev.filter(m => m.id !== messageId));
      setPopupMessages(prev => prev.filter(m => m.id !== messageId));
      toast({ title: 'Mensagem excluída' });
      return;
    }
    
    // Delete from database
    const { error } = await supabase
      .from('whatsapp_messages')
      .delete()
      .eq('id', messageId);
    
    if (!error) {
      setMessages(prev => prev.filter(m => m.id !== messageId));
      setPopupMessages(prev => prev.filter(m => m.id !== messageId));
      toast({ title: 'Mensagem excluída' });
    } else {
      toast({ title: 'Erro', description: 'Erro ao excluir mensagem', variant: 'destructive' });
    }
  };

  // Copy text to clipboard
  const handleCopyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({ title: 'Copiado!', description: 'Texto copiado para a área de transferência' });
    } catch {
      toast({ title: 'Erro', description: 'Não foi possível copiar', variant: 'destructive' });
    }
  };

  // Handle right-click on conversation
  const handleConversationContextMenu = (e: React.MouseEvent, conv: WhatsAppConversationData) => {
    e.preventDefault();
    e.stopPropagation();
    setConversationContextMenu({
      isOpen: true,
      position: { x: e.clientX, y: e.clientY },
      conversation: conv,
    });
  };

  // Handle right-click on message
  const handleMessageContextMenu = (e: React.MouseEvent, message: WhatsAppMessage) => {
    e.preventDefault();
    e.stopPropagation();
    setMessageContextMenu({
      isOpen: true,
      position: { x: e.clientX, y: e.clientY },
      messageId: message.id,
      messageContent: message.content,
      isFromMe: message.from_me,
    });
  };

  // Assign AI agent to conversation with auto-reply toggle
  const handleAssignAgent = async (conv: WhatsAppConversationData, agentId: string | null, enableAutoReply: boolean = true) => {
    const { error } = await supabase
      .from('whatsapp_conversations')
      .update({ 
        assigned_agent_id: agentId,
        ai_auto_reply_enabled: agentId ? enableAutoReply : false
      })
      .eq('id', conv.id);
    
    if (!error) {
      setConversations(prev => prev.map(c => 
        c.id === conv.id ? { ...c, assigned_agent_id: agentId || undefined } : c
      ));
      if (selectedConversation?.id === conv.id) {
        setSelectedConversation({ ...conv, assigned_agent_id: agentId || undefined });
      }
      toast({ 
        title: agentId ? 'Agente Atribuído' : 'Agente Removido', 
        description: agentId ? 'Agente IA atribuído à conversa!' : 'Agente IA removido da conversa'
      });
    }
  };

  useEffect(() => {
    const loadData = async () => {
      if (!companyId) return;
      
      // Load sessions first so selectedSessionId is set before loading conversations
      await loadSessions();
      await Promise.all([
        loadConversations(),
        loadAiAgents(),
        loadLabels(),
        loadContactsCount()
      ]);
      setLoading(false);
    };
    
    loadData();
    
    // Polling fallback for conversations - refresh every 1s for near real-time sidebar/header/profile sync
    const conversationsPoll = setInterval(() => {
      if (companyId) {
        loadConversations();
      }
    }, 1000);
    
    return () => clearInterval(conversationsPoll);
  }, [companyId, selectedSessionId]);
  
  // Recarregar conversas quando trocar de canal
  useEffect(() => {
    if (companyId && selectedSessionId) {
      loadConversations();
      // Limpar conversa selecionada ao trocar canal
      setSelectedConversation(null);
      setMessages([]);
      setShowMobileChat(false);
    }
  }, [selectedSessionId]);

  // Real-time subscription for messages, conversations, contacts, sessions
  useEffect(() => {
    if (!companyId) return;

    console.log('📡 Setting up realtime subscriptions for company:', companyId);

    // Subscribe to new messages - listen to INSERT and UPDATE
    const messagesChannel = supabase
      .channel('whatsapp-messages-rt')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'whatsapp_messages',
        filter: `company_id=eq.${companyId}`
      }, (payload) => {
        const newMessage = payload.new as any;
        console.log('📨 Realtime message event:', payload.eventType, newMessage?.content?.substring(0, 30));

        // Append/update messages in the currently open conversation so the
        // chat window reflects sent/received messages in real time.
        const openConvId = selectedConversationIdRef.current;
        const openConversationIds = selectedConversationIdsRef.current;
        const messageBelongsToOpenChat = Boolean(
          newMessage &&
          openConvId &&
          (newMessage.conversation_id === openConvId || openConversationIds.has(newMessage.conversation_id))
        );

        if (newMessage && messageBelongsToOpenChat) {
          if (payload.eventType === 'INSERT') {
            setMessages(prev => {
              if (prev.some(m => m.id === newMessage.id)) return prev;
              // Replace an optimistic message with same wa_message_id if present
              const idx = newMessage.wa_message_id
                ? prev.findIndex(m => m.wa_message_id && m.wa_message_id === newMessage.wa_message_id)
                : prev.findIndex(m =>
                    m.id.startsWith('temp-') &&
                    m.from_me === newMessage.from_me &&
                    (m.content || '').trim() === (newMessage.content || '').trim()
                  );
              if (idx >= 0) {
                const copy = [...prev];
                copy[idx] = { ...copy[idx], ...newMessage };
                return copy.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
              }
              return [...prev, newMessage]
                .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
            });
          } else if (payload.eventType === 'UPDATE') {
            setMessages(prev => prev.map(m => m.id === newMessage.id ? { ...m, ...newMessage } : m));
          }
        }

        // Keep the sidebar fresh even when the conversation row update is missed
        // (manual sends, webhook races, or parent-channel guards).
        if (payload.eventType === 'INSERT' && newMessage?.conversation_id) {
          const messageAt = newMessage.timestamp || newMessage.created_at || new Date().toISOString();
          const preview = newMessage.message_type && newMessage.message_type !== 'text'
            ? (newMessage.media_caption || newMessage.content || `[${newMessage.message_type}]`)
            : (newMessage.content || '');

          setConversations(prev => {
            const target = prev.find(c => c.id === newMessage.conversation_id);
            if (!target) return prev;
            const updated = {
              ...target,
              last_message: preview,
              last_message_at: messageAt,
              unread_count: messageBelongsToOpenChat || newMessage.from_me
                ? 0
                : (target.unread_count || 0) + 1,
            };
            return [updated, ...prev.filter(c => c.id !== target.id)]
              .sort((a, b) => new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime());
          });
        }

        // If a new INCOMING message belongs to the currently open conversation,
        // immediately reset its unread_count (the user is actively reading it).
        const openId = openConvId;
        if (
          payload.eventType === 'INSERT' &&
          newMessage &&
          !newMessage.from_me &&
          openId &&
          (newMessage.conversation_id === openId || selectedConversationIdsRef.current.has(newMessage.conversation_id))
        ) {
          supabase
            .from('whatsapp_conversations')
            .update({ unread_count: 0 })
            .eq('id', openId)
            .then(() => {
              setConversations(prev => prev.map(c =>
                c.id === openId ? { ...c, unread_count: 0 } : c
              ));
            });
        }

        // We don't call loadConversations() here because it might overwrite the local 
        // unread_count=0 reset with stale data from the database before the UPDATE sticks.
        // The conversations list will be updated by the whatsapp_conversations channel below.
      })
      .subscribe();

    // Subscribe to conversation updates (INSERT and UPDATE)
    const conversationsChannel = supabase
      .channel('whatsapp-conversations-rt')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'whatsapp_conversations',
        filter: `company_id=eq.${companyId}`
      }, (payload) => {
        const newConv = payload.new as any;
        console.log('📥 New conversation:', newConv.contact_name || newConv.contact_phone);
        // Only add conversations for the currently selected session to prevent flicker
        if (selectedSessionId && selectedSessionId !== 'ALL' && newConv.session_id !== selectedSessionId) return;
        setConversations(prev => {
          // Avoid duplicates
          if (prev.some(c => c.id === newConv.id)) return prev;
          return [newConv, ...prev];
        });
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'whatsapp_conversations',
        filter: `company_id=eq.${companyId}`
      }, (payload) => {
        const updated = payload.new as any;
        if (selectedSessionId && selectedSessionId !== 'ALL' && updated.session_id !== selectedSessionId) return;
         // Suppress unread badge for the currently open conversation
         if (selectedConversationIdRef.current === updated.id && (updated.unread_count || 0) > 0) {
           updated.unread_count = 0;
           // Persist the reset in DB (fire-and-forget) so it sticks
           const currentConv = conversations.find(c => c.id === updated.id);
           if (currentConv) {
             markConversationAsRead(currentConv);
           }
         }
        setConversations(prev => 
          prev.map(c => c.id === updated.id ? { ...c, ...updated } : c)
        );
      })
      .subscribe();

    // Subscribe to session updates
    const sessionsChannel = supabase
      .channel('whatsapp-sessions-rt')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'whatsapp_sessions',
        filter: `company_id=eq.${companyId}`
      }, () => {
        loadSessions();
      })
      .subscribe();

    // Subscribe to contacts (for count update)
    const contactsChannel = supabase
      .channel('whatsapp-contacts-rt')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'whatsapp_contacts',
        filter: `company_id=eq.${companyId}`
      }, () => {
        // Update contacts count
        loadContactsCount();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(messagesChannel);
      supabase.removeChannel(conversationsChannel);
      supabase.removeChannel(sessionsChannel);
      supabase.removeChannel(contactsChannel);
    };
  }, [companyId, selectedConversation?.id, selectedSessionId]);

   // CRITICAL: Monitoramento específico para o grupo GOPHARMA para garantir que nunca fique travado
   useEffect(() => {
     if (!companyId) return;
     
      // Verifica a cada 2 minutos se há novas mensagens no grupo GoPharma
      const monitorGopharma = async () => {
        const { data: gopharmaConv } = await supabase
          .from('whatsapp_conversations')
          .select('id, last_message_at, session_id, remote_jid, contact_phone')
          .eq('company_id', companyId)
          .ilike('contact_name', '%GOPHARMA%')
          .single();
        
        if (gopharmaConv) {
          // Se o grupo GoPharma estiver aberto, o polling de 500ms já cuida disso.
          // Se não estiver aberto, o loadConversations geral cuida.
          // Mas aqui forçamos uma atualização das conversas se detectarmos mudança.
          loadConversations();
          
          // Se as mensagens parecerem travadas (última mensagem > 1h), força o webhook a re-sincronizar
          const lastMsgDate = new Date(gopharmaConv.last_message_at);
          const diffHours = (Date.now() - lastMsgDate.getTime()) / (1000 * 60 * 60);
          if (diffHours > 1 && gopharmaConv.session_id) {
             supabase.functions.invoke('whatsapp-api', {
               body: { 
                 action: 'sync_messages', 
                 sessionId: gopharmaConv.session_id, 
                 jid: gopharmaConv.remote_jid || gopharmaConv.contact_phone + '@g.us' 
               }
             }).catch(console.error);
          }
        }
      };

      const interval = setInterval(monitorGopharma, 120000);
      return () => clearInterval(interval);
   }, [companyId]);

   // Load messages when conversation changes + polling fallback for realtime reliability

   useEffect(() => {
     if (selectedConversation) {
       const phone = selectedConversation.contact_phone;
       selectedConversationIdsRef.current = new Set([selectedConversation.id]);
       // Reset messages before loading the selected chat to avoid racing with the fetch.
       setMessages([]);
       setLoadingMessages(true);
       loadMessagesByPhone(phone);
       setSelectedAgent(null);
        
        // Reset unread count immediately upon selection
        markConversationAsRead(selectedConversation);
       
       // Safety: never keep the "puxando mensagens" loader forever
       const loaderTimeout = setTimeout(() => setLoadingMessages(false), 8000);

       // Polling fallback - refresh messages every 500ms (instant sync)
       const pollInterval = setInterval(() => {
         loadMessagesByPhone(phone);
         
         // Also ensure unread count stays 0 while viewing
         const currentConv = conversations.find(c => c.id === selectedConversation.id);
         if (currentConv && (currentConv.unread_count || 0) > 0) {
           markConversationAsRead(currentConv);
         }
       }, 500);
       
       // Force a specific check for GOPHARMA when selected
       if (selectedConversation.contact_name?.toUpperCase().includes('GOPHARMA')) {
         console.log('🎯 GOPHARMA GROUP SELECTED - Priority Sync Active');
         handleRefreshData();
       }
       
       return () => { clearInterval(pollInterval); clearTimeout(loaderTimeout); };

     } else {
       setMessages([]);
       setLoadingMessages(false);
     }
   }, [selectedConversation?.id, selectedConversation?.contact_phone]);

  // Stop the "puxando mensagens" loader as soon as messages arrive
  useEffect(() => {
    if (loadingMessages && messages.length > 0) setLoadingMessages(false);
  }, [messages.length, loadingMessages]);

  // Fetch conversation IDs with active chatbot executions
  useEffect(() => {
    const fetchChatbotConvs = async () => {
      // Only count executions with recent activity (last 30 min) so stale
      // "running" rows don't keep falsely flagging conversations as Bot.
      const cutoff = new Date(Date.now() - 30 * 60 * 1000).toISOString();
      const { data } = await supabase
        .from('chatbot_executions')
        .select('conversation_id')
        .eq('status', 'running')
        .gte('last_activity_at', cutoff);
      if (data) {
        setChatbotActiveConvIds(new Set(data.map(d => d.conversation_id).filter(Boolean) as string[]));
      }
    };
    fetchChatbotConvs();
    const interval = setInterval(fetchChatbotConvs, 15000);
    return () => clearInterval(interval);
  }, []);

  // Check for active chatbot execution on selected conversation
  useEffect(() => {
    if (!selectedConversation?.id) {
      setActiveChatbotFlow(null);
      return;
    }
    const checkChatbot = async () => {
      const { data } = await supabase
        .from('chatbot_executions')
        .select('id, flow_id, chatbot_flows(name)')
        .eq('conversation_id', selectedConversation.id)
        .eq('status', 'running')
        .order('started_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (data) {
        setActiveChatbotFlow({ id: data.id, name: (data as any).chatbot_flows?.name || 'Chatbot' });
      } else {
        setActiveChatbotFlow(null);
      }
    };
    checkChatbot();
  }, [selectedConversation?.id]);

  // Handle session success - sync conversations after connection
  const handleSessionSuccess = async (session: WhatsAppSession) => {
    // Force select the new session immediately
    setSelectedSessionId(session.id);

    // Optimistically mark the just-connected session as 'connected' in local state
    // so the sidebar/list doesn't show it as "Desconectado" while realtime catches up.
    setSessions(prev => {
      const exists = prev.some(s => s.id === session.id);
      const merged: WhatsAppSession = { ...(session as any), status: 'connected' } as WhatsAppSession;
      return exists
        ? prev.map(s => (s.id === session.id ? { ...s, ...merged } : s))
        : [merged, ...prev];
    });

    // Reload from DB (may still be racing with webhook write) and retry a few times
    // until the session is reported as connected — avoids stale "disconnected" UI.
    await loadSessions();
    for (let i = 0; i < 5; i++) {
      const { data } = await supabase
        .from('whatsapp_sessions')
        .select('*')
        .eq('id', session.id)
        .maybeSingle();
      if (data?.status === 'connected') {
        setSessions(prev => prev.map(s => (s.id === session.id ? { ...s, ...(data as any) } : s)));
        break;
      }
      await new Promise(r => setTimeout(r, 800));
    }
    toast({ title: 'Sucesso', description: 'WhatsApp conectado!' });
    
    // Start syncing conversations and contacts
    setSyncingConversations(true);
    toast({ title: 'Sincronizando', description: 'Carregando dados do WhatsApp...' });
    
    try {
      await Promise.all([
        loadConversations(),
        loadContactsCount()
      ]);
      toast({ title: 'Pronto', description: 'Dados carregados com sucesso!' });
    } catch (error) {
      console.error('Error syncing data:', error);
      toast({ 
        title: 'Aviso', 
        description: 'Alguns dados podem não ter sido carregados.',
        variant: 'destructive'
      });
    } finally {
      setSyncingConversations(false);
    }
  };

  // Send message to AI Agent
  const sendMessageToAgent = async () => {
    if (!newMessage.trim() || !selectedAgent) return;
    
    setSendingMessage(true);
    const agentKey = `agent-${selectedAgent.id}`;
    const userMessage: WhatsAppMessage = {
      id: `agent-msg-${Date.now()}`,
      conversation_id: agentKey,
      content: newMessage,
      from_me: true,
      status: 'sent',
      created_at: new Date().toISOString()
    };
    
    const updatedMessages = [...agentChatMessages, userMessage];
    setAgentChatMessages(updatedMessages);
    setAgentChatHistory(prev => ({ ...prev, [agentKey]: updatedMessages }));
    setNewMessage('');
    setIsAiTyping(true);
    
    try {
      const response = await supabase.functions.invoke('ai-chat', {
        body: {
          message: newMessage,
          agentId: selectedAgent.id,
          personality: selectedAgent.personality,
          instructions: selectedAgent.instructions
        }
      });
      
      if (response.error) throw response.error;
      
      const aiMessage: WhatsAppMessage = {
        id: `agent-msg-${Date.now() + 1}`,
        conversation_id: agentKey,
        content: response.data?.response || 'Desculpe, não consegui processar sua mensagem.',
        from_me: false,
        status: 'delivered',
        created_at: new Date().toISOString(),
        sender_name: selectedAgent.name
      };
      
      const finalMessages = [...updatedMessages, aiMessage];
      setAgentChatMessages(finalMessages);
      setAgentChatHistory(prev => ({ ...prev, [agentKey]: finalMessages }));
    } catch (error) {
      console.error('Error calling AI:', error);
      toast({
        title: 'Erro',
        description: 'Erro ao comunicar com o agente IA',
        variant: 'destructive'
      });
    } finally {
      setIsAiTyping(false);
      setSendingMessage(false);
    }
  };

  // Ref guard to prevent duplicate sends from double-clicks or rapid Enter presses
  const sendingRef = useRef(false);
  const selectedConversationIdRef = useRef<string | null>(null);
  const selectedConversationIdsRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    selectedConversationIdRef.current = selectedConversation?.id || null;
    selectedConversationIdsRef.current = selectedConversation?.id ? new Set([selectedConversation.id]) : new Set();
  }, [selectedConversation?.id]);

  useEffect(() => {
    if (!selectedConversation) return;
    const fresh = conversations.find(c => c.id === selectedConversation.id);
    if (fresh && fresh !== selectedConversation) {
      setSelectedConversation(prev => prev ? { ...prev, ...fresh } : prev);
    }
  }, [conversations, selectedConversation?.id]);

  // Send message to WhatsApp conversation with Optimistic UI
  const sendMessage = async () => {
    if (selectedAgent) {
      return sendMessageToAgent();
    }
    
    if (!newMessage.trim() || !selectedConversation || sendingRef.current) return;
    sendingRef.current = true;
    // Snapshot content immediately and clear input synchronously to prevent
    // a second Enter/click from re-reading the same value before React re-renders.
    const __content = newMessage.trim();
    setNewMessage('');
    
    // Check if connected before sending
    const connectedSession = sessions.find(s => 
      s.id === selectedConversation.session_id && s.status === 'connected'
    ) || sessions.find(s => s.status === 'connected');
    
    if (!connectedSession && !selectedConversation.is_demo) {
      toast({ 
        title: 'WhatsApp Desconectado', 
        description: 'Você precisa conectar seu WhatsApp para enviar mensagens. Clique em "Desconectado" para reconectar.',
        variant: 'destructive'
      });
      sendingRef.current = false;
      setNewMessage(__content); // restore so user can retry
      return;
    }
    
    setSendingMessage(true);
    const messageContent = __content;
    
    // Get the preferred session ID from the conversation
    // If not found or not connected, fall back to any connected session
    const targetSessionId = selectedConversation.session_id;
    
    // Create optimistic message
    const tempId = `temp-${Date.now()}`;
    const optimisticMessage: WhatsAppMessage = {
      id: tempId,
      conversation_id: selectedConversation.id,
      content: messageContent,
      from_me: true,
      status: 'sending',
      created_at: new Date().toISOString()
    };
    
    // OPTIMISTIC: Add message to UI immediately (instant feedback)
    setMessages(prev => [...prev, optimisticMessage]);
    
    // Update conversation in list immediately
    setConversations(prev => {
      const exists = prev.some(c => c.contact_phone === selectedConversation.contact_phone);
      if (exists) {
        return prev.map(c => 
          c.contact_phone === selectedConversation.contact_phone 
            ? { ...c, last_message: messageContent, last_message_at: new Date().toISOString() }
            : c
        );
      } else {
        // If it's a new conversation (temp), add it to the top of the list
        return [{
          ...selectedConversation,
          last_message: messageContent,
          last_message_at: new Date().toISOString(),
          unread_count: 0
        }, ...prev];
      }
    });
    
    try {
      // Select the session to use
      // 1. Try the specific session tied to this conversation (if connected)
      // 2. Fall back to the currently selected channel (if single and connected)
      // 3. Fall back to any connected session
      let connectedSession = sessions.find(s => 
        s.id === targetSessionId && s.status === 'connected'
      );

      if (!connectedSession) {
        if (selectedSessionId && selectedSessionId !== 'ALL') {
          connectedSession = sessions.find(s => s.id === selectedSessionId && s.status === 'connected');
        }
      }

      if (!connectedSession) {
        connectedSession = sessions.find(s => s.status === 'connected');
      }
      
      if (connectedSession && !selectedConversation.is_demo) {
        // Send via real WhatsApp API
        const { data: sendData, error, timedOut } = await invokeFunctionWithTimeout('whatsapp-api', {
          body: {
            action: 'send_message',
            sessionId: connectedSession.id,
            conversationId: selectedConversation.id,
            manualTakeover: true,
            phone: selectedConversation.contact_phone,
            message: messageContent
          }
        }, 25000);

        if (timedOut) {
          toast({
            title: 'Envio em processamento',
            description: 'A sessão demorou para responder; vou atualizar a conversa automaticamente quando confirmar.',
          });
          await loadSessions();
          await loadMessagesByPhone(selectedConversation.contact_phone);
          return;
        }

        // Detect disconnected socket ("Connection Closed") and auto-reconnect
        const combined = (
          (sendData?.error || '') + ' ' + (sendData?.details || '') + ' ' + (error?.message || '')
        ).toLowerCase();
        const isDisconnected =
          combined.includes('connection closed') ||
          combined.includes('desconect') ||
          combined.includes('session not connected');
        if (isDisconnected && connectedSession) {
          setMessages(prev => prev.map(m => m.id === tempId ? { ...m, status: 'failed' } : m));
          toast({
            title: 'WhatsApp desconectado',
            description: 'Reconectando automaticamente… escaneie o novo QR.',
            variant: 'destructive'
          });
          void forceReconnectSession(connectedSession.id);
          return;
        }
        if (error) throw error;
        
        // Update optimistic message status to sent (instant - no reload needed)
        // The 500ms polling will sync any server-side updates automatically
        setMessages(prev => prev.map(m => 
          m.id === tempId ? { ...m, status: 'sent' } : m
        ));
        
        // Note: Don't call loadMessagesByPhone here to avoid flicker
        // Polling will handle sync
      } else {
        // Demo mode - just mark as sent
        setMessages(prev => prev.map(m => 
          m.id === tempId ? { ...m, status: 'sent' } : m
        ));
      }
    } catch (e: any) {
      console.error('Error sending message:', e);
      // Mark message as failed
      setMessages(prev => prev.map(m => 
        m.id === tempId ? { ...m, status: 'failed' } : m
      ));
      toast({ title: 'Erro', description: e.message || 'Erro ao enviar mensagem', variant: 'destructive' });
    } finally {
      setSendingMessage(false);
      sendingRef.current = false;
    }
  };

  // Send a single file (used by file input AND drag-and-drop)
  const sendFile = async (file: File, caption?: string) => {
    if (!file || !selectedConversation) return;

    // Check if connected before sending
    const connectedSession = sessions.find(s => 
      s.id === selectedConversation.session_id && s.status === 'connected'
    ) || sessions.find(s => s.status === 'connected');
    
    if (!connectedSession && !selectedConversation.is_demo) {
      toast({ 
        title: 'WhatsApp Desconectado', 
        description: 'Você precisa conectar seu WhatsApp para enviar mídia.',
        variant: 'destructive'
      });
      return;
    }
    
    setUploadingMedia(true);
    
    try {
      // Determine media type
      let mediaType = 'document';
      if (file.type.startsWith('image/')) mediaType = 'image';
      else if (file.type.startsWith('video/')) mediaType = 'video';
      else if (file.type.startsWith('audio/')) mediaType = 'audio';
      
      // Upload file to Supabase storage
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
      
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('whatsapp-media')
        .upload(`outgoing/${fileName}`, file, {
          cacheControl: '3600',
          upsert: false
        });
      
      if (uploadError) {
        throw new Error('Erro ao fazer upload do arquivo');
      }
      
      // Get public URL
      const { data: urlData } = supabase.storage
        .from('whatsapp-media')
        .getPublicUrl(uploadData.path);
      
      const mediaUrl = urlData.publicUrl;
      
      // Create optimistic message
      const tempId = `temp-${Date.now()}`;
      const optimisticMessage: WhatsAppMessage = {
        id: tempId,
        conversation_id: selectedConversation.id,
        content: file.name,
        from_me: true,
        status: 'sending',
        created_at: new Date().toISOString(),
        message_type: mediaType,
        media_url: mediaUrl,
        media_caption: caption || (mediaType === 'document' ? file.name : undefined),
      };
      
      setMessages(prev => [...prev, optimisticMessage]);
      
      // Send via API
      if (connectedSession && !selectedConversation.is_demo) {
        const { error } = await supabase.functions.invoke('whatsapp-api', {
          body: {
            action: 'send_media',
            sessionId: connectedSession.id,
            conversationId: selectedConversation.id,
            manualTakeover: true,
            phone: selectedConversation.contact_phone,
            mediaUrl: mediaUrl,
            mediaType: mediaType,
            fileName: file.name,
            caption: caption || ''
          }
        });
        
        if (error) throw error;
        
        setMessages(prev => prev.map(m => 
          m.id === tempId ? { ...m, status: 'sent' } : m
        ));
        
        toast({ title: 'Mídia enviada!' });
      } else {
        // Demo mode
        setMessages(prev => prev.map(m => 
          m.id === tempId ? { ...m, status: 'sent' } : m
        ));
      }
    } catch (e: any) {
      console.error('Error uploading media:', e);
      toast({ 
        title: 'Erro', 
        description: e.message || 'Erro ao enviar mídia', 
        variant: 'destructive' 
      });
    } finally {
      setUploadingMedia(false);
      setRecordingAudio(false);
    }
  };

  // Handle file upload for media messages (input change)
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (file) await sendFile(file);
  };

  // Handle audio recording complete
  const handleAudioRecordingComplete = async (audioBlob: Blob) => {
    if (!selectedConversation) return;
    
    const connectedSession = sessions.find(s => 
      s.id === selectedConversation.session_id && s.status === 'connected'
    ) || sessions.find(s => s.status === 'connected');
    
    if (!connectedSession && !selectedConversation.is_demo) {
      toast({ 
        title: 'WhatsApp Desconectado', 
        description: 'Você precisa conectar seu WhatsApp para enviar áudio.',
        variant: 'destructive'
      });
      return;
    }
    
    setUploadingMedia(true);
    
    try {
      // Create file from blob
      const fileName = `audio-${Date.now()}.webm`;
      const file = new File([audioBlob], fileName, { type: audioBlob.type });
      
      // Upload to Supabase storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('whatsapp-media')
        .upload(`outgoing/${fileName}`, file, {
          cacheControl: '3600',
          upsert: false
        });
      
      if (uploadError) {
        throw new Error('Erro ao fazer upload do áudio');
      }
      
      // Get public URL
      const { data: urlData } = supabase.storage
        .from('whatsapp-media')
        .getPublicUrl(uploadData.path);
      
      const mediaUrl = urlData.publicUrl;
      
      // Create optimistic message
      const tempId = `temp-${Date.now()}`;
      const optimisticMessage: WhatsAppMessage = {
        id: tempId,
        conversation_id: selectedConversation.id,
        content: '🎤 Mensagem de voz',
        from_me: true,
        status: 'sending',
        created_at: new Date().toISOString(),
        message_type: 'audio',
        media_url: mediaUrl
      };
      
      setMessages(prev => [...prev, optimisticMessage]);
      
      // Send via API
      if (connectedSession && !selectedConversation.is_demo) {
        const { error } = await supabase.functions.invoke('whatsapp-api', {
          body: {
            action: 'send_media',
            sessionId: connectedSession.id,
            conversationId: selectedConversation.id,
            manualTakeover: true,
            phone: selectedConversation.contact_phone,
            mediaUrl: mediaUrl,
            mediaType: 'audio',
            fileName: fileName,
            caption: ''
          }
        });
        
        if (error) throw error;
        
        setMessages(prev => prev.map(m => 
          m.id === tempId ? { ...m, status: 'sent' } : m
        ));
        
        toast({ title: 'Áudio enviado!' });
      } else {
        // Demo mode
        setMessages(prev => prev.map(m => 
          m.id === tempId ? { ...m, status: 'sent' } : m
        ));
      }
    } catch (e: any) {
      console.error('Error sending audio:', e);
      toast({ 
        title: 'Erro', 
        description: e.message || 'Erro ao enviar áudio', 
        variant: 'destructive' 
      });
    } finally {
      setUploadingMedia(false);
    }
  };

  // Handle meeting scheduled - insert link into message
  const handleMeetingScheduled = (meetingLink: string, scheduledTime: string) => {
    setNewMessage(`📅 Reunião agendada para ${scheduledTime}\n\n🔗 Link: ${meetingLink}`);
  };

  const selectAgent = (agent: AIAgent) => {
    setSelectedAgent(agent);
    setSelectedConversation(null);
    // Load persisted history for this agent
    const agentKey = `agent-${agent.id}`;
    setAgentChatMessages(agentChatHistory[agentKey] || []);
    setShowMobileChat(true);
  };

  // Get connected sessions first (needed for filtering)
  const connectedSessions = sessions.filter(s => s.status === 'connected');
  
  // Check if there are disconnected sessions (for UI indicator)
  const hasDisconnectedSessions = sessions.some(s => s.status === 'disconnected' && !connectedSessions.length);

  // Helper function to check if a phone number is a status broadcast or invalid
  // NOTE: Groups have 18+ digit IDs - these are VALID and should NOT be filtered
  const isStatusBroadcastOrInvalid = (phone: string | undefined): boolean => {
    if (!phone) return true;
    const cleaned = phone.replace(/\D/g, '');
    // Only filter truly invalid patterns
    if (cleaned.length < 8) return true; // Too short
    if (cleaned.startsWith('status')) return true;
    if (phone.includes('@broadcast')) return true;
    // Don't filter by length - groups have 18+ digits and are valid
    return false;
  };

  // Extract ALL connected phone numbers (normalized) for self-chat filtering
  const connectedPhones = connectedSessions
    .map(s => s.phone_number?.replace(/\D/g, ''))
    .filter(Boolean) as string[];
  
  // Filter conversations - exclude self-conversations and status broadcasts
  const filteredConversations = conversations.filter(conv => {
    // Filter out status broadcasts and invalid phone numbers
    if (isStatusBroadcastOrInvalid(conv.contact_phone)) {
      return false;
    }
    
    // Normalize contact phone for comparison
    const contactPhone = conv.contact_phone?.replace(/\D/g, '');
    
    // Filter out self-conversations (where contact_phone matches ANY connected session phone)
    // Use endsWith to handle country code differences (e.g., 5511999999 vs 11999999)
    // Only apply self-filter for normal phone numbers (8-15 digits), not groups (18+ digits)
    if (contactPhone && contactPhone.length <= 15 && connectedPhones.some(cp => 
      cp === contactPhone || 
      cp?.endsWith(contactPhone) || 
      contactPhone?.endsWith(cp)
    )) {
      return false; // Exclude self-chat
    }
    
    const matchesSearch = searchQuery === '' || 
      conv.contact_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      conv.contact_phone.includes(searchQuery);
    
    const matchesTab = activeTab === 'all' || 
      (activeTab === 'unread' && (conv.unread_count || 0) > 0) ||
      (activeTab === 'open' && conv.status === 'open') ||
      (activeTab === 'closed' && conv.status === 'closed');
    
    return matchesSearch && matchesTab;
  });

  // Format time
  const formatTime = (date: string) => {
    const d = new Date(date);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    
    if (days === 0) {
      return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    } else if (days === 1) {
      return 'Ontem';
    } else if (days < 7) {
      return d.toLocaleDateString('pt-BR', { weekday: 'short' });
    } else {
      return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
    }
  };

  if (loading) {
    return (
      <div className="h-full bg-[#faf9f7] dark:bg-[#141414] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground text-sm">Carregando CRM WhatsApp...</p>
        </div>
      </div>
    );
  }

  const currentMessages = selectedAgent ? agentChatMessages : messages;

  return (
    <div 
      id="crm-layout-root"
      className={cn(
        "bg-[#faf9f7] dark:bg-[#141414] flex flex-col overflow-hidden md:rounded-tl-2xl md:border-l md:border-t md:border-border/10",
        "h-[100dvh] md:h-full",
        isMobile && showMobileChat && "fixed inset-0 z-50",
        isMobile && !showMobileChat && "fixed inset-0 z-40"
      )}
    >
      <header
        className={cn(
          "md:hidden shrink-0 flex items-center justify-between gap-2 px-3 pb-2.5 text-foreground shadow-sm",
          showMobileChat && "hidden"
        )}
        style={{
          background: 'var(--background)',
          paddingTop: 'calc(0.75rem + env(safe-area-inset-top))',
          minHeight: 'calc(3.75rem + env(safe-area-inset-top))',
        }}
      >
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate('/dashboard')}
          className="h-10 w-10 rounded-xl hover:bg-muted"
          title="Voltar para o Dashboard"
        >
          <ArrowLeft className="h-[20px] w-[20px]" />
        </Button>
        <div className="flex-1 flex items-center justify-center min-w-0">
          <EllosuitWordmark className="h-[22px] w-auto" color="#374DA4" />
        </div>

        <Button
          variant="ghost"
          size="icon"
          onClick={() => setShowMobileMenu(true)}
          className="h-10 w-10 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 relative"
          title="Abrir funções"
          aria-label="Abrir funções do CRM"
        >
          <Plus className="h-[20px] w-[20px]" />
          {connectedSessions.length > 0 && (
            <span className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-emerald-400 ring-2 ring-background" />
          )}
        </Button>

        <Sheet open={showMobileMenu} onOpenChange={setShowMobileMenu}>
          <SheetContent
            side="right"
            className="w-[86vw] sm:w-[380px] p-0 flex flex-col bg-[#faf9f7] dark:bg-[#141414] overscroll-contain"
          >
            <SheetHeader className="px-5 pt-[calc(1rem+env(safe-area-inset-top))] pb-3 border-b border-border/10 text-left">
              <SheetTitle className="text-[17px] font-semibold tracking-tight">Funções do CRM</SheetTitle>
              <p className="text-[12px] text-muted-foreground">
                {connectedSessions.length > 0 ? `${connectedSessions.length} canal(is) conectado(s)` : 'Nenhum canal conectado'}
              </p>
            </SheetHeader>

            <div className="flex-1 overflow-y-auto overscroll-contain px-4 py-4 pb-[calc(1.5rem+env(safe-area-inset-bottom))] space-y-6">
              {/* Visões do CRM */}
              <section>
                <p className="px-1 mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Visões</p>
                <div className="grid grid-cols-3 gap-2">
                  {([
                    { id: 'list', label: 'Conversas', icon: List },
                    { id: 'kanban', label: 'Kanban', icon: LayoutGrid },
                    { id: 'contacts', label: 'Contatos', icon: Users },
                    { id: 'satisfaction', label: 'Satisfação', icon: Heart },
                    { id: 'autopilot', label: 'Piloto', icon: Power },
                  ] as const).map(({ id, label, icon: Icon }) => {
                    const active = viewMode === id;
                    return (
                      <button
                        key={id}
                        type="button"
                        onClick={() => { setViewMode(id); setShowMobileMenu(false); }}
                        className={cn(
                          "flex flex-col items-center justify-center gap-1.5 rounded-2xl px-2 py-3 border transition-all active:scale-95",
                          active
                            ? "bg-primary/10 border-primary/30 text-primary"
                            : "bg-background border-border/40 text-foreground hover:bg-muted/60"
                        )}
                      >
                        <Icon className="h-[18px] w-[18px]" />
                        <span className="text-[11px] font-medium leading-tight text-center">{label}</span>
                      </button>
                    );
                  })}
                </div>
              </section>

              {/* Piloto automático */}
              <section>
                <p className="px-1 mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Piloto Automático</p>
                <div className="flex items-center justify-between gap-3 rounded-2xl border border-border/40 bg-background px-4 py-3">
                  <div className="min-w-0">
                    <p className="text-[14px] font-medium truncate">{autopilotActive ? 'Ligado' : 'Desligado'}</p>
                    <p className="text-[11.5px] text-muted-foreground truncate">
                      {autopilotActive ? 'IA assumindo as conversas' : 'Controle manual'}
                    </p>
                  </div>
                  <Switch
                    checked={autopilotActive}
                    onCheckedChange={async (next) => {
                      setAutopilotActive(next);
                      try {
                        const { data, error } = await supabase.functions.invoke('crm-autopilot-config', {
                          body: { action: next ? 'activate' : 'deactivate', companyId },
                        });
                        if (error) throw error;
                        if (data?.error) throw new Error(data.error);
                        toast({
                          title: next ? '🚀 Piloto Automático LIGADO' : 'Piloto Automático desligado',
                          description: next ? 'Assumindo todas as conversas do CRM' : 'Você voltou ao controle manual',
                        });
                      } catch (err: any) {
                        setAutopilotActive(!next);
                        toast({ title: 'Erro', description: err?.message, variant: 'destructive' });
                      }
                    }}
                  />
                </div>
              </section>

              {/* Canais conectados */}
              <section>
                <p className="px-1 mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Canais conectados</p>
                <div className="rounded-2xl border border-border/40 bg-background divide-y divide-border/30 overflow-hidden">
                  <button
                    type="button"
                    onClick={() => { setSelectedSessionId('ALL'); setShowMobileMenu(false); }}
                    className="w-full flex items-center gap-3 px-4 py-3 text-left active:bg-muted/60"
                  >
                    <Phone className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="text-[14px] flex-1 truncate">Todos os canais</span>
                    {selectedSessionId === 'ALL' && <Check className="h-4 w-4 text-primary shrink-0" />}
                  </button>
                  {sessions.map(session => {
                    const isSelected = (selectedSessionId || connectedSessions[0]?.id) === session.id;
                    return (
                      <button
                        key={session.id}
                        type="button"
                        onClick={() => { setSelectedSessionId(session.id); loadConversations(); setShowMobileMenu(false); }}
                        className="w-full flex items-center gap-3 px-4 py-3 text-left active:bg-muted/60"
                      >
                        <span className={cn("h-2 w-2 rounded-full shrink-0", session.status === 'connected' ? "bg-emerald-500" : "bg-red-500")} />
                        <span className="text-[14px] flex-1 truncate">
                          {session.phone_name || session.instance_name || session.phone_number || 'Canal'}
                        </span>
                        {isSelected && <Check className="h-4 w-4 text-primary shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              </section>

              {/* Páginas dedicadas */}
              <section>
                <p className="px-1 mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Ferramentas</p>
                <div className="rounded-2xl border border-border/40 bg-background divide-y divide-border/30 overflow-hidden">
                  {([
                    { label: 'Chatbot Builder', icon: GitBranch, path: '/dashboard/chatbot?hub=crm' },
                    { label: 'Agentes de IA', icon: Bot, path: '/dashboard/bot-ia?hub=crm' },
                    { label: 'Disparos em Massa', icon: Send, path: '/dashboard/disparos?hub=crm' },
                    { label: 'Contatos & Cadastros', icon: Contact, path: '/dashboard/cadastros?hub=crm' },
                    { label: 'Agenda', icon: Calendar, path: '/dashboard/agenda?hub=crm' },
                    { label: 'Automações', icon: Settings, path: '/dashboard/automacoes?hub=crm' },
                  ] as const).map(({ label, icon: Icon, path }) => (
                    <button
                      key={path}
                      type="button"
                      onClick={() => { setShowMobileMenu(false); navigate(path); }}
                      className="w-full flex items-center gap-3 px-4 py-3 text-left active:bg-muted/60"
                    >
                      <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span className="text-[14px] flex-1 truncate">{label}</span>
                    </button>
                  ))}
                </div>
              </section>

              {/* Ações */}
              <section>
                <p className="px-1 mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Ações</p>
                <div className="rounded-2xl border border-border/40 bg-background divide-y divide-border/30 overflow-hidden">
                  <button
                    type="button"
                    onClick={() => { setShowMobileMenu(false); setSelectedConversationForLabels(null); setShowLabelsManager(true); }}
                    className="w-full flex items-center gap-3 px-4 py-3 text-left active:bg-muted/60"
                  >
                    <Tag className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="text-[14px] flex-1 truncate">Etiquetas</span>
                  </button>
                  {isCompanyAdmin && (
                    <button
                      type="button"
                      onClick={() => { setShowMobileMenu(false); setShowInviteDialog(true); }}
                      className="w-full flex items-center gap-3 px-4 py-3 text-left active:bg-muted/60"
                    >
                      <UserPlus className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span className="text-[14px] flex-1 truncate">Convidar atendente</span>
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={syncingData}
                    onClick={handleRefreshData}
                    className="w-full flex items-center gap-3 px-4 py-3 text-left active:bg-muted/60 disabled:opacity-60"
                  >
                    <RefreshCw className={cn("h-4 w-4 text-muted-foreground shrink-0", syncingData && "animate-spin")} />
                    <span className="text-[14px] flex-1 truncate">{syncingData ? 'Atualizando...' : 'Atualizar dados'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => { setShowMobileMenu(false); setShowQRModal(true); }}
                    className="w-full flex items-center gap-3 px-4 py-3 text-left active:bg-muted/60"
                  >
                    <QrCode className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="text-[14px] flex-1 truncate">
                      {connectedSessions.length > 0 ? 'Conectar outro número' : 'Conectar WhatsApp'}
                    </span>
                  </button>
                  {connectedSessions.length > 0 && (
                    <button
                      type="button"
                      disabled={!!reconnectingSessionId}
                      onClick={() => {
                        const s = connectedSessions[0];
                        if (!s) return;
                        if (!confirm('Reconectar este canal? A sessão atual será encerrada e você precisará escanear um novo QR Code.')) return;
                        void forceReconnectSession(s.id);
                      }}
                      className="w-full flex items-center gap-3 px-4 py-3 text-left active:bg-muted/60 disabled:opacity-60"
                    >
                      <RefreshCw className={cn("h-4 w-4 text-muted-foreground shrink-0", reconnectingSessionId && "animate-spin")} />
                      <span className="text-[14px] flex-1 truncate">{reconnectingSessionId ? 'Reconectando…' : 'Reconectar canal'}</span>
                    </button>
                  )}
                  {connectedSessions.length > 0 && (
                    <button
                      type="button"
                      onClick={async () => {
                        const session = connectedSessions[0];
                        if (!session) return;
                        if (!confirm('Desconectar e limpar esta sessão? Será necessário um novo QR Code.')) return;
                        setSessions(prev => prev.map(s => s.id === session.id ? { ...s, status: 'disconnected' } : s));
                        try {
                          await supabase.functions.invoke('whatsapp-api', { body: { action: 'logout', sessionId: session.id } });
                          toast({ title: 'Desconectado', description: 'WhatsApp desconectado com sucesso' });
                          await loadSessions();
                        } catch (e) {
                          toast({ title: 'Aviso', description: 'A desconexão remota pode ter falhado.', variant: 'destructive' });
                          await loadSessions();
                        }
                      }}
                      className="w-full flex items-center gap-3 px-4 py-3 text-left text-destructive active:bg-destructive/10"
                    >
                      <Eraser className="h-4 w-4 shrink-0" />
                      <span className="text-[14px] flex-1 truncate">Desconectar sessão</span>
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={stoppingAllBots}
                    onClick={async () => {
                      if (!companyId) return;
                      if (!confirm('Encerrar BOT em TODAS as conversas?')) return;
                      setStoppingAllBots(true);
                      try {
                        const { error: convErr } = await supabase
                          .from('whatsapp_conversations')
                          .update({ ai_auto_reply_enabled: false })
                          .eq('company_id', companyId)
                          .eq('ai_auto_reply_enabled', true);
                        if (convErr) throw convErr;
                        await (supabase as any)
                          .from('chatbot_executions')
                          .update({ status: 'stopped' })
                          .eq('company_id', companyId)
                          .eq('status', 'running');
                        setConversations(prev => prev.map(c => ({ ...c, ai_auto_reply_enabled: false })));
                        setSelectedConversation(prev => prev ? { ...prev, ai_auto_reply_enabled: false } : prev);
                        setChatbotActiveConvIds(new Set());
                        toast({ title: 'BOT encerrado', description: 'Auto-resposta desativada em todas as conversas.' });
                      } catch (e: any) {
                        toast({ title: 'Erro', description: e?.message || 'Falha ao encerrar bots', variant: 'destructive' });
                      } finally {
                        setStoppingAllBots(false);
                      }
                    }}
                    className="w-full flex items-center gap-3 px-4 py-3 text-left text-destructive active:bg-destructive/10 disabled:opacity-60"
                  >
                    <BotOff className={cn("h-4 w-4 shrink-0", stoppingAllBots && "animate-pulse")} />
                    <span className="text-[14px] flex-1 truncate">{stoppingAllBots ? 'Encerrando...' : 'Encerrar BOT'}</span>
                  </button>
                </div>
              </section>
            </div>
          </SheetContent>
        </Sheet>
      </header>

      {/* Top Header — refined, editorial (desktop) */}
      <div className="hidden md:flex items-center justify-between gap-3 px-6 py-3 border-b border-border/10 bg-[#faf9f7]/60 dark:bg-[#141414]/60 backdrop-blur-xl flex-shrink-0 flex-wrap min-w-0">
        {/* Segmented view switcher */}
        <div className="inline-flex items-center rounded-full bg-black/[0.03] dark:bg-white/[0.03] p-0.5 border border-border/10">
          {([
            { id: 'list', label: 'Lista', icon: List },
            { id: 'kanban', label: 'Kanban', icon: LayoutGrid },
            { id: 'contacts', label: 'Contatos', icon: Users },
            { id: 'satisfaction', label: 'Satisfação', icon: Heart },
            { id: 'autopilot', label: 'Piloto Automático', icon: Power },
          ] as const).map(({ id, label, icon: Icon }) => {
            const active = viewMode === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => setViewMode(id)}
                className={cn(
                  "relative inline-flex items-center gap-1.5 h-8 px-3.5 rounded-full text-[13px] font-medium transition-all",
                  active
                    ? "bg-background text-foreground shadow-sm border border-border/10"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {id !== 'autopilot' && <Icon className="h-3.5 w-3.5" />}
                <span>{label}</span>
                {id === 'contacts' && contactsCount > 0 && (
                  <span className="ml-0.5 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-primary/10 text-[10px] font-semibold text-primary tabular-nums">
                    {contactsCount > 999 ? '999+' : contactsCount}
                  </span>
                )}
                {id === 'autopilot' && (
                  <span
                    role="switch"
                    aria-checked={autopilotActive}
                    tabIndex={0}
                    onClick={async (e) => {
                      e.stopPropagation();
                      const next = !autopilotActive;
                      setAutopilotActive(next);
                      try {
                        const { data, error } = await supabase.functions.invoke('crm-autopilot-config', {
                          body: { action: next ? 'activate' : 'deactivate', companyId },
                        });
                        if (error) throw error;
                        if (data?.error) throw new Error(data.error);
                        toast({
                          title: next ? '🚀 Piloto Automático LIGADO' : 'Piloto Automático desligado',
                          description: next ? 'Assumindo todas as conversas do CRM' : 'Você voltou ao controle manual',
                        });
                      } catch (err: any) {
                        setAutopilotActive(!next);
                        toast({ title: 'Erro', description: err?.message, variant: 'destructive' });
                      }
                    }}
                    className={cn(
                      "ml-1 relative inline-flex h-4 w-7 items-center rounded-full transition-colors cursor-pointer",
                      autopilotActive ? "bg-primary" : "bg-muted-foreground/30"
                    )}
                    title={autopilotActive ? 'Desligar piloto' : 'Ligar piloto'}
                  >
                    <span
                      className={cn(
                        "inline-block h-3 w-3 rounded-full bg-white shadow transition-transform",
                        autopilotActive ? "translate-x-3.5" : "translate-x-0.5"
                      )}
                    />
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Right cluster */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => { setSelectedConversationForLabels(null); setShowLabelsManager(true); }}
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full text-[13px] font-medium text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
          >
            <Tag className="h-3.5 w-3.5" />
            <span className="hidden lg:inline">Etiquetas</span>
          </button>

          {isCompanyAdmin && (
            <button
              type="button"
              onClick={() => setShowInviteDialog(true)}
              title="Convidar atendente"
              className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full text-[13px] font-medium text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
            >
              <UserPlus className="h-3.5 w-3.5" />
              <span className="hidden lg:inline">Convidar</span>
            </button>
          )}

               {!isMobile && (
                 <DropdownMenu>
                   <DropdownMenuTrigger asChild>
                     <button
                       type="button"
                       className="inline-flex items-center gap-2 h-8 pl-2.5 pr-2.5 max-w-[190px] rounded-full bg-muted/60 ring-1 ring-border/50 text-[13px] font-medium text-muted-foreground hover:text-foreground hover:ring-border transition-all"
                     >
                       <div className="flex items-center gap-2 truncate">
                         <span className={cn(
                           "h-2 w-2 rounded-full",
                           connectedSessions.length > 0
                             ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"
                             : "bg-red-500"
                         )} />
                        <span className="truncate hidden lg:inline">
                            {selectedSessionId === 'ALL'
                              ? 'Todos os canais'
                              : (sessions.find(s => (selectedSessionId || connectedSessions[0]?.id) === s.id)?.phone_name ||
                                 sessions.find(s => (selectedSessionId || connectedSessions[0]?.id) === s.id)?.instance_name ||
                                 'Selecionar Canal')}
                          </span>
                       </div>
                       <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                     </button>
                   </DropdownMenuTrigger>
                   <DropdownMenuContent align="end" className="w-72 rounded-2xl">
                      <DropdownMenuItem
                        onClick={() => { setSelectedSessionId('ALL'); }}
                        className="flex items-center gap-3 p-2 cursor-pointer"
                      >
                        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                          <Phone className="h-4 w-4 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">Ver todos os canais</p>
                          <p className="text-xs text-muted-foreground truncate">
                            Mensagens de todas as conexões
                          </p>
                        </div>
                        {selectedSessionId === 'ALL' && <Check className="h-4 w-4 text-primary shrink-0" />}
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                     {sessions.length === 0 ? (
                       <div className="p-4 text-center text-sm text-muted-foreground">
                         Nenhum canal configurado
                       </div>
                     ) : (
                       sessions.map(session => {
                         const isSelected = (selectedSessionId || connectedSessions[0]?.id) === session.id;
                         return (
                           <DropdownMenuItem
                             key={session.id}
                             onClick={() => { setSelectedSessionId(session.id); loadConversations(); }}
                             className="flex items-center gap-3 p-2 cursor-pointer"
                           >
                             <div className="relative">
                               <Avatar className="h-8 w-8">
                                 <AvatarImage src={session.profile_picture} />
                                 <AvatarFallback className="bg-primary text-white text-xs">
                                   <Phone className="h-4 w-4" />
                                 </AvatarFallback>
                               </Avatar>
                               <span className={cn(
                                 "absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-background",
                                 session.status === 'connected' ? "bg-green-500" : "bg-red-500"
                               )} />
                             </div>
                             <div className="flex-1 min-w-0">
                               <p className="text-sm font-medium truncate">
                                 {session.phone_name || session.instance_name}
                               </p>
                               <p className="text-xs text-muted-foreground truncate">
                                 {session.phone_number || (session.status === 'connected' ? 'Conectado' : 'Desconectado')}
                               </p>
                             </div>
                             {isSelected && <Check className="h-4 w-4 text-primary shrink-0" />}
                              {session.status !== 'connected' && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                                  title="Excluir sessão"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    handleDeleteSession(session.id);
                                  }}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              )}
                           </DropdownMenuItem>
                         );
                       })
                     )}
                     <DropdownMenuSeparator />
                     <DropdownMenuItem onClick={() => setShowQRModal(true)} className="flex items-center gap-2 cursor-pointer text-primary">
                       <Plus className="h-4 w-4" />
                       <span>Conectar Novo WhatsApp</span>
                     </DropdownMenuItem>
                     {sessions.filter(s => s.status !== 'connected').length > 0 && (
                       <DropdownMenuItem
                         onSelect={(e) => {
                           e.preventDefault();
                           setConfirmCleanup(true);
                         }}
                         className="flex items-center gap-2 text-destructive cursor-pointer"
                       >
                         <Eraser className="h-4 w-4" />
                         <span>Limpar sessões inativas ({sessions.filter(s => s.status !== 'connected').length})</span>
                       </DropdownMenuItem>
                     )}
                   </DropdownMenuContent>
                 </DropdownMenu>
               )}

          {connectedSessions.length === 0 && (
            <>
              <div className="w-px h-5 bg-border/40 mx-1.5" />
            <button
              type="button"
              onClick={() => setShowQRModal(true)}
              className={cn(
                "inline-flex items-center gap-2 h-8 pl-2.5 pr-3 rounded-full ring-1 transition-all text-[13px] font-medium",
                hasDisconnectedSessions
                  ? "bg-destructive/10 text-destructive ring-destructive/25 hover:ring-destructive/50"
                  : "bg-muted/60 text-muted-foreground ring-border/60 hover:text-foreground hover:ring-border"
              )}
            >
              <Circle className={cn("h-2 w-2", hasDisconnectedSessions ? "fill-destructive text-destructive" : "fill-muted-foreground text-muted-foreground")} />
              <span className="hidden sm:inline">Conectar</span>
            </button>
            </>
          )}
        </div>

      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden">

      {viewMode === 'kanban' ? (
        <WhatsAppKanbanView
          conversations={filteredConversations}
          labels={labels}
          columns={kanbanColumns}
          companyId={companyId}
          teammates={teammates.map(t => ({ user_id: t.user_id, name: t.name, avatar_url: t.avatar_url }))}
          aiAgents={aiAgents.map(a => ({ id: a.id, name: a.name }))}

          onSelectConversation={(conv) => {
            // Abre a conversa exatamente como na view "Conversas" normal (sem pop-up/sidebar)
            const realConv =
              conversations.find(c => c.id === conv.id) ||
              conversations.find(c => c.contact_phone === conv.contact_phone) ||
              (conv as any);
            setSelectedConversation(realConv);
            setSelectedAgent(null);
            setShowContactProfile(false);
            setMessages([]);
            setViewMode('list');
            setShowMobileChat(true);
            markConversationAsRead(realConv);
          }}
          onSaveLead={openSaveLeadModal}
          onManageLabels={openLabelsManager}
          onUpdateStage={handleUpdateStage}
          onConfigureColumns={() => setShowColumnConfig(true)}
          onColumnsChange={(cols) => {
            setKanbanColumns(cols);
            localStorage.setItem('whatsapp_kanban_columns', JSON.stringify(cols));
          }}
        />
      ) : viewMode === 'satisfaction' ? (
        <div className="flex-1 overflow-hidden flex flex-col">
          <WhatsAppSatisfaction companyId={companyId || ''} />
        </div>
      ) : viewMode === 'autopilot' ? (
        <div className="flex-1 overflow-hidden flex flex-col">
          <WhatsAppAutopilot companyId={companyId || ''} />
        </div>
      ) : viewMode === 'contacts' ? (
        <div className="flex-1 overflow-hidden">
          <WhatsAppContacts
            companyId={companyId || ''}
            sessionId={connectedSessions[0]?.id}
            fullPage
            onStartConversation={(contact) => {
              // Check if we already have a conversation with this contact in our loaded list
              const existingConv = conversations.find(c => c.contact_phone === contact.phone_number);
              
              if (existingConv) {
                setSelectedConversation(existingConv);
              } else {
                // Create a temporary conversation for this contact
                const tempConv: WhatsAppConversationData = {
                  id: `temp-${contact.id}`,
                  contact_phone: contact.phone_number,
                  contact_name: contact.push_name || contact.business_name,
                  profile_picture: contact.profile_picture,
                  last_message_at: new Date().toISOString(),
                  status: 'open',
                  session_id: contact.session_id
                };
                setSelectedConversation(tempConv);
              }
              setViewMode('list');
              setShowMobileChat(true);
              toast({ title: 'Iniciar conversa', description: `Enviando mensagem para ${contact.push_name || contact.phone_number}` });
            }}
            onSaveAsLead={(contact) => {
              // Open save lead modal with contact info
              setSelectedConversationForLead({
                id: `temp-${contact.id}`,
                contact_phone: contact.phone_number,
                contact_name: contact.push_name || contact.business_name,
                profile_picture: contact.profile_picture,
                last_message_at: new Date().toISOString(),
                status: 'open'
              });
              setShowSaveLeadModal(true);
            }}
          />
        </div>
      ) : (
        /* List Mode (Sidebar + Chat) */
        <div className="flex-1 flex overflow-hidden min-w-0">
          {/* Conversations List - Left Panel */}
          <div className={cn(
            "w-full md:w-80 lg:w-[360px] xl:w-[400px] shrink-0 min-w-0 border-r border-border/10 flex flex-col bg-[#faf9f7] dark:bg-[#141414] overflow-hidden",
            showMobileChat && "hidden md:flex"
          )}>

            
             <div className={cn("border-b border-border/10 space-y-2", isMobile ? "p-3 pt-2" : "p-4")}>
               {/* Session Selector (Desktop) */}

               {/* Search */}
               {/* Search */}
               <div className="relative">
                  <Search className={cn(
                    "absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground",
                    isMobile ? "h-[18px] w-[18px]" : "h-4 w-4"
                  )} />
                  <Input
                    placeholder="Buscar conversas..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className={cn(
                      "pl-11 py-3 bg-black/[0.02] dark:bg-white/[0.02] border-border/10 rounded-[28px] text-[13px] placeholder:text-muted-foreground focus-visible:bg-background focus-visible:ring-1 focus-visible:ring-primary/20 focus-visible:border-primary/40 transition-all",
                      isMobile && "h-11 text-[15px] rounded-[28px] bg-muted/70 border border-border/10 focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:border-primary/60"
                    )}
                  />
               </div>
               
                 {/* Filter Tabs - clean */}
                  <div className="flex gap-1 p-1 rounded-xl bg-black/[0.03] dark:bg-white/[0.03] border border-border/10">
                  {['all', 'unread', 'open', 'closed'].map((tab) => (
                    <button
                      key={tab}
                      type="button"
                      onClick={() => setActiveTab(tab as any)}
                      className={cn(
                        "flex-1 py-2 text-xs font-medium rounded-lg transition-all duration-200",
                         isMobile && "h-9 text-[13px]",
                         activeTab === tab
                           ? "bg-background text-foreground shadow-sm border border-border/10 font-semibold"
                           : "text-muted-foreground hover:text-foreground hover:bg-black/[0.02] dark:hover:bg-white/[0.02]"
                      )}
                    >
                      {tab === 'all' ? 'Todas' : tab === 'unread' ? 'Não lidas' : tab === 'open' ? 'Abertas' : 'Fechadas'}
                    </button>
                  ))}
                </div>
             </div>
        
            {/* AI Agents Section removed for cleaner mobile experience */}
        
        {/* Conversations List */}
        <ScrollArea className="flex-1 overscroll-contain">
          {syncingConversations ? (
            <div className="flex flex-col items-center justify-center h-64 text-center p-4">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary mx-auto mb-4"></div>
              <h3 className="font-medium mb-2">Sincronizando conversas</h3>
              <p className="text-sm text-muted-foreground">
                Carregando suas conversas do WhatsApp...
              </p>
            </div>
          ) : filteredConversations.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-center p-4">
              {connectedSessions.length === 0 ? (
                <>
                  <QrCode className="h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="font-medium mb-2">Nenhum WhatsApp conectado</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Conecte seu WhatsApp para ver as conversas
                  </p>
                  <Button onClick={() => setShowQRModal(true)} className="bg-primary hover:bg-primary/90">
                    <QrCode className="h-4 w-4 mr-2" />
                    Conectar WhatsApp
                  </Button>
                </>
              ) : searchQuery ? (
                <>
                  <Search className="h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="font-medium mb-2">Nenhum resultado</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Tente outra busca ou filtro
                  </p>
                  {(() => {
                    const digits = searchQuery.replace(/\D/g, '');
                    if (digits.length < 8) return null;
                    const normalized = digits.length <= 11 ? `55${digits}` : digits;
                    const sessionId = selectedSessionId && selectedSessionId !== 'ALL'
                      ? selectedSessionId
                      : connectedSessions[0]?.id;
                    if (!sessionId) return null;
                    return (
                      <Button
                        className="bg-primary hover:bg-primary/90 text-white gap-2"
                        onClick={async () => {
                          try {
                            // 1) Try existing conversation in local list (any phone variant)
                            const variants = new Set<string>([normalized]);
                            if (normalized.startsWith('55') && normalized.length === 13) {
                              variants.add(normalized.slice(0, 4) + normalized.slice(5));
                            }
                            if (normalized.startsWith('55') && normalized.length === 12) {
                              variants.add(normalized.slice(0, 4) + '9' + normalized.slice(4));
                            }
                            const existingLocal = conversations.find(c => variants.has(c.contact_phone));
                            if (existingLocal) {
                              setSelectedConversation(existingLocal);
                              setShowMobileChat(true);
                              setSearchQuery('');
                              return;
                            }

                            if (!companyId) {
                              toast({ title: 'Erro', description: 'Empresa não identificada.', variant: 'destructive' });
                              return;
                            }

                            // 2) Try existing in DB
                            const { data: existingDb } = await supabase
                              .from('whatsapp_conversations')
                              .select('*')
                              .eq('company_id', companyId)
                              .in('contact_phone', Array.from(variants))
                              .order('last_message_at', { ascending: false })
                              .limit(1)
                              .maybeSingle();

                            if (existingDb) {
                              setConversations(prev => prev.some(c => c.id === (existingDb as any).id) ? prev : [existingDb as any, ...prev]);
                              setSelectedConversation(existingDb as any);
                              setShowMobileChat(true);
                              setSearchQuery('');
                              toast({ title: 'Conversa aberta', description: `+${normalized}` });
                              return;
                            }

                            // 3) Create new conversation row
                            const jid = normalized.length >= 18
                              ? `${normalized}@g.us`
                              : `${normalized}@s.whatsapp.net`;
                            const { data: newConv, error: insertErr } = await supabase
                              .from('whatsapp_conversations')
                              .insert({
                                session_id: sessionId,
                                company_id: companyId,
                                contact_phone: normalized,
                                remote_jid: jid,
                                status: 'open',
                                last_message_at: new Date().toISOString(),
                              })
                              .select()
                              .single();

                            if (insertErr || !newConv) {
                              console.error('Falha ao criar conversa:', insertErr);
                              toast({ title: 'Erro', description: 'Não foi possível iniciar a conversa.', variant: 'destructive' });
                              return;
                            }

                            setConversations(prev => [newConv as any, ...prev]);
                            setSelectedConversation(newConv as any);
                            setShowMobileChat(true);
                            setSearchQuery('');
                            toast({ title: 'Nova conversa', description: `Iniciando conversa com +${normalized}` });
                          } catch (e: any) {
                            console.error('Erro ao iniciar conversa:', e);
                            toast({ title: 'Erro', description: e?.message || 'Falha ao iniciar conversa', variant: 'destructive' });
                          }
                        }}
                      >
                        <MessageSquare className="h-4 w-4" />
                        Enviar mensagem para +{normalized}
                      </Button>
                    );
                  })()}
                </>
              ) : (
                <>
                  <MessageSquare className="h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="font-medium mb-2">Nenhuma conversa ainda</h3>
                  <p className="text-sm text-muted-foreground">
                    As conversas aparecerão aqui quando você receber mensagens
                  </p>
                </>
              )}
            </div>
          ) : (
            <div className="p-2 space-y-1">
              {filteredConversations.map(conversation => (
                <SwipeableConversationItem
                  key={`${conversation.id}-${conversation.profile_picture || 'none'}`}
                  onDelete={() => handleDeleteConversation(conversation)}
                  onSelect={async () => {
                    // If clicking the same conversation, just ensure mobile chat is open
                    if (selectedConversation?.id === conversation.id) {
                      setShowMobileChat(true);
                      return;
                    }
                    
                    setSelectedConversation(conversation);
                    setSelectedAgent(null);
                    setShowContactProfile(false);
                    setShowMobileChat(true);
                    
                    // Explicitly reset messages to prevent flicker of previous chat
                    setMessages([]);
                    
                    // Mark as read (local state + DB)
                    await markConversationAsRead(conversation);
                  }}
                >
                  <div
                    className={cn(
                      "flex items-center gap-3.5 px-3.5 py-3 rounded-2xl transition-colors cursor-pointer relative overflow-hidden",
                      selectedConversation?.id === conversation.id
                        ? "bg-black/[0.03] dark:bg-white/[0.04]"
                        : "hover:bg-black/[0.02] dark:hover:bg-white/[0.02] active:bg-black/[0.03]"
                    )}
                    onContextMenu={(e) => handleConversationContextMenu(e, conversation)}
                    onTouchStart={(e) => {
                      const timer = setTimeout(() => {
                        e.preventDefault();
                        const touch = e.touches[0];
                        setConversationContextMenu({
                          isOpen: true,
                          position: { x: touch.clientX, y: touch.clientY },
                          conversation,
                        });
                      }, 500);
                      (e.currentTarget as any)._longPressTimer = timer;
                    }}
                    onTouchEnd={(e) => {
                      clearTimeout((e.currentTarget as any)._longPressTimer);
                    }}
                    onTouchMove={(e) => {
                      clearTimeout((e.currentTarget as any)._longPressTimer);
                    }}
                  >
                    {selectedConversation?.id === conversation.id && (
                      <span className="absolute left-0 top-2.5 bottom-2.5 w-[2px] rounded-r-full bg-primary/70" />
                    )}
                    <div className="relative">
                      <Avatar className={cn(isMobile ? "h-[54px] w-[54px] ring-1 ring-border/30" : "h-12 w-12")}>
                        <AvatarImage key={`${conversation.id}-${conversation.profile_picture}`} src={conversation.profile_picture} />
                        <AvatarFallback className="bg-black/[0.04] dark:bg-white/[0.06] text-muted-foreground font-semibold">
                          {(conversation.contact_name || conversation.contact_phone).substring(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      {/* AI Agent indicator */}
                      {conversation.assigned_agent_id && conversation.ai_auto_reply_enabled && (
                        <div className="absolute -bottom-0.5 -right-0.5 p-1 bg-primary rounded-full ring-2 ring-background">
                          <Bot className="h-2.5 w-2.5 text-primary-foreground" />
                        </div>
                      )}
                      {/* Chatbot indicator */}
                      {!(conversation.assigned_agent_id && conversation.ai_auto_reply_enabled) && chatbotActiveConvIds.has(conversation.id) && (
                        <div className="absolute -bottom-0.5 -right-0.5 p-1 bg-primary rounded-full ring-2 ring-background">
                          <GitBranch className="h-2.5 w-2.5 text-primary-foreground" />
                        </div>
                      )}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <div className="flex items-center gap-2 min-w-0 overflow-hidden">
                          {isGroupConversation(conversation) && (
                            <Users className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                          )}
                          <span className={cn(
                            "font-semibold truncate text-foreground",
                            isMobile ? "text-[15.5px]" : "text-base"
                          )}>
                            {getDisplayName(conversation)}
                          </span>
                          {/* Discreet status pills */}
                          <div className="flex items-center gap-1 flex-shrink-0">
                            {isParentConversation(conversation) && (
                              <span className="inline-flex items-center h-[18px] pl-1.5 pr-2 rounded-full bg-violet-500/10 text-violet-600 dark:text-violet-400 text-[10px] font-medium gap-1 ring-1 ring-violet-500/15">
                                <span className="h-1.5 w-1.5 rounded-full bg-violet-500" />
                                Pai do Piloto
                              </span>
                            )}
                            {conversation.human_takeover && !isParentConversation(conversation) && (
                              <span className="inline-flex items-center h-[18px] pl-1.5 pr-2 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 text-[10px] font-medium gap-1 ring-1 ring-amber-500/15">
                                <User className="h-2.5 w-2.5" />
                                Humano
                              </span>
                            )}
                            {conversation.assigned_agent_id && conversation.ai_auto_reply_enabled && !isParentConversation(conversation) && (
                              <span className="inline-flex items-center h-[18px] pl-1.5 pr-2 rounded-full bg-primary/10 text-primary text-[10px] font-medium gap-1 ring-1 ring-primary/15">
                                <Sparkles className="h-2.5 w-2.5" />
                                IA
                              </span>
                            )}
                            {chatbotActiveConvIds.has(conversation.id) && !(conversation.assigned_agent_id && conversation.ai_auto_reply_enabled) && !isParentConversation(conversation) && (
                              <span className="inline-flex items-center h-[18px] pl-1.5 pr-2 rounded-full bg-sky-500/10 text-sky-600 dark:text-sky-400 text-[10px] font-medium gap-1 ring-1 ring-sky-500/15">
                                <GitBranch className="h-2.5 w-2.5" />
                                Bot
                              </span>
                            )}
                            {autopilotActive && !(conversation.assigned_agent_id && conversation.ai_auto_reply_enabled) && !isParentConversation(conversation) && (
                              <span className="inline-flex items-center h-[18px] pl-1.5 pr-2 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-medium gap-1 ring-1 ring-emerald-500/15">
                                <Sparkles className="h-2.5 w-2.5" />
                                Piloto
                              </span>
                            )}
                            <LeadScoreBadge
                              conversationId={conversation.id}
                              contactName={conversation.contact_name}
                              lastMessage={conversation.last_message}
                              lastMessageAt={conversation.last_message_at}
                            />
                          </div>
                        </div>
                        <span className={cn(
                          "flex-shrink-0 whitespace-nowrap",
                          (conversation.unread_count || 0) > 0
                            ? "text-[12px] font-semibold text-primary"
                            : "text-[12px] text-muted-foreground"
                        )}>
                          {conversation.last_message_at ? formatTime(conversation.last_message_at) : '--:--'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between min-w-0">
                        <div className={cn(
                          "truncate pr-2 min-w-0 flex-1 rounded-xl px-2.5 py-1 -ml-2.5",
                          isMobile ? "text-[13.5px]" : "text-sm",
                          (conversation.unread_count || 0) > 0
                            ? "text-foreground font-medium"
                            : "text-muted-foreground"
                        )}>
                          {isTypingStatusValid(conversation) ? (
                            <span className="text-primary font-semibold animate-pulse flex items-center gap-1">
                              {conversation.typing_status === 'recording' ? (
                                <><Mic className="h-3 w-3" /> gravando áudio...</>
                              ) : (
                                "digitando..."
                              )}
                            </span>
                          ) : conversation.last_message ? (
                            <LastMessagePreview text={conversation.last_message} />
                          ) : (
                            <span className="italic opacity-60">Iniciando conversa...</span>
                          )}
                        </div>
                        {(conversation.unread_count || 0) > 0 && (
                          <Badge className="bg-primary hover:bg-primary/90 text-primary-foreground text-[11px] font-bold px-2 py-0.5 min-w-[22px] h-[22px] rounded-full justify-center shadow-sm border-0">
                            {conversation.unread_count}
                          </Badge>
                        )}
                      </div>
                      {/* Labels below message */}
                      {conversation.labels && conversation.labels.length > 0 && (
                        <div className="flex items-center gap-1 mt-1.5 overflow-hidden">
                          {conversation.labels.slice(0, 2).map(labelId => {
                            const label = labels.find(l => l.id === labelId);
                            if (!label) return null;
                            return (
                              <span
                                key={labelId}
                                className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium"
                                style={{
                                  backgroundColor: `${label.color}14`,
                                  color: label.color,
                                }}
                              >
                                {label.name}
                              </span>
                            );
                          })}
                          {conversation.labels.length > 2 && (
                            <span className="text-[10px] text-muted-foreground">
                              +{conversation.labels.length - 2}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </SwipeableConversationItem>
              ))}
            </div>
          )}
        </ScrollArea>
      </div>

      {/* Chat Area - Right Panel */}
      <div className={cn(
        "flex-1 flex",
        !showMobileChat && "hidden md:flex",
        isMobile && showMobileChat && "w-full"
      )}>
      <div className="flex-1 flex flex-col min-w-0">
        {selectedConversation || selectedAgent ? (
          <>
            {/* Chat Header */}
            <div className={cn(
              "border-b border-border/10 bg-[#faf9f7]/60 dark:bg-[#141414]/60 backdrop-blur-xl text-foreground flex items-center justify-between px-6 flex-shrink-0 min-w-0",
              isMobile ? "h-[calc(3.75rem+env(safe-area-inset-top))] pt-[env(safe-area-inset-top)] px-2 gap-1" : "h-16"
            )}>
              <div className={cn("flex items-center min-w-0 flex-1", isMobile ? "gap-1.5" : "gap-3") }>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="md:hidden h-10 w-10 rounded-full text-foreground hover:bg-black/[0.05] dark:hover:bg-white/[0.05] shrink-0"
                  onClick={() => {
                    setShowMobileChat(false);
                    setSelectedConversation(null);
                    setSelectedAgent(null);
                    // Pop the history state we pushed
                    if (window.history.state?.whatsappChat) {
                      window.history.back();
                    }
                  }}
                >
                  <ArrowLeft className="h-5 w-5" />
                </Button>
                <button 
                  onClick={() => !selectedAgent && setShowContactProfile(true)}
                  className="flex items-center gap-3 hover:opacity-80 transition-opacity min-w-0 flex-1"
                >
                  <Avatar className={cn("shrink-0 ring-1 ring-border", isMobile ? "h-11 w-11" : "h-10 w-10")}>
                    {selectedAgent ? (
                      <>
                        <AvatarImage key={selectedAgent.avatar_url || 'no-agent-pic'} src={selectedAgent.avatar_url || undefined} />
                        <AvatarFallback className="bg-gradient-to-br from-var(--primary) to-[#253573] text-white">
                          <Bot className="h-5 w-5" />
                        </AvatarFallback>
                      </>
                    ) : (
                      <>
                        <AvatarImage key={`${selectedConversation?.id}-${selectedConversation?.profile_picture}`} src={selectedConversation?.profile_picture} />
                        <AvatarFallback className="bg-[#DFE4FB] text-primary">
                          {(selectedConversation ? getDisplayName(selectedConversation, messages) : '').substring(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </>
                    )}
                  </Avatar>
                  <div className="text-left min-w-0 flex-1">
                    <div className="flex items-center gap-2 min-w-0">
                      <h2 className={cn("font-semibold truncate", isMobile ? "text-[15.5px] max-w-[58vw] leading-tight" : "max-w-[180px] sm:max-w-[260px] md:max-w-[360px]")}>
                        {selectedAgent ? selectedAgent.name : (selectedConversation ? getDisplayName(selectedConversation, messages) : '')}
                      </h2>
                      {selectedAgent && !isMobile && (
                        <Badge className="bg-[#DFE4FB] text-primary dark:bg-[#0F1631] dark:text-[#879CE0] text-xs shrink-0">
                          Agente IA
                        </Badge>
                      )}
                      {isMobile && selectedConversation?.assigned_agent_id && selectedConversation?.ai_auto_reply_enabled && (
                        <span className="shrink-0 h-5 w-5 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center" title="IA atendendo">
                          <Bot className="h-3 w-3 text-white" />
                        </span>
                      )}
                    </div>
                    <p className={cn("truncate text-muted-foreground", isMobile ? "text-[12px] max-w-[58vw] leading-tight mt-0.5" : "text-xs max-w-[150px] sm:max-w-[240px] md:max-w-[320px]")}>
                      {selectedAgent ? (
                        selectedAgent.description || 'Assistente virtual'
                      ) : (selectedConversation && isTypingStatusValid(selectedConversation)) ? (
                        <span className="text-[#25D366] font-medium animate-pulse">
                          {selectedConversation.typing_status === 'recording' ? 'gravando áudio...' : 'digitando...'}
                        </span>
                      ) : (
                        isGroupConversation(selectedConversation!) 
                          ? (selectedConversation?.group_description || 'Conversa de grupo')
                          : formatPhoneDisplay(selectedConversation?.contact_phone || '')
                      )}
                    </p>
                  </div>
                </button>
              </div>
              
              <div className={cn("flex items-center flex-shrink-0 justify-end", isMobile ? "gap-1" : "gap-1.5") }>
                {selectedConversation && (
                  <Popover open={historyOpen} onOpenChange={setHistoryOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="flex-shrink-0 text-muted-foreground hover:text-foreground hover:bg-black/[0.05] dark:hover:bg-white/[0.05] relative"
                        title="Histórico de eventos"
                      >
                        <HistoryIcon className="h-5 w-5" />
                        {conversationEvents.length > 0 && (
                          <span className="absolute -top-0.5 -right-0.5 h-4 min-w-[16px] px-1 rounded-full bg-amber-400 text-[10px] font-semibold text-black flex items-center justify-center">
                            {conversationEvents.length > 9 ? '9+' : conversationEvents.length}
                          </span>
                        )}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent align="end" className="w-80 p-0">
                      <div className="px-4 py-3 border-b">
                        <div className="text-sm font-semibold">Histórico da conversa</div>
                        <div className="text-xs text-muted-foreground">Eventos de automação e atendimento</div>
                      </div>
                      <ScrollArea className="max-h-80">
                        {conversationEvents.length === 0 ? (
                          <div className="px-4 py-6 text-xs text-muted-foreground text-center">
                            Nenhum evento registrado ainda.
                          </div>
                        ) : (
                          <ol className="relative px-4 py-3 space-y-3">
                            {conversationEvents.map((ev) => {
                              const meta: {
                                label: string;
                                Icon: React.ComponentType<{ className?: string }>;
                                tone: string;
                              } = (() => {
                                switch (ev.event_type) {
                                  case 'human_takeover':
                                    return { label: 'Humano assumiu', Icon: User, tone: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300' };
                                  case 'returned_to_ai':
                                    return { label: 'Devolvida para IA', Icon: ShieldCheck, tone: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' };
                                  case 'ai_paused':
                                    return { label: 'IA bloqueada', Icon: ShieldOff, tone: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300' };
                                  case 'chatbot_stopped':
                                    return { label: 'Chatbot parado', Icon: PauseCircle, tone: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200' };
                                  default:
                                    return { label: ev.event_type, Icon: HistoryIcon, tone: 'bg-muted text-foreground' };
                                }
                              })();
                              const when = new Date(ev.created_at);
                              const whenLabel = when.toLocaleString('pt-BR', {
                                day: '2-digit', month: '2-digit', year: '2-digit',
                                hour: '2-digit', minute: '2-digit',
                              });
                              return (
                                <li key={ev.id} className="flex gap-2.5">
                                  <div className={cn("h-7 w-7 rounded-full flex items-center justify-center flex-shrink-0", meta.tone)}>
                                    <meta.Icon className="h-3.5 w-3.5" />
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <div className="text-xs font-medium">{meta.label}</div>
                                    {ev.reason && (
                                      <div className="text-xs text-muted-foreground truncate" title={ev.reason}>
                                        {ev.reason}
                                      </div>
                                    )}
                                    <div className="text-[10px] text-muted-foreground mt-0.5">
                                      {whenLabel} · {ev.actor_name || (ev.actor_type === 'system' ? 'Sistema' : 'Usuário')}
                                    </div>
                                  </div>
                                </li>
                              );
                            })}
                          </ol>
                        )}
                      </ScrollArea>
                    </PopoverContent>
                  </Popover>
                )}
                {selectedConversation && (
                  <Sheet open={followUpsOpen} onOpenChange={setFollowUpsOpen}>
                    <SheetContent side="right" className="w-full sm:max-w-md p-0 flex flex-col">
                      <FollowUpsPanel
                        conversationId={selectedConversation.id}
                        companyId={(selectedConversation as any).company_id ?? null}
                        onClose={() => setFollowUpsOpen(false)}
                      />
                    </SheetContent>
                  </Sheet>
                )}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="flex-shrink-0 h-8 gap-1.5 rounded-full px-3 text-[12px] font-medium text-muted-foreground hover:text-foreground hover:bg-black/[0.05] dark:hover:bg-white/[0.05]"
                    >
                      <MoreVertical className="h-4 w-4" />
                      <span className={cn(isMobile && "hidden")}>Ações</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-64 max-h-[70vh] overflow-y-auto">
                    <DropdownMenuItem onClick={() => !selectedAgent && setShowContactProfile(true)}>
                      <Users className="h-4 w-4 mr-2" />
                      Ver perfil do contato
                    </DropdownMenuItem>
                    {selectedConversation && (
                      <>
                        <DropdownMenuItem onClick={() => setFollowUpsOpen(true)}>
                          <CalendarClock className="h-4 w-4 mr-2" />
                          Follow-ups inteligentes
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setShowScheduleMeetingModal(true)}>
                          <Calendar className="h-4 w-4 mr-2" />
                          Agendar reunião
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setHistoryOpen(true)}>
                          <HistoryIcon className="h-4 w-4 mr-2" />
                          Histórico da conversa
                        </DropdownMenuItem>
                      </>
                    )}
                    {!selectedAgent && selectedConversation && (
                      <>
                        <DropdownMenuSeparator />
                        {aiAgents.length > 0 && (
                          <>
                            <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
                              Atribuir Agente IA
                            </div>
                            {aiAgents.map(agent => (
                              <DropdownMenuItem 
                                key={agent.id}
                                onClick={() => handleAssignAgent(selectedConversation, agent.id, true)}
                                className={selectedConversation.assigned_agent_id === agent.id ? "bg-[#F0F2FE] dark:bg-blue-950" : ""}
                              >
                                <Bot className="h-4 w-4 mr-2 text-primary" />
                                {agent.name}
                                {selectedConversation.assigned_agent_id === agent.id && (
                                  <Check className="h-4 w-4 ml-auto text-primary" />
                                )}
                              </DropdownMenuItem>
                            ))}
                            {selectedConversation.assigned_agent_id && (
                              <>
                                <DropdownMenuItem 
                                  onClick={async () => {
                                    const newState = !selectedConversation.ai_auto_reply_enabled;
                                    const { error } = await supabase
                                      .from('whatsapp_conversations')
                                      .update({ ai_auto_reply_enabled: newState })
                                      .eq('id', selectedConversation.id);
                                    
                                    if (!error) {
                                      setConversations(prev => prev.map(c => 
                                        c.id === selectedConversation.id 
                                          ? { ...c, ai_auto_reply_enabled: newState } 
                                          : c
                                      ));
                                      setSelectedConversation(prev => prev 
                                        ? { ...prev, ai_auto_reply_enabled: newState } 
                                        : null
                                      );
                                      toast({
                                        title: newState ? 'Auto-resposta ativada' : 'Auto-resposta desativada',
                                        description: newState 
                                          ? 'O agente IA responderá automaticamente' 
                                          : 'O agente IA não responderá automaticamente'
                                      });
                                    }
                                  }}
                                  className={selectedConversation.ai_auto_reply_enabled ? "text-primary" : "text-muted-foreground"}
                                >
                                  <Sparkles className="h-4 w-4 mr-2" />
                                  {selectedConversation.ai_auto_reply_enabled ? '✓ Auto-resposta ON' : 'Auto-resposta OFF'}
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleAssignAgent(selectedConversation, null)}>
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  Remover Agente
                                </DropdownMenuItem>
                              </>
                            )}
                            <DropdownMenuSeparator />
                          </>
                        )}
                        <DropdownMenuItem
                          onClick={() => {
                            setActivateStep('choice');
                            setActivateAutomationOpen(true);
                          }}
                        >
                          <Sparkles className="h-4 w-4 mr-2 text-primary" />
                          Ativar automação
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setShowStartChatbot(true)}>
                          <GitBranch className="h-4 w-4 mr-2 text-primary" />
                          Iniciar Chatbot
                        </DropdownMenuItem>
                        {activeChatbotFlow && (
                          <DropdownMenuItem
                            onClick={async () => {
                              await supabase
                                .from('chatbot_executions')
                                .update({ status: 'stopped', completed_at: new Date().toISOString() })
                                .eq('id', activeChatbotFlow.id);
                              await logConversationEvent(
                                selectedConversation.id,
                                'chatbot_stopped',
                                `Fluxo "${activeChatbotFlow.name}" interrompido manualmente`,
                                { flow_execution_id: activeChatbotFlow.id },
                              );
                              setActiveChatbotFlow(null);
                              toast({ title: 'Chatbot parado', description: 'O fluxo foi interrompido.' });
                            }}
                          >
                            <Square className="h-4 w-4 mr-2" />
                            Parar fluxo ({activeChatbotFlow.name})
                          </DropdownMenuItem>
                        )}
                        {selectedConversation.human_takeover && (
                          <DropdownMenuItem
                            onClick={async () => {
                              const { error } = await supabase
                                .from('whatsapp_conversations')
                                .update({ human_takeover: false, human_takeover_at: null })
                                .eq('id', selectedConversation.id);
                              if (!error) {
                                setConversations(prev => prev.map(c =>
                                  c.id === selectedConversation.id ? { ...c, human_takeover: false } : c
                                ));
                                setSelectedConversation(prev => prev ? { ...prev, human_takeover: false } : prev);
                                await logConversationEvent(selectedConversation.id, 'returned_to_ai', 'Conversa devolvida para a IA');
                                toast({ title: 'Devolvido para a IA', description: 'A automação voltou a responder esta conversa.' });
                              }
                            }}
                          >
                            <UserCheck className="h-4 w-4 mr-2" />
                            Devolver para a IA
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem
                          onClick={async () => {
                            if (!selectedConversation) return;
                            const t = toast({ title: 'Sincronizando...', description: 'Atualizando dados e histórico do WhatsApp.' });
                            try {
                              const { data, error } = await supabase.functions.invoke('whatsapp-api', {
                                body: {
                                  action: 'sync_chat_history',
                                  conversationId: selectedConversation.id,
                                  limit: 300,
                                },
                              });
                              if (error) throw error;
                              
                              // Forced reload of conversations to catch profile pic updates
                              await loadConversations();
                              
                              const synced = (data as any)?.synced ?? 0;
                              toast({
                                title: 'Sincronização concluída',
                                description: synced > 0
                                  ? `${synced} novas mensagens carregadas e dados atualizados.`
                                  : 'Dados atualizados com sucesso.',
                              });
                              
                              // Reload messages if any were synced
                              if (synced > 0) {
                                await loadMessagesByPhone(selectedConversation.contact_phone);
                              }
                            } catch (e: any) {
                              toast({
                                title: 'Erro ao sincronizar',
                                description: e?.message || 'Não foi possível atualizar os dados.',
                                variant: 'destructive',
                              });
                            }
                          }}
                        >
                          <RefreshCw className="h-4 w-4 mr-2 text-primary" />
                          Sincronizar dados
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => openLabelsManager(selectedConversation)}>
                          <Tag className="h-4 w-4 mr-2" />
                          Gerenciar Etiquetas
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => openSaveLeadModal(selectedConversation)}>
                          <UserPlus className="h-4 w-4 mr-2" />
                          Adicionar à Base de Clientes
                        </DropdownMenuItem>
                        {isCompanyAdmin && (
                          <>
                            <DropdownMenuSeparator />
                            <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
                              Transferir para
                            </div>
                            {teammates.length <= 1 ? (
                              <DropdownMenuItem
                                onClick={() => setShowInviteDialog(true)}
                                className="text-primary"
                              >
                                <UserPlus className="h-4 w-4 mr-2" />
                                Convidar atendente...
                              </DropdownMenuItem>
                            ) : (
                              <>
                                {teammates
                                  .filter(t => t.user_id !== user?.id)
                                  .map(t => (
                                    <DropdownMenuItem
                                      key={t.user_id}
                                      onClick={() => handleTransferConversation(t.user_id)}
                                      className={selectedConversation.assigned_user_id === t.user_id ? 'bg-muted' : ''}
                                    >
                                      <Avatar className="h-5 w-5 mr-2">
                                        <AvatarImage src={t.avatar_url || undefined} />
                                        <AvatarFallback className="text-[10px] bg-primary/10 text-primary">
                                          {t.name.substring(0, 2).toUpperCase()}
                                        </AvatarFallback>
                                      </Avatar>
                                      <span className="truncate">{t.name}</span>
                                      {selectedConversation.assigned_user_id === t.user_id && (
                                        <Check className="h-3.5 w-3.5 ml-auto text-primary" />
                                      )}
                                    </DropdownMenuItem>
                                  ))}
                                <DropdownMenuItem
                                  onClick={() => handleTransferConversation(user?.id || null)}
                                  className={selectedConversation.assigned_user_id === user?.id ? 'bg-muted' : ''}
                                >
                                  <UserCheck className="h-4 w-4 mr-2" />
                                  Atribuir a mim
                                </DropdownMenuItem>
                                {selectedConversation.assigned_user_id && (
                                  <DropdownMenuItem
                                    onClick={() => handleTransferConversation(null)}
                                    className="text-muted-foreground"
                                  >
                                    <Eraser className="h-4 w-4 mr-2" />
                                    Remover atribuição
                                  </DropdownMenuItem>
                                )}
                                <DropdownMenuItem onClick={() => setShowInviteDialog(true)}>
                                  <UserPlus className="h-4 w-4 mr-2" />
                                  Convidar atendente...
                                </DropdownMenuItem>
                              </>
                            )}
                          </>
                        )}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem 
                          onClick={() => handleArchiveConversation(selectedConversation)}
                          className="text-amber-600"
                        >
                          <Archive className="h-4 w-4 mr-2" />
                          {selectedConversation.status === 'archived' ? 'Desarquivar' : 'Arquivar'}
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          onClick={() => handleDeleteConversation(selectedConversation)}
                          className="text-destructive focus:text-destructive"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Excluir conversa
                        </DropdownMenuItem>
                      </>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
            
            {/* Messages Area */}
            <div
              className="flex-1 relative overflow-hidden"
              onDragEnter={(e) => {
                if (!selectedConversation) return;
                if (!Array.from(e.dataTransfer?.types || []).includes('Files')) return;
                e.preventDefault();
                dragCounterRef.current += 1;
                setIsDraggingFile(true);
              }}
              onDragOver={(e) => {
                if (!Array.from(e.dataTransfer?.types || []).includes('Files')) return;
                e.preventDefault();
                e.dataTransfer.dropEffect = 'copy';
              }}
              onDragLeave={(e) => {
                if (!Array.from(e.dataTransfer?.types || []).includes('Files')) return;
                e.preventDefault();
                dragCounterRef.current -= 1;
                if (dragCounterRef.current <= 0) {
                  dragCounterRef.current = 0;
                  setIsDraggingFile(false);
                }
              }}
              onDrop={async (e) => {
                if (!selectedConversation) return;
                if (!Array.from(e.dataTransfer?.types || []).includes('Files')) return;
                e.preventDefault();
                dragCounterRef.current = 0;
                setIsDraggingFile(false);
                const files = Array.from(e.dataTransfer?.files || []);
                if (files.length === 0) return;
                setPendingDropFiles(files);
                setDropCaption('');
              }}
            >
              {isDraggingFile && (
                <div className="absolute inset-0 z-30 flex items-center justify-center bg-primary/15 backdrop-blur-sm border-2 border-dashed border-primary rounded-lg pointer-events-none">
                  <div className="bg-background/90 px-6 py-4 rounded-xl shadow-lg flex items-center gap-3">
                    <Paperclip className="h-6 w-6 text-primary" />
                    <div>
                      <p className="font-semibold text-foreground">Solte para enviar</p>
                      <p className="text-xs text-muted-foreground">Imagens, vídeos, áudios ou documentos</p>
                    </div>
                  </div>
                </div>
              )}
              <ScrollArea ref={messagesScrollAreaRef} className="h-full p-4 bg-[#faf9f7] dark:bg-[#141414]">
              <div className="space-y-5 max-w-3xl mx-auto">
                {loadingMessages && currentMessages.length === 0 && !selectedAgent ? (
                  <MessagesLoadingState />
                ) : currentMessages.length === 0 ? (
                  <div className="flex items-center justify-center h-full py-20">
                    <div className="text-center">
                      {selectedAgent ? (
                        <>
                          <Bot className="h-12 w-12 text-primary mx-auto mb-4" />
                          <p className="text-muted-foreground">
                            Inicie uma conversa com <strong>{selectedAgent.name}</strong>
                          </p>
                        </>
                      ) : (
                        <>
                          <MessageSquare className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                          <p className="text-muted-foreground">
                            Nenhuma mensagem ainda. Inicie a conversa!
                          </p>
                        </>
                      )}
                    </div>
                  </div>
                ) : (
                  <div key={`chat-container-${selectedConversation?.id}`} className={cn("flex flex-col", isMobile ? "gap-4" : "gap-3")}>
                    {currentMessages.filter(m => m.message_type !== 'reaction').map(message => (
                      <div
                        key={message.id}
                        className={cn(
                          "flex group",
                          message.from_me ? 'justify-end' : 'justify-start',
                          message.from_me && message.is_ai_response && 'items-end gap-2'
                        )}
                        onContextMenu={(e) => handleMessageContextMenu(e, message)}
                      >
                        {/* Bot avatar for AI responses */}
                        {message.from_me && message.is_ai_response && (
                          <div className="w-7 h-7 rounded-full bg-[#374DA4] flex items-center justify-center flex-shrink-0 mb-1 order-first">
                            <Bot className="h-3.5 w-3.5 text-white" />
                          </div>
                        )}
                        <div
                          className={cn(
                            "max-w-[85%] sm:max-w-[70%] rounded-2xl px-4 py-2.5 shadow-none relative",
                            message.from_me
                              ? message.is_ai_response 
                                ? "bg-[#374DA4] text-white rounded-br-sm border border-[#374DA4]/80" 
                                : message.status === 'sending'
                                  ? "bg-muted/50 text-muted-foreground rounded-br-sm border border-border/5"
                                  : message.status === 'failed'
                                    ? "bg-destructive/10 text-destructive rounded-br-sm border border-destructive/20"
                                    : "bg-black/[0.05] dark:bg-white/[0.05] text-foreground rounded-br-sm border border-border/10"
                              : "bg-background text-foreground rounded-bl-sm border border-border/10"
                          )}
                        >
                          {/* AI Response indicator for sent messages */}
                          {message.from_me && message.is_ai_response && (
                            <div className="flex items-center gap-1.5 mb-1.5 pb-1.5 border-b border-white/20">
                              <Bot className="h-3.5 w-3.5 text-white" />
                              <span className="text-[10px] font-semibold text-white/90 uppercase tracking-wide">
                                {message.sender_name?.replace('🤖 ', '') || 'Resposta Automática IA'}
                              </span>
                            </div>
                          )}
                          
                          {!message.from_me && selectedAgent && (
                            <div className="flex items-center gap-1 mb-1">
                              <Bot className="h-3 w-3 text-primary" />
                              <span className="text-[10px] font-medium text-primary dark:text-[#5A74D1]">
                                {selectedAgent.name}
                              </span>
                            </div>
                          )}
                          
                          {/* Group message: show sender name */}
                          {!message.from_me && !selectedAgent && message.sender_name && (
                            <div className="flex items-center gap-1.5 mb-1.5">
                              <span className="text-xs font-semibold text-primary">
                                {message.sender_name}
                              </span>
                            </div>
                          )}
                          
                          {['image', 'video', 'audio', 'ptt', 'document', 'sticker', 'location', 'contact'].includes(message.message_type || '') ? (
                            <WhatsAppMediaMessage
                              messageType={message.message_type || 'text'}
                              content={message.content || ''}
                              mediaUrl={message.media_url || undefined}
                              mediaCaption={message.media_caption || undefined}
                              fromMe={message.from_me}
                            />
                          ) : (
                            <p className={cn(
                              "text-sm whitespace-pre-wrap break-words",
                              message.from_me ? (message.is_ai_response ? "text-white" : "text-foreground") : "text-foreground"
                            )}>
                              {message.content && message.content.split(/(\s+)/).map((part, i) => {
                                if (part.match(/^(https?:\/\/[^\s]+)$|^www\.[^\s]+$/i)) {
                                  const url = part.startsWith('http') ? part : `https://${part}`;
                                  return (
                                    <a 
                                      key={i} 
                                      href={url} 
                                      target="_blank" 
                                      rel="noopener noreferrer"
                                      className="underline hover:no-underline font-medium break-all"
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      {part}
                                    </a>
                                  );
                                }
                                return part;
                              })}
                            </p>
                          )}
                          
                          <div className={cn(
                            "flex items-center justify-end gap-1 mt-1",
                            message.from_me ? (message.is_ai_response ? "text-white/70" : "text-muted-foreground") : "text-muted-foreground"
                          )}>
                            <span className="text-[10px]">
                              {new Date(message.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                            {message.from_me && (
                              message.status === 'read' ? (
                                <CheckCheck className={cn("h-3 w-3", message.is_ai_response ? "text-white" : "text-primary")} />
                              ) : message.status === 'delivered' ? (
                                <CheckCheck className={cn("h-3 w-3", message.is_ai_response ? "text-white/70" : "text-muted-foreground/50")} />
                              ) : (
                                <Check className={cn("h-3 w-3", message.is_ai_response ? "text-white/70" : "text-muted-foreground/50")} />
                              )
                            )}
                          </div>

                          {/* Reactions badge */}
                          {(message.reaction || message.reactions) && (
                            <div className={cn(
                              "absolute -bottom-3 right-0 flex items-center gap-0.5 z-10 animate-in zoom-in duration-200",
                              message.from_me ? "justify-end" : "justify-start"
                            )}>
                              {message.reactions ? (
                                <div className="flex -space-x-1 hover:space-x-0.5 transition-all">
                                  {Object.entries(message.reactions).map(([sender, emoji], idx) => (
                                    <div 
                                      key={`${sender}-${idx}`}
                                      title={sender}
                                      className={cn(
                                        "bg-background border rounded-full px-1.5 py-0.5 text-[10px] shadow-sm flex items-center justify-center cursor-default hover:z-20",
                                        message.from_me ? "border-[#B3BFF0] dark:border-[#0F1631]" : "border-border"
                                      )}
                                    >
                                      {emoji}
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <div className={cn(
                                  "bg-background border rounded-full px-1.5 py-0.5 text-[10px] shadow-sm",
                                  message.from_me ? "border-[#B3BFF0] dark:border-[#0F1631] shadow-[#DFE4FB]/20" : "border-border"
                                )}>
                                  {message.reaction}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                    {isAiTyping && (
                      <div className="flex justify-start">
                        <div className="bg-black/[0.03] dark:bg-white/[0.03] rounded-lg px-4 py-3 rounded-bl-none border border-border/40">
                          <div className="flex items-center gap-2">
                            <Bot className="h-4 w-4 text-primary animate-pulse" />
                            <div className="flex gap-1">
                              <span className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                              <span className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                              <span className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
              </ScrollArea>

              {/* Scroll to bottom button - WhatsApp Web style */}
              {showScrollToBottom && (
                <Button
                  onClick={handleScrollToBottom}
                  size="icon"
                  className="absolute bottom-4 right-6 z-10 rounded-full bg-[#faf9f7] dark:bg-[#141414] shadow-lg hover:bg-black/[0.05] dark:hover:bg-white/[0.05] h-10 w-10 border border-border/10"
                >
                  <ChevronDown className="h-5 w-5 text-muted-foreground" />
                </Button>
              )}
            </div>
            
            {/* Input Area */}
            <div className={cn(
              "p-4 border-t border-border/10 bg-[#faf9f7] dark:bg-[#141414]",
              isMobile && "pb-[calc(1rem+env(safe-area-inset-bottom))]"
            )}>
              {/* Hidden file input */}
              <input 
                type="file" 
                ref={fileInputRef}
                className="hidden"
                accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx"
                onChange={handleFileUpload}
              />
              
              <div className="flex items-center gap-2 max-w-3xl mx-auto">
                {/* Media upload dropdown */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button 
                      variant="ghost" 
                      size="icon"
                      className="h-10 w-10 flex-shrink-0"
                      disabled={uploadingMedia || !selectedConversation}
                    >
                      {uploadingMedia ? (
                        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                      ) : (
                        <Plus className="h-5 w-5 text-muted-foreground" />
                      )}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start">
                    <DropdownMenuItem onClick={() => {
                      if (fileInputRef.current) {
                        fileInputRef.current.accept = 'image/*';
                        fileInputRef.current.click();
                      }
                    }}>
                      <ImageIcon className="h-4 w-4 mr-2" />
                      Imagem
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => {
                      if (fileInputRef.current) {
                        fileInputRef.current.accept = 'video/*';
                        fileInputRef.current.click();
                      }
                    }}>
                      <Play className="h-4 w-4 mr-2" />
                      Vídeo
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => {
                      if (fileInputRef.current) {
                        fileInputRef.current.accept = '.pdf,.doc,.docx,.xls,.xlsx';
                        fileInputRef.current.click();
                      }
                    }}>
                      <FileText className="h-4 w-4 mr-2" />
                      Documento
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                
                {/* Audio Recorder Button */}
                <AudioComposerButton
                  recording={recordingAudio}
                  disabled={uploadingMedia || !selectedConversation}
                  onRecordingStart={() => setRecordingAudio(true)}
                  onRecordingEnd={() => setRecordingAudio(false)}
                  onAudioReady={handleAudioRecordingComplete}
                />
                {!recordingAudio && (
                  <>
                    <div className="relative flex-1">
                      <Input
                        placeholder={selectedAgent ? `Mensagem para ${selectedAgent.name}...` : "Digite uma mensagem..."}
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()}
                        className="w-full pr-11 h-11 rounded-2xl bg-black/[0.02] dark:bg-white/[0.02] border-border/10 focus-visible:ring-1 focus-visible:ring-primary/20 focus-visible:ring-offset-0 focus-visible:border-primary/40 transition-all"
                      />
                      <div className="absolute right-1.5 top-1/2 -translate-y-1/2">
                        <AIImproveMessageButton size="sm" text={newMessage} onImproved={(t) => setNewMessage(t)} disabled={sendingMessage} />
                      </div>
                    </div>
                    <Button 
                    onClick={sendMessage} 
                    disabled={sendingMessage || !newMessage.trim()}
                    className="bg-primary hover:bg-primary/90 h-10 w-10 rounded-full flex items-center justify-center p-0 shrink-0"
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                  </>
                )}
              </div>
            </div>
          </>
        ) : (
          /* Empty State */
          <div className="flex-1 flex flex-col items-center justify-center bg-[#faf9f7] dark:bg-[#141414] text-center p-8">
            <div className="relative mb-12">
              <div className="absolute inset-0 bg-primary/5 blur-[60px] rounded-full scale-150" />
              <div className="relative w-32 h-32 text-muted-foreground/30">
                <MessageSquare className="w-full h-full" strokeWidth={0.7} />
              </div>
            </div>
            <h2 className="text-2xl font-semibold text-foreground mb-3 tracking-tight">
              CRM WhatsApp
            </h2>
            <p className="text-muted-foreground max-w-sm leading-relaxed text-[15px]">
              Selecione uma conversa na lista lateral para iniciar o atendimento e gerenciar suas interações.
              {aiAgents.length > 0 && (
                <span className="block mt-2">
                  Ou converse com um dos <strong className="text-foreground">Agentes IA</strong> disponíveis.
                </span>
              )}
            </p>
            <div className="mt-12 flex gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground/30" />
              <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground/20" />
              <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground/10" />
            </div>
            {connectedSessions.length === 0 && (
              <div className="flex flex-col sm:flex-row gap-3 mt-6">
                <Button 
                  onClick={() => setShowQRModal(true)} 
                  className="bg-primary hover:bg-primary/90"
                >
                  <QrCode className="h-4 w-4 mr-2" />
                  Conectar WhatsApp
                </Button>
              </div>
            )}
          </div>
                )}
              </div>

              {/* Contact Profile Panel - Desktop */}
              {showContactProfile && selectedConversation && !isMobile && companyId && (
                <ContactProfilePanel
                  contactPhone={selectedConversation.contact_phone}
                  contactName={selectedConversation.contact_name}
                  profilePicture={selectedConversation.profile_picture}
                  companyId={companyId}
                  labels={selectedConversation.labels}
                  conversationStatus={selectedConversation.status}
                  createdAt={selectedConversation.last_message_at}
                  onClose={() => setShowContactProfile(false)}
                />
              )}
            </div>
          </div>
        )}
      </div>



      <ConversationLabelsManager
        isOpen={showLabelsManager}
        onClose={() => {
          setShowLabelsManager(false);
          setSelectedConversationForLabels(null);
        }}
        labels={labels}
        selectedLabels={selectedConversationForLabels?.labels || []}
        onToggleLabel={handleToggleLabel}
        onCreateLabel={handleCreateLabel}
        onDeleteLabel={handleDeleteLabel}
        mode={selectedConversationForLabels ? 'assign' : 'manage'}
      />

      {/* Save Lead Modal */}
      <SaveLeadModal
        isOpen={showSaveLeadModal}
        onClose={() => {
          setShowSaveLeadModal(false);
          setSelectedConversationForLead(null);
        }}
        conversation={selectedConversationForLead}
        companyId={companyId}
        onSuccess={() => toast({ title: 'Lead salvo!', description: 'Contato adicionado ao banco de dados' })}
      />

      {/* Start Chatbot Modal */}
      {selectedConversation && (
        <Dialog open={activateAutomationOpen} onOpenChange={setActivateAutomationOpen}>
          <DialogContent className="sm:max-w-md rounded-2xl">
            <DialogHeader>
              <DialogTitle>Ativar automação</DialogTitle>
              <DialogDescription>
                {activateStep === 'choice'
                  ? 'O que você quer ativar nesta conversa?'
                  : 'Escolha o agente de IA que vai atender.'}
              </DialogDescription>
            </DialogHeader>
            {activateStep === 'choice' ? (
              <div className="grid gap-2">
                <button
                  type="button"
                  onClick={() => {
                    if (aiAgents.length === 1) {
                      handleAssignAgent(selectedConversation, aiAgents[0].id, true);
                      setActivateAutomationOpen(false);
                    } else if (aiAgents.length === 0) {
                      toast({ title: 'Nenhum agente de IA', description: 'Crie um agente antes de ativar.', variant: 'destructive' });
                    } else {
                      setActivateStep('agents');
                    }
                  }}
                  className="flex items-start gap-3 rounded-2xl border border-border/60 p-3 text-left hover:bg-black/[0.03] dark:hover:bg-white/[0.05] transition-colors"
                >
                  <Bot className="h-5 w-5 mt-0.5 text-primary" />
                  <span>
                    <span className="block text-sm font-medium">Agente de IA</span>
                    <span className="block text-xs text-muted-foreground">Responde livremente com base no contexto</span>
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setActivateAutomationOpen(false);
                    setShowStartChatbot(true);
                  }}
                  className="flex items-start gap-3 rounded-2xl border border-border/60 p-3 text-left hover:bg-black/[0.03] dark:hover:bg-white/[0.05] transition-colors"
                >
                  <GitBranch className="h-5 w-5 mt-0.5 text-primary" />
                  <span>
                    <span className="block text-sm font-medium">Fluxo de chatbot</span>
                    <span className="block text-xs text-muted-foreground">Segue um fluxo pré-configurado passo a passo</span>
                  </span>
                </button>
              </div>
            ) : (
              <div className="grid gap-2 max-h-[50vh] overflow-y-auto">
                {aiAgents.map(agent => (
                  <button
                    key={agent.id}
                    type="button"
                    onClick={() => {
                      handleAssignAgent(selectedConversation, agent.id, true);
                      setActivateAutomationOpen(false);
                    }}
                    className="flex items-center gap-3 rounded-2xl border border-border/60 p-3 text-left text-sm hover:bg-black/[0.03] dark:hover:bg-white/[0.05] transition-colors"
                  >
                    <Bot className="h-4 w-4 text-primary" />
                    {agent.name}
                  </button>
                ))}
              </div>
            )}
          </DialogContent>
        </Dialog>
      )}

      {selectedConversation && (
        <StartChatbotModal
          isOpen={showStartChatbot}
          onClose={() => setShowStartChatbot(false)}
          companyId={companyId}
          conversationId={selectedConversation.id}
          contactPhone={selectedConversation.contact_phone}
          contactName={selectedConversation.contact_name}
          sessionId={selectedConversation.session_id}
          onStarted={(execId, flowName) => setActiveChatbotFlow({ id: execId, name: flowName })}
        />
      )}

      <ConversationPopup
        open={showConversationPopup}
        onOpenChange={(open) => {
          setShowConversationPopup(open);
          if (!open) setPopupConversation(null);
        }}
        conversation={popupConversation}
        messages={popupMessages}
        labels={labels}
        onSendMessage={async (message) => {
          if (!popupConversation) return;
          
          // Check if demo
          if (popupConversation.is_demo || popupConversation.id.startsWith('demo-')) {
            const newMsg: WhatsAppMessage = {
              id: `demo-msg-${Date.now()}`,
              conversation_id: popupConversation.id,
              content: message,
              from_me: true,
              status: 'sent',
              created_at: new Date().toISOString()
            };
            setPopupMessages(prev => [...prev, newMsg]);
            return;
          }
          
          // Real message - find connected session
          const connectedSession = sessions.find(s => 
            s.id === popupConversation.session_id && s.status === 'connected'
          ) || sessions.find(s => s.status === 'connected');
          
          if (connectedSession) {
            // OPTIMISTIC: Add message immediately for instant feedback
            const tempId = `temp-${Date.now()}`;
            const optimisticMsg: WhatsAppMessage = {
              id: tempId,
              conversation_id: popupConversation.id,
              content: message,
              from_me: true,
              status: 'sending',
              created_at: new Date().toISOString()
            };
            setPopupMessages(prev => [...prev, optimisticMsg]);
            
            setSendingMessage(true);
            try {
              const { error, timedOut } = await invokeFunctionWithTimeout('whatsapp-api', {
                body: {
                  action: 'send_message',
                  sessionId: connectedSession.id,
                  conversationId: popupConversation.id,
                  manualTakeover: true,
                  phone: popupConversation.contact_phone,
                  message
                }
              }, 25000);

              if (timedOut) {
                toast({
                  title: 'Envio em processamento',
                  description: 'A sessão demorou para responder; a conversa será atualizada automaticamente.',
                });
                return;
              }
              
              if (error) throw error;
              
              // Update optimistic message to sent (instant - polling will sync)
              setPopupMessages(prev => prev.map(m => 
                m.id === tempId ? { ...m, status: 'sent' } : m
              ));
            } catch (e: any) {
              // Mark as failed
              setPopupMessages(prev => prev.map(m => 
                m.id === tempId ? { ...m, status: 'failed' } : m
              ));
              toast({ title: 'Erro', description: e.message, variant: 'destructive' });
            } finally {
              setSendingMessage(false);
            }
          } else {
            toast({ title: 'Atenção', description: 'Conecte um WhatsApp para enviar mensagens', variant: 'destructive' });
          }
        }}
        onManageLabels={() => {
          if (popupConversation) {
            openLabelsManager(popupConversation);
          }
        }}
        onSaveLead={() => {
          if (popupConversation) {
            openSaveLeadModal(popupConversation);
          }
        }}
        onDeleteMessage={handleDeleteMessage}
        sendingMessage={sendingMessage}
      />

      {/* Kanban Column Config */}
      <KanbanColumnConfig
        open={showColumnConfig}
        onOpenChange={setShowColumnConfig}
        columns={kanbanColumns}
        onColumnsChange={(newColumns) => {
          setKanbanColumns(newColumns);
          localStorage.setItem('whatsapp_kanban_columns', JSON.stringify(newColumns));
        }}
      />

      {/* WhatsApp QR Modal */}
      {companyId && user?.id && (
        <WhatsAppQRModal
          isOpen={showQRModal}
          onClose={() => setShowQRModal(false)}
          companyId={companyId}
          userId={user.id}
          onSuccess={handleSessionSuccess}
          existingSession={connectedSessions[0]}
        />
      )}

      {/* Conversation Context Menu */}
      <ConversationContextMenu
        isOpen={conversationContextMenu.isOpen}
        position={conversationContextMenu.position}
        conversation={conversationContextMenu.conversation}
        labels={labels}
        aiAgents={aiAgents}
        onClose={() => setConversationContextMenu(prev => ({ ...prev, isOpen: false }))}
        onManageLabels={(conv) => openLabelsManager(conv as WhatsAppConversationData)}
        onSaveLead={(conv) => openSaveLeadModal(conv as WhatsAppConversationData)}
        onArchive={(conv) => handleArchiveConversation(conv as WhatsAppConversationData)}
        onDelete={(conv) => handleDeleteConversation(conv as WhatsAppConversationData)}
        onAssignAgent={(conv, agentId) => handleAssignAgent(conv as WhatsAppConversationData, agentId)}
        onCopyPhone={(phone) => handleCopyToClipboard(phone)}
        onStartChatbot={(conv) => {
          setSelectedConversation(conv as WhatsAppConversationData);
          setShowStartChatbot(true);
        }}
        onMarkResolved={async (conv) => {
          const { error } = await supabase
            .from('whatsapp_conversations')
            .update({ status: 'closed' })
            .eq('id', conv.id);
          if (!error) {
            setConversations(prev => prev.map(c => c.id === conv.id ? { ...c, status: 'closed' } : c));
            toast({ title: 'Conversa marcada como resolvida' });
          }
        }}
      />

      <AlertDialog open={confirmCleanup} onOpenChange={(open) => !open && setConfirmCleanup(false)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Limpar sessões inativas?</AlertDialogTitle>
            <AlertDialogDescription>
              Isso irá remover <strong>{sessions.filter(s => s.status !== 'connected').length}</strong> sessão(ões) desconectada(s) e todas as suas conversas.
              Sessões conectadas não serão afetadas. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={cleaningUp}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCleanupInactiveSessions}
              disabled={cleaningUp}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {cleaningUp ? 'Limpando...' : 'Limpar todas'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirmar envio de arquivos arrastados */}
      <AlertDialog open={pendingDropFiles.length > 0} onOpenChange={(open) => { if (!open && !sendingDropped) { setPendingDropFiles([]); setDropCaption(''); } }}>
        <AlertDialogContent className="max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle>Enviar {pendingDropFiles.length} arquivo{pendingDropFiles.length > 1 ? 's' : ''}?</AlertDialogTitle>
            <AlertDialogDescription>
              Revise antes de enviar para <strong>{selectedConversation?.contact_name || selectedConversation?.contact_phone}</strong>.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="max-h-64 overflow-y-auto space-y-2 py-2">
            {pendingDropFiles.map((f, i) => {
              const isImg = f.type.startsWith('image/');
              const url = isImg ? URL.createObjectURL(f) : null;
              return (
                <div key={i} className="flex items-center gap-3 p-2 border rounded-lg bg-muted/30">
                  {isImg && url ? (
                    <img src={url} alt={f.name} className="h-12 w-12 object-cover rounded" />
                  ) : (
                    <div className="h-12 w-12 rounded bg-primary/10 flex items-center justify-center">
                      <Paperclip className="h-5 w-5 text-primary" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{f.name}</p>
                    <p className="text-xs text-muted-foreground">{(f.size / 1024).toFixed(1)} KB</p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    disabled={sendingDropped}
                    onClick={() => setPendingDropFiles(prev => prev.filter((_, idx) => idx !== i))}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              );
            })}
          </div>
          <Input
            placeholder="Adicionar legenda (opcional)"
            value={dropCaption}
            onChange={(e) => setDropCaption(e.target.value)}
            disabled={sendingDropped}
          />
          <AlertDialogFooter>
            <AlertDialogCancel disabled={sendingDropped}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={sendingDropped || pendingDropFiles.length === 0}
              onClick={async (e) => {
                e.preventDefault();
                setSendingDropped(true);
                try {
                  const files = [...pendingDropFiles];
                  for (let i = 0; i < files.length; i++) {
                    await sendFile(files[i], i === 0 ? dropCaption : '');
                  }
                  setPendingDropFiles([]);
                  setDropCaption('');
                } finally {
                  setSendingDropped(false);
                }
              }}
            >
              {sendingDropped ? 'Enviando...' : 'Enviar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Message Context Menu */}
      <MessageContextMenu
        isOpen={messageContextMenu.isOpen}
        position={messageContextMenu.position}
        messageId={messageContextMenu.messageId}
        messageContent={messageContextMenu.messageContent}
        isFromMe={messageContextMenu.isFromMe}
        onClose={() => setMessageContextMenu(prev => ({ ...prev, isOpen: false }))}
        onCopy={(content) => handleCopyToClipboard(content)}
        onDelete={(messageId) => handleDeleteMessage(messageId)}
        onScheduleMeeting={() => setShowScheduleMeetingModal(true)}
      />

      {/* Schedule Meeting Modal */}
      <ScheduleMeetingModal
        isOpen={showScheduleMeetingModal}
        onClose={() => setShowScheduleMeetingModal(false)}
        contactName={selectedConversation?.contact_name}
        contactPhone={selectedConversation?.contact_phone}
      />

      {/* Contact Profile - Mobile (full screen overlay) */}
      {showContactProfile && selectedConversation && isMobile && companyId && (
        <div className="fixed inset-0 z-50 bg-card animate-in slide-in-from-right duration-200">
          <ContactProfilePanel
            contactPhone={selectedConversation.contact_phone}
            contactName={selectedConversation.contact_name}
            profilePicture={selectedConversation.profile_picture}
            companyId={companyId}
            labels={selectedConversation.labels}
            conversationStatus={selectedConversation.status}
            createdAt={selectedConversation.last_message_at}
            onClose={() => setShowContactProfile(false)}
          />
        </div>
      )}

      {companyId && (
        <InviteAttendantDialog
          open={showInviteDialog}
          onOpenChange={setShowInviteDialog}
          companyId={companyId}
          onInvited={() => {/* invitation pending until accepted */}}
        />
      )}
    </div>
  );
};

export default WhatsAppCRM;
