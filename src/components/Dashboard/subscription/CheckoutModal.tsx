import React, { useState } from 'react';
import { CreditCard, QrCode, Loader2, Shield, Check, X } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

interface CheckoutModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  plan: {
    id: 'omni' | 'flow' | 'track' | 'business';
    name: string;
    monthlyPrice: number;
    yearlyPrice: number;
  };
  billingCycle: 'monthly' | 'yearly';
}

export function CheckoutModal({ open, onOpenChange, plan, billingCycle }: CheckoutModalProps) {
  const [paymentMethod, setPaymentMethod] = useState<'credit_card' | 'pix'>('credit_card');
  const [isLoading, setIsLoading] = useState(false);
  const [pixData, setPixData] = useState<{ qr_code: string; qr_code_url: string } | null>(null);
  
  // Customer form
  const [customer, setCustomer] = useState({
    name: '',
    email: '',
    document: '',
    phone: '',
  });

  // Card form
  const [card, setCard] = useState({
    number: '',
    holder_name: '',
    exp_month: '',
    exp_year: '',
    cvv: '',
  });

  const price = billingCycle === 'yearly' ? plan.yearlyPrice : plan.monthlyPrice;
  const monthlyEquivalent = billingCycle === 'yearly' ? Math.round(plan.yearlyPrice / 12) : plan.monthlyPrice;

  const formatCardNumber = (value: string) => {
    const v = value.replace(/\D/g, '').substring(0, 16);
    const parts = [];
    for (let i = 0; i < v.length; i += 4) {
      parts.push(v.substring(i, i + 4));
    }
    return parts.join(' ');
  };

  const formatDocument = (value: string) => {
    const v = value.replace(/\D/g, '');
    if (v.length <= 11) {
      // CPF
      return v.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
    } else {
      // CNPJ
      return v.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
    }
  };

  const formatPhone = (value: string) => {
    const v = value.replace(/\D/g, '').substring(0, 11);
    if (v.length <= 10) {
      return v.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3');
    }
    return v.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      // Validate customer fields
      if (!customer.name || !customer.document || !customer.phone) {
        throw new Error('Preencha todos os campos obrigatórios');
      }

      // Validate card if credit card payment
      if (paymentMethod === 'credit_card') {
        if (!card.number || !card.holder_name || !card.exp_month || !card.exp_year || !card.cvv) {
          throw new Error('Preencha todos os dados do cartão');
        }
      }

      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        throw new Error('Você precisa estar logado');
      }

      const response = await supabase.functions.invoke('pagarme-checkout', {
        body: {
          plan_id: plan.id,
          billing_cycle: billingCycle,
          payment_method: paymentMethod,
          customer: {
            name: customer.name,
            email: customer.email || sessionData.session.user.email,
            document: customer.document.replace(/\D/g, ''),
            phone: customer.phone.replace(/\D/g, ''),
          },
          ...(paymentMethod === 'credit_card' && {
            card: {
              number: card.number.replace(/\D/g, ''),
              holder_name: card.holder_name,
              exp_month: parseInt(card.exp_month),
              exp_year: parseInt(card.exp_year),
              cvv: card.cvv,
            },
          }),
        },
      });

      if (response.error) {
        throw new Error(response.error.message || 'Erro ao processar pagamento');
      }

      const result = response.data;

      if (result.pix) {
        // Show PIX QR code
        setPixData(result.pix);
        toast.success('QR Code PIX gerado! Escaneie para pagar.');
      } else {
        // Credit card with trial
        toast.success(result.message || 'Assinatura criada com sucesso!');
        onOpenChange(false);
        window.location.reload();
      }
    } catch (error: any) {
      console.error('Checkout error:', error);
      toast.error(error.message || 'Erro ao processar pagamento');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            Checkout Seguro
          </DialogTitle>
          <DialogDescription>
            Assinar {plan.name}
          </DialogDescription>
        </DialogHeader>

        {pixData ? (
          <div className="space-y-6 py-4">
            <div className="text-center space-y-4">
              <h3 className="text-lg font-semibold">Escaneie o QR Code para pagar</h3>
              <div className="bg-white p-4 rounded-lg inline-block">
                {pixData.qr_code_url ? (
                  <img src={pixData.qr_code_url} alt="QR Code PIX" className="w-48 h-48" />
                ) : (
                  <div className="w-48 h-48 flex items-center justify-center bg-muted rounded">
                    <QrCode className="h-24 w-24 text-muted-foreground" />
                  </div>
                )}
              </div>
              {pixData.qr_code && (
                <div className="space-y-2">
                  <Label>Ou copie o código PIX:</Label>
                  <div className="flex gap-2">
                    <Input 
                      value={pixData.qr_code} 
                      readOnly 
                      className="text-xs font-mono"
                    />
                    <Button 
                      variant="outline" 
                      onClick={() => {
                        navigator.clipboard.writeText(pixData.qr_code);
                        toast.success('Código copiado!');
                      }}
                    >
                      Copiar
                    </Button>
                  </div>
                </div>
              )}
              <p className="text-sm text-muted-foreground">
                Após o pagamento, sua assinatura será ativada automaticamente.
              </p>
              <Button variant="outline" onClick={() => setPixData(null)}>
                Voltar
              </Button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Plan Summary */}
            <div className="bg-muted/50 rounded-lg p-4 space-y-2">
              <div className="flex justify-between items-center">
                <span className="font-medium">{plan.name}</span>
                <Badge variant="secondary">
                  {billingCycle === 'yearly' ? 'Anual' : 'Mensal'}
                </Badge>
              </div>
              <div className="flex justify-between items-baseline">
                <span className="text-2xl font-bold">
                  R$ {monthlyEquivalent}
                  <span className="text-sm font-normal text-muted-foreground">/mês</span>
                </span>
                {billingCycle === 'yearly' && (
                  <span className="text-sm text-muted-foreground">
                    Total: R$ {price}/ano
                  </span>
                )}
              </div>
              {paymentMethod === 'credit_card' && (
                <div className="flex items-center gap-2 text-sm text-primary">
                  <Check className="h-4 w-4" />
                  7 dias grátis para testar
                </div>
              )}
            </div>

            {/* Customer Data */}
            <div className="space-y-4">
              <h4 className="font-medium">Seus dados</h4>
              <div className="grid gap-3">
                <div>
                  <Label htmlFor="name">Nome completo *</Label>
                  <Input
                    id="name"
                    value={customer.name}
                    onChange={(e) => setCustomer(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Seu nome"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="document">CPF ou CNPJ *</Label>
                  <Input
                    id="document"
                    value={customer.document}
                    onChange={(e) => setCustomer(prev => ({ 
                      ...prev, 
                      document: formatDocument(e.target.value) 
                    }))}
                    placeholder="000.000.000-00"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="phone">Telefone *</Label>
                  <Input
                    id="phone"
                    value={customer.phone}
                    onChange={(e) => setCustomer(prev => ({ 
                      ...prev, 
                      phone: formatPhone(e.target.value) 
                    }))}
                    placeholder="(11) 99999-9999"
                    required
                  />
                </div>
              </div>
            </div>

            {/* Payment Method */}
            <div className="space-y-4">
              <h4 className="font-medium">Forma de pagamento</h4>
              <Tabs 
                value={paymentMethod} 
                onValueChange={(v) => setPaymentMethod(v as 'credit_card' | 'pix')}
              >
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="credit_card" className="flex items-center gap-2">
                    <CreditCard className="h-4 w-4" />
                    Cartão
                  </TabsTrigger>
                  <TabsTrigger value="pix" className="flex items-center gap-2">
                    <QrCode className="h-4 w-4" />
                    PIX
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="credit_card" className="space-y-3 mt-4">
                  <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 text-sm">
                    <div className="flex items-center gap-2 text-primary font-medium">
                      <Shield className="h-4 w-4" />
                      7 dias grátis
                    </div>
                    <p className="text-muted-foreground mt-1">
                      Cadastre seu cartão para iniciar o período de teste. 
                      Você só será cobrado após 7 dias.
                    </p>
                  </div>
                  
                  <div>
                    <Label htmlFor="card_number">Número do cartão</Label>
                    <Input
                      id="card_number"
                      value={card.number}
                      onChange={(e) => setCard(prev => ({ 
                        ...prev, 
                        number: formatCardNumber(e.target.value) 
                      }))}
                      placeholder="0000 0000 0000 0000"
                      maxLength={19}
                    />
                  </div>
                  <div>
                    <Label htmlFor="holder_name">Nome no cartão</Label>
                    <Input
                      id="holder_name"
                      value={card.holder_name}
                      onChange={(e) => setCard(prev => ({ 
                        ...prev, 
                        holder_name: e.target.value.toUpperCase() 
                      }))}
                      placeholder="NOME COMO NO CARTÃO"
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <Label htmlFor="exp_month">Mês</Label>
                      <Input
                        id="exp_month"
                        value={card.exp_month}
                        onChange={(e) => setCard(prev => ({ 
                          ...prev, 
                          exp_month: e.target.value.replace(/\D/g, '').substring(0, 2)
                        }))}
                        placeholder="MM"
                        maxLength={2}
                      />
                    </div>
                    <div>
                      <Label htmlFor="exp_year">Ano</Label>
                      <Input
                        id="exp_year"
                        value={card.exp_year}
                        onChange={(e) => setCard(prev => ({ 
                          ...prev, 
                          exp_year: e.target.value.replace(/\D/g, '').substring(0, 4)
                        }))}
                        placeholder="AAAA"
                        maxLength={4}
                      />
                    </div>
                    <div>
                      <Label htmlFor="cvv">CVV</Label>
                      <Input
                        id="cvv"
                        type="password"
                        value={card.cvv}
                        onChange={(e) => setCard(prev => ({ 
                          ...prev, 
                          cvv: e.target.value.replace(/\D/g, '').substring(0, 4)
                        }))}
                        placeholder="***"
                        maxLength={4}
                      />
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="pix" className="mt-4">
                  <div className="bg-muted rounded-lg p-4 text-center space-y-2">
                    <QrCode className="h-12 w-12 mx-auto text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">
                      Ao confirmar, um QR Code PIX será gerado para pagamento imediato.
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Pagamento via PIX não inclui período de teste gratuito.
                    </p>
                  </div>
                </TabsContent>
              </Tabs>
            </div>

            {/* Submit */}
            <Button type="submit" className="w-full" size="lg" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processando...
                </>
              ) : paymentMethod === 'credit_card' ? (
                'Iniciar teste grátis de 7 dias'
              ) : (
                'Gerar QR Code PIX'
              )}
            </Button>

            <p className="text-xs text-center text-muted-foreground">
              Pagamento processado de forma segura.
              <br />
              Ao assinar, você concorda com nossos termos de uso.
            </p>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
