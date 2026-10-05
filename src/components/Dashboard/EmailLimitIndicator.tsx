import React, { useState, useEffect } from 'react';
import { Progress } from '@/components/ui/progress';
import { AlertTriangle, Mail, AlertCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';

interface EmailLimitIndicatorProps {
  className?: string;
  showDetails?: boolean;
}

const EmailLimitIndicator: React.FC<EmailLimitIndicatorProps> = ({ 
  className = '', 
  showDetails = true 
}) => {
  const [sentCount, setSentCount] = useState(0);
  const [dailyLimit, setDailyLimit] = useState(500);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    const fetchLimits = async () => {
      if (!user) return;

      try {
        const today = new Date().toISOString().split('T')[0];
        
        const { data, error } = await supabase
          .from('email_send_limits')
          .select('sent_count, daily_limit')
          .eq('user_id', user.id)
          .eq('date', today)
          .maybeSingle();

        if (!error && data) {
          setSentCount(data.sent_count);
          setDailyLimit(data.daily_limit);
        } else {
          setSentCount(0);
        }
      } catch (error) {
        console.error('Error fetching email limits:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchLimits();
  }, [user]);

  const percentage = dailyLimit > 0 ? (sentCount / dailyLimit) * 100 : 0;
  const remaining = dailyLimit - sentCount;
  const isNearLimit = percentage >= 80;
  const isAtLimit = sentCount >= dailyLimit;

  if (loading) {
    return null;
  }

  if (!showDetails) {
    return (
      <div className={cn("flex items-center gap-2", className)}>
        <div className="h-1.5 w-24 bg-gray-200 dark:bg-white/10 rounded-full overflow-hidden">
          <div 
            className="h-full bg-[#374DA4] transition-all duration-1000 ease-out"
            style={{ width: `${percentage}%` }}
          />
        </div>
        <span className="text-[10px] font-bold text-muted-foreground tracking-tighter uppercase">
          {sentCount}/{dailyLimit} <span className="hidden xs:inline">ENVIADOS</span>
        </span>
      </div>
    );
  }

  return (
    <div className={cn("space-y-4", className)}>
      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <p className="text-sm font-bold text-foreground tracking-tight">Capacidade Diária</p>
          <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-widest">Reseta em 24h</p>
        </div>
        <div className="text-right">
          <p className="text-lg font-black text-[#374DA4] leading-none">{sentCount}</p>
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-tighter">de {dailyLimit} emails</p>
        </div>
      </div>
      
      <div className="space-y-2">
        <div className="h-3 w-full bg-gray-100 dark:bg-white/5 rounded-full overflow-hidden border border-border/40 p-0.5">
          <div 
            className={cn(
              "h-full rounded-full transition-all duration-1000 ease-out shadow-sm",
              isAtLimit ? "bg-red-500 shadow-red-500/20" : isNearLimit ? "bg-amber-500 shadow-amber-500/20" : "bg-gradient-to-r from-[#374DA4] to-[#4c6ef5] shadow-[#374DA4]/20"
            )}
            style={{ width: `${percentage}%` }}
          />
        </div>
        <div className="flex justify-between text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
          <span>{percentage.toFixed(0)}% utilizado</span>
          <span>{remaining} restantes</span>
        </div>
      </div>
      
      {isNearLimit && (
        <div className={cn(
          "flex items-center gap-2 p-3 rounded-2xl animate-pulse",
          isAtLimit ? "bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/30" : "bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-900/30"
        )}>
          {isAtLimit ? <AlertTriangle className="h-3.5 w-3.5 text-red-600 dark:text-red-400" /> : <AlertCircle className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />}
          <p className={cn(
            "text-[10px] font-bold uppercase tracking-tight",
            isAtLimit ? "text-red-700 dark:text-red-300" : "text-amber-700 dark:text-amber-300"
          )}>
            {isAtLimit ? "Limite diário atingido." : "Você está quase atingindo seu limite diário."}
          </p>
        </div>
      )}
    </div>
  );
};

export default EmailLimitIndicator;