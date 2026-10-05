import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  MessageSquare, Calendar, BarChart3, FileText, 
  Sparkles, ArrowRight, ArrowLeft, X, Rocket,
  Bot, Send, FolderOpen, Users
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface OnboardingStep {
  icon: React.ElementType;
  title: string;
  description: string;
  color: string;
  route?: string;
}

const steps: OnboardingStep[] = [
  {
    icon: Sparkles,
    title: 'Bem-vindo ao Ellosuit!',
    description: 'Sua plataforma completa de gestão, comunicação e automação. Vamos fazer um tour rápido para você conhecer o que tem disponível.',
    color: '#374DA4',
  },
  {
    icon: MessageSquare,
    title: 'CRM WhatsApp',
    description: 'Gerencie todas as suas conversas do WhatsApp, envie mensagens em massa e automatize respostas com IA.',
    color: '#FF4500',
    route: '/dashboard/crm-ello',
  },
  {
    icon: Bot,
    title: 'Agentes de IA',
    description: 'Crie agentes inteligentes que atendem seus clientes 24h, respondem dúvidas e agendam reuniões automaticamente.',
    color: '#FF4500',
    route: '/dashboard/bot-ia',
  },
  {
    icon: Calendar,
    title: 'Agenda & Reuniões',
    description: 'Agende reuniões com videoconferência integrada, compartilhe links de agendamento e gerencie seu calendário.',
    color: '#007DE3',
    route: '/dashboard/agenda',
  },
  {
    icon: Send,
    title: 'Email Marketing',
    description: 'Crie campanhas de email profissionais com templates visuais e acompanhe métricas de abertura e cliques.',
    color: '#FF4500',
    route: '/dashboard/email',
  },
  {
    icon: Users,
    title: 'Cadastros Unificados',
    description: 'Gerencie clientes, fornecedores e prospectos em um único lugar com campos personalizados.',
    color: '#374DA4',
    route: '/dashboard/cadastros',
  },
  {
    icon: FolderOpen,
    title: 'Drive & Documentos',
    description: 'Armazene arquivos na nuvem, gere contratos e propostas automaticamente a partir de templates.',
    color: '#374DA4',
    route: '/dashboard/drive',
  },
  {
    icon: BarChart3,
    title: 'Rastreamento & Analytics',
    description: 'Rastreie documentos enviados, encurte links e veja quem acessou seu conteúdo em tempo real.',
    color: '#2ECC71',
    route: '/dashboard/rastreamento',
  },
  {
    icon: Rocket,
    title: 'Tudo pronto!',
    description: 'Você pode explorar cada módulo pelo menu superior. Se precisar de ajuda, pergunte ao Assistente de IA na tela inicial!',
    color: '#374DA4',
  },
];

const ONBOARDING_KEY = 'ellosuit-onboarding-completed';

export default function OnboardingWizard() {
  const [isOpen, setIsOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const { user } = useAuth();
  const navigate = useNavigate();

  const checkOnboardingStatus = useCallback(async () => {
    if (!user) return;

    // 1. Check local storage first for quick response
    const localCompleted = localStorage.getItem(ONBOARDING_KEY);
    if (localCompleted === 'true') return;

    // 2. Check database for a persistent source of truth
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('onboarding_completed')
        .eq('id', user.id)
        .single();

      if (error) {
        console.error('Error fetching onboarding status:', error);
        return;
      }

      if (data && !data.onboarding_completed) {
        // Small delay to let the dashboard render first
        const timer = setTimeout(() => setIsOpen(true), 1500);
        return () => clearTimeout(timer);
      } else if (data?.onboarding_completed) {
        // Sync local storage if it's already done in DB
        localStorage.setItem(ONBOARDING_KEY, 'true');
      }
    } catch (err) {
      console.error('Unexpected error checking onboarding:', err);
    }
  }, [user]);

  useEffect(() => {
    checkOnboardingStatus();
  }, [checkOnboardingStatus]);

  const handleClose = async () => {
    localStorage.setItem(ONBOARDING_KEY, 'true');
    setIsOpen(false);

    // Persistent update in database
    if (user) {
      try {
        await supabase
          .from('profiles')
          .update({ onboarding_completed: true })
          .eq('id', user.id);
      } catch (err) {
        console.error('Error saving onboarding completion:', err);
      }
    }
  };

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(prev => prev + 1);
    } else {
      handleClose();
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) setCurrentStep(prev => prev - 1);
  };

  const handleGoTo = (route?: string) => {
    if (route) {
      handleClose();
      navigate(route);
    }
  };

  const step = steps[currentStep];
  const Icon = step.icon;
  const isFirst = currentStep === 0;
  const isLast = currentStep === steps.length - 1;
  const progress = ((currentStep + 1) / steps.length) * 100;

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[200] flex items-center justify-center p-4"
        style={{ backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
      >
        <motion.div
          key={currentStep}
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: -20 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="relative w-full max-w-md rounded-2xl bg-card border border-border shadow-2xl overflow-hidden"
        >
          {/* Progress bar */}
          <div className="h-1 bg-muted">
            <motion.div
              className="h-full rounded-r-full"
              style={{ backgroundColor: step.color }}
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.4 }}
            />
          </div>

          {/* Close button */}
          <button
            onClick={handleClose}
            className="absolute top-4 right-4 p-1.5 rounded-full hover:bg-muted transition-colors text-muted-foreground"
          >
            <X className="h-4 w-4" />
          </button>

          {/* Content */}
          <div className="p-8 pt-6 text-center">
            {/* Icon */}
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', delay: 0.1 }}
              className="mx-auto mb-5 w-16 h-16 rounded-2xl flex items-center justify-center"
              style={{ backgroundColor: `${step.color}15` }}
            >
              <Icon className="h-8 w-8" style={{ color: step.color }} />
            </motion.div>

            {/* Step counter */}
            <p className="text-xs font-medium text-muted-foreground mb-2">
              {currentStep + 1} de {steps.length}
            </p>

            <h2 className="text-xl font-bold text-foreground mb-3">
              {step.title}
            </h2>

            <p className="text-sm text-muted-foreground leading-relaxed mb-6">
              {step.description}
            </p>

            {/* Go to module button */}
            {step.route && (
              <Button
                variant="outline"
                size="sm"
                className="mb-4 rounded-full"
                onClick={() => handleGoTo(step.route)}
              >
                Ir para {step.title}
                <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
              </Button>
            )}

            {/* Step dots */}
            <div className="flex justify-center gap-1.5 mb-6">
              {steps.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setCurrentStep(i)}
                  className={`h-1.5 rounded-full transition-all duration-300 ${
                    i === currentStep ? 'w-6' : 'w-1.5'
                  }`}
                  style={{
                    backgroundColor: i === currentStep ? step.color : 'hsl(var(--muted))',
                  }}
                />
              ))}
            </div>

            {/* Navigation */}
            <div className="flex items-center justify-between gap-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={handlePrev}
                disabled={isFirst}
                className="rounded-full"
              >
                <ArrowLeft className="h-4 w-4 mr-1" />
                Voltar
              </Button>

              <Button
                size="sm"
                onClick={handleNext}
                className="rounded-full text-white px-6"
                style={{ backgroundColor: step.color }}
              >
                {isLast ? 'Começar!' : 'Próximo'}
                {!isLast && <ArrowRight className="h-4 w-4 ml-1" />}
                {isLast && <Rocket className="h-4 w-4 ml-1" />}
              </Button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
