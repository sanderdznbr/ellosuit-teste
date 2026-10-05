
import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { Mail, Eye, MousePointer, TrendingUp } from 'lucide-react';

interface EmailStatsData {
  total_emails: number;
  total_opened: number;
  total_clicked: number;
  open_rate: number;
  click_rate: number;
}

const EmailStats = () => {
  const [stats, setStats] = useState<EmailStatsData>({
    total_emails: 0,
    total_opened: 0,
    total_clicked: 0,
    open_rate: 0,
    click_rate: 0
  });
  const [isLoading, setIsLoading] = useState(true);

  const fetchStats = async () => {
    try {
      // Buscar total de emails enviados
      const { count: totalEmails } = await supabase
        .from('emails')
        .select('*', { count: 'exact', head: true });

      // Buscar emails únicos que foram abertos
      const { data: openedEmails } = await supabase
        .from('email_events')
        .select('email_id')
        .eq('event_type', 'opened');

      // Buscar emails únicos que tiveram cliques
      const { data: clickedEmails } = await supabase
        .from('email_events')
        .select('email_id')
        .eq('event_type', 'clicked');

      const uniqueOpened = new Set(openedEmails?.map(e => e.email_id) || []).size;
      const uniqueClicked = new Set(clickedEmails?.map(e => e.email_id) || []).size;
      
      const total = totalEmails || 0;
      const opened = uniqueOpened;
      const clicked = uniqueClicked;

      setStats({
        total_emails: total,
        total_opened: opened,
        total_clicked: clicked,
        open_rate: total > 0 ? (opened / total) * 100 : 0,
        click_rate: total > 0 ? (clicked / total) * 100 : 0
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
    
    // Configurar atualização em tempo real
    const channel = supabase
      .channel('email-stats')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'emails'
      }, () => {
        fetchStats();
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'email_events'
      }, () => {
        fetchStats();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const statCards = [
    {
      title: 'Emails Enviados',
      value: stats.total_emails,
      icon: Mail,
      color: 'text-[#2F428D]'
    },
    {
      title: 'Emails Abertos',
      value: stats.total_opened,
      icon: Eye,
      color: 'text-green-600'
    },
    {
      title: 'Taxa de Abertura',
      value: `${stats.open_rate.toFixed(1)}%`,
      icon: TrendingUp,
      color: 'text-purple-600'
    },
    {
      title: 'Taxa de Clique',
      value: `${stats.click_rate.toFixed(1)}%`,
      icon: MousePointer,
      color: 'text-[#253573]'
    }
  ];

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="p-6">
              <div className="h-20 bg-gray-200 rounded"></div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {statCards.map((stat, index) => {
        const Icon = stat.icon;
        return (
          <Card key={index}>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 mb-1">
                    {stat.title}
                  </p>
                  <p className="text-2xl font-bold">
                    {stat.value}
                  </p>
                </div>
                <Icon className={`h-8 w-8 ${stat.color}`} />
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};

export default EmailStats;
