import React, { useState, useEffect, useCallback } from 'react';
import { ArrowLeft, Shield, Check, CreditCard, Loader2, Zap, Rocket, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useIsMobile } from '@/hooks/use-mobile';
 import crmElloHero from '@/assets/crm-ello-hero.webp';
import ellosuitLogo from '@/assets/ellosuit-logo.png';

const BEEHIVE_PUBLIC_KEY = import.meta.env.VITE_BEEHIVE_PUBLIC_KEY || '';

interface Plan {
  id: string;
  label: string;
  sessions: number;
  price: number; // cents
  features: string[];
  recommended?: boolean;
}

const INSTALLMENT_FEES: Record<number, number> = {
  1: 3.99, 2: 13.83, 3: 14.28, 4: 15.24, 5: 16.18, 6: 17.11,
  7: 19.88, 8: 20.78, 9: 21.67, 10: 22.54, 11: 23.40, 12: 24.26,
};

const PLANS: Plan[] = [
  {
    id: 'starter',
    label: 'Starter',
    sessions: 1,
    price: 30000,
    features: ['1 sessão WhatsApp', '2.000 msgs/dia', 'Suporte por email', 'Rate limit: 30/min'],
  },
  {
    id: 'growth',
    label: 'Growth',
    sessions: 2,
    price: 54700,
    features: ['2 sessões WhatsApp', '5.000 msgs/dia', 'Suporte por email', 'Rate limit: 45/min', 'Webhooks'],
  },
  {
    id: 'professional',
    label: 'Professional',
    sessions: 3,
    price: 79700,
    features: ['3 sessões WhatsApp', '10.000 msgs/dia', 'Suporte prioritário', 'Rate limit: 60/min', 'Webhooks'],
    recommended: true,
  },
  {
    id: 'business',
    label: 'Business',
    sessions: 5,
    price: 149700,
    features: ['5 sessões WhatsApp', '20.000 msgs/dia', 'Suporte dedicado', 'Rate limit: 120/min', 'Webhooks + Analytics'],
  },
  {
    id: 'scale',
    label: 'Scale',
    sessions: 8,
    price: 219700,
    features: ['8 sessões WhatsApp', '40.000 msgs/dia', 'Suporte dedicado', 'Rate limit: 200/min', 'Webhooks + Analytics', 'SLA 99.5%'],
  },
  {
    id: 'enterprise',
    label: 'Enterprise',
    sessions: 10,
    price: 300000,
    features: ['10 sessões WhatsApp', 'Msgs ilimitadas', 'Gerente de conta', 'Rate limit: custom', 'SLA 99.9%', 'IP dedicado'],
  },
];

declare global {
  interface Window {
    HopyPay?: {
      setPublicKey: (key: string) => void;
      setTestMode: (test: boolean) => void;
      encrypt: (card: { number: string; holderName: string; expMonth: number; expYear: number; cvv: string }) => Promise<string>;
      is3DSAvailable: () => Promise<boolean>;
      authenticate3DS: (opts: { amount: number; currency: string; installments: number; card: { number: string; holderName: string; expMonth: number; expYear: number; cvv: string } }) => Promise<void>;
    };
  }
}

