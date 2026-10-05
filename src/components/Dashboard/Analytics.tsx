
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  TrendingUp, 
  TrendingDown, 
  Mail, 
  Users, 
  Eye, 
  MousePointer, 
  Calendar,
  FileText,
  Activity,
  Target,
  BarChart3,
  PieChart
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

interface AnalyticsProps {
  onNavigate: (page: string) => void;
}

const Analytics = ({ onNavigate }: AnalyticsProps) => {
  const { user } = useAuth();

  const MetricCard = ({ title, value, change, icon: Icon, trend }: any) => (
    <Card className="border-none shadow-lg rounded-2xl bg-white hover:shadow-xl transition-all duration-300">
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-600 mb-2">{title}</p>
            <p className="text-3xl font-bold text-gray-900">{value}</p>
            <div className="flex items-center mt-2">
              {trend === 'up' ? (
                <TrendingUp className="h-4 w-4 text-green-500 mr-1" />
              ) : (
                <TrendingDown className="h-4 w-4 text-red-500 mr-1" />
              )}
              <span className={`text-sm font-medium ${trend === 'up' ? 'text-green-600' : 'text-red-600'}`}>
                {change}
              </span>
            </div>
          </div>
          <div className="p-4 rounded-full bg-[#F0F2FE]">
            <Icon className="h-6 w-6 text-[#2F428D]" />
          </div>
        </div>
      </CardContent>
    </Card>
  );

  if (!user) {
    return (
      <div className="p-6 space-y-8 bg-gray-50 min-h-screen">
        <div className="flex items-center justify-center py-12">
          <p className="text-gray-500">Faça login para ver suas análises</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-8 bg-gray-50 min-h-screen">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Análises</h1>
            <p className="text-base text-gray-600 mt-2">
              Acompanhe o desempenho das suas campanhas e atividades
            </p>
          </div>
          <Button 
            onClick={() => onNavigate('campaign-mail')}
            className="bg-[#2F428D] hover:bg-[#253573] rounded-xl"
          >
            <Target className="h-4 w-4 mr-2" />
            Nova Campanha
          </Button>
        </div>

        {/* Métricas Principais */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <MetricCard 
            title="E-mails Enviados"
            value="0"
            change="0%"
            icon={Mail}
            trend="up"
          />
          <MetricCard 
            title="Taxa de Abertura"
            value="0%"
            change="0%"
            icon={Eye}
            trend="up"
          />
          <MetricCard 
            title="Taxa de Clique"
            value="0%"
            change="0%"
            icon={MousePointer}
            trend="up"
          />
          <MetricCard 
            title="Novos Contatos"
            value="0"
            change="0%"
            icon={Users}
            trend="up"
          />
        </div>

        {/* Gráficos Placeholder */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="border-none shadow-lg rounded-2xl bg-white">
            <CardHeader className="p-6 pb-4">
              <div className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-[#2F428D]" />
                <CardTitle className="text-lg font-semibold">Desempenho de E-mails</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="p-6 pt-0">
              <div className="h-64 flex items-center justify-center bg-gray-50 rounded-xl">
                <div className="text-center">
                  <BarChart3 className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500">Dados aparecerão quando você enviar emails</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-none shadow-lg rounded-2xl bg-white">
            <CardHeader className="p-6 pb-4">
              <div className="flex items-center gap-2">
                <PieChart className="h-5 w-5 text-[#2F428D]" />
                <CardTitle className="text-lg font-semibold">Dispositivos</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="p-6 pt-0">
              <div className="h-64 flex items-center justify-center bg-gray-50 rounded-xl">
                <div className="text-center">
                  <PieChart className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500">Dados aparecerão quando você tiver interações</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Performance das Campanhas */}
        <Card className="border-none shadow-lg rounded-2xl bg-white">
          <CardHeader className="p-6 pb-4">
            <div className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-[#2F428D]" />
              <CardTitle className="text-lg font-semibold">Performance das Campanhas</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="p-6 pt-0">
            <div className="text-center py-12">
              <Activity className="h-12 w-12 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                Nenhuma campanha ainda
              </h3>
              <p className="text-gray-500 mb-4">
                Crie sua primeira campanha para ver as métricas aqui
              </p>
              <Button onClick={() => onNavigate('campaign-mail')}>
                <Target className="h-4 w-4 mr-2" />
                Criar Campanha
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Ações Rápidas */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card 
            className="border-none shadow-lg rounded-2xl bg-white cursor-pointer hover:shadow-xl transition-all duration-300"
            onClick={() => onNavigate('mail-tracking')}
          >
            <CardContent className="p-8 text-center">
              <Eye className="h-12 w-12 text-[#2F428D] mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Rastreamento</h3>
              <p className="text-sm text-gray-600">Ver detalhes dos e-mails enviados</p>
            </CardContent>
          </Card>

          <Card 
            className="border-none shadow-lg rounded-2xl bg-white cursor-pointer hover:shadow-xl transition-all duration-300"
            onClick={() => onNavigate('my-calendar')}
          >
            <CardContent className="p-8 text-center">
              <Calendar className="h-12 w-12 text-green-600 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Agenda</h3>
              <p className="text-sm text-gray-600">Gerenciar compromissos</p>
            </CardContent>
          </Card>

          <Card 
            className="border-none shadow-lg rounded-2xl bg-white cursor-pointer hover:shadow-xl transition-all duration-300"
            onClick={() => onNavigate('documents')}
          >
            <CardContent className="p-8 text-center">
              <FileText className="h-12 w-12 text-purple-600 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Documentos</h3>
              <p className="text-sm text-gray-600">Gerenciar arquivos</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Analytics;
