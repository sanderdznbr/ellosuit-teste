import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { X, ArrowRight, ArrowLeft, Sparkles, Calendar, Mail, Video, Users, FileText, Bot } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface GuidedTourProps {
  onComplete: () => void;
  onSkip: () => void;
}

const TOUR_STEPS = [
  {
    id: 'welcome',
    title: 'Bem-vindo ao Ellosuit! 🎉',
    description: 'Vamos fazer um tour rápido para você conhecer as principais funcionalidades da plataforma.',
    icon: Sparkles,
    highlight: null,
    position: 'center',
  },
  {
    id: 'sidebar',
    title: 'Menu Lateral',
    description: 'Aqui você encontra todas as ferramentas organizadas por categoria. Passe o mouse sobre os ícones para expandir os submenus.',
    icon: null,
    highlight: '[data-sidebar]',
    position: 'right',
  },
  {
    id: 'agenda',
    title: 'Agenda e Calendário',
    description: 'Gerencie seus compromissos, agende reuniões e sincronize com o Google Calendar.',
    icon: Calendar,
    highlight: null,
    position: 'center',
  },
  {
    id: 'reunioes',
    title: 'Reuniões por Vídeo',
    description: 'Crie salas de videoconferência instantâneas com gravação, transcrição automática e assistente de IA.',
    icon: Video,
    highlight: null,
    position: 'center',
  },
  {
    id: 'email',
    title: 'Email Marketing',
    description: 'Conecte sua conta de email, crie campanhas e rastreie aberturas e cliques.',
    icon: Mail,
    highlight: null,
    position: 'center',
  },
  {
    id: 'ia',
    title: 'Inteligência Artificial',
    description: 'Configure agentes de IA para automatizar atendimento no WhatsApp e outras tarefas.',
    icon: Bot,
    highlight: null,
    position: 'center',
  },
  {
    id: 'final',
    title: 'Pronto para começar!',
    description: 'Explore a plataforma e personalize sua experiência. Você pode reordenar os itens da sidebar nas configurações.',
    icon: Sparkles,
    highlight: null,
    position: 'center',
  },
];

export const GuidedTour: React.FC<GuidedTourProps> = ({ onComplete, onSkip }) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [isVisible, setIsVisible] = useState(true);

  const step = TOUR_STEPS[currentStep];
  const isLastStep = currentStep === TOUR_STEPS.length - 1;
  const isFirstStep = currentStep === 0;

  const handleNext = () => {
    if (isLastStep) {
      onComplete();
    } else {
      setCurrentStep(prev => prev + 1);
    }
  };

  const handlePrev = () => {
    if (!isFirstStep) {
      setCurrentStep(prev => prev - 1);
    }
  };

  // Highlight element on the page
  useEffect(() => {
    if (step.highlight) {
      const element = document.querySelector(step.highlight);
      if (element) {
        element.classList.add('tour-highlight');
        return () => element.classList.remove('tour-highlight');
      }
    }
  }, [step.highlight]);

  if (!isVisible) return null;

  return (
    <>
      {/* Overlay */}
      <div className="fixed inset-0 bg-black/50 z-[100]" />
      
      {/* Tour Card */}
      <AnimatePresence mode="wait">
        <motion.div
          key={step.id}
          initial={{ opacity: 0, y: 20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -20, scale: 0.95 }}
          className="fixed inset-0 flex items-center justify-center z-[101] p-4"
        >
          <Card className="w-full max-w-md shadow-2xl border-0">
            <CardContent className="p-0">
              {/* Header */}
              <div className="bg-primary p-4 flex items-center justify-between rounded-t-lg">
                <div className="flex items-center gap-3">
                  {step.icon && <step.icon className="h-6 w-6 text-white" />}
                  <span className="text-white/80 text-sm">
                    {currentStep + 1} de {TOUR_STEPS.length}
                  </span>
                </div>
                <Button 
                  variant="ghost" 
                  size="icon"
                  className="text-white/80 hover:text-white hover:bg-white/10"
                  onClick={onSkip}
                >
                  <X className="h-5 w-5" />
                </Button>
              </div>

              {/* Content */}
              <div className="p-6 space-y-4">
                <h2 className="text-xl font-bold text-foreground">{step.title}</h2>
                <p className="text-muted-foreground">{step.description}</p>

                {/* Progress dots */}
                <div className="flex justify-center gap-1.5 py-2">
                  {TOUR_STEPS.map((_, i) => (
                    <div 
                      key={i}
                      className={`h-2 w-2 rounded-full transition-all ${
                        i === currentStep ? 'bg-primary w-4' : 
                        i < currentStep ? 'bg-primary/50' : 'bg-muted'
                      }`}
                    />
                  ))}
                </div>

                {/* Actions */}
                <div className="flex justify-between pt-2">
                  <Button 
                    variant="ghost" 
                    onClick={handlePrev}
                    disabled={isFirstStep}
                    className={isFirstStep ? 'invisible' : ''}
                  >
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Anterior
                  </Button>
                  
                  <Button onClick={handleNext}>
                    {isLastStep ? (
                      <>
                        Começar <Sparkles className="ml-2 h-4 w-4" />
                      </>
                    ) : (
                      <>
                        Próximo <ArrowRight className="ml-2 h-4 w-4" />
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </AnimatePresence>

      {/* Highlight CSS */}
      <style>{`
        .tour-highlight {
          position: relative;
          z-index: 102;
          box-shadow: 0 0 0 4px hsl(var(--primary)), 0 0 20px rgba(0,0,0,0.3);
          border-radius: 8px;
        }
      `}</style>
    </>
  );
};

export default GuidedTour;
