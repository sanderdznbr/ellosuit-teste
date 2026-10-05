import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2, Sparkles, CheckCircle, ArrowRight, ArrowLeft, Building2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface AIOnboardingWizardProps {
  onComplete: (preferences: OnboardingPreferences) => void;
  onSkip: () => void;
}

interface OnboardingPreferences {
  segment: string;
  companySize: string;
  mainGoals: string[];
  recommendedTools: string[];
}

const SEGMENTS = [
  { id: 'vendas', label: 'Vendas & Comercial', icon: '💼', tools: ['crm-whatsapp', 'email', 'analytics', 'agenda-aberta'] },
  { id: 'marketing', label: 'Marketing & Comunicação', icon: '📢', tools: ['email', 'rastreamento', 'analytics', 'fluxos'] },
  { id: 'rh', label: 'Recursos Humanos', icon: '👥', tools: ['cadastros', 'agenda', 'reunioes', 'tasks'] },
  { id: 'financeiro', label: 'Financeiro & Admin', icon: '💰', tools: ['cadastros', 'drive', 'relatorios', 'email'] },
  { id: 'atendimento', label: 'Atendimento ao Cliente', icon: '🎧', tools: ['crm-whatsapp', 'bot-ia', 'reunioes', 'tasks'] },
  { id: 'consultoria', label: 'Consultoria & Serviços', icon: '🎯', tools: ['agenda-aberta', 'reunioes', 'drive', 'analytics'] },
  { id: 'educacao', label: 'Educação & Treinamento', icon: '📚', tools: ['reunioes', 'drive', 'tasks', 'agenda'] },
  { id: 'outro', label: 'Outro Segmento', icon: '🔧', tools: ['agenda', 'email', 'tasks', 'drive'] },
];

const COMPANY_SIZES = [
  { id: 'solo', label: 'Apenas eu', description: 'Profissional autônomo' },
  { id: 'small', label: '2-10 pessoas', description: 'Pequena equipe' },
  { id: 'medium', label: '11-50 pessoas', description: 'Empresa em crescimento' },
  { id: 'large', label: '51+ pessoas', description: 'Empresa estabelecida' },
];

const GOALS = [
  { id: 'vendas', label: 'Aumentar vendas', icon: '📈' },
  { id: 'produtividade', label: 'Melhorar produtividade', icon: '⚡' },
  { id: 'organizacao', label: 'Organizar processos', icon: '📋' },
  { id: 'comunicacao', label: 'Melhorar comunicação', icon: '💬' },
  { id: 'atendimento', label: 'Otimizar atendimento', icon: '🎯' },
  { id: 'automacao', label: 'Automatizar tarefas', icon: '🤖' },
];

