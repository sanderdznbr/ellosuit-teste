
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Mail, 
  TrendingUp, 
  Clock, 
  CheckCircle, 
  AlertCircle,
  Calendar,
  Target,
  Activity,
  BarChart3,
  Users,
  Zap
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface EmailMetrics {
  total_sent: number;
  total_opened: number;
  total_clicked: number;
  total_replied: number;
  open_rate: number;
  click_rate: number;
  reply_rate: number;
}

interface ProductivityData {
  daily_emails: number;
  weekly_emails: number;
  monthly_emails: number;
  avg_response_time: number;
  active_conversations: number;
  completed_tasks: number;
}

const MailProductivity = () => {
  const { user } = useAuth();
  const [selectedPeriod, setSelectedPeriod] = useState('week');
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState<EmailMetrics>({
    total_sent: 0,
    total_opened: 0,
    total_clicked: 0,
    total_replied: 0,
    open_rate: 0,
    click_rate: 0,
    reply_rate: 0
  });
  const [productivity, setProductivity] = useState<ProductivityData>({
    daily_emails: 0,
    weekly_emails: 0,
    monthly_emails: 0,
    avg_response_time: 0,
    active_conversations: 0,
    completed_tasks: 0
  });

  useEffect(() => {
    if (user) {
      fetchEmailProductivity();
    }
  }, [user, selectedPeriod]);

  const fetchEmailProductivity = async () => {
    try {
      setLoading(true);
      
      // Get user's company
      const { data: companyUser } = await supabase
        .from('company_users')
        .select('company_id')
        .eq('user_id', user?.id)
        .single();

      if (!companyUser) {
        console.log('No company found for user');
        return;
      }

      // Reset all metrics to zero (no real data available yet)
      setMetrics({
        total_sent: 0,
        total_opened: 0,
        total_clicked: 0,
        total_replied: 0,
        open_rate: 0,
        click_rate: 0,
        reply_rate: 0
      });

      setProductivity({
        daily_emails: 0,
        weekly_emails: 0,
        monthly_emails: 0,
        avg_response_time: 0,
        active_conversations: 0,
        completed_tasks: 0
      });

    } catch (error) {
      console.error('Error fetching email productivity:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatResponseTime = (minutes: number) => {
    if (minutes < 60) {
      return `${minutes}min`;
    }
    const hours = Math.floor(minutes / 60);
    return `${hours}h`;
  };

  if (loading) {
    return (
      <div className="p-6 space-y-8 bg-gray-50 min-h-screen">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Produtividade de Email</h1>
          <p className="text-base text-gray-600 mt-2">Analisando métricas...</p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="border-none shadow-lg rounded-2xl bg-white animate-pulse">
              <CardContent className="p-6">
                <div className="h-20 bg-gray-200 rounded-xl"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-8 bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Produtividade de Email</h1>
          <p className="text-base text-gray-600 mt-2">Acompanhe suas métricas de email e produtividade</p>
        </div>
        
        <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
          <SelectTrigger className="w-40 rounded-xl">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="rounded-xl">
            <SelectItem value="day">Hoje</SelectItem>
            <SelectItem value="week">Esta Semana</SelectItem>
            <SelectItem value="month">Este Mês</SelectItem>
            <SelectItem value="quarter">Este Trimestre</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Main Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="border-none shadow-lg rounded-2xl bg-white">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Emails Enviados</p>
                <p className="text-3xl font-bold text-gray-900">{metrics.total_sent}</p>
                <p className="text-sm text-gray-500 mt-1">Este período</p>
              </div>
              <div className="p-4 rounded-full bg-[#F0F2FE]">
                <Mail className="h-6 w-6 text-[#2F428D]" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-lg rounded-2xl bg-white">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Taxa de Abertura</p>
                <p className="text-3xl font-bold text-gray-900">{metrics.open_rate}%</p>
                <p className="text-sm text-gray-500 mt-1">De {metrics.total_sent} enviados</p>
              </div>
              <div className="p-4 rounded-full bg-green-50">
                <TrendingUp className="h-6 w-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-lg rounded-2xl bg-white">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Taxa de Cliques</p>
                <p className="text-3xl font-bold text-gray-900">{metrics.click_rate}%</p>
                <p className="text-sm text-gray-500 mt-1">De {metrics.total_opened} abertos</p>
              </div>
              <div className="p-4 rounded-full bg-purple-50">
                <Target className="h-6 w-6 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-lg rounded-2xl bg-white">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Tempo de Resposta</p>
                <p className="text-3xl font-bold text-gray-900">{formatResponseTime(productivity.avg_response_time)}</p>
                <p className="text-sm text-gray-500 mt-1">Tempo médio</p>
              </div>
              <div className="p-4 rounded-full bg-[#F0F2FE]">
                <Clock className="h-6 w-6 text-[#253573]" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Analytics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Productivity Overview */}
        <Card className="border-none shadow-lg rounded-2xl bg-white">
          <CardHeader className="p-6 pb-4">
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Visão Geral da Produtividade
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6 pt-0 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-[#F0F2FE] p-6 rounded-2xl">
                <div className="flex items-center gap-3">
                  <Mail className="h-8 w-8 text-[#2F428D]" />
                  <div>
                    <p className="text-3xl font-bold text-[#2F428D]">{productivity.daily_emails}</p>
                    <p className="text-sm text-[#253573]">Emails Hoje</p>
                  </div>
                </div>
              </div>
              
              <div className="bg-green-50 p-6 rounded-2xl">
                <div className="flex items-center gap-3">
                  <Users className="h-8 w-8 text-green-600" />
                  <div>
                    <p className="text-3xl font-bold text-green-600">{productivity.active_conversations}</p>
                    <p className="text-sm text-green-700">Conversas Ativas</p>
                  </div>
                </div>
              </div>
              
              <div className="bg-purple-50 p-6 rounded-2xl">
                <div className="flex items-center gap-3">
                  <CheckCircle className="h-8 w-8 text-purple-600" />
                  <div>
                    <p className="text-3xl font-bold text-purple-600">{productivity.completed_tasks}</p>
                    <p className="text-sm text-purple-700">Tarefas Concluídas</p>
                  </div>
                </div>
              </div>
              
              <div className="bg-[#F0F2FE] p-6 rounded-2xl">
                <div className="flex items-center gap-3">
                  <Zap className="h-8 w-8 text-[#253573]" />
                  <div>
                    <p className="text-3xl font-bold text-[#253573]">{productivity.weekly_emails}</p>
                    <p className="text-sm text-[#1A2551]">Emails na Semana</p>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Email Performance */}
        <Card className="border-none shadow-lg rounded-2xl bg-white">
          <CardHeader className="p-6 pb-4">
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Performance de Email
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6 pt-0 space-y-4">
            <div className="space-y-3">
              <div>
                <div className="flex justify-between items-center mb-1">
                  <span className="text-base font-medium">Taxa de Abertura</span>
                  <span className="text-base text-gray-600">{metrics.open_rate}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-green-600 h-2 rounded-full" 
                    style={{ width: `${metrics.open_rate}%` }}
                  ></div>
                </div>
              </div>
              
              <div>
                <div className="flex justify-between items-center mb-1">
                  <span className="text-base font-medium">Taxa de Cliques</span>
                  <span className="text-base text-gray-600">{metrics.click_rate}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-[#2F428D] h-2 rounded-full" 
                    style={{ width: `${metrics.click_rate}%` }}
                  ></div>
                </div>
              </div>
              
              <div>
                <div className="flex justify-between items-center mb-1">
                  <span className="text-base font-medium">Taxa de Resposta</span>
                  <span className="text-base text-gray-600">{metrics.reply_rate}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-purple-600 h-2 rounded-full" 
                    style={{ width: `${metrics.reply_rate}%` }}
                  ></div>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t">
              <div className="text-center">
                <p className="text-base text-gray-600 mb-2">Status do Sistema</p>
                <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 rounded-full">
                  Aguardando Dados
                </Badge>
                <p className="text-sm text-gray-500 mt-2">
                  Os dados serão coletados conforme você usa o sistema de email
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Call to Action */}
      <Card className="border-2 border-dashed border-gray-300 rounded-2xl">
        <CardContent className="p-8 text-center">
          <Mail className="h-16 w-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-xl font-semibold mb-2">Comece a Usar o Sistema de Email</h3>
          <p className="text-base text-gray-600 mb-6">
            Conecte sua conta de email e comece a enviar campanhas para ver suas métricas de produtividade aqui.
          </p>
          <div className="flex justify-center gap-4">
            <Button className="rounded-xl">
              <Mail className="h-4 w-4 mr-2" />
              Configurar Email
            </Button>
            <Button variant="outline" className="rounded-xl">
              <BarChart3 className="h-4 w-4 mr-2" />
              Ver Tutorial
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default MailProductivity;
