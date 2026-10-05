import React, { useState } from 'react';
import { Shield, CreditCard, Check, Loader2, Sparkles, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useSubscription } from '@/hooks/useSubscription';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';

const BUSINESS_FEATURES = [
  'CRM WhatsApp (3 sessões)',
  'Email Marketing (10.000/mês)',
  'Agentes de IA (5)',
  'ChatBot Builder',
  'Agenda Online & Tarefas',
  'Videoconferência (15 participantes)',
  'Rastreamento de Docs, Links e Vídeos',
  'Drive (50 GB)',
  '10 usuários incluídos',
  'Suporte prioritário',
];

export default function ActivatePlan() {
  const { user } = useAuth();
  const { isFree, refetch } = useSubscription();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);

  const [customer, setCustomer] = useState({
    name: '',
    document: '',
    phone: '',
  });

  const [card, setCard] = useState({
    number: '',
    holder_name: '',
    exp_month: '',
    exp_year: '',
    cvv: '',
  });

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      if (!customer.name || !customer.document || !customer.phone) {
        throw new Error('Preencha todos os campos obrigatórios');
      }
      if (!card.number || !card.holder_name || !card.exp_month || !card.exp_year || !card.cvv) {
        throw new Error('Preencha todos os dados do cartão');
      }

      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) throw new Error('Você precisa estar logado');

      const response = await supabase.functions.invoke('pagarme-checkout', {
        body: {
          plan_id: 'business',
          billing_cycle: 'monthly',
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

  // If not free, redirect to dashboard
  if (!isFree) {
    navigate('/dashboard');
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 flex items-center justify-center p-4">
      <div className="w-full max-w-4xl grid md:grid-cols-2 gap-8">
        {/* Left - Benefits */}
        <div className="flex flex-col justify-center space-y-8">
          <div>
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary mb-6">
              <Sparkles className="h-4 w-4" />
              <span className="text-sm font-medium">Ellosuit Business</span>
            </div>
            <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-3">
              Desbloqueie todo o potencial
            </h1>
            <p className="text-muted-foreground text-lg">
              Cadastre seu cartão e ganhe <strong className="text-primary">7 dias grátis</strong> para testar todas as funcionalidades.
            </p>
          </div>

          <div className="space-y-3">
            {BUSINESS_FEATURES.map((feature, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Check className="h-3 w-3 text-primary" />
                </div>
                <span className="text-sm text-foreground">{feature}</span>
              </div>
            ))}
          </div>

          <div className="bg-muted/50 rounded-xl p-4 border border-border">
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold text-foreground">R$ 297</span>
              <span className="text-muted-foreground">/mês</span>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              Após os 7 dias de teste. Cancele a qualquer momento.
            </p>
          </div>
        </div>

        {/* Right - Card Form */}
        <Card className="shadow-xl border-border">
          <CardContent className="p-6 md:p-8">
            <div className="flex items-center gap-2 mb-6">
              <Shield className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-semibold text-foreground">Ativar Teste Grátis</h2>
            </div>

            <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 mb-6 text-sm">
              <div className="flex items-center gap-2 text-primary font-medium">
                <CreditCard className="h-4 w-4" />
                Nenhuma cobrança agora
              </div>
              <p className="text-muted-foreground mt-1">
                Você só será cobrado após 7 dias. Cancele quando quiser.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
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
                  onChange={(e) => setCustomer(prev => ({ ...prev, document: formatDocument(e.target.value) }))}
                  placeholder="000.000.000-00"
                  required
                />
              </div>
              <div>
                <Label htmlFor="phone">Telefone *</Label>
                <Input
                  id="phone"
                  value={customer.phone}
                  onChange={(e) => setCustomer(prev => ({ ...prev, phone: formatPhone(e.target.value) }))}
                  placeholder="(11) 99999-9999"
                  required
                />
              </div>

              <div className="pt-2 border-t border-border">
                <h3 className="font-medium text-foreground mb-3 flex items-center gap-2">
                  <CreditCard className="h-4 w-4" />
                  Dados do cartão
                </h3>
                <div className="space-y-3">
                  <div>
                    <Label htmlFor="card_number">Número do cartão</Label>
                    <Input
                      id="card_number"
                      value={card.number}
                      onChange={(e) => setCard(prev => ({ ...prev, number: formatCardNumber(e.target.value) }))}
                      placeholder="0000 0000 0000 0000"
                      maxLength={19}
                    />
                  </div>
                  <div>
                    <Label htmlFor="holder_name">Nome no cartão</Label>
                    <Input
                      id="holder_name"
                      value={card.holder_name}
                      onChange={(e) => setCard(prev => ({ ...prev, holder_name: e.target.value.toUpperCase() }))}
                      placeholder="NOME COMO NO CARTÃO"
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <Label htmlFor="exp_month">Mês</Label>
                      <Input
                        id="exp_month"
                        value={card.exp_month}
                        onChange={(e) => setCard(prev => ({ ...prev, exp_month: e.target.value.replace(/\D/g, '').substring(0, 2) }))}
                        placeholder="MM"
                        maxLength={2}
                      />
                    </div>
                    <div>
                      <Label htmlFor="exp_year">Ano</Label>
                      <Input
                        id="exp_year"
                        value={card.exp_year}
                        onChange={(e) => setCard(prev => ({ ...prev, exp_year: e.target.value.replace(/\D/g, '').substring(0, 4) }))}
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
                        onChange={(e) => setCard(prev => ({ ...prev, cvv: e.target.value.replace(/\D/g, '').substring(0, 4) }))}
                        placeholder="***"
                        maxLength={4}
                      />
                    </div>
                  </div>
                </div>
              </div>

              <Button type="submit" className="w-full h-12 text-base" size="lg" disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Processando...
                  </>
                ) : (
                  <>
                    Ativar 7 dias grátis
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </>
                )}
              </Button>

              <p className="text-xs text-center text-muted-foreground">
                Pagamento processado de forma segura.
                <br />
                Ao continuar, você concorda com nossos termos de uso.
              </p>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
