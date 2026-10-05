import React, { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import { Coins, TrendingDown, ArrowRight, History, MessageSquare, Info, Plus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';

interface CreditBalance {
  balance: number;
  total_purchased: number;
  total_consumed: number;
}

interface CreditPackage {
  id: string;
  name: string;
  credits: number;
  price_brl: number;
  description: string;
  is_popular: boolean;
}

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.07 } },
};
const item = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35 } },
};

const AiCreditsPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [balance, setBalance] = useState<CreditBalance | null>(null);
  const [packages, setPackages] = useState<CreditPackage[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCompanyId = async () => {
      if (!user?.id) return;
      const { data } = await supabase.from('company_users').select('company_id').eq('user_id', user.id).single();
      if (data?.company_id) setCompanyId(data.company_id);
    };
    fetchCompanyId();
  }, [user?.id]);

  useEffect(() => {
    if (companyId) loadData();
  }, [companyId]);

  const loadData = async () => {
    if (!companyId) return;
    setLoading(true);
    const [balRes, pkgRes] = await Promise.all([
      supabase.from('ai_credit_balances').select('*').eq('company_id', companyId).maybeSingle(),
      supabase.from('ai_credit_packages').select('*').eq('is_active', true).order('sort_order'),
    ]);
    if (balRes.data) {
      setBalance({ balance: Number(balRes.data.balance), total_purchased: Number(balRes.data.total_purchased), total_consumed: Number(balRes.data.total_consumed) });
    } else {
      setBalance({ balance: 0, total_purchased: 0, total_consumed: 0 });
    }
    setPackages((pkgRes.data || []) as CreditPackage[]);
    setLoading(false);
  };

  const handlePurchase = async (pkg: CreditPackage) => {
    if (!companyId) return;
    const { error } = await supabase.rpc('add_ai_credits', {
      p_company_id: companyId,
      p_amount: pkg.credits,
      p_description: `Compra: ${pkg.name} (${pkg.credits} créditos)`,
    });
    if (error) {
      toast.error('Erro ao adicionar créditos');
    } else {
      toast.success(`${pkg.credits} créditos adicionados!`);
      loadData();
    }
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  const usagePercent = balance && balance.total_purchased > 0
    ? Math.min(100, (balance.total_consumed / balance.total_purchased) * 100)
    : 0;
  const messagesAvailable = Math.floor((balance?.balance || 0) / 0.10);

  return (
    <motion.div
      variants={container}
      initial="hidden"
      animate="show"
      className="max-w-5xl mx-auto p-4 md:p-6 space-y-8"
    >
      {/* Header */}
      <motion.div variants={item} className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Créditos de IA</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Gerencie o consumo dos seus agentes</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="gap-2 rounded-full"
          onClick={() => navigate('/dashboard/creditos-ia/historico')}
        >
          <History className="h-4 w-4" />
          <span className="hidden sm:inline">Histórico</span>
        </Button>
      </motion.div>

      {/* Balance Row */}
      <motion.div variants={item} className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Hero balance */}
        <Card className="rounded-3xl border-0 bg-gradient-to-br from-primary to-primary/80 shadow-lg overflow-hidden relative">
          <CardContent className="p-6 relative z-10">
            <p className="text-xs uppercase tracking-widest text-white/70 font-semibold">Saldo disponível</p>
            <p className="text-5xl font-extrabold mt-2 tabular-nums text-white">
              {balance?.balance.toFixed(1) || '0.0'}
            </p>
            <p className="text-sm text-white/60 mt-1">créditos</p>
            <div className="mt-5 flex items-center gap-2 text-white/80 text-sm">
              <MessageSquare className="h-4 w-4" />
              <span>{messagesAvailable.toLocaleString('pt-BR')} mensagens restantes</span>
            </div>
          </CardContent>
        </Card>

        {/* Purchased */}
        <Card className="rounded-3xl border border-border/40">
          <CardContent className="p-6 flex flex-col justify-between h-full">
            <div className="flex items-center justify-between">
              <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold">Adquirido</p>
              <Plus className="h-4 w-4 text-muted-foreground/40" />
            </div>
            <div className="mt-4">
              <p className="text-4xl font-extrabold tabular-nums">{balance?.total_purchased.toFixed(0) || '0'}</p>
              <p className="text-xs text-muted-foreground mt-1">créditos comprados</p>
            </div>
          </CardContent>
        </Card>

        {/* Consumed */}
        <Card className="rounded-3xl border border-border/40">
          <CardContent className="p-6 flex flex-col justify-between h-full">
            <div className="flex items-center justify-between">
              <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold">Utilizado</p>
              <TrendingDown className="h-4 w-4 text-muted-foreground/40" />
            </div>
            <div className="mt-4">
              <p className="text-4xl font-extrabold tabular-nums">{balance?.total_consumed.toFixed(0) || '0'}</p>
              {balance && balance.total_purchased > 0 && (
                <div className="mt-3">
                  <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
                    <span>Uso</span>
                    <span>{usagePercent.toFixed(0)}%</span>
                  </div>
                  <Progress value={usagePercent} className="h-1.5 rounded-full" />
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Packages */}
      <motion.div variants={item}>
        <h2 className="text-base font-semibold mb-4 text-foreground">Recarregar</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {packages.map((pkg, i) => {
            const pricePerMessage = (pkg.price_brl / pkg.credits) * 0.10;
            const messagesCount = Math.floor(pkg.credits / 0.10);

            return (
              <motion.div
                key={pkg.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 + i * 0.08, duration: 0.35 }}
              >
                <Card
                  className={`rounded-3xl relative transition-all duration-300 hover:shadow-xl hover:-translate-y-1 group ${
                    pkg.is_popular
                      ? 'border-2 border-primary shadow-md'
                      : 'border border-border/50 hover:border-primary/40'
                  }`}
                >
                  {pkg.is_popular && (
                    <Badge className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground text-[10px] px-3 rounded-full shadow">
                      Recomendado
                    </Badge>
                  )}
                  <CardContent className="p-5 pt-6 space-y-4">
                    <div>
                      <p className="font-semibold text-foreground">{pkg.name}</p>
                      <p className="text-xs text-muted-foreground">{pkg.description}</p>
                    </div>
                    <div className="text-center py-1">
                      <span className="text-xs text-muted-foreground">R$ </span>
                      <span className="text-3xl font-extrabold tabular-nums text-foreground">
                        {Math.floor(pkg.price_brl)}
                      </span>
                      <span className="text-sm text-muted-foreground">,{((pkg.price_brl % 1) * 100).toFixed(0).padStart(2, '0')}</span>
                    </div>
                    <div className="space-y-2 text-xs text-muted-foreground border-t border-border/40 pt-3">
                      <div className="flex justify-between">
                        <span>Créditos</span>
                        <span className="font-medium text-foreground">{pkg.credits.toLocaleString('pt-BR')}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Mensagens</span>
                        <span className="font-medium text-foreground">{messagesCount.toLocaleString('pt-BR')}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Custo/msg</span>
                        <span className="font-medium text-primary">R$ {pricePerMessage.toFixed(3)}</span>
                      </div>
                    </div>
                  </CardContent>
                  <CardFooter className="px-5 pb-5 pt-0">
                    <Button
                      className="w-full rounded-2xl gap-2 font-semibold transition-transform group-hover:scale-[1.02]"
                      variant={pkg.is_popular ? 'default' : 'outline'}
                      onClick={() => handlePurchase(pkg)}
                    >
                      Comprar <ArrowRight className="h-4 w-4" />
                    </Button>
                  </CardFooter>
                </Card>
              </motion.div>
            );
          })}
        </div>
      </motion.div>

      {/* Info */}
      <motion.div variants={item}>
        <Card className="rounded-3xl border border-border/30 bg-muted/20">
          <CardContent className="p-5">
            <div className="flex items-start gap-3">
              <Info className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
              <div className="space-y-1 text-sm text-muted-foreground">
                <p>Cada resposta do agente consome <span className="font-medium text-foreground">0,10 créditos</span>. Créditos são descontados automaticamente. Se acabarem, os agentes pausam até nova recarga. Você inicia com <span className="font-medium text-foreground">10 créditos gratuitos</span>.</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  );
};

export default AiCreditsPage;