export const AIOnboardingWizard: React.FC<AIOnboardingWizardProps> = ({ onComplete, onSkip }) => {
  const [step, setStep] = useState(1);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [segment, setSegment] = useState('');
  const [companySize, setCompanySize] = useState('');
  const [selectedGoals, setSelectedGoals] = useState<string[]>([]);
  const [recommendations, setRecommendations] = useState<string[]>([]);

  const handleGoalToggle = (goalId: string) => {
    setSelectedGoals(prev => 
      prev.includes(goalId) 
        ? prev.filter(g => g !== goalId)
        : [...prev, goalId]
    );
  };

  const analyzeAndRecommend = async () => {
    setIsAnalyzing(true);
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const selectedSegment = SEGMENTS.find(s => s.id === segment);
    const tools = selectedSegment?.tools || ['agenda', 'email', 'tasks'];
    
    const goalBasedTools: string[] = [];
    if (selectedGoals.includes('vendas')) goalBasedTools.push('analytics', 'crm-whatsapp');
    if (selectedGoals.includes('automacao')) goalBasedTools.push('bot-ia', 'fluxos');
    if (selectedGoals.includes('comunicacao')) goalBasedTools.push('reunioes', 'email');
    
    const allTools = [...new Set([...tools, ...goalBasedTools])];
    setRecommendations(allTools.slice(0, 6));
    setIsAnalyzing(false);
    setStep(4);
  };

  const handleComplete = () => {
    onComplete({
      segment,
      companySize,
      mainGoals: selectedGoals,
      recommendedTools: recommendations,
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#2F428D] to-[#1A2551] flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        {/* Step Dots */}
        <div className="flex justify-center gap-2 mb-8">
          {[1, 2, 3, 4].map((i) => (
            <div 
              key={i}
              className={`h-2 w-2 rounded-full transition-all ${
                i <= step ? 'bg-white' : 'bg-white/30'
              } ${i === step ? 'w-6' : ''}`}
            />
          ))}
        </div>

        <AnimatePresence mode="wait">
          {/* Step 1: Segmento */}
          {step === 1 && (
            <motion.div
              key="step1"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-8"
            >
              <div className="text-center">
                <Sparkles className="h-12 w-12 text-white mx-auto mb-4" />
                <h1 className="text-3xl font-bold text-white mb-2">Bem-vindo ao ELLOsuit!</h1>
                <p className="text-white/80">Qual é o seu segmento de atuação?</p>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {SEGMENTS.map((seg) => (
                  <button
                    key={seg.id}
                    onClick={() => setSegment(seg.id)}
                    className={`p-4 rounded-2xl transition-all text-center ${
                      segment === seg.id 
                        ? 'bg-white text-[#253573] shadow-xl scale-105' 
                        : 'bg-white/10 text-white hover:bg-white/20'
                    }`}
                  >
                    <span className="text-3xl mb-2 block">{seg.icon}</span>
                    <span className="text-sm font-medium">{seg.label}</span>
                  </button>
                ))}
              </div>

              <div className="flex justify-between items-center pt-4">
                <button 
                  onClick={onSkip} 
                  className="text-white/60 hover:text-white text-sm transition-colors"
                >
                  Pular configuração
                </button>
                <Button 
                  onClick={() => setStep(2)} 
                  disabled={!segment}
                  className="bg-white text-[#253573] hover:bg-white/90 rounded-xl px-6"
                >
                  Continuar <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </motion.div>
          )}

          {/* Step 2: Tamanho da empresa */}
          {step === 2 && (
            <motion.div
              key="step2"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-8"
            >
              <div className="text-center">
                <Building2 className="h-12 w-12 text-white mx-auto mb-4" />
                <h1 className="text-3xl font-bold text-white mb-2">Qual o tamanho da sua equipe?</h1>
                <p className="text-white/80">Adaptamos os recursos para sua realidade</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {COMPANY_SIZES.map((size) => (
                  <button
                    key={size.id}
                    onClick={() => setCompanySize(size.id)}
                    className={`p-5 rounded-2xl transition-all text-left ${
                      companySize === size.id 
                        ? 'bg-white text-[#253573] shadow-xl scale-105' 
                        : 'bg-white/10 text-white hover:bg-white/20'
                    }`}
                  >
                    <span className="font-bold block mb-1">{size.label}</span>
                    <span className={`text-sm ${companySize === size.id ? 'text-[#2F428D]' : 'text-white/70'}`}>
                      {size.description}
                    </span>
                  </button>
                ))}
              </div>

              <div className="flex justify-between pt-4">
                <Button 
                  variant="ghost" 
                  onClick={() => setStep(1)}
                  className="text-white hover:bg-white/10 rounded-xl"
                >
                  <ArrowLeft className="mr-2 h-4 w-4" /> Voltar
                </Button>
                <Button 
                  onClick={() => setStep(3)} 
                  disabled={!companySize}
                  className="bg-white text-[#253573] hover:bg-white/90 rounded-xl px-6"
                >
                  Continuar <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </motion.div>
          )}

          {/* Step 3: Objetivos */}
          {step === 3 && (
            <motion.div
              key="step3"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-8"
            >
              <div className="text-center">
                <h1 className="text-3xl font-bold text-white mb-2">Quais são seus objetivos?</h1>
                <p className="text-white/80">Selecione até 3 objetivos principais</p>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {GOALS.map((goal) => (
                  <button
                    key={goal.id}
                    onClick={() => handleGoalToggle(goal.id)}
                    disabled={selectedGoals.length >= 3 && !selectedGoals.includes(goal.id)}
                    className={`p-4 rounded-2xl transition-all text-center ${
                      selectedGoals.includes(goal.id)
                        ? 'bg-white text-[#253573] shadow-xl scale-105' 
                        : 'bg-white/10 text-white hover:bg-white/20'
                    } ${selectedGoals.length >= 3 && !selectedGoals.includes(goal.id) ? 'opacity-40 cursor-not-allowed' : ''}`}
                  >
                    <span className="text-2xl mb-2 block">{goal.icon}</span>
                    <span className="text-sm font-medium">{goal.label}</span>
                  </button>
                ))}
              </div>

              <div className="flex justify-between pt-4">
                <Button 
                  variant="ghost" 
                  onClick={() => setStep(2)}
                  className="text-white hover:bg-white/10 rounded-xl"
                >
                  <ArrowLeft className="mr-2 h-4 w-4" /> Voltar
                </Button>
                <Button 
                  onClick={analyzeAndRecommend} 
                  disabled={selectedGoals.length === 0 || isAnalyzing}
                  className="bg-white text-[#253573] hover:bg-white/90 rounded-xl px-6"
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

          {/* Step 4: Recomendações */}
          {step === 4 && (
            <motion.div
              key="step4"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="space-y-8"
            >
              <div className="text-center">
                <div className="w-20 h-20 rounded-full bg-white/20 mx-auto flex items-center justify-center mb-4">
                  <CheckCircle className="h-10 w-10 text-white" />
                </div>
                <h1 className="text-3xl font-bold text-white mb-2">Tudo pronto!</h1>
                <p className="text-white/80">Recomendamos estas ferramentas para você:</p>
              </div>

              <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6">
                <div className="flex flex-wrap gap-2 justify-center">
                  {recommendations.map((tool) => (
                    <span 
                      key={tool} 
                      className="px-4 py-2 bg-white text-[#253573] rounded-xl text-sm font-medium"
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
                  className="bg-white text-[#253573] hover:bg-white/90 rounded-xl px-10 py-6 text-lg font-semibold shadow-xl"
                >
                  Começar a usar <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
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
    'bot-ia': 'Agentes de IA',
    'reunioes': 'Reuniões',
    'tasks': 'Tarefas',
    'drive': 'Arquivos',
    'cadastros': 'Cadastros',
    'rastreamento': 'Rastreamento',
    'fluxos': 'Fluxos',
    'relatorios': 'Relatórios',
    'agenda': 'Agenda',
  };
  return labels[toolId] || toolId;
}

export default AIOnboardingWizard;
