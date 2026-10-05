import React, { useState } from 'react';
import { Check, Sparkles, MessageSquare, Building2, ArrowRight, Rocket, Zap, BarChart3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useSubscription } from '@/hooks/useSubscription';
import { CheckoutModal } from './subscription/CheckoutModal';

interface PlanConfig {
  id: 'omni' | 'flow' | 'track' | 'business';
  name: string;
  subtitle: string;
  description: string;
  monthlyPrice: number;
  yearlyPrice: number;
  icon: React.ElementType;
  color: string;
  bgClass: string;
  borderClass: string;
  textClass: string;
  popular?: boolean;
  users: number;
  baseIncluded: string[];
  features: string[];
}

const PLANS: PlanConfig[] = [
  {
    id: 'omni',
    name: 'Start',
    subtitle: 'Para começar',
    description: 'CRM WhatsApp com IA para começar a vender mais hoje.',
    monthlyPrice: 197,
    yearlyPrice: 1970,
    icon: Rocket,
    color: '#374DA4',
    bgClass: 'bg-[#374DA4]/10',
    borderClass: 'border-[#374DA4]',
    textClass: 'text-[#374DA4]',
    users: 2,
    baseIncluded: [
      '1 número de WhatsApp conectado',
      'CRM Kanban de vendas',
      'Agenda + lembretes via WhatsApp',
      'Drive (5 GB)',
    ],
    features: [
      '2 agentes de IA treináveis',
      'ChatBot Builder (3 fluxos)',
      'Disparos e templates',
      'Email marketing (2.000/mês)',
      '2 usuários incluídos',
    ],
  },
  {
    id: 'flow',
    name: 'Flow',
    subtitle: 'Produtividade',
    description: 'Agenda Online, Tarefas, Videoconferência e Fluxos',
    monthlyPrice: 147,
    yearlyPrice: 1470,
    icon: Zap,
    color: '#007DE3',
    bgClass: 'bg-[#007DE3]/10',
    borderClass: 'border-[#007DE3]',
    textClass: 'text-[#007DE3]',
    users: 2,
    baseIncluded: [
      'Dashboard e Home',
      'Gestão (Cadastros)',
      'Drive (5 GB)',
      'Analytics',
    ],
    features: [
      'Minha Agenda (ilimitado)',
      'Agenda Online (2 links)',
      'Tarefas (ilimitado)',
      'Videoconferência (8 participantes)',
      'Gravação (5h/mês)',
    ],
  },
  {
    id: 'track',
    name: 'Track',
    subtitle: 'Rastreamento',
    description: 'Rastreamento de Documentos, Links, Vídeos e Emails',
    monthlyPrice: 97,
    yearlyPrice: 970,
    icon: BarChart3,
    color: '#2ECC71',
    bgClass: 'bg-[#2ECC71]/10',
    borderClass: 'border-[#2ECC71]',
    textClass: 'text-[#2ECC71]',
    users: 2,
    baseIncluded: [
      'Dashboard e Home',
      'Gestão (Cadastros)',
      'Drive (5 GB)',
      'Analytics',
    ],
    features: [
      'Rastrear Documentos (100/mês)',
      'Rastrear Links (200/mês)',
      'Rastrear Vídeos (50/mês)',
      'Analytics de Rastreamento',
    ],
  },
  {
    id: 'business',
    name: 'Business',
    subtitle: 'Mais escolhido',
    description: 'A operação completa para times comerciais que vendem todo dia.',
    monthlyPrice: 297,
    yearlyPrice: 2970,
    icon: Building2,
    color: '#374DA4',
    bgClass: 'bg-[#374DA4]/10',
    borderClass: 'border-[#374DA4]',
    textClass: 'text-[#374DA4]',
    popular: true,
    users: 10,
    baseIncluded: [
      '3 números de WhatsApp',
      'CRM, agenda, tarefas e fluxos',
      'Reuniões com gravação + IA',
      'Drive (50 GB)',
    ],
    features: [
      'Rastreio de documentos e links',
      '5 agentes de IA + chatbot builder',
      'Email marketing (10.000/mês)',
      '10 usuários incluídos',
      'Suporte prioritário',
    ],
  },
];

