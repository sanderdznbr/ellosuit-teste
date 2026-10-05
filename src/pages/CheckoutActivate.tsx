import React, { useState } from 'react';
import { ArrowLeft, Check, ChevronDown, CreditCard, Loader2, Lock, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useSubscription } from '@/hooks/useSubscription';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { addDays, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import ellosuitLogo from '@/assets/logoellosuit.png';

const TRIAL_BENEFITS = [
  'Teste grátis de 7 dias, cancele quando quiser',
  'Enviaremos um e-mail 2 dias antes do trial acabar',
  'Após o trial, você será cobrado automaticamente',
];

const MONTHLY_PRICE = 297;
const ANNUAL_PRICE = 2497;
const ANNUAL_MONTHLY_EQUIV = Math.round(ANNUAL_PRICE / 12);
const ANNUAL_SAVINGS = Math.round((1 - ANNUAL_PRICE / (MONTHLY_PRICE * 12)) * 100);

type BillingCycle = 'monthly' | 'annual';

export default function CheckoutActivate() {
  const { user } = useAuth();
  const { isFree, refetch } = useSubscription();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [billingCycle, setBillingCycle] = useState<BillingCycle>('annual');
  const [showCardForm, setShowCardForm] = useState(false);

  const [customer, setCustomer] = useState({ name: '', document: '', phone: '' });
  const [card, setCard] = useState({ number: '', holder_name: '', exp_month: '', exp_year: '', cvv: '' });

  const trialEndDate = format(addDays(new Date(), 7), "d 'de' MMMM, yyyy", { locale: ptBR });
  const price = billingCycle === 'monthly' ? MONTHLY_PRICE : ANNUAL_PRICE;
  const priceLabel = billingCycle === 'monthly' ? `R$ ${MONTHLY_PRICE}/mês` : `R$ ${ANNUAL_PRICE}/ano`;

  const formatCardNumber = (value: string) => {
    const v = value.replace(/\D/g, '').substring(0, 16);
    const parts = [];
    for (let i = 0; i < v.length; i += 4) parts.push(v.substring(i, i + 4));
    return parts.join(' ');
  };

  const formatDocument = (value: string) => {
    const v = value.replace(/\D/g, '');
    if (v.length <= 11) return v.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
    return v.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
  };

  const formatPhone = (value: string) => {
    const v = value.replace(/\D/g, '').substring(0, 11);
    if (v.length <= 10) return v.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3');
    return v.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setIsLoading(true);
    try {
      if (!customer.name || !customer.document || !customer.phone) throw new Error('Preencha todos os campos obrigatórios');
      if (!card.number || !card.holder_name || !card.exp_month || !card.exp_year || !card.cvv) throw new Error('Preencha todos os dados do cartão');

      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) throw new Error('Você precisa estar logado');

      const response = await supabase.functions.invoke('pagarme-checkout', {
        body: {
          plan_id: 'business',
          billing_cycle: billingCycle === 'monthly' ? 'monthly' : 'yearly',
          payment_method: 'credit_card',
          customer: {
            name: customer.name,
            email: sessionData.session.user.email,
            document: customer.document.replace(/\D/g, ''),
            phone: customer.phone.replace(/\D/g, ''),
          },
          card: {
            number: card.number.replace(/\D/g, ''),
            holder_name: card.holder_name,
            exp_month: parseInt(card.exp_month),
            exp_year: parseInt(card.exp_year),
            cvv: card.cvv,
          },
        },
      });

      if (response.error) throw new Error(response.error.message || 'Erro ao processar');
      toast.success('🎉 Teste grátis de 7 dias ativado! Aproveite o Ellosuit Business.');
      await refetch();
      navigate('/dashboard');
    } catch (error: any) {
      console.error('Activation error:', error);
      toast.error(error.message || 'Erro ao processar pagamento');
    } finally {
      setIsLoading(false);
    }
  };

  // Allow non-free users to access if they need to register/update card
  // Only redirect if they already have an active paid subscription AND came here by accident


  return (
    <div className="min-h-screen bg-background overflow-y-auto">
      {/* Header with logo */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 pt-4 sm:pt-6 flex items-center justify-between">
        <img src={ellosuitLogo} alt="Ellosuit" className="h-8 w-auto" />
        <button
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar
        </button>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-10 pb-20">
        <div className="grid lg:grid-cols-[1fr_380px] gap-8 lg:gap-12">
          {/* Left — Form */}
          <div className="order-2 lg:order-1">
            <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-5">
              Comece seu teste grátis
            </h1>

            <div className="space-y-2.5 mb-10">
              {TRIAL_BENEFITS.map((b, i) => (
                <div key={i} className="flex items-center gap-3">
                  <Check className="h-4 w-4 text-primary flex-shrink-0" />
                  <span className="text-sm text-muted-foreground">{b}</span>
                </div>
              ))}
            </div>

            {/* Payment section */}
            <section className="mb-8">
              <h2 className="text-lg font-semibold text-foreground mb-4">Pagamento</h2>

              {/* Credit card toggle button */}
              <button
                type="button"
                onClick={() => setShowCardForm(!showCardForm)}
                className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl border transition-all ${
                  showCardForm
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-primary/40'
                }`}
              >
                <CreditCard className="h-5 w-5 text-muted-foreground" />
                <span className="text-sm font-medium text-foreground flex-1 text-left">Cartão de crédito</span>
                <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${showCardForm ? 'rotate-180' : ''}`} />
              </button>

              {/* Card form — collapsible */}
              {showCardForm && (
                <div className="mt-4 space-y-4 animate-in slide-in-from-top-2 duration-200">
                  <div>
                    <Label htmlFor="card_number" className="text-xs text-muted-foreground">Número do cartão</Label>
                    <Input
                      id="card_number"
                      value={card.number}
                      onChange={(e) => setCard(prev => ({ ...prev, number: formatCardNumber(e.target.value) }))}
                      placeholder="1234 1234 1234 1234"
                      maxLength={19}
                      className="h-12 mt-1"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-xs text-muted-foreground">Data de validade</Label>
                      <div className="flex gap-2 mt-1">
                        <Input
                          value={card.exp_month}
                          onChange={(e) => setCard(prev => ({ ...prev, exp_month: e.target.value.replace(/\D/g, '').substring(0, 2) }))}
                          placeholder="MM"
                          maxLength={2}
                          className="h-12"
                        />
                        <span className="flex items-center text-muted-foreground">/</span>
                        <Input
                          value={card.exp_year}
                          onChange={(e) => setCard(prev => ({ ...prev, exp_year: e.target.value.replace(/\D/g, '').substring(0, 4) }))}
                          placeholder="AAAA"
                          maxLength={4}
                          className="h-12"
                        />
                      </div>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Código de segurança</Label>
                      <Input
                        type="password"
                        value={card.cvv}
                        onChange={(e) => setCard(prev => ({ ...prev, cvv: e.target.value.replace(/\D/g, '').substring(0, 4) }))}
                        placeholder="CVV"
                        maxLength={4}
                        className="h-12 mt-1"
                      />
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Nome no cartão</Label>
                    <Input
                      value={card.holder_name}
                      onChange={(e) => setCard(prev => ({ ...prev, holder_name: e.target.value.toUpperCase() }))}
                      placeholder="NOME COMO NO CARTÃO"
                      className="h-12 mt-1"
                    />
                  </div>
                </div>
              )}
            </section>

            {/* Billing details */}
            <section>
              <h2 className="text-lg font-semibold text-foreground mb-4">Dados de cobrança</h2>
              <div className="space-y-4">
                <div>
                  <Label className="text-xs text-muted-foreground">Nome completo</Label>
                  <Input
                    value={customer.name}
                    onChange={(e) => setCustomer(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Seu nome completo"
                    className="h-12 mt-1"
                  />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">CPF ou CNPJ</Label>
                  <Input
                    value={customer.document}
                    onChange={(e) => setCustomer(prev => ({ ...prev, document: formatDocument(e.target.value) }))}
                    placeholder="000.000.000-00"
                    className="h-12 mt-1"
                  />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Telefone</Label>
                  <Input
                    value={customer.phone}
                    onChange={(e) => setCustomer(prev => ({ ...prev, phone: formatPhone(e.target.value) }))}
                    placeholder="(11) 99999-9999"
                    className="h-12 mt-1"
                  />
                </div>
              </div>
            </section>

            {/* Mobile/tablet submit button — after form */}
            <div className="lg:hidden mt-8">
              <Button
                onClick={() => handleSubmit()}
                className="w-full h-12 text-base rounded-xl"
                size="lg"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Processando...
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-4 w-4" />
                    Iniciar teste grátis
                  </>
                )}
              </Button>
              <p className="text-xs text-center text-muted-foreground mt-3">
                Seu plano começa em {trialEndDate}, a menos que cancele.
              </p>
              <div className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground mt-2">
                <Lock className="h-3 w-3" />
                Pagamento seguro
              </div>
            </div>
          </div>

          {/* Right — Summary card */}
          <div className="order-1 lg:order-2 lg:sticky lg:top-8 h-fit">
            <div className="rounded-2xl border border-border bg-card p-6 space-y-5">
              <h2 className="text-lg font-bold text-foreground">Seu plano trial</h2>

              {/* Billing cycle selector */}
              <div>
                <p className="text-sm font-medium text-foreground mb-3">Ciclo de cobrança</p>
                <div className="space-y-2.5">
                  <label
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-colors ${
                      billingCycle === 'annual' ? 'bg-primary/5' : ''
                    }`}
                    onClick={() => setBillingCycle('annual')}
                  >
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                      billingCycle === 'annual' ? 'border-primary' : 'border-muted-foreground/30'
                    }`}>
                      {billingCycle === 'annual' && <div className="w-2.5 h-2.5 rounded-full bg-primary" />}
                    </div>
                    <span className="text-sm text-foreground flex-1">Anual</span>
                    <Badge variant="secondary" className="bg-primary/10 text-primary text-xs font-semibold border-0">
                      Economize {ANNUAL_SAVINGS}%
                    </Badge>
                  </label>

                  <label
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-colors ${
                      billingCycle === 'monthly' ? 'bg-primary/5' : ''
                    }`}
                    onClick={() => setBillingCycle('monthly')}
                  >
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                      billingCycle === 'monthly' ? 'border-primary' : 'border-muted-foreground/30'
                    }`}>
                      {billingCycle === 'monthly' && <div className="w-2.5 h-2.5 rounded-full bg-primary" />}
                    </div>
                    <span className="text-sm text-foreground">Mensal</span>
                  </label>
                </div>
              </div>

              <div className="border-t border-border pt-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-foreground">Ellosuit Business</span>
                  <div className="text-right">
                    <span className="text-sm text-muted-foreground line-through">
                      R$ {billingCycle === 'monthly' ? '297,00' : '3.564,00'}
                    </span>
                    <p className="text-xs text-primary font-medium">Grátis por 7 dias!</p>
                  </div>
                </div>
              </div>

              <div className="border-t border-border pt-4 space-y-2">
                <div className="flex items-center justify-between text-sm text-muted-foreground">
                  <span>Cobrança em {trialEndDate}</span>
                  <span>{priceLabel}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-foreground">Total hoje</span>
                  <span className="text-2xl font-bold text-foreground">R$ 0</span>
                </div>
              </div>

              <div className="hidden lg:block">
                <Button
                  onClick={() => handleSubmit()}
                  className="w-full h-12 text-base rounded-xl"
                  size="lg"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Processando...
                    </>
                  ) : (
                    <>
                      <Sparkles className="mr-2 h-4 w-4" />
                      Iniciar teste grátis
                    </>
                  )}
                </Button>
              </div>

              <p className="text-xs text-center text-muted-foreground">
                Seu plano começa em {trialEndDate}, a menos que cancele. Cancele a qualquer momento.
              </p>

              <div className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
                <Lock className="h-3 w-3" />
                Pagamento seguro
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
