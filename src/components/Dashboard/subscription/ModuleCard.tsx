import React from 'react';
import { Check, MessageSquare, Zap, BarChart3 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import type { ModuleType } from '@/hooks/useSubscription';

interface ModuleCardProps {
  type: ModuleType;
  isSelected: boolean;
  isOwned: boolean;
  onToggle: (type: ModuleType) => void;
  disabled?: boolean;
}

const moduleConfig = {
  omni: {
    name: 'Omni',
    subtitle: 'Comunicação',
    description: 'CRM WhatsApp, Email Marketing, Agentes de IA e ChatBot Builder',
    price: 147,
    color: 'hsl(24, 100%, 45%)', // #E34800
    bgClass: 'bg-[#E34800]/10',
    borderClass: 'border-[#E34800]',
    textClass: 'text-[#E34800]',
    icon: MessageSquare,
    features: [
      'CRM WhatsApp (1 sessão)',
      'Email Marketing (2.000/mês)',
      'Agentes de IA (2)',
      'ChatBot Builder (3 fluxos)',
      'Alternância de CRMs',
    ],
  },
  flow: {
    name: 'Flow',
    subtitle: 'Produtividade',
    description: 'Agenda Online, Tarefas, Videoconferência e Fluxos de Trabalho',
    price: 97,
    color: 'hsl(210, 100%, 45%)', // #007DE3
    bgClass: 'bg-[#007DE3]/10',
    borderClass: 'border-[#007DE3]',
    textClass: 'text-[#007DE3]',
    icon: Zap,
    features: [
      'Minha Agenda (ilimitado)',
      'Agenda Online (2 links)',
      'Tarefas (ilimitado)',
      'Videoconferência (8 participantes)',
      'Gravação de Reuniões (5h/mês)',
      'Fluxos de Trabalho (5 quadros)',
    ],
  },
  track: {
    name: 'Track',
    subtitle: 'Rastreamento',
    description: 'Rastreamento de Documentos, Links, Vídeos e Analytics',
    price: 67,
    color: 'hsl(104, 70%, 36%)', // #2ECC71
    bgClass: 'bg-[#2ECC71]/10',
    borderClass: 'border-[#2ECC71]',
    textClass: 'text-[#2ECC71]',
    icon: BarChart3,
    features: [
      'Rastrear Documentos (100/mês)',
      'Rastrear Links (200/mês)',
      'Rastrear Vídeos (50/mês)',
      'Rastrear Emails',
      'Analytics de Rastreamento',
    ],
  },
};

export function ModuleCard({ type, isSelected, isOwned, onToggle, disabled }: ModuleCardProps) {
  const config = moduleConfig[type];
  const Icon = config.icon;

  return (
    <Card
      className={cn(
        'relative cursor-pointer transition-all duration-300 hover:shadow-lg',
        isSelected && `ring-2 ${config.borderClass} shadow-lg`,
        isOwned && 'opacity-75',
        disabled && 'opacity-50 cursor-not-allowed'
      )}
      onClick={() => !disabled && !isOwned && onToggle(type)}
    >
      {isOwned && (
        <Badge className="absolute -top-2 right-4 bg-primary">
          Ativo
        </Badge>
      )}
      
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={cn('p-2.5 rounded-xl', config.bgClass)}>
              <Icon className={cn('h-6 w-6', config.textClass)} />
            </div>
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                {config.name}
                <span className={cn('text-xs font-normal', config.textClass)}>
                  {config.subtitle}
                </span>
              </CardTitle>
            </div>
          </div>
          <Switch
            checked={isSelected || isOwned}
            onCheckedChange={() => !disabled && !isOwned && onToggle(type)}
            disabled={disabled || isOwned}
          />
        </div>
        <CardDescription className="mt-2">
          {config.description}
        </CardDescription>
      </CardHeader>

      <CardContent>
        <ul className="space-y-2 mb-4">
          {config.features.map((feature, index) => (
            <li key={index} className="flex items-center gap-2 text-sm">
              <Check className={cn('h-4 w-4 flex-shrink-0', config.textClass)} />
              <span>{feature}</span>
            </li>
          ))}
        </ul>

        <div className={cn('p-3 rounded-lg text-center', config.bgClass)}>
          <span className={cn('text-2xl font-bold', config.textClass)}>
            R$ {config.price}
          </span>
          <span className="text-muted-foreground">/mês</span>
        </div>
      </CardContent>
    </Card>
  );
}

export { moduleConfig };
