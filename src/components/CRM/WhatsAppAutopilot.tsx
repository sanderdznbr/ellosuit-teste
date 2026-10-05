import React, { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Bot, Sparkles, Mic, PhoneCall, BookOpen, Activity,
  Loader2, Save, CheckCircle2, AlertCircle, Radio, Power,
  Brain, Zap, Wand2, MessageSquare, User, ArrowRight, Clock,
} from 'lucide-react';

interface Props {
  companyId: string;
}

interface Config {
  id?: string;
  is_active: boolean;
  objective: string;
  personality: string;
  tone_preset: string;
  max_chars: number;
  allow_audio: boolean;
  send_hour_start: number;
  send_hour_end: number;
  max_msgs_per_hour_per_contact: number;
  voice_id: string | null;
  voice_status: string;
  parent_phone: string | null;
  parent_session_id: string | null;
  confidence_threshold: number;
  parent_timeout_minutes: number;
  parent_fallback_behavior: string;
  learning_enabled: boolean;
  auto_configure: boolean;
  learned_prompt: string | null;
  writing_style_summary: string | null;
  avg_msgs_per_turn: number;
  last_self_config_at: string | null;
}

const DEFAULT: Config = {
  is_active: false,
  objective: '',
  personality: '',
  tone_preset: 'cordial',
  max_chars: 500,
  allow_audio: false,
  send_hour_start: 8,
  send_hour_end: 20,
  max_msgs_per_hour_per_contact: 4,
  voice_id: null,
  voice_status: 'none',
  parent_phone: null,
  parent_session_id: null,
  confidence_threshold: 0.7,
  parent_timeout_minutes: 30,
  parent_fallback_behavior: 'wait',
  learning_enabled: true,
  auto_configure: true,
  learned_prompt: null,
  writing_style_summary: null,
  avg_msgs_per_turn: 1,
  last_self_config_at: null,
};