const formatCurrency = (cents: number) => {
  return `R$ ${(cents / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
};

const ApiWhatsAppCheckout: React.FC = () => {
  const { user, session } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const { isMobile } = useIsMobile();

  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [installments, setInstallments] = useState(1);
  const [processing, setProcessing] = useState(false);
  const [sdkLoaded, setSdkLoaded] = useState(false);
  const [activeSubscription, setActiveSubscription] = useState<any>(null);

  // Card form
  const [cardNumber, setCardNumber] = useState('');
  const [cardName, setCardName] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvv, setCardCvv] = useState('');

  // Customer
  const [customerName, setCustomerName] = useState('');
  const [customerDocument, setCustomerDocument] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');

  // Load BeehiveHub SDK
  useEffect(() => {
    if (document.querySelector('script[src*="paybeehive"]')) {
      setSdkLoaded(true);
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://api.conta.paybeehive.com.br/v1/js';
    script.onload = () => {
      setSdkLoaded(true);
      if (window.HopyPay && BEEHIVE_PUBLIC_KEY) {
        window.HopyPay.setPublicKey(BEEHIVE_PUBLIC_KEY);
      }
    };
    document.head.appendChild(script);
  }, []);

  // Check existing subscription
  useEffect(() => {
    const checkSub = async () => {
      if (!user) return;
      const { data: cu } = await supabase
        .from('company_users')
        .select('company_id')
        .eq('user_id', user.id)
        .single();
      if (!cu) return;

      const { data } = await supabase
        .from('api_whatsapp_subscriptions')
        .select('*')
        .eq('company_id', cu.company_id)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(1);

      if (data && data.length > 0) {
        setActiveSubscription(data[0]);
      }
    };
    checkSub();
  }, [user]);

  const formatCardNumber = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 16);
    return digits.replace(/(\d{4})(?=\d)/g, '$1 ');
  };

  const formatExpiry = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 4);
    if (digits.length >= 3) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
    return digits;
  };

  const formatDocument = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 14);
    if (digits.length <= 11) {
      return digits.replace(/(\d{3})(\d{3})(\d{3})(\d{0,2})/, '$1.$2.$3-$4').replace(/-$/, '');
    }
    return digits.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{0,2})/, '$1.$2.$3/$4-$5').replace(/-$/, '');
  };

  const handleSubmit = useCallback(async () => {
    if (!selectedPlan || !session) return;

    const cleanCardNumber = cardNumber.replace(/\s/g, '');
    if (cleanCardNumber.length < 13 || !cardName || !cardExpiry || cardCvv.length < 3 || !customerDocument) {
      toast({ title: 'Preencha todos os campos obrigatórios', variant: 'destructive' });
      return;
    }

    setProcessing(true);

    try {
      const [expMonth, expYear] = cardExpiry.split('/').map(Number);
      const fullExpYear = expYear < 100 ? 2000 + expYear : expYear;

      let cardToken = '';

      // Tokenize card via BeehiveHub SDK
      if (window.HopyPay) {
        // Try 3DS first
        const is3DS = await window.HopyPay.is3DSAvailable();
        if (is3DS) {
          await window.HopyPay.authenticate3DS({
            amount: selectedPlan.price,
            currency: 'brl',
            installments,
            card: {
              number: cleanCardNumber,
              holderName: cardName,
              expMonth,
              expYear: fullExpYear,
              cvv: cardCvv,
            },
          });
        }

        cardToken = await window.HopyPay.encrypt({
          number: cleanCardNumber,
          holderName: cardName,
          expMonth,
          expYear: fullExpYear,
          cvv: cardCvv,
        });
      } else {
        toast({ title: 'SDK de pagamento não carregado. Recarregue a página.', variant: 'destructive' });
        setProcessing(false);
        return;
      }

      // Call checkout edge function
      const { data, error } = await supabase.functions.invoke('beehive-checkout', {
        body: {
          plan_name: selectedPlan.id,
          installments,
          card_token: cardToken,
          customer_name: customerName || cardName,
          customer_document: customerDocument.replace(/\D/g, ''),
          customer_phone: customerPhone.replace(/\D/g, ''),
        },
      });

      if (error) throw error;

      if (data?.success) {
        toast({ title: '🎉 Pagamento processado!', description: 'Sua assinatura da API WhatsApp está ativa.' });
        navigate('/dashboard/api-whatsapp');
      } else {
        throw new Error(data?.error || data?.details || 'Pagamento recusado');
      }
    } catch (err: any) {
      console.error('Checkout error:', err);
      toast({
        title: 'Erro no pagamento',
        description: err.message || 'Tente novamente ou use outro cartão.',
        variant: 'destructive',
      });
    } finally {
      setProcessing(false);
    }
  }, [selectedPlan, cardNumber, cardName, cardExpiry, cardCvv, customerDocument, customerName, customerPhone, installments, session, toast, navigate]);

  const installmentAmount = selectedPlan ? Math.ceil(selectedPlan.price / installments) : 0;

  if (activeSubscription) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-2xl mx-auto">
          <Button variant="ghost" onClick={() => navigate('/dashboard/api-whatsapp')} className="mb-6">
            <ArrowLeft className="h-4 w-4 mr-2" /> Voltar
          </Button>
          <Card>
            <CardContent className="p-8 text-center">
              <Check className="h-16 w-16 text-green-500 mx-auto mb-4" />
              <h2 className="text-2xl font-bold mb-2">Assinatura Ativa</h2>
              <p className="text-muted-foreground mb-4">
                Plano <strong>{activeSubscription.plan_label}</strong> • {activeSubscription.sessions_included} sessões
              </p>
              <p className="text-sm text-muted-foreground">
                Válida até {new Date(activeSubscription.expires_at).toLocaleDateString('pt-BR')}
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex bg-white">
      {/* Left side - Info & Form */}
      <div className="flex-1 flex flex-col p-6 lg:p-12 overflow-y-auto">
        <div className="mb-8">
          <img src={ellosuitLogo} alt="Ellosuit" className="h-8 w-auto cursor-pointer" onClick={() => navigate('/dashboard')} />
        </div>

        <div className="flex-1 flex items-center justify-center">
          <div className="w-full max-w-2xl">
            {!selectedPlan ? (
              <div className="space-y-8">
                <div className="space-y-2">
                  <div className="w-12 h-12 rounded-2xl bg-[#F0F2FE] flex items-center justify-center mb-6">
                    <Rocket className="h-6 w-6 text-[#374DA4]" />
                  </div>
                  <h1 className="text-3xl font-bold text-slate-900">Ative seu CRM Ello</h1>
                  <p className="text-slate-500 text-base leading-relaxed">
                    Escolha o plano ideal para sua empresa e comece a escalar seus atendimentos via WhatsApp com automação e IA.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {PLANS.map((plan) => (
                    <div 
                      key={plan.id}
                      onClick={() => setSelectedPlan(plan)}
                      className={`group relative p-6 rounded-3xl border transition-all cursor-pointer ${
                        plan.recommended 
                          ? 'border-[#374DA4] bg-[#F0F2FE]/30' 
                          : 'border-slate-100 bg-white hover:border-slate-200'
                      }`}
                    >
                      {plan.recommended && (
                        <Badge className="absolute -top-3 left-6 bg-[#374DA4] text-white border-none px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider">
                          Recomendado
                        </Badge>
                      )}
                      <h3 className="text-lg font-bold text-slate-900 mb-1">{plan.label}</h3>
                      <div className="flex items-baseline gap-1 mb-4">
                        <span className="text-2xl font-bold text-slate-900">{formatCurrency(plan.price)}</span>
                        <span className="text-xs text-slate-400">/ano</span>
                      </div>
                      <ul className="space-y-2 mb-6">
                        {plan.features.slice(0, 3).map((f, i) => (
                          <li key={i} className="flex items-center gap-2 text-xs text-slate-500">
                            <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                            {f}
                          </li>
                        ))}
                      </ul>
                      <Button 
                        className={`w-full rounded-xl h-10 text-xs font-bold transition-all ${
                          plan.recommended 
                            ? 'bg-[#374DA4] hover:bg-[#E03D00] text-white shadow-lg shadow-[#2F428D]/20' 
                            : 'bg-slate-900 hover:bg-slate-800 text-white'
                        }`}
                      >
                        Selecionar Plano
                      </Button>
                    </div>
                  ))}
                </div>

                <Button 
                  variant="ghost" 
                  className="text-slate-400 hover:text-slate-600 h-10 text-xs font-normal"
                  onClick={() => navigate('/dashboard')}
                >
                  <ArrowLeft className="mr-2 h-3.5 w-3.5" />
                  Voltar para o Dashboard
                </Button>
              </div>
            ) : (
              /* Checkout Form */
              <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="flex items-center gap-4 mb-8">
                  <button 
                    onClick={() => setSelectedPlan(null)}
                    className="p-2 rounded-xl bg-slate-50 hover:bg-slate-100 transition-colors"
                  >
                    <ArrowLeft className="h-5 w-5 text-slate-600" />
                  </button>
                  <div>
                    <h2 className="text-xl font-bold text-slate-900">Finalizar Assinatura</h2>
                    <p className="text-sm text-slate-500">Plano {selectedPlan.label} selecionado</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-6">
                    <div className="space-y-4">
                      <div>
                        <Label className="text-[11px] uppercase font-bold tracking-wider text-slate-400 mb-1.5 block">Nome completo</Label>
                        <Input
                          value={customerName}
                          onChange={(e) => setCustomerName(e.target.value)}
                          placeholder="Como no cartão"
                          className="h-12 rounded-xl border-slate-200 bg-slate-50/50"
                        />
                      </div>
                      <div>
                        <Label className="text-[11px] uppercase font-bold tracking-wider text-slate-400 mb-1.5 block">CPF/CNPJ *</Label>
                        <Input
                          value={customerDocument}
                          onChange={(e) => setCustomerDocument(formatDocument(e.target.value))}
                          placeholder="000.000.000-00"
                          className="h-12 rounded-xl border-slate-200 bg-slate-50/50"
                        />
                      </div>
                      <div>
                        <Label className="text-[11px] uppercase font-bold tracking-wider text-slate-400 mb-1.5 block">Número do cartão *</Label>
                        <Input
                          value={cardNumber}
                          onChange={(e) => setCardNumber(formatCardNumber(e.target.value))}
                          placeholder="0000 0000 0000 0000"
                          maxLength={19}
                          className="h-12 rounded-xl border-slate-200 bg-slate-50/50"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label className="text-[11px] uppercase font-bold tracking-wider text-slate-400 mb-1.5 block">Validade *</Label>
                          <Input
                            value={cardExpiry}
                            onChange={(e) => setCardExpiry(formatExpiry(e.target.value))}
                            placeholder="MM/AA"
                            maxLength={5}
                            className="h-12 rounded-xl border-slate-200 bg-slate-50/50 text-center"
                          />
                        </div>
                        <div>
                          <Label className="text-[11px] uppercase font-bold tracking-wider text-slate-400 mb-1.5 block">CVV *</Label>
                          <Input
                            value={cardCvv}
                            onChange={(e) => setCardCvv(e.target.value.replace(/\D/g, '').slice(0, 4))}
                            placeholder="123"
                            maxLength={4}
                            type="password"
                            className="h-12 rounded-xl border-slate-200 bg-slate-50/50 text-center"
                          />
                        </div>
                      </div>
                      <div>
                        <Label className="text-[11px] uppercase font-bold tracking-wider text-slate-400 mb-1.5 block">Parcelas</Label>
                        <select
                          value={installments}
                          onChange={(e) => setInstallments(Number(e.target.value))}
                          className="w-full h-12 px-4 rounded-xl border border-slate-200 bg-slate-50/50 text-sm appearance-none cursor-pointer outline-none focus:ring-2 focus:ring-[#374DA4]/20"
                        >
                          {Array.from({ length: 12 }, (_, i) => i + 1).map((n) => {
                            const fee = INSTALLMENT_FEES[n] || 0;
                            return (
                              <option key={n} value={n}>
                                {n}x de {formatCurrency(Math.ceil(selectedPlan.price / n))}
                              </option>
                            );
                          })}
                        </select>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-6">
                    <div className="p-6 rounded-3xl bg-slate-50 border border-slate-100">
                      <h4 className="text-[11px] uppercase font-bold tracking-wider text-slate-400 mb-4">Resumo da Compra</h4>
                      <div className="space-y-3">
                        <div className="flex justify-between text-sm">
                          <span className="text-slate-500">Plano {selectedPlan.label}</span>
                          <span className="font-bold text-slate-900">{formatCurrency(selectedPlan.price)}</span>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span className="text-slate-400">Parcelamento</span>
                          <span className="text-slate-500">{installments}x de {formatCurrency(Math.ceil(selectedPlan.price / installments))}</span>
                        </div>
                        <div className="pt-3 mt-3 border-t border-slate-200 flex justify-between items-baseline">
                          <span className="text-sm font-bold text-slate-900">Total a pagar</span>
                          <span className="text-2xl font-bold text-[#374DA4]">{formatCurrency(selectedPlan.price)}</span>
                        </div>
                      </div>
                    </div>

                    <Button
                      className="w-full h-12 bg-[#374DA4] hover:bg-[#E03D00] text-white rounded-xl font-bold shadow-lg shadow-[#2F428D]/20"
                      disabled={processing || !sdkLoaded}
                      onClick={handleSubmit}
                    >
                      {processing ? (
                        <Loader2 className="h-5 w-5 animate-spin" />
                      ) : (
                        `Assinar Agora`
                      )}
                    </Button>

                    <div className="flex items-center justify-center gap-2 text-[10px] text-slate-400">
                      <Shield className="h-3 w-3 text-green-500" />
                      Pagamento 100% seguro via criptografia 3DS
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="mt-8 flex justify-between items-center text-slate-300 text-[10px] uppercase tracking-widest">
          <p>&copy; {new Date().getFullYear()} ElloSuit.</p>
          <div className="flex gap-4">
            <a href="#" className="hover:text-slate-400 transition-colors">Privacidade</a>
            <a href="#" className="hover:text-slate-400 transition-colors">Termos</a>
          </div>
        </div>
      </div>

      {/* Right side - Hero placeholder */}
      {!isMobile && (
        <div className="hidden lg:block flex-1 relative overflow-hidden bg-slate-50 border-l border-slate-100">
          <img
            src={crmElloHero}
            alt="Ative seu CRM Ello"
            className="absolute inset-0 w-full h-full object-cover"
          />
        </div>
      )}
    </div>
  );
};

export default ApiWhatsAppCheckout;
