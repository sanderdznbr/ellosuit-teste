import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { 
  Loader2, Sparkles, CheckCircle, ArrowRight, ArrowLeft, 
  Building2, Users, Send, X, Mail, Plus, MessageSquare 
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import ellosuitLogo from '@/assets/logoellosuit.png';

interface ConversationalOnboardingProps {
  onComplete: (preferences: OnboardingPreferences) => void;
  onSkip: () => void;
}

interface OnboardingPreferences {
  segment: string;
  companySize: string;
  mainGoals: string[];
  recommendedTools: string[];
  businessDescription?: string;
}

interface ChatMessage {
  role: 'assistant' | 'user';
  content: string;
}

const COMPANY_SIZES = [
  { id: 'solo', label: 'Apenas eu', description: 'Profissional autônomo', count: 1 },
  { id: 'small', label: '2-10 pessoas', description: 'Pequena equipe', count: 2 },
  { id: 'medium', label: '11-50 pessoas', description: 'Empresa em crescimento', count: 11 },
  { id: 'large', label: '51+ pessoas', description: 'Empresa estabelecida', count: 51 },
];

const ConversationalOnboarding: React.FC<ConversationalOnboardingProps> = ({ onComplete, onSkip }) => {
  const { toast } = useToast();
  const chatEndRef = useRef<HTMLDivElement>(null);
  
  const [step, setStep] = useState(1);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [businessArea, setBusinessArea] = useState('');
  const [companySize, setCompanySize] = useState('');
  const [teamEmails, setTeamEmails] = useState<string[]>(['']);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    { role: 'assistant', content: 'Olá! 👋 Sou o assistente do ELLOsuit. Me conte um pouco sobre o seu negócio: qual é a sua área de atuação?' }
  ]);
  const [userInput, setUserInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [recommendations, setRecommendations] = useState<string[]>([]);
  const [analyzedGoals, setAnalyzedGoals] = useState<string[]>([]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  const sendToAI = async (message: string, context: string) => {
    try {
      const systemPrompt = `Você é um assistente de onboarding do ELLOsuit, uma plataforma de produtividade empresarial. 
      
Ferramentas disponíveis no ELLOsuit:
- crm-whatsapp: CRM para WhatsApp e vendas
- email: Email marketing e campanhas
- analytics: Análises e relatórios
- agenda-aberta: Agendamento online de reuniões
- bot-ia: Agentes de IA para atendimento
- reunioes: Videoconferências e reuniões online
- tasks: Gerenciamento de tarefas
- drive: Armazenamento de arquivos
- cadastros: Gestão de clientes e cadastros
- rastreamento: Rastreamento de documentos e links
- fluxos: Automação de fluxos de trabalho
- relatorios: Relatórios e dashboards

${context}

Responda de forma amigável, breve e em português brasileiro. Faça perguntas para entender melhor as necessidades do usuário.`;

      const { data, error } = await supabase.functions.invoke('ai-chat', {
        body: {
          messages: [
            { role: 'system', content: systemPrompt },
            ...chatMessages.map(m => ({ role: m.role, content: m.content })),
            { role: 'user', content: message }
          ]
        }
      });

      if (error) throw error;
      return data.response || data.message;
    } catch (error) {
      console.error('AI error:', error);
      return 'Desculpe, ocorreu um erro. Pode reformular sua resposta?';
    }
  };

  const handleSendMessage = async () => {
    if (!userInput.trim() || isTyping) return;

    const message = userInput.trim();
    setUserInput('');
    setChatMessages(prev => [...prev, { role: 'user', content: message }]);
    setIsTyping(true);

    // Store the business area from first message
    if (chatMessages.length === 1) {
      setBusinessArea(message);
    }

    const context = businessArea 
      ? `O usuário já informou que atua na área: ${businessArea}. Continue a conversa para entender melhor os objetivos.`
      : 'Primeira mensagem do usuário sobre sua área de atuação.';

    const response = await sendToAI(message, context);
    
    setChatMessages(prev => [...prev, { role: 'assistant', content: response }]);
    setIsTyping(false);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const proceedToTeamSize = () => {
    if (!businessArea && chatMessages.length > 1) {
      // Extract from conversation
      const userMessages = chatMessages.filter(m => m.role === 'user');
      if (userMessages.length > 0) {
        setBusinessArea(userMessages[0].content);
      }
    }
    setStep(2);
  };

  const addEmailField = () => {
    setTeamEmails([...teamEmails, '']);
  };

  const updateEmail = (index: number, value: string) => {
    const updated = [...teamEmails];
    updated[index] = value;
    setTeamEmails(updated);
  };

  const removeEmail = (index: number) => {
    if (teamEmails.length > 1) {
      setTeamEmails(teamEmails.filter((_, i) => i !== index));
    }
  };

  const analyzeAndRecommend = async () => {
    setIsAnalyzing(true);
    
    try {
      const analysisPrompt = `Com base na conversa, analise e retorne um JSON com:
      {
        "tools": ["lista de 4-6 ferramentas recomendadas do ELLOsuit"],
        "goals": ["lista de 2-4 objetivos principais identificados"]
      }
      
Área de atuação: ${businessArea}
Tamanho da equipe: ${companySize}
Histórico da conversa: ${chatMessages.map(m => `${m.role}: ${m.content}`).join('\n')}`;

      const { data, error } = await supabase.functions.invoke('ai-chat', {
        body: {
          messages: [
            { role: 'system', content: 'Você é um analisador de necessidades. Responda APENAS com JSON válido, sem markdown ou explicações.' },
            { role: 'user', content: analysisPrompt }
          ]
        }
      });

      if (error) throw error;

      try {
        const result = JSON.parse(data.response || data.message);
        setRecommendations(result.tools || ['agenda', 'email', 'tasks', 'drive']);
        setAnalyzedGoals(result.goals || ['Aumentar produtividade', 'Organizar processos']);
      } catch {
        // Fallback recommendations
        setRecommendations(['agenda', 'email', 'tasks', 'drive', 'reunioes']);
        setAnalyzedGoals(['Aumentar produtividade', 'Melhorar organização']);
      }
    } catch (error) {
      console.error('Analysis error:', error);
      setRecommendations(['agenda', 'email', 'tasks', 'drive']);
      setAnalyzedGoals(['Aumentar produtividade']);
    }
    
    setIsAnalyzing(false);
    setStep(3);
  };

  const handleComplete = async () => {
    // Send invites if there are emails
    const validEmails = teamEmails.filter(e => e.trim() && e.includes('@'));
    if (validEmails.length > 0) {
      toast({
        title: 'Convites enviados!',
        description: `${validEmails.length} convite(s) enviado(s) para sua equipe.`
      });
    }

    onComplete({
      segment: businessArea,
      companySize,
      mainGoals: analyzedGoals,
      recommendedTools: recommendations,
      businessDescription: businessArea,
    });
  };

  const selectedSize = COMPANY_SIZES.find(s => s.id === companySize);
  const showInviteSection = selectedSize && selectedSize.count > 1;

  return (
    <div className="min-h-screen bg-primary flex flex-col">
      {/* Header with logo */}
      <div className="p-6 flex justify-center">
        <img src={ellosuitLogo} alt="ELLOsuit" className="h-10 object-contain" />
      </div>

      {/* Progress indicator */}
      <div className="flex justify-center gap-2 mb-6">
        {[1, 2, 3].map((i) => (
          <div 
            key={i}
            className={`h-2 rounded-full transition-all duration-300 ${
              i <= step ? 'bg-white' : 'bg-white/30'
            } ${i === step ? 'w-8' : 'w-2'}`}
          />
        ))}
      </div>

      {/* Main content */}
      <div className="flex-1 flex items-center justify-center px-4 pb-8">
        <div className="w-full max-w-2xl">
          <AnimatePresence mode="wait">
            {/* Step 1: Conversational Business Area */}
            {step === 1 && (
              <motion.div
                key="step1"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-6"
              >
                <div className="text-center mb-6">
                  <div className="w-16 h-16 rounded-2xl bg-white/10 mx-auto flex items-center justify-center mb-4">
                    <MessageSquare className="h-8 w-8 text-white" />
                  </div>
                  <h1 className="text-3xl font-bold text-white mb-2">Bem-vindo ao ELLOsuit!</h1>
                  <p className="text-white/70">Vamos personalizar sua experiência</p>
                </div>

                {/* Chat area */}
                <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-4 max-h-[400px] overflow-y-auto">
                  <div className="space-y-4">
                    {chatMessages.map((msg, i) => (
                      <div 
                        key={i} 
                        className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                      >
                        <div 
                          className={`max-w-[80%] p-3 rounded-2xl ${
                            msg.role === 'user' 
                              ? 'bg-white text-primary rounded-br-sm' 
                              : 'bg-white/20 text-white rounded-bl-sm'
                          }`}
                        >
                          {msg.content}
                        </div>
                      </div>
                    ))}
                    {isTyping && (
                      <div className="flex justify-start">
                        <div className="bg-white/20 text-white p-3 rounded-2xl rounded-bl-sm">
                          <div className="flex gap-1">
                            <span className="w-2 h-2 bg-white/60 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                            <span className="w-2 h-2 bg-white/60 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                            <span className="w-2 h-2 bg-white/60 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                          </div>
                        </div>
                      </div>
                    )}
                    <div ref={chatEndRef} />
                  </div>
                </div>

                {/* Input area */}
                <div className="flex gap-2">
                  <Input
                    value={userInput}
                    onChange={(e) => setUserInput(e.target.value)}
                    onKeyDown={handleKeyPress}
                    placeholder="Digite sua área de atuação... ex: Consultoria de Marketing"
                    className="flex-1 h-12 bg-white/10 border-white/20 text-white placeholder:text-white/50 rounded-xl"
                  />
                  <Button 
                    onClick={handleSendMessage}
                    disabled={!userInput.trim() || isTyping}
                    className="h-12 w-12 rounded-xl bg-white text-primary hover:bg-white/90"
                  >
                    <Send className="h-5 w-5" />
                  </Button>
                </div>

                <div className="flex justify-between items-center pt-4">
                  <button 
                    onClick={onSkip} 
                    className="text-white/60 hover:text-white text-sm transition-colors"
                  >
                    Pular configuração
                  </button>
                  <Button 
                    onClick={proceedToTeamSize} 
                    disabled={chatMessages.length < 2}
                    className="bg-white text-primary hover:bg-white/90 rounded-xl px-6"
                  >
                    Continuar <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              </motion.div>
            )}

            {/* Step 2: Team Size + Invites */}
            {step === 2 && (
              <motion.div
                key="step2"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-6"
              >
                <div className="text-center">
                  <div className="w-16 h-16 rounded-2xl bg-white/10 mx-auto flex items-center justify-center mb-4">
                    <Users className="h-8 w-8 text-white" />
                  </div>
                  <h1 className="text-3xl font-bold text-white mb-2">Qual o tamanho da sua equipe?</h1>
                  <p className="text-white/70">Adaptamos os recursos para sua realidade</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  {COMPANY_SIZES.map((size) => (
                    <button
                      key={size.id}
                      onClick={() => setCompanySize(size.id)}
                      className={`p-5 rounded-2xl transition-all text-left ${
                        companySize === size.id 
                          ? 'bg-white text-primary shadow-xl scale-[1.02]' 
                          : 'bg-white/10 text-white hover:bg-white/20'
                      }`}
                    >
                      <span className="font-bold block mb-1">{size.label}</span>
                      <span className={`text-sm ${companySize === size.id ? 'text-primary/70' : 'text-white/70'}`}>
                        {size.description}
                      </span>
                    </button>
                  ))}
                </div>

                {/* Team invite section - appears when team > 1 */}
                <AnimatePresence>
                  {showInviteSection && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 mt-4">
                        <div className="flex items-center gap-3 mb-4">
                          <Mail className="h-5 w-5 text-white" />
                          <h3 className="text-white font-semibold">Convide sua equipe</h3>
                        </div>
                        <p className="text-white/70 text-sm mb-4">
                          Adicione os emails dos membros da sua equipe para enviar convites
                        </p>
                        
                        <div className="space-y-3">
                          {teamEmails.map((email, index) => (
                            <div key={index} className="flex gap-2">
                              <Input
                                type="email"
                                value={email}
                                onChange={(e) => updateEmail(index, e.target.value)}
                                placeholder="email@exemplo.com"
                                className="flex-1 bg-white/10 border-white/20 text-white placeholder:text-white/50 rounded-xl"
                              />
                              {teamEmails.length > 1 && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => removeEmail(index)}
                                  className="text-white/60 hover:text-white hover:bg-white/10 rounded-xl"
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          ))}
                        </div>
                        
                        <Button
                          variant="ghost"
                          onClick={addEmailField}
                          className="mt-3 text-white/70 hover:text-white hover:bg-white/10 w-full rounded-xl"
                        >
                          <Plus className="h-4 w-4 mr-2" />
                          Adicionar outro email
                        </Button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                <div className="flex justify-between pt-4">
                  <Button 
                    variant="ghost" 
                    onClick={() => setStep(1)}
                    className="text-white hover:bg-white/10 rounded-xl"
                  >
                    <ArrowLeft className="mr-2 h-4 w-4" /> Voltar
                  </Button>
                  <Button 
                    onClick={analyzeAndRecommend} 
                    disabled={!companySize || isAnalyzing}
                    className="bg-white text-primary hover:bg-white/90 rounded-xl px-6"
                  >
                    {isAnalyzing ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Analisando...
                      </>
                    ) : (
                      <>
                        <Sparkles className="mr-2 h-4 w-4" />
                        Gerar recomendações
                      </>
                    )}
                  </Button>
                </div>
              </motion.div>
            )}

            {/* Step 3: Recommendations */}
            {step === 3 && (
              <motion.div
                key="step3"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="space-y-6"
              >
                <div className="text-center">
                  <div className="w-20 h-20 rounded-full bg-white/20 mx-auto flex items-center justify-center mb-4">
                    <CheckCircle className="h-10 w-10 text-white" />
                  </div>
                  <h1 className="text-3xl font-bold text-white mb-2">Tudo pronto!</h1>
                  <p className="text-white/70">Baseado na nossa conversa, recomendamos:</p>
                </div>

                {analyzedGoals.length > 0 && (
                  <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-5">
                    <h3 className="text-white font-semibold mb-3 text-sm uppercase tracking-wide">
                      Objetivos identificados
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {analyzedGoals.map((goal, i) => (
                        <Badge key={i} variant="secondary" className="bg-white/20 text-white border-0">
                          {goal}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-5">
                  <h3 className="text-white font-semibold mb-3 text-sm uppercase tracking-wide">
                    Ferramentas recomendadas
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {recommendations.map((tool) => (
                      <span 
                        key={tool} 
                        className="px-4 py-2 bg-white text-primary rounded-xl text-sm font-medium"
                      >
                        {getToolLabel(tool)}
                      </span>
                    ))}
                  </div>
                </div>

                <p className="text-center text-white/60 text-sm">
                  💡 Você pode personalizar a sidebar a qualquer momento nas configurações
                </p>

                <div className="flex justify-center pt-4">
                  <Button 
                    onClick={handleComplete} 
                    size="lg" 
                    className="bg-white text-primary hover:bg-white/90 rounded-xl px-10 py-6 text-lg font-semibold shadow-xl"
                  >
                    Começar a usar <ArrowRight className="ml-2 h-5 w-5" />
                  </Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};

function getToolLabel(toolId: string): string {
  const labels: Record<string, string> = {
    'crm-whatsapp': 'CRM WhatsApp',
    'email': 'Email Marketing',
    'analytics': 'Analytics',
    'agenda-aberta': 'Agenda Online',
    'agenda': 'Agenda',
    'bot-ia': 'Agentes de IA',
    'reunioes': 'Reuniões',
    'tasks': 'Tarefas',
    'drive': 'Arquivos',
    'cadastros': 'Cadastros',
    'rastreamento': 'Rastreamento',
    'fluxos': 'Fluxos',
    'relatorios': 'Relatórios',
  };
  return labels[toolId] || toolId;
}

export default ConversationalOnboarding;
