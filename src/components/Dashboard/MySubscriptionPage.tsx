import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useSubscription } from '@/hooks/useSubscription';
import { 
  CreditCard, Receipt, Clock, ChevronRight, Download, FileArchive,
  CheckCircle2, XCircle, AlertCircle, RefreshCw, Crown, Sparkles, ShieldCheck
} from 'lucide-react';
import { generateSalesDefensePDF } from '@/utils/salesPdfGenerator';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';

interface Payment {
  id: string;
  amount: number;
  currency: string;
  status: string;
  payment_method: string | null;
  card_brand: string | null;
  card_last_digits: string | null;
  description: string | null;
  invoice_url: string | null;
  paid_at: string | null;
  due_date: string | null;
  created_at: string;
}

const statusConfig: Record<string, { label: string; icon: any; className: string }> = {
  paid: { label: 'Pago', icon: CheckCircle2, className: 'text-emerald-600 bg-emerald-500/10' },
  pending: { label: 'Pendente', icon: Clock, className: 'text-amber-600 bg-amber-500/10' },
  failed: { label: 'Falhou', icon: XCircle, className: 'text-destructive bg-destructive/10' },
  refunded: { label: 'Estornado', icon: RefreshCw, className: 'text-muted-foreground bg-muted' },
};

const methodLabels: Record<string, string> = {
  credit_card: 'Cartão de Crédito',
  pix: 'PIX',
  boleto: 'Boleto',
};

