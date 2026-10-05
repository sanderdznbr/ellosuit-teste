import React from 'react';
import { Check, X, Sparkles } from 'lucide-react';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import type { ModuleType, AddonType } from '@/hooks/useSubscription';
import { moduleConfig } from './ModuleCard';

interface PricingSummaryProps {
  selectedModules: ModuleType[];
  selectedAddons: Record<AddonType, number>;
  billingCycle: 'monthly' | 'yearly';
  onCheckout: () => void;
  isCurrentSubscription?: boolean;
}

const addonPrices: Record<AddonType, { price: number; name: string }> = {
  users: { price: 29, name: 'Usuário adicional' },
  storage: { price: 19, name: '+10 GB armazenamento' },
  emails: { price: 29, name: '+2.000 emails' },
  ai_agents: { price: 39, name: 'Agente de IA' },
  whatsapp_sessions: { price: 67, name: 'Sessão WhatsApp' },
  booking_links: { price: 19, name: 'Agenda Online' },
  meeting_hours: { price: 49, name: '+10h gravação' },
  tracked_docs: { price: 29, name: '+100 docs rastreados' },
  priority_support: { price: 97, name: 'Suporte prioritário' },
};

const BASE_PRICE = 97;
const YEARLY_DISCOUNT = 0.17; // 17%

export function PricingSummary({
  selectedModules,
  selectedAddons,
  billingCycle,
  onCheckout,
  isCurrentSubscription = false,
}: PricingSummaryProps) {
  // Calculate base price
  const basePrice = BASE_PRICE;

  // Calculate modules price
  const modulesPrice = selectedModules.reduce((total, module) => {
    return total + moduleConfig[module].price;
  }, 0);

  // Calculate addons price
  const addonsPrice = Object.entries(selectedAddons).reduce((total, [type, quantity]) => {
    if (quantity > 0 && addonPrices[type as AddonType]) {
      return total + (addonPrices[type as AddonType].price * quantity);
    }
    return total;
  }, 0);

  // Total monthly
  const monthlyTotal = basePrice + modulesPrice + addonsPrice;

  // Apply yearly discount
  const yearlyTotal = monthlyTotal * 12 * (1 - YEARLY_DISCOUNT);
  const yearlyMonthly = yearlyTotal / 12;
  const yearlySavings = (monthlyTotal * 12) - yearlyTotal;

  const displayPrice = billingCycle === 'yearly' ? yearlyMonthly : monthlyTotal;
  const displayTotal = billingCycle === 'yearly' ? yearlyTotal : monthlyTotal;

  const hasItems = selectedModules.length > 0 || Object.values(selectedAddons).some(q => q > 0);

  return (
    <Card className="sticky top-4">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          Resumo do Plano
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Base Plan */}
        <div className="flex justify-between items-center">
          <div>
            <span className="font-medium">Ellosuit Base</span>
            <p className="text-xs text-muted-foreground">2 usuários, 5 GB</p>
          </div>
          <span className="font-medium">R$ {BASE_PRICE}</span>
        </div>

        {/* Modules */}
        {selectedModules.length > 0 && (
          <>
            <Separator />
            <div className="space-y-2">
              <span className="text-sm font-medium text-muted-foreground">Módulos</span>
              {selectedModules.map(module => (
                <div key={module} className="flex justify-between items-center text-sm">
                  <div className="flex items-center gap-2">
                    <div className={cn(
                      'w-2 h-2 rounded-full',
                      module === 'omni' && 'bg-[#E34800]',
                      module === 'flow' && 'bg-[#007DE3]',
                      module === 'track' && 'bg-[#2ECC71]'
                    )} />
                    <span>{moduleConfig[module].name}</span>
                  </div>
                  <span>R$ {moduleConfig[module].price}</span>
                </div>
              ))}
            </div>
          </>
        )}

        {/* Addons */}
        {Object.entries(selectedAddons).some(([_, q]) => q > 0) && (
          <>
            <Separator />
            <div className="space-y-2">
              <span className="text-sm font-medium text-muted-foreground">Add-ons</span>
              {Object.entries(selectedAddons).map(([type, quantity]) => {
                if (quantity <= 0) return null;
                const addon = addonPrices[type as AddonType];
                if (!addon) return null;
                return (
                  <div key={type} className="flex justify-between items-center text-sm">
                    <span>{addon.name} x{quantity}</span>
                    <span>R$ {addon.price * quantity}</span>
                  </div>
                );
              })}
            </div>
          </>
        )}

        <Separator />

        {/* Totals */}
        <div className="space-y-2">
          <div className="flex justify-between items-center text-sm">
            <span className="text-muted-foreground">Subtotal mensal</span>
            <span>R$ {monthlyTotal}</span>
          </div>

          {billingCycle === 'yearly' && (
            <div className="flex justify-between items-center text-sm text-primary">
              <span>Desconto anual (17%)</span>
              <span>-R$ {Math.round(yearlySavings / 12)}</span>
            </div>
          )}

          <div className="flex justify-between items-center pt-2">
            <span className="font-semibold">Total</span>
            <div className="text-right">
              <span className="text-2xl font-bold">R$ {Math.round(displayPrice)}</span>
              <span className="text-muted-foreground">/mês</span>
              {billingCycle === 'yearly' && (
                <p className="text-xs text-muted-foreground">
                  R$ {Math.round(displayTotal)}/ano
                </p>
              )}
            </div>
          </div>

          {billingCycle === 'yearly' && (
            <Badge className="w-full justify-center bg-primary/10 text-primary">
              Você economiza R$ {Math.round(yearlySavings)}/ano
            </Badge>
          )}
        </div>
      </CardContent>

      <CardFooter className="flex-col gap-2">
        <Button 
          className="w-full" 
          size="lg"
          onClick={onCheckout}
          disabled={isCurrentSubscription && !hasItems}
        >
          {isCurrentSubscription ? 'Atualizar Plano' : 'Assinar Agora'}
        </Button>
        <p className="text-xs text-center text-muted-foreground">
          7 dias de teste grátis. Cancele quando quiser.
        </p>
      </CardFooter>
    </Card>
  );
}
