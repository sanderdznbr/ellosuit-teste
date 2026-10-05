import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Bot, Brain, MessageSquare, Upload, FileText, X, Check, Sparkles, Wand2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

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

  // Step 1 - Profile
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  // Step 2 - Behavior
  const [personality, setPersonality] = useState('');
  const [instructions, setInstructions] = useState('');
  const [doNot, setDoNot] = useState('');
  const [temperature, setTemperature] = useState(0.7);
  const [maxChars, setMaxChars] = useState(2000);
  const [contextMemory, setContextMemory] = useState(10);
  const [humor, setHumor] = useState('profissional');

  // Step 3 - Knowledge
  const [trainingFiles, setTrainingFiles] = useState<TrainingFile[]>([]);
  const [uploadingFile, setUploadingFile] = useState(false);

  // Step 4 - Activation
  const [whatsappEnabled, setWhatsappEnabled] = useState(false);
  const [whatsappSessions, setWhatsappSessions] = useState<any[]>([]);
  const [whatsappSessionId, setWhatsappSessionId] = useState('');

  // AI Creation
  const [showAiDialog, setShowAiDialog] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiGenerating, setAiGenerating] = useState(false);

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

Seja criativo e detalhado nas instruções. O personality deve ter pelo menos 100 caracteres. As instructions devem ter pelo menos 300 caracteres com fluxo de atendimento completo.`
            },
            { role: 'user', content: aiPrompt }
          ]
        }
      });

      if (error) throw error;

      const responseText = data?.response || data?.message || '';
      
      // Parse JSON - try to extract from possible markdown code blocks
      let jsonStr = responseText.trim();
      const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) jsonStr = jsonMatch[1].trim();
      
      const agentConfig = JSON.parse(jsonStr);

      // Fill all fields
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
      setCurrentStep(1); // Go to step 1 to review

      toast({ title: '✨ Agente gerado!', description: 'Revise as configurações e ajuste se necessário.' });
    } catch (e: any) {
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
    setTrainingFiles(prev => [...prev, {
      id: Math.random().toString(36).substring(7),
      name: file.name,
      size: file.size,
      type: file.type,
    }]);
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
          maxResponseChars: maxChars,
          temperature,
          contextMemory,
          humor,
          trainingFiles: trainingFiles.map(f => ({ id: f.id, name: f.name, size: f.size, type: f.type })),
        }
      });

      if (error) throw error;
      toast({ title: 'Agente criado!', description: `${name} está pronto para uso.` });
      navigate('/dashboard/bot-ia');
    } catch (e: any) {
      toast({ title: 'Erro', description: e.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-3xl mx-auto px-6 py-8">
        {/* Header */}
         <div className="flex items-center gap-3 mb-8">
           <Button 
             variant="ghost" 
             size="icon" 
             className="rounded-xl transition-colors duration-300" 
             onClick={() => navigate('/dashboard/bot-ia')}
             style={{ color: OMNI_COLOR }}
           >
             <ArrowLeft className="h-5 w-5" />
           </Button>
          <div className="flex-1">
            <h1 className="text-xl font-bold text-gray-900">Novo Agente de IA</h1>
            <p className="text-sm text-gray-500">Modelo de IA: elloiav1.0</p>
          </div>
          <Button
            onClick={() => setShowAiDialog(true)}
            className="rounded-xl gap-2 text-white bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700 shadow-md"
          >
            <Wand2 className="h-4 w-4" />
            Criar com IA
          </Button>
        </div>

        {/* Stepper */}
        <div className="flex items-center justify-center mb-10">
          {STEPS.map((step, i) => (
            <React.Fragment key={step.id}>
              <div className="flex flex-col items-center gap-1.5">
                <div
                  className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold transition-all ${
                    currentStep === step.id
                      ? 'text-white shadow-md'
                      : currentStep > step.id
                      ? 'bg-green-100 text-green-600'
                      : 'bg-gray-100 text-gray-400'
                  }`}
                  style={currentStep === step.id ? { backgroundColor: OMNI_COLOR } : {}}
                >
                  {currentStep > step.id ? <Check className="h-4 w-4" /> : step.id}
                </div>
                <span className={`text-xs font-medium ${currentStep === step.id ? 'text-gray-900' : 'text-gray-400'}`}>
                  {step.label}
                </span>
              </div>
              {i < STEPS.length - 1 && (
                <div className={`w-16 h-px mx-2 mt-[-18px] ${currentStep > step.id ? 'bg-green-300' : 'bg-gray-200'}`} />
              )}
            </React.Fragment>
          ))}
        </div>

        {/* Step Content */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6">
          {/* Step 1: Profile */}
          {currentStep === 1 && (
            <div className="space-y-5">
              <div>
                <Label className="text-sm font-medium text-gray-700">Nome do Agente *</Label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex: Assistente de Vendas"
                  className="mt-1.5 rounded-xl h-11"
                />
              </div>
              <div>
                <Label className="text-sm font-medium text-gray-700">Descrição</Label>
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Breve descrição sobre o que esse agente faz..."
                  className="mt-1.5 rounded-xl min-h-[80px]"
                />
              </div>
            </div>
          )}

          {/* Step 2: Behavior */}
          {currentStep === 2 && (
            <div className="space-y-5">
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
            </div>
          )}

          {/* Step 3: Knowledge */}
          {currentStep === 3 && (
            <div className="space-y-5">
              <div>
                <Label className="text-sm font-medium text-gray-700">Base de Conhecimento</Label>
                <p className="text-xs text-gray-400 mb-3">Adicione arquivos para o agente usar como referência nas respostas</p>
              </div>

              {trainingFiles.length > 0 && (
                <div className="space-y-2">
                  {trainingFiles.map(file => (
                    <div key={file.id} className="flex items-center justify-between bg-gray-50 rounded-xl p-3">
                      <div className="flex items-center gap-3">
                        <FileText className="h-5 w-5 text-[#374DA4]" />
                        <div>
                          <p className="text-sm font-medium text-gray-900">{file.name}</p>
                          <p className="text-xs text-gray-400">{formatFileSize(file.size)}</p>
                        </div>
                      </div>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setTrainingFiles(prev => prev.filter(f => f.id !== file.id))}>
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
                <input
                  type="file"
                  accept=".txt,.pdf,.json,.csv,.md"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>
            </div>
          )}

          {/* Step 4: Activation */}
          {currentStep === 4 && (
            <div className="space-y-6">
              <div className="text-center py-4">
                <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ backgroundColor: `${OMNI_COLOR}12` }}>
                  <Sparkles className="h-8 w-8" style={{ color: OMNI_COLOR }} />
                </div>
                <h3 className="text-lg font-semibold text-gray-900">Quase pronto!</h3>
                <p className="text-sm text-gray-500 mt-1">Revise e ative integrações para seu agente</p>
              </div>

              {/* Summary */}
              <div className="bg-gray-50 rounded-xl p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Nome</span>
                  <span className="font-medium text-gray-900">{name}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Modelo</span>
                  <Badge variant="secondary" className="text-xs">elloiav1.0</Badge>
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

              {/* WhatsApp Integration */}
              <div className="flex items-center justify-between bg-white rounded-xl border border-gray-100 p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-green-50 rounded-xl flex items-center justify-center">
                    <MessageSquare className="h-5 w-5 text-green-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">WhatsApp</p>
                    <p className="text-xs text-gray-500">Responder mensagens automaticamente</p>
                  </div>
                </div>
                <Switch checked={whatsappEnabled} onCheckedChange={setWhatsappEnabled} />
              </div>
            </div>
          )}
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between mt-6">
          <Button
            variant="outline"
            className="rounded-xl"
            onClick={() => currentStep > 1 ? setCurrentStep(currentStep - 1) : navigate('/dashboard/bot-ia')}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            {currentStep === 1 ? 'Cancelar' : 'Voltar'}
          </Button>

          {currentStep < 4 ? (
            <Button
              className="rounded-xl text-white"
              style={{ backgroundColor: OMNI_COLOR }}
              onClick={() => setCurrentStep(currentStep + 1)}
              disabled={!canAdvance()}
            >
              Próximo
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          ) : (
            <Button
              className="rounded-xl text-white"
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

      {/* AI Creation Dialog */}
      <Dialog open={showAiDialog} onOpenChange={setShowAiDialog}>
        <DialogContent className="sm:max-w-lg">
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
