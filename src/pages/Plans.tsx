import React, { useState } from 'react';
import { Check, ArrowLeft, Sparkles, Crown, Building2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useNavigate } from 'react-router-dom';
import ellosuitLogo from '@/assets/logoellosuit.png';

interface Plan {
  name: string;
  description: string;
  monthlyPrice: number;
  yearlyPrice: number;
  users: number | string;
  highlighted: boolean;
  cta: string;
  ctaAction: 'trial';
  modules: string[];
  features: string[];
  discount: number;
  icon: React.ElementType;
}

const PLANS: Plan[] = [
  {
    name: 'Pro',
    description: 'Para equipes em crescimento',
    monthlyPrice: 297,
    yearlyPrice: 2970,
    users: 5,
    highlighted: false,
    cta: 'Teste grátis 7 dias',
    ctaAction: 'trial',
    discount: 15,
    icon: Crown,
    modules: ['Base', 'Omni', 'Flow'],
    features: [
      '5 usuários incluídos',
      'CRM WhatsApp completo',
      'Videoconferência para 8 pessoas',
      'Email Marketing 2.000/mês',
      'Agenda Online (2 links)',
    ],
  },
  {
    name: 'Business',
    description: 'Para empresas consolidadas',
    monthlyPrice: 397,
    yearlyPrice: 3970,
    users: 10,
    highlighted: true,
    cta: 'Teste grátis 7 dias',
    ctaAction: 'trial',
    discount: 18,
    icon: Building2,
    modules: ['Base', 'Omni', 'Flow', 'Track'],
    features: [
      '10 usuários incluídos',
      'Todos os módulos',
      'Rastreamento completo',
      'Email Marketing 5.000/mês',
      'Videoconferência para 15 pessoas',
      'Gravação de reuniões (10h)',
    ],
  },
  {
    name: 'Enterprise',
    description: 'Para grandes operações',
    monthlyPrice: 797,
    yearlyPrice: 7970,
    users: 'Ilimitados',
    highlighted: false,
    cta: 'Teste grátis 7 dias',
    ctaAction: 'trial',
    discount: 17,
    icon: Sparkles,
    modules: ['Tudo Ilimitado'],
    features: [
      'Usuários ilimitados',
      'Todos os recursos ilimitados',
      'WhatsApp multi-sessão',
      'Suporte prioritário 24/7',
      'Onboarding dedicado',
      'API de integrações',
    ],
  },
];

export default function Plans() {
  const navigate = useNavigate();
  const [billing, setBilling] = useState<'monthly' | 'yearly'>('monthly');

  const handleSelectPlan = () => {
    navigate('/checkout/ativar');
  };

  return (
    <div className="min-h-screen bg-background overflow-y-auto">
      {/* Header */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-6 flex items-center justify-between">
        <img src={ellosuitLogo} alt="Ellosuit" className="h-8 w-auto" />
        <button
          onClick={() => navigate('/dashboard')}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
        >
          <ArrowLeft className="h-4 w-4" />
          Continuar grátis
        </button>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10 pb-20">
        <div className="text-center mb-12">
          <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-3">
            Escolha o plano ideal para você
          </h1>
          <p className="text-muted-foreground">
            Cancele a qualquer momento. Sem compromisso.
          </p>

          {/* Billing toggle */}
          <div className="mt-8 inline-flex items-center gap-1 p-1 rounded-full border border-border bg-card">
            <button
              onClick={() => setBilling('monthly')}
              className={`px-5 py-2 rounded-full text-sm font-medium transition-colors ${
                billing === 'monthly' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Mensal
            </button>
            <button
              onClick={() => setBilling('yearly')}
              className={`px-5 py-2 rounded-full text-sm font-medium transition-colors inline-flex items-center gap-2 ${
                billing === 'yearly' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Anual
              <Badge variant="secondary" className={`text-[10px] ${billing === 'yearly' ? 'bg-primary-foreground/20 text-primary-foreground' : 'bg-primary/10 text-primary'}`}>
                economize 2 meses
              </Badge>
            </button>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {PLANS.map((plan) => {
            const Icon = plan.icon;
            return (
              <div
                key={plan.name}
                className={`relative rounded-2xl border p-6 flex flex-col transition-shadow ${
                  plan.highlighted
                    ? 'border-primary bg-primary/[0.03] shadow-lg shadow-primary/10'
                    : 'border-border bg-card'
                }`}
              >
                {plan.highlighted && (
                  <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground px-4 py-1 text-xs font-semibold">
                    Recomendado
                  </Badge>
                )}

                <div className="flex items-center gap-3 mb-4">
                  <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${
                    plan.highlighted ? 'bg-primary text-primary-foreground' : 'bg-muted'
                  }`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-foreground">{plan.name}</h3>
                    <p className="text-xs text-muted-foreground">{plan.description}</p>
                  </div>
                </div>

                <div className="mb-4">
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-3xl font-bold text-foreground">
                      R$ {billing === 'monthly' ? plan.monthlyPrice : Math.round(plan.yearlyPrice / 12)}
                    </span>
                    <span className="text-sm text-muted-foreground">/mês</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {billing === 'monthly' ? (
                      <>cobrado mensalmente</>
                    ) : (
                      <>
                        R$ {plan.yearlyPrice} cobrado 1x/ano
                        <Badge variant="secondary" className="ml-2 bg-primary/10 text-primary text-[10px]">
                          -{plan.discount}%
                        </Badge>
                      </>
                    )}
                  </p>
                </div>

                {/* Users */}
                <div className="bg-muted/50 rounded-lg p-2.5 mb-4 text-center text-sm font-medium">
                  {typeof plan.users === 'number' ? `${plan.users} usuários incluídos` : `Usuários ${plan.users}`}
                </div>

                {/* Modules */}
                <div className="flex flex-wrap gap-1 mb-4">
                  {plan.modules.map((mod) => (
                    <Badge key={mod} variant="secondary" className="text-xs">{mod}</Badge>
                  ))}
                </div>

                <Button
                  onClick={handleSelectPlan}
                  className={`w-full h-11 rounded-full text-sm font-medium mb-6 ${
                    plan.highlighted
                      ? ''
                      : 'bg-background text-foreground border border-border hover:bg-muted'
                  }`}
                  variant={plan.highlighted ? 'default' : 'outline'}
                >
                  <Sparkles className="mr-2 h-4 w-4" />
                  {plan.cta}
                </Button>

                <div className="border-t border-border pt-5 flex-1">
                  <ul className="space-y-2.5">
                    {plan.features.map((f, i) => (
                      <li key={i} className="flex items-start gap-2.5 text-sm text-muted-foreground">
                        <Check className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
                        {f}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
