import React, { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, Bot, Coins, History, Filter } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';

interface CreditTransaction {
  id: string;
  transaction_type: string;
  amount: number;
  balance_after: number;
  description: string;
  created_at: string;
  agent_id: string | null;
}

const AiCreditsHistoryPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [transactions, setTransactions] = useState<CreditTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');

  useEffect(() => {
    const fetchCompanyId = async () => {
      if (!user?.id) return;
      const { data } = await supabase.from('company_users').select('company_id').eq('user_id', user.id).single();
      if (data?.company_id) setCompanyId(data.company_id);
    };
    fetchCompanyId();
  }, [user?.id]);

  useEffect(() => {
    if (companyId) loadTransactions();
  }, [companyId]);

  const loadTransactions = async () => {
    if (!companyId) return;
    setLoading(true);
    const { data } = await supabase
      .from('ai_credit_transactions')
      .select('*')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false })
      .limit(200);
    setTransactions((data || []) as CreditTransaction[]);
    setLoading(false);
  };

  const filtered = filter === 'all'
    ? transactions
    : transactions.filter(t => t.transaction_type === filter);

  const totalConsumed = transactions
    .filter(t => t.transaction_type === 'consumption')
    .reduce((sum, t) => sum + Math.abs(Number(t.amount)), 0);

  const totalPurchased = transactions
    .filter(t => t.transaction_type === 'purchase')
    .reduce((sum, t) => sum + Number(t.amount), 0);

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard/creditos-ia')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-xl bg-primary/10 text-primary">
              <History className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold">Histórico de Transações</h1>
              <p className="text-muted-foreground text-xs">{filtered.length} transações encontradas</p>
            </div>
          </div>
        </div>
      </div>

      {/* Summary + Filter */}
      <div className="flex flex-col sm:flex-row gap-3">
        <Card className="flex-1 border-primary/20 bg-primary/5">
          <CardContent className="py-3 px-4 flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Total Comprado</span>
            <span className="font-bold text-primary">+{totalPurchased.toFixed(1)}</span>
          </CardContent>
        </Card>
        <Card className="flex-1 border-destructive/20 bg-destructive/5">
          <CardContent className="py-3 px-4 flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Total Consumido</span>
            <span className="font-bold text-destructive">-{totalConsumed.toFixed(1)}</span>
          </CardContent>
        </Card>
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="w-[140px] h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              <SelectItem value="purchase">Compras</SelectItem>
              <SelectItem value="consumption">Consumo</SelectItem>
              <SelectItem value="expiration">Expiração</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Transaction List */}
      {filtered.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center text-muted-foreground">
            <Bot className="h-12 w-12 mx-auto mb-3 opacity-20" />
            <p className="font-medium">Nenhuma transação encontrada</p>
            <p className="text-sm mt-1">As transações aparecerão aqui quando seus agentes começarem a responder.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-1.5">
          {filtered.map((tx) => {
            const isConsumption = tx.transaction_type === 'consumption';
            const isPurchase = tx.transaction_type === 'purchase';
            const isExpiration = tx.transaction_type === 'expiration';

            return (
              <Card key={tx.id} className="border-border/40 hover:border-border/80 transition-colors">
                <CardContent className="py-3 px-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`p-2 rounded-lg shrink-0 ${
                        isConsumption ? 'bg-destructive/10 text-destructive' :
                        isExpiration ? 'bg-[#2F428D]/10 text-[#2F428D]' :
                        'bg-primary/10 text-primary'
                      }`}>
                        {isConsumption ? <Bot className="h-4 w-4" /> : <Coins className="h-4 w-4" />}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{tx.description}</p>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(tx.created_at), "dd 'de' MMM, yyyy 'às' HH:mm", { locale: ptBR })}
                        </p>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className={`font-bold text-sm ${
                        Number(tx.amount) < 0 ? 'text-destructive' : 'text-primary'
                      }`}>
                        {Number(tx.amount) > 0 ? '+' : ''}{Number(tx.amount).toFixed(2)}
                      </p>
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 font-normal">
                        Saldo: {Number(tx.balance_after).toFixed(1)}
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default AiCreditsHistoryPage;