export function SubscriptionPage() {
  const subscription = useSubscription();
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('yearly');
  const [checkoutPlan, setCheckoutPlan] = useState<typeof PLANS[0] | null>(null);
  const [showCheckout, setShowCheckout] = useState(false);

  const handleSubscribe = (plan: typeof PLANS[0]) => {
    setCheckoutPlan(plan);
    setShowCheckout(true);
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 0,
    }).format(price);
  };

  const isCurrentPlan = (planId: string) => {
    if (planId === 'business' && subscription.planType === 'business') return true;
    if (planId === 'omni' && subscription.hasOmni && !subscription.hasFlow && !subscription.hasTrack) return true;
    if (planId === 'flow' && subscription.hasFlow && !subscription.hasOmni && !subscription.hasTrack) return true;
    if (planId === 'track' && subscription.hasTrack && !subscription.hasOmni && !subscription.hasFlow) return true;
    return false;
  };

  if (subscription.isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse space-y-4 w-full max-w-6xl px-4">
          <div className="h-20 bg-muted rounded-xl" />
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-[500px] bg-muted rounded-xl" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30">
      <div className="container max-w-6xl mx-auto py-12 px-4">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary mb-6">
            <Sparkles className="h-4 w-4" />
            <span className="text-sm font-medium">Escolha seu plano</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            Preços claros. Sem surpresa no boleto.
          </h1>
          <p className="text-muted-foreground text-lg max-w-xl mx-auto">
            7 dias grátis em todos os planos. Cancele quando quiser.
          </p>
          
          {/* Billing Toggle */}
          <div className="flex items-center justify-center gap-4 mt-8 p-1 bg-muted rounded-full w-fit mx-auto">
            <button
              onClick={() => setBillingCycle('monthly')}
              className={cn(
                "px-6 py-2 rounded-full text-sm font-medium transition-all",
                billingCycle === 'monthly' 
                  ? "bg-background shadow-sm text-foreground" 
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              Mensal
            </button>
            <button
              onClick={() => setBillingCycle('yearly')}
              className={cn(
                "px-6 py-2 rounded-full text-sm font-medium transition-all flex items-center gap-2",
                billingCycle === 'yearly' 
                  ? "bg-background shadow-sm text-foreground" 
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              Anual
              <Badge className="bg-primary/20 text-primary text-xs">-17%</Badge>
            </button>
          </div>
        </div>

        {/* Plans Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {PLANS.filter((p) => p.id === 'omni' || p.id === 'business').map((plan) => {
            const Icon = plan.icon;
            const price = billingCycle === 'yearly' ? plan.yearlyPrice : plan.monthlyPrice;
            const monthlyEquivalent = billingCycle === 'yearly' ? Math.round(plan.yearlyPrice / 12) : plan.monthlyPrice;
            const currentPlan = isCurrentPlan(plan.id);
            
            return (
              <Card 
                key={plan.id}
                className={cn(
                  "relative flex flex-col transition-all duration-300 hover:shadow-xl hover:-translate-y-1",
                  plan.popular && `ring-2 ${plan.borderClass} shadow-lg`,
                  currentPlan && "ring-2 ring-primary"
                )}
              >
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-10">
                    <Badge className="bg-[#374DA4] text-white shadow-lg px-4">
                      Mais escolhido
                    </Badge>
                  </div>
                )}
                
                {currentPlan && (
                  <div className="absolute -top-3 right-4 z-10">
                    <Badge variant="outline" className="bg-background">
                      Seu Plano
                    </Badge>
                  </div>
                )}
                
                <CardHeader className="text-center pb-4 pt-8">
                  <div className={cn(
                    "w-16 h-16 rounded-2xl mx-auto flex items-center justify-center mb-4",
                    plan.bgClass
                  )}>
                    <Icon className={cn("h-8 w-8", plan.textClass)} />
                  </div>
                  <div className="space-y-1">
                    <CardTitle className="text-2xl">{plan.name}</CardTitle>
                    <Badge variant="secondary" className={cn("text-xs", plan.bgClass, plan.textClass)}>
                      {plan.subtitle}
                    </Badge>
                  </div>
                  <CardDescription className="mt-2 min-h-[40px]">
                    {plan.description}
                  </CardDescription>
                </CardHeader>
                
                <CardContent className="flex-1 space-y-6">
                  {/* Price */}
                  <div className="text-center">
                    <div className="flex items-baseline justify-center gap-1">
                      <span className="text-4xl font-bold">{formatPrice(monthlyEquivalent)}</span>
                      <span className="text-muted-foreground">/mês</span>
                    </div>
                    {billingCycle === 'yearly' && (
                      <p className="text-sm text-muted-foreground mt-1">
                        {formatPrice(price)}/ano
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground mt-2">
                      {plan.users} usuários incluídos
                    </p>
                  </div>
                  
                  {/* Base Included */}
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Ellosuit Base incluído
                    </p>
                    <ul className="space-y-1.5">
                      {plan.baseIncluded.map((feature, index) => (
                        <li key={index} className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Check className="h-3 w-3 text-muted-foreground/50 flex-shrink-0" />
                          <span>{feature}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  
                  {/* Plan Features */}
                  <div className="space-y-2">
                    <p className={cn("text-xs font-medium uppercase tracking-wider", plan.textClass)}>
                      Recursos do {plan.name}
                    </p>
                    <ul className="space-y-2">
                      {plan.features.map((feature, index) => (
                        <li key={index} className="flex items-start gap-2 text-sm">
                          <Check className={cn("h-4 w-4 mt-0.5 flex-shrink-0", plan.textClass)} />
                          <span>{feature}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </CardContent>
                
                <CardFooter className="pt-4">
                  <Button 
                    className={cn(
                      "w-full h-12 text-base",
                      plan.popular && "bg-[#374DA4] hover:bg-[#374DA4]/90"
                    )}
                    variant={currentPlan ? "outline" : plan.popular ? "default" : "outline"}
                    disabled={currentPlan}
                    onClick={() => handleSubscribe(plan)}
                  >
                    {currentPlan ? (
                      'Plano Atual'
                    ) : (
                      <>
                        Assinar {plan.name}
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </>
                    )}
                  </Button>
                </CardFooter>
              </Card>
            );
          })}

          {/* Enterprise card (static) */}
          <Card className="relative flex flex-col transition-all duration-300 hover:shadow-xl hover:-translate-y-1 border-dashed">
            <CardHeader className="text-center pb-4 pt-8">
              <div className="w-16 h-16 rounded-2xl mx-auto flex items-center justify-center mb-4 bg-gray-900/5">
                <Sparkles className="h-8 w-8 text-gray-900" />
              </div>
              <div className="space-y-1">
                <CardTitle className="text-2xl">Enterprise</CardTitle>
                <Badge variant="secondary" className="text-xs">Sob medida</Badge>
              </div>
              <CardDescription className="mt-2 min-h-[40px]">
                Para operações que exigem escala, SLA e IA dedicada.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex-1 space-y-6">
              <div className="text-center">
                <div className="text-3xl font-bold">Sob consulta</div>
                <p className="text-xs text-muted-foreground mt-2">Usuários ilimitados</p>
              </div>
              <div className="space-y-2">
                <p className="text-xs font-medium uppercase tracking-wider text-gray-900">
                  Tudo do Business +
                </p>
                <ul className="space-y-2">
                  {[
                    'Números e usuários ilimitados',
                    'API Oficial WhatsApp (Meta)',
                    'IA dedicada e treinamento custom',
                    'Onboarding assistido',
                    'SLA 99,9% + suporte dedicado',
                    'Integrações sob demanda',
                  ].map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm">
                      <Check className="h-4 w-4 mt-0.5 flex-shrink-0 text-gray-900" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </CardContent>
            <CardFooter className="pt-4">
              <Button
                variant="outline"
                className="w-full h-12 text-base"
                onClick={() => window.open('https://wa.me/5541985350504?text=Quero%20conhecer%20o%20plano%20Enterprise%20da%20Ellosuit', '_blank')}
              >
                Falar com vendas
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </CardFooter>
          </Card>
        </div>

        {/* Footer Info */}
        <div className="mt-12 text-center">
          <p className="text-sm text-muted-foreground">
            ✓ 7 dias de teste grátis &nbsp;&nbsp; ✓ Cancele quando quiser &nbsp;&nbsp; ✓ Suporte em português
          </p>
        </div>

        {/* Current Subscription Info */}
        {subscription.isActive && (
          <Card className="mt-12 bg-muted/30 border-dashed">
            <CardContent className="py-6">
              <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                <div>
                  <h3 className="font-semibold mb-1 flex items-center gap-2">
                    Sua assinatura atual
                    {subscription.status === 'trialing' && (
                      <Badge variant="secondary">Período de teste</Badge>
                    )}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {subscription.currentPeriodEnd && (
                      <>Próxima cobrança em {subscription.currentPeriodEnd.toLocaleDateString('pt-BR')}</>
                    )}
                  </p>
                </div>
                <div className="flex gap-3">
                  <Button variant="outline" size="sm">
                    Gerenciar Pagamento
                  </Button>
                  <Button variant="ghost" size="sm" className="text-muted-foreground">
                    Cancelar
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Checkout Modal */}
        {checkoutPlan && (
          <CheckoutModal
            open={showCheckout}
            onOpenChange={setShowCheckout}
            plan={checkoutPlan}
            billingCycle={billingCycle}
          />
        )}
      </div>
    </div>
  );
}

export default SubscriptionPage;