export default function MySubscriptionPage() {
  const { user } = useAuth();
  const subscription = useSubscription();
  const navigate = useNavigate();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [sub, setSub] = useState<any>(null);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      // Get company
      const { data: cu } = await supabase
        .from('company_users')
        .select('company_id')
        .eq('user_id', user.id)
        .limit(1)
        .single();

      if (!cu) { setLoading(false); return; }
      setCompanyId(cu.company_id);

      // Get subscription details
      const [subRes, payRes] = await Promise.all([
        supabase.from('subscriptions').select('*').eq('company_id', cu.company_id).single(),
        supabase.from('subscription_payments').select('*').eq('company_id', cu.company_id).order('created_at', { ascending: false }).limit(50),
      ]);

      if (subRes.data) setSub(subRes.data);
      if (payRes.data) setPayments(payRes.data as Payment[]);
      setLoading(false);
    };
    load();
  }, [user]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(amount);
  };

  const planLabel = subscription.isFree ? 'Free' : subscription.planType === 'business' ? 'Business' : subscription.planType.charAt(0).toUpperCase() + subscription.planType.slice(1);

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto px-4 md:px-6 pt-2 pb-24 md:py-6">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-xl font-bold text-foreground">Minha Assinatura</h1>
          <p className="text-xs text-muted-foreground">Pagamentos, faturas e histórico de cobrança</p>
        </div>

        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="rounded-2xl border border-border/60 bg-card p-5 animate-pulse">
                <div className="h-4 bg-muted rounded w-1/3 mb-3" />
                <div className="h-3 bg-muted rounded w-1/2" />
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-4">
            {/* Active Plan Card */}
            <div className="rounded-2xl border border-border/60 bg-card p-4 md:p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center">
                    {subscription.isFree ? <Sparkles className="h-4.5 w-4.5 text-muted-foreground" /> : <Crown className="h-4.5 w-4.5 text-[#64748b]" />}
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-foreground">Plano {planLabel}</h2>
                    <p className="text-[10px] text-muted-foreground">
                      {subscription.isFree ? 'Plano gratuito' : `${subscription.billingCycle === 'yearly' ? 'Anual' : 'Mensal'} · ${formatCurrency(subscription.monthlyPrice)}/${subscription.billingCycle === 'yearly' ? 'ano' : 'mês'}`}
                    </p>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate('/dashboard/assinatura')}
                  className="h-7 text-[10px] rounded-lg gap-1"
                >
                  Alterar plano <ChevronRight className="h-3 w-3" />
                </Button>
              </div>

              {/* Subscription details */}
              {sub && !subscription.isFree && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <DetailBlock label="Status" value={subscription.status === 'active' ? 'Ativo' : subscription.isTrialActive ? `Trial (${subscription.trialDaysRemaining}d)` : subscription.status} />
                  <DetailBlock label="Ciclo" value={subscription.billingCycle === 'yearly' ? 'Anual' : 'Mensal'} />
                  <DetailBlock label="Próxima cobrança" value={sub.current_period_end ? format(new Date(sub.current_period_end), 'dd/MM/yyyy') : '—'} />
                  <DetailBlock label="Desde" value={sub.created_at ? format(new Date(sub.created_at), 'dd/MM/yyyy') : '—'} />
                </div>
              )}
            </div>

            {/* Payment Method */}
            <div className="rounded-2xl border border-border/60 bg-card p-4 md:p-5">
              <h3 className="text-xs font-semibold text-foreground mb-3 flex items-center gap-2">
                <CreditCard className="h-3.5 w-3.5 text-muted-foreground" />
                Método de Pagamento
              </h3>
              {sub?.pagarme_customer_id ? (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-7 rounded bg-muted flex items-center justify-center">
                      <CreditCard className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="text-xs font-medium text-foreground">Cartão de crédito</p>
                      <p className="text-[10px] text-muted-foreground">
                        {payments.length > 0 && payments[0].card_brand
                          ? `${payments[0].card_brand.toUpperCase()} •••• ${payments[0].card_last_digits || '****'}`
                          : 'Cadastrado via Pagar.me'}
                      </p>
                    </div>
                  </div>
                  <span className="text-[9px] font-medium px-1.5 py-px rounded-full bg-emerald-500/10 text-emerald-600">Ativo</span>
                </div>
              ) : (
                <div className="text-center py-4">
                  <CreditCard className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
                  <p className="text-xs text-muted-foreground mb-3">Nenhum método de pagamento cadastrado</p>
                  <Button
                    size="sm"
                    onClick={() => navigate('/checkout/ativar')}
                    className="h-8 text-xs rounded-xl gap-1.5 bg-[#64748b] hover:bg-[#475569] text-white"
                  >
                    <CreditCard className="h-3.5 w-3.5" />
                    Cadastrar cartão
                  </Button>
                </div>
              )}
            </div>

            {/* Payment History */}
            <div className="rounded-2xl border border-border/60 bg-card p-4 md:p-5 relative">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xs font-semibold text-foreground flex items-center gap-2">
                  <Receipt className="h-3.5 w-3.5 text-muted-foreground" />
                  Histórico de Pagamentos
                </h3>
                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={async () => {
                      const { data } = await supabase
                        .from('subscriptions')
                        .select('company_id, plan_type, monthly_price, created_at, status, companies(name)')
                        .filter('monthly_price', 'gt', 0);
                      
                      if (data) {
                        const formatted = data.map((item: any) => ({
                          company_name: item.companies?.name || 'Empresa',
                          contracted_at: item.created_at,
                          monthly_price: item.monthly_price,
                          plan_type: item.plan_type,
                          status: item.status
                        }));
                        generateSalesDefensePDF(formatted);
                      }
                    }}
                    className="h-7 text-[10px] rounded-lg gap-1.5 border-[#DFE4FB] hover:border-[#2F428D] hover:text-[#253573] transition-all text-[#2F428D]"
                  >
                    <ShieldCheck className="h-3 w-3" />
                    Gerar PDF de Defesa
                  </Button>
                  <a href="/downloads/faturas_ellosuit.zip" download="faturas_ellosuit.zip">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="h-7 text-[10px] rounded-lg gap-1.5 border-dashed hover:border-solid transition-all"
                    >
                      <FileArchive className="h-3 w-3" />
                      Baixar Todas (ZIP)
                    </Button>
                  </a>
                </div>
              </div>

              {payments.length === 0 ? (
                <div className="text-center py-8">
                  <Receipt className="h-10 w-10 text-muted-foreground/20 mx-auto mb-2" />
                  <p className="text-xs text-muted-foreground">Nenhum pagamento registrado</p>
                </div>
              ) : (
                <div className="space-y-1">
                  {payments.map((payment) => {
                    const config = statusConfig[payment.status] || statusConfig.pending;
                    const StatusIcon = config.icon;
                    return (
                      <div
                        key={payment.id}
                        className="flex items-center justify-between py-3 px-2 rounded-xl hover:bg-muted/30 transition-colors group"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${config.className}`}>
                            <StatusIcon className="h-3.5 w-3.5" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-medium text-foreground truncate">
                              {payment.description || `Pagamento ${planLabel}`}
                            </p>
                            <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                              <span>{payment.paid_at ? format(new Date(payment.paid_at), "dd/MM/yyyy", { locale: ptBR }) : format(new Date(payment.created_at), "dd/MM/yyyy", { locale: ptBR })}</span>
                              {payment.payment_method && (
                                <>
                                  <span>·</span>
                                  <span>{methodLabels[payment.payment_method] || payment.payment_method}</span>
                                </>
                              )}
                              {payment.card_last_digits && (
                                <>
                                  <span>·</span>
                                  <span>•••• {payment.card_last_digits}</span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 flex-shrink-0">
                          <div className="text-right">
                            <p className="text-xs font-semibold text-foreground">{formatCurrency(payment.amount)}</p>
                            <span className={`text-[9px] font-medium px-1.5 py-px rounded-full ${config.className}`}>
                              {config.label}
                            </span>
                          </div>
                          {payment.invoice_url && (
                            <a href={payment.invoice_url} target="_blank" rel="noopener noreferrer">
                              <Button variant="ghost" size="sm" className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 transition-opacity">
                                <Download className="h-3.5 w-3.5" />
                              </Button>
                            </a>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function DetailBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-muted/40 p-2.5">
      <p className="text-[9px] text-muted-foreground uppercase tracking-wider">{label}</p>
      <p className="text-xs font-semibold text-foreground mt-0.5">{value}</p>
    </div>
  );
}