const WhatsAppAutopilot: React.FC<Props> = ({ companyId }) => {
  const { toast } = useToast();
  const [cfg, setCfg] = useState<Config>(DEFAULT);
  const [stats, setStats] = useState({ totalConvs: 0, voiceSamples: 0, styleItems: 0, availableAudios: 0 });
  const [sessions, setSessions] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [cloning, setCloning] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [selfConfiguring, setSelfConfiguring] = useState(false);
  const [savingLearning, setSavingLearning] = useState(false);
  const [validatingParent, setValidatingParent] = useState(false);
  const [parentPhoneInput, setParentPhoneInput] = useState<string>('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [{ data: cfgRes }, { data: sess }, { data: evs }] = await Promise.all([
        supabase.functions.invoke('crm-autopilot-config', { body: { action: 'get', companyId } }),
        supabase.from('whatsapp_sessions')
          .select('id, instance_name, phone_number, status, deleted_at')
          .eq('company_id', companyId)
          .is('deleted_at', null)
          .order('updated_at', { ascending: false }),
        supabase.from('crm_autopilot_events').select('*').eq('company_id', companyId).order('created_at', { ascending: false }).limit(30),
      ]);
      if (cfgRes?.config) setCfg({ ...DEFAULT, ...cfgRes.config });
      if (cfgRes?.config?.parent_phone) setParentPhoneInput(cfgRes.config.parent_phone);
      if (cfgRes?.stats) setStats(cfgRes.stats);
      const list = sess || [];
      setSessions(list);
      // Auto-select the only available session if none is set yet
      if (list.length === 1 && !cfgRes?.config?.parent_session_id) {
        setCfg((c) => ({ ...c, parent_session_id: list[0].id }));
      }
      setEvents(evs || []);
    } catch (e: any) {
      toast({ title: 'Erro ao carregar', description: e?.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [companyId, toast]);

  useEffect(() => { load(); }, [load]);

  // Auto-trigger self-configure whenever auto-configure is on and we don't have a learned prompt yet
  useEffect(() => {
    if (loading || selfConfiguring) return;
    if (!cfg.auto_configure) return;
    if (cfg.learned_prompt) return;
    runSelfConfigure();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, cfg.auto_configure, cfg.learned_prompt, stats.styleItems]);

  // Auto-clone voice as soon as there are enough audios from the CRM — no manual step needed
  useEffect(() => {
    if (loading || cloning) return;
    if (!stats.availableAudios || stats.availableAudios < 1) return;
    if (cfg.voice_status === 'ready' || cfg.voice_status === 'cloning' || cfg.voice_status === 'failed') return;
    cloneVoice();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, stats.availableAudios, cfg.voice_status]);

  // Realtime for events
  useEffect(() => {
    if (!companyId) return;
    const ch = supabase.channel(`autopilot-events-${companyId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'crm_autopilot_events', filter: `company_id=eq.${companyId}` },
        (payload) => setEvents((prev) => [payload.new, ...prev].slice(0, 30)))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [companyId]);

  const save = async () => {
    setSaving(true);
    try {
      const { data, error } = await supabase.functions.invoke('crm-autopilot-config', {
        body: { action: 'save', companyId, config: cfg },
      });
      if (error) throw error;
      if (data?.config) setCfg({ ...DEFAULT, ...data.config });
      toast({ title: 'Configurações salvas' });
    } catch (e: any) {
      toast({ title: 'Erro ao salvar', description: e?.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const toggle = async (activate: boolean) => {
    setToggling(true);
    try {
      const { data, error } = await supabase.functions.invoke('crm-autopilot-config', {
        body: { action: activate ? 'activate' : 'deactivate', companyId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setCfg((c) => ({ ...c, is_active: activate }));
      toast({
        title: activate ? '🚀 Piloto Automático LIGADO' : 'Piloto Automático desligado',
        description: activate ? 'Assumindo todas as conversas do CRM' : 'Você voltou ao controle manual',
      });
      load();
    } catch (e: any) {
      toast({ title: 'Erro', description: e?.message, variant: 'destructive' });
    } finally {
      setToggling(false);
    }
  };

  const cloneVoice = async () => {
    setCloning(true);
    try {
      const { data, error } = await supabase.functions.invoke('crm-autopilot-clone-voice', {
        body: { companyId, voiceName: `Minha voz — ${new Date().toLocaleDateString('pt-BR')}` },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data?.message || data.error);
      toast({ title: '🎙️ Voz clonada!', description: `${data.samples_used} amostras usadas` });
      load();
    } catch (e: any) {
      toast({ title: 'Erro ao clonar voz', description: e?.message, variant: 'destructive' });
    } finally {
      setCloning(false);
    }
  };

  const runSelfConfigure = async () => {
    setSelfConfiguring(true);
    try {
      const { data, error } = await supabase.functions.invoke('crm-autopilot-self-configure', {
        body: { companyId },
      });
      if (error) throw error;
      if (data?.error === 'not_enough_samples') {
        toast({ title: 'Ainda aprendendo', description: `Precisa de mais mensagens suas (só encontrei ${data.samples || 0}). Continue usando o WhatsApp normalmente.`, variant: 'destructive' });
        return;
      }
      if (data?.error) throw new Error(data.error);
      toast({ title: '🧠 Auto-configurado', description: `Baseado em ${data.samples} das suas mensagens` });
      load();
    } catch (e: any) {
      toast({ title: 'Erro ao auto-configurar', description: e?.message, variant: 'destructive' });
    } finally {
      setSelfConfiguring(false);
    }
  };

  const quickToggle = async (patch: Partial<Config>) => {
    setSavingLearning(true);
    const next = { ...cfg, ...patch };
    setCfg(next);
    try {
      await supabase.functions.invoke('crm-autopilot-config', {
        body: { action: 'save', companyId, config: next },
      });
      // If the user just enabled auto-configure, immediately (re)run self-configure
      if (patch.auto_configure === true) {
        runSelfConfigure();
      }
    } catch (e: any) {
      toast({ title: 'Erro', description: e?.message, variant: 'destructive' });
    } finally {
      setSavingLearning(false);
    }
  };

  const set = <K extends keyof Config>(k: K, v: Config[K]) => setCfg((c) => ({ ...c, [k]: v }));

  const validateParent = async () => {
    if (!parentPhoneInput.trim()) {
      toast({ title: 'Informe o número', description: 'Digite o número do Pai com DDI.', variant: 'destructive' });
      return;
    }
    if (!cfg.parent_session_id) {
      toast({ title: 'Selecione a sessão', description: 'Escolha qual WhatsApp vai enviar a mensagem.', variant: 'destructive' });
      return;
    }
    setValidatingParent(true);
    try {
      const { data, error } = await supabase.functions.invoke('crm-autopilot-config', {
        body: { action: 'validate_parent', companyId, parentPhone: parentPhoneInput, parentSessionId: cfg.parent_session_id },
      });
      if (error) throw error;
      if (data?.error) {
        toast({ title: 'Não deu certo', description: data.message || data.error, variant: 'destructive' });
        return;
      }
      if (data?.config) setCfg({ ...DEFAULT, ...data.config });
      if (data?.phone) setParentPhoneInput(data.phone);
      toast({ title: '✅ Número Pai validado', description: 'Enviei uma mensagem de confirmação pra ele.' });
    } catch (e: any) {
      toast({ title: 'Erro ao validar', description: e?.message, variant: 'destructive' });
    } finally {
      setValidatingParent(false);
    }
  };

  const voiceBadge = () => {
    if (cfg.voice_status === 'ready') return { text: 'Voz pronta', cls: 'text-emerald-600', icon: CheckCircle2 };
    if (cfg.voice_status === 'cloning') return { text: 'Clonando...', cls: 'text-amber-600', icon: Loader2 };
    if (cfg.voice_status === 'failed') return { text: 'Falhou', cls: 'text-red-600', icon: AlertCircle };
    return { text: 'Sem voz', cls: 'text-muted-foreground', icon: Mic };
  };

  if (loading) {
    return <div className="flex-1 flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  const vb = voiceBadge();

  return (
    <div className="flex-1 overflow-y-auto bg-background">
      <div className="max-w-6xl mx-auto px-4 md:px-8 py-6 md:py-10 space-y-6">
        {/* Cinematic hero */}
        <div className={`relative overflow-hidden rounded-[28px] border p-6 md:p-10 transition-all duration-500 ${
          cfg.is_active
            ? 'border-[#374DA4]/50 bg-gradient-to-br from-[#374DA4]/20 via-[#374DA4]/5 to-background shadow-[0_20px_60px_-20px_rgba(48,0,227,0.45)]'
            : 'border-border/60 bg-gradient-to-br from-card via-card to-muted/30'
        }`}>
          {/* Ambient glow */}
          <div className={`pointer-events-none absolute -top-32 -right-32 h-96 w-96 rounded-full blur-3xl transition-opacity duration-700 ${
            cfg.is_active ? 'opacity-60 bg-[#374DA4]/30' : 'opacity-0'
          }`} />
          <div className={`pointer-events-none absolute -bottom-32 -left-32 h-96 w-96 rounded-full blur-3xl transition-opacity duration-700 ${
            cfg.is_active ? 'opacity-40 bg-fuchsia-500/20' : 'opacity-0'
          }`} />

          <div className="relative flex items-center justify-between gap-8 flex-wrap">
            <div className="flex-1 min-w-0">
              <div className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#374DA4]">
                <Sparkles className="h-3.5 w-3.5" /> Piloto Automático · JARVIS
              </div>
              <h1 className="mt-3 text-3xl md:text-[38px] font-semibold text-foreground tracking-tight leading-tight">
                {cfg.is_active ? (
                  <>Ele está <span className="text-[#374DA4]">no comando</span>.</>
                ) : (
                  <>Um clique e ele <span className="text-[#374DA4]">assume tudo</span>.</>
                )}
              </h1>
              <p className="mt-2 text-sm md:text-[15px] text-muted-foreground max-w-2xl leading-relaxed">
                Quando ligado, responde todos os contatos usando seu estilo. Quando desligado, continua <strong className="text-foreground">aprendendo com você</strong> — lendo suas mensagens, áudios e o jeito que você fala.
              </p>
              <div className="mt-5 flex flex-wrap items-center gap-2 text-[12px]">
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-background/60 border border-border/60 text-muted-foreground">
                  <Bot className="h-3.5 w-3.5" /> {stats.totalConvs} conversas
                </span>
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-background/60 border border-border/60 text-muted-foreground">
                  <BookOpen className="h-3.5 w-3.5" /> {stats.styleItems} trechos de estilo
                </span>
                <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-background/60 border border-border/60 ${vb.cls}`}>
                  <vb.icon className={`h-3.5 w-3.5 ${cfg.voice_status === 'cloning' ? 'animate-spin' : ''}`} /> {vb.text}
                </span>
                {cfg.auto_configure && cfg.last_self_config_at && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#374DA4]/10 border border-[#374DA4]/30 text-[#374DA4]">
                    <Wand2 className="h-3.5 w-3.5" /> Auto-configurado
                  </span>
                )}
              </div>
            </div>

            {/* Big power button */}
            <div className="flex flex-col items-center gap-3">
              <button
                onClick={() => toggle(!cfg.is_active)}
                disabled={toggling}
                className={`group relative h-32 w-32 md:h-36 md:w-36 rounded-full border-4 transition-all duration-500 flex items-center justify-center ${
                  cfg.is_active
                    ? 'border-[#374DA4] bg-gradient-to-br from-[#374DA4] to-[#5B21B6] shadow-[0_0_60px_rgba(48,0,227,0.6)] scale-105'
                    : 'border-border bg-muted/30 hover:border-[#374DA4]/60 hover:bg-muted/60'
                } disabled:opacity-70`}
                aria-label={cfg.is_active ? 'Desligar piloto' : 'Ligar piloto'}
              >
                {cfg.is_active && (
                  <span className="absolute inset-0 rounded-full border-4 border-[#374DA4]/40 animate-ping" />
                )}
                {toggling ? (
                  <Loader2 className="h-12 w-12 animate-spin text-white" />
                ) : (
                  <Power className={`h-14 w-14 md:h-16 md:w-16 transition-colors ${cfg.is_active ? 'text-white' : 'text-muted-foreground group-hover:text-[#374DA4]'}`} strokeWidth={1.5} />
                )}
              </button>
              <div className="text-center">
                <div className={`text-[10px] uppercase tracking-[0.2em] font-bold ${cfg.is_active ? 'text-[#374DA4]' : 'text-muted-foreground'}`}>
                  {cfg.is_active ? 'NO AR' : 'STANDBY'}
                </div>
                {cfg.is_active && (
                  <div className="mt-1 text-[10px] uppercase tracking-widest text-emerald-600 inline-flex items-center gap-1">
                    <Radio className="h-3 w-3 animate-pulse" /> Atendendo agora
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Learning & auto-config strip */}
          <div className="relative mt-6 grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className={`flex items-center justify-between gap-3 rounded-2xl border p-4 transition-colors ${
              cfg.learning_enabled ? 'border-emerald-500/40 bg-emerald-500/5' : 'border-border/60 bg-background/40'
            }`}>
              <div className="flex items-center gap-3 min-w-0">
                <div className={`h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                  cfg.learning_enabled ? 'bg-emerald-500/15 text-emerald-600' : 'bg-muted text-muted-foreground'
                }`}>
                  <Brain className={`h-5 w-5 ${cfg.learning_enabled ? 'animate-pulse' : ''}`} />
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-foreground">Aprendendo com você</div>
                  <div className="text-[11px] text-muted-foreground">Lê suas mensagens e áudios em tempo real — mesmo com o piloto desligado.</div>
                </div>
              </div>
              <Switch
                checked={cfg.learning_enabled}
                disabled={savingLearning}
                onCheckedChange={(v) => quickToggle({ learning_enabled: v })}
              />
            </div>
            <div className={`flex items-center justify-between gap-3 rounded-2xl border p-4 transition-colors ${
              cfg.auto_configure ? 'border-[#374DA4]/40 bg-[#374DA4]/5' : 'border-border/60 bg-background/40'
            }`}>
              <div className="flex items-center gap-3 min-w-0">
                <div className={`h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                  cfg.auto_configure ? 'bg-[#374DA4]/15 text-[#374DA4]' : 'bg-muted text-muted-foreground'
                }`}>
                  <Zap className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-foreground">Auto-configurável</div>
                  <div className="text-[11px] text-muted-foreground">Ele cria o próprio prompt, tom, limite e ritmo — direto do seu jeito de escrever.</div>
                </div>
              </div>
              <Switch
                checked={cfg.auto_configure}
                disabled={savingLearning}
                onCheckedChange={(v) => quickToggle({ auto_configure: v })}
              />
            </div>
          </div>
        </div>

        {/* Coexistence with chatbot */}
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4 flex items-start gap-3">
          <Bot className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="text-[12.5px] text-foreground leading-relaxed">
            <strong>Convive com o Chatbot sem atrapalhar.</strong> Se o cliente já está dentro de um fluxo de chatbot, o piloto <u>não interfere</u> — ele fica com a etiqueta <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 text-[10px] font-semibold">CHATBOT</span> ativa e o piloto em modo espera. Só assume quando o cliente <em>sai do fluxo</em> ou fica <em>perdido</em> (5 min sem atividade). Nesse momento troca pra tag <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-[#374DA4]/10 text-[#374DA4] text-[10px] font-semibold">PILOTO</span> e responde.
          </div>
        </div>

        <Tabs defaultValue="behavior">
          <TabsList className="flex-wrap">
            <TabsTrigger value="behavior" className="gap-2"><Bot className="h-4 w-4" /> Comportamento</TabsTrigger>
            <TabsTrigger value="brain" className="gap-2"><Brain className="h-4 w-4" /> Cérebro aprendido</TabsTrigger>
            <TabsTrigger value="voice" className="gap-2"><Mic className="h-4 w-4" /> Voz</TabsTrigger>
            <TabsTrigger value="parent" className="gap-2"><PhoneCall className="h-4 w-4" /> Número Pai</TabsTrigger>
            <TabsTrigger value="learning" className="gap-2"><BookOpen className="h-4 w-4" /> Aprendizado</TabsTrigger>
            <TabsTrigger value="log" className="gap-2"><Activity className="h-4 w-4" /> Log ao vivo</TabsTrigger>
          </TabsList>

          {/* Behavior */}
          <TabsContent value="behavior" className="mt-4 space-y-4">
            <div className="rounded-3xl border border-border/60 bg-card p-6 space-y-4">
              {cfg.auto_configure && (
                <div className="rounded-2xl border border-[#374DA4]/30 bg-[#374DA4]/5 p-4 text-[12px] text-[#374DA4] flex items-start gap-3">
                  {selfConfiguring ? <Loader2 className="h-4 w-4 flex-shrink-0 mt-0.5 animate-spin" /> : <Wand2 className="h-4 w-4 flex-shrink-0 mt-0.5" />}
                  <div className="flex-1">
                    <strong>{selfConfiguring ? 'Configurando com IA…' : 'Auto-configuração ativa.'}</strong>{' '}
                    Objetivo, tom, personalidade e limite de caracteres são preenchidos <u>automaticamente</u> a partir do seu jeito de escrever. Para editar manualmente, desligue "Auto-configurável" no topo.
                  </div>
                </div>
              )}
              <fieldset disabled={cfg.auto_configure} className={cfg.auto_configure ? 'opacity-60 pointer-events-none space-y-4' : 'space-y-4'}>
              <div>
                <Label>Objetivo / missão do agente</Label>
                <Textarea rows={3} value={cfg.objective} onChange={(e) => set('objective', e.target.value)}
                  placeholder="Ex: Qualificar leads, tirar dúvidas sobre meus serviços e agendar reuniões." />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Tom preset</Label>
                  <Select value={cfg.tone_preset} onValueChange={(v) => set('tone_preset', v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cordial">Cordial</SelectItem>
                      <SelectItem value="vendedor">Vendedor</SelectItem>
                      <SelectItem value="consultivo">Consultivo</SelectItem>
                      <SelectItem value="direto">Direto e objetivo</SelectItem>
                      <SelectItem value="descontraido">Descontraído</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Máx. caracteres por mensagem: <span className="font-semibold text-foreground">{cfg.max_chars}</span></Label>
                  <Slider value={[cfg.max_chars]} min={100} max={2000} step={50} onValueChange={(v) => set('max_chars', v[0])} className="mt-3" />
                </div>
              </div>
              <div>
                <Label>Personalidade detalhada</Label>
                <Textarea rows={3} value={cfg.personality} onChange={(e) => set('personality', e.target.value)}
                  placeholder="Ex: Uso muitos emojis, falo informal, sempre chamo o cliente pelo nome, evito jargão técnico." />
              </div>
              </fieldset>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label>Início do horário (BR)</Label>
                  <Input type="number" min={0} max={23} value={cfg.send_hour_start}
                    onChange={(e) => set('send_hour_start', Number(e.target.value) || 0)} />
                </div>
                <div>
                  <Label>Fim do horário (BR)</Label>
                  <Input type="number" min={1} max={24} value={cfg.send_hour_end}
                    onChange={(e) => set('send_hour_end', Number(e.target.value) || 20)} />
                </div>
                <div>
                  <Label>Máx. msgs/hora por contato</Label>
                  <Input type="number" min={1} max={20} value={cfg.max_msgs_per_hour_per_contact}
                    onChange={(e) => set('max_msgs_per_hour_per_contact', Number(e.target.value) || 4)} />
                </div>
              </div>
              <div className="flex items-center justify-between rounded-2xl border border-border/60 p-4">
                <div>
                  <div className="text-sm font-medium">Permitir envio de áudios</div>
                  <div className="text-xs text-muted-foreground">Usa sua voz clonada quando fizer mais sentido</div>
                </div>
                <Switch checked={cfg.allow_audio} onCheckedChange={(v) => set('allow_audio', v)} disabled={cfg.voice_status !== 'ready'} />
              </div>
            </div>
          </TabsContent>

          {/* Brain (learned prompt) */}
          <TabsContent value="brain" className="mt-4 space-y-4">
            <div className="rounded-3xl border border-border/60 bg-card p-6 space-y-4">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="min-w-0">
                  <h3 className="text-lg font-semibold flex items-center gap-2"><Brain className="h-5 w-5 text-[#374DA4]" /> Prompt que ele mesmo escreveu</h3>
                  <p className="mt-1 text-sm text-muted-foreground max-w-xl">
                    A partir das suas mensagens, a IA gerou um manual de como <em>você</em> escreve. Este é o cérebro que o piloto usa para responder.
                  </p>
                  {cfg.last_self_config_at && (
                    <p className="mt-2 text-[11px] text-muted-foreground">
                      Última atualização: {new Date(cfg.last_self_config_at).toLocaleString('pt-BR')}
                    </p>
                  )}
                </div>
                <Button onClick={runSelfConfigure} disabled={selfConfiguring} className="gap-2 bg-[#374DA4] hover:bg-[#2500B8]">
                  {selfConfiguring ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
                  Reaprender agora
                </Button>
              </div>

              {cfg.writing_style_summary && (
                <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-4">
                  <div className="text-[10px] uppercase tracking-widest font-bold text-emerald-700 dark:text-emerald-400 mb-1">Seu estilo, resumido</div>
                  <p className="text-sm text-foreground">{cfg.writing_style_summary}</p>
                </div>
              )}

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <MiniStat label="Máx. chars" value={cfg.max_chars} />
                <MiniStat label="Msgs/turno" value={Number(cfg.avg_msgs_per_turn).toFixed(1)} />
                <MiniStat label="Tom" value={cfg.tone_preset} />
                <MiniStat label="Amostras" value={stats.styleItems} />
              </div>

              <div>
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">System prompt aprendido</Label>
                <div className="mt-2 rounded-2xl border border-border/60 bg-muted/30 p-4 text-[13px] leading-relaxed text-foreground whitespace-pre-wrap max-h-[400px] overflow-y-auto font-mono">
                  {cfg.learned_prompt || (
                    <span className="text-muted-foreground italic font-sans">
                      Ainda não gerado. Deixe o modo "Aprendendo" ligado, envie algumas mensagens no WhatsApp e clique em "Reaprender agora".
                    </span>
                  )}
                </div>
              </div>
            </div>
          </TabsContent>

          {/* Voice */}
          <TabsContent value="voice" className="mt-4">
            <div className="rounded-3xl border border-border/60 bg-card p-6 space-y-4">
              <div className="flex items-start gap-4 flex-wrap">
                <div className="flex-1 min-w-0">
                  <h3 className="text-lg font-semibold flex items-center gap-2">
                    Sua voz <span className="text-[10px] uppercase tracking-widest font-bold text-[#374DA4] bg-[#374DA4]/10 px-2 py-0.5 rounded-full">Automático</span>
                  </h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    O sistema pega automaticamente os áudios que você já enviou pelo CRM e clona sua voz — sem precisar gravar nada. Assim que houver áudios suficientes, a clonagem começa sozinha.
                  </p>
                  <div className="mt-3 text-xs text-muted-foreground">
                    Áudios disponíveis no CRM: <strong className="text-foreground">{stats.availableAudios}</strong>
                    {stats.voiceSamples > 0 && <> · Usados na última clonagem: <strong className="text-foreground">{stats.voiceSamples}</strong></>}
                    {cfg.voice_id && <> · Voice ID: <code className="text-[11px]">{cfg.voice_id.slice(0, 12)}…</code></>}
                  </div>
                </div>
                <Button onClick={cloneVoice} disabled={cloning || stats.availableAudios < 1} className="gap-2 bg-[#374DA4] hover:bg-[#2500B8]">
                  {cloning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mic className="h-4 w-4" />}
                  {cloning ? 'Clonando…' : cfg.voice_id ? 'Re-clonar com áudios novos' : 'Clonar agora'}
                </Button>
              </div>
              {cfg.voice_status === 'ready' && (
                <div className="rounded-2xl border border-emerald-500/40 bg-emerald-500/5 p-4 text-sm text-emerald-700 dark:text-emerald-400 flex items-start gap-3">
                  <CheckCircle2 className="h-4 w-4 flex-shrink-0 mt-0.5" />
                  <span>Voz pronta. Envie novos áudios pelo CRM a qualquer momento e clique em <strong>Re-clonar</strong> pra atualizar.</span>
                </div>
              )}
              {cfg.voice_status === 'cloning' && (
                <div className="rounded-2xl border border-[#374DA4]/40 bg-[#374DA4]/5 p-4 text-sm text-[#374DA4] flex items-start gap-3">
                  <Loader2 className="h-4 w-4 flex-shrink-0 mt-0.5 animate-spin" />
                  <span>Clonando automaticamente com os áudios do CRM…</span>
                </div>
              )}
              {stats.availableAudios < 1 && cfg.voice_status !== 'ready' && (
                <div className="rounded-2xl border border-amber-500/40 bg-amber-500/5 p-4 text-sm text-amber-700 dark:text-amber-400">
                  Ainda não encontrei áudios seus no CRM. Envie 3–10 áudios de 15–30s pelo WhatsApp e a clonagem acontece sozinha.
                </div>
              )}
            </div>
          </TabsContent>

          {/* Parent */}
          <TabsContent value="parent" className="mt-4">
            <div className="rounded-3xl border border-border/60 bg-card p-6 space-y-4">
              <div>
                <h3 className="text-lg font-semibold">Número Pai (escalonamento)</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Se o agente tiver dúvida, ele envia a pergunta pra este número (WhatsApp), aguarda a resposta (texto ou áudio),
                  processa e responde o cliente com base na sua orientação.
                </p>
              </div>

              {/* How it works — visual flow */}
              <div className="rounded-2xl border border-[#374DA4]/30 bg-gradient-to-br from-[#374DA4]/5 via-background to-fuchsia-500/5 p-5">
                <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-widest text-[#374DA4] mb-4">
                  <Sparkles className="h-3.5 w-3.5" /> Como funciona o fluxo
                </div>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  <FlowStep n={1} icon={MessageSquare} title="Cliente pergunta" desc="Manda uma mensagem no WhatsApp da empresa." />
                  <FlowStep n={2} icon={Brain} title="Agente tem dúvida" desc="A confiança fica abaixo do limiar — ele para de responder." accent />
                  <FlowStep n={3} icon={PhoneCall} title="Pai recebe pergunta" desc="Você recebe a dúvida no seu WhatsApp (texto ou áudio)." accent />
                  <FlowStep n={4} icon={User} title="Cliente é respondido" desc="Assim que você responder ao Pai, o agente responde o cliente na hora." />
                </div>
                <div className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 flex items-start gap-3">
                  <Clock className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div className="text-[12px] text-foreground leading-relaxed">
                    <strong>"Aguardando resposta do Número Pai"</strong> significa que o agente já te mandou a dúvida e <u>o cliente não vai receber nada</u> até você orientar. Sem tempo limite — mas quanto mais rápido você responder, mais rápido o cliente é atendido.
                  </div>
                </div>
                <div className="mt-2 text-[11px] text-muted-foreground">
                  💡 Você pode acompanhar todas as escalações em tempo real na aba <strong className="text-foreground">Log ao vivo</strong>.
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Número do Pai (com DDI)</Label>
                  <Input
                    value={parentPhoneInput}
                    onChange={(e) => setParentPhoneInput(e.target.value)}
                    placeholder="+55 11 99999-9999"
                  />
                  {cfg.parent_phone && (
                    <p className="mt-1 text-[11px] text-emerald-600 inline-flex items-center gap-1">
                      <CheckCircle2 className="h-3 w-3" /> Configurado: +{cfg.parent_phone}
                    </p>
                  )}
                </div>
                <div>
                  <Label>Sessão WhatsApp que envia a pergunta</Label>
                  <Select value={cfg.parent_session_id || ''} onValueChange={(v) => set('parent_session_id', v || null)}>
                    <SelectTrigger><SelectValue placeholder="Selecione uma sessão conectada" /></SelectTrigger>
                    <SelectContent>
                      {sessions.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.instance_name}
                          {s.phone_number ? ` · ${s.phone_number}` : ''}
                          {s.status !== 'connected' ? ` · ${s.status}` : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="md:col-span-2">
                  <Button
                    onClick={validateParent}
                    disabled={validatingParent || !parentPhoneInput.trim() || !cfg.parent_session_id}
                    className="gap-2 bg-[#374DA4] hover:bg-[#2500B8]"
                  >
                    {validatingParent ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                    Validar e configurar Número Pai
                  </Button>
                  <p className="mt-2 text-[11px] text-muted-foreground">
                    Vou verificar se o número existe no WhatsApp e enviar uma mensagem de confirmação avisando que ele virou o Pai desta conta.
                  </p>
                </div>
                <div>
                  <Label>Limiar de confiança: <span className="font-semibold text-foreground">{Math.round(cfg.confidence_threshold * 100)}%</span></Label>
                  <Slider value={[cfg.confidence_threshold * 100]} min={30} max={95} step={5}
                    onValueChange={(v) => set('confidence_threshold', v[0] / 100)} className="mt-3" />
                  <p className="text-[11px] text-muted-foreground mt-1">Abaixo desse valor, o agente escala para o Pai.</p>
                </div>
                <div className="md:col-span-2 rounded-2xl border border-border/60 bg-muted/30 p-4 text-[12px] text-muted-foreground">
                  <strong className="text-foreground">Como funciona:</strong> quando o agente tiver dúvida, ele envia a pergunta pro Pai e <u>fica aguardando</u>. Assim que o Pai responder (texto ou áudio), o agente responde o cliente na hora com base na orientação. Sem tempo limite — o cliente só recebe resposta depois que o Pai orientar.
                </div>
              </div>
            </div>
          </TabsContent>

          {/* Learning */}
          <TabsContent value="learning" className="mt-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <StatCard label="Conversas monitoradas" value={stats.totalConvs} icon={Bot} />
              <StatCard label="Áudios coletados" value={stats.voiceSamples} icon={Mic} />
              <StatCard label="Trechos de estilo" value={stats.styleItems} icon={BookOpen} />
            </div>
            <div className="mt-4 rounded-3xl border border-border/60 bg-card p-6 text-sm text-muted-foreground">
              <p>
                O agente aprende automaticamente com <strong>toda mensagem que você envia</strong> no CRM.
                Quanto mais você usar o WhatsApp normalmente, melhor ele imita seu estilo.
                {' '}Desligue em <em>Aprendendo com você</em> no topo para pausar a coleta.
              </p>
            </div>
          </TabsContent>

          {/* Live log */}
          <TabsContent value="log" className="mt-4">
            <div className="rounded-3xl border border-border/60 bg-card p-6">
              <div className="flex items-center gap-2 mb-4 text-sm">
                <Radio className="h-4 w-4 text-emerald-500 animate-pulse" />
                <span className="font-semibold">Ao vivo</span>
                <span className="text-muted-foreground text-xs">últimas ações do piloto</span>
              </div>
              {events.length === 0 ? (
                <p className="text-sm text-muted-foreground py-6 text-center">Nenhuma ação registrada ainda.</p>
              ) : (
                <div className="space-y-2 max-h-[500px] overflow-y-auto">
                  {events.map((e) => <EventRow key={e.id} e={e} />)}
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>

        <div className="sticky bottom-4 flex justify-end">
          <Button onClick={save} disabled={saving} className="gap-2 bg-[#374DA4] hover:bg-[#2500B8] shadow-lg">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Salvar configurações
          </Button>
        </div>
      </div>
    </div>
  );
};

const StatCard: React.FC<{ label: string; value: number; icon: any }> = ({ label, value, icon: Icon }) => (
  <div className="rounded-3xl border border-border/60 bg-card p-6">
    <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">
      <Icon className="h-3.5 w-3.5" /> {label}
    </div>
    <div className="mt-2 text-3xl font-semibold tabular-nums text-foreground">{value}</div>
  </div>
);

const MiniStat: React.FC<{ label: string; value: number | string }> = ({ label, value }) => (
  <div className="rounded-2xl border border-border/60 bg-background/50 p-3">
    <div className="text-[10px] uppercase tracking-widest font-semibold text-muted-foreground">{label}</div>
    <div className="mt-1 text-lg font-semibold tabular-nums text-foreground truncate">{value}</div>
  </div>
);

const FlowStep: React.FC<{ n: number; icon: any; title: string; desc: string; accent?: boolean }> = ({ n, icon: Icon, title, desc, accent }) => (
  <div className={`relative rounded-2xl border p-4 ${accent ? 'border-[#374DA4]/40 bg-[#374DA4]/5' : 'border-border/60 bg-background/60'}`}>
    <div className={`absolute -top-2 -left-2 h-6 w-6 rounded-full flex items-center justify-center text-[11px] font-bold ${accent ? 'bg-[#374DA4] text-white' : 'bg-muted text-muted-foreground border border-border'}`}>{n}</div>
    <Icon className={`h-5 w-5 mb-2 ${accent ? 'text-[#374DA4]' : 'text-muted-foreground'}`} />
    <div className="text-[13px] font-semibold text-foreground">{title}</div>
    <div className="mt-1 text-[11px] text-muted-foreground leading-snug">{desc}</div>
  </div>
);

const EVENT_META: Record<string, { color: string; label: string }> = {
  answered: { color: 'text-emerald-600', label: 'Respondeu' },
  answered_after_parent: { color: 'text-emerald-600', label: 'Respondeu (após Pai)' },
  escalated_to_parent: { color: 'text-amber-600', label: 'Escalou pro Pai' },
  parent_timeout: { color: 'text-red-600', label: 'Pai não respondeu' },
  skipped: { color: 'text-muted-foreground', label: 'Ignorou' },
  error: { color: 'text-red-600', label: 'Erro' },
  autopilot_activated: { color: 'text-[#374DA4]', label: 'LIGADO' },
  autopilot_deactivated: { color: 'text-muted-foreground', label: 'Desligado' },
  autopilot_self_configured: { color: 'text-[#374DA4]', label: 'Auto-configurado' },
  chatbot_handoff: { color: 'text-amber-600', label: 'Chatbot → Piloto' },
  parent_configured: { color: 'text-emerald-600', label: 'Pai configurado' },
};

const EventRow: React.FC<{ e: any }> = ({ e }) => {
  const m = EVENT_META[e.event_type] || { color: 'text-foreground', label: e.event_type };
  return (
    <div className="flex items-start gap-3 rounded-xl bg-muted/40 px-3 py-2">
      <span className={`text-[11px] font-semibold uppercase tracking-wider ${m.color} whitespace-nowrap`}>
        {m.label}
      </span>
      <div className="flex-1 min-w-0">
        <div className="text-[13px] text-foreground truncate">{e.description}</div>
        <div className="text-[10px] text-muted-foreground">
          {new Date(e.created_at).toLocaleString('pt-BR')}
        </div>
      </div>
    </div>
  );
};

export default WhatsAppAutopilot;