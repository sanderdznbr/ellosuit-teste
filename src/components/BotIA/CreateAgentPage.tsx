import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Bot, Brain, FileText, Upload, X, Check, Sparkles, Wand2, Loader2, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import AgentAvatar from './AgentAvatar/AgentAvatar';
import { AGENT_STYLES, DEFAULT_AGENT_STYLE_ID } from './AgentAvatar/agentStyles';

const OMNI_COLOR = '#374DA4';

interface TrainingFile {
  id: string;
  name: string;
  size: number;
  type: string;
}

const STEPS = [
  { id: 1, label: 'Perfil', icon: Bot },
  { id: 2, label: 'Comportamento', icon: Brain },
  { id: 3, label: 'Conhecimento', icon: FileText },
  { id: 4, label: 'Ativação', icon: Sparkles },
];

const CreateAgentPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();

  const [currentStep, setCurrentStep] = useState(1);
  const [saving, setSaving] = useState(false);

  // Step 1 - Perfil: nome + estilo do avatar
  const [name, setName] = useState('');
  const [styleIndex, setStyleIndex] = useState(
    Math.max(0, AGENT_STYLES.findIndex((s) => s.id === DEFAULT_AGENT_STYLE_ID)),
  );
  const currentStyle = AGENT_STYLES[styleIndex] ?? AGENT_STYLES[0];

  // Step 2 - Comportamento
  const [description, setDescription] = useState('');
  const [personality, setPersonality] = useState('');
  const [instructions, setInstructions] = useState('');
  const [doNot, setDoNot] = useState('');
  const [temperature, setTemperature] = useState(0.7);
  const [maxChars, setMaxChars] = useState(2000);
  const [contextMemory, setContextMemory] = useState(10);
  const [humor, setHumor] = useState('profissional');

  // Step 3 - Conhecimento
  const [trainingFiles, setTrainingFiles] = useState<TrainingFile[]>([]);

  // Step 4 - Ativação
  const [whatsappEnabled, setWhatsappEnabled] = useState(false);
  const [whatsappSessionId, setWhatsappSessionId] = useState('');

  // Criação com IA
  const [showAiDialog, setShowAiDialog] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiGenerating, setAiGenerating] = useState(false);

  const canGoPrev = styleIndex > 0;
  const canGoNext = styleIndex < AGENT_STYLES.length - 1;
  const moveStyle = (delta: number) => {
    setStyleIndex((prev) => Math.min(AGENT_STYLES.length - 1, Math.max(0, prev + delta)));
  };

  const handleCreateWithAI = async () => {
    if (!aiPrompt.trim() || aiGenerating) return;
    setAiGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('ai-chat', {
        body: {
          model: 'google/gemini-2.5-flash',
          temperature: 0.7,
          messages: [
            {
              role: 'system',
              content: `Você é um especialista em criar agentes de IA para atendimento ao cliente. 
O usuário vai descrever o tipo de agente que quer. Você deve gerar uma configuração completa.

IMPORTANTE: Responda APENAS com JSON válido, sem markdown, sem blocos de código, sem texto extra. Apenas o JSON puro.

O JSON deve ter esta estrutura exata:
{
  "name": "nome curto do agente",
  "description": "descrição breve do que o agente faz",
  "personality": "descrição detalhada da personalidade, tom de voz e estilo de comunicação",
  "instructions": "instruções completas e detalhadas de como o agente deve se comportar, o que perguntar, como responder, fluxo de atendimento",
  "doNot": "lista de coisas que o agente NÃO deve fazer",
  "humor": "profissional|amigavel|formal|descontraido|tecnico",
  "temperature": 0.7,
  "maxChars": 2000,
  "contextMemory": 10
}

Seja criativo e detalhado nas instruções. O personality deve ter pelo menos 100 caracteres. As instructions devem ter pelo menos 300 caracteres com fluxo de atendimento completo.`,
            },
            { role: 'user', content: aiPrompt },
          ],
        },
      });

      if (error) throw error;

      const responseText = data?.response || data?.message || '';

      let jsonStr = responseText.trim();
      const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) jsonStr = jsonMatch[1].trim();

      const agentConfig = JSON.parse(jsonStr);

      if (agentConfig.name) setName(agentConfig.name);
      if (agentConfig.description) setDescription(agentConfig.description);
      if (agentConfig.personality) setPersonality(agentConfig.personality);
      if (agentConfig.instructions) setInstructions(agentConfig.instructions);
      if (agentConfig.doNot) setDoNot(agentConfig.doNot);
      if (agentConfig.humor) setHumor(agentConfig.humor);
      if (agentConfig.temperature != null) setTemperature(agentConfig.temperature);
      if (agentConfig.maxChars) setMaxChars(agentConfig.maxChars);
      if (agentConfig.contextMemory) setContextMemory(agentConfig.contextMemory);

      setShowAiDialog(false);
      setAiPrompt('');
      setCurrentStep(1);

      toast({ title: '✨ Agente gerado!', description: 'Revise as configurações e ajuste se necessário.' });
    } catch (e: unknown) {
      console.error('AI generation error:', e);
      toast({ title: 'Erro ao gerar', description: 'Não foi possível gerar o agente. Tente novamente.', variant: 'destructive' });
    } finally {
      setAiGenerating(false);
    }
  };

  const ensureCompany = async (): Promise<string | null> => {
    if (!user?.id) return null;
    const metadataCompanyId = user.user_metadata?.company_id;
    if (metadataCompanyId) return metadataCompanyId;
    const { data } = await supabase.from('company_users').select('company_id').eq('user_id', user.id).single();
    if (data?.company_id) return data.company_id;
    const companyName = user.user_metadata?.company_name || user.email?.split('@')[0] || 'Minha Empresa';
    const { data: newCompany } = await supabase.from('companies').insert({ name: companyName }).select().single();
    if (!newCompany) return null;
    await supabase.from('company_users').insert({ company_id: newCompany.id, user_id: user.id, role: 'admin' });
    return newCompany.id;
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
    setTrainingFiles((prev) => [
      ...prev,
      { id: Math.random().toString(36).substring(7), name: file.name, size: file.size, type: file.type },
    ]);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const canAdvance = () => {
    if (currentStep === 1) return name.trim().length > 0;
    if (currentStep === 2) return personality.trim().length > 0 && instructions.trim().length > 0;
    return true;
  };

  const handleCreate = async () => {
    if (!user?.id) return;
    setSaving(true);
    try {
      const companyId = await ensureCompany();
      if (!companyId) throw new Error('Empresa não encontrada');

      const { error } = await supabase.from('ai_agents').insert({
        name,
        description,
        personality,
        instructions: `${instructions}${doNot ? `\n\nO QUE NÃO FAZER:\n${doNot}` : ''}`,
        model: 'google/gemini-3-flash-preview',
        company_id: companyId,
        created_by: user.id,
        is_active: true,
        whatsapp_enabled: whatsappEnabled,
        whatsapp_session_id: whatsappEnabled && whatsappSessionId ? whatsappSessionId : null,
        settings: {
          agentStyle: currentStyle.id,
          maxResponseChars: maxChars,
          temperature,
          contextMemory,
          humor,
          trainingFiles: trainingFiles.map((f) => ({ id: f.id, name: f.name, size: f.size, type: f.type })),
        },
      });

      if (error) throw error;
      toast({ title: 'Agente criado!', description: `${name} está pronto para uso.` });
      navigate('/dashboard/bot-ia');
    } catch (e) {
      toast({ title: 'Erro', description: e instanceof Error ? e.message : 'Falha ao criar', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const stepTitle = currentStep === 1 ? 'Novo agente' : name.trim() || 'Novo agente';

  return (
    <div className="min-h-screen bg-[#fafafb]">
      <div className="max-w-2xl mx-auto px-6 py-10">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 mb-10">
          <Button
            variant="ghost"
            size="icon"
            className="rounded-full text-gray-400 hover:text-gray-700 -ml-2"
            onClick={() => navigate('/dashboard/bot-ia')}
            aria-label="Voltar"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-base font-semibold text-gray-900 truncate">{stepTitle}</h1>
          <Button
            variant="ghost"
            onClick={() => setShowAiDialog(true)}
            className="rounded-full gap-2 text-gray-500 hover:text-gray-900 text-sm -mr-2"
          >
            <Wand2 className="h-4 w-4" />
            <span className="hidden sm:inline">Criar com IA</span>
          </Button>
        </div>

        {/* Stepper */}
        <div className="flex items-center gap-2 mb-10">
          {STEPS.map((step, i) => {
            const done = currentStep > step.id;
            const active = currentStep === step.id;
            return (
              <React.Fragment key={step.id}>
                <button
                  type="button"
                  onClick={() => step.id < currentStep && setCurrentStep(step.id)}
                  className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                    active
                      ? 'text-white'
                      : done
                        ? 'text-gray-600 hover:bg-gray-100'
                        : 'text-gray-300'
                  }`}
                  style={active ? { backgroundColor: OMNI_COLOR } : {}}
                >
                  {done ? <Check className="h-3.5 w-3.5" /> : <span>{step.id}</span>}
                  <span className="hidden sm:inline">{step.label}</span>
                </button>
                {i < STEPS.length - 1 && (
                  <div className={`flex-1 h-px ${currentStep > step.id ? 'bg-gray-300' : 'bg-gray-200'}`} />
                )}
              </React.Fragment>
            );
          })}
        </div>

        {/* Conteúdo */}
        {currentStep === 1 && (
          <div className="space-y-10">
            <div className="space-y-3">
              <Label htmlFor="agent-name" className="sr-only">
                Nome do agente
              </Label>
              <Input
                id="agent-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Nome do seu agente"
                autoFocus
                className="h-14 text-center text-lg rounded-2xl border-gray-200 bg-white shadow-sm placeholder:text-gray-300 focus-visible:ring-1"
              />
            </div>

            <div className="space-y-4">
              <p className="text-center text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">
                Estilo do agente
              </p>

              <div
                className="relative"
                tabIndex={0}
                role="group"
                aria-label="Selecionar estilo do agente"
                onKeyDown={(e) => {
                  if (e.key === 'ArrowLeft') { e.preventDefault(); moveStyle(-1); }
                  if (e.key === 'ArrowRight') { e.preventDefault(); moveStyle(1); }
                }}
              >
                <div className="overflow-hidden rounded-3xl">
                  <div
                    className="flex transition-transform duration-500 ease-out"
                    style={{ transform: `translateX(-${styleIndex * 100}%)` }}
                  >
                    {AGENT_STYLES.map((style, i) => (
                      <div
                        key={style.id}
                        className="w-full shrink-0 flex flex-col items-center justify-center gap-1 pt-2 pb-4"
                        aria-hidden={i !== styleIndex}
                      >
                        <AgentAvatar styleId={style.id} size={200} paused={i !== styleIndex} />
                        <p className="text-sm font-semibold text-gray-900 mt-1">{style.name}</p>
                        <p className="text-xs text-gray-400">{style.description}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => moveStyle(-1)}
                  disabled={!canGoPrev}
                  aria-label="Estilo anterior"
                  className="absolute left-0 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full bg-white shadow-sm border border-gray-100 flex items-center justify-center text-gray-600 transition-all hover:shadow-md disabled:opacity-25 disabled:cursor-not-allowed disabled:hover:shadow-sm"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <button
                  type="button"
                  onClick={() => moveStyle(1)}
                  disabled={!canGoNext}
                  aria-label="Próximo estilo"
                  className="absolute right-0 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full bg-white shadow-sm border border-gray-100 flex items-center justify-center text-gray-600 transition-all hover:shadow-md disabled:opacity-25 disabled:cursor-not-allowed disabled:hover:shadow-sm"
                >
                  <ChevronRight className="h-5 w-5" />
                </button>
              </div>

              <div className="flex items-center justify-center gap-1.5">
                {AGENT_STYLES.map((style, i) => (
                  <button
                    key={style.id}
                    type="button"
                    onClick={() => setStyleIndex(i)}
                    aria-label={`Ver ${style.name}`}
                    aria-current={i === styleIndex}
                    className={`h-1.5 rounded-full transition-all ${
                      i === styleIndex ? 'w-6 bg-gray-800' : 'w-1.5 bg-gray-300 hover:bg-gray-400'
                    }`}
                  />
                ))}
              </div>
            </div>
          </div>
        )}

        {currentStep !== 1 && (
          <Card className="rounded-3xl border-gray-100 bg-white shadow-sm">
            <CardContent className="p-6 space-y-5">
              {currentStep === 2 && (
                <>
                  <div>
                    <Label className="text-sm font-medium text-gray-700">Descrição</Label>
                    <p className="text-xs text-gray-400 mb-1.5">Aparece na lista de agentes</p>
                    <Textarea
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Breve descrição sobre o que esse agente faz..."
                      className="rounded-xl min-h-[70px]"
                    />
                  </div>

                  <div>
                    <Label className="text-sm font-medium text-gray-700">Personalidade *</Label>
                    <p className="text-xs text-gray-400 mb-1.5">Defina o tom e estilo de comunicação do agente</p>
                    <Textarea
                      value={personality}
                      onChange={(e) => setPersonality(e.target.value)}
                      placeholder="Ex: Profissional, empático, objetivo e sempre oferece soluções..."
                      className="rounded-xl min-h-[80px]"
                    />
                  </div>

                  <div>
                    <Label className="text-sm font-medium text-gray-700">Prompt / Instruções *</Label>
                    <p className="text-xs text-gray-400 mb-1.5">Descreva detalhadamente como o agente deve se comportar</p>
                    <Textarea
                      value={instructions}
                      onChange={(e) => setInstructions(e.target.value)}
                      placeholder="Você é um assistente especializado em vendas. Sempre cumprimente o cliente, faça perguntas para entender a necessidade..."
                      className="rounded-xl min-h-[140px]"
                    />
                  </div>

                  <div>
                    <Label className="text-sm font-medium text-gray-700">O que NÃO fazer</Label>
                    <p className="text-xs text-gray-400 mb-1.5">Restrições e limites do agente</p>
                    <Textarea
                      value={doNot}
                      onChange={(e) => setDoNot(e.target.value)}
                      placeholder="Não falar sobre concorrentes, não inventar preços, não prometer prazos impossíveis..."
                      className="rounded-xl min-h-[80px]"
                    />
                  </div>

                  <div>
                    <Label className="text-sm font-medium text-gray-700">Tom / Humor</Label>
                    <Select value={humor} onValueChange={setHumor}>
                      <SelectTrigger className="rounded-xl h-11 mt-1.5">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="profissional">Profissional</SelectItem>
                        <SelectItem value="amigavel">Amigável</SelectItem>
                        <SelectItem value="formal">Formal</SelectItem>
                        <SelectItem value="descontraido">Descontraído</SelectItem>
                        <SelectItem value="tecnico">Técnico</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <Label className="text-xs text-gray-600">Criatividade</Label>
                        <span className="text-xs font-medium text-gray-900">{temperature.toFixed(1)}</span>
                      </div>
                      <Slider
                        value={[temperature * 100]}
                        onValueChange={([v]) => setTemperature(v / 100)}
                        min={0} max={100} step={10}
                      />
                      <p className="text-[10px] text-gray-400 mt-1">0 = preciso, 1 = criativo</p>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <Label className="text-xs text-gray-600">Limite de caracteres</Label>
                        <span className="text-xs font-medium text-gray-900">{maxChars}</span>
                      </div>
                      <Slider
                        value={[maxChars]}
                        onValueChange={([v]) => setMaxChars(v)}
                        min={100} max={10000} step={100}
                      />
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <Label className="text-xs text-gray-600">Memória (msgs)</Label>
                        <span className="text-xs font-medium text-gray-900">{contextMemory}</span>
                      </div>
                      <Slider
                        value={[contextMemory]}
                        onValueChange={([v]) => setContextMemory(v)}
                        min={1} max={50} step={1}
                      />
                    </div>
                  </div>
                </>
              )}

              {currentStep === 3 && (
                <>
                  <div>
                    <Label className="text-sm font-medium text-gray-700">Base de Conhecimento</Label>
                    <p className="text-xs text-gray-400 mb-3">Adicione arquivos para o agente usar como referência nas respostas</p>
                  </div>

                  {trainingFiles.length > 0 && (
                    <div className="space-y-2">
                      {trainingFiles.map((file) => (
                        <div key={file.id} className="flex items-center justify-between bg-gray-50 rounded-xl p-3">
                          <div className="flex items-center gap-3">
                            <FileText className="h-5 w-5 text-[#374DA4]" />
                            <div>
                              <p className="text-sm font-medium text-gray-900">{file.name}</p>
                              <p className="text-xs text-gray-400">{formatFileSize(file.size)}</p>
                            </div>
                          </div>
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setTrainingFiles((prev) => prev.filter((f) => f.id !== file.id))}>
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}

                  <label className="cursor-pointer block">
                    <div className="border-2 border-dashed border-gray-200 rounded-xl p-8 text-center hover:border-gray-300 hover:bg-gray-50/50 transition-all">
                      <Upload className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                      <p className="text-sm text-gray-600 font-medium">Arraste ou clique para adicionar arquivos</p>
                      <p className="text-xs text-gray-400 mt-1">TXT, PDF, JSON, CSV, MD (máx. 10MB)</p>
                    </div>
                    <input type="file" accept=".txt,.pdf,.json,.csv,.md" onChange={handleFileUpload} className="hidden" />
                  </label>
                </>
              )}

              {currentStep === 4 && (
                <>
                  <div className="text-center py-4">
                    <div className="flex justify-center mb-2">
                      <AgentAvatar styleId={currentStyle.id} size={120} />
                    </div>
                    <h3 className="text-base font-semibold text-gray-900">{name}</h3>
                    <p className="text-sm text-gray-500 mt-0.5">Pronto para ativar</p>
                  </div>

                  <div className="bg-gray-50 rounded-2xl p-4 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Estilo</span>
                      <span className="font-medium text-gray-900">{currentStyle.name}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Tom</span>
                      <span className="font-medium text-gray-900 capitalize">{humor}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Arquivos</span>
                      <span className="font-medium text-gray-900">{trainingFiles.length}</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between bg-white rounded-2xl border border-gray-100 p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-green-50 rounded-xl flex items-center justify-center">
                        <Sparkles className="h-5 w-5 text-green-600" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">WhatsApp</p>
                        <p className="text-xs text-gray-500">Responder mensagens automaticamente</p>
                      </div>
                    </div>
                    <Switch checked={whatsappEnabled} onCheckedChange={setWhatsappEnabled} />
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        )}

        {/* Navegação */}
        <div className="flex items-center justify-between mt-8">
          <Button
            variant="ghost"
            className="rounded-full text-gray-500"
            onClick={() => (currentStep > 1 ? setCurrentStep(currentStep - 1) : navigate('/dashboard/bot-ia'))}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            {currentStep === 1 ? 'Cancelar' : 'Voltar'}
          </Button>

          {currentStep < 4 ? (
            <Button
              className="rounded-full text-white px-6"
              style={{ backgroundColor: OMNI_COLOR }}
              onClick={() => setCurrentStep(currentStep + 1)}
              disabled={!canAdvance()}
            >
              Próximo
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          ) : (
            <Button
              className="rounded-full text-white px-6"
              style={{ backgroundColor: OMNI_COLOR }}
              onClick={handleCreate}
              disabled={saving}
            >
              {saving ? 'Criando...' : 'Criar Agente'}
              <Check className="h-4 w-4 ml-2" />
            </Button>
          )}
        </div>
      </div>

      {/* Criação com IA */}
      <Dialog open={showAiDialog} onOpenChange={setShowAiDialog}>
        <DialogContent className="sm:max-w-lg rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wand2 className="h-5 w-5 text-violet-500" />
              Criar Agente com IA
            </DialogTitle>
            <DialogDescription>
              Descreva o agente que você precisa e a IA vai configurar tudo automaticamente.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 mt-2">
            <Textarea
              value={aiPrompt}
              onChange={(e) => setAiPrompt(e.target.value)}
              placeholder="Ex: Preciso de um agente de vendas para uma loja de roupas femininas. Ele deve ser simpático, perguntar o que a cliente procura, sugerir produtos, informar sobre promoções e direcionar para o pagamento. Deve falar de forma jovem e descontraída."
              className="min-h-[160px] rounded-xl"
              disabled={aiGenerating}
            />

            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Sparkles className="h-3.5 w-3.5" />
              <span>Quanto mais detalhes você fornecer, melhor será o resultado</span>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" className="rounded-xl" onClick={() => setShowAiDialog(false)} disabled={aiGenerating}>
                Cancelar
              </Button>
              <Button
                onClick={handleCreateWithAI}
                disabled={!aiPrompt.trim() || aiGenerating}
                className="rounded-xl gap-2 text-white bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700"
              >
                {aiGenerating ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Gerando...
                  </>
                ) : (
                  <>
                    <Wand2 className="h-4 w-4" />
                    Gerar Agente
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CreateAgentPage;
