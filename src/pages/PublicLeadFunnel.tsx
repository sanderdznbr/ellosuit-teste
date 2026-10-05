import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { ArrowRight, ArrowLeft, Check, Loader2, Star, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

interface ImageOption {
  id: string;
  imageUrl: string;
  label: string;
  nextStepId?: string;
}

interface StepField {
  id: string;
  type: string;
  label: string;
  placeholder?: string;
  required?: boolean;
  options?: string[];
  imageOptions?: ImageOption[];
  max?: number;
  size?: 'sm' | 'md' | 'lg';
  align?: 'left' | 'center' | 'right';
}

interface FunnelStep {
  id: string;
  position: number;
  step_type: string;
  title: string;
  description: string;
  content: any;
  required: boolean;
}

interface LeadFunnel {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  is_active: boolean;
  settings: any;
}

const PublicLeadFunnel: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  
  const [funnel, setFunnel] = useState<LeadFunnel | null>(null);
  const [steps, setSteps] = useState<FunnelStep[]>([]);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [sessionId, setSessionId] = useState('');
  const [submissionId, setSubmissionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setSessionId(`session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`);
  }, []);

  useEffect(() => {
    const loadFunnel = async () => {
      if (!slug) return;

      setLoading(true);

      let { data: funnelData, error: funnelError } = await supabase
        .from('lead_funnels')
        .select('*')
        .eq('slug', slug)
        .eq('is_active', true)
        .single();

      if (funnelError || !funnelData) {
        const { data: inactiveFunnel } = await supabase
          .from('lead_funnels')
          .select('id, is_active')
          .eq('slug', slug)
          .single();
        
        if (inactiveFunnel && !inactiveFunnel.is_active) {
          setError('Este funil está pausado. Entre em contato com o administrador.');
        } else {
          setError('Funil não encontrado. Verifique o link e tente novamente.');
        }
        setLoading(false);
        return;
      }

      setFunnel(funnelData);

      const { data: stepsData } = await supabase
        .from('lead_funnel_steps')
        .select('*')
        .eq('funnel_id', funnelData.id)
        .order('position', { ascending: true });

      if (stepsData && stepsData.length > 0) {
        setSteps(stepsData.map(s => ({
          ...s,
          title: s.title || '',
          description: s.description || '',
          content: s.content || {}
        })));
      } else {
        setError('Este funil não possui etapas configuradas.');
      }

      setLoading(false);
    };

    loadFunnel();
  }, [slug]);

  useEffect(() => {
    const trackSubmission = async () => {
      if (!funnel || !sessionId || steps.length === 0) return;

      if (!submissionId) {
        const { data } = await supabase
          .from('lead_submissions')
          .insert({
            funnel_id: funnel.id,
            session_id: sessionId,
            status: 'in_progress',
            current_step: 1,
            answers: {},
            metadata: {
              userAgent: navigator.userAgent,
              referrer: document.referrer,
              startedAt: new Date().toISOString(),
              device: /Mobile|Android|iPhone/i.test(navigator.userAgent) ? 'mobile' : 'desktop'
            }
          })
          .select()
          .single();

        if (data) {
          setSubmissionId(data.id);
        }

        await supabase.from('lead_step_events').insert({
          funnel_id: funnel.id,
          step_id: steps[0]?.id || null,
          event_type: 'view',
          metadata: { stepIndex: 0 }
        });
      }
    };

    trackSubmission();
  }, [funnel, sessionId, steps]);

  const currentStep = steps[currentStepIndex];
  const progress = steps.length > 0 ? ((currentStepIndex + 1) / steps.length) * 100 : 0;
  const buttonColor = funnel?.settings?.buttonColor || '#8B5CF6';
  const backgroundColor = funnel?.settings?.backgroundColor || '#FFFFFF';
  const thankYouMessage = funnel?.settings?.thankYouMessage || 'Sua resposta foi enviada com sucesso.';

  const setFieldAnswer = (fieldId: string, value: any) => {
    setAnswers(prev => ({ ...prev, [fieldId]: value }));
  };

  // For legacy single-field steps
  const setAnswer = (value: any) => {
    if (!currentStep) return;
    setAnswers(prev => ({ ...prev, [currentStep.id]: value }));
  };

  const canProceed = () => {
    if (!currentStep) return false;
    
    // Check if step has multiple fields
    const fields = currentStep.content?.fields;
    if (fields && fields.length > 0) {
      return fields.every((field: StepField) => {
        if (!field.required) return true;
        const answer = answers[field.id];
        if (answer === undefined || answer === null || answer === '') return false;
        if (Array.isArray(answer) && answer.length === 0) return false;
        return true;
      });
    }
    
    // Legacy single-field behavior
    if (!currentStep.required) return true;
    const answer = answers[currentStep.id];
    if (answer === undefined || answer === null || answer === '') return false;
    if (Array.isArray(answer) && answer.length === 0) return false;
    return true;
  };

  const goNext = async () => {
    if (!canProceed() || !funnel) return;

    await supabase.from('lead_step_events').insert({
      funnel_id: funnel.id,
      step_id: currentStep.id,
      submission_id: submissionId,
      event_type: 'complete',
      metadata: { stepIndex: currentStepIndex, answers }
    });

    if (submissionId) {
      await supabase
        .from('lead_submissions')
        .update({
          current_step: currentStepIndex + 2,
          answers
        })
        .eq('id', submissionId);
    }

    // Check for conditional navigation from image_choice fields
    const fields = currentStep?.content?.fields as StepField[] | undefined;
    let targetStepId: string | null = null;
    
    if (fields) {
      for (const field of fields) {
        if (field.type === 'image_choice' && field.imageOptions) {
          const selectedOptionId = answers[field.id];
          const selectedOption = field.imageOptions.find(opt => opt.id === selectedOptionId);
          if (selectedOption?.nextStepId) {
            targetStepId = selectedOption.nextStepId;
            break;
          }
        }
      }
    }

    if (targetStepId) {
      // Conditional navigation - find the target step index
      const targetIndex = steps.findIndex(s => s.id === targetStepId);
      if (targetIndex !== -1) {
        setCurrentStepIndex(targetIndex);
        
        await supabase.from('lead_step_events').insert({
          funnel_id: funnel.id,
          step_id: steps[targetIndex]?.id || null,
          submission_id: submissionId,
          event_type: 'view',
          metadata: { stepIndex: targetIndex, conditionalNavigation: true }
        });
        return;
      }
    }

    // Default linear navigation
    if (currentStepIndex < steps.length - 1) {
      setCurrentStepIndex(prev => prev + 1);
      
      await supabase.from('lead_step_events').insert({
        funnel_id: funnel.id,
        step_id: steps[currentStepIndex + 1]?.id || null,
        submission_id: submissionId,
        event_type: 'view',
        metadata: { stepIndex: currentStepIndex + 1 }
      });
    } else {
      setSubmitting(true);
      
      if (submissionId) {
        await supabase
          .from('lead_submissions')
          .update({
            status: 'completed',
            answers,
            completed_at: new Date().toISOString()
          })
          .eq('id', submissionId);
      }

      setCompleted(true);
      setSubmitting(false);
    }
  };

  const goBack = () => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex(prev => prev - 1);
    }
  };

  // Render a single field input
  const renderFieldInput = (field: StepField, answerId: string) => {
    const value = answers[answerId];

    switch (field.type) {
      case 'text':
      case 'name':
      case 'company':
        return (
          <Input
            value={value || ''}
            onChange={(e) => setFieldAnswer(answerId, e.target.value)}
            placeholder={field.placeholder || field.label}
            className="text-base py-5"
          />
        );

      case 'email':
        return (
          <Input
            type="email"
            value={value || ''}
            onChange={(e) => setFieldAnswer(answerId, e.target.value)}
            placeholder={field.placeholder || 'seu@email.com'}
            className="text-base py-5"
          />
        );

      case 'phone':
        return (
          <Input
            type="tel"
            value={value || ''}
            onChange={(e) => setFieldAnswer(answerId, e.target.value)}
            placeholder={field.placeholder || '(00) 00000-0000'}
            className="text-base py-5"
          />
        );

      case 'number':
        return (
          <Input
            type="number"
            value={value || ''}
            onChange={(e) => setFieldAnswer(answerId, e.target.value)}
            placeholder={field.placeholder || 'Digite um número'}
            className="text-base py-5"
          />
        );

      case 'url':
        return (
          <Input
            type="url"
            value={value || ''}
            onChange={(e) => setFieldAnswer(answerId, e.target.value)}
            placeholder={field.placeholder || 'https://exemplo.com'}
            className="text-base py-5"
          />
        );

      case 'date':
        return (
          <Input
            type="date"
            value={value || ''}
            onChange={(e) => setFieldAnswer(answerId, e.target.value)}
            className="text-base py-5"
          />
        );

      case 'address':
      case 'textarea':
        return (
          <Textarea
            value={value || ''}
            onChange={(e) => setFieldAnswer(answerId, e.target.value)}
            placeholder={field.placeholder || field.label}
            rows={field.type === 'address' ? 2 : 4}
            className="text-base"
          />
        );

      case 'single_choice':
        return (
          <RadioGroup
            value={value || ''}
            onValueChange={(v) => setFieldAnswer(answerId, v)}
            className="space-y-2"
          >
            {(field.options || []).map((option, idx) => (
              <label
                key={idx}
                className={cn(
                  "flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all",
                  value === option
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/50"
                )}
              >
                <RadioGroupItem value={option} />
                <span>{option}</span>
              </label>
            ))}
          </RadioGroup>
        );

      case 'multiple_choice':
        return (
          <div className="space-y-2">
            {(field.options || []).map((option, idx) => {
              const selected = Array.isArray(value) && value.includes(option);
              return (
                <label
                  key={idx}
                  className={cn(
                    "flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all",
                    selected
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/50"
                  )}
                >
                  <Checkbox
                    checked={selected}
                    onCheckedChange={(checked) => {
                      const current = Array.isArray(value) ? value : [];
                      if (checked) {
                        setFieldAnswer(answerId, [...current, option]);
                      } else {
                        setFieldAnswer(answerId, current.filter((a: string) => a !== option));
                      }
                    }}
                  />
                  <span>{option}</span>
                </label>
              );
            })}
          </div>
        );

      case 'rating':
        const max = field.max || 5;
        return (
          <div className="flex items-center justify-center gap-1">
            {Array.from({ length: max }, (_, i) => i + 1).map(num => (
              <button
                key={num}
                onClick={() => setFieldAnswer(answerId, num)}
                className={cn(
                  "p-2 rounded-lg transition-all",
                  value >= num
                    ? "text-yellow-500"
                    : "text-muted-foreground hover:text-yellow-400"
                )}
              >
                <Star className={cn("h-7 w-7", value >= num && "fill-current")} />
              </button>
            ))}
          </div>
        );

      case 'image_choice':
        return (
          <div className="grid grid-cols-2 gap-3">
            {(field.imageOptions || []).map((opt) => {
              const isSelected = value === opt.id;
              return (
                <button
                  key={opt.id}
                  onClick={() => {
                    setFieldAnswer(answerId, opt.id);
                    // Store the nextStepId for conditional navigation
                    if (opt.nextStepId) {
                      setFieldAnswer(`${answerId}_nextStep`, opt.nextStepId);
                    }
                  }}
                  className={cn(
                    "rounded-xl border-2 overflow-hidden transition-all",
                    isSelected
                      ? "border-primary ring-2 ring-primary/20"
                      : "border-border hover:border-primary/50"
                  )}
                >
                  <div className="aspect-video bg-muted flex items-center justify-center overflow-hidden">
                    {opt.imageUrl ? (
                      <img 
                        src={opt.imageUrl} 
                        alt={opt.label} 
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="text-muted-foreground text-xs">Sem imagem</div>
                    )}
                  </div>
                  <div className={cn(
                    "p-2 text-center text-sm font-medium transition-colors",
                    isSelected ? "bg-primary/10 text-primary" : "bg-card"
                  )}>
                    {opt.label}
                  </div>
                  {isSelected && (
                    <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                      <Check className="h-3 w-3 text-primary-foreground" />
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        );

      case 'heading':
        return (
          <h2 className={cn(
            "font-bold",
            field.size === 'lg' ? 'text-2xl' : field.size === 'sm' ? 'text-lg' : 'text-xl',
            field.align === 'center' ? 'text-center' : field.align === 'right' ? 'text-right' : 'text-left'
          )}>
            {field.label}
          </h2>
        );

      case 'paragraph':
        return (
          <p className={cn(
            "text-muted-foreground",
            field.align === 'center' ? 'text-center' : field.align === 'right' ? 'text-right' : 'text-left'
          )}>
            {field.label}
          </p>
        );

      default:
        return (
          <Input
            value={value || ''}
            onChange={(e) => setFieldAnswer(answerId, e.target.value)}
            placeholder={field.placeholder || 'Digite sua resposta...'}
            className="text-base py-5"
          />
        );
    }
  };

  // Render step content (supports multiple fields per step)
  const renderStepContent = () => {
    if (!currentStep) return null;

    const fields = currentStep.content?.fields as StepField[] | undefined;

    // New multi-field mode
    if (fields && fields.length > 0) {
      return (
        <div className="space-y-5">
          {fields.map((field) => {
            // Layout fields (heading, paragraph) don't need a label wrapper
            if (field.type === 'heading' || field.type === 'paragraph') {
              return (
                <div key={field.id}>
                  {renderFieldInput(field, field.id)}
                </div>
              );
            }
            
            return (
              <div key={field.id} className="space-y-2">
                <label className="text-sm font-medium text-foreground">
                  {field.label}
                  {field.required && <span className="text-red-500 ml-1">*</span>}
                </label>
                {renderFieldInput(field, field.id)}
              </div>
            );
          })}
        </div>
      );
    }

    // Legacy single-field mode
    const answer = answers[currentStep.id];

    switch (currentStep.step_type) {
      case 'text':
      case 'name':
      case 'company':
        return (
          <Input
            value={answer || ''}
            onChange={(e) => setAnswer(e.target.value)}
            placeholder={
              currentStep.step_type === 'name' ? 'Nome completo' :
              currentStep.step_type === 'company' ? 'Nome da empresa' :
              'Digite sua resposta...'
            }
            className="text-lg py-6"
          />
        );

      case 'email':
        return (
          <Input
            type="email"
            value={answer || ''}
            onChange={(e) => setAnswer(e.target.value)}
            placeholder="seu@email.com"
            className="text-lg py-6"
          />
        );

      case 'phone':
        return (
          <Input
            type="tel"
            value={answer || ''}
            onChange={(e) => setAnswer(e.target.value)}
            placeholder="(00) 00000-0000"
            className="text-lg py-6"
          />
        );

      case 'number':
        return (
          <Input
            type="number"
            value={answer || ''}
            onChange={(e) => setAnswer(e.target.value)}
            placeholder="Digite um número"
            className="text-lg py-6"
          />
        );

      case 'url':
        return (
          <Input
            type="url"
            value={answer || ''}
            onChange={(e) => setAnswer(e.target.value)}
            placeholder="https://exemplo.com"
            className="text-lg py-6"
          />
        );

      case 'date':
        return (
          <Input
            type="date"
            value={answer || ''}
            onChange={(e) => setAnswer(e.target.value)}
            className="text-lg py-6"
          />
        );

      case 'address':
      case 'textarea':
        return (
          <Textarea
            value={answer || ''}
            onChange={(e) => setAnswer(e.target.value)}
            placeholder={currentStep.step_type === 'address' ? 'Digite seu endereço completo...' : 'Digite sua resposta...'}
            rows={currentStep.step_type === 'address' ? 2 : 4}
            className="text-lg"
          />
        );

      case 'single_choice':
        return (
          <RadioGroup
            value={answer || ''}
            onValueChange={setAnswer}
            className="space-y-3"
          >
            {(currentStep.content?.options || []).map((option: string, idx: number) => (
              <label
                key={idx}
                className={cn(
                  "flex items-center gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all",
                  answer === option
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/50"
                )}
              >
                <RadioGroupItem value={option} />
                <span className="text-base">{option}</span>
              </label>
            ))}
          </RadioGroup>
        );

      case 'multiple_choice':
        return (
          <div className="space-y-3">
            {(currentStep.content?.options || []).map((option: string, idx: number) => {
              const selected = Array.isArray(answer) && answer.includes(option);
              return (
                <label
                  key={idx}
                  className={cn(
                    "flex items-center gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all",
                    selected
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/50"
                  )}
                >
                  <Checkbox
                    checked={selected}
                    onCheckedChange={(checked) => {
                      const current = Array.isArray(answer) ? answer : [];
                      if (checked) {
                        setAnswer([...current, option]);
                      } else {
                        setAnswer(current.filter((a: string) => a !== option));
                      }
                    }}
                  />
                  <span className="text-base">{option}</span>
                </label>
              );
            })}
          </div>
        );

      case 'rating':
        const max = currentStep.content?.max || 5;
        return (
          <div className="flex items-center justify-center gap-2">
            {Array.from({ length: max }, (_, i) => i + 1).map(num => (
              <button
                key={num}
                onClick={() => setAnswer(num)}
                className={cn(
                  "p-3 rounded-xl transition-all",
                  answer >= num
                    ? "text-yellow-500"
                    : "text-muted-foreground hover:text-yellow-400"
                )}
              >
                <Star className={cn("h-8 w-8", answer >= num && "fill-current")} />
              </button>
            ))}
          </div>
        );

      case 'cta':
        return (
          <Button
            size="lg"
            className="w-full py-6 text-lg"
            style={{ backgroundColor: buttonColor }}
            onClick={goNext}
          >
            {currentStep.content?.buttonText || 'Continuar'}
          </Button>
        );

      default:
        return null;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor }}>
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ backgroundColor }}>
        <Card className="max-w-md w-full shadow-lg">
          <CardContent className="pt-6 text-center">
            <p className="text-muted-foreground">{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (completed) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ backgroundColor }}>
        <Card className="max-w-md w-full shadow-lg">
          <CardContent className="pt-8 pb-8 text-center">
            <div 
              className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
              style={{ backgroundColor: `${buttonColor}20` }}
            >
              <CheckCircle className="h-8 w-8" style={{ color: buttonColor }} />
            </div>
            <h2 className="text-2xl font-bold mb-2">Obrigado!</h2>
            <p className="text-muted-foreground">
              {thankYouMessage}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4" style={{ backgroundColor }}>
      <div className="max-w-xl mx-auto pt-8">
        {/* Progress */}
        <div className="mb-8">
          <div className="flex items-center justify-between text-sm text-muted-foreground mb-2">
            <span>Etapa {currentStepIndex + 1} de {steps.length}</span>
            <span>{Math.round(progress)}%</span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>

        {/* Step Card */}
        <Card className="shadow-xl border-0">
          <CardContent className="p-8">
            {/* Title */}
            <h1 className="text-2xl font-bold text-foreground mb-2">
              {currentStep?.title || `Etapa ${currentStepIndex + 1}`}
            </h1>
            
            {/* Description */}
            {currentStep?.description && (
              <p className="text-muted-foreground mb-6">
                {currentStep.description}
              </p>
            )}

            {/* Content */}
            <div className="mb-8">
              {renderStepContent()}
            </div>

            {/* Navigation */}
            {currentStep?.step_type !== 'cta' && (
              <div className="flex items-center gap-3">
                {currentStepIndex > 0 && (
                  <Button variant="outline" onClick={goBack} className="gap-2">
                    <ArrowLeft className="h-4 w-4" />
                    Voltar
                  </Button>
                )}
                <Button
                  className="flex-1 gap-2"
                  style={{ backgroundColor: buttonColor }}
                  onClick={goNext}
                  disabled={!canProceed() || submitting}
                >
                  {submitting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : currentStepIndex === steps.length - 1 ? (
                    <>
                      Enviar
                      <Check className="h-4 w-4" />
                    </>
                  ) : (
                    <>
                      Continuar
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Powered by */}
        <p className="text-center text-xs text-muted-foreground mt-6">
          Powered by Ellosuit
        </p>
      </div>
    </div>
  );
};

export default PublicLeadFunnel;
