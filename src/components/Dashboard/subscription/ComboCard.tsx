import React from 'react';
import { Check, Crown, Building2, Sparkles } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { PlanType } from '@/hooks/useSubscription';

interface ComboCardProps {
  type: 'pro' | 'business' | 'enterprise';
  isCurrentPlan: boolean;
  onSelect: (type: PlanType) => void;
}

const comboConfig = {
  pro: {
    name: 'Pro',
    description: 'Para equipes em crescimento',
    monthlyPrice: 297,
    yearlyPrice: 2970,
    users: 5,
    discount: 15,
    icon: Crown,
    popular: true,
    modules: ['Base', 'Omni', 'Flow'],
    highlights: [
      '5 usuários incluídos',
      'CRM WhatsApp completo',
      'Videoconferência para 8 pessoas',
      'Email Marketing 2.000/mês',
      'Agenda Online (2 links)',
    ],
  },
  business: {
    name: 'Business',
    description: 'Para empresas consolidadas',
    monthlyPrice: 397,
    yearlyPrice: 3970,
    users: 10,
    discount: 18,
    icon: Building2,
    popular: false,
    modules: ['Base', 'Omni', 'Flow', 'Track'],
    highlights: [
      '10 usuários incluídos',
      'Todos os módulos',
      'Rastreamento completo',
      'Email Marketing 5.000/mês',
      'Videoconferência para 15 pessoas',
      'Gravação de reuniões (10h)',
    ],
  },
  enterprise: {
    name: 'Enterprise',
    description: 'Para grandes operações',
    monthlyPrice: 797,
    yearlyPrice: 7970,
    users: -1, // unlimited
    discount: 17,
    icon: Sparkles,
    popular: false,
    modules: ['Tudo Ilimitado'],
    highlights: [
      'Usuários ilimitados',
      'Todos os recursos ilimitados',
      'WhatsApp multi-sessão',
      'Suporte prioritário 24/7',
      'Onboarding dedicado',
      'API de integrações',
    ],
  },
};

export function ComboCard({ type, isCurrentPlan, onSelect }: ComboCardProps) {
  const config = comboConfig[type];
  const Icon = config.icon;

  return (
    <Card
      className={cn(
        'relative transition-all duration-300 hover:shadow-lg',
        config.popular && 'border-primary shadow-lg scale-[1.02]',
        isCurrentPlan && 'ring-2 ring-primary'
      )}
    >
      {config.popular && (
        <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary shadow-md">
          Mais Popular
        </Badge>
      )}
      
      {isCurrentPlan && (
        <Badge variant="outline" className="absolute -top-3 right-4 bg-background">
          Plano Atual
        </Badge>
      )}

      <CardHeader className="text-center pb-2">
        <div className={cn(
          'w-14 h-14 rounded-2xl mx-auto flex items-center justify-center mb-4',
          config.popular ? 'bg-primary text-primary-foreground' : 'bg-muted'
        )}>
          <Icon className="h-7 w-7" />
        </div>
        <CardTitle className="text-xl">{config.name}</CardTitle>
        <CardDescription>{config.description}</CardDescription>
      </CardHeader>

      <CardContent>
        {/* Price */}
        <div className="text-center mb-4">
          <div className="flex items-baseline justify-center gap-1">
            <span className="text-3xl font-bold">R$ {config.monthlyPrice}</span>
            <span className="text-muted-foreground">/mês</span>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            ou R$ {config.yearlyPrice}/ano
            <Badge variant="secondary" className="ml-2 bg-primary/10 text-primary">
              -{config.discount}%
            </Badge>
          </p>
        </div>

        {/* Users */}
        <div className="bg-muted/50 rounded-lg p-3 mb-4 text-center">
          <span className="font-medium">
            {config.users === -1 ? 'Usuários ilimitados' : `${config.users} usuários incluídos`}
          </span>
        </div>

        {/* Modules */}
        <div className="flex flex-wrap gap-1 justify-center mb-4">
          {config.modules.map((module) => (
            <Badge key={module} variant="secondary" className="text-xs">
              {module}
            </Badge>
          ))}
        </div>

        {/* Features */}
        <ul className="space-y-2 mb-6">
          {config.highlights.map((feature, index) => (
            <li key={index} className="flex items-start gap-2 text-sm">
              <Check className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
              <span>{feature}</span>
            </li>
          ))}
        </ul>

        <Button
          className="w-full"
          variant={isCurrentPlan ? 'outline' : config.popular ? 'default' : 'outline'}
          disabled={isCurrentPlan}
          onClick={() => onSelect(type)}
        >
          {isCurrentPlan ? 'Plano Atual' : 'Selecionar'}
        </Button>
      </CardContent>
    </Card>
  );
}

export { comboConfig };
