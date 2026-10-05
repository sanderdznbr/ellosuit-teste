import React from 'react';
import { Plus, Minus, Users, HardDrive, Mail, Bot, MessageCircle, Calendar, Video, FileText, Headphones } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { AddonType } from '@/hooks/useSubscription';

interface Addon {
  type: AddonType;
  name: string;
  description: string;
  unitPrice: number;
  unit: string;
  icon: React.ElementType;
  popular?: boolean;
  bundle?: {
    quantity: number;
    price: number;
    savings: number;
  };
}

const addons: Addon[] = [
  {
    type: 'users',
    name: 'Usuários Adicionais',
    description: 'Adicione mais funcionários à sua equipe',
    unitPrice: 29,
    unit: 'usuário',
    icon: Users,
    popular: true,
    bundle: { quantity: 5, price: 119, savings: 26 },
  },
  {
    type: 'storage',
    name: 'Armazenamento Extra',
    description: 'Mais espaço no Drive',
    unitPrice: 19,
    unit: '10 GB',
    icon: HardDrive,
    bundle: { quantity: 5, price: 79, savings: 16 },
  },
  {
    type: 'whatsapp_sessions',
    name: 'Sessão WhatsApp CRM',
    description: 'CRM adicional para WhatsApp',
    unitPrice: 67,
    unit: 'sessão',
    icon: MessageCircle,
    popular: true,
    bundle: { quantity: 3, price: 167, savings: 34 },
  },
  {
    type: 'emails',
    name: 'Créditos de Email',
    description: 'Mais emails para enviar',
    unitPrice: 29,
    unit: '2.000 emails',
    icon: Mail,
  },
  {
    type: 'ai_agents',
    name: 'Agente de IA',
    description: 'Agente adicional de IA',
    unitPrice: 39,
    unit: 'agente',
    icon: Bot,
    bundle: { quantity: 5, price: 159, savings: 36 },
  },
  {
    type: 'booking_links',
    name: 'Agenda Online',
    description: 'Link adicional de agendamento',
    unitPrice: 19,
    unit: 'agenda',
    icon: Calendar,
    bundle: { quantity: 5, price: 79, savings: 16 },
  },
  {
    type: 'meeting_hours',
    name: 'Gravação de Reuniões',
    description: 'Horas extras de gravação',
    unitPrice: 49,
    unit: '10 horas',
    icon: Video,
  },
  {
    type: 'tracked_docs',
    name: 'Documentos Rastreados',
    description: 'Limite extra de documentos',
    unitPrice: 29,
    unit: '100 docs',
    icon: FileText,
  },
  {
    type: 'priority_support',
    name: 'Suporte Prioritário',
    description: 'Atendimento VIP 24/7',
    unitPrice: 97,
    unit: 'mensal',
    icon: Headphones,
  },
];

interface AddonSelectorProps {
  selectedAddons: Record<AddonType, number>;
  onAddonChange: (type: AddonType, quantity: number) => void;
  category?: 'team' | 'storage' | 'communication' | 'productivity' | 'all';
}

const categoryMap: Record<string, AddonType[]> = {
  team: ['users', 'priority_support'],
  storage: ['storage'],
  communication: ['whatsapp_sessions', 'emails', 'ai_agents'],
  productivity: ['booking_links', 'meeting_hours', 'tracked_docs'],
  all: ['users', 'storage', 'whatsapp_sessions', 'emails', 'ai_agents', 'booking_links', 'meeting_hours', 'tracked_docs', 'priority_support'],
};

export function AddonSelector({ selectedAddons, onAddonChange, category = 'all' }: AddonSelectorProps) {
  const filteredAddons = addons.filter(addon => 
    categoryMap[category].includes(addon.type)
  );

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {filteredAddons.map((addon) => {
        const Icon = addon.icon;
        const quantity = selectedAddons[addon.type] || 0;
        const total = quantity * addon.unitPrice;

        return (
          <Card 
            key={addon.type}
            className={cn(
              'relative transition-all',
              quantity > 0 && 'ring-2 ring-primary/50'
            )}
          >
            {addon.popular && (
              <Badge className="absolute -top-2 right-4 bg-primary text-xs">
                Popular
              </Badge>
            )}

            <CardHeader className="pb-2">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-muted">
                  <Icon className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1">
                  <CardTitle className="text-base">{addon.name}</CardTitle>
                  <CardDescription className="text-xs mt-1">
                    {addon.description}
                  </CardDescription>
                </div>
              </div>
            </CardHeader>

            <CardContent>
              <div className="flex items-center justify-between mb-3">
                <div>
                  <span className="text-lg font-bold">R$ {addon.unitPrice}</span>
                  <span className="text-muted-foreground text-sm">/{addon.unit}</span>
                </div>
                
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => onAddonChange(addon.type, Math.max(0, quantity - 1))}
                    disabled={quantity === 0}
                  >
                    <Minus className="h-4 w-4" />
                  </Button>
                  <span className="w-8 text-center font-medium">{quantity}</span>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => onAddonChange(addon.type, quantity + 1)}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {addon.bundle && (
                <div 
                  className="p-2 bg-muted/50 rounded-lg text-xs cursor-pointer hover:bg-muted transition-colors"
                  onClick={() => onAddonChange(addon.type, addon.bundle!.quantity)}
                >
                  <div className="flex justify-between items-center">
                    <span>Pacote {addon.bundle.quantity}x</span>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">R$ {addon.bundle.price}</span>
                      <Badge variant="secondary" className="bg-primary/10 text-primary text-xs">
                        -{addon.bundle.savings}%
                      </Badge>
                    </div>
                  </div>
                </div>
              )}

              {quantity > 0 && (
                <div className="mt-3 pt-3 border-t">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Subtotal:</span>
                    <span className="font-medium">R$ {total}/mês</span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

export { addons };
