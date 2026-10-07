import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
   ArrowLeft, Bot, Save, Loader2, Trash2, Upload, FileText, X,
   Settings2, MessageSquare, Brain, Zap, Shield, Send, User,
   Smile, AlertTriangle, Globe, Clock, Hash, RefreshCw, Wrench
 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import AgentMediaManager from './AgentMediaManager';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { supabase } from '@/integrations/supabase/client';
import RadialGlowOrb from '@/components/ChatBot/RadialGlowOrb';
import IntegrationTab from './IntegrationTab';
import AgentDebugChat from './AgentDebugChat';
import AgentAvatar from './AgentAvatar/AgentAvatar';
import { AGENT_STYLES, DEFAULT_AGENT_STYLE_ID, isAgentStyleId } from './AgentAvatar/agentStyles';
import {
  fetchCompanyWhatsAppSessions,
  pickDefaultSessionId,
  type WhatsAppSessionOption,
} from './whatsappSessions';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

const OMNI_COLOR = '#374DA4';

const TABS = [
  { id: 'perfil', label: 'Perfil', icon: Bot },
  { id: 'comportamento', label: 'Comportamento', icon: Brain },
  { id: 'arquivos', label: 'Arquivos', icon: FileText },
  { id: 'configuracoes', label: 'Configurações', icon: Settings2 },
  { id: 'integracoes', label: 'Integrações', icon: Zap },
    { id: 'corrigir', label: 'Corrigir', icon: Wrench },
    { id: 'conversar', label: 'Conversar', icon: MessageSquare },
 ];
const AI_MODELS = [
  { value: 'google/gemini-3-flash-preview', label: 'Gemini 3 Flash', desc: 'Rápido e eficiente', tier: 'fast' },
  { value: 'google/gemini-2.5-flash', label: 'Gemini 2.5 Flash', desc: 'Balanceado', tier: 'balanced' },
  { value: 'google/gemini-2.5-pro', label: 'Gemini 2.5 Pro', desc: 'Mais avançado', tier: 'advanced' },
  { value: 'openai/gpt-5-mini', label: 'GPT-5 Mini', desc: 'Rápido', tier: 'fast' },
  { value: 'openai/gpt-5', label: 'GPT-5', desc: 'Mais poderoso', tier: 'advanced' },
];

function getRecommendedModel(promptText: string, instructionsText: string): string {
  const combined = (promptText + ' ' + instructionsText).trim();
  const len = combined.length;
  const complexKeywords = ['analis', 'consult', 'diagnóstic', 'relatório', 'estratég', 'jurídic', 'médic', 'técnic', 'financ', 'contábil', 'audit', 'compliance'];
  const hasComplexity = complexKeywords.some(k => combined.toLowerCase().includes(k));
  
  if (len > 1500 || hasComplexity) return 'google/gemini-2.5-pro';
  if (len > 500) return 'google/gemini-2.5-flash';
  return 'google/gemini-3-flash-preview';
}

const HUMOR_OPTIONS = [
  { value: 'profissional', label: 'Profissional', emoji: '💼' },
  { value: 'amigavel', label: 'Amigável', emoji: '😊' },
  { value: 'formal', label: 'Formal', emoji: '🎩' },
  { value: 'casual', label: 'Casual', emoji: '👋' },
  { value: 'entusiasmado', label: 'Entusiasmado', emoji: '🔥' },
  { value: 'tecnico', label: 'Técnico', emoji: '⚙️' },
];

const LANGUAGE_OPTIONS = [
  { value: 'pt-BR', label: 'Português (BR)' },
  { value: 'en', label: 'English' },
  { value: 'es', label: 'Español' },
  { value: 'auto', label: 'Detectar idioma' },
];

interface TrainingFile {
  id: string;
  name: string;
  size: number;
  type: string;
  uploadedAt?: string;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

function cleanMarkdown(text: string): string {
  return text
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/#{1,6}\s?/g, '')
    .replace(/`{1,3}(.*?)`{1,3}/gs, '$1')
    .replace(/^[-*+]\s/gm, '• ')
    .trim();
}

const EditAgentPage: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState('perfil');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
   const [agentCompanyId, setAgentCompanyId] = useState('');
 
  // Form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [personality, setPersonality] = useState('');
  const [instructions, setInstructions] = useState('');
  /** Visual do agente: persistido em `settings.agentStyle` e usado em toda a UI. */
  const [agentStyle, setAgentStyle] = useState<string>(DEFAULT_AGENT_STYLE_ID);
  const [doNot, setDoNot] = useState('');
  const [model, setModel] = useState('google/gemini-3-flash-preview');
  const [isActive, setIsActive] = useState(true);
  const [humor, setHumor] = useState('profissional');
  const [language, setLanguage] = useState('pt-BR');
  const [welcomeMessage, setWelcomeMessage] = useState('');

  // Advanced settings
  const [maxResponseChars, setMaxResponseChars] = useState(2000);
  const [temperature, setTemperature] = useState(0.7);
  const [contextMemory, setContextMemory] = useState(10);
  const [responseDelay, setResponseDelay] = useState(0);
  const [splitLongMessages, setSplitLongMessages] = useState(false);
  const [audioResponseMode, setAudioResponseMode] = useState<'disabled' | 'when_audio' | 'always'>('disabled');
  const [ttsVoice, setTtsVoice] = useState('alloy');

  // Files
  const [trainingFiles, setTrainingFiles] = useState<TrainingFile[]>([]);

  // WhatsApp
  const [whatsappEnabled, setWhatsappEnabled] = useState(false);
  const [whatsappSessionId, setWhatsappSessionId] = useState('');
  const [whatsappSessions, setWhatsappSessions] = useState<WhatsAppSessionOption[]>([]);

  // Chat
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
   const [aiImprovingField, setAiImprovingField] = useState<string | null>(null);
 

  useEffect(() => {
    if (id) {
      loadAgent();
    }
  }, [id]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  const markChanged = () => { if (!hasChanges) setHasChanges(true); };

  const improveWithAI = async (fieldName: string, currentText: string, setter: (v: string) => void, context: string) => {
    if (!currentText.trim()) {
      toast({ title: 'Campo vazio', description: 'Escreva algo primeiro para melhorar com IA', variant: 'destructive' });
      return;
    }
    setAiImprovingField(fieldName);
    try {
      const { data, error } = await supabase.functions.invoke('ai-chat', {
        body: {
          messages: [
            {
              role: 'system',
              content: `Você é um especialista em criação de agentes de IA e chatbots. Sua tarefa é melhorar o texto fornecido pelo usuário para o campo "${context}" de um agente de IA. Melhore o texto tornando-o mais claro, profissional, detalhado e eficaz. Mantenha a essência e intenção original. Retorne APENAS o texto melhorado, sem explicações ou comentários adicionais.`
            },
            {
              role: 'user',
              content: `Melhore este texto para o campo "${context}" de um agente de IA:\n\n${currentText}`
            }
          ]
        }
      });
      if (error) throw error;
      const improved = data?.response || data?.message || '';
      if (improved.trim()) {
        setter(improved.trim());
        markChanged();
        toast({ title: 'Texto melhorado!', description: 'O texto foi aprimorado pela IA' });
      }
    } catch (e: any) {
      console.error('AI improve error:', e);
      toast({ title: 'Erro', description: 'Não foi possível melhorar o texto. Tente novamente.', variant: 'destructive' });
    } finally {
      setAiImprovingField(null);
    }
  };

  const loadAgent = async () => {
    try {
      const { data, error } = await supabase
        .from('ai_agents')
        .select('*')
        .eq('id', id!)
        .single();

      if (error || !data) throw error || new Error('Agente não encontrado');

      const settings = data.settings as any;
      setAgentCompanyId(data.company_id);
      void loadWhatsappSessions(data.company_id);
      setName(data.name);
      setDescription(data.description || '');
      setPersonality(data.personality);
      setInstructions(data.instructions);
      setModel(data.model || 'google/gemini-3-flash-preview');
      setIsActive(data.is_active ?? true);
      setWhatsappEnabled(data.whatsapp_enabled || false);
      setWhatsappSessionId(data.whatsapp_session_id || '');
      setMaxResponseChars(settings?.maxResponseChars || 2000);
      setTemperature(settings?.temperature || 0.7);
      setContextMemory(settings?.contextMemory || 10);
      setTrainingFiles(settings?.trainingFiles || []);
      setAgentStyle(isAgentStyleId(settings?.agentStyle) ? settings.agentStyle : DEFAULT_AGENT_STYLE_ID);
      setDoNot(settings?.doNot || '');
      setHumor(settings?.humor || 'profissional');
      setLanguage(settings?.language || 'pt-BR');
      setWelcomeMessage(settings?.welcomeMessage || '');
      setResponseDelay(settings?.responseDelay || 0);
      setSplitLongMessages(settings?.splitLongMessages || false);
      setAudioResponseMode(settings?.audioResponseMode || 'disabled');
       setTtsVoice(settings?.ttsVoice || 'alloy');
 

      // Init chat
      setChatMessages([{
        id: '1',
        role: 'assistant',
        content: `Olá! Eu sou ${data.name}. ${data.description || 'Como posso ajudá-lo hoje?'}`,
        timestamp: new Date()
      }]);
    } catch (e: any) {
      toast({ title: 'Erro', description: 'Agente não encontrado', variant: 'destructive' });
      navigate('/dashboard/bot-ia');
    } finally {
      setLoading(false);
    }
  };

  /** Números da empresa do agente, com os conectados primeiro. */
  const loadWhatsappSessions = async (companyId: string | null) => {
    const list = await fetchCompanyWhatsAppSessions(companyId);
    setWhatsappSessions(list);
    setWhatsappSessionId((current) => pickDefaultSessionId(list, current));
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const file = files[0];
    const allowedTypes = ['text/plain', 'application/pdf', 'application/json', 'text/csv', 'text/markdown'];
    if (!allowedTypes.includes(file.type)) {
      toast({ title: 'Tipo inválido', description: 'Aceitos: TXT, PDF, JSON, CSV, MD', variant: 'destructive' });
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast({ title: 'Arquivo muito grande', description: 'Máximo 10MB', variant: 'destructive' });
      return;
    }
    setTrainingFiles(prev => [...prev, {
      id: Math.random().toString(36).substring(7),
      name: file.name,
      size: file.size,
      type: file.type,
      uploadedAt: new Date().toISOString(),
    }]);
    markChanged();
    toast({ title: 'Arquivo adicionado', description: file.name });
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const handleSave = async () => {
    if (!name || !personality || !instructions) {
      toast({ title: 'Erro', description: 'Preencha os campos obrigatórios: Nome, Personalidade e Instruções', variant: 'destructive' });
      return;
    }
    // Sem o número escolhido o webhook não tem como entregar as mensagens ao
    // agente — salvar assim deixaria o agente mudo sem ninguém entender por quê.
    if (whatsappEnabled && !whatsappSessionId) {
      toast({
        title: 'Escolha o número do WhatsApp',
        description: 'Na Ativação no WhatsApp, selecione o número conectado para o agente responder.',
        variant: 'destructive',
      });
      return;
    }
    setSaving(true);
    try {
      const fullInstructions = doNot
        ? `${instructions}\n\nO QUE NÃO FAZER:\n${doNot}`
        : instructions;

      const { error } = await supabase
        .from('ai_agents')
        .update({
          name,
          description,
          personality,
          instructions: fullInstructions,
          model,
          is_active: isActive,
          whatsapp_enabled: whatsappEnabled,
          whatsapp_session_id: whatsappEnabled && whatsappSessionId ? whatsappSessionId : null,
          settings: {
            // Preservado sempre: e o que faz a lista e o chat manterem o visual
            // escolhido depois de editar o agente.
            agentStyle,
            maxResponseChars,
            temperature,
            contextMemory,
            trainingFiles: trainingFiles.map(f => ({ id: f.id, name: f.name, size: f.size, type: f.type, uploadedAt: f.uploadedAt })),
            doNot,
            humor,
            language,
            welcomeMessage,
            responseDelay,
            splitLongMessages,
            audioResponseMode,
            ttsVoice,
          }
        })
        .eq('id', id!);

       if (error) throw error;
       setHasChanges(false);
      toast({ title: 'Sucesso', description: 'Agente atualizado!' });
    } catch (e: any) {
      toast({ title: 'Erro', description: e.message || 'Erro ao atualizar', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    try {
      const { error } = await supabase.from('ai_agents').delete().eq('id', id!);
      if (error) throw error;
      toast({ title: 'Sucesso', description: 'Agente excluído' });
      navigate('/dashboard/bot-ia');
    } catch (e: any) {
      toast({ title: 'Erro', description: e.message, variant: 'destructive' });
    }
  };

  const sendChatMessage = async () => {
    if (!chatInput.trim() || chatLoading) return;
    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: chatInput.trim(),
      timestamp: new Date(),
    };
    setChatMessages(prev => [...prev, userMsg]);
    setChatInput('');
    setChatLoading(true);

    try {
      const chatUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-chat`;
      const resp = await fetch(chatUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          messages: chatMessages
            .filter(m => m.id !== '1')
            .concat(userMsg)
            .map(m => ({ role: m.role, content: m.content })),
          agentId: id,
        }),
      });

      if (!resp.ok || !resp.body) throw new Error('Erro na resposta');

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let assistantContent = '';
      let textBuffer = '';

      const assistantId = Date.now().toString() + '-ai';
      setChatMessages(prev => [...prev, { id: assistantId, role: 'assistant', content: '', timestamp: new Date() }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        textBuffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = textBuffer.indexOf('\n')) !== -1) {
          let line = textBuffer.slice(0, newlineIndex);
          textBuffer = textBuffer.slice(newlineIndex + 1);
          if (line.endsWith('\r')) line = line.slice(0, -1);
          if (!line.startsWith('data: ')) continue;
          const jsonStr = line.slice(6).trim();
          if (jsonStr === '[DONE]') break;
          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              assistantContent += content;
              const cleaned = cleanMarkdown(assistantContent);
              setChatMessages(prev =>
                prev.map(m => m.id === assistantId ? { ...m, content: cleaned } : m)
              );
            }
          } catch { /* partial json */ }
        }
      }
    } catch (e) {
      console.error('Chat error:', e);
      toast({ title: 'Erro', description: 'Falha ao enviar mensagem', variant: 'destructive' });
    } finally {
      setChatLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-full bg-background">
      {/* Top Header */}
      <div className="bg-card/80 backdrop-blur-xl border-b border-border sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-3 sm:px-6 py-2.5 sm:py-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
            <Button variant="ghost" size="icon" className="rounded-full shrink-0 h-9 w-9 sm:h-10 sm:w-10" onClick={() => navigate('/dashboard/bot-ia')}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex items-center gap-2 sm:gap-3 min-w-0">
              <AgentAvatar styleId={agentStyle} size={40} className="shrink-0" />
              <div className="min-w-0">
                <h1 className="text-sm sm:text-lg font-bold text-foreground leading-tight truncate">{name}</h1>
                <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                  <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider backdrop-blur-md ${
                    isActive
                      ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                      : 'bg-muted text-muted-foreground border border-border'
                  }`}>
                    <div className={`h-1.5 w-1.5 rounded-full ${isActive ? 'bg-emerald-500 animate-pulse' : 'bg-muted-foreground'}`} />
                    {isActive ? 'Online' : 'Offline'}
                  </div>
                  {hasChanges && (
                    <div className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 backdrop-blur-md hidden sm:block">
                      Alterações não salvas
                    </div>
                  )}
                  {hasChanges && (
                    <div className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse sm:hidden" title="Alterações não salvas" />
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-muted/40 border border-border">
              <span className="text-xs font-medium text-muted-foreground">Ativo</span>
              <Switch checked={isActive} onCheckedChange={(v) => { setIsActive(v); markChanged(); }} />
            </div>
            <Switch className="sm:hidden" checked={isActive} onCheckedChange={(v) => { setIsActive(v); markChanged(); }} />
            <Button
              onClick={handleSave}
              disabled={saving}
              size="sm"
              className="rounded-full text-white gap-2 px-3 sm:px-5 h-9 sm:h-10 shadow-lg shadow-[#374DA4]/20 hover:shadow-[#374DA4]/30 transition-all font-semibold"
              style={{ backgroundColor: OMNI_COLOR }}
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              <span className="hidden sm:inline">Salvar</span>
            </Button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="max-w-6xl mx-auto px-3 sm:px-6 pb-2.5 sm:pb-3">
          <div className="flex gap-1 overflow-x-auto scrollbar-none p-1 rounded-full bg-[#374DA4]/5 dark:bg-white/5 border border-[#374DA4]/10 dark:border-white/10 backdrop-blur-md w-full sm:w-fit sm:max-w-full">
            {TABS.map(tab => {
              const Icon = tab.icon;
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-1.5 px-3 sm:px-4 py-2 text-xs sm:text-sm font-semibold rounded-full transition-all whitespace-nowrap shrink-0 ${
                    active
                      ? 'bg-[#374DA4] text-white shadow-md shadow-[#374DA4]/20'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className={active ? 'inline' : 'hidden sm:inline'}>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Tab Content */}
      <div className="max-w-4xl mx-auto px-3 sm:px-6 py-4 sm:py-6">
        {/* PERFIL TAB */}
        {activeTab === 'perfil' && (
          <div className="space-y-6">
            {/* Ativação no WhatsApp: é o que faz o agente responder de verdade. */}
            <Card className="rounded-2xl border-border">
              <CardContent className="p-4 sm:p-6 space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <Label className="text-sm font-medium text-foreground/90">
                      Ativação no WhatsApp
                    </Label>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Com isso ligado, o agente responde sozinho as mensagens que chegam no número
                      escolhido.
                    </p>
                  </div>
                  <Switch
                    checked={whatsappEnabled}
                    onCheckedChange={(v) => {
                      setWhatsappEnabled(v);
                      markChanged();
                    }}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Número do WhatsApp</Label>
                  <Select
                    value={whatsappSessionId || 'none'}
                    onValueChange={(v) => {
                      setWhatsappSessionId(v === 'none' ? '' : v);
                      markChanged();
                    }}
                    disabled={whatsappSessions.length === 0}
                  >
                    <SelectTrigger className="rounded-xl" aria-label="Número do WhatsApp do agente">
                      <SelectValue placeholder="Escolha o número conectado" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Nenhum número</SelectItem>
                      {whatsappSessions.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {whatsappSessions.length === 0 ? (
                  <p className="text-[11px] text-muted-foreground">
                    Nenhum WhatsApp nesta empresa. Conecte um número em API WhatsApp para o agente
                    poder responder.
                  </p>
                ) : !whatsappSessions.some((s) => s.connected) ? (
                  <p className="text-[11px] text-amber-600 dark:text-amber-400">
                    Nenhum número conectado agora — reconecte o WhatsApp para o agente voltar a
                    responder.
                  </p>
                ) : whatsappEnabled && !whatsappSessionId ? (
                  <p className="text-[11px] text-amber-600 dark:text-amber-400">
                    Escolha o número acima para o agente receber as mensagens.
                  </p>
                ) : whatsappEnabled ? (
                  <p className="text-[11px] text-emerald-600 dark:text-emerald-400">
                    O agente responde automaticamente nesse número.
                  </p>
                ) : null}
              </CardContent>
            </Card>

            <Card className="rounded-2xl border-border">
              <CardContent className="p-4 sm:p-6 space-y-5">
                <div>
                  <Label className="text-sm font-medium text-foreground/90">Visual do Agente</Label>
                  <p className="text-xs text-muted-foreground mb-3">
                    O avatar escolhido acompanha o agente na lista, no chat e aqui.
                  </p>
                  <div
                    role="radiogroup"
                    aria-label="Visual do agente"
                    className="grid grid-cols-3 sm:grid-cols-5 gap-2"
                  >
                    {AGENT_STYLES.map((style) => {
                      const selected = style.id === agentStyle;
                      return (
                        <button
                          key={style.id}
                          type="button"
                          role="radio"
                          aria-checked={selected}
                          onClick={() => { setAgentStyle(style.id); markChanged(); }}
                          className={`rounded-2xl border p-2 flex flex-col items-center gap-0.5 transition-all ${
                            selected ? 'border-2 bg-[#F0F2FE] dark:bg-white/5' : 'border-border hover:border-gray-300'
                          }`}
                          style={selected ? { borderColor: OMNI_COLOR } : {}}
                        >
                          <AgentAvatar styleId={style.id} size={64} paused={!selected} />
                          <span className="text-[11px] font-semibold text-foreground text-center leading-tight">
                            {style.name}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <Label className="text-sm font-medium text-foreground/90">Nome do Agente *</Label>
                  <Input value={name} onChange={(e) => { setName(e.target.value); markChanged(); }} placeholder="Ex: Assistente de Vendas" className="mt-1.5 rounded-xl h-11" />
                </div>

                <div>
                  <Label className="text-sm font-medium text-foreground/90">Descrição</Label>
                  <Textarea value={description} onChange={(e) => { setDescription(e.target.value); markChanged(); }} placeholder="Breve descrição do agente..." className="mt-1.5 rounded-xl min-h-[80px]" />
                </div>

                <div>
                  <Label className="text-sm font-medium text-foreground/90">Modelo de IA</Label>
                  {(() => {
                    const recommended = getRecommendedModel(personality, instructions);
                    const recommendedLabel = AI_MODELS.find(m => m.value === recommended)?.label;
                    return recommended !== model ? (
                      <div className="mt-1 mb-2 flex items-center gap-2">
                        <Badge className="bg-[#DFE4FB] text-[#253573] text-[10px] gap-1">
                          <RadialGlowOrb size={12} />
                          Recomendado: {recommendedLabel}
                        </Badge>
                        <button
                          onClick={() => { setModel(recommended); markChanged(); }}
                          className="text-[11px] text-[#2F428D] hover:underline"
                        >
                          Usar recomendado
                        </button>
                      </div>
                    ) : (
                      <div className="mt-1 mb-2">
                        <Badge className="bg-green-100 text-green-700 text-[10px] gap-1">
                          ✓ Modelo ideal para seu prompt
                        </Badge>
                      </div>
                    );
                  })()}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {AI_MODELS.map(m => {
                      const isRecommended = m.value === getRecommendedModel(personality, instructions);
                      return (
                        <button
                          key={m.value}
                          onClick={() => { setModel(m.value); markChanged(); }}
                          className={`p-3 rounded-xl border text-left transition-all relative ${
                            model === m.value
                              ? 'border-2 bg-[#F0F2FE]'
                              : 'border-border hover:border-border'
                          }`}
                          style={model === m.value ? { borderColor: OMNI_COLOR } : {}}
                        >
                          <p className="text-sm font-medium text-foreground">
                            {m.label}
                            {isRecommended && model !== m.value && (
                              <span className="ml-1.5 text-[10px] text-[#374DA4] font-normal">★ recomendado</span>
                            )}
                          </p>
                          <p className="text-xs text-muted-foreground">{m.desc}</p>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <div>
                      <Label className="text-sm font-medium text-foreground/90">Mensagem de Boas-vindas</Label>
                      <p className="text-xs text-muted-foreground">Primeira mensagem que o agente envia ao iniciar uma conversa</p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => improveWithAI('welcome', welcomeMessage, setWelcomeMessage, 'Mensagem de Boas-vindas')}
                      disabled={aiImprovingField === 'welcome' || !welcomeMessage.trim()}
                      className="gap-1.5 text-xs"
                    >
                      {aiImprovingField === 'welcome' ? (
                        <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Melhorando...</>
                      ) : (
                        <><RadialGlowOrb size={14} /> Melhorar com IA</>
                      )}
                    </Button>
                  </div>
                  <Textarea
                    value={welcomeMessage}
                    onChange={(e) => { setWelcomeMessage(e.target.value); markChanged(); }}
                    placeholder="Ex: Olá! 👋 Sou o assistente da empresa. Como posso ajudar?"
                    className="rounded-xl min-h-[60px]"
                  />
                </div>

                <div>
                  <Label className="text-sm font-medium text-foreground/90">Idioma Principal</Label>
                  <Select value={language} onValueChange={(v) => { setLanguage(v); markChanged(); }}>
                    <SelectTrigger className="mt-1.5 rounded-xl h-11">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {LANGUAGE_OPTIONS.map(l => (
                        <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* COMPORTAMENTO TAB */}
        {activeTab === 'comportamento' && (
          <div className="space-y-6">
            <Card className="rounded-2xl border-border">
              <CardContent className="p-4 sm:p-6 space-y-5">
                <div>
                  <Label className="text-sm font-medium text-foreground/90">Tom de Voz / Humor</Label>
                  <p className="text-xs text-muted-foreground mb-2">Escolha o estilo de comunicação do agente</p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {HUMOR_OPTIONS.map(h => (
                      <button
                        key={h.value}
                        onClick={() => { setHumor(h.value); markChanged(); }}
                        className={`flex items-center gap-2 p-3 rounded-xl border text-left transition-all ${
                          humor === h.value
                            ? 'border-2 bg-[#F0F2FE]'
                            : 'border-border hover:border-border'
                        }`}
                        style={humor === h.value ? { borderColor: OMNI_COLOR } : {}}
                      >
                        <span className="text-lg">{h.emoji}</span>
                        <span className="text-sm font-medium text-foreground/90">{h.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <div>
                      <Label className="text-sm font-medium text-foreground/90">Personalidade *</Label>
                      <p className="text-xs text-muted-foreground">Defina o tom e estilo de comunicação em detalhe</p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => improveWithAI('personality', personality, setPersonality, 'Personalidade')}
                      disabled={aiImprovingField === 'personality' || !personality.trim()}
                      className="gap-1.5 text-xs"
                    >
                      {aiImprovingField === 'personality' ? (
                        <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Melhorando...</>
                      ) : (
                        <><RadialGlowOrb size={14} /> Melhorar com IA</>
                      )}
                    </Button>
                  </div>
                  <Textarea
                    value={personality}
                    onChange={(e) => { setPersonality(e.target.value); markChanged(); }}
                    placeholder="Ex: Profissional, empático, objetivo e sempre oferece soluções..."
                    className="rounded-xl min-h-[100px]"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <div>
                      <Label className="text-sm font-medium text-foreground/90">Prompt / Instruções *</Label>
                      <p className="text-xs text-muted-foreground">Descreva detalhadamente como o agente deve se comportar</p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => improveWithAI('instructions', instructions, setInstructions, 'Instruções/Prompt')}
                      disabled={aiImprovingField === 'instructions' || !instructions.trim()}
                      className="gap-1.5 text-xs"
                    >
                      {aiImprovingField === 'instructions' ? (
                        <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Melhorando...</>
                      ) : (
                        <><RadialGlowOrb size={14} /> Melhorar com IA</>
                      )}
                    </Button>
                  </div>
                  <Textarea
                    value={instructions}
                    onChange={(e) => { setInstructions(e.target.value); markChanged(); }}
                    placeholder="Você é um assistente especializado em vendas. Sempre cumprimente o cliente..."
                    className="rounded-xl min-h-[180px] font-mono text-sm"
                  />
                  <div className="flex justify-end mt-1">
                    <span className="text-xs text-muted-foreground">{instructions.length} caracteres</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-2xl border-border">
              <CardContent className="p-4 sm:p-6 space-y-5">
                <div className="flex items-center gap-2">
                  <Shield className="h-4 w-4 text-red-500" />
                  <Label className="text-base font-semibold text-foreground">Restrições e Limites</Label>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <div>
                      <Label className="text-sm font-medium text-foreground/90">O que NÃO fazer</Label>
                      <p className="text-xs text-muted-foreground">Defina o que o agente nunca deve fazer ou falar</p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => improveWithAI('doNot', doNot, setDoNot, 'Restrições e Limites')}
                      disabled={aiImprovingField === 'doNot' || !doNot.trim()}
                      className="gap-1.5 text-xs"
                    >
                      {aiImprovingField === 'doNot' ? (
                        <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Melhorando...</>
                      ) : (
                        <><RadialGlowOrb size={14} /> Melhorar com IA</>
                      )}
                    </Button>
                  </div>
                  <Textarea
                    value={doNot}
                    onChange={(e) => { setDoNot(e.target.value); markChanged(); }}
                    placeholder="Não falar sobre concorrentes, não inventar preços, não prometer prazos impossíveis, não compartilhar dados pessoais de clientes..."
                    className="rounded-xl min-h-[120px] border-red-200 focus:border-red-300"
                  />
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* ARQUIVOS TAB */}
        {activeTab === 'arquivos' && (
          <div className="space-y-6">
            {/* Mídia do Agente - fotos para enviar no WhatsApp */}
            {id && agentCompanyId && (
              <AgentMediaManager agentId={id} companyId={agentCompanyId} />
            )}

            <Card className="rounded-2xl border-border">
              <CardContent className="p-4 sm:p-6 space-y-5">
                <div>
                  <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
                    <FileText className="h-4 w-4" style={{ color: OMNI_COLOR }} />
                    Base de Conhecimento
                  </h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    Adicione arquivos para o agente estudar e usar como referência nas respostas. Quanto mais contexto, melhores as respostas.
                  </p>
                </div>

                {trainingFiles.length > 0 ? (
                  <div className="space-y-2">
                    {trainingFiles.map(file => (
                      <div key={file.id} className="flex items-center justify-between p-3 bg-muted/40 rounded-xl border border-border">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-[#F0F2FE] flex items-center justify-center">
                            <FileText className="h-5 w-5 text-[#374DA4]" />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-foreground">{file.name}</p>
                            <p className="text-xs text-muted-foreground">{formatFileSize(file.size)} • {file.uploadedAt ? new Date(file.uploadedAt).toLocaleDateString('pt-BR') : ''}</p>
                          </div>
                        </div>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-red-500" onClick={() => { setTrainingFiles(prev => prev.filter(f => f.id !== file.id)); markChanged(); }}>
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12 border-2 border-dashed border-border rounded-2xl">
                    <Upload className="h-10 w-10 text-gray-300 mx-auto mb-3" />
                    <p className="text-sm font-medium text-muted-foreground">Nenhum arquivo adicionado</p>
                    <p className="text-xs text-muted-foreground mt-1">Arraste arquivos ou clique para adicionar</p>
                  </div>
                )}

                <div className="flex justify-center">
                  <Label htmlFor="edit-file-upload-v2" className="cursor-pointer">
                    <div className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-white text-sm font-medium transition-all hover:opacity-90" style={{ backgroundColor: OMNI_COLOR }}>
                      <Upload className="h-4 w-4" />
                      Adicionar Arquivo
                    </div>
                    <input id="edit-file-upload-v2" type="file" accept=".txt,.pdf,.json,.csv,.md" onChange={handleFileUpload} className="hidden" />
                  </Label>
                </div>
                <p className="text-xs text-muted-foreground text-center">Aceitos: TXT, PDF, JSON, CSV, MD (máx. 10MB cada)</p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* CONFIGURAÇÕES TAB */}
        {activeTab === 'configuracoes' && (
          <div className="space-y-6">
            <Card className="rounded-2xl border-border">
              <CardContent className="p-4 sm:p-6 space-y-6">
                <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
                  <Settings2 className="h-4 w-4" style={{ color: OMNI_COLOR }} />
                  Parâmetros do Modelo
                </h2>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <Label className="text-sm text-foreground/90">Limite de caracteres por resposta</Label>
                      <p className="text-xs text-muted-foreground">Controla o tamanho máximo das respostas</p>
                    </div>
                    <Badge variant="outline" className="font-mono">{maxResponseChars}</Badge>
                  </div>
                  <Slider value={[maxResponseChars]} onValueChange={([v]) => { setMaxResponseChars(v); markChanged(); }} min={100} max={10000} step={100} className="[&_[role=slider]]:border-gray-400 [&_[role=slider]]:bg-white [&>span:first-child>span]:bg-gray-400 [&>span:first-child]:bg-gray-200" />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <Label className="text-sm text-foreground/90">Temperatura (Criatividade)</Label>
                      <p className="text-xs text-muted-foreground">0 = preciso e factual, 1 = criativo e variado</p>
                    </div>
                    <Badge variant="outline" className="font-mono">{temperature.toFixed(1)}</Badge>
                  </div>
                  <Slider value={[temperature * 100]} onValueChange={([v]) => { setTemperature(v / 100); markChanged(); }} min={0} max={100} step={10} className="[&_[role=slider]]:border-gray-400 [&_[role=slider]]:bg-white [&>span:first-child>span]:bg-gray-400 [&>span:first-child]:bg-gray-200" />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <Label className="text-sm text-foreground/90">Memória de Contexto</Label>
                      <p className="text-xs text-muted-foreground">Quantidade de mensagens que o agente lembra</p>
                    </div>
                    <Badge variant="outline" className="font-mono">{contextMemory} msgs</Badge>
                  </div>
                  <Slider value={[contextMemory]} onValueChange={([v]) => { setContextMemory(v); markChanged(); }} min={1} max={50} step={1} className="[&_[role=slider]]:border-gray-400 [&_[role=slider]]:bg-white [&>span:first-child>span]:bg-gray-400 [&>span:first-child]:bg-gray-200" />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <Label className="text-sm text-foreground/90">Atraso na Resposta (segundos)</Label>
                      <p className="text-xs text-muted-foreground">Simula tempo de digitação humana</p>
                    </div>
                    <Badge variant="outline" className="font-mono">{responseDelay}s</Badge>
                  </div>
                  <Slider value={[responseDelay]} onValueChange={([v]) => { setResponseDelay(v); markChanged(); }} min={0} max={10} step={1} className="[&_[role=slider]]:border-gray-400 [&_[role=slider]]:bg-white [&>span:first-child>span]:bg-gray-400 [&>span:first-child]:bg-gray-200" />
                </div>

                <div className="flex items-center justify-between py-2">
                  <div>
                    <Label className="text-sm text-foreground/90">Dividir mensagens longas</Label>
                    <p className="text-xs text-muted-foreground">Separa respostas grandes em múltiplas mensagens</p>
                  </div>
                  <Switch checked={splitLongMessages} onCheckedChange={(v) => { setSplitLongMessages(v); markChanged(); }} />
                </div>
              </CardContent>
            </Card>

            {/* Audio Response Settings */}
            <Card className="rounded-2xl border-border">
              <CardContent className="p-4 sm:p-6 space-y-5">
                <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
                  🎙️ Resposta por Áudio
                </h2>
                <p className="text-xs text-muted-foreground -mt-3">Configure quando o agente deve responder com áudio no WhatsApp</p>

                <div>
                  <Label className="text-sm font-medium text-foreground/90">Modo de Resposta por Áudio</Label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-2">
                    {([
                      { value: 'disabled', label: 'Desativado', desc: 'Apenas texto', emoji: '💬' },
                      { value: 'when_audio', label: 'Quando receber áudio', desc: 'Responde áudio com áudio', emoji: '🎤' },
                      { value: 'always', label: 'Sempre', desc: 'Todas respostas em áudio', emoji: '🔊' },
                    ] as const).map(opt => (
                      <button
                        key={opt.value}
                        onClick={() => { setAudioResponseMode(opt.value); markChanged(); }}
                        className={`p-3 rounded-xl border text-left transition-all ${
                          audioResponseMode === opt.value
                            ? 'border-2 bg-[#F0F2FE]'
                            : 'border-border hover:border-border'
                        }`}
                        style={audioResponseMode === opt.value ? { borderColor: OMNI_COLOR } : {}}
                      >
                        <span className="text-lg">{opt.emoji}</span>
                        <p className="text-sm font-medium text-foreground mt-1">{opt.label}</p>
                        <p className="text-xs text-muted-foreground">{opt.desc}</p>
                      </button>
                    ))}
                  </div>
                </div>

                {audioResponseMode !== 'disabled' && (
                  <div>
                    <Label className="text-sm font-medium text-foreground/90">Voz</Label>
                    <p className="text-xs text-muted-foreground mb-2">Escolha a voz para as respostas em áudio</p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {[
                        { value: 'ello', label: '⭐ Ello', desc: 'Voz Ellosuit (ElevenLabs)' },
                        { value: 'alloy', label: 'Alloy', desc: 'Neutra e versátil' },
                        { value: 'echo', label: 'Echo', desc: 'Masculina suave' },
                        { value: 'fable', label: 'Fable', desc: 'Expressiva' },
                        { value: 'onyx', label: 'Onyx', desc: 'Masculina grave' },
                        { value: 'nova', label: 'Nova', desc: 'Feminina jovem' },
                        { value: 'shimmer', label: 'Shimmer', desc: 'Feminina clara' },
                      ].map(v => (
                        <button
                          key={v.value}
                          onClick={() => { setTtsVoice(v.value); markChanged(); }}
                          className={`p-2.5 rounded-xl border text-left transition-all ${
                            ttsVoice === v.value
                              ? 'border-2 bg-[#F0F2FE]'
                              : 'border-border hover:border-border'
                          }`}
                          style={ttsVoice === v.value ? { borderColor: OMNI_COLOR } : {}}
                        >
                          <p className="text-sm font-medium text-foreground">{v.label}</p>
                          <p className="text-xs text-muted-foreground">{v.desc}</p>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Danger Zone */}
            <Card className="rounded-2xl border-red-200">
              <CardContent className="p-4 sm:p-6 space-y-3">
                <h2 className="text-base font-semibold text-red-600 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" />
                  Zona de Perigo
                </h2>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" size="sm" className="w-full rounded-xl">
                      <Trash2 className="h-4 w-4 mr-2" />
                      Excluir Agente Permanentemente
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Excluir "{name}"?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Esta ação não pode ser desfeita. O agente e todo o histórico serão permanentemente excluídos.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">Excluir</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </CardContent>
            </Card>
          </div>
        )}

         {/* INTEGRAÇÕES TAB */}
         {activeTab === 'integracoes' && (
           <IntegrationTab agentId={id!} agentName={name} />
         )}
 

        {/* CONVERSAR TAB */}
        {activeTab === 'conversar' && (
          <Card className="rounded-2xl border-border overflow-hidden">
            <CardContent className="p-0 flex flex-col" style={{ height: 'calc(100vh - 220px)' }}>
              {/* Chat Header */}
              <div className="px-4 py-3 border-b bg-muted/40 flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold" style={{ backgroundColor: OMNI_COLOR }}>
                  {name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">{name}</p>
                  <p className="text-xs text-muted-foreground">Teste em tempo real — alterações salvas serão refletidas</p>
                </div>
              </div>

              {/* Messages */}
              <ScrollArea className="flex-1 px-4 py-4">
                <div className="space-y-4 max-w-2xl mx-auto">
                  {chatMessages.map(msg => (
                    <div key={msg.id} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                        msg.role === 'user' ? 'bg-gray-200' : ''
                      }`} style={msg.role === 'assistant' ? { backgroundColor: OMNI_COLOR } : {}}>
                        {msg.role === 'user'
                          ? <User className="h-4 w-4 text-muted-foreground" />
                          : <Bot className="h-4 w-4 text-white" />
                        }
                      </div>
                      <div className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm ${
                        msg.role === 'user'
                          ? 'bg-muted text-foreground'
                          : 'bg-[#F0F2FE] text-foreground border border-[#DFE4FB]'
                      }`}>
                        {msg.content || <Loader2 className="h-4 w-4 animate-spin" />}
                      </div>
                    </div>
                  ))}
                  <div ref={chatEndRef} />
                </div>
              </ScrollArea>

              {/* Input */}
              <div className="px-4 py-3 border-t bg-white">
                <form
                  onSubmit={(e) => { e.preventDefault(); sendChatMessage(); }}
                  className="flex gap-2 max-w-2xl mx-auto"
                >
                  <Input
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    placeholder="Digite uma mensagem para testar..."
                    className="rounded-xl h-11"
                    disabled={chatLoading}
                  />
                  <Button
                    type="submit"
                    disabled={chatLoading || !chatInput.trim()}
                    className="rounded-xl h-11 px-4 text-white"
                    style={{ backgroundColor: OMNI_COLOR }}
                  >
                    {chatLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  </Button>
                </form>
              </div>
            </CardContent>
          </Card>
        )}

        {/* CORRIGIR TAB */}
        {activeTab === 'corrigir' && (
          <AgentDebugChat
            agentName={name}
            currentInstructions={instructions}
            currentPersonality={personality}
            currentDoNot={doNot}
            onApplySuggestion={(field, newValue) => {
              if (field === 'instructions') setInstructions(newValue);
              else if (field === 'personality') setPersonality(newValue);
              else if (field === 'doNot') setDoNot(newValue);
              markChanged();
            }}
          />
        )}
      </div>
    </div>
  );
};

export default EditAgentPage;
